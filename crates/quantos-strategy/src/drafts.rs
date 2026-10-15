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
}
