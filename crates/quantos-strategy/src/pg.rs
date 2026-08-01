use native_tls::TlsConnector;
use postgres::{Client, NoTls, Row, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{
    ActorId, ContentHash, CoreError, DraftVersionId, SnapshotId, StrategyDraftId, TenantId,
    WorkspaceId,
};
use serde_json::Value;
use thiserror::Error;
use url::Url;
use uuid::Uuid;

use crate::{
    DraftArtifactRef, DraftSaveKind, DraftVersionInput, StrategyDraft, StrategyDraftError,
    StrategyDraftVersion,
};

#[derive(Debug, Error)]
pub enum PgStrategyError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Strategy(#[from] StrategyDraftError),
}

pub struct PgStrategyStore {
    client: Client,
}

impl PgStrategyStore {
    pub fn connect(database_url: &str) -> Result<Self, PgStrategyError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
    }

    pub fn create_draft(
        &mut self,
        draft: &StrategyDraft,
        created_by_user: Option<Uuid>,
    ) -> Result<StrategyDraft, PgStrategyError> {
        let row = self.client.query_typed_one(
            "insert into quantos.strategy_drafts (
                draft_id, tenant_id, workspace_id, owner_actor_id, name,
                head_version, created_by_actor, created_by_user, created_at, updated_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            returning draft_id, tenant_id, workspace_id, owner_actor_id, name,
                      head_version, created_at, updated_at",
            &[
                (draft.draft_id.as_uuid(), Type::UUID),
                (draft.tenant_id.as_uuid(), Type::UUID),
                (draft.workspace_id.as_uuid(), Type::UUID),
                (draft.owner_actor_id.as_uuid(), Type::UUID),
                (&draft.name, Type::TEXT),
                (&(draft.head_version as i64), Type::INT8),
                (draft.owner_actor_id.as_uuid(), Type::UUID),
                (&created_by_user, Type::UUID),
                (&draft.created_at, Type::TIMESTAMPTZ),
                (&draft.updated_at, Type::TIMESTAMPTZ),
            ],
        )?;
        row_to_draft(&row).map_err(PgStrategyError::from)
    }

    pub fn save_version(
        &mut self,
        tenant_id: TenantId,
        created_by: ActorId,
        created_by_user: Option<Uuid>,
        input: DraftVersionInput,
    ) -> Result<StrategyDraftVersion, PgStrategyError> {
        if !input.parameters.is_object() {
            return Err(StrategyDraftError::ParametersInvalid.into());
        }
        let content_hash =
            ContentHash::sha256_bytes(&quantos_core::canonical_json_bytes(&serde_json::json!({
                "parameters": input.parameters,
                "data_snapshot_id": input.data_snapshot_id.map(|id| id.to_string()),
                "artifact_refs": input.artifact_refs,
                "save_kind": input.save_kind.as_str(),
            }))?);
        let version_id = DraftVersionId::new();
        let artifact_refs = serde_json::to_value(&input.artifact_refs)?;

        let mut transaction = self.client.transaction()?;
        let head_row = transaction.query_typed_opt(
            "select head_version from quantos.strategy_drafts
             where tenant_id = $1 and draft_id = $2
             for update",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (input.draft_id.as_uuid(), Type::UUID),
            ],
        )?;
        let Some(head_row) = head_row else {
            return Err(StrategyDraftError::DraftNotFound {
                draft_id: input.draft_id,
            }
            .into());
        };
        let head_version = head_row.get::<_, i64>(0) as u64;
        if head_version != input.base_version {
            return Err(StrategyDraftError::VersionConflict {
                draft_id: input.draft_id,
                base_version: input.base_version,
                head_version,
            }
            .into());
        }
        let next_version = head_version + 1;

        let row = transaction.query_typed_one(
            "insert into quantos.strategy_draft_versions (
                version_id, tenant_id, draft_id, version, parameters,
                data_snapshot_id, artifact_refs, content_hash, save_kind,
                created_by_actor, created_by_user, created_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            returning version_id, tenant_id, draft_id, version, parameters,
                      data_snapshot_id, artifact_refs, content_hash, save_kind,
                      created_by_actor, created_at",
            &[
                (version_id.as_uuid(), Type::UUID),
                (tenant_id.as_uuid(), Type::UUID),
                (input.draft_id.as_uuid(), Type::UUID),
                (&(next_version as i64), Type::INT8),
                (&postgres::types::Json(&input.parameters), Type::JSONB),
                (&input.data_snapshot_id.map(|id| *id.as_uuid()), Type::UUID),
                (&postgres::types::Json(&artifact_refs), Type::JSONB),
                (&content_hash.as_str(), Type::TEXT),
                (&input.save_kind.as_str(), Type::TEXT),
                (created_by.as_uuid(), Type::UUID),
                (&created_by_user, Type::UUID),
                (&input.saved_at, Type::TIMESTAMPTZ),
            ],
        )?;
        transaction.execute(
            "update quantos.strategy_drafts
             set head_version = $3, updated_at = $4
             where tenant_id = $1 and draft_id = $2",
            &[
                &tenant_id.as_uuid(),
                &input.draft_id.as_uuid(),
                &(next_version as i64),
                &input.saved_at,
            ],
        )?;
        transaction.commit()?;

        row_to_version(&row).map_err(PgStrategyError::from)
    }

    pub fn get_draft(
        &mut self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
    ) -> Result<Option<StrategyDraft>, PgStrategyError> {
        let row = self.client.query_typed_opt(
            "select draft_id, tenant_id, workspace_id, owner_actor_id, name,
                    head_version, created_at, updated_at
             from quantos.strategy_drafts
             where tenant_id = $1 and draft_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (draft_id.as_uuid(), Type::UUID),
            ],
        )?;
        row.map(|row| row_to_draft(&row))
            .transpose()
            .map_err(PgStrategyError::from)
    }

    pub fn list_versions(
        &mut self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
    ) -> Result<Vec<StrategyDraftVersion>, PgStrategyError> {
        let rows = self.client.query_typed(
            "select version_id, tenant_id, draft_id, version, parameters,
                    data_snapshot_id, artifact_refs, content_hash, save_kind,
                    created_by_actor, created_at
             from quantos.strategy_draft_versions
             where tenant_id = $1 and draft_id = $2
             order by version asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (draft_id.as_uuid(), Type::UUID),
            ],
        )?;
        rows.iter()
            .map(row_to_version)
            .collect::<Result<Vec<_>, _>>()
            .map_err(PgStrategyError::from)
    }
}

