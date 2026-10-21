//! Current ALL composition: owned process-local reference API, no target acceptance.
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

const ROUTES: &[&str] = &[
    "/v1/session",
    "/v1/context",
    "/v1/settings/profile",
    "/v1/settings/downloads",
    "/v1/platform/browser-capabilities",
    "/v1/audit/events",
    "/v1/research-runs",
    "/v1/data-snapshots",
    "/v1/markets/catalog",
    "/v1/markets/watchlist",
    "/v1/strategies",
    "/v1/releases",
    "/v1/portfolio?accountId=44444444-4444-4444-8444-444444444444",
    "/v1/risk?accountId=44444444-4444-4444-8444-444444444444",
    "/v1/proposals",
    "/v1/approvals",
    "/v1/orders?accountId=44444444-4444-4444-8444-444444444444",
    "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444",
    "/v1/ledger/entries?accountId=44444444-4444-4444-8444-444444444444",
    "/v1/performance/summary?accountId=44444444-4444-4444-8444-444444444444&currency=USD&method=simple&period=week&periodMode=rolling",
    "/v1/operations/health",
    "/v1/admin/members",
    "/v1/alerts",
    "/v1/command/summary",
];

async fn status(p: &BffProvider, path: &str, session: &str) -> (u16, Value) {
    call(p, "GET", path, None, session, Uuid::new_v4(), "", "").await
}
fn expected_read(path: &str) -> u16 {
    if path.starts_with("/v1/reconciliation/")
        || path.starts_with("/v1/ledger/")
        || path.starts_with("/v1/performance/")
    {
        403
    } else {
        200
    }
}
#[tokio::test]
async fn all_domains_share_one_provider_without_read_execution_authority() {
    let p = BffProvider::default();
    for path in ROUTES {
        let (s, v) = status(
            &p,
            path,
            if *path == "/v1/admin/members" {
                "session-owner"
            } else {
                CURRENT_SESSION
            },
        )
        .await;
        assert_eq!(s, expected_read(path), "{path}: {v}");
    }
    let before = p
        .data
        .lock()
        .await
        .execution
        .as_ref()
        .unwrap()
        .downstream_counts();
    let audit = p.audit_count().await;
    for _ in 0..3 {
        for path in ROUTES {
            let (s, v) = status(
                &p,
                path,
                if *path == "/v1/admin/members" {
                    "session-owner"
                } else {
                    CURRENT_SESSION
                },
            )
            .await;
            assert_eq!(s, expected_read(path), "{path}: {v}");
        }
    }
    assert_eq!(
        before,
        p.data
            .lock()
            .await
            .execution
            .as_ref()
            .unwrap()
            .downstream_counts()
    );
    assert_eq!(audit, p.audit_count().await);
}
#[tokio::test]
async fn missing_identity_is_denied_across_every_domain() {
    let p = BffProvider::default();
    for path in ROUTES {
        let (s, v) = status(&p, path, "missing-session").await;
        assert_eq!(s, 401, "{path}: {v}");
        assert!(v["code"].is_string());
    }
}
#[tokio::test]
async fn quarantined_identity_is_denied_across_every_domain() {
    let p = BffProvider::default();
    assert_eq!(
        status(&p, "/v1/operations/health", CURRENT_SESSION).await.0,
        200
    );
    p.data.lock().await.operations.as_mut().unwrap().poisoned = true;
    for path in ROUTES {
        let (s, v) = status(&p, path, "session-owner").await;
        assert_eq!(s, 503, "{path}: {v}");
    }
}
#[tokio::test]
async fn expired_identity_is_denied_across_every_domain() {
    let p = BffProvider::default();
    p.advance_reference_time(Duration::seconds(3601)).await;
    for path in ROUTES {
        let (s, v) = status(&p, path, "session-current").await;
        assert_eq!(s, 401, "{path}: {v}");
    }
}
#[tokio::test]
async fn shadow_aggregate_reads_never_seed_paper_orders() {
    let p = BffProvider::shadow_reference();
    for path in [
        "/v1/command/summary",
        "/v1/platform/browser-capabilities",
        "/v1/settings/downloads",
    ] {
        let (s, v) = status(&p, path, "session-current").await;
        assert_eq!(s, expected_read(path), "{path}: {v}");
    }
    let state = p.data.lock().await;
    assert!(state.execution.is_none());
    assert!(state.strategy.is_none());
}

#[tokio::test]
async fn current_member_revocation_denies_all_previously_read_domains() {
    let p = BffProvider::default();
    for path in ROUTES {
        let (s, v) = status(&p, path, CURRENT_SESSION).await;
        assert_eq!(
            s,
            if *path == "/v1/admin/members" {
                403
            } else {
                expected_read(path)
            },
            "{path}: {v}"
        );
    }
    let grant = proof(&p, "session-owner").await;
    let (_, members) = status(&p, "/v1/admin/members", "session-owner").await;
    let (_, ctx) = status(&p, "/v1/context", "session-current").await;
    let member = members["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["spec"]["actorId"] == ctx["actorId"])
        .unwrap();
    let mut body = grant.clone();
    body["spec"] = member["spec"].clone();
    body["spec"]["active"] = json!(false);
    let (s, v) = call(
        &p,
        "PUT",
        &format!("/v1/admin/members/{}", member["id"].as_str().unwrap()),
        Some(body),
        "session-owner",
        Uuid::new_v4(),
        member["objectVersion"].as_str().unwrap(),
        grant["reauthTokenRef"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 200, "{v}");
    let audit = p.audit_count().await;
    for path in ROUTES {
        let (s, v) = status(&p, path, "session-current").await;
        assert_eq!(s, 401, "{path}: {v}");
    }
    assert_eq!(audit, p.audit_count().await);
}
