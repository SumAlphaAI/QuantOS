use std::{collections::HashSet, env, time::Duration};

use chrono::{Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{CorrelationId, SchemaVersion, TenantId};
use quantos_event::{NewRecordedEvent, RecordedEvent, pg::PgEventStore};
use quantos_observability::capacity::{
    CapacityMonitorError, OperationalMetricSample, PgCapacityMonitor, REQUIRED_EXTERNAL_METRICS,
};
use serde_json::json;
use url::Url;

#[test]
fn live_metrics_drive_restart_safe_windows_persist_alerts_and_build_adr_evidence() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        eprintln!("skipping live F09 capacity test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let scope = format!("f09-live-{tenant_id}");
    let final_observation = Utc::now();
    let first_observation = final_observation - ChronoDuration::minutes(17);
    let second_observation = final_observation - ChronoDuration::minutes(8);
    let _cleanup = Cleanup::seed(&database_url, tenant_id, &scope);

    let event = RecordedEvent::new(NewRecordedEvent {
        tenant_id,
        correlation_id,
        aggregate_type: "f09-capacity".to_owned(),
        aggregate_id: scope.clone(),
        sequence: 1,
        event_kind: "CapacityFixtureCreated".to_owned(),
        schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
        occurred_at: first_observation - ChronoDuration::seconds(120),
        payload: json!({"fixture": "f09-capacity"}),
    })
    .expect("event builds");
    PgEventStore::connect(&database_url)
        .expect("event store connects")
        .append_event(&event)
        .expect("event and real outbox row persist");

    let mut direct = connect_client(&database_url).expect("verification client connects");
    direct
        .execute_typed(
            "insert into quantos.dead_letter_event (
                tenant_id, source, consumer_name, event_id, correlation_id, sequence,
                reason, payload, created_at
             ) values ($1,'outbox','f09-capacity',$2,$3,1,'injected poison',$4,$5)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
                (&json!({"redacted": true}), Type::JSONB),
                (
                    &(final_observation - ChronoDuration::minutes(1)),
                    Type::TIMESTAMPTZ,
                ),
            ],
        )
        .expect("real DLQ row persists");

    let mut rejected_writer = PgCapacityMonitor::connect_scoped_for_tenant(
        &database_url,
        &scope,
        Some(*tenant_id.as_uuid()),
    )
    .expect("metric writer connects");
    let missing = rejected_writer.collect_snapshot(first_observation, Duration::from_secs(900));
    assert!(
        matches!(missing, Err(CapacityMonitorError::MissingMetricCoverage(_))),
        "an incomplete metric window must fail closed"
    );
    let rejected = rejected_writer.record_metric(&OperationalMetricSample {
        tenant_id: Some(*tenant_id.as_uuid()),
        metric_name: "storage_operation_error".to_owned(),
        metric_value: 0.0,
        source: "f09-sensitive-negative-test".to_owned(),
        correlation_id: Some(correlation_id),
        attributes: json!({"secret_token": "must-not-persist"}),
        observed_at: first_observation,
    });
    assert!(
        rejected.is_err(),
        "sensitive metric attributes must fail closed"
    );

    for observed_at in [first_observation, second_observation, final_observation] {
        let mut monitor = PgCapacityMonitor::connect_scoped_for_tenant(
            &database_url,
            &scope,
            Some(*tenant_id.as_uuid()),
        )
        .expect("capacity monitor reconnects for each scheduled tick");
        record_breaching_external_metrics(&mut monitor, tenant_id, correlation_id, observed_at);
        let evidence = monitor
            .evaluate_and_persist(observed_at, Duration::from_secs(15 * 60))
            .expect("complete live metric window evaluates");
        if observed_at == final_observation {
            let rules = evidence
                .alerts
                .iter()
                .map(|alert| alert.rule_id.as_str())
                .collect::<HashSet<_>>();
            assert_eq!(rules.len(), 11);
            for expected in [
                "outbox_oldest_age",
                "dead_letter_ratio",
                "realtime_projection_delay",
                "realtime_quota_utilization",
                "risk_query_p95_ms",
                "portfolio_query_p95_ms",
                "risk_mv_freshness",
                "ops_aggregate_freshness",
                "storage_error_rate",
                "secret_rotation_failed",
                "secret_read_failed",
            ] {
                assert!(rules.contains(expected), "missing alert {expected}");
            }
            assert!(evidence.correlation_ids.contains(&correlation_id));
            assert_eq!(
                evidence.metric_sources.len(),
                REQUIRED_EXTERNAL_METRICS.len()
            );
            assert!(evidence.secret_redaction_verified);
        }
    }

    let persisted = direct
        .query_one(
            "select count(*)::bigint from quantos.capacity_alerts where scope = $1",
            &[&scope],
        )
        .expect("persisted alerts query succeeds")
        .get::<_, i64>(0);
    assert!(persisted >= 11, "all alert families must persist");
}

fn record_breaching_external_metrics(
    monitor: &mut PgCapacityMonitor,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
    observed_at: chrono::DateTime<Utc>,
) {
    for (metric_name, value) in [
        ("realtime_projection_delay_secs", 8.0),
        ("realtime_quota_utilization", 0.8),
        ("risk_query_latency_ms", 350.0),
        ("portfolio_query_latency_ms", 340.0),
        ("risk_mv_freshness_secs", 90.0),
        ("ops_aggregate_freshness_secs", 360.0),
        ("storage_operation_error", 1.0),
        ("secret_rotation_failure", 1.0),
        ("secret_read_failure", 1.0),
    ] {
        monitor
            .record_metric(&OperationalMetricSample {
                tenant_id: Some(*tenant_id.as_uuid()),
                metric_name: metric_name.to_owned(),
                metric_value: value,
                source: metric_name.to_owned(),
                correlation_id: Some(correlation_id),
                attributes: json!({"fixture": "f09-live", "redaction_checked": true}),
                observed_at,
            })
            .expect("metric sample persists");
    }
}

struct Cleanup {
    database_url: String,
    tenant_id: TenantId,
    scope: String,
}

impl Cleanup {
    fn seed(database_url: &str, tenant_id: TenantId, scope: &str) -> Self {
        let mut client = connect_client(database_url).expect("setup client connects");
        client
            .execute_typed(
                "insert into quantos.tenants (id, slug, name) values ($1,$2,$2)",
                &[(tenant_id.as_uuid(), Type::UUID), (&scope, Type::TEXT)],
            )
            .expect("tenant fixture inserts");
        Self {
            database_url: database_url.to_owned(),
            tenant_id,
            scope: scope.to_owned(),
        }
    }
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute(
                "delete from quantos.capacity_alerts where scope = $1",
                &[&self.scope],
            );
            let _ = client.execute(
                "delete from quantos.capacity_alert_window_state where scope = $1",
                &[&self.scope],
            );
            let _ = client.execute_typed(
                "delete from quantos.tenants where id = $1",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            );
        }
    }
}

fn connect_client(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));
    if disable_tls {
        Client::connect(database_url, NoTls)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        Client::connect(
            database_url,
            MakeTlsConnector::new(builder.build().expect("TLS connector initializes")),
        )
    }
}
