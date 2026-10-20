use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
fn auth() -> AuthContext {
    crate::operations::command_auth(crate::CURRENT_SESSION, false)
}
fn summary(a: &AuthContext, now: DateTime<Utc>) -> Value {
    compose(
        a,
        [
            research_source(a, &[], now),
            unavailable("execution", "unavailable"),
            unavailable("operations", "unavailable"),
            unavailable("strategy", "forbidden"),
        ],
        now,
    )
}
async fn http(p: &crate::BffProvider, path: &str, session: &str) -> (u16, Value) {
    let response = p
        .router()
        .oneshot(
            Request::builder()
                .uri(path)
                .header("cookie", format!("quantos_session={session}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    assert_eq!(
        response
            .headers()
            .get("cache-control")
            .map(|v| v.to_str().unwrap()),
        Some("no-store")
    );
    let bytes = to_bytes(response.into_body(), 1048576).await.unwrap();
    let value=serde_json::from_slice(&bytes).unwrap_or_else(|_|json!({"events":String::from_utf8_lossy(&bytes).lines().filter_map(|s|s.strip_prefix("data: ")).map(|s|serde_json::from_str::<Value>(s).unwrap()).collect::<Vec<_>>()}));
    (status, value)
}
#[tokio::test]
async fn actual_four_sources_are_authorized_bounded_and_reads_do_not_acquire_authority() {
    let p = crate::BffProvider::default();
    let (s, v) = http(&p, "/v1/command/summary", crate::CURRENT_SESSION).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(v["sources"].as_array().unwrap().len(), 4);
    assert_ne!(v["riskPosture"], "unknown");
    assert!(v["orderSummary"].is_object());
    let before = p
        .data
        .lock()
        .await
        .execution
        .as_ref()
        .unwrap()
        .downstream_counts();
    let audit = p.audit_count().await;
    for _ in 0..20 {
        assert_eq!(
            http(&p, "/v1/command/summary", crate::CURRENT_SESSION)
                .await
                .0,
            200
        )
    }
    assert_eq!(
        p.data
            .lock()
            .await
            .execution
            .as_ref()
            .unwrap()
            .downstream_counts(),
        before
    );
    assert_eq!(p.audit_count().await, audit);
}
#[tokio::test]
async fn unknown_identity_viewer_and_foreign_account_never_receive_aggregate() {
    let p = crate::BffProvider::default();
    for (session, status) in [("missing", 401), (crate::VIEWER_SESSION, 403)] {
        assert_eq!(http(&p, "/v1/command/summary", session).await.0, status)
    }
    assert_eq!(
        http(
            &p,
            &format!("/v1/command/summary?accountId={}", Uuid::new_v4()),
            crate::CURRENT_SESSION
        )
        .await
        .0,
        404
    );
}
#[tokio::test]
async fn owner_and_operator_use_their_actual_domain_capabilities() {
    let p = crate::BffProvider::default();
    let (_, operator) = http(&p, "/v1/command/summary", crate::CURRENT_SESSION).await;
    let (s, owner) = http(&p, "/v1/command/summary", "session-owner").await;
    assert_eq!(s, 200);
    assert!(operator["runningRuns"].is_number());
    assert_eq!(owner["runningRuns"], Value::Null);
    assert_eq!(owner["orderSummary"], Value::Null);
    assert!(
        owner["recentActivity"]
            .as_array()
            .unwrap()
            .iter()
            .all(|v| v["kind"] != "run" && v["kind"] != "order")
    );
}
#[tokio::test]
async fn stale_sources_are_explicit_and_never_show_zero_or_fresh_risk() {
    let p = crate::BffProvider::default();
    let _ = http(&p, "/v1/command/summary", crate::CURRENT_SESSION).await;
    p.advance_reference_time(Duration::seconds(61)).await;
    let (s, v) = http(&p, "/v1/command/summary", crate::CURRENT_SESSION).await;
    assert_eq!(s, 200);
    assert_eq!(v["riskPosture"], "unknown");
    assert_eq!(v["orderSummary"], Value::Null);
    assert_eq!(v["systemHealth"], Value::Null);
    assert_eq!(v["openRiskAlerts"], Value::Null);
    assert_eq!(v["partial"], true);
}
#[tokio::test]
async fn shared_governance_quarantine_and_expired_session_refuse_old_streams() {
    let p = crate::BffProvider::default();
    assert_eq!(
        http(&p, "/v1/command/stream", crate::CURRENT_SESSION)
            .await
            .0,
        200
    );
    p.data.lock().await.operations.as_mut().unwrap().poisoned = true;
    assert_eq!(
        http(&p, "/v1/command/summary", crate::CURRENT_SESSION)
            .await
            .0,
        503
    );
    let p = crate::BffProvider::default();
    p.advance_reference_time(Duration::seconds(301)).await;
    assert_eq!(
        http(&p, "/v1/command/summary", crate::CURRENT_SESSION)
            .await
            .0,
        401
    );
}
#[test]
fn source_failures_and_scope_changes_do_not_fabricate_empty_success() {
    let a = auth();
    let n = Utc::now();
    let s = summary(&a, n);
    assert_eq!(s["orderSummary"], Value::Null);
    assert_eq!(s["pendingApprovals"], Value::Null);
    let mut other = a.clone();
    other.account_id = Some(quantos_core::AccountId::from_uuid(Uuid::new_v4()));
    let e = crate::execution::ExecutionService::reference();
    assert_eq!(e.command_source(&other, n)["status"], "unavailable");
}
#[test]
fn oversized_research_source_fails_closed_and_does_not_claim_zero() {
    let a = auth();
    let rows = vec![json!({}); ROW_LIMIT + 1];
    assert_eq!(
        research_source(&a, &rows, Utc::now())["status"],
        "unavailable"
    );
}
#[test]
fn research_projection_strips_prompts_actors_and_raw_payloads() {
    let a = auth();
    let n = Utc::now();
    let id = Uuid::new_v4();
    let rows = vec![
        json!({"runId":id,"createdAt":n,"status":"failed","question":"PRIVATE_PROMPT","actor":"PRIVATE_ACTOR","raw":"PRIVATE_SECRET"}),
    ];
    let v = research_source(&a, &rows, n);
    assert_eq!(v["data"]["failedRuns"], 1);
    assert_eq!(
        v["data"]["items"][0]["objectRef"],
        format!("/research/runs/{id}")
    );
    assert!(!v.to_string().contains("PRIVATE_"));
}
#[test]
fn immutable_revision_ignores_sample_time_but_tracks_source_status() {
    let a = auth();
    let n = Utc::now();
    let first = summary(&a, n);
    let next = summary(&a, n + Duration::seconds(1));
    assert_eq!(first["revision"], next["revision"]);
    assert_ne!(first["sampledAt"], next["sampledAt"]);
}
#[test]
fn stream_replays_exact_frames_without_false_new_events() {
    let a = auth();
    let n = Utc::now();
    let mut streams = CommandStreams::default();
    let first = streams
        .response(
            &a,
            "session",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n,
        )
        .unwrap();
    let id = first["streamId"].as_str().unwrap();
    let q = BTreeMap::from([
        ("streamId".into(), id.into()),
        ("afterSequence".into(), "0".into()),
    ]);
    let replay = streams
        .response(
            &a,
            "session",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n + Duration::seconds(1)),
            n + Duration::seconds(1),
        )
        .unwrap();
    assert_eq!(first, replay);
    let mut q = q;
    q.insert("afterSequence".into(), "1".into());
    assert!(
        streams
            .response(
                &a,
                "session",
                "/v1/command/stream",
                &q,
                &HeaderMap::new(),
                summary(&a, n),
                n
            )
            .unwrap()["events"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}
#[test]
fn stream_scope_expiry_and_future_sequence_refuse_recovery() {
    let a = auth();
    let n = Utc::now();
    let mut s = CommandStreams::default();
    let first = s
        .response(
            &a,
            "session",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n,
        )
        .unwrap();
    let mut q = BTreeMap::from([(
        "streamId".into(),
        first["streamId"].as_str().unwrap().into(),
    )]);
    for session in ["other"] {
        assert!(
            s.response(
                &a,
                session,
                "/v1/command/stream",
                &q,
                &HeaderMap::new(),
                summary(&a, n),
                n
            )
            .is_err()
        )
    }
    q.insert("afterSequence".into(), "99".into());
    assert!(
        s.response(
            &a,
            "session",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n),
            n
        )
        .is_err()
    );
    q.remove("afterSequence");
    assert!(
        s.response(
            &a,
            "session",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n),
            n + Duration::seconds(30)
        )
        .is_err()
    );
}
#[test]
fn stream_overflow_gaps_and_expired_capacity_recover_without_writes() {
    let a = auth();
    let n = Utc::now();
    let mut s = CommandStreams::default();
    let first = s
        .response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n,
        )
        .unwrap();
    let q = BTreeMap::from([(
        "streamId".into(),
        first["streamId"].as_str().unwrap().into(),
    )]);
    for x in 0..33 {
        let mut v = summary(&a, n);
        v["revision"] = json!(format!("sha256:{x:064x}"));
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::from([
                (
                    "streamId".into(),
                    first["streamId"].as_str().unwrap().into(),
                ),
                (
                    "afterSequence".into(),
                    s.leases.values().next().unwrap().last.to_string(),
                ),
            ]),
            &HeaderMap::new(),
            v,
            n,
        )
        .unwrap();
    }
    assert!(
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n),
            n
        )
        .is_err()
    );
    while s.leases.len() < STREAM_LIMIT {
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n,
        )
        .unwrap();
    }
    assert_eq!(
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert!(
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n + Duration::seconds(31)
        )
        .is_ok()
    );
}
#[test]
fn unknown_queries_and_ambiguous_resume_headers_fail_closed() {
    let a = auth();
    let n = Utc::now();
    let mut s = CommandStreams::default();
    let mut h = HeaderMap::new();
    h.insert("last-event-id", "2".parse().unwrap());
    for q in [
        BTreeMap::from([("actorId".into(), Uuid::new_v4().to_string())]),
        BTreeMap::from([("afterSequence".into(), "1".into())]),
    ] {
        assert!(
            s.response(&a, "s", "/v1/command/stream", &q, &h, summary(&a, n), n)
                .is_err()
        )
    }
}

