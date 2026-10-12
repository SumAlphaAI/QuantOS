//! Durable R03 orchestration. No credentials, source approvals or Engine approvals
//! are synthesized here: callers supply configured stores and reviewed policies.
use crate::{
    LeasedWorkflowRun, WorkflowRun, WorkflowRunStatus,
    pg::PgRuntimeStore,
    research::{
        ResearchArtifactRecord, ResearchCheckpointPayload, ResearchRunResult,
        ResearchWorkflowCoordinatorConfig, ResearchWorkflowError, ResearchWorkflowInput,
        build_command_metadata, dispatch_research, ensure_snapshot_allowed, prepare_research_input,
    },
    snapshot_source::SnapshotConsumerSource,
};
use chrono::{DateTime, Utc};
use quantos_core::{ActorId, TenantId, WorkflowRunId, canonical_json_bytes};
use quantos_engine_manager::EngineManager;
use quantos_storage::{
    pg::PgStorageStore, provenance::SnapshotSourcePolicy, supabase_storage::SupabaseStorageAdapter,
};
use serde_json::json;

impl PgRuntimeStore {
    /// Enqueue an authenticated page request with the same durable checkpoint
    /// as the R03 coordinator. Execution remains the research worker's job.
    pub fn enqueue_research(
        &mut self,
        input: ResearchWorkflowInput,
        at: DateTime<Utc>,
    ) -> Result<WorkflowRun, ResearchWorkflowError> {
        let (run, request) = prepare_research_input(input)?;
        Ok(self.schedule_run_with_checkpoint(&run, at, Some(&serde_json::to_value(request)?))?)
    }
}

/// Sync PostgreSQL/Storage clients must run on a multi-thread executor.
fn blocking<T>(f: impl FnOnce() -> T) -> T {
    tokio::task::block_in_place(f)
}

pub struct PgResearchArtifactRepository<'a> {
    pub runtime: &'a mut PgRuntimeStore,
    pub storage: &'a SupabaseStorageAdapter,
}

impl PgResearchArtifactRepository<'_> {
    /// Tenant and actor checks precede Storage reads. Replay verifies actual bytes.
    pub fn replay(
        &mut self,
        tenant: TenantId,
        actor: ActorId,
        run_id: WorkflowRunId,
    ) -> Result<ResearchArtifactRecord, ResearchWorkflowError> {
        let run = self
            .runtime
            .load_run(run_id)?
            .filter(|r| {
                r.tenant_id == tenant
                    && r.actor_id == actor
                    && r.status == WorkflowRunStatus::Succeeded
            })
            .ok_or(ResearchWorkflowError::InvalidResult(
                "research artifact unavailable",
            ))?;
        let cp = self
            .runtime
            .load_checkpoint(run_id)?
            .ok_or(ResearchWorkflowError::MissingCheckpoint { run_id })?;
        let record: ResearchArtifactRecord =
            serde_json::from_value(cp.payload["artifact"].clone())?;
        validate_record(&run, &record)?;
        let manifest = self
            .runtime
            .load_artifact_for_run(tenant, run_id, record.artifact_manifest.artifact_id)?
            .ok_or(ResearchWorkflowError::InvalidResult(
                "artifact binding missing",
            ))?;
        if manifest != record.artifact_manifest {
            return Err(ResearchWorkflowError::InvalidResult("manifest changed"));
        }
        if self.storage.get_artifact(&manifest)?.as_ref() != canonical_json_bytes(&record.output)? {
            return Err(ResearchWorkflowError::InvalidResult(
                "archive bytes changed",
            ));
        }
        Ok(record)
    }
}

fn validate_record(
    run: &WorkflowRun,
    r: &ResearchArtifactRecord,
) -> Result<(), ResearchWorkflowError> {
    if r.workflow_run_id != run.workflow_run_id
        || r.artifact_manifest.tenant_id != run.tenant_id
        || r.input_hash != run.input_hash
        || r.capability != run.capability.as_str()
        || r.artifact_manifest.content_hash
            != quantos_core::ContentHash::sha256_bytes(&canonical_json_bytes(&r.output)?)
    {
        return Err(ResearchWorkflowError::InvalidResult(
            "checkpoint identity or bytes mismatch",
        ));
    }
    Ok(())
}

