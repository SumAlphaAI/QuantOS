use std::{
    collections::{BTreeMap, BTreeSet},
    ops::Deref,
};

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

    pub fn validate(&self) -> Result<(), SnapshotError> {
        if self.usage != SnapshotUsage::Research
            && (self.allow_pending
                || self.allow_degraded
                || self.allow_failed
                || !self.require_license
                || !self.require_freshness)
        {
            return Err(SnapshotError::UnsafeRule);
        }
        Ok(())
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
pub struct DataSnapshotFields {
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

/// Read-only record. Wire input is untrusted until invariants are checked.
/// ```compile_fail
/// fn mutate(snapshot: &mut quantos_storage::DataSnapshotRecord) {
///     snapshot.quality = quantos_storage::SnapshotQuality::Passed;
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct DataSnapshotRecord {
    #[serde(deserialize_with = "deserialize_snapshot_fields")]
    pub(crate) fields: DataSnapshotFields,
}

impl Deref for DataSnapshotRecord {
    type Target = DataSnapshotFields;
    fn deref(&self) -> &Self::Target {
        &self.fields
    }
}

fn deserialize_snapshot_fields<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<DataSnapshotFields, D::Error> {
    let fields = DataSnapshotFields::deserialize(deserializer)?;
    let record = DataSnapshotRecord { fields };
    record
        .validate_integrity()
        .map_err(serde::de::Error::custom)?;
    Ok(record.fields)
}

pub const MAX_SNAPSHOT_AGE_SECS: i64 = 86_400;
pub const MAX_SNAPSHOT_ITEMS: usize = 1_024;
pub const MAX_SNAPSHOT_BYTES: usize = 1_048_576;

fn micros(time: DateTime<Utc>) -> DateTime<Utc> {
    DateTime::from_timestamp_micros(time.timestamp_micros())
        .expect("existing timestamp fits microseconds")
}

impl DataSnapshotRecord {
    pub fn new(
        tenant_id: TenantId,
        mut input: DataSnapshotInput,
        created_at: DateTime<Utc>,
    ) -> Result<Self, SnapshotError> {
        input.window.start_at = micros(input.window.start_at);
        input.window.end_at = micros(input.window.end_at);
        input.captured_at = micros(input.captured_at);
        let created_at = micros(created_at);
        if input.window.end_at < input.window.start_at {
            return Err(SnapshotError::InvalidWindow);
        }
        if !(0..=MAX_SNAPSHOT_AGE_SECS).contains(&input.max_age_secs) {
            return Err(SnapshotError::InvalidMaxAge {
                max_age_secs: input.max_age_secs,
            });
        }

        let schema_name = input.schema_name.trim().to_owned();
        if schema_name.is_empty() {
            return Err(SnapshotError::InvalidSchemaName);
        }

        if schema_name != "DataSnapshot" || input.schema_version.as_str() != "v1" {
            return Err(SnapshotError::InvalidSchemaName);
        }
        if input.window.end_at > input.captured_at || input.captured_at > created_at {
            return Err(SnapshotError::InvalidChronology);
        }
        if [
            input.sources.len(),
            input.lineage.len(),
            input.artifact_refs.len(),
            input.symbols.len(),
            input.quality_findings.len(),
        ]
        .into_iter()
        .any(|n| n > MAX_SNAPSHOT_ITEMS)
            || serde_json::to_vec(&input)?.len() > MAX_SNAPSHOT_BYTES
        {
            return Err(SnapshotError::InputBudget);
        }
        let normalized = NormalizedSnapshotInput::from_input(input);
        let content_hash = ContentHash::sha256_bytes(&canonical_json_bytes(
            &normalized.canonical_payload(schema_name.as_str()),
        )?);
        let expires_at = normalized
            .captured_at
            .checked_add_signed(ChronoDuration::seconds(normalized.max_age_secs))
            .ok_or(SnapshotError::InvalidChronology)?;

        Ok(Self {
            fields: DataSnapshotFields {
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
            },
        })
    }

    pub fn input(&self) -> DataSnapshotInput {
        DataSnapshotInput {
            schema_name: self.schema_name.clone(),
            schema_version: self.schema_version.clone(),
            schema_entry_id: self.schema_entry_id,
            window: self.window.clone(),
            sources: self.sources.clone(),
            quality: self.quality,
            quality_findings: self.quality_findings.clone(),
            license_label: self.license_label.clone(),
            captured_at: self.captured_at,
            max_age_secs: self.max_age_secs,
            symbols: self.symbols.clone(),
            artifact_refs: self.artifact_refs.clone(),
            lineage: self.lineage.clone(),
        }
    }

    pub fn canonical_payload_bytes(&self) -> Result<Vec<u8>, SnapshotError> {
        Ok(canonical_json_bytes(
            &NormalizedSnapshotInput::from_input(self.input()).canonical_payload(&self.schema_name),
        )?)
    }

    pub fn validate_integrity(&self) -> Result<(), SnapshotError> {
        let expected = Self::new(self.tenant_id, self.input(), self.created_at)?;
        if expected.fields.expires_at != self.expires_at
            || expected.fields.content_hash != self.content_hash
            || expected.input() != self.input()
        {
            return Err(SnapshotError::Integrity);
        }
        Ok(())
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
    pub fn from_rules(
        rules: impl IntoIterator<Item = SnapshotQualityRule>,
    ) -> Result<Self, SnapshotError> {
        let mut indexed = BTreeMap::new();
        let mut tenant = None;
        for rule in rules {
            rule.validate()?;
            if tenant.is_some_and(|id| id != rule.tenant_id) || indexed.contains_key(&rule.usage) {
                return Err(SnapshotError::RuleConflict);
            }
            tenant = Some(rule.tenant_id);
            indexed.insert(rule.usage, rule);
        }
        Ok(Self { rules: indexed })
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
        if snapshot.validate_integrity().is_err() {
            violations.push(SnapshotGateViolation::MetadataIncomplete { field: "integrity" });
        }
        if snapshot.captured_at > observed_at || snapshot.window.end_at > snapshot.captured_at {
            violations.push(SnapshotGateViolation::MetadataIncomplete {
                field: "chronology",
            });
        }
        let strict = usage != SnapshotUsage::Research;
        if strict && (snapshot.symbols.is_empty() || snapshot.artifact_refs.is_empty()) {
            violations.push(SnapshotGateViolation::MetadataIncomplete {
                field: "data_dependencies",
            });
        }
        if snapshot.sources.iter().any(|s| {
            [
                s.source_id.as_str(),
                s.provider.as_str(),
                s.dataset.as_str(),
            ]
            .into_iter()
            .any(|v| v.trim().is_empty())
        }) {
            violations.push(SnapshotGateViolation::MetadataIncomplete {
                field: "source_identity",
            });
        }
        if snapshot.lineage.iter().any(|l| {
            l.lineage_kind.trim().is_empty()
                || l.reference.trim().is_empty()
                || !l.details.is_object()
        }) {
            violations.push(SnapshotGateViolation::MetadataIncomplete { field: "lineage" });
        }
        if snapshot.artifact_refs.iter().any(|a| {
            a.media_type.trim().is_empty()
                || a.storage_bucket.trim().is_empty()
                || a.object_key.trim().is_empty()
        }) {
            violations.push(SnapshotGateViolation::MetadataIncomplete {
                field: "artifact_refs",
            });
        }
        if (strict || rule.require_license) && snapshot.license_label.trim().is_empty() {
            violations.push(SnapshotGateViolation::LicenseMissing);
        }
        if snapshot.sources.is_empty() {
            violations.push(SnapshotGateViolation::MetadataIncomplete { field: "sources" });
        } else if (strict || rule.require_license)
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
        if (strict || rule.require_freshness)
            && (snapshot.is_expired(observed_at)
                || snapshot
                    .window
                    .end_at
                    .checked_add_signed(ChronoDuration::seconds(snapshot.max_age_secs))
                    .is_none_or(|deadline| observed_at > deadline))
        {
            violations.push(SnapshotGateViolation::Expired);
        }
        if (strict && snapshot.quality != SnapshotQuality::Passed)
            || !rule.allows_quality(snapshot.quality)
        {
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

    pub fn upsert(
        &mut self,
        snapshot: DataSnapshotRecord,
    ) -> Result<&DataSnapshotRecord, SnapshotError> {
        snapshot.validate_integrity()?;
        let hash_key = (snapshot.tenant_id, snapshot.content_hash.clone());
        let id_key = (snapshot.tenant_id, snapshot.snapshot_id);
        let snapshot = self.snapshots_by_hash.entry(hash_key).or_insert(snapshot);
        self.hash_by_id
            .insert(id_key, snapshot.content_hash.clone());
        Ok(snapshot)
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
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("SNAPSHOT_REFERENCE: persisted schema, artifact or lineage reference is invalid")]
    Reference,
    #[error("SNAPSHOT_WRITE_CONTEXT: tenant, actor, correlation, cause and reason are required")]
    WriteContext,
    #[error("SNAPSHOT_INTEGRITY: content hash or derived fields are inconsistent")]
    Integrity,
    #[error("SNAPSHOT_INVALID_CHRONOLOGY: window, capture or creation time is inconsistent")]
    InvalidChronology,
    #[error("SNAPSHOT_INPUT_BUDGET: input exceeds bounded collection or byte budget")]
    InputBudget,
    #[error("SNAPSHOT_UNSAFE_RULE: strategy/trading safety floor cannot be disabled")]
    UnsafeRule,
    #[error("SNAPSHOT_RULE_CONFLICT: duplicate usage or mixed tenant")]
    RuleConflict,
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
            Self::Json(_) => "SNAPSHOT_JSON",
            Self::WriteContext => "SNAPSHOT_WRITE_CONTEXT",
            Self::Reference => "SNAPSHOT_REFERENCE",
            Self::Integrity => "SNAPSHOT_INTEGRITY",
            Self::InvalidChronology => "SNAPSHOT_INVALID_CHRONOLOGY",
            Self::InputBudget => "SNAPSHOT_INPUT_BUDGET",
            Self::UnsafeRule => "SNAPSHOT_UNSAFE_RULE",
            Self::RuleConflict => "SNAPSHOT_RULE_CONFLICT",
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
#[path = "../tests/unit/snapshot.rs"]
mod tests;
