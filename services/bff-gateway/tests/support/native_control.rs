use super::*;
fn control_body(
    base: &str,
    who: &str,
    action: &str,
    scope: &str,
    generation: u64,
    permit: Option<&str>,
) -> Value {
    let (s, c) = call(
        base,
        who,
        "POST",
        "/v1/auth/mfa/challenges",
        json!({"purpose":"security_change","code":"123456"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{c}");
    let (s, g) = call(
        base,
        who,
        "POST",
        "/v1/auth/reauth",
        json!({"challengeRef":c["challengeRef"]}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{g}");
    let mut b = json!({"scope":scope,"accountId":if scope=="global"{Value::Null}else{json!("44444444-4444-4444-8444-444444444444")},"expectedGeneration":generation.to_string(),"reason":"owned public kill control","confirmPhrase":format!("{} {} {}",if action=="engage"{"ENGAGE"}else if action=="release"{"RELEASE"}else{"APPROVE"},scope.to_uppercase(),if action=="release-approvals"{"RELEASE"}else{"KILL"}),"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]});
    if let Some(p) = permit {
        b["approvalRef"] = json!(p);
    }
    b
}
pub(super) fn mutate(
    base: &str,
    who: &str,
    action: &str,
    scope: &str,
    generation: u64,
    permit: Option<&str>,
) -> Value {
    let b = control_body(base, who, action, scope, generation, permit);
    let (s, v) = call(
        base,
        who,
        "POST",
        &format!("/v1/risk/kill-switch/{action}"),
        b,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{v}");
    v
}
fn put_evidence(name: &str, v: Value) {
    if let Ok(path) = std::env::var(name) {
        private_write(path, serde_json::to_vec_pretty(&v).unwrap());
    }
}
#[test]
fn public_kill_control_replicas_cas_proofs_and_layered_independent_release() {
    let lab = Lab::new();
    let (_a, url) = lab.bff(true);
    let (_b, other) = lab.bff(true);
    let subjects = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &subjects["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let body = control_body(&url, "session-current", "engage", "account", 0, None);
    let key = Uuid::new_v4().to_string();
    let rows = std::thread::scope(|scope| {
        (0..12)
            .map(|i| {
                let base = if i % 2 == 0 { &url } else { &other };
                let b = &body;
                let k = &key;
                scope.spawn(move || {
                    call(
                        base,
                        "session-current",
                        "POST",
                        "/v1/risk/kill-switch/engage",
                        b.clone(),
                        k,
                    )
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| t.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert!(rows.iter().all(|(s, v)| *s == 200 && v == &rows[0].1));
    let account = get(&other, "/v1/risk/kill-switch");
    assert_eq!(account["generation"], "1");
    assert_eq!(account["nativeGeneration"], "1");
    assert_eq!(account["nativeStopped"], true);
    assert_eq!(account["history"].as_array().unwrap().len(), 1);
    let mut changed = body.clone();
    changed["reason"] = json!("changed");
    assert_eq!(
        call(
            &url,
            "session-current",
            "POST",
            "/v1/risk/kill-switch/engage",
            changed,
            &key
        )
        .0,
        409
    );
    assert_eq!(
        call(
            &url,
            "session-current",
            "POST",
            "/v1/risk/kill-switch/engage",
            body.clone(),
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    let wrong = control_body(&url, "session-current", "engage", "global", 1, None);
    assert_eq!(
        call(
            &url,
            "session-current",
            "POST",
            "/v1/risk/kill-switch/engage",
            wrong,
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    let stale = control_body(&url, "session-owner", "engage", "global", 0, None);
    assert_eq!(
        call(
            &url,
            "session-owner",
            "POST",
            "/v1/risk/kill-switch/engage",
            stale,
            &Uuid::new_v4().to_string()
        )
        .0,
        409
    );
    let missing = control_body(&url, "session-owner", "release", "account", 1, None);
    assert_eq!(
        call(
            &url,
            "session-owner",
            "POST",
            "/v1/risk/kill-switch/release",
            missing,
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    mutate(&url, "session-owner", "engage", "global", 1, None);
    let global = get(&url, "/v1/risk/kill-switch");
    assert_eq!(global["generation"], "2");
    assert_eq!(global["globalActive"], true);
    let permit = mutate(
        &url,
        "session-approver",
        "release-approvals",
        "account",
        2,
        None,
    );
    mutate(
        &url,
        "session-owner",
        "release",
        "account",
        2,
        permit["event"]["eventId"].as_str(),
    );
    let layered = get(&other, "/v1/risk/kill-switch");
    assert_eq!(layered["generation"], "3");
    assert_eq!(layered["accountActive"], false);
    assert_eq!(layered["globalActive"], true);
    assert_eq!(layered["nativeStopped"], true);
    let self_permit = mutate(
        &url,
        "session-owner",
        "release-approvals",
        "global",
        3,
        None,
    );
    let self_release = control_body(
        &url,
        "session-owner",
        "release",
        "global",
        3,
        self_permit["event"]["eventId"].as_str(),
    );
    assert_eq!(
        call(
            &url,
            "session-owner",
            "POST",
            "/v1/risk/kill-switch/release",
            self_release,
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    let permit = mutate(
        &url,
        "session-approver",
        "release-approvals",
        "global",
        3,
        None,
    );
    let released = mutate(
        &url,
        "session-owner",
        "release",
        "global",
        3,
        permit["event"]["eventId"].as_str(),
    );
    let (_r, restarted) = lab.bff(true);
    let view = get(&restarted, "/v1/risk/kill-switch");
    assert_eq!(view["generation"], "4");
    assert_eq!(view["nativeGeneration"], "4");
    assert_eq!(view["nativeStopped"], false);
    for k in ["original-command", "new-command"] {
        assert_ne!(
            call(
                &restarted,
                "session-current",
                "POST",
                &format!("/v1/assisted-testnet/requests/{id}/commands"),
                json!({"expectedRevision":2}),
                k
            )
            .0,
            200
        );
    }
    let corr = released["event"]["correlationId"].as_str().unwrap();
    let events = get(
        &restarted,
        &format!("/v1/audit/events?correlationId={corr}"),
    );
    let chain = get(&restarted, &format!("/v1/audit/evidence-chains/{corr}"));
    assert_eq!(chain["items"].as_array().unwrap().len(), 4);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    put_evidence(
        "QUANTOS_NATIVE_CONTROL_FLOW_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"account":account,"global":global,"layered":layered,"released":view,"receipt":released,"events":events,"chain":chain,"replicaRequests":12,"proofReuseDenied":true,"selfReviewDenied":true,"staleAndChangedBodyDenied":true,"oldReviewsRemainInvalid":true,"protocolCalls":0,"actualTestnet":false}),
    );
}
#[test]
fn public_control_commit_before_native_ack_recovers_and_refuses_rollback_missing_and_corrupt() {
    let lab = Lab::new();
    let (mut p, url) = lab.bff(true);
    get(&url, "/v1/risk/kill-switch");
    let b = control_body(&url, "session-owner", "engage", "global", 0, None);
    let key = Uuid::new_v4().to_string();
    let old = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    private_write(lab.directory.join("pause-control-after-commit"), b"owned");
    let u = url.clone();
    let body = b.clone();
    let k = key.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(10))
            .build()
            .unwrap()
            .post(format!("{u}/v1/risk/kill-switch/engage"))
            .header(
                "cookie",
                "quantos_session=session-owner; quantos_csrf=csrf-token-0000000000000001",
            )
            .header("origin", "http://localhost:3190")
            .header("x-csrf-token", "csrf-token-0000000000000001")
            .header("idempotency-key", k)
            .header("x-request-id", Uuid::new_v4().to_string())
            .json(&body)
            .send()
    });
    let until = std::time::Instant::now() + Wait::from_secs(8);
    while !lab.directory.join("control-after-commit.marker").exists() {
        assert!(std::time::Instant::now() < until, "commit marker missing");
        std::thread::sleep(Wait::from_millis(10));
    }
    p.0.kill().unwrap();
    p.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    fs::remove_file(lab.directory.join("pause-control-after-commit")).unwrap();
    let (_r, restarted) = lab.bff(true);
    let recovered = get(&restarted, "/v1/risk/kill-switch");
    assert_eq!(recovered["generation"], "1");
    assert_eq!(recovered["nativeGeneration"], "1");
    assert_eq!(recovered["nativeStopped"], true);
    let (s, receipt) = call(
        &restarted,
        "session-owner",
        "POST",
        "/v1/risk/kill-switch/engage",
        b,
        &key,
    );
    assert_eq!(s, 200, "{receipt}");
    assert_eq!(
        get(&restarted, "/v1/risk/kill-switch")["history"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    let good = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .write(&old)
        .unwrap();
    let (_cold, cold) = lab.bff(true);
    assert_eq!(
        call(
            &cold,
            "session-current",
            "GET",
            "/v1/risk/kill-switch",
            json!({}),
            "rollback"
        )
        .0,
        503
    );
    owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .write(&good)
        .unwrap();
    let native = fs::read(lab.directory.join("commands.json")).unwrap();
    fs::remove_file(lab.directory.join("commands.json")).unwrap();
    assert!(lab.bff_or_startup_refusal(true).is_none());
    private_write(lab.directory.join("commands.json"), b"{broken");
    assert_eq!(
        call(
            &restarted,
            "session-current",
            "GET",
            "/v1/risk/kill-switch",
            json!({}),
            "corrupt"
        )
        .0,
        503
    );
    private_write(lab.directory.join("commands.json"), native);
    let current = get(&restarted, "/v1/risk/kill-switch");
    for k in ["generation", "nativeGeneration", "nativeStopped", "history"] {
        assert_eq!(current[k], recovered[k]);
    }
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    put_evidence(
        "QUANTOS_NATIVE_CONTROL_RECOVERY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"recovered":recovered,"receipt":receipt,"actualBffDeathAfterCommit":true,"sameKeyNoDuplicate":true,"coldRollbackDenied":true,"coldMissingDenied":true,"corruptDenied":true,"protocolCalls":0,"actualTestnet":false}),
    );
}
#[test]
fn public_controls_preserve_actual_unknown_fill_ledger_and_open_alert_obligations() {
    let lab = Lab::configured(true);
    let (mut p, url) = lab.bff(true);
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &rows["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let key = Uuid::new_v4().to_string();
    let u = url.clone();
    let target = path.clone();
    let k = key.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(5))
            .build()
            .unwrap()
            .post(format!("{u}{target}"))
            .header(
                "cookie",
                "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
            )
            .header("origin", "http://localhost:3190")
            .header("x-csrf-token", "csrf-token-0000000000000001")
            .header("idempotency-key", k)
            .header("x-request-id", Uuid::new_v4().to_string())
            .json(&json!({"expectedRevision":2}))
            .send()
    });
    let pending = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    assert!(pending.starts_with("L02_PENDING="));
    p.0.kill().unwrap();
    p.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let (_r, restarted) = lab.bff(true);
    let (s, c) = call(
        &restarted,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &key,
    );
    assert_eq!(s, 200, "{c}");
    assert_eq!(c["state"], "unknown");
    let before = get(&restarted, "/v1/assisted-testnet/ledger");
    let alerts = get(&restarted, "/v1/alerts");
    let anchor = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    mutate(&restarted, "session-current", "engage", "account", 0, None);
    let permit = mutate(
        &restarted,
        "session-approver",
        "release-approvals",
        "account",
        1,
        None,
    );
    let released = mutate(
        &restarted,
        "session-owner",
        "release",
        "account",
        1,
        permit["event"]["eventId"].as_str(),
    );
    let after = get(&restarted, "/v1/assisted-testnet/ledger");
    assert_eq!(before, after);
    assert_eq!(after["appliedFillCount"], 0);
    assert_eq!(after["quarantinedCommandCount"], 1);
    assert_eq!(get(&restarted, "/v1/alerts"), alerts);
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap()["issued"],
        anchor
    );
    let control = get(&restarted, "/v1/risk/kill-switch");
    assert_eq!(control["generation"], "2");
    assert_eq!(control["unknownCommands"], 1);
    assert_eq!(control["nativeStopped"], false);
    assert_ne!(
        call(
            &restarted,
            "session-current",
            "POST",
            &path,
            json!({"expectedRevision":2}),
            &key
        )
        .0,
        200
    );
    let view = get(&restarted, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(view["command"]["state"], "unknown");
    // A delayed trace may finish the original paused call; it is not a resend.
    if let Ok(line) = lab.trace.recv_timeout(Wait::from_millis(100)) {
        let trace: Value = serde_json::from_str(
            line.strip_prefix("L02_TRACE=")
                .expect("only original delayed trace"),
        )
        .unwrap();
        assert_eq!(trace["protocolCalls"], 1);
    }
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    put_evidence(
        "QUANTOS_NATIVE_CONTROL_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"before":before,"after":after,"alerts":alerts,"afterAlerts":get(&restarted,"/v1/alerts"),"control":control,"releaseReceipt":released,"command":view["command"],"unknownReservationsUnchanged":true,"noReplay":true,"protocolCalls":1,"actualTestnet":false}),
    );
}