pub struct PgResearchWorkflowCoordinator<'a> {
    runtime: &'a mut PgRuntimeStore,
    snapshot_source: SnapshotConsumerSource<'a>,
    storage: &'a SupabaseStorageAdapter,
    manager: &'a mut EngineManager,
    config: ResearchWorkflowCoordinatorConfig,
}

impl<'a> PgResearchWorkflowCoordinator<'a> {
    #[must_use]
    pub fn new(
        runtime: &'a mut PgRuntimeStore,
        snapshots: &'a mut PgStorageStore,
        policy: &'a SnapshotSourcePolicy,
        storage: &'a SupabaseStorageAdapter,
        manager: &'a mut EngineManager,
        config: ResearchWorkflowCoordinatorConfig,
    ) -> Self {
        Self {
            runtime,
            snapshot_source: SnapshotConsumerSource::Postgres(snapshots, policy),
            storage,
            manager,
            config,
        }
    }

    pub fn schedule_research_run(
        &mut self,
        input: ResearchWorkflowInput,
        at: DateTime<Utc>,
    ) -> Result<WorkflowRun, ResearchWorkflowError> {
        let (run, request) = prepare_research_input(input)?;
        Ok(self.runtime.schedule_run_with_checkpoint(
            &run,
            at,
            Some(&serde_json::to_value(request)?),
        )?)
    }

    pub async fn execute_next(
        &mut self,
        tenant: TenantId,
    ) -> Result<Option<ResearchRunResult>, ResearchWorkflowError> {
        if tokio::runtime::Handle::current().runtime_flavor()
            != tokio::runtime::RuntimeFlavor::MultiThread
        {
            return Err(ResearchWorkflowError::InvalidResult(
                "persistent coordinator requires a multi-thread executor",
            ));
        }
        let lease = blocking(|| {
            self.runtime.claim_runs_of_kind(
                tenant,
                &self.config.worker_name,
                1,
                Utc::now(),
                self.config.lease_duration,
                Some("research"),
            )
        })?
        .pop();
        let Some(lease) = lease else {
            return Ok(None);
        };
        let result = self.execute_claimed(&lease).await;
        if let Err(error) = &result
            && !matches!(error, ResearchWorkflowError::Cancelled)
        {
            // Never release another worker's lease or retry a cancellation/deadline.
            blocking(|| {
                self.runtime.mark_timed_out_runs(tenant, Utc::now())?;
                if self
                    .runtime
                    .load_run(lease.run.workflow_run_id)?
                    .is_some_and(|r| {
                        r.status == WorkflowRunStatus::Running
                            && r.lease_owner.as_deref() == Some(&lease.lease_owner)
                            && r.lease_expires_at.is_some_and(|at| at > Utc::now())
                    })
                {
                    self.runtime
                        .fail_and_retry(&lease, &error.to_string(), Utc::now())?;
                }
                Ok::<_, crate::pg::PgRuntimeError>(())
            })?;
        }
        result.map(Some)
    }

