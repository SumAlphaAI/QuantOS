use super::*;
pub(super) fn current(url: &str) -> Value {
    let v = get(url, "/v1/admin/feature-flags");
    v["items"][0].clone()
}
fn body(url: &str, v: &Value, enabled: bool) -> Value {
    let (s, c) = call(
        url,
        "session-owner",
        "POST",
        "/v1/auth/mfa/challenges",
        json!({"purpose":"security_change","code":"123456"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{c}");
    let (s, g) = call(
        url,
        "session-owner",
        "POST",
        "/v1/auth/reauth",
        json!({"challengeRef":c["challengeRef"]}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{g}");
    let mut b = json!({"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]});
    b["scope"] = json!({"tenantId":v["tenantId"],"workspaceId":v["workspaceId"],"accountId":v["accountId"],"mode":"assisted_live","featureKey":"execution.assisted-testnet"});
    b["enabled"] = json!(enabled);
    b["validUntil"] = json!(Utc::now() + Duration::minutes(2));
    b["reason"] = json!("owned current scoped C11 review");
    b["confirmPhrase"] = json!(if enabled {
        "ENABLE ASSISTED TESTNET"
    } else {
        "DISABLE ASSISTED TESTNET"
    });
    b
}
fn put(url: &str, v: &Value, b: Value, key: &str) -> (u16, Value) {
    let r = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Wait::from_secs(15))
        .build()
        .unwrap()
        .put(format!(
            "{url}/v1/admin/feature-flags/{}",
            v["resourceId"].as_str().unwrap()
        ))
        .header(
            "cookie",
            "quantos_session=session-owner; quantos_csrf=csrf-token-0000000000000001",
        )
        .header("origin", "http://localhost:3190")
        .header("x-csrf-token", "csrf-token-0000000000000001")
        .header("if-match", v["version"].as_str().unwrap())
        .header("idempotency-key", key)
        .header("x-request-id", Uuid::new_v4().to_string())
        .json(&b)
        .send()
        .unwrap();
    let s = r.status().as_u16();
    (s, r.json().unwrap())
}
pub(super) fn change(url: &str, v: &Value, enabled: bool) -> Value {
    let b = body(url, v, enabled);
    let (s, r) = put(url, v, b, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{r}");
    r
}
fn evidence(name: &str, v: Value) {
    if let Ok(path) = std::env::var(name) {
        private_write(path, serde_json::to_vec_pretty(&v).unwrap());
    }
}
#[test]
fn c11_public_runtime_replicas_and_original_receipt_do_not_reset_kill_generation() {
    let lab = Lab::new();
    let (_a, url) = lab.bff(true);
    let (_b, other) = lab.bff(true);
    let initial = current(&url);
    let subs = get(&url, "/v1/assisted-testnet/subjects");
    let request = open(&url, &subs["items"][0]);
    approve(&url, &request, 0);
    approve(&url, &request, 1);
    let b = body(&url, &initial, false);
    let key = Uuid::new_v4().to_string();
    let replies = std::thread::scope(|s| {
        let handles = (0..12)
            .map(|i| {
                let url = if i % 2 == 0 { &url } else { &other };
                let b = b.clone();
                let key = &key;
                let v = &initial;
                s.spawn(move || put(url, v, b, key))
            })
            .collect::<Vec<_>>();
        handles
            .into_iter()
            .map(|h| h.join().unwrap())
            .collect::<Vec<_>>()
    });
    for (s, r) in &replies {
        assert_eq!(*s, 200, "{r}");
        assert_eq!(*r, replies[0].1);
    }
    let off = current(&other);
    assert_eq!(off["version"], "1");
    assert_eq!(off["effective"], false);
    assert_eq!(off["killGeneration"], "0");
    let caps = get(&url, "/v1/assisted-testnet/capabilities");
    assert_eq!(caps["canRequest"], false);
    let path = format!("/v1/assisted-testnet/requests/{request}/commands");
    assert_eq!(
        call(
            &url,
            "session-current",
            "POST",
            &path,
            json!({"expectedRevision":2}),
            &Uuid::new_v4().to_string()
        )
        .0,
        403
    );
    let reviewed = get(&url, &format!("/v1/assisted-testnet/requests/{request}"));
    assert_eq!(reviewed["request"]["revision"], 2);
    let mut changed = b.clone();
    changed["reason"] = json!("changed");
    assert_eq!(put(&url, &initial, changed, &key).0, 409);
    assert_eq!(put(&url, &initial, b, &Uuid::new_v4().to_string()).0, 403);
    let stale = body(&url, &initial, true);
    assert_eq!(
        put(&url, &initial, stale, &Uuid::new_v4().to_string()).0,
        409
    );
    change(&url, &off, true);
    let on = current(&url);
    assert_eq!(on["version"], "2");
    assert_eq!(on["killGeneration"], "0");
    let command_key = Uuid::new_v4().to_string();
    let (s, command) = call(
        &url,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &command_key,
    );
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let before = get(&url, "/v1/assisted-testnet/ledger");
    let mut short = body(&url, &on, true);
    short["validUntil"] = json!(Utc::now() + Duration::seconds(2));
    assert_eq!(put(&url, &on, short, &Uuid::new_v4().to_string()).0, 200);
    std::thread::sleep(Wait::from_millis(2100));
    let expired = current(&url);
    assert_eq!(expired["version"], "3");
    assert_eq!(expired["enabled"], true);
    assert_eq!(expired["effective"], false);
    assert_eq!(expired["nativeActivationEffective"], false);
    assert_eq!(expired["historyCount"], 4);
    assert_eq!(expired["killGeneration"], "0");
    change(&url, &expired, false);
    let disabled = current(&url);
    let (_r, restarted) = lab.bff(true);
    let after = get(&restarted, "/v1/assisted-testnet/ledger");
    assert_eq!(before, after);
    assert_eq!(current(&restarted)["version"], "4");
    let history = get(
        &restarted,
        &format!(
            "/v1/admin/feature-flags/{}/history",
            initial["resourceId"].as_str().unwrap()
        ),
    );
    assert_eq!(history["items"].as_array().unwrap().len(), 5);
    let c10 = get(
        &restarted,
        &format!(
            "/v1/audit/evidence-chains/{}",
            initial["resourceId"].as_str().unwrap()
        ),
    );
    assert_eq!(c10["items"].as_array().unwrap().len(), 5);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_C11_FLOW_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"initial":initial,"off":off,"on":on,"disabled":disabled,"expired":expired,"history":history,"c10":c10,"events":get(&restarted,&format!("/v1/audit/events?correlationId={}",initial["resourceId"].as_str().unwrap())),"reviewed":reviewed,"offCapabilities":caps,"originalReceipt":replies[0].1,"replicas":12,"before":before,"after":after,"command":command,"killGenerationUnchanged":true,"noAutomaticResend":true,"protocolCalls":1,"actualTestnet":false}),
    );
}
#[test]
fn c11_actual_committed_process_death_recovers_original_lease_and_refuses_fork() {
    let lab = Lab::new();
    let (mut process, url) = lab.bff(true);
    let v = current(&url);
    let b = body(&url, &v, false);
    let old = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    let key = Uuid::new_v4().to_string();
    private_write(
        lab.directory.join("pause-activation-after-commit"),
        b"owned commit window",
    );
    let (u, input, version, k) = (url.clone(), b.clone(), v.clone(), key.clone());
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(10))
            .build()
            .unwrap()
            .put(format!(
                "{u}/v1/admin/feature-flags/{}",
                version["resourceId"].as_str().unwrap()
            ))
            .header(
                "cookie",
                "quantos_session=session-owner; quantos_csrf=csrf-token-0000000000000001",
            )
            .header("origin", "http://localhost:3190")
            .header("x-csrf-token", "csrf-token-0000000000000001")
            .header("if-match", "0")
            .header("idempotency-key", k)
            .header("x-request-id", Uuid::new_v4().to_string())
            .json(&input)
            .send()
    });
    let end = std::time::Instant::now() + Wait::from_secs(8);
    while !lab
        .directory
        .join("activation-after-commit.marker")
        .is_file()
    {
        assert!(std::time::Instant::now() < end);
        std::thread::sleep(Wait::from_millis(10));
    }
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    fs::remove_file(lab.directory.join("pause-activation-after-commit")).unwrap();
    let (_r, restarted) = lab.bff(true);
    let recovered = current(&restarted);
    assert_eq!(recovered["version"], "1");
    assert_eq!(recovered["nativeActivationVersion"], "1");
    assert_eq!(recovered["effective"], false);
    let (s, receipt) = put(&restarted, &v, b, &key);
    assert_eq!(s, 200, "{receipt}");
    assert_eq!(current(&restarted)["historyCount"], 2);
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
            "/v1/admin/feature-flags",
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
    let store = owner_store(&lab, "commands");
    let native = store.lock().unwrap().read().unwrap().unwrap();
    let mut fork = native.clone();
    fork["activation"]["enabled"] = json!(true);
    store.lock().unwrap().write(&fork).unwrap();
    let (_fork, forked) = lab.bff(true);
    assert_eq!(
        call(
            &forked,
            "session-current",
            "GET",
            "/v1/admin/feature-flags",
            json!({}),
            "fork"
        )
        .0,
        503
    );
    store.lock().unwrap().write(&native).unwrap();
    assert_eq!(current(&restarted)["effective"], false);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_C11_RECOVERY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"recovered":recovered,"receipt":receipt,"actualBffDeathAfterCommit":true,"originalReceiptOnly":true,"oldApprovalRollbackDenied":true,"nativeSameVersionForkDenied":true,"protocolCalls":0,"actualTestnet":false}),
    );
}
pub(super) fn unknown_current_c11(lab: &Lab, url: &str, unknown: &Value) {
    let before = get(url, "/v1/assisted-testnet/ledger");
    let alerts = get(url, "/v1/alerts");
    let issued = owner_store(lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    super::native_control::mutate(url, "session-current", "engage", "account", 0, None);
    let stopped = get(url, "/v1/risk/kill-switch");
    assert_eq!(stopped["generation"], "1");
    let v = current(url);
    change(url, &v, false);
    let off = current(url);
    assert_eq!(off["effective"], false);
    assert_eq!(off["killGeneration"], "1");
    assert_eq!(get(url, "/v1/assisted-testnet/ledger"), before);
    assert_eq!(get(url, "/v1/alerts"), alerts);
    change(url, &off, true);
    let on = current(url);
    assert_eq!(on["killGeneration"], "1");
    assert_eq!(on["nativeStopped"], true);
    assert_eq!(on["runtimeWritable"], false);
    let after = get(url, "/v1/assisted-testnet/ledger");
    let after_alerts = get(url, "/v1/alerts");
    assert_eq!(after, before);
    assert_eq!(after_alerts, alerts);
    assert_eq!(
        owner_store(lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap()["issued"],
        issued
    );
    assert_eq!(after["appliedFillCount"], 0);
    assert_eq!(after["quarantinedCommandCount"], 1);
    super::l4_controls::unknown_join(lab, unknown, &before, &alerts, &off, &on);
    evidence(
        "QUANTOS_C11_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"command":unknown,"before":before,"after":after,"alerts":alerts,"afterAlerts":after_alerts,"off":off,"on":on,"killGenerationBefore":stopped["generation"],"unknownReservationsUnchanged":true,"noResend":true,"protocolCalls":1,"actualTestnet":false}),
    );
}

#[cfg(unix)]
#[test]
fn c11_failed_journal_write_cannot_activate_uncommitted_lease_on_warm_read() {
    use std::os::unix::fs::PermissionsExt;
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let initial = current(&url);
    change(&url, &initial, false);
    let off = current(&url);
    let input = body(&url, &off, true);
    let key = Uuid::new_v4().to_string();
    let committed = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    // Real OS write denial, not a synthetic HTTP outcome or accepted zero IO.
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o500)).unwrap();
    assert!(
        fs::write(lab.directory.join("write-denial-probe"), b"must refuse").is_err(),
        "owned test requires an unprivileged Unix caller"
    );
    let denied = put(&url, &off, input.clone(), &key);
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(denied.0, 503, "{:?}", denied.1);
    assert_eq!(
        owner_store(&lab, "approvals")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        committed
    );
    let identity = get(&url, "/v1/session");
    assert_eq!(identity["mode"], "assisted_live");
    let after = current(&url);
    assert_eq!(after["version"], "1");
    assert_eq!(after["effective"], false);
    assert_eq!(after["nativeActivationVersion"], "1");
    assert_eq!(after["historyCount"], 2);
    let (s, receipt) = put(&url, &off, input, &key);
    assert_eq!(s, 200, "{receipt}");
    let recovered = current(&url);
    assert_eq!(recovered["version"], "2");
    assert_eq!(recovered["effective"], true);
    assert_eq!(recovered["killGeneration"], "0");
    assert_eq!(recovered["historyCount"], 3);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_C11_WRITE_FAILURE_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualOsWriteDenied":true,"failedResponseStatus":denied.0,"committedStateUnchanged":true,"warmRead":after,"manualOriginalReceipt":receipt,"afterManualRecovery":recovered,"noImplicitActivation":true,"protocolCalls":0,"actualTestnet":false}),
    );
}
