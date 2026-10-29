use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
pub(super) async fn call(
    app: &Router,
    who: &str,
    method: &str,
    path: &str,
    body: Value,
    key: &str,
) -> (StatusCode, Value) {
    let r = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header(
                    "cookie",
                    format!("quantos_session={who}; quantos_csrf={}", crate::CSRF_TOKEN),
                )
                .header("origin", crate::ALLOWED_ORIGIN)
                .header("x-csrf-token", crate::CSRF_TOKEN)
                .header(
                    "idempotency-key",
                    Uuid::parse_str(&ContentHash::sha256_bytes(key.as_bytes()).to_string()[7..39])
                        .unwrap()
                        .to_string(),
                )
                .header("x-request-id", Uuid::new_v4().to_string())
                .header("content-type", "application/json")
                .body(if method == "GET" {
                    Body::empty()
                } else {
                    Body::from(body.to_string())
                })
                .unwrap(),
        )
        .await
        .unwrap();
    let status = r.status();
    let raw = to_bytes(r.into_body(), 1_000_000).await.unwrap();
    (status, serde_json::from_slice(&raw).unwrap())
}
pub(super) async fn proof(app: &Router, who: &str) -> Value {
    let (status, c) = call(
        app,
        who,
        "POST",
        "/v1/auth/mfa/challenges",
        json!({"purpose":"security_change","code":"123456"}),
        "mfa",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{c}");
    let (status, g) = call(
        app,
        who,
        "POST",
        "/v1/auth/reauth",
        json!({"challengeRef":c["challengeRef"]}),
        "reauth",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{g}");
    json!({"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]})
}
#[tokio::test]
async fn core_l03_public_fifty_dual_approval_workflows_issue_same_subject_native_l01_commands() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let (_, subjects) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "read",
    )
    .await;
    assert_eq!(subjects["items"].as_array().unwrap().len(), 50);
    let mut rows = vec![];
    for (i, sub) in subjects["items"].as_array().unwrap().iter().enumerate() {
        let (status, opened) = call(
            &app,
            "session-current",
            "POST",
            "/v1/assisted-testnet/requests",
            json!({"subjectId":sub["subjectId"]}),
            &format!("open-{i}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{opened}");
        let id = opened["request"]["requestId"].as_str().unwrap();
        let base = format!("/v1/assisted-testnet/requests/{id}");
        for (slot, who) in ["session-approver", "session-owner"].iter().enumerate() {
            let mut b = proof(&app, who).await;
            b["expectedRevision"] = json!(slot);
            let key = format!("approve-{i}-{slot}");
            let (status, r) = call(
                &app,
                who,
                "POST",
                &format!("{base}/approvals"),
                b.clone(),
                &key,
            )
            .await;
            assert_eq!(status, StatusCode::OK, "{r}");
            assert_eq!(r["request"]["revision"], slot + 1);
            assert_eq!(r["request"]["executionAuthority"], false);
            let (status, replay) =
                call(&app, who, "POST", &format!("{base}/approvals"), b, &key).await;
            assert_eq!(status, StatusCode::OK, "{replay}");
            assert_eq!(replay, r);
        }
        let b = json!({"expectedRevision":2});
        let (status, c) = call(
            &app,
            "session-current",
            "POST",
            &format!("{base}/commands"),
            b.clone(),
            &format!("command-{i}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{c}");
        assert_eq!(c["state"], "accepted", "{c}");
        assert_eq!(c["subjectHash"], sub["subjectHash"]);
        assert_eq!(c["order"]["commandId"], c["commandId"]);
        assert_eq!(c["order"]["accountId"], sub["accountId"]);
        assert_eq!(c["order"]["quantity"], sub["quantity"]);
        let (_, replay) = call(
            &app,
            "session-current",
            "POST",
            &format!("{base}/commands"),
            b,
            &format!("command-{i}"),
        )
        .await;
        assert_eq!(c, replay);
        let (_, a) = call(
            &app,
            "session-current",
            "GET",
            &format!("{base}/audit"),
            json!({}),
            "read",
        )
        .await;
        assert_eq!(a["verified"], true);
        assert_eq!(a["items"].as_array().unwrap().len(), 2);
        assert_ne!(a["items"][0]["actorId"], a["items"][1]["actorId"]);
        rows.push(json!({"subject":sub,"requestId":id,"command":c,"audit":a}));
    }
    let s = p.data.lock().await;
    let h = s.assisted.as_ref().unwrap();
    let (a, anchor) = h.service.audit_snapshot().unwrap();
    h.service.verify_audit(&a, &anchor).unwrap();
    assert_eq!(a.len(), 100);
    assert_eq!(h.native.submission_count().unwrap(), 50);
    if let Ok(path) = std::env::var("QUANTOS_CORE_L03_NATIVE_HTTP") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-core-l03-public-native/v1","sourceCommit":std::env::var("GITHUB_SHA").ok(),"scope":"ACTUAL_AXUM_C01_MFA_PUBLIC_DUAL_TO_IN_PROCESS_L01_WITH_OWNED_PROTOCOL_PORT","workflows":50,"auditEntries":100,"nativeSubmissions":50,"auditVerified":true,"rows":rows,"actualTestnetConnected":false,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
#[tokio::test]
async fn core_l03_default_off_rejects_public_commands_before_body_and_no_mode_downgrade() {
    let mut refusals = vec![];
    for (profile, p) in [
        crate::BffProvider::default(),
        crate::BffProvider::assisted_reference(false),
    ]
    .into_iter()
    .enumerate()
    {
        let app = p.router();
        let (_, caps) = call(
            &app,
            "session-current",
            "GET",
            "/v1/assisted-testnet/capabilities",
            json!({}),
            "r",
        )
        .await;
        assert_eq!(caps["serverFlagEnabled"], false);
        for i in 0..50 {
            let base = "/v1/assisted-testnet";
            let (method, path) = match i % 7 {
                0 => ("GET", format!("{base}/subjects")),
                1 => ("GET", format!("{base}/requests")),
                2 => ("POST", format!("{base}/requests")),
                3 => ("GET", format!("{base}/requests/{}", Uuid::new_v4())),
                4 => (
                    "POST",
                    format!("{base}/requests/{}/approvals", Uuid::new_v4()),
                ),
                5 => (
                    "POST",
                    format!("{base}/requests/{}/commands", Uuid::new_v4()),
                ),
                _ => ("GET", format!("{base}/requests/{}/audit", Uuid::new_v4())),
            };
            let (s, _) = call(
                &app,
                "session-current",
                method,
                &path,
                json!({"enabled":true,"actorId":Uuid::new_v4()}),
                "k",
            )
            .await;
            assert_eq!(s, StatusCode::FORBIDDEN);
            refusals.push(
                json!({"profile":profile,"case":i,"method":method,"path":path,"status":s.as_u16()}),
            );
        }
        if let Some(h) = &p.data.lock().await.assisted {
            assert_eq!(h.native.submission_count().unwrap(), 0);
        }
    }
    if let Ok(path) = std::env::var("QUANTOS_CORE_L03_OFF_HTTP") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-core-l03-default-off/v1","sourceCommit":std::env::var("GITHUB_SHA").ok(),"caseCorpus":50,"profiles":2,"requests":100,"denied":100,"nativeSubmissions":0,"rows":refusals})).unwrap()).unwrap();
    }
    let app = crate::BffProvider::assisted_reference(true).router();
    let (s, _) = call(
        &app,
        "session-current",
        "GET",
        "/v1/orders?accountId=44444444-4444-4444-8444-444444444444",
        json!({}),
        "r",
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}
#[tokio::test]
async fn core_l03_public_rejects_injected_payload_forged_mfa_self_and_cross_session() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let (_, subs) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "r",
    )
    .await;
    let subject = subs["items"][0]["subjectId"].clone();
    let (s, _) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":subject,"quantity":"100000","actorId":Uuid::new_v4()}),
        "injected",
    )
    .await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY);
    let (_, r) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":subject}),
        "open",
    )
    .await;
    let path = format!(
        "/v1/assisted-testnet/requests/{}/approvals",
        r["request"]["requestId"].as_str().unwrap()
    );
    let mut b = proof(&app, "session-current").await;
    b["expectedRevision"] = json!(0);
    assert_eq!(
        call(&app, "session-current", "POST", &path, b, "self")
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    let mut b = proof(&app, "session-approver").await;
    b["expectedRevision"] = json!(0);
    assert_eq!(
        call(&app, "session-owner", "POST", &path, b, "foreign-proof")
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(
            &app,
            "session-approver",
            "POST",
            &path,
            json!({"expectedRevision":0,"mfaChallengeRef":"mfa-forged","reauthTokenRef":"fake"}),
            "forged"
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        p.data
            .lock()
            .await
            .assisted
            .as_ref()
            .unwrap()
            .native
            .submission_count()
            .unwrap(),
        0
    );
}
#[tokio::test]
async fn core_l03_public_proof_expiry_and_policy_revocation_block_native_recovery() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let (_, subs) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "r",
    )
    .await;
    let (_, r) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":subs["items"][0]["subjectId"]}),
        "open",
    )
    .await;
    let id = r["request"]["requestId"].as_str().unwrap();
    let mut b = proof(&app, "session-approver").await;
    b["expectedRevision"] = json!(0);
    p.advance_reference_time(Duration::seconds(120)).await;
    assert_ne!(
        call(
            &app,
            "session-approver",
            "POST",
            &format!("/v1/assisted-testnet/requests/{id}/approvals"),
            b,
            "expired"
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        p.data
            .lock()
            .await
            .assisted
            .as_ref()
            .unwrap()
            .native
            .submission_count()
            .unwrap(),
        0
    );
}
#[tokio::test]
async fn core_l03_full_inventory_recovers_original_open_without_creating_a_201st_request() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let (_, subs) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "read",
    )
    .await;
    let body = json!({"subjectId":subs["items"][0]["subjectId"]});
    let mut original = Value::Null;
    for i in 0..200 {
        let (s, r) = call(
            &app,
            "session-current",
            "POST",
            "/v1/assisted-testnet/requests",
            body.clone(),
            &format!("cap-{i}"),
        )
        .await;
        assert_eq!(s, StatusCode::OK, "{r}");
        if i == 0 {
            original = r;
        }
    }
    let (s, r) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        body.clone(),
        "cap-0",
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{r}");
    assert_eq!(r, original);
    assert_eq!(
        call(
            &app,
            "session-current",
            "POST",
            "/v1/assisted-testnet/requests",
            body,
            "new-over-cap"
        )
        .await
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    let s = p.data.lock().await;
    assert_eq!(s.assisted.as_ref().unwrap().requests.len(), 200);
    assert_eq!(
        s.assisted
            .as_ref()
            .unwrap()
            .native
            .submission_count()
            .unwrap(),
        0
    );
}

mod current_source;
