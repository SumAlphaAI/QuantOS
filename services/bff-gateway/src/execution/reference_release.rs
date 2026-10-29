//! Explicit owned synthetic seed for the loopback Paper reference; never loaded by live mode.
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    AccountId, ActorId, ArtifactId, ContentHash, SchemaVersion, TenantId, WorkspaceId,
    canonical_json_bytes,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_storage::{
    ArtifactManifest, DataSnapshotInput, DataSnapshotRecord, InMemoryArtifactCatalog,
    InMemoryDataSnapshotCatalog, SnapshotArtifactRef, SnapshotLineageEntry, SnapshotQuality,
    SnapshotQualityRuleset, SnapshotSourceRef, SnapshotWindow, default_quality_rules,
};
use quantos_strategy::{
    DraftArtifactRef, DraftSaveKind, DraftVersionInput,
    backtest::{BacktestBarSeries, BacktestCandidate, BacktestCostModel, BacktestRequest},
    drafts::DraftService,
    release::ValidatedBacktest,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, io::Read, sync::OnceLock};

// Only the running image identity is immutable. Source SHA, clocks and owned
// domain material must still be resolved independently for every fixture.
pub(crate) fn reference_image_digest() -> &'static ContentHash {
    static IMAGE: OnceLock<ContentHash> = OnceLock::new();
    IMAGE.get_or_init(|| {
        let mut file = std::fs::File::open(std::env::current_exe().unwrap()).unwrap();
        let mut hash = Sha256::new();
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let count = file.read(&mut buffer).unwrap();
            if count == 0 {
                break;
            }
            hash.update(&buffer[..count]);
        }
        ContentHash::parse(&format!("sha256:{:x}", hash.finalize())).unwrap()
    })
}
fn honest_snapshot(start: DateTime<Utc>, captured_at: DateTime<Utc>) -> DataSnapshotRecord {
    DataSnapshotRecord::new(
        TenantId::from_uuid(uuid::Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap()),
        DataSnapshotInput {
            schema_name: "DataSnapshot".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: start,
                end_at: start + ChronoDuration::minutes(239),
            },
            sources: vec![SnapshotSourceRef {
                source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                provider: "approved.binance.spot".to_owned(),
                dataset: "crypto.bars.v1".to_owned(),
                license_label: "internal-approved".to_owned(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: "internal-approved".to_owned(),
            captured_at,
            max_age_secs: 86_400,
            symbols: vec!["BTCUSDT".to_owned()],
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: ArtifactId::new(),
                media_type: "application/json".to_owned(),
                content_hash: BacktestBarSeries::fixture(
                    "BTCUSDT",
                    ContentHash::sha256_bytes(b"unbound"),
                    48,
                    start,
                )
                .data_hash()
                .unwrap(),
                storage_bucket: "quantos-artifacts".to_owned(),
                object_key: "tenant/example/snapshots/bars".to_owned(),
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".to_owned(),
                reference: "market:BTCUSDT".to_owned(),
                details: json!({ "from_sequence": 1, "to_sequence": 48 }),
            }],
        },
        captured_at,
    )
    .expect("snapshot builds")
}

fn honest_request_at(now: DateTime<Utc>) -> BacktestRequest {
    // Each fixture owns one clock. A long test process must not reuse the first
    // fixture's wall time and accidentally age new risk inputs past their TTL.
    let clock = DateTime::from_timestamp_micros(now.timestamp_micros()).unwrap()
        - ChronoDuration::seconds(10);
    let start = clock - ChronoDuration::hours(4);
    let snapshot = honest_snapshot(start, clock);
    let series = BacktestBarSeries::fixture("BTCUSDT", snapshot.content_hash.clone(), 48, start);
    BacktestRequest {
        snapshot,
        series,
        cost_model: BacktestCostModel::new(8, 12),
        warmup_bars: 8,
        candidate: BacktestCandidate {
            source_commit: "a".repeat(40),
            image_digest: ContentHash::sha256_bytes(b"fixture-image"),
            runtime_digest: ContentHash::sha256_bytes(b"fixture-runtime"),
            clock,
        },
        draft: None,
    }
}

