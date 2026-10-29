//! Controlled model inputs. Separate mTLS tests prove the current owner join.
use chrono::Duration;
use quantos_portfolio::{
    native_ledger::{NativeLedger, Scope},
    native_source::NativeExecutionFacts,
};
use quantos_reconcile::current::*;
use serde_json::{Value, json};
fn input() -> Input {
    let p: Value = serde_json::from_str(include_str!(
        "../../../docs/audit/evidence/core-x01-current-local-20261029/attempt-01/native-ledger.json"
    ))
    .unwrap();
    let s: NativeExecutionFacts = serde_json::from_value(p["view"]["facts"].clone()).unwrap();
    let c = s.command_id;
    let client = format!(
        "q{}",
        &digest(&json!(["l01-client/v1", c, c])).unwrap().as_str()[7..38]
    );
    let scope = Scope {
        tenant_id: s.tenant_id,
        workspace_id: s.workspace_id,
        account_id: s.account_id,
    };
    let record = ProtocolRecord {
        http_status: 200,
        command_id: c,
        account_id: s.account_id,
        observed_at: s.recorded_at,
        request_hash: digest(&json!("owned independent request")).unwrap(),
        response: json!({"orderId":101,"clientOrderId":client,"symbol":"BTCUSDT","origQty":"1","executedQty":"1","status":"FILLED","side":"BUY","fills":[{"tradeId":201,"qty":"1","price":"1000","commission":"0.01","commissionAsset":"USDT"}]}),
    };
    let books = ProtocolJournal {
        schema_version: "quantos-independent-protocol-journal.v1".into(),
        source_id: "owned-pinned-observer".into(),
        account_id: s.account_id,
        revision: 1,
        captured_at: s.recorded_at,
        records: vec![record],
    };
    Input {
        scope,
        origin_id: books.source_id.clone(),
        checked_at: s.recorded_at + Duration::seconds(1),
        sources: vec![s],
        ledger_checkpoint: p["checkpoint"].clone(),
        books: Some(books),
    }
}
fn state(i: &Input) -> CurrentReconciliation {
    CurrentReconciliation::new(i.scope.clone(), i.origin_id.clone()).unwrap()
}
#[test]
fn independent_raw_response_matches_current_native_and_persistent_ledger_without_full_books_claim()
{
    let i = input();
    let mut s = state(&i);
    assert!(s.observe(i.clone()).unwrap());
    let view = s.view().unwrap();
    assert_eq!(view["comparisonStatus"], "MATCHED_OBSERVATIONS");
    assert_eq!(view["coverage"], "OBSERVED_EXECUTION_DELTAS_ONLY");
    for key in ["fullBooksReady", "dayCloseAllowed", "executionAuthority"] {
        assert_eq!(view[key], false);
    }
    assert_ne!(view["booksHash"], json!(i.sources[0].source_hash));
    assert!(!s.observe(i.clone()).unwrap());
    assert_eq!(s.anchor().sequence, 1);
    assert_eq!(
        CurrentReconciliation::restore(i.scope, i.origin_id, &s.checkpoint().unwrap())
            .unwrap()
            .view()
            .unwrap(),
        view
    );
}
#[test]
fn unknown_stays_open_even_when_independent_response_has_a_full_fill() {
    let mut i = input();
    let source = &mut i.sources[0];
    source.outcome = "unknown".into();
    source.consumer_ready = false;
    source.reason = "OUTCOME_UNRESOLVED".into();
    let mut body = serde_json::to_value(&source).unwrap();
    body.as_object_mut().unwrap().remove("sourceHash");
    source.source_hash = digest(&json!(["quantos-native-execution-source/v1", body])).unwrap();
    let mut l = NativeLedger::new(i.scope.clone()).unwrap();
    l.observe(source).unwrap();
    i.ledger_checkpoint = l.checkpoint().unwrap();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let v = s.view().unwrap();
    assert_eq!(v["unknownObligationsOpen"], 1);
    assert_eq!(v["comparisonStatus"], "DIFFERENCES");
    assert!(
        v["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["kind"] == "OUTCOME_UNRESOLVED")
    );
    assert!(
        v["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["kind"] == "QUARANTINED_BOOK_OBSERVATION"
                && f["observed"]["executedQuantity"] == "1")
    );
    assert_eq!(l.view().unwrap()["appliedFillCount"], 0);
    assert_eq!(
        CurrentReconciliation::restore(i.scope, i.origin_id, &s.checkpoint().unwrap())
            .unwrap()
            .view()
            .unwrap(),
        v
    );
}
#[test]
fn missing_books_never_become_empty_clean_and_recovery_does_not_close_alert_evidence() {
    let mut i = input();
    let book = i.books.take();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let before = s.view().unwrap();
    assert_eq!(before["comparisonStatus"], "UNAVAILABLE");
    assert_eq!(before["openAlertEvidenceCount"], 1);
    assert!(!s.observe(i.clone()).unwrap());
    i.books = book;
    i.checked_at += Duration::seconds(1);
    s.observe(i).unwrap();
    let v = s.view().unwrap();
    assert_eq!(v["comparisonStatus"], "MATCHED_OBSERVATIONS");
    assert_eq!(v["openAlertEvidenceCount"], 1);
    assert_eq!(v["alertEvidence"][0]["status"], "OPEN");
}
#[test]
fn source_scope_origin_clock_and_native_binding_mismatch_are_refused() {
    for which in 0..5 {
        let mut i = input();
        match which {
            0 => i.books.as_mut().unwrap().source_id = "copied-ledger".into(),
            1 => i.books.as_mut().unwrap().account_id = quantos_core::AccountId::new(),
            2 => i.books.as_mut().unwrap().captured_at = i.checked_at + Duration::seconds(1),
            3 => i.sources[0].source_hash = digest(&json!("wrong")).unwrap(),
            _ => i.sources[0].command_id = quantos_core::CommandId::new(),
        };
        let mut s = state(&i);
        assert!(s.observe(i).is_err());
        assert_eq!(s.anchor().sequence, 0);
    }
}
#[test]
fn independent_quantity_price_fee_order_and_side_differences_are_located() {
    for kind in 0..5 {
        let mut i = input();
        let raw = &mut i.books.as_mut().unwrap().records[0].response;
        match kind {
            0 => raw["fills"][0]["price"] = json!("1100"),
            1 => raw["fills"][0]["commission"] = json!("0.02"),
            2 => {
                raw["origQty"] = json!("2");
                raw["executedQty"] = json!("2");
                raw["fills"][0]["qty"] = json!("2");
            }
            3 => raw["status"] = json!("PARTIALLY_FILLED"),
            _ => raw["side"] = json!("SELL"),
        };
        let mut s = state(&i);
        s.observe(i).unwrap();
        let v = s.view().unwrap();
        assert_eq!(v["comparisonStatus"], "DIFFERENCES");
        assert!(v["openAlertEvidenceCount"].as_u64().unwrap() > 0);
        assert!(!v["findings"].as_array().unwrap().is_empty());
    }
}
#[test]
fn copied_ledger_or_native_dto_cannot_masquerade_as_independent_protocol_journal() {
    let i = input();
    assert!(serde_json::from_value::<ProtocolJournal>(i.ledger_checkpoint).is_err());
    assert!(
        serde_json::from_value::<ProtocolJournal>(serde_json::to_value(&i.sources[0]).unwrap())
            .is_err()
    );
}
#[test]
fn signed_source_rollback_or_same_revision_fork_is_not_allowed_after_unavailability() {
    let i = input();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let mut missing = i.clone();
    missing.books = None;
    missing.checked_at += Duration::seconds(1);
    s.observe(missing).unwrap();
    let anchor = s.anchor();
    let mut older = i.clone();
    older.checked_at += Duration::seconds(2);
    older.books.as_mut().unwrap().records.clear();
    older.books.as_mut().unwrap().revision = 0;
    assert!(s.observe(older).is_err());
    let mut fork = i;
    fork.checked_at += Duration::seconds(2);
    fork.books.as_mut().unwrap().records[0].response["fills"][0]["price"] = json!("1100");
    assert!(s.observe(fork).is_err());
    assert_eq!(s.anchor(), anchor);
}
#[test]
fn duplicate_record_fill_and_malformed_response_are_atomic_refusals() {
    for kind in 0..7 {
        let mut i = input();
        let b = i.books.as_mut().unwrap();
        match kind {
            0 => {
                b.records.push(b.records[0].clone());
                b.revision = 2;
            }
            1 => {
                let f = b.records[0].response["fills"][0].clone();
                b.records[0].response["fills"]
                    .as_array_mut()
                    .unwrap()
                    .push(f);
            }
            2 => b.records[0].response["clientOrderId"] = json!("different-command"),
            3 => b.records[0].response["fills"][0]["commission"] = json!("-1"),
            4 => b.records[0].response["executedQty"] = json!("0"),
            5 => {
                let body = b.records[0].response.clone();
                b.records[0].response = json!({"status":200,"body":body});
            }
            _ => b.records[0].http_status = 401,
        };
        let mut s = state(&i);
        assert!(s.observe(i).is_err());
        assert_eq!(s.anchor().sequence, 0);
    }
}
#[test]
fn stale_independent_books_are_unavailable_not_freshened_on_query() {
    let mut i = input();
    i.checked_at += Duration::seconds(91);
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let v = s.view().unwrap();
    assert_eq!(v["booksState"], "STALE");
    assert_eq!(v["comparisonStatus"], "UNAVAILABLE");
    i.checked_at += Duration::seconds(1);
    assert!(!s.observe(i).unwrap());
    assert_eq!(s.view().unwrap()["checkedAt"], v["checkedAt"]);
}
#[test]
fn checkpoint_chain_anchor_fork_and_ledger_body_tampering_are_rejected() {
    let i = input();
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let checkpoint = s.checkpoint().unwrap();
    for field in ["hash", "previous"] {
        let mut c = checkpoint.clone();
        c["frames"][0][field] = json!(digest(&json!("wrong")).unwrap());
        assert!(CurrentReconciliation::restore(i.scope.clone(), i.origin_id.clone(), &c).is_err());
    }
    let mut c = checkpoint;
    c["frames"][0]["input"]["ledgerCheckpoint"]["entries"] = json!([]);
    assert!(CurrentReconciliation::restore(i.scope.clone(), i.origin_id.clone(), &c).is_err());
    assert!(state(&i).verify_anchor(&s.anchor()).is_err());
}
#[test]
fn evidence_outbox_is_bound_to_original_native_ledger_book_and_report_not_delivered_or_closed() {
    let mut i = input();
    i.books.as_mut().unwrap().records[0].response["fills"][0]["commission"] = json!("0.02");
    let mut s = state(&i);
    s.observe(i.clone()).unwrap();
    let v = s.view().unwrap();
    let e = v["alertEvidence"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["binding"].is_object())
        .unwrap();
    assert_eq!(e["binding"]["sourceHash"], json!(i.sources[0].source_hash));
    assert_eq!(e["ledgerHash"], v["ledgerHash"]);
    assert_eq!(e["booksHash"], v["booksHash"]);
    assert_eq!(e["reportId"], v["reportId"]);
    assert_eq!(e["status"], "OPEN");
    assert_eq!(e["executionAuthority"], false);
    assert!(!s.observe(i).unwrap());
}
#[test]
fn non_quote_fees_stay_quarantined_and_never_become_zero_usdt() {
    let mut i = input();
    let s = &mut i.sources[0];
    s.fills[0].fee_currency = "BNB".into();
    s.consumer_ready = false;
    s.reason = "FEE_CONVERSION_REQUIRED".into();
    let mut body = serde_json::to_value(&s).unwrap();
    body.as_object_mut().unwrap().remove("sourceHash");
    s.source_hash = digest(&json!(["quantos-native-execution-source/v1", body])).unwrap();
    let mut l = NativeLedger::new(i.scope.clone()).unwrap();
    l.observe(s).unwrap();
    i.ledger_checkpoint = l.checkpoint().unwrap();
    let mut state = state(&i);
    state.observe(i).unwrap();
    let v = state.view().unwrap();
    assert_eq!(v["comparisonStatus"], "DIFFERENCES");
    assert!(
        v["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["kind"] == "FEE_CONVERSION_REQUIRED")
    );
}
