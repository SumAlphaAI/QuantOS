pub mod backtest;
pub mod generated;
pub mod pg;
pub mod release;

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ArtifactId, ContentHash, CoreError, DraftVersionId, SnapshotId, StrategyDraftId,
    TenantId, WorkspaceId, canonical_json_bytes,
};
use quantos_policy::Capability;
use quantos_storage::{
    InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotGateViolation,
    SnapshotQualityGate, SnapshotQualityRuleset, SnapshotUsage,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DraftSaveKind {
    Manual,
    Autosave,
}

impl DraftSaveKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Autosave => "autosave",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DraftArtifactRef {
    pub artifact_id: ArtifactId,
    pub content_hash: ContentHash,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StrategyDraft {
    pub draft_id: StrategyDraftId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub owner_actor_id: ActorId,
    pub name: String,
    pub head_version: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StrategyDraftVersion {
    pub version_id: DraftVersionId,
    pub draft_id: StrategyDraftId,
    pub tenant_id: TenantId,
    pub version: u64,
    pub parameters: Value,
    pub data_snapshot_id: Option<SnapshotId>,
    pub artifact_refs: Vec<DraftArtifactRef>,
    pub content_hash: ContentHash,
    pub save_kind: DraftSaveKind,
    pub created_by: ActorId,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DraftVersionInput {
    pub draft_id: StrategyDraftId,
    pub parameters: Value,
    pub data_snapshot_id: Option<SnapshotId>,
    pub artifact_refs: Vec<DraftArtifactRef>,
    pub base_version: u64,
    pub save_kind: DraftSaveKind,
    pub saved_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidationHandoff {
    pub draft_id: StrategyDraftId,
    pub version: u64,
    pub version_content_hash: ContentHash,
    pub data_snapshot_id: SnapshotId,
    pub artifact_refs: Vec<DraftArtifactRef>,
    pub initiated_by: ActorId,
    pub initiated_at: DateTime<Utc>,
}

#[derive(Debug, Error)]
pub enum StrategyDraftError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("STRATEGY_DRAFT_UNAUTHORIZED: actor is missing capability `{capability}`")]
    Unauthorized { capability: String },
    #[error("STRATEGY_DRAFT_NOT_FOUND: draft `{draft_id}` is not available")]
    DraftNotFound { draft_id: StrategyDraftId },
    #[error("STRATEGY_DRAFT_PARAMETERS_INVALID: parameters must be a JSON object")]
    ParametersInvalid,
    #[error(
        "STRATEGY_DRAFT_VERSION_CONFLICT: draft `{draft_id}` head is version {head_version}, not base version {base_version}"
    )]
    VersionConflict {
        draft_id: StrategyDraftId,
        base_version: u64,
        head_version: u64,
    },
    #[error(
        "STRATEGY_DRAFT_SNAPSHOT_REF_UNRESOLVED: snapshot `{snapshot_id}` is not an approved data reference"
    )]
    SnapshotRefUnresolved { snapshot_id: SnapshotId },
    #[error(
        "STRATEGY_DRAFT_ARTIFACT_REF_UNRESOLVED: artifact `{artifact_id}` is not an approved artifact reference"
    )]
    ArtifactRefUnresolved { artifact_id: ArtifactId },
    #[error("STRATEGY_VALIDATION_REQUIRES_SNAPSHOT: draft `{draft_id}` pins no DataSnapshot")]
    ValidationMissingSnapshot { draft_id: StrategyDraftId },
    #[error("STRATEGY_VALIDATION_REQUIRES_ARTIFACTS: draft `{draft_id}` references no Artifact")]
    ValidationMissingArtifacts { draft_id: StrategyDraftId },
    #[error("STRATEGY_VALIDATION_SNAPSHOT_GATE_REJECTED: {details}")]
    ValidationSnapshotGateRejected { details: String },
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryStrategyDraftStore {
    drafts: BTreeMap<(TenantId, StrategyDraftId), StrategyDraft>,
    versions: BTreeMap<(TenantId, StrategyDraftId, u64), StrategyDraftVersion>,
}

