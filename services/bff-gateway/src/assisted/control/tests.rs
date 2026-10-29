use super::super::tests::{call, proof};
use super::*;
async fn read(app: &Router) -> Value {
    let (s, v) = call(
        app,
        "session-current",
        "GET",
        "/v1/risk/kill-switch",
        json!({}),
        "read",
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v
}
async fn send(
    app: &Router,
    who: &str,
    action: &str,
    scope: &str,
    generation: &str,
    key: &str,
    permit: Option<&str>,
) -> (StatusCode, Value) {
    let mut b = proof(app, who).await;
    b["scope"] = json!(scope);
    b["accountId"] = if scope == "global" {
        Value::Null
    } else {
        json!("44444444-4444-4444-8444-444444444444")
    };
    b["expectedGeneration"] = json!(generation);
    b["reason"] = json!("owned current control test");
    b["confirmPhrase"] = json!(format!(
        "{} {} {}",
        if action == "engage" {
            "ENGAGE"
        } else if action == "release" {
            "RELEASE"
        } else {
            "APPROVE"
        },
        scope.to_uppercase(),
        if action == "release-approvals" {
            "RELEASE"
        } else {
            "KILL"
        }
    ));
    if let Some(p) = permit {
        b["approvalRef"] = json!(p);
    }
    call(
        app,
        who,
        "POST",
        &format!("/v1/risk/kill-switch/{action}"),
        b,
        key,
    )
    .await
}
#[tokio::test]
async fn account_engage_review_owner_release_keeps_old_decision_generation_invalid() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let (s, rows) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "subjects",
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert!(!rows["items"].as_array().unwrap().is_empty());
    let (s, _) = send(
        &app,
        "session-current",
        "engage",
        "account",
        "0",
        "engage",
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let v = read(&app).await;
    assert_eq!(v["generation"], "1");
    assert_eq!(v["nativeGeneration"], "1");
    assert_eq!(v["nativeStopped"], true);
    let (s, a) = send(
        &app,
        "session-approver",
        "release-approvals",
        "account",
        "1",
        "review",
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{a}");
    let (s, r) = send(
        &app,
        "session-owner",
        "release",
        "account",
        "1",
        "release",
        a["event"]["eventId"].as_str(),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{r}");
    let v = read(&app).await;
    assert_eq!(v["generation"], "2");
    assert_eq!(v["nativeStopped"], false);
    assert_eq!(v["protectedCommands"], 0);
    let (_, after) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "after",
    )
    .await;
    assert_eq!(after["items"], json!([]));
    let (_, chain) = call(
        &app,
        "session-current",
        "GET",
        &format!(
            "/v1/audit/evidence-chains/{}",
            r["event"]["correlationId"].as_str().unwrap()
        ),
        json!({}),
        "chain",
    )
    .await;
    assert_eq!(chain["items"].as_array().unwrap().len(), 3);
}
#[tokio::test]
async fn global_requires_owner_and_release_requires_independent_review() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    assert_eq!(
        send(
            &app,
            "session-current",
            "engage",
            "global",
            "0",
            "denied",
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(
            &app,
            "session-owner",
            "engage",
            "global",
            "0",
            "global",
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let (s, a) = send(
        &app,
        "session-owner",
        "release-approvals",
        "global",
        "1",
        "self",
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(
        send(
            &app,
            "session-owner",
            "release",
            "global",
            "1",
            "self-release",
            a["event"]["eventId"].as_str()
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let (s, a) = send(
        &app,
        "session-approver",
        "release-approvals",
        "global",
        "1",
        "other",
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(
        send(
            &app,
            "session-owner",
            "release",
            "global",
            "1",
            "release",
            a["event"]["eventId"].as_str()
        )
        .await
        .0,
        StatusCode::OK
    );
}
#[tokio::test]
async fn layered_global_account_release_does_not_clear_other_stop() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    assert_eq!(
        send(&app, "session-current", "engage", "account", "0", "a", None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        send(&app, "session-owner", "engage", "global", "1", "g", None)
            .await
            .0,
        StatusCode::OK
    );
    let (_, a) = send(
        &app,
        "session-approver",
        "release-approvals",
        "account",
        "2",
        "review-a",
        None,
    )
    .await;
    assert_eq!(
        send(
            &app,
            "session-owner",
            "release",
            "account",
            "2",
            "release-a",
            a["event"]["eventId"].as_str()
        )
        .await
        .0,
        StatusCode::OK
    );
    let v = read(&app).await;
    assert_eq!(v["generation"], "3");
    assert_eq!(v["accountActive"], false);
    assert_eq!(v["globalActive"], true);
    assert_eq!(v["nativeStopped"], true);
}
#[tokio::test]
async fn stale_cas_wrong_role_and_disabled_refuse_without_generation_change() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    assert_eq!(
        send(
            &app,
            "session-current",
            "engage",
            "account",
            "1",
            "stale",
            None
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        send(
            &app,
            "session-approver",
            "engage",
            "account",
            "0",
            "wrong-role",
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(read(&app).await["generation"], "0");
    let off = crate::BffProvider::assisted_reference(false).router();
    assert_eq!(
        send(&off, "session-owner", "engage", "global", "0", "off", None)
            .await
            .0,
        StatusCode::FORBIDDEN
    );
}

async fn intent(app: &Router) -> Value {
    let mut b = proof(app, "session-current").await;
    b["scope"] = json!("account");
    b["accountId"] = json!("44444444-4444-4444-8444-444444444444");
    b["expectedGeneration"] = json!("0");
    b["reason"] = json!("owned control refusal probe");
    b["confirmPhrase"] = json!("ENGAGE ACCOUNT KILL");
    b
}
#[tokio::test]
async fn malformed_scope_generation_confirmation_proofs_and_csrf_do_not_mutate() {
    use axum::body::Body;
    use tower::ServiceExt;
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let original = intent(&app).await;
    for (field, value, expected) in [
        ("scope", json!("venue"), StatusCode::UNPROCESSABLE_ENTITY),
        ("accountId", json!(Uuid::new_v4()), StatusCode::FORBIDDEN),
        (
            "expectedGeneration",
            json!("00"),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        (
            "expectedGeneration",
            json!("18446744073709551616"),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        (
            "confirmPhrase",
            json!("yes"),
            StatusCode::UNPROCESSABLE_ENTITY,
        ),
        ("reason", json!("\n"), StatusCode::UNPROCESSABLE_ENTITY),
        (
            "mfaChallengeRef",
            json!(Uuid::new_v4()),
            StatusCode::FORBIDDEN,
        ),
        (
            "reauthTokenRef",
            json!(Uuid::new_v4()),
            StatusCode::FORBIDDEN,
        ),
    ] {
        let mut b = original.clone();
        b[field] = value;
        let (s, v) = call(
            &app,
            "session-current",
            "POST",
            "/v1/risk/kill-switch/engage",
            b,
            field,
        )
        .await;
        assert_eq!(s, expected, "{field}: {v}");
    }
    let r = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri("/v1/risk/kill-switch/engage")
                .header("cookie", "quantos_session=session-current")
                .header("content-type", "application/json")
                .header("idempotency-key", Uuid::new_v4().to_string())
                .body(Body::from(original.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(r.status(), StatusCode::FORBIDDEN);
    assert_eq!(read(&app).await["generation"], "0");
}
#[tokio::test]
async fn expired_mfa_or_independent_review_cannot_release_or_extend_original_key() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    let b = intent(&app).await;
    p.advance_reference_time(Duration::seconds(121)).await;
    assert_eq!(
        call(
            &app,
            "session-current",
            "POST",
            "/v1/risk/kill-switch/engage",
            b,
            "expired"
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        send(
            &app,
            "session-current",
            "engage",
            "account",
            "0",
            "kill",
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, permit) = send(
        &app,
        "session-approver",
        "release-approvals",
        "account",
        "1",
        "permit",
        None,
    )
    .await;
    p.advance_reference_time(Duration::seconds(121)).await;
    assert_eq!(
        send(
            &app,
            "session-owner",
            "release",
            "account",
            "1",
            "expired-permit",
            permit["event"]["eventId"].as_str()
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(read(&app).await["nativeStopped"], true);
}
#[tokio::test]
async fn journal_hash_and_signed_current_risk_mismatch_fail_closed() {
    let p = crate::BffProvider::assisted_reference(true);
    let app = p.router();
    assert_eq!(
        send(
            &app,
            "session-current",
            "engage",
            "account",
            "0",
            "kill",
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    {
        let mut s = p.data.lock().await;
        let h = s.assisted.as_mut().unwrap();
        h.controls.records[0].reason = "changed after signing".into();
    }
    assert_eq!(
        call(
            &app,
            "session-current",
            "GET",
            "/v1/risk/kill-switch",
            json!({}),
            "read"
        )
        .await
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
