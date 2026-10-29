use super::*;
use crate::assisted::tests::{call, proof};
use axum::body::{Body, to_bytes};
use tower::ServiceExt;
async fn view(app: &Router) -> Value {
    let (s, v) = call(
        app,
        "session-current",
        "GET",
        "/v1/admin/feature-flags",
        json!({}),
        "read",
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v["items"][0].clone()
}
async fn body(app: &Router, who: &str, view: &Value, enabled: bool) -> Value {
    let mut b = proof(app, who).await;
    b["scope"] = json!({"tenantId":view["tenantId"],"workspaceId":view["workspaceId"],"accountId":view["accountId"],"mode":"assisted_live","featureKey":"execution.assisted-testnet"});
    b["enabled"] = json!(enabled);
    b["validUntil"] = json!(now(Utc::now()) + Duration::minutes(2));
    b["reason"] = json!("owned scoped activation review");
    b["confirmPhrase"] = json!(if enabled {
        "ENABLE ASSISTED TESTNET"
    } else {
        "DISABLE ASSISTED TESTNET"
    });
    b
}
async fn put(app: &Router, who: &str, v: &Value, b: Value, key: &str) -> (StatusCode, Value) {
    let r = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("PUT")
                .uri(format!(
                    "/v1/admin/feature-flags/{}",
                    v["resourceId"].as_str().unwrap()
                ))
                .header(
                    "cookie",
                    format!("quantos_session={who}; quantos_csrf={}", crate::CSRF_TOKEN),
                )
                .header("origin", crate::ALLOWED_ORIGIN)
                .header("x-csrf-token", crate::CSRF_TOKEN)
                .header("if-match", v["version"].as_str().unwrap())
                .header("idempotency-key", key)
                .header("x-request-id", Uuid::new_v4().to_string())
                .header("content-type", "application/json")
                .body(Body::from(b.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let s = r.status();
    let bytes = to_bytes(r.into_body(), 1_000_000).await.unwrap();
    (s, serde_json::from_slice(&bytes).unwrap())
}
#[tokio::test]
async fn versioned_public_c11_controls_runtime_without_changing_risk_or_approval_revisions() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let initial = view(&app).await;
    assert_eq!(initial["source"], "owner_reference_bootstrap");
    assert_eq!(initial["version"], "0");
    assert_eq!(initial["effective"], true);
    let b = body(&app, "session-owner", &initial, false).await;
    let key = Uuid::new_v4().to_string();
    let (s, receipt) = put(&app, "session-owner", &initial, b.clone(), &key).await;
    assert_eq!(s, StatusCode::OK, "{receipt}");
    let off = view(&app).await;
    assert_eq!(off["effective"], false);
    assert_eq!(off["version"], "1");
    assert_eq!(off["killGeneration"], "0");
    assert_eq!(off["nativeActivationVersion"], "1");
    let (_, caps) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/capabilities",
        json!({}),
        "caps",
    )
    .await;
    assert_eq!(caps["serverFlagEnabled"], false);
    assert_eq!(caps["targetEnabled"], true);
    assert_eq!(caps["canRequest"], false);
    assert_eq!(caps["policyRevision"], 1);
    assert_eq!(
        put(&app, "session-owner", &initial, b.clone(), &key)
            .await
            .1,
        receipt
    );
    let mut changed = b.clone();
    changed["reason"] = json!("changed body");
    assert_eq!(
        put(&app, "session-owner", &initial, changed, &key).await.0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        put(
            &app,
            "session-owner",
            &initial,
            b,
            &Uuid::new_v4().to_string()
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let b = body(&app, "session-owner", &off, true).await;
    assert_eq!(
        put(&app, "session-owner", &off, b, &Uuid::new_v4().to_string())
            .await
            .0,
        StatusCode::OK
    );
    let on = view(&app).await;
    assert_eq!(on["effective"], true);
    assert_eq!(on["version"], "2");
    assert_eq!(on["killGeneration"], "0");
    let history = format!(
        "/v1/admin/feature-flags/{}/history",
        on["resourceId"].as_str().unwrap()
    );
    let (s, page) = call(
        &app,
        "session-current",
        "GET",
        &(history.clone() + "?pageSize=1"),
        json!({}),
        "history",
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(page["items"][0]["source"], "owner_reference_bootstrap");
    assert!(page["nextCursor"].is_string());
    let cursor = page["nextCursor"].as_str().unwrap();
    let (_, page2) = call(
        &app,
        "session-current",
        "GET",
        &format!("{history}?cursor={cursor}&pageSize=1"),
        json!({}),
        "page2",
    )
    .await;
    assert_eq!(page2["items"][0]["version"], "1");
    assert_eq!(
        page2["items"][0]["previous"],
        page["items"][0]["recordHash"]
    );
    let (_, chain) = call(
        &app,
        "session-current",
        "GET",
        &format!(
            "/v1/audit/evidence-chains/{}",
            on["resourceId"].as_str().unwrap()
        ),
        json!({}),
        "chain",
    )
    .await;
    assert_eq!(chain["items"].as_array().unwrap().len(), 3);
}
#[tokio::test]
async fn owner_role_scope_ceiling_cas_and_mfa_are_required() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let v = view(&app).await;
    for who in ["session-current", "session-approver"] {
        let b = body(&app, who, &v, false).await;
        assert_eq!(
            put(&app, who, &v, b, &Uuid::new_v4().to_string()).await.0,
            StatusCode::FORBIDDEN
        );
    }
    for field in [
        "scope",
        "mfaChallengeRef",
        "reauthTokenRef",
        "confirmPhrase",
        "validUntil",
    ] {
        let mut b = body(&app, "session-owner", &v, false).await;
        b[field] = if field == "scope" {
            json!({})
        } else if field == "validUntil" {
            json!(now(Utc::now()) + Duration::minutes(11))
        } else {
            json!("wrong")
        };
        assert_ne!(
            put(&app, "session-owner", &v, b, &Uuid::new_v4().to_string())
                .await
                .0,
            StatusCode::OK
        );
    }
    let mut stale = v.clone();
    stale["version"] = json!("1");
    let b = body(&app, "session-owner", &v, false).await;
    assert_eq!(
        put(
            &app,
            "session-owner",
            &stale,
            b,
            &Uuid::new_v4().to_string()
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(view(&app).await["version"], "0");
    let off = crate::BffProvider::assisted_reference(false).router();
    let v = view(&off).await;
    let b = body(&off, "session-owner", &v, true).await;
    assert_eq!(
        put(&off, "session-owner", &v, b, &Uuid::new_v4().to_string())
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(view(&off).await["effective"], false);
}
#[tokio::test]
async fn expiry_is_time_gate_without_automatic_history_generation_or_native_reset() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let v = view(&app).await;
    let mut b = body(&app, "session-owner", &v, true).await;
    b["validUntil"] = json!(now(Utc::now()) + Duration::seconds(1));
    assert_eq!(
        put(&app, "session-owner", &v, b, &Uuid::new_v4().to_string())
            .await
            .0,
        StatusCode::OK
    );
    p.advance_reference_time(Duration::seconds(2)).await;
    let v = view(&app).await;
    assert_eq!(v["enabled"], true);
    assert_eq!(v["effective"], false);
    assert_eq!(v["version"], "1");
    assert_eq!(v["historyCount"], 2);
    assert_eq!(v["killGeneration"], "0");
    let (s, _) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":Uuid::new_v4()}),
        "expired",
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}
#[tokio::test]
async fn corrupt_journal_and_reused_expired_proof_fail_closed() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let v = view(&app).await;
    let b = body(&app, "session-owner", &v, false).await;
    p.advance_reference_time(Duration::seconds(121)).await;
    assert_eq!(
        put(&app, "session-owner", &v, b, &Uuid::new_v4().to_string())
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    p.data
        .lock()
        .await
        .assisted
        .as_mut()
        .unwrap()
        .activation
        .records[0]
        .enabled = false;
    let (s, _) = call(
        &app,
        "session-owner",
        "GET",
        "/v1/admin/feature-flags",
        json!({}),
        "corrupt",
    )
    .await;
    assert_eq!(s, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn revoked_owner_cannot_replay_a_committed_activation_or_consume_new_proof() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let v = view(&app).await;
    let b = body(&app, "session-owner", &v, false).await;
    let key = Uuid::new_v4().to_string();
    assert_eq!(
        put(&app, "session-owner", &v, b.clone(), &key).await.0,
        StatusCode::OK
    );
    p.data
        .lock()
        .await
        .assisted
        .as_ref()
        .unwrap()
        .service
        .revoke_session("session-owner")
        .unwrap();
    assert_eq!(
        put(&app, "session-owner", &v, b, &key).await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(view(&app).await["version"], "1");
    assert_eq!(view(&app).await["historyCount"], 2);
}