impl InMemoryStrategyDraftStore {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_draft(
        &mut self,
        auth: &AuthContext,
        name: impl Into<String>,
        created_at: DateTime<Utc>,
    ) -> Result<StrategyDraft, StrategyDraftError> {
        ensure_strategy_write(auth)?;
        let draft = StrategyDraft {
            draft_id: StrategyDraftId::new(),
            tenant_id: auth.tenant_id,
            workspace_id: auth.workspace_id,
            owner_actor_id: auth.actor_id,
            name: name.into(),
            head_version: 0,
            created_at,
            updated_at: created_at,
        };
        self.drafts
            .insert((draft.tenant_id, draft.draft_id), draft.clone());
        Ok(draft)
    }

    pub fn save_version(
        &mut self,
        auth: &AuthContext,
        input: DraftVersionInput,
        snapshots: &InMemoryDataSnapshotCatalog,
        artifacts: &InMemoryArtifactCatalog,
    ) -> Result<StrategyDraftVersion, StrategyDraftError> {
        ensure_strategy_write(auth)?;
        if !input.parameters.is_object() {
            return Err(StrategyDraftError::ParametersInvalid);
        }
        let key = (auth.tenant_id, input.draft_id);
        let draft = self
            .drafts
            .get_mut(&key)
            .ok_or(StrategyDraftError::DraftNotFound {
                draft_id: input.draft_id,
            })?;
        if draft.head_version != input.base_version {
            return Err(StrategyDraftError::VersionConflict {
                draft_id: input.draft_id,
                base_version: input.base_version,
                head_version: draft.head_version,
            });
        }
        if let Some(snapshot_id) = input.data_snapshot_id
            && snapshots.get(auth.tenant_id, snapshot_id).is_none()
        {
            return Err(StrategyDraftError::SnapshotRefUnresolved { snapshot_id });
        }
        for artifact_ref in &input.artifact_refs {
            let approved = artifacts
                .find_by_hash(auth.tenant_id, &artifact_ref.content_hash)
                .is_some_and(|manifest| manifest.artifact_id == artifact_ref.artifact_id);
            if !approved {
                return Err(StrategyDraftError::ArtifactRefUnresolved {
                    artifact_id: artifact_ref.artifact_id,
                });
            }
        }

        let version = draft.head_version + 1;
        let content_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "parameters": input.parameters,
            "data_snapshot_id": input.data_snapshot_id.map(|id| id.to_string()),
            "artifact_refs": input.artifact_refs,
            "save_kind": input.save_kind.as_str(),
        }))?);
        let record = StrategyDraftVersion {
            version_id: DraftVersionId::new(),
            draft_id: input.draft_id,
            tenant_id: auth.tenant_id,
            version,
            parameters: input.parameters,
            data_snapshot_id: input.data_snapshot_id,
            artifact_refs: input.artifact_refs,
            content_hash,
            save_kind: input.save_kind,
            created_by: auth.actor_id,
            created_at: input.saved_at,
        };
        draft.head_version = version;
        draft.updated_at = input.saved_at;
        self.versions.insert(
            (record.tenant_id, record.draft_id, record.version),
            record.clone(),
        );
        Ok(record)
    }

    #[must_use]
    pub fn get_draft(
        &self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
    ) -> Option<&StrategyDraft> {
        self.drafts.get(&(tenant_id, draft_id))
    }

    #[must_use]
    pub fn head_version(
        &self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
    ) -> Option<&StrategyDraftVersion> {
        let head = self.get_draft(tenant_id, draft_id)?.head_version;
        self.versions.get(&(tenant_id, draft_id, head))
    }

    #[must_use]
    pub fn list_versions(
        &self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
    ) -> Vec<&StrategyDraftVersion> {
        self.versions
            .range((tenant_id, draft_id, 0)..=(tenant_id, draft_id, u64::MAX))
            .map(|(_, version)| version)
            .collect()
    }

    pub fn initiate_validation(
        &self,
        auth: &AuthContext,
        draft_id: StrategyDraftId,
        snapshots: &InMemoryDataSnapshotCatalog,
        quality_rules: &SnapshotQualityRuleset,
        observed_at: DateTime<Utc>,
    ) -> Result<ValidationHandoff, StrategyDraftError> {
        ensure_strategy_write(auth)?;
        let head = self
            .head_version(auth.tenant_id, draft_id)
            .ok_or(StrategyDraftError::DraftNotFound { draft_id })?;
        let snapshot_id = head
            .data_snapshot_id
            .ok_or(StrategyDraftError::ValidationMissingSnapshot { draft_id })?;
        if head.artifact_refs.is_empty() {
            return Err(StrategyDraftError::ValidationMissingArtifacts { draft_id });
        }
        let snapshot = snapshots
            .get(auth.tenant_id, snapshot_id)
            .ok_or(StrategyDraftError::SnapshotRefUnresolved { snapshot_id })?;
        let decision = SnapshotQualityGate::evaluate(
            snapshot,
            SnapshotUsage::Strategy,
            observed_at,
            quality_rules,
        );
        if !decision.allowed {
            let details = decision
                .violations
                .iter()
                .map(gate_violation_detail)
                .collect::<Vec<_>>()
                .join(", ");
            return Err(StrategyDraftError::ValidationSnapshotGateRejected { details });
        }

        Ok(ValidationHandoff {
            draft_id,
            version: head.version,
            version_content_hash: head.content_hash.clone(),
            data_snapshot_id: snapshot_id,
            artifact_refs: head.artifact_refs.clone(),
            initiated_by: auth.actor_id,
            initiated_at: observed_at,
        })
    }
}

