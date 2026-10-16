use chrono::{Duration, Utc};
use quantos_core::{AccountId, ActorId, ContentHash, CorrelationId, SchemaVersion, TenantId};
use quantos_event::{AppendOnlyLedger, NewRecordedEvent, RecordedEvent};
use quantos_market::{MarketIngestor, RawMarketTick, default_approved_providers};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, InMemoryPortfolioProjection,
    MarketMarkEvent, PortfolioEvent, PortfolioEventKind, PortfolioSnapshot, RiskInputSnapshot,
    generate_fill_replay, replay_start, snapshots_approx_eq,
};

fn account() -> AccountId {
    AccountId::from_uuid(uuid::Uuid::from_u128(
        0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10,
    ))
}
fn at(second: i64) -> chrono::DateTime<Utc> {
    replay_start() + Duration::seconds(second)
}
fn event(sequence: u64, second: i64, kind: PortfolioEventKind) -> PortfolioEvent {
    PortfolioEvent {
        event_id: format!("x01-{sequence}"),
        sequence,
        occurred_at: at(second),
        kind,
    }
}
fn status(sequence: u64, second: i64, status: AccountStatus) -> PortfolioEvent {
    event(
        sequence,
        second,
        PortfolioEventKind::AccountStatus(AccountStatusEvent {
            account_id: account(),
            status,
        }),
    )
}
fn fill(sequence: u64, second: i64, symbol: &str) -> PortfolioEvent {
    event(
        sequence,
        second,
        PortfolioEventKind::Fill(FillEvent {
            account_id: account(),
            symbol: symbol.into(),
            side: FillSide::Buy,
            quantity: 2.0,
            price: 100.0,
            fee: 1.0,
        }),
    )
}
fn mark(sequence: u64, second: i64, source: i64, symbol: &str) -> PortfolioEvent {
    event(
        sequence,
        second,
        PortfolioEventKind::MarketMark(MarketMarkEvent {
            symbol: symbol.into(),
            price: 110.0,
            source_at: at(source),
        }),
    )
}
fn ready(tenant: TenantId) -> InMemoryPortfolioProjection {
    InMemoryPortfolioProjection::rebuild(
        tenant,
        at(0),
        &[
            status(1, 0, AccountStatus::Active),
            fill(2, 1, "BTC/USDT"),
            fill(3, 2, "ETH/USDT"),
            mark(4, 3, 3, "BTC/USDT"),
            mark(5, 4, 4, "ETH/USDT"),
        ],
    )
    .unwrap()
}

#[test]
fn x01_ten_thousand_fills_golden_and_cold_rebuild() {
    let tenant = TenantId::new();
    let events = generate_fill_replay(account(), 10_000, at(0));
    assert_eq!(events.len(), 10_003);
    let snapshot = InMemoryPortfolioProjection::rebuild(tenant, at(0), &events)
        .unwrap()
        .snapshot(account())
        .unwrap();
    snapshot.validate().unwrap();
    let restored: PortfolioSnapshot =
        serde_json::from_slice(&serde_json::to_vec(&snapshot).unwrap()).unwrap();
    assert_eq!(restored, snapshot);
    restored.validate().unwrap();
    let golden: PortfolioSnapshot =
        serde_json::from_str(include_str!("golden/portfolio_snapshot.json")).unwrap();
    assert!(snapshots_approx_eq(&snapshot, &golden));
    let mut partial = InMemoryPortfolioProjection::new(tenant, at(0));
    for e in &events[..5000] {
        partial.apply(e).unwrap();
    }
    drop(partial);
    for _ in 0..10 {
        let cold = InMemoryPortfolioProjection::rebuild(tenant, at(0), &events)
            .unwrap()
            .snapshot(account())
            .unwrap();
        assert_eq!(cold, snapshot);
    }
}

#[test]
fn x01_rejected_events_do_not_poison_retry() {
    let tenant = TenantId::new();
    let events = generate_fill_replay(account(), 10, at(0));
    let mut p = InMemoryPortfolioProjection::new(tenant, at(0));
    p.apply(&events[0]).unwrap();
    let before = p.snapshot(account()).unwrap();
    assert!(p.apply(&events[2]).is_err());
    assert_eq!(before, p.snapshot(account()).unwrap());
    p.apply(&events[1]).unwrap();
    p.apply(&events[2]).unwrap();
    let after = p.snapshot(account()).unwrap();
    assert!(p.apply(&events[2]).is_err());
    assert_eq!(after, p.snapshot(account()).unwrap());
}

