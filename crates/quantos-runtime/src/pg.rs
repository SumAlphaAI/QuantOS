use chrono::{DateTime, Duration as ChronoDuration, Utc};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{
    Client, NoTls, Row, Transaction,
    types::{Json, Type},
};
use postgres_openssl::MakeTlsConnector;
use thiserror::Error;
use url::Url;
use uuid::Uuid;

use crate::{
    LeasedWorkflowRun, NewWorkflowRun, RuntimeSession, ToolRegistration, WorkflowArtifactBinding,
    WorkflowCheckpoint, WorkflowRun, WorkflowRunStatus,
};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ArtifactId, AuditEntryId, ContentHash, CoreError, CorrelationId, RuntimeSessionId,
    TaskAttemptId, TenantId, WorkflowRunId,
};
use quantos_policy::{Capability, RunMode};
use quantos_storage::ArtifactManifest;

#[derive(Debug, Error)]
pub enum PgRuntimeError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] openssl::error::ErrorStack),
    #[error("remote runtime database requires sslmode=verify-full")]
    InsecureDatabaseTransport,
    #[error("runtime database login must have only quantos_runtime role membership")]
    RuntimeRoleRequired,
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Policy(#[from] quantos_policy::PolicyError),
    #[error(transparent)]
    Runtime(#[from] crate::RuntimeError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub struct PgRuntimeStore {
    client: Client,
}

impl PgRuntimeStore {
    pub fn connect(database_url: &str) -> Result<Self, PgRuntimeError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
    }

    pub fn connect_as_runtime(database_url: &str) -> Result<Self, PgRuntimeError> {
        let url = Url::parse(database_url)?;
        if !url
            .query_pairs()
            .any(|(key, value)| key == "sslmode" && value == "verify-full")
        {
            return Err(PgRuntimeError::InsecureDatabaseTransport);
        }
        let mut store = Self::connect(database_url)?;
        let role = store.client.query_one(
            "select pg_has_role(session_user, 'quantos_runtime', 'SET') as runtime,
                    pg_has_role(session_user, 'quantos_bff', 'SET') as bff,
                    pg_has_role(session_user, 'quantos_execution_gateway', 'SET') as execution",
            &[],
        )?;
        require_narrow_runtime_role(role.get("runtime"), role.get("bff"), role.get("execution"))?;
        store.client.batch_execute("set role quantos_runtime")?;
        Ok(store)
    }

    pub fn load_session(
        &mut self,
        id: RuntimeSessionId,
    ) -> Result<Option<RuntimeSession>, PgRuntimeError> {
        self.client.query_typed_opt(
            "select id, tenant_id, actor_id, workspace_id, account_id, mode, created_at, expires_at
             from quantos.runtime_sessions where id = $1 and revoked_at is null",
            &[(id.as_uuid(), Type::UUID)],
        )?.map(|row| row_to_runtime_session(&row)).transpose()
    }

    pub fn pending_tenants(&mut self) -> Result<Vec<TenantId>, PgRuntimeError> {
        let rows = self.client.query(
            "select distinct tenant_id from quantos.workflow_runs
             where status in ('queued', 'running', 'cancel_requested')",
            &[],
        )?;
        Ok(rows
            .into_iter()
            .map(|row| TenantId::from_uuid(row.get(0)))
            .collect())
    }

    pub fn finalize_pending_cancellations(
        &mut self,
        tenant_id: TenantId,
        at: DateTime<Utc>,
    ) -> Result<usize, PgRuntimeError> {
        let rows = self.client.query_typed(
            "select id from quantos.workflow_runs
             where tenant_id = $1 and status = 'cancel_requested'
               and (lease_expires_at is null or lease_expires_at <= $2)",
            &[(tenant_id.as_uuid(), Type::UUID), (&at, Type::TIMESTAMPTZ)],
        )?;
        for row in &rows {
            self.finalize_cancelled(WorkflowRunId::from_uuid(row.get("id")), at)?;
        }
        Ok(rows.len())
    }

    pub fn create_session(
        &mut self,
        auth: &AuthContext,
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<RuntimeSession, PgRuntimeError> {
        if expires_at <= created_at {
            return Err(crate::RuntimeError::rejected("session expiry is invalid").into());
        }
        let row = self.client.query_typed_opt(
            "insert into quantos.runtime_sessions (
                tenant_id, actor_id, workspace_id, account_id, mode, created_at, expires_at
            ) select $1,$2,$3,$4,$5,$6,$7
              from quantos.actors as actor
              join quantos.workspace_memberships as member
                on member.tenant_id = actor.tenant_id and member.actor_id = actor.id
               and member.workspace_id = $3
              where actor.id = $2 and actor.tenant_id = $1
                and actor.user_id = $8 and actor.is_active = true
                and ($4::uuid is null or exists (
                  select 1 from quantos.accounts as account
                  where account.id = $4 and account.tenant_id = $1
                    and account.workspace_id = $3 and account.mode = $5
                    and account.is_active = true
                ))
            returning id, tenant_id, actor_id, workspace_id, account_id, mode, created_at, expires_at",
            &[
                (auth.tenant_id.as_uuid(), Type::UUID),
                (auth.actor_id.as_uuid(), Type::UUID),
                (auth.workspace_id.as_uuid(), Type::UUID),
                (&auth.account_id.map(|value| *value.as_uuid()), Type::UUID),
                (&auth.mode.as_str(), Type::TEXT),
                (&created_at, Type::TIMESTAMPTZ),
                (&expires_at, Type::TIMESTAMPTZ),
                (&auth.user_id, Type::UUID),
            ],
        )?;
        row.map(|row| row_to_runtime_session(&row))
            .transpose()?
            .ok_or_else(|| {
                crate::RuntimeError::rejected("runtime session context is invalid").into()
            })
    }

    pub fn register_tool(
        &mut self,
        tenant_id: TenantId,
        tool: &ToolRegistration,
        updated_at: DateTime<Utc>,
    ) -> Result<ToolRegistration, PgRuntimeError> {
        let row = self.client.query_typed_one(
            "insert into quantos.tool_registry (
                tenant_id, tool_name, capability, description, max_cost_units, rate_limit_per_minute, enabled, created_at, updated_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
            on conflict (tenant_id, tool_name)
            do update set
                capability = excluded.capability,
                description = excluded.description,
                max_cost_units = excluded.max_cost_units,
                rate_limit_per_minute = excluded.rate_limit_per_minute,
                enabled = excluded.enabled,
                updated_at = excluded.updated_at
            returning tool_name, capability, description, max_cost_units, rate_limit_per_minute, enabled",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&tool.tool_name, Type::TEXT),
                (&tool.capability.as_str(), Type::TEXT),
                (&tool.description, Type::TEXT),
                (&(tool.max_cost_units as i64), Type::INT8),
                (&(tool.rate_limit_per_minute as i32), Type::INT4),
                (&tool.enabled, Type::BOOL),
                (&updated_at, Type::TIMESTAMPTZ),
            ],
        )?;
        row_to_tool_registration(&row)
    }

    pub fn schedule_run(
        &mut self,
        input: &NewWorkflowRun,
        queued_at: DateTime<Utc>,
    ) -> Result<WorkflowRun, PgRuntimeError> {
        if input.deadline_at <= queued_at || input.rate_limit_per_minute == 0 {
            return Err(crate::RuntimeError::rejected("deadline or rate limit is invalid").into());
        }
        let fingerprint = ContentHash::sha256_bytes(&serde_json::to_vec(input)?);
        let row = self.client.query_typed_opt(
            "with session_row as (
                select session.id,
                       session.tenant_id,
                       session.actor_id,
                       session.workspace_id,
                       session.account_id,
                       session.mode,
                       session.expires_at
                from quantos.runtime_sessions as session
                where session.id = $1
                  and session.expires_at > $12
                  and session.revoked_at is null
            ),
            tool_row as (
                select tool.tool_name,
                       tool.capability,
                       tool.max_cost_units,
                       tool.rate_limit_per_minute
                from quantos.tool_registry as tool
                join session_row as session on session.tenant_id = tool.tenant_id
                where tool.tool_name = $2 and tool.enabled = true
                  and tool.capability = $3
                  and (session.account_id is null or exists (
                    select 1 from quantos.accounts as account
                    where account.id = session.account_id
                      and account.tenant_id = session.tenant_id
                      and account.workspace_id = session.workspace_id
                      and account.mode = session.mode and account.is_active = true
                  ))
                  and exists (
                    select 1 from quantos.actors as actor
                    join quantos.workspace_memberships as member
                      on member.tenant_id = actor.tenant_id
                     and member.actor_id = actor.id
                     and member.workspace_id = session.workspace_id
                    join quantos.actor_capabilities as grant_row
                      on grant_row.tenant_id = actor.tenant_id
                     and grant_row.actor_id = actor.id
                     and grant_row.capability = $3
                     and (grant_row.workspace_id is null or grant_row.workspace_id = session.workspace_id)
                     and (grant_row.account_id is null or grant_row.account_id = session.account_id)
                     and (grant_row.mode_scope is null or grant_row.mode_scope = session.mode)
                    where actor.id = session.actor_id
                      and actor.tenant_id = session.tenant_id
                      and actor.is_active = true
                  )
            ),
            inserted as (
            insert into quantos.workflow_runs (
                tenant_id, runtime_session_id, actor_id, workspace_id, account_id, tool_name,
                capability, workflow_kind, idempotency_key, correlation_id, input_hash,
                status, attempts, max_attempts, next_attempt_at, deadline_at,
                cost_budget_units, rate_limit_per_minute, created_at, updated_at,
                request_fingerprint
            )
            select session.tenant_id, session.id, session.actor_id, session.workspace_id, session.account_id,
                   tool.tool_name, $3, $4, $5, $6, $7, 'queued', 0, $8, $12, $9,
                   least($10, tool.max_cost_units), least($11, tool.rate_limit_per_minute), $12, $12,
                   $13
            from session_row as session
            join tool_row as tool on true
            on conflict (tenant_id, idempotency_key)
            do update set updated_at = quantos.workflow_runs.updated_at
            returning id, runtime_session_id, tenant_id, actor_id, workspace_id, account_id,
                      tool_name, capability, workflow_kind, idempotency_key, correlation_id,
                      input_hash, status, attempts, max_attempts, next_attempt_at, deadline_at,
                      cost_budget_units, rate_limit_per_minute, lease_owner, lease_expires_at,
                      cancel_requested_at, completed_at, last_error, created_at, updated_at,
                      request_fingerprint, (xmax = '0'::xid) as inserted
            ),
            rate_row as (
                insert into quantos.workflow_tool_rate_windows
                    (tenant_id, tool_name, window_start, accepted_count, effective_limit)
                select inserted.tenant_id, inserted.tool_name,
                       to_timestamp((extract(epoch from $12::timestamptz)::bigint / 60) * 60),
                       1, inserted.rate_limit_per_minute
                from inserted where inserted.inserted
                on conflict (tenant_id, tool_name, window_start)
                do update set accepted_count = quantos.workflow_tool_rate_windows.accepted_count + 1,
                              effective_limit = least(quantos.workflow_tool_rate_windows.effective_limit,
                                                      excluded.effective_limit)
                returning accepted_count
            )
            select inserted.* from inserted left join rate_row on true",
            &[
                (input.runtime_session_id.as_uuid(), Type::UUID),
                (&input.tool_name, Type::TEXT),
                (&input.capability.as_str(), Type::TEXT),
                (&input.workflow_kind, Type::TEXT),
                (&input.idempotency_key, Type::TEXT),
                (input.correlation_id.as_uuid(), Type::UUID),
                (&input.input_hash.as_str(), Type::TEXT),
                (&(input.max_attempts.max(1) as i32), Type::INT4),
                (&input.deadline_at, Type::TIMESTAMPTZ),
                (&(input.cost_budget_units as i64), Type::INT8),
                (&(input.rate_limit_per_minute as i32), Type::INT4),
                (&queued_at, Type::TIMESTAMPTZ),
                (&fingerprint.as_str(), Type::TEXT),
            ],
        ).map_err(|error| {
            if error.as_db_error().and_then(|db| db.constraint())
                == Some("workflow_tool_rate_windows_within_limit")
            {
                PgRuntimeError::Runtime(crate::RuntimeError::rejected("tool rate limit exceeded"))
            } else {
                PgRuntimeError::Postgres(error)
            }
        })?;

        let row = row.ok_or_else(|| crate::RuntimeError::tool_not_registered(&input.tool_name))?;
        let run = row_to_workflow_run(&row)?;
        if row.get::<_, String>("request_fingerprint") != fingerprint.as_str() {
            return Err(
                crate::RuntimeError::duplicate_idempotency_key(&input.idempotency_key).into(),
            );
        }
        Ok(run)
    }

    pub fn claim_runs(
        &mut self,
        tenant_id: TenantId,
        worker_name: &str,
        limit: i64,
        observed_at: DateTime<Utc>,
        lease_duration: ChronoDuration,
    ) -> Result<Vec<LeasedWorkflowRun>, PgRuntimeError> {
        self.mark_timed_out_runs(tenant_id, observed_at)?;
        self.client.execute_typed(
            "update quantos.workflow_runs set status = 'failed', completed_at = $2,
                    lease_owner = null, lease_expires_at = null, attempt_id = null, updated_at = $2
             where tenant_id = $1 and status = 'running' and attempts >= max_attempts
               and lease_expires_at <= $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;
        let lease_expires_at = observed_at + lease_duration;
        let rows = self.client.query_typed(
            "with candidate as (
                select run.id
                from quantos.workflow_runs as run
                where run.tenant_id = $5
                  and run.next_attempt_at <= $3
                  and run.deadline_at > $3
                  and run.cancel_requested_at is null
                  and run.attempts < run.max_attempts
                  and run.status in ('queued', 'running')
                  and (
                    run.lease_expires_at is null
                    or run.lease_expires_at <= $3
                  )
                order by run.next_attempt_at asc, run.created_at asc
                for update skip locked
                limit $4
            )
            update quantos.workflow_runs as run
            set status = 'running',
                attempts = run.attempts + 1,
                lease_owner = $1,
                lease_expires_at = $2,
                attempt_id = gen_random_uuid(),
                updated_at = $3
            from candidate
            where run.id = candidate.id
            returning run.id, run.runtime_session_id, run.tenant_id, run.actor_id, run.workspace_id,
                      run.account_id, run.tool_name, run.capability, run.workflow_kind,
                      run.idempotency_key, run.correlation_id, run.input_hash, run.status,
                      run.attempts, run.max_attempts, run.next_attempt_at, run.deadline_at,
                      run.cost_budget_units, run.rate_limit_per_minute, run.lease_owner,
                      run.lease_expires_at, run.cancel_requested_at, run.completed_at,
                      run.last_error, run.created_at, run.updated_at, run.attempt_id",
            &[
                (&worker_name, Type::TEXT),
                (&lease_expires_at, Type::TIMESTAMPTZ),
                (&observed_at, Type::TIMESTAMPTZ),
                (&limit, Type::INT8),
                (tenant_id.as_uuid(), Type::UUID),
            ],
        )?;

        rows.iter()
            .map(|row| {
                let run = row_to_workflow_run(row)?;
                Ok(LeasedWorkflowRun {
                    task_attempt_id: TaskAttemptId::from_uuid(row.get("attempt_id")),
                    lease_owner: row
                        .get::<_, Option<String>>("lease_owner")
                        .unwrap_or_default(),
                    lease_expires_at: row
                        .get::<_, Option<DateTime<Utc>>>("lease_expires_at")
                        .expect("lease should be set"),
                    run,
                })
            })
            .collect()
    }

    pub fn save_checkpoint(
        &mut self,
        lease: &LeasedWorkflowRun,
        checkpoint_key: &str,
        step_index: u32,
        payload: &serde_json::Value,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowCheckpoint, PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        check_lease_tx(&mut tx, lease, recorded_at)?;
        let payload = Json(payload);
        let row = tx.query_typed_opt(
            "insert into quantos.workflow_run_checkpoints (
                workflow_run_id, checkpoint_key, step_index, payload, recorded_at
            ) select run.id, $2, $3, $4, $5
              from quantos.workflow_runs as run
              where run.id = $1 and run.status = 'running'
                and run.lease_owner = $6 and run.attempt_id = $7
                and run.lease_expires_at > greatest($5, clock_timestamp())
                and run.deadline_at > greatest($5, clock_timestamp())
                and run.cancel_requested_at is null
            on conflict (workflow_run_id)
            do update set
                checkpoint_key = excluded.checkpoint_key,
                step_index = excluded.step_index,
                payload = excluded.payload,
                recorded_at = excluded.recorded_at
            where quantos.workflow_run_checkpoints.step_index <= excluded.step_index
            returning workflow_run_id, checkpoint_key, step_index, payload, recorded_at",
            &[
                (lease.run.workflow_run_id.as_uuid(), Type::UUID),
                (&checkpoint_key, Type::TEXT),
                (&(step_index as i32), Type::INT4),
                (&payload, Type::JSONB),
                (&recorded_at, Type::TIMESTAMPTZ),
                (&lease.lease_owner, Type::TEXT),
                (lease.task_attempt_id.as_uuid(), Type::UUID),
            ],
        )?;
        let checkpoint = row
            .map(|row| row_to_checkpoint(&row))
            .transpose()?
            .ok_or_else(|| crate::RuntimeError::lease_conflict(lease.run.workflow_run_id))?;
        tx.commit()?;
        Ok(checkpoint)
    }

    pub fn load_checkpoint(
        &mut self,
        run_id: WorkflowRunId,
    ) -> Result<Option<WorkflowCheckpoint>, PgRuntimeError> {
        self.client
            .query_typed_opt(
                "select workflow_run_id, checkpoint_key, step_index, payload, recorded_at
                 from quantos.workflow_run_checkpoints
                 where workflow_run_id = $1",
                &[(run_id.as_uuid(), Type::UUID)],
            )?
            .map(|row| row_to_checkpoint(&row))
            .transpose()
    }

    pub fn record_artifact(
        &mut self,
        lease: &LeasedWorkflowRun,
        manifest: &ArtifactManifest,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowArtifactBinding, PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        check_lease_tx(&mut tx, lease, recorded_at)?;
        let metadata = serde_json::to_value(&manifest.metadata)?;
        let metadata = Json(&metadata);
        // Keep artifact upsert, workflow binding, and run touch in one statement.
        // Besides being atomic, this avoids four cross-region round trips and is
        // compatible with transaction-pooler connections.
        let row = tx.query_typed_opt(
            "with artifact as (
               insert into quantos.object_artifacts (
                 tenant_id, artifact_id, content_hash, storage_bucket, object_key,
                 media_type, size_bytes, metadata, created_at
               ) select $1,$2,$3,$4,$5,$6,$7,$8,$9
                 from quantos.workflow_runs as run
                 where run.id = $10 and run.tenant_id = $1
                   and run.status = 'running' and run.lease_owner = $12
                   and run.attempt_id = $13
                   and run.lease_expires_at > greatest($11, clock_timestamp())
                   and run.deadline_at > greatest($11, clock_timestamp())
                   and run.cancel_requested_at is null
                   and (run.cost_used_units < run.cost_budget_units or exists (
                     select 1 from quantos.workflow_run_artifacts as old_binding
                     join quantos.object_artifacts as old_artifact
                       on old_artifact.artifact_id = old_binding.artifact_id
                     where old_binding.workflow_run_id = run.id
                       and old_artifact.tenant_id = $1 and old_artifact.content_hash = $3
                   ))
               on conflict (tenant_id, content_hash)
               do update set
                 storage_bucket = quantos.object_artifacts.storage_bucket,
                 object_key = quantos.object_artifacts.object_key,
                 media_type = quantos.object_artifacts.media_type,
                 size_bytes = quantos.object_artifacts.size_bytes,
                 metadata = quantos.object_artifacts.metadata
               returning artifact_id
             ),
             binding as (
               insert into quantos.workflow_run_artifacts (
                 tenant_id, workflow_run_id, artifact_id, linked_at
               )
               select $1, $10, artifact_id, $11 from artifact
               on conflict (workflow_run_id, artifact_id)
               do update set linked_at = quantos.workflow_run_artifacts.linked_at
               returning workflow_run_id, artifact_id, linked_at,
                         (xmax = '0'::xid) as created
             ),
             touched as (
               update quantos.workflow_runs
               set updated_at = $11, cost_used_units = cost_used_units + 1
               where id = $10 and exists (select 1 from binding where created)
             )
             select workflow_run_id, artifact_id, linked_at from binding",
            &[
                (manifest.tenant_id.as_uuid(), Type::UUID),
                (manifest.artifact_id.as_uuid(), Type::UUID),
                (&manifest.content_hash.as_str(), Type::TEXT),
                (&manifest.storage_bucket, Type::TEXT),
                (&manifest.object_key, Type::TEXT),
                (&manifest.media_type, Type::TEXT),
                (&(manifest.size_bytes as i64), Type::INT8),
                (&metadata, Type::JSONB),
                (&manifest.created_at, Type::TIMESTAMPTZ),
                (lease.run.workflow_run_id.as_uuid(), Type::UUID),
                (&recorded_at, Type::TIMESTAMPTZ),
                (&lease.lease_owner, Type::TEXT),
                (lease.task_attempt_id.as_uuid(), Type::UUID),
            ],
        )?;
        let row =
            row.ok_or_else(|| crate::RuntimeError::lease_conflict(lease.run.workflow_run_id))?;
        tx.commit()?;
        Ok(WorkflowArtifactBinding {
            workflow_run_id: WorkflowRunId::from_uuid(row.get("workflow_run_id")),
            artifact_id: ArtifactId::from_uuid(row.get("artifact_id")),
            content_hash: manifest.content_hash.clone(),
            linked_at: row.get("linked_at"),
        })
    }

    pub fn complete_run(
        &mut self,
        lease: &LeasedWorkflowRun,
        completed_at: DateTime<Utc>,
    ) -> Result<(), PgRuntimeError> {
        let updated = self.client.execute_typed(
            "update quantos.workflow_runs
             set status = 'succeeded',
                 completed_at = $3,
                 lease_owner = null,
                 lease_expires_at = null, attempt_id = null,
                 updated_at = $3
             where id = $1 and lease_owner = $2 and attempt_id = $4
               and status = 'running' and lease_expires_at > greatest($3, clock_timestamp())
               and deadline_at > greatest($3, clock_timestamp())
               and cancel_requested_at is null",
            &[
                (lease.run.workflow_run_id.as_uuid(), Type::UUID),
                (&lease.lease_owner, Type::TEXT),
                (&completed_at, Type::TIMESTAMPTZ),
                (lease.task_attempt_id.as_uuid(), Type::UUID),
            ],
        )?;
        if updated == 0 {
            return Err(crate::RuntimeError::lease_conflict(lease.run.workflow_run_id).into());
        }
        Ok(())
    }

    pub fn fail_and_retry(
        &mut self,
        lease: &LeasedWorkflowRun,
        detail: &str,
        observed_at: DateTime<Utc>,
    ) -> Result<WorkflowRunStatus, PgRuntimeError> {
        let backoff_seconds = 1_i64 << lease.run.attempts.saturating_sub(1).min(6);
        let row = self.client.query_typed_opt(
            "update quantos.workflow_runs
             set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
                 completed_at = case when attempts >= max_attempts then $4 else null end,
                 next_attempt_at = $4 + $5 * interval '1 second',
                 last_error = $6, lease_owner = null, lease_expires_at = null,
                 attempt_id = null, updated_at = $4
             where id = $1 and lease_owner = $2 and attempt_id = $3
               and status = 'running' and lease_expires_at > greatest($4, clock_timestamp())
               and deadline_at > greatest($4, clock_timestamp())
               and cancel_requested_at is null
             returning status",
            &[
                (lease.run.workflow_run_id.as_uuid(), Type::UUID),
                (&lease.lease_owner, Type::TEXT),
                (lease.task_attempt_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
                (&backoff_seconds, Type::INT8),
                (&detail, Type::TEXT),
            ],
        )?;
        let row =
            row.ok_or_else(|| crate::RuntimeError::lease_conflict(lease.run.workflow_run_id))?;
        WorkflowRunStatus::from_database(row.get::<_, String>("status").as_str())
            .map_err(PgRuntimeError::from)
    }

    pub fn request_cancel(
        &mut self,
        run_id: WorkflowRunId,
        requested_at: DateTime<Utc>,
    ) -> Result<(), PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        let row = tx.query_typed_opt(
            "update quantos.workflow_runs as run
             set status = 'cancel_requested',
                 cancel_requested_at = $2,
                 updated_at = $2
             from quantos.actors as actor
             where run.id = $1
               and actor.id = run.actor_id
               and run.status in ('queued', 'running')
             returning run.tenant_id, run.correlation_id, actor.id as actor_id",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&requested_at, Type::TIMESTAMPTZ),
            ],
        )?;
        let Some(row) = row else {
            return Ok(());
        };
        insert_audit_tx(
            &mut tx,
            TenantId::from_uuid(row.get("tenant_id")),
            ActorId::from_uuid(row.get("actor_id")),
            CorrelationId::from_uuid(row.get("correlation_id")),
            "runtime.cancel_requested",
            &serde_json::json!({ "workflow_run_id": run_id.to_string() }),
            requested_at,
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn finalize_cancelled(
        &mut self,
        run_id: WorkflowRunId,
        cancelled_at: DateTime<Utc>,
    ) -> Result<(), PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        let row = tx.query_typed_opt(
            "update quantos.workflow_runs as run
             set status = 'cancelled',
                 completed_at = $2,
                 lease_owner = null,
                 lease_expires_at = null, attempt_id = null,
                 updated_at = $2
             from quantos.actors as actor
             where run.id = $1
               and actor.id = run.actor_id
               and run.status = 'cancel_requested'
               and (run.lease_expires_at is null or run.lease_expires_at <= $2)
             returning run.tenant_id, run.correlation_id, actor.id as actor_id",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&cancelled_at, Type::TIMESTAMPTZ),
            ],
        )?;
        let Some(row) = row else {
            return Ok(());
        };
        insert_audit_tx(
            &mut tx,
            TenantId::from_uuid(row.get("tenant_id")),
            ActorId::from_uuid(row.get("actor_id")),
            CorrelationId::from_uuid(row.get("correlation_id")),
            "runtime.cancelled",
            &serde_json::json!({ "workflow_run_id": run_id.to_string() }),
            cancelled_at,
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn mark_timed_out_runs(
        &mut self,
        tenant_id: TenantId,
        observed_at: DateTime<Utc>,
    ) -> Result<usize, PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        let rows = tx.query_typed(
            "update quantos.workflow_runs as run
             set status = 'timed_out',
                 completed_at = $1,
                 lease_owner = null,
                 lease_expires_at = null, attempt_id = null,
                 updated_at = $1
             from quantos.actors as actor
             where run.tenant_id = $2
               and run.deadline_at <= $1
               and run.status not in ('succeeded', 'failed', 'cancelled', 'timed_out')
               and actor.id = run.actor_id
             returning run.id, run.tenant_id, run.correlation_id, actor.id as actor_id",
            &[
                (&observed_at, Type::TIMESTAMPTZ),
                (tenant_id.as_uuid(), Type::UUID),
            ],
        )?;
        for row in &rows {
            let run_id = WorkflowRunId::from_uuid(row.get("id"));
            insert_audit_tx(
                &mut tx,
                TenantId::from_uuid(row.get("tenant_id")),
                ActorId::from_uuid(row.get("actor_id")),
                CorrelationId::from_uuid(row.get("correlation_id")),
                "runtime.timed_out",
                &serde_json::json!({ "workflow_run_id": run_id.to_string() }),
                observed_at,
            )?;
        }
        tx.commit()?;
        Ok(rows.len())
    }

    pub fn load_run(
        &mut self,
        run_id: WorkflowRunId,
    ) -> Result<Option<WorkflowRun>, PgRuntimeError> {
        self.client
            .query_typed_opt(
                "select id, runtime_session_id, tenant_id, actor_id, workspace_id, account_id,
                        tool_name, capability, workflow_kind, idempotency_key, correlation_id,
                        input_hash, status, attempts, max_attempts, next_attempt_at, deadline_at,
                        cost_budget_units, rate_limit_per_minute, lease_owner, lease_expires_at,
                        cancel_requested_at, completed_at, last_error, created_at, updated_at
                 from quantos.workflow_runs
                 where id = $1",
                &[(run_id.as_uuid(), Type::UUID)],
            )?
            .map(|row| row_to_workflow_run(&row))
            .transpose()
    }

    pub fn workflow_artifact_count(
        &mut self,
        run_id: WorkflowRunId,
    ) -> Result<i64, PgRuntimeError> {
        Ok(self
            .client
            .query_typed_one(
                "select count(*) as count
                 from quantos.workflow_run_artifacts
                 where workflow_run_id = $1",
                &[(run_id.as_uuid(), Type::UUID)],
            )?
            .get("count"))
    }

    pub fn load_artifact_for_run(
        &mut self,
        tenant_id: TenantId,
        run_id: WorkflowRunId,
        artifact_id: ArtifactId,
    ) -> Result<Option<ArtifactManifest>, PgRuntimeError> {
        let row = self.client.query_typed_opt(
            "select artifact.artifact_id, artifact.tenant_id, artifact.media_type,
                    artifact.content_hash, artifact.storage_bucket, artifact.object_key,
                    artifact.size_bytes, artifact.metadata, artifact.created_at
             from quantos.workflow_run_artifacts as binding
             join quantos.object_artifacts as artifact
               on artifact.artifact_id = binding.artifact_id
              and artifact.tenant_id = binding.tenant_id
             where binding.tenant_id = $1 and binding.workflow_run_id = $2
               and binding.artifact_id = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (run_id.as_uuid(), Type::UUID),
                (artifact_id.as_uuid(), Type::UUID),
            ],
        )?;
        row.map(|row| {
            let metadata: Json<serde_json::Value> = row.get("metadata");
            Ok(ArtifactManifest {
                artifact_id: ArtifactId::from_uuid(row.get("artifact_id")),
                tenant_id: TenantId::from_uuid(row.get("tenant_id")),
                media_type: row.get("media_type"),
                content_hash: ContentHash::parse(row.get::<_, String>("content_hash").as_str())?,
                storage_bucket: row.get("storage_bucket"),
                object_key: row.get("object_key"),
                size_bytes: row.get::<_, i64>("size_bytes") as u64,
                metadata: serde_json::from_value(metadata.0)?,
                created_at: row.get("created_at"),
            })
        })
        .transpose()
    }

    pub fn audit_actions_for_run(
        &mut self,
        run_id: WorkflowRunId,
    ) -> Result<Vec<String>, PgRuntimeError> {
        let rows = self.client.query_typed(
            "select action
             from quantos.audit_entries
             where details ->> 'workflow_run_id' = $1
             order by recorded_at asc",
            &[(&run_id.to_string(), Type::TEXT)],
        )?;
        Ok(rows.into_iter().map(|row| row.get("action")).collect())
    }
}

