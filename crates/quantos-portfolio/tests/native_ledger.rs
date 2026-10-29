//! Owner-shaped model fixtures; actual BFF tests separately prove native ingestion.
use quantos_core::{CommandId, ContentHash};
use quantos_portfolio::native_ledger::*;
use serde_json::{Value, json};
#[path = "support/native_fixture.rs"]
mod fixture;
use fixture::{edit, scope, source};
#[test]
fn exact_fees_post_once_restore_and_hash_binding() {
    let s = source(1, "buy", "1", "1000", "0.0100000000000000000001");
    let mut l = NativeLedger::new(scope()).unwrap();
    assert!(l.observe(&s).unwrap());
    let before = l.checkpoint().unwrap();
    assert!(!l.observe(&s).unwrap());
    assert_eq!(l.checkpoint().unwrap(), before);
    let restored = NativeLedger::restore(scope(), &before).unwrap();
    assert_eq!(restored.view().unwrap(), l.view().unwrap());
    let v = l.view().unwrap();
    assert_eq!(v["positions"][0]["quantity"], "1");
    assert_eq!(v["quoteFeesTotal"], "0.0100000000000000000001");
    assert_eq!(v["entries"][0]["sourceHash"], json!(s.source_hash));
    assert_eq!(v["appliedFillCount"], 1);
    assert_eq!(v["valuationReady"], false);
}
#[test]
fn buys_sell_close_and_flip_have_exact_cash_and_realized_pnl() {
    let mut l = NativeLedger::new(scope()).unwrap();
    for s in [
        source(1, "buy", "2", "100", "0.2"),
        source(2, "sell", "1", "110", "0.1"),
        source(3, "sell", "2", "90", "0.2"),
    ] {
        l.observe(&s).unwrap();
    }
    let v = l.view().unwrap();
    assert_eq!(v["positions"][0]["quantity"], "-1");
    assert_eq!(v["positions"][0]["averageEntryPrice"], "90");
    assert_eq!(v["positions"][0]["realizedPnl"], "-0.5");
    assert_eq!(v["quoteCashDelta"], "89.5");
    assert_eq!(v["quoteFeesTotal"], "0.5");
}
#[test]
fn unknown_with_observed_fill_is_durable_quarantine_and_never_posts() {
    let s = edit(&source(1, "buy", "1", "1000", "0.01"), |v| {
        v["outcome"] = json!("unknown");
        v["consumerReady"] = json!(false);
        v["reason"] = json!("OUTCOME_UNRESOLVED");
    });
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&s).unwrap();
    let v = l.view().unwrap();
    assert_eq!(v["consumerReady"], false);
    assert_eq!(v["appliedFillCount"], 0);
    assert_eq!(v["entries"][0]["observedFillIds"], json!(["fill:1"]));
    assert_eq!(v["entries"][0]["state"], "quarantined");
    let mut again = NativeLedger::restore(scope(), &l.checkpoint().unwrap()).unwrap();
    assert!(!again.observe(&s).unwrap());
    assert!(
        again
            .observe(&source(1, "buy", "1", "1000", "0.01"))
            .is_err()
    );
    assert_eq!(again.view().unwrap(), v);
}
#[test]
fn foreign_fee_remains_in_raw_checkpoint_without_zero_conversion() {
    let s = edit(&source(1, "buy", "1", "1000", "0.01"), |v| {
        v["fills"][0]["feeCurrency"] = json!("BNB");
        v["consumerReady"] = json!(false);
        v["reason"] = json!("FEE_CONVERSION_REQUIRED");
    });
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&s).unwrap();
    assert_eq!(
        l.view().unwrap()["entries"][0]["reason"],
        "FEE_CONVERSION_REQUIRED"
    );
    assert_eq!(
        l.checkpoint().unwrap()["entries"][0]["observation"]["body"]["fills"][0]["feeCurrency"],
        "BNB"
    );
    assert_eq!(l.view().unwrap()["positions"], json!([]));
}
#[test]
fn malformed_or_rebound_sources_are_atomic_refusals() {
    let s = source(1, "buy", "1", "1000", "0.01");
    for field in ["accountId", "workspaceId", "tenantId"] {
        let bad = edit(&s, |v| v[field] = json!(uuid::Uuid::new_v4()));
        assert!(NativeLedger::new(scope()).unwrap().observe(&bad).is_err());
    }
    for field in ["commandId", "accountId", "symbol", "orderId", "side"] {
        let bad = edit(&s, |v| {
            v["fills"][0][field] = json!(if field.ends_with("Id") {
                uuid::Uuid::new_v4().to_string()
            } else {
                "wrong".into()
            })
        });
        let mut l = NativeLedger::new(scope()).unwrap();
        assert!(l.observe(&bad).is_err());
        assert_eq!(l.anchor().sequence, 0);
    }
    let mut bad = s.clone();
    bad.fills[0].fee_amount = "2".into();
    assert!(NativeLedger::new(scope()).unwrap().observe(&bad).is_err());
}
#[test]
fn fill_identity_cannot_be_reused_by_another_command_even_when_quarantined() {
    let a = source(1, "buy", "1", "1000", "0.01");
    let b = edit(&source(2, "buy", "1", "1000", "0.01"), |v| {
        v["fills"][0]["fillId"] = json!(a.fills[0].fill_id)
    });
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&a).unwrap();
    let before = l.checkpoint().unwrap();
    assert!(l.observe(&b).is_err());
    assert_eq!(before, l.checkpoint().unwrap());
}
#[test]
fn arithmetic_precision_loss_or_bad_late_fill_never_partly_posts() {
    let a = source(
        1,
        "buy",
        "0.00000000000000000001",
        "0.00000000000000000001",
        "0",
    );
    let mut l = NativeLedger::new(scope()).unwrap();
    assert!(l.observe(&a).is_err());
    assert_eq!(l.anchor().sequence, 0);
    let bad = edit(&source(2, "buy", "2", "1000", "0.01"), |v| {
        let mut fill = v["fills"][0].clone();
        v["fills"][0]["quantity"] = json!("1");
        fill["fillId"] = json!("fill:late");
        fill["quantity"] = json!("1");
        fill["feeAmount"] = json!("-1");
        v["fills"].as_array_mut().unwrap().push(fill);
    });
    assert!(l.observe(&bad).is_err());
    assert_eq!(l.anchor().sequence, 0);
}
#[test]
fn authenticated_checkpoint_still_requires_chain_source_and_anchor_consistency() {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "buy", "1", "1000", "0.01")).unwrap();
    let saved = l.checkpoint().unwrap();
    for key in ["hash", "previous"] {
        let mut bad = saved.clone();
        bad["entries"][0][key] = json!(ContentHash::sha256_bytes(b"corrupt"));
        assert!(NativeLedger::restore(scope(), &bad).is_err());
    }
    let mut bad = saved.clone();
    bad["entries"][0]["observation"]["body"]["fills"][0]["price"] = json!("3");
    assert!(NativeLedger::restore(scope(), &bad).is_err());
    let mut bad = saved;
    bad["anchor"]["sequence"] = json!(0);
    assert!(NativeLedger::restore(scope(), &bad).is_err());
}
#[test]
fn persisted_anchor_detects_missing_history_and_forks() {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "buy", "1", "1000", "0.01")).unwrap();
    let anchor = l.anchor();
    assert!(
        NativeLedger::new(scope())
            .unwrap()
            .verify_anchor(&anchor)
            .is_err()
    );
    let mut fork = NativeLedger::new(scope()).unwrap();
    fork.observe(&source(2, "buy", "1", "1000", "0.01"))
        .unwrap();
    assert!(fork.verify_anchor(&anchor).is_err());
    l.observe(&source(2, "buy", "1", "1000", "0.01")).unwrap();
    l.verify_anchor(&anchor).unwrap();
}
#[test]
fn legacy_no_journal_command_is_query_only_and_cannot_be_upgraded_implicitly() {
    let s = source(1, "buy", "1", "1000", "0.01");
    let b = LegacyBinding {
        request_id: s.request_id,
        command_id: s.command_id,
        subject_hash: s.subject_hash.clone(),
    };
    let mut l = NativeLedger::new(scope()).unwrap();
    assert!(l.observe_legacy(b.clone()).unwrap());
    assert!(!l.observe_legacy(b).unwrap());
    assert_eq!(l.view().unwrap()["entries"][0]["sourceHash"], Value::Null);
    assert_eq!(l.view().unwrap()["consumerReady"], false);
    assert!(l.observe(&s).is_err());
    assert!(l.receipt(CommandId::from_uuid(uuid::Uuid::nil())).is_none());
}
