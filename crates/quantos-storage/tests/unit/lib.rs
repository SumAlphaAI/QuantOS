use chrono::{TimeZone, Utc};
use serde_json::json;

use super::{
    ArtifactManifest, InMemoryArtifactCatalog, InMemorySchemaRegistry, object_key_for_content,
};
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

#[test]
fn artifact_catalog_deduplicates_by_tenant_and_hash() {
    let tenant_id = TenantId::new();
    let hash = ContentHash::sha256_bytes(br#"artifact"#);
    let created_at = Utc
        .with_ymd_and_hms(2026, 7, 30, 16, 0, 0)
        .single()
        .expect("valid timestamp");
    let mut catalog = InMemoryArtifactCatalog::new();
    let first = catalog
        .upsert(ArtifactManifest::new(
            tenant_id,
            "application/json",
            hash.clone(),
            "quantos-artifacts",
            8,
            created_at,
        ))
        .clone();
    let second = catalog
        .upsert(ArtifactManifest::new(
            tenant_id,
            "application/json",
            hash.clone(),
            "quantos-artifacts",
            8,
            created_at,
        ))
        .clone();

    assert_eq!(first.artifact_id, second.artifact_id);
    assert!(catalog.find_by_hash(tenant_id, &hash).is_some());
}
