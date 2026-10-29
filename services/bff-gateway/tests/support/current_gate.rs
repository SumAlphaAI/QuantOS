//! Same current-risk Command through public C11/kill, current financial refresh,
//! reconciliation and Alert. No old packet is treated as current execution.
use super::*;
use super::{
    c11_activation as c11, current_execution as current, native_control as kill, valuation,
};
pub(super) fn native(lab: &Lab) -> Value {
    owner_store(lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()
}
pub(super) fn immutable(v: &Value) -> Value {
    json!({"issued":v["issued"],"claims":v["claims"],"snapshotClaims":v["snapshotClaims"]})
}
pub(super) fn inspect(url: &str, id: &str) -> Value {
    get(url, &format!("/v1/assisted-testnet/requests/{id}"))
}
pub(super) fn audit(url: &str, id: &str) -> Value {
    get(url, &format!("/v1/audit/events?correlationId={id}"))
}
pub(super) fn release(url: &str, scope: &str, generation: u64) -> Value {
    let p = kill::mutate(
        url,
        "session-approver",
        "release-approvals",
        scope,
        generation,
        None,
    );
    kill::mutate(
        url,
        "session-owner",
        "release",
        scope,
        generation,
        p["event"]["eventId"].as_str(),
    )
}
pub(super) fn roundtrip(url: &str) -> Value {
    let before = c11::current(url);
    c11::change(url, &before, false);
    let off = c11::current(url);
    assert_eq!(off["runtimeWritable"], false);
    c11::change(url, &off, true);
    c11::current(url)
}
#[test]
fn current_gate_accepted_exact_review_public_controls_fresh_generation_cannot_repeat_proposal() {
    let lab = Lab::new();
    current::enabled(&lab);
    let (_p, url) = lab.bff(true);
    let (first_valuation, review, id) = current::prepare(&lab, &url);
    let approval = inspect(&url, &id);
    // Actual public Owner MFA/CAS lease, not version-zero bootstrap permission.
    let initial = c11::current(&url);
    c11::change(&url, &initial, false);
    let denied_off = current::submit(&url, &id, "off");
    assert_ne!(denied_off.0, 200);
    assert_eq!(native(&lab)["issued"].as_object().unwrap().len(), 1);
    let off = c11::current(&url);
    c11::change(&url, &off, true);
    let on = c11::current(&url);
    assert_eq!(on["version"], "2");
    assert_eq!(inspect(&url, &id), approval);
    let (s, command) = current::submit(&url, &id, "current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(command["currentRisk"]["activation"]["version"], 2);
    assert_eq!(lab.trace()["protocolCalls"], 2);
    let original = inspect(&url, &id);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 2);
    let stale = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(stale["riskInputReady"], false);
    // Independent signed protocol observation fault creates OPEN evidence; restoring
    // observations never implicitly acknowledges or closes it.
    let path = lab.directory.join("observer.json");
    let bytes = fs::read(&path).unwrap();
    let mut bad: Value = serde_json::from_slice(&bytes).unwrap();
    bad["signature"] = json!("00");
    private_write(&path, serde_json::to_vec(&bad).unwrap());
    let unavailable = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(unavailable["comparisonStatus"], "UNAVAILABLE");
    let alerts = get(&url, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 1);
    private_write(&path, bytes);
    let books = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(books["comparisonStatus"], "MATCHED_OBSERVATIONS");
    assert_eq!(books["fullBooksReady"], false);
    assert_eq!(books["dayCloseAllowed"], false);
    assert_eq!(get(&url, "/v1/alerts"), alerts);
    let request_audit = audit(&url, &id);
    let reservations = immutable(&native(&lab));
    kill::mutate(&url, "session-owner", "engage", "global", 0, None);
    kill::mutate(&url, "session-current", "engage", "account", 1, None);
    let stopped = roundtrip(&url);
    assert_eq!(stopped["version"], "4");
    assert_eq!(stopped["killGeneration"], "2");
    assert_eq!(stopped["nativeStopped"], true);
    let (_r, cold) = lab.bff(true);
    assert_eq!(inspect(&cold, &id), original);
    assert_eq!(immutable(&native(&lab)), reservations);
    assert_eq!(audit(&cold, &id), request_audit);
    release(&cold, "account", 2);
    let layered = get(&cold, "/v1/risk/kill-switch");
    assert_eq!(layered["nativeStopped"], true);
    assert_eq!(layered["generation"], "3");
    release(&cold, "global", 3);
    let released = get(&cold, "/v1/risk/kill-switch");
    assert_eq!(released["nativeStopped"], false);
    assert_eq!(released["generation"], "4");
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    assert_eq!(inspect(&cold, &id), original);
    assert_eq!(immutable(&native(&lab)), reservations);
    // A deliberately new owner reference mark/version and generation produce a
    // new eligible review of the SAME immutable ETH Proposal. No limits change.
    let mut input = valuation::input(&lab, &ledger, 2);
    for m in &mut input.marks {
        if m.symbol == "BTCUSDT" {
            m.price = "2200".into();
        }
    }
    valuation::write(&lab, &input);
    let valuation = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], true);
    assert_eq!(valuation["killGeneration"], "4");
    let path = format!(
        "/v1/assisted-testnet/subjects/{}/risk-reviews",
        review["previousSubjectId"].as_str().unwrap()
    );
    let (s, new_review) = call(
        &cold,
        "session-current",
        "POST",
        &path,
        json!({"snapshotHash":valuation["snapshot"]["snapshotHash"],"expectedGeneration":"4"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{new_review}");
    assert_eq!(new_review["decision"]["verdict"], "approval_required");
    assert_eq!(new_review["proposalHash"], review["proposalHash"]);
    assert_ne!(
        new_review["decision"]["decisionId"],
        review["decision"]["decisionId"]
    );
    let newer = open(&cold, &new_review["subject"]);
    let new_opened = inspect(&cold, &newer);
    assert_eq!(new_opened["request"]["approvers"], json!([]));
    approve(&cold, &newer, 0);
    approve(&cold, &newer, 1);
    let repeat = current::submit(&cold, &newer, "never-repeat");
    assert_eq!(repeat.0, 409, "{repeat:?}");
    assert_eq!(repeat.1["code"], "STATE_CONFLICT");
    assert_eq!(immutable(&native(&lab)), reservations);
    assert_eq!(audit(&cold, &id), request_audit);
    assert_eq!(get(&cold, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    let current_c11 = c11::current(&cold);
    let history = get(
        &cold,
        &format!(
            "/v1/admin/feature-flags/{}/history",
            current_c11["resourceId"].as_str().unwrap()
        ),
    );
    assert_eq!(history["totalCount"], 5);
    let activation_audit = audit(&cold, current_c11["resourceId"].as_str().unwrap());
    let controls = get(&cold, "/v1/risk/kill-switch");
    let control_audits = controls["history"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| audit(&cold, e["correlationId"].as_str().unwrap()))
        .collect::<Vec<_>>();
    let mut refusals = vec![];
    for action in ["ack", "unack"] {
        let r = call(
            &cold,
            "session-owner",
            "POST",
            &format!(
                "/v1/alerts/{}/{action}",
                alerts["items"][0]["id"].as_str().unwrap()
            ),
            json!({}),
            &Uuid::new_v4().to_string(),
        );
        assert_eq!(r.0, 403);
        refusals.push(json!({"operation":action,"status":r.0,"body":r.1}));
    }
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_L4_CURRENT_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"CURRENT_NATIVE_REVIEW_ACCEPTED_PUBLIC_CONTROLS_REREVIEW_SAME_PROPOSAL","firstValuation":first_valuation,"review":review,"approval":approval,"command":command,"original":original,"ledger":ledger,"staleValuation":stale,"observerUnavailable":unavailable,"reconciliation":books,"alerts":alerts,"requestAudit":request_audit,"initialC11":initial,"on":on,"stopped":stopped,"layered":layered,"released":released,"currentC11":current_c11,"c11History":history,"valuation":valuation,"newReview":new_review,"newOpened":new_opened,"newApproved":inspect(&cold,&newer),"activationAudit":activation_audit,"controlAudits":control_audits,"gapRefusals":refusals,"repeatRefusal":{"status":repeat.0,"body":repeat.1},"reservationsBefore":reservations,"reservationsAfter":immutable(&native(&lab)),"protocolCalls":2,"actualTestnet":false,"limitsRelaxed":false,"automaticClosure":false,"noResend":true}),
    );
}
#[test]
fn current_gate_unknown_remains_open_across_public_c11_kill_release_and_restart() {
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
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let (_r, cold) = lab.bff(true);
    let original = inspect(&cold, &id);
    assert_eq!(original["command"]["state"], "unknown");
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    let books = get(&cold, "/v1/assisted-testnet/reconciliation");
    let alerts = get(&cold, "/v1/alerts");
    let request_audit = audit(&cold, &id);
    let reservations = immutable(&native(&lab));
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    assert_eq!(alerts["items"].as_array().unwrap().len(), 2);
    roundtrip(&cold);
    kill::mutate(&cold, "session-current", "engage", "account", 0, None);
    let stopped = roundtrip(&cold);
    assert_eq!(stopped["version"], "4");
    assert_eq!(stopped["killGeneration"], "1");
    assert_eq!(stopped["nativeStopped"], true);
    let (_again, latest) = lab.bff(true);
    assert_eq!(inspect(&latest, &id), original);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    release(&latest, "account", 1);
    let released = c11::current(&latest);
    assert_eq!(released["nativeStopped"], false);
    assert_eq!(released["killGeneration"], "2");
    let valuation = get(&latest, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], false);
    assert!(valuation.get("snapshot").is_none());
    let reject = call(
        &latest,
        "session-current",
        "POST",
        &format!(
            "/v1/assisted-testnet/subjects/{}/risk-reviews",
            review["previousSubjectId"].as_str().unwrap()
        ),
        json!({"snapshotHash":review["snapshotHash"],"expectedGeneration":"2"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(reject.0, 409);
    let retry = current::submit(&latest, &id, "query-only");
    assert_ne!(retry.0, 200);
    assert_eq!(inspect(&latest, &id), original);
    assert_eq!(get(&latest, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(get(&latest, "/v1/assisted-testnet/reconciliation"), books);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    assert_eq!(audit(&latest, &id), request_audit);
    assert_eq!(immutable(&native(&lab)), reservations);
    for alert in alerts["items"].as_array().unwrap() {
        assert_eq!(alert["status"], "unacked");
        assert_eq!(alert["sourceEvidence"]["status"], "OPEN");
    }
    valuation::evidence(
        "QUANTOS_L4_CURRENT_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"CURRENT_NATIVE_REVIEW_UNKNOWN_PUBLIC_CONTROLS","review":review,"original":original,"ledger":ledger,"reconciliation":books,"alerts":alerts,"requestAudit":request_audit,"stopped":stopped,"released":released,"valuation":valuation,"riskRefusal":{"status":reject.0,"body":reject.1},"commandRefusal":{"status":retry.0,"body":retry.1},"reservationsBefore":reservations,"reservationsAfter":immutable(&native(&lab)),"protocolCalls":2,"actualTestnet":false,"noResend":true,"automaticClosure":false}),
    );
}