fn require_narrow_runtime_role(
    runtime: bool,
    bff: bool,
    execution: bool,
) -> Result<(), PgRuntimeError> {
    if !runtime || bff || execution {
        return Err(PgRuntimeError::RuntimeRoleRequired);
    }
    Ok(())
}

fn check_lease_tx(
    tx: &mut Transaction<'_>,
    lease: &LeasedWorkflowRun,
    at: DateTime<Utc>,
) -> Result<(), PgRuntimeError> {
    let row = tx.query_typed_opt(
        "select id from quantos.workflow_runs
         where id = $1 and tenant_id = $2 and status = 'running'
           and lease_owner = $3 and attempt_id = $4
           and lease_expires_at > greatest($5, clock_timestamp())
           and deadline_at > greatest($5, clock_timestamp())
           and cancel_requested_at is null
         for update",
        &[
            (lease.run.workflow_run_id.as_uuid(), Type::UUID),
            (lease.run.tenant_id.as_uuid(), Type::UUID),
            (&lease.lease_owner, Type::TEXT),
            (lease.task_attempt_id.as_uuid(), Type::UUID),
            (&at, Type::TIMESTAMPTZ),
        ],
    )?;
    if row.is_none() {
        return Err(crate::RuntimeError::lease_conflict(lease.run.workflow_run_id).into());
    }
    Ok(())
}

