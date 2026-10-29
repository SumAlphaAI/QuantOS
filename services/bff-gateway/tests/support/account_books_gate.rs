//! Current same-account composition; reference statements are authored independently
//! of native/X01 amounts. No target admission or automatic obligation closure.
use super::*;
use super::{
    account_books as books, c11_activation as c11, current_execution as current,
    current_gate as gate, native_control as kill, valuation,
};
fn reconcile(url: &str) -> Value {
    get(url, "/v1/assisted-testnet/reconciliation")
}
fn statement(lab: &Lab) -> quantos_reconcile::account_books::Books {
    let payload: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("account-books.json")).unwrap())
            .unwrap();
    let mut b: quantos_reconcile::account_books::Books =
        serde_json::from_value(payload["payload"].clone()).unwrap();
    books::advance(&mut b);
    // Scenario contract: independent export of two spot purchases, each 1@1000
    // and USDT0.01 fee, from an owner-authenticated opening USDT10000.
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    b
}
fn claims(lab: &Lab) -> Value {
    let n = gate::native(lab);
    json!({"issuedHash":quantos_reconcile::current::digest(&n["issued"]).unwrap(),"claims":n["claims"],"snapshotClaims":n["snapshotClaims"]})
}
fn control_evidence(url: &str) -> Value {
    let flag = c11::current(url);
    let history = get(
        url,
        &format!(
            "/v1/admin/feature-flags/{}/history",
            flag["resourceId"].as_str().unwrap()
        ),
    );
    assert_eq!(history["totalCount"], 5);
    let activation_audit = gate::audit(url, flag["resourceId"].as_str().unwrap());
    assert_eq!(activation_audit["items"].as_array().unwrap().len(), 5);
    let controls = get(url, "/v1/risk/kill-switch");
    let audits = controls["history"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| gate::audit(url, e["correlationId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    assert!(!audits.is_empty());
    json!({"currentC11":flag,"c11History":history,"activationAudit":activation_audit,"controls":controls,"controlAudits":audits})
}
fn financial_alerts(url: &str) -> (Value, Vec<Value>) {
    let rows = get(url, "/v1/alerts");
    let mut audits = vec![];
    for a in rows["items"].as_array().unwrap() {
        assert_eq!(a["sourceEvidence"]["status"], "OPEN");
        assert_eq!(a["status"], "unacked");
        assert_eq!(a["resolved"], false);
        let audit = gate::audit(url, a["correlationId"].as_str().unwrap());
        assert!(
            audit["items"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["kind"] == "assisted.x05_alert_consumed"
                    && e["redactedPayload"]["evidenceId"] == a["sourceEvidence"]["evidenceId"])
        );
        audits.push(audit);
    }
    (rows, audits)
}
fn review(url: &str, old: &Value, valuation: &Value, generation: &str) -> (u16, Value) {
    call(
        url,
        "session-current",
        "POST",
        &format!(
            "/v1/assisted-testnet/subjects/{}/risk-reviews",
            old["previousSubjectId"].as_str().unwrap()
        ),
        json!({"snapshotHash":valuation["snapshot"]["snapshotHash"],"expectedGeneration":generation}),
        &Uuid::new_v4().to_string(),
    )
}
fn funding(lab: &Lab, url: &str, ledger: &Value, version: u64) -> Value {
    let mut i = valuation::input(lab, ledger, version);
    for m in &mut i.marks {
        if m.symbol == "BTCUSDT" {
            m.price = "2200".into();
        }
    }
    valuation::write(lab, &i);
    get(url, "/v1/assisted-testnet/valuation")
}
#[test]
fn account_books_gate_accepted_controls_and_corrected_open_books_deny_current_risk() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (_, reviewed, id) = current::prepare(&lab, &url);
    let initial = c11::current(&url);
    c11::change(&url, &initial, false);
    let off = c11::current(&url);
    c11::change(&url, &off, true);
    let (s, command) = current::submit(&url, &id, "current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(lab.trace()["protocolCalls"], 2);
    let original = gate::inspect(&url, &id);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let mut b = statement(&lab);
    books::publish(&lab, &b);
    assert_eq!(
        reconcile(&url)["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    books::advance(&mut b);
    b.positions[0].amount = "2".into();
    b.cash[0].amount = "8000".into();
    b.fees[0].amount = "0".into();
    books::publish(&lab, &b);
    assert_eq!(
        reconcile(&url)["accountBooks"]["findings"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    let (alerts, audits) = financial_alerts(&url);
    assert_eq!(alerts["items"].as_array().unwrap().len(), 3);
    books::advance(&mut b);
    b.positions[0].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    assert_eq!(
        reconcile(&url)["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    let before = claims(&lab);
    let immutable = gate::immutable(&gate::native(&lab));
    let request_audit = gate::audit(&url, &id);
    kill::mutate(&url, "session-owner", "engage", "global", 0, None);
    kill::mutate(&url, "session-current", "engage", "account", 1, None);
    let stopped = gate::roundtrip(&url);
    assert_eq!(stopped["killGeneration"], "2");
    let (_r, cold) = lab.bff(true);
    assert_eq!(gate::inspect(&cold, &id), original);
    gate::release(&cold, "account", 2);
    gate::release(&cold, "global", 3);
    books::advance(&mut b);
    books::publish(&lab, &b);
    let recovered = reconcile(&cold);
    assert_eq!(
        recovered["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    let fresh = funding(&lab, &cold, &ledger, 2);
    let (s, denied) = review(&cold, &reviewed, &fresh, "4");
    assert_eq!(s, 200, "{denied}");
    assert_eq!(denied["decision"]["verdict"], "deny");
    assert_eq!(
        denied["booksAdmission"]["reason"],
        "OPEN_FINANCIAL_OBLIGATIONS"
    );
    assert!(denied.get("subject").is_none());
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    assert_eq!(gate::immutable(&gate::native(&lab)), immutable);
    assert_eq!(gate::audit(&cold, &id), request_audit);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_BOOKS_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"CURRENT_BOOKS_OPEN_DENIES_RISK_AFTER_CONTROLS","original":original,"ledger":ledger,"alerts":alerts,"alertAudits":audits,"recovered":recovered,"denied":denied,"claimsBefore":before,"claimsAfter":claims(&lab),"controlEvidence":control_evidence(&cold),"protocolCalls":2,"actualTestnet":false,"noResend":true,"automaticClosure":false}),
    );
}
#[test]
fn account_books_gate_unknown_stays_quarantined_through_controls_and_cold_recovery() {
    let lab = Lab::pause_at(2);
    current::enabled(&lab);
    let (mut process, url) = lab.bff(true);
    let (_, reviewed, id) = current::prepare(&lab, &url);
    let base = url.clone();
    let request = id.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(5))
            .build()
            .unwrap()
            .post(format!(
                "{base}/v1/assisted-testnet/requests/{request}/commands"
            ))
            .header(
                "cookie",
                "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
            )
            .header("origin", "http://localhost:3190")
            .header("x-csrf-token", "csrf-token-0000000000000001")
            .header("x-request-id", Uuid::new_v4().to_string())
            .header("idempotency-key", Uuid::new_v4().to_string())
            .json(&json!({"expectedRevision":2}))
            .send()
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 2);
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let (_r, cold) = lab.bff(true);
    let original = gate::inspect(&cold, &id);
    assert_eq!(original["command"]["state"], "unknown");
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    let b = statement(&lab);
    books::publish(&lab, &b);
    let view = reconcile(&cold);
    assert_eq!(
        view["accountBooks"]["status"],
        "UNKNOWN_OR_QUARANTINED_OBLIGATIONS"
    );
    assert_eq!(view["accountBooks"]["comparisonReady"], false);
    let (alerts, audits) = financial_alerts(&cold);
    assert_eq!(alerts["items"].as_array().unwrap().len(), 3);
    let immutable = gate::immutable(&gate::native(&lab));
    let before = claims(&lab);
    let request_audit = gate::audit(&cold, &id);
    gate::roundtrip(&cold);
    kill::mutate(&cold, "session-current", "engage", "account", 0, None);
    let stopped = gate::roundtrip(&cold);
    assert_eq!(stopped["killGeneration"], "1");
    assert_eq!(stopped["version"], "4");
    let (_again, latest) = lab.bff(true);
    assert_eq!(gate::inspect(&latest, &id), original);
    assert_eq!(reconcile(&latest), view);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    gate::release(&latest, "account", 1);
    let released = c11::current(&latest);
    assert_eq!(released["killGeneration"], "2");
    assert_eq!(released["nativeStopped"], false);
    let valuation = get(&latest, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], false);
    assert!(valuation.get("snapshot").is_none());
    let reject = review(
        &latest,
        &reviewed,
        &json!({"snapshot":{"snapshotHash":reviewed["snapshotHash"]}}),
        "2",
    );
    assert_eq!(reject.0, 409);
    assert_eq!(reconcile(&latest), view);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    assert_eq!(get(&latest, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(gate::inspect(&latest, &id), original);
    assert_eq!(gate::audit(&latest, &id), request_audit);
    assert_eq!(gate::immutable(&gate::native(&lab)), immutable);
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_BOOKS_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"CURRENT_ACCOUNT_BOOKS_UNKNOWN_PUBLIC_CONTROLS","review":reviewed,"original":original,"ledger":ledger,"reconciliation":view,"statement":b,"alerts":alerts,"alertAudits":audits,"requestAudit":request_audit,"stopped":stopped,"released":released,"valuation":valuation,"riskRefusal":{"status":reject.0,"body":reject.1},"claimsBefore":before,"claimsAfter":claims(&lab),"controlEvidence":control_evidence(&latest),"protocolCalls":2,"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false}),
    );
}
