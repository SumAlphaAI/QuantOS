use bytes::Bytes;

use super::{SupabaseStorageAdapter, SupabaseStorageConfig, validate_payload_hash};
use crate::ArtifactManifest;
use chrono::{TimeZone, Utc};
use quantos_core::{ContentHash, TenantId};

#[test]
fn object_url_points_to_supabase_storage_endpoint() {
    let tenant_id = TenantId::new();
    let payload = Bytes::from_static(br#"{"artifact":"payload"}"#);
    let manifest = ArtifactManifest::new(
        tenant_id,
        "application/json",
        ContentHash::sha256_bytes(&payload),
        "quantos-artifacts",
        payload.len() as u64,
        Utc.with_ymd_and_hms(2026, 7, 28, 12, 0, 0)
            .single()
            .expect("valid timestamp"),
    );

    let adapter = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: "https://example.supabase.co/".to_owned(),
        bucket_name: "quantos-artifacts".to_owned(),
        api_key: "test-key".to_owned(),
        authorization_token: None,
        upsert: true,
    })
    .expect("adapter builds");

    assert_eq!(
        adapter.object_url(&manifest),
        format!(
            "https://example.supabase.co/storage/v1/object/{}/{}",
            manifest.storage_bucket, manifest.object_key
        )
    );
}

#[test]
fn payload_hash_validation_rejects_mismatch() {
    let error = validate_payload_hash(
        &ContentHash::sha256_bytes(br#"{"expected":"payload"}"#),
        &Bytes::from_static(br#"{"actual":"payload"}"#),
    )
    .expect_err("hash mismatch should be rejected");

    assert!(error.to_string().contains("artifact hash mismatch"));
}
