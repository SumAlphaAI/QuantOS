use std::{
    io::Cursor,
    time::{Duration, Instant},
};

use anyhow::Result;

use super::*;

#[test]
fn replay_dataset_ingests_one_hundred_thousand_ticks_without_parse_failures() -> Result<()> {
    let spec = default_replay_spec()?;
    let ticks = generate_replay_dataset(&spec)?;
    let mut encoded = Vec::new();
    write_ticks_jsonl(&mut encoded, ticks.clone())?;
    let decoded = read_ticks_jsonl(Cursor::new(encoded))?;

    assert_eq!(decoded.len(), 100_000);

    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let summary = ingestor.ingest_batch(tenant_id, correlation_id, decoded, &mut ledger)?;

    assert_eq!(summary.input_ticks, 100_000);
    assert_eq!(summary.unique_ticks + summary.duplicate_ticks, 100_000);
    assert!(summary.unique_ticks > 90_000);
    assert!(summary.anomaly_events > 0);
    assert_eq!(
        ledger
            .events_by_correlation_id(tenant_id, correlation_id)
            .len(),
        summary.recorded_events
    );
    Ok(())
}

#[test]
fn out_of_order_and_duplicate_ticks_are_deduplicated() -> Result<()> {
    let spec = MarketReplaySpec {
        dataset_name: "small".to_owned(),
        provider: "approved.binance.spot".to_owned(),
        symbols: vec!["BTCUSDT".to_owned(), "ETHUSDT".to_owned()],
        base_time: Utc::now(),
        count: 24,
        duplicate_every: 4,
        out_of_order_every: 3,
        stale_every: 0,
        quality_fail_every: 0,
    };
    let tenant_id = TenantId::new();
    let correlation_id = CorrelationId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let summary = ingestor.ingest_batch(
        tenant_id,
        correlation_id,
        generate_replay_dataset(&spec)?,
        &mut ledger,
    )?;

    assert_eq!(summary.input_ticks, 24);
    assert_eq!(summary.duplicate_ticks, 5);
    assert_eq!(summary.unique_ticks, 19);
    assert_eq!(
        ledger
            .events_by_correlation_id(tenant_id, correlation_id)
            .len(),
        summary.recorded_events
    );
    Ok(())
}

#[test]
fn freshness_and_quality_anomalies_emit_events_within_five_seconds() -> Result<()> {
    let provider = "approved.binance.spot".to_owned();
    let base_time = Utc::now();
    let stale_tick = RawMarketTick {
        provider: provider.clone(),
        source_tick_id: "stale-1".to_owned(),
        provider_symbol: "BTC/USDT".to_owned(),
        event_time: base_time,
        received_at: base_time + ChronoDuration::seconds(6),
        price: "101.5".to_owned(),
        volume: "2.5".to_owned(),
    };
    let quality_tick = RawMarketTick {
        provider,
        source_tick_id: "quality-1".to_owned(),
        provider_symbol: "ETH-USDT".to_owned(),
        event_time: base_time + ChronoDuration::seconds(1),
        received_at: base_time + ChronoDuration::seconds(1),
        price: "0".to_owned(),
        volume: "0".to_owned(),
    };

    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let started_at = Instant::now();
    let stale = ingestor.ingest_tick(TenantId::new(), CorrelationId::new(), stale_tick)?;
    let quality = ingestor.ingest_tick(TenantId::new(), CorrelationId::new(), quality_tick)?;

    let stale_anomaly = stale
        .market_events
        .iter()
        .find(|event| event.event_kind == MarketEventKind::FreshnessDegraded)
        .expect("freshness anomaly emitted");
    let quality_anomaly = quality
        .market_events
        .iter()
        .find(|event| event.event_kind == MarketEventKind::QualityFailed)
        .expect("quality anomaly emitted");

    assert!(started_at.elapsed() <= Duration::from_secs(5));
    assert_eq!(
        quality_anomaly.anomaly_reason.as_deref(),
        Some("invalid_or_non_positive_price_or_volume")
    );
    assert_eq!(
        stale.recorded_events[1].occurred_at,
        stale_anomaly.received_at
    );
    assert_eq!(
        quality.recorded_events[1].occurred_at,
        quality_anomaly.received_at
    );
    Ok(())
}

