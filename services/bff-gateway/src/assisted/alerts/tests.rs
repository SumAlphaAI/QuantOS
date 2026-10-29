use super::*;
fn fixture() -> (Scope, Vec<AlertEvidence>) {
    // Historical packet supplies typed model inputs only; current process tests
    // independently generate and consume fresh X05 evidence.
    let v:Value=serde_json::from_str(include_str!("../../../../../docs/audit/evidence/core-x05-current-local-20261029/attempt-02/unknown-reconciliation.json")).unwrap();
    let e: Vec<AlertEvidence> = serde_json::from_value(v["view"]["alertEvidence"].clone()).unwrap();
    (e[0].scope.clone(), e)
}
#[test]
fn consumes_each_open_evidence_once() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s);
    assert!(i.consume(&e).unwrap());
    let first = serde_json::to_value(&i).unwrap();
    assert!(!i.consume(&e).unwrap());
    assert_eq!(first, serde_json::to_value(i).unwrap());
}
#[test]
fn recovery_reconstructs_same_source_and_read_only_rows() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s.clone());
    i.consume(&e).unwrap();
    let v = serde_json::to_value(&i).unwrap();
    let restored: Inbox = serde_json::from_value(v).unwrap();
    restored.verify(&s, &i.anchor, &e).unwrap();
    restored.verify(&s, &Anchor::default(), &e).unwrap();
    assert_eq!(i.rows(), restored.rows());
    for row in i.rows() {
        assert_eq!(row["mode"], "assisted_live");
        assert_eq!(row["active"], true);
        assert_eq!(row["resolved"], false);
        assert_eq!(row["status"], "unacked");
        assert_eq!(row["readOnly"], true);
        assert_eq!(row["sourceRef"], row["sourceEvidence"]["evidenceId"]);
    }
}
#[test]
fn unknown_stays_open_even_with_observed_fill() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s);
    i.consume(&e).unwrap();
    let rows = i.rows();
    assert!(rows.iter().any(|r| r["rule"] == "OUTCOME_UNRESOLVED"));
    assert!(
        rows.iter()
            .any(|r| r["sourceEvidence"]["finding"]["observed"]["executedQuantity"] == "1")
    );
    assert!(rows.iter().all(|r| r["sourceEvidence"]["status"] == "OPEN"));
}
#[test]
fn unavailable_recovery_does_not_remove_consumed_obligations() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s.clone());
    i.consume(&e).unwrap();
    assert!(i.verify(&s, &i.anchor, &[]).is_err());
    assert!(i.consume(&[]).is_err());
    assert_eq!(i.records.len(), e.len());
}
#[test]
fn changed_source_body_refuses_without_partial_consumption() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s);
    i.consume(&e).unwrap();
    let before = serde_json::to_value(&i).unwrap();
    let mut changed = e.clone();
    changed[0].report_id = ContentHash::sha256_bytes(b"wrong report");
    assert!(i.consume(&changed).is_err());
    assert_eq!(before, serde_json::to_value(i).unwrap());
}
#[test]
fn forged_scope_status_authority_and_id_refuse() {
    let (s, e) = fixture();
    for kind in 0..4 {
        let mut changed = e.clone();
        match kind {
            0 => changed[0].scope.account_id = AccountId::from_uuid(Uuid::new_v4()),
            1 => changed[0].status = "CLOSED".into(),
            2 => changed[0].execution_authority = true,
            _ => changed[0].evidence_id = ContentHash::sha256_bytes(b"forged"),
        };
        assert!(Inbox::new(s.clone()).consume(&changed).is_err());
    }
}
#[test]
fn duplicate_checkpoint_rows_and_extra_fields_refuse() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s.clone());
    i.consume(&e).unwrap();
    i.records.push(i.records[0].clone());
    assert!(i.verify(&s, &Anchor::default(), &e).is_err());
    let mut v = serde_json::to_value(Inbox::new(s)).unwrap();
    v["closed"] = json!(true);
    assert!(serde_json::from_value::<Inbox>(v).is_err());
}
#[test]
fn rollback_fork_and_anchor_tamper_refuse() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s.clone());
    i.consume(&e).unwrap();
    let mut bad = i.clone();
    bad.records.pop();
    assert!(bad.verify(&s, &i.anchor, &e).is_err());
    let mut bad = i.clone();
    bad.anchor.head = Some(ContentHash::sha256_bytes(b"wrong"));
    assert!(bad.verify(&s, &Anchor::default(), &e).is_err());
    if i.records.len() > 1 {
        let mut bad = i.clone();
        bad.records.reverse();
        bad.anchor.head = bad.heads().unwrap().last().cloned();
        assert!(bad.verify(&s, &i.anchor, &e).is_err());
    }
}
#[test]
fn missing_source_identity_refuses() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s.clone());
    i.consume(&e).unwrap();
    let mut missing = e.clone();
    missing.pop();
    assert!(i.verify(&s, &Anchor::default(), &missing).is_err());
}
#[test]
fn append_preserves_original_alert_identity_and_observation_time() {
    let (s, e) = fixture();
    let mut i = Inbox::new(s);
    i.consume(&e[..1]).unwrap();
    let first = i.rows()[0].clone();
    i.consume(&e).unwrap();
    assert_eq!(first, i.rows()[0]);
    assert_ne!(i.rows()[0]["id"], i.rows()[1]["id"]);
    assert_eq!(
        i.rows()[0]["occurredAt"],
        serde_json::to_value(e[0].observed_at).unwrap()
    );
}
