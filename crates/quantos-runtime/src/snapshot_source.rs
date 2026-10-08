use chrono::{DateTime, Utc};
use quantos_core::{ActorId, SnapshotId, TenantId};
use quantos_storage::{
    DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotQualityRuleset, SnapshotUsage,
    pg::{PgStorageError, PgStorageStore},
    provenance::SnapshotSourcePolicy,
};

pub(crate) enum SnapshotConsumerSource<'a> {
    InMemory(&'a InMemoryDataSnapshotCatalog, &'a SnapshotQualityRuleset),
    Postgres(&'a mut PgStorageStore, &'a SnapshotSourcePolicy),
}

impl SnapshotConsumerSource<'_> {
    pub(crate) fn load(
        &mut self,
        tenant: TenantId,
        actor: ActorId,
        id: SnapshotId,
        usage: SnapshotUsage,
        observed: DateTime<Utc>,
    ) -> Result<Option<(DataSnapshotRecord, SnapshotQualityRuleset)>, PgStorageError> {
        match self {
            Self::InMemory(catalog, rules) => Ok(catalog
                .get(tenant, id)
                .cloned()
                .map(|record| (record, (*rules).clone()))),
            Self::Postgres(store, policy) => {
                if let Ok(handle) = tokio::runtime::Handle::try_current() {
                    if handle.runtime_flavor() != tokio::runtime::RuntimeFlavor::MultiThread {
                        return Err(quantos_storage::provenance::SourceAuthorizationError(
                            "persistent consumer requires a multi-thread executor",
                        )
                        .into());
                    }
                    tokio::task::block_in_place(|| {
                        store.authorize_snapshot_reader(tenant, actor)?;
                        store.load_authorized_snapshot(tenant, id, usage, observed, policy)
                    })
                    .map(Some)
                } else {
                    store.authorize_snapshot_reader(tenant, actor)?;
                    store
                        .load_authorized_snapshot(tenant, id, usage, observed, policy)
                        .map(Some)
                }
            }
        }
    }
}