#[tokio::test]
async fn shadow_read_never_seeds_or_exposes_paper_execution_or_strategy() {
    let p = crate::BffProvider::shadow_reference();
    let (status, v) = http(&p, "/v1/command/summary", crate::CURRENT_SESSION).await;
    assert_eq!(status, 200);
    assert_eq!(v["mode"], "shadow");
    assert_eq!(v["orderSummary"], Value::Null);
    assert!(p.data.lock().await.execution.is_none());
    assert!(p.data.lock().await.strategy.is_none());
}
#[test]
fn source_priority_and_recent_ordering_happen_before_output_truncation() {
    let a = auth();
    let n = Utc::now();
    let mut rows = vec![];
    for i in 0..60 {
        rows.push(json!({"runId":Uuid::from_u128(i+1),"createdAt":n-Duration::seconds(i as i64),"status":if i==59{"failed"}else{"running"}}));
    }
    let r = research_source(&a, &rows, n);
    assert_eq!(r["data"]["items"].as_array().unwrap().len(), 50);
    assert_eq!(r["data"]["items"][0]["id"], rows[0]["runId"]);
    assert_eq!(r["data"]["priority"][0]["id"], rows[59]["runId"]);
    assert_eq!(r["data"]["truncated"], true);
    let v = compose(
        &a,
        [
            r,
            unavailable("execution", "unavailable"),
            unavailable("operations", "unavailable"),
            unavailable("strategy", "unavailable"),
        ],
        n,
    );
    assert_eq!(v["priority"][0]["id"], rows[59]["runId"]);
    assert_eq!(v["recentActivity"][0]["id"], rows[0]["runId"]);
    assert_eq!(v["failedRuns"], 1);
    assert_eq!(v["runningRuns"], 59);
}
#[test]
fn current_capability_revocation_and_binding_change_precede_saved_event_replay() {
    let mut a = auth();
    let n = Utc::now();
    let mut s = CommandStreams::default();
    let first = s
        .response(
            &a,
            "s",
            "/v1/command/stream",
            &BTreeMap::new(),
            &HeaderMap::new(),
            summary(&a, n),
            n,
        )
        .unwrap();
    let q = BTreeMap::from([(
        "streamId".into(),
        first["streamId"].as_str().unwrap().into(),
    )]);
    a.capabilities
        .remove(&quantos_policy::Capability::parse("ops.read").unwrap());
    assert_eq!(
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::FORBIDDEN
    );
    a = auth();
    a.capabilities
        .remove(&quantos_policy::Capability::parse("research.read").unwrap());
    assert_eq!(
        s.response(
            &a,
            "s",
            "/v1/command/stream",
            &q,
            &HeaderMap::new(),
            summary(&a, n),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::CONFLICT
    );
}

#[test]
fn projection_expiry_never_outlives_a_ready_source_and_rechecks_final_sample_time() {
    let a = auth();
    let n = Utc::now();
    let ops = source(
        "operations",
        json!({"health":"healthy","openRiskAlerts":0,"items":[]}),
        n - Duration::seconds(29),
        n,
        30,
    );
    let sources = [
        research_source(&a, &[], n),
        unavailable("execution", "unavailable"),
        ops,
        unavailable("strategy", "unavailable"),
    ];
    let v = compose(&a, sources.clone(), n);
    assert_eq!(v["expiresAt"], json!(n + Duration::seconds(1)));
    assert_eq!(v["systemHealth"], "healthy");
    let later = compose(&a, sources, n + Duration::seconds(2));
    assert_eq!(later["systemHealth"], Value::Null);
    assert_eq!(later["sources"][2]["status"], "stale");
}
