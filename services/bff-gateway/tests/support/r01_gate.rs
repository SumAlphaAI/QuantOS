//! Current authenticated R01/mixed review/control L4 composition. Runtime unchanged.
use super::financial_review_gate::{alerts, capture, controls};
use super::r01_provenance as market;
use super::*;
use super::{
    account_books as books, books_risk as risk, c11_activation as c11,
    current_execution as current, current_gate as gate, financial_review as fin,
    native_control as kill, source_review as source, valuation,
};
use quantos_portfolio::{market_provenance::SignedArtifact, native_valuation::Inputs};
const PATH: &str = "/v1/assisted-testnet/source-reviews";
const FIN: &str = "/v1/assisted-testnet/financial-reviews";
use super::source_review_gate::setup;
fn authorize(url: &str) -> Vec<Value> {
    let (a, b, c) = source::authorize(url);
    let (d, e, f) = fin::authorize(url);
    vec![a, b, c, d, e, f]
}
#[test]
fn r01_gate_current_success_controls_new_review_and_repeat_proposal_refusal() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (_, candidate, ledger, mut b) = setup(&lab, &url);
    market::configure(&lab, true);
    let (_market, url) = lab.bff(true);
    let (open_before, _) = alerts(&url);
    let source_receipts = source::authorize(&url);
    let source_only = get(&url, PATH);
    let (source_only_valuation, source_only_risk) =
        risk_current(&lab, &url, &candidate, &ledger, 2);
    assert_eq!(source_only_risk["decision"]["verdict"], "deny");
    assert_eq!(
        source_only_risk["booksAdmission"]["reason"],
        "OPEN_FINANCIAL_OBLIGATIONS"
    );
    let (fa, fe, fp) = fin::authorize(&url);
    let first_receipts = vec![
        source_receipts.0,
        source_receipts.1,
        source_receipts.2,
        fa,
        fe,
        fp,
    ];
    let admitted = get(&url, PATH);
    let signed_admitted = capture(&lab);
    let first_valuation = source_only_valuation.clone();
    let (status, review) = risk::request(
        &url,
        &candidate,
        &first_valuation,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(status, 200, "{review}");
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
    assert_eq!(matched["openAlertEvidenceCount"], 4);
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
    assert!(before_new["riskBooks"].get("sourceReview").is_none());
    assert_eq!(before_new["history"].as_array().unwrap().len(), 6);
    let next_receipts = authorize(&cold);
    let renewed = get(&cold, PATH);
    assert_eq!(
        renewed["riskBooks"]["financialReview"]["killGeneration"],
        "4"
    );
    let signed_renewed = capture(&lab);
    let (fresh_valuation, new_review) = risk_current(&lab, &cold, &candidate, &ledger, 3);
    assert_eq!(new_review["decision"]["verdict"], "deny", "{new_review}");
    assert!(new_review.get("subject").is_none());
    assert_eq!(new_review["proposalHash"], review["proposalHash"]);
    assert!(
        new_review["decision"]["checks"]
            .as_array()
            .unwrap()
            .iter()
            .any(|c| c["rule"] == "concentration" && c["breached"] == true)
    );
    let deny_audit = gate::audit(
        &cold,
        new_review["decision"]["decisionId"].as_str().unwrap(),
    );
    let repeat = current::submit(&cold, &id, "no-resend-after-current-deny");
    assert_ne!(repeat.0, 200, "{}", repeat.1);
    assert_eq!(gate::immutable(&gate::native(&lab)), immutable);
    assert_eq!(risk::immutable(&risk::native(&lab)), claims_before);
    assert_eq!(gate::inspect(&cold, &id), original);
    assert_eq!(gate::audit(&cold, &id), request_audit);
    let (open_after, alert_audits) = alerts(&cold);
    assert_eq!(open_after, open_before);
    let review_audits = [
        &first_receipts[0],
        &first_receipts[3],
        &next_receipts[0],
        &next_receipts[3],
    ]
    .iter()
    .map(|r| gate::audit(&cold, r["event"]["caseId"].as_str().unwrap()))
    .collect::<Vec<_>>();
    let journal = fin::journal(&lab);
    let control_evidence = controls(&cold);
    assert_eq!(control_evidence["currentC11"]["version"], "4");
    assert_eq!(control_evidence["controls"]["generation"], "4");
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        &lab,
        "QUANTOS_L4_R01_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false,"protocolCalls":2,"reviewReceipts":([first_receipts.clone(),next_receipts.clone()].concat()),"sourceOnly":source_only,"sourceOnlyValuation":source_only_valuation,"sourceOnlyRisk":source_only_risk,"admitted":admitted,"signedAdmitted":signed_admitted,"firstValuation":first_valuation,"review":review,"approved":approved,"initialC11":initial,"offRefusal":{"status":off.0,"body":off.1},"on":on,"command":command,"original":original,"ledger":ledger,"matched":matched,"stopped":stopped,"beforeNewReview":before_new,"renewed":renewed,"signedRenewed":signed_renewed,"freshValuation":fresh_valuation,"newReview":new_review,"denyAudit":deny_audit,"repeatRefusal":{"status":repeat.0,"body":repeat.1},"openBefore":open_before,"alerts":open_after,"alertAudits":alert_audits,"reviewAudits":review_audits,"requestAudit":request_audit,"authorizationJournal":journal,"claimsBefore":claims_before,"claimsAfter":risk::immutable(&risk::native(&lab)),"controlEvidence":control_evidence}),
    );
}
#[test]
fn r01_gate_unknown_through_public_controls_and_cold_recovery() {
    let lab = Lab::pause_at(2);
    current::enabled(&lab);
    let (_boot, url) = lab.bff(true);
    let (_, candidate, ledger, mut b) = setup(&lab, &url);
    market::configure(&lab, true);
    let (mut process, url) = lab.bff(true);
    let (open_before, _) = alerts(&url);
    let receipts = authorize(&url);
    let admitted = get(&url, PATH);
    let signed_admitted = capture(&lab);
    let (first_valuation, review) = risk_current(&lab, &url, &candidate, &ledger, 2);
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
    assert_eq!(view_before["items"].as_array().unwrap().len(), 7);
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
    let body = source::body(&latest, "session-current", &view, "request");
    let refusal = source::post(
        &latest,
        "session-current",
        PATH,
        &body,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(refusal.0, 409);
    let fv = get(&latest, FIN);
    let fb = fin::body(&latest, "session-current", &fv, "request");
    let financial_refusal = fin::post(
        &latest,
        "session-current",
        FIN,
        &fb,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(financial_refusal.0, 409);
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
    let review_audits = [&receipts[0], &receipts[3]]
        .iter()
        .map(|r| gate::audit(&latest, r["event"]["caseId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_R01_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false,"protocolCalls":2,"marketProof":proof(&lab, 2),"firstValuation":first_valuation,"admitted":admitted,"signedAdmitted":signed_admitted,"review":review,"original":original,"ledger":ledger,"priorFinancialAlerts":open_before,"alerts":open_after,"alertAudits":alert_audits,"view":view,"reviewRefusal":{"status":refusal.0,"body":refusal.1},"financialRefusal":{"status":financial_refusal.0,"body":financial_refusal.1},"reconciliation":after,"valuation":valuation,"stopped":stopped,"released":released,"requestAudit":request_audit,"reviewAudits":review_audits,"authorizationJournal":fin::journal(&lab),"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"controlEvidence":controls(&latest)}),
    );
}
fn publish_input(lab: &Lab, input: &Inputs) -> SignedArtifact {
    let p = market::policy(lab, input);
    let previous = market::state(lab)["marketHistory"]["artifacts"]
        .as_array()
        .and_then(|v| v.last())
        .cloned();
    let (version, hash) = previous
        .map(|v| {
            let a: SignedArtifact = serde_json::from_value(v).unwrap();
            (
                a.payload.version + 1,
                Some(a.payload.content_hash().unwrap()),
            )
        })
        .unwrap_or((1, None));
    // This fixture's first ledger entry is BTC; the second known entry adds ETH.
    let symbols: &[&str] = if input.ledger_anchor.sequence == 1 {
        &["BTCUSDT"]
    } else {
        &["BTCUSDT", "ETHUSDT"]
    };
    let a = market::produce(lab, &p, input, version, hash, symbols);
    quantos_portfolio::market_provenance::Binding {
        policy: p.clone(),
        artifact: a.clone(),
        certificate: fs::read_to_string(lab.directory.join("server.pem")).unwrap(),
    }
    .marks(&input.scope, &input.raw_market_hash().unwrap(), input.as_of)
    .expect("fixture R01/F03 provenance must be valid before public consumption");
    valuation::write(lab, input);
    market::publish(lab, &p, &a);
    a
}
fn risk_current(
    lab: &Lab,
    url: &str,
    candidate: &Value,
    ledger: &Value,
    version: u64,
) -> (Value, Value) {
    let mut input = valuation::input(lab, ledger, version);
    input.marks.clear();
    publish_input(lab, &input);
    let v = get(url, "/v1/assisted-testnet/valuation");
    assert_eq!(
        v["reason"], "READY_OWNED_ACCOUNT_AUTHENTICATED_R01_MARKS",
        "{v}"
    );
    let (s, r) = risk::request(url, candidate, &v, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["marketProvenance"], v["marketProvenance"]);
    (v, r)
}
fn proof(lab: &Lab, version: u64) -> Value {
    let state = market::state(lab);
    let mut raw = state["sources"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["version"] == version)
        .unwrap()
        .clone();
    let binding = raw["marketProvenance"].clone();
    raw.as_object_mut().unwrap().remove("marketProvenance");
    raw["marks"] = json!([]);
    json!({"input":raw,"policy":binding["policy"],"artifact":binding["artifact"],"certificate":binding["certificate"]})
}
#[test]
fn r01_gate_mark_authentication_does_not_promote_account_authority_or_cached_risk() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_boot, url) = lab.bff(true);
    let (_, candidate, ledger, _) = setup(&lab, &url);
    market::configure(&lab, true);
    let (_market, url) = lab.bff(true);
    let receipts = authorize(&url);
    let admitted = get(&url, PATH);
    let signed_admitted = capture(&lab);
    let (first_valuation, review) = risk_current(&lab, &url, &candidate, &ledger, 2);
    assert_eq!(review["decision"]["verdict"], "approval_required");
    assert_eq!(
        first_valuation["sourceTrust"],
        "OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"
    );
    let original_proof = proof(&lab, 2);
    let claims = risk::immutable(&risk::native(&lab));
    let (open_before, _) = alerts(&url);
    let mut claim = valuation::input(&lab, &ledger, 3);
    claim.marks.clear();
    claim.source_id = "account:claimed-independent-cash-and-status:unattested".into();
    let claim_artifact = publish_input(&lab, &claim);
    let unavailable = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "account-claim",
    );
    assert_eq!(unavailable.0, 503, "{}", unavailable.1);
    let refused = risk::request(
        &url,
        &candidate,
        &first_valuation,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(refused.0, 503, "{}", refused.1);
    assert!(refused.1.get("subject").is_none());
    assert_eq!(risk::immutable(&risk::native(&lab)), claims);
    let (restored_valuation, restored_review) = risk_current(&lab, &url, &candidate, &ledger, 3);
    assert_eq!(restored_review["decision"]["verdict"], "approval_required");
    assert_eq!(
        restored_valuation["sourceTrust"],
        first_valuation["sourceTrust"]
    );
    let (_cold, cold) = lab.bff(true);
    let restored = get(&cold, PATH);
    assert_eq!(restored["history"], admitted["history"]);
    let (open_after, alert_audits) = alerts(&cold);
    assert_eq!(open_before, open_after);
    assert_eq!(risk::immutable(&risk::native(&lab)), claims);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    let review_audits = [&receipts[0], &receipts[3]]
        .iter()
        .map(|r| gate::audit(&cold, r["event"]["caseId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    valuation::evidence(
        "QUANTOS_L4_R01_GAP_RESULT",
        json!({
            "sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"noResend":true,"automaticClosure":false,"limitsRelaxed":false,"protocolCalls":1,
            "admitted":admitted,"signedAdmitted":signed_admitted,"authorizationJournal":fin::journal(&lab),"marketProof":original_proof,"firstValuation":first_valuation,"review":review,
            "claimedInput":claim,"claimArtifact":claim_artifact,"unattestedValuation":{"status":unavailable.0,"body":unavailable.1},"cachedReviewRefusal":{"status":refused.0,"body":refused.1},
            "restoredValuation":restored_valuation,"restoredReview":restored_review,"freshMarketProof":proof(&lab,3),"restored":restored,"alerts":open_after,"alertAudits":alert_audits,"reviewAudits":review_audits,"claimsBefore":claims,"claimsAfter":risk::immutable(&risk::native(&lab)),
            "remainingGap":"AUTHENTICATED_ACCOUNT_CASH_STATUS_PROVENANCE_NOT_JOINED_MARK_AUTHORITY_NOT_FUNDING_AUTHORITY"
        }),
    );
}

fn emit(lab: &Lab, name: &str, mut packet: Value) {
    packet["marketProof"] = proof(lab, 2);
    packet["freshMarketProof"] = proof(lab, 3);
    valuation::evidence(name, packet);
}
