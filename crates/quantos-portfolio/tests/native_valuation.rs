//! Pure owner-shaped fixtures only. Actual HTTP/native ingestion is tested by BFF.
#[path = "support/native_fixture.rs"]
mod fixture;
use chrono::{Duration, Utc};
use fixture::{edit, scope, source};
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_portfolio::{native_ledger::NativeLedger, native_valuation::*};
use serde_json::{Value, json};
fn ledger() -> NativeLedger {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "buy", "1", "1000", "0.01")).unwrap();
    l
}
fn inputs(l: &NativeLedger) -> Inputs {
    let f = source(1, "buy", "1", "1000", "0.01");
    let at = f.recorded_at + Duration::seconds(2);
    let v = l.view().unwrap();
    Inputs {
        market_provenance: None,
        account_provenance: None,
        schema_version: "quantos-native-valuation-input.v1".into(),
        source_id: SOURCE.into(),
        version: 1,
        scope: scope(),
        basis: BASIS.into(),
        origin_ledger_hash: serde_json::from_value(
            NativeLedger::new(scope()).unwrap().view().unwrap()["ledgerHash"].clone(),
        )
        .unwrap(),
        opening_at: f.fills[0].filled_at - Duration::seconds(1),
        cash_source_ref: "fixture:opening-cash:1".into(),
        quote_cash_at_opening: "10000".into(),
        realized_pnl_before_origin_today: "-5".into(),
        quote_currency: "USDT".into(),
        ledger_hash: serde_json::from_value(v["ledgerHash"].clone()).unwrap(),
        ledger_anchor: l.anchor(),
        as_of: at,
        valid_until: at + Duration::seconds(30),
        cash_coverage_through: at,
        account_status: "active".into(),
        account_status_at: at,
        status_source_ref: "fixture:account-status:1".into(),
        marks: v["positions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["quantity"] != "0")
            .map(|p| Mark {
                symbol: p["symbol"].as_str().unwrap().into(),
                price: "1100".into(),
                source_ref: "fixture:approved-mark:1".into(),
                observed_at: at,
                quality: "normal".into(),
            })
            .collect(),
    }
}
fn snapshot(l: &NativeLedger, i: &Inputs, g: u64) -> Snapshot {
    evaluate(l, i, g, i.as_of).unwrap().snapshot.unwrap()
}
#[test]
fn exact_equity_pnl_exposure_and_source_are_bound() {
    let l = ledger();
    let i = inputs(&l);
    let s = snapshot(&l, &i, 0);
    assert_eq!(s.quote_cash, "8999.99");
    assert_eq!(s.equity, "10099.99");
    assert_eq!(s.realized_pnl_today, "-5.01");
    assert_eq!(s.unrealized_pnl, "100");
    assert_eq!(s.total_pnl_today, "94.99");
    assert_eq!(s.exposure_gross, "1100");
    assert_eq!(s.exposure_net, "1100");
    assert_eq!(s.source_hash, i.content_hash().unwrap());
    assert_eq!(s.ledger_anchor, l.anchor());
    assert!(!s.execution_authority);
    s.validate_for(&l, &i, 0, i.as_of).unwrap();
}
#[test]
fn reads_do_not_renew_original_window_or_mint_new_snapshots() {
    let l = ledger();
    let i = inputs(&l);
    let mut state = State::default();
    let a = state.observe(&l, &i, 0, i.as_of).unwrap().snapshot.unwrap();
    let b = state
        .observe(&l, &i, 0, i.as_of + Duration::seconds(2))
        .unwrap()
        .snapshot
        .unwrap();
    assert_eq!(a, b);
    assert_eq!(state.counts(), (1, 1));
    assert!(
        state
            .observe(&l, &i, 0, a.expires_at)
            .unwrap()
            .snapshot
            .is_none()
    );
    assert_eq!(state.counts(), (1, 1));
}
#[test]
fn missing_mark_never_falls_back_to_fill_price() {
    let l = ledger();
    let mut i = inputs(&l);
    i.marks.clear();
    let r = evaluate(&l, &i, 0, i.as_of).unwrap();
    assert_eq!(r.reason, "MISSING_MARK");
    assert!(r.snapshot.is_none());
}
#[test]
fn open_or_partially_filled_orders_are_not_free_risk_capacity() {
    for partial in [false, true] {
        let f = edit(&source(1, "buy", "1", "1000", "0.01"), |v| {
            if partial {
                v["order"]["quantity"] = json!("2");
                v["order"]["status"] = json!("partially_filled");
            } else {
                v["order"]["filledQuantity"] = json!("0");
                v["order"]["averageFillPrice"] = Value::Null;
                v["order"]["status"] = json!("accepted");
                v["fills"] = json!([]);
            }
        });
        let mut l = NativeLedger::new(scope()).unwrap();
        l.observe(&f).unwrap();
        let i = inputs(&l);
        let r = evaluate(&l, &i, 0, i.as_of).unwrap();
        assert_eq!(r.reason, "OPEN_ORDER_RESERVATIONS_UNMODELED");
        assert!(r.snapshot.is_none());
    }
}
#[test]
fn stale_suspect_and_future_marks_refuse() {
    let l = ledger();
    let mut i = inputs(&l);
    i.marks[0].quality = "suspect".into();
    assert!(evaluate(&l, &i, 0, i.as_of).unwrap().snapshot.is_none());
    i.marks[0].quality = "normal".into();
    i.marks[0].observed_at -= Duration::seconds(31);
    assert_eq!(
        evaluate(&l, &i, 0, i.as_of).unwrap().reason,
        "STALE_OR_UNTRUSTED_MARK"
    );
    i.marks[0].observed_at = i.as_of + Duration::milliseconds(1);
    assert!(evaluate(&l, &i, 0, i.as_of).is_err());
}
#[test]
fn unknown_observed_fill_is_not_zero_exposure_or_usable_equity() {
    let f = edit(&source(1, "buy", "1", "1000", "0.01"), |v| {
        v["outcome"] = json!("unknown");
        v["consumerReady"] = json!(false);
        v["reason"] = json!("OUTCOME_UNRESOLVED");
    });
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&f).unwrap();
    let i = inputs(&l);
    let before = l.checkpoint().unwrap();
    let r = evaluate(&l, &i, 7, i.as_of).unwrap();
    assert_eq!(r.reason, "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    assert!(r.snapshot.is_none());
    assert_eq!(l.checkpoint().unwrap(), before);
    assert_eq!(l.view().unwrap()["quarantinedCommandCount"], 1);
}
#[test]
fn short_position_has_signed_net_and_positive_gross() {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "sell", "1", "1000", "0.01")).unwrap();
    let i = inputs(&l);
    let s = snapshot(&l, &i, 3);
    assert_eq!(s.quote_cash, "10999.99");
    assert_eq!(s.exposure_net, "-1100");
    assert_eq!(s.exposure_gross, "1100");
    assert_eq!(s.unrealized_pnl, "-100");
    assert_eq!(s.equity, "9899.99");
}
#[test]
fn high_precision_fees_are_never_converted_through_f64() {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "buy", "1", "1000", "0.0100000000000000000001"))
        .unwrap();
    let i = inputs(&l);
    assert_eq!(snapshot(&l, &i, 0).equity, "10099.9899999999999999999999");
}
#[test]
fn account_scope_origin_currency_and_duplicate_marks_refuse() {
    let l = ledger();
    let i = inputs(&l);
    for key in [
        "scope",
        "originLedgerHash",
        "quoteCurrency",
        "sourceId",
        "basis",
    ] {
        let mut v = json!(i);
        match key {
            "scope" => v[key]["accountId"] = json!(uuid::Uuid::new_v4()),
            "originLedgerHash" => v[key] = json!(ContentHash::sha256_bytes(b"foreign")),
            _ => v[key] = json!("foreign"),
        };
        let x: Inputs = serde_json::from_value(v).unwrap();
        assert!(evaluate(&l, &x, 0, i.as_of).is_err(), "{key}");
    }
    let mut x = i.clone();
    x.marks.push(x.marks[0].clone());
    assert!(evaluate(&l, &x, 0, i.as_of).is_err());
}
#[test]
fn old_ledger_or_facts_after_source_time_are_unusable() {
    let l = ledger();
    let mut i = inputs(&l);
    i.ledger_hash = ContentHash::sha256_bytes(b"old");
    assert_eq!(
        evaluate(&l, &i, 0, i.as_of).unwrap().reason,
        "LEDGER_MISMATCH"
    );
    let mut i = inputs(&l);
    i.opening_at = i.as_of;
    assert_eq!(
        evaluate(&l, &i, 0, i.as_of).unwrap().reason,
        "LEDGER_TIME_MISMATCH"
    );
}
#[test]
fn original_generation_is_checked_without_rewriting_old_snapshot() {
    let l = ledger();
    let i = inputs(&l);
    let mut state = State::default();
    let a = state.observe(&l, &i, 0, i.as_of).unwrap().snapshot.unwrap();
    assert!(a.validate_for(&l, &i, 1, i.as_of).is_err());
    let b = state.observe(&l, &i, 1, i.as_of).unwrap().snapshot.unwrap();
    assert_ne!(a.snapshot_hash, b.snapshot_hash);
    assert_eq!(a.kill_generation, "0");
    assert_eq!(a.expires_at, b.expires_at);
    assert_eq!(state.counts(), (1, 2));
}
#[test]
fn source_version_conflict_rollback_and_cash_reset_are_atomic() {
    let l = ledger();
    let i = inputs(&l);
    let mut state = State::default();
    state.observe(&l, &i, 0, i.as_of).unwrap();
    let before = state.checkpoint().unwrap();
    for kind in 0..6 {
        let mut x = i.clone();
        if kind == 0 {
            x.marks[0].price = "1200".into();
        }
        if kind == 1 {
            x.version = 3;
        }
        if kind == 2 {
            x.version = 2;
            x.quote_cash_at_opening = "20000".into();
        }
        if kind == 3 {
            x.version = 2;
            x.cash_coverage_through -= Duration::milliseconds(1);
        }
        if kind == 4 {
            x.version = 2;
            x.account_status_at -= Duration::milliseconds(1);
        }
        if kind == 5 {
            x.version = 2;
            x.marks[0].price = "1200".into();
        }
        assert!(state.observe(&l, &x, 0, x.as_of).is_err());
        assert_eq!(state.checkpoint().unwrap(), before);
    }
    let mut next = i.clone();
    next.version = 2;
    next.marks.clear();
    state.observe(&l, &next, 0, next.as_of).unwrap();
    assert!(state.observe(&l, &i, 0, i.as_of).is_err());
    let mut third = i.clone();
    third.version = 3;
    third.marks[0].observed_at -= Duration::seconds(1);
    assert!(state.observe(&l, &third, 0, third.as_of).is_err());
}
#[test]
fn recovery_rebuilds_historical_snapshots_against_immutable_ledger_prefix() {
    let mut l = ledger();
    let i = inputs(&l);
    let mut state = State::default();
    state.observe(&l, &i, 0, i.as_of).unwrap();
    l.observe(&source(2, "buy", "1", "1000", "0.01")).unwrap();
    let mut next = inputs(&l);
    next.version = 2;
    state.observe(&l, &next, 0, next.as_of).unwrap();
    assert_eq!(
        State::restore(&state.checkpoint().unwrap(), &l)
            .unwrap()
            .checkpoint()
            .unwrap(),
        state.checkpoint().unwrap()
    );
    let old = State::default();
    assert!(old.verify_extension(&state).is_err());
    // A later UNKNOWN cannot invalidate historical facts or make their cached
    // valuation usable for the current ledger.
    let unresolved = edit(&source(3, "buy", "1", "1000", "0.01"), |v| {
        v["outcome"] = json!("unknown");
        v["consumerReady"] = json!(false);
        v["reason"] = json!("OUTCOME_UNRESOLVED");
    });
    l.observe(&unresolved).unwrap();
    let mut recovered = State::restore(&state.checkpoint().unwrap(), &l).unwrap();
    let mut current = inputs(&l);
    current.version = 3;
    let denied = recovered.observe(&l, &current, 1, current.as_of).unwrap();
    assert_eq!(denied.reason, "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    assert!(denied.snapshot.is_none());
    assert_eq!(recovered.counts(), (3, 2));
}
#[test]
fn corrupt_derived_snapshots_and_missing_sources_refuse_recovery() {
    let l = ledger();
    let i = inputs(&l);
    let mut state = State::default();
    state.observe(&l, &i, 0, i.as_of).unwrap();
    let mut v = state.checkpoint().unwrap();
    v["sources"] = json!([]);
    assert!(State::restore(&v, &l).is_err());
    let mut v = state.checkpoint().unwrap();
    v["snapshots"]
        .as_object_mut()
        .unwrap()
        .values_mut()
        .next()
        .unwrap()["equity"] = json!("999999");
    assert!(State::restore(&v, &l).is_err());
}
#[test]
fn daily_pnl_is_not_reused_across_utc_rollover() {
    let l = ledger();
    let mut i = inputs(&l);
    i.opening_at -= Duration::days(1);
    assert_eq!(evaluate(&l, &i, 0, i.as_of).unwrap().reason, "DAY_ROLLOVER");
}
#[test]
fn invalid_arithmetic_negative_cash_and_timestamp_overflow_refuse() {
    let l = ledger();
    let mut i = inputs(&l);
    i.quote_cash_at_opening = "79228162514264337593543950335".into();
    assert!(evaluate(&l, &i, 0, i.as_of).is_err());
    i.quote_cash_at_opening = "1".into();
    assert_eq!(
        evaluate(&l, &i, 0, i.as_of).unwrap().reason,
        "INVALID_ACCOUNT_CASH_OR_EQUITY"
    );
    i.as_of = chrono::DateTime::<Utc>::MAX_UTC;
    i.valid_until = i.as_of;
    assert!(evaluate(&l, &i, 0, i.as_of).is_err());
    let mut i = inputs(&l);
    i.marks[0].price = "1e-28".into();
    assert!(evaluate(&l, &i, 0, i.as_of).is_err());
}
#[test]
fn content_hash_is_canonical_and_not_an_execution_token() {
    let l = ledger();
    let i = inputs(&l);
    let s = snapshot(&l, &i, 0);
    let mut v = json!(s);
    v.as_object_mut().unwrap().remove("snapshotHash");
    assert_eq!(
        s.snapshot_hash,
        ContentHash::sha256_bytes(
            &canonical_json_bytes(&json!(["quantos-native-risk-input-snapshot/v1", v])).unwrap()
        )
    );
    assert_eq!(serde_json::from_value::<Snapshot>(json!(s)).unwrap(), s);
    let _: Value = json!(i);
}
