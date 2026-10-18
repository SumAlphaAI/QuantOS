use super::*;
use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use tower::ServiceExt;
async fn call(
    r: &Router,
    m: &str,
    path: &str,
    body: Option<Value>,
    session: &str,
    key: Uuid,
    version: Option<&str>,
) -> (u16, Value) {
    let mut req = Request::builder()
        .method(m)
        .uri(path)
        .header(
            "cookie",
            format!(
                "quantos_session={session}; quantos_csrf={}",
                crate::CSRF_TOKEN
            ),
        )
        .header("origin", crate::ALLOWED_ORIGIN)
        .header("x-csrf-token", crate::CSRF_TOKEN)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("idempotency-key", key.to_string());
    if let Some(v) = version {
        req = req.header("if-match", v)
    }
    if body.is_some() {
        req = req.header("content-type", "application/json")
    }
    let res = r
        .clone()
        .oneshot(
            req.body(
                body.map(|v| Body::from(v.to_string()))
                    .unwrap_or_else(Body::empty),
            )
            .unwrap(),
        )
        .await
        .unwrap();
    let status = res.status().as_u16();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(json!({"raw":String::from_utf8_lossy(&bytes)})),
    )
}
async fn setup() -> (crate::BffProvider, Router, Value) {
    let p = crate::BffProvider::default();
    let r = p.router();
    let (s, v) = call(
        &r,
        "GET",
        "/v1/strategies",
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200, "{v}");
    let id = v["items"][0]["strategyId"].as_str().unwrap();
    let (s, d) = call(
        &r,
        "GET",
        &format!("/v1/strategies/{id}/draft"),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    (p, r, d)
}
async fn backtest(r: &Router, d: &Value) -> Value {
    let(s,v)=call(r,"POST","/v1/backtests",Some(json!({"strategyId":d["strategyId"],"objectVersion":d["objectVersion"],"dataSnapshotId":d["dataSnapshotId"]})),crate::CURRENT_SESSION,Uuid::new_v4(),None).await;
    assert_eq!(s, 202, "{v}");
    v
}
async fn release(r: &Router, d: &Value) -> Value {
    let run = backtest(r, d).await;
    let(s,v)=call(r,"POST","/v1/releases",Some(json!({"strategyId":d["strategyId"],"objectVersion":d["objectVersion"],"backtestRunId":run["jobId"],"parameters":d["parameters"]})),crate::CURRENT_SESSION,Uuid::new_v4(),None).await;
    assert_eq!(s, 201, "{v}");
    v
}
async fn submit(r: &Router, v: &Value) -> Value {
    let (s, a) = call(
        r,
        "POST",
        &format!(
            "/v1/releases/{}/approval-submissions",
            v["releaseId"].as_str().unwrap()
        ),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        v["objectVersion"].as_str(),
    )
    .await;
    assert_eq!(s, 202, "{a}");
    a
}
async fn proof(r: &Router, session: &str) -> Value {
    let (s, c) = call(
        r,
        "POST",
        "/v1/auth/mfa/challenges",
        Some(json!({"purpose":"security_change","code":"123456"})),
        session,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200, "{c}");
    let (s, g) = call(
        r,
        "POST",
        "/v1/auth/reauth",
        Some(json!({"challengeRef":c["challengeRef"]})),
        session,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200, "{g}");
    json!({"decision":"approve","mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"]})
}
#[tokio::test]
async fn real_draft_backtest_release_and_a3_artifact_binding() {
    let (_, r, d) = setup().await;
    let v = release(&r, &d).await;
    assert_eq!(v["allowedTargets"], json!(["paper", "shadow"]));
    assert_eq!(v["approvalState"], "none");
    assert!(v["contentHash"].as_str().unwrap().starts_with("sha256:"));
    let (s, a) = call(
        &r,
        "GET",
        &format!(
            "/v1/artifacts/{}",
            v["backtestReportArtifactId"].as_str().unwrap()
        ),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(a["dataSnapshotId"], d["dataSnapshotId"]);
    assert_eq!(a["backtestReport"]["leak_check"]["violations"], 0);
    assert_eq!(a["backtestReport"]["draft"]["draft_id"], d["strategyId"]);
}
#[tokio::test]
async fn concurrent_edit_is_unique_and_returns_current_diff() {
    let (_, r, d) = setup().await;
    let path = format!("/v1/strategies/{}/draft", d["strategyId"].as_str().unwrap());
    let mut tasks = vec![];
    for i in 0..30 {
        let r = r.clone();
        let path = path.clone();
        let mut b = json!({"files":d["files"],"parameters":d["parameters"]});
        b["files"]["notes"] = json!(i.to_string());
        tasks.push(tokio::spawn(async move {
            call(
                &r,
                "PUT",
                &path,
                Some(b),
                crate::CURRENT_SESSION,
                Uuid::new_v4(),
                Some("1"),
            )
            .await
        }));
    }
    let mut success = 0;
    for t in tasks {
        let (s, v) = t.await.unwrap();
        if s == 200 {
            success += 1;
            assert_eq!(v["objectVersion"], "2")
        } else {
            assert_eq!(s, 409, "{v}");
            assert_eq!(v["currentVersion"], "2");
            assert!(v["conflictDiff"]["files"].is_object())
        }
    }
    assert_eq!(success, 1);
}
#[tokio::test]
async fn lost_save_response_replays_original_and_changed_intent_conflicts() {
    let (p, r, d) = setup().await;
    let path = format!("/v1/strategies/{}/draft", d["strategyId"].as_str().unwrap());
    let b = json!({"files":d["files"],"parameters":d["parameters"]});
    let key = Uuid::new_v4();
    let first = call(
        &r,
        "PUT",
        &path,
        Some(b.clone()),
        crate::CURRENT_SESSION,
        key,
        Some("1"),
    )
    .await;
    assert_eq!(first.0, 200);
    let n = p.audit_count().await;
    for _ in 0..100 {
        assert_eq!(
            call(
                &r,
                "PUT",
                &path,
                Some(b.clone()),
                crate::CURRENT_SESSION,
                key,
                Some("1")
            )
            .await,
            first
        );
    }
    assert_eq!(p.audit_count().await, n);
    assert_eq!(
        call(
            &r,
            "PUT",
            &path,
            Some(json!({"files":{},"parameters":{}})),
            crate::CURRENT_SESSION,
            key,
            Some("1")
        )
        .await
        .0,
        409
    );
}
#[tokio::test]
async fn edited_untrusted_source_fails_static_and_backtest() {
    let (_, r, d) = setup().await;
    let path = format!("/v1/strategies/{}/draft", d["strategyId"].as_str().unwrap());
    let (s, v) = call(
        &r,
        "PUT",
        &path,
        Some(json!({"files":{"strategy.rule":"future(close, 1)"},"parameters":d["parameters"]})),
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        Some("1"),
    )
    .await;
    assert_eq!(s, 200);
    let (s, e) = call(
        &r,
        "POST",
        &path.replace("draft", "static-checks"),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 422, "{e}");
    assert_eq!(e["code"], "STATIC_CHECK_FAILED");
    assert_eq!(call(&r,"POST","/v1/backtests",Some(json!({"strategyId":v["strategyId"],"objectVersion":v["objectVersion"],"dataSnapshotId":v["dataSnapshotId"]})),crate::CURRENT_SESSION,Uuid::new_v4(),None).await.0,422);
}
#[tokio::test]
async fn snapshot_and_pinned_report_binding_cannot_be_forged() {
    let (_, r, d) = setup().await;
    let b = json!({"strategyId":d["strategyId"],"objectVersion":d["objectVersion"],"dataSnapshotId":Uuid::new_v4()});
    assert_eq!(
        call(
            &r,
            "POST",
            "/v1/backtests",
            Some(b),
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        422
    );
    let run = backtest(&r, &d).await;
    let mut params = d["parameters"].clone();
    params["lookback"] = json!(999);
    let(s,e)=call(&r,"POST","/v1/releases",Some(json!({"strategyId":d["strategyId"],"objectVersion":d["objectVersion"],"backtestRunId":run["jobId"],"parameters":params})),crate::CURRENT_SESSION,Uuid::new_v4(),None).await;
    assert_eq!(s, 409, "{e}");
}
#[tokio::test]
async fn release_approval_requires_independent_verified_actor_and_timelines() {
    let (_, r, d) = setup().await;
    let v = release(&r, &d).await;
    let a = submit(&r, &v).await;
    let path = format!("/v1/approvals/{}/decisions", a["jobId"].as_str().unwrap());
    let own = proof(&r, crate::CURRENT_SESSION).await;
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(own),
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            Some("0")
        )
        .await
        .0,
        403
    );
    let verified = proof(&r, "session-approver").await;
    let key = Uuid::new_v4();
    let accepted = call(
        &r,
        "POST",
        &path,
        Some(verified.clone()),
        "session-approver",
        key,
        Some("0"),
    )
    .await;
    assert_eq!(accepted.0, 200, "{:?}", accepted);
    assert_eq!(accepted.1["status"], "approved");
    assert!(accepted.1.get("commandRef").is_none());
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(verified),
            "session-approver",
            key,
            Some("0")
        )
        .await,
        accepted
    );
    let (s, view) = call(
        &r,
        "GET",
        &format!("/v1/releases/{}", v["releaseId"].as_str().unwrap()),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    assert_eq!(view["approvalState"], "approved");
    assert_eq!(view["approvalTimeline"].as_array().unwrap().len(), 2);
}
#[tokio::test]
async fn approval_proof_cannot_authorize_another_resource() {
    let (_, r, d) = setup().await;
    let first = release(&r, &d).await;
    let a = submit(&r, &first).await;
    let verified = proof(&r, "session-approver").await;
    let path = format!("/v1/approvals/{}/decisions", a["jobId"].as_str().unwrap());
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(verified.clone()),
            "session-approver",
            Uuid::new_v4(),
            Some("0")
        )
        .await
        .0,
        200
    );
    let id = d["strategyId"].as_str().unwrap();
    let (s, d) = call(
        &r,
        "PUT",
        &format!("/v1/strategies/{id}/draft"),
        Some(json!({"files":d["files"],"parameters":d["parameters"]})),
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        Some("1"),
    )
    .await;
    assert_eq!(s, 200);
    let next = release(&r, &d).await;
    let b = submit(&r, &next).await;
    let path = format!("/v1/approvals/{}/decisions", b["jobId"].as_str().unwrap());
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(verified),
            "session-approver",
            Uuid::new_v4(),
            Some("0")
        )
        .await
        .0,
        403
    );
}
#[tokio::test]
async fn unauthorized_tenant_workspace_and_role_do_not_see_objects() {
    let (p, r, d) = setup().await;
    let path = format!("/v1/strategies/{}/draft", d["strategyId"].as_str().unwrap());
    assert_eq!(
        call(
            &r,
            "GET",
            &path,
            None,
            "session-viewer",
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        403
    );
    assert_eq!(
        call(&r, "GET", &path, None, "missing", Uuid::new_v4(), None)
            .await
            .0,
        401
    );
    let mut state = p.data.lock().await;
    let mut auth = reference_auth(crate::CURRENT_SESSION);
    auth.workspace_id = quantos_core::WorkspaceId::new();
    let e = state
        .strategy
        .as_mut()
        .unwrap()
        .handle(
            &auth,
            "x",
            &Method::GET,
            &path,
            &Default::default(),
            &HeaderMap::new(),
            &json!({}),
            None,
            Utc::now(),
        )
        .unwrap_err();
    assert_eq!(e.0, StatusCode::NOT_FOUND);
}
#[tokio::test]
async fn scoped_cursor_preserves_snapshot_and_rejects_changed_query() {
    let (_, r, _) = setup().await;
    let (s, v) = call(
        &r,
        "GET",
        "/v1/strategies?pageSize=1",
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    let cursor = v["nextCursor"].as_str().unwrap();
    let (s, next) = call(
        &r,
        "GET",
        &format!("/v1/strategies?pageSize=1&cursor={cursor}"),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    assert_ne!(next["items"][0]["strategyId"], v["items"][0]["strategyId"]);
    assert_eq!(
        call(
            &r,
            "GET",
            &format!("/v1/strategies?pageSize=2&cursor={cursor}"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        422
    );
}
#[tokio::test]
async fn stale_snapshot_denies_validation_and_expired_release_denies_approval() {
    let (p, r, d) = setup().await;
    let v = release(&r, &d).await;
    let a = submit(&r, &v).await;
    p.advance_reference_time(Duration::days(2)).await;
    p.renew_reference_session().await;
    assert_eq!(
        call(
            &r,
            "POST",
            &format!(
                "/v1/strategies/{}/static-checks",
                d["strategyId"].as_str().unwrap()
            ),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        422
    );
    let v = call(
        &r,
        "GET",
        &format!("/v1/approvals/{}", a["jobId"].as_str().unwrap()),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(v.0, 200);
    assert_eq!(v.1["status"], "expired");
}
#[tokio::test]
async fn poisoned_owner_fails_closed() {
    let (p, r, _) = setup().await;
    p.data.lock().await.strategy.as_mut().unwrap().poisoned = true;
    assert_eq!(
        call(
            &r,
            "GET",
            "/v1/strategies",
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        503
    );
}
#[tokio::test]
async fn client_cannot_inject_authority_targets_or_validation() {
    let (_, r, d) = setup().await;
    let(s,v)=call(&r,"POST","/v1/releases",Some(json!({"strategyId":d["strategyId"],"objectVersion":"1","backtestRunId":Uuid::new_v4(),"parameters":{},"allowedTargets":["assisted_live"],"verified":true})),crate::CURRENT_SESSION,Uuid::new_v4(),None).await;
    assert_eq!(s, 422, "{v}");
}
#[tokio::test]
async fn verified_proof_is_single_use_across_strategy_and_execution() {
    let (_, r, d) = setup().await;
    let v = release(&r, &d).await;
    let a = submit(&r, &v).await;
    let verified = proof(&r, "session-owner").await;
    let path = format!("/v1/approvals/{}/decisions", a["jobId"].as_str().unwrap());
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(verified.clone()),
            "session-owner",
            Uuid::new_v4(),
            Some("0")
        )
        .await
        .0,
        200
    );
    let body = json!({"accountId":"44444444-4444-4444-8444-444444444444","reason":"owned refusal check","confirmPhrase":"ENGAGE KILL SWITCH","mfaChallengeRef":verified["mfaChallengeRef"],"reauthTokenRef":verified["reauthTokenRef"]});
    assert_eq!(
        call(
            &r,
            "POST",
            "/v1/risk/kill-switch/engage",
            Some(body),
            "session-owner",
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        403
    );
}
#[tokio::test]
async fn rollback_requires_prior_approved_same_strategy_release() {
    let (_, r, d) = setup().await;
    let first = release(&r, &d).await;
    let id = d["strategyId"].as_str().unwrap();
    let (s, d) = call(
        &r,
        "PUT",
        &format!("/v1/strategies/{id}/draft"),
        Some(json!({"files":d["files"],"parameters":d["parameters"]})),
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        Some("1"),
    )
    .await;
    assert_eq!(s, 200);
    let second = release(&r, &d).await;
    let path = format!(
        "/v1/releases/{}/rollback-requests",
        second["releaseId"].as_str().unwrap()
    );
    let (s, e) = call(
        &r,
        "POST",
        &path,
        Some(json!({"targetReleaseId":first["releaseId"]})),
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 409, "{e}");
    assert_eq!(e["code"], "RELEASE_UNAPPROVED");
}
#[tokio::test]
async fn approval_expires_at_core_ttl_and_reconnect_revocation_is_terminal() {
    let (p, r, d) = setup().await;
    let v = release(&r, &d).await;
    let a = submit(&r, &v).await;
    let path = format!("/v1/approvals/{}/decisions", a["jobId"].as_str().unwrap());
    let verified = proof(&r, "session-approver").await;
    assert_eq!(
        call(
            &r,
            "POST",
            &path,
            Some(verified),
            "session-approver",
            Uuid::new_v4(),
            Some("0")
        )
        .await
        .0,
        200
    );
    p.advance_reference_time(Duration::seconds(301)).await;
    p.renew_reference_session().await;
    let (s, v) = call(
        &r,
        "GET",
        &format!("/v1/releases/{}", v["releaseId"].as_str().unwrap()),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    assert_eq!(v["approvalState"], "expired");
    let run = backtest(&r, &d).await;
    let path = format!("/v1/backtests/{}/stream", run["jobId"].as_str().unwrap());
    assert_eq!(
        call(
            &r,
            "POST",
            "/v1/auth/logout",
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        204
    );
    assert_eq!(
        call(
            &r,
            "GET",
            &path,
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None
        )
        .await
        .0,
        401
    );
}
#[tokio::test]
async fn trusted_report_owner_seam_checks_scope_attachment_hash_and_poison() {
    let (p, r, d) = setup().await;
    let run = backtest(&r, &d).await;
    let (s, report) = call(
        &r,
        "GET",
        &format!("/v1/backtests/{}", run["jobId"].as_str().unwrap()),
        None,
        crate::CURRENT_SESSION,
        Uuid::new_v4(),
        None,
    )
    .await;
    assert_eq!(s, 200);
    let id = uid(&report, "reportArtifactId").unwrap();
    let mut state = p.data.lock().await;
    let host = state.strategy.as_mut().unwrap();
    let auth = reference_auth(crate::CURRENT_SESSION);
    let metadata = host.artifact(&auth, id, false).unwrap().unwrap();
    let attachment = host.artifact(&auth, id, true).unwrap().unwrap();
    assert_eq!(metadata["contentHash"], attachment["contentHash"]);
    assert_eq!(attachment["contentHash"], digest(&attachment["content"]));
    let mut foreign = auth.clone();
    foreign.workspace_id = quantos_core::WorkspaceId::new();
    assert_eq!(
        host.artifact(&foreign, id, false).unwrap_err().0,
        StatusCode::NOT_FOUND
    );
    host.poisoned = true;
    assert_eq!(
        host.artifact(&auth, id, false).unwrap_err().0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
#[tokio::test]
async fn self_approval_is_rejected_even_when_actor_has_approver_capability() {
    let (p, r, d) = setup().await;
    let v = release(&r, &d).await;
    let entry = submit(&r, &v).await;
    let id = entry["jobId"].as_str().unwrap();
    let mut auth = reference_auth(crate::CURRENT_SESSION);
    auth.role = Role::Owner;
    auth.capabilities
        .insert(Capability::parse(Capability::STRATEGY_APPROVE).unwrap());
    let mut h = HeaderMap::new();
    h.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    h.insert("if-match", "0".parse().unwrap());
    let mut state = p.data.lock().await;
    let e = state
        .strategy
        .as_mut()
        .unwrap()
        .handle(
            &auth,
            "owned",
            &Method::POST,
            &format!("/v1/approvals/{id}/decisions"),
            &Default::default(),
            &h,
            &json!({"decision":"approve"}),
            Some("verified-owned-proof".into()),
            Utc::now(),
        )
        .unwrap_err();
    assert_eq!(e.1, "SELF_APPROVAL_FORBIDDEN");
}
#[tokio::test]
async fn strategy_audit_roots_and_response_ids_form_closed_evidence_chain() {
    let (p, r, d) = setup().await;
    let accepted = backtest(&r, &d).await;
    let state = p.data.lock().await;
    let rows = state
        .audits
        .iter()
        .filter(|a| a["correlationId"] == accepted["correlationId"])
        .collect::<Vec<_>>();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["eventId"], accepted["auditRef"]);
    assert_eq!(rows[0]["causationId"], accepted["auditRef"]);
    assert_eq!(rows[0]["route"], "/v1/backtests");
    assert_eq!(
        rows[0]["actor"],
        reference_auth(crate::CURRENT_SESSION).actor_id.to_string()
    );
}
