//! Current L4 composition only. Runtime is byte-bound to latest X06 baseline.
use super::*;
use super::{
    account_books as books, books_risk as risk, c11_activation as c11,
    current_execution as current, current_gate as gate, financial_review as fin,
    native_control as kill, valuation,
};
const PATH: &str = "/v1/assisted-testnet/financial-reviews";
fn capture(lab: &Lab) -> Value {
    let v: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("account-books.json")).unwrap())
            .unwrap();
    json!({"signedStatement":v,"certificate":fs::read_to_string(lab.directory.join("server.pem")).unwrap()})
}
fn controls(url: &str) -> Value {
    let f = c11::current(url);
    let id = f["resourceId"].as_str().unwrap();
    let c = get(url, "/v1/risk/kill-switch");
    let audits = c["history"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| gate::audit(url, e["correlationId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    json!({"currentC11":f,"c11History":get(url,&format!("/v1/admin/feature-flags/{id}/history")),"activationAudit":gate::audit(url,id),"controls":c,"controlAudits":audits})
}
fn risk_current(
    lab: &Lab,
    url: &str,
    candidate: &Value,
    ledger: &Value,
    version: u64,
) -> (Value, Value) {
    let mut input = valuation::input(lab, ledger, version);
    for m in &mut input.marks {
        if m.symbol == "BTCUSDT" {
            m.price = "2200".into();
        }
    }
    valuation::write(lab, &input);
    let v = get(url, "/v1/assisted-testnet/valuation");
    assert_eq!(v["riskInputReady"], true);
    let (s, r) = risk::request(url, candidate, &v, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{r}");
    (v, r)
}
fn alerts(url: &str) -> (Value, Vec<Value>) {
    let v = get(url, "/v1/alerts");
    let audits = v["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| {
            assert_eq!(e["sourceEvidence"]["status"], "OPEN");
            assert_eq!(e["resolved"], false);
            gate::audit(url, e["correlationId"].as_str().unwrap())
        })
        .collect();
    (v, audits)
}
#[test]
fn financial_review_gate_current_success_controls_new_review_and_repeat_proposal_refusal() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (_, candidate, ledger, mut b) = fin::setup(&lab, &url);
    let (open_before, _) = alerts(&url);
    let (a, e, p) = fin::authorize(&url);
    let admitted = get(&url, PATH);
    let signed_admitted = capture(&lab);
    let (first_valuation, review) = risk_current(&lab, &url, &candidate, &ledger, 2);
    assert_eq!(review["decision"]["verdict"], "approval_required");
    let id = open(&url, &review["subject"]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let approved = gate::inspect(&url, &id);
    let initial = c11::current(&url);
    c11::change(&url, &initial, false);
    let before_off = risk::immutable(&risk::native(&lab));
    let off = current::submit(&url, &id, "off");
    assert_ne!(off.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before_off);
    let disabled = c11::current(&url);
    c11::change(&url, &disabled, true);
    let on = c11::current(&url);
    assert_eq!(on["version"], "2");
    let (s, command) = current::submit(&url, &id, "current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["currentRisk"]["activation"]["version"], 2);
    assert_eq!(command["currentRisk"]["books"], admitted["riskBooks"]);
    assert_eq!(lab.trace()["protocolCalls"], 2);
    let original = gate::inspect(&url, &id);
    let immutable = gate::immutable(&gate::native(&lab));
    let claims_before = risk::immutable(&risk::native(&lab));
    let request_audit = gate::audit(&url, &id);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let matched = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        matched["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert_eq!(matched["openAlertEvidenceCount"], 3);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 2);
    kill::mutate(&url, "session-owner", "engage", "global", 0, None);
    kill::mutate(&url, "session-current", "engage", "account", 1, None);
    let stopped = gate::roundtrip(&url);
    assert_eq!(stopped["killGeneration"], "2");
    let (_cold, cold) = lab.bff(true);
    assert_eq!(gate::inspect(&cold, &id), original);
    gate::release(&cold, "account", 2);
    gate::release(&cold, "global", 3);
    books::advance(&mut b);
    books::publish(&lab, &b);
    let before_new = get(&cold, PATH);
    assert!(before_new["riskBooks"].get("financialReview").is_none());
    assert_eq!(before_new["history"].as_array().unwrap().len(), 3);
    let (a4, e4, p4) = fin::authorize(&cold);
    let renewed = get(&cold, PATH);
    assert_eq!(
        renewed["riskBooks"]["financialReview"]["killGeneration"],
        "4"
    );
    let signed_renewed = capture(&lab);
    let (fresh_valuation, new_review) = risk_current(&lab, &cold, &candidate, &ledger, 3);
    assert_eq!(new_review["decision"]["verdict"], "approval_required");
    assert_eq!(new_review["proposalHash"], review["proposalHash"]);
    assert_ne!(
        new_review["subject"]["subjectId"],
        review["subject"]["subjectId"]
    );
    let new_id = open(&cold, &new_review["subject"]);
    let empty = gate::inspect(&cold, &new_id);
    assert_eq!(empty["request"]["revision"], 0);
    approve(&cold, &new_id, 0);
    approve(&cold, &new_id, 1);
    let new_approved = gate::inspect(&cold, &new_id);
    let repeat = current::submit(&cold, &new_id, "repeat-proposal");
    assert_eq!(repeat.0, 409, "{}", repeat.1);
    assert_eq!(gate::immutable(&gate::native(&lab)), immutable);
    assert_eq!(risk::immutable(&risk::native(&lab)), claims_before);
    assert_eq!(gate::inspect(&cold, &id), original);
    assert_eq!(gate::audit(&cold, &id), request_audit);
    let (open_after, alert_audits) = alerts(&cold);
    assert_eq!(open_after, open_before);
    let financial_audits = [&a, &a4]
        .iter()
        .map(|r| gate::audit(&cold, r["event"]["caseId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    let journal = fin::journal(&lab);
    let control_evidence = controls(&cold);
    assert_eq!(control_evidence["currentC11"]["version"], "4");
    assert_eq!(control_evidence["controls"]["generation"], "4");
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_FINANCIAL_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false,"protocolCalls":2,"financialReceipts":[a,e,p,a4,e4,p4],"admitted":admitted,"signedAdmitted":signed_admitted,"firstValuation":first_valuation,"review":review,"approved":approved,"initialC11":initial,"offRefusal":{"status":off.0,"body":off.1},"on":on,"command":command,"original":original,"ledger":ledger,"matched":matched,"stopped":stopped,"beforeNewReview":before_new,"renewed":renewed,"signedRenewed":signed_renewed,"freshValuation":fresh_valuation,"newReview":new_review,"emptyApproval":empty,"newApproved":new_approved,"repeatRefusal":{"status":repeat.0,"body":repeat.1},"openBefore":open_before,"alerts":open_after,"alertAudits":alert_audits,"financialAudits":financial_audits,"requestAudit":request_audit,"authorizationJournal":journal,"claimsBefore":claims_before,"claimsAfter":risk::immutable(&risk::native(&lab)),"controlEvidence":control_evidence}),
    );
}
#[test]
fn financial_review_gate_unknown_through_public_controls_and_cold_recovery() {
    let lab = Lab::pause_at(2);
    current::enabled(&lab);
    let (mut process, url) = lab.bff(true);
    let (_, candidate, ledger, mut b) = fin::setup(&lab, &url);
    let (open_before, _) = alerts(&url);
    let (a, _, _) = fin::authorize(&url);
    let admitted = get(&url, PATH);
    let signed_admitted = capture(&lab);
    let (_, review) = risk_current(&lab, &url, &candidate, &ledger, 2);
    let id = open(&url, &review["subject"]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let base = url.clone();
    let request = id.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(10))
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
            .header("idempotency-key", Uuid::new_v4().to_string())
            .header("x-request-id", Uuid::new_v4().to_string())
            .json(&json!({"expectedRevision":2}))
            .send()
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 2);
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let (_r, cold) = lab.bff(true);
    let original = gate::inspect(&cold, &id);
    assert_eq!(original["command"]["state"], "unknown");
    assert_eq!(
        original["command"]["currentRisk"]["books"],
        admitted["riskBooks"]
    );
    let immutable = gate::immutable(&gate::native(&lab));
    let before = risk::immutable(&risk::native(&lab));
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    let (view_before, _) = alerts(&cold);
    assert_eq!(view_before["items"].as_array().unwrap().len(), 6);
    gate::roundtrip(&cold);
    kill::mutate(&cold, "session-current", "engage", "account", 0, None);
    let stopped = gate::roundtrip(&cold);
    let (_again, latest) = lab.bff(true);
    assert_eq!(gate::inspect(&latest, &id), original);
    gate::release(&latest, "account", 1);
    let released = c11::current(&latest);
    assert_eq!(released["killGeneration"], "2");
    assert_eq!(released["nativeStopped"], false);
    let view = get(&latest, PATH);
    assert_eq!(view["reviewable"], false);
    assert_eq!(view["currentBooks"]["unknownObligations"], 1);
    assert!(view["riskBooks"].get("financialReview").is_none());
    let body = fin::body(&latest, "session-current", &view, "request");
    let refusal = fin::post(
        &latest,
        "session-current",
        PATH,
        &body,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(refusal.0, 409);
    let valuation = get(&latest, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], false);
    assert!(valuation.get("snapshot").is_none());
    let after = get(&latest, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        after["accountBooks"]["status"],
        "UNKNOWN_OR_QUARANTINED_OBLIGATIONS"
    );
    let (open_after, alert_audits) = alerts(&latest);
    assert_eq!(view_before, open_after);
    for old in open_before["items"].as_array().unwrap() {
        assert!(open_after["items"].as_array().unwrap().contains(old));
    }
    assert_eq!(gate::inspect(&latest, &id), original);
    assert_eq!(gate::immutable(&gate::native(&lab)), immutable);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    let request_audit = gate::audit(&latest, &id);
    let financial_audit = gate::audit(&latest, a["event"]["caseId"].as_str().unwrap());
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_FINANCIAL_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false,"protocolCalls":2,"admitted":admitted,"signedAdmitted":signed_admitted,"review":review,"original":original,"ledger":ledger,"priorFinancialAlerts":open_before,"alerts":open_after,"alertAudits":alert_audits,"view":view,"reviewRefusal":{"status":refusal.0,"body":refusal.1},"reconciliation":after,"valuation":valuation,"stopped":stopped,"released":released,"requestAudit":request_audit,"financialAudit":financial_audit,"authorizationJournal":fin::journal(&lab),"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"controlEvidence":controls(&latest)}),
    );
}
#[test]
fn financial_review_gate_recovered_source_still_has_an_unreviewable_open_obligation() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (_, candidate, ledger) = risk::seed(&lab, &url);
    let mut b = books::statement(&lab);
    b.valid_until = b.captured_at + Duration::seconds(2);
    books::publish(&lab, &b);
    let initial = get(&url, PATH);
    assert_eq!(initial["currentBooks"]["openObligations"], 0);
    std::thread::sleep(Wait::from_millis(2100));
    let stale = get(&url, PATH);
    assert_eq!(stale["currentBooks"]["accountState"], "STALE_SOURCE");
    assert_eq!(stale["currentBooks"]["openObligations"], 1);
    books::advance(&mut b);
    books::publish(&lab, &b);
    let recovered = get(&url, PATH);
    assert_eq!(
        recovered["currentBooks"]["accountState"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert_eq!(recovered["currentBooks"]["openObligations"], 1);
    assert_eq!(recovered["reviewable"], false);
    let body = fin::body(&url, "session-current", &recovered, "request");
    let rejected = fin::post(
        &url,
        "session-current",
        PATH,
        &body,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(rejected.0, 409);
    let before = risk::immutable(&risk::native(&lab));
    let (v, r) = risk_current(&lab, &url, &candidate, &ledger, 2);
    assert_eq!(r["decision"]["verdict"], "deny");
    assert_eq!(r["booksAdmission"]["reason"], "OPEN_FINANCIAL_OBLIGATIONS");
    assert!(r.get("subject").is_none());
    let (open, alert_audits) = alerts(&url);
    assert_eq!(open["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        open["items"][0]["sourceEvidence"]["finding"]["kind"],
        "ACCOUNT_BOOKS_STALE"
    );
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_FINANCIAL_GAP_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false,"protocolCalls":1,"initial":initial,"stale":stale,"recovered":recovered,"signedRecovered":capture(&lab),"reviewRefusal":{"status":rejected.0,"body":rejected.1},"valuation":v,"risk":r,"alerts":open,"alertAudits":alert_audits,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"remainingGap":"EXPLICIT_SOURCE_HEALTH_OBLIGATION_DISPOSITION_NOT_IMPLEMENTED"}),
    );
}
