use super::valuation::{evidence, input, write};
use super::*;
pub(super) fn enabled(lab: &Lab) {
    let p = lab.directory.join("bff-owner.json");
    let mut owner: Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
    owner["currentReviewExecutionEnabled"] = json!(true);
    private_write(p, serde_json::to_vec(&owner).unwrap());
}
pub(super) fn submit(url: &str, id: &str, _key: &str) -> (u16, Value) {
    call(
        url,
        "session-current",
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/commands"),
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    )
}
pub(super) fn prepare(lab: &Lab, url: &str) -> (Value, Value, String) {
    let rows = get(url, "/v1/assisted-testnet/subjects");
    let btc = rows["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["quantity"] == "1")
        .unwrap();
    let bootstrap = open(url, btc);
    approve(url, &bootstrap, 0);
    approve(url, &bootstrap, 1);
    let (s, c) = submit(url, &bootstrap, "bootstrap");
    assert_eq!(s, 200, "{c}");
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let ledger = get(url, "/v1/assisted-testnet/ledger");
    write(lab, &input(lab, &ledger, 1));
    let view = get(url, "/v1/assisted-testnet/valuation");
    assert_eq!(view["riskInputReady"], true, "{view}");
    let catalog = get(url, "/v1/assisted-testnet/risk-review-candidates");
    let eth = catalog["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["symbol"] == "ETHUSDT")
        .unwrap();
    // A catalog handle has no old Subject/approval/execution authority.
    assert_eq!(
        call(
            url,
            "session-current",
            "POST",
            "/v1/assisted-testnet/requests",
            json!({"subjectId":eth["subjectId"]}),
            &Uuid::new_v4().to_string()
        )
        .0,
        422
    );
    let (status, review) = call(
        url,
        "session-current",
        "POST",
        &format!(
            "/v1/assisted-testnet/subjects/{}/risk-reviews",
            eth["subjectId"].as_str().unwrap()
        ),
        json!({"snapshotHash":view["snapshot"]["snapshotHash"],"expectedGeneration":view["killGeneration"]}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(status, 200, "{review}");
    assert_eq!(
        review["decision"]["verdict"], "approval_required",
        "{review}"
    );
    assert_eq!(review["proposalHash"], eth["proposalHash"]);
    let id = open(url, &review["subject"]);
    assert_eq!(
        get(url, &format!("/v1/assisted-testnet/requests/{id}"))["request"]["approvers"],
        json!([])
    );
    approve(url, &id, 0);
    approve(url, &id, 1);
    (view, review, id)
}
#[test]
fn current_review_actual_mtls_executes_exact_eth_once_and_recovers_original_reservation() {
    let lab = Lab::new();
    enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (valuation, review, id) = prepare(&lab, &url);
    let (status, command) = submit(&url, &id, "explicit-current");
    assert_eq!(status, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(command["order"]["symbol"], "ETHUSDT");
    assert_eq!(lab.trace()["protocolCalls"], 2);
    let b = &command["currentRisk"];
    for k in [
        "snapshotHash",
        "ledgerHash",
        "sourceHash",
        "sourceVersion",
        "killGeneration",
    ] {
        if k == "sourceVersion" {
            assert_eq!(
                b[k].as_u64().unwrap().to_string(),
                review[k].as_str().unwrap()
            );
        } else {
            assert_eq!(b[k], review[k], "{k}");
        }
    }
    assert_eq!(b["decisionId"], review["decision"]["decisionId"]);
    assert_eq!(b["notional"], "1000");
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 2);
    assert_eq!(ledger["quarantinedCommandCount"], 0);
    let saved = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    assert_eq!(saved["snapshotClaims"].as_object().unwrap().len(), 1);
    let (_cold, restarted) = lab.bff(true);
    let restored = get(&restarted, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(restored["command"], command);
    // Same source is obsolete after the fill: a new evaluation cannot reuse it.
    assert_eq!(
        get(&restarted, "/v1/assisted-testnet/valuation")["riskInputReady"],
        false
    );
    let audit = get(&restarted, &format!("/v1/audit/events?correlationId={id}"));
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["kind"] == "assisted.command_accepted")
    );
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        saved
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(80)).is_err());
    evidence(
        "QUANTOS_L04_CURRENT_EXECUTION_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"ACTUAL_PUBLIC_REFERENCE_BFF_OWNED_MTLS_CURRENT_ETH_EXECUTION","valuation":valuation,"review":review,"command":command,"ledger":ledger,"audit":audit,"restored":restored,"protocolCalls":2,"snapshotClaims":saved["snapshotClaims"],"actualTestnet":false,"limitsRelaxed":false,"noResend":true,"automaticClosure":false}),
    );
}
#[test]
fn current_review_default_off_and_changed_mark_fail_before_native_io() {
    for changed in [false, true] {
        let lab = Lab::new();
        if changed {
            enabled(&lab);
        }
        let (_p, url) = lab.bff(true);
        let (_, _, id) = prepare(&lab, &url);
        if changed {
            let ledger = get(&url, "/v1/assisted-testnet/ledger");
            let mut i = input(&lab, &ledger, 2);
            i.marks[0].price = "1200".into();
            write(&lab, &i);
        }
        let before = owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap();
        let (s, body) = submit(&url, &id, "must-not-dispatch");
        assert!(matches!(s, 403 | 409), "{s}:{body}");
        assert_eq!(
            owner_store(&lab, "commands")
                .lock()
                .unwrap()
                .read()
                .unwrap()
                .unwrap(),
            before
        );
        assert!(lab.trace.recv_timeout(Wait::from_millis(80)).is_err());
    }
}
#[test]
fn current_review_crash_after_mtls_commit_keeps_unknown_snapshot_claim_and_open_alerts() {
    let lab = Lab::pause_at(2);
    enabled(&lab);
    let (mut process, url) = lab.bff(true);
    let (_, review, id) = prepare(&lab, &url);
    let request_id = id.clone();
    let base = url.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(5))
            .build()
            .unwrap()
            .post(format!(
                "{base}/v1/assisted-testnet/requests/{request_id}/commands"
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
    let before = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    assert_eq!(
        before["snapshotClaims"][review["snapshotHash"].as_str().unwrap()],
        id
    );
    let (_p, url) = lab.bff(true);
    let view = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(view["command"]["state"], "unknown");
    assert_eq!(view["command"]["currentRisk"]["killGeneration"], "0");
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    let valuation = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], false);
    assert!(valuation.get("snapshot").is_none());
    let reconciliation = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(reconciliation["unknownObligationsOpen"], 1);
    let alerts = get(&url, "/v1/alerts");
    assert!(alerts["items"].as_array().unwrap().len() >= 2);
    assert_eq!(submit(&url, &id, "never-resend").0, 409);
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        before
    );
    assert_eq!(
        get(&url, &format!("/v1/assisted-testnet/requests/{id}")),
        view
    );
    evidence(
        "QUANTOS_L04_CURRENT_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"ACTUAL_CURRENT_COMMAND_CRASH_AFTER_ZONE_COMMIT","review":review,"view":view,"ledger":ledger,"valuation":valuation,"reconciliation":reconciliation,"alerts":alerts,"snapshotClaims":before["snapshotClaims"],"originalGeneration":"0","protocolCalls":2,"noResend":true,"automaticClosure":false,"actualTestnet":false}),
    );
}