fn connect_client(database_url: &str) -> Result<Client, PgRuntimeError> {
    let url = Url::parse(database_url)?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    let mode = url
        .query_pairs()
        .find(|(key, _)| key == "sslmode")
        .map(|(_, value)| value.into_owned());
    if !local && mode.as_deref() != Some("verify-full") {
        return Err(PgRuntimeError::InsecureDatabaseTransport);
    }
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned());
    let options = url
        .query_pairs()
        .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let mut connection_url = url.clone();
    connection_url.set_query(None);
    if !options.is_empty() {
        connection_url.query_pairs_mut().extend_pairs(options);
    }
    let mut config: postgres::Config = connection_url.as_str().parse()?;
    if local && mode.as_deref() != Some("verify-full") {
        config.ssl_mode(postgres::config::SslMode::Disable);
        return Ok(config.connect(NoTls)?);
    }
    let mut builder = SslConnector::builder(SslMethod::tls())?;
    builder.set_verify(SslVerifyMode::PEER);
    if let Some(root) = root {
        builder.set_ca_file(root)?;
    } else {
        builder.set_default_verify_paths()?;
    }
    config.ssl_mode(postgres::config::SslMode::Require);
    Ok(config.connect(MakeTlsConnector::new(builder.build()))?)
}

fn insert_audit_tx(
    tx: &mut Transaction<'_>,
    tenant_id: TenantId,
    actor_id: ActorId,
    correlation_id: CorrelationId,
    action: &str,
    details: &serde_json::Value,
    recorded_at: DateTime<Utc>,
) -> Result<AuditEntryId, PgRuntimeError> {
    let details = Json(details);
    let row = tx.query_typed_one(
        "insert into quantos.audit_entries (
            tenant_id, actor_id, correlation_id, causation_id, action, details, recorded_at
        ) values ($1,$2,$3,$3,$4,$5,$6)
        returning id",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (actor_id.as_uuid(), Type::UUID),
            (correlation_id.as_uuid(), Type::UUID),
            (&action, Type::TEXT),
            (&details, Type::JSONB),
            (&recorded_at, Type::TIMESTAMPTZ),
        ],
    )?;
    Ok(AuditEntryId::from_uuid(row.get("id")))
}

