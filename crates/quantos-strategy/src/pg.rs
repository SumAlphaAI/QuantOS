use native_tls::TlsConnector;
use postgres::{Client, NoTls, Row, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_auth::AuthContext;
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
    release::{DeploymentTarget, DeploymentTicket, StrategyRelease, StrategyReleaseError},
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

    /// Requires a verified server-side AuthContext; identity is never taken from draft JSON.
    pub fn create_draft(
        &mut self,
        auth: &AuthContext,
        name: &str,
        now: chrono::DateTime<chrono::Utc>,
    ) -> Result<StrategyDraft, PgStrategyError> {
        let draft = crate::InMemoryStrategyDraftStore::new().create_draft(auth, name, now)?;
        let created_by_user = Some(auth.user_id);
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
        auth: &AuthContext,
        input: DraftVersionInput,
    ) -> Result<StrategyDraftVersion, PgStrategyError> {
        crate::ensure_strategy_write(auth)?;
        let tenant_id = auth.tenant_id;
        let created_by = auth.actor_id;
        let created_by_user = Some(auth.user_id);
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
            "select head_version, workspace_id, updated_at from quantos.strategy_drafts
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
        if head_row.get::<_, Uuid>(1) != *auth.workspace_id.as_uuid() {
            return Err(StrategyDraftError::DraftNotFound {
                draft_id: input.draft_id,
            }
            .into());
        }
        if input.saved_at < head_row.get::<_, chrono::DateTime<chrono::Utc>>(2) {
            return Err(StrategyDraftError::ClockRegression.into());
        }
        let head_version = head_row.get::<_, i64>(0) as u64;
        if head_version != input.base_version {
            return Err(StrategyDraftError::VersionConflict {
                draft_id: input.draft_id,
                base_version: input.base_version,
                head_version,
            }
            .into());
        }
        let next_version = head_version
            .checked_add(1)
            .filter(|v| *v <= i64::MAX as u64)
            .ok_or(StrategyDraftError::VersionExhausted)?;

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
        auth: &AuthContext,
        draft_id: StrategyDraftId,
    ) -> Result<Option<StrategyDraft>, PgStrategyError> {
        crate::ensure_strategy_write(auth)?;
        let tenant_id = auth.tenant_id;
        let row = self.client.query_typed_opt(
            "select draft_id, tenant_id, workspace_id, owner_actor_id, name,
                    head_version, created_at, updated_at
             from quantos.strategy_drafts
             where tenant_id = $1 and draft_id = $2 and workspace_id = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (draft_id.as_uuid(), Type::UUID),
                (auth.workspace_id.as_uuid(), Type::UUID),
            ],
        )?;
        row.map(|row| row_to_draft(&row))
            .transpose()
            .map_err(PgStrategyError::from)
    }

    pub fn list_versions(
        &mut self,
        auth: &AuthContext,
        draft_id: StrategyDraftId,
    ) -> Result<Vec<StrategyDraftVersion>, PgStrategyError> {
        if self.get_draft(auth, draft_id)?.is_none() {
            return Err(StrategyDraftError::DraftNotFound { draft_id }.into());
        }
        let tenant_id = auth.tenant_id;
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
    /// Hydrate a pinned head, then reauthorize persisted snapshot provenance/rules and Artifacts.
    pub fn initiate_validation(
        &mut self,
        auth: &AuthContext,
        draft_id: StrategyDraftId,
        storage: &mut quantos_storage::pg::PgStorageStore,
        policy: &quantos_storage::provenance::SnapshotSourcePolicy,
        now: chrono::DateTime<chrono::Utc>,
    ) -> Result<crate::ValidationHandoff, PgStrategyError> {
        let draft = self
            .get_draft(auth, draft_id)?
            .ok_or(StrategyDraftError::DraftNotFound { draft_id })?;
        let versions = self.list_versions(auth, draft_id)?;
        let mut memory = crate::InMemoryStrategyDraftStore::new();
        memory.drafts.insert((auth.tenant_id, draft_id), draft);
        for version in versions {
            memory
                .versions
                .insert((auth.tenant_id, draft_id, version.version), version);
        }
        Ok(memory.initiate_validation_persisted(auth, draft_id, storage, policy, now)?)
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

    /// Verified evidence is opaque and minted by DraftService, never request JSON.
    pub fn publish(
        &mut self,
        auth: &AuthContext,
        proof: crate::release::ValidatedBacktest,
        targets: Vec<DeploymentTarget>,
        at: chrono::DateTime<chrono::Utc>,
    ) -> Result<StrategyRelease, PgStrategyError> {
        let at = pg_timestamp(at);
        let release = crate::release::InMemoryStrategyReleaseStore::new()
            .publish_verified(auth, proof, targets, at)?;
        let targets: Vec<_> = release.allowed_targets.iter().map(|t| t.as_str()).collect();
        self.client.execute("insert into quantos.strategy_releases (
            release_id,tenant_id,workspace_id,draft_id,draft_version,name,source_digest,image_digest,
            parameter_hash,backtest_report_hash,data_snapshot_id,evidence_refs,allowed_targets,
            content_hash,created_by_actor,created_by_user,created_at,validation_evidence)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            on conflict (tenant_id,draft_id,draft_version) do nothing", &[
            &release.release_id.as_uuid(),&auth.tenant_id.as_uuid(),&auth.workspace_id.as_uuid(),
            &release.draft_id.as_uuid(),&(release.draft_version as i64),&release.name,&release.source_digest,
            &release.image_digest,&release.parameter_hash.as_str(),&release.backtest_report_hash.as_ref().map(|h|h.as_str()),
            &release.data_snapshot_id.as_uuid(),&postgres::types::Json(&release.evidence_refs),&targets,
            &release.content_hash.as_str(),&auth.actor_id.as_uuid(),&Some(auth.user_id),&at,
            &postgres::types::Json(&release.validation),
        ])?;
        let existing = self
            .release_for_draft(auth.tenant_id, release.draft_id, release.draft_version)?
            .ok_or(StrategyReleaseError::ReleaseNotFound {
                release_id: release.release_id,
            })?;
        existing.ensure_scope(auth)?;
        if existing.content_hash != release.content_hash {
            return Err(StrategyReleaseError::ContentConflict {
                draft_id: release.draft_id,
                draft_version: release.draft_version,
            }
            .into());
        }
        Ok(existing)
    }
    pub fn approve(
        &mut self,
        auth: &AuthContext,
        release_id: quantos_core::ProposalId,
        expected: &ContentHash,
        at: chrono::DateTime<chrono::Utc>,
        expires: chrono::DateTime<chrono::Utc>,
    ) -> Result<StrategyRelease, PgStrategyError> {
        let at = pg_timestamp(at);
        let expires = pg_timestamp(expires);
        let mut release = self
            .get_release(auth.tenant_id, release_id)?
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        release.approve_bound(auth, expected, at, expires)?;
        let changed=self.client.execute("update quantos.strategy_releases set approved_at=$3,approved_by_actor=$4,approval_evidence=$5
            where tenant_id=$1 and release_id=$2 and approved_at is null and content_hash=$6",
            &[&auth.tenant_id.as_uuid(),&release_id.as_uuid(),&at,&auth.actor_id.as_uuid(),
                &postgres::types::Json(&release.approval),&expected.as_str()])?;
        if changed != 1 {
            return Err(StrategyReleaseError::AlreadyApproved { release_id }.into());
        }
        Ok(release)
    }
    pub fn request_deployment(
        &mut self,
        auth: &AuthContext,
        release_id: quantos_core::ProposalId,
        target: DeploymentTarget,
        at: chrono::DateTime<chrono::Utc>,
    ) -> Result<DeploymentTicket, PgStrategyError> {
        let at = pg_timestamp(at);
        let release = self
            .get_release(auth.tenant_id, release_id)?
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        release.authorize_deployment(auth, target, at)?;
        let row=self.client.query_opt("insert into quantos.strategy_release_deployments (
            deployment_id,tenant_id,release_id,target,requested_by_actor,requested_by_user,requested_at)
            values ($1,$2,$3,$4,$5,$6,$7)
            on conflict (tenant_id,release_id,target) do update set release_id=excluded.release_id
            where strategy_release_deployments.requested_at <= excluded.requested_at
            returning requested_by_actor,requested_at",
            &[&Uuid::now_v7(),&auth.tenant_id.as_uuid(),&release_id.as_uuid(),&target.as_str(),&auth.actor_id.as_uuid(),&Some(auth.user_id),&at])?.ok_or(StrategyReleaseError::InvalidEvidence)?;
        Ok(DeploymentTicket {
            release_id,
            target,
            requested_by: ActorId::from_uuid(row.get(0)),
            requested_at: row.get(1),
        })
    }
    fn get_release(
        &mut self,
        tenant_id: TenantId,
        release_id: quantos_core::ProposalId,
    ) -> Result<Option<StrategyRelease>, PgStrategyError> {
        let row = self.client.query_typed_opt(
            "select release_id, tenant_id, draft_id, draft_version, name,
                    source_digest, image_digest, parameter_hash, backtest_report_hash,
                    data_snapshot_id, evidence_refs, allowed_targets,
                    approved_at, approved_by_actor, content_hash, created_by_actor, created_at,
                    workspace_id, validation_evidence, approval_evidence
             from quantos.strategy_releases
             where tenant_id = $1 and release_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (release_id.as_uuid(), Type::UUID),
            ],
        )?;
        row.map(|row| row_to_release(&row)).transpose()
    }

    fn release_for_draft(
        &mut self,
        tenant_id: TenantId,
        draft_id: StrategyDraftId,
        draft_version: u64,
    ) -> Result<Option<StrategyRelease>, PgStrategyError> {
        let row = self.client.query_typed_opt(
            "select release_id, tenant_id, draft_id, draft_version, name,
                    source_digest, image_digest, parameter_hash, backtest_report_hash,
                    data_snapshot_id, evidence_refs, allowed_targets,
                    approved_at, approved_by_actor, content_hash, created_by_actor, created_at,
                    workspace_id, validation_evidence, approval_evidence
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

// Match PostgreSQL timestamptz precision before sealing approval attestations.
fn pg_timestamp(at: chrono::DateTime<chrono::Utc>) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp_micros(at.timestamp_micros())
        .expect("representable database timestamp")
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
        workspace_id: WorkspaceId::from_uuid(row.try_get(17)?),
        validation: row
            .get::<_, Option<postgres::types::Json<Value>>>(18)
            .map(|v| crate::release::ValidatedBacktest::from_storage(v.0))
            .transpose()?,
        approval: row
            .get::<_, Option<postgres::types::Json<Value>>>(19)
            .map(|v| serde_json::from_value(v.0))
            .transpose()?,
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

#[cfg(test)]
mod release_row_tests {
    use super::*;
    /// This exercises the real postgres Row decoder, using a read-only SELECT.
    /// No table mutation or local database is required; target execution is separate.
    #[test]
    #[ignore = "requires separately authorized Supabase connection; never local database acceptance"]
    fn s03_legacy_null_workspace_returns_error_instead_of_panicking() {
        assert_eq!(
            std::env::var("QUANTOS_RUN_S03_POSTGRES_TESTS").as_deref(),
            Ok("1")
        );
        let url = std::env::var("DATABASE_URL").expect("authorized target configuration");
        assert!(
            Url::parse(&url)
                .unwrap()
                .host_str()
                .is_some_and(|h| h.ends_with(".supabase.com"))
        );
        let mut client = connect_client(&url).unwrap();
        let id = Uuid::now_v7();
        let hash = ContentHash::sha256_bytes(b"owned legacy fixture");
        let row = client
            .query_one(
                "select $1::uuid,$1::uuid,$1::uuid,1::bigint,'legacy'::text,
            'legacy-source'::text,$2::text,$2::text,null::text,$1::uuid,'[]'::jsonb,
            array['paper']::text[],null::timestamptz,null::uuid,$2::text,$1::uuid,
            '2026-01-01T00:00:00Z'::timestamptz,null::uuid,null::jsonb,null::jsonb",
                &[&id, &hash.as_str()],
            )
            .unwrap();
        assert!(row_to_release(&row).is_err());
    }
}
