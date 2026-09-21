use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{
    ArtifactId, ContentHash, CoreError, SchemaEntryId, SchemaVersion, SnapshotId, TenantId,
    canonical_json_bytes,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotQuality {
    Pending,
    Passed,
    Degraded,
    Failed,
}

impl SnapshotQuality {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Passed => "passed",
            Self::Degraded => "degraded",
            Self::Failed => "failed",
        }
    }

    pub fn parse(value: &str) -> Result<Self, SnapshotError> {
        match value {
            "pending" => Ok(Self::Pending),
            "passed" => Ok(Self::Passed),
            "degraded" => Ok(Self::Degraded),
            "failed" => Ok(Self::Failed),
            _ => Err(SnapshotError::invalid_quality(value)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotUsage {
    Research,
    Strategy,
    Trading,
}

impl SnapshotUsage {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Research => "research",
            Self::Strategy => "strategy",
            Self::Trading => "trading",
        }
    }

    pub fn parse(value: &str) -> Result<Self, SnapshotError> {
        match value {
            "research" => Ok(Self::Research),
            "strategy" => Ok(Self::Strategy),
            "trading" => Ok(Self::Trading),
            _ => Err(SnapshotError::invalid_usage(value)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotWindow {
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotSourceRef {
    pub source_id: String,
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotArtifactRef {
    pub artifact_id: ArtifactId,
    pub media_type: String,
    pub content_hash: ContentHash,
    pub storage_bucket: String,
    pub object_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotLineageEntry {
    pub lineage_kind: String,
    pub reference: String,
    pub details: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotQualityFinding {
    pub code: String,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotQualityRule {
    pub tenant_id: TenantId,
    pub usage: SnapshotUsage,
    pub allow_pending: bool,
    pub allow_degraded: bool,
    pub allow_failed: bool,
    pub require_license: bool,
    pub require_freshness: bool,
    pub updated_at: DateTime<Utc>,
}

impl SnapshotQualityRule {
    #[must_use]
    pub fn default_for_usage(
        tenant_id: TenantId,
        usage: SnapshotUsage,
        updated_at: DateTime<Utc>,
    ) -> Self {
        match usage {
            SnapshotUsage::Research => Self {
                tenant_id,
                usage,
                allow_pending: true,
                allow_degraded: true,
                allow_failed: false,
                require_license: true,
                require_freshness: false,
                updated_at,
            },
            SnapshotUsage::Strategy | SnapshotUsage::Trading => Self {
                tenant_id,
                usage,
                allow_pending: false,
                allow_degraded: false,
                allow_failed: false,
                require_license: true,
                require_freshness: true,
                updated_at,
            },
        }
    }

    #[must_use]
    pub fn allows_quality(&self, quality: SnapshotQuality) -> bool {
        match quality {
            SnapshotQuality::Pending => self.allow_pending,
            SnapshotQuality::Passed => true,
            SnapshotQuality::Degraded => self.allow_degraded,
            SnapshotQuality::Failed => self.allow_failed,
        }
    }
}

#[must_use]
pub fn default_quality_rules(
    tenant_id: TenantId,
    updated_at: DateTime<Utc>,
) -> Vec<SnapshotQualityRule> {
    [
        SnapshotUsage::Research,
        SnapshotUsage::Strategy,
        SnapshotUsage::Trading,
    ]
    .into_iter()
    .map(|usage| SnapshotQualityRule::default_for_usage(tenant_id, usage, updated_at))
    .collect()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataSnapshotInput {
    pub schema_name: String,
    pub schema_version: SchemaVersion,
    pub schema_entry_id: Option<SchemaEntryId>,
    pub window: SnapshotWindow,
    pub sources: Vec<SnapshotSourceRef>,
    pub quality: SnapshotQuality,
    pub quality_findings: Vec<SnapshotQualityFinding>,
    pub license_label: String,
    pub captured_at: DateTime<Utc>,
    pub max_age_secs: i64,
    pub symbols: Vec<String>,
    pub artifact_refs: Vec<SnapshotArtifactRef>,
    pub lineage: Vec<SnapshotLineageEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DataSnapshotRecord {
    pub snapshot_id: SnapshotId,
    pub tenant_id: TenantId,
    pub schema_name: String,
    pub schema_version: SchemaVersion,
    pub schema_entry_id: Option<SchemaEntryId>,
    pub window: SnapshotWindow,
    pub sources: Vec<SnapshotSourceRef>,
    pub quality: SnapshotQuality,
    pub quality_findings: Vec<SnapshotQualityFinding>,
    pub license_label: String,
    pub captured_at: DateTime<Utc>,
    pub max_age_secs: i64,
    pub expires_at: DateTime<Utc>,
    pub symbols: Vec<String>,
    pub artifact_refs: Vec<SnapshotArtifactRef>,
    pub lineage: Vec<SnapshotLineageEntry>,
    pub content_hash: ContentHash,
    pub created_at: DateTime<Utc>,
}

impl DataSnapshotRecord {
    pub fn new(
        tenant_id: TenantId,
        input: DataSnapshotInput,
        created_at: DateTime<Utc>,
    ) -> Result<Self, SnapshotError> {
        if input.window.end_at < input.window.start_at {
            return Err(SnapshotError::InvalidWindow);
        }
        if input.max_age_secs < 0 {
            return Err(SnapshotError::InvalidMaxAge {
                max_age_secs: input.max_age_secs,
            });
        }

        let schema_name = input.schema_name.trim().to_owned();
        if schema_name.is_empty() {
            return Err(SnapshotError::InvalidSchemaName);
        }

        let normalized = NormalizedSnapshotInput::from_input(input);
        let content_hash = ContentHash::sha256_bytes(&canonical_json_bytes(
            &normalized.canonical_payload(schema_name.as_str()),
        )?);
        let expires_at = normalized.captured_at + ChronoDuration::seconds(normalized.max_age_secs);

        Ok(Self {
            snapshot_id: SnapshotId::new(),
            tenant_id,
            schema_name,
            schema_version: normalized.schema_version,
            schema_entry_id: normalized.schema_entry_id,
            window: normalized.window,
            sources: normalized.sources,
            quality: normalized.quality,
            quality_findings: normalized.quality_findings,
            license_label: normalized.license_label,
            captured_at: normalized.captured_at,
            max_age_secs: normalized.max_age_secs,
            expires_at,
            symbols: normalized.symbols,
            artifact_refs: normalized.artifact_refs,
            lineage: normalized.lineage,
            content_hash,
            created_at,
        })
    }

    #[must_use]
    pub fn is_expired(&self, observed_at: DateTime<Utc>) -> bool {
        observed_at > self.expires_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotQualityRuleset {
    rules: BTreeMap<SnapshotUsage, SnapshotQualityRule>,
}

impl SnapshotQualityRuleset {
    #[must_use]
    pub fn from_rules(rules: impl IntoIterator<Item = SnapshotQualityRule>) -> Self {
        Self {
            rules: rules.into_iter().map(|rule| (rule.usage, rule)).collect(),
        }
    }

    #[must_use]
    pub fn rule_for(&self, usage: SnapshotUsage) -> Option<&SnapshotQualityRule> {
        self.rules.get(&usage)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotGateViolation {
    LicenseMissing,
    Expired,
    QualityInsufficient { quality: SnapshotQuality },
    RuleMissing { usage: SnapshotUsage },
    MetadataIncomplete { field: &'static str },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotGateDecision {
    pub allowed: bool,
    pub violations: Vec<SnapshotGateViolation>,
}

pub struct SnapshotQualityGate;

impl SnapshotQualityGate {
    #[must_use]
    pub fn evaluate(
        snapshot: &DataSnapshotRecord,
        usage: SnapshotUsage,
        observed_at: DateTime<Utc>,
        rules: &SnapshotQualityRuleset,
    ) -> SnapshotGateDecision {
        let Some(rule) = rules
            .rule_for(usage)
            .filter(|rule| rule.tenant_id == snapshot.tenant_id)
        else {
            return SnapshotGateDecision {
                allowed: false,
                violations: vec![SnapshotGateViolation::RuleMissing { usage }],
            };
        };

        let mut violations = Vec::new();
        if rule.require_license && snapshot.license_label.trim().is_empty() {
            violations.push(SnapshotGateViolation::LicenseMissing);
        }
        if snapshot.sources.is_empty() {
            violations.push(SnapshotGateViolation::MetadataIncomplete { field: "sources" });
        } else if rule.require_license
            && snapshot
                .sources
                .iter()
                .any(|source| source.license_label.trim().is_empty())
        {
            violations.push(SnapshotGateViolation::MetadataIncomplete {
                field: "source_license",
            });
        }
        if snapshot.lineage.is_empty() {
            violations.push(SnapshotGateViolation::MetadataIncomplete { field: "lineage" });
        }
        if rule.require_freshness && snapshot.is_expired(observed_at) {
            violations.push(SnapshotGateViolation::Expired);
        }
        if !rule.allows_quality(snapshot.quality) {
            violations.push(SnapshotGateViolation::QualityInsufficient {
                quality: snapshot.quality,
            });
        }

        SnapshotGateDecision {
            allowed: violations.is_empty(),
            violations,
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryDataSnapshotCatalog {
    snapshots_by_hash: BTreeMap<(TenantId, ContentHash), DataSnapshotRecord>,
    hash_by_id: BTreeMap<(TenantId, SnapshotId), ContentHash>,
}

impl InMemoryDataSnapshotCatalog {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn upsert(&mut self, snapshot: DataSnapshotRecord) -> &DataSnapshotRecord {
        let hash_key = (snapshot.tenant_id, snapshot.content_hash.clone());
        let id_key = (snapshot.tenant_id, snapshot.snapshot_id);
        let snapshot = self.snapshots_by_hash.entry(hash_key).or_insert(snapshot);
        self.hash_by_id
            .insert(id_key, snapshot.content_hash.clone());
        snapshot
    }

    #[must_use]
    pub fn get(&self, tenant_id: TenantId, snapshot_id: SnapshotId) -> Option<&DataSnapshotRecord> {
        let hash = self.hash_by_id.get(&(tenant_id, snapshot_id))?;
        self.snapshots_by_hash.get(&(tenant_id, hash.clone()))
    }

    #[must_use]
    pub fn find_by_hash(
        &self,
        tenant_id: TenantId,
        content_hash: &ContentHash,
    ) -> Option<&DataSnapshotRecord> {
        self.snapshots_by_hash
            .get(&(tenant_id, content_hash.clone()))
    }

    #[must_use]
    pub fn list_by_symbol(&self, tenant_id: TenantId, symbol: &str) -> Vec<&DataSnapshotRecord> {
        let mut matches = self
            .snapshots_by_hash
            .iter()
            .filter(|((stored_tenant_id, _), snapshot)| {
                *stored_tenant_id == tenant_id
                    && snapshot.symbols.iter().any(|value| value == symbol)
            })
            .map(|(_, snapshot)| snapshot)
            .collect::<Vec<_>>();
        matches.sort_by_key(|snapshot| std::cmp::Reverse(snapshot.captured_at));
        matches
    }
}

#[derive(Debug, Error)]
pub enum SnapshotError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("SNAPSHOT_INVALID_WINDOW: snapshot window end precedes start")]
    InvalidWindow,
    #[error("SNAPSHOT_INVALID_MAX_AGE: max_age_secs `{max_age_secs}` must be >= 0")]
    InvalidMaxAge { max_age_secs: i64 },
    #[error("SNAPSHOT_INVALID_SCHEMA_NAME: schema_name must not be empty")]
    InvalidSchemaName,
    #[error("SNAPSHOT_INVALID_QUALITY: unsupported quality `{value}`")]
    InvalidQuality { value: String },
    #[error("SNAPSHOT_INVALID_USAGE: unsupported usage `{value}`")]
    InvalidUsage { value: String },
}

impl SnapshotError {
    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        match self {
            Self::Core(error) => error.machine_code(),
            Self::InvalidWindow => "SNAPSHOT_INVALID_WINDOW",
            Self::InvalidMaxAge { .. } => "SNAPSHOT_INVALID_MAX_AGE",
            Self::InvalidSchemaName => "SNAPSHOT_INVALID_SCHEMA_NAME",
            Self::InvalidQuality { .. } => "SNAPSHOT_INVALID_QUALITY",
            Self::InvalidUsage { .. } => "SNAPSHOT_INVALID_USAGE",
        }
    }

    fn invalid_quality(value: &str) -> Self {
        Self::InvalidQuality {
            value: value.to_owned(),
        }
    }

    fn invalid_usage(value: &str) -> Self {
        Self::InvalidUsage {
            value: value.to_owned(),
        }
    }
}

#[derive(Debug, Clone)]
struct NormalizedSnapshotInput {
    schema_version: SchemaVersion,
    schema_entry_id: Option<SchemaEntryId>,
    window: SnapshotWindow,
    sources: Vec<SnapshotSourceRef>,
    quality: SnapshotQuality,
    quality_findings: Vec<SnapshotQualityFinding>,
    license_label: String,
    captured_at: DateTime<Utc>,
    max_age_secs: i64,
    symbols: Vec<String>,
    artifact_refs: Vec<SnapshotArtifactRef>,
    lineage: Vec<SnapshotLineageEntry>,
}

impl NormalizedSnapshotInput {
    fn from_input(input: DataSnapshotInput) -> Self {
        let mut sources = input.sources;
        sources.sort_by(|left, right| {
            (
                left.source_id.as_str(),
                left.provider.as_str(),
                left.dataset.as_str(),
                left.license_label.as_str(),
            )
                .cmp(&(
                    right.source_id.as_str(),
                    right.provider.as_str(),
                    right.dataset.as_str(),
                    right.license_label.as_str(),
                ))
        });

        let mut quality_findings = input.quality_findings;
        quality_findings.sort_by(|left, right| {
            (left.code.as_str(), left.detail.as_str())
                .cmp(&(right.code.as_str(), right.detail.as_str()))
        });

        let mut symbols = input
            .symbols
            .into_iter()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        symbols.sort();

        let mut artifact_refs = input.artifact_refs;
        artifact_refs.sort_by(|left, right| {
            (
                left.artifact_id,
                left.media_type.as_str(),
                left.content_hash.as_str(),
                left.storage_bucket.as_str(),
                left.object_key.as_str(),
            )
                .cmp(&(
                    right.artifact_id,
                    right.media_type.as_str(),
                    right.content_hash.as_str(),
                    right.storage_bucket.as_str(),
                    right.object_key.as_str(),
                ))
        });

        let mut lineage = input.lineage;
        lineage.sort_by(|left, right| {
            let left_details = canonical_json_bytes(&left.details).unwrap_or_default();
            let right_details = canonical_json_bytes(&right.details).unwrap_or_default();
            (
                left.lineage_kind.as_str(),
                left.reference.as_str(),
                left_details,
            )
                .cmp(&(
                    right.lineage_kind.as_str(),
                    right.reference.as_str(),
                    right_details,
                ))
        });

        Self {
            schema_version: input.schema_version,
            schema_entry_id: input.schema_entry_id,
            window: input.window,
            sources,
            quality: input.quality,
            quality_findings,
            license_label: input.license_label.trim().to_owned(),
            captured_at: input.captured_at,
            max_age_secs: input.max_age_secs,
            symbols,
            artifact_refs,
            lineage,
        }
    }

    fn canonical_payload(&self, schema_name: &str) -> Value {
        json!({
            "schema_name": schema_name,
            "schema_version": self.schema_version.as_str(),
            "schema_entry_id": self.schema_entry_id.map(|value| value.to_string()),
            "window": {
                "start_at": self.window.start_at.to_rfc3339(),
                "end_at": self.window.end_at.to_rfc3339(),
            },
            "sources": self.sources,
            "quality": self.quality.as_str(),
            "quality_findings": self.quality_findings,
            "license_label": self.license_label,
            "captured_at": self.captured_at.to_rfc3339(),
            "max_age_secs": self.max_age_secs,
            "symbols": self.symbols,
            "artifact_refs": self.artifact_refs,
            "lineage": self.lineage,
        })
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use serde_json::json;

    use super::{
        DataSnapshotInput, DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotArtifactRef,
        SnapshotError, SnapshotGateViolation, SnapshotLineageEntry, SnapshotQuality,
        SnapshotQualityFinding, SnapshotQualityGate, SnapshotQualityRuleset, SnapshotSourceRef,
        SnapshotUsage, SnapshotWindow, default_quality_rules,
    };
    use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};

    fn baseline_input() -> DataSnapshotInput {
        DataSnapshotInput {
            schema_name: "DataSnapshot".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: Utc
                    .with_ymd_and_hms(2026, 7, 31, 0, 0, 0)
                    .single()
                    .expect("valid timestamp"),
                end_at: Utc
                    .with_ymd_and_hms(2026, 7, 31, 1, 0, 0)
                    .single()
                    .expect("valid timestamp"),
            },
            sources: vec![
                SnapshotSourceRef {
                    source_id: "coinbase-btc".to_owned(),
                    provider: "approved.coinbase.spot".to_owned(),
                    dataset: "crypto.top_of_book.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                },
                SnapshotSourceRef {
                    source_id: "binance-btc".to_owned(),
                    provider: "approved.binance.spot".to_owned(),
                    dataset: "crypto.top_of_book.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                },
            ],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![SnapshotQualityFinding {
                code: "spread_within_expected_range".to_owned(),
                detail: "spread remains below threshold".to_owned(),
            }],
            license_label: "internal-approved".to_owned(),
            captured_at: Utc
                .with_ymd_and_hms(2026, 7, 31, 1, 0, 5)
                .single()
                .expect("valid timestamp"),
            max_age_secs: 30,
            symbols: vec!["ETHUSDT".to_owned(), "BTCUSDT".to_owned()],
            artifact_refs: vec![
                SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: ContentHash::sha256_bytes(br#"{"kind":"a"}"#),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: "tenant/example/artifacts/a".to_owned(),
                },
                SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: ContentHash::sha256_bytes(br#"{"kind":"b"}"#),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: "tenant/example/artifacts/b".to_owned(),
                },
            ],
            lineage: vec![
                SnapshotLineageEntry {
                    lineage_kind: "market_event_range".to_owned(),
                    reference: "market:BTCUSDT".to_owned(),
                    details: json!({ "first_sequence": 1, "last_sequence": 100 }),
                },
                SnapshotLineageEntry {
                    lineage_kind: "schema_registry".to_owned(),
                    reference: "research/DataSnapshot/v1".to_owned(),
                    details: json!({ "domain": "research" }),
                },
            ],
        }
    }

    #[test]
    fn quality_and_usage_wire_values_round_trip_and_reject_unknown_values() {
        for (quality, wire) in [
            (SnapshotQuality::Pending, "pending"),
            (SnapshotQuality::Passed, "passed"),
            (SnapshotQuality::Degraded, "degraded"),
            (SnapshotQuality::Failed, "failed"),
        ] {
            assert_eq!(quality.as_str(), wire);
            assert_eq!(
                SnapshotQuality::parse(wire).expect("quality parses"),
                quality
            );
        }
        let quality_error = SnapshotQuality::parse("unknown").expect_err("unknown quality fails");
        assert_eq!(quality_error.machine_code(), "SNAPSHOT_INVALID_QUALITY");

        for (usage, wire) in [
            (SnapshotUsage::Research, "research"),
            (SnapshotUsage::Strategy, "strategy"),
            (SnapshotUsage::Trading, "trading"),
        ] {
            assert_eq!(usage.as_str(), wire);
            assert_eq!(SnapshotUsage::parse(wire).expect("usage parses"), usage);
        }
        let usage_error = SnapshotUsage::parse("unknown").expect_err("unknown usage fails");
        assert_eq!(usage_error.machine_code(), "SNAPSHOT_INVALID_USAGE");
    }

    #[test]
    fn data_snapshot_hash_is_stable_for_equivalent_inputs() {
        let tenant_id = TenantId::new();
        let created_at = Utc
            .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
            .single()
            .expect("valid timestamp");
        let original = baseline_input();
        let first = DataSnapshotRecord::new(tenant_id, original.clone(), created_at)
            .expect("snapshot builds");

        let mut reordered = original;
        reordered.sources.reverse();
        reordered.symbols.reverse();
        reordered.artifact_refs.reverse();
        reordered.lineage.reverse();
        let second =
            DataSnapshotRecord::new(tenant_id, reordered, created_at).expect("snapshot builds");

        assert_eq!(first.content_hash, second.content_hash);

        let mut catalog = InMemoryDataSnapshotCatalog::new();
        let stored_first = catalog.upsert(first).clone();
        let stored_second = catalog.upsert(second).clone();
        assert_eq!(stored_first.snapshot_id, stored_second.snapshot_id);
    }

    #[test]
    fn data_snapshot_rejects_invalid_window_age_and_schema() {
        let tenant_id = TenantId::new();
        let created_at = Utc
            .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
            .single()
            .expect("valid timestamp");

        let mut invalid_window = baseline_input();
        invalid_window.window.end_at = invalid_window.window.start_at - ChronoDuration::seconds(1);
        assert!(matches!(
            DataSnapshotRecord::new(tenant_id, invalid_window, created_at),
            Err(SnapshotError::InvalidWindow)
        ));

        let mut invalid_age = baseline_input();
        invalid_age.max_age_secs = -1;
        assert!(matches!(
            DataSnapshotRecord::new(tenant_id, invalid_age, created_at),
            Err(SnapshotError::InvalidMaxAge { max_age_secs: -1 })
        ));

        let mut invalid_schema = baseline_input();
        invalid_schema.schema_name = "  ".to_owned();
        assert!(matches!(
            DataSnapshotRecord::new(tenant_id, invalid_schema, created_at),
            Err(SnapshotError::InvalidSchemaName)
        ));
    }

    #[test]
    fn strategy_and_trading_gates_reject_three_hundred_invalid_fixtures() {
        let tenant_id = TenantId::new();
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(
            tenant_id,
            Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 0)
                .single()
                .expect("valid timestamp"),
        ));

        for index in 0..300 {
            let mut input = baseline_input();
            if index < 100 {
                input.captured_at = input.window.end_at;
                input.max_age_secs = 1;
            } else if index < 200 {
                input.quality = SnapshotQuality::Failed;
            } else {
                input.license_label.clear();
            }

            let snapshot = DataSnapshotRecord::new(
                tenant_id,
                input,
                Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 30)
                    .single()
                    .expect("valid timestamp"),
            )
            .expect("snapshot builds");
            let observed_at = if index < 100 {
                snapshot.expires_at + ChronoDuration::seconds(1)
            } else {
                snapshot.captured_at
            };

            for usage in [SnapshotUsage::Strategy, SnapshotUsage::Trading] {
                let decision = SnapshotQualityGate::evaluate(&snapshot, usage, observed_at, &rules);
                assert!(
                    !decision.allowed,
                    "fixture {index} should be rejected for {usage:?}"
                );
                if index < 100 {
                    assert!(
                        decision
                            .violations
                            .contains(&SnapshotGateViolation::Expired)
                    );
                } else if index < 200 {
                    assert!(decision.violations.contains(
                        &SnapshotGateViolation::QualityInsufficient {
                            quality: SnapshotQuality::Failed,
                        },
                    ));
                } else {
                    assert!(
                        decision
                            .violations
                            .contains(&SnapshotGateViolation::LicenseMissing)
                    );
                }
            }
        }
    }

    #[test]
    fn research_gate_allows_degraded_non_expired_snapshots() {
        let tenant_id = TenantId::new();
        let mut input = baseline_input();
        input.quality = SnapshotQuality::Degraded;
        let snapshot = DataSnapshotRecord::new(
            tenant_id,
            input,
            Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
                .single()
                .expect("valid timestamp"),
        )
        .expect("snapshot builds");
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(
            tenant_id,
            snapshot.created_at,
        ));

        let decision = SnapshotQualityGate::evaluate(
            &snapshot,
            SnapshotUsage::Research,
            snapshot.captured_at,
            &rules,
        );
        assert!(decision.allowed);
    }

    #[test]
    fn snapshot_gate_fails_closed_for_cross_tenant_rules_and_incomplete_lineage() {
        let tenant_id = TenantId::new();
        let other_tenant_id = TenantId::new();
        let now = Utc
            .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
            .single()
            .expect("valid timestamp");
        let snapshot =
            DataSnapshotRecord::new(tenant_id, baseline_input(), now).expect("snapshot builds");
        let cross_tenant_rules =
            SnapshotQualityRuleset::from_rules(default_quality_rules(other_tenant_id, now));
        let cross_tenant = SnapshotQualityGate::evaluate(
            &snapshot,
            SnapshotUsage::Trading,
            snapshot.captured_at,
            &cross_tenant_rules,
        );
        assert_eq!(
            cross_tenant.violations,
            vec![SnapshotGateViolation::RuleMissing {
                usage: SnapshotUsage::Trading,
            }]
        );

        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(tenant_id, now));
        for (field, mutate) in [
            (
                "sources",
                (|input: &mut DataSnapshotInput| input.sources.clear())
                    as fn(&mut DataSnapshotInput),
            ),
            (
                "source_license",
                (|input: &mut DataSnapshotInput| input.sources[0].license_label.clear())
                    as fn(&mut DataSnapshotInput),
            ),
            (
                "lineage",
                (|input: &mut DataSnapshotInput| input.lineage.clear())
                    as fn(&mut DataSnapshotInput),
            ),
        ] {
            let mut input = baseline_input();
            mutate(&mut input);
            let incomplete = DataSnapshotRecord::new(tenant_id, input, now)
                .expect("incomplete snapshot remains inspectable");
            let decision = SnapshotQualityGate::evaluate(
                &incomplete,
                SnapshotUsage::Trading,
                incomplete.captured_at,
                &rules,
            );
            assert!(
                decision
                    .violations
                    .contains(&SnapshotGateViolation::MetadataIncomplete { field })
            );
        }
    }
}