pub fn payload() -> Value {
    json!({"artifact_type":"StrategyDraftArtifact","release_eligible":true,"static_check":{"passed":true,"findings":[]},"strategy":{"rule":"momentum","rule_source":"momentum(close, lookback=6)","parameters":{"lookback":6,"entry_threshold_bps":20,"exit_threshold_bps":-10,"max_position_notional":"1000","universe":["BTCUSDT"]}}})
}
pub(crate) fn material(
    payload: &Value,
) -> (
    AuthContext,
    DraftService,
    BacktestRequest,
    Vec<DraftArtifactRef>,
) {
    material_at(payload, Utc::now())
}
pub(crate) fn material_at(
    payload: &Value,
    at: DateTime<Utc>,
) -> (
    AuthContext,
    DraftService,
    BacktestRequest,
    Vec<DraftArtifactRef>,
) {
    let image_digest = reference_image_digest().clone();
    let mut request = honest_request_at(at);
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    request.candidate.source_commit = quantos_core::fixture_source::fixture_source_commit(
        &root,
        std::env::var("GITHUB_SHA").ok().as_deref(),
    )
    .expect("owned fixture requires a checkout HEAD or frozen archive SHA");
    request.candidate.image_digest = image_digest;
    request.candidate.runtime_digest =
        ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap());
    let now = request.candidate.clock;
    let auth = AuthContext {
        tenant_id: request.snapshot.tenant_id,
        actor_id: ActorId::from_uuid(
            uuid::Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap(),
        ),
        user_id: uuid::Uuid::now_v7(),
        workspace_id: WorkspaceId::from_uuid(
            uuid::Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap(),
        ),
        workspace_slug: "s03".into(),
        workspace_name: "S03 owned fixture".into(),
        role: Role::Operator,
        mode: RunMode::Paper,
        account_id: Some(AccountId::from_uuid(
            uuid::Uuid::parse_str("44444444-4444-4444-8444-444444444444").unwrap(),
        )),
        capabilities: BTreeSet::from([
            Capability::parse(Capability::STRATEGY_WRITE).unwrap(),
            Capability::parse(Capability::STRATEGY_APPROVE).unwrap(),
        ]),
    };
    let artifact = ArtifactManifest::new(
        auth.tenant_id,
        "application/json",
        ContentHash::sha256_bytes(&canonical_json_bytes(payload).unwrap()),
        "owned-fixture",
        canonical_json_bytes(payload).unwrap().len() as u64,
        now,
    );
    let reference = DraftArtifactRef {
        artifact_id: artifact.artifact_id,
        content_hash: artifact.content_hash.clone(),
    };
    let mut artifacts = InMemoryArtifactCatalog::new();
    artifacts.upsert(artifact);
    let mut snapshots = InMemoryDataSnapshotCatalog::new();
    snapshots.upsert(request.snapshot.clone()).unwrap();
    let drafts = DraftService::new(
        snapshots,
        artifacts,
        SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now)).unwrap(),
    );
    (auth, drafts, request, vec![reference])
}
pub(crate) fn fixture_at(payload: &Value, at: DateTime<Utc>) -> (AuthContext, ValidatedBacktest) {
    let (auth, drafts, request, refs) = material_at(payload, at);
    let now = request.candidate.clock;
    let draft = drafts.create(&auth, "S03 strategy", now).unwrap();
    drafts
        .save(
            &auth,
            DraftVersionInput {
                draft_id: draft.draft_id,
                parameters: payload["strategy"].clone(),
                data_snapshot_id: Some(request.snapshot.snapshot_id),
                artifact_refs: refs,
                base_version: 0,
                save_kind: DraftSaveKind::Manual,
                saved_at: now,
            },
        )
        .unwrap();
    let proof = drafts
        .validated_backtest(&auth, draft.draft_id, request, payload)
        .unwrap();
    (auth, proof)
}

#[cfg(test)]
mod clock_tests {
    use super::*;

    #[test]
    fn material_binds_the_real_image_and_lockfile_without_reusing_domain_state() {
        let payload = payload();
        let (_, _, first, _) = material(&payload);
        let (_, _, second, _) = material(&payload);
        let image = std::fs::read(std::env::current_exe().unwrap()).unwrap();
        assert_eq!(
            first.candidate.image_digest,
            ContentHash::sha256_bytes(&image)
        );
        assert_eq!(first.candidate.image_digest, second.candidate.image_digest);
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        assert_eq!(
            first.candidate.runtime_digest,
            ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap())
        );
        assert_ne!(first.snapshot.snapshot_id, second.snapshot.snapshot_id);
    }

    #[test]
    fn a_later_fixture_uses_its_own_clock_after_a_slow_test_process() {
        let first_now = DateTime::parse_from_rfc3339("2026-10-19T02:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let later_now = first_now + ChronoDuration::minutes(5);
        let first = honest_request_at(first_now);
        let later = honest_request_at(later_now);
        assert_eq!(
            later.candidate.clock - first.candidate.clock,
            ChronoDuration::minutes(5)
        );
        for (request, now) in [(first, first_now), (later, later_now)] {
            assert_eq!(request.candidate.clock, now - ChronoDuration::seconds(10));
            assert_eq!(request.snapshot.captured_at, request.candidate.clock);
            assert_eq!(
                request.snapshot.window.start_at,
                request.series.bars[0].open_time
            );
            assert_eq!(request.series.snapshot_hash, request.snapshot.content_hash);
            request.snapshot.validate_integrity().unwrap();
        }
    }
}
