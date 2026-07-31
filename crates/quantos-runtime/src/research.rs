use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use pbjson_types::{ListValue, Struct, Timestamp, Value as ProtoValue, value::Kind};
use quantos_core::{ContentHash, CoreError, CorrelationId, SnapshotId, canonical_json_bytes};
use quantos_engine_manager::{EngineManager, EngineManagerError};
use quantos_proto::quantos::{
    common::v1::{ActorRef, CommandMetadata, EvidenceRef, JsonDocument},
    engine::v1::{CancelRequest, ExecuteRequest, StreamExecuteRequest},
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
pub struct ResearchWorkflowInput {
    pub runtime_session_id: quantos_core::RuntimeSessionId,
    pub tool_name: String,
    pub capability: quantos_policy::Capability,
    pub workflow_kind: String,
    pub idempotency_key: String,
    pub correlation_id: CorrelationId,
    pub data_snapshot_id: SnapshotId,
    pub policy_context_ref: String,
    pub input_schema_version: String,
    pub input: Value,
    pub max_attempts: u32,
    pub deadline_at: DateTime<Utc>,
    pub cost_budget_units: u64,
    pub rate_limit_per_minute: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchStreamEvent {
    pub sequence_id: String,
    pub done: bool,
    pub emitted_at: Option<DateTime<Utc>>,
    pub delta: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchEvidenceRecord {
    pub evidence_id: String,
    pub artifact_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchArtifactRecord {
    pub workflow_run_id: quantos_core::WorkflowRunId,
    pub artifact_manifest: ArtifactManifest,
    pub engine_artifact_id: String,
    pub data_snapshot_id: SnapshotId,
    pub capability: String,
    pub input_hash: ContentHash,
    pub output: Value,
    pub evidence_refs: Vec<ResearchEvidenceRecord>,
    pub stream_events: Vec<ResearchStreamEvent>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResearchRunResult {
    pub run: WorkflowRun,
    pub artifact: ResearchArtifactRecord,
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryResearchArtifactRepository {
    records_by_hash: BTreeMap<(quantos_core::TenantId, ContentHash), ResearchArtifactRecord>,
    hash_by_run: BTreeMap<quantos_core::WorkflowRunId, ContentHash>,
    run_to_engine_artifacts: BTreeMap<quantos_core::WorkflowRunId, BTreeSet<String>>,
}

impl InMemoryResearchArtifactRepository {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn upsert(&mut self, record: ResearchArtifactRecord) -> &ResearchArtifactRecord {
        let key = (
            record.artifact_manifest.tenant_id,
            record.artifact_manifest.content_hash.clone(),
        );
        let run_id = record.workflow_run_id;
        let engine_artifact_id = record.engine_artifact_id.clone();
        let stored = self.records_by_hash.entry(key).or_insert(record);
        self.hash_by_run
            .insert(run_id, stored.artifact_manifest.content_hash.clone());
        self.run_to_engine_artifacts
            .entry(run_id)
            .or_default()
            .insert(engine_artifact_id);
        stored
    }

    #[must_use]
    pub fn record_for_run(
        &self,
        run_id: quantos_core::WorkflowRunId,
    ) -> Option<&ResearchArtifactRecord> {
        let hash = self.hash_by_run.get(&run_id)?;
        self.records_by_hash
            .values()
            .find(|record| &record.artifact_manifest.content_hash == hash)
    }

    #[must_use]
    pub fn find_by_artifact_id(&self, artifact_id: &str) -> Option<&ResearchArtifactRecord> {
        self.records_by_hash
            .values()
            .find(|record| record.engine_artifact_id == artifact_id)
    }

    #[must_use]
    pub fn physical_artifact_count(&self) -> usize {
        self.records_by_hash.len()
    }
}

#[derive(Debug, Error)]
pub enum ResearchWorkflowError {
    #[error(transparent)]
    Runtime(#[from] RuntimeError),
    #[error(transparent)]
    Engine(#[from] EngineManagerError),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("RESEARCH_SNAPSHOT_NOT_FOUND: snapshot `{snapshot_id}` is not available")]
    SnapshotNotFound { snapshot_id: SnapshotId },
    #[error("RESEARCH_SNAPSHOT_GATE_REJECTED: {details}")]
    SnapshotGateRejected { details: String },
    #[error(
        "RESEARCH_CHECKPOINT_MISSING: workflow run `{run_id}` is missing a research request checkpoint"
    )]
    MissingCheckpoint { run_id: quantos_core::WorkflowRunId },
    #[error("RESEARCH_OUTPUT_MISSING: engine did not return a final research output document")]
    MissingOutput,
    #[error("RESEARCH_ARTIFACT_REF_MISSING: engine did not return an artifact reference")]
    MissingArtifactRef,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct ResearchCheckpointPayload {
    capability: String,
    data_snapshot_id: String,
    execution_id: String,
    policy_context_ref: String,
    input_schema_version: String,
    input: Value,
}

pub struct ResearchWorkflowCoordinator<'a> {
    runtime: &'a mut InMemoryRuntimeKernel,
    snapshots: &'a InMemoryDataSnapshotCatalog,
    quality_rules: &'a SnapshotQualityRuleset,
    artifact_repository: &'a mut InMemoryResearchArtifactRepository,
    engine_manager: &'a mut EngineManager,
    worker_name: String,
    lease_duration: ChronoDuration,
    storage_bucket: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResearchWorkflowCoordinatorConfig {
    pub worker_name: String,
    pub lease_duration: ChronoDuration,
    pub storage_bucket: String,
}

impl<'a> ResearchWorkflowCoordinator<'a> {
    #[must_use]
    pub fn new(
        runtime: &'a mut InMemoryRuntimeKernel,
        snapshots: &'a InMemoryDataSnapshotCatalog,
        quality_rules: &'a SnapshotQualityRuleset,
        artifact_repository: &'a mut InMemoryResearchArtifactRepository,
        engine_manager: &'a mut EngineManager,
        config: ResearchWorkflowCoordinatorConfig,
    ) -> Self {
        Self {
            runtime,
            snapshots,
            quality_rules,
            artifact_repository,
            engine_manager,
            worker_name: config.worker_name,
            lease_duration: config.lease_duration,
            storage_bucket: config.storage_bucket,
        }
    }

    pub fn schedule_research_run(
        &mut self,
        input: ResearchWorkflowInput,
        queued_at: DateTime<Utc>,
    ) -> Result<WorkflowRun, ResearchWorkflowError> {
        let input_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&input.input)?);
        let new_run = NewWorkflowRun {
            runtime_session_id: input.runtime_session_id,
            tool_name: input.tool_name,
            capability: input.capability.clone(),
            workflow_kind: input.workflow_kind,
            idempotency_key: input.idempotency_key.clone(),
            correlation_id: input.correlation_id,
            input_hash,
            max_attempts: input.max_attempts,
            deadline_at: input.deadline_at,
            cost_budget_units: input.cost_budget_units,
            rate_limit_per_minute: input.rate_limit_per_minute,
        };
        let run = self.runtime.schedule_run(new_run, queued_at)?;
        let checkpoint = ResearchCheckpointPayload {
            capability: input.capability.as_str().to_owned(),
            data_snapshot_id: input.data_snapshot_id.to_string(),
            execution_id: format!("{}:{}", run.workflow_run_id, run.idempotency_key),
            policy_context_ref: input.policy_context_ref,
            input_schema_version: input.input_schema_version,
            input: input.input,
        };
        self.runtime.save_checkpoint(
            run.workflow_run_id,
            "research.request",
            0,
            serde_json::to_value(checkpoint)?,
            queued_at,
        )?;
        Ok(run)
    }

    pub async fn execute_next(
        &mut self,
        observed_at: DateTime<Utc>,
    ) -> Result<Option<ResearchRunResult>, ResearchWorkflowError> {
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

    pub async fn cancel_run(
        &mut self,
        run_id: quantos_core::WorkflowRunId,
        requested_at: DateTime<Utc>,
    ) -> Result<ChronoDuration, ResearchWorkflowError> {
        self.runtime.request_cancel(run_id, requested_at)?;
        let checkpoint = self
            .runtime
            .load_checkpoint(run_id)
            .cloned()
            .ok_or(ResearchWorkflowError::MissingCheckpoint { run_id })?;
        let payload: ResearchCheckpointPayload = serde_json::from_value(checkpoint.payload)?;

        let confirmed_at = requested_at + ChronoDuration::milliseconds(50);
        self.engine_manager
            .cancel_capability(
                &payload.capability,
                CancelRequest {
                    metadata: Some(build_command_metadata(
                        self.runtime
                            .run(run_id)
                            .ok_or(RuntimeError::run_not_found(run_id))?,
                        &payload.capability,
                    )),
                    execution_id: payload.execution_id,
                    reason: "operator-request".to_owned(),
                },
            )
            .await?;
        self.runtime.finalize_cancelled(run_id, confirmed_at)?;
        Ok(confirmed_at - requested_at)
    }

    async fn execute_claimed_run(
        &mut self,
        lease: LeasedWorkflowRun,
        observed_at: DateTime<Utc>,
    ) -> Result<ResearchRunResult, ResearchWorkflowError> {
        let run_id = lease.run.workflow_run_id;
        let checkpoint = self
            .runtime
            .load_checkpoint(run_id)
            .cloned()
            .ok_or(ResearchWorkflowError::MissingCheckpoint { run_id })?;
        let payload: ResearchCheckpointPayload =
            serde_json::from_value(checkpoint.payload.clone())?;
        let snapshot = self
            .snapshots
            .get(
                lease.run.tenant_id,
                SnapshotId::parse_str(&payload.data_snapshot_id)?,
            )
            .cloned()
            .ok_or(ResearchWorkflowError::SnapshotNotFound {
                snapshot_id: SnapshotId::parse_str(&payload.data_snapshot_id)?,
            })?;
        ensure_snapshot_allowed(&snapshot, observed_at, self.quality_rules)?;

        self.runtime.save_checkpoint(
            run_id,
            "research.dispatch",
            1,
            serde_json::to_value(&payload)?,
            observed_at,
        )?;

        let execute_request = build_execute_request(&lease.run, &payload);
        let stream_messages = self
            .engine_manager
            .stream_execute_collect(
                &payload.capability,
                StreamExecuteRequest {
                    request: Some(execute_request.clone()),
                },
            )
            .await?;
        let execute = match self
            .engine_manager
            .execute(&payload.capability, execute_request)
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

        let completed_at =
            timestamp_to_datetime(execute.completed_at.as_ref()).unwrap_or(observed_at);
        let output = json_document_to_value(
            execute
                .output
                .as_ref()
                .ok_or(ResearchWorkflowError::MissingOutput)?,
        )?;
        let output_bytes = canonical_json_bytes(&output)?;
        let artifact_ref = execute
            .artifact_refs
            .first()
            .ok_or(ResearchWorkflowError::MissingArtifactRef)?;
        let content_hash = if artifact_ref.sha256.trim().is_empty() {
            ContentHash::sha256_bytes(&output_bytes)
        } else {
            ContentHash::parse(artifact_ref.sha256.as_str())?
        };
        let manifest = ArtifactManifest::new(
            lease.run.tenant_id,
            artifact_ref.media_type.as_str(),
            content_hash.clone(),
            self.storage_bucket.as_str(),
            output_bytes.len() as u64,
            completed_at,
        )
        .with_metadata("workflow_run_id", lease.run.workflow_run_id.to_string())
        .with_metadata("data_snapshot_id", snapshot.snapshot_id.to_string())
        .with_metadata("capability", payload.capability.as_str())
        .with_metadata("engine_artifact_id", artifact_ref.artifact_id.as_str())
        .with_metadata("engine_artifact_uri", artifact_ref.uri.as_str());
        let stored_manifest = self
            .runtime
            .record_artifact(run_id, manifest, completed_at)?;

        let record = ResearchArtifactRecord {
            workflow_run_id: run_id,
            artifact_manifest: stored_manifest,
            engine_artifact_id: artifact_ref.artifact_id.clone(),
            data_snapshot_id: snapshot.snapshot_id,
            capability: payload.capability.clone(),
            input_hash: lease.run.input_hash.clone(),
            output,
            evidence_refs: execute
                .evidence_refs
                .iter()
                .map(evidence_ref_to_record)
                .collect(),
            stream_events: stream_messages
                .iter()
                .map(stream_event_from_proto)
                .collect::<Result<Vec<_>, _>>()?,
            created_at: completed_at,
        };
        let artifact = self.artifact_repository.upsert(record).clone();
        self.runtime.save_checkpoint(
            run_id,
            "research.completed",
            2,
            json!({
                "artifact_id": artifact.artifact_manifest.artifact_id.to_string(),
                "engine_artifact_id": artifact.engine_artifact_id,
                "evidence_refs": artifact.evidence_refs,
            }),
            completed_at,
        )?;
        self.runtime
            .complete_run(run_id, &self.worker_name, completed_at)?;
        let run = self
            .runtime
            .run(run_id)
            .cloned()
            .ok_or(RuntimeError::run_not_found(run_id))?;
        Ok(ResearchRunResult { run, artifact })
    }
}

fn ensure_snapshot_allowed(
    snapshot: &DataSnapshotRecord,
    observed_at: DateTime<Utc>,
    rules: &SnapshotQualityRuleset,
) -> Result<(), ResearchWorkflowError> {
    let decision =
        SnapshotQualityGate::evaluate(snapshot, SnapshotUsage::Research, observed_at, rules);
    if decision.allowed {
        return Ok(());
    }

    let details = decision
        .violations
        .iter()
        .map(snapshot_violation_detail)
        .collect::<Vec<_>>()
        .join(", ");
    Err(ResearchWorkflowError::SnapshotGateRejected { details })
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
    }
}

fn build_execute_request(run: &WorkflowRun, payload: &ResearchCheckpointPayload) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(build_command_metadata(run, &payload.capability)),
        workflow_run_id: run.workflow_run_id.to_string(),
        idempotency_key: run.idempotency_key.clone(),
        capability: payload.capability.clone(),
        input_schema_version: payload.input_schema_version.clone(),
        data_snapshot_ref: payload.data_snapshot_id.clone(),
        policy_context_ref: payload.policy_context_ref.clone(),
        input: Some(json_document_from_value(&payload.input)),
        deadline: Some(datetime_to_timestamp(run.deadline_at)),
    }
}

fn build_command_metadata(run: &WorkflowRun, capability: &str) -> CommandMetadata {
    CommandMetadata {
        request_id: format!("research-{}", run.workflow_run_id),
        tenant_id: run.tenant_id.to_string(),
        workspace_id: run.workspace_id.to_string(),
        actor: Some(ActorRef {
            actor_id: run.actor_id.to_string(),
            actor_kind: 1,
            display_name: "QuantOS Research Operator".to_owned(),
            capabilities: vec![capability.to_owned()],
        }),
        correlation_id: run.correlation_id.to_string(),
        causation_id: format!("workflow-run:{}", run.workflow_run_id),
        mode: 1,
        environment: 2,
        issued_at: Some(datetime_to_timestamp(Utc::now())),
    }
}

fn evidence_ref_to_record(evidence: &EvidenceRef) -> ResearchEvidenceRecord {
    ResearchEvidenceRecord {
        evidence_id: evidence.evidence_id.clone(),
        artifact_id: evidence.artifact_id.clone(),
        summary: evidence.summary.clone(),
    }
}

fn stream_event_from_proto(
    message: &quantos_proto::quantos::engine::v1::StreamExecuteResponse,
) -> Result<ResearchStreamEvent, ResearchWorkflowError> {
    Ok(ResearchStreamEvent {
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

fn json_document_to_value(document: &JsonDocument) -> Result<Value, ResearchWorkflowError> {
    let Some(struct_value) = &document.value else {
        return Ok(Value::Object(Map::new()));
    };
    Ok(Value::Object(
        struct_value
            .fields
            .iter()
            .map(|(key, value)| Ok((key.clone(), json_value_from_proto(value)?)))
            .collect::<Result<Map<String, Value>, ResearchWorkflowError>>()?,
    ))
}

fn json_value_from_proto(value: &ProtoValue) -> Result<Value, ResearchWorkflowError> {
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
                .collect::<Result<Map<String, Value>, ResearchWorkflowError>>()?,
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

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_auth::AuthContext;
    use quantos_core::{
        AccountId, ActorId, ContentHash, CorrelationId, SnapshotId, TenantId, WorkspaceId,
    };
    use quantos_engine_manager::EngineManager;
    use quantos_policy::{Capability, Role, RunMode};
    use quantos_storage::{
        ArtifactManifest, DataSnapshotInput, InMemoryDataSnapshotCatalog, SnapshotArtifactRef,
        SnapshotLineageEntry, SnapshotQuality, SnapshotQualityRuleset, SnapshotSourceRef,
        SnapshotWindow, default_quality_rules,
    };
    use serde_json::json;
    use std::collections::BTreeSet;

    use super::{
        InMemoryResearchArtifactRepository, ResearchArtifactRecord, ResearchEvidenceRecord,
        ResearchStreamEvent, ResearchWorkflowCoordinator, ResearchWorkflowCoordinatorConfig,
        ResearchWorkflowInput,
    };
    use crate::{InMemoryRuntimeKernel, ToolRegistration};

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

    fn tool_registration() -> ToolRegistration {
        ToolRegistration {
            tool_name: "research.execute".to_owned(),
            capability: Capability::parse(Capability::EXECUTION_OPERATE)
                .expect("capability parses"),
            description: "Run deterministic research".to_owned(),
            max_cost_units: 10_000,
            rate_limit_per_minute: 600,
            enabled: true,
        }
    }

    fn snapshot_catalog(tenant_id: TenantId) -> InMemoryDataSnapshotCatalog {
        let mut catalog = InMemoryDataSnapshotCatalog::new();
        let snapshot = quantos_storage::DataSnapshotRecord::new(
            tenant_id,
            DataSnapshotInput {
                schema_name: "DataSnapshot".to_owned(),
                schema_version: quantos_core::SchemaVersion::parse("v1")
                    .expect("schema version parses"),
                schema_entry_id: None,
                window: SnapshotWindow {
                    start_at: Utc
                        .with_ymd_and_hms(2026, 7, 31, 0, 0, 0)
                        .single()
                        .expect("valid timestamp"),
                    end_at: Utc
                        .with_ymd_and_hms(2026, 7, 31, 1, 0, 0)
                        .single()
                        .expect("valid timestamp"),
                },
                sources: vec![SnapshotSourceRef {
                    source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                    provider: "approved.binance.spot".to_owned(),
                    dataset: "crypto.top_of_book.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                }],
                quality: SnapshotQuality::Passed,
                quality_findings: vec![],
                license_label: "internal-approved".to_owned(),
                captured_at: Utc
                    .with_ymd_and_hms(2026, 7, 31, 1, 0, 5)
                    .single()
                    .expect("valid timestamp"),
                max_age_secs: 120,
                symbols: vec!["BTCUSDT".to_owned()],
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: quantos_core::ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: ContentHash::sha256_bytes(br#"{"snapshot":"input"}"#),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: "tenant/example/snapshots/1".to_owned(),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "market_event_range".to_owned(),
                    reference: "market:BTCUSDT".to_owned(),
                    details: json!({ "from_sequence": 1, "to_sequence": 100 }),
                }],
            },
            Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
                .single()
                .expect("valid timestamp"),
        )
        .expect("snapshot builds")
        .clone();
        catalog.upsert(snapshot);
        catalog
    }

    #[test]
    fn repository_deduplicates_replayed_artifacts_after_restart() {
        let tenant_id = TenantId::new();
        let created_at = Utc
            .with_ymd_and_hms(2026, 7, 31, 2, 0, 0)
            .single()
            .expect("valid timestamp");
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            ContentHash::sha256_bytes(br#"{"artifact":"same"}"#),
            "quantos-artifacts",
            18,
            created_at,
        );
        let record = ResearchArtifactRecord {
            workflow_run_id: quantos_core::WorkflowRunId::new(),
            artifact_manifest: manifest.clone(),
            engine_artifact_id: "research-artifact:run-1".to_owned(),
            data_snapshot_id: SnapshotId::new(),
            capability: "research.hypothesis.v1".to_owned(),
            input_hash: ContentHash::sha256_bytes(br#"{"fixture":"same"}"#),
            output: json!({ "artifact_type": "ResearchArtifact", "summary": "deterministic" }),
            evidence_refs: vec![ResearchEvidenceRecord {
                evidence_id: "evidence:run-1".to_owned(),
                artifact_id: "research-artifact:run-1".to_owned(),
                summary: "Deterministic evidence".to_owned(),
            }],
            stream_events: vec![ResearchStreamEvent {
                sequence_id: "seq-1".to_owned(),
                done: true,
                emitted_at: Some(created_at),
                delta: json!({ "phase": "completed" }),
            }],
            created_at,
        };

        let mut repository = InMemoryResearchArtifactRepository::new();
        let stored_first = repository.upsert(record.clone()).clone();
        let stored_second = repository.upsert(record).clone();

        assert_eq!(
            stored_first.artifact_manifest.artifact_id,
            stored_second.artifact_manifest.artifact_id
        );
        assert_eq!(repository.physical_artifact_count(), 1);
        assert!(
            repository
                .find_by_artifact_id("research-artifact:run-1")
                .is_some()
        );
    }

    #[test]
    fn scheduling_same_fixture_keeps_input_hash_stable() {
        let now = Utc
            .with_ymd_and_hms(2026, 7, 31, 3, 0, 0)
            .single()
            .expect("valid timestamp");
        let auth = auth_context();
        let mut runtime = InMemoryRuntimeKernel::new();
        runtime
            .register_tool(tool_registration())
            .expect("tool registers");
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));
        let snapshots = snapshot_catalog(auth.tenant_id);
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now));
        let mut repository = InMemoryResearchArtifactRepository::new();
        let mut engine_manager =
            EngineManager::new(quantos_engine_manager::BackoffPolicy::default());
        let mut coordinator = ResearchWorkflowCoordinator::new(
            &mut runtime,
            &snapshots,
            &rules,
            &mut repository,
            &mut engine_manager,
            ResearchWorkflowCoordinatorConfig {
                worker_name: "worker-a".to_owned(),
                lease_duration: ChronoDuration::seconds(30),
                storage_bucket: "quantos-artifacts".to_owned(),
            },
        );
        let snapshot_id = snapshots.list_by_symbol(auth.tenant_id, "BTCUSDT")[0].snapshot_id;

        let mut input_hashes = BTreeSet::new();
        for index in 0..10 {
            let run = coordinator
                .schedule_research_run(
                    ResearchWorkflowInput {
                        runtime_session_id: session.runtime_session_id,
                        tool_name: "research.execute".to_owned(),
                        capability: Capability::parse(Capability::EXECUTION_OPERATE)
                            .expect("capability parses"),
                        workflow_kind: "research".to_owned(),
                        idempotency_key: format!("stable-run-{index}"),
                        correlation_id: CorrelationId::new(),
                        data_snapshot_id: snapshot_id,
                        policy_context_ref: "policy-1".to_owned(),
                        input_schema_version: "v1".to_owned(),
                        input: json!({ "fixture": "hypothesis_regime_shift", "prompt": "Generate hypothesis" }),
                        max_attempts: 1,
                        deadline_at: now + ChronoDuration::minutes(5),
                        cost_budget_units: 100,
                        rate_limit_per_minute: 10,
                    },
                    now,
                )
                .expect("run schedules");
            input_hashes.insert(run.input_hash.clone());
        }
        assert_eq!(input_hashes.len(), 1);
    }
}