fn ensure_strategy_write(auth: &AuthContext) -> Result<(), StrategyDraftError> {
    let capability =
        Capability::parse(Capability::STRATEGY_WRITE).expect("capability constant parses");
    if auth.capabilities.contains(&capability) {
        return Ok(());
    }
    Err(StrategyDraftError::Unauthorized {
        capability: Capability::STRATEGY_WRITE.to_owned(),
    })
}

fn gate_violation_detail(violation: &SnapshotGateViolation) -> String {
    match violation {
        SnapshotGateViolation::LicenseMissing => "license missing".to_owned(),
        SnapshotGateViolation::Expired => "snapshot expired".to_owned(),
        SnapshotGateViolation::QualityInsufficient { quality } => {
            format!("quality `{}` rejected", quality.as_str())
        }
        SnapshotGateViolation::RuleMissing { usage } => {
            format!("missing rule for usage `{}`", usage.as_str())
        }
    }
}

/// Deterministic strategy parameter fixture used by contract tests and harness replay.
#[must_use]
pub fn strategy_fixture_parameters(seed: u64) -> Value {
    json!({
        "strategy_family": "trend_following",
        "lookback_bars": 20 + (seed % 40),
        "entry_threshold_bps": 5 + (seed % 25),
        "exit_threshold_bps": 3 + (seed % 10),
        "max_position_notional": "25000",
        "universe": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        "seed": seed,
    })
}

#[cfg(test)]
mod tests {
    use std::{collections::BTreeSet, time::Instant};

    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_auth::AuthContext;
    use quantos_core::{AccountId, ContentHash, SchemaVersion};
    use quantos_policy::{Role, RunMode};
    use quantos_storage::{
        ArtifactManifest, DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef,
        SnapshotLineageEntry, SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
        default_quality_rules,
    };
    use serde_json::json;

    use super::*;

    fn auth_context() -> AuthContext {
        AuthContext {
            tenant_id: TenantId::new(),
            actor_id: ActorId::new(),
            user_id: uuid::Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "primary".to_owned(),
            workspace_name: "Primary".to_owned(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::new()),
            capabilities: BTreeSet::from([
                Capability::parse(Capability::STRATEGY_WRITE).expect("capability parses")
            ]),
        }
    }

