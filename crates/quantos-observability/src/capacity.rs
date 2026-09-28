//! PostgreSQL-backed F09 capacity metric collection and restart-safe alerting.

use std::{collections::HashSet, time::Duration};

use chrono::{DateTime, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::CorrelationId;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;
use url::Url;

use crate::{
    AlertRecord, AlertSeverity, AlertWindowState, CapacityAlertEvaluator, CapacitySnapshot,
    recommended_action_for_rule, redact_value,
};

pub const REQUIRED_EXTERNAL_METRICS: [&str; 9] = [
    "realtime_projection_delay_secs",
    "realtime_quota_utilization",
    "risk_query_latency_ms",
    "portfolio_query_latency_ms",
    "risk_mv_freshness_secs",
    "ops_aggregate_freshness_secs",
    "storage_operation_error",
    "secret_rotation_failure",
    "secret_read_failure",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OperationalMetricSample {
    pub tenant_id: Option<uuid::Uuid>,
    pub metric_name: String,
    pub metric_value: f64,
    pub source: String,
    pub correlation_id: Option<CorrelationId>,
    pub attributes: Value,
    pub observed_at: DateTime<Utc>,
}

#[derive(Debug, Error)]
pub enum CapacityMonitorError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("remote F09 PostgreSQL connections require TLS")]
    InsecureRemoteConnection,
    #[error("F09 metric coverage is stale or missing: {0}")]
    MissingMetricCoverage(String),
    #[error("F09 capacity monitor already running for scope {0}")]
    ConcurrentRun(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CapacityRunEvidence {
    pub generated_at: DateTime<Utc>,
    pub incident_window: String,
    pub snapshot: CapacitySnapshot,
    pub alerts: Vec<AlertRecord>,
    pub correlation_ids: Vec<CorrelationId>,
    pub summary: String,
    pub metric_sources: Vec<String>,
    pub db_fault_result: String,
    pub event_consumer_fault_result: String,
    pub engine_fault_result: String,
    pub secret_redaction_verified: bool,
    #[serde(rename = "traceEvidence")]
    pub trace_evidence: Vec<Value>,
    pub recommended_actions: Vec<String>,
}

pub struct PgCapacityMonitor {
    client: Client,
    scope: String,
    tenant_id: Option<uuid::Uuid>,
}

impl PgCapacityMonitor {
    pub fn connect(database_url: &str) -> Result<Self, CapacityMonitorError> {
        Self::connect_scoped(database_url, "global")
    }

    pub fn connect_scoped(
        database_url: &str,
        scope: impl Into<String>,
    ) -> Result<Self, CapacityMonitorError> {
        Self::connect_scoped_for_tenant(database_url, scope, None)
    }

    pub fn connect_scoped_for_tenant(
        database_url: &str,
        scope: impl Into<String>,
        tenant_id: Option<uuid::Uuid>,
    ) -> Result<Self, CapacityMonitorError> {
        Ok(Self {
            client: connect_client(database_url)?,
            scope: scope.into(),
            tenant_id,
        })
    }

    pub fn record_metric(
        &mut self,
        sample: &OperationalMetricSample,
    ) -> Result<(), CapacityMonitorError> {
        let safe_attributes = redact_value(sample.attributes.clone());
        self.client.query_one(
            "select quantos.record_operational_metric($1,$2,$3,$4,$5,$6,$7)",
            &[
                &sample.tenant_id,
                &sample.metric_name,
                &sample.metric_value,
                &sample.source,
                &sample.correlation_id.map(|value| *value.as_uuid()),
                &safe_attributes,
                &sample.observed_at,
            ],
        )?;
        Ok(())
    }

    pub fn collect_snapshot(
        &mut self,
        observed_at: DateTime<Utc>,
        lookback: Duration,
    ) -> Result<CapacitySnapshot, CapacityMonitorError> {
        let window_start = observed_at
            - chrono::Duration::from_std(lookback)
                .expect("F09 lookback duration fits chrono duration");
        self.require_metric_coverage(window_start, observed_at)?;

        let row = self.client.query_one(
            "select
               coalesce((select extract(epoch from ($1 - min(created_at)))
                         from quantos.outbox_event
                         where status in ('pending', 'leased') and created_at <= $1 and ($3::uuid is null or tenant_id = $3)), 0)::float8,
               coalesce((select count(distinct dead.event_id)::float8
                         from quantos.dead_letter_event dead
                         join quantos.event_log event on event.event_id = dead.event_id
                         where event.ingested_at between $2 and $1
                           and ($3::uuid is null or event.tenant_id = $3))
                 / greatest((select count(*)::float8 from quantos.event_log where ingested_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), 1), 0)::float8,
               coalesce((select metric_value from quantos.operational_metric_samples where metric_name = 'realtime_projection_delay_secs' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3) order by observed_at desc limit 1), 0)::float8,
               coalesce((select metric_value from quantos.operational_metric_samples where metric_name = 'realtime_quota_utilization' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3) order by observed_at desc limit 1), 0)::float8,
               coalesce((select percentile_cont(0.95) within group (order by metric_value) from quantos.operational_metric_samples where metric_name = 'risk_query_latency_ms' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), 0)::float8,
               coalesce((select percentile_cont(0.95) within group (order by metric_value) from quantos.operational_metric_samples where metric_name = 'portfolio_query_latency_ms' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), 0)::float8,
               coalesce((select metric_value from quantos.operational_metric_samples where metric_name = 'risk_mv_freshness_secs' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3) order by observed_at desc limit 1), 0)::float8,
               coalesce((select metric_value from quantos.operational_metric_samples where metric_name = 'ops_aggregate_freshness_secs' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3) order by observed_at desc limit 1), 0)::float8,
               coalesce((select avg(metric_value) from quantos.operational_metric_samples where metric_name = 'storage_operation_error' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), 0)::float8,
               coalesce((select bool_or(metric_value > 0) from quantos.operational_metric_samples where metric_name = 'secret_rotation_failure' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), false),
               coalesce((select bool_or(metric_value > 0) from quantos.operational_metric_samples where metric_name = 'secret_read_failure' and observed_at between $2 and $1 and ($3::uuid is null or tenant_id = $3)), false)",
            &[&observed_at, &window_start, &self.tenant_id],
        )?;

        Ok(CapacitySnapshot {
            outbox_oldest_age_secs: row.get(0),
            dead_letter_ratio: row.get(1),
            realtime_projection_delay_secs: row.get(2),
            realtime_quota_utilization: row.get(3),
            risk_query_p95_ms: row.get(4),
            portfolio_query_p95_ms: row.get(5),
            risk_mv_freshness_secs: row.get(6),
            ops_aggregate_freshness_secs: row.get(7),
            storage_error_rate: row.get(8),
            secret_rotation_failed: row.get(9),
            secret_read_failed: row.get(10),
        })
    }

    pub fn evaluate_and_persist(
        &mut self,
        observed_at: DateTime<Utc>,
        lookback: Duration,
    ) -> Result<CapacityRunEvidence, CapacityMonitorError> {
        let acquired: bool = self
            .client
            .query_one(
                "select pg_try_advisory_lock(709, hashtext($1))",
                &[&self.scope],
            )?
            .get(0);
        if !acquired {
            return Err(CapacityMonitorError::ConcurrentRun(self.scope.clone()));
        }
        let result = self.evaluate_and_persist_locked(observed_at, lookback);
        let unlock = self.client.query_one(
            "select pg_advisory_unlock(709, hashtext($1))",
            &[&self.scope],
        );
        if let Err(error) = unlock {
            return Err(error.into());
        }
        result
    }

    fn evaluate_and_persist_locked(
        &mut self,
        observed_at: DateTime<Utc>,
        lookback: Duration,
    ) -> Result<CapacityRunEvidence, CapacityMonitorError> {
        let snapshot = match self.collect_snapshot(observed_at, lookback) {
            Ok(snapshot) => snapshot,
            Err(CapacityMonitorError::MissingMetricCoverage(missing)) => {
                // An observed sampling failure breaks continuity even if a
                // retry succeeds within 90 seconds of the previous good tick.
                let mut transaction = self.client.transaction()?;
                transaction.execute(
                    "delete from quantos.capacity_alert_window_state where scope = $1",
                    &[&self.scope],
                )?;
                transaction.execute(
                    "insert into quantos.capacity_alerts (
                       scope, rule_id, severity, summary, observed_value, threshold, triggered_at
                     ) values ($1,'metric_coverage_missing','critical',
                       'F09 metric producer is missing or stale', $2, $3, $4)
                     on conflict (scope, rule_id, triggered_at) do nothing",
                    &[
                        &self.scope,
                        &serde_json::json!(missing),
                        &serde_json::json!("latest sample <= 90s"),
                        &observed_at,
                    ],
                )?;
                transaction.commit()?;
                return Err(CapacityMonitorError::MissingMetricCoverage(missing));
            }
            Err(error) => return Err(error),
        };
        let mut state = self.load_window_state()?;
        let alerts = CapacityAlertEvaluator.evaluate(&snapshot, observed_at, &mut state);
        self.persist_window_state_and_alerts(&state, &alerts, observed_at)?;

        let window_start = observed_at
            - chrono::Duration::from_std(lookback)
                .expect("F09 lookback duration fits chrono duration");
        let (correlation_ids, metric_sources) = self.evidence_links(window_start, observed_at)?;
        let recommended_actions = alerts
            .iter()
            .map(|alert| recommended_action_for_rule(&alert.rule_id))
            .collect::<Vec<_>>();

        Ok(CapacityRunEvidence {
            generated_at: observed_at,
            incident_window: format!("{}/{}", window_start.to_rfc3339(), observed_at.to_rfc3339()),
            snapshot,
            summary: format!(
                "F09 collected all required live metric families and generated {} alert(s)",
                alerts.len()
            ),
            alerts,
            correlation_ids,
            metric_sources,
            db_fault_result: "NOT RUN / NO RECEIPT".to_owned(),
            event_consumer_fault_result: "NOT RUN / NO RECEIPT".to_owned(),
            engine_fault_result: "NOT RUN / NO RECEIPT".to_owned(),
            secret_redaction_verified: false,
            trace_evidence: Vec::new(),
            recommended_actions,
        })
    }

    fn require_metric_coverage(
        &mut self,
        window_start: DateTime<Utc>,
        observed_at: DateTime<Utc>,
    ) -> Result<(), CapacityMonitorError> {
        let rows = self.client.query(
            "select metric_name, max(observed_at)
             from quantos.operational_metric_samples
             where observed_at between $1 and $2
               and ($3::uuid is null or tenant_id = $3)
             group by metric_name",
            &[&window_start, &observed_at, &self.tenant_id],
        )?;
        let present = rows
            .iter()
            .filter(|row| {
                row.get::<_, DateTime<Utc>>(1) >= observed_at - chrono::Duration::seconds(90)
            })
            .map(|row| row.get::<_, String>(0))
            .collect::<HashSet<_>>();
        let missing = REQUIRED_EXTERNAL_METRICS
            .iter()
            .filter(|name| !present.contains(**name))
            .copied()
            .collect::<Vec<_>>();
        if missing.is_empty() {
            Ok(())
        } else {
            Err(CapacityMonitorError::MissingMetricCoverage(
                missing.join(", "),
            ))
        }
    }

    fn load_window_state(&mut self) -> Result<AlertWindowState, CapacityMonitorError> {
        let mut state = AlertWindowState::default();
        for row in self.client.query(
            "select rule_id, first_breach_at, consecutive_breaches, last_observed_at
             from quantos.capacity_alert_window_state where scope = $1",
            &[&self.scope],
        )? {
            let rule_id = row.get::<_, String>(0);
            let last_observed_at = row.get::<_, DateTime<Utc>>(3);
            state.last_observed_at = Some(
                state
                    .last_observed_at
                    .map_or(last_observed_at, |previous| previous.max(last_observed_at)),
            );
            if let Some(first_breach_at) = row.get::<_, Option<DateTime<Utc>>>(1) {
                state
                    .first_breach_at
                    .insert(rule_id.clone(), first_breach_at);
            }
            let consecutive = row.get::<_, i32>(2);
            if consecutive > 0 {
                state
                    .consecutive_breaches
                    .insert(rule_id, consecutive as u32);
            }
        }
        Ok(state)
    }

    fn persist_window_state_and_alerts(
        &mut self,
        state: &AlertWindowState,
        alerts: &[AlertRecord],
        observed_at: DateTime<Utc>,
    ) -> Result<(), CapacityMonitorError> {
        let mut transaction = self.client.transaction()?;
        transaction.execute(
            "delete from quantos.capacity_alert_window_state where scope = $1",
            &[&self.scope],
        )?;
        let accepted_tick = state.last_observed_at.unwrap_or(observed_at);
        let rule_ids = state
            .first_breach_at
            .keys()
            .chain(state.consecutive_breaches.keys())
            .cloned()
            .collect::<HashSet<_>>();
        for rule_id in rule_ids {
            let first_breach = state.first_breach_at.get(&rule_id).copied();
            let consecutive = state
                .consecutive_breaches
                .get(&rule_id)
                .copied()
                .unwrap_or_default() as i32;
            transaction.execute(
                "insert into quantos.capacity_alert_window_state (
                    scope, rule_id, first_breach_at, consecutive_breaches, last_observed_at
                 ) values ($1,$2,$3,$4,$5)",
                &[
                    &self.scope,
                    &rule_id,
                    &first_breach,
                    &consecutive,
                    &accepted_tick,
                ],
            )?;
        }
        for alert in alerts {
            let severity = match alert.severity {
                AlertSeverity::Warning => "warning",
                AlertSeverity::Critical => "critical",
            };
            transaction.execute(
                "insert into quantos.capacity_alerts (
                    scope, rule_id, severity, summary, observed_value, threshold, triggered_at
                 ) values ($1,$2,$3,$4,$5,$6,$7)
                 on conflict (scope, rule_id, triggered_at) do nothing",
                &[
                    &self.scope,
                    &alert.rule_id,
                    &severity,
                    &alert.summary,
                    &alert.observed_value,
                    &alert.threshold,
                    &alert.triggered_at,
                ],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }

    fn evidence_links(
        &mut self,
        window_start: DateTime<Utc>,
        observed_at: DateTime<Utc>,
    ) -> Result<(Vec<CorrelationId>, Vec<String>), CapacityMonitorError> {
        let rows = self.client.query(
            "select distinct correlation_id, source
             from quantos.operational_metric_samples
             where observed_at between $1 and $2
               and ($3::uuid is null or tenant_id = $3)
             order by source",
            &[&window_start, &observed_at, &self.tenant_id],
        )?;
        let mut correlations = Vec::new();
        let mut sources = Vec::new();
        for row in rows {
            if let Some(value) = row.get::<_, Option<uuid::Uuid>>(0) {
                let correlation_id = CorrelationId::from_uuid(value);
                if !correlations.contains(&correlation_id) {
                    correlations.push(correlation_id);
                }
            }
            let source = row.get::<_, String>(1);
            if !sources.contains(&source) {
                sources.push(source);
            }
        }
        Ok((correlations, sources))
    }
}

