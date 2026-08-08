use chrono::{DateTime, Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{
    Client, NoTls, Row, Transaction,
    types::{Json, Type},
};
use postgres_native_tls::MakeTlsConnector;
use thiserror::Error;
use url::Url;
use uuid::Uuid;

use crate::{
    LeasedWorkflowRun, NewWorkflowRun, RuntimeSession, ToolRegistration, WorkflowArtifactBinding,
    WorkflowCheckpoint, WorkflowRun, WorkflowRunStatus,
};
use quantos_auth::AuthContext;
use quantos_core::{
    ArtifactId, AuditEntryId, ContentHash, CoreError, CorrelationId, RuntimeSessionId,
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
    Tls(#[from] native_tls::Error),
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

    pub fn create_session(
        &mut self,
        auth: &AuthContext,
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<RuntimeSession, PgRuntimeError> {
        let row = self.client.query_typed_one(
            "insert into quantos.runtime_sessions (
                tenant_id, actor_id, workspace_id, account_id, mode, created_at, expires_at
            ) values ($1,$2,$3,$4,$5,$6,$7)
            returning id, tenant_id, actor_id, workspace_id, account_id, mode, created_at, expires_at",
            &[
                (auth.tenant_id.as_uuid(), Type::UUID),
                (auth.actor_id.as_uuid(), Type::UUID),
                (auth.workspace_id.as_uuid(), Type::UUID),
                (&auth.account_id.map(|value| *value.as_uuid()), Type::UUID),
                (&auth.mode.as_str(), Type::TEXT),
                (&created_at, Type::TIMESTAMPTZ),
                (&expires_at, Type::TIMESTAMPTZ),
            ],
        )?;
        row_to_runtime_session(&row)
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
            ),
            tool_row as (
                select tool.tool_name,
                       tool.capability,
                       tool.max_cost_units,
                       tool.rate_limit_per_minute
                from quantos.tool_registry as tool
                join session_row as session on session.tenant_id = tool.tenant_id
                where tool.tool_name = $2 and tool.enabled = true
            )
            insert into quantos.workflow_runs (
                tenant_id, runtime_session_id, actor_id, workspace_id, account_id, tool_name,
                capability, workflow_kind, idempotency_key, correlation_id, input_hash,
                status, attempts, max_attempts, next_attempt_at, deadline_at,
                cost_budget_units, rate_limit_per_minute, created_at, updated_at
            )
            select session.tenant_id, session.id, session.actor_id, session.workspace_id, session.account_id,
                   tool.tool_name, $3, $4, $5, $6, $7, 'queued', 0, $8, $12, $9,
                   least($10, tool.max_cost_units), least($11, tool.rate_limit_per_minute), $12, $12
            from session_row as session
            join tool_row as tool on true
            on conflict (tenant_id, idempotency_key)
            do update set updated_at = quantos.workflow_runs.updated_at
            returning id, runtime_session_id, tenant_id, actor_id, workspace_id, account_id,
                      tool_name, capability, workflow_kind, idempotency_key, correlation_id,
                      input_hash, status, attempts, max_attempts, next_attempt_at, deadline_at,
                      cost_budget_units, rate_limit_per_minute, lease_owner, lease_expires_at,
                      cancel_requested_at, completed_at, last_error, created_at, updated_at",
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
            ],
        )?;

        match row {
            Some(row) => row_to_workflow_run(&row),
            None => Err(crate::RuntimeError::tool_not_registered(&input.tool_name).into()),
        }
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
        let lease_expires_at = observed_at + lease_duration;
        let rows = self.client.query_typed(
            "with candidate as (
                select run.id
                from quantos.workflow_runs as run
                where run.tenant_id = $5
                  and run.next_attempt_at <= $3
                  and run.deadline_at > $3
                  and run.cancel_requested_at is null
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
                updated_at = $3
            from candidate
            where run.id = candidate.id
            returning run.id, run.runtime_session_id, run.tenant_id, run.actor_id, run.workspace_id,
                      run.account_id, run.tool_name, run.capability, run.workflow_kind,
                      run.idempotency_key, run.correlation_id, run.input_hash, run.status,
                      run.attempts, run.max_attempts, run.next_attempt_at, run.deadline_at,
                      run.cost_budget_units, run.rate_limit_per_minute, run.lease_owner,
                      run.lease_expires_at, run.cancel_requested_at, run.completed_at,
                      run.last_error, run.created_at, run.updated_at",
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
                    task_attempt_id: TaskAttemptId::new(),
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
        run_id: WorkflowRunId,
        checkpoint_key: &str,
        step_index: u32,
        payload: &serde_json::Value,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowCheckpoint, PgRuntimeError> {
        let payload = Json(payload);
        let row = self.client.query_typed_one(
            "insert into quantos.workflow_run_checkpoints (
                workflow_run_id, checkpoint_key, step_index, payload, recorded_at
            ) values ($1,$2,$3,$4,$5)
            on conflict (workflow_run_id)
            do update set
                checkpoint_key = excluded.checkpoint_key,
                step_index = excluded.step_index,
                payload = excluded.payload,
                recorded_at = excluded.recorded_at
            returning workflow_run_id, checkpoint_key, step_index, payload, recorded_at",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&checkpoint_key, Type::TEXT),
                (&(step_index as i32), Type::INT4),
                (&payload, Type::JSONB),
                (&recorded_at, Type::TIMESTAMPTZ),
            ],
        )?;
        row_to_checkpoint(&row)
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
        run_id: WorkflowRunId,
        manifest: &ArtifactManifest,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowArtifactBinding, PgRuntimeError> {
        let metadata = serde_json::to_value(&manifest.metadata)?;
        let metadata = Json(&metadata);
        // Keep artifact upsert, workflow binding, and run touch in one statement.
        // Besides being atomic, this avoids four cross-region round trips and is
        // compatible with transaction-pooler connections.
        let row = self.client.query_typed_one(
            "with artifact as (
               insert into quantos.object_artifacts (
                 tenant_id, artifact_id, content_hash, storage_bucket, object_key,
                 media_type, size_bytes, metadata, created_at
               ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
                 workflow_run_id, artifact_id, linked_at
               )
               select $10, artifact_id, $11 from artifact
               on conflict (workflow_run_id, artifact_id)
               do update set linked_at = quantos.workflow_run_artifacts.linked_at
               returning workflow_run_id, artifact_id, linked_at
             ),
             touched as (
               update quantos.workflow_runs
               set updated_at = $11
               where id = $10 and exists (select 1 from binding)
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
                (run_id.as_uuid(), Type::UUID),
                (&recorded_at, Type::TIMESTAMPTZ),
            ],
        )?;
        Ok(WorkflowArtifactBinding {
            workflow_run_id: WorkflowRunId::from_uuid(row.get("workflow_run_id")),
            artifact_id: ArtifactId::from_uuid(row.get("artifact_id")),
            content_hash: manifest.content_hash.clone(),
            linked_at: row.get("linked_at"),
        })
    }

    pub fn complete_run(
        &mut self,
        run_id: WorkflowRunId,
        worker_name: &str,
        completed_at: DateTime<Utc>,
    ) -> Result<(), PgRuntimeError> {
        let updated = self.client.execute_typed(
            "update quantos.workflow_runs
             set status = 'succeeded',
                 completed_at = $3,
                 lease_owner = null,
                 lease_expires_at = null,
                 updated_at = $3
             where id = $1 and lease_owner = $2",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&worker_name, Type::TEXT),
                (&completed_at, Type::TIMESTAMPTZ),
            ],
        )?;
        if updated == 0 {
            return Err(crate::RuntimeError::lease_conflict(run_id).into());
        }
        Ok(())
    }

    pub fn request_cancel(
        &mut self,
        run_id: WorkflowRunId,
        requested_at: DateTime<Utc>,
    ) -> Result<(), PgRuntimeError> {
        let mut tx = self.client.transaction()?;
        let row = tx.query_typed_one(
            "update quantos.workflow_runs as run
             set status = case
                   when run.status in ('queued', 'running', 'cancel_requested') then 'cancel_requested'
                   else run.status
                 end,
                 cancel_requested_at = coalesce(run.cancel_requested_at, $2),
                 updated_at = $2
             from quantos.actors as actor
             where run.id = $1
               and actor.id = run.actor_id
             returning run.tenant_id, run.correlation_id, actor.user_id",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&requested_at, Type::TIMESTAMPTZ),
            ],
        )?;
        insert_audit_tx(
            &mut tx,
            TenantId::from_uuid(row.get("tenant_id")),
            CorrelationId::from_uuid(row.get("correlation_id")),
            row.get("user_id"),
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
        let row = tx.query_typed_one(
            "update quantos.workflow_runs as run
             set status = 'cancelled',
                 completed_at = $2,
                 lease_owner = null,
                 lease_expires_at = null,
                 updated_at = $2
             from quantos.actors as actor
             where run.id = $1
               and actor.id = run.actor_id
             returning run.tenant_id, run.correlation_id, actor.user_id",
            &[
                (run_id.as_uuid(), Type::UUID),
                (&cancelled_at, Type::TIMESTAMPTZ),
            ],
        )?;
        insert_audit_tx(
            &mut tx,
            TenantId::from_uuid(row.get("tenant_id")),
            CorrelationId::from_uuid(row.get("correlation_id")),
            row.get("user_id"),
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
                 lease_expires_at = null,
                 updated_at = $1
             from quantos.actors as actor
             where run.tenant_id = $2
               and run.deadline_at <= $1
               and run.cancel_requested_at is null
               and run.status not in ('succeeded', 'failed', 'cancelled', 'timed_out')
               and actor.id = run.actor_id
             returning run.id, run.tenant_id, run.correlation_id, actor.user_id",
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
                CorrelationId::from_uuid(row.get("correlation_id")),
                row.get("user_id"),
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

fn connect_client(database_url: &str) -> Result<Client, PgRuntimeError> {
    let url = Url::parse(database_url)?;
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Ok(Client::connect(database_url, NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build()?;
        Ok(Client::connect(
            database_url,
            MakeTlsConnector::new(connector),
        )?)
    }
}

fn insert_audit_tx(
    tx: &mut Transaction<'_>,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
    actor_user_id: Option<Uuid>,
    action: &str,
    details: &serde_json::Value,
    recorded_at: DateTime<Utc>,
) -> Result<AuditEntryId, PgRuntimeError> {
    let details = Json(details);
    let row = tx.query_typed_one(
        "insert into quantos.audit_entries (
            tenant_id, correlation_id, actor_user_id, action, details, recorded_at
        ) values ($1,$2,$3,$4,$5,$6)
        returning id",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (correlation_id.as_uuid(), Type::UUID),
            (&actor_user_id, Type::UUID),
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
        status: match row.get::<_, String>("status").as_str() {
            "queued" => WorkflowRunStatus::Queued,
            "running" => WorkflowRunStatus::Running,
            "succeeded" => WorkflowRunStatus::Succeeded,
            "failed" => WorkflowRunStatus::Failed,
            "cancel_requested" => WorkflowRunStatus::CancelRequested,
            "cancelled" => WorkflowRunStatus::Cancelled,
            "timed_out" => WorkflowRunStatus::TimedOut,
            value => return Err(crate::RuntimeError::invalid_status(value).into()),
        },
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
