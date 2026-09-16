use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use bff_gateway::BffProvider;
use chrono::{DateTime, Duration, Utc};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const COOKIE: &str = "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001";
const VIEWER_COOKIE: &str =
    "quantos_session=session-viewer; quantos_csrf=csrf-token-0000000000000001";
const ORIGIN: &str = "http://localhost:3190";
const CSRF: &str = "csrf-token-0000000000000001";
const CORRELATION: &str = "aaaaaaaa-1111-4111-8111-111111111111";
const EXPIRED_EXPORT: &str = "eeeeeeee-1111-4111-8111-111111111111";

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

fn viewer(method: &str, path: &str) -> Request<Body> {
    let mut request = request(method, path, None);
    request
        .headers_mut()
        .insert("cookie", VIEWER_COOKIE.parse().unwrap());
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
    json_body(response).await["reauthTokenRef"]
        .as_str()
        .unwrap()
        .to_owned()
}

fn export_body() -> Value {
    json!({
        "scope":{"correlationIds":[CORRELATION]},
        "format":"jsonl","reason":"Regulatory evidence review",
        "watermark":"QuantOS audit copy","retentionDays":7
    })
}

fn export_mutation(path: &str, key: &str, reauth: &str, body: Option<Value>) -> Request<Body> {
    let mut request = mutation("POST", path, body);
    request
        .headers_mut()
        .insert("idempotency-key", key.parse().unwrap());
    request
        .headers_mut()
        .insert("x-reauth-token-ref", reauth.parse().unwrap());
    request
}

#[tokio::test]
async fn audit_search_is_capability_guarded_redacted_and_cursor_paginated() {
    let router = BffProvider::default().router();
    assert_eq!(
        router
            .clone()
            .oneshot(request("GET", "/v1/audit/events", None))
            .await
            .unwrap()
            .status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        router
            .clone()
            .oneshot(viewer("GET", "/v1/audit/events"))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );

    let first = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/audit/events?correlationId={CORRELATION}&pageSize=3"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = json_body(first).await;
    assert_eq!(first_body["items"].as_array().unwrap().len(), 3);
    assert_eq!(first_body["nextCursor"], "audit:3");
    for item in first_body["items"].as_array().unwrap() {
        assert_eq!(item["redactionApplied"], true);
        assert_eq!(item["redactedPayload"]["secret"], "[REDACTED]");
        assert!(item["payloadHash"].as_str().unwrap().starts_with("sha256:"));
    }

    let second = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/audit/events?correlationId={CORRELATION}&pageSize=3&cursor=audit%3A3"),
            None,
        ))
        .await
        .unwrap();
    let second_body = json_body(second).await;
    assert_eq!(second_body["items"].as_array().unwrap()[0]["sequence"], 4);

    let invalid_range = router
        .oneshot(authenticated(
            "GET",
            "/v1/audit/events?startAt=2026-09-17T00%3A00%3A00Z&endAt=2026-09-16T00%3A00%3A00Z",
            None,
        ))
        .await
        .unwrap();
    assert_eq!(invalid_range.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn evidence_chain_preserves_causation_order_and_hides_missing_resources() {
    let router = BffProvider::default().router();
    let first = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/audit/evidence-chains/{CORRELATION}?pageSize=4"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = json_body(first).await;
    assert_eq!(first_body["complete"], false);
    assert_eq!(first_body["nextCursor"], "audit:4");
    assert_eq!(first_body["items"][0]["sequence"], 1);
    assert!(first_body["items"][0].get("causationId").is_none());
    assert_eq!(
        first_body["items"][1]["causationId"],
        first_body["items"][0]["eventId"]
    );

    let last = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/audit/evidence-chains/{CORRELATION}?pageSize=4&cursor=audit%3A4"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(json_body(last).await["complete"], true);

    let missing = router
        .clone()
        .oneshot(authenticated(
            "GET",
            "/v1/audit/evidence-chains/bbbbbbbb-1111-4111-8111-111111111111",
            None,
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
async fn export_lifecycle_is_idempotent_watermarked_short_lived_and_audited() {
    let provider = BffProvider::default();
    let router = provider.router();
    let reauth = recent_auth(&router).await;

    let first = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "create-export-1",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::ACCEPTED);
    let first_body = json_body(first).await;
    assert_eq!(first_body["status"], "queued");
    assert!(first_body["auditRef"].as_str().is_some());
    assert!(first_body.get("downloadUrl").is_none());
    let export_id = first_body["exportId"].as_str().unwrap();

    let replay = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "create-export-1",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    assert_eq!(json_body(replay).await["exportId"], export_id);
    assert_eq!(provider.audit_action_count("export.created").await, 1);
    let audit = router
        .clone()
        .oneshot(authenticated(
            "GET",
            "/v1/audit/events?kind=export.created",
            None,
        ))
        .await
        .unwrap();
    let audit_body = json_body(audit).await;
    let audit_payload = &audit_body["items"][0]["redactedPayload"];
    assert_eq!(audit_payload["format"], "jsonl");
    assert_eq!(audit_payload["reason"], "Regulatory evidence review");
    assert_eq!(audit_payload["watermark"], "QuantOS audit copy");
    assert_eq!(audit_payload["retentionDays"], 7);

    let status = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/exports/{export_id}"),
            None,
        ))
        .await
        .unwrap();
    let status_body = json_body(status).await;
    assert_eq!(status_body["status"], "ready");
    assert!(status_body.get("downloadUrl").is_none());

    let download = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/exports/{export_id}/download"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(download.status(), StatusCode::OK);
    let download_body = json_body(download).await;
    assert_eq!(download_body["watermarked"], true);
    assert!(
        download_body["downloadUrl"]
            .as_str()
            .unwrap()
            .starts_with("https://downloads.invalid/")
    );
    let expires_at = DateTime::parse_from_rfc3339(download_body["expiresAt"].as_str().unwrap())
        .unwrap()
        .with_timezone(&Utc);
    assert!(expires_at > Utc::now());
    assert!(expires_at <= Utc::now() + Duration::minutes(5));
    assert_eq!(provider.audit_action_count("export.status_viewed").await, 1);
    assert_eq!(
        provider.audit_action_count("export.download_issued").await,
        1
    );
}

#[tokio::test]
async fn export_cancel_expiry_and_validation_fail_closed() {
    let provider = BffProvider::default();
    let router = provider.router();
    let reauth = recent_auth(&router).await;

    let invalid = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "invalid-export",
            &reauth,
            Some(json!({
                "scope":{"correlationIds":[]},"format":"raw","reason":"short",
                "watermark":"x","retentionDays":31
            })),
        ))
        .await
        .unwrap();
    assert_eq!(invalid.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let created = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "create-export-cancel",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    let export_id = json_body(created).await["exportId"]
        .as_str()
        .unwrap()
        .to_owned();
    let cancelled = router
        .clone()
        .oneshot(export_mutation(
            &format!("/v1/exports/{export_id}/cancel"),
            "cancel-export-1",
            &reauth,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(cancelled.status(), StatusCode::ACCEPTED);
    assert_eq!(json_body(cancelled).await["status"], "cancelled");
    assert_eq!(provider.audit_action_count("export.cancelled").await, 1);

    let cancelled_download = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/exports/{export_id}/download"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(cancelled_download.status(), StatusCode::CONFLICT);

    let expired = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/exports/{EXPIRED_EXPORT}/download"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(expired.status(), StatusCode::GONE);
}
