pub mod pg;
pub mod research;
pub mod signal_proposal;

use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ArtifactId, ContentHash, CorrelationId, RuntimeSessionId, TaskAttemptId, TenantId,
    WorkflowRunId,
};
use quantos_policy::Capability;
use quantos_storage::ArtifactManifest;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeSession {
    pub runtime_session_id: RuntimeSessionId,
    pub tenant_id: TenantId,
    pub actor_id: quantos_core::ActorId,
    pub workspace_id: quantos_core::WorkspaceId,
    pub account_id: Option<quantos_core::AccountId>,
    pub mode: quantos_policy::RunMode,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolRegistration {
    pub tool_name: String,
    pub capability: Capability,
    pub description: String,
    pub max_cost_units: u64,
    pub rate_limit_per_minute: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowRunStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
    CancelRequested,
    Cancelled,
    TimedOut,
}

impl WorkflowRunStatus {
    pub fn from_database(value: &str) -> Result<Self, RuntimeError> {
        match value {
            "queued" => Ok(Self::Queued),
            "running" => Ok(Self::Running),
            "succeeded" => Ok(Self::Succeeded),
            "failed" => Ok(Self::Failed),
            "cancel_requested" => Ok(Self::CancelRequested),
            "cancelled" => Ok(Self::Cancelled),
            "timed_out" => Ok(Self::TimedOut),
            other => Err(RuntimeError::invalid_status(other)),
        }
    }
    #[must_use]
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::Cancelled | Self::TimedOut
        )
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::CancelRequested => "cancel_requested",
            Self::Cancelled => "cancelled",
            Self::TimedOut => "timed_out",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub workflow_run_id: WorkflowRunId,
    pub runtime_session_id: RuntimeSessionId,
    pub tenant_id: TenantId,
    pub actor_id: quantos_core::ActorId,
    pub workspace_id: quantos_core::WorkspaceId,
    pub account_id: Option<quantos_core::AccountId>,
    pub tool_name: String,
    pub capability: Capability,
    pub workflow_kind: String,
    pub idempotency_key: String,
    pub correlation_id: CorrelationId,
    pub input_hash: ContentHash,
    pub status: WorkflowRunStatus,
    pub attempts: u32,
    pub max_attempts: u32,
    pub next_attempt_at: DateTime<Utc>,
    pub deadline_at: DateTime<Utc>,
    pub cost_budget_units: u64,
    pub rate_limit_per_minute: u32,
    pub lease_owner: Option<String>,
    pub lease_expires_at: Option<DateTime<Utc>>,
    pub cancel_requested_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewWorkflowRun {
    pub runtime_session_id: RuntimeSessionId,
    pub tool_name: String,
    pub capability: Capability,
    pub workflow_kind: String,
    pub idempotency_key: String,
    pub correlation_id: CorrelationId,
    pub input_hash: ContentHash,
    pub max_attempts: u32,
    pub deadline_at: DateTime<Utc>,
    pub cost_budget_units: u64,
    pub rate_limit_per_minute: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowCheckpoint {
    pub workflow_run_id: WorkflowRunId,
    pub checkpoint_key: String,
    pub step_index: u32,
    pub payload: Value,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowArtifactBinding {
    pub workflow_run_id: WorkflowRunId,
    pub artifact_id: ArtifactId,
    pub content_hash: ContentHash,
    pub linked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeAuditRecord {
    pub tenant_id: TenantId,
    pub workflow_run_id: WorkflowRunId,
    pub action: String,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeasedWorkflowRun {
    pub task_attempt_id: TaskAttemptId,
    pub run: WorkflowRun,
    pub lease_owner: String,
    pub lease_expires_at: DateTime<Utc>,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{code}: {message}")]
pub struct RuntimeError {
    code: &'static str,
    message: String,
}

impl RuntimeError {
    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        self.code
    }

    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    #[must_use]
    pub fn session_expired(session_id: RuntimeSessionId) -> Self {
        Self::new(
            "RUNTIME_SESSION_EXPIRED",
            format!("runtime session `{session_id}` is expired"),
        )
    }

    #[must_use]
    pub fn tool_not_registered(tool_name: &str) -> Self {
        Self::new(
            "RUNTIME_TOOL_NOT_REGISTERED",
            format!("tool `{tool_name}` is not registered or not enabled"),
        )
    }

    #[must_use]
    pub fn duplicate_tool(tool_name: &str) -> Self {
        Self::new(
            "RUNTIME_DUPLICATE_TOOL",
            format!("tool `{tool_name}` is already registered"),
        )
    }

    #[must_use]
    pub fn duplicate_idempotency_key(idempotency_key: &str) -> Self {
        Self::new(
            "RUNTIME_DUPLICATE_IDEMPOTENCY",
            format!("workflow idempotency key `{idempotency_key}` already exists"),
        )
    }

    #[must_use]
    pub fn run_not_found(run_id: WorkflowRunId) -> Self {
        Self::new(
            "RUNTIME_RUN_NOT_FOUND",
            format!("workflow run `{run_id}` was not found"),
        )
    }

    #[must_use]
    pub fn invalid_status(value: &str) -> Self {
        Self::new(
            "RUNTIME_INVALID_STATUS",
            format!("invalid workflow status `{value}`"),
        )
    }

    #[must_use]
    pub fn lease_conflict(run_id: WorkflowRunId) -> Self {
        Self::new(
            "RUNTIME_LEASE_CONFLICT",
            format!("workflow run `{run_id}` is not currently leased by this worker"),
        )
    }

    #[must_use]
    pub fn rejected(reason: &'static str) -> Self {
        Self::new("RUNTIME_REQUEST_REJECTED", reason)
    }
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryRuntimeKernel {
    sessions: BTreeMap<RuntimeSessionId, RuntimeSession>,
    session_capabilities: BTreeMap<RuntimeSessionId, BTreeSet<Capability>>,
    tools: BTreeMap<String, ToolRegistration>,
    runs: BTreeMap<WorkflowRunId, WorkflowRun>,
    runs_by_idempotency: BTreeMap<(TenantId, String), WorkflowRunId>,
    requests_by_idempotency: BTreeMap<(TenantId, String), NewWorkflowRun>,
    checkpoints: BTreeMap<WorkflowRunId, WorkflowCheckpoint>,
    artifacts_by_hash: BTreeMap<(TenantId, ContentHash), ArtifactManifest>,
    run_artifacts: BTreeMap<WorkflowRunId, BTreeSet<ArtifactId>>,
    audit_log: Vec<RuntimeAuditRecord>,
}

impl InMemoryRuntimeKernel {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_session(
        &mut self,
        auth: &AuthContext,
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> RuntimeSession {
        let session = RuntimeSession {
            runtime_session_id: RuntimeSessionId::new(),
            tenant_id: auth.tenant_id,
            actor_id: auth.actor_id,
            workspace_id: auth.workspace_id,
            account_id: auth.account_id,
            mode: auth.mode,
            created_at,
            expires_at,
        };
        self.sessions
            .insert(session.runtime_session_id, session.clone());
        self.session_capabilities
            .insert(session.runtime_session_id, auth.capabilities.clone());
        session
    }

    pub fn register_tool(&mut self, tool: ToolRegistration) -> Result<(), RuntimeError> {
        if self.tools.contains_key(&tool.tool_name) {
            return Err(RuntimeError::duplicate_tool(&tool.tool_name));
        }
        self.tools.insert(tool.tool_name.clone(), tool);
        Ok(())
    }

    pub fn schedule_run(
        &mut self,
        input: NewWorkflowRun,
        queued_at: DateTime<Utc>,
    ) -> Result<WorkflowRun, RuntimeError> {
        let session = self
            .sessions
            .get(&input.runtime_session_id)
            .ok_or(RuntimeError::session_expired(input.runtime_session_id))?;
        if session.expires_at <= queued_at {
            return Err(RuntimeError::session_expired(input.runtime_session_id));
        }
        let tool = self
            .tools
            .get(&input.tool_name)
            .filter(|tool| tool.enabled)
            .ok_or_else(|| RuntimeError::tool_not_registered(&input.tool_name))?;

        let key = (session.tenant_id, input.idempotency_key.clone());
        if let Some(existing_id) = self.runs_by_idempotency.get(&key) {
            let existing =
                self.runs.get(existing_id).cloned().ok_or_else(|| {
                    RuntimeError::duplicate_idempotency_key(&input.idempotency_key)
                })?;
            if self.requests_by_idempotency.get(&key) != Some(&input) {
                return Err(RuntimeError::duplicate_idempotency_key(
                    &input.idempotency_key,
                ));
            }
            return Ok(existing);
        }

        if input.deadline_at <= queued_at || input.capability != tool.capability {
            return Err(RuntimeError::rejected(
                "deadline or tool capability is invalid",
            ));
        }
        if !self
            .session_capabilities
            .get(&input.runtime_session_id)
            .is_some_and(|capabilities| capabilities.contains(&input.capability))
        {
            return Err(RuntimeError::rejected("tool is not authorized"));
        }

        let rate_limit_per_minute = input.rate_limit_per_minute.min(tool.rate_limit_per_minute);
        let request = input.clone();
        let run = WorkflowRun {
            workflow_run_id: WorkflowRunId::new(),
            runtime_session_id: input.runtime_session_id,
            tenant_id: session.tenant_id,
            actor_id: session.actor_id,
            workspace_id: session.workspace_id,
            account_id: session.account_id,
            tool_name: input.tool_name,
            capability: input.capability,
            workflow_kind: input.workflow_kind,
            idempotency_key: input.idempotency_key,
            correlation_id: input.correlation_id,
            input_hash: input.input_hash,
            status: WorkflowRunStatus::Queued,
            attempts: 0,
            max_attempts: input.max_attempts.max(1),
            next_attempt_at: queued_at,
            deadline_at: input.deadline_at,
            cost_budget_units: input.cost_budget_units.min(tool.max_cost_units),
            rate_limit_per_minute,
            lease_owner: None,
            lease_expires_at: None,
            cancel_requested_at: None,
            completed_at: None,
            last_error: None,
            created_at: queued_at,
            updated_at: queued_at,
        };
        self.runs_by_idempotency.insert(
            (run.tenant_id, run.idempotency_key.clone()),
            run.workflow_run_id,
        );
        self.requests_by_idempotency.insert(key, request);
        self.runs.insert(run.workflow_run_id, run.clone());
        Ok(run)
    }

    pub fn claim_runs(
        &mut self,
        worker_name: &str,
        now: DateTime<Utc>,
        limit: usize,
        lease_duration: ChronoDuration,
    ) -> Vec<LeasedWorkflowRun> {
        self.mark_timed_out_runs(now);

        let mut claimed = Vec::new();
        let mut ids = self
            .runs
            .iter()
            .filter_map(|(id, run)| {
                let lease_expired = run
                    .lease_expires_at
                    .map(|value| value <= now)
                    .unwrap_or(true);
                let eligible = run.attempts < run.max_attempts
                    && matches!(
                        run.status,
                        WorkflowRunStatus::Queued | WorkflowRunStatus::Running
                    )
                    && run.next_attempt_at <= now
                    && run.deadline_at > now
                    && run.cancel_requested_at.is_none()
                    && lease_expired;
                eligible.then_some(*id)
            })
            .collect::<Vec<_>>();
        ids.sort_by_key(|id| {
            self.runs
                .get(id)
                .map(|run| (run.next_attempt_at, run.created_at))
                .unwrap_or((now, now))
        });

        for id in ids.into_iter().take(limit) {
            let run = self.runs.get_mut(&id).expect("run should exist");
            run.status = WorkflowRunStatus::Running;
            run.attempts += 1;
            run.lease_owner = Some(worker_name.to_owned());
            let lease_expires_at = now + lease_duration;
            run.lease_expires_at = Some(lease_expires_at);
            run.updated_at = now;
            claimed.push(LeasedWorkflowRun {
                task_attempt_id: TaskAttemptId::new(),
                run: run.clone(),
                lease_owner: worker_name.to_owned(),
                lease_expires_at,
            });
        }

        claimed
    }

    pub fn save_checkpoint(
        &mut self,
        run_id: WorkflowRunId,
        checkpoint_key: impl Into<String>,
        step_index: u32,
        payload: Value,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowCheckpoint, RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        run.updated_at = recorded_at;
        let checkpoint = WorkflowCheckpoint {
            workflow_run_id: run_id,
            checkpoint_key: checkpoint_key.into(),
            step_index,
            payload,
            recorded_at,
        };
        self.checkpoints.insert(run_id, checkpoint.clone());
        Ok(checkpoint)
    }

    #[must_use]
    pub fn load_checkpoint(&self, run_id: WorkflowRunId) -> Option<&WorkflowCheckpoint> {
        self.checkpoints.get(&run_id)
    }

    pub fn record_artifact(
        &mut self,
        run_id: WorkflowRunId,
        manifest: ArtifactManifest,
        recorded_at: DateTime<Utc>,
    ) -> Result<ArtifactManifest, RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        run.updated_at = recorded_at;
        let artifact = self
            .artifacts_by_hash
            .entry((manifest.tenant_id, manifest.content_hash.clone()))
            .or_insert_with(|| manifest.clone())
            .clone();
        self.run_artifacts
            .entry(run_id)
            .or_default()
            .insert(artifact.artifact_id);
        Ok(artifact)
    }

    pub fn complete_run(
        &mut self,
        run_id: WorkflowRunId,
        worker_name: &str,
        completed_at: DateTime<Utc>,
    ) -> Result<(), RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        if run.lease_owner.as_deref() != Some(worker_name) {
            return Err(RuntimeError::lease_conflict(run_id));
        }
        run.status = WorkflowRunStatus::Succeeded;
        run.completed_at = Some(completed_at);
        run.lease_owner = None;
        run.lease_expires_at = None;
        run.updated_at = completed_at;
        Ok(())
    }

    pub fn fail_and_retry(
        &mut self,
        run_id: WorkflowRunId,
        worker_name: &str,
        detail: &str,
        observed_at: DateTime<Utc>,
    ) -> Result<WorkflowRunStatus, RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        if run.lease_owner.as_deref() != Some(worker_name) {
            return Err(RuntimeError::lease_conflict(run_id));
        }
        run.last_error = Some(detail.to_owned());
        run.lease_owner = None;
        run.lease_expires_at = None;
        run.updated_at = observed_at;
        if run.attempts >= run.max_attempts {
            run.status = WorkflowRunStatus::Failed;
        } else {
            run.status = WorkflowRunStatus::Queued;
            run.next_attempt_at = observed_at + retry_backoff(run.attempts);
        }
        Ok(run.status)
    }

    pub fn request_cancel(
        &mut self,
        run_id: WorkflowRunId,
        requested_at: DateTime<Utc>,
    ) -> Result<(), RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        if run.status.is_terminal() {
            return Ok(());
        }
        run.status = WorkflowRunStatus::CancelRequested;
        run.cancel_requested_at = Some(requested_at);
        run.updated_at = requested_at;
        self.audit_log.push(RuntimeAuditRecord {
            tenant_id: run.tenant_id,
            workflow_run_id: run.workflow_run_id,
            action: "runtime.cancel_requested".to_owned(),
            recorded_at: requested_at,
        });
        Ok(())
    }

    pub fn finalize_cancelled(
        &mut self,
        run_id: WorkflowRunId,
        cancelled_at: DateTime<Utc>,
    ) -> Result<(), RuntimeError> {
        let run = self
            .runs
            .get_mut(&run_id)
            .ok_or(RuntimeError::run_not_found(run_id))?;
        run.status = WorkflowRunStatus::Cancelled;
        run.completed_at = Some(cancelled_at);
        run.lease_owner = None;
        run.lease_expires_at = None;
        run.updated_at = cancelled_at;
        self.audit_log.push(RuntimeAuditRecord {
            tenant_id: run.tenant_id,
            workflow_run_id: run.workflow_run_id,
            action: "runtime.cancelled".to_owned(),
            recorded_at: cancelled_at,
        });
        Ok(())
    }

    pub fn mark_timed_out_runs(&mut self, now: DateTime<Utc>) -> usize {
        let mut count = 0;
        for run in self.runs.values_mut() {
            if !run.status.is_terminal()
                && run.cancel_requested_at.is_none()
                && run.deadline_at <= now
            {
                run.status = WorkflowRunStatus::TimedOut;
                run.completed_at = Some(now);
                run.lease_owner = None;
                run.lease_expires_at = None;
                run.updated_at = now;
                self.audit_log.push(RuntimeAuditRecord {
                    tenant_id: run.tenant_id,
                    workflow_run_id: run.workflow_run_id,
                    action: "runtime.timed_out".to_owned(),
                    recorded_at: now,
                });
                count += 1;
            }
        }
        count
    }

    #[must_use]
    pub fn run(&self, run_id: WorkflowRunId) -> Option<&WorkflowRun> {
        self.runs.get(&run_id)
    }

    #[must_use]
    pub fn physical_artifact_count(&self) -> usize {
        self.artifacts_by_hash.len()
    }

    #[must_use]
    pub fn run_artifact_count(&self, run_id: WorkflowRunId) -> usize {
        self.run_artifacts.get(&run_id).map_or(0, BTreeSet::len)
    }

    #[must_use]
    pub fn audit_log(&self) -> &[RuntimeAuditRecord] {
        &self.audit_log
    }
}

fn retry_backoff(attempts: u32) -> ChronoDuration {
    let exponent = attempts.saturating_sub(1).min(6);
    ChronoDuration::seconds(1_i64 << exponent)
}

#[cfg(test)]
mod tests {
    use super::{
        InMemoryRuntimeKernel, NewWorkflowRun, RuntimeAuditRecord, ToolRegistration,
        WorkflowRunStatus,
    };
    use chrono::{Duration as ChronoDuration, Utc};
    use quantos_auth::AuthContext;
    use quantos_core::{
        AccountId, ActorId, ContentHash, CorrelationId, RuntimeSessionId, TenantId, WorkspaceId,
    };
    use quantos_policy::{Capability, Role, RunMode};
    use quantos_storage::ArtifactManifest;
    use std::{collections::BTreeSet, time::Instant};

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
                Capability::parse(Capability::EXECUTION_OPERATE).expect("capability parses")
            ]),
        }
    }

    fn tool() -> ToolRegistration {
        ToolRegistration {
            tool_name: "research.execute".to_owned(),
            capability: Capability::parse(Capability::EXECUTION_OPERATE)
                .expect("capability parses"),
            description: "Run a deterministic research step".to_owned(),
            max_cost_units: 10_000,
            rate_limit_per_minute: 600,
            enabled: true,
        }
    }

    fn schedule_run(
        runtime_session_id: RuntimeSessionId,
        index: usize,
        now: chrono::DateTime<Utc>,
    ) -> NewWorkflowRun {
        NewWorkflowRun {
            runtime_session_id,
            tool_name: "research.execute".to_owned(),
            capability: Capability::parse(Capability::EXECUTION_OPERATE)
                .expect("capability parses"),
            workflow_kind: "research".to_owned(),
            idempotency_key: format!("run-{index}"),
            correlation_id: CorrelationId::new(),
            input_hash: ContentHash::sha256_bytes(format!("payload-{index}").as_bytes()),
            max_attempts: 3,
            deadline_at: now + ChronoDuration::minutes(10),
            cost_budget_units: 1_000,
            rate_limit_per_minute: 60,
        }
    }

    #[test]
    fn kernel_recovers_one_hundred_runs_without_duplicate_artifacts() {
        let now = Utc::now();
        let auth = auth_context();
        let mut first = InMemoryRuntimeKernel::new();
        first.register_tool(tool()).expect("tool registers");
        let session = first.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut run_ids = Vec::new();
        for index in 0..100 {
            let run = first
                .schedule_run(schedule_run(session.runtime_session_id, index, now), now)
                .expect("run schedules");
            run_ids.push(run.workflow_run_id);
        }

        let leased = first.claim_runs("worker-a", now, 100, ChronoDuration::seconds(30));
        assert_eq!(leased.len(), 100);

        for (index, lease) in leased.iter().enumerate() {
            first
                .save_checkpoint(
                    lease.run.workflow_run_id,
                    "step.execute",
                    1,
                    serde_json::json!({ "step": 1, "task": index }),
                    now,
                )
                .expect("checkpoint saves");
            let manifest = ArtifactManifest::new(
                lease.run.tenant_id,
                "application/json",
                ContentHash::sha256_bytes(format!("artifact-{index}").as_bytes()),
                "quantos-artifacts",
                16,
                now,
            );
            first
                .record_artifact(lease.run.workflow_run_id, manifest.clone(), now)
                .expect("artifact records");
        }

        let mut recovered = first.clone();
        let resumed = recovered.claim_runs(
            "worker-b",
            now + ChronoDuration::seconds(31),
            100,
            ChronoDuration::seconds(30),
        );
        assert_eq!(resumed.len(), 100);

        for (index, lease) in resumed.iter().enumerate() {
            let checkpoint = recovered
                .load_checkpoint(lease.run.workflow_run_id)
                .expect("checkpoint should exist after restart");
            assert_eq!(checkpoint.step_index, 1);
            let manifest = ArtifactManifest::new(
                lease.run.tenant_id,
                "application/json",
                ContentHash::sha256_bytes(format!("artifact-{index}").as_bytes()),
                "quantos-artifacts",
                16,
                now,
            );
            recovered
                .record_artifact(lease.run.workflow_run_id, manifest, now)
                .expect("artifact dedupe holds");
            recovered
                .complete_run(lease.run.workflow_run_id, "worker-b", now)
                .expect("run completes");
        }

        assert_eq!(recovered.physical_artifact_count(), 100);
        for run_id in run_ids {
            let run = recovered.run(run_id).expect("run exists");
            assert_eq!(run.status, WorkflowRunStatus::Succeeded);
            assert_eq!(recovered.run_artifact_count(run_id), 1);
        }
    }

    #[test]
    fn cancel_and_timeout_events_are_audited() {
        let now = Utc::now();
        let auth = auth_context();
        let mut kernel = InMemoryRuntimeKernel::new();
        kernel.register_tool(tool()).expect("tool registers");
        let session = kernel.open_session(&auth, now, now + ChronoDuration::hours(1));

        let run = kernel
            .schedule_run(schedule_run(session.runtime_session_id, 1, now), now)
            .expect("run schedules");
        kernel
            .request_cancel(run.workflow_run_id, now)
            .expect("cancel requests");
        kernel
            .finalize_cancelled(run.workflow_run_id, now)
            .expect("run cancels");

        let timed = kernel
            .schedule_run(
                NewWorkflowRun {
                    deadline_at: now - ChronoDuration::seconds(1),
                    ..schedule_run(session.runtime_session_id, 2, now)
                },
                now - ChronoDuration::seconds(2),
            )
            .expect("timed run schedules");
        assert_eq!(kernel.mark_timed_out_runs(now), 1);

        let actions = kernel
            .audit_log()
            .iter()
            .map(|entry: &RuntimeAuditRecord| entry.action.as_str())
            .collect::<Vec<_>>();
        assert!(actions.contains(&"runtime.cancel_requested"));
        assert!(actions.contains(&"runtime.cancelled"));
        assert!(actions.contains(&"runtime.timed_out"));
        assert_eq!(
            kernel
                .run(timed.workflow_run_id)
                .expect("run exists")
                .status,
            WorkflowRunStatus::TimedOut
        );
    }

    #[test]
    fn scheduling_one_hundred_runs_stays_under_budget_in_memory() {
        let now = Utc::now();
        let auth = auth_context();
        let mut kernel = InMemoryRuntimeKernel::new();
        kernel.register_tool(tool()).expect("tool registers");
        let session = kernel.open_session(&auth, now, now + ChronoDuration::hours(1));

        let started = Instant::now();
        for index in 0..100 {
            kernel
                .schedule_run(schedule_run(session.runtime_session_id, index, now), now)
                .expect("run schedules");
        }
        let claimed = kernel.claim_runs("worker", now, 100, ChronoDuration::seconds(30));

        assert_eq!(claimed.len(), 100);
        assert!(
            started.elapsed() < std::time::Duration::from_millis(200),
            "in-memory scheduling baseline should stay within the F07 budget"
        );
    }
}
