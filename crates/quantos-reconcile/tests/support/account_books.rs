use super::*;
use quantos_reconcile::account_books::{Balance, Basis, Books, COVERAGE};
#[test]
fn historical_protocol_frames_restore_without_rebinding_or_backfilling_account_fields() {
    let p:Value=serde_json::from_str(include_str!("../../../../docs/audit/evidence/core-x05-current-local-20261029/attempt-01/reconciliation.json")).unwrap();
    let c = &p["checkpoint"];
    let scope = serde_json::from_value(c["scope"].clone()).unwrap();
    let s =
        CurrentReconciliation::restore(scope, c["originId"].as_str().unwrap().into(), c).unwrap();
    assert_eq!(s.checkpoint().unwrap(), *c);
    assert_eq!(s.view().unwrap(), p["view"]);
    assert!(s.view().unwrap().get("accountBooks").is_none());
}
fn account_input() -> Input {
    let mut i = input();
    let at = i.checked_at;
    let opening = at - Duration::seconds(10);
    let origin = NativeLedger::new(i.scope.clone()).unwrap().view().unwrap();
    i.account_basis = Some(Basis {
        scope: i.scope.clone(),
        source_hash: digest(&json!("accepted owner X01 input")).unwrap(),
        source_ref: "fixture:opening-cash".into(),
        origin_ledger_hash: serde_json::from_value(origin["ledgerHash"].clone()).unwrap(),
        opening_at: opening,
        quote_currency: "USDT".into(),
        opening_cash: "10000".into(),
    });
    // Independent fixture statement is authored from the scenario's contract,
    // never by reading ledger positions/cash/fees or native response bodies.
    let row = |asset: &str, amount: &str| Balance {
        asset: asset.into(),
        amount: amount.into(),
        source_ref: format!("fixture:independent-statement:{asset}"),
    };
    i.account_books = Some(Books {
        schema_version: "quantos-independent-account-books.v1".into(),
        scope: i.scope.clone(),
        source_id: i.origin_id.clone(),
        version: 1,
        previous_hash: None,
        source_ref: "fixture:account-statement:1".into(),
        coverage: COVERAGE.into(),
        position_universe: vec!["BTCUSDT".into(), "ETHUSDT".into()],
        cash_universe: vec!["USDT".into()],
        fee_universe: vec!["USDT".into()],
        positions_complete: true,
        cash_complete: true,
        fees_complete: true,
        external_flows_absent: true,
        liabilities_absent: true,
        open_orders_absent: true,
        period_start: opening,
        coverage_through: at,
        captured_at: at,
        valid_until: at + Duration::seconds(30),
        positions: vec![row("BTCUSDT", "1"), row("ETHUSDT", "0")],
        cash: vec![row("USDT", "8999.99")],
        fees: vec![row("USDT", "0.01")],
    });
    i.account_books_checked = true;
    i
}
fn advance(i: &mut Input) {
    let b = i.account_books.as_mut().unwrap();
    b.previous_hash = Some(b.content_hash().unwrap());
    b.version += 1;
    i.checked_at += Duration::seconds(1);
    b.captured_at = i.checked_at;
    b.coverage_through = i.checked_at;
    b.valid_until = i.checked_at + Duration::seconds(30);
}
#[test]
fn independent_account_balances_are_source_bound_exact_and_read_only() {
    let i = account_input();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let v = s.view().unwrap();
    let a = &v["accountBooks"];
    assert_eq!(a["status"], "MATCHED_DECLARED_ACCOUNT_BOOKS");
    assert_eq!(a["comparisonReady"], true);
    assert_eq!(a["sourceVersion"], "1");
    assert_ne!(a["sourceHash"], v["booksHash"]);
    for k in ["fullBooksReady", "dayCloseAllowed", "executionAuthority"] {
        assert_eq!(a[k], false);
        assert_eq!(v[k], false);
    }
    assert!(!s.observe(i.clone()).unwrap());
    assert_eq!(
        CurrentReconciliation::restore(i.scope, i.origin_id, &s.checkpoint().unwrap())
            .unwrap()
            .view()
            .unwrap(),
        v
    );
}
#[test]
fn each_financial_difference_is_open_and_correction_does_not_close_it() {
    let mut i = account_input();
    let b = i.account_books.as_mut().unwrap();
    b.positions[0].amount = "2".into();
    b.cash[0].amount = "9000".into();
    b.fees[0].amount = "0".into();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let v = s.view().unwrap();
    assert_eq!(v["accountBooks"]["findings"].as_array().unwrap().len(), 3);
    assert_eq!(v["openAlertEvidenceCount"], 3);
    advance(&mut i);
    let b = i.account_books.as_mut().unwrap();
    b.positions[0].amount = "1.0000000000000000000000000000".into();
    b.cash[0].amount = "8999.990".into();
    b.fees[0].amount = "0.010".into();
    s.observe(i.clone()).unwrap();
    let corrected = s.view().unwrap();
    assert_eq!(
        corrected["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert_eq!(corrected["alertEvidence"], v["alertEvidence"]);
    let mut cold = CurrentReconciliation::restore(
        i.scope.clone(),
        i.origin_id.clone(),
        &s.checkpoint().unwrap(),
    )
    .unwrap();
    i.account_books = None;
    i.checked_at += Duration::seconds(1);
    cold.observe(i).unwrap();
    let missing = cold.view().unwrap();
    assert_eq!(missing["accountBooks"]["comparisonReady"], false);
    assert_eq!(missing["openAlertEvidenceCount"], 4);
    for e in missing["alertEvidence"].as_array().unwrap() {
        assert_eq!(e["status"], "OPEN");
    }
}
#[test]
fn coverage_cannot_silently_omit_positions_cash_fees_or_unsupported_obligations() {
    let mutations: Vec<fn(&mut Books)> = vec![
        |b| b.positions.pop().map(|_| ()).unwrap(),
        |b| b.cash.clear(),
        |b| b.fees.clear(),
        |b| b.positions_complete = false,
        |b| b.cash_complete = false,
        |b| b.fees_complete = false,
        |b| b.external_flows_absent = false,
        |b| b.liabilities_absent = false,
        |b| b.open_orders_absent = false,
        |b| b.position_universe.push("XRPUSDT".into()),
        |b| {
            b.fee_universe = vec!["BNB".into()];
            b.fees[0].asset = "BNB".into();
        },
        |b| b.period_start -= Duration::seconds(1),
        |b| b.coverage = "DERIVATIVES".into(),
    ];
    for mutate in mutations {
        let mut i = account_input();
        mutate(i.account_books.as_mut().unwrap());
        let mut s = state(&i);
        s.observe(i).unwrap();
        let v = s.view().unwrap();
        assert_eq!(
            v["accountBooks"]["status"], "INCOMPLETE_OR_UNSUPPORTED_COVERAGE",
            "{v}"
        );
        assert_eq!(v["accountBooks"]["comparisonReady"], false);
    }
}
#[test]
fn wrong_scope_source_duplicate_decimal_or_future_statement_is_atomic_refusal() {
    let mutations: Vec<fn(&mut Books)> = vec![
        |b| b.scope.account_id = quantos_core::AccountId::new(),
        |b| b.source_id = "other".into(),
        |b| b.positions.push(b.positions[0].clone()),
        |b| b.positions[0].amount = "0.00000000000000000000000000001".into(),
        |b| b.cash[0].amount = "1e2".into(),
        |b| b.captured_at += Duration::seconds(1),
        |b| b.valid_until += Duration::seconds(1),
        |b| b.version = 0,
        |b| b.source_ref.clear(),
        |b| b.position_universe.reverse(),
    ];
    for mutate in mutations {
        let mut i = account_input();
        let mut s = state(&i);
        let before = s.checkpoint().unwrap();
        mutate(i.account_books.as_mut().unwrap());
        assert!(s.observe(i).is_err());
        assert_eq!(s.checkpoint().unwrap(), before);
    }
}
#[test]
fn monotonic_versions_prefix_origin_and_universe_survive_restart() {
    let first = account_input();
    let mut s = state(&first);
    s.observe(first.clone()).unwrap();
    let a = s.anchor();
    let mut next = first.clone();
    advance(&mut next);
    s.observe(next.clone()).unwrap();
    let cp = s.checkpoint().unwrap();
    for mode in 0..7 {
        let mut cold =
            CurrentReconciliation::restore(first.scope.clone(), first.origin_id.clone(), &cp)
                .unwrap();
        let mut bad = next.clone();
        advance(&mut bad);
        let b = bad.account_books.as_mut().unwrap();
        match mode {
            0 => {
                b.version = 1;
                b.previous_hash = None;
            }
            1 => b.version += 1,
            2 => b.previous_hash = None,
            3 => {
                b.version = 2;
                b.previous_hash = next.account_books.as_ref().unwrap().previous_hash.clone();
                b.cash[0].amount = "1".into();
            }
            4 => b.position_universe.push("XRPUSDT".into()),
            5 => bad.account_basis.as_mut().unwrap().opening_cash = "20000".into(),
            _ => bad.account_books_checked = false,
        };
        assert!(cold.observe(bad).is_err(), "mode {mode}");
        assert_eq!(cold.checkpoint().unwrap(), cp);
    }
    let mut cold =
        CurrentReconciliation::restore(first.scope.clone(), first.origin_id.clone(), &cp).unwrap();
    assert!(cold.verify_anchor(&a).is_ok());
    assert!(
        CurrentReconciliation::restore(first.scope, first.origin_id, &json!({"frames":[]}))
            .is_err()
    );
    next.account_books = None;
    next.checked_at += Duration::seconds(1);
    cold.observe(next).unwrap();
    assert_eq!(
        cold.view().unwrap()["accountBooks"]["status"],
        "SOURCE_UNAVAILABLE"
    );
}
#[test]
fn half_open_expiry_missing_basis_and_short_coverage_never_use_cached_match() {
    let mut i = account_input();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    i.checked_at = i.account_books.as_ref().unwrap().valid_until;
    s.observe(i.clone()).unwrap();
    assert_eq!(s.view().unwrap()["accountBooks"]["status"], "STALE_SOURCE");
    let mut i = account_input();
    i.account_basis = None;
    let mut s = state(&i);
    s.observe(i).unwrap();
    assert_eq!(
        s.view().unwrap()["accountBooks"]["status"],
        "LOCAL_OPENING_BASIS_UNAVAILABLE"
    );
    let mut i = account_input();
    let t = i.sources[0].recorded_at - Duration::seconds(1);
    i.account_books.as_mut().unwrap().coverage_through = t;
    let mut s = state(&i);
    s.observe(i).unwrap();
    assert_eq!(
        s.view().unwrap()["accountBooks"]["status"],
        "NATIVE_PERIOD_OR_OPEN_ORDERS_NOT_COVERED"
    );
}
#[test]
fn exact_cash_arithmetic_refuses_unrepresentable_precision_without_partial_registration() {
    let mut i = account_input();
    i.account_basis.as_mut().unwrap().opening_cash = "79228162514264337593543950335".into();
    let mut s = state(&i);
    let before = s.checkpoint().unwrap();
    assert!(s.observe(i).is_err());
    assert_eq!(s.checkpoint().unwrap(), before);
}
#[test]
fn unknown_overrides_independent_balances_even_if_the_statement_observed_execution() {
    let mut i = account_input();
    let source = &mut i.sources[0];
    source.outcome = "unknown".into();
    source.consumer_ready = false;
    source.reason = "OUTCOME_UNRESOLVED".into();
    let mut body = json!(source);
    body.as_object_mut().unwrap().remove("sourceHash");
    source.source_hash = digest(&json!(["quantos-native-execution-source/v1", body])).unwrap();
    let mut ledger = NativeLedger::new(i.scope.clone()).unwrap();
    ledger.observe(source).unwrap();
    i.ledger_checkpoint = ledger.checkpoint().unwrap();
    let mut s = state(&i);
    s.observe(i).unwrap();
    let v = s.view().unwrap();
    assert_eq!(
        v["accountBooks"]["status"],
        "UNKNOWN_OR_QUARANTINED_OBLIGATIONS"
    );
    assert_eq!(v["accountBooks"]["comparisonReady"], false);
    assert_eq!(v["unknownObligationsOpen"], 1);
    assert!(
        v["alertEvidence"]
            .as_array()
            .unwrap()
            .iter()
            .all(|e| e["status"] == "OPEN")
    );
}
