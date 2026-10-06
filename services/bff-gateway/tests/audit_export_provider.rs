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
    request.headers_mut().insert(
        "x-request-id",
        uuid::Uuid::now_v7().to_string().parse().unwrap(),
    );
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
        .insert("idempotency-key", uuid_key(key).parse().unwrap());
    request
        .headers_mut()
        .insert("x-reauth-token-ref", reauth.parse().unwrap());
    request
}

fn uuid_key(label: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    label.hash(&mut hash);
    format!(
        "11111111-1111-4111-8111-{:012x}",
        hash.finish() & 0xffffffffffff
    )
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
    assert!(uuid::Uuid::parse_str(first_body["nextCursor"].as_str().unwrap()).is_ok());
    for item in first_body["items"].as_array().unwrap() {
        assert_eq!(item["redactionApplied"], true);
        assert!(item["redactedPayload"].get("secret").is_none());
        assert_eq!(item["redactedPayload"]["redactionSummary"], "[REDACTED]");
        assert!(item["payloadHash"].as_str().unwrap().starts_with("sha256:"));
    }

    let second = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!(
                "/v1/audit/events?correlationId={CORRELATION}&pageSize=3&cursor={}",
                first_body["nextCursor"].as_str().unwrap()
            ),
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
    assert!(uuid::Uuid::parse_str(first_body["nextCursor"].as_str().unwrap()).is_ok());
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
            &format!(
                "/v1/audit/evidence-chains/{CORRELATION}?pageSize=4&cursor={}",
                first_body["nextCursor"].as_str().unwrap()
            ),
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
    assert_eq!(audit_payload["reason"], "[REDACTED]");
    assert_eq!(audit_payload["watermark"], "[REDACTED]");
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

#[tokio::test]
async fn audit_sort_filter_is_executed_and_unknown_expressions_are_rejected() {
    let router = BffProvider::default().router();
    let response = router.clone().oneshot(authenticated("GET", &format!("/v1/audit/events?correlationId={CORRELATION}&sort=occurredAt:desc&filter=kind:eq:order.accepted"), None)).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    let items = body["items"].as_array().unwrap();
    assert!(!items.is_empty());
    assert!(items.iter().all(|item| item["kind"] == "order.accepted"));
    assert!(
        items
            .windows(2)
            .all(|pair| pair[0]["occurredAt"].as_str() >= pair[1]["occurredAt"].as_str())
    );
    for path in [
        "/v1/audit/events?sort=secret:asc".to_owned(),
        "/v1/audit/events?filter=kind:contains:order".to_owned(),
        format!("/v1/audit/evidence-chains/{CORRELATION}?sort=occurredAt:desc"),
    ] {
        assert_eq!(
            router
                .clone()
                .oneshot(authenticated("GET", &path, None))
                .await
                .unwrap()
                .status(),
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }
}

#[tokio::test]
async fn export_commands_reject_changed_intents_before_audit_or_cancellation() {
    let provider = BffProvider::default();
    let router = provider.router();
    let reauth = recent_auth(&router).await;
    let create = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "intent-create",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    let original = json_body(create).await;
    let first_id = original["exportId"].as_str().unwrap();
    let replay = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "intent-create",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    assert_eq!(json_body(replay).await, original);
    for (field, value) in [
        ("reason", json!("A distinct legitimate purpose")),
        (
            "scope",
            json!({"correlationIds":["bbbbbbbb-1111-4111-8111-111111111111"]}),
        ),
        ("format", json!("csv")),
        ("watermark", json!("Another watermark")),
        ("retentionDays", json!(14)),
    ] {
        let mut body = export_body();
        body[field] = value;
        let conflict = router
            .clone()
            .oneshot(export_mutation(
                "/v1/exports",
                "intent-create",
                &reauth,
                Some(body),
            ))
            .await
            .unwrap();
        assert_eq!(conflict.status(), StatusCode::CONFLICT, "changed {field}");
        assert_eq!(json_body(conflict).await["code"], "IDEMPOTENCY_CONFLICT");
    }
    assert_eq!(provider.audit_action_count("export.created").await, 1);
    let second = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "intent-second",
            &reauth,
            Some(export_body()),
        ))
        .await
        .unwrap();
    let second = json_body(second).await;
    let second_id = second["exportId"].as_str().unwrap();
    let first_path = format!("/v1/exports/{first_id}/cancel");
    let cancelled = router
        .clone()
        .oneshot(export_mutation(&first_path, "intent-cancel", &reauth, None))
        .await
        .unwrap();
    let cancelled = json_body(cancelled).await;
    let replay = router
        .clone()
        .oneshot(export_mutation(&first_path, "intent-cancel", &reauth, None))
        .await
        .unwrap();
    assert_eq!(json_body(replay).await, cancelled);
    let wrong_target = router
        .clone()
        .oneshot(export_mutation(
            &format!("/v1/exports/{second_id}/cancel"),
            "intent-cancel",
            &reauth,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(wrong_target.status(), StatusCode::CONFLICT);
    assert_eq!(
        json_body(wrong_target).await["code"],
        "IDEMPOTENCY_CONFLICT"
    );
    assert_eq!(provider.audit_action_count("export.cancelled").await, 1);
    let unaffected = router
        .clone()
        .oneshot(authenticated(
            "GET",
            &format!("/v1/exports/{second_id}"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(json_body(unaffected).await["status"], "ready");
}

#[tokio::test]
async fn complete_scope_intent_conflicts_without_side_effects_and_rejects_invalid_scope() {
    let provider = BffProvider::default();
    let router = provider.router();
    let grant = recent_auth(&router).await;
    let mut original = export_body();
    original["scope"]["eventKinds"] = json!(["fill.recorded"]);
    original["scope"]["startAt"] = json!("2026-09-01T00:00:00Z");
    original["scope"]["endAt"] = json!("2026-09-30T00:00:00Z");
    let created = router
        .clone()
        .oneshot(export_mutation(
            "/v1/exports",
            "scope-original",
            &grant,
            Some(original.clone()),
        ))
        .await
        .unwrap();
    assert_eq!(created.status(), StatusCode::ACCEPTED);
    for (name, value) in [
        ("eventKinds", json!(["order.accepted"])),
        ("startAt", json!("2026-09-02T00:00:00Z")),
        ("endAt", json!("2026-09-29T00:00:00Z")),
    ] {
        let count = provider.audit_action_count("export.created").await;
        let mut changed = original.clone();
        changed["scope"][name] = value;
        let r = router
            .clone()
            .oneshot(export_mutation(
                "/v1/exports",
                "scope-original",
                &grant,
                Some(changed),
            ))
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::CONFLICT);
        assert_eq!(provider.audit_action_count("export.created").await, count);
    }
    for (label, patch, expected) in [
        (
            "duplicate",
            json!({"correlationIds":[CORRELATION,CORRELATION]}),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        (
            "reverse",
            json!({"correlationIds":[CORRELATION],"startAt":"2026-09-30T00:00:00Z","endAt":"2026-09-01T00:00:00Z"}),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        (
            "hidden",
            json!({"correlationIds":[uuid::Uuid::new_v4()]}),
            StatusCode::NOT_FOUND,
        ),
    ] {
        let mut body = export_body();
        body["scope"] = patch;
        assert_eq!(
            router
                .clone()
                .oneshot(export_mutation("/v1/exports", label, &grant, Some(body)))
                .await
                .unwrap()
                .status(),
            expected
        );
    }
}
#[tokio::test]
async fn opaque_snapshot_cursors_reject_tampering_and_query_reuse() {
    let provider = BffProvider::default();
    let router = provider.router();
    let first = json_body(
        router
            .clone()
            .oneshot(authenticated(
                "GET",
                &format!("/v1/audit/events?correlationId={CORRELATION}&pageSize=3"),
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    let token = first["nextCursor"].as_str().unwrap();
    for path in [
        format!("/v1/audit/events?correlationId={CORRELATION}&pageSize=3&cursor=audit:999"),
        format!("/v1/audit/events?kind=fill.recorded&pageSize=3&cursor={token}"),
        format!("/v1/audit/evidence-chains/{CORRELATION}?pageSize=3&cursor={token}"),
    ] {
        assert_eq!(
            router
                .clone()
                .oneshot(authenticated("GET", &path, None))
                .await
                .unwrap()
                .status(),
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }
    assert!(provider.audit_action_count("audit.search_accessed").await > 0);
}
#[tokio::test]
async fn redaction_hashes_and_retention_are_enforced_by_business_calls() {
    use sha2::{Digest, Sha256};
    let provider = BffProvider::default();
    let router = provider.router();
    let grant = recent_auth(&router).await;
    let secret = "synthetic-account-12345678901234567890 Bearer SECRET_TOKEN";
    let mut body = export_body();
    body["reason"] = json!(secret);
    body["watermark"] = json!(secret);
    let job = json_body(
        router
            .clone()
            .oneshot(export_mutation(
                "/v1/exports",
                "redaction",
                &grant,
                Some(body),
            ))
            .await
            .unwrap(),
    )
    .await;
    let audit = json_body(
        router
            .clone()
            .oneshot(authenticated(
                "GET",
                "/v1/audit/events?kind=export.created",
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    assert!(!audit.to_string().contains(secret));
    let entry = &audit["items"][0];
    let canonical = quantos_core::canonical_json_bytes(&entry["redactedPayload"]).unwrap();
    assert_eq!(
        entry["payloadHash"],
        format!("sha256:{:x}", Sha256::digest(canonical))
    );
    provider.advance_reference_time(Duration::days(31)).await;
    provider.renew_reference_session().await;
    assert_eq!(
        router
            .clone()
            .oneshot(authenticated(
                "GET",
                &format!("/v1/exports/{}/download", job["exportId"].as_str().unwrap()),
                None
            ))
            .await
            .unwrap()
            .status(),
        StatusCode::GONE
    );
}
