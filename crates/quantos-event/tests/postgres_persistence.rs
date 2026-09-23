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
use quantos_core::{ActorId, CorrelationId, EventId, SchemaVersion, TenantId};
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
fn batched_success_rolls_back_when_either_lease_token_changes() {
    let Some(database_url) = live_database_url() else {
        return;
    };
    let tenant_id = TenantId::new();
    let actor_id = seed_tenant(&database_url, tenant_id);
    let correlation_id = CorrelationId::new();
    let mut store = PgEventStore::connect(&database_url).expect("consumer connects");
    let mut replacement = connect_client(&database_url).expect("replacement connects");

    for (sequence, replaced_kind) in [(1, "inbox"), (2, "outbox")] {
        let event = build_event(tenant_id, actor_id, correlation_id, sequence);
        store.append_event(&event).expect("event appends");
        let result = store.poll_outbox_once(
            "f05-batch-original",
            "projection-batch-fencing",
            1,
            Utc::now(),
            ChronoDuration::seconds(30),
            2,
            |handled, inbox_claim| {
                assert_eq!(handled.event_id, event.event_id);
                let changed = if replaced_kind == "inbox" {
                    replacement.execute_typed(
                        "update quantos.inbox_receipt set lease_token = gen_random_uuid()
                         where id = $1 and tenant_id = $2",
                        &[
                            (inbox_claim.inbox_entry_id.as_uuid(), Type::UUID),
                            (tenant_id.as_uuid(), Type::UUID),
                        ],
                    )
                } else {
                    replacement.execute_typed(
                        "update quantos.outbox_event set lease_token = gen_random_uuid()
                         where tenant_id = $1 and event_log_id =
                           (select id from quantos.event_log where event_id = $2)",
                        &[
                            (tenant_id.as_uuid(), Type::UUID),
                            (event.event_id.as_uuid(), Type::UUID),
                        ],
                    )
                }
                .expect("replacement rotates the lease token");
                assert_eq!(changed, 1);
                Ok(())
            },
            |_| Ok(()),
        );
        assert!(matches!(
            result,
            Err(PgEventStoreError::StaleLease { kind, .. }) if kind == replaced_kind
        ));

        // The batch transaction must not persist an applied receipt or advance
        // the checkpoint when either lease was replaced during the handler.
        let row = replacement
            .query_typed_one(
                "select status from quantos.inbox_receipt
                 where tenant_id = $1 and consumer_name = $2 and event_id = $3",
                &[
                    (tenant_id.as_uuid(), Type::UUID),
                    (&"projection-batch-fencing", Type::TEXT),
                    (event.event_id.as_uuid(), Type::UUID),
                ],
            )
            .expect("inbox receipt loads");
        assert_eq!(row.get::<_, String>("status"), "processing");
        let checkpoint = store
            .load_checkpoint(tenant_id, "projection-batch-fencing", &event.stream_key())
            .expect("checkpoint query succeeds");
        assert_eq!(
            checkpoint.map(|value| value.next_sequence),
            Some(sequence).filter(|_| sequence > 1)
        );

        replacement
            .execute_typed(
                "update quantos.inbox_receipt set lease_expires_at = clock_timestamp() - interval '1 second'
                 where tenant_id = $1 and consumer_name = $2 and event_id = $3",
                &[
                    (tenant_id.as_uuid(), Type::UUID),
                    (&"projection-batch-fencing", Type::TEXT),
                    (event.event_id.as_uuid(), Type::UUID),
                ],
            )
            .expect("replacement inbox lease expires");
        replacement
            .execute_typed(
                "update quantos.outbox_event set lease_expires_at = clock_timestamp() - interval '1 second'
                 where tenant_id = $1 and event_log_id =
                   (select id from quantos.event_log where event_id = $2)",
                &[
                    (tenant_id.as_uuid(), Type::UUID),
                    (event.event_id.as_uuid(), Type::UUID),
                ],
            )
            .expect("replacement outbox lease expires");
        let recovered = store
            .poll_outbox_once(
                "f05-batch-replacement",
                "projection-batch-fencing",
                1,
                Utc::now() + ChronoDuration::seconds(2),
                ChronoDuration::seconds(30),
                2,
                |handled, _| {
                    assert_eq!(handled.event_id, event.event_id);
                    Ok(())
                },
                |_| Ok(()),
            )
            .expect("replacement worker completes the event");
        assert_eq!(recovered.processed, 1);
    }
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

    // Exercise the production consumer, including lease fencing, inbox success,
    // checkpoint updates and outbox acknowledgements. Bulk SQL is fixture setup
    // only; it must never manufacture a successful consumption result.
    let mut applied = std::collections::HashSet::new();
    let consumption_started = Instant::now();
    let mut processed = 0;
    while processed < 10_000 {
        let report = store
            .poll_outbox_once(
                "f05-volume-worker",
                "projection-volume",
                250,
                Utc::now(),
                ChronoDuration::seconds(30),
                3,
                |event, _claim| {
                    assert_eq!(event.tenant_id, tenant_id);
                    assert_eq!(event.correlation_id, correlation_id);
                    assert!(applied.insert(event.event_id), "duplicate side effect");
                    Ok(())
                },
                |_| Ok(()),
            )
            .expect("volume events process through the production consumer");
        assert!(
            report.processed > 0,
            "consumer stopped before full convergence"
        );
        assert_eq!(report.retried, 0);
        assert_eq!(report.dead_lettered, 0);
        processed += report.processed;
    }
    let consumption_elapsed = consumption_started.elapsed();
    assert_eq!(processed, 10_000);
    assert_eq!(applied.len(), 10_000);
    let checkpoint = store
        .load_checkpoint(tenant_id, "projection-volume", "trade:btc-usdt")
        .expect("volume checkpoint loads")
        .expect("consumer persisted a checkpoint");
    assert_eq!(checkpoint.next_sequence, 10_001);

    // Nightly measures complete payload retrieval on disposable loopback PostgreSQL.
    // The isolated hosted target checks the same 10,000 identities across the
    // actual pooler without treating cross-region transport time as query latency.
    let hosted_target = env::var("QUANTOS_F05_TARGET_ISOLATED").as_deref() == Ok("1");
    let lookup_started = Instant::now();
    let replayed_ids = if hosted_target {
        let mut db = connect_client(&database_url).expect("target identity scan connects");
        db.query_typed(
            "select event_id from quantos.event_log
             where tenant_id = $1 and correlation_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
        )
        .expect("target event identity chain loads")
        .iter()
        .map(|row| EventId::from_uuid(row.get("event_id")))
        .collect::<std::collections::HashSet<_>>()
    } else {
        store
            .events_by_correlation_id(tenant_id, correlation_id)
            .expect("10,000 event correlation chain loads")
            .iter()
            .map(|event| event.event_id)
            .collect::<std::collections::HashSet<_>>()
    };
    let lookup_elapsed = lookup_started.elapsed();
    assert_eq!(replayed_ids.len(), 10_000);
    assert_eq!(replayed_ids, applied);
    if !hosted_target {
        assert!(
            lookup_elapsed <= Duration::from_secs(5),
            "complete 10,000 event correlation retrieval took {lookup_elapsed:?}"
        );
    }
    let health = store
        .health_snapshot(tenant_id, Utc::now())
        .expect("health snapshot loads");
    assert_eq!(health.pending_outbox, 0);
    assert_eq!(health.pending_inbox, 0);
    assert_eq!(health.pending_dead_letters, 0);
    let mut db = connect_client(&database_url).expect("final persisted counts connect");
    let row = db.query_one(
        "select (select count(*) from quantos.outbox_event where tenant_id=$1 and status='dispatched'),
                (select count(*) from quantos.inbox_receipt where tenant_id=$1 and consumer_name='projection-volume' and status='applied')",
        &[tenant_id.as_uuid()],
    ).expect("final persisted counts load");
    assert_eq!(row.get::<_, i64>(0), 10_000);
    assert_eq!(row.get::<_, i64>(1), 10_000);
    if let Ok(path) = env::var("QUANTOS_F05_MEASUREMENTS_PATH") {
        std::fs::write(
            path,
            serde_json::to_vec_pretty(&json!({
                "eventCount": processed,
                "uniqueSideEffects": applied.len(),
                "dispatched": row.get::<_, i64>(0),
                "appliedReceipts": row.get::<_, i64>(1),
                "checkpointNextSequence": checkpoint.next_sequence,
                "consumptionMillis": consumption_elapsed.as_millis(),
                "correlationLookupMillis": lookup_elapsed.as_secs_f64() * 1000.0,
                "lookupScope": if hosted_target { "target-event-id-client-retrieval" } else { "complete-client-retrieval" },
                "consumerPath": "PgEventStore::poll_outbox_once",
            }))
            .unwrap(),
        )
        .expect("measured acceptance evidence writes");
    }
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

#[test]
fn postgres_rejects_invalid_appends_and_recovers_busy_and_duplicate_receipts() {
    let Some(url) = live_database_url() else {
        return;
    };
    let tenant = TenantId::new();
    let actor = seed_tenant(&url, tenant);
    let correlation = CorrelationId::new();
    let mut store = PgEventStore::connect(&url).unwrap();
    let event = build_event(tenant, actor, correlation, 1);
    // Invalid actor fails after stream creation; the transaction must roll back.
    let invalid = build_event(tenant, ActorId::new(), correlation, 1);
    assert!(store.append_event(&invalid).is_err());
    assert!(
        store
            .events_by_correlation_id(tenant, correlation)
            .unwrap()
            .is_empty()
    );
    store.append_event(&event).unwrap();
    assert!(matches!(
        store.append_event(&event),
        Err(PgEventStoreError::Event(_))
    ));
    assert!(matches!(
        store.append_event(&build_event(tenant, actor, correlation, 3)),
        Err(PgEventStoreError::Event(_))
    ));
    let now = Utc::now();
    let original = match store
        .claim_inbox_processing(
            "coverage",
            "owner",
            &event,
            now,
            ChronoDuration::seconds(30),
        )
        .unwrap()
    {
        InboxClaimDecision::Claimed(claim) => claim,
        other => panic!("{other:?}"),
    };
    let busy = store
        .poll_outbox_once(
            "other",
            "coverage",
            1,
            now,
            ChronoDuration::seconds(30),
            2,
            |_, _| panic!("busy receipt must not invoke handler"),
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(busy.retried, 1);
    let mut stale = original.clone();
    stale.lease_token = Uuid::now_v7();
    assert!(matches!(
        store.record_inbox_failure(&stale, &event, "stale", 2, now),
        Err(PgEventStoreError::StaleLease { .. })
    ));
    store.record_inbox_success(&original, &event, now).unwrap();
    // Retry availability is based on the actual completion timestamp inside
    // poll_outbox_once. A hosted database round trip can take longer than the
    // original test's fixed clock offset, so observe from a fresh wall clock.
    let retry_observed_at = Utc::now() + ChronoDuration::seconds(2);
    let duplicate = store
        .poll_outbox_once(
            "other",
            "coverage",
            1,
            retry_observed_at,
            ChronoDuration::seconds(30),
            2,
            |_, _| panic!("applied receipt must not invoke handler"),
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(duplicate.duplicate_skipped, 1);
    let checkpoint = store
        .load_checkpoint(tenant, "coverage", &event.stream_key())
        .unwrap()
        .unwrap();
    store.save_checkpoint(&checkpoint).unwrap();
    assert!(
        store
            .load_checkpoint(tenant, "missing", &event.stream_key())
            .unwrap()
            .is_none()
    );
    assert!(matches!(
        store.claim_inbox_processing(
            "missing",
            "owner",
            &build_event(tenant, actor, correlation, 2),
            now,
            ChronoDuration::seconds(30)
        ),
        Err(PgEventStoreError::MissingEvent(_))
    ));
    // Exercise failure acknowledgement fencing before a valid completion.
    let next = build_event(tenant, actor, correlation, 2);
    store.append_event(&next).unwrap();
    let current = store
        .claim_outbox_events("owner", 1, Utc::now(), ChronoDuration::seconds(30))
        .unwrap()
        .remove(0);
    let mut stale = current.clone();
    stale.lease_token = Uuid::now_v7();
    assert!(matches!(
        store.record_outbox_failure(&stale, "coverage", "stale", 2, Utc::now()),
        Err(PgEventStoreError::StaleLease { .. })
    ));
    store.mark_outbox_dispatched(&current, Utc::now()).unwrap();

    // A claim that is already expired before handler dispatch must fail
    // closed, then be recoverable by a later worker without leaving a fixture
    // in the shared target queue.
    let expired = build_event(tenant, actor, correlation, 3);
    store.append_event(&expired).unwrap();
    let expired_at = Utc::now();
    assert!(matches!(
        store.poll_outbox_once(
            "expired-owner",
            "coverage-expired",
            1,
            expired_at,
            ChronoDuration::milliseconds(-1),
            2,
            |_, _| panic!("expired lease must fail before handler dispatch"),
            |_| Ok(()),
        ),
        Err(PgEventStoreError::StaleLease { kind: "inbox", .. })
    ));
    let recovered = store
        .poll_outbox_once(
            "recovery-owner",
            "coverage-expired",
            1,
            Utc::now() + ChronoDuration::seconds(2),
            ChronoDuration::seconds(30),
            2,
            |event, _| {
                assert_eq!(event.event_id, expired.event_id);
                Ok(())
            },
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(recovered.processed, 1);
    assert!(PgEventStore::connect("invalid URL").is_err());
    let parsed = Url::parse(&url).unwrap();
    // Only exercise plaintext/TLS rejection on an explicitly plaintext loopback fixture.
    if matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"))
        && parsed
            .query_pairs()
            .any(|(k, v)| k == "sslmode" && v == "disable")
    {
        for mode in [
            None,
            Some("disable"),
            Some("prefer"),
            Some("require"),
            Some("verify-full"),
        ] {
            let mut candidate = parsed.clone();
            candidate
                .query_pairs_mut()
                .clear()
                .append_pair("application_name", "f05-coverage");
            if let Some(mode) = mode {
                candidate.query_pairs_mut().append_pair("sslmode", mode);
            }
            let result = PgEventStore::connect(candidate.as_str());
            assert_eq!(
                result.is_ok(),
                !matches!(mode, Some("require" | "verify-full"))
            );
        }
    }
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

    let mut last_error = None;
    for attempt in 0..3 {
        let result = if disable_tls {
            Client::connect(database_url, NoTls)
        } else {
            let mut builder = TlsConnector::builder();
            if relaxed_tls {
                builder.danger_accept_invalid_certs(true);
            }
            let connector = builder.build().expect("TLS connector builds");
            Client::connect(database_url, MakeTlsConnector::new(connector))
        };
        match result {
            Ok(client) => return Ok(client),
            Err(error) if attempt < 2 => {
                last_error = Some(error);
                thread::sleep(Duration::from_secs(1));
            }
            Err(error) => return Err(error),
        }
    }
    Err(last_error.expect("a failed connection attempt records its error"))
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