    async fn execute_claimed(
        &mut self,
        lease: &LeasedWorkflowRun,
    ) -> Result<ResearchRunResult, ResearchWorkflowError> {
        let run = &lease.run;
        let run_id = run.workflow_run_id;
        let cp = blocking(|| self.runtime.load_checkpoint(run_id))?
            .ok_or(ResearchWorkflowError::MissingCheckpoint { run_id })?;
        let request: ResearchCheckpointPayload =
            serde_json::from_value(cp.payload.get("request").unwrap_or(&cp.payload).clone())?;
        let (snapshot, rules) = self
            .snapshot_source
            .load(
                run.tenant_id,
                run.actor_id,
                quantos_core::SnapshotId::parse_str(&request.data_snapshot_id)?,
                quantos_storage::SnapshotUsage::Research,
                Utc::now(),
            )?
            .ok_or(ResearchWorkflowError::InvalidResult("snapshot unavailable"))?;
        ensure_snapshot_allowed(&snapshot, Utc::now(), &rules)?;
        let record = if let Some(prepared) = cp.payload.get("artifact") {
            let record = serde_json::from_value(prepared.clone())?;
            validate_record(run, &record)?;
            record
        } else {
            blocking(|| {
                self.runtime.save_checkpoint(
                    lease,
                    "research.dispatch",
                    1,
                    &json!({"request":request}),
                    Utc::now(),
                )
            })?;
            let mut cancel_manager = self.manager.clone();
            let dispatch =
                dispatch_research(self.manager, run, &request, &self.config.storage_bucket);
            tokio::pin!(dispatch);
            let period = std::time::Duration::from_millis(100);
            let mut poll = tokio::time::interval_at(tokio::time::Instant::now() + period, period);
            poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            let remaining = (lease.lease_expires_at.min(run.deadline_at) - Utc::now())
                .to_std()
                .map_err(|_| ResearchWorkflowError::InvalidResult("lease expired"))?;
            let timeout = tokio::time::sleep(remaining);
            tokio::pin!(timeout);
            let record = loop {
                tokio::select! {
                    biased;
                    result = &mut dispatch => break result?,
                    _ = &mut timeout => return Err(ResearchWorkflowError::InvalidResult("dispatch deadline or lease expired")),
                    _ = poll.tick() => {
                        let current = blocking(|| self.runtime.load_run(run_id))?
                            .ok_or(ResearchWorkflowError::InvalidResult("run unavailable"))?;
                        if current.status == WorkflowRunStatus::CancelRequested {
                            let response = cancel_manager.cancel_capability(&request.capability,
                                quantos_proto::quantos::engine::v1::CancelRequest {
                                    metadata: Some(build_command_metadata(run, &request.capability)),
                                    execution_id: request.execution_id.clone(), reason: "operator-request".into(),
                                }).await?;
                            if !response.cancelled { return Err(ResearchWorkflowError::CancelNotConfirmed); }
                            blocking(|| self.runtime.acknowledge_engine_cancelled(lease, Utc::now()))?;
                            return Err(ResearchWorkflowError::Cancelled);
                        }
                    }
                }
            };
            // Cancellation can race the final Engine response. Check again
            // before preparing bytes; never strand a requested cancellation.
            if blocking(|| self.runtime.load_run(run_id))?
                .is_some_and(|r| r.status == WorkflowRunStatus::CancelRequested)
            {
                let response = cancel_manager
                    .cancel_capability(
                        &request.capability,
                        quantos_proto::quantos::engine::v1::CancelRequest {
                            metadata: Some(build_command_metadata(run, &request.capability)),
                            execution_id: request.execution_id.clone(),
                            reason: "operator-request".into(),
                        },
                    )
                    .await?;
                if !response.cancelled {
                    return Err(ResearchWorkflowError::CancelNotConfirmed);
                }
                blocking(|| self.runtime.acknowledge_engine_cancelled(lease, Utc::now()))?;
                return Err(ResearchWorkflowError::Cancelled);
            }
            // Stable artifact identity/output survive a crash before/after HTTP.
            blocking(|| {
                self.runtime.save_checkpoint(
                    lease,
                    "research.prepared",
                    2,
                    &json!({"request":request,"artifact":record}),
                    Utc::now(),
                )
            })?;
            record
        };
        let manifest = &record.artifact_manifest.clone();
        blocking(|| {
            // Create-only upload. Ambiguous/duplicate responses are reconciled by
            // reading and comparing bytes, never by deleting or overwriting objects.
            let bytes = canonical_json_bytes(&record.output)?;
            self.storage
                .put_artifact_immutable(manifest, bytes.into())?;
            self.runtime.record_artifact(lease, manifest, Utc::now())?;
            let actual = self
                .runtime
                .load_artifact_for_run(
                    run.tenant_id,
                    run_id,
                    // Rebinding existing content can return an earlier artifact ID.
                    // R03 outputs include workflow_run_id, so cross-run aliases are rejected.
                    manifest.artifact_id,
                )?
                .ok_or(ResearchWorkflowError::InvalidResult(
                    "artifact identity conflict",
                ))?;
            if actual != *manifest {
                return Err(ResearchWorkflowError::InvalidResult(
                    "artifact metadata conflict",
                ));
            }
            self.runtime.save_checkpoint(
                lease,
                "research.completed",
                3,
                &json!({"request":request,"artifact":record}),
                Utc::now(),
            )?;
            self.runtime.complete_run(lease, Utc::now())?;
            let run = self
                .runtime
                .load_run(run_id)?
                .ok_or(ResearchWorkflowError::InvalidResult("run missing"))?;
            Ok(ResearchRunResult {
                run,
                artifact: record,
            })
        })
    }
}
