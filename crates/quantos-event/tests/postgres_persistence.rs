use std::env;

use chrono::Utc;
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{CorrelationId, SchemaVersion, TenantId};
use quantos_event::{NewRecordedEvent, RecordedEvent, pg::PgEventStore};
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
fn postgres_event_store_persists_event_chain_outbox_inbox_and_replay() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let events = vec![
        build_event(tenant_id, correlation_id, 1),
        build_event(tenant_id, correlation_id, 2),
        build_event(tenant_id, correlation_id, 3),
    ];

    for event in &events {
        store.append_event(event).expect("event appends");
    }

    let replayed = store
        .events_by_correlation_id(correlation_id)
        .expect("replay query succeeds");
    assert_eq!(replayed.len(), 3);
    assert_eq!(
        replayed
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2, 3]
    );

    let audit_entries = store
        .audit_entries_by_correlation_id(correlation_id)
        .expect("audit query succeeds");
    assert_eq!(audit_entries.len(), 3);

    let pending_before = store
        .pending_outbox(50)
        .expect("outbox query succeeds")
        .into_iter()
        .filter(|entry| entry.outbox.tenant_id == tenant_id)
        .collect::<Vec<_>>();
    assert_eq!(pending_before.len(), 3);

    store
        .mark_outbox_dispatched(pending_before[0].outbox.outbox_entry_id, Utc::now())
        .expect("outbox dispatch updates");

    let outbox_first_failure = store
        .record_outbox_failure(
            pending_before[1].outbox.outbox_entry_id,
            "jetstream unavailable",
            2,
            Utc::now(),
        )
        .expect("first outbox failure persists");
    assert!(!outbox_first_failure);

    let outbox_second_failure = store
        .record_outbox_failure(
            pending_before[1].outbox.outbox_entry_id,
            "jetstream unavailable",
            2,
            Utc::now(),
        )
        .expect("second outbox failure persists");
    assert!(outbox_second_failure);

    store
        .record_inbox_success("projection-risk", &events[0], Utc::now())
        .expect("inbox success persists");
    store
        .record_inbox_success("projection-risk", &events[1], Utc::now())
        .expect("second inbox success persists");

    let inbox_first_failure = store
        .record_inbox_failure(
            "projection-risk",
            &events[2],
            "projection panic",
            2,
            Utc::now(),
        )
        .expect("first inbox failure persists");
    assert_eq!(inbox_first_failure.attempts, 1);
    assert!(!inbox_first_failure.dead_lettered);

    let inbox_second_failure = store
        .record_inbox_failure(
            "projection-risk",
            &events[2],
            "projection panic",
            2,
            Utc::now(),
        )
        .expect("second inbox failure persists");
    assert_eq!(inbox_second_failure.attempts, 2);
    assert!(inbox_second_failure.dead_lettered);

    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-risk", &events[2].stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist");
    assert_eq!(checkpoint.next_sequence, 4);

    let dead_letters = store
        .dead_letters(tenant_id, "projection-risk")
        .expect("dead letter query succeeds");
    assert_eq!(dead_letters.len(), 1);
    assert_eq!(dead_letters[0].sequence, 3);

    let mut client = connect_client(&database_url).expect("connects for direct verification");
    let outbox_row = client
        .query_typed_one(
            "select status, attempts
             from quantos.event_outbox
             where tenant_id = $1 and event_log_id = (
               select id from quantos.event_log where event_id = $2
             )",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (events[1].event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("outbox row exists");
    assert_eq!(outbox_row.get::<_, String>("status"), "dead_letter");
    assert_eq!(outbox_row.get::<_, i32>("attempts"), 2);

    let inbox_row = client
        .query_typed_one(
            "select status, attempts
             from quantos.event_inbox
             where tenant_id = $1 and consumer_name = $2 and event_id = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&"projection-risk", Type::TEXT),
                (events[2].event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("inbox row exists");
    assert_eq!(inbox_row.get::<_, String>("status"), "dead_letter");
    assert_eq!(inbox_row.get::<_, i32>("attempts"), 2);

    let dead_letter_count = client
        .query_typed_one(
            "select count(*) as count
             from quantos.event_dead_letters
             where tenant_id = $1 and event_id in ($2, $3)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (events[1].event_id.as_uuid(), Type::UUID),
                (events[2].event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("dead letter rows count")
        .get::<_, i64>("count");
    assert_eq!(dead_letter_count, 2);
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
    let slug = format!("f05-live-{}", tenant_id);
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
