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
    release::{
        DeploymentPolicy, DeploymentTarget, DeploymentTicket, StrategyRelease, StrategyReleaseError,
    },
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
    #[error(transparent)]
    Release(#[from] StrategyReleaseError),
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

pub struct PgReleaseStore {
    client: Client,
}

impl PgReleaseStore {
    pub fn connect(database_url: &str) -> Result<Self, PgStrategyError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
    }

    pub fn publish(
        &mut self,
        release: &StrategyRelease,
        created_by_user: Option<Uuid>,
    ) -> Result<StrategyRelease, PgStrategyError> {
        let allowed_targets: Vec<&str> = release
            .allowed_targets
            .iter()
            .map(|target| target.as_str())
            .collect();
        let inserted = self.client.query_typed_opt(
            "insert into quantos.strategy_releases (
                release_id, tenant_id, draft_id, draft_version, name,
                source_digest, image_digest, parameter_hash, backtest_report_hash,
                data_snapshot_id, evidence_refs, allowed_targets,
                content_hash, created_by_actor, created_by_user, created_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            on conflict (tenant_id, draft_id, draft_version) do nothing
            returning release_id",
            &[
                (release.release_id.as_uuid(), Type::UUID),
                (release.tenant_id.as_uuid(), Type::UUID),
                (release.draft_id.as_uuid(), Type::UUID),
                (&(release.draft_version as i64), Type::INT8),
                (&release.name, Type::TEXT),
                (&release.source_digest, Type::TEXT),
                (&release.image_digest, Type::TEXT),
                (&release.parameter_hash.as_str(), Type::TEXT),
                (
                    &release
                        .backtest_report_hash
                        .as_ref()
                        .map(|hash| hash.as_str().to_owned()),
                    Type::TEXT,
                ),
                (release.data_snapshot_id.as_uuid(), Type::UUID),
                (
                    &postgres::types::Json(&serde_json::to_value(&release.evidence_refs)?),
                    Type::JSONB,
                ),
                (&allowed_targets, Type::TEXT_ARRAY),
                (&release.content_hash.as_str(), Type::TEXT),
                (release.created_by.as_uuid(), Type::UUID),
                (&created_by_user, Type::UUID),
                (&release.created_at, Type::TIMESTAMPTZ),
            ],
        )?;
        if inserted.is_some() {
            return self
                .get_release(release.tenant_id, release.release_id)?
                .ok_or(StrategyReleaseError::ReleaseNotFound {
                    release_id: release.release_id,
                })
                .map_err(PgStrategyError::from);
        }

        let existing = self
            .release_for_draft(release.tenant_id, release.draft_id, release.draft_version)?
            .ok_or(StrategyReleaseError::ReleaseNotFound {
                release_id: release.release_id,
            })?;
        if existing.content_hash == release.content_hash {
            return Ok(existing);
        }
        Err(StrategyReleaseError::ContentConflict {
            draft_id: release.draft_id,
            draft_version: release.draft_version,
        }
        .into())
    }

    pub fn approve(
        &mut self,
        tenant_id: TenantId,
        release_id: quantos_core::ProposalId,
        approved_by: ActorId,
        approved_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<StrategyRelease, PgStrategyError> {
        let updated = self.client.execute(
            "update quantos.strategy_releases
             set approved_at = $3, approved_by_actor = $4
             where tenant_id = $1 and release_id = $2 and approved_at is null",
            &[
                &tenant_id.as_uuid(),
                &release_id.as_uuid(),
                &approved_at,
                &approved_by.as_uuid(),
            ],
        )?;
        if updated == 0 {
            return Err(StrategyReleaseError::AlreadyApproved { release_id }.into());
        }
        self.get_release(tenant_id, release_id)?
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })
            .map_err(PgStrategyError::from)
    }

    pub fn request_deployment(
        &mut self,
        tenant_id: TenantId,
        release_id: quantos_core::ProposalId,
        target: DeploymentTarget,
        requested_by: ActorId,
        requested_by_user: Option<Uuid>,
        requested_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<DeploymentTicket, PgStrategyError> {
        let release = self
            .get_release(tenant_id, release_id)?
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        let violations = DeploymentPolicy::evaluate(&release, target);
        if !violations.is_empty() {
            return Err(StrategyReleaseError::DeploymentRejected {
                violations: violations
                    .iter()
                    .map(|violation| violation.as_str())
                    .collect::<Vec<_>>()
                    .join(","),
            }
            .into());
        }
        self.client.execute(
            "insert into quantos.strategy_release_deployments (
                deployment_id, tenant_id, release_id, target,
                requested_by_actor, requested_by_user, requested_at
            ) values ($1,$2,$3,$4,$5,$6,$7)",
            &[
                &Uuid::now_v7(),
                &tenant_id.as_uuid(),
                &release_id.as_uuid(),
                &target.as_str(),
                &requested_by.as_uuid(),
                &requested_by_user,
                &requested_at,
            ],
        )?;
        Ok(DeploymentTicket {
            release_id,
            target,
            requested_by,
            requested_at,
        })
    }

    pub fn get_release(
        &mut self,
        tenant_id: TenantId,
        release_id: quantos_core::ProposalId,
    ) -> Result<Option<StrategyRelease>, PgStrategyError> {
        let row = self.client.query_typed_opt(
            "select release_id, tenant_id, draft_id, draft_version, name,
                    source_digest, image_digest, parameter_hash, backtest_report_hash,
                    data_snapshot_id, evidence_refs, allowed_targets,
                    approved_at, approved_by_actor, content_hash, created_by, created_at
             from quantos.strategy_releases
             where tenant_id = $1 and release_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (release_id.as_uuid(), Type::UUID),
            ],
        )?;
        row.map(|row| row_to_release(&row)).transpose()
    }

    pub fn release_for_draft(
        &mut self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
        draft_version: u64,
    ) -> Result<Option<StrategyRelease>, PgStrategyError> {
        let row = self.client.query_typed_opt(
            "select release_id, tenant_id, draft_id, draft_version, name,
                    source_digest, image_digest, parameter_hash, backtest_report_hash,
                    data_snapshot_id, evidence_refs, allowed_targets,
                    approved_at, approved_by_actor, content_hash, created_by, created_at
             from quantos.strategy_releases
             where tenant_id = $1 and draft_id = $2 and draft_version = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (draft_id.as_uuid(), Type::UUID),
                (&(draft_version as i64), Type::INT8),
            ],
        )?;
        row.map(|row| row_to_release(&row)).transpose()
    }
}

