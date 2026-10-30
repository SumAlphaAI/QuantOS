//! Independently owner-approved account opening basis/status artifacts. No live
//! funding assertion, mark authority, cash rebase, or new execution permission.
use crate::{
    native_ledger::{Scope, decimal},
    native_valuation::{BASIS, Inputs, SOURCE},
};
use chrono::{DateTime, Duration, Utc};
use openssl::{hash::MessageDigest, sign::Verifier, x509::X509};
use quantos_core::{ContentHash, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;
pub const PURPOSE: &str = "assisted_testnet_account_valuation";
pub const TRUST: &str =
    "AUTHENTICATED_OWNER_APPROVED_ACCOUNT_OPENING_STATUS_ARTIFACT_NOT_VENUE_FUNDS";
pub const DOMAIN: &str = "quantos-account-valuation-artifact-signature/v1";
#[derive(Debug, thiserror::Error)]
#[error("ACCOUNT_VALUATION_PROVENANCE_REJECTED")]
pub struct Error;
type Result<T> = std::result::Result<T, Error>;
fn digest(v: &impl Serialize) -> Result<ContentHash> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error)?).map_err(|_| Error)?,
    ))
}
fn text(s: &str) -> bool {
    !s.trim().is_empty() && s.len() <= 256 && !s.chars().any(char::is_control)
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Opening {
    pub source_id: String,
    pub basis: String,
    pub origin_ledger_hash: ContentHash,
    pub opening_at: DateTime<Utc>,
    pub cash_source_ref: String,
    pub quote_cash_at_opening: String,
    pub realized_pnl_before_origin_today: String,
    pub quote_currency: String,
}
impl Opening {
    pub fn from_input(i: &Inputs) -> Self {
        Self {
            source_id: i.source_id.clone(),
            basis: i.basis.clone(),
            origin_ledger_hash: i.origin_ledger_hash.clone(),
            opening_at: i.opening_at,
            cash_source_ref: i.cash_source_ref.clone(),
            quote_cash_at_opening: i.quote_cash_at_opening.clone(),
            realized_pnl_before_origin_today: i.realized_pnl_before_origin_today.clone(),
            quote_currency: i.quote_currency.clone(),
        }
    }
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-account-valuation-opening/v1", self]))
    }
    fn validate(&self, scope: &Scope) -> Result<()> {
        let empty = crate::native_ledger::NativeLedger::new(scope.clone())
            .map_err(|_| Error)?
            .view()
            .map_err(|_| Error)?;
        if self.source_id != SOURCE
            || self.basis != BASIS
            || self.quote_currency != "USDT"
            || !text(&self.cash_source_ref)
            || empty["ledgerHash"] != self.origin_ledger_hash.to_string()
            || decimal(&self.quote_cash_at_opening).map_err(|_| Error)?
                < rust_decimal::Decimal::ZERO
        {
            return Err(Error);
        }
        decimal(&self.realized_pnl_before_origin_today).map_err(|_| Error)?;
        Ok(())
    }
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
    pub provider: String,
    pub dataset: String,
    pub approval_reference: String,
    pub approval_version: String,
    pub approval_document_hash: ContentHash,
    pub scope_hash: ContentHash,
    pub signer: String,
    pub certificate: String,
    pub opening: Opening,
    pub max_age_secs: u32,
}
impl Policy {
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-account-valuation-policy/v1", self]))
    }
    pub fn scope_hash(scope: &Scope) -> Result<ContentHash> {
        digest(&json!([
            "quantos-account-valuation-permission-scope/v1",
            scope,
            PURPOSE
        ]))
    }
    fn certificate(&self) -> Result<X509> {
        if self.certificate.len() > 16384 {
            return Err(Error);
        }
        let c = X509::from_pem(self.certificate.as_bytes()).map_err(|_| Error)?;
        let pin = format!(
            "sha256:{}",
            c.digest(MessageDigest::sha256())
                .map_err(|_| Error)?
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        );
        if pin != self.signer {
            return Err(Error);
        }
        Ok(c)
    }
    fn structural(&self) -> Result<()> {
        self.opening.validate(&self.scope)?;
        self.certificate()?;
        if self.revision == 0
            || self.expires_at <= self.issued_at
            || self.purpose != PURPOSE
            || self.scope_hash != Self::scope_hash(&self.scope)?
            || !(1..=30).contains(&self.max_age_secs)
            || [
                &self.provider,
                &self.dataset,
                &self.approval_reference,
                &self.approval_version,
            ]
            .iter()
            .any(|v| !text(v))
        {
            return Err(Error);
        }
        Ok(())
    }
    fn live(&self, at: DateTime<Utc>) -> Result<()> {
        self.structural()?;
        let c = self.certificate()?;
        let t = openssl::asn1::Asn1Time::from_unix(at.timestamp()).map_err(|_| Error)?;
        let e = openssl::asn1::Asn1Time::from_unix(
            self.expires_at
                .timestamp()
                .checked_add(i64::from(self.expires_at.timestamp_subsec_nanos() != 0))
                .ok_or(Error)?,
        )
        .map_err(|_| Error)?;
        if !self.enabled
            || at < self.issued_at
            || at >= self.expires_at
            || c.not_before().compare(&t).map_err(|_| Error)? == std::cmp::Ordering::Greater
            || c.not_after().compare(&t).map_err(|_| Error)? != std::cmp::Ordering::Greater
            || c.not_after().compare(&e).map_err(|_| Error)? == std::cmp::Ordering::Less
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
    pub observed_at: DateTime<Utc>,
    pub opening: Opening,
    pub account_status: String,
    pub account_status_at: DateTime<Utc>,
    pub cash_coverage_through: DateTime<Utc>,
    pub status_source_ref: String,
    pub quality: String,
}
/// Independently authored source observations, never inferred from a market
/// mark, native Fill price, corrected books, or consumer-supplied cash amount.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Observation {
    pub opening: Opening,
    pub observed_at: DateTime<Utc>,
    pub account_status: String,
    pub account_status_at: DateTime<Utc>,
    pub cash_coverage_through: DateTime<Utc>,
    pub status_source_ref: String,
    pub quality: String,
}
impl Artifact {
    pub fn from_observation(
        p: &Policy,
        input_hash: ContentHash,
        version: u64,
        previous_hash: Option<ContentHash>,
        observed: Observation,
    ) -> Result<Self> {
        p.structural()?;
        Ok(Self {
            scope: p.scope.clone(),
            version,
            previous_hash,
            policy_hash: p.content_hash()?,
            valuation_input_hash: input_hash,
            observed_at: observed.observed_at,
            opening: observed.opening,
            account_status: observed.account_status,
            account_status_at: observed.account_status_at,
            cash_coverage_through: observed.cash_coverage_through,
            status_source_ref: observed.status_source_ref,
            quality: observed.quality,
        })
    }
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-account-valuation-artifact/v1", self]))
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SignedArtifact {
    pub payload: Artifact,
    pub signature: String,
}
impl SignedArtifact {
    pub fn verify(&self, p: &Policy) -> Result<()> {
        let cert = p.certificate()?;
        if self.signature.is_empty()
            || self.signature.len() > 8192
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
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Summary {
    pub artifact_hash: ContentHash,
    pub artifact_version: u64,
    pub policy_hash: ContentHash,
    pub policy_revision: u64,
    pub opening_hash: ContentHash,
    pub provider: String,
    pub dataset: String,
    pub approval_reference: String,
    pub approval_version: String,
    pub approval_document_hash: ContentHash,
    pub scope_hash: ContentHash,
    pub signer: String,
    pub purpose: String,
    pub observed_at: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub trust: String,
}
impl Binding {
    pub fn summary(&self, i: &Inputs, at: DateTime<Utc>) -> Result<Summary> {
        let p = &self.policy;
        let a = &self.artifact.payload;
        p.live(at)?;
        if let Some(m) = &i.market_provenance {
            let market_cert = X509::from_pem(m.certificate.as_bytes()).map_err(|_| Error)?;
            if m.policy.signer == p.signer
                || market_cert
                    .public_key()
                    .map_err(|_| Error)?
                    .public_key_to_der()
                    .map_err(|_| Error)?
                    == p.certificate()?
                        .public_key()
                        .map_err(|_| Error)?
                        .public_key_to_der()
                        .map_err(|_| Error)?
            {
                return Err(Error);
            }
        }
        self.artifact.verify(p)?;
        if p.scope != i.scope
            || a.scope != i.scope
            || a.version == 0
            || a.policy_hash != p.content_hash()?
            || a.valuation_input_hash != i.raw_market_hash().map_err(|_| Error)?
            || a.opening != p.opening
            || a.opening != Opening::from_input(i)
            || a.observed_at != i.as_of
            || a.observed_at < p.issued_at
            || a.observed_at > at
            || a.quality != "normal"
            || a.account_status != i.account_status
            || !matches!(a.account_status.as_str(), "active" | "suspended" | "closed")
            || a.account_status_at != i.account_status_at
            || a.cash_coverage_through != i.cash_coverage_through
            || a.status_source_ref != i.status_source_ref
            || !text(&a.status_source_ref)
            || a.account_status_at > a.observed_at
            || a.cash_coverage_through > a.observed_at
            || a.account_status_at < a.opening.opening_at
            || a.cash_coverage_through < a.opening.opening_at
        {
            return Err(Error);
        }
        let delta = Duration::seconds(i64::from(p.max_age_secs));
        let end = p
            .expires_at
            .min(i.valid_until)
            .min(a.observed_at.checked_add_signed(delta).ok_or(Error)?)
            .min(a.account_status_at.checked_add_signed(delta).ok_or(Error)?)
            .min(
                a.cash_coverage_through
                    .checked_add_signed(delta)
                    .ok_or(Error)?,
            );
        if at >= end {
            return Err(Error);
        }
        Ok(Summary {
            artifact_hash: a.content_hash()?,
            artifact_version: a.version,
            policy_hash: p.content_hash()?,
            policy_revision: p.revision,
            opening_hash: p.opening.content_hash()?,
            provider: p.provider.clone(),
            dataset: p.dataset.clone(),
            approval_reference: p.approval_reference.clone(),
            approval_version: p.approval_version.clone(),
            approval_document_hash: p.approval_document_hash.clone(),
            scope_hash: p.scope_hash.clone(),
            signer: p.signer.clone(),
            purpose: p.purpose.clone(),
            observed_at: a.observed_at,
            valid_until: end,
            trust: TRUST.into(),
        })
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct History {
    pub policies: Vec<Policy>,
    pub artifacts: Vec<SignedArtifact>,
}
impl History {
    pub fn policy(&mut self, p: &Policy, scope: &Scope) -> Result<()> {
        p.structural()?;
        if &p.scope != scope || self.policies.len() > 64 {
            return Err(Error);
        }
        if let Some(old) = self.policies.last() {
            if p.revision == old.revision {
                return if p == old { Ok(()) } else { Err(Error) };
            }
            if p.revision != old.revision.checked_add(1).ok_or(Error)?
                || p.previous_hash.as_ref() != Some(&old.content_hash()?)
                || p.issued_at < old.issued_at
                || p.opening != old.opening
                || p.signer != old.signer
                || p.certificate != old.certificate
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
    pub fn artifact(&mut self, a: &SignedArtifact, p: &Policy) -> Result<()> {
        a.verify(p)?;
        let b = &a.payload;
        if b.opening != p.opening
            || b.scope != p.scope
            || b.policy_hash != p.content_hash()?
            || b.version == 0
            || self.artifacts.len() > 64
            || serde_json::to_vec(a).map_err(|_| Error)?.len() > 262144
        {
            return Err(Error);
        }
        if let Some(old) = self.artifacts.last() {
            let o = &old.payload;
            if b.version == o.version {
                return if a == old { Ok(()) } else { Err(Error) };
            }
            if b.version != o.version.checked_add(1).ok_or(Error)?
                || b.previous_hash.as_ref() != Some(&o.content_hash()?)
                || b.observed_at < o.observed_at
                || b.account_status_at < o.account_status_at
                || b.cash_coverage_through < o.cash_coverage_through
                || b.account_status_at == o.account_status_at
                    && b.account_status != o.account_status
                || b.opening != o.opening
            {
                return Err(Error);
            }
        } else if b.version != 1 || b.previous_hash.is_some() {
            return Err(Error);
        }
        if self.artifacts.len() >= 64 {
            return Err(Error);
        }
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
            copy.artifact(a, p)?;
        }
        Ok(())
    }
    pub fn extension(&self, old: &Self) -> Result<()> {
        if self.policies.len() < old.policies.len()
            || self.artifacts.len() < old.artifacts.len()
            || self.policies[..old.policies.len()] != old.policies
            || self.artifacts[..old.artifacts.len()] != old.artifacts
        {
            return Err(Error);
        }
        Ok(())
    }
}
