use chrono::Utc;
use quantos_core::{ActorId, CorrelationId, EventId, TenantId};
use quantos_event::pg::{PgEventStore, PgEventStoreError};
use quantos_market::{
    MarketIngestor, RawMarketTick, default_approved_providers, durable::DurableMarketIngestor,
};
use std::{
    env,
    sync::{Arc, Barrier},
    thread,
    time::{Duration, Instant},
};

#[test]
fn supabase_atomic_restart_conflict_concurrency_replay_and_dead_letter() {
    if env::var("QUANTOS_RUN_R01_POSTGRES_TESTS").as_deref() != Ok("1") {
        eprintln!("R01 Supabase NOT RUN: explicit target gate required");
        return;
    }
    let url = env::var("DATABASE_URL").expect("target DATABASE_URL required");
    let tenant = TenantId::parse_str(&env::var("QUANTOS_R01_TEST_TENANT").unwrap()).unwrap();
    let foreign =
        TenantId::parse_str(&env::var("QUANTOS_R01_TEST_FOREIGN_TENANT").unwrap()).unwrap();
    let actor = ActorId::parse_str(&env::var("QUANTOS_R01_TEST_ACTOR").unwrap()).unwrap();
    let c = CorrelationId::new();
    let now = Utc::now();
    let tick = |id: &str, price: &str| RawMarketTick {
        provider: "approved.binance.spot".into(),
        source_tick_id: id.into(),
        provider_symbol: "BTC/USDT".into(),
        event_time: now,
        received_at: now,
        price: price.into(),
        volume: "1".into(),
    };
    let connect =
        || DurableMarketIngestor::connect(&url, default_approved_providers(), actor).unwrap();
    let mut i = connect();
    let started = Instant::now();
    let first = i.ingest(tenant, c, tick("first", "-1"), now).unwrap();
    assert_eq!(first.recorded_events.len(), 2);
    assert!(started.elapsed() < Duration::from_secs(5));
    println!(
        "R01 abnormal_tick_commit_ns={}",
        started.elapsed().as_nanos()
    );
    drop(i);
    let mut i = connect();
    assert!(
        i.ingest(tenant, c, tick("first", "-1"), now)
            .unwrap()
            .duplicate
    );
    assert!(matches!(
        i.ingest(tenant, c, tick("first", "100"), now),
        Err(quantos_market::durable::DurableMarketError::Store(
            PgEventStoreError::MarketSourceConflict
        ))
    ));
    let second = i.ingest(tenant, c, tick("second", "100"), now).unwrap();
    assert_eq!(second.recorded_events[0].sequence, 3);
    assert!(i.ingest(foreign, c, tick("foreign", "100"), now).is_err());
    let mut store = PgEventStore::connect_for_outbox_tenants(&url, &[tenant])
        .unwrap()
        .with_aggregate_scope("market");
    let raw = tick("rollback", "0");
    let hash = raw.source_hash().unwrap();
    let valid = MarketIngestor::with_actor(default_approved_providers(), actor)
        .ingest_tick_at(tenant, c, raw, now)
        .unwrap()
        .recorded_events;
    let mut broken = valid.clone();
    broken[1].causation_id = EventId::new();
    assert!(
        store
            .append_market_events(
                tenant,
                actor,
                "approved.binance.spot",
                "rollback",
                &hash,
                &mut broken
            )
            .is_err()
    );
    let mut retry = valid;
    assert!(
        store
            .append_market_events(
                tenant,
                actor,
                "approved.binance.spot",
                "rollback",
                &hash,
                &mut retry
            )
            .unwrap()
    );
    assert_eq!(retry[0].sequence, 4);
    assert_eq!(retry[1].sequence, 5);
    // Release idle clients before the eight-connection race on the shared Supabase pool.
    drop(i);
    drop(store);
    let barrier = Arc::new(Barrier::new(8));
    // Admit all eight sessions before spawning writers. A failed handshake cannot strand
    // seven threads at a barrier; SQL writes still race on eight independent connections.
    let writers = (0..8).map(|_| connect()).collect::<Vec<_>>();
    let mut threads = vec![];
    for mut i in writers {
        let barrier = barrier.clone();
        let raw = tick("parallel", "100");
        threads.push(thread::spawn(move || {
            barrier.wait();
            i.ingest(tenant, c, raw, now).unwrap().duplicate
        }));
    }
    assert_eq!(
        threads
            .into_iter()
            .map(|t| t.join().unwrap())
            .filter(|duplicate| !*duplicate)
            .count(),
        1
    );
    let mut i = connect();
    let mut store = PgEventStore::connect_for_outbox_tenants(&url, &[tenant])
        .unwrap()
        .with_aggregate_scope("market");
    let all = store.events_by_correlation_id(tenant, c).unwrap();
    assert_eq!(all.len(), 6);
    assert_eq!(
        all.iter().map(|e| e.sequence).collect::<Vec<_>>(),
        (1..=6).collect::<Vec<_>>()
    );
    let committed = store
        .last_market_receipt(tenant, "approved.binance.spot")
        .unwrap()
        .unwrap();
    assert!(
        !i.watchdog(tenant, c, "approved.binance.spot", committed)
            .unwrap()
    );
    assert!(
        i.watchdog(
            tenant,
            c,
            "approved.binance.spot",
            committed + chrono::Duration::seconds(4)
        )
        .unwrap()
    );
    assert!(
        !i.watchdog(
            tenant,
            c,
            "approved.binance.spot",
            committed + chrono::Duration::seconds(5)
        )
        .unwrap()
    );
    assert!(
        i.reject_frame(
            tenant,
            c,
            "approved.binance.spot",
            b"malformed",
            Utc::now(),
            "MARKET_JSON"
        )
        .unwrap()
    );
    assert!(
        !i.reject_frame(
            tenant,
            c,
            "approved.binance.spot",
            b"malformed",
            Utc::now(),
            "MARKET_JSON"
        )
        .unwrap()
    );
    let foreign_actor =
        ActorId::parse_str(&env::var("QUANTOS_R01_TEST_FOREIGN_ACTOR").unwrap()).unwrap();
    let mut empty =
        DurableMarketIngestor::connect(&url, default_approved_providers(), foreign_actor).unwrap();
    assert!(
        empty
            .watchdog(foreign, c, "approved.binance.spot", Utc::now())
            .unwrap()
    );
    assert!(
        !empty
            .watchdog(foreign, c, "approved.binance.spot", Utc::now())
            .unwrap()
    );
    let consumer = "r01-market-projection";
    // Poison outcomes take multiple remote transactions. Acquire each event's
    // existing 30-second lease immediately before handling it; this functional
    // test does not require all eight failures to fit one batch's wall clock.
    let mut dead_lettered = 0;
    for _ in 0..8 {
        let failed = store
            .poll_outbox_once(
                "r01-test",
                consumer,
                1,
                Utc::now() + chrono::Duration::seconds(6),
                chrono::Duration::seconds(30),
                1,
                |_, _| Err("injected".into()),
                |_| Ok(()),
            )
            .unwrap();
        assert_eq!(failed.claimed, 1);
        dead_lettered += failed.dead_lettered;
    }
    assert_eq!(dead_lettered, 8);
    let dead = store.dead_letters(tenant, consumer).unwrap();
    assert_eq!(dead.len(), 16);
    let dead = dead
        .into_iter()
        .map(|d| (d.event_id, d))
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(dead.len(), 8);
    for dead in dead.into_values() {
        store
            .requeue_dead_letter(tenant, dead.dead_letter_id, actor, Utc::now())
            .unwrap();
    }
    let recovered = store
        .poll_outbox_once(
            "r01-test",
            consumer,
            100,
            Utc::now(),
            chrono::Duration::seconds(30),
            3,
            |_, _| Ok(()),
            |_| Ok(()),
        )
        .unwrap();
    assert_eq!(recovered.processed, 8);
    let checkpoint = store
        .load_checkpoint(tenant, consumer, &second.recorded_events[0].stream_key())
        .unwrap()
        .unwrap();
    assert_eq!(checkpoint.next_sequence, 7);
    assert_eq!(
        store
            .poll_outbox_once(
                "r01-test",
                consumer,
                100,
                Utc::now(),
                chrono::Duration::seconds(30),
                3,
                |_, _| Ok(()),
                |_| Ok(())
            )
            .unwrap()
            .processed,
        0
    );
    println!(
        "R01_SUPABASE_PASS events=8 concurrent_unique=1 rollback_retry=PASS restart=PASS conflict=PASS watchdog=PASS dead_letter_replayed=8"
    );
}