fn row_to_draft(row: &Row) -> Result<StrategyDraft, StrategyDraftError> {
    Ok(StrategyDraft {
        draft_id: StrategyDraftId::from_uuid(row.get(0)),
        tenant_id: TenantId::from_uuid(row.get(1)),
        workspace_id: WorkspaceId::from_uuid(row.get(2)),
        owner_actor_id: ActorId::from_uuid(row.get(3)),
        name: row.get(4),
        head_version: row.get::<_, i64>(5) as u64,
        created_at: row.get(6),
        updated_at: row.get(7),
    })
}

fn row_to_version(row: &Row) -> Result<StrategyDraftVersion, StrategyDraftError> {
    let data_snapshot_id: Option<Uuid> = row.get(5);
    let artifact_refs_json: Value = row.get::<_, postgres::types::Json<Value>>(6).0;
    let artifact_refs: Vec<DraftArtifactRef> = serde_json::from_value(artifact_refs_json)?;
    let save_kind = match row.get::<_, &str>(8) {
        "manual" => DraftSaveKind::Manual,
        "autosave" => DraftSaveKind::Autosave,
        other => {
            return Err(StrategyDraftError::Core(CoreError::invalid_id(
                "DraftSaveKind",
                other,
            )));
        }
    };
    Ok(StrategyDraftVersion {
        version_id: DraftVersionId::from_uuid(row.get(0)),
        tenant_id: TenantId::from_uuid(row.get(1)),
        draft_id: StrategyDraftId::from_uuid(row.get(2)),
        version: row.get::<_, i64>(3) as u64,
        parameters: row.get::<_, postgres::types::Json<Value>>(4).0,
        data_snapshot_id: data_snapshot_id.map(SnapshotId::from_uuid),
        artifact_refs,
        content_hash: ContentHash::parse(row.get::<_, &str>(7))?,
        save_kind,
        created_by: ActorId::from_uuid(row.get(9)),
        created_at: row.get(10),
    })
}

fn connect_client(database_url: &str) -> Result<Client, PgStrategyError> {
    let url = Url::parse(database_url)?;
    let use_tls = matches!(
        url.query_pairs().find(|(key, _)| key == "sslmode"),
        Some((_, value)) if value != "disable"
    ) || !url
        .host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1");
    if use_tls {
        let connector = TlsConnector::new()?;
        let connector = MakeTlsConnector::new(connector);
        Ok(Client::connect(database_url, connector)?)
    } else {
        Ok(Client::connect(database_url, NoTls)?)
    }
}
