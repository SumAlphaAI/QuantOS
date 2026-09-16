use std::collections::BTreeMap;

use chrono::{DateTime, Duration as ChronoDuration, TimeZone, Utc};
use pbjson_types::{ListValue, Struct, Timestamp, Value as ProtoValue, value::Kind};
use quantos_core::{ContentHash, CoreError, CorrelationId, SnapshotId, canonical_json_bytes};
use quantos_engine_manager::{EngineManager, EngineManagerError};
use quantos_proto::quantos::{
    common::v1::{ActorRef, CommandMetadata, JsonDocument},
    engine::v1::{ExecuteRequest, StreamExecuteRequest},
};
use quantos_storage::{
    ArtifactManifest, DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotGateViolation,
    SnapshotQualityGate, SnapshotQualityRuleset, SnapshotUsage,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use thiserror::Error;

use crate::{InMemoryRuntimeKernel, LeasedWorkflowRun, NewWorkflowRun, RuntimeError, WorkflowRun};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignalProposalWorkflowInput {
    pub runtime_session_id: quantos_core::RuntimeSessionId,
    pub tool_name: String,
    pub capability: quantos_policy::Capability,
    pub workflow_kind: String,
    pub idempotency_key: String,
    pub correlation_id: CorrelationId,
    pub feature_snapshot_id: SnapshotId,
    pub policy_context_ref: String,
    pub data_query_input_schema_version: Option<String>,
    pub data_query_input: Option<Value>,
    pub provided_data_query: Option<Value>,
    pub signal_input_schema_version: String,
    pub signal_input: Value,
    pub provided_signal: Option<Value>,
    pub proposal_input_schema_version: String,
    pub proposal_input: Value,
    pub max_attempts: u32,
    pub deadline_at: DateTime<Utc>,
    pub cost_budget_units: u64,
    pub rate_limit_per_minute: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowEvidenceRecord {
    pub evidence_id: String,
    pub artifact_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowStreamEvent {
    pub sequence_id: String,
    pub done: bool,
    pub emitted_at: Option<DateTime<Utc>>,
    pub delta: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataQueryRecord {
    pub workflow_run_id: quantos_core::WorkflowRunId,
    pub artifact_manifest: ArtifactManifest,
    pub auxiliary_artifact_manifests: Vec<ArtifactManifest>,
    pub capability: String,
    pub provider: String,
    pub dataset: String,
    pub schema_ref: String,
    pub response_hash: ContentHash,
    pub trading_approved: bool,
    pub engine_artifact_ids: Vec<String>,
    pub output: Value,
    pub evidence_refs: Vec<WorkflowEvidenceRecord>,
    pub stream_events: Vec<WorkflowStreamEvent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignalRecord {
    pub workflow_run_id: quantos_core::WorkflowRunId,
    pub artifact_manifest: ArtifactManifest,
    pub auxiliary_artifact_manifests: Vec<ArtifactManifest>,
    pub engine_artifact_id: String,
    pub data_snapshot_id: SnapshotId,
    pub capability: String,
    pub signal_id: String,
    pub strategy_release_id: String,
    pub symbol: String,
    pub valid_until: DateTime<Utc>,
    pub input_hash: ContentHash,
    pub output: Value,
    pub evidence_refs: Vec<WorkflowEvidenceRecord>,
    pub stream_events: Vec<WorkflowStreamEvent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TradeProposalRecord {
    pub workflow_run_id: quantos_core::WorkflowRunId,
    pub artifact_manifest: ArtifactManifest,
    pub auxiliary_artifact_manifests: Vec<ArtifactManifest>,
    pub capability: String,
    pub proposal_id: String,
    pub account_id: String,
    pub symbol: String,
    pub signal_id: String,
    pub signal_artifact_id: quantos_core::ArtifactId,
    pub executable: bool,
    pub expires_at: DateTime<Utc>,
    pub evidence_refs: Vec<WorkflowEvidenceRecord>,
    pub counter_views: Vec<String>,
    pub engine_artifact_ids: Vec<String>,
    pub output: Value,
    pub stream_events: Vec<WorkflowStreamEvent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SignalProposalRunResult {
    pub run: WorkflowRun,
    pub data_query: Option<DataQueryRecord>,
    pub signal: SignalRecord,
    pub proposal: TradeProposalRecord,
}

#[derive(Debug, Default, Clone)]
pub struct InMemorySignalProposalRepository {
    signals_by_hash: BTreeMap<(quantos_core::TenantId, ContentHash), SignalRecord>,
    signal_hash_by_run: BTreeMap<quantos_core::WorkflowRunId, ContentHash>,
    proposals_by_hash: BTreeMap<(quantos_core::TenantId, ContentHash), TradeProposalRecord>,
    proposal_hash_by_run: BTreeMap<quantos_core::WorkflowRunId, ContentHash>,
}

impl InMemorySignalProposalRepository {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn upsert_signal(&mut self, record: SignalRecord) -> &SignalRecord {
        let key = (
            record.artifact_manifest.tenant_id,
            record.artifact_manifest.content_hash.clone(),
        );
        let run_id = record.workflow_run_id;
        let stored = self.signals_by_hash.entry(key).or_insert(record);
        self.signal_hash_by_run
            .insert(run_id, stored.artifact_manifest.content_hash.clone());
        stored
    }

    pub fn upsert_proposal(&mut self, record: TradeProposalRecord) -> &TradeProposalRecord {
        let key = (
            record.artifact_manifest.tenant_id,
            record.artifact_manifest.content_hash.clone(),
        );
        let run_id = record.workflow_run_id;
        let stored = self.proposals_by_hash.entry(key).or_insert(record);
        self.proposal_hash_by_run
            .insert(run_id, stored.artifact_manifest.content_hash.clone());
        stored
    }

    #[must_use]
    pub fn signal_for_run(&self, run_id: quantos_core::WorkflowRunId) -> Option<&SignalRecord> {
        let hash = self.signal_hash_by_run.get(&run_id)?;
        self.signals_by_hash
            .values()
            .find(|record| &record.artifact_manifest.content_hash == hash)
    }

    #[must_use]
    pub fn proposal_for_run(
        &self,
        run_id: quantos_core::WorkflowRunId,
    ) -> Option<&TradeProposalRecord> {
        let hash = self.proposal_hash_by_run.get(&run_id)?;
        self.proposals_by_hash
            .values()
            .find(|record| &record.artifact_manifest.content_hash == hash)
    }

    #[must_use]
    pub fn physical_signal_count(&self) -> usize {
        self.signals_by_hash.len()
    }

    #[must_use]
    pub fn physical_proposal_count(&self) -> usize {
        self.proposals_by_hash.len()
    }
}

pub struct SignalProposalSchemaValidator;

impl SignalProposalSchemaValidator {
    pub fn validate_data_query(value: &Value) -> Result<(), SignalProposalWorkflowError> {
        let _ = ParsedDataQuery::try_from(value)?;
        Ok(())
    }

    pub fn validate_signal(value: &Value) -> Result<(), SignalProposalWorkflowError> {
        let _ = ParsedSignal::try_from(value)?;
        Ok(())
    }

    pub fn validate_proposal(value: &Value) -> Result<(), SignalProposalWorkflowError> {
        let _ = ParsedTradeProposal::try_from(value)?;
        Ok(())
    }
}

pub struct TradeProposalEvaluationGate;

impl TradeProposalEvaluationGate {
    pub fn ensure_evaluable(
        proposal: &TradeProposalRecord,
        observed_at: DateTime<Utc>,
    ) -> Result<(), SignalProposalWorkflowError> {
        if proposal.expires_at <= observed_at {
            return Err(SignalProposalWorkflowError::ProposalExpired {
                proposal_id: proposal.proposal_id.clone(),
                expires_at: proposal.expires_at,
                observed_at,
            });
        }
        Ok(())
    }
}

#[derive(Debug, Error)]
pub enum SignalProposalWorkflowError {
    #[error(transparent)]
    Runtime(#[from] RuntimeError),
    #[error(transparent)]
    Engine(#[from] EngineManagerError),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("SIGNAL_PROPOSAL_SNAPSHOT_NOT_FOUND: snapshot `{snapshot_id}` is not available")]
    SnapshotNotFound { snapshot_id: SnapshotId },
    #[error("SIGNAL_PROPOSAL_SNAPSHOT_GATE_REJECTED: {details}")]
    SnapshotGateRejected { details: String },
    #[error("SIGNAL_PROPOSAL_CHECKPOINT_MISSING: workflow run `{run_id}` is missing a checkpoint")]
    MissingCheckpoint { run_id: quantos_core::WorkflowRunId },
    #[error("SIGNAL_OUTPUT_MISSING: engine did not return a final signal document")]
    MissingSignalOutput,
    #[error("DATA_QUERY_OUTPUT_MISSING: engine did not return a final data query document")]
    MissingDataQueryOutput,
    #[error("SIGNAL_ARTIFACT_REF_MISSING: engine did not return a signal artifact reference")]
    MissingSignalArtifactRef,
    #[error("PROPOSAL_OUTPUT_MISSING: engine did not return a final proposal document")]
    MissingProposalOutput,
    #[error("DATA_QUERY_SCHEMA_INVALID: {detail}")]
    InvalidDataQuery { detail: String },
    #[error("SIGNAL_SCHEMA_INVALID: {detail}")]
    InvalidSignal { detail: String },
    #[error("PROPOSAL_SCHEMA_INVALID: {detail}")]
    InvalidProposal { detail: String },
    #[error(
        "PROPOSAL_EXPIRED: proposal `{proposal_id}` expired at {expires_at} before {observed_at}"
    )]
    ProposalExpired {
        proposal_id: String,
        expires_at: DateTime<Utc>,
        observed_at: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct SignalProposalCheckpointPayload {
    feature_snapshot_id: String,
    policy_context_ref: String,
    data_query_input_schema_version: Option<String>,
    data_query_input: Option<Value>,
    provided_data_query: Option<Value>,
    signal_input_schema_version: String,
    signal_input: Value,
    provided_signal: Option<Value>,
    proposal_input_schema_version: String,
    proposal_input: Value,
}

pub struct SignalProposalWorkflowCoordinator<'a> {
    runtime: &'a mut InMemoryRuntimeKernel,
    snapshots: &'a InMemoryDataSnapshotCatalog,
    quality_rules: &'a SnapshotQualityRuleset,
    repository: &'a mut InMemorySignalProposalRepository,
    engine_manager: &'a mut EngineManager,
    worker_name: String,
    lease_duration: ChronoDuration,
    storage_bucket: String,
    data_query_capability: String,
    signal_capability: String,
    proposal_capability: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignalProposalWorkflowCoordinatorConfig {
    pub worker_name: String,
    pub lease_duration: ChronoDuration,
    pub storage_bucket: String,
    pub data_query_capability: String,
    pub signal_capability: String,
    pub proposal_capability: String,
}

impl<'a> SignalProposalWorkflowCoordinator<'a> {
    #[must_use]
    pub fn new(
        runtime: &'a mut InMemoryRuntimeKernel,
        snapshots: &'a InMemoryDataSnapshotCatalog,
        quality_rules: &'a SnapshotQualityRuleset,
        repository: &'a mut InMemorySignalProposalRepository,
        engine_manager: &'a mut EngineManager,
        config: SignalProposalWorkflowCoordinatorConfig,
    ) -> Self {
        Self {
            runtime,
            snapshots,
            quality_rules,
            repository,
            engine_manager,
            worker_name: config.worker_name,
            lease_duration: config.lease_duration,
            storage_bucket: config.storage_bucket,
            data_query_capability: config.data_query_capability,
            signal_capability: config.signal_capability,
            proposal_capability: config.proposal_capability,
        }
    }

    pub fn schedule_workflow_run(
        &mut self,
        input: SignalProposalWorkflowInput,
        queued_at: DateTime<Utc>,
    ) -> Result<WorkflowRun, SignalProposalWorkflowError> {
        let input_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "feature_snapshot_id": input.feature_snapshot_id.to_string(),
            "data_query_input_schema_version": input.data_query_input_schema_version,
            "data_query_input": input.data_query_input,
            "provided_data_query": input.provided_data_query,
            "signal_input_schema_version": input.signal_input_schema_version,
            "signal_input": input.signal_input,
            "provided_signal": input.provided_signal,
            "proposal_input_schema_version": input.proposal_input_schema_version,
            "proposal_input": input.proposal_input,
        }))?);
        let new_run = NewWorkflowRun {
            runtime_session_id: input.runtime_session_id,
            tool_name: input.tool_name,
            capability: input.capability,
            workflow_kind: input.workflow_kind,
            idempotency_key: input.idempotency_key,
            correlation_id: input.correlation_id,
            input_hash,
            max_attempts: input.max_attempts,
            deadline_at: input.deadline_at,
            cost_budget_units: input.cost_budget_units,
            rate_limit_per_minute: input.rate_limit_per_minute,
        };
        let run = self.runtime.schedule_run(new_run, queued_at)?;
        let checkpoint = SignalProposalCheckpointPayload {
            feature_snapshot_id: input.feature_snapshot_id.to_string(),
            policy_context_ref: input.policy_context_ref,
            data_query_input_schema_version: input.data_query_input_schema_version,
            data_query_input: input.data_query_input,
            provided_data_query: input.provided_data_query,
            signal_input_schema_version: input.signal_input_schema_version,
            signal_input: input.signal_input,
            provided_signal: input.provided_signal,
            proposal_input_schema_version: input.proposal_input_schema_version,
            proposal_input: input.proposal_input,
        };
        self.runtime.save_checkpoint(
            run.workflow_run_id,
            "signal_proposal.request",
            0,
            serde_json::to_value(checkpoint)?,
            queued_at,
        )?;
        Ok(run)
    }

    pub async fn execute_next(
        &mut self,
        observed_at: DateTime<Utc>,
    ) -> Result<Option<SignalProposalRunResult>, SignalProposalWorkflowError> {
        let Some(lease) = self
            .runtime
            .claim_runs(&self.worker_name, observed_at, 1, self.lease_duration)
            .into_iter()
            .next()
        else {
            return Ok(None);
        };

        Ok(Some(self.execute_claimed_run(lease, observed_at).await?))
    }

    async fn execute_claimed_run(
        &mut self,
        lease: LeasedWorkflowRun,
        observed_at: DateTime<Utc>,
    ) -> Result<SignalProposalRunResult, SignalProposalWorkflowError> {
        let run_id = lease.run.workflow_run_id;
        let checkpoint = self
            .runtime
            .load_checkpoint(run_id)
            .cloned()
            .ok_or(SignalProposalWorkflowError::MissingCheckpoint { run_id })?;
        let payload: SignalProposalCheckpointPayload =
            serde_json::from_value(checkpoint.payload.clone())?;
        let snapshot_id = SnapshotId::parse_str(&payload.feature_snapshot_id)?;
        let snapshot = self
            .snapshots
            .get(lease.run.tenant_id, snapshot_id)
            .cloned()
            .ok_or(SignalProposalWorkflowError::SnapshotNotFound { snapshot_id })?;
        ensure_snapshot_allowed(&snapshot, observed_at, self.quality_rules)?;

        self.runtime.save_checkpoint(
            run_id,
            "signal_proposal.dispatch",
            1,
            serde_json::to_value(&payload)?,
            observed_at,
        )?;

        let (data_query_record, data_query_payload_value) = match payload
            .provided_data_query
            .clone()
        {
            Some(data_query_value) => {
                let data_query_record = self.build_provided_data_query_record(
                    &lease.run,
                    snapshot.snapshot_id,
                    data_query_value,
                )?;
                let data_query_output = data_query_record.output.clone();
                self.runtime.save_checkpoint(
                    run_id,
                    "signal_proposal.data_query_ready",
                    2,
                    json!({
                        "data_query_artifact_id": data_query_record.artifact_manifest.artifact_id.to_string(),
                        "dataset": data_query_record.dataset,
                        "provider": data_query_record.provider,
                    }),
                    data_query_record.created_at,
                )?;
                (Some(data_query_record), Some(data_query_output))
            }
            None => match (
                payload.data_query_input_schema_version.as_deref(),
                payload.data_query_input.as_ref(),
            ) {
                (Some(schema_version), Some(data_query_input)) => {
                    let data_query_execute_request = build_engine_execute_request(
                        &lease.run,
                        &self.data_query_capability,
                        schema_version,
                        &payload.feature_snapshot_id,
                        &payload.policy_context_ref,
                        data_query_input,
                        "data-query",
                    );
                    let data_query_stream = match self
                        .engine_manager
                        .stream_execute_collect(
                            &self.data_query_capability,
                            StreamExecuteRequest {
                                request: Some(data_query_execute_request.clone()),
                            },
                        )
                        .await
                    {
                        Ok(messages) => messages,
                        Err(error) => {
                            let _ = self.runtime.fail_and_retry(
                                run_id,
                                &self.worker_name,
                                error.to_string().as_str(),
                                observed_at,
                            )?;
                            return Err(error.into());
                        }
                    };
                    let data_query_execute = match self
                        .engine_manager
                        .execute(&self.data_query_capability, data_query_execute_request)
                        .await
                    {
                        Ok(response) => response,
                        Err(error) => {
                            let _ = self.runtime.fail_and_retry(
                                run_id,
                                &self.worker_name,
                                error.to_string().as_str(),
                                observed_at,
                            )?;
                            return Err(error.into());
                        }
                    };
                    let data_query_output = json_document_to_value(
                        data_query_execute
                            .output
                            .as_ref()
                            .ok_or(SignalProposalWorkflowError::MissingDataQueryOutput)?,
                    )?;
                    let data_query_record = self.build_engine_data_query_record(
                        &lease.run,
                        snapshot.snapshot_id,
                        data_query_output.clone(),
                        &data_query_execute,
                        &data_query_stream,
                        observed_at,
                    )?;
                    self.runtime.save_checkpoint(
                        run_id,
                        "signal_proposal.data_query_ready",
                        2,
                        json!({
                            "data_query_artifact_id": data_query_record.artifact_manifest.artifact_id.to_string(),
                            "dataset": data_query_record.dataset,
                            "provider": data_query_record.provider,
                            "engine_artifact_ids": data_query_record.engine_artifact_ids,
                        }),
                        data_query_record.created_at,
                    )?;
                    (Some(data_query_record), Some(data_query_output))
                }
                _ => (None, None),
            },
        };

        let signal_input = match data_query_payload_value.as_ref() {
            Some(data_query_payload) => inject_named_object(
                payload.signal_input.clone(),
                "data_query",
                data_query_payload.clone(),
            )?,
            None => payload.signal_input.clone(),
        };

        let (signal_record, signal_payload_value) = match payload.provided_signal.clone() {
            Some(signal_value) => {
                let signal_record = self.build_provided_signal_record(
                    &lease.run,
                    snapshot.snapshot_id,
                    signal_value,
                )?;
                let signal_output = signal_record.output.clone();
                let signal_record = self.repository.upsert_signal(signal_record).clone();
                (signal_record, signal_output)
            }
            None => {
                let signal_execute_request = build_engine_execute_request(
                    &lease.run,
                    &self.signal_capability,
                    &payload.signal_input_schema_version,
                    &payload.feature_snapshot_id,
                    &payload.policy_context_ref,
                    &signal_input,
                    "signal",
                );
                let signal_stream = match self
                    .engine_manager
                    .stream_execute_collect(
                        &self.signal_capability,
                        StreamExecuteRequest {
                            request: Some(signal_execute_request.clone()),
                        },
                    )
                    .await
                {
                    Ok(messages) => messages,
                    Err(error) => {
                        let _ = self.runtime.fail_and_retry(
                            run_id,
                            &self.worker_name,
                            error.to_string().as_str(),
                            observed_at,
                        )?;
                        return Err(error.into());
                    }
                };
                let signal_execute = match self
                    .engine_manager
                    .execute(&self.signal_capability, signal_execute_request)
                    .await
                {
                    Ok(response) => response,
                    Err(error) => {
                        let _ = self.runtime.fail_and_retry(
                            run_id,
                            &self.worker_name,
                            error.to_string().as_str(),
                            observed_at,
                        )?;
                        return Err(error.into());
                    }
                };
                let signal_output = json_document_to_value(
                    signal_execute
                        .output
                        .as_ref()
                        .ok_or(SignalProposalWorkflowError::MissingSignalOutput)?,
                )?;
                let signal_record = self.build_engine_signal_record(
                    &lease.run,
                    snapshot.snapshot_id,
                    signal_output.clone(),
                    &signal_execute,
                    &signal_stream,
                    observed_at,
                )?;
                let signal_record = self.repository.upsert_signal(signal_record).clone();
                self.runtime.save_checkpoint(
                    run_id,
                    "signal_proposal.signal_ready",
                    3,
                    json!({
                        "signal_artifact_id": signal_record.artifact_manifest.artifact_id.to_string(),
                        "signal_id": signal_record.signal_id,
                        "valid_until": signal_record.valid_until.to_rfc3339(),
                    }),
                    signal_record.created_at,
                )?;
                (signal_record, signal_output)
            }
        };

        let proposal_input = inject_signal(payload.proposal_input.clone(), signal_payload_value)?;
        let proposal_input = match data_query_payload_value {
            Some(data_query_payload) => {
                inject_named_object(proposal_input, "data_query", data_query_payload)?
            }
            None => proposal_input,
        };
        let proposal_execute_request = build_engine_execute_request(
            &lease.run,
            &self.proposal_capability,
            &payload.proposal_input_schema_version,
            &payload.feature_snapshot_id,
            &payload.policy_context_ref,
            &proposal_input,
            "proposal",
        );
        let proposal_stream = match self
            .engine_manager
            .stream_execute_collect(
                &self.proposal_capability,
                StreamExecuteRequest {
                    request: Some(proposal_execute_request.clone()),
                },
            )
            .await
        {
            Ok(messages) => messages,
            Err(error) => {
                let _ = self.runtime.fail_and_retry(
                    run_id,
                    &self.worker_name,
                    error.to_string().as_str(),
                    observed_at,
                )?;
                return Err(error.into());
            }
        };
        let proposal_execute = match self
            .engine_manager
            .execute(&self.proposal_capability, proposal_execute_request)
            .await
        {
            Ok(response) => response,
            Err(error) => {
                let _ = self.runtime.fail_and_retry(
                    run_id,
                    &self.worker_name,
                    error.to_string().as_str(),
                    observed_at,
                )?;
                return Err(error.into());
            }
        };
        let proposal_output = json_document_to_value(
            proposal_execute
                .output
                .as_ref()
                .ok_or(SignalProposalWorkflowError::MissingProposalOutput)?,
        )?;
        let proposal_record = self.build_proposal_record(
            &lease.run,
            &signal_record,
            proposal_output,
            &proposal_execute,
            &proposal_stream,
            observed_at,
        )?;
        let proposal_record = self.repository.upsert_proposal(proposal_record).clone();

        self.runtime.save_checkpoint(
            run_id,
            "signal_proposal.completed",
            4,
            json!({
                "data_query_artifact_id": data_query_record.as_ref().map(|record| record.artifact_manifest.artifact_id.to_string()),
                "signal_artifact_id": signal_record.artifact_manifest.artifact_id.to_string(),
                "proposal_artifact_id": proposal_record.artifact_manifest.artifact_id.to_string(),
                "proposal_id": proposal_record.proposal_id,
                "counter_views": proposal_record.counter_views,
                "engine_artifact_ids": proposal_record.engine_artifact_ids,
            }),
            proposal_record.created_at,
        )?;
        self.runtime
            .complete_run(run_id, &self.worker_name, proposal_record.created_at)?;
        let run = self
            .runtime
            .run(run_id)
            .cloned()
            .ok_or(RuntimeError::run_not_found(run_id))?;
        Ok(SignalProposalRunResult {
            run,
            data_query: data_query_record,
            signal: signal_record,
            proposal: proposal_record,
        })
    }

    fn build_provided_data_query_record(
        &mut self,
        run: &WorkflowRun,
        snapshot_id: SnapshotId,
        data_query_output: Value,
    ) -> Result<DataQueryRecord, SignalProposalWorkflowError> {
        SignalProposalSchemaValidator::validate_data_query(&data_query_output)?;
        let parsed = ParsedDataQuery::try_from(&data_query_output)?;
        let completed_at = run.created_at;
        let output_bytes = canonical_json_bytes(&data_query_output)?;
        let content_hash = ContentHash::sha256_bytes(&output_bytes);
        let manifest = ArtifactManifest::new(
            run.tenant_id,
            "application/json",
            content_hash,
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
        .with_metadata("data_snapshot_id", snapshot_id.to_string())
        .with_metadata("capability", self.data_query_capability.as_str())
        .with_metadata("data_query_source", "provided_input")
        .with_metadata("dataset", parsed.dataset.as_str())
        .with_metadata("provider", parsed.provider.as_str());
        let stored_manifest =
            self.runtime
                .record_artifact(run.workflow_run_id, manifest, completed_at)?;

        Ok(DataQueryRecord {
            workflow_run_id: run.workflow_run_id,
            artifact_manifest: stored_manifest,
            auxiliary_artifact_manifests: vec![],
            capability: self.data_query_capability.clone(),
            provider: parsed.provider,
            dataset: parsed.dataset,
            schema_ref: parsed.schema_ref,
            response_hash: parsed.response_hash,
            trading_approved: parsed.trading_approved,
            engine_artifact_ids: vec!["provided-data-query".to_owned()],
            output: data_query_output,
            evidence_refs: parsed.evidence_refs,
            stream_events: vec![],
            created_at: completed_at,
        })
    }

    fn build_engine_data_query_record(
        &mut self,
        run: &WorkflowRun,
        snapshot_id: SnapshotId,
        data_query_output: Value,
        execute: &quantos_proto::quantos::engine::v1::ExecuteResponse,
        stream: &[quantos_proto::quantos::engine::v1::StreamExecuteResponse],
        observed_at: DateTime<Utc>,
    ) -> Result<DataQueryRecord, SignalProposalWorkflowError> {
        SignalProposalSchemaValidator::validate_data_query(&data_query_output)?;
        let parsed = ParsedDataQuery::try_from(&data_query_output)?;
        let completed_at =
            timestamp_to_datetime(execute.completed_at.as_ref()).unwrap_or(observed_at);
        let output_bytes = canonical_json_bytes(&data_query_output)?;
        let content_hash = ContentHash::sha256_bytes(&output_bytes);
        let manifest = ArtifactManifest::new(
            run.tenant_id,
            "application/json",
            content_hash,
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
        .with_metadata("data_snapshot_id", snapshot_id.to_string())
        .with_metadata("capability", self.data_query_capability.as_str())
        .with_metadata("dataset", parsed.dataset.as_str())
        .with_metadata("provider", parsed.provider.as_str())
        .with_metadata("response_hash", parsed.response_hash.as_str());
        let stored_manifest =
            self.runtime
                .record_artifact(run.workflow_run_id, manifest, completed_at)?;
        let data_query_capability = self.data_query_capability.clone();
        let auxiliary_artifact_manifests = self.record_engine_artifact_manifests(
            run,
            snapshot_id,
            data_query_capability.as_str(),
            &execute.artifact_refs,
            completed_at,
        )?;

        Ok(DataQueryRecord {
            workflow_run_id: run.workflow_run_id,
            artifact_manifest: stored_manifest,
            auxiliary_artifact_manifests,
            capability: self.data_query_capability.clone(),
            provider: parsed.provider,
            dataset: parsed.dataset,
            schema_ref: parsed.schema_ref,
            response_hash: parsed.response_hash,
            trading_approved: parsed.trading_approved,
            engine_artifact_ids: execute
                .artifact_refs
                .iter()
                .map(|artifact| artifact.artifact_id.clone())
                .collect(),
            output: data_query_output,
            evidence_refs: parsed.evidence_refs,
            stream_events: stream
                .iter()
                .map(stream_event_from_proto)
                .collect::<Result<Vec<_>, _>>()?,
            created_at: completed_at,
        })
    }

    fn build_provided_signal_record(
        &mut self,
        run: &WorkflowRun,
        snapshot_id: SnapshotId,
        signal_output: Value,
    ) -> Result<SignalRecord, SignalProposalWorkflowError> {
        SignalProposalSchemaValidator::validate_signal(&signal_output)?;
        let parsed = ParsedSignal::try_from(&signal_output)?;
        let completed_at = parsed.generated_at;
        let output_bytes = canonical_json_bytes(&signal_output)?;
        let content_hash = ContentHash::sha256_bytes(&output_bytes);
        let manifest = ArtifactManifest::new(
            run.tenant_id,
            "application/json",
            content_hash,
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
        .with_metadata("data_snapshot_id", snapshot_id.to_string())
        .with_metadata("capability", self.signal_capability.as_str())
        .with_metadata("signal_source", "provided_input");
        let stored_manifest =
            self.runtime
                .record_artifact(run.workflow_run_id, manifest, completed_at)?;

        Ok(SignalRecord {
            workflow_run_id: run.workflow_run_id,
            artifact_manifest: stored_manifest,
            auxiliary_artifact_manifests: vec![],
            engine_artifact_id: "provided-signal".to_owned(),
            data_snapshot_id: snapshot_id,
            capability: self.signal_capability.clone(),
            signal_id: parsed.signal_id,
            strategy_release_id: parsed.strategy_release_id,
            symbol: parsed.symbol,
            valid_until: parsed.valid_until,
            input_hash: run.input_hash.clone(),
            output: signal_output,
            evidence_refs: parsed.evidence_refs,
            stream_events: vec![],
            created_at: completed_at,
        })
    }

    fn build_engine_signal_record(
        &mut self,
        run: &WorkflowRun,
        snapshot_id: SnapshotId,
        signal_output: Value,
        execute: &quantos_proto::quantos::engine::v1::ExecuteResponse,
        stream: &[quantos_proto::quantos::engine::v1::StreamExecuteResponse],
        observed_at: DateTime<Utc>,
    ) -> Result<SignalRecord, SignalProposalWorkflowError> {
        SignalProposalSchemaValidator::validate_signal(&signal_output)?;
        let parsed = ParsedSignal::try_from(&signal_output)?;
        let completed_at =
            timestamp_to_datetime(execute.completed_at.as_ref()).unwrap_or(observed_at);
        let output_bytes = canonical_json_bytes(&signal_output)?;
        let artifact_ref = execute
            .artifact_refs
            .first()
            .ok_or(SignalProposalWorkflowError::MissingSignalArtifactRef)?;
        let content_hash = if artifact_ref.sha256.trim().is_empty() {
            ContentHash::sha256_bytes(&output_bytes)
        } else {
            ContentHash::parse(artifact_ref.sha256.as_str())?
        };
        let manifest = ArtifactManifest::new(
            run.tenant_id,
            artifact_ref.media_type.as_str(),
            content_hash,
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
        .with_metadata("data_snapshot_id", snapshot_id.to_string())
        .with_metadata("capability", self.signal_capability.as_str())
        .with_metadata("engine_artifact_id", artifact_ref.artifact_id.as_str())
        .with_metadata("engine_artifact_uri", artifact_ref.uri.as_str());
        let stored_manifest =
            self.runtime
                .record_artifact(run.workflow_run_id, manifest, completed_at)?;
        let signal_capability = self.signal_capability.clone();
        let auxiliary_artifact_manifests = self.record_engine_artifact_manifests(
            run,
            snapshot_id,
            signal_capability.as_str(),
            &execute.artifact_refs[1..],
            completed_at,
        )?;

        Ok(SignalRecord {
            workflow_run_id: run.workflow_run_id,
            artifact_manifest: stored_manifest,
            auxiliary_artifact_manifests,
            engine_artifact_id: artifact_ref.artifact_id.clone(),
            data_snapshot_id: snapshot_id,
            capability: self.signal_capability.clone(),
            signal_id: parsed.signal_id,
            strategy_release_id: parsed.strategy_release_id,
            symbol: parsed.symbol,
            valid_until: parsed.valid_until,
            input_hash: run.input_hash.clone(),
            output: signal_output,
            evidence_refs: parsed.evidence_refs,
            stream_events: stream
                .iter()
                .map(stream_event_from_proto)
                .collect::<Result<Vec<_>, _>>()?,
            created_at: completed_at,
        })
    }

    fn build_proposal_record(
        &mut self,
        run: &WorkflowRun,
        signal_record: &SignalRecord,
        proposal_output: Value,
        execute: &quantos_proto::quantos::engine::v1::ExecuteResponse,
        stream: &[quantos_proto::quantos::engine::v1::StreamExecuteResponse],
        observed_at: DateTime<Utc>,
    ) -> Result<TradeProposalRecord, SignalProposalWorkflowError> {
        SignalProposalSchemaValidator::validate_proposal(&proposal_output)?;
        let parsed = ParsedTradeProposal::try_from(&proposal_output)?;
        if parsed.signal_id != signal_record.signal_id {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: format!(
                    "proposal signal_id `{}` does not match signal `{}`",
                    parsed.signal_id, signal_record.signal_id
                ),
            });
        }
        if parsed.expires_at > signal_record.valid_until {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: format!(
                    "proposal expires_at `{}` exceeds signal valid_until `{}`",
                    parsed.expires_at, signal_record.valid_until
                ),
            });
        }
        let completed_at =
            timestamp_to_datetime(execute.completed_at.as_ref()).unwrap_or(observed_at);
        let output_bytes = canonical_json_bytes(&proposal_output)?;
        let content_hash = ContentHash::sha256_bytes(&output_bytes);
        let manifest = ArtifactManifest::new(
            run.tenant_id,
            "application/json",
            content_hash,
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
        .with_metadata(
            "data_snapshot_id",
            signal_record.data_snapshot_id.to_string(),
        )
        .with_metadata("capability", self.proposal_capability.as_str())
        .with_metadata(
            "signal_artifact_id",
            signal_record.artifact_manifest.artifact_id.to_string(),
        )
        .with_metadata("proposal_id", parsed.proposal_id.as_str());
        let stored_manifest =
            self.runtime
                .record_artifact(run.workflow_run_id, manifest, completed_at)?;
        let proposal_capability = self.proposal_capability.clone();
        let auxiliary_artifact_manifests = self.record_engine_artifact_manifests(
            run,
            signal_record.data_snapshot_id,
            proposal_capability.as_str(),
            &execute.artifact_refs,
            completed_at,
        )?;

        Ok(TradeProposalRecord {
            workflow_run_id: run.workflow_run_id,
            artifact_manifest: stored_manifest,
            auxiliary_artifact_manifests,
            capability: self.proposal_capability.clone(),
            proposal_id: parsed.proposal_id,
            account_id: parsed.account_id,
            symbol: parsed.symbol,
            signal_id: parsed.signal_id,
            signal_artifact_id: signal_record.artifact_manifest.artifact_id,
            executable: parsed.executable,
            expires_at: parsed.expires_at,
            evidence_refs: parsed.evidence_refs,
            counter_views: parsed.counter_views,
            engine_artifact_ids: execute
                .artifact_refs
                .iter()
                .map(|artifact| artifact.artifact_id.clone())
                .collect(),
            output: proposal_output,
            stream_events: stream
                .iter()
                .map(stream_event_from_proto)
                .collect::<Result<Vec<_>, _>>()?,
            created_at: completed_at,
        })
    }

    fn record_engine_artifact_manifests(
        &mut self,
        run: &WorkflowRun,
        snapshot_id: SnapshotId,
        capability: &str,
        artifact_refs: &[quantos_proto::quantos::common::v1::ArtifactRef],
        recorded_at: DateTime<Utc>,
    ) -> Result<Vec<ArtifactManifest>, SignalProposalWorkflowError> {
        artifact_refs
            .iter()
            .map(|artifact_ref| {
                let content_hash = if artifact_ref.sha256.trim().is_empty() {
                    ContentHash::sha256_bytes(artifact_ref.artifact_id.as_bytes())
                } else {
                    ContentHash::parse(artifact_ref.sha256.as_str())?
                };
                let manifest = ArtifactManifest::new(
                    run.tenant_id,
                    artifact_ref.media_type.as_str(),
                    content_hash,
                    self.storage_bucket.as_str(),
                    0,
                    recorded_at,
                )
                .with_metadata("workflow_run_id", run.workflow_run_id.to_string())
                .with_metadata("data_snapshot_id", snapshot_id.to_string())
                .with_metadata("capability", capability)
                .with_metadata("engine_artifact_id", artifact_ref.artifact_id.as_str())
                .with_metadata("engine_artifact_uri", artifact_ref.uri.as_str());
                self.runtime
                    .record_artifact(run.workflow_run_id, manifest, recorded_at)
                    .map_err(SignalProposalWorkflowError::from)
            })
            .collect()
    }
}

fn ensure_snapshot_allowed(
    snapshot: &DataSnapshotRecord,
    observed_at: DateTime<Utc>,
    rules: &SnapshotQualityRuleset,
) -> Result<(), SignalProposalWorkflowError> {
    let decision =
        SnapshotQualityGate::evaluate(snapshot, SnapshotUsage::Strategy, observed_at, rules);
    if decision.allowed {
        return Ok(());
    }

    let details = decision
        .violations
        .iter()
        .map(snapshot_violation_detail)
        .collect::<Vec<_>>()
        .join(", ");
    Err(SignalProposalWorkflowError::SnapshotGateRejected { details })
}

fn snapshot_violation_detail(violation: &SnapshotGateViolation) -> String {
    match violation {
        SnapshotGateViolation::LicenseMissing => "license missing".to_owned(),
        SnapshotGateViolation::Expired => "snapshot expired".to_owned(),
        SnapshotGateViolation::QualityInsufficient { quality } => {
            format!("quality `{}` rejected", quality.as_str())
        }
        SnapshotGateViolation::RuleMissing { usage } => {
            format!("missing rule for usage `{}`", usage.as_str())
        }
        SnapshotGateViolation::MetadataIncomplete { field } => {
            format!("snapshot metadata `{field}` is incomplete")
        }
    }
}

fn build_engine_execute_request(
    run: &WorkflowRun,
    capability: &str,
    input_schema_version: &str,
    data_snapshot_ref: &str,
    policy_context_ref: &str,
    input: &Value,
    request_prefix: &str,
) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(build_command_metadata(run, capability, request_prefix)),
        workflow_run_id: deterministic_engine_workflow_run_id(run, capability, request_prefix),
        idempotency_key: format!("{request_prefix}-{}", run.idempotency_key),
        capability: capability.to_owned(),
        input_schema_version: input_schema_version.to_owned(),
        data_snapshot_ref: data_snapshot_ref.to_owned(),
        policy_context_ref: policy_context_ref.to_owned(),
        input: Some(json_document_from_value(input)),
        deadline: Some(datetime_to_timestamp(run.deadline_at)),
    }
}

fn build_command_metadata(
    run: &WorkflowRun,
    capability: &str,
    request_prefix: &str,
) -> CommandMetadata {
    let request_token = deterministic_request_token(run, capability, request_prefix);
    CommandMetadata {
        request_id: format!("{request_prefix}-{request_token}"),
        tenant_id: run.tenant_id.to_string(),
        workspace_id: run.workspace_id.to_string(),
        actor: Some(ActorRef {
            actor_id: run.actor_id.to_string(),
            actor_kind: 1,
            display_name: "QuantOS Signal Proposal Operator".to_owned(),
            capabilities: vec![capability.to_owned()],
        }),
        correlation_id: run.correlation_id.to_string(),
        causation_id: format!("workflow-input:{request_token}"),
        mode: 1,
        environment: 2,
        issued_at: Some(datetime_to_timestamp(deterministic_issued_at(
            run,
            capability,
            request_prefix,
        ))),
    }
}

fn deterministic_engine_workflow_run_id(
    run: &WorkflowRun,
    capability: &str,
    request_prefix: &str,
) -> String {
    format!(
        "{request_prefix}-{}",
        deterministic_request_token(run, capability, request_prefix)
    )
}

fn deterministic_request_token(
    run: &WorkflowRun,
    capability: &str,
    request_prefix: &str,
) -> String {
    let seed = format!(
        "{}|{}|{}",
        run.input_hash.as_str(),
        capability,
        request_prefix,
    );
    let digest = ContentHash::sha256_bytes(seed.as_bytes());
    digest
        .as_str()
        .trim_start_matches("sha256:")
        .chars()
        .take(16)
        .collect()
}

fn deterministic_issued_at(
    run: &WorkflowRun,
    capability: &str,
    request_prefix: &str,
) -> DateTime<Utc> {
    let seed = format!(
        "{}|{}|{}",
        run.input_hash.as_str(),
        capability,
        request_prefix,
    );
    let digest = ContentHash::sha256_bytes(seed.as_bytes());
    let offset_seed = &digest.as_str()["sha256:".len()..][..8];
    let offset_minutes = u32::from_str_radix(offset_seed, 16).unwrap_or(0) % (366 * 24 * 60);
    Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0)
        .single()
        .expect("fixed deterministic timestamp is valid")
        + ChronoDuration::minutes(i64::from(offset_minutes))
}

fn inject_signal(
    mut proposal_input: Value,
    signal: Value,
) -> Result<Value, SignalProposalWorkflowError> {
    let Some(root) = proposal_input.as_object_mut() else {
        return Err(SignalProposalWorkflowError::InvalidProposal {
            detail: "proposal input must be a JSON object".to_owned(),
        });
    };
    root.insert("signal".to_owned(), signal.clone());
    if !root.contains_key("symbol") {
        let Some(symbol) = signal.get("symbol").and_then(Value::as_str) else {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "signal.symbol is required".to_owned(),
            });
        };
        root.insert("symbol".to_owned(), Value::String(symbol.to_owned()));
    }
    Ok(proposal_input)
}

fn inject_named_object(
    mut input: Value,
    field_name: &str,
    injected_value: Value,
) -> Result<Value, SignalProposalWorkflowError> {
    let Some(root) = input.as_object_mut() else {
        return Err(SignalProposalWorkflowError::InvalidDataQuery {
            detail: "workflow input must be a JSON object".to_owned(),
        });
    };
    root.insert(field_name.to_owned(), injected_value);
    Ok(input)
}

fn stream_event_from_proto(
    message: &quantos_proto::quantos::engine::v1::StreamExecuteResponse,
) -> Result<WorkflowStreamEvent, SignalProposalWorkflowError> {
    Ok(WorkflowStreamEvent {
        sequence_id: message.sequence_id.clone(),
        done: message.done,
        emitted_at: timestamp_to_datetime(message.emitted_at.as_ref()),
        delta: json_document_to_value(message.delta.as_ref().unwrap_or(&JsonDocument::default()))?,
    })
}

fn json_document_from_value(value: &Value) -> JsonDocument {
    let object = match value {
        Value::Object(map) => map.clone(),
        _ => {
            let mut map = Map::new();
            map.insert("value".to_owned(), value.clone());
            map
        }
    };
    JsonDocument {
        value: Some(Struct {
            fields: object
                .into_iter()
                .map(|(key, value)| (key, proto_value_from_json(value)))
                .collect(),
        }),
    }
}

fn proto_value_from_json(value: Value) -> ProtoValue {
    ProtoValue {
        kind: Some(match value {
            Value::Null => Kind::NullValue(0),
            Value::Bool(value) => Kind::BoolValue(value),
            Value::Number(number) => Kind::NumberValue(number.as_f64().unwrap_or_default()),
            Value::String(value) => Kind::StringValue(value),
            Value::Array(values) => Kind::ListValue(ListValue {
                values: values.into_iter().map(proto_value_from_json).collect(),
            }),
            Value::Object(map) => Kind::StructValue(Struct {
                fields: map
                    .into_iter()
                    .map(|(key, value)| (key, proto_value_from_json(value)))
                    .collect(),
            }),
        }),
    }
}

fn json_document_to_value(document: &JsonDocument) -> Result<Value, SignalProposalWorkflowError> {
    let Some(struct_value) = &document.value else {
        return Ok(Value::Object(Map::new()));
    };
    Ok(Value::Object(
        struct_value
            .fields
            .iter()
            .map(|(key, value)| Ok((key.clone(), json_value_from_proto(value)?)))
            .collect::<Result<Map<String, Value>, SignalProposalWorkflowError>>()?,
    ))
}

fn json_value_from_proto(value: &ProtoValue) -> Result<Value, SignalProposalWorkflowError> {
    Ok(match &value.kind {
        None | Some(Kind::NullValue(_)) => Value::Null,
        Some(Kind::BoolValue(value)) => Value::Bool(*value),
        Some(Kind::NumberValue(value)) => serde_json::Number::from_f64(*value)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Some(Kind::StringValue(value)) => Value::String(value.clone()),
        Some(Kind::StructValue(value)) => Value::Object(
            value
                .fields
                .iter()
                .map(|(key, value)| Ok((key.clone(), json_value_from_proto(value)?)))
                .collect::<Result<Map<String, Value>, SignalProposalWorkflowError>>()?,
        ),
        Some(Kind::ListValue(value)) => Value::Array(
            value
                .values
                .iter()
                .map(json_value_from_proto)
                .collect::<Result<Vec<_>, _>>()?,
        ),
    })
}

fn datetime_to_timestamp(value: DateTime<Utc>) -> Timestamp {
    Timestamp {
        seconds: value.timestamp(),
        nanos: value.timestamp_subsec_nanos() as i32,
    }
}

fn timestamp_to_datetime(value: Option<&Timestamp>) -> Option<DateTime<Utc>> {
    let timestamp = value?;
    DateTime::<Utc>::from_timestamp(timestamp.seconds, timestamp.nanos as u32)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct DecimalValuePayload {
    value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct EvidenceRefPayload {
    evidence_id: String,
    artifact_id: String,
    summary: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct DataQueryLicensePayload {
    label: String,
    approved_for_production: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct DataQueryLineagePayload {
    schema_hash: String,
    content_hash: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct DataQueryUsagePayload {
    trading_approved: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct DataQueryPayload {
    response_type: String,
    provider: String,
    query_id: String,
    dataset: String,
    schema_ref: String,
    sources: Vec<Value>,
    license: DataQueryLicensePayload,
    lineage: DataQueryLineagePayload,
    usage: DataQueryUsagePayload,
    response_hash: String,
}

#[derive(Debug, Clone, PartialEq)]
struct ParsedDataQuery {
    provider: String,
    dataset: String,
    schema_ref: String,
    response_hash: ContentHash,
    trading_approved: bool,
    evidence_refs: Vec<WorkflowEvidenceRecord>,
}

impl TryFrom<&Value> for ParsedDataQuery {
    type Error = SignalProposalWorkflowError;

    fn try_from(value: &Value) -> Result<Self, Self::Error> {
        let payload: DataQueryPayload = serde_json::from_value(value.clone()).map_err(|error| {
            SignalProposalWorkflowError::InvalidDataQuery {
                detail: error.to_string(),
            }
        })?;
        if payload.response_type.trim() != "DataQueryResponse" {
            return Err(SignalProposalWorkflowError::InvalidDataQuery {
                detail: "response_type must equal `DataQueryResponse`".to_owned(),
            });
        }
        if payload.provider.trim().is_empty()
            || payload.dataset.trim().is_empty()
            || payload.schema_ref.trim().is_empty()
            || payload.query_id.trim().is_empty()
        {
            return Err(SignalProposalWorkflowError::InvalidDataQuery {
                detail: "provider/dataset/schema_ref/query_id are required".to_owned(),
            });
        }
        if payload.sources.is_empty() {
            return Err(SignalProposalWorkflowError::InvalidDataQuery {
                detail: "sources must not be empty".to_owned(),
            });
        }
        if payload.license.label.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidDataQuery {
                detail: "license.label is required".to_owned(),
            });
        }
        let response_hash = ContentHash::parse(payload.response_hash.as_str())?;
        let _ = ContentHash::parse(payload.lineage.schema_hash.as_str())?;
        let _ = ContentHash::parse(payload.lineage.content_hash.as_str())?;
        if payload.usage.trading_approved {
            return Err(SignalProposalWorkflowError::InvalidDataQuery {
                detail: "TP05 data_query must keep trading_approved=false".to_owned(),
            });
        }
        let evidence_refs = vec![
            WorkflowEvidenceRecord {
                evidence_id: format!("data-query-evidence:{}:1", payload.query_id),
                artifact_id: format!(
                    "data-lineage:{}",
                    payload.query_id.trim_start_matches("query:")
                ),
                summary: format!("license: {}", payload.license.label),
            },
            WorkflowEvidenceRecord {
                evidence_id: format!("data-query-evidence:{}:2", payload.query_id),
                artifact_id: format!(
                    "data-lineage:{}",
                    payload.query_id.trim_start_matches("query:")
                ),
                summary: format!("source_count: {}", payload.sources.len()),
            },
        ];
        Ok(Self {
            provider: payload.provider,
            dataset: payload.dataset,
            schema_ref: payload.schema_ref,
            response_hash,
            trading_approved: payload.usage.trading_approved,
            evidence_refs,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct SignalPayload {
    signal_id: String,
    strategy_release_id: String,
    symbol: String,
    direction: String,
    strength: DecimalValuePayload,
    confidence: DecimalValuePayload,
    diagnostics: Option<Value>,
    generated_at: String,
    valid_until: String,
    evidence_refs: Vec<EvidenceRefPayload>,
}

#[derive(Debug, Clone, PartialEq)]
struct ParsedSignal {
    signal_id: String,
    strategy_release_id: String,
    symbol: String,
    valid_until: DateTime<Utc>,
    evidence_refs: Vec<WorkflowEvidenceRecord>,
    generated_at: DateTime<Utc>,
}

impl TryFrom<&Value> for ParsedSignal {
    type Error = SignalProposalWorkflowError;

    fn try_from(value: &Value) -> Result<Self, Self::Error> {
        let payload: SignalPayload = serde_json::from_value(value.clone()).map_err(|error| {
            SignalProposalWorkflowError::InvalidSignal {
                detail: error.to_string(),
            }
        })?;
        if payload.signal_id.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "signal_id is required".to_owned(),
            });
        }
        if payload.strategy_release_id.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "strategy_release_id is required".to_owned(),
            });
        }
        if payload.symbol.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "symbol is required".to_owned(),
            });
        }
        if payload.direction.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "direction is required".to_owned(),
            });
        }
        if payload.strength.value.trim().is_empty() || payload.confidence.value.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "strength/confidence are required".to_owned(),
            });
        }
        let diagnostics = payload.diagnostics.unwrap_or(Value::Null);
        if diagnostics.is_null() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "diagnostics are required".to_owned(),
            });
        }
        let generated_at = parse_timestamp(&payload.generated_at)
            .map_err(|detail| SignalProposalWorkflowError::InvalidSignal { detail })?;
        let valid_until = parse_timestamp(&payload.valid_until)
            .map_err(|detail| SignalProposalWorkflowError::InvalidSignal { detail })?;
        if valid_until <= generated_at {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "valid_until must be later than generated_at".to_owned(),
            });
        }
        if payload.evidence_refs.is_empty() {
            return Err(SignalProposalWorkflowError::InvalidSignal {
                detail: "evidence_refs must not be empty".to_owned(),
            });
        }
        Ok(Self {
            signal_id: payload.signal_id,
            strategy_release_id: payload.strategy_release_id,
            symbol: payload.symbol,
            valid_until,
            evidence_refs: payload
                .evidence_refs
                .into_iter()
                .map(|evidence| WorkflowEvidenceRecord {
                    evidence_id: evidence.evidence_id,
                    artifact_id: evidence.artifact_id,
                    summary: evidence.summary,
                })
                .collect(),
            generated_at,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct TradeProposalPayload {
    proposal_id: String,
    account_id: String,
    symbol: String,
    action: String,
    quantity: DecimalValuePayload,
    notional: DecimalValuePayload,
    signal: SignalPayload,
    evidence_refs: Vec<EvidenceRefPayload>,
    rationale: String,
    confidence: DecimalValuePayload,
    expires_at: String,
    executable: bool,
}

#[derive(Debug, Clone, PartialEq)]
struct ParsedTradeProposal {
    proposal_id: String,
    account_id: String,
    symbol: String,
    signal_id: String,
    expires_at: DateTime<Utc>,
    executable: bool,
    evidence_refs: Vec<WorkflowEvidenceRecord>,
    counter_views: Vec<String>,
}

impl TryFrom<&Value> for ParsedTradeProposal {
    type Error = SignalProposalWorkflowError;

    fn try_from(value: &Value) -> Result<Self, Self::Error> {
        let payload: TradeProposalPayload =
            serde_json::from_value(value.clone()).map_err(|error| {
                SignalProposalWorkflowError::InvalidProposal {
                    detail: error.to_string(),
                }
            })?;
        if payload.proposal_id.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "proposal_id is required".to_owned(),
            });
        }
        if payload.account_id.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "account_id is required".to_owned(),
            });
        }
        if payload.symbol.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "symbol is required".to_owned(),
            });
        }
        if payload.action.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "action is required".to_owned(),
            });
        }
        if payload.quantity.value.trim().is_empty()
            || payload.notional.value.trim().is_empty()
            || payload.confidence.value.trim().is_empty()
        {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "quantity/notional/confidence are required".to_owned(),
            });
        }
        if payload.rationale.trim().is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "rationale is required".to_owned(),
            });
        }
        let signal =
            ParsedSignal::try_from(&serde_json::to_value(payload.signal).map_err(|error| {
                SignalProposalWorkflowError::InvalidProposal {
                    detail: error.to_string(),
                }
            })?)?;
        let expires_at = parse_timestamp(&payload.expires_at)
            .map_err(|detail| SignalProposalWorkflowError::InvalidProposal { detail })?;
        if payload.evidence_refs.is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "evidence_refs must not be empty".to_owned(),
            });
        }
        if payload.executable {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "proposal must keep executable=false".to_owned(),
            });
        }

        let evidence_refs = payload
            .evidence_refs
            .into_iter()
            .map(|evidence| WorkflowEvidenceRecord {
                evidence_id: evidence.evidence_id,
                artifact_id: evidence.artifact_id,
                summary: evidence.summary,
            })
            .collect::<Vec<_>>();
        let mut committee_summaries = evidence_refs
            .iter()
            .filter(|evidence| evidence.artifact_id.starts_with("committee-debate:"))
            .map(|evidence| evidence.summary.clone())
            .collect::<Vec<_>>();
        let counter_views = if committee_summaries.len() > 1 {
            committee_summaries.split_off(1)
        } else {
            Vec::new()
        };
        if counter_views.is_empty() {
            return Err(SignalProposalWorkflowError::InvalidProposal {
                detail: "counter views are required via committee evidence".to_owned(),
            });
        }

        Ok(Self {
            proposal_id: payload.proposal_id,
            account_id: payload.account_id,
            symbol: payload.symbol,
            signal_id: signal.signal_id,
            expires_at,
            executable: payload.executable,
            evidence_refs,
            counter_views,
        })
    }
}

fn parse_timestamp(value: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|error| format!("invalid RFC3339 timestamp `{value}`: {error}"))
}
