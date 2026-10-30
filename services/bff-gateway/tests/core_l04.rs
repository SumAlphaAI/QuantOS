//! Actual local HTTP -> L03 -> separate L02 mTLS process -> owned protocol bytes.
//! No external venue, database, identity provider or production credentials.
#[path = "support/l04_tls.rs"]
mod tls;
use chrono::{Duration, Utc};
use execution_gateway::restricted_zone::fingerprint;
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration as Wait,
};
use uuid::Uuid;
struct Process(Child);
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
struct Lab {
    directory: PathBuf,
    zone: Process,
    trace: mpsc::Receiver<String>,
}
impl Drop for Lab {
    fn drop(&mut self) {
        let _ = self.zone.0.kill();
        let _ = self.zone.0.wait();
        let _ = fs::remove_dir_all(&self.directory);
    }
}
fn private_write(p: impl AsRef<std::path::Path>, bytes: impl AsRef<[u8]>) {
    fs::write(&p, bytes).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(p, fs::Permissions::from_mode(0o600)).unwrap();
    }
}
fn portfolio_store(lab: &Lab) -> quantos_execution::durable::DurableStore {
    owner_store(lab, "portfolio")
}
fn owner_store(lab: &Lab, name: &str) -> quantos_execution::durable::DurableStore {
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    quantos_execution::durable::DurableStore::new(
        &lab.directory,
        name,
        serde_json::from_value(owner["keys"][3].clone()).unwrap(),
    )
    .unwrap()
}
fn portfolio_checkpoint(lab: &Lab) -> Value {
    portfolio_store(lab)
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()
}
impl Lab {
    fn new() -> Self {
        Self::configured(false)
    }
    fn configured(pause: bool) -> Self {
        Self::pause_at(if pause { 1 } else { 0 })
    }
    fn pause_at(pause: usize) -> Self {
        assert!(!std::env::vars().any(|(k, _)| {
            [
                "DATABASE_URL",
                "QUANTOS_EXECUTION_DATABASE_URL",
                "SUPABASE_SERVICE_ROLE_KEY",
                "BINANCE_API_KEY",
                "BINANCE_API_SECRET",
            ]
            .contains(&k.as_str())
        }));
        let directory = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("quantos-l02-{}", Uuid::new_v4()));
        fs::create_dir(&directory).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&directory, fs::Permissions::from_mode(0o700)).unwrap();
        }
        let (ca, ca_key) = tls::certificate("l04-owned-ca", None, false, false);
        let (server, key) =
            tls::certificate("execution-zone.invalid", Some((&ca, &ca_key)), true, false);
        let (peer, peerkey) = tls::certificate(
            "execution-worker.invalid",
            Some((&ca, &ca_key)),
            false,
            false,
        );
        for (name, bytes) in [
            ("ca.pem", ca.to_pem().unwrap()),
            ("server.pem", server.to_pem().unwrap()),
            ("server-key.pem", key.private_key_to_pem_pkcs8().unwrap()),
            ("peer-1.pem", peer.to_pem().unwrap()),
            ("peer-2.pem", peer.to_pem().unwrap()),
            (
                "peer-1-key.pem",
                peerkey.private_key_to_pem_pkcs8().unwrap(),
            ),
        ] {
            private_write(directory.join(name), bytes);
        }
        let at = chrono::DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
        private_write(directory.join("config.json"),serde_json::to_vec(&json!({"account":"44444444-4444-4444-8444-444444444444","now":at,"rotation":false,"schedule":[],"wallClock":true,"pauseReplyAtRequest":pause})).unwrap());
        let executable = std::env::var("QUANTOS_L02_FIXTURE_EXECUTABLE")
            .expect("build execution-gateway and explicitly select the owned executable");
        let mut zone = Process(
            Command::new(executable)
                .args(["--l02-owned-zone-fixture", directory.to_str().unwrap()])
                .env_clear()
                .env("TMPDIR", std::env::temp_dir())
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .unwrap(),
        );
        let out = zone.0.stdout.take().unwrap();
        let (tx, trace) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines() {
                if tx.send(line.unwrap()).is_err() {
                    break;
                }
            }
        });
        let line = trace.recv_timeout(Wait::from_secs(10)).unwrap();
        let ready: Value = serde_json::from_str(line.strip_prefix("L02_READY=").unwrap()).unwrap();
        assert_eq!(ready["pid"], zone.0.id());
        let mut keys = [[0; 32]; 4];
        for k in &mut keys {
            openssl::rand::rand_bytes(k).unwrap();
        }
        private_write(directory.join("bff-owner.json"),serde_json::to_vec(&json!({"address":ready["address"],"serverFingerprint":fingerprint(&server).unwrap(),"sessionHash":format!("sha256:{}","1".repeat(64)),"keys":keys,"createdAt":at,"expiresAt":at+Duration::minutes(5)})).unwrap());
        Self {
            directory,
            zone,
            trace,
        }
    }
    fn bff(&self, enabled: bool) -> (Process, String) {
        self.bff_or_startup_refusal(enabled)
            .expect("owned BFF must start")
    }
    fn bff_or_startup_refusal(&self, enabled: bool) -> Option<(Process, String)> {
        let mut child = Process(
            Command::new(env!("CARGO_BIN_EXE_bff-gateway"))
                .env_clear()
                .env("PATH", std::env::var("PATH").unwrap())
                .env("TMPDIR", std::env::temp_dir())
                .env("QUANTOS_BFF_BIND", "127.0.0.1:0")
                .env("QUANTOS_BFF_REFERENCE_CONTEXT", "assisted-mtls-local")
                .env("QUANTOS_BFF_OWNED_MTLS_DIRECTORY", &self.directory)
                .env(
                    "QUANTOS_BFF_OWNED_ASSISTED",
                    if enabled { "enabled" } else { "disabled" },
                )
                .env("GITHUB_SHA", std::env::var("GITHUB_SHA").unwrap())
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .unwrap(),
        );
        let out = child.0.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut line = String::new();
            BufReader::new(out).read_line(&mut line).unwrap();
            let _ = tx.send(line);
        });
        let ready_line = rx.recv_timeout(Wait::from_secs(15)).unwrap();
        if ready_line.is_empty() {
            assert!(
                !child.0.wait().unwrap().success(),
                "startup refusal must exit nonzero"
            );
            return None;
        }
        let ready: Value = serde_json::from_str(&ready_line).expect("owned BFF readiness JSON");
        assert_eq!(ready["ready"], true);
        let address: std::net::SocketAddr = ready["address"].as_str().unwrap().parse().unwrap();
        assert!(address.ip().is_loopback());
        assert_ne!(
            address.port(),
            0,
            "readiness must report the retained OS listener"
        );
        Some((child, format!("http://{address}")))
    }
    fn trace(&self) -> Value {
        let line = self.trace.recv_timeout(Wait::from_secs(10)).unwrap();
        serde_json::from_str(line.strip_prefix("L02_TRACE=").unwrap()).unwrap()
    }
}
fn call(base: &str, who: &str, method: &str, path: &str, body: Value, key: &str) -> (u16, Value) {
    let c = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Wait::from_secs(15))
        .build()
        .unwrap();
    let r = c
        .request(method.parse().unwrap(), format!("{base}{path}"))
        .header(
            "cookie",
            format!("quantos_session={who}; quantos_csrf=csrf-token-0000000000000001"),
        )
        .header("origin", "http://localhost:3190")
        .header("x-csrf-token", "csrf-token-0000000000000001")
        .header("idempotency-key", key)
        .header("x-request-id", Uuid::new_v4().to_string());
    let r = if method == "GET" || path == "/v1/auth/logout" {
        r
    } else {
        r.json(&body)
    }
    .send()
    .unwrap();
    let code = r.status().as_u16();
    let v = if code == 204 {
        Value::Null
    } else {
        r.json().unwrap()
    };
    (code, v)
}
fn get(base: &str, path: &str) -> Value {
    let (s, v) = call(
        base,
        "session-current",
        "GET",
        path,
        json!({}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{path}: {v}");
    v
}
fn approve(base: &str, id: &str, slot: u8) {
    let who = if slot == 0 {
        "session-approver"
    } else {
        "session-owner"
    };
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
    let b = json!({"expectedRevision":slot,"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]});
    let key = Uuid::new_v4().to_string();
    let (s, v) = call(
        base,
        who,
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/approvals"),
        b.clone(),
        &key,
    );
    assert_eq!(s, 200, "{v}");
    let (s, replay) = call(
        base,
        who,
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/approvals"),
        b,
        &key,
    );
    assert_eq!(s, 200, "{replay}");
    assert_eq!(v, replay);
}
fn open(base: &str, subject: &Value) -> String {
    let (s, r) = call(
        base,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":subject["subjectId"]}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{r}");
    r["request"]["requestId"].as_str().unwrap().into()
}
#[test]
fn core_l04_public_mtls_restart_replica_c10_and_four_controlled_drills() {
    let lab = Lab::new();
    let (mut a, url) = lab.bff(true);
    let subjects = get(&url, "/v1/assisted-testnet/subjects");
    let before = fs::read(lab.directory.join("approvals.json")).unwrap();
    for path in [
        "/v1/session",
        "/v1/context",
        "/v1/assisted-testnet/capabilities",
    ] {
        get(&url, path);
    }
    assert_eq!(
        fs::read(lab.directory.join("approvals.json")).unwrap(),
        before,
        "pure reads rewrote current authority ledger"
    );

    // Remaining Ops mode refusal stays OPEN. Current native controls and C11
    // have their own positive/recovery tests; this probe does not grant them.
    let mut gap_probes = vec![];
    {
        let (method, path, body) = ("GET", "/v1/operations/health", json!({}));
        let (status, reply) = call(
            &url,
            "session-current",
            method,
            path,
            body,
            &Uuid::new_v4().to_string(),
        );
        assert_eq!(status, 403, "{path}: {reply}");
        assert_eq!(reply["code"], "CONTEXT_MODE_REQUIRED");
        gap_probes.push(json!({"method":method,"path":path,"status":status,"code":reply["code"],"interpretation":"OPEN_PRODUCT_JOIN_GAP_NOT_SUCCESSFUL_CONTROL"}));
    }
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    if let Ok(out) = std::env::var("QUANTOS_CORE_L4_GAP_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"profile":"CURRENT_OWNED_ASSISTED_LIVE","probes":gap_probes,"noZoneTraceDuringProbes":true,"publicNativeKillJoin":"CURRENT_CONTROL_TESTED_SEPARATELY","c11ActivationJoin":"CURRENT_ACTIVATION_TESTED_SEPARATELY","globalKillApiRepresentation":"CURRENT_CONTROL_TESTED_SEPARATELY","closureGranted":false,"actualTestnet":false})).unwrap());
    }
    let id = open(&url, &subjects["items"][0]);
    assert_ne!(
        fs::read(lab.directory.join("approvals.json")).unwrap(),
        before,
        "business write was not persisted"
    );
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    // Actual process death after approvals: recover original immutable source.
    a.0.kill().unwrap();
    a.0.wait().unwrap();
    let (_a, url) = lab.bff(true);
    let (_b, other) = lab.bff(true);
    let path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let key = Uuid::new_v4().to_string();
    let mut threads = vec![];
    for index in 0..12 {
        let endpoint = if index % 2 == 0 {
            url.clone()
        } else {
            other.clone()
        };
        let path = path.clone();
        let key = key.clone();
        threads.push(std::thread::spawn(move || {
            call(
                &endpoint,
                "session-current",
                "POST",
                &path,
                json!({"expectedRevision":2}),
                &key,
            )
        }));
    }
    let mut receipts = vec![];
    for t in threads {
        let (s, r) = t.join().unwrap();
        assert_eq!(s, 200, "{r}");
        assert_eq!(r["state"], "accepted", "{r}");
        assert_eq!(r["order"]["filledQuantity"], "1");
        receipts.push(r);
    }
    assert!(receipts.iter().all(|r| r == &receipts[0]));
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let view = get(&other, &format!("/v1/assisted-testnet/requests/{id}"));
    let facts = &view["facts"];
    assert_eq!(facts["commandId"], receipts[0]["commandId"]);
    assert_eq!(facts["subjectHash"], receipts[0]["subjectHash"]);
    assert_eq!(facts["consumerReady"], true);
    assert_eq!(facts["fills"].as_array().unwrap().len(), 1);
    assert_eq!(facts["fills"][0]["commandId"], facts["commandId"]);
    assert_eq!(facts["fills"][0]["orderId"], facts["order"]["orderId"]);
    assert_eq!(facts["fills"][0]["feeCurrency"], "USDT");
    let ledger = get(&other, "/v1/assisted-testnet/ledger");
    let reconciliation = get(&other, "/v1/assisted-testnet/reconciliation");
    assert_eq!(reconciliation["comparisonStatus"], "MATCHED_OBSERVATIONS");
    assert_eq!(reconciliation["fullBooksReady"], false);
    assert_eq!(reconciliation["dayCloseAllowed"], false);
    assert_eq!(reconciliation["executionAuthority"], false);
    assert_eq!(
        reconciliation["sourceBindings"][0]["sourceHash"],
        facts["sourceHash"]
    );
    assert_eq!(
        reconciliation["sourceBindings"][0]["ledgerEntryHash"],
        view["ledger"]["entryHash"]
    );
    assert_eq!(reconciliation["ledgerHash"], ledger["ledgerHash"]);
    assert_ne!(reconciliation["booksHash"], facts["sourceHash"]);
    assert_eq!(
        get(&url, "/v1/assisted-testnet/reconciliation"),
        reconciliation
    );
    if let Ok(out) = std::env::var("QUANTOS_CORE_X05_RECONCILIATION_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"view":reconciliation,"ledger":ledger,"nativeView":view,"checkpoint":owner_store(&lab,"reconciliation").lock().unwrap().read().unwrap().unwrap(),"observer":serde_json::from_slice::<Value>(&fs::read(lab.directory.join("observer.json")).unwrap()).unwrap(),"observerCertificate":fs::read_to_string(lab.directory.join("server.pem")).unwrap(),"protocolCalls":1,"readOnly":true,"actualTestnet":false})).unwrap());
    }
    let observer = fs::read(lab.directory.join("observer.json")).unwrap();
    let mut tampered: Value = serde_json::from_slice(&observer).unwrap();
    tampered["payload"]["records"][0]["response"]["fills"][0]["commission"] = json!("0.02");
    private_write(
        lab.directory.join("observer.json"),
        serde_json::to_vec(&tampered).unwrap(),
    );
    let unavailable = get(&other, "/v1/assisted-testnet/reconciliation");
    assert_eq!(unavailable["comparisonStatus"], "UNAVAILABLE");
    assert_eq!(unavailable["openAlertEvidenceCount"], 1);
    assert_eq!(
        get(&url, "/v1/assisted-testnet/reconciliation"),
        unavailable
    );
    let delivered = get(&other, "/v1/alerts");
    assert_eq!(delivered["items"].as_array().unwrap().len(), 1);
    let replicas = std::thread::scope(|scope| {
        (0..12)
            .map(|i| {
                let base = if i % 2 == 0 { &url } else { &other };
                scope.spawn(move || get(base, "/v1/alerts"))
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| t.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert!(replicas.iter().all(|v| v == &delivered));
    let alert = &delivered["items"][0];
    assert_eq!(alert["sourceEvidence"], unavailable["alertEvidence"][0]);
    assert_eq!(
        alert["sourceRef"],
        unavailable["alertEvidence"][0]["evidenceId"]
    );
    assert_eq!(alert["readOnly"], true);
    let alert_path = format!("/v1/alerts/{}", alert["id"].as_str().unwrap());
    assert_eq!(get(&url, &alert_path), *alert);
    let consumed = get(
        &url,
        &format!(
            "/v1/audit/evidence-chains/{}",
            alert["correlationId"].as_str().unwrap()
        ),
    );
    assert_eq!(consumed["items"].as_array().unwrap().len(), 1);
    assert_eq!(consumed["items"][0]["eventId"], alert["auditRef"]);
    assert_eq!(consumed["items"][0]["kind"], "assisted.x05_alert_consumed");
    for forbidden in [
        "/v1/alerts/subscriptions",
        "/v1/alerts/stream",
        "/v1/operations/health",
    ] {
        assert_ne!(
            call(&url, "session-current", "GET", forbidden, json!({}), "read").0,
            200
        );
    }
    for action in ["ack", "unack"] {
        assert_eq!(
            call(
                &url,
                "session-current",
                "POST",
                &format!("{alert_path}/{action}"),
                json!({}),
                "no-write"
            )
            .0,
            403
        );
    }
    assert_eq!(
        call(
            &url,
            "session-viewer",
            "GET",
            "/v1/alerts",
            json!({}),
            "viewer"
        )
        .0,
        403
    );
    assert_eq!(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/alerts?accountId=55555555-5555-4555-8555-555555555555",
            json!({}),
            "wrong"
        )
        .0,
        404
    );
    let (_off, off) = lab.bff(false);
    // A replica cannot rewrite the immutable C11 scope/target bootstrap by
    // changing its private startup flag. Drift refuses the whole transaction.
    for path in ["/v1/session", "/v1/alerts"] {
        assert_eq!(
            call(
                &off,
                "session-current",
                "GET",
                path,
                json!({}),
                "ceiling-drift"
            )
            .0,
            503
        );
    }
    private_write(lab.directory.join("observer.json"), &observer);
    let restored = get(&other, "/v1/assisted-testnet/reconciliation");
    assert_eq!(restored["comparisonStatus"], "MATCHED_OBSERVATIONS");
    assert_eq!(restored["openAlertEvidenceCount"], 1);
    assert_eq!(restored["alertEvidence"][0]["status"], "OPEN");
    let (_recon_restart, recon_restart) = lab.bff(true);
    assert_eq!(
        get(&recon_restart, "/v1/assisted-testnet/reconciliation"),
        restored
    );
    assert_eq!(get(&recon_restart, "/v1/alerts"), delivered);
    assert_eq!(
        get(
            &recon_restart,
            &format!(
                "/v1/audit/evidence-chains/{}",
                alert["correlationId"].as_str().unwrap()
            )
        ),
        consumed
    );
    // Simulate the synced-inbox / older approval-anchor crash window. A new
    // real BFF process must recover only the authenticated monotonic prefix.
    let approvals = owner_store(&lab, "approvals");
    let saved_approvals = approvals.lock().unwrap().read().unwrap().unwrap();
    let mut older_anchor = saved_approvals.clone();
    older_anchor["alertAnchor"] = json!({"sequence":0,"head":null});
    approvals.lock().unwrap().write(&older_anchor).unwrap();
    let (_ahead_restart, ahead_restart) = lab.bff(true);
    assert_eq!(get(&ahead_restart, "/v1/alerts"), delivered);
    approvals.lock().unwrap().write(&saved_approvals).unwrap();
    let alert_bytes = fs::read(lab.directory.join("alerts.json")).unwrap();
    private_write(lab.directory.join("alerts.json"), b"{broken");
    assert_eq!(
        call(
            &recon_restart,
            "session-current",
            "GET",
            "/v1/alerts",
            json!({}),
            "corrupt"
        )
        .0,
        503
    );
    private_write(lab.directory.join("alerts.json"), &alert_bytes);
    let store = owner_store(&lab, "alerts");
    let original = store.lock().unwrap().read().unwrap().unwrap();
    let mut rollback = original.clone();
    rollback["records"] = json!([]);
    rollback["anchor"] = json!({"sequence":0,"head":null});
    store.lock().unwrap().write(&rollback).unwrap();
    assert_eq!(
        call(
            &recon_restart,
            "session-current",
            "GET",
            "/v1/alerts",
            json!({}),
            "rollback"
        )
        .0,
        503
    );
    store.lock().unwrap().write(&original).unwrap();
    fs::remove_file(lab.directory.join("alerts.json")).unwrap();
    assert_eq!(
        call(
            &recon_restart,
            "session-current",
            "GET",
            "/v1/alerts",
            json!({}),
            "missing"
        )
        .0,
        503
    );
    private_write(lab.directory.join("alerts.json"), &alert_bytes);
    assert_eq!(get(&recon_restart, "/v1/alerts"), delivered);
    if let Ok(out) = std::env::var("QUANTOS_CORE_X06_ALERT_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"delivered":delivered,"source":unavailable,"recoveredSource":restored,"audit":consumed,"events":get(&recon_restart,&format!("/v1/audit/events?correlationId={}",alert["correlationId"].as_str().unwrap())),"checkpoint":original,"restarted":get(&recon_restart,"/v1/alerts"),"concurrentIngestionRequests":12,"authenticatedAheadAnchorRecovery":true,"noAutomaticClosure":true,"corruptMissingRollbackDenied":true,"unauthorizedAndMutationDenied":true,"nativeProtocolCalls":1,"actualTestnet":false})).unwrap());
    }
    let recon_bytes = fs::read(lab.directory.join("reconciliation.json")).unwrap();
    private_write(lab.directory.join("reconciliation.json"), b"{broken");
    assert_eq!(
        call(
            &recon_restart,
            "session-current",
            "GET",
            "/v1/assisted-testnet/reconciliation",
            json!({}),
            &Uuid::new_v4().to_string()
        )
        .0,
        503
    );
    private_write(lab.directory.join("reconciliation.json"), recon_bytes);
    if let Ok(out) = std::env::var("QUANTOS_CORE_X05_ALERT_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"unavailable":unavailable,"restored":restored,"restart":get(&recon_restart,"/v1/assisted-testnet/reconciliation"),"corruptStoreDenied":true,"automaticClosure":false,"actualTestnet":false})).unwrap());
    }
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quoteFeesTotal"], facts["fills"][0]["feeAmount"]);
    assert_eq!(ledger["positions"][0]["quantity"], "1");
    assert_eq!(ledger["consumerReady"], true);
    assert_eq!(ledger["valuationReady"], false);
    assert_eq!(ledger["entries"][0]["sourceHash"], facts["sourceHash"]);
    assert_eq!(ledger["entries"][0], view["ledger"]);
    let bytes = fs::read(lab.directory.join("portfolio.json")).unwrap();
    assert_eq!(get(&url, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(
        fs::read(lab.directory.join("portfolio.json")).unwrap(),
        bytes,
        "readonly replay rewrote ledger"
    );
    let (_ledger_restart, ledger_url) = lab.bff(true);
    assert_eq!(get(&ledger_url, "/v1/assisted-testnet/ledger"), ledger);
    // Anchor survives a new process, and current permissions/bytes are always checked.
    fs::remove_file(lab.directory.join("portfolio.json")).unwrap();
    assert_eq!(
        call(
            &ledger_url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/ledger",
            json!({}),
            &Uuid::new_v4().to_string()
        )
        .0,
        503
    );
    private_write(lab.directory.join("portfolio.json"), &bytes);
    let commands = fs::read(lab.directory.join("commands.json")).unwrap();
    fs::remove_file(lab.directory.join("commands.json")).unwrap();
    assert_eq!(
        call(
            &ledger_url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/ledger",
            json!({}),
            &Uuid::new_v4().to_string()
        )
        .0,
        503
    );
    private_write(lab.directory.join("commands.json"), &commands);
    // Even an owner-authenticated empty command checkpoint cannot orphan a
    // previously posted ledger. The ledger's own anchor/source checks still run.
    owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .write(&json!({"issued":{},"claims":{},"killed":false}))
        .unwrap();
    let (_source_missing, source_missing) = lab.bff(true);
    assert_eq!(
        call(
            &source_missing,
            "session-current",
            "GET",
            "/v1/assisted-testnet/ledger",
            json!({}),
            &Uuid::new_v4().to_string()
        )
        .0,
        503,
        "orphan ledger served without original native source"
    );
    private_write(lab.directory.join("commands.json"), commands);
    assert_eq!(get(&ledger_url, "/v1/assisted-testnet/ledger"), ledger);
    private_write(lab.directory.join("portfolio.json"), b"{broken");
    assert_eq!(
        call(
            &ledger_url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/ledger",
            json!({}),
            &Uuid::new_v4().to_string()
        )
        .0,
        503
    );
    private_write(lab.directory.join("portfolio.json"), &bytes);
    let next = open(&url, &subjects["items"][1]);
    approve(&url, &next, 0);
    approve(&url, &next, 1);
    assert_eq!(
        call(
            &url,
            "session-current",
            "POST",
            &format!("/v1/assisted-testnet/requests/{next}/commands"),
            json!({"expectedRevision":2}),
            &Uuid::new_v4().to_string()
        )
        .0,
        409,
        "new IO used pre-fill risk review"
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    if let Ok(out) = std::env::var("QUANTOS_CORE_X01_LEDGER_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"ledger":ledger,"checkpoint":portfolio_checkpoint(&lab),"view":view,"restartLedger":get(&ledger_url,"/v1/assisted-testnet/ledger"),"nativeProtocolCalls":1,"replicaRequests":12,"unchangedLedgerOnRead":true,"missingOrCorruptLedgerDenied":true,"staleReviewNewCommandDenied":true,"actualTestnet":false})).unwrap());
    }
    assert_eq!(
        get(&url, &format!("/v1/assisted-testnet/requests/{id}"))["facts"],
        *facts
    );
    let chain = get(&other, &format!("/v1/audit/evidence-chains/{id}"));
    let nodes = chain["items"].as_array().unwrap();
    assert_eq!(nodes.len(), 5, "{chain}");
    assert!(
        nodes
            .iter()
            .all(|n| n["route"] == format!("/orders?approvalId={id}")),
        "invalid Orders route: {chain}"
    );
    for node in nodes {
        let event = Uuid::parse_str(node["eventId"].as_str().unwrap()).unwrap();
        assert_eq!(event.get_version_num(), 8);
        assert_eq!(event.get_variant(), uuid::Variant::RFC4122);
    }
    assert_eq!(nodes[3]["kind"], "assisted.command_reserved");
    assert_eq!(nodes[4]["kind"], "assisted.command_accepted");
    for pair in nodes.windows(2) {
        assert_eq!(pair[1]["causationId"], pair[0]["eventId"]);
    }
    let events = get(&url, &format!("/v1/audit/events?correlationId={id}"));
    let source = &events["items"][0]["redactedPayload"]["source"];
    assert_eq!(source["decisionPurpose"], "assisted_testnet_review");
    assert_eq!(source["killGeneration"], 0);
    assert_eq!(source["executionAuthority"], false);
    assert_eq!(
        source["proposalRecordHash"],
        events["items"][0]["redactedPayload"]["proposalHash"]
    );
    assert_eq!(
        source["decisionId"],
        events["items"][0]["redactedPayload"]["decisionId"]
    );
    assert_eq!(source["decisionSignature"].as_str().unwrap().len(), 64);

    assert_eq!(events["items"].as_array().unwrap().len(), 5);
    assert_eq!(
        events["items"][4]["redactedPayload"]["commandId"],
        receipts[0]["commandId"]
    );
    let completion = events["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|event| event["kind"] == "assisted.command_accepted")
        .unwrap();
    assert_eq!(
        completion["redactedPayload"]["executionFactsHash"],
        facts["sourceHash"]
    );
    assert_eq!(
        completion["redactedPayload"]["fillIds"][0],
        facts["fills"][0]["fillId"]
    );
    if let Ok(out) = std::env::var("QUANTOS_CORE_X04_FACTS_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"view":view,"context":get(&other,"/v1/context"),"events":events,"chain":chain,"nativeProtocolCalls":1,"replicaRequests":12,"actualTestnet":false})).unwrap());
    }
    if let Ok(out) = std::env::var("QUANTOS_CORE_L04_C10_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"events":events,"chain":chain})).unwrap());
    }
    let (s, _) = call(
        &url,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 409);
    // Private startup ceiling drift must not replace persisted C11 or permit replay.
    let (_off, off) = lab.bff(false);
    let (s, _) = call(
        &off,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &key,
    );
    assert_eq!(s, 503);
    l4_controls::accepted_join(&lab, &url, &id, &view, &ledger, &events);
    // A separate original ledger has no preceding trade/review fence. Exercise
    // actual engine death, then preserve its unknown command across restart.
    let lab = Lab::new();
    let (_isolated, url) = lab.bff(true);
    let subjects = get(&url, "/v1/assisted-testnet/subjects");
    let unknown = open(&url, &subjects["items"][1]);
    approve(&url, &unknown, 0);
    approve(&url, &unknown, 1);
    // Process kill uses the real child PID; no simulated transport result.
    let status = Command::new("kill")
        .args(["-TERM", &lab.zone.0.id().to_string()])
        .status()
        .unwrap();
    assert!(status.success());
    let path2 = format!("/v1/assisted-testnet/requests/{unknown}/commands");
    let key2 = Uuid::new_v4().to_string();
    let (s, u) = call(
        &url,
        "session-current",
        "POST",
        &path2,
        json!({"expectedRevision":2}),
        &key2,
    );
    assert_eq!(s, 200, "{u}");
    assert_eq!(u["state"], "unknown");
    let (_restart, restarted) = lab.bff(true);
    let (s, recovered) = call(
        &restarted,
        "session-current",
        "POST",
        &path2,
        json!({"expectedRevision":2}),
        &key2,
    );
    assert_eq!(s, 200, "{recovered}");
    assert_eq!(recovered, u);
    let unknown_chain = get(&restarted, &format!("/v1/audit/evidence-chains/{unknown}"));
    assert_eq!(
        unknown_chain["items"][4]["kind"],
        "assisted.command_unknown"
    );
    // Tampered/truncated checkpoint denies reads and writes, never boots empty.
    private_write(lab.directory.join("commands.json"), b"{broken");
    let (s, _) = call(
        &restarted,
        "session-current",
        "POST",
        &path2,
        json!({"expectedRevision":2}),
        &key2,
    );
    assert_eq!(s, 503);
    private_write(lab.directory.join("approvals.json"), b"{broken");
    for path in [
        "/v1/session",
        "/v1/context",
        "/v1/assisted-testnet/capabilities",
    ] {
        let (status, _) = call(
            &restarted,
            "session-current",
            "GET",
            path,
            json!({}),
            &Uuid::new_v4().to_string(),
        );
        assert_eq!(
            status, 503,
            "warm authority cache masked corrupt current store"
        );
    }
    if let Ok(out) = std::env::var("QUANTOS_CORE_L04_RESULT") {
        fs::write(out,serde_json::to_vec_pretty(&json!({"schema":"quantos-core-l04-local/v1","sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"sameSource":true,"mutualTls":true,"realBffProcesses":true,"replicaRequests":12,"nativeProtocolCalls":1,"commonC10Nodes":5,"unknownNotReissued":true,"fourDrills":["replay","process-recovery","engine-fault","kill-switch"],"corruptStoreDenied":true,"actualTestnetConnected":false,"gate":"NOT_READY_GAPS_OPEN","runtimeAdmission":"DENIED"})).unwrap()).unwrap();
    }
}

#[test]
fn core_l04_crash_after_zone_commit_recovers_unknown_without_resubmit() {
    let lab = Lab::configured(true);
    let (mut process, url) = lab.bff(true);
    let subjects = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &subjects["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let key = Uuid::new_v4().to_string();
    let path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let url2 = url.clone();
    let path2 = path.clone();
    let key2 = key.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(5))
            .build()
            .unwrap()
            .post(format!("{url2}{path2}"))
            .header(
                "cookie",
                "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
            )
            .header("origin", "http://localhost:3190")
            .header("x-csrf-token", "csrf-token-0000000000000001")
            .header("x-request-id", Uuid::new_v4().to_string())
            .header("idempotency-key", key2)
            .json(&json!({"expectedRevision":2}))
            .send()
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 1);
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let (_restart, restarted) = lab.bff(true);
    let (s, recovered) = call(
        &restarted,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &key,
    );
    assert_eq!(s, 200, "{recovered}");
    assert_eq!(recovered["state"], "unknown");
    assert!(recovered.get("order").is_none());
    let ledger = get(&restarted, "/v1/assisted-testnet/ledger");
    let reconciliation = get(&restarted, "/v1/assisted-testnet/reconciliation");
    assert_eq!(reconciliation["unknownObligationsOpen"], 1);
    assert_eq!(reconciliation["comparisonStatus"], "DIFFERENCES");
    assert_eq!(reconciliation["fullBooksReady"], false);
    assert!(
        reconciliation["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["kind"] == "OUTCOME_UNRESOLVED")
    );
    assert!(
        reconciliation["findings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["kind"] == "QUARANTINED_BOOK_OBSERVATION"
                && f["observed"]["executedQuantity"] == "1")
    );
    if let Ok(out) = std::env::var("QUANTOS_CORE_X05_UNKNOWN_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"view":reconciliation,"ledger":ledger,"checkpoint":owner_store(&lab,"reconciliation").lock().unwrap().read().unwrap().unwrap(),"observer":serde_json::from_slice::<Value>(&fs::read(lab.directory.join("observer.json")).unwrap()).unwrap(),"observerCertificate":fs::read_to_string(lab.directory.join("server.pem")).unwrap(),"protocolCalls":1,"noReplay":true,"actualTestnet":false})).unwrap());
    }
    assert_eq!(ledger["consumerReady"], false);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    assert_eq!(ledger["appliedFillCount"], 0);
    assert_eq!(ledger["entries"][0]["reason"], "OUTCOME_UNRESOLVED");
    let (_again, again) = lab.bff(true);
    assert_eq!(get(&again, "/v1/assisted-testnet/ledger"), ledger);
    if let Ok(out) = std::env::var("QUANTOS_CORE_X01_UNKNOWN_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"ledger":ledger,"checkpoint":portfolio_checkpoint(&lab),"command":recovered,"nativeProtocolCalls":1,"restartPreserved":true,"noReplayTrace":true,"actualTestnet":false})).unwrap());
    }
    let delivered = get(&restarted, "/v1/alerts");
    assert_eq!(
        delivered["items"].as_array().unwrap().len(),
        reconciliation["alertEvidence"].as_array().unwrap().len()
    );
    for a in delivered["items"].as_array().unwrap() {
        assert_eq!(a["resolved"], false);
        assert_eq!(a["sourceEvidence"]["status"], "OPEN");
        assert_eq!(a["correlationId"], id);
    }
    let first = get(&restarted, "/v1/alerts?pageSize=1&sort=id:asc");
    assert_eq!(first["items"].as_array().unwrap().len(), 1);
    let cursor = first["nextCursor"].as_str().unwrap();
    let next = get(
        &restarted,
        &format!("/v1/alerts?pageSize=1&sort=id:asc&cursor={cursor}"),
    );
    assert_ne!(first["items"][0]["id"], next["items"][0]["id"]);
    assert_eq!(
        call(
            &restarted,
            "session-owner",
            "GET",
            &format!("/v1/alerts?pageSize=1&sort=id:asc&cursor={cursor}"),
            json!({}),
            "cross"
        )
        .0,
        409
    );
    assert_eq!(get(&again, "/v1/alerts"), delivered);
    assert_eq!(get(&again, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let chain = get(&restarted, &format!("/v1/audit/evidence-chains/{id}"));
    assert_eq!(
        chain["items"].as_array().unwrap().len(),
        4 + delivered["items"].as_array().unwrap().len()
    );
    assert_eq!(chain["items"][3]["kind"], "assisted.command_reserved");
    for a in delivered["items"].as_array().unwrap() {
        assert!(
            chain["items"].as_array().unwrap().iter().any(
                |n| n["eventId"] == a["auditRef"] && n["kind"] == "assisted.x05_alert_consumed"
            )
        );
    }
    if let Ok(out) = std::env::var("QUANTOS_CORE_X06_UNKNOWN_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"delivered":delivered,"source":reconciliation,"ledger":ledger,"audit":chain,"events":get(&again,&format!("/v1/audit/events?correlationId={id}")),"checkpoint":owner_store(&lab,"alerts").lock().unwrap().read().unwrap().unwrap(),"restart":get(&again,"/v1/alerts"),"paginationScopeDenied":true,"protocolCalls":1,"noReplay":true,"actualTestnet":false})).unwrap());
    }

    if let Ok(out) = std::env::var("QUANTOS_CORE_L04_CRASH_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"zoneProtocolCallsBeforeKill":1,"callerObservedResponseLoss":true,"recoveredState":recovered["state"],"recoveredOrderAbsent":true,"commonC10ReservationNodes":4,"noReplayTrace":true,"actualTestnetConnected":false})).unwrap());
    }
    // The single original completion trace was consumed above.
    c11_activation::unknown_current_c11(&lab, &restarted, &recovered);
    valuation::unknown(&lab, &restarted, &recovered);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
}

#[test]
fn core_l04_logout_survives_process_recovery_and_denies_c10_and_native() {
    let lab = Lab::new();
    let (mut first, url) = lab.bff(true);
    let subjects = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &subjects["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let (s, _) = call(
        &url,
        "session-current",
        "POST",
        "/v1/auth/logout",
        json!({}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 204);
    first.0.kill().unwrap();
    first.0.wait().unwrap();
    let (_restart, restarted) = lab.bff(true);
    for path in [
        format!("/v1/audit/evidence-chains/{id}"),
        "/v1/audit/events".into(),
        "/v1/session".into(),
        "/v1/assisted-testnet/ledger".into(),
        "/v1/assisted-testnet/reconciliation".into(),
        "/v1/alerts".into(),
    ] {
        let (s, _) = call(
            &restarted,
            "session-current",
            "GET",
            &path,
            json!({}),
            &Uuid::new_v4().to_string(),
        );
        assert_eq!(s, 401);
    }
    let (s, _) = call(
        &restarted,
        "session-current",
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/commands"),
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 401);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
}

#[path = "support/native_control.rs"]
mod native_control;

#[path = "support/c11_activation.rs"]
mod c11_activation;

#[path = "support/l4_controls.rs"]
mod l4_controls;

#[path = "support/valuation.rs"]
mod valuation;

#[path = "support/account_books.rs"]
mod account_books;
#[path = "support/current_execution.rs"]
mod current_execution;
#[path = "support/current_gate.rs"]
mod current_gate;
#[path = "support/risk_refresh.rs"]
mod risk_refresh;

#[path = "support/account_books_gate.rs"]
mod account_books_gate;
#[path = "support/books_risk.rs"]
mod books_risk;
#[path = "support/books_risk_legacy.rs"]
mod books_risk_legacy;
#[path = "support/financial_review.rs"]
mod financial_review;
#[path = "support/financial_review_gate.rs"]
mod financial_review_gate;
