use std::{
    env,
    sync::{
        Arc, Barrier,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
    time::{Duration, Instant},
};

use chrono::{Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{CorrelationId, SchemaVersion, TenantId};
use quantos_event::{
    NewRecordedEvent, RecordedEvent,
    pg::{InboxClaimDecision, PgEventStore},
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
            let _ = client.execute_typed(
                "delete from quantos.tenants where id = $1",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            );
        }
    }
}

#[test]
fn postgres_polling_claims_with_skip_locked_and_recovers_after_lease_expiry() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut seed_store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let events = vec![
        build_event(tenant_id, correlation_id, 1),
        build_event(tenant_id, correlation_id, 2),
    ];
    for event in &events {
        seed_store.append_event(event).expect("event appends");
    }
    let observed_at = Utc::now();

    let mut worker_a = PgEventStore::connect(&database_url).expect("worker A connects");
    let mut worker_b = PgEventStore::connect(&database_url).expect("worker B connects");
    let mut worker_c = PgEventStore::connect(&database_url).expect("worker C connects");
    let mut worker_d = PgEventStore::connect(&database_url).expect("worker D connects");

    let claimed_a = worker_a
        .claim_outbox_events("worker-a", 1, observed_at, ChronoDuration::seconds(30))
        .expect("worker A claims one row");
    let claimed_b = worker_b
        .claim_outbox_events("worker-b", 1, observed_at, ChronoDuration::seconds(30))
        .expect("worker B claims next row");
    let claimed_c = worker_c
        .claim_outbox_events("worker-c", 1, observed_at, ChronoDuration::seconds(30))
        .expect("worker C sees no remaining rows");

    assert_eq!(claimed_a.len(), 1);
    assert_eq!(claimed_b.len(), 1);
    assert!(claimed_c.is_empty());
    assert_ne!(
        claimed_a[0].outbox.outbox_entry_id,
        claimed_b[0].outbox.outbox_entry_id
    );
    assert_eq!(claimed_a[0].event.sequence, 1);
    assert_eq!(claimed_b[0].event.sequence, 2);

    let recovered = worker_d
        .claim_outbox_events(
            "worker-d",
            1,
            observed_at + ChronoDuration::seconds(31),
            ChronoDuration::seconds(30),
        )
        .expect("expired lease is claimable again");
    assert_eq!(recovered.len(), 1);
    assert_eq!(
        recovered[0].outbox.outbox_entry_id,
        claimed_a[0].outbox.outbox_entry_id
    );
    assert_eq!(recovered[0].outbox.attempts, 2);
}

#[test]
fn postgres_polling_worker_compensates_for_realtime_misses_and_replays_by_correlation() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
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

    let mut applied = Vec::new();
    let report = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            50,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |event| {
                applied.push(event.sequence);
                Ok(())
            },
            |_| Err("realtime wakeup dropped".to_owned()),
        )
        .expect("database polling consumer closes the loop");

    assert_eq!(report.claimed, 3);
    assert_eq!(report.processed, 3);
    assert_eq!(report.notify_failures, 3);
    assert_eq!(applied, vec![1, 2, 3]);

    // The five-second acceptance budget applies to correlation-chain lookup,
    // not to the preceding polling/handler/notifier workflow.
    let started_at = Instant::now();
    let replayed = store
        .events_by_correlation_id(correlation_id)
        .expect("replay query succeeds");
    assert_eq!(replayed.len(), 3);
    assert!(
        started_at.elapsed() <= Duration::from_secs(5),
        "correlation replay should stay within the F05 budget"
    );

    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-risk", &events[2].stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist");
    assert_eq!(checkpoint.next_sequence, 4);

    let second_scan = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            50,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |_| Ok(()),
            |_| Ok(()),
        )
        .expect("follow-up scan succeeds");
    assert_eq!(second_scan.claimed, 0);

    let mut client = connect_client(&database_url).expect("connects for direct verification");
    let dispatched = client
        .query_typed_one(
            "select count(*) as count
             from quantos.outbox_event
             where tenant_id = $1 and status = 'dispatched'",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )
        .expect("dispatched count query succeeds")
        .get::<_, i64>("count");
    assert_eq!(dispatched, 3);
}

