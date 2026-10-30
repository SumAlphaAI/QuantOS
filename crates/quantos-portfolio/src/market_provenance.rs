//! Owner-pinned R01/F03 artifact bridge. Approval configuration is a separate
//! authenticated server input; content hashes or client license labels are not authority.
use crate::native_ledger::Scope;
use chrono::{DateTime, Duration, Utc};
use openssl::{hash::MessageDigest, sign::Verifier, x509::X509};
use quantos_core::{ArtifactId, ContentHash, CorrelationId, SchemaVersion, canonical_json_bytes};
use quantos_market::{
    ApprovedProvider, ApprovedProviderRegistry, MarketDataQuality, MarketEvent, MarketEventKind,
    MarketIngestor, RawMarketTick,
};
use quantos_storage::{
    DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
    SnapshotQuality, SnapshotQualityGate, SnapshotQualityRuleset, SnapshotSourceRef, SnapshotUsage,
    default_quality_rules,
    provenance::{SnapshotSourcePolicy, SourceApproval},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeSet;
pub const TRUST: &str = "AUTHENTICATED_R01_F03_TRADING_ARTIFACT_OWNER_PINNED_NOT_LIVE_VENUE";
pub const DOMAIN: &str = "quantos-r01-valuation-artifact-signature/v1";
#[derive(Debug, thiserror::Error)]
#[error("R01_VALUATION_PROVENANCE_REJECTED")]
pub struct Error;
type Result<T> = std::result::Result<T, Error>;
fn digest(v: &impl Serialize) -> Result<ContentHash> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error)?).map_err(|_| Error)?,
    ))
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Policy {
    pub scope: Scope,
    pub revision: u64,
    pub previous_hash: Option<ContentHash>,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub enabled: bool,
    pub purpose: String,
    pub signer: String,
    pub price_scale: u32,
    pub provider: ApprovedProvider,
    pub approval: SourceApproval,
}
impl Policy {
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-r01-valuation-policy/v1", self]))
    }
    pub fn scope_hash(scope: &Scope) -> Result<ContentHash> {
        digest(&json!([
            "quantos-r01-valuation-permission-scope/v1",
            scope,
            "assisted_testnet_valuation"
        ]))
    }
    fn structural(&self) -> Result<()> {
        if self.revision == 0
            || self.expires_at <= self.issued_at
            || self.purpose != "assisted_testnet_valuation"
            || self.price_scale > 18
            || self.signer.len() != 71
            || !self.signer.starts_with("sha256:")
            || self.approval.tenant_id != self.scope.tenant_id
            || self.approval.scope_hash != Self::scope_hash(&self.scope)?
            || self.approval.provider != self.provider.provider
            || self.approval.dataset != self.provider.dataset
            || self.approval.license_label != self.provider.license_label
            || self.approval.approval_reference != self.provider.approval_reference
            || self.approval.approval_version != self.provider.approval_version
            || self.approval.symbols.len() > 16
        {
            return Err(Error);
        }
        ApprovedProviderRegistry::new([self.provider.clone()]).map_err(|_| Error)?;
        SnapshotSourcePolicy::new(vec![self.approval.clone()]).map_err(|_| Error)?;
        Ok(())
    }
    pub fn deadline(&self) -> DateTime<Utc> {
        self.expires_at
            .min(self.provider.expires_at)
            .min(self.approval.expires_at)
    }
    fn live(&self, at: DateTime<Utc>) -> Result<()> {
        self.structural()?;
        if !self.enabled
            || !self.provider.enabled
            || !self.approval.enabled
            || self.issued_at > at
            || at >= self.deadline()
            || !self
                .approval
                .allowed_usages
                .contains(&SnapshotUsage::Trading)
        {
            return Err(Error);
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Artifact {
    pub scope: Scope,
    pub version: u64,
    pub previous_hash: Option<ContentHash>,
    pub policy_hash: ContentHash,
    pub valuation_input_hash: ContentHash,
    pub produced_at: DateTime<Utc>,
    pub ticks: Vec<RawMarketTick>,
    pub events: Vec<MarketEvent>,
    pub snapshot: DataSnapshotRecord,
}
impl Artifact {
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-r01-valuation-artifact/v1", self]))
    }
    pub fn produce(
        policy: &Policy,
        input_hash: ContentHash,
        version: u64,
        previous_hash: Option<ContentHash>,
        ticks: Vec<RawMarketTick>,
        at: DateTime<Utc>,
    ) -> Result<Self> {
        policy.live(at)?;
        let events = normalize(policy, &ticks, at)?;
        let event_hash = digest(&events)?;
        let symbols = events
            .iter()
            .map(|e| e.normalized_symbol.clone())
            .collect::<Vec<_>>();
        let snapshot = DataSnapshotRecord::new(
            policy.scope.tenant_id,
            DataSnapshotInput {
                schema_name: "DataSnapshot".into(),
                schema_version: SchemaVersion::parse("v1").map_err(|_| Error)?,
                schema_entry_id: None,
                window: quantos_storage::SnapshotWindow {
                    start_at: ticks.iter().map(|t| t.event_time).min().ok_or(Error)?,
                    end_at: at,
                },
                sources: symbols
                    .iter()
                    .map(|s| SnapshotSourceRef {
                        source_id: format!("market:{}:{s}", policy.provider.provider),
                        provider: policy.provider.provider.clone(),
                        dataset: policy.provider.dataset.clone(),
                        license_label: policy.provider.license_label.clone(),
                    })
                    .collect(),
                quality: if events
                    .iter()
                    .all(|e| e.quality == MarketDataQuality::Passed)
                {
                    SnapshotQuality::Passed
                } else {
                    SnapshotQuality::Failed
                },
                quality_findings: vec![],
                license_label: policy.provider.license_label.clone(),
                captured_at: at,
                max_age_secs: policy.provider.freshness_sla_secs.min(30),
                symbols,
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".into(),
                    content_hash: event_hash.clone(),
                    storage_bucket: "owned-r01-valuation".into(),
                    object_key: event_hash.to_string(),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "r01_market_events".into(),
                    reference: event_hash.to_string(),
                    details: json!({"count":events.len(),"hash":event_hash}),
                }],
            },
            at,
        )
        .map_err(|_| Error)?;
        Ok(Self {
            scope: policy.scope.clone(),
            version,
            previous_hash,
            policy_hash: policy.content_hash()?,
            valuation_input_hash: input_hash,
            produced_at: at,
            ticks,
            events,
            snapshot,
        })
    }
}
fn normalize(p: &Policy, ticks: &[RawMarketTick], at: DateTime<Utc>) -> Result<Vec<MarketEvent>> {
    if ticks.is_empty() || ticks.len() > 16 {
        return Err(Error);
    }
    let mut ingestor = MarketIngestor::new(
        ApprovedProviderRegistry::new([p.provider.clone()]).map_err(|_| Error)?,
    );
    let mut all = vec![];
    let mut symbols = BTreeSet::new();
    for t in ticks {
        let o = ingestor
            .ingest_tick_at(p.scope.tenant_id, CorrelationId::new(), t.clone(), at)
            .map_err(|_| Error)?;
        let e = o.market_events.first().ok_or(Error)?;
        if o.duplicate || !symbols.insert(e.normalized_symbol.clone()) {
            return Err(Error);
        }
        all.extend(o.market_events);
    }
    Ok(all)
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SignedArtifact {
    pub payload: Artifact,
    pub signature: String,
}
impl SignedArtifact {
    pub fn verify(&self, p: &Policy, certificate: &str) -> Result<()> {
        let cert = X509::from_pem(certificate.as_bytes()).map_err(|_| Error)?;
        if format!(
            "sha256:{}",
            cert.digest(MessageDigest::sha256())
                .map_err(|_| Error)?
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        ) != p.signer
            || self.signature.len() > 8192
            || self.signature.is_empty()
            || !self.signature.len().is_multiple_of(2)
            || !self.signature.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(Error);
        }
        let sig = (0..self.signature.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&self.signature[i..i + 2], 16).map_err(|_| Error))
            .collect::<Result<Vec<_>>>()?;
        let key = cert.public_key().map_err(|_| Error)?;
        let mut v = Verifier::new(MessageDigest::sha256(), &key).map_err(|_| Error)?;
        v.update(&canonical_json_bytes(&json!([DOMAIN, self.payload])).map_err(|_| Error)?)
            .map_err(|_| Error)?;
        if !v.verify(&sig).map_err(|_| Error)? {
            return Err(Error);
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Binding {
    pub policy: Policy,
    pub artifact: SignedArtifact,
    pub certificate: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Summary {
    pub artifact_hash: ContentHash,
    pub artifact_version: u64,
    pub snapshot_hash: ContentHash,
    pub policy_hash: ContentHash,
    pub policy_revision: u64,
    pub provider: String,
    pub dataset: String,
    pub approval_reference: String,
    pub approval_version: String,
    pub approval_document_hash: ContentHash,
    pub scope_hash: ContentHash,
    pub signer: String,
    pub price_scale: u32,
    pub purpose: String,
    pub valid_until: DateTime<Utc>,
    pub trust: String,
}
impl Binding {
    pub fn marks(
        &self,
        scope: &Scope,
        input_hash: &ContentHash,
        at: DateTime<Utc>,
    ) -> Result<(Vec<crate::native_valuation::Mark>, Summary)> {
        let p = &self.policy;
        let a = &self.artifact.payload;
        p.live(at)?;
        let cert = X509::from_pem(self.certificate.as_bytes()).map_err(|_| Error)?;
        let now = openssl::asn1::Asn1Time::from_unix(at.timestamp()).map_err(|_| Error)?;
        let end =
            openssl::asn1::Asn1Time::from_unix(p.deadline().timestamp()).map_err(|_| Error)?;
        if cert.not_before().compare(&now).map_err(|_| Error)? == std::cmp::Ordering::Greater
            || cert.not_after().compare(&now).map_err(|_| Error)? != std::cmp::Ordering::Greater
            || cert.not_after().compare(&end).map_err(|_| Error)? == std::cmp::Ordering::Less
        {
            return Err(Error);
        }
        self.artifact.verify(p, &self.certificate)?;
        if &p.scope != scope
            || a.scope != p.scope
            || a.policy_hash != p.content_hash()?
            || &a.valuation_input_hash != input_hash
            || a.version == 0
            || a.produced_at > at
            || a.produced_at < p.issued_at
            || a.snapshot.tenant_id != scope.tenant_id
            || a.snapshot.captured_at != a.produced_at
            || a.snapshot.created_at != a.produced_at
            || a.snapshot.window.end_at != a.produced_at
        {
            return Err(Error);
        }
        a.snapshot.validate_integrity().map_err(|_| Error)?;
        let expected = normalize(p, &a.ticks, a.produced_at)?;
        if expected != a.events
            || a.events.len() != a.ticks.len()
            || a.events.iter().any(|e| {
                e.event_kind != MarketEventKind::TickRecorded
                    || e.quality != MarketDataQuality::Passed
                    || e.anomaly_reason.is_some()
            })
            || a.snapshot.artifact_refs.len() != 1
            || a.snapshot.artifact_refs[0].content_hash != digest(&a.events)?
            || a.snapshot.artifact_refs[0].media_type != "application/json"
            || a.snapshot.max_age_secs != p.provider.freshness_sla_secs.min(30)
        {
            return Err(Error);
        }
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(
            scope.tenant_id,
            a.produced_at,
        ))
        .map_err(|_| Error)?;
        if !SnapshotQualityGate::evaluate(&a.snapshot, SnapshotUsage::Trading, at, &rules).allowed {
            return Err(Error);
        }
        let policy = SnapshotSourcePolicy::new(vec![p.approval.clone()]).map_err(|_| Error)?;
        let mut end = p.deadline().min(a.snapshot.expires_at);
        let mut marks = vec![];
        for e in &a.events {
            policy
                .validate_event(
                    &a.snapshot,
                    &serde_json::to_value(e).map_err(|_| Error)?,
                    SnapshotUsage::Trading,
                    at,
                )
                .map_err(|_| Error)?;
            let price = e.price.ok_or(Error)?;
            let raw = rust_decimal::Decimal::from_str_exact(&e.raw_price).map_err(|_| Error)?;
            if raw.scale() > p.price_scale
                || raw != price.value()
                || e.event_time > at
                || e.received_at > at
                || e.event_time > e.received_at
                || e.detected_at != a.produced_at
            {
                return Err(Error);
            }
            end = end.min(
                e.event_time
                    .checked_add_signed(Duration::seconds(p.provider.freshness_sla_secs.min(30)))
                    .ok_or(Error)?,
            );
            marks.push(crate::native_valuation::Mark {
                symbol: e.normalized_symbol.replace('/', ""),
                price: price.value().normalize().to_string(),
                source_ref: format!("r01-artifact:{}:{}", a.content_hash()?, e.normalized_symbol),
                observed_at: e.event_time,
                quality: "normal".into(),
            });
        }
        if at >= end {
            return Err(Error);
        }
        Ok((
            marks,
            Summary {
                artifact_hash: a.content_hash()?,
                artifact_version: a.version,
                snapshot_hash: a.snapshot.content_hash.clone(),
                policy_hash: p.content_hash()?,
                policy_revision: p.revision,
                provider: p.provider.provider.clone(),
                dataset: p.provider.dataset.clone(),
                approval_reference: p.approval.approval_reference.clone(),
                approval_version: p.approval.approval_version.clone(),
                approval_document_hash: p.approval.approval_document_hash.clone(),
                scope_hash: p.approval.scope_hash.clone(),
                signer: p.signer.clone(),
                price_scale: p.price_scale,
                purpose: p.purpose.clone(),
                valid_until: end,
                trust: TRUST.into(),
            },
        ))
    }
}
/// Observed authoritative heads advance even when current quality or permission
/// refuses consumption; replaying the prior healthy file cannot undo revocation.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct History {
    pub policies: Vec<Policy>,
    pub artifacts: Vec<SignedArtifact>,
    pub certificate: String,
}
impl History {
    pub fn policy(&mut self, p: &Policy, scope: &Scope) -> Result<()> {
        p.structural()?;
        if &p.scope != scope || self.policies.len() > 64 {
            return Err(Error);
        }
        if let Some(old) = self.policies.last() {
            if p.revision == old.revision {
                return if p.content_hash()? == old.content_hash()? {
                    Ok(())
                } else {
                    Err(Error)
                };
            }
            if p.revision != old.revision + 1
                || p.previous_hash.as_ref() != Some(&old.content_hash()?)
                || p.issued_at < old.issued_at
            {
                return Err(Error);
            }
        } else if p.revision != 1 || p.previous_hash.is_some() {
            return Err(Error);
        }
        if self.policies.len() >= 64 {
            return Err(Error);
        }
        self.policies.push(p.clone());
        Ok(())
    }
    pub fn artifact(&mut self, a: &SignedArtifact, p: &Policy, certificate: &str) -> Result<()> {
        a.verify(p, certificate)?;
        let b = &a.payload;
        if b.policy_hash != p.content_hash()?
            || b.scope != p.scope
            || b.version == 0
            || self.artifacts.len() > 64
            || b.ticks.is_empty()
            || b.ticks.len() > 16
            || b.events.len() > 32
            || serde_json::to_vec(a).map_err(|_| Error)?.len() > 262144
        {
            return Err(Error);
        }
        if !self.certificate.is_empty() && self.certificate != certificate {
            return Err(Error);
        }
        if let Some(old) = self.artifacts.last() {
            let o = &old.payload;
            if b.version == o.version {
                return if b.content_hash()? == o.content_hash()? {
                    Ok(())
                } else {
                    Err(Error)
                };
            }
            if b.version != o.version + 1
                || b.previous_hash.as_ref() != Some(&o.content_hash()?)
                || b.produced_at < o.produced_at
            {
                return Err(Error);
            }
        } else if b.version != 1 || b.previous_hash.is_some() {
            return Err(Error);
        }
        if self.artifacts.len() >= 64 {
            return Err(Error);
        }
        self.certificate = certificate.into();
        self.artifacts.push(a.clone());
        Ok(())
    }
    pub fn verify(&self, scope: &Scope) -> Result<()> {
        let mut copy = Self::default();
        for p in &self.policies {
            copy.policy(p, scope)?;
        }
        for a in &self.artifacts {
            let p = self
                .policies
                .iter()
                .find(|p| p.content_hash().ok().as_ref() == Some(&a.payload.policy_hash))
                .ok_or(Error)?;
            copy.artifact(a, p, &self.certificate)?;
        }
        Ok(())
    }
    pub fn extension(&self, old: &Self) -> Result<()> {
        if self.policies.len() < old.policies.len() || self.artifacts.len() < old.artifacts.len() {
            return Err(Error);
        }
        for (a, b) in self.policies.iter().zip(&old.policies) {
            if a.content_hash()? != b.content_hash()? {
                return Err(Error);
            }
        }
        for (a, b) in self.artifacts.iter().zip(&old.artifacts) {
            if a.payload.content_hash()? != b.payload.content_hash()? || a.signature != b.signature
            {
                return Err(Error);
            }
        }
        if !old.certificate.is_empty() && self.certificate != old.certificate {
            return Err(Error);
        }
        Ok(())
    }
}
