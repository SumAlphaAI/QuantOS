use std::collections::HashMap;

pub mod capacity;
pub mod service;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::CorrelationId;
use quantos_event::{AppendOnlyLedger, EventError, RecordedEvent};
use quantos_runtime::{
    InMemoryRuntimeKernel, NewWorkflowRun, RuntimeError, RuntimeSession, WorkflowCheckpoint,
    WorkflowRun,
};
use quantos_storage::{ArtifactManifest, InMemoryArtifactCatalog};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TraceStatus {
    Started,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Warning,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FaultTarget {
    Database,
    EventConsumer,
    Engine,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TraceRecord {
    pub correlation_id: CorrelationId,
    pub subsystem: String,
    pub operation: String,
    pub status: TraceStatus,
    pub attributes: Value,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StructuredLogRecord {
    pub level: TelemetryLevel,
    pub subsystem: String,
    pub message: String,
    pub correlation_id: Option<CorrelationId>,
    pub fields: Value,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthComponent {
    pub name: String,
    pub ready: bool,
    pub detail: String,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServiceHealthReport {
    pub service: String,
    pub ready: bool,
    pub components: Vec<HealthComponent>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct CapacitySnapshot {
    pub outbox_oldest_age_secs: f64,
    pub dead_letter_ratio: f64,
    pub realtime_projection_delay_secs: f64,
    pub realtime_quota_utilization: f64,
    pub risk_query_p95_ms: f64,
    pub portfolio_query_p95_ms: f64,
    pub risk_mv_freshness_secs: f64,
    pub ops_aggregate_freshness_secs: f64,
    pub storage_error_rate: f64,
    pub secret_rotation_failed: bool,
    pub secret_read_failed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlertRecord {
    pub rule_id: String,
    pub severity: AlertSeverity,
    pub summary: String,
    pub observed_value: Value,
    pub threshold: Value,
    pub triggered_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AdrEvidenceReport {
    pub generated_at: DateTime<Utc>,
    pub alerts: Vec<AlertRecord>,
    pub implicated_correlations: Vec<CorrelationId>,
    pub summary: String,
    pub recommended_actions: Vec<String>,
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryTelemetrySink {
    traces: Vec<TraceRecord>,
    logs: Vec<StructuredLogRecord>,
    alerts: Vec<AlertRecord>,
}

impl InMemoryTelemetrySink {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_trace(
        &mut self,
        correlation_id: CorrelationId,
        subsystem: impl Into<String>,
        operation: impl Into<String>,
        status: TraceStatus,
        attributes: Value,
        recorded_at: DateTime<Utc>,
    ) {
        self.traces.push(TraceRecord {
            correlation_id,
            subsystem: subsystem.into(),
            operation: operation.into(),
            status,
            attributes: redact_value(attributes),
            recorded_at,
        });
    }

    pub fn record_log(
        &mut self,
        level: TelemetryLevel,
        subsystem: impl Into<String>,
        message: impl Into<String>,
        correlation_id: Option<CorrelationId>,
        fields: Value,
        recorded_at: DateTime<Utc>,
    ) {
        self.logs.push(StructuredLogRecord {
            level,
            subsystem: subsystem.into(),
            message: message.into(),
            correlation_id,
            fields: redact_value(fields),
            recorded_at,
        });
    }

    pub fn record_alert(&mut self, alert: AlertRecord) {
        self.alerts.push(alert);
    }

    #[must_use]
    pub fn traces_for_correlation(&self, correlation_id: CorrelationId) -> Vec<&TraceRecord> {
        self.traces
            .iter()
            .filter(|record| record.correlation_id == correlation_id)
            .collect()
    }

    #[must_use]
    pub fn traces(&self) -> &[TraceRecord] {
        &self.traces
    }

    #[must_use]
    pub fn logs(&self) -> &[StructuredLogRecord] {
        &self.logs
    }

    #[must_use]
    pub fn alerts(&self) -> &[AlertRecord] {
        &self.alerts
    }
}

#[derive(Debug, Default, Clone)]
pub struct AlertWindowState {
    first_breach_at: HashMap<String, DateTime<Utc>>,
    consecutive_breaches: HashMap<String, u32>,
}

#[derive(Debug, Clone)]
struct AlertSeed {
    rule_id: String,
    severity: AlertSeverity,
    summary: String,
    observed_value: Value,
    threshold: Value,
}

#[derive(Debug, Default, Clone)]
pub struct CapacityAlertEvaluator;

impl CapacityAlertEvaluator {
    #[must_use]
    pub fn evaluate(
        &self,
        snapshot: &CapacitySnapshot,
        observed_at: DateTime<Utc>,
        state: &mut AlertWindowState,
    ) -> Vec<AlertRecord> {
        let mut alerts = Vec::new();

        self.evaluate_duration_rule(
            snapshot.outbox_oldest_age_secs > 60.0,
            observed_at,
            ChronoDuration::minutes(15),
            state,
            AlertSeed {
                rule_id: "outbox_oldest_age".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "outbox oldest age exceeded 60 seconds for 15 minutes: {:.1}s",
                    snapshot.outbox_oldest_age_secs
                ),
                observed_value: json!(snapshot.outbox_oldest_age_secs),
                threshold: json!(60.0),
            },
            &mut alerts,
        );
        self.evaluate_immediate_rule(
            snapshot.dead_letter_ratio > 0.001,
            observed_at,
            AlertSeed {
                rule_id: "dead_letter_ratio".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "dead letter ratio exceeded 0.1%: {:.4}",
                    snapshot.dead_letter_ratio
                ),
                observed_value: json!(snapshot.dead_letter_ratio),
                threshold: json!(0.001),
            },
            &mut alerts,
        );
        self.evaluate_duration_rule(
            snapshot.realtime_projection_delay_secs > 5.0,
            observed_at,
            ChronoDuration::minutes(15),
            state,
            AlertSeed {
                rule_id: "realtime_projection_delay".to_owned(),
                severity: AlertSeverity::Warning,
                summary: format!(
                    "realtime projection delay exceeded 5 seconds for 15 minutes: {:.1}s",
                    snapshot.realtime_projection_delay_secs
                ),
                observed_value: json!(snapshot.realtime_projection_delay_secs),
                threshold: json!(5.0),
            },
            &mut alerts,
        );
        self.evaluate_duration_rule(
            snapshot.realtime_quota_utilization > 0.7,
            observed_at,
            ChronoDuration::minutes(15),
            state,
            AlertSeed {
                rule_id: "realtime_quota_utilization".to_owned(),
                severity: AlertSeverity::Warning,
                summary: format!(
                    "realtime quota utilization exceeded 70% for 15 minutes: {:.2}",
                    snapshot.realtime_quota_utilization
                ),
                observed_value: json!(snapshot.realtime_quota_utilization),
                threshold: json!(0.7),
            },
            &mut alerts,
        );
        self.evaluate_duration_rule(
            snapshot.risk_query_p95_ms > 300.0,
            observed_at,
            ChronoDuration::minutes(15),
            state,
            AlertSeed {
                rule_id: "risk_query_p95_ms".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "risk query p95 exceeded 300ms for 15 minutes: {:.1}ms",
                    snapshot.risk_query_p95_ms
                ),
                observed_value: json!(snapshot.risk_query_p95_ms),
                threshold: json!(300.0),
            },
            &mut alerts,
        );
        self.evaluate_duration_rule(
            snapshot.portfolio_query_p95_ms > 300.0,
            observed_at,
            ChronoDuration::minutes(15),
            state,
            AlertSeed {
                rule_id: "portfolio_query_p95_ms".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "portfolio query p95 exceeded 300ms for 15 minutes: {:.1}ms",
                    snapshot.portfolio_query_p95_ms
                ),
                observed_value: json!(snapshot.portfolio_query_p95_ms),
                threshold: json!(300.0),
            },
            &mut alerts,
        );
        self.evaluate_consecutive_rule(
            snapshot.risk_mv_freshness_secs > 60.0,
            observed_at,
            3,
            state,
            AlertSeed {
                rule_id: "risk_mv_freshness".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "risk materialized view freshness exceeded 60 seconds for 3 consecutive checks: {:.1}s",
                    snapshot.risk_mv_freshness_secs
                ),
                observed_value: json!(snapshot.risk_mv_freshness_secs),
                threshold: json!(60.0),
            },
            &mut alerts,
        );
        self.evaluate_consecutive_rule(
            snapshot.ops_aggregate_freshness_secs > 300.0,
            observed_at,
            3,
            state,
            AlertSeed {
                rule_id: "ops_aggregate_freshness".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "operations aggregate freshness exceeded 300 seconds for 3 consecutive checks: {:.1}s",
                    snapshot.ops_aggregate_freshness_secs
                ),
                observed_value: json!(snapshot.ops_aggregate_freshness_secs),
                threshold: json!(300.0),
            },
            &mut alerts,
        );
        self.evaluate_immediate_rule(
            snapshot.storage_error_rate > 0.01,
            observed_at,
            AlertSeed {
                rule_id: "storage_error_rate".to_owned(),
                severity: AlertSeverity::Critical,
                summary: format!(
                    "storage error rate exceeded 1%: {:.3}",
                    snapshot.storage_error_rate
                ),
                observed_value: json!(snapshot.storage_error_rate),
                threshold: json!(0.01),
            },
            &mut alerts,
        );
        self.evaluate_immediate_rule(
            snapshot.secret_rotation_failed,
            observed_at,
            AlertSeed {
                rule_id: "secret_rotation_failed".to_owned(),
                severity: AlertSeverity::Critical,
                summary: "secret rotation failure detected".to_owned(),
                observed_value: json!(snapshot.secret_rotation_failed),
                threshold: json!(false),
            },
            &mut alerts,
        );
        self.evaluate_immediate_rule(
            snapshot.secret_read_failed,
            observed_at,
            AlertSeed {
                rule_id: "secret_read_failed".to_owned(),
                severity: AlertSeverity::Critical,
                summary: "secret read failure detected".to_owned(),
                observed_value: json!(snapshot.secret_read_failed),
                threshold: json!(false),
            },
            &mut alerts,
        );

        alerts
    }

    fn evaluate_immediate_rule(
        &self,
        breached: bool,
        observed_at: DateTime<Utc>,
        seed: AlertSeed,
        alerts: &mut Vec<AlertRecord>,
    ) {
        if breached {
            alerts.push(AlertRecord {
                rule_id: seed.rule_id,
                severity: seed.severity,
                summary: seed.summary,
                observed_value: seed.observed_value,
                threshold: seed.threshold,
                triggered_at: observed_at,
            });
        }
    }

    fn evaluate_duration_rule(
        &self,
        breached: bool,
        observed_at: DateTime<Utc>,
        required_duration: ChronoDuration,
        state: &mut AlertWindowState,
        seed: AlertSeed,
        alerts: &mut Vec<AlertRecord>,
    ) {
        if breached {
            let first_breach = state
                .first_breach_at
                .entry(seed.rule_id.clone())
                .or_insert(observed_at);
            if observed_at.signed_duration_since(*first_breach) >= required_duration {
                alerts.push(AlertRecord {
                    rule_id: seed.rule_id,
                    severity: seed.severity,
                    summary: seed.summary,
                    observed_value: seed.observed_value,
                    threshold: seed.threshold,
                    triggered_at: observed_at,
                });
            }
        } else {
            state.first_breach_at.remove(seed.rule_id.as_str());
        }
    }

    fn evaluate_consecutive_rule(
        &self,
        breached: bool,
        observed_at: DateTime<Utc>,
        required_count: u32,
        state: &mut AlertWindowState,
        seed: AlertSeed,
        alerts: &mut Vec<AlertRecord>,
    ) {
        if breached {
            let count = state
                .consecutive_breaches
                .entry(seed.rule_id.clone())
                .and_modify(|value| *value += 1)
                .or_insert(1);
            if *count >= required_count {
                alerts.push(AlertRecord {
                    rule_id: seed.rule_id,
                    severity: seed.severity,
                    summary: seed.summary,
                    observed_value: seed.observed_value,
                    threshold: seed.threshold,
                    triggered_at: observed_at,
                });
            }
        } else {
            state.consecutive_breaches.remove(seed.rule_id.as_str());
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct FaultProxy {
    remaining_failures: HashMap<FaultTarget, u32>,
}

impl FaultProxy {
    #[must_use]
    pub fn new() -> Self {
        Self {
            remaining_failures: HashMap::new(),
        }
    }

    pub fn inject_failures(&mut self, target: FaultTarget, failures: u32) {
        self.remaining_failures.insert(target, failures);
    }

    pub fn run<T, F>(
        &mut self,
        target: FaultTarget,
        sink: &mut InMemoryTelemetrySink,
        correlation_id: CorrelationId,
        operation: &str,
        recorded_at: DateTime<Utc>,
        closure: F,
    ) -> Result<T, FaultProxyError>
    where
        F: FnOnce() -> T,
    {
        if let Some(remaining) = self.remaining_failures.get_mut(&target)
            && *remaining > 0
        {
            *remaining -= 1;
            sink.record_log(
                TelemetryLevel::Error,
                fault_subsystem(target),
                "fault injected",
                Some(correlation_id),
                json!({
                    "operation": operation,
                    "target": format!("{target:?}"),
                    "secret_token": "should-be-redacted",
                }),
                recorded_at,
            );
            sink.record_trace(
                correlation_id,
                fault_subsystem(target),
                operation,
                TraceStatus::Failed,
                json!({
                    "fault_target": format!("{target:?}"),
                    "reason": "injected_failure",
                }),
                recorded_at,
            );
            return Err(FaultProxyError::Injected(target));
        }

        let result = closure();
        sink.record_trace(
            correlation_id,
            fault_subsystem(target),
            operation,
            TraceStatus::Succeeded,
            json!({
                "fault_target": format!("{target:?}"),
                "recovered": true,
            }),
            recorded_at,
        );
        Ok(result)
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum FaultProxyError {
    #[error("FAULT_INJECTED: {0:?}")]
    Injected(FaultTarget),
}

#[derive(Debug, Default, Clone)]
pub struct ObservableAppendOnlyLedger {
    inner: AppendOnlyLedger,
    telemetry: InMemoryTelemetrySink,
}

impl ObservableAppendOnlyLedger {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn append(
        &mut self,
        event: RecordedEvent,
        recorded_at: DateTime<Utc>,
    ) -> Result<(), EventError> {
        let correlation_id = event.correlation_id;
        let result = self.inner.append(event);
        let (status, attributes) = match &result {
            Ok(()) => (
                TraceStatus::Succeeded,
                json!({ "write_target": "event_log", "result": "appended" }),
            ),
            Err(error) => (
                TraceStatus::Failed,
                json!({
                    "write_target": "event_log",
                    "machine_code": error.machine_code(),
                }),
            ),
        };
        self.telemetry.record_trace(
            correlation_id,
            "event",
            "append_event",
            status,
            attributes,
            recorded_at,
        );
        result
    }

    #[must_use]
    pub fn telemetry(&self) -> &InMemoryTelemetrySink {
        &self.telemetry
    }

    #[must_use]
    pub fn telemetry_mut(&mut self) -> &mut InMemoryTelemetrySink {
        &mut self.telemetry
    }

    #[must_use]
    pub fn inner(&self) -> &AppendOnlyLedger {
        &self.inner
    }
}

#[derive(Debug, Default, Clone)]
pub struct ObservableArtifactCatalog {
    inner: InMemoryArtifactCatalog,
    telemetry: InMemoryTelemetrySink,
}

impl ObservableArtifactCatalog {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn upsert(
        &mut self,
        correlation_id: CorrelationId,
        manifest: ArtifactManifest,
        recorded_at: DateTime<Utc>,
    ) -> ArtifactManifest {
        let stored = self.inner.upsert(manifest).clone();
        self.telemetry.record_trace(
            correlation_id,
            "storage",
            "upsert_artifact",
            TraceStatus::Succeeded,
            json!({
                "write_target": "object_artifacts",
                "artifact_id": stored.artifact_id.to_string(),
                "tenant_id": stored.tenant_id.to_string(),
            }),
            recorded_at,
        );
        stored
    }

    #[must_use]
    pub fn telemetry(&self) -> &InMemoryTelemetrySink {
        &self.telemetry
    }
}

#[derive(Debug, Default, Clone)]
pub struct ObservableRuntimeKernel {
    inner: InMemoryRuntimeKernel,
    telemetry: InMemoryTelemetrySink,
}

impl ObservableRuntimeKernel {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_session(
        &mut self,
        auth: &quantos_auth::AuthContext,
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> RuntimeSession {
        self.inner.open_session(auth, created_at, expires_at)
    }

    pub fn register_tool(
        &mut self,
        tool: quantos_runtime::ToolRegistration,
    ) -> Result<(), RuntimeError> {
        self.inner.register_tool(tool)
    }

    pub fn schedule_run(
        &mut self,
        input: &NewWorkflowRun,
        queued_at: DateTime<Utc>,
    ) -> Result<WorkflowRun, RuntimeError> {
        let result = self.inner.schedule_run(input.clone(), queued_at);
        let correlation_id = input.correlation_id;
        let (status, attributes) = match &result {
            Ok(run) => (
                TraceStatus::Succeeded,
                json!({
                    "write_target": "workflow_runs",
                    "workflow_run_id": run.workflow_run_id.to_string(),
                    "tool_name": run.tool_name,
                }),
            ),
            Err(error) => (
                TraceStatus::Failed,
                json!({
                    "write_target": "workflow_runs",
                    "machine_code": error.machine_code(),
                }),
            ),
        };
        self.telemetry.record_trace(
            correlation_id,
            "runtime",
            "schedule_run",
            status,
            attributes,
            queued_at,
        );
        result
    }

    pub fn save_checkpoint(
        &mut self,
        correlation_id: CorrelationId,
        run_id: quantos_core::WorkflowRunId,
        checkpoint_key: &str,
        step_index: u32,
        payload: &Value,
        recorded_at: DateTime<Utc>,
    ) -> Result<WorkflowCheckpoint, RuntimeError> {
        let result = self.inner.save_checkpoint(
            run_id,
            checkpoint_key,
            step_index,
            payload.clone(),
            recorded_at,
        );
        let (status, attributes) = match &result {
            Ok(checkpoint) => (
                TraceStatus::Succeeded,
                json!({
                    "write_target": "workflow_run_checkpoints",
                    "workflow_run_id": checkpoint.workflow_run_id.to_string(),
                    "step_index": checkpoint.step_index,
                }),
            ),
            Err(error) => (
                TraceStatus::Failed,
                json!({
                    "write_target": "workflow_run_checkpoints",
                    "machine_code": error.machine_code(),
                }),
            ),
        };
        self.telemetry.record_trace(
            correlation_id,
            "runtime",
            "save_checkpoint",
            status,
            attributes,
            recorded_at,
        );
        result
    }

    pub fn record_artifact(
        &mut self,
        correlation_id: CorrelationId,
        run_id: quantos_core::WorkflowRunId,
        manifest: &ArtifactManifest,
        recorded_at: DateTime<Utc>,
    ) -> Result<ArtifactManifest, RuntimeError> {
        let result = self
            .inner
            .record_artifact(run_id, manifest.clone(), recorded_at);
        let (status, attributes) = match &result {
            Ok(stored) => (
                TraceStatus::Succeeded,
                json!({
                    "write_target": "workflow_run_artifacts",
                    "workflow_run_id": run_id.to_string(),
                    "artifact_id": stored.artifact_id.to_string(),
                }),
            ),
            Err(error) => (
                TraceStatus::Failed,
                json!({
                    "write_target": "workflow_run_artifacts",
                    "machine_code": error.machine_code(),
                }),
            ),
        };
        self.telemetry.record_trace(
            correlation_id,
            "runtime",
            "record_artifact",
            status,
            attributes,
            recorded_at,
        );
        result
    }

    pub fn request_cancel(
        &mut self,
        correlation_id: CorrelationId,
        run_id: quantos_core::WorkflowRunId,
        requested_at: DateTime<Utc>,
    ) -> Result<(), RuntimeError> {
        let result = self.inner.request_cancel(run_id, requested_at);
        let (status, attributes) = match &result {
            Ok(()) => (
                TraceStatus::Succeeded,
                json!({ "write_target": "workflow_runs", "workflow_run_id": run_id.to_string() }),
            ),
            Err(error) => (
                TraceStatus::Failed,
                json!({
                    "write_target": "workflow_runs",
                    "machine_code": error.machine_code(),
                }),
            ),
        };
        self.telemetry.record_trace(
            correlation_id,
            "runtime",
            "request_cancel",
            status,
            attributes,
            requested_at,
        );
        result
    }

    #[must_use]
    pub fn telemetry(&self) -> &InMemoryTelemetrySink {
        &self.telemetry
    }
}

#[must_use]
pub fn build_health_report(
    service: &str,
    components: Vec<HealthComponent>,
    checked_at: DateTime<Utc>,
) -> ServiceHealthReport {
    let ready = components.iter().all(|component| component.ready);
    ServiceHealthReport {
        service: service.to_owned(),
        ready,
        components,
        checked_at,
    }
}

#[must_use]
pub fn build_adr_evidence_report(
    alerts: &[AlertRecord],
    sink: &InMemoryTelemetrySink,
    generated_at: DateTime<Utc>,
) -> AdrEvidenceReport {
    let implicated_correlations = sink.traces().iter().map(|trace| trace.correlation_id).fold(
        Vec::<CorrelationId>::new(),
        |mut values, correlation_id| {
            if !values.contains(&correlation_id) {
                values.push(correlation_id);
            }
            values
        },
    );
    let recommended_actions = alerts
        .iter()
        .map(|alert| recommended_action_for_rule(alert.rule_id.as_str()))
        .collect();

    AdrEvidenceReport {
        generated_at,
        alerts: alerts.to_vec(),
        implicated_correlations,
        summary: format!("generated {} observability alerts", alerts.len()),
        recommended_actions,
    }
}

#[must_use]
pub fn redact_value(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| {
                    if should_redact_key(key.as_str()) {
                        (key, Value::String("[REDACTED]".to_owned()))
                    } else {
                        (key, redact_value(value))
                    }
                })
                .collect(),
        ),
        Value::Array(values) => Value::Array(values.into_iter().map(redact_value).collect()),
        other => other,
    }
}

fn should_redact_key(key: &str) -> bool {
    let lowered = key.to_ascii_lowercase();
    [
        "secret",
        "token",
        "password",
        "api_key",
        "authorization",
        "credential",
        "session",
    ]
    .iter()
    .any(|needle| lowered.contains(needle))
}

fn fault_subsystem(target: FaultTarget) -> &'static str {
    match target {
        FaultTarget::Database => "database",
        FaultTarget::EventConsumer => "event_consumer",
        FaultTarget::Engine => "engine",
    }
}

fn recommended_action_for_rule(rule_id: &str) -> String {
    match rule_id {
        "outbox_oldest_age" => "inspect outbox backlog and worker liveness".to_owned(),
        "dead_letter_ratio" => "review dead letter payloads and replay readiness".to_owned(),
        "realtime_projection_delay" => {
            "check realtime wakeups, quotas, and projection consumers".to_owned()
        }
        "realtime_quota_utilization" => {
            "reduce realtime fanout or request quota increase".to_owned()
        }
        "risk_query_p95_ms" | "portfolio_query_p95_ms" => {
            "profile hot queries and validate read-model indexes".to_owned()
        }
        "risk_mv_freshness" | "ops_aggregate_freshness" => {
            "inspect materialized view refresh cadence and upstream lag".to_owned()
        }
        "storage_error_rate" => {
            "inspect storage gateway errors and Supabase bucket health".to_owned()
        }
        "secret_rotation_failed" | "secret_read_failed" => {
            "audit secret rotation state and Vault access policies".to_owned()
        }
        _ => "triage observability alert and attach recovery evidence".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;
    use quantos_auth::AuthContext;
    use quantos_core::{ContentHash, SchemaVersion, TenantId};
    use quantos_event::{NewRecordedEvent, RecordedEvent};
    use quantos_policy::{Capability, Role, RunMode};
    use quantos_runtime::ToolRegistration;
    use serde_json::json;

    use super::*;

    fn sample_auth_context() -> AuthContext {
        AuthContext {
            tenant_id: TenantId::new(),
            actor_id: quantos_core::ActorId::new(),
            user_id: uuid::Uuid::now_v7(),
            workspace_id: quantos_core::WorkspaceId::new(),
            workspace_slug: "primary".to_owned(),
            workspace_name: "Primary".to_owned(),
            role: Role::Owner,
            mode: RunMode::Paper,
            account_id: Some(quantos_core::AccountId::new()),
            capabilities: [
                Capability::parse(Capability::EXECUTION_OPERATE).expect("capability parses")
            ]
            .into_iter()
            .collect(),
        }
    }

    #[test]
    fn telemetry_redacts_secret_fields() {
        let redacted = redact_value(json!({
            "secret_token": "abc",
            "nested": { "api_key": "123", "safe": true }
        }));

        assert_eq!(redacted["secret_token"], "[REDACTED]");
        assert_eq!(redacted["nested"]["api_key"], "[REDACTED]");
        assert_eq!(redacted["nested"]["safe"], true);
    }

    #[test]
    fn capacity_alerts_cover_required_thresholds_and_adr_inputs() {
        let evaluator = CapacityAlertEvaluator;
        let base_time = Utc
            .with_ymd_and_hms(2026, 7, 30, 10, 0, 0)
            .single()
            .expect("valid timestamp");
        let snapshot = CapacitySnapshot {
            outbox_oldest_age_secs: 75.0,
            dead_letter_ratio: 0.002,
            realtime_projection_delay_secs: 8.0,
            realtime_quota_utilization: 0.8,
            risk_query_p95_ms: 350.0,
            portfolio_query_p95_ms: 330.0,
            risk_mv_freshness_secs: 90.0,
            ops_aggregate_freshness_secs: 360.0,
            storage_error_rate: 0.02,
            secret_rotation_failed: true,
            secret_read_failed: true,
        };
        let mut state = AlertWindowState::default();

        let _ = evaluator.evaluate(&snapshot, base_time, &mut state);
        let _ = evaluator.evaluate(
            &snapshot,
            base_time + ChronoDuration::minutes(16),
            &mut state,
        );
        let alerts = evaluator.evaluate(
            &snapshot,
            base_time + ChronoDuration::minutes(17),
            &mut state,
        );

        assert!(
            alerts
                .iter()
                .any(|alert| alert.rule_id == "outbox_oldest_age")
        );
        assert!(
            alerts
                .iter()
                .any(|alert| alert.rule_id == "dead_letter_ratio")
        );
        assert!(
            alerts
                .iter()
                .any(|alert| alert.rule_id == "secret_rotation_failed")
        );

        let mut sink = InMemoryTelemetrySink::new();
        let correlation_id = CorrelationId::new();
        sink.record_trace(
            correlation_id,
            "runtime",
            "schedule_run",
            TraceStatus::Succeeded,
            json!({ "write_target": "workflow_runs" }),
            base_time,
        );
        let report =
            build_adr_evidence_report(&alerts, &sink, base_time + ChronoDuration::minutes(17));
        assert!(!report.recommended_actions.is_empty());
        assert!(report.implicated_correlations.contains(&correlation_id));
    }

    #[test]
    fn observable_writes_are_indexed_by_correlation_id() {
        let tenant_id = TenantId::new();
        let correlation_id = CorrelationId::new();
        let occurred_at = Utc
            .with_ymd_and_hms(2026, 7, 30, 11, 0, 0)
            .single()
            .expect("valid timestamp");
        let event = RecordedEvent::new(NewRecordedEvent {
            tenant_id,
            correlation_id,
            aggregate_type: "workflow".to_owned(),
            aggregate_id: "run-1".to_owned(),
            sequence: 1,
            event_kind: "created".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            occurred_at,
            payload: json!({ "status": "queued" }),
        })
        .expect("event builds");
        let mut ledger = ObservableAppendOnlyLedger::new();
        ledger.append(event, occurred_at).expect("event appends");

        let mut storage = ObservableArtifactCatalog::new();
        storage.upsert(
            correlation_id,
            ArtifactManifest::new(
                tenant_id,
                "application/json",
                ContentHash::sha256_bytes(br#"artifact"#),
                "quantos-artifacts",
                8,
                occurred_at,
            ),
            occurred_at,
        );

        let mut runtime = ObservableRuntimeKernel::new();
        let auth = sample_auth_context();
        let session =
            runtime.open_session(&auth, occurred_at, occurred_at + ChronoDuration::hours(1));
        runtime
            .register_tool(ToolRegistration {
                tool_name: "research.execute".to_owned(),
                capability: Capability::parse(Capability::EXECUTION_OPERATE)
                    .expect("capability parses"),
                description: "Run research".to_owned(),
                max_cost_units: 100,
                rate_limit_per_minute: 10,
                enabled: true,
            })
            .expect("tool registers");
        let run = runtime
            .schedule_run(
                &NewWorkflowRun {
                    runtime_session_id: session.runtime_session_id,
                    tool_name: "research.execute".to_owned(),
                    capability: Capability::parse(Capability::EXECUTION_OPERATE)
                        .expect("capability parses"),
                    workflow_kind: "research".to_owned(),
                    idempotency_key: "idem-1".to_owned(),
                    correlation_id,
                    input_hash: ContentHash::sha256_bytes(br#"payload"#),
                    max_attempts: 3,
                    deadline_at: occurred_at + ChronoDuration::minutes(5),
                    cost_budget_units: 10,
                    rate_limit_per_minute: 5,
                },
                occurred_at,
            )
            .expect("run schedules");
        runtime
            .save_checkpoint(
                correlation_id,
                run.workflow_run_id,
                "step.1",
                1,
                &json!({ "done": true }),
                occurred_at,
            )
            .expect("checkpoint saves");

        assert_eq!(
            ledger
                .telemetry()
                .traces_for_correlation(correlation_id)
                .len(),
            1
        );
        assert_eq!(
            storage
                .telemetry()
                .traces_for_correlation(correlation_id)
                .len(),
            1
        );
        assert_eq!(
            runtime
                .telemetry()
                .traces_for_correlation(correlation_id)
                .len(),
            2
        );
    }

    #[test]
    fn fault_proxy_redacts_secrets_and_preserves_recovery_trace() {
        let correlation_id = CorrelationId::new();
        let recorded_at = Utc
            .with_ymd_and_hms(2026, 7, 30, 12, 0, 0)
            .single()
            .expect("valid timestamp");
        let mut sink = InMemoryTelemetrySink::new();
        let mut fault_proxy = FaultProxy::new();
        fault_proxy.inject_failures(FaultTarget::Database, 1);

        let first = fault_proxy.run(
            FaultTarget::Database,
            &mut sink,
            correlation_id,
            "commit_transaction",
            recorded_at,
            || "ok",
        );
        assert!(matches!(
            first,
            Err(FaultProxyError::Injected(FaultTarget::Database))
        ));

        let second = fault_proxy
            .run(
                FaultTarget::Database,
                &mut sink,
                correlation_id,
                "commit_transaction",
                recorded_at + ChronoDuration::seconds(1),
                || "ok",
            )
            .expect("recovery succeeds");
        assert_eq!(second, "ok");

        assert!(
            sink.logs()[0].fields["secret_token"] == "[REDACTED]"
                || sink.logs()[0].fields["secret_token"].is_null()
        );
        assert_eq!(sink.traces_for_correlation(correlation_id).len(), 2);
    }

    #[test]
    fn db_event_consumer_and_engine_faults_recover_without_secret_leaks() {
        let tenant_id = TenantId::new();
        let correlation_id = CorrelationId::new();
        let recorded_at = Utc
            .with_ymd_and_hms(2026, 7, 30, 12, 30, 0)
            .single()
            .expect("valid timestamp");
        let mut sink = InMemoryTelemetrySink::new();
        let mut fault_proxy = FaultProxy::new();
        fault_proxy.inject_failures(FaultTarget::Database, 1);
        fault_proxy.inject_failures(FaultTarget::EventConsumer, 1);
        fault_proxy.inject_failures(FaultTarget::Engine, 1);

        for (offset, target) in [
            FaultTarget::Database,
            FaultTarget::EventConsumer,
            FaultTarget::Engine,
        ]
        .into_iter()
        .enumerate()
        {
            let first = fault_proxy.run(
                target,
                &mut sink,
                correlation_id,
                "recover_chain",
                recorded_at + ChronoDuration::seconds(offset as i64),
                || "ok",
            );
            assert!(first.is_err());
            let second = fault_proxy.run(
                target,
                &mut sink,
                correlation_id,
                "recover_chain",
                recorded_at + ChronoDuration::seconds(offset as i64 + 10),
                || "ok",
            );
            assert_eq!(second.expect("recovery succeeds"), "ok");
        }

        let mut ledger = ObservableAppendOnlyLedger::new();
        for sequence in [1_u64, 2_u64] {
            let event = RecordedEvent::new(NewRecordedEvent {
                tenant_id,
                correlation_id,
                aggregate_type: "workflow".to_owned(),
                aggregate_id: "run-f09".to_owned(),
                sequence,
                event_kind: if sequence == 1 {
                    "created".to_owned()
                } else {
                    "recovered".to_owned()
                },
                schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
                occurred_at: recorded_at + ChronoDuration::seconds(sequence as i64),
                payload: json!({ "sequence": sequence }),
            })
            .expect("event builds");
            ledger
                .append(
                    event,
                    recorded_at + ChronoDuration::seconds(sequence as i64),
                )
                .expect("event appends");
        }

        assert_eq!(
            ledger
                .inner()
                .events_by_correlation_id(correlation_id)
                .len(),
            2
        );
        assert!(
            sink.logs()
                .iter()
                .all(|record| record.fields.to_string().contains("[REDACTED]"))
        );
    }

    #[test]
    fn health_report_requires_all_components_ready() {
        let checked_at = Utc
            .with_ymd_and_hms(2026, 7, 30, 13, 0, 0)
            .single()
            .expect("valid timestamp");
        let report = build_health_report(
            "runtime-gateway",
            vec![
                HealthComponent {
                    name: "database".to_owned(),
                    ready: true,
                    detail: "connected".to_owned(),
                    checked_at,
                },
                HealthComponent {
                    name: "engine-manager".to_owned(),
                    ready: false,
                    detail: "fault injected".to_owned(),
                    checked_at,
                },
            ],
            checked_at,
        );

        assert!(!report.ready);
        assert_eq!(report.service, "runtime-gateway");
    }
}
