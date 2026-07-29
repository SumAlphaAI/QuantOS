pub mod pg;
pub mod supabase_storage;

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use quantos_core::{
    ArtifactId, ContentHash, CoreError, SchemaEntryId, SchemaVersion, TenantId,
    canonical_json_bytes,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
mod tests {
    use chrono::{TimeZone, Utc};
    use serde_json::json;

    use super::{ArtifactManifest, InMemorySchemaRegistry, object_key_for_content};
    use quantos_core::{ContentHash, SchemaVersion, TenantId};

    #[test]
    fn object_keys_are_deterministic_for_same_hash() {
        let tenant_id = TenantId::new();
        let hash = ContentHash::sha256_bytes(br#"{"hello":"world"}"#);

        assert_eq!(
            object_key_for_content(&tenant_id, &hash),
            object_key_for_content(&tenant_id, &hash)
        );
    }

    #[test]
    fn artifact_manifest_uses_hash_based_object_key() {
        let tenant_id = TenantId::new();
        let hash = ContentHash::sha256_bytes(br#"payload"#);
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            hash.clone(),
            "quantos-artifacts",
            7,
            Utc.with_ymd_and_hms(2026, 7, 28, 12, 0, 0)
                .single()
                .expect("valid timestamp"),
        )
        .with_metadata("source", "unit-test");

        assert!(
            manifest
                .object_key
                .ends_with(hash.as_str().trim_start_matches("sha256:"))
        );
        assert_eq!(manifest.metadata["source"], "unit-test");
    }

    #[test]
    fn schema_registry_deduplicates_equivalent_documents() {
        let tenant_id = TenantId::new();
        let version = SchemaVersion::parse("v1").expect("schema version parses");
        let created_at = Utc
            .with_ymd_and_hms(2026, 7, 28, 12, 30, 0)
            .single()
            .expect("valid timestamp");
        let mut registry = InMemorySchemaRegistry::new();

        let first = registry
            .register(
                tenant_id,
                "events",
                "TradeCommand",
                version.clone(),
                json!({ "type": "object", "required": ["tenant_id", "correlation_id"] }),
                created_at,
            )
            .expect("schema registers")
            .clone();
        let second = registry
            .register(
                tenant_id,
                "events",
                "TradeCommand",
                version.clone(),
                json!({ "required": ["tenant_id", "correlation_id"], "type": "object" }),
                created_at,
            )
            .expect("schema registers")
            .clone();

        assert_eq!(first.schema_entry_id, second.schema_entry_id);
        assert_eq!(first.content_hash, second.content_hash);
        assert!(
            registry
                .get(tenant_id, "events", "TradeCommand", &version)
                .is_some()
        );
    }
}
