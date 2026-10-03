use chrono::{Duration, Utc};
use quantos_core::{ActorId, CorrelationId, TenantId};
use quantos_event::pg::PgEventStore;
use quantos_market::{
    ApprovedProviderRegistry, RawMarketTick, default_approved_providers,
    durable::DurableMarketIngestor,
};
use serde_json::json;
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::Path,
    process::{Command, Output},
};
fn enabled() -> bool {
    std::env::var("QUANTOS_RUN_R01_POSTGRES_TESTS").as_deref() == Ok("1")
}
fn target() -> (String, TenantId, ActorId) {
    (
        std::env::var("DATABASE_URL").unwrap(),
        TenantId::parse_str(&std::env::var("QUANTOS_R01_BINANCE_TENANT").unwrap()).unwrap(),
        ActorId::parse_str(&std::env::var("QUANTOS_R01_BINANCE_ACTOR").unwrap()).unwrap(),
    )
}
fn registry(provider: &str) -> ApprovedProviderRegistry {
    let mut p = default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    p.provider = provider.into();
    p.freshness_sla_secs = 2;
    ApprovedProviderRegistry::new([p]).unwrap()
}
fn ticks(provider: &str, start: i64, n: i64) -> Vec<RawMarketTick> {
    (start..start + n)
        .map(|id| RawMarketTick {
            provider: provider.into(),
            source_tick_id: format!("BTCUSDT:agg:{id}"),
            provider_symbol: "BTCUSDT".into(),
            event_time: Utc::now(),
            received_at: Utc::now(),
            price: "100.1250".into(),
            volume: "2.00".into(),
        })
        .collect()
}
#[test]
fn supabase_pages_are_atomic_and_empty_polls_are_transport_health() {
    if !enabled() {
        eprintln!("Binance Supabase NOT RUN");
        return;
    }
    let (db, t, a) = target();
    let provider = format!("fixture.binance.atomic.{}", CorrelationId::new());
    let mut writer = DurableMarketIngestor::connect(&db, registry(&provider), a).unwrap();
    let c = CorrelationId::new();
    assert_eq!(
        writer.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
        None
    );
    assert!(
        !writer
            .binance_watchdog(t, c, &provider, "BTCUSDT", Utc::now())
            .unwrap()
    );
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 7, ticks(&provider, 7, 1001))
            .is_err()
    );
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", -1, vec![])
            .is_err()
    );
    let data = ticks(&provider, 7, 2);
    assert_eq!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 7, data.clone())
            .unwrap(),
        9
    );
    assert_eq!(
        writer.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
        Some(9)
    );
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 7, data)
            .is_err()
    );
    let mut bad = ticks(&provider, 9, 2);
    bad[1].source_tick_id = "BTCUSDT:agg:11".into();
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 9, bad)
            .is_err()
    );
    let mut bad = ticks(&provider, 9, 1);
    bad[0].provider = "different".into();
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 9, bad)
            .is_err()
    );
    let mut bad = ticks(&provider, 9, 1);
    bad[0].provider_symbol = "ETHUSDT".into();
    assert!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 9, bad)
            .is_err()
    );
    // A valid first element followed by a malformed second element must leave no receipt or cursor advance.
    let event = quantos_market::MarketIngestor::with_actor(registry(&provider), a)
        .ingest_tick_at(t, c, ticks(&provider, 9, 1).remove(0), Utc::now())
        .unwrap();
    let tick = ticks(&provider, 9, 1).remove(0);
    let page = json!([{"id":9,"source_id":"BTCUSDT:agg:9","hash":tick.source_hash().unwrap(),"canonical_symbol":"BTC/USDT","events":event.recorded_events},{"id":11,"source_id":"BTCUSDT:agg:11","events":[]}]);
    let mut store = PgEventStore::connect(&db).unwrap();
    store.configure_market_deadline().unwrap();
    assert!(
        store
            .append_binance_page(t, a, &provider, "BTCUSDT", 9, &page)
            .is_err()
    );
    assert_eq!(
        store.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
        Some(9)
    );
    assert_eq!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 9, ticks(&provider, 9, 1))
            .unwrap(),
        10
    );
    assert!(
        !writer
            .binance_watchdog(t, c, &provider, "BTCUSDT", Utc::now())
            .unwrap()
    );
    let stale = Utc::now() + Duration::seconds(4);
    assert!(
        writer
            .binance_watchdog(t, c, &provider, "BTCUSDT", stale)
            .unwrap()
    );
    assert!(
        !writer
            .binance_watchdog(t, c, &provider, "BTCUSDT", stale)
            .unwrap()
    );
    assert_eq!(
        writer
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 10, vec![])
            .unwrap(),
        10
    );
    assert!(
        !writer
            .binance_watchdog(t, c, &provider, "BTCUSDT", Utc::now())
            .unwrap()
    );
    drop(store);
    drop(writer);
    let mut denied =
        DurableMarketIngestor::connect(&db, registry(&provider), ActorId::new()).unwrap();
    assert!(
        denied
            .ingest_binance_page(t, c, &provider, "BTCUSDT", 10, vec![])
            .is_err()
    );
    println!("Binance target atomic rollback/retry/restart/actor/watchdog/empty-health PASS");
}
fn server(responses: Vec<(u16, String)>) -> (String, std::thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/", listener.local_addr().unwrap());
    let h = std::thread::spawn(move || {
        let mut requests = vec![];
        for (status, body) in responses {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buf = [0; 2048];
            let n = socket.read(&mut buf).unwrap();
            requests.push(String::from_utf8_lossy(&buf[..n]).into_owned());
            write!(socket,"HTTP/1.1 {status} Response\r\nContent-Length: {}\r\nRetry-After: 1\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        }
        requests
    });
    (url, h)
}
fn body(start: i64, n: i64) -> String {
    serde_json::to_string(&(start..start+n).map(|id|json!({"a":id,"p":"100.1250","q":"2.00","T":Utc::now().timestamp_millis(),"f":id,"l":id,"m":false})).collect::<Vec<_>>()).unwrap()
}
fn execute(
    root: &Path,
    provider: &str,
    t: TenantId,
    a: ActorId,
    url: &str,
    extra: &[&str],
) -> Output {
    Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args([
            "binance-rest",
            "--approvals",
            root.join("approved.json").to_str().unwrap(),
            "--provider",
            provider,
            "--tenant",
            &t.to_string(),
            "--actor",
            &a.to_string(),
            "--fixture",
        ])
        .args(extra)
        .env("QUANTOS_BINANCE_REST_BASE_URL", url)
        .env("QUANTOS_TRACE_EXPORT_PATH", root.join("trace.jsonl"))
        .output()
        .unwrap()
}
#[test]
fn cli_transport_outage_recovers_from_committed_cursor_and_restarts() {
    if !enabled() {
        eprintln!("Binance CLI target NOT RUN");
        return;
    }
    let (db, t, a) = target();
    let root = std::env::temp_dir().join(format!("binance-test-{}", CorrelationId::new()));
    fs::create_dir_all(&root).unwrap();
    let provider = format!("fixture.binance.cli.{}", CorrelationId::new());
    let approved = registry(&provider)
        .approved_provider(&provider)
        .unwrap()
        .clone();
    fs::write(
        root.join("approved.json"),
        serde_json::to_vec(&vec![approved]).unwrap(),
    )
    .unwrap();
    let (url, h) = server(vec![
        (503, "{}".into()),
        (503, "{}".into()),
        (200, body(7, 2)),
        (200, "[]".into()),
    ]);
    let o = execute(
        &root,
        &provider,
        t,
        a,
        &url,
        &["--from-id", "7", "--iterations", "4"],
    );
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    let requests = h.join().unwrap();
    assert!(requests.iter().take(3).all(|r| r.contains("fromId=7")));
    assert!(requests[3].contains("fromId=9"));
    let mut store = PgEventStore::connect(&db).unwrap();
    assert_eq!(
        store.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
        Some(9)
    );
    let (url, h) = server(vec![(200, body(9, 2))]);
    let o = execute(&root, &provider, t, a, &url, &["--iterations", "1"]);
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    assert!(h.join().unwrap()[0].contains("fromId=9"));
    assert_eq!(
        store.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
        Some(11)
    );
    let o = execute(
        &root,
        &provider,
        t,
        a,
        "http://127.0.0.1:1/",
        &["--from-id", "7", "--iterations", "1"],
    );
    assert!(!o.status.success());
    for (status, payload) in [
        (429, "{}".into()),
        (418, "{}".into()),
        (200, "{}".into()),
        (200, body(12, 1)),
        (200, "x".repeat(1_048_577)),
        (503, "{}".into()),
    ] {
        let (url, h) = server(vec![(status, payload)]);
        let o = execute(&root, &provider, t, a, &url, &["--iterations", "1"]);
        assert!(!o.status.success());
        h.join().unwrap();
        assert_eq!(
            store.binance_cursor(t, &provider, "BTCUSDT").unwrap(),
            Some(11)
        );
    }
    let fresh_provider = format!("fixture.binance.bootstrap.{}", CorrelationId::new());
    let p = registry(&fresh_provider)
        .approved_provider(&fresh_provider)
        .unwrap()
        .clone();
    fs::write(
        root.join("approved.json"),
        serde_json::to_vec(&vec![p]).unwrap(),
    )
    .unwrap();
    let b = body(20, 1);
    let (url, h) = server(vec![(200, b.clone()), (200, b)]);
    let o = execute(&root, &fresh_provider, t, a, &url, &["--iterations", "1"]);
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    let requests = h.join().unwrap();
    assert!(!requests[0].contains("fromId"));
    assert!(requests[1].contains("fromId=20"));
    let empty_provider = format!("fixture.binance.empty.{}", CorrelationId::new());
    let p = registry(&empty_provider)
        .approved_provider(&empty_provider)
        .unwrap()
        .clone();
    fs::write(
        root.join("approved.json"),
        serde_json::to_vec(&vec![p]).unwrap(),
    )
    .unwrap();
    let (url, h) = server(vec![(200, "[]".into())]);
    assert!(
        !execute(&root, &empty_provider, t, a, &url, &["--iterations", "1"])
            .status
            .success()
    );
    h.join().unwrap();
    fs::remove_dir_all(root).unwrap();
    println!("Binance CLI source outage/restart/429/418/schema/gap/body-cap/bootstrap PASS");
}
#[test]
fn cli_rejects_unbounded_and_unapproved_configuration() {
    let root = std::env::temp_dir().join(format!("binance-config-{}", CorrelationId::new()));
    fs::create_dir_all(&root).unwrap();
    let provider = "fixture.binance.config";
    let p = registry(provider)
        .approved_provider(provider)
        .unwrap()
        .clone();
    fs::write(
        root.join("approved.json"),
        serde_json::to_vec(&vec![p]).unwrap(),
    )
    .unwrap();
    for args in [
        vec!["--iterations", "0"],
        vec!["--iterations", "1001"],
        vec!["--limit", "0"],
        vec!["--limit", "1001"],
        vec!["--poll-ms", "999"],
        vec!["--poll-ms", "60001"],
        vec!["--from-id=-1"],
        vec!["--symbol", "UNKNOWN"],
    ] {
        assert!(
            !execute(
                &root,
                provider,
                TenantId::new(),
                ActorId::new(),
                "http://127.0.0.1:1/",
                &args
            )
            .status
            .success()
        );
    }
    fs::remove_dir_all(root).unwrap();
}