#[test]
fn postgres_polling_worker_dead_letters_poison_events_after_retry_budget() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let event = build_event(tenant_id, correlation_id, 1);
    store.append_event(&event).expect("event appends");

    let first = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            10,
            Utc::now(),
            ChronoDuration::seconds(30),
            2,
            |_| Err("projection panic".to_owned()),
            |_| Ok(()),
        )
        .expect("first failure persists");
    assert_eq!(first.retried, 1);
    assert_eq!(first.dead_lettered, 0);

    let second = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            10,
            Utc::now() + ChronoDuration::seconds(2),
            ChronoDuration::seconds(30),
            2,
            |_| Err("projection panic".to_owned()),
            |_| Ok(()),
        )
        .expect("second failure dead-letters");
    assert_eq!(second.dead_lettered, 1);

    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-risk", &event.stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist after dead-letter");
    assert_eq!(checkpoint.next_sequence, 2);

    let dead_letters = store
        .dead_letters(tenant_id, "projection-risk")
        .expect("dead letter query succeeds");
    assert_eq!(dead_letters.len(), 1);
    assert_eq!(dead_letters[0].sequence, 1);

    let mut client = connect_client(&database_url).expect("connects for direct verification");
    let outbox_status = client
        .query_typed_one(
            "select status
             from quantos.outbox_event
             where tenant_id = $1 and event_log_id = (
               select id from quantos.event_log where event_id = $2
             )",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("outbox row exists")
        .get::<_, String>("status");
    assert_eq!(outbox_status, "dead_letter");

    let dead_letter_count = client
        .query_typed_one(
            "select count(*) as count
             from quantos.dead_letter_event
             where tenant_id = $1 and event_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("dead letter count query succeeds")
        .get::<_, i64>("count");
    assert_eq!(dead_letter_count, 2);
}

#[test]
fn postgres_inbox_receipt_only_allows_one_side_effect_across_thousand_delivery_attempts() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let event = build_event(tenant_id, correlation_id, 1);
    store.append_event(&event).expect("event appends");

    // A bounded worker set drives 1,000 delivery attempts without creating a
    // connection per attempt. The live target uses the transaction pooler;
    // all statements in this path are one-shot typed queries.
    let parallelism = 32;
    let attempts = 1_000;
    let barrier = Arc::new(Barrier::new(parallelism));
    let side_effect_count = Arc::new(AtomicUsize::new(0));
    let attempt_counter = Arc::new(AtomicUsize::new(0));
    let observed_at = Utc::now();

    thread::scope(|scope| {
        for worker_index in 0..parallelism {
            let database_url = database_url.clone();
            let barrier = Arc::clone(&barrier);
            let side_effect_count = Arc::clone(&side_effect_count);
            let attempt_counter = Arc::clone(&attempt_counter);
            let event = event.clone();

            scope.spawn(move || {
                let worker_name = format!("worker-{worker_index}");
                let mut store =
                    PgEventStore::connect(&database_url).expect("worker store connects");
                barrier.wait();

                loop {
                    let attempt = attempt_counter.fetch_add(1, Ordering::SeqCst);
                    if attempt >= attempts {
                        break;
                    }

                    match store
                        .claim_inbox_processing(
                            "projection-idempotent",
                            &worker_name,
                            &event,
                            observed_at,
                            ChronoDuration::seconds(30),
                        )
                        .expect("claim query succeeds")
                    {
                        InboxClaimDecision::Claimed(claim) => {
                            let previous = side_effect_count.fetch_add(1, Ordering::SeqCst);
                            assert_eq!(previous, 0, "only one worker may apply side effects");
                            store
                                .record_inbox_success(&claim, &event, observed_at)
                                .expect("winning claim commits");
                        }
                        InboxClaimDecision::AlreadyApplied | InboxClaimDecision::Busy => {}
                    }
                }
            });
        }
    });

    assert_eq!(side_effect_count.load(Ordering::SeqCst), 1);

    let mut verify_store = PgEventStore::connect(&database_url).expect("verification store");
    let checkpoint = verify_store
        .load_checkpoint(tenant_id, "projection-idempotent", &event.stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist");
    assert_eq!(checkpoint.next_sequence, 2);

    let mut client = connect_client(&database_url).expect("connects for direct verification");
    let inbox_row = client
        .query_typed_one(
            "select status
             from quantos.inbox_receipt
             where tenant_id = $1 and consumer_name = $2 and event_id = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&"projection-idempotent", Type::TEXT),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("inbox row exists");
    assert_eq!(inbox_row.get::<_, String>("status"), "applied");
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
        .execute_typed(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)
             on conflict (id) do nothing",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&slug, Type::TEXT),
                (&slug, Type::TEXT),
            ],
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
