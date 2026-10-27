use reqwest::blocking::Client;
use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};
struct Peer {
    child: Child,
    client: Client,
    base: String,
    subjects: Vec<String>,
    negative: Value,
}
impl Drop for Peer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
impl Peer {
    fn start(enabled: bool) -> Self {
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
        let exe = std::env::var("QUANTOS_SERVICE_L03_EXECUTABLE")
            .unwrap_or_else(|_| env!("CARGO_BIN_EXE_execution-gateway").into());
        let mut child = Command::new(exe)
            .arg("--service-l03-owned-fixture")
            .arg(if enabled { "owned-enabled" } else { "off" })
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let out = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines() {
                let Ok(line) = line else { break };
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        let first = rx.recv_timeout(Duration::from_secs(5)).unwrap();
        let ready: Value = serde_json::from_str(first.strip_prefix("L03_READY=").unwrap()).unwrap();
        assert_eq!(ready["pid"].as_u64(), Some(child.id() as u64));
        assert_eq!(ready["backend"], "OWNED_SERVICE_L03_HTTP");
        assert_eq!(ready["enabled"], enabled);
        let base = format!("http://{}", ready["address"].as_str().unwrap());
        assert!(base.starts_with("http://127.0.0.1:"));
        let subjects = ready["subjects"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| s.as_str().unwrap().into())
            .collect();
        Self {
            child,
            client: Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(3))
                .build()
                .unwrap(),
            base,
            subjects,
            negative: ready["negativeSubjects"].clone(),
        }
    }
    fn call(
        &self,
        method: &str,
        path: &str,
        actor: &str,
        key: &str,
        body: Option<Value>,
    ) -> (u16, Value) {
        let mut req = self
            .client
            .request(method.parse().unwrap(), format!("{}{path}", self.base))
            .bearer_auth(actor)
            .header("idempotency-key", key);
        if let Some(b) = body {
            req = req.json(&b);
        }
        let r = req.send().unwrap();
        let status = r.status().as_u16();
        let body = r.json().unwrap();
        (status, body)
    }
    fn proof(&self, actor: &str, id: &str) -> Value {
        let (s, v) = self.call(
            "POST",
            &format!("/_owned/step-up/{id}"),
            actor,
            "unused",
            None,
        );
        assert_eq!(s, 200, "{v}");
        v
    }
    fn open(&self, index: usize) -> Value {
        let (s, v) = self.call(
            "POST",
            "/v1/assisted-testnet/approval-requests",
            "operator",
            &format!("open-{index}"),
            Some(json!({"subjectId":self.subjects[index]})),
        );
        assert_eq!(s, 200, "{v}");
        v["receipt"].clone()
    }
    fn summary(&self) -> Value {
        let (s, v) = self.call("GET", "/_owned/summary", "owner", "unused", None);
        assert_eq!(s, 200);
        v
    }
}
#[test]
fn service_l03_default_off_refuses_fifty_actual_http_attempts_and_injected_claims() {
    let p = Peer::start(false);
    let mut rows = vec![];
    let id = uuid::Uuid::new_v4();
    for i in 0..50 {
        let (path, method) = match i % 5 {
            0 => ("/v1/assisted-testnet/approval-requests".to_string(), "POST"),
            1 => (
                format!("/v1/assisted-testnet/approval-requests/{id}"),
                "GET",
            ),
            2 => (
                format!("/v1/assisted-testnet/approval-requests/{id}/challenges"),
                "POST",
            ),
            3 => (
                format!("/v1/assisted-testnet/approval-requests/{id}/approvals"),
                "POST",
            ),
            _ => (
                format!("/v1/assisted-testnet/approval-requests/{id}/audit"),
                "GET",
            ),
        };
        let r = p
            .client
            .request(method.parse().unwrap(), format!("{}{path}", p.base))
            .bearer_auth(if i % 2 == 0 { "owner" } else { "operator" })
            .header("x-assisted-live-enabled", "true")
            .header("x-role", "owner")
            .header("x-capabilities", "execution.assisted_testnet")
            .body("{\"enabled\":true,\"mfa\":\"mfa-forged\"}")
            .send()
            .unwrap();
        assert_eq!(r.status().as_u16(), 403);
        let v: Value = r.json().unwrap();
        assert_eq!(v["error"]["code"], "ASSISTED_TESTNET_DISABLED");
        rows.push(
            json!({"case":i,"method":method,"status":403,"code":"ASSISTED_TESTNET_DISABLED"}),
        );
    }
    let (_, cap) = p.call(
        "GET",
        "/v1/assisted-testnet/capabilities",
        "owner",
        "none",
        None,
    );
    assert_eq!(cap["approve"], false);
    assert_eq!(cap["executionAuthority"], false);
    let summary = p.summary();
    assert_eq!(summary["audit"].as_array().unwrap().len(), 0);
    assert_eq!(summary["ordersIssued"], 0);
    if let Ok(path) = std::env::var("QUANTOS_SERVICE_L03_OFF") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-service-l03-off/v1","scope":"ACTUAL_OWNED_LOOPBACK_HTTP_NOT_PUBLIC_BFF","attempts":rows,"auditEntries":0,"ordersIssued":0,"advertisedApprove":false,"productionCredentialsUsed":false,"childEnvironmentCleared":true})).unwrap()).unwrap();
    }
}
#[test]
fn service_l03_fifty_http_dual_approvals_and_dropped_response_recovery() {
    let p = Peer::start(true);
    let mut rows = vec![];
    assert_eq!(p.subjects.len(), 50);
    for i in 0..50 {
        let r = p.open(i);
        let id = r["request"].as_str().unwrap();
        let a = p.proof("first", id);
        let b = p.proof("second", id);
        let path = format!("/v1/assisted-testnet/approval-requests/{id}/approvals");
        let firstbody = json!({"expectedRevision":0,"proof":a});
        if i == 0 {
            let lost = p
                .client
                .post(format!("{}{path}", p.base))
                .bearer_auth("first")
                .header("idempotency-key", format!("first-{i}"))
                .json(&firstbody)
                .send()
                .unwrap();
            assert_eq!(lost.status().as_u16(), 200);
            drop(lost);
        }
        let (s, one) = p.call(
            "POST",
            &path,
            "first",
            &format!("first-{i}"),
            Some(firstbody),
        );
        assert_eq!(s, 200, "{one}");
        assert_eq!(one["receipt"]["status"], "awaiting_second");
        if i == 0 {
            assert_eq!(one["replayed"], true);
        }
        let body = json!({"expectedRevision":1,"proof":b});
        let (s, two) = p.call(
            "POST",
            &path,
            "second",
            &format!("second-{i}"),
            Some(body.clone()),
        );
        assert_eq!(s, 200, "{two}");
        assert_eq!(two["receipt"]["status"], "approved");
        assert_eq!(two["receipt"]["execution_authority"], false);
        let (s, repeat) = p.call("POST", &path, "second", &format!("second-{i}"), Some(body));
        assert_eq!(s, 200);
        assert_eq!(repeat["replayed"], true);
        assert_eq!(repeat["receipt"], two["receipt"]);
        let (s, read) = p.call(
            "GET",
            &format!("/v1/assisted-testnet/approval-requests/{id}"),
            "operator",
            "unused",
            None,
        );
        assert_eq!(s, 200);
        assert_eq!(read, two["receipt"]);
        let (s, audit) = p.call(
            "GET",
            &format!("/v1/assisted-testnet/approval-requests/{id}/audit"),
            "operator",
            "unused",
            None,
        );
        assert_eq!(s, 200);
        assert_eq!(audit["entries"].as_array().unwrap().len(), 2);
        rows.push(json!({"case":i,"request":id,"subjectHash":r["subject_hash"],"status":"approved","revision":2,"approvers":2,"auditEntries":2,"sameBodyReplay":true,"executionAuthority":false}));
    }
    let summary = p.summary();
    assert_eq!(summary["audit"].as_array().unwrap().len(), 100);
    assert_eq!(summary["anchor"]["count"], 100);
    assert_eq!(summary["auditVerified"], true);
    assert_eq!(summary["ordersIssued"], 0);
    if let Ok(path) = std::env::var("QUANTOS_SERVICE_L03_HTTP") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-service-l03-http/v1","scope":"ACTUAL_OWNED_HTTP_WITH_KEYED_SYNTHETIC_MFA_PORT_NOT_PUBLIC_BFF_OR_TRADING","cases":rows,"summary":summary,"droppedFirstResponseRecovered":true,"sameKeyExtraAuditEntries":0,"productionCredentialsUsed":false,"childEnvironmentCleared":true})).unwrap()).unwrap();
    }
}
#[test]
fn service_l03_http_permission_mfa_caps_subject_binding_and_expiry_refuse_atomically() {
    let p = Peer::start(true);
    let mut outcomes = vec![];
    for actor in ["viewer", "unknown"] {
        let (s, _) = p.call(
            "POST",
            "/v1/assisted-testnet/approval-requests",
            actor,
            "bad",
            Some(json!({"subjectId":p.subjects[0]})),
        );
        assert_eq!(s, 403);
        outcomes.push(json!({"id":format!("role-{actor}"),"status":s}));
    }
    for (kind, id) in p.negative.as_object().unwrap() {
        let (s, _) = p.call(
            "POST",
            "/v1/assisted-testnet/approval-requests",
            "operator",
            kind,
            Some(json!({"subjectId":id})),
        );
        assert_eq!(s, 422);
        outcomes.push(json!({"id":kind,"status":s}));
    }
    let (s, _) = p.call(
        "POST",
        "/v1/assisted-testnet/approval-requests",
        "operator",
        "injected",
        Some(json!({"subjectId":p.subjects[0],"notional":"0","actor":"owner","enabled":true})),
    );
    assert_eq!(s, 422);
    outcomes.push(json!({"id":"injected-body-authority","status":s}));
    let r = p.open(0);
    let id = r["request"].as_str().unwrap();
    let (s, _) = p.call(
        "POST",
        &format!("/v1/assisted-testnet/approval-requests/{id}/challenges"),
        "operator",
        "self",
        None,
    );
    assert_eq!(s, 403);
    outcomes.push(json!({"id":"originator-cannot-approve","status":s}));
    let mut a = p.proof("first", id);
    let b = p.proof("second", id);
    let original = a.clone();
    a["signature"] = json!("mfa-prefix-is-not-proof");
    let path = format!("/v1/assisted-testnet/approval-requests/{id}/approvals");
    let (s, _) = p.call(
        "POST",
        &path,
        "first",
        "forged",
        Some(json!({"expectedRevision":0,"proof":a})),
    );
    assert_eq!(s, 403);
    assert_eq!(p.summary()["audit"].as_array().unwrap().len(), 0);
    outcomes.push(json!({"id":"forged-mfa-prefix","status":s}));
    let (s, _) = p.call(
        "POST",
        &path,
        "first",
        "valid-first",
        Some(json!({"expectedRevision":0,"proof":original})),
    );
    assert_eq!(s, 200);
    let (s, _) = p.call(
        "POST",
        "/_owned/advance",
        "owner",
        "clock",
        Some(json!({"seconds":120})),
    );
    assert_eq!(s, 200);
    let (s, _) = p.call(
        "POST",
        &path,
        "second",
        "expired",
        Some(json!({"expectedRevision":1,"proof":b})),
    );
    assert_eq!(s, 410);
    outcomes.push(json!({"id":"mfa-and-approval-deadline","status":s}));
    assert_eq!(p.summary()["audit"].as_array().unwrap().len(), 1);
    if let Ok(path) = std::env::var("QUANTOS_SERVICE_L03_REFUSALS") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-service-l03-refusals/v1","scope":"ACTUAL_OWNED_HTTP_CURRENT_CHECKS","cases":outcomes,"retainedFirstAudit":1,"invalidSecondAudit":0,"ordersIssued":0,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
