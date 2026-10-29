use super::*;
use super::{account_books as books, current_execution as current, valuation};
fn evidence(name: &str, v: Value) {
    valuation::evidence(name, v);
}
fn read_book(lab: &Lab) -> quantos_reconcile::account_books::Books {
    serde_json::from_value(
        serde_json::from_slice::<Value>(
            &fs::read(lab.directory.join("account-books.json")).unwrap(),
        )
        .unwrap()["payload"]
            .clone(),
    )
    .unwrap()
}
fn native(lab: &Lab) -> Value {
    owner_store(lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()
}
fn immutable(n: &Value) -> Value {
    json!({"issuedHash":quantos_reconcile::current::digest(&n["issued"]).unwrap(),"claims":n["claims"],"snapshotClaims":n["snapshotClaims"]})
}
fn request(url: &str, c: &Value, v: &Value, key: &str) -> (u16, Value) {
    call(
        url,
        "session-current",
        "POST",
        &format!(
            "/v1/assisted-testnet/subjects/{}/risk-reviews",
            c["subjectId"].as_str().unwrap()
        ),
        json!({"snapshotHash":v["snapshot"]["snapshotHash"],"expectedGeneration":v["killGeneration"]}),
        key,
    )
}
fn seed(lab: &Lab, url: &str) -> (Value, Value, Value) {
    let rows = get(url, "/v1/assisted-testnet/subjects");
    let id = open(url, &rows["items"][0]);
    approve(url, &id, 0);
    approve(url, &id, 1);
    let (s, c) = current::submit(url, &id, "bootstrap");
    assert_eq!(s, 200, "{c}");
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let ledger = get(url, "/v1/assisted-testnet/ledger");
    valuation::write(lab, &valuation::input(lab, &ledger, 1));
    let v = get(url, "/v1/assisted-testnet/valuation");
    assert_eq!(v["riskInputReady"], true);
    let candidates = get(url, "/v1/assisted-testnet/risk-review-candidates");
    let candidate = candidates["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["symbol"] == "ETHUSDT")
        .unwrap()
        .clone();
    (v, candidate, ledger)
}
fn approval(url: &str, id: &str, slot: u8) -> (u16, Value) {
    let who = if slot == 0 {
        "session-approver"
    } else {
        "session-owner"
    };
    let (_, c) = call(
        url,
        who,
        "POST",
        "/v1/auth/mfa/challenges",
        json!({"purpose":"security_change","code":"123456"}),
        &Uuid::new_v4().to_string(),
    );
    let (_, g) = call(
        url,
        who,
        "POST",
        "/v1/auth/reauth",
        json!({"challengeRef":c["challengeRef"]}),
        &Uuid::new_v4().to_string(),
    );
    call(
        url,
        who,
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/approvals"),
        json!({"expectedRevision":slot,"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]}),
        &Uuid::new_v4().to_string(),
    )
}
#[test]
fn books_risk_current_success_binds_decision_subject_command_and_original_recovery() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (v, review, id) = current::prepare(&lab, &url);
    let expected = &review["booksAdmission"]["input"];
    let admitted_books: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("account-books.json")).unwrap())
            .unwrap();
    let signer_certificate = fs::read_to_string(lab.directory.join("server.pem")).unwrap();
    assert_eq!(
        review["booksAdmission"]["reason"],
        "ELIGIBLE_REFERENCE_BOOKS"
    );
    assert_eq!(expected["openObligations"], 0);
    assert_eq!(expected["ledgerHash"], v["ledgerHash"]);
    assert_eq!(review["subject"]["nativeRiskBinding"]["books"], *expected);
    let (s, command) = current::submit(&url, &id, "current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(command["currentRisk"]["books"], *expected);
    assert_eq!(lab.trace()["protocolCalls"], 2);
    let original = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    let before = immutable(&native(&lab));
    let mut b = read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let report = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        report["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert_eq!(report["openAlertEvidenceCount"], 0);
    let (_r, cold) = lab.bff(true);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    assert_eq!(immutable(&native(&lab)), before);
    assert_eq!(current::submit(&cold, &id, "query-only").0, 409);
    let audit = get(&cold, &format!("/v1/audit/events?correlationId={id}"));
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["kind"] == "assisted.command_accepted"
                && e["redactedPayload"]["currentRisk"]["books"] == *expected)
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_BOOKS_RISK_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"admittedBooks":admitted_books,"signerCertificate":signer_certificate,"valuation":v,"review":review,"command":command,"original":original,"currentReport":report,"audit":audit,"claimsBefore":before,"claimsAfter":immutable(&native(&lab)),"protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn books_risk_missing_deny_new_version_requires_new_review_and_independent_approvals() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (v, c, ledger) = seed(&lab, &url);
    let key = Uuid::new_v4().to_string();
    let (s, missing) = request(&url, &c, &v, &key);
    assert_eq!(s, 200);
    assert_eq!(missing["decision"]["verdict"], "deny");
    assert_eq!(
        missing["booksAdmission"]["reason"],
        "BOOKS_SOURCE_UNAVAILABLE"
    );
    assert!(missing.get("subject").is_none());
    assert_eq!(request(&url, &c, &v, &key).1, missing);
    let mut b = books::statement(&lab);
    books::publish(&lab, &b);
    assert_eq!(request(&url, &c, &v, &key).0, 409);
    let (_, first) = request(&url, &c, &v, &Uuid::new_v4().to_string());
    assert_eq!(first["decision"]["verdict"], "approval_required");
    let id = open(&url, &first["subject"]);
    approve(&url, &id, 0);
    let one = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(one["request"]["revision"], 1);
    books::advance(&mut b);
    books::publish(&lab, &b);
    let second_refused = approval(&url, &id, 1);
    assert_eq!(second_refused.0, 409);
    assert_eq!(
        get(&url, &format!("/v1/assisted-testnet/requests/{id}"))["request"],
        one["request"]
    );
    let (_, newer) = request(&url, &c, &v, &Uuid::new_v4().to_string());
    assert_eq!(newer["proposalHash"], first["proposalHash"]);
    assert_ne!(newer["subject"]["subjectId"], first["subject"]["subjectId"]);
    let next = open(&url, &newer["subject"]);
    let empty = get(&url, &format!("/v1/assisted-testnet/requests/{next}"));
    assert_eq!(empty["request"]["approvers"], json!([]));
    assert_eq!(empty["request"]["revision"], 0);
    assert_eq!(newer["booksAdmission"]["input"]["sourceVersion"], 2);
    assert_eq!(get(&url, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(native(&lab)["issued"].as_object().unwrap().len(), 1);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_BOOKS_RISK_REVIEW_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"missing":missing,"first":first,"firstApproval":one,"secondRefusal":{"status":second_refused.0,"body":second_refused.1},"newer":newer,"empty":empty,"ledger":ledger,"sameKeySourceDriftDenied":true,"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn books_risk_financial_differences_and_corrected_but_open_obligations_are_signed_deny() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (v, c, ledger) = seed(&lab, &url);
    let mut b = books::statement(&lab);
    b.positions[0].amount = "2".into();
    b.cash[0].amount = "9000".into();
    b.fees[0].amount = "0".into();
    books::publish(&lab, &b);
    let signed_different: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("account-books.json")).unwrap())
            .unwrap();
    let signer_certificate = fs::read_to_string(lab.directory.join("server.pem")).unwrap();
    let before = immutable(&native(&lab));
    let (s, diff) = request(&url, &c, &v, &Uuid::new_v4().to_string());
    assert_eq!(s, 200);
    assert_eq!(diff["decision"]["verdict"], "deny");
    assert_eq!(diff["booksAdmission"]["reason"], "BOOKS_NOT_MATCHED");
    assert_eq!(diff["booksAdmission"]["input"]["openObligations"], 3);
    assert!(diff.get("subject").is_none());
    let alerts = get(&url, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 3);
    books::advance(&mut b);
    b.positions[0].amount = "1".into();
    b.cash[0].amount = "8999.99".into();
    b.fees[0].amount = "0.01".into();
    books::publish(&lab, &b);
    let (_, open) = request(&url, &c, &v, &Uuid::new_v4().to_string());
    assert_eq!(open["decision"]["verdict"], "deny");
    assert_eq!(
        open["booksAdmission"]["reason"],
        "OPEN_FINANCIAL_OBLIGATIONS"
    );
    assert_eq!(
        open["booksAdmission"]["input"]["accountState"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert!(open.get("subject").is_none());
    assert_eq!(get(&url, "/v1/alerts"), alerts);
    let (_r, cold) = lab.bff(true);
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    assert_eq!(get(&cold, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(immutable(&native(&lab)), before);
    let audit = get(
        &cold,
        &format!(
            "/v1/audit/events?correlationId={}",
            open["decision"]["decisionId"].as_str().unwrap()
        ),
    );
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["kind"] == "risk.native_review_created"
                && e["redactedPayload"]["review"]["booksAdmission"]["reason"]
                    == "OPEN_FINANCIAL_OBLIGATIONS")
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_BOOKS_RISK_OPEN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"signedDifferent":signed_different,"signerCertificate":signer_certificate,"signedCorrected":serde_json::from_slice::<Value>(&fs::read(lab.directory.join("account-books.json")).unwrap()).unwrap(),"differences":diff,"correctedDeny":open,"alerts":alerts,"audit":audit,"ledger":ledger,"claimsBefore":before,"claimsAfter":immutable(&native(&lab)),"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn books_risk_io_rechecks_source_version_missing_signature_difference_and_scope() {
    let mut outcomes = vec![];
    for case in ["version", "signature", "difference", "scope"] {
        let lab = Lab::new();
        current::enabled(&lab);
        let (_p, url) = lab.bff(true);
        let (_, review, id) = current::prepare(&lab, &url);
        let before = immutable(&native(&lab));
        let request_before = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
        let mut b = read_book(&lab);
        match case {
            "version" => {
                books::advance(&mut b);
                books::publish(&lab, &b);
            }
            "signature" => {
                let p = lab.directory.join("account-books.json");
                let mut v: Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
                v["signature"] = json!("00");
                private_write(p, serde_json::to_vec(&v).unwrap());
            }
            "difference" => {
                books::advance(&mut b);
                b.cash[0].amount = "9000".into();
                books::publish(&lab, &b);
            }
            _ => {
                b.scope.account_id = quantos_core::AccountId::new();
                books::publish(&lab, &b);
            }
        }
        let denied = current::submit(&url, &id, "must-refuse");
        assert!(matches!(denied.0, 409 | 503), "{case}: {denied:?}");
        assert_eq!(immutable(&native(&lab)), before);
        assert_eq!(
            get(&url, &format!("/v1/assisted-testnet/requests/{id}")),
            request_before
        );
        assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
        outcomes.push(json!({"case":case,"status":denied.0,"response":denied.1,"originalBooks":review["booksAdmission"],"claimsUnchanged":true}));
    }
    evidence(
        "QUANTOS_BOOKS_RISK_IO_REFUSAL_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"outcomes":outcomes,"cases":4,"protocolCallsPerCase":1,"newCurrentIo":0,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn books_risk_publisher_fence_spans_actual_io_and_unknown_keeps_original_books() {
    let lab = Lab::pause_at(2);
    current::enabled(&lab);
    let (mut process, url) = lab.bff(true);
    let (_, review, id) = current::prepare(&lab, &url);
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
    let path = lab.directory.join("account-books-fence.lock");
    let (tx, rx) = mpsc::channel();
    let writer = std::thread::spawn(move || {
        let f = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(path)
            .unwrap();
        tx.send("waiting").unwrap();
        f.lock().unwrap();
        tx.send("acquired").unwrap();
    });
    assert_eq!(rx.recv_timeout(Wait::from_secs(5)).unwrap(), "waiting");
    assert!(rx.recv_timeout(Wait::from_millis(150)).is_err());
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    assert_eq!(rx.recv_timeout(Wait::from_secs(5)).unwrap(), "acquired");
    writer.join().unwrap();
    let mut b = read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let (_r, cold) = lab.bff(true);
    let original = get(&cold, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(original["command"]["state"], "unknown");
    assert_eq!(
        original["command"]["currentRisk"]["books"],
        review["booksAdmission"]["input"]
    );
    let before = immutable(&native(&lab));
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    let current = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(current["riskInputReady"], false);
    let report = get(&cold, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        report["accountBooks"]["status"],
        "UNKNOWN_OR_QUARANTINED_OBLIGATIONS"
    );
    let alerts = get(&cold, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 3);
    let (_again, latest) = lab.bff(true);
    assert_eq!(
        get(&latest, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    assert_eq!(immutable(&native(&lab)), before);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_BOOKS_RISK_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"review":review,"original":original,"ledger":ledger,"valuation":current,"reconciliation":report,"alerts":alerts,"claimsBefore":before,"claimsAfter":immutable(&native(&lab)),"publisherBlockedDuringIo":true,"originalGeneration":"0","protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn books_risk_waiting_for_publisher_lock_resamples_the_original_deadline() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (v, c, _) = seed(&lab, &url);
    let mut b = books::statement(&lab);
    b.valid_until = b.captured_at + Duration::seconds(2);
    books::publish(&lab, &b);
    let fence = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(lab.directory.join("account-books-fence.lock"))
        .unwrap();
    fence.lock().unwrap();
    let base = url.clone();
    let key = Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel();
    let caller = std::thread::spawn(move || {
        let r = request(&base, &c, &v, &key);
        tx.send(r).unwrap();
    });
    assert!(rx.recv_timeout(Wait::from_millis(150)).is_err());
    std::thread::sleep(Wait::from_millis(2100));
    drop(fence);
    let (s, r) = rx.recv_timeout(Wait::from_secs(10)).unwrap();
    caller.join().unwrap();
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["decision"]["verdict"], "deny");
    assert_eq!(r["booksAdmission"]["reason"], "BOOKS_SOURCE_STALE");
    assert!(r.get("subject").is_none());
    let decided: chrono::DateTime<Utc> =
        serde_json::from_value(r["decision"]["decidedAt"].clone()).unwrap();
    assert!(decided >= b.valid_until);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_BOOKS_RISK_WAIT_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"review":r,"originalBooksDeadline":b.valid_until,"blockedBeforeDeadline":true,"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
