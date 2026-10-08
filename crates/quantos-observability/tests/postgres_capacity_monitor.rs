use std::{collections::HashSet, env, time::Duration};

use chrono::{Duration as ChronoDuration, Utc};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, types::Type};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{ActorId, CorrelationId, SchemaVersion, TenantId};
use quantos_event::{NewRecordedEvent, RecordedEvent, pg::PgEventStore};
use quantos_observability::capacity::{
    CapacityMonitorError, OperationalMetricSample, PgCapacityMonitor, REQUIRED_EXTERNAL_METRICS,
};
use quantos_observability::{FaultProxy, FaultTarget, InMemoryTelemetrySink};
use quantos_runtime::pg::PgRuntimeStore;
use serde_json::json;
use url::Url;

#[test]
fn live_metrics_drive_restart_safe_windows_persist_alerts_and_build_adr_evidence() {
    if env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref() != Ok("1") {
        eprintln!("skipping isolated F09 PostgreSQL test; run make test-f09-live");
        return;
    }
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        panic!("DATABASE_URL is required when QUANTOS_RUN_F09_POSTGRES_TESTS=1");
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let actor_id = ActorId::new();
    let scope = fixture_scope("live", tenant_id);
    let _cleanup = Cleanup::seed(&database_url, tenant_id, actor_id, &scope);

    let event = RecordedEvent::new(NewRecordedEvent {
        tenant_id,
        actor_id,
        correlation_id,
        causation_id: None,
        aggregate_type: "f09-capacity".to_owned(),
        aggregate_id: scope.clone(),
        sequence: 1,
        event_kind: "CapacityFixtureCreated".to_owned(),
        schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
        occurred_at: Utc::now() - ChronoDuration::minutes(19),
        payload: json!({"fixture": "f09-capacity"}),
    })
    .expect("event builds");
    retry_target_connection(|| PgEventStore::connect(&database_url))
        .expect("event store connects")
        .append_event(&event)
        .expect("event and real outbox row persist");

    // Anchor the replay window after the real database append. The event's
    // database-assigned ingested_at is then in the final DLQ cohort even when
    // remote Supabase setup takes longer than expected.
    let final_observation = Utc::now() + ChronoDuration::seconds(1);
    let first_observation = final_observation - ChronoDuration::minutes(17);

    let mut direct = connect_client(&database_url).expect("verification client connects");
    direct.execute(
        "update quantos.outbox_event set created_at = $1 where tenant_id = $2 and event_log_id = (select id from quantos.event_log where event_id = $3)",
        &[&(first_observation - ChronoDuration::seconds(120)), tenant_id.as_uuid(), event.event_id.as_uuid()],
    ).expect("age seeded from original enqueue time");
    direct
        .execute_typed(
            "insert into quantos.dead_letter_event (
                tenant_id, source, consumer_name, event_id, actor_id, correlation_id,
                causation_id, sequence, reason, payload, created_at
             ) values ($1,'outbox','f09-capacity',$2,$3,$4,$5,1,'injected poison',$6,$7)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (actor_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
                (event.causation_id.as_uuid(), Type::UUID),
                (&json!({"redacted": true}), Type::JSONB),
                (
                    &(final_observation - ChronoDuration::minutes(1)),
                    Type::TIMESTAMPTZ,
                ),
            ],
        )
        .expect("real DLQ row persists");

    let mut rejected_writer = retry_target_connection(|| {
        PgCapacityMonitor::connect_scoped_for_tenant(
            &database_url,
            &scope,
            Some(*tenant_id.as_uuid()),
        )
    })
    .expect("metric writer connects");
    let missing = rejected_writer.collect_snapshot(first_observation, Duration::from_secs(900));
    assert!(
        matches!(missing, Err(CapacityMonitorError::MissingMetricCoverage(_))),
        "an incomplete metric window must fail closed"
    );
    direct
        .query_one("select pg_advisory_lock(709, hashtext($1))", &[&scope])
        .expect("hold independent monitor lease");
    let concurrent =
        rejected_writer.evaluate_and_persist(first_observation, Duration::from_secs(900));
    assert!(matches!(
        concurrent,
        Err(CapacityMonitorError::ConcurrentRun(_))
    ));
    direct
        .query_one("select pg_advisory_unlock(709, hashtext($1))", &[&scope])
        .expect("release independent monitor lease");
    let rejected = rejected_writer.record_metric(&OperationalMetricSample {
        tenant_id: Some(*tenant_id.as_uuid()),
        metric_name: "storage_operation_error".to_owned(),
        metric_value: 0.0,
        source: "storage_operation_error".to_owned(),
        correlation_id: Some(correlation_id),
        attributes: json!({"secret_token": "must-not-persist"}),
        observed_at: first_observation,
    });
    assert!(
        rejected.is_err(),
        "sensitive metric attributes must fail closed"
    );
    let invalid_ratio = rejected_writer.record_metric(&OperationalMetricSample {
        tenant_id: Some(*tenant_id.as_uuid()),
        metric_name: "realtime_quota_utilization".to_owned(),
        metric_value: 1.5,
        source: "realtime_quota_utilization".to_owned(),
        correlation_id: Some(correlation_id),
        attributes: json!({}),
        observed_at: first_observation,
    });
    assert!(
        invalid_ratio.is_err(),
        "quota utilization above 100% must fail closed"
    );

    record_breaching_external_metrics(
        &mut rejected_writer,
        tenant_id,
        correlation_id,
        first_observation,
    );
    eprintln!("F09 capacity phase seed_remaining_metric_minutes");
    seed_remaining_metric_minutes(&mut direct, tenant_id, correlation_id, first_observation);
    let mut monitor = retry_target_connection(|| {
        PgCapacityMonitor::connect_scoped_for_tenant(
            &database_url,
            &scope,
            Some(*tenant_id.as_uuid()),
        )
    })
    .expect("capacity monitor connects");
    for minute in 0..=17 {
        eprintln!("F09 capacity continuity tick {minute}/17");
        let observed_at = first_observation + ChronoDuration::minutes(minute);
        if minute == 8 {
            eprintln!("F09 capacity phase reconnect_tick8");
            monitor = retry_target_connection(|| {
                PgCapacityMonitor::connect_scoped_for_tenant(
                    &database_url,
                    &scope,
                    Some(*tenant_id.as_uuid()),
                )
            })
            .expect("capacity monitor reconnects midway through the window");
        }
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
            assert!(!evidence.secret_redaction_verified);
            assert!(evidence.trace_evidence.is_empty());
            assert_eq!(evidence.db_fault_result, "NOT RUN / NO RECEIPT");
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

    // A failed sample read between adjacent valid ticks must erase persisted
    // continuity. Otherwise a fast recovery reuses a pre-failure 15m window.
    direct.execute(
        "delete from quantos.operational_metric_samples where tenant_id = $1 and metric_name = 'realtime_quota_utilization'",
        &[tenant_id.as_uuid()],
    ).unwrap();
    let retry_at = final_observation + ChronoDuration::seconds(1);
    assert!(matches!(
        monitor.evaluate_and_persist(retry_at, Duration::from_secs(900)),
        Err(CapacityMonitorError::MissingMetricCoverage(_))
    ));
    let remaining: i64 = direct
        .query_one(
            "select count(*) from quantos.capacity_alert_window_state where scope = $1",
            &[&scope],
        )
        .unwrap()
        .get(0);
    assert_eq!(
        remaining, 0,
        "missing coverage must clear persisted breach state"
    );
    record_breaching_external_metrics(&mut monitor, tenant_id, correlation_id, retry_at);
    let recovered = monitor
        .evaluate_and_persist(retry_at, Duration::from_secs(900))
        .unwrap();
    for rule in [
        "outbox_oldest_age",
        "risk_mv_freshness",
        "ops_aggregate_freshness",
    ] {
        assert!(
            !recovered.alerts.iter().any(|alert| alert.rule_id == rule),
            "recovery reused pre-gap state for {rule}"
        );
    }
}

