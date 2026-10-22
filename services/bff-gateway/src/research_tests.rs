use super::*;
use crate::BffProvider;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
const SNAPSHOT: &str = "11111111-1111-4111-8111-000000000001";
const ARTIFACT: &str = "44444444-4444-4444-8444-444444444444";
fn input() -> Value {
    json!({"capability":"research.hypothesis.v1","dataSnapshotId":SNAPSHOT,"question":"Explain this market observation","budget":"10","deadlineAt":Utc::now()+Duration::hours(1)})
}
fn request(method: &str, path: &str, body: Option<Value>, key: Uuid) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(path)
        .header(
            "cookie",
            "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
        )
        .header("origin", "http://localhost:3190")
        .header("x-csrf-token", "csrf-token-0000000000000001")
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("idempotency-key", key.to_string())
        .header("content-type", "application/json")
        .body(Body::from(body.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap()
}
async fn call(
    p: &BffProvider,
    method: &str,
    path: &str,
    body: Option<Value>,
    key: Uuid,
) -> (u16, Value) {
    let r = p
        .router()
        .oneshot(request(method, path, body, key))
        .await
        .unwrap();
    let status = r.status().as_u16();
    assert_eq!(r.headers().get("cache-control").unwrap(), "no-store");
    assert!(Uuid::parse_str(r.headers()["x-correlation-id"].to_str().unwrap()).is_ok());
    let bytes = to_bytes(r.into_body(), 4 * 1024 * 1024).await.unwrap();
    let value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| json!({"sse":String::from_utf8(bytes.to_vec()).unwrap()}));
    (status, value)
}
async fn create(p: &BffProvider) -> Value {
    let (s, v) = call(
        p,
        "POST",
        "/v1/research-runs",
        Some(input()),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(s, 202, "{v}");
    v
}
async fn seed_artifact(p: &BffProvider) {
    let now = Utc::now();
    p.data.lock().await.research.artifacts.insert(uuid(ARTIFACT).unwrap(),json!({"artifactId":ARTIFACT,"hypothesis":"Reference fixture hypothesis","summary":"Explicit page fixture","engineVersion":"fixture-v1","promptVersion":"fixture-v1","codeVersion":"fixture-v1","environmentHash":digest(&json!("fixture")),"dataSnapshotId":SNAPSHOT,"contentHash":digest(&json!("fixture-content")),"createdAt":now}));
}
#[tokio::test]
async fn all_nine_page_operations_return_populated_contract_responses() {
    let p = BffProvider::default();
    seed_artifact(&p).await;
    let accepted = create(&p).await;
    let id = accepted["jobId"].as_str().unwrap();
    let mut responses = vec![json!({"operation":"createResearchRun","status":202,"body":accepted})];
    for (op, path) in [
        ("listResearchRuns", "/v1/research-runs".to_owned()),
        ("getResearchRun", format!("/v1/research-runs/{id}")),
        ("listDataSnapshots", "/v1/data-snapshots".to_owned()),
        ("getDataSnapshot", format!("/v1/data-snapshots/{SNAPSHOT}")),
        ("getArtifact", format!("/v1/artifacts/{ARTIFACT}")),
        (
            "getArtifactAttachment",
            format!("/v1/artifacts/{ARTIFACT}/attachment"),
        ),
    ] {
        let (s, v) = call(&p, "GET", &path, None, Uuid::new_v4()).await;
        assert_eq!(s, 200, "{op}: {v}");
        responses.push(json!({"operation":op,"status":s,"body":v}));
    }
    let (s, events) = call(
        &p,
        "GET",
        &format!("/v1/research-runs/{id}/stream"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(s, 200);
    assert!(events["sse"].as_str().unwrap().contains("research.queued"));
    responses.push(json!({"operation":"subscribeResearchRun","status":s,"body":events}));
    let (s, v) = call(
        &p,
        "POST",
        &format!("/v1/research-runs/{id}/cancel"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(s, 202);
    responses.push(json!({"operation":"cancelResearchRun","status":s,"body":v}));
    if let Ok(path) = std::env::var("QUANTOS_BFF003_PROBE_OUTPUT") {
        std::fs::write(path, serde_json::to_vec_pretty(&responses).unwrap()).unwrap();
    }
}
#[tokio::test]
async fn concurrent_retries_do_not_duplicate_runs_audits_or_events() {
    let p = BffProvider::default();
    let body = input();
    let key = Uuid::new_v4();
    let mut tasks = vec![];
    for _ in 0..8 {
        let p = p.clone();
        let body = body.clone();
        tasks.push(tokio::spawn(async move {
            call(&p, "POST", "/v1/research-runs", Some(body), key).await
        }));
    }
    let first = tasks.remove(0).await.unwrap();
    assert_eq!(first.0, 202);
    for task in tasks {
        assert_eq!(task.await.unwrap(), first);
    }
    let state = p.data.lock().await;
    assert_eq!(state.research.runs.len(), 1);
    assert_eq!(state.research.commands.len(), 1);
    assert_eq!(state.research.events.values().next().unwrap().len(), 1);
    drop(state);
    let mut changed = body;
    changed["question"] = json!("Changed intent");
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(changed), key)
            .await
            .0,
        409
    );
}
#[tokio::test]
async fn quality_license_and_unknown_attachments_fail_before_scheduling() {
    let p = BffProvider::default();
    for tail in [2, 3] {
        let mut v = input();
        v["dataSnapshotId"] = json!(format!("11111111-1111-4111-8111-{tail:012}"));
        let (s, v) = call(&p, "POST", "/v1/research-runs", Some(v), Uuid::new_v4()).await;
        assert_eq!(s, 422);
        assert_eq!(v["code"], "SNAPSHOT_BLOCKED");
    }
    let mut v = input();
    v["attachments"] = json!([Uuid::new_v4()]);
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(v), Uuid::new_v4())
            .await
            .0,
        404
    );
    assert!(p.data.lock().await.research.runs.is_empty());
}
#[tokio::test]
async fn command_validation_rejects_forgery_empty_and_unsafe_numeric_inputs() {
    let p = BffProvider::default();
    for (field, value) in [
        ("question", json!(" ")),
        ("question", json!("")),
        ("capability", json!("unknown")),
        ("budget", json!("-1")),
        ("budget", json!("0")),
        ("budget", json!("1.5")),
        ("budget", json!("1000001")),
        ("budget", json!(10)),
        ("deadlineAt", json!(Utc::now() - Duration::seconds(1))),
        ("deadlineAt", json!(Utc::now() + Duration::days(2))),
        ("tenantId", json!(Uuid::new_v4())),
    ] {
        let mut v = input();
        v[field] = value;
        assert_eq!(
            call(&p, "POST", "/v1/research-runs", Some(v), Uuid::new_v4())
                .await
                .0,
            422,
            "{field}"
        );
    }
    assert!(p.data.lock().await.research.runs.is_empty());
}
#[tokio::test]
async fn cancellation_is_idempotent_and_terminal_success_conflicts() {
    let p = BffProvider::default();
    let job = create(&p).await;
    let id = job["jobId"].as_str().unwrap();
    let path = format!("/v1/research-runs/{id}/cancel");
    let key = Uuid::new_v4();
    let a = call(&p, "POST", &path, None, key).await;
    assert_eq!(a.0, 202);
    assert_eq!(call(&p, "POST", &path, None, key).await, a);
    let detail = call(&p, "GET", &format!("/v1/research-runs/{id}"), None, key).await;
    assert_eq!(detail.1["status"], "cancelled");
    p.data
        .lock()
        .await
        .research
        .runs
        .get_mut(&uuid(id).unwrap())
        .unwrap()["status"] = json!("succeeded");
    assert_eq!(call(&p, "POST", &path, None, Uuid::new_v4()).await.0, 409);
}
#[tokio::test]
async fn replay_has_stable_ids_strict_sequences_and_ahead_cursor_conflict() {
    let p = BffProvider::default();
    let job = create(&p).await;
    let id = job["jobId"].as_str().unwrap();
    call(
        &p,
        "POST",
        &format!("/v1/research-runs/{id}/cancel"),
        None,
        Uuid::new_v4(),
    )
    .await;
    let path = format!("/v1/research-runs/{id}/stream?afterSequence=1");
    let first = call(&p, "GET", &path, None, Uuid::new_v4()).await;
    let again = call(&p, "GET", &path, None, Uuid::new_v4()).await;
    assert_eq!(first, again);
    let text = first.1["sse"].as_str().unwrap();
    assert!(text.contains("id: 2"));
    assert!(!text.contains("id: 1"));
    assert_eq!(
        call(
            &p,
            "GET",
            &format!("/v1/research-runs/{id}/stream?afterSequence=100"),
            None,
            Uuid::new_v4()
        )
        .await
        .0,
        409
    );
}
#[tokio::test]
async fn denied_identity_csrf_and_hidden_resource_return_no_page_data() {
    let p = BffProvider::default();
    for (header, value, method, expected) in [
        ("cookie", "", "GET", 401),
        ("cookie", "quantos_session=session-viewer", "GET", 403),
        ("x-csrf-token", "wrong", "POST", 403),
        ("origin", "https://untrusted.invalid", "POST", 403),
    ] {
        let mut r = request(
            method,
            "/v1/research-runs",
            if method == "POST" {
                Some(input())
            } else {
                None
            },
            Uuid::new_v4(),
        );
        r.headers_mut().insert(header, value.parse().unwrap());
        assert_eq!(
            p.router().oneshot(r).await.unwrap().status().as_u16(),
            expected
        );
    }
    for path in [
        format!("/v1/research-runs/{}", Uuid::new_v4()),
        format!("/v1/artifacts/{}/attachment", Uuid::new_v4()),
    ] {
        assert_eq!(call(&p, "GET", &path, None, Uuid::new_v4()).await.0, 404);
    }
    p.advance_reference_time(Duration::minutes(6)).await;
    assert_eq!(
        call(&p, "GET", "/v1/research-runs", None, Uuid::new_v4())
            .await
            .0,
        401
    );
}
#[tokio::test]
async fn list_http_validation_and_populated_pagination_work() {
    let p = BffProvider::default();
    for path in [
        "/v1/data-snapshots?pageSize=201",
        "/v1/data-snapshots?tenantId=forged",
        "/v1/research-runs?sort=question:asc",
        "/v1/research-runs?filter=status:like:queued",
        "/v1/research-runs?dataSnapshotId=bad",
    ] {
        assert_eq!(
            call(&p, "GET", path, None, Uuid::new_v4()).await.0,
            422,
            "{path}"
        );
    }
    let (_, first) = call(
        &p,
        "GET",
        "/v1/data-snapshots?pageSize=1&sort=snapshotId:asc",
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(first["items"].as_array().unwrap().len(), 1);
    let cursor = first["nextCursor"].as_str().unwrap();
    let (_, next) = call(
        &p,
        "GET",
        &format!("/v1/data-snapshots?pageSize=1&sort=snapshotId:asc&cursor={cursor}"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_ne!(first["items"][0], next["items"][0]);
}
#[test]
fn cursors_bind_scope_query_and_immutable_materialized_rows() {
    let mut pages = Pages::default();
    let now = Utc::now();
    let items = (0..3)
        .map(|v| json!({"runId":v.to_string(),"status":"queued","createdAt":"same"}))
        .collect();
    let mut q = ListQuery {
        page_size: Some(1),
        ..Default::default()
    };
    let first = pages.list("actor-a", "runs", items, &q, now).unwrap();
    q.cursor = Some(first["nextCursor"].as_str().unwrap().into());
    assert_eq!(
        pages
            .list("actor-b", "runs", vec![], &q, now)
            .err()
            .unwrap()
            .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    q.status = Some("running".into());
    assert!(pages.list("actor-a", "runs", vec![], &q, now).is_err());
    q.status = None;
    let next = pages.list("actor-a", "runs", vec![], &q, now).unwrap();
    assert_eq!(next["items"][0]["runId"], "1");
    assert_eq!(
        pages
            .list("actor-a", "runs", vec![], &q, now + Duration::minutes(6))
            .err()
            .unwrap()
            .0,
        StatusCode::GONE
    );
}
#[test]
fn bounded_materialization_and_invalid_sort_fail_closed() {
    let mut pages = Pages::default();
    let items = (0..2001).map(|_| json!({})).collect();
    assert_eq!(
        pages
            .list("a", "runs", items, &ListQuery::default(), Utc::now())
            .err()
            .unwrap()
            .1,
        "NARROW_QUERY"
    );
    let q = ListQuery {
        sort: Some("password:asc".into()),
        ..Default::default()
    };
    assert!(pages.list("a", "runs", vec![], &q, Utc::now()).is_err());
}
#[tokio::test]
async fn attachment_content_hash_matches_the_returned_canonical_bytes() {
    let p = BffProvider::default();
    seed_artifact(&p).await;
    let (status, value) = call(
        &p,
        "GET",
        &format!("/v1/artifacts/{ARTIFACT}/attachment"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(value["contentHash"], digest(&value["content"]));
    assert!(value.get("object_key").is_none());
}

#[test]
fn resolved_attachments_use_the_actual_rd_agent_input_shape_and_limit() {
    let value = engine_input("Question", &[json!({"summary":"authorized evidence"})]).unwrap();
    assert_eq!(value.as_object().unwrap().len(), 1);
    assert!(
        value["prompt"]
            .as_str()
            .unwrap()
            .contains("authorized evidence")
    );
    assert!(engine_input("Question", &[json!({"summary":"x".repeat(8192)})]).is_err());
}
#[tokio::test]
async fn method_and_attachment_limits_are_enforced_by_the_mounted_routes() {
    let p = BffProvider::default();
    for (method, path) in [
        ("POST", "/v1/data-snapshots"),
        ("POST", "/v1/artifacts/44444444-4444-4444-8444-444444444444"),
        (
            "GET",
            "/v1/research-runs/44444444-4444-4444-8444-444444444444/cancel",
        ),
    ] {
        assert_eq!(
            p.router()
                .oneshot(request(method, path, None, Uuid::new_v4()))
                .await
                .unwrap()
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
    }
    let mut v = input();
    v["attachments"] = json!([ARTIFACT, ARTIFACT]);
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(v), Uuid::new_v4())
            .await
            .0,
        422
    );
    let mut v = input();
    v["attachments"] = json!((0..17).map(|_| Uuid::new_v4()).collect::<Vec<_>>());
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(v), Uuid::new_v4())
            .await
            .0,
        422
    );
}
#[test]
fn quota_is_actor_operation_bound_and_returns_retry_metadata() {
    let mut quota = Quota::default();
    let now = Utc::now();
    for _ in 0..120 {
        quota.take("a", "list", now).unwrap();
    }
    let error = quota.take("a", "list", now).unwrap_err();
    assert_eq!(error.0, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(error.response().headers()["retry-after"], "60");
    assert!(quota.take("b", "list", now).is_ok());
    assert!(quota.take("a", "get", now).is_ok());
    assert!(quota.take("a", "list", now + Duration::minutes(1)).is_ok());
}
#[test]
fn completed_intent_replays_after_its_original_deadline() {
    let mut fixture = Fixture::default();
    let mut expired: Create = serde_json::from_value(input()).unwrap();
    expired.deadline_at = Utc::now() - Duration::seconds(1);
    let key = Uuid::new_v4();
    let response =
        json!({"jobId":Uuid::new_v4(),"status":"accepted","correlationId":Uuid::new_v4()});
    fixture.commands.insert(
        format!("create:{key}"),
        (serde_json::to_value(&expired).unwrap(), response.clone()),
    );
    assert_eq!(fixture.create(key, expired).unwrap(), response);
    assert!(fixture.runs.is_empty());
}

#[tokio::test]
async fn current_function_research_audit_refs_resolve_and_retries_append_once() {
    let p = BffProvider::default();
    let body = input();
    let key = Uuid::new_v4();
    let (_, accepted) = call(&p, "POST", "/v1/research-runs", Some(body.clone()), key).await;
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(body), key)
            .await
            .1,
        accepted
    );
    let correlation = accepted["correlationId"].as_str().unwrap();
    let (status, chain) = call(
        &p,
        "GET",
        &format!("/v1/audit/evidence-chains/{correlation}"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(
        status, 200,
        "accepted auditRef must resolve through C10: {chain}"
    );
    assert_eq!(chain["items"][0]["eventId"], accepted["auditRef"]);
    let id = accepted["jobId"].as_str().unwrap();
    let cancel_key = Uuid::new_v4();
    let (_, cancelled) = call(
        &p,
        "POST",
        &format!("/v1/research-runs/{id}/cancel"),
        None,
        cancel_key,
    )
    .await;
    assert_eq!(
        call(
            &p,
            "POST",
            &format!("/v1/research-runs/{id}/cancel"),
            None,
            cancel_key
        )
        .await
        .1,
        cancelled
    );
    let state = p.data.lock().await;
    for response in [&accepted, &cancelled] {
        let events = state
            .audits
            .iter()
            .filter(|e| e["eventId"] == response["auditRef"])
            .collect::<Vec<_>>();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["causationId"], accepted["auditRef"]);
        assert_eq!(
            events[0]["payloadHash"],
            crate::audit_core::payload_hash(&events[0]["redactedPayload"])
        );
        assert!(
            !events[0]
                .to_string()
                .contains("Explain this market observation")
        );
    }
}
#[tokio::test]
async fn current_function_reference_clock_rejects_deadline_and_stale_snapshot() {
    let p = BffProvider::default();
    p.advance_reference_time(Duration::minutes(2)).await;
    p.renew_reference_session().await;
    let mut body = input();
    body["deadlineAt"] = json!(Utc::now() + Duration::minutes(1));
    assert_eq!(
        call(&p, "POST", "/v1/research-runs", Some(body), Uuid::new_v4())
            .await
            .0,
        422
    );
    p.advance_reference_time(Duration::hours(1)).await;
    p.renew_reference_session().await;
    let mut body = input();
    body["deadlineAt"] = json!(Utc::now() + Duration::hours(3));
    let (status, value) = call(&p, "POST", "/v1/research-runs", Some(body), Uuid::new_v4()).await;
    assert_eq!(status, 422);
    assert_eq!(value["code"], "SNAPSHOT_BLOCKED");
    assert!(p.data.lock().await.research.runs.is_empty());
}
#[tokio::test]
async fn current_function_artifact_metadata_and_attachment_bind_identical_content() {
    let p = BffProvider::default();
    seed_artifact(&p).await;
    let (_, metadata) = call(
        &p,
        "GET",
        &format!("/v1/artifacts/{ARTIFACT}"),
        None,
        Uuid::new_v4(),
    )
    .await;
    let (_, attachment) = call(
        &p,
        "GET",
        &format!("/v1/artifacts/{ARTIFACT}/attachment"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(metadata["contentHash"], attachment["contentHash"]);
    assert_eq!(attachment["contentHash"], digest(&attachment["content"]));
    let correlation = attachment["correlationId"]
        .as_str()
        .expect("attachment audit correlation");
    let (status, chain) = call(
        &p,
        "GET",
        &format!("/v1/audit/evidence-chains/{correlation}"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(chain["items"][0]["eventId"], attachment["auditRef"]);
}

#[test]
fn current_function_snapshot_expiry_preserves_subsecond_window_and_overflow_boundaries() {
    let mut fixture = Fixture::default();
    let now = fixture.now;
    let id = uuid(SNAPSHOT).unwrap();
    let snapshot = fixture.snapshots.get_mut(&id).unwrap();
    snapshot["window"]["start"] = json!(now - Duration::hours(3));
    snapshot["capturedAt"] = json!(now - Duration::hours(1));
    snapshot["window"]["end"] = json!(now - Duration::hours(1));
    assert_eq!(fixture.snapshot(id).unwrap()["qualityBlocked"], false);
    fixture.snapshots.get_mut(&id).unwrap()["capturedAt"] =
        json!(now - Duration::hours(1) - Duration::nanoseconds(1));
    assert_eq!(fixture.snapshot(id).unwrap()["qualityBlocked"], true);
    let snapshot = fixture.snapshots.get_mut(&id).unwrap();
    snapshot["capturedAt"] = json!(now);
    snapshot["window"]["end"] = json!(now - Duration::hours(1) - Duration::nanoseconds(1));
    assert_eq!(fixture.snapshot(id).unwrap()["qualityBlocked"], true);
    let snapshot = fixture.snapshots.get_mut(&id).unwrap();
    snapshot["window"]["end"] = json!(now);
    snapshot["maxAgeSeconds"] = json!(i64::MAX);
    assert_eq!(fixture.snapshot(id).unwrap()["qualityBlocked"], true);
}

#[tokio::test]
async fn snapshot_read_capability_matches_reference_resource_owner() {
    let p = BffProvider::default();
    for path in ["/v1/session", "/v1/context"] {
        let (status, body) = call(&p, "GET", path, None, Uuid::new_v4()).await;
        assert_eq!(status, 200);
        assert!(
            body["capabilities"]
                .as_array()
                .unwrap()
                .contains(&json!("snapshot.read"))
        );
    }
    let (status, _) = call(
        &p,
        "GET",
        &format!("/v1/data-snapshots/{SNAPSHOT}"),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(status, 200);
    for session in ["session-other", "session-approver", "session-owner"] {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            format!("quantos_session={session}").parse().unwrap(),
        );
        let payload = crate::session_payload(&headers, Utc::now() + Duration::hours(1));
        assert!(
            !payload["capabilities"]
                .as_array()
                .unwrap()
                .contains(&json!("snapshot.read"))
        );
        let mut req = request(
            "GET",
            &format!("/v1/data-snapshots/{SNAPSHOT}"),
            None,
            Uuid::new_v4(),
        );
        req.headers_mut().insert(
            "cookie",
            format!("quantos_session={session}").parse().unwrap(),
        );
        let response = p.router().oneshot(req).await.unwrap();
        assert!(matches!(response.status().as_u16(), 401 | 403));
    }
}

#[tokio::test]
async fn research_capabilities_match_current_reference_owner_only() {
    let p = BffProvider::default();
    for path in ["/v1/session", "/v1/context"] {
        let (status, body) = call(&p, "GET", path, None, Uuid::new_v4()).await;
        assert_eq!(status, 200);
        for cap in ["research.read", "research.write"] {
            assert!(
                body["capabilities"]
                    .as_array()
                    .unwrap()
                    .contains(&json!(cap))
            );
        }
    }
    for session in ["session-other", "session-approver", "session-owner"] {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            format!("quantos_session={session}").parse().unwrap(),
        );
        let payload = crate::session_payload(&headers, Utc::now() + Duration::hours(1));
        for cap in ["research.read", "research.write"] {
            assert!(
                !payload["capabilities"]
                    .as_array()
                    .unwrap()
                    .contains(&json!(cap))
            );
        }
        for method in ["GET", "POST"] {
            let mut req = request(method, "/v1/research-runs", None, Uuid::new_v4());
            req.headers_mut().insert(
                "cookie",
                format!("quantos_session={session}").parse().unwrap(),
            );
            let response = p.router().oneshot(req).await.unwrap();
            assert!(matches!(response.status().as_u16(), 401 | 403));
        }
    }
}
