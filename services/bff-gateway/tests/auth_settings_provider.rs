use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use bff_gateway::BffProvider;
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const COOKIE: &str = "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001";
const ORIGIN: &str = "http://localhost:3190";
const CSRF: &str = "csrf-token-0000000000000001";

fn request(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut builder = Request::builder().method(method).uri(path);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    builder
        .body(Body::from(
            body.map_or_else(String::new, |value| value.to_string()),
        ))
        .unwrap()
}

fn authenticated(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut request = request(method, path, body);
    request
        .headers_mut()
        .insert("cookie", COOKIE.parse().unwrap());
    request
}

fn mutation(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut request = authenticated(method, path, body);
    request
        .headers_mut()
        .insert("origin", ORIGIN.parse().unwrap());
    request
        .headers_mut()
        .insert("x-csrf-token", CSRF.parse().unwrap());
    request
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

async fn recent_auth(router: &Router) -> String {
    let challenge_response = router
        .clone()
        .oneshot(mutation(
            "POST",
            "/v1/auth/mfa/challenges",
            Some(json!({"purpose":"security_change","code":"123456"})),
        ))
        .await
        .unwrap();
    assert_eq!(challenge_response.status(), StatusCode::OK);
    let challenge = json_body(challenge_response).await;
    let response = router
        .clone()
        .oneshot(mutation(
            "POST",
            "/v1/auth/reauth",
            Some(json!({"challengeRef":challenge["challengeRef"]})),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await["reauthTokenRef"]
        .as_str()
        .unwrap()
        .to_owned()
}

fn protected_mutation(method: &str, path: &str, key: &str, reauth: &str) -> Request<Body> {
    let mut request = mutation(method, path, None);
    request
        .headers_mut()
        .insert("idempotency-key", key.parse().unwrap());
    request
        .headers_mut()
        .insert("x-reauth-token-ref", reauth.parse().unwrap());
    request
}

#[tokio::test]
async fn authentication_csrf_and_resource_failures_fail_closed() {
    let router = BffProvider::default().router();

    let unauthenticated = router
        .clone()
        .oneshot(request("GET", "/v1/session", None))
        .await
        .unwrap();
    assert_eq!(unauthenticated.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(json_body(unauthenticated).await["code"], "UNAUTHENTICATED");

    let csrf_missing = router
        .clone()
        .oneshot(authenticated(
            "PUT",
            "/v1/settings/profile",
            Some(json!({})),
        ))
        .await
        .unwrap();
    assert_eq!(csrf_missing.status(), StatusCode::FORBIDDEN);

    let bad_origin = {
        let mut request = mutation("PUT", "/v1/settings/profile", Some(json!({})));
        request
            .headers_mut()
            .insert("origin", "https://evil.example".parse().unwrap());
        request
    };
    assert_eq!(
        router.clone().oneshot(bad_origin).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );

    let reauth = recent_auth(&router).await;
    let missing = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/sessions/missing-session",
            "missing-session-key",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        json_body(missing).await["message"],
        "资源不存在或无权访问。"
    );
}

#[tokio::test]
async fn mfa_rate_limit_is_account_neutral() {
    let router = BffProvider::default().router();
    for attempt in 1..=5 {
        let response = router
            .clone()
            .oneshot(mutation(
                "POST",
                "/v1/auth/mfa/challenges",
                Some(json!({"purpose":"login","code":"000000"})),
            ))
            .await
            .unwrap();
        if attempt < 5 {
            assert_eq!(response.status(), StatusCode::OK);
        } else {
            assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
            let body = json_body(response).await;
            assert_eq!(body["retryAfter"], 60);
            assert!(!body["message"].as_str().unwrap().contains("账户"));
        }
    }
}

#[tokio::test]
async fn session_revocation_requires_recent_auth_is_idempotent_and_emits_sse_audit() {
    let provider = BffProvider::default();
    let router = provider.router();

    let without_reauth = {
        let mut request = mutation("DELETE", "/v1/settings/sessions/session-remote", None);
        request
            .headers_mut()
            .insert("idempotency-key", "revoke-session-1".parse().unwrap());
        request
    };
    assert_eq!(
        router
            .clone()
            .oneshot(without_reauth)
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );

    let reauth = recent_auth(&router).await;
    let first = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/sessions/session-remote",
            "revoke-session-1",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::ACCEPTED);
    let first_body = json_body(first).await;
    assert!(first_body["auditRef"].as_str().is_some());

    let replay = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/sessions/session-remote",
            "revoke-session-1",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(replay.status(), StatusCode::ACCEPTED);
    assert_eq!(json_body(replay).await["jobId"], first_body["jobId"]);
    assert_eq!(provider.audit_count().await, 1);

    let stream = router
        .clone()
        .oneshot(authenticated(
            "GET",
            "/v1/settings/sessions/stream?afterSequence=0",
            None,
        ))
        .await
        .unwrap();
    assert_eq!(stream.status(), StatusCode::OK);
    assert_eq!(stream.headers()["content-type"], "text/event-stream");
    let body = String::from_utf8(
        stream
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes()
            .to_vec(),
    )
    .unwrap();
    assert!(body.contains("permission_revoked"));
    assert!(body.contains("session-remote"));
}

#[tokio::test]
async fn current_session_and_last_mfa_factor_are_protected() {
    let router = BffProvider::default().router();
    let reauth = recent_auth(&router).await;

    let current = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/sessions/session-current",
            "current-session",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(current.status(), StatusCode::CONFLICT);
    assert_eq!(
        json_body(current).await["code"],
        "CURRENT_SESSION_PROTECTED"
    );

    let first = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/mfa/factors/factor-passkey",
            "factor-1",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::ACCEPTED);

    let last = router
        .clone()
        .oneshot(protected_mutation(
            "DELETE",
            "/v1/settings/mfa/factors/factor-totp",
            "factor-2",
            &reauth,
        ))
        .await
        .unwrap();
    assert_eq!(last.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(last).await["code"], "LAST_FACTOR_PROTECTED");
}

#[tokio::test]
async fn stale_settings_write_returns_current_version_without_mutation() {
    let router = BffProvider::default().router();
    let mut request = mutation(
        "PUT",
        "/v1/settings/profile",
        Some(json!({"displayName":"stale"})),
    );
    request
        .headers_mut()
        .insert("if-match", "profile-v0".parse().unwrap());
    request
        .headers_mut()
        .insert("idempotency-key", "profile-save-1".parse().unwrap());
    let response = router.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(json_body(response).await["currentVersion"], "profile-v1");

    let current = router
        .clone()
        .oneshot(authenticated("GET", "/v1/settings/profile", None))
        .await
        .unwrap();
    assert_eq!(json_body(current).await["objectVersion"], "profile-v1");
}

#[tokio::test]
async fn logout_expires_secure_http_only_same_site_cookie() {
    let router = BffProvider::default().router();
    let response = router
        .clone()
        .oneshot(mutation("POST", "/v1/auth/logout", None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    let cookie = response.headers()["set-cookie"].to_str().unwrap();
    assert!(cookie.contains("Secure"));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Strict"));

    let after = router
        .clone()
        .oneshot(authenticated("GET", "/v1/session", None))
        .await
        .unwrap();
    assert_eq!(after.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn public_access_request_validates_origin_and_body_and_writes_audit() {
    let provider = BffProvider::default();
    let router = provider.router();
    let valid_body = json!({
        "teamName":"Research", "contactEmail":"research@example.com",
        "purpose":"Paper research", "markets":["digital-assets"],
        "expectedMode":"paper", "privacyNoticeVersion":"2026-09-16"
    });

    let untrusted = request("POST", "/v1/access-requests", Some(valid_body.clone()));
    assert_eq!(
        router.clone().oneshot(untrusted).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );

    let mut invalid = request(
        "POST",
        "/v1/access-requests",
        Some(json!({
            "teamName":"", "contactEmail":"invalid", "purpose":"", "markets":[],
            "expectedMode":"paper", "privacyNoticeVersion":"2026-09-16"
        })),
    );
    invalid
        .headers_mut()
        .insert("origin", ORIGIN.parse().unwrap());
    assert_eq!(
        router.clone().oneshot(invalid).await.unwrap().status(),
        StatusCode::UNPROCESSABLE_ENTITY
    );

    let mut valid = request("POST", "/v1/access-requests", Some(valid_body));
    valid
        .headers_mut()
        .insert("origin", ORIGIN.parse().unwrap());
    let accepted = router.clone().oneshot(valid).await.unwrap();
    assert_eq!(accepted.status(), StatusCode::ACCEPTED);
    assert!(json_body(accepted).await["auditRef"].as_str().is_some());
    assert_eq!(provider.audit_count().await, 1);
}

#[tokio::test]
async fn notification_save_is_idempotent_and_audited() {
    let provider = BffProvider::default();
    let router = provider.router();
    let mut save = mutation(
        "PUT",
        "/v1/settings/notification-preferences",
        Some(json!({})),
    );
    save.headers_mut()
        .insert("if-match", "notifications-v1".parse().unwrap());
    save.headers_mut()
        .insert("idempotency-key", "notification-save-1".parse().unwrap());

    let first = router.clone().oneshot(save).await.unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = json_body(first).await;
    assert_eq!(first_body["objectVersion"], "notifications-v2");

    let mut replay = mutation(
        "PUT",
        "/v1/settings/notification-preferences",
        Some(json!({})),
    );
    replay
        .headers_mut()
        .insert("if-match", "notifications-v1".parse().unwrap());
    replay
        .headers_mut()
        .insert("idempotency-key", "notification-save-1".parse().unwrap());
    let replayed = router.clone().oneshot(replay).await.unwrap();
    assert_eq!(replayed.status(), StatusCode::OK);
    assert_eq!(
        json_body(replayed).await["objectVersion"],
        "notifications-v2"
    );
    assert_eq!(provider.audit_count().await, 1);
}