fn connect_client(database_url: &str) -> Result<Client, CapacityMonitorError> {
    let (mut config, root, disable_tls) = connection_config(database_url)?;
    if disable_tls {
        Ok(config.connect(NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
        if let Some(root) = root {
            builder.add_root_certificate(native_tls::Certificate::from_pem(&std::fs::read(root)?)?);
        }
        config.ssl_mode(postgres::config::SslMode::Require);
        Ok(config.connect(MakeTlsConnector::new(builder.build()?))?)
    }
}

fn connection_config(
    database_url: &str,
) -> Result<(postgres::Config, Option<String>, bool), CapacityMonitorError> {
    let url = Url::parse(database_url)?;
    let local = url
        .host_str()
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    if disable_tls && !local {
        return Err(CapacityMonitorError::InsecureRemoteConnection);
    }
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned())
        .or_else(|| std::env::var("QUANTOS_BFF_SSLROOTCERT").ok());
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
    config.connect_timeout(Duration::from_secs(10));
    Ok((config, root, disable_tls))
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;
    use serde_json::json;

    use super::*;

    #[test]
    fn required_external_metric_inventory_is_complete_and_unique() {
        assert_eq!(REQUIRED_EXTERNAL_METRICS.len(), 9);
        assert_eq!(
            REQUIRED_EXTERNAL_METRICS
                .iter()
                .collect::<HashSet<_>>()
                .len(),
            REQUIRED_EXTERNAL_METRICS.len()
        );
        assert!(REQUIRED_EXTERNAL_METRICS.contains(&"storage_operation_error"));
        assert!(REQUIRED_EXTERNAL_METRICS.contains(&"secret_read_failure"));
    }

    #[test]
    fn target_connection_accepts_verified_tls_options_without_relaxing_validation() {
        let (_, root, disabled) = connection_config(
            "postgresql://user:example@db.test.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=%2Ftmp%2Ftarget-ca.pem",
        )
        .expect("verified target URL parses");
        assert_eq!(root.as_deref(), Some("/tmp/target-ca.pem"));
        assert!(!disabled);
        assert!(matches!(
            connection_config(
                "postgresql://user:example@db.test.supabase.com:5432/postgres?sslmode=disable"
            ),
            Err(CapacityMonitorError::InsecureRemoteConnection)
        ));
    }

    #[test]
    fn capacity_evidence_serializes_for_the_adr_generator() {
        let generated_at = Utc
            .with_ymd_and_hms(2026, 8, 11, 12, 0, 0)
            .single()
            .expect("valid timestamp");
        let evidence = CapacityRunEvidence {
            generated_at,
            incident_window: "test-window".to_owned(),
            snapshot: CapacitySnapshot::default(),
            alerts: Vec::new(),
            correlation_ids: Vec::new(),
            summary: "complete".to_owned(),
            metric_sources: vec!["fixture".to_owned()],
            db_fault_result: "passed".to_owned(),
            event_consumer_fault_result: "passed".to_owned(),
            engine_fault_result: "passed".to_owned(),
            secret_redaction_verified: true,
            trace_evidence: vec![json!({"status": "succeeded"})],
            recommended_actions: Vec::new(),
        };
        let json = serde_json::to_value(evidence).expect("evidence serializes");
        assert_eq!(json["generated_at"], "2026-08-11T12:00:00Z");
        assert!(json["traceEvidence"].is_array());
    }
}