#[test]
fn rejects_unapproved_providers_and_normalizes_symbols() {
    let error = MarketIngestor::new(default_approved_providers())
        .ingest_tick(
            TenantId::new(),
            CorrelationId::new(),
            RawMarketTick {
                provider: "shadow.provider".to_owned(),
                source_tick_id: "1".to_owned(),
                provider_symbol: "btc/usdt".to_owned(),
                event_time: Utc::now(),
                received_at: Utc::now(),
                price: "1".to_owned(),
                volume: "1".to_owned(),
            },
        )
        .expect_err("provider should be rejected");

    assert_eq!(error.machine_code(), "MARKET_PROVIDER_NOT_APPROVED");
    assert_eq!(
        normalize_symbol("btc/usdt").expect("symbol normalizes"),
        "BTC/USDT"
    );
    assert_eq!(
        normalize_symbol("btc-usdt").expect("hyphenated symbol normalizes"),
        "BTC/USDT"
    );
    assert_eq!(
        normalize_symbol("btc_usdt").expect("underscored symbol normalizes"),
        "BTC/USDT"
    );
    assert_eq!(
        normalize_symbol("btc@@usdt")
            .expect_err("unexpected punctuation must fail closed")
            .machine_code(),
        "MARKET_INVALID_SYMBOL"
    );
}

