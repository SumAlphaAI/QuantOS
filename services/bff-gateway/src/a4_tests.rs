//! Current A4 composition in one owned provider; no target or release admission.
use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
async fn call(
    p: &BffProvider,
    m: &str,
    path: &str,
    b: Option<Value>,
    session: &str,
    key: Uuid,
    version: &str,
) -> (u16, Value) {
    let req = Request::builder()
        .method(m)
        .uri(path)
        .header(
            "cookie",
            format!("quantos_session={session}; quantos_csrf={CSRF_TOKEN}"),
        )
        .header("origin", ALLOWED_ORIGIN)
        .header("x-csrf-token", CSRF_TOKEN)
        .header("idempotency-key", key.to_string())
        .header("if-match", version)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("content-type", "application/json")
        .body(Body::from(b.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap();
    let r = p.router().oneshot(req).await.unwrap();
    let s = r.status().as_u16();
    let bytes = to_bytes(r.into_body(), 1048576).await.unwrap();
    (s, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}
async fn get(p: &BffProvider, path: &str) -> Value {
    let (s, v) = call(p, "GET", path, None, CURRENT_SESSION, Uuid::new_v4(), "").await;
    assert_eq!(s, 200, "{v}");
    v
}
async fn proof(p: &BffProvider) -> Value {
    let (s, c) = call(
        p,
        "POST",
        "/v1/auth/mfa/challenges",
        Some(json!({"purpose":"security_change","code":"123456"})),
        "session-owner",
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 200);
    let (s, g) = call(
        p,
        "POST",
        "/v1/auth/reauth",
        Some(json!({"challengeRef":c["challengeRef"]})),
        "session-owner",
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 200);
    json!({"decision":"approve","mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]})
}
async fn strategy_pending(p: &BffProvider) -> (Value, Value, Value) {
    let list = get(p, "/v1/strategies").await;
    let id = list["items"][0]["strategyId"].as_str().unwrap();
    let d = get(p, &format!("/v1/strategies/{id}/draft")).await;
    let(s,run)=call(p,"POST","/v1/backtests",Some(json!({"strategyId":id,"objectVersion":d["objectVersion"],"dataSnapshotId":d["dataSnapshotId"]})),CURRENT_SESSION,Uuid::new_v4(),"").await;
    assert_eq!(s, 202, "{run}");
    let(s,r)=call(p,"POST","/v1/releases",Some(json!({"strategyId":id,"objectVersion":d["objectVersion"],"backtestRunId":run["jobId"],"parameters":d["parameters"]})),CURRENT_SESSION,Uuid::new_v4(),"").await;
    assert_eq!(s, 201, "{r}");
    let (s, a) = call(
        p,
        "POST",
        &format!(
            "/v1/releases/{}/approval-submissions",
            r["releaseId"].as_str().unwrap()
        ),
        None,
        CURRENT_SESSION,
        Uuid::new_v4(),
        r["objectVersion"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 202, "{a}");
    (d, r, a)
}
async fn risk_pending(p: &BffProvider, key: Uuid) -> (Value, Value) {
    let proposal = get(p, "/v1/proposals").await["items"][0].clone();
    let pre = get(
        p,
        &format!(
            "/v1/trade-preflight?accountId={}&proposalId={}",
            proposal["accountId"].as_str().unwrap(),
            proposal["proposalId"].as_str().unwrap()
        ),
    )
    .await;
    let (s, a) = call(
        p,
        "POST",
        &format!(
            "/v1/proposals/{}/risk-evaluations",
            proposal["proposalId"].as_str().unwrap()
        ),
        Some(json!({"contextHash":pre["contextHash"]})),
        CURRENT_SESSION,
        key,
        "0",
    )
    .await;
    assert_eq!(s, 202, "{a}");
    (proposal, a)
}
#[tokio::test]
async fn mixed_approvals_have_distinct_authority_and_frozen_pagination() {
    let p = BffProvider::default();
    let (_, r, s) = strategy_pending(&p).await;
    let (_, t) = risk_pending(&p, Uuid::new_v4()).await;
    assert_ne!(s["jobId"], t["jobId"]);
    let page = get(&p, "/v1/approvals?pageSize=1&sort=approvalId:asc").await;
    assert!(page["nextCursor"].is_string());
    let all = get(&p, "/v1/approvals").await;
    assert_eq!(all["items"].as_array().unwrap().len(), 2);
    let sa = all["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["approvalId"] == s["jobId"])
        .unwrap();
    assert_eq!(sa["kind"], "strategy_release");
    assert_eq!(sa["objectRef"], r["releaseId"]);
    let body = proof(&p).await;
    let (s, a) = call(
        &p,
        "POST",
        &format!("/v1/approvals/{}/decisions", s["jobId"].as_str().unwrap()),
        Some(body),
        "session-owner",
        Uuid::new_v4(),
        "0",
    )
    .await;
    assert_eq!(s, 200, "{a}");
    assert!(a.get("commandRef").is_none());
    let next = get(
        &p,
        &format!(
            "/v1/approvals?pageSize=1&sort=approvalId:asc&cursor={}",
            page["nextCursor"].as_str().unwrap()
        ),
    )
    .await;
    assert_ne!(
        page["items"][0]["approvalId"],
        next["items"][0]["approvalId"]
    );
    assert_eq!(page["items"][0]["status"], "pending");
    assert_eq!(next["items"][0]["status"], "pending");
    assert_eq!(
        get(
            &p,
            "/v1/orders?accountId=44444444-4444-4444-8444-444444444444"
        )
        .await["items"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}
#[tokio::test]
async fn execution_proof_cannot_be_reused_for_strategy_and_exact_retry_recovers() {
    let p = BffProvider::default();
    let (_, _, s) = strategy_pending(&p).await;
    let (_, t) = risk_pending(&p, Uuid::new_v4()).await;
    let body = proof(&p).await;
    let path = format!("/v1/approvals/{}/decisions", t["jobId"].as_str().unwrap());
    let key = Uuid::new_v4();
    let first = call(
        &p,
        "POST",
        &path,
        Some(body.clone()),
        "session-owner",
        key,
        "0",
    )
    .await;
    assert_eq!(first.0, 200, "{:?}", first);
    assert!(first.1["commandRef"].is_string());
    assert_eq!(
        call(
            &p,
            "POST",
            &path,
            Some(body.clone()),
            "session-owner",
            key,
            "0"
        )
        .await,
        first
    );
    let target = format!("/v1/approvals/{}/decisions", s["jobId"].as_str().unwrap());
    assert_eq!(
        call(
            &p,
            "POST",
            &target,
            Some(body),
            "session-owner",
            Uuid::new_v4(),
            "0"
        )
        .await
        .0,
        403
    );
    let fresh = proof(&p).await;
    assert_eq!(
        call(
            &p,
            "POST",
            &target,
            Some(fresh),
            "session-owner",
            Uuid::new_v4(),
            "0"
        )
        .await
        .0,
        200
    );
}
#[tokio::test]
async fn simultaneous_domain_retries_preserve_two_unique_audit_roots() {
    let p = BffProvider::default();
    let (list, _, _) = strategy_pending(&p).await;
    let proposal = get(&p, "/v1/proposals").await["items"][0].clone();
    let pre = get(
        &p,
        &format!(
            "/v1/trade-preflight?accountId={}&proposalId={}",
            proposal["accountId"].as_str().unwrap(),
            proposal["proposalId"].as_str().unwrap()
        ),
    )
    .await;
    let key = Uuid::new_v4();
    let start = p.data.lock().await.audits.len();
    let mut tasks = vec![];
    for i in 0..12 {
        let p = p.clone();
        let d = list.clone();
        let proposal = proposal.clone();
        let pre = pre.clone();
        tasks.push(tokio::spawn(async move {
            if i % 2 == 0 {
                call(
                    &p,
                    "PUT",
                    &format!("/v1/strategies/{}/draft", d["strategyId"].as_str().unwrap()),
                    Some(json!({"files":d["files"],"parameters":d["parameters"]})),
                    CURRENT_SESSION,
                    key,
                    "1",
                )
                .await
            } else {
                call(
                    &p,
                    "POST",
                    &format!(
                        "/v1/proposals/{}/risk-evaluations",
                        proposal["proposalId"].as_str().unwrap()
                    ),
                    Some(json!({"contextHash":pre["contextHash"]})),
                    CURRENT_SESSION,
                    key,
                    "0",
                )
                .await
            }
        }));
    }
    let mut replies = Vec::new();
    for (i, t) in tasks.into_iter().enumerate() {
        let (s, v) = t.await.unwrap();
        assert_eq!(s, if i % 2 == 0 { 200 } else { 202 }, "{v}");
        replies.push(v);
    }
    let state = p.data.lock().await;
    let rows = &state.audits[start..];
    assert_eq!(rows.len(), 2);
    assert_ne!(rows[0]["eventId"], rows[1]["eventId"]);
    for row in rows {
        assert_eq!(row["eventId"], row["causationId"]);
        assert!(replies.iter().any(|v| v["auditRef"] == row["eventId"]));
        assert!(row["route"].as_str().unwrap().starts_with("/v1/"));
    }
}
#[tokio::test]
async fn poisoned_strategy_host_cannot_publish_successful_mixed_approval_page() {
    let p = BffProvider::default();
    strategy_pending(&p).await;
    risk_pending(&p, Uuid::new_v4()).await;
    p.data.lock().await.strategy.as_mut().unwrap().poisoned = true;
    let (s, v) = call(
        &p,
        "GET",
        "/v1/approvals",
        None,
        CURRENT_SESSION,
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(
        s, 503,
        "quarantined strategy must not silently publish approval facts: {v}"
    );
    let caps = get(
        &p,
        "/v1/order-capabilities?accountId=44444444-4444-4444-8444-444444444444",
    )
    .await;
    assert_eq!(caps["venueSubmit"], false);
    let mut execution_only = strategy::reference_auth(CURRENT_SESSION);
    execution_only.capabilities.clear();
    execution_only.capabilities.insert(
        quantos_policy::Capability::parse(quantos_policy::Capability::EXECUTION_OPERATE).unwrap(),
    );
    assert!(
        p.data
            .lock()
            .await
            .strategy
            .as_ref()
            .unwrap()
            .checked_approvals(&execution_only, Utc::now())
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn strategy_only_reader_lists_own_approval_without_execution_grant() {
    let p = BffProvider::default();
    let (_, _, a) = strategy_pending(&p).await;
    let auth = strategy::reference_auth(CURRENT_SESSION);
    assert!(
        !auth
            .capabilities
            .iter()
            .any(|c| c.as_str() == quantos_policy::Capability::EXECUTION_OPERATE)
    );
    let q = std::collections::BTreeMap::from([
        ("sort".into(), "approvalId:asc".into()),
        ("pageSize".into(), "1".into()),
    ]);
    let (_, v) = p
        .data
        .lock()
        .await
        .strategy
        .as_mut()
        .unwrap()
        .handle(
            &auth,
            "trusted-strategy-reader",
            &axum::http::Method::GET,
            "/v1/approvals",
            &q,
            &axum::http::HeaderMap::new(),
            &json!({}),
            None,
            Utc::now(),
        )
        .unwrap();
    assert_eq!(v["items"][0]["approvalId"], a["jobId"]);
}
