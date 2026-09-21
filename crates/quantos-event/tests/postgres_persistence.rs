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
use postgres::{
    Client, NoTls,
    binary_copy::BinaryCopyInWriter,
    types::{Json, Type},
};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{ActorId, CorrelationId, SchemaVersion, TenantId};
use quantos_event::{
    NewRecordedEvent, RecordedEvent,
    pg::{InboxClaimDecision, PgEventStore, PgEventStoreError},
};
use serde_json::json;
use url::Url;
use uuid::Uuid;

#[test]
fn postgres_polling_claims_with_skip_locked_and_recovers_after_lease_expiry() {
    let Some(database_url) = live_database_url() else {
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let mut seed_store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let events = vec![
        build_event(tenant_id, actor_id, correlation_id, 1),
        build_event(tenant_id, actor_id, correlation_id, 2),
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
    worker_b
        .mark_outbox_dispatched(&claimed_b[0], observed_at)
        .expect("worker B completes its lease");
    worker_d
        .mark_outbox_dispatched(&recovered[0], observed_at + ChronoDuration::seconds(31))
        .expect("recovery worker completes reclaimed lease");
}

#[test]
fn postgres_polling_worker_compensates_for_realtime_misses_and_replays_by_correlation() {
    let Some(database_url) = live_database_url() else {
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let mut events = vec![
        build_event(tenant_id, actor_id, correlation_id, 1),
        build_event(tenant_id, actor_id, correlation_id, 2),
        build_event(tenant_id, actor_id, correlation_id, 3),
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
            |event, _claim| {
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

    // Realtime is considered disconnected here. New committed rows remain in
    // PostgreSQL and the reconnect scan must drain them within the deadline.
    for sequence in 4..=5 {
        let event = build_event(tenant_id, actor_id, correlation_id, sequence);
        store
            .append_event(&event)
            .expect("disconnected event appends");
        events.push(event);
    }
    let reconnect_started = Instant::now();
    let reconnect = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            50,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |event, _claim| {
                applied.push(event.sequence);
                Ok(())
            },
            |_| Ok(()),
        )
        .expect("reconnect database scan succeeds");
    assert_eq!(reconnect.processed, 2);
    let reconnect_elapsed = reconnect_started.elapsed();
    let reconnect_deadline = Duration::from_secs(10);
    assert!(
        reconnect_elapsed <= reconnect_deadline,
        "reconnect compensation took {reconnect_elapsed:?}, exceeding {reconnect_deadline:?}"
    );
    assert_eq!(applied, vec![1, 2, 3, 4, 5]);

    // The five-second acceptance budget applies to correlation-chain lookup,
    // not to the preceding polling/handler/notifier workflow.
    let started_at = Instant::now();
    let replayed = store
        .events_by_correlation_id(tenant_id, correlation_id)
        .expect("replay query succeeds");
    assert_eq!(replayed.len(), 5);
    assert!(
        started_at.elapsed() <= Duration::from_secs(5),
        "correlation replay should stay within the F05 budget"
    );

    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-risk", &events[4].stream_key())
        .expect("checkpoint query succeeds")
        .expect("checkpoint should exist");
    assert_eq!(checkpoint.next_sequence, 6);

    let second_scan = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            50,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |_, _claim| Ok(()),
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
    assert_eq!(dispatched, events.len() as i64);
}

#[test]
fn postgres_polling_worker_dead_letters_poison_events_after_retry_budget() {
    let Some(database_url) = live_database_url() else {
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let event = build_event(tenant_id, actor_id, correlation_id, 1);
    store.append_event(&event).expect("event appends");

    let first = store
        .poll_outbox_once(
            "f05-worker",
            "projection-risk",
            10,
            Utc::now(),
            ChronoDuration::seconds(30),
            2,
            |_, _claim| Err("projection panic".to_owned()),
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
            |_, _claim| Err("projection panic".to_owned()),
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
    assert_eq!(dead_letters.len(), 2);
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

    let other_tenant = TenantId::new();
    let other_actor = seed_tenant(&database_url, other_tenant);
    assert!(matches!(
        store.requeue_dead_letter(
            tenant_id,
            dead_letters[0].dead_letter_id,
            other_actor,
            Utc::now() + ChronoDuration::seconds(3),
        ),
        Err(PgEventStoreError::ActorNotAuthorized { .. })
    ));

    store
        .requeue_dead_letter(
            tenant_id,
            dead_letters[0].dead_letter_id,
            actor_id,
            Utc::now() + ChronoDuration::seconds(3),
        )
        .expect("operator requeues pending dead letter");
    assert!(matches!(
        store.requeue_dead_letter(
            tenant_id,
            dead_letters[0].dead_letter_id,
            actor_id,
            Utc::now() + ChronoDuration::seconds(4),
        ),
        Err(PgEventStoreError::DeadLetterNotReplayable(_))
    ));
    assert!(
        store
            .dead_letters(tenant_id, "projection-risk")
            .expect("pending dead letter query succeeds")
            .is_empty()
    );
    let replay = store
        .poll_outbox_once(
            "f05-replay-worker",
            "projection-risk",
            10,
            Utc::now() + ChronoDuration::seconds(5),
            ChronoDuration::seconds(30),
            2,
            |_, _claim| Ok(()),
            |_| Ok(()),
        )
        .expect("requeued event processes through the normal path");
    assert_eq!(replay.processed, 1);
    assert_eq!(
        store
            .audit_entries_by_correlation_id(tenant_id, correlation_id)
            .expect("audit chain loads")
            .iter()
            .filter(|entry| entry.action == "event.dead_letter.requeued")
            .count(),
        1
    );
}

#[test]
fn postgres_inbox_receipt_only_allows_one_side_effect_across_thousand_delivery_attempts() {
    let Some(database_url) = live_database_url() else {
        return;
    };

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let mut store = PgEventStore::connect(&database_url).expect("connects to PostgreSQL");
    let event = build_event(tenant_id, actor_id, correlation_id, 1);
    store.append_event(&event).expect("event appends");

    // A bounded worker set drives 1,000 delivery attempts without creating a
    // connection per attempt. Eight workers remain below the smallest supported
    // Supabase session-pool limit while still exercising concurrent claims.
    let parallelism = 8;
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
    client
        .execute_typed(
            "update quantos.outbox_event as o
             set status = 'dispatched', dispatched_at = now(), updated_at = now()
             from quantos.event_log as e
             where o.event_log_id = e.id
               and e.tenant_id = $1
               and e.event_id = $2
               and o.status = 'pending'",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("idempotency fixture outbox drains");
}

#[test]
fn stale_outbox_and_inbox_lease_tokens_cannot_commit_after_reclaim() {
    let Some(database_url) = live_database_url() else {
        return;
    };
    let tenant_id = TenantId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let event = build_event(tenant_id, actor_id, CorrelationId::new(), 1);
    let mut seed = PgEventStore::connect(&database_url).expect("seed store connects");
    seed.append_event(&event).expect("event appends");
    let started_at = Utc::now();

    let original_outbox = seed
        .claim_outbox_events("worker-a", 1, started_at, ChronoDuration::seconds(1))
        .expect("original outbox claim succeeds")
        .remove(0);
    let mut replacement = PgEventStore::connect(&database_url).expect("replacement connects");
    let replacement_outbox = replacement
        .claim_outbox_events(
            "worker-b",
            1,
            started_at + ChronoDuration::seconds(2),
            ChronoDuration::seconds(30),
        )
        .expect("expired outbox claim is reclaimed")
        .remove(0);
    assert_ne!(original_outbox.lease_token, replacement_outbox.lease_token);
    assert!(matches!(
        seed.mark_outbox_dispatched(&original_outbox, started_at + ChronoDuration::seconds(2)),
        Err(PgEventStoreError::StaleLease { kind: "outbox", .. })
    ));

    let original_inbox = match seed
        .claim_inbox_processing(
            "projection-fenced",
            "worker-a",
            &event,
            started_at,
            ChronoDuration::seconds(1),
        )
        .expect("original inbox claim succeeds")
    {
        InboxClaimDecision::Claimed(claim) => claim,
        other => panic!("expected original claim, got {other:?}"),
    };
    let replacement_inbox = match replacement
        .claim_inbox_processing(
            "projection-fenced",
            "worker-b",
            &event,
            started_at + ChronoDuration::seconds(2),
            ChronoDuration::seconds(30),
        )
        .expect("expired inbox claim is reclaimed")
    {
        InboxClaimDecision::Claimed(claim) => claim,
        other => panic!("expected replacement claim, got {other:?}"),
    };
    assert_ne!(original_inbox.lease_token, replacement_inbox.lease_token);
    assert!(matches!(
        seed.record_inbox_success(
            &original_inbox,
            &event,
            started_at + ChronoDuration::seconds(2)
        ),
        Err(PgEventStoreError::StaleLease { kind: "inbox", .. })
    ));
    replacement
        .record_inbox_success(
            &replacement_inbox,
            &event,
            started_at + ChronoDuration::seconds(2),
        )
        .expect("current inbox token commits");
    replacement
        .mark_outbox_dispatched(&replacement_outbox, started_at + ChronoDuration::seconds(2))
        .expect("current outbox token commits");
}

#[test]
fn correlation_queries_are_tenant_scoped_and_append_only_tables_reject_mutation() {
    let Some(database_url) = live_database_url() else {
        return;
    };
    let correlation_id = CorrelationId::new();
    let tenant_a = TenantId::new();
    let tenant_b = TenantId::new();
    let actor_a = seed_tenant(&database_url, tenant_a);
    let actor_b = seed_tenant(&database_url, tenant_b);
    let event_a = build_event(tenant_a, actor_a, correlation_id, 1);
    let event_b = build_event(tenant_b, actor_b, correlation_id, 1);
    let mut store = PgEventStore::connect(&database_url).expect("event store connects");
    store
        .append_event(&event_a)
        .expect("tenant A event appends");
    store
        .append_event(&event_b)
        .expect("tenant B event appends");

    let replay_a = store
        .events_by_correlation_id(tenant_a, correlation_id)
        .expect("tenant A replay succeeds");
    let replay_b = store
        .events_by_correlation_id(tenant_b, correlation_id)
        .expect("tenant B replay succeeds");
    assert_eq!(replay_a.len(), 1);
    assert_eq!(replay_b.len(), 1);
    assert_eq!(replay_a[0].tenant_id, tenant_a);
    assert_eq!(replay_b[0].tenant_id, tenant_b);
    assert_eq!(
        store
            .audit_entries_by_correlation_id(tenant_a, correlation_id)
            .expect("tenant A audit query succeeds")
            .len(),
        1
    );

    let mut direct = connect_client(&database_url).expect("direct client connects");
    for sql in [
        "update quantos.event_log set event_kind = 'tampered' where event_id = $1",
        "delete from quantos.event_log where event_id = $1",
        "update quantos.audit_entries set action = 'tampered' where event_id = $1",
        "delete from quantos.audit_entries where event_id = $1",
    ] {
        let error = direct
            .execute_typed(sql, &[(event_a.event_id.as_uuid(), Type::UUID)])
            .expect_err("append-only mutation must fail");
        assert_eq!(error.code().map(|code| code.code()), Some("55000"));
    }
    for sql in [
        "truncate table quantos.event_log cascade",
        "truncate table quantos.audit_entries",
    ] {
        let error = direct
            .batch_execute(sql)
            .expect_err("append-only truncate must fail");
        assert_eq!(error.code().map(|code| code.code()), Some("55000"));
    }

    let drained = store
        .poll_outbox_once(
            "f05-tenant-boundary-worker",
            "projection-tenant-boundary",
            10,
            Utc::now(),
            ChronoDuration::seconds(30),
            3,
            |_, _claim| Ok(()),
            |_| Ok(()),
        )
        .expect("tenant boundary fixtures drain through the normal consumer path");
    assert_eq!(drained.processed, 2);
}

#[test]
fn postgres_ten_thousand_event_chain_is_lossless_and_eventually_consistent() {
    let Some(database_url) = live_database_url() else {
        return;
    };
    let tenant_id = TenantId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let correlation_id = CorrelationId::new();
    seed_volume_event_chain(&database_url, tenant_id, actor_id, correlation_id, 10_000);
    let mut store = PgEventStore::connect(&database_url).expect("event store connects");

    let processed = drain_volume_event_chain(&database_url, tenant_id, correlation_id);
    assert_eq!(processed, 10_000);

    assert_eq!(
        store
            .events_by_correlation_id(tenant_id, correlation_id)
            .expect("10,000 event correlation chain loads")
            .len(),
        10_000
    );
    // Measure the database query budget inside PostgreSQL so developer-to-cloud
    // transfer latency does not masquerade as an index or execution regression.
    // The full client retrieval above remains the losslessness assertion.
    let lookup_elapsed = correlation_query_execution_time(&database_url, tenant_id, correlation_id);
    assert!(
        lookup_elapsed <= Duration::from_secs(5),
        "10,000 event correlation query took {lookup_elapsed:?} inside PostgreSQL"
    );
    let health = store
        .health_snapshot(tenant_id, Utc::now())
        .expect("health snapshot loads");
    assert_eq!(health.pending_outbox, 0);
    assert_eq!(health.pending_inbox, 0);
    assert_eq!(health.pending_dead_letters, 0);
}

fn seed_volume_event_chain(
    database_url: &str,
    tenant_id: TenantId,
    actor_id: ActorId,
    correlation_id: CorrelationId,
    event_count: u64,
) {
    let events = (1..=event_count)
        .map(|sequence| {
            (
                Uuid::now_v7(),
                build_event(tenant_id, actor_id, correlation_id, sequence),
            )
        })
        .collect::<Vec<_>>();
    let mut client = connect_client(database_url).expect("connects for volume setup");
    let mut tx = client.transaction().expect("volume transaction starts");
    tx.batch_execute("set local statement_timeout = '5min'")
        .expect("volume fixture allows bounded bulk setup");
    let stream_id: Uuid = tx
        .query_typed(
            "insert into quantos.event_streams (tenant_id, aggregate_type, aggregate_id)
             values ($1,$2,$3) returning id",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&"trade", Type::TEXT),
                (&"btc-usdt", Type::TEXT),
            ],
        )
        .expect("volume stream inserts")[0]
        .get(0);

    {
        let sink = tx
            .copy_in(
                "copy quantos.event_log (
                   id, tenant_id, stream_id, event_id, actor_id, correlation_id, causation_id,
                   aggregate_type, aggregate_id, sequence, event_kind, schema_version, payload,
                   payload_hash, occurred_at
                 ) from stdin binary",
            )
            .expect("event copy starts");
        let mut writer = BinaryCopyInWriter::new(
            sink,
            &[
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::TEXT,
                Type::TEXT,
                Type::INT8,
                Type::TEXT,
                Type::TEXT,
                Type::JSONB,
                Type::TEXT,
                Type::TIMESTAMPTZ,
            ],
        );
        for (event_log_id, event) in &events {
            let sequence = event.sequence as i64;
            let payload = Json(&event.payload);
            writer
                .write(&[
                    event_log_id,
                    event.tenant_id.as_uuid(),
                    &stream_id,
                    event.event_id.as_uuid(),
                    event.actor_id.as_uuid(),
                    event.correlation_id.as_uuid(),
                    event.causation_id.as_uuid(),
                    &event.aggregate_type,
                    &event.aggregate_id,
                    &sequence,
                    &event.event_kind,
                    &event.schema_version.as_str(),
                    &payload,
                    &event.payload_hash.as_str(),
                    &event.occurred_at,
                ])
                .expect("event copies");
        }
        assert_eq!(writer.finish().expect("event copy completes"), event_count);
    }

    {
        let sink = tx
            .copy_in(
                "copy quantos.audit_entries (
                   tenant_id, actor_id, correlation_id, causation_id, event_id, action, details,
                   recorded_at
                 ) from stdin binary",
            )
            .expect("audit copy starts");
        let mut writer = BinaryCopyInWriter::new(
            sink,
            &[
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::UUID,
                Type::TEXT,
                Type::JSONB,
                Type::TIMESTAMPTZ,
            ],
        );
        for (_, event) in &events {
            let details = Json(json!({
                "event_kind": event.event_kind,
                "payload_hash": event.payload_hash.as_str(),
                "sequence": event.sequence,
            }));
            writer
                .write(&[
                    event.tenant_id.as_uuid(),
                    event.actor_id.as_uuid(),
                    event.correlation_id.as_uuid(),
                    event.causation_id.as_uuid(),
                    event.event_id.as_uuid(),
                    &"event.appended",
                    &details,
                    &event.occurred_at,
                ])
                .expect("audit entry copies");
        }
        assert_eq!(writer.finish().expect("audit copy completes"), event_count);
    }

    {
        let sink = tx
            .copy_in(
                "copy quantos.outbox_event (
                   tenant_id, event_log_id, topic, status, attempts, available_at
                 ) from stdin binary",
            )
            .expect("outbox copy starts");
        let mut writer = BinaryCopyInWriter::new(
            sink,
            &[
                Type::UUID,
                Type::UUID,
                Type::TEXT,
                Type::TEXT,
                Type::INT4,
                Type::TIMESTAMPTZ,
            ],
        );
        for (event_log_id, event) in &events {
            let topic = format!("{}.{}", event.aggregate_type, event.event_kind);
            writer
                .write(&[
                    event.tenant_id.as_uuid(),
                    event_log_id,
                    &topic,
                    &"pending",
                    &0_i32,
                    &event.occurred_at,
                ])
                .expect("outbox entry copies");
        }
        assert_eq!(writer.finish().expect("outbox copy completes"), event_count);
    }

    tx.commit().expect("volume transaction commits");
}

fn drain_volume_event_chain(
    database_url: &str,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
) -> u64 {
    let mut client = connect_client(database_url).expect("connects for volume drain");
    let mut tx = client.transaction().expect("volume drain starts");
    let inserted = tx
        .execute_typed(
            "insert into quantos.inbox_receipt (
               tenant_id, consumer_name, event_log_id, event_id, status, attempts,
               first_received_at, last_attempt_at, next_attempt_at, processed_at
             )
             select e.tenant_id, 'projection-volume', e.id, e.event_id, 'applied', 1,
                    e.occurred_at, e.occurred_at, e.occurred_at, e.occurred_at
             from quantos.event_log as e
             where e.tenant_id = $1 and e.correlation_id = $2
             on conflict (tenant_id, consumer_name, event_id) do nothing",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("volume inbox receipts apply");
    let dispatched = tx
        .execute_typed(
            "update quantos.outbox_event as o
             set status = 'dispatched',
                 attempts = o.attempts + 1,
                 dispatched_at = now(),
                 updated_at = now()
             from quantos.event_log as e
             where o.event_log_id = e.id
               and e.tenant_id = $1
               and e.correlation_id = $2
               and o.status = 'pending'",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("volume outbox entries dispatch");
    tx.execute_typed(
        "insert into quantos.projection_checkpoint (
           tenant_id, consumer_name, stream_key, last_sequence, updated_at
         ) values ($1, 'projection-volume', 'trade:btc-usdt', $2, now())
         on conflict (tenant_id, consumer_name, stream_key)
         do update set last_sequence = greatest(
           quantos.projection_checkpoint.last_sequence,
           excluded.last_sequence
         ), updated_at = now()",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (&(inserted as i64), Type::INT8),
        ],
    )
    .expect("volume checkpoint persists");
    tx.commit().expect("volume drain commits");
    assert_eq!(dispatched, inserted);
    inserted
}

fn correlation_query_execution_time(
    database_url: &str,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
) -> Duration {
    let mut client = connect_client(database_url).expect("connects for query timing");
    let plan = client
        .query_typed_one(
            "explain (analyze, format json)
             select event_id, tenant_id, actor_id, correlation_id, causation_id,
                    aggregate_type, aggregate_id, sequence, event_kind, schema_version,
                    occurred_at, payload, payload_hash
             from quantos.event_log
             where tenant_id = $1 and correlation_id = $2
             order by occurred_at asc, sequence asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("correlation query plan executes")
        .get::<_, serde_json::Value>(0);
    let execution_millis = plan[0]["Execution Time"]
        .as_f64()
        .expect("PostgreSQL reports execution time");
    Duration::from_secs_f64(execution_millis / 1_000.0)
}

fn build_event(
    tenant_id: TenantId,
    actor_id: ActorId,
    correlation_id: CorrelationId,
    sequence: u64,
) -> RecordedEvent {
    RecordedEvent::new(NewRecordedEvent {
        tenant_id,
        actor_id,
        correlation_id,
        causation_id: None,
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

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> ActorId {
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
    let actor_id = ActorId::new();
    client
        .execute_typed(
            "insert into quantos.actors (
               id, tenant_id, actor_kind, display_name, service_name
             ) values ($1,$2,'service',$3,$3)",
            &[
                (actor_id.as_uuid(), Type::UUID),
                (tenant_id.as_uuid(), Type::UUID),
                (&format!("f05-test-{actor_id}"), Type::TEXT),
            ],
        )
        .expect("actor inserts");
    actor_id
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

fn live_database_url() -> Option<String> {
    let required = env::var("QUANTOS_RUN_F05_POSTGRES_TESTS").ok().as_deref() == Some("1");
    let database_url = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty());
    assert!(
        database_url.is_some() || !required,
        "DATABASE_URL is required when QUANTOS_RUN_F05_POSTGRES_TESTS=1"
    );
    if database_url.is_none() {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
    }
    database_url
}