fn raw(id: &str) -> RawMarketTick {
    let now = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    RawMarketTick {
        provider: "approved.binance.spot".into(),
        source_tick_id: id.into(),
        provider_symbol: "BTC/USDT".into(),
        event_time: now,
        received_at: now,
        price: "100.1250".into(),
        volume: "2.5".into(),
    }
}
#[test]
fn identity_is_tenant_scoped_and_conflicting_content_is_rejected() -> Result<()> {
    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let first = ingestor.ingest_tick(t, c, raw("1"))?;
    assert_eq!(
        first.market_events[0].price.unwrap().value().to_string(),
        "100.1250"
    );
    assert!(ingestor.ingest_tick(t, c, raw("1"))?.duplicate);
    assert!(
        !ingestor
            .ingest_tick(TenantId::new(), c, raw("1"))?
            .duplicate
    );
    let mut changed = raw("1");
    changed.price = "999".into();
    assert!(matches!(
        ingestor.ingest_tick(t, c, changed),
        Err(MarketError::SourceConflict)
    ));
    for id in ["", " ", "watchdog:1", "rejected:1"] {
        assert!(matches!(
            ingestor.ingest_tick(t, c, raw(id)),
            Err(MarketError::InvalidIdentity)
        ));
    }
    let mut retry = raw("1");
    retry.received_at += ChronoDuration::seconds(1);
    assert!(ingestor.ingest_tick(t, c, retry)?.duplicate);
    Ok(())
}
#[test]
fn invalid_numeric_ticks_emit_quality_with_raw_values_and_continue() -> Result<()> {
    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut cases = vec![];
    for (id, price, volume) in [
        ("negative", "-1", "1"),
        ("bad", "invalid", "1"),
        ("scale", "0.0000000000001", "1"),
        ("zero", "0", "0"),
        ("volume", "1", "-2"),
    ] {
        let mut tick = raw(id);
        tick.price = price.into();
        tick.volume = volume.into();
        cases.push(tick);
    }
    cases.push(raw("good"));
    let result = ingestor.ingest_batch(t, c, cases, &mut ledger)?;
    assert_eq!(result.anomaly_events, 5);
    assert_eq!(result.unique_ticks, 6);
    let events = ledger.events_by_correlation_id(t, c);
    assert_eq!(events.len(), 11);
    let root = &events[0];
    let child = &events[1];
    assert_eq!(child.causation_id, root.event_id);
    assert_eq!(root.payload["raw_price"], "-1");
    assert!(root.payload["price"].is_null());
    Ok(())
}
#[test]
fn failed_batch_does_not_publish_partial_ledger_or_identity() -> Result<()> {
    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut bad = raw("bad");
    bad.provider = "unapproved".into();
    assert!(
        ingestor
            .ingest_batch(t, c, [raw("first"), bad], &mut ledger)
            .is_err()
    );
    assert!(ledger.events_by_correlation_id(t, c).is_empty());
    assert_eq!(
        ingestor
            .ingest_batch(t, c, [raw("first")], &mut ledger)?
            .duplicate_ticks,
        0
    );
    // An incompatible ledger must not consume the next identity either.
    let mut other = MarketIngestor::new(default_approved_providers());
    assert!(
        other
            .ingest_batch(t, c, [raw("second")], &mut ledger)
            .is_err()
    );
    let mut empty = AppendOnlyLedger::new();
    assert_eq!(
        other
            .ingest_batch(t, c, [raw("second")], &mut empty)?
            .unique_ticks,
        1
    );
    Ok(())
}
#[test]
fn instrument_identity_is_unambiguous_and_venue_scoped() -> Result<()> {
    assert_ne!(normalize_symbol("AB/C")?, normalize_symbol("A/BC")?);
    for symbol in [
        "BTC/USDT/EXTRA",
        "BTC@@USDT",
        "/USDT",
        "BTC/",
        "BTCUSDT",
        "💰/USD",
    ] {
        assert!(normalize_symbol(symbol).is_err());
    }
    let mut i = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let first = i.ingest_tick(t, c, raw("first"))?;
    let mut coinbase = raw("first");
    coinbase.provider = "approved.coinbase.spot".into();
    let second = i.ingest_tick(t, c, coinbase)?;
    assert_ne!(
        first.recorded_events[0].aggregate_id,
        second.recorded_events[0].aggregate_id
    );
    let mut unknown = raw("unknown");
    unknown.provider_symbol = "AB/C".into();
    assert!(i.ingest_tick(t, c, unknown).is_err());
    Ok(())
}
#[test]
fn processing_clock_detects_backlog_future_receive_and_future_event() -> Result<()> {
    let t = TenantId::new();
    let c = CorrelationId::new();
    let mut i = MarketIngestor::new(default_approved_providers());
    let tick = raw("old");
    let now = tick.received_at + ChronoDuration::seconds(30);
    let result = i.ingest_tick_at(t, c, tick, now)?;
    assert_eq!(result.market_events[0].quality, MarketDataQuality::Degraded);
    assert_eq!(result.recorded_events[1].occurred_at, now);
    for (id, event_future) in [("event", true), ("receive", false)] {
        let mut tick = raw(id);
        let now = tick.received_at;
        if event_future {
            tick.event_time += ChronoDuration::seconds(3);
        } else {
            tick.received_at += ChronoDuration::seconds(3);
        }
        assert_eq!(
            i.ingest_tick_at(t, c, tick, now)?.market_events[0].quality,
            MarketDataQuality::Failed
        );
    }
    Ok(())
}
#[test]
fn provider_configuration_fails_closed_and_supports_revocation() -> Result<()> {
    let valid = default_approved_providers()
        .approved_provider("approved.binance.spot")?
        .clone();
    assert!(ApprovedProviderRegistry::new(Vec::<ApprovedProvider>::new()).is_err());
    for mutate in 0..9 {
        let mut p = valid.clone();
        match mutate {
            0 => p.dataset.clear(),
            1 => p.license_label.clear(),
            2 => p.approval_reference.clear(),
            3 => p.approval_version.clear(),
            4 => p.freshness_sla_secs = -1,
            5 => p.max_future_skew_secs = -1,
            6 => p.instruments.clear(),
            7 => {
                p.instruments.insert("alias".into(), "BTC/USDT".into());
            }
            _ => {
                p.instruments.insert("UNKNOWN".into(), "AB/C/EXTRA".into());
            }
        }
        assert!(ApprovedProviderRegistry::new([p]).is_err());
    }
    assert!(ApprovedProviderRegistry::new([valid.clone(), valid.clone()]).is_err());
    assert!(default_approved_providers().require_live().is_err());
    let mut revoked = valid.clone();
    revoked.enabled = false;
    assert!(
        ApprovedProviderRegistry::new([revoked])?
            .approved_provider(&valid.provider)
            .is_err()
    );
    let mut expired = valid.clone();
    expired.expires_at = raw("x").event_time;
    assert!(
        ApprovedProviderRegistry::new([expired])?
            .approved_provider(&valid.provider)
            .is_err()
    );
    let mut live = valid;
    live.approval_reference = "license-register:approved-42".into();
    ApprovedProviderRegistry::new([live])?.require_live()?;
    Ok(())
}
#[test]
fn replay_and_parser_are_bounded_and_invalid_specs_return_errors() -> Result<()> {
    let valid = default_replay_spec()?;
    for mutate in 0..5 {
        let mut spec = valid.clone();
        match mutate {
            0 => spec.symbols.clear(),
            1 => spec.count = 0,
            2 => spec.count = MAX_REPLAY_TICKS + 1,
            3 => spec.symbols = vec!["INVALID".into()],
            _ => spec.base_time = DateTime::<Utc>::MAX_UTC,
        }
        assert!(generate_replay_dataset(&spec).is_err());
    }
    assert!(read_ticks_jsonl(Cursor::new(vec![b'x'; MAX_LINE_BYTES + 1])).is_err());
    assert!(read_ticks_jsonl(Cursor::new("{bad}\n")).is_err());
    let mut encoded = vec![];
    write_ticks_jsonl(&mut encoded, [raw("one")])?;
    let mixed = [b" \n".as_slice(), encoded.as_slice()].concat();
    assert_eq!(read_ticks_jsonl(Cursor::new(mixed))?.len(), 1);
    let mut too_many = vec![];
    for _ in 0..=MAX_REPLAY_TICKS {
        too_many.extend_from_slice(&encoded);
    }
    assert!(matches!(
        read_ticks_jsonl(Cursor::new(too_many)),
        Err(MarketError::ResourceLimit)
    ));
    assert_eq!(
        MarketError::Configuration.machine_code(),
        "MARKET_CONFIGURATION"
    );
    Ok(())
}
#[test]
fn pure_domain_p95_under_fifty_milliseconds() -> Result<()> {
    let mut i = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let mut nanos = vec![];
    for n in 0..2000 {
        let started = Instant::now();
        i.ingest_tick(t, c, raw(&format!("perf-{n}")))?;
        nanos.push(started.elapsed().as_nanos());
    }
    nanos.sort_unstable();
    let p95 = nanos[1899];
    assert!(p95 < 50_000_000, "P95 {p95}ns");
    println!("R01 pure domain n=2000 p95_ns={p95}");
    Ok(())
}
#[test]
fn error_codes_and_io_failures_are_deterministic() -> Result<()> {
    use std::io::{self, BufRead, Read, Write};
    struct Broken;
    impl Read for Broken {
        fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::other("injected"))
        }
    }
    impl BufRead for Broken {
        fn fill_buf(&mut self) -> io::Result<&[u8]> {
            Err(io::Error::other("injected"))
        }
        fn consume(&mut self, _: usize) {}
    }
    impl Write for Broken {
        fn write(&mut self, _: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("injected"))
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }
    assert!(matches!(
        TickReader::new(Broken).next().unwrap(),
        Err(MarketError::Io(_))
    ));
    assert!(write_ticks_jsonl(&mut Broken, [raw("io")]).is_err());
    let json = read_ticks_jsonl(Cursor::new("invalid")).unwrap_err();
    assert_eq!(json.machine_code(), "MARKET_JSON");
    assert_eq!(
        MarketError::Io(io::Error::other("injected")).machine_code(),
        "MARKET_IO"
    );
    let core = quantos_core::ContentHash::parse("invalid").unwrap_err();
    assert_eq!(
        MarketError::Core(core).machine_code(),
        "CORE_INVALID_CONTENT_HASH"
    );
    let event = quantos_event::EventError::duplicate_event(quantos_core::EventId::new());
    assert_eq!(
        MarketError::Event(event).machine_code(),
        "EVENT_DUPLICATE_EVENT"
    );
    for (quality, label) in [
        (MarketDataQuality::Passed, "passed"),
        (MarketDataQuality::Degraded, "degraded"),
        (MarketDataQuality::Failed, "failed"),
    ] {
        assert_eq!(quality.as_str(), label);
    }
    let mut i = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new();
    let c = CorrelationId::new();
    let hash = raw("fill").source_hash()?;
    for n in 0..MAX_REPLAY_TICKS {
        i.seen_tick_ids.insert(
            (t, "approved.binance.spot".into(), format!("fill-{n}")),
            hash.clone(),
        );
    }
    assert!(matches!(
        i.ingest_tick(t, c, raw("extra")),
        Err(MarketError::ResourceLimit)
    ));
    Ok(())
}
