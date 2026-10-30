use super::*;
use super::{account_books as books, books_risk as risk, current_execution as current, valuation};
const PATH: &str = "/v1/assisted-testnet/financial-reviews";
fn emit(name: &str, v: Value) {
    valuation::evidence(name, v);
}
pub(super) fn journal(lab: &Lab) -> Value {
    let s = owner_store(lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    json!({"journal":s["financialReviews"],"consumedProofHashes":s["consumedStepProofs"].as_array().unwrap().iter().map(|v|quantos_core::ContentHash::sha256_bytes(v.as_str().unwrap().as_bytes())).collect::<Vec<_>>()})
}

pub(super) fn body(url: &str, who: &str, v: &Value, action: &str) -> Value {
    let (s, c) = call(
        url,
        who,
        "POST",
        "/v1/auth/mfa/challenges",
        json!({"purpose":"security_change","code":"123456"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{c}");
    let (s, g) = call(
        url,
        who,
        "POST",
        "/v1/auth/reauth",
        json!({"challengeRef":c["challengeRef"]}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{g}");
    json!({"expectedRevision":v["revision"],"contextHash":v["contextHash"],"reason":"Explicit independent current financial evidence review","confirmPhrase":match action{"request"=>"REQUEST FINANCIAL REVIEW","endorse"=>"ENDORSE FINANCIAL REVIEW","authorize"=>"AUTHORIZE CURRENT RISK REVIEW",_=>"RETAIN FINANCIAL BLOCK"},"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]})
}
pub(super) fn post(url: &str, who: &str, path: &str, b: &Value, key: &str) -> (u16, Value) {
    let r = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Wait::from_secs(15))
        .build()
        .unwrap()
        .post(format!("{url}{path}"))
        .header(
            "cookie",
            format!("quantos_session={who}; quantos_csrf=csrf-token-0000000000000001"),
        )
        .header("origin", "http://localhost:3190")
        .header("x-csrf-token", "csrf-token-0000000000000001")
        .header("idempotency-key", key)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("if-match", b["expectedRevision"].as_str().unwrap_or("bad"))
        .json(b)
        .send()
        .unwrap();
    (r.status().as_u16(), r.json().unwrap())
}
pub(super) fn action(url: &str, who: &str, id: Option<&str>, action: &str) -> Value {
    let v = get(url, PATH);
    let b = body(url, who, &v, action);
    let path = id
        .map(|id| format!("{PATH}/{id}/{action}"))
        .unwrap_or(PATH.into());
    let (s, r) = post(url, who, &path, &b, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{action}: {r}");
    r
}
pub(super) fn setup(
    lab: &Lab,
    url: &str,
) -> (Value, Value, Value, quantos_reconcile::account_books::Books) {
    let (v, c, ledger) = risk::seed(lab, url);
    let mut b = books::statement(lab);
    b.positions[0].amount = "2".into();
    b.cash[0].amount = "9000".into();
    b.fees[0].amount = "0".into();
    books::publish(lab, &b);
    let bad = get(url, PATH);
    assert_eq!(bad["reviewable"], false);
    assert_eq!(bad["currentBooks"]["openObligations"], 3);
    books::advance(&mut b);
    b.positions[0].amount = "1".into();
    b.cash[0].amount = "8999.99".into();
    b.fees[0].amount = "0.01".into();
    books::publish(lab, &b);
    let ready = get(url, PATH);
    assert_eq!(ready["reviewable"], true, "{ready}");
    assert_eq!(ready["riskBooks"]["openObligations"], 3);
    assert!(ready["riskBooks"].get("financialReview").is_none());
    (v, c, ledger, b)
}
pub(super) fn authorize(url: &str) -> (Value, Value, Value) {
    let request = action(url, "session-current", None, "request");
    let id = request["event"]["caseId"].as_str().unwrap();
    let endorsement = action(url, "session-approver", Some(id), "endorse");
    let permit = action(url, "session-owner", Some(id), "authorize");
    (request, endorsement, permit)
}
#[test]
fn financial_review_independent_pair_new_risk_subject_actual_io_and_open_history() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (_, candidate, ledger, mut b) = setup(&lab, &url);
    let original_seed = risk::native(&lab)["issued"].clone();
    let before_alerts = get(&url, "/v1/alerts");
    let (request, endorsement, permit) = authorize(&url);
    let reviewed = get(&url, PATH);
    assert_eq!(reviewed["history"].as_array().unwrap().len(), 3);
    assert_eq!(reviewed["riskBooks"]["openObligations"], 3);
    assert_eq!(
        reviewed["riskBooks"]["financialReview"]["coveredObligations"],
        3
    );
    valuation::write(&lab, &valuation::input(&lab, &ledger, 2));
    let v = get(&url, "/v1/assisted-testnet/valuation");
    let (s, r) = risk::request(&url, &candidate, &v, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{r}");
    assert_eq!(
        r["booksAdmission"]["reason"],
        "ELIGIBLE_REVIEWED_REFERENCE_BOOKS"
    );
    assert_eq!(
        r["subject"]["nativeRiskBinding"]["books"],
        reviewed["riskBooks"]
    );
    let id = open(&url, &r["subject"]);
    assert_eq!(
        get(&url, &format!("/v1/assisted-testnet/requests/{id}"))["request"]["revision"],
        0
    );
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let (s, command) = current::submit(&url, &id, "current-reviewed");
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(command["currentRisk"]["books"], reviewed["riskBooks"]);
    assert_eq!(command["currentRisk"]["killGeneration"], "0");
    assert_eq!(lab.trace()["protocolCalls"], 2);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let current = get(&url, PATH);
    assert_eq!(
        current["currentBooks"]["accountState"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert!(current["riskBooks"].get("financialReview").is_none());
    assert_eq!(get(&url, "/v1/alerts"), before_alerts);
    let original = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    let (_cold, cold) = lab.bff(true);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    let restored = get(&cold, PATH);
    assert_eq!(restored["history"], reviewed["history"]);
    assert_eq!(get(&cold, "/v1/alerts"), before_alerts);
    assert_eq!(current::submit(&cold, &id, "no-resend").0, 409);
    for (k, value) in original_seed.as_object().unwrap() {
        assert_eq!(risk::native(&lab)["issued"][k], *value);
    }
    let audit = get(
        &cold,
        &format!(
            "/v1/audit/events?correlationId={}",
            request["event"]["caseId"].as_str().unwrap()
        ),
    );
    assert_eq!(audit["items"].as_array().unwrap().len(), 3);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_FINANCIAL_REVIEW_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"authorizationJournal":journal(&lab),"request":request,"endorsement":endorsement,"permit":permit,"reviewed":reviewed,"risk":r,"command":command,"original":original,"afterSourceChange":current,"restored":restored,"openBefore":before_alerts,"openAfter":get(&cold,"/v1/alerts"),"audit":audit,"protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn financial_review_roles_mfa_independence_replica_cas_and_original_recovery() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    setup(&lab, &url);
    let (_rep, other) = lab.bff(true);
    let v = get(&url, PATH);
    let b = body(&url, "session-current", &v, "request");
    let key = Uuid::new_v4().to_string();
    let (s, request) = post(&url, "session-current", PATH, &b, &key);
    assert_eq!(s, 200, "{request}");
    assert_eq!(
        post(&other, "session-current", PATH, &b, &key),
        (200, request.clone())
    );
    let mut changed = b.clone();
    changed["reason"] = json!("different body");
    assert_eq!(post(&url, "session-current", PATH, &changed, &key).0, 409);
    assert_eq!(
        post(
            &url,
            "session-current",
            PATH,
            &b,
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    let id = request["event"]["caseId"].as_str().unwrap();
    let v = get(&url, PATH);
    let own = body(&url, "session-current", &v, "endorse");
    let self_refused = post(
        &url,
        "session-current",
        &format!("{PATH}/{id}/endorse"),
        &own,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(self_refused.0, 403);
    let foreign = post(
        &url,
        "session-approver",
        &format!("{PATH}/{id}/endorse"),
        &own,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(foreign.0, 403);
    let e = body(&url, "session-approver", &v, "endorse");
    let race = std::thread::scope(|s| {
        let a = s.spawn(|| {
            post(
                &url,
                "session-approver",
                &format!("{PATH}/{id}/endorse"),
                &e,
                &Uuid::new_v4().to_string(),
            )
        });
        let z = s.spawn(|| {
            post(
                &other,
                "session-approver",
                &format!("{PATH}/{id}/endorse"),
                &e,
                &Uuid::new_v4().to_string(),
            )
        });
        vec![a.join().unwrap().0, z.join().unwrap().0]
    });
    assert_eq!(race.iter().filter(|s| **s == 200).count(), 1);
    assert!(race.iter().all(|s| [200, 403, 409].contains(s)));
    let permit = action(&url, "session-owner", Some(id), "authorize");
    let history = get(&other, PATH);
    assert_eq!(history["history"].as_array().unwrap().len(), 3);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_FINANCIAL_REVIEW_AUTH_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"authorizationJournal":journal(&lab),"request":request,"permit":permit,"view":history,"selfRefusal":self_refused.0,"foreignMfaRefusal":foreign.0,"race":race,"originalRecovery":true,"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn financial_review_source_change_or_retain_block_revokes_old_subject_before_io() {
    let mut outcomes = vec![];
    for changed_source in [false, true] {
        let lab = Lab::new();
        current::enabled(&lab);
        let (_p, url) = lab.bff(true);
        let (_, candidate, ledger, mut b) = setup(&lab, &url);
        let (req, _, _) = authorize(&url);
        valuation::write(&lab, &valuation::input(&lab, &ledger, 2));
        let v = get(&url, "/v1/assisted-testnet/valuation");
        let (_, r) = risk::request(&url, &candidate, &v, &Uuid::new_v4().to_string());
        assert_eq!(r["decision"]["verdict"], "approval_required");
        let id = open(&url, &r["subject"]);
        approve(&url, &id, 0);
        approve(&url, &id, 1);
        let before = risk::immutable(&risk::native(&lab));
        if changed_source {
            books::advance(&mut b);
            books::publish(&lab, &b);
        } else {
            action(
                &url,
                "session-owner",
                Some(req["event"]["caseId"].as_str().unwrap()),
                "retain-block",
            );
        }
        let refused = current::submit(&url, &id, "no-old-subject");
        assert_eq!(refused.0, 409, "{}", refused.1);
        assert_eq!(risk::immutable(&risk::native(&lab)), before);
        let view = get(&url, PATH);
        assert!(view["riskBooks"].get("financialReview").is_none());
        let (_, deny) = risk::request(&url, &candidate, &v, &Uuid::new_v4().to_string());
        assert_eq!(deny["decision"]["verdict"], "deny");
        assert_eq!(
            deny["booksAdmission"]["reason"],
            "OPEN_FINANCIAL_OBLIGATIONS"
        );
        assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
        outcomes.push(json!({"sourceChanged":changed_source,"ioStatus":refused.0,"view":view,"deny":deny,"claimsUnchanged":true,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"priorRisk":r}));
    }
    emit(
        "QUANTOS_FINANCIAL_REVIEW_REVOCATION_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"outcomes":outcomes,"protocolCallsPerCase":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn financial_review_committed_lost_response_cold_original_receipt_and_tamper_refusal() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (mut p, url) = lab.bff(true);
    setup(&lab, &url);
    let req = action(&url, "session-current", None, "request");
    let id = req["event"]["caseId"].as_str().unwrap();
    action(&url, "session-approver", Some(id), "endorse");
    let v = get(&url, PATH);
    let b = body(&url, "session-owner", &v, "authorize");
    let key = Uuid::new_v4().to_string();
    private_write(
        lab.directory.join("pause-financial-after-commit"),
        b"owned pause",
    );
    let path = format!("{PATH}/{id}/authorize");
    let handle = std::thread::spawn({
        let url = url.clone();
        let path = path.clone();
        let b = b.clone();
        let key = key.clone();
        move || {
            reqwest::blocking::Client::builder()
                .no_proxy()
                .timeout(Wait::from_secs(10))
                .build()
                .unwrap()
                .post(format!("{url}{path}"))
                .header(
                    "cookie",
                    "quantos_session=session-owner; quantos_csrf=csrf-token-0000000000000001",
                )
                .header("origin", "http://localhost:3190")
                .header("x-csrf-token", "csrf-token-0000000000000001")
                .header("if-match", b["expectedRevision"].as_str().unwrap())
                .header("idempotency-key", key)
                .header("x-request-id", Uuid::new_v4().to_string())
                .json(&b)
                .send()
        }
    });
    let deadline = std::time::Instant::now() + Wait::from_secs(10);
    while !lab.directory.join("financial-after-commit.marker").exists() {
        assert!(std::time::Instant::now() < deadline);
        std::thread::sleep(Wait::from_millis(10));
    }
    p.0.kill().unwrap();
    p.0.wait().unwrap();
    assert!(handle.join().unwrap().is_err());
    fs::remove_file(lab.directory.join("pause-financial-after-commit")).unwrap();
    let (_cold, cold) = lab.bff(true);
    let recovered = post(&cold, "session-owner", &path, &b, &key);
    assert_eq!(recovered.0, 200, "{}", recovered.1);
    let current = get(&cold, PATH);
    assert_eq!(current["history"].as_array().unwrap().len(), 3);
    assert_eq!(current["history"][2], recovered.1["event"]);
    let committed_journal = journal(&lab);
    let store = owner_store(&lab, "approvals");
    {
        let tx = store.lock().unwrap();
        let mut state = tx.read().unwrap().unwrap();
        state["financialReviews"]["records"][1]["reason"] = json!("tamper");
        tx.write(&state).unwrap();
    }
    let refused = call(
        &cold,
        "session-current",
        "GET",
        PATH,
        json!({}),
        &Uuid::new_v4().to_string(),
    )
    .0;
    assert_eq!(refused, 503);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_FINANCIAL_REVIEW_RECOVERY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"responseLostAfterCommit":true,"authorizationJournal":committed_journal,"recovered":recovered.1,"view":current,"tamperStatus":refused,"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn financial_review_unknown_remains_unreviewable_and_original_generation_is_query_only() {
    let lab = Lab::pause_at(2);
    current::enabled(&lab);
    let (mut p, url) = lab.bff(true);
    let (_, review, id) = current::prepare(&lab, &url);
    let path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let caller = std::thread::spawn({
        let url = url.clone();
        move || {
            reqwest::blocking::Client::builder()
                .no_proxy()
                .timeout(Wait::from_secs(10))
                .build()
                .unwrap()
                .post(format!("{url}{path}"))
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
        }
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 2);
    p.0.kill().unwrap();
    p.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let mut b = risk::read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let (_cold, cold) = lab.bff(true);
    let original = get(&cold, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(original["command"]["state"], "unknown");
    assert_eq!(original["command"]["currentRisk"]["killGeneration"], "0");
    assert_eq!(
        original["command"]["currentRisk"]["books"],
        review["booksAdmission"]["input"]
    );
    let before = risk::immutable(&risk::native(&lab));
    let view = get(&cold, PATH);
    assert_eq!(view["reviewable"], false);
    assert_eq!(view["currentBooks"]["unknownObligations"], 1);
    let b = body(&cold, "session-current", &view, "request");
    let refused = post(
        &cold,
        "session-current",
        PATH,
        &b,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(refused.0, 409);
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    let alerts = get(&cold, "/v1/alerts");
    assert!(
        alerts["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|a| a["sourceEvidence"]["status"] == "OPEN" && a["resolved"] == false)
    );
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_FINANCIAL_REVIEW_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"view":view,"refusalStatus":refused.0,"original":original,"ledger":ledger,"alerts":alerts,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn financial_review_pending_source_generation_and_original_deadline_are_not_rebound() {
    let mut outcomes = vec![];
    for case in 0..3 {
        let lab = Lab::new();
        current::enabled(&lab);
        let (_p, url) = lab.bff(true);
        let (_, _, _, mut book) = setup(&lab, &url);
        if case == 2 {
            books::advance(&mut book);
            book.valid_until = book.captured_at + Duration::seconds(2);
            books::publish(&lab, &book);
        }
        let request = action(&url, "session-current", None, "request");
        let id = request["event"]["caseId"].as_str().unwrap();
        let view = get(&url, PATH);
        let b = body(&url, "session-approver", &view, "endorse");
        if case == 0 {
            books::advance(&mut book);
            books::publish(&lab, &book);
        } else if case == 1 {
            let stopped = super::native_control::mutate(
                &url,
                "session-current",
                "engage",
                "account",
                0,
                None,
            );
            assert_eq!(stopped["event"]["generation"], "1");
        } else {
            std::thread::sleep(Wait::from_millis(2100));
        }
        let result = post(
            &url,
            "session-approver",
            &format!("{PATH}/{id}/endorse"),
            &b,
            &Uuid::new_v4().to_string(),
        );
        assert_eq!(result.0, 409, "{}", result.1);
        let current = get(&url, PATH);
        assert!(current["riskBooks"].get("financialReview").is_none());
        outcomes.push(json!({"case":case,"status":result.0,"view":current}));
        assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    }
    emit(
        "QUANTOS_FINANCIAL_REVIEW_FRESHNESS_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"cases":outcomes,"protocolCallsPerCase":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