#[test]
fn x01_invalid_numbers_symbols_and_time_are_atomic() {
    let good = fill(2, 1, "BTC/USDT");
    let mut bad = Vec::new();
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, -1.0, 0.0] {
        for field in 0..2 {
            let mut e = good.clone();
            if let PortfolioEventKind::Fill(f) = &mut e.kind {
                if field == 0 {
                    f.quantity = value;
                } else {
                    f.price = value;
                }
            }
            bad.push(e);
        }
    }
    for value in [f64::NAN, f64::INFINITY, -1.0] {
        let mut e = good.clone();
        if let PortfolioEventKind::Fill(f) = &mut e.kind {
            f.fee = value;
        }
        bad.push(e);
    }
    for symbol in ["", "btc/usdt", "BTC//USDT", "BTC USDT"] {
        let mut e = good.clone();
        if let PortfolioEventKind::Fill(f) = &mut e.kind {
            f.symbol = symbol.into();
        }
        bad.push(e);
    }
    let mut overflow = good.clone();
    if let PortfolioEventKind::Fill(f) = &mut overflow.kind {
        f.quantity = f64::MAX;
        f.price = f64::MAX;
    }
    bad.push(overflow);
    let mut underflow = good.clone();
    if let PortfolioEventKind::Fill(f) = &mut underflow.kind {
        f.quantity = f64::MIN_POSITIVE;
        f.price = f64::MIN_POSITIVE;
    }
    bad.push(underflow);

    let mut old = good.clone();
    old.occurred_at = at(-1);
    bad.push(old);
    let mut empty = good.clone();
    empty.event_id.clear();
    bad.push(empty);
    bad.push(mark(2, 1, 2, "BTC/USDT"));
    for e in bad {
        let mut p = InMemoryPortfolioProjection::new(TenantId::new(), at(0));
        p.apply(&status(1, 0, AccountStatus::Active)).unwrap();
        let before = p.snapshot(account()).unwrap();
        assert!(p.apply(&e).is_err(), "invalid event accepted: {e:?}");
        assert_eq!(p.last_sequence(), 1);
        assert_eq!(p.snapshot(account()).unwrap(), before);
        p.apply(&good).unwrap();
        assert_eq!(p.last_sequence(), 2);
    }
    let mut p =
        InMemoryPortfolioProjection::rebuild(TenantId::new(), at(0), &[fill(1, 0, "BTC/USDT")])
            .unwrap();
    let before = p.snapshot(account()).unwrap();
    let mut huge = mark(2, 1, 1, "BTC/USDT");
    if let PortfolioEventKind::MarketMark(m) = &mut huge.kind {
        m.price = f64::MAX;
    }
    assert!(p.apply(&huge).is_err());
    assert_eq!(p.snapshot(account()).unwrap(), before);
    p.apply(&mark(2, 1, 1, "BTC/USDT")).unwrap();
    let mut p = InMemoryPortfolioProjection::new(TenantId::new(), at(0));
    for (sequence, symbol) in [(1, "BTC/USDT"), (2, "ETH/USDT")] {
        let mut e = fill(sequence, sequence as i64, symbol);
        if let PortfolioEventKind::Fill(f) = &mut e.kind {
            f.quantity = 1.0;
            f.price = f64::MAX / 2.0;
        }
        p.apply(&e).unwrap();
    }
    let before = p.snapshot(account()).unwrap();
    let mut overflow = fill(3, 3, "SOL/USDT");
    if let PortfolioEventKind::Fill(f) = &mut overflow.kind {
        f.quantity = 1.0;
        f.price = f64::MAX / 2.0;
    }
    assert!(p.apply(&overflow).is_err());
    assert_eq!(p.snapshot(account()).unwrap(), before);
}