#[test]
fn fault_proxy_retries_real_postgres_event_and_consumer_chain() {
    if env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref() != Ok("1") {
        return;
    }
    let database_url = env::var("DATABASE_URL").expect("isolated DATABASE_URL required");
    let tenant_id = TenantId::new();
    let actor_id = ActorId::new();
    let correlation_id = CorrelationId::new();
    let scope = fixture_scope("fault", tenant_id);
    let _cleanup = Cleanup::seed(&database_url, tenant_id, actor_id, &scope);
    let now = Utc::now();
    let event = RecordedEvent::new(NewRecordedEvent {
        tenant_id,
        actor_id,
        correlation_id,
        causation_id: None,
        aggregate_type: "f09-fault".to_owned(),
        aggregate_id: scope,
        sequence: 1,
        event_kind: "FaultRecovered".to_owned(),
        schema_version: SchemaVersion::parse("v1").unwrap(),
        occurred_at: now,
        payload: json!({"safe": true}),
    })
    .unwrap();
    let mut store = retry_target_connection(|| {
        PgEventStore::connect_for_outbox_tenants(&database_url, &[tenant_id])
    })
    .unwrap();
    let mut fixture_client = connect_client(&database_url).expect("fixture updater connects");
    let prioritize_fixture = |client: &mut Client| {
        let updated = client
            .execute(
                "update quantos.outbox_event set available_at = '1900-01-01'::timestamptz
             where event_log_id = (select id from quantos.event_log where event_id = $1)
               and status in ('pending','leased')",
                &[event.event_id.as_uuid()],
            )
            .expect("only this F09 outbox fixture is prioritized");
        assert_eq!(updated, 1, "F09 outbox fixture must exist before polling");
    };
    let mut proxy = FaultProxy::new();
    let mut telemetry = InMemoryTelemetrySink::new();
    proxy.inject_failures(FaultTarget::Database, 1);
    assert!(
        proxy
            .run(
                FaultTarget::Database,
                &mut telemetry,
                correlation_id,
                "append_event",
                now,
                || store.append_event(&event)
            )
            .is_err()
    );
    proxy
        .run(
            FaultTarget::Database,
            &mut telemetry,
            correlation_id,
            "append_event",
            now + ChronoDuration::seconds(1),
            || store.append_event(&event),
        )
        .unwrap()
        .unwrap();
    assert_eq!(
        store
            .events_by_correlation_id(tenant_id, correlation_id)
            .unwrap()
            .len(),
        1
    );
    prioritize_fixture(&mut fixture_client);

    proxy.inject_failures(FaultTarget::EventConsumer, 1);
    let first = store
        .poll_outbox_once(
            "f09-worker",
            "f09-consumer",
            1,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |_, _| {
                proxy
                    .run(
                        FaultTarget::EventConsumer,
                        &mut telemetry,
                        correlation_id,
                        "consume_event",
                        Utc::now(),
                        || (),
                    )
                    .map_err(|error| error.to_string())
            },
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(first.retried, 1);
    prioritize_fixture(&mut fixture_client);
    std::thread::sleep(Duration::from_secs(4));
    let second = store
        .poll_outbox_once(
            "f09-worker",
            "f09-consumer",
            1,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |_, _| {
                proxy
                    .run(
                        FaultTarget::EventConsumer,
                        &mut telemetry,
                        correlation_id,
                        "consume_event",
                        Utc::now(),
                        || (),
                    )
                    .map_err(|error| error.to_string())
            },
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(second.processed, 1);
    let projection_samples = connect_client(&database_url)
        .expect("metric verifier connects")
        .query_one(
            "select count(*)::bigint from quantos.operational_metric_samples
             where tenant_id = $1 and metric_name = 'realtime_projection_delay_secs'
               and correlation_id = $2",
            &[tenant_id.as_uuid(), correlation_id.as_uuid()],
        )
        .expect("projection sample query succeeds")
        .get::<_, i64>(0);
    assert_eq!(
        projection_samples, 1,
        "real consumer completion emits one sample"
    );
    assert_eq!(
        store
            .events_by_correlation_id(tenant_id, correlation_id)
            .unwrap()
            .len(),
        1
    );
    let logs = serde_json::to_string(telemetry.logs()).unwrap();
    assert!(!logs.contains("should-be-redacted"));
    assert!(logs.contains("[REDACTED]"));
}

#[test]
fn live_database_session_termination_preserves_ordered_event_chain() {
    if env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref() != Ok("1") {
        return;
    }
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL required");
    let tenant_id = TenantId::new();
    let actor_id = ActorId::new();
    let correlation_id = CorrelationId::new();
    let scope = fixture_scope("db-disconnect", tenant_id);
    let _cleanup = Cleanup::seed(&database_url, tenant_id, actor_id, &scope);
    let mut store = retry_target_connection(|| PgEventStore::connect(&database_url))
        .expect("event store connects");
    let event = |sequence| {
        RecordedEvent::new(NewRecordedEvent {
            tenant_id,
            actor_id,
            correlation_id,
            causation_id: None,
            aggregate_type: "f09-db-disconnect".to_owned(),
            aggregate_id: scope.clone(),
            sequence,
            event_kind: "ConnectionRecovered".to_owned(),
            schema_version: SchemaVersion::parse("v1").unwrap(),
            occurred_at: Utc::now(),
            payload: json!({"safe": true, "sequence": sequence}),
        })
        .unwrap()
    };
    let first = event(1);
    store.append_event(&first).expect("first event commits");

    // Terminate only this test's own connection. No shared database outage or
    // other session is touched on the user's test Supabase project.
    let mut doomed = connect_client(&database_url).expect("fault session connects");
    let termination = doomed.query_one("select pg_terminate_backend(pg_backend_pid())", &[]);
    assert!(termination.is_err(), "the fault session must disconnect");
    assert!(doomed.query_one("select 1", &[]).is_err());

    drop(store);
    let mut recovered = retry_target_connection(|| PgEventStore::connect(&database_url))
        .expect("reconnect succeeds");
    let second = event(2);
    recovered
        .append_event(&second)
        .expect("second event commits");
    let chain = recovered
        .events_by_correlation_id(tenant_id, correlation_id)
        .expect("event chain remains queryable");
    assert_eq!(chain.len(), 2);
    assert_eq!(chain[0].event_id, first.event_id);
    assert_eq!(chain[1].event_id, second.event_id);
    assert_eq!(chain[0].sequence, 1);
    assert_eq!(chain[1].sequence, 2);
    eprintln!("F09 database termination recovered; correlation={correlation_id}; ordered_events=2");
}

#[test]
fn restricted_runtime_role_records_only_real_storage_outcomes() {
    if env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref() != Ok("1") {
        return;
    }
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL required");
    let runtime_url = env::var("QUANTOS_RUNTIME_DATABASE_URL")
        .expect("QUANTOS_RUNTIME_DATABASE_URL required for restricted producer test");
    let tenant_id = TenantId::new();
    let actor_id = ActorId::new();
    let correlation_id = CorrelationId::new();
    let scope = format!("f09-runtime-metric-{tenant_id}");
    let _cleanup = Cleanup::seed(&database_url, tenant_id, actor_id, &scope);
    let mut runtime = retry_target_connection(|| PgRuntimeStore::connect_as_runtime(&runtime_url))
        .expect("restricted Runtime database role connects");
    runtime
        .record_storage_operation(tenant_id, correlation_id, false, Utc::now())
        .expect("successful Storage result records zero");
    runtime
        .record_storage_operation(tenant_id, correlation_id, true, Utc::now())
        .expect("failed Storage result records one");
    let mut verifier = connect_client(&database_url).expect("verification client connects");
    let values = verifier
        .query(
            "select metric_value from quantos.operational_metric_samples
             where tenant_id = $1 and metric_name = 'storage_operation_error'
               and correlation_id = $2 order by observed_at, id",
            &[tenant_id.as_uuid(), correlation_id.as_uuid()],
        )
        .expect("persisted runtime metrics query succeeds")
        .into_iter()
        .map(|row| row.get::<_, f64>(0))
        .collect::<Vec<_>>();
    assert_eq!(values.len(), 2);
    assert!(values.contains(&0.0) && values.contains(&1.0));
}

fn record_breaching_external_metrics(
    monitor: &mut PgCapacityMonitor,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
    observed_at: chrono::DateTime<Utc>,
) {
    for (metric_name, value) in breaching_metrics() {
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

fn breaching_metrics() -> [(&'static str, f64); 9] {
    [
        ("realtime_projection_delay_secs", 8.0),
        ("realtime_quota_utilization", 0.8),
        ("risk_query_latency_ms", 350.0),
        ("portfolio_query_latency_ms", 340.0),
        ("risk_mv_freshness_secs", 90.0),
        ("ops_aggregate_freshness_secs", 360.0),
        ("storage_operation_error", 1.0),
        ("secret_rotation_failure", 1.0),
        ("secret_read_failure", 1.0),
    ]
}

fn seed_remaining_metric_minutes(
    client: &mut Client,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
    first_observation: chrono::DateTime<Utc>,
) {
    let mut rows = Vec::new();
    for minute in 1..=17 {
        for (name, value) in breaching_metrics() {
            rows.push(json!({
                "name": name,
                "value": value,
                "observed_at": (first_observation + ChronoDuration::minutes(minute)).to_rfc3339(),
            }));
        }
    }
    client.execute(
        "insert into quantos.operational_metric_samples (
            tenant_id, metric_name, metric_value, source, correlation_id, attributes, observed_at
         ) select $1, sample.name, sample.value, sample.name, $2, '{}'::jsonb, sample.observed_at
           from jsonb_to_recordset($3::jsonb) as sample(name text, value double precision, observed_at timestamptz)",
        &[tenant_id.as_uuid(), correlation_id.as_uuid(), &json!(rows)],
    ).expect("continuous metric samples persist in one batch");
}

struct Cleanup {
    database_url: String,
    tenant_id: TenantId,
    scope: String,
    actor_id: ActorId,
}

impl Cleanup {
    fn seed(database_url: &str, tenant_id: TenantId, actor_id: ActorId, scope: &str) -> Self {
        if let Ok(manifest) = env::var("QUANTOS_F09_FIXTURE_MANIFEST") {
            use std::io::Write;
            let run = env::var("QUANTOS_F09_FIXTURE_RUN").expect("fixture run required");
            uuid::Uuid::parse_str(&run).expect("fixture run UUID");
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(manifest)
                .expect("fixture manifest");
            writeln!(file,"{}",json!({"run":run,"tenantId":tenant_id.as_uuid(),"actorId":actor_id.as_uuid(),"scope":scope})).expect("fixture registered before SQL");
        }
        let mut client = connect_client(database_url).expect("setup client connects");
        client
            .execute_typed(
                "insert into quantos.tenants (id, slug, name) values ($1,$2,$2)",
                &[(tenant_id.as_uuid(), Type::UUID), (&scope, Type::TEXT)],
            )
            .expect("tenant fixture inserts");
        client
            .execute_typed(
                "insert into quantos.actors (
                   id, tenant_id, actor_kind, display_name, service_name
                 ) values ($1,$2,'service',$3,$3)",
                &[
                    (actor_id.as_uuid(), Type::UUID),
                    (tenant_id.as_uuid(), Type::UUID),
                    (&format!("f09-test-{actor_id}"), Type::TEXT),
                ],
            )
            .expect("actor fixture inserts");
        Self {
            database_url: database_url.to_owned(),
            tenant_id,
            scope: scope.to_owned(),
            actor_id,
        }
    }
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _=client.execute_typed("update quantos.actors set is_active=false where id=$1 and tenant_id=$2 and service_name=$3 and exists(select 1 from quantos.tenants where id=$2 and slug=$4)",&[(self.actor_id.as_uuid(),Type::UUID),(self.tenant_id.as_uuid(),Type::UUID),(&format!("f09-test-{}",self.actor_id),Type::TEXT),(&self.scope,Type::TEXT)]);
        }
    }
}
fn fixture_scope(kind: &str, tenant_id: TenantId) -> String {
    match env::var("QUANTOS_F09_FIXTURE_RUN") {
        Ok(run) => format!("f09-{kind}-{run}-{tenant_id}"),
        Err(_) => format!("f09-{kind}-{tenant_id}"),
    }
}

fn connect_client(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let local = url
        .host_str()
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    assert!(!disable_tls || local, "remote F09 database requires TLS");
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned())
        .or_else(|| env::var("QUANTOS_BFF_SSLROOTCERT").ok());
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
    retry_target_connection(|| {
        if disable_tls {
            config.connect(NoTls)
        } else {
            let mut builder = SslConnector::builder(SslMethod::tls()).expect("F09 TLS initializes");
            builder.set_verify(SslVerifyMode::PEER);
            if let Some(root) = &root {
                builder.set_ca_file(root).expect("F09 CA file loads");
            } else {
                builder
                    .set_default_verify_paths()
                    .expect("F09 system CA roots load");
            }
            config.ssl_mode(postgres::config::SslMode::Require);
            config.connect(MakeTlsConnector::new(builder.build()))
        }
    })
}

// A remote Supabase endpoint can close a new TLS handshake before PostgreSQL
// receives any query. Retry only connection establishment; assertions and
// business operations never retry, so an injected fault still has to recover.
fn retry_target_connection<T, E>(mut connect: impl FnMut() -> Result<T, E>) -> Result<T, E> {
    for attempt in 1..4 {
        match connect() {
            Ok(value) => return Ok(value),
            Err(_) => {
                eprintln!("F09 target connection attempt {attempt}/4 failed");
                std::thread::sleep(Duration::from_secs(2));
            }
        }
    }
    connect()
}
