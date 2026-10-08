pub mod pg;
pub mod provenance;
pub mod snapshot;
pub mod supabase_storage;
pub mod wire;

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use quantos_core::{
    ArtifactId, ContentHash, CoreError, SchemaEntryId, SchemaVersion, TenantId,
    canonical_json_bytes,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use snapshot::{
    DataSnapshotInput, DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotArtifactRef,
    SnapshotError, SnapshotGateDecision, SnapshotGateViolation, SnapshotLineageEntry,
    SnapshotQuality, SnapshotQualityFinding, SnapshotQualityGate, SnapshotQualityRule,
    SnapshotQualityRuleset, SnapshotSourceRef, SnapshotUsage, SnapshotWindow,
    default_quality_rules,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArtifactManifest {
    pub artifact_id: ArtifactId,
    pub tenant_id: TenantId,
    pub media_type: String,
    pub content_hash: ContentHash,
    pub storage_bucket: String,
    pub object_key: String,
    pub size_bytes: u64,
    pub metadata: BTreeMap<String, String>,
    pub created_at: DateTime<Utc>,
}

impl ArtifactManifest {
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        media_type: impl Into<String>,
        content_hash: ContentHash,
        storage_bucket: impl Into<String>,
        size_bytes: u64,
        created_at: DateTime<Utc>,
    ) -> Self {
        let object_key = object_key_for_content(&tenant_id, &content_hash);
        Self {
            artifact_id: ArtifactId::new(),
            tenant_id,
            media_type: media_type.into(),
            content_hash,
            storage_bucket: storage_bucket.into(),
            object_key,
            size_bytes,
            metadata: BTreeMap::new(),
            created_at,
        }
    }

    #[must_use]
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SchemaRegistryEntry {
    pub schema_entry_id: SchemaEntryId,
    pub tenant_id: TenantId,
    pub domain: String,
    pub schema_name: String,
    pub schema_version: SchemaVersion,
    pub content_hash: ContentHash,
    pub schema_document: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Default, Clone)]
pub struct InMemorySchemaRegistry {
    entries: BTreeMap<(TenantId, String, String, SchemaVersion), SchemaRegistryEntry>,
}

impl InMemorySchemaRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(
        &mut self,
        tenant_id: TenantId,
        domain: impl Into<String>,
        schema_name: impl Into<String>,
        schema_version: SchemaVersion,
        schema_document: Value,
        created_at: DateTime<Utc>,
    ) -> Result<&SchemaRegistryEntry, CoreError> {
        let domain = domain.into();
        let schema_name = schema_name.into();
        let schema_bytes = canonical_json_bytes(&schema_document)?;
        let entry = SchemaRegistryEntry {
            schema_entry_id: SchemaEntryId::new(),
            tenant_id,
            domain: domain.clone(),
            schema_name: schema_name.clone(),
            schema_version: schema_version.clone(),
            content_hash: ContentHash::sha256_bytes(&schema_bytes),
            schema_document,
            created_at,
        };

        let key = (tenant_id, domain, schema_name, schema_version);
        let existing = self.entries.entry(key).or_insert(entry);
        Ok(existing)
    }

    #[must_use]
    pub fn get(
        &self,
        tenant_id: TenantId,
        domain: &str,
        schema_name: &str,
        schema_version: &SchemaVersion,
    ) -> Option<&SchemaRegistryEntry> {
        self.entries.get(&(
            tenant_id,
            domain.to_owned(),
            schema_name.to_owned(),
            schema_version.clone(),
        ))
    }
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryArtifactCatalog {
    manifests: BTreeMap<(TenantId, ContentHash), ArtifactManifest>,
}

impl InMemoryArtifactCatalog {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn upsert(&mut self, manifest: ArtifactManifest) -> &ArtifactManifest {
        let key = (manifest.tenant_id, manifest.content_hash.clone());
        self.manifests.entry(key).or_insert(manifest)
    }

    #[must_use]
    pub fn find_by_hash(
        &self,
        tenant_id: TenantId,
        content_hash: &ContentHash,
    ) -> Option<&ArtifactManifest> {
        self.manifests.get(&(tenant_id, content_hash.clone()))
    }
}

#[must_use]
pub fn object_key_for_content(tenant_id: &TenantId, content_hash: &ContentHash) -> String {
    let digest = content_hash
        .as_str()
        .strip_prefix("sha256:")
        .unwrap_or_else(|| content_hash.as_str());
    let prefix = &digest[..2];
    format!("tenant/{tenant_id}/artifacts/{prefix}/{digest}")
}

#[cfg(test)]
#[path = "../tests/unit/lib.rs"]
mod tests;