    fn unauthorized_auth() -> AuthContext {
        let mut auth = auth_context();
        auth.capabilities.clear();
        auth
    }

    fn fixed_now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn approved_snapshot(tenant_id: TenantId) -> (InMemoryDataSnapshotCatalog, SnapshotId) {
        let captured_at = fixed_now() - ChronoDuration::seconds(5);
        let snapshot = DataSnapshotRecord::new(
            tenant_id,
            DataSnapshotInput {
                schema_name: "DataSnapshot".to_owned(),
                schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
                schema_entry_id: None,
                window: SnapshotWindow {
                    start_at: fixed_now() - ChronoDuration::minutes(30),
                    end_at: fixed_now() - ChronoDuration::seconds(10),
                },
                sources: vec![SnapshotSourceRef {
                    source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                    provider: "approved.binance.spot".to_owned(),
                    dataset: "crypto.top_of_book.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                }],
                quality: SnapshotQuality::Passed,
                quality_findings: vec![],
                license_label: "internal-approved".to_owned(),
                captured_at,
                max_age_secs: 3_600,
                symbols: vec!["BTCUSDT".to_owned()],
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: ContentHash::sha256_bytes(br#"{"snapshot":"fixture"}"#),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: "tenant/example/snapshots/1".to_owned(),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "market_event_range".to_owned(),
                    reference: "market:BTCUSDT".to_owned(),
                    details: json!({ "from_sequence": 1, "to_sequence": 100 }),
                }],
            },
            fixed_now(),
        )
        .expect("snapshot builds");
        let snapshot_id = snapshot.snapshot_id;
        let mut catalog = InMemoryDataSnapshotCatalog::new();
        catalog.upsert(snapshot);
        (catalog, snapshot_id)
    }

    fn approved_artifact(tenant_id: TenantId) -> (InMemoryArtifactCatalog, DraftArtifactRef) {
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            ContentHash::sha256_bytes(br#"{"artifact":"approved"}"#),
            "quantos-artifacts",
            24,
            fixed_now(),
        );
        let artifact_ref = DraftArtifactRef {
            artifact_id: manifest.artifact_id,
            content_hash: manifest.content_hash.clone(),
        };
        let mut catalog = InMemoryArtifactCatalog::new();
        catalog.upsert(manifest);
        (catalog, artifact_ref)
    }

    #[test]
    fn fifty_concurrent_editors_never_silently_overwrite() {
        let auth = auth_context();
        let (snapshots, snapshot_id) = approved_snapshot(auth.tenant_id);
        let (artifacts, artifact_ref) = approved_artifact(auth.tenant_id);
        let mut store = InMemoryStrategyDraftStore::new();
        let draft = store
            .create_draft(&auth, "trend.alpha", fixed_now())
            .expect("draft creates");

        let build_input = |seed: u64, base: u64| DraftVersionInput {
            draft_id: draft.draft_id,
            parameters: strategy_fixture_parameters(seed),
            data_snapshot_id: Some(snapshot_id),
            artifact_refs: vec![artifact_ref.clone()],
            base_version: base,
            save_kind: DraftSaveKind::Manual,
            saved_at: fixed_now(),
        };

        let mut conflicts = 0;
        let mut winners = 0;
        for seed in 0..50_u64 {
            match store.save_version(&auth, build_input(seed, 0), &snapshots, &artifacts) {
                Ok(_) => winners += 1,
                Err(StrategyDraftError::VersionConflict { .. }) => conflicts += 1,
                Err(error) => panic!("unexpected error: {error}"),
            }
        }
        assert_eq!(winners, 1);
        assert_eq!(conflicts, 49);

        for seed in 1..50_u64 {
            let head = store
                .get_draft(auth.tenant_id, draft.draft_id)
                .expect("draft exists")
                .head_version;
            store
                .save_version(&auth, build_input(seed, head), &snapshots, &artifacts)
                .expect("retry with fresh base succeeds");
        }

        let draft_after = store
            .get_draft(auth.tenant_id, draft.draft_id)
            .expect("draft exists");
        assert_eq!(draft_after.head_version, 50);

        let versions = store.list_versions(auth.tenant_id, draft.draft_id);
        assert_eq!(versions.len(), 50);
        let numbers: BTreeSet<u64> = versions.iter().map(|version| version.version).collect();
        assert_eq!(numbers.len(), 50);
        let hashes: BTreeSet<&ContentHash> = versions
            .iter()
            .map(|version| &version.content_hash)
            .collect();
        assert_eq!(hashes.len(), 50);
        let seeds: BTreeSet<u64> = versions
            .iter()
            .filter_map(|version| version.parameters.get("seed").and_then(Value::as_u64))
            .collect();
        assert_eq!(seeds.len(), 50);
    }

    #[test]
    fn unauthorized_actor_cannot_save_or_initiate_validation() {
        let auth = auth_context();
        let intruder = unauthorized_auth();
        let (snapshots, snapshot_id) = approved_snapshot(auth.tenant_id);
        let (artifacts, artifact_ref) = approved_artifact(auth.tenant_id);
        let mut store = InMemoryStrategyDraftStore::new();
        let draft = store
            .create_draft(&auth, "trend.alpha", fixed_now())
            .expect("draft creates");

        let create_error = store
            .create_draft(&intruder, "trend.evil", fixed_now())
            .expect_err("unauthorized create fails");
        assert!(matches!(
            create_error,
            StrategyDraftError::Unauthorized { .. }
        ));

        let save_error = store
            .save_version(
                &intruder,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    parameters: strategy_fixture_parameters(1),
                    data_snapshot_id: Some(snapshot_id),
                    artifact_refs: vec![artifact_ref],
                    base_version: 0,
                    save_kind: DraftSaveKind::Manual,
                    saved_at: fixed_now(),
                },
                &snapshots,
                &artifacts,
            )
            .expect_err("unauthorized save fails");
        assert!(matches!(
            save_error,
            StrategyDraftError::Unauthorized { .. }
        ));

        let rules =
            SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, fixed_now()));
        let validate_error = store
            .initiate_validation(&intruder, draft.draft_id, &snapshots, &rules, fixed_now())
            .expect_err("unauthorized validation fails");
        assert!(matches!(
            validate_error,
            StrategyDraftError::Unauthorized { .. }
        ));
    }

    #[test]
    fn drafts_without_snapshot_or_artifacts_cannot_initiate_validation() {
        let auth = auth_context();
        let (snapshots, snapshot_id) = approved_snapshot(auth.tenant_id);
        let (artifacts, artifact_ref) = approved_artifact(auth.tenant_id);
        let rules =
            SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, fixed_now()));
        let mut store = InMemoryStrategyDraftStore::new();
        let draft = store
            .create_draft(&auth, "trend.incomplete", fixed_now())
            .expect("draft creates");

        let save = |store: &mut InMemoryStrategyDraftStore,
                    snapshot: Option<SnapshotId>,
                    refs: Vec<DraftArtifactRef>| {
            store.save_version(
                &auth,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    parameters: strategy_fixture_parameters(7),
                    data_snapshot_id: snapshot,
                    artifact_refs: refs,
                    base_version: store
                        .get_draft(auth.tenant_id, draft.draft_id)
                        .expect("draft exists")
                        .head_version,
                    save_kind: DraftSaveKind::Autosave,
                    saved_at: fixed_now(),
                },
                &snapshots,
                &artifacts,
            )
        };

        save(&mut store, None, vec![]).expect("draft without refs saves as WIP");
        let missing_snapshot = store
            .initiate_validation(&auth, draft.draft_id, &snapshots, &rules, fixed_now())
            .expect_err("no snapshot means no validation");
        assert!(matches!(
            missing_snapshot,
            StrategyDraftError::ValidationMissingSnapshot { .. }
        ));

        save(&mut store, Some(snapshot_id), vec![]).expect("snapshot-only draft saves");
        let missing_artifacts = store
            .initiate_validation(&auth, draft.draft_id, &snapshots, &rules, fixed_now())
            .expect_err("no artifacts means no validation");
        assert!(matches!(
            missing_artifacts,
            StrategyDraftError::ValidationMissingArtifacts { .. }
        ));

        save(&mut store, Some(snapshot_id), vec![artifact_ref]).expect("complete draft saves");
        let handoff = store
            .initiate_validation(&auth, draft.draft_id, &snapshots, &rules, fixed_now())
            .expect("complete draft initiates validation");
        assert_eq!(handoff.version, 3);
        assert_eq!(handoff.data_snapshot_id, snapshot_id);
        assert_eq!(handoff.artifact_refs.len(), 1);
    }

    #[test]
    fn unapproved_references_are_rejected_at_save_time() {
        let auth = auth_context();
        let (snapshots, _) = approved_snapshot(auth.tenant_id);
        let (artifacts, _) = approved_artifact(auth.tenant_id);
        let mut store = InMemoryStrategyDraftStore::new();
        let draft = store
            .create_draft(&auth, "trend.foreign", fixed_now())
            .expect("draft creates");

        let snapshot_error = store
            .save_version(
                &auth,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    parameters: strategy_fixture_parameters(3),
                    data_snapshot_id: Some(SnapshotId::new()),
                    artifact_refs: vec![],
                    base_version: 0,
                    save_kind: DraftSaveKind::Manual,
                    saved_at: fixed_now(),
                },
                &snapshots,
                &artifacts,
            )
            .expect_err("unknown snapshot is rejected");
        assert!(matches!(
            snapshot_error,
            StrategyDraftError::SnapshotRefUnresolved { .. }
        ));

        let artifact_error = store
            .save_version(
                &auth,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    parameters: strategy_fixture_parameters(3),
                    data_snapshot_id: None,
                    artifact_refs: vec![DraftArtifactRef {
                        artifact_id: ArtifactId::new(),
                        content_hash: ContentHash::sha256_bytes(br#"{"artifact":"foreign"}"#),
                    }],
                    base_version: 0,
                    save_kind: DraftSaveKind::Manual,
                    saved_at: fixed_now(),
                },
                &snapshots,
                &artifacts,
            )
            .expect_err("unknown artifact is rejected");
        assert!(matches!(
            artifact_error,
            StrategyDraftError::ArtifactRefUnresolved { .. }
        ));
    }

    #[test]
    fn draft_saves_stay_under_three_hundred_millis_p95() {
        let auth = auth_context();
        let (snapshots, snapshot_id) = approved_snapshot(auth.tenant_id);
        let (artifacts, artifact_ref) = approved_artifact(auth.tenant_id);
        let mut store = InMemoryStrategyDraftStore::new();
        let draft = store
            .create_draft(&auth, "trend.latency", fixed_now())
            .expect("draft creates");

        let mut durations = Vec::new();
        for seed in 0..50_u64 {
            let head = store
                .get_draft(auth.tenant_id, draft.draft_id)
                .expect("draft exists")
                .head_version;
            let started = Instant::now();
            store
                .save_version(
                    &auth,
                    DraftVersionInput {
                        draft_id: draft.draft_id,
                        parameters: strategy_fixture_parameters(seed),
                        data_snapshot_id: Some(snapshot_id),
                        artifact_refs: vec![artifact_ref.clone()],
                        base_version: head,
                        save_kind: DraftSaveKind::Autosave,
                        saved_at: fixed_now(),
                    },
                    &snapshots,
                    &artifacts,
                )
                .expect("save succeeds");
            durations.push(started.elapsed());
        }

        durations.sort();
        let p95 = durations[(durations.len() * 95 / 100).min(durations.len() - 1)];
        assert!(
            p95 < std::time::Duration::from_millis(300),
            "draft save p95 {p95:?} exceeded 300ms"
        );
    }
}
