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
use std::collections::BTreeSet;
fn series_start() -> DateTime<Utc> {
    {
        static START: std::sync::OnceLock<DateTime<Utc>> = std::sync::OnceLock::new();
        *START.get_or_init(|| {
            DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap()
                - ChronoDuration::hours(4)
        })
    }
}

fn honest_snapshot(captured_at: DateTime<Utc>) -> DataSnapshotRecord {
    DataSnapshotRecord::new(
        TenantId::new(),
        DataSnapshotInput {
            schema_name: "DataSnapshot".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: series_start(),
                end_at: series_start() + ChronoDuration::minutes(239),
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
                    series_start(),
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

pub fn honest_request() -> BacktestRequest {
    let snapshot = honest_snapshot(series_start() + ChronoDuration::hours(4));
    let series =
        BacktestBarSeries::fixture("BTCUSDT", snapshot.content_hash.clone(), 48, series_start());
    BacktestRequest {
        snapshot,
        series,
        cost_model: BacktestCostModel::new(8, 12),
        warmup_bars: 8,
        candidate: BacktestCandidate {
            source_commit: "a".repeat(40),
            image_digest: ContentHash::sha256_bytes(b"fixture-image"),
            runtime_digest: ContentHash::sha256_bytes(b"fixture-runtime"),
            clock: series_start() + ChronoDuration::hours(4),
        },
        draft: None,
    }
}

pub fn payload() -> Value {
    json!({"artifact_type":"StrategyDraftArtifact","release_eligible":true,"static_check":{"passed":true,"findings":[]},"strategy":{"rule":"momentum","rule_source":"momentum(close, lookback=6)","parameters":{"lookback":6,"entry_threshold_bps":20,"exit_threshold_bps":-10,"max_position_notional":"1000","universe":["BTCUSDT"]}}})
}
pub fn fixture(payload: &Value) -> (AuthContext, ValidatedBacktest) {
    let mut request = honest_request();
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let git = std::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&root)
        .output()
        .unwrap();
    assert!(git.status.success());
    request.candidate.source_commit = String::from_utf8(git.stdout).unwrap().trim().into();
    request.candidate.image_digest =
        ContentHash::sha256_bytes(&std::fs::read(std::env::current_exe().unwrap()).unwrap());
    request.candidate.runtime_digest =
        ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap());
    let now = request.candidate.clock;
    let auth = AuthContext {
        tenant_id: request.snapshot.tenant_id,
        actor_id: ActorId::new(),
        user_id: uuid::Uuid::now_v7(),
        workspace_id: WorkspaceId::new(),
        workspace_slug: "s03".into(),
        workspace_name: "S03 owned fixture".into(),
        role: Role::Operator,
        mode: RunMode::Paper,
        account_id: Some(AccountId::new()),
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
    let draft = drafts.create(&auth, "S03 strategy", now).unwrap();
    drafts
        .save(
            &auth,
            DraftVersionInput {
                draft_id: draft.draft_id,
                parameters: payload["strategy"].clone(),
                data_snapshot_id: Some(request.snapshot.snapshot_id),
                artifact_refs: vec![reference],
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
