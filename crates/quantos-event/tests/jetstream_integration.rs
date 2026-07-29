use std::env;

use chrono::Utc;
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{CorrelationId, SchemaVersion, TenantId};
use quantos_event::{
    NewRecordedEvent, RecordedEvent,
    jetstream::{JetStreamAdapter, JetStreamConfig},
    pg::PgEventStore,
};
use serde_json::json;
use url::Url;

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute(
                "delete from quantos.tenants where id = $1",
                &[self.tenant_id.as_uuid()],
            );
        }
    }
}

#[test]
fn jetstream_adapter_publishes_and_consumes_postgres_backed_events() {
    if env::var("QUANTOS_RUN_JETSTREAM_TESTS").ok().as_deref() != Some("1") {
        eprintln!("skipping JetStream integration test: QUANTOS_RUN_JETSTREAM_TESTS is not set");
        return;
    }

    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping JetStream integration test: DATABASE_URL is not set");
        return;
    };
    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://127.0.0.1:4222".to_owned());

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let stream_suffix = tenant_id.as_uuid().simple().to_string();
    let config = JetStreamConfig {
        server_url: nats_url,
        stream_name: format!("QUANTOS_EVENTS_{stream_suffix}"),
        subject_prefix: format!("quantos.events.{stream_suffix}"),
        durable_prefix: format!("quantos-{stream_suffix}"),
        ..JetStreamConfig::default()
    };
    let adapter = JetStreamAdapter::connect(config).expect("connects to JetStream");

    let event = build_event(tenant_id, correlation_id, 1);
    store.append_event(&event).expect("event appends");

    let pending = store
        .pending_outbox(5_000)
        .expect("outbox query succeeds")
        .into_iter()
        .filter(|entry| entry.outbox.tenant_id == tenant_id)
        .collect::<Vec<_>>();
    assert_eq!(pending.len(), 1);

    let subject = adapter
        .publish_recorded_event(&pending[0].outbox.topic, &pending[0].event)
        .expect("event publishes");
    assert_eq!(subject, adapter.subject_for_topic(&pending[0].outbox.topic));
    store
        .mark_outbox_dispatched(pending[0].outbox.outbox_entry_id, Utc::now())
        .expect("outbox dispatch persists");

    let report = adapter
        .consume_into_inbox(
            &mut store,
            "projection-risk-live",
            "projection-risk-live",
            10,
            2,
            Utc::now(),
            |_| Ok(()),
        )
        .expect("messages are consumed");
    assert_eq!(report.processed, 1);
    assert_eq!(report.dead_lettered, 0);
    assert_eq!(report.retried, 0);

    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-risk-live", &event.stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist");
    assert_eq!(checkpoint.next_sequence, 2);

    let mut client = connect_client(&database_url).expect("connects for direct verification");
    let outbox_row = client
        .query_typed_one(
            "select status, dispatched_at
             from quantos.event_outbox
             where tenant_id = $1 and event_log_id = (
               select id from quantos.event_log where event_id = $2
             )",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("outbox row exists");
    assert_eq!(outbox_row.get::<_, String>("status"), "dispatched");
    assert!(
        outbox_row
            .get::<_, Option<chrono::DateTime<Utc>>>("dispatched_at")
            .is_some()
    );

    let inbox_row = client
        .query_typed_one(
            "select status, attempts
             from quantos.event_inbox
             where tenant_id = $1 and consumer_name = $2 and event_id = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&"projection-risk-live", Type::TEXT),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("inbox row exists");
    assert_eq!(inbox_row.get::<_, String>("status"), "applied");
    assert_eq!(inbox_row.get::<_, i32>("attempts"), 1);

    adapter.delete_stream().expect("stream deletes");
}

fn build_event(tenant_id: TenantId, correlation_id: CorrelationId, sequence: u64) -> RecordedEvent {
    RecordedEvent::new(NewRecordedEvent {
        tenant_id,
        correlation_id,
        aggregate_type: "trade".to_owned(),
        aggregate_id: "btc-usdt".to_owned(),
        sequence,
        event_kind: format!("TradeEvent{sequence}"),
        schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
        occurred_at: Utc::now(),
        payload: json!({
            "event_id": format!("event-{sequence}"),
            "sequence": sequence,
            "symbol": "BTCUSDT"
        }),
    })
    .expect("event builds")
}

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> TenantCleanup {
    let mut client = connect_client(database_url).expect("connects for setup");
    let slug = format!("f05-js-{}", tenant_id);
    client
        .execute(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)
             on conflict (id) do nothing",
            &[tenant_id.as_uuid(), &slug, &slug],
        )
        .expect("tenant inserts");

    TenantCleanup {
        database_url: database_url.to_owned(),
        tenant_id,
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
        let connector = builder.build().expect("TLS connector builds");
        Client::connect(database_url, MakeTlsConnector::new(connector))
    }
}
