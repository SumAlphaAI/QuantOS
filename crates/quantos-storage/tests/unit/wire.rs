use super::*;
use crate::{
    DataSnapshotInput, SnapshotArtifactRef, SnapshotLineageEntry, SnapshotQuality,
    SnapshotSourceRef, SnapshotWindow,
};
use quantos_core::{ArtifactId, ContentHash, SchemaVersion};
use quantos_proto::quantos::common::v1::ActorRef;
use serde_json::json;
fn metadata() -> CommandMetadata {
    CommandMetadata {
        request_id: uuid::Uuid::new_v4().to_string(),
        tenant_id: TenantId::new().to_string(),
        workspace_id: uuid::Uuid::new_v4().to_string(),
        actor: Some(ActorRef {
            actor_id: ActorId::new().to_string(),
            actor_kind: 2,
            display_name: "fixture".into(),
            capabilities: vec!["snapshot.write".into()],
        }),
        correlation_id: CorrelationId::new().to_string(),
        causation_id: EventId::new().to_string(),
        mode: 1,
        environment: 2,
        issued_at: Some(timestamp(Utc::now())),
    }
}
#[test]
fn wire_projection_preserves_identity_and_all_quality_variants() {
    let meta = metadata();
    let ctx = SnapshotWriteContext::from_command_metadata(&meta, "fixture").unwrap();
    let now = Utc::now();
    for quality in [
        SnapshotQuality::Pending,
        SnapshotQuality::Passed,
        SnapshotQuality::Degraded,
        SnapshotQuality::Failed,
    ] {
        let record = DataSnapshotRecord::new(
            ctx.tenant_id,
            DataSnapshotInput {
                schema_name: "DataSnapshot".into(),
                schema_version: SchemaVersion::parse("v1").unwrap(),
                schema_entry_id: None,
                window: SnapshotWindow {
                    start_at: now,
                    end_at: now,
                },
                sources: vec![SnapshotSourceRef {
                    source_id: "fixture".into(),
                    provider: "fixture".into(),
                    dataset: "fixture".into(),
                    license_label: "fixture-only".into(),
                }],
                quality,
                quality_findings: vec![],
                license_label: "fixture-only".into(),
                captured_at: now,
                max_age_secs: 10,
                symbols: vec!["BTCUSDT".into()],
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".into(),
                    content_hash: ContentHash::sha256_bytes(b"wire"),
                    storage_bucket: "fixture".into(),
                    object_key: "fixture".into(),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "fixture".into(),
                    reference: "fixture".into(),
                    details: json!({}),
                }],
            },
            now,
        )
        .unwrap();
        let wire = snapshot_to_wire(&record, meta.clone()).unwrap();
        assert_eq!(wire.content_hash, record.content_hash.as_str());
        assert_eq!(wire.snapshot_id, record.snapshot_id.to_string());
        assert_eq!(
            wire.metadata
                .as_ref()
                .unwrap()
                .actor
                .as_ref()
                .unwrap()
                .actor_id,
            ctx.actor_id.to_string()
        );
        assert_eq!(wire.artifact_refs.len(), 1);
        assert_eq!(wire.sources.len(), 1);
        let mut foreign = meta.clone();
        foreign.tenant_id = TenantId::new().to_string();
        assert!(snapshot_to_wire(&record, foreign).is_err());
    }
}
#[test]
fn incomplete_or_invalid_metadata_cannot_become_write_context() {
    let mut meta = metadata();
    meta.actor = None;
    assert!(SnapshotWriteContext::from_command_metadata(&meta, "fixture").is_err());
    let mut meta = metadata();
    meta.tenant_id = "invalid".into();
    assert!(SnapshotWriteContext::from_command_metadata(&meta, "fixture").is_err());
    let mut meta = metadata();
    meta.causation_id.clear();
    let ctx = SnapshotWriteContext::from_command_metadata(&meta, "fixture").unwrap();
    assert_eq!(ctx.causation_id.to_string(), meta.request_id);
    assert!(SnapshotWriteContext::from_command_metadata(&metadata(), "").is_err());
    let mut ctx = ctx;
    ctx.actor_id = ActorId::from_uuid(uuid::Uuid::nil());
    assert!(ctx.validate(ctx.tenant_id).is_err());
}