#[test]
fn x01_risk_snapshot_binds_identity_status_and_each_mark_time() {
    let tenant = TenantId::new();
    let p = ready(tenant);
    let r = p.risk_snapshot(account(), at(5), 10).unwrap();
    r.validate_for(tenant, account(), at(5), 10).unwrap();
    assert_eq!(r.marks.len(), 2);
    assert!(
        r.validate_for(TenantId::new(), account(), at(5), 10)
            .is_err()
    );
    assert!(r.validate_for(tenant, AccountId::new(), at(5), 10).is_err());
    assert!(r.validate_for(tenant, account(), at(20), 10).is_err());
    assert!(r.validate_for(tenant, account(), at(4), 10).is_err());
    assert!(r.validate_for(tenant, account(), at(5), 2).is_err());
    assert!(p.risk_snapshot(account(), at(5), 0).is_err());
    let other = ready(TenantId::new())
        .risk_snapshot(account(), at(5), 10)
        .unwrap();
    assert_eq!(r.portfolio.snapshot_hash, other.portfolio.snapshot_hash);
    assert_ne!(r.input_hash, other.input_hash);
    for state in [AccountStatus::Suspended, AccountStatus::Closed] {
        let mut p = p.clone();
        p.apply(&status(6, 5, state)).unwrap();
        let display = p.snapshot(account()).unwrap();
        display.validate().unwrap();
        assert_eq!(display.account_status, Some(state));
        assert!(p.risk_snapshot(account(), at(5), 10).is_err());
    }
    let mut p = p.clone();
    p.apply(&mark(6, 29, 29, "ETH/USDT")).unwrap();
    p.apply(&status(7, 29, AccountStatus::Active)).unwrap();
    assert!(
        p.risk_snapshot(account(), at(30), 10).is_err(),
        "another symbol must not refresh BTC"
    );
    p.apply(&mark(8, 30, 30, "BTC/USDT")).unwrap();
    assert!(p.risk_snapshot(account(), at(30), 10).is_ok());
    let missing = InMemoryPortfolioProjection::rebuild(
        tenant,
        at(0),
        &[status(1, 0, AccountStatus::Active), fill(2, 1, "BTC/USDT")],
    )
    .unwrap();
    assert!(missing.risk_snapshot(account(), at(1), 10).is_err());
    let unknown = InMemoryPortfolioProjection::new(tenant, at(0));
    assert!(unknown.risk_snapshot(account(), at(0), 10).is_err());
}

fn recorded(
    tenant: TenantId,
    sequence: u64,
    kind: PortfolioEventKind,
    name: &str,
    second: i64,
) -> RecordedEvent {
    RecordedEvent::new(NewRecordedEvent {
        tenant_id: tenant,
        actor_id: ActorId::new(),
        correlation_id: CorrelationId::new(),
        causation_id: None,
        aggregate_type: "portfolio".into(),
        aggregate_id: tenant.to_string(),
        sequence,
        event_kind: name.into(),
        schema_version: SchemaVersion::parse("v1").unwrap(),
        occurred_at: at(second),
        payload: serde_json::to_value(kind).unwrap(),
    })
    .unwrap()
}
#[test]
fn x01_ledger_market_to_portfolio_and_cross_tenant_denials() {
    let tenant = TenantId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut p = InMemoryPortfolioProjection::new(tenant, at(0));
    for (e, name) in [
        (
            status(1, 0, AccountStatus::Active),
            "portfolio.account_status",
        ),
        (fill(2, 1, "BTC/USDT"), "portfolio.fill"),
    ] {
        let mut record = recorded(tenant, e.sequence, e.kind, name, e.sequence as i64 - 1);
        if name == "portfolio.fill" {
            record.payload["price"] = 100.into();
            record.payload["quantity"] = 2.into();
            record.payload_hash = ContentHash::sha256_bytes(
                &quantos_core::canonical_json_bytes(&record.payload).unwrap(),
            );
        }
        ledger.append(record.clone()).unwrap();
        p.apply_recorded(&record, record.sequence).unwrap();
        let mut foreign = record.clone();
        foreign.tenant_id = TenantId::new();
        assert!(p.apply_recorded(&foreign, 3).is_err());
    }
    let mut market = MarketIngestor::new(default_approved_providers());
    let tick = |id: &str, source: i64| RawMarketTick {
        provider: "approved.binance.spot".into(),
        source_tick_id: id.into(),
        provider_symbol: "BTC/USDT".into(),
        event_time: at(source),
        received_at: at(2),
        price: "110.0".into(),
        volume: "1.0".into(),
    };
    let outcome = market
        .ingest_tick(tenant, CorrelationId::new(), tick("good", 2))
        .unwrap();
    let record = &outcome.recorded_events[0];
    ledger.append(record.clone()).unwrap();
    p.apply_market_recorded(record, 3).unwrap();
    assert_eq!(p.mark("BTC/USDT").unwrap().1, at(2));
    let risk = p.risk_snapshot(account(), at(2), 10).unwrap();
    assert_eq!(risk.portfolio.exposure_net, 220.0);
    let before = p.snapshot(account()).unwrap();
    assert!(p.apply_market_recorded(record, 4).is_err());
    let stale = market
        .ingest_tick(tenant, CorrelationId::new(), tick("stale", -20))
        .unwrap();
    assert!(
        p.apply_market_recorded(&stale.recorded_events[0], 4)
            .is_err()
    );
    let mut tampered = record.clone();
    tampered.payload["raw_price"] = "999".into();
    assert!(p.apply_market_recorded(&tampered, 4).is_err());
    let mut foreign = record.clone();
    foreign.tenant_id = TenantId::new();
    assert!(p.apply_market_recorded(&foreign, 4).is_err());
    let mut unsupported = record.clone();
    unsupported.schema_version = SchemaVersion::parse("v3").unwrap();
    assert!(p.apply_market_recorded(&unsupported, 4).is_err());
    assert_eq!(before, p.snapshot(account()).unwrap());
    let next = recorded(
        tenant,
        3,
        PortfolioEventKind::AccountStatus(AccountStatusEvent {
            account_id: account(),
            status: AccountStatus::Active,
        }),
        "portfolio.account_status",
        3,
    );
    let mut unexpected = next.clone();
    unexpected.payload["unknown_field"] = true.into();
    unexpected.payload_hash = ContentHash::sha256_bytes(
        &quantos_core::canonical_json_bytes(&unexpected.payload).unwrap(),
    );
    assert!(p.apply_recorded(&unexpected, 4).is_err());
    ledger.append(next.clone()).unwrap();
    p.apply_recorded(&next, 4).unwrap();
    assert_eq!(p.last_sequence(), 4);
}

