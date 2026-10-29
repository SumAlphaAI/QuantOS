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
    net::TcpListener,
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
impl Lab {
    fn new() -> Self {
        Self::configured(false)
    }
    fn configured(pause: bool) -> Self {
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
        private_write(directory.join("config.json"),serde_json::to_vec(&json!({"account":"44444444-4444-4444-8444-444444444444","now":at,"rotation":false,"schedule":[],"wallClock":true,"pauseReplyAtRequest":if pause{1}else{0}})).unwrap());
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
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        drop(listener);
        let mut child = Process(
            Command::new(env!("CARGO_BIN_EXE_bff-gateway"))
                .env_clear()
                .env("PATH", std::env::var("PATH").unwrap())
                .env("TMPDIR", std::env::temp_dir())
                .env("QUANTOS_BFF_BIND", address.to_string())
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
        let ready: Value =
            serde_json::from_str(&rx.recv_timeout(Wait::from_secs(15)).unwrap()).unwrap();
        assert_eq!(ready["ready"], true);
        (child, format!("http://{address}"))
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
    assert_eq!(s, 200, "{v}");
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
    // Current permission off is a kill/refusal, not permission to replay.
    let (_off, off) = lab.bff(false);
    let (s, _) = call(
        &off,
        "session-current",
        "POST",
        &path,
        json!({"expectedRevision":2}),
        &key,
    );
    assert_eq!(s, 403);
    // Engine/zone death: keep the reservation unknown, never retry on restart.
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
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let chain = get(&restarted, &format!("/v1/audit/evidence-chains/{id}"));
    assert_eq!(chain["items"].as_array().unwrap().len(), 4);
    assert_eq!(chain["items"][3]["kind"], "assisted.command_reserved");
    if let Ok(out) = std::env::var("QUANTOS_CORE_L04_CRASH_RESULT") {
        private_write(out,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"zoneProtocolCallsBeforeKill":1,"callerObservedResponseLoss":true,"recoveredState":recovered["state"],"recoveredOrderAbsent":true,"commonC10ReservationNodes":4,"noReplayTrace":true,"actualTestnetConnected":false})).unwrap());
    }
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
