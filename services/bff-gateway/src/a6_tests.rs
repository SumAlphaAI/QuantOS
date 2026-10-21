//! A6 current composition only: C02 and C17 share one owned local provider.
//! No database, real worker/Storage, upstream Gate or release claim.
use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
#[expect(
    clippy::too_many_arguments,
    reason = "HTTP identity, idempotency, version and reauthentication inputs stay explicit in refusal probes"
)]
async fn call(
    p: &BffProvider,
    method: &str,
    path: &str,
    body: Option<Value>,
    session: &str,
    key: Uuid,
    version: &str,
    reauth: &str,
) -> (u16, Value) {
    let r = p
        .router()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header(
                    "cookie",
                    format!("quantos_session={session}; quantos_csrf={CSRF_TOKEN}"),
                )
                .header("origin", ALLOWED_ORIGIN)
                .header("x-csrf-token", CSRF_TOKEN)
                .header("x-request-id", Uuid::new_v4().to_string())
                .header("idempotency-key", key.to_string())
                .header("if-match", version)
                .header("x-reauth-token-ref", reauth)
                .header("content-type", "application/json")
                .body(Body::from(body.map(|v| v.to_string()).unwrap_or_default()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(r.headers().get("cache-control").unwrap(), "no-store");
    let status = r.status().as_u16();
    let bytes = to_bytes(r.into_body(), 1048576).await.unwrap();
    let value=serde_json::from_slice(&bytes).unwrap_or_else(|_|json!({"events":String::from_utf8_lossy(&bytes).lines().filter_map(|line|line.strip_prefix("data: ")).map(|s|serde_json::from_str::<Value>(s).unwrap()).collect::<Vec<_>>() }));
    (status, value)
}
async fn read(p: &BffProvider, path: &str) -> Value {
    let (s, v) = call(
        p,
        "GET",
        path,
        None,
        CURRENT_SESSION,
        Uuid::new_v4(),
        "",
        "",
    )
    .await;
    assert_eq!(s, 200, "{path}: {v}");
    v
}
async fn proof(p: &BffProvider, session: &str) -> Value {
    let (s, c) = call(
        p,
        "POST",
        "/v1/auth/mfa/challenges",
        Some(json!({"purpose":"security_change","code":"123456"})),
        session,
        Uuid::new_v4(),
        "",
        "",
    )
    .await;
    assert_eq!(s, 200, "{c}");
    let (s, g) = call(
        p,
        "POST",
        "/v1/auth/reauth",
        Some(json!({"challengeRef":c["challengeRef"]})),
        session,
        Uuid::new_v4(),
        "",
        "",
    )
    .await;
    assert_eq!(s, 200, "{g}");
    json!({"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"],"reason":"owned A6 controlled action"})
}
async fn export(p: &BffProvider) -> (Value, Value) {
    let grant = proof(p, CURRENT_SESSION).await;
    let(s,job)=call(p,"POST","/v1/exports",Some(json!({"scope":{"correlationIds":[AUDIT_CORRELATION]},"format":"csv","reason":"PRIVATE_A6_EXPORT_REASON","watermark":"PRIVATE_A6_WATERMARK","retentionDays":1})),CURRENT_SESSION,Uuid::new_v4(),"",grant["reauthTokenRef"].as_str().unwrap()).await;
    assert_eq!(s, 202, "{job}");
    (job, grant)
}
async fn leases(p: &BffProvider) -> (String, String) {
    let _ = export(p).await;
    let stream = read(p, "/v1/command/stream").await;
    let page = read(p, "/v1/settings/downloads?pageSize=1").await;
    (
        format!(
            "/v1/command/stream?streamId={}&afterSequence=0",
            stream["events"][0]["streamId"].as_str().unwrap()
        ),
        format!(
            "/v1/settings/downloads?pageSize=1&cursor={}",
            page["nextCursor"].as_str().unwrap()
        ),
    )
}
#[tokio::test]
async fn mixed_command_platform_reads_never_acquire_execution_or_export_authority() {
    let p = BffProvider::default();
    let before = read(&p, "/v1/command/summary").await;
    let (job, _) = export(&p).await;
    let execution = p
        .data
        .lock()
        .await
        .execution
        .as_ref()
        .unwrap()
        .downstream_counts();
    let audit = p.audit_count().await;
    for _ in 0..10 {
        let policy = read(&p, "/v1/platform/browser-capabilities").await;
        assert_eq!(policy["permissionState"]["notifications"], "unknown");
        let history = read(&p, "/v1/settings/downloads").await;
        assert!(
            history["items"]
                .as_array()
                .unwrap()
                .iter()
                .any(|i| i["downloadId"] == job["exportId"])
        );
        for marker in ["PRIVATE_A6", "downloadUrl", "object_key", "requestedBy"] {
            assert!(!history.to_string().contains(marker));
        }
        let after = read(&p, "/v1/command/summary").await;
        assert_eq!(after["revision"], before["revision"]);
        assert!(!after.to_string().contains("PRIVATE_A6"));
    }
    assert_eq!(
        p.data
            .lock()
            .await
            .execution
            .as_ref()
            .unwrap()
            .downstream_counts(),
        execution
    );
    assert_eq!(p.audit_count().await, audit);
    assert_eq!(p.data.lock().await.exports.len(), 2);
}
#[tokio::test]
async fn stream_and_history_recovery_tokens_cannot_cross_resource_namespaces() {
    let p = BffProvider::default();
    let _ = export(&p).await;
    let stream = read(&p, "/v1/command/stream").await;
    let page = read(&p, "/v1/settings/downloads?pageSize=1").await;
    let stream_id = stream["events"][0]["streamId"].as_str().unwrap();
    let cursor = page["nextCursor"].as_str().unwrap();
    for (path, status) in [
        (
            format!("/v1/command/stream?streamId={cursor}&afterSequence=0"),
            409,
        ),
        (
            format!("/v1/settings/downloads?pageSize=1&cursor={stream_id}"),
            422,
        ),
        (format!("/v1/command/summary?cursor={cursor}"), 422),
        (
            format!("/v1/settings/downloads?afterSequence=1&streamId={stream_id}"),
            422,
        ),
    ] {
        assert_eq!(
            call(
                &p,
                "GET",
                &path,
                None,
                CURRENT_SESSION,
                Uuid::new_v4(),
                "",
                ""
            )
            .await
            .0,
            status,
            "{path}"
        );
    }
}
#[tokio::test]
async fn independent_deadlines_and_observer_refresh_do_not_renew_saved_a6_leases() {
    let p = BffProvider::default();
    let (stream, cursor) = leases(&p).await;
    p.advance_reference_time(Duration::seconds(31)).await;
    p.renew_operations_reference().await.unwrap();
    assert_eq!(
        call(
            &p,
            "GET",
            &stream,
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        409
    );
    assert_eq!(
        call(
            &p,
            "GET",
            &cursor,
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        200
    );
    let summary = read(&p, "/v1/command/summary").await;
    assert_eq!(
        summary["sources"]
            .as_array()
            .unwrap()
            .iter()
            .find(|s| s["domain"] == "execution")
            .unwrap()["status"],
        "ready"
    );
    assert_eq!(
        read(&p, "/v1/platform/browser-capabilities").await["permissionState"]["clipboard"],
        "unknown"
    );
    p.advance_reference_time(Duration::seconds(30)).await;
    let expired_source = read(&p, "/v1/command/summary").await;
    assert_eq!(expired_source["riskPosture"], "unknown");
    assert_eq!(expired_source["orderSummary"], Value::Null);
    assert_eq!(
        call(
            &p,
            "GET",
            &cursor,
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        422
    );
    assert_eq!(
        read(&p, "/v1/settings/downloads").await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
#[tokio::test]
async fn current_member_revocation_precedes_saved_a6_recovery_and_download_issuance() {
    let p = BffProvider::default();
    let (stream, cursor) = leases(&p).await;
    let actor = read(&p, "/v1/context").await["actorId"].clone();
    let (s, members) = call(
        &p,
        "GET",
        "/v1/admin/members",
        None,
        "session-owner",
        Uuid::new_v4(),
        "",
        "",
    )
    .await;
    assert_eq!(s, 200);
    let member = members["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["spec"]["actorId"] == actor)
        .unwrap();
    let mut b = proof(&p, "session-owner").await;
    b["spec"] = member["spec"].clone();
    b["spec"]["active"] = json!(false);
    let (s, v) = call(
        &p,
        "PUT",
        &format!("/v1/admin/members/{}", member["id"].as_str().unwrap()),
        Some(b),
        "session-owner",
        Uuid::new_v4(),
        member["objectVersion"].as_str().unwrap(),
        "",
    )
    .await;
    assert_eq!(s, 200, "{v}");
    let id = p
        .data
        .lock()
        .await
        .exports
        .keys()
        .find(|s| s.as_str() != EXPIRED_EXPORT)
        .unwrap()
        .clone();
    for path in [
        "/v1/command/summary",
        "/v1/platform/browser-capabilities",
        "/v1/settings/downloads",
        &stream,
        &cursor,
        &format!("/v1/exports/{id}/download"),
    ] {
        assert_eq!(
            call(
                &p,
                "GET",
                path,
                None,
                CURRENT_SESSION,
                Uuid::new_v4(),
                "",
                ""
            )
            .await
            .0,
            401,
            "{path}"
        );
    }
}
#[tokio::test]
async fn shared_quarantine_refuses_all_a6_routes_without_new_business_writes() {
    let p = BffProvider::default();
    let (stream, cursor) = leases(&p).await;
    let count = p.audit_count().await;
    p.data.lock().await.operations.as_mut().unwrap().poisoned = true;
    for path in [
        "/v1/command/summary",
        "/v1/platform/browser-capabilities",
        "/v1/settings/downloads",
        &stream,
        &cursor,
    ] {
        assert_eq!(
            call(
                &p,
                "GET",
                path,
                None,
                CURRENT_SESSION,
                Uuid::new_v4(),
                "",
                ""
            )
            .await
            .0,
            503,
            "{path}"
        );
    }
    assert_eq!(p.audit_count().await, count);
}
#[tokio::test]
async fn expired_session_denies_both_surfaces_and_renewal_cannot_revive_old_recovery() {
    let p = BffProvider::default();
    let (stream, cursor) = leases(&p).await;
    p.advance_reference_time(Duration::seconds(301)).await;
    for path in [
        "/v1/command/summary",
        "/v1/platform/browser-capabilities",
        "/v1/settings/downloads",
        &stream,
        &cursor,
    ] {
        assert_eq!(
            call(
                &p,
                "GET",
                path,
                None,
                CURRENT_SESSION,
                Uuid::new_v4(),
                "",
                ""
            )
            .await
            .0,
            401,
            "{path}"
        );
    }
    p.renew_reference_session().await;
    assert_eq!(
        call(
            &p,
            "GET",
            &stream,
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        409
    );
    assert_eq!(
        call(
            &p,
            "GET",
            &cursor,
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        422
    );
    assert_eq!(
        read(&p, "/v1/platform/browser-capabilities").await["downloadHistoryIncludesLinks"],
        false
    );
}
#[tokio::test]
async fn browser_reads_never_turn_shadow_or_viewer_into_execution_authority() {
    let p = BffProvider::shadow_reference();
    let _ = read(&p, "/v1/platform/browser-capabilities").await;
    let summary = read(&p, "/v1/command/summary").await;
    assert_eq!(summary["mode"], "shadow");
    assert_eq!(summary["riskPosture"], "unknown");
    let state = p.data.lock().await;
    assert!(state.execution.is_none());
    assert!(state.strategy.is_none());
    drop(state);
    for path in [
        "/v1/command/summary",
        "/v1/command/stream",
        "/v1/settings/downloads",
    ] {
        assert_eq!(
            call(
                &p,
                "GET",
                path,
                None,
                VIEWER_SESSION,
                Uuid::new_v4(),
                "",
                ""
            )
            .await
            .0,
            403
        );
    }
    assert_eq!(
        call(
            &p,
            "GET",
            "/v1/platform/browser-capabilities",
            None,
            VIEWER_SESSION,
            Uuid::new_v4(),
            "",
            ""
        )
        .await
        .0,
        200
    );
}
#[tokio::test]
async fn export_cancellation_changes_history_but_not_command_frame_or_execution_facts() {
    let p = BffProvider::default();
    let stream = read(&p, "/v1/command/stream").await;
    let event = &stream["events"][0];
    let (job, grant) = export(&p).await;
    let (s, v) = call(
        &p,
        "POST",
        &format!("/v1/exports/{}/cancel", job["exportId"].as_str().unwrap()),
        None,
        CURRENT_SESSION,
        Uuid::new_v4(),
        "",
        grant["reauthTokenRef"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 202, "{v}");
    let history = read(&p, "/v1/settings/downloads").await;
    let row = history["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["downloadId"] == job["exportId"])
        .unwrap();
    assert_eq!(row["status"], "failed");
    assert!(row.get("downloadPath").is_none());
    let replay = read(
        &p,
        &format!(
            "/v1/command/stream?streamId={}&afterSequence=0",
            event["streamId"].as_str().unwrap()
        ),
    )
    .await;
    assert_eq!(replay["events"], json!([event]));
    assert!(
        read(
            &p,
            &format!(
                "/v1/command/stream?streamId={}&afterSequence=1",
                event["streamId"].as_str().unwrap()
            )
        )
        .await["events"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}