#[test]
fn x01_snapshot_tampering_and_float_roundtrip() {
    let p = ready(TenantId::new());
    let r = p.risk_snapshot(account(), at(5), 10).unwrap();
    let bytes = serde_json::to_vec(&r).unwrap();
    let restored: RiskInputSnapshot = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(restored, r);
    restored
        .validate_for(r.portfolio.tenant_id, account(), at(5), 10)
        .unwrap();
    let mut changed = r.clone();
    changed.portfolio.exposure_gross += 1.0;
    assert!(
        changed
            .validate_for(r.portfolio.tenant_id, account(), at(5), 10)
            .is_err()
    );
    let mut changed = r.clone();
    changed.marks[0].source_at = at(5);
    assert!(
        changed
            .validate_for(r.portfolio.tenant_id, account(), at(5), 10)
            .is_err()
    );
    let mut changed = r.portfolio.clone();
    changed.positions.push(changed.positions[0].clone());
    assert!(changed.validate().is_err());
    let mut changed = r.portfolio.clone();
    changed.snapshot_hash = ContentHash::sha256_bytes(b"forged");
    assert!(changed.validate().is_err());
    let mut changed = r.portfolio.clone();
    changed.positions[0].quantity = f64::NAN;
    assert!(changed.validate().is_err());
}

#[test]
fn x01_short_reversal_fee_and_account_isolation() {
    let mut e = fill(2, 1, "BTC/USDT");
    if let PortfolioEventKind::Fill(f) = &mut e.kind {
        f.side = FillSide::Sell;
        f.quantity = 3.0;
        f.price = 120.0;
    }
    let p = InMemoryPortfolioProjection::rebuild(
        TenantId::new(),
        at(0),
        &[fill(1, 0, "BTC/USDT"), e, mark(3, 2, 2, "BTC/USDT")],
    )
    .unwrap();
    let s = p.snapshot(account()).unwrap();
    s.validate().unwrap();
    assert_eq!(s.positions[0].quantity, -1.0);
    assert_eq!(s.realized_pnl, 38.0);
    assert_eq!(s.unrealized_pnl, 10.0);
    assert_eq!(s.exposure_net, -110.0);
    assert_eq!(s.exposure_gross, 110.0);
    assert!(p.snapshot(AccountId::new()).unwrap().positions.is_empty());
}