fn row_to_release(row: &Row) -> Result<StrategyRelease, PgStrategyError> {
    let backtest_report_hash: Option<String> = row.get(8);
    let evidence_refs: Vec<DraftArtifactRef> =
        serde_json::from_value(row.get::<_, postgres::types::Json<Value>>(10).0)?;
    let allowed_targets: Vec<String> = row.get(11);
    let approved_by: Option<Uuid> = row.get(13);
    Ok(StrategyRelease {
        release_id: quantos_core::ProposalId::from_uuid(row.get(0)),
        tenant_id: TenantId::from_uuid(row.get(1)),
        draft_id: StrategyDraftId::from_uuid(row.get(2)),
        draft_version: row.get::<_, i64>(3) as u64,
        name: row.get(4),
        source_digest: row.get(5),
        image_digest: row.get(6),
        parameter_hash: ContentHash::parse(row.get::<_, &str>(7))?,
        backtest_report_hash: backtest_report_hash
            .map(|hash| ContentHash::parse(hash.as_str()))
            .transpose()?,
        data_snapshot_id: SnapshotId::from_uuid(row.get(9)),
        evidence_refs,
        allowed_targets: allowed_targets
            .iter()
            .map(|target| DeploymentTarget::parse(target))
            .collect::<Result<Vec<_>, _>>()?,
        approved_at: row.get(12),
        approved_by: approved_by.map(ActorId::from_uuid),
        content_hash: ContentHash::parse(row.get::<_, &str>(14))?,
        created_by: ActorId::from_uuid(row.get(15)),
        created_at: row.get(16),
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
