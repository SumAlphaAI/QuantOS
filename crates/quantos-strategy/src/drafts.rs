//! Process-local S01 API. Callers supply a verified AuthContext from quantos-auth.
//! Catalogs are trusted server inputs; request JSON must never construct them.
use std::sync::Mutex;

use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::StrategyDraftId;
use quantos_storage::{
    InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotQualityRuleset,
};

use crate::{
    DraftVersionInput, InMemoryStrategyDraftStore, StrategyDraft, StrategyDraftError,
    StrategyDraftVersion, ValidationHandoff, ensure_draft_workspace, ensure_strategy_write,
};

/// One shared instance per local service, with atomic compare-and-save across request threads.
/// Restart durability belongs to PgStrategyStore and requires separate target acceptance.
pub struct DraftService {
    store: Mutex<InMemoryStrategyDraftStore>,
    snapshots: InMemoryDataSnapshotCatalog,
    artifacts: InMemoryArtifactCatalog,
    rules: SnapshotQualityRuleset,
}

impl DraftService {
    #[must_use]
    pub fn new(
        snapshots: InMemoryDataSnapshotCatalog,
        artifacts: InMemoryArtifactCatalog,
        rules: SnapshotQualityRuleset,
    ) -> Self {
        Self {
            store: Mutex::new(InMemoryStrategyDraftStore::new()),
            snapshots,
            artifacts,
            rules,
        }
    }

    pub fn create(
        &self,
        auth: &AuthContext,
        name: &str,
        now: DateTime<Utc>,
    ) -> Result<StrategyDraft, StrategyDraftError> {
        self.store
            .lock()
            .map_err(|_| StrategyDraftError::StoreUnavailable)?
            .create_draft(auth, name, now)
    }

    /// Autosave uses the same required base_version as manual save. Conflict is explicit;
    /// a caller must fetch the head and resolve its edit before retrying.
    pub fn save(
        &self,
        auth: &AuthContext,
        input: DraftVersionInput,
    ) -> Result<StrategyDraftVersion, StrategyDraftError> {
        self.store
            .lock()
            .map_err(|_| StrategyDraftError::StoreUnavailable)?
            .save_version(auth, input, &self.snapshots, &self.artifacts)
    }

    pub fn versions(
        &self,
        auth: &AuthContext,
        id: StrategyDraftId,
    ) -> Result<Vec<StrategyDraftVersion>, StrategyDraftError> {
        ensure_strategy_write(auth)?;
        let store = self
            .store
            .lock()
            .map_err(|_| StrategyDraftError::StoreUnavailable)?;
        ensure_draft_workspace(
            auth,
            store
                .get_draft(auth.tenant_id, id)
                .ok_or(StrategyDraftError::DraftNotFound { draft_id: id })?,
        )?;
        Ok(store
            .list_versions(auth.tenant_id, id)
            .into_iter()
            .cloned()
            .collect())
    }

    pub fn validate(
        &self,
        auth: &AuthContext,
        id: StrategyDraftId,
        now: DateTime<Utc>,
    ) -> Result<ValidationHandoff, StrategyDraftError> {
        self.store
            .lock()
            .map_err(|_| StrategyDraftError::StoreUnavailable)?
            .initiate_validation(auth, id, &self.snapshots, &self.artifacts, &self.rules, now)
    }
    /// Authenticated, process-local S01 -> TP06 -> S02 consumption. Catalogs and native
    /// candidate provenance must be supplied by the trusted host, never request JSON.
    pub fn backtest(
        &self,
        auth: &AuthContext,
        id: StrategyDraftId,
        mut request: crate::backtest::BacktestRequest,
        generated_payload: &serde_json::Value,
    ) -> Result<crate::backtest::BacktestValidationReport, crate::backtest::BacktestError> {
        use crate::backtest::{BacktestDraftBinding, BacktestError, StrategyAdapter, run_backtest};
        use quantos_core::{ContentHash, canonical_json_bytes};
        let invalid = |error: &str| BacktestError::InvalidInput(error.to_owned());
        let store = self
            .store
            .lock()
            .map_err(|_| invalid("draft store unavailable"))?;
        let handoff = store
            .initiate_validation(
                auth,
                id,
                &self.snapshots,
                &self.artifacts,
                &self.rules,
                request.candidate.clock,
            )
            .map_err(|error| invalid(&error.to_string()))?;
        let version = store
            .head_version(auth.tenant_id, id)
            .ok_or_else(|| invalid("draft head unavailable"))?;
        if self.snapshots.get(auth.tenant_id, handoff.data_snapshot_id) != Some(&request.snapshot) {
            return Err(invalid("Snapshot differs from trusted S01 catalog"));
        }
        let payload_hash = ContentHash::sha256_bytes(&canonical_json_bytes(generated_payload)?);
        if !handoff
            .artifact_refs
            .iter()
            .any(|r| r.content_hash == payload_hash)
        {
            return Err(invalid(
                "generated Artifact is not referenced by S01 version",
            ));
        }
        let mut adapter =
            crate::generated::GeneratedStrategyAdapter::from_draft_payload(generated_payload)
                .map_err(|error| invalid(&error.to_string()))?;
        if version.parameters != adapter.configuration() {
            return Err(invalid("S01 parameters differ from effective adapter"));
        }
        request.draft = Some(BacktestDraftBinding {
            tenant_id: auth.tenant_id,
            workspace_id: auth.workspace_id,
            draft_id: id,
            version: handoff.version,
            version_hash: handoff.version_content_hash,
            parameter_hash: ContentHash::sha256_bytes(&canonical_json_bytes(&version.parameters)?),
        });
        // Copy the immutable version binding before releasing the store lock. A later
        // edit creates another version; it cannot rewrite this report's provenance.
        drop(store);
        run_backtest(&request, &mut adapter)
    }
}