fn row_to_runtime_session(row: &Row) -> Result<RuntimeSession, PgRuntimeError> {
    Ok(RuntimeSession {
        runtime_session_id: RuntimeSessionId::from_uuid(row.get("id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        actor_id: quantos_core::ActorId::from_uuid(row.get("actor_id")),
        workspace_id: quantos_core::WorkspaceId::from_uuid(row.get("workspace_id")),
        account_id: row
            .get::<_, Option<Uuid>>("account_id")
            .map(quantos_core::AccountId::from_uuid),
        mode: RunMode::parse(row.get::<_, String>("mode").as_str())?,
        created_at: row.get("created_at"),
        expires_at: row.get("expires_at"),
    })
}

fn row_to_tool_registration(row: &Row) -> Result<ToolRegistration, PgRuntimeError> {
    Ok(ToolRegistration {
        tool_name: row.get("tool_name"),
        capability: Capability::parse(row.get::<_, String>("capability").as_str())?,
        description: row.get("description"),
        max_cost_units: row.get::<_, i64>("max_cost_units") as u64,
        rate_limit_per_minute: row.get::<_, i32>("rate_limit_per_minute") as u32,
        enabled: row.get("enabled"),
    })
}

fn row_to_workflow_run(row: &Row) -> Result<WorkflowRun, PgRuntimeError> {
    Ok(WorkflowRun {
        workflow_run_id: WorkflowRunId::from_uuid(row.get("id")),
        runtime_session_id: RuntimeSessionId::from_uuid(row.get("runtime_session_id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        actor_id: quantos_core::ActorId::from_uuid(row.get("actor_id")),
        workspace_id: quantos_core::WorkspaceId::from_uuid(row.get("workspace_id")),
        account_id: row
            .get::<_, Option<Uuid>>("account_id")
            .map(quantos_core::AccountId::from_uuid),
        tool_name: row.get("tool_name"),
        capability: Capability::parse(row.get::<_, String>("capability").as_str())?,
        workflow_kind: row.get("workflow_kind"),
        idempotency_key: row.get("idempotency_key"),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        input_hash: ContentHash::parse(row.get::<_, String>("input_hash").as_str())?,
        status: WorkflowRunStatus::from_database(row.get::<_, String>("status").as_str())?,
        attempts: row.get::<_, i32>("attempts") as u32,
        max_attempts: row.get::<_, i32>("max_attempts") as u32,
        next_attempt_at: row.get("next_attempt_at"),
        deadline_at: row.get("deadline_at"),
        cost_budget_units: row.get::<_, i64>("cost_budget_units") as u64,
        rate_limit_per_minute: row.get::<_, i32>("rate_limit_per_minute") as u32,
        lease_owner: row.get("lease_owner"),
        lease_expires_at: row.get("lease_expires_at"),
        cancel_requested_at: row.get("cancel_requested_at"),
        completed_at: row.get("completed_at"),
        last_error: row.get("last_error"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn row_to_checkpoint(row: &Row) -> Result<WorkflowCheckpoint, PgRuntimeError> {
    Ok(WorkflowCheckpoint {
        workflow_run_id: WorkflowRunId::from_uuid(row.get("workflow_run_id")),
        checkpoint_key: row.get("checkpoint_key"),
        step_index: row.get::<_, i32>("step_index") as u32,
        payload: row.get("payload"),
        recorded_at: row.get("recorded_at"),
    })
}

#[cfg(test)]
mod tests {
    use super::{PgRuntimeError, PgRuntimeStore, require_narrow_runtime_role};
    use std::env;
    use url::Url;

    #[test]
    fn remote_runtime_rejects_unverified_transport_before_connecting() {
        let result = PgRuntimeStore::connect_as_runtime(
            "postgresql://runtime:unused@db.example.supabase.co:5432/postgres?sslmode=require",
        );
        assert!(matches!(
            result,
            Err(PgRuntimeError::InsecureDatabaseTransport)
        ));
        let result = PgRuntimeStore::connect(
            "postgresql://runtime:unused@db.example.supabase.co:5432/postgres?sslmode=disable",
        );
        assert!(matches!(
            result,
            Err(PgRuntimeError::InsecureDatabaseTransport)
        ));
    }

    #[test]
    fn runtime_role_membership_requires_only_the_runtime_role() {
        assert!(require_narrow_runtime_role(true, false, false).is_ok());
        for memberships in [
            (false, false, false),
            (true, true, false),
            (true, false, true),
            (true, true, true),
        ] {
            assert!(matches!(
                require_narrow_runtime_role(memberships.0, memberships.1, memberships.2),
                Err(PgRuntimeError::RuntimeRoleRequired)
            ));
        }
    }

    #[test]
    fn local_transport_and_query_options_are_handled_explicitly() {
        for url in [
            "postgresql://runtime:unused@127.0.0.1:1/postgres",
            "postgresql://runtime:unused@127.0.0.1:1/postgres?sslmode=verify-full",
            "postgresql://runtime:unused@127.0.0.1:1/postgres?sslmode=verify-full&application_name=f07-test",
        ] {
            assert!(matches!(
                PgRuntimeStore::connect(url),
                Err(PgRuntimeError::Postgres(_))
            ));
        }
    }

    #[test]
    fn broad_admin_login_cannot_impersonate_runtime_service() {
        let Some(database_url) = env::var("DATABASE_URL")
            .ok()
            .filter(|value| !value.is_empty())
        else {
            assert_ne!(env::var("QUANTOS_F07_DB_REQUIRED").as_deref(), Ok("1"));
            return;
        };
        let mut url = Url::parse(&database_url).unwrap();
        let ca = env::var("QUANTOS_BFF_SSLROOTCERT").expect("isolated Supabase CA is required");
        let options = url
            .query_pairs()
            .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();
        url.set_query(None);
        url.query_pairs_mut()
            .extend_pairs(options)
            .append_pair("sslmode", "verify-full")
            .append_pair("sslrootcert", &ca);
        assert!(matches!(
            PgRuntimeStore::connect_as_runtime(url.as_str()),
            Err(PgRuntimeError::RuntimeRoleRequired)
        ));
    }
}
