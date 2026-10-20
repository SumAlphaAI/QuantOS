//! Current A5 composition in one owned Shadow provider. Independent source
//! leases do not fabricate a reconciliation/alert business integration proof.
use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
async fn call(
    p: &BffProvider,
    m: &str,
    path: &str,
    b: Option<Value>,
    session: &str,
    key: Uuid,
    version: &str,
) -> (u16, Value) {
    let path = if [
        "/v1/reconciliation/runs",
        "/v1/reconciliation/breaks",
        "/v1/ledger/entries",
    ]
    .contains(&path)
    {
        format!("{path}?accountId=44444444-4444-4444-8444-444444444444")
    } else if path == "/v1/performance/summary" {
        format!(
            "{path}?accountId=44444444-4444-4444-8444-444444444444&currency=USD&method=simple&period=week&periodMode=rolling"
        )
    } else {
        path.to_owned()
    };
    let req = Request::builder()
        .method(m)
        .uri(&path)
        .header(
            "cookie",
            format!("quantos_session={session}; quantos_csrf={CSRF_TOKEN}"),
        )
        .header("origin", ALLOWED_ORIGIN)
        .header("x-csrf-token", CSRF_TOKEN)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("idempotency-key", key.to_string())
        .header("if-match", version)
        .header("content-type", "application/json")
        .body(Body::from(b.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap();
    let r = p.router().oneshot(req).await.unwrap();
    let s = r.status().as_u16();
    let bytes = to_bytes(r.into_body(), 1048576).await.unwrap();
    let v=serde_json::from_slice(&bytes).unwrap_or_else(|_|json!({"frames":String::from_utf8_lossy(&bytes).lines().filter_map(|s|s.strip_prefix("data: ")).map(|s|serde_json::from_str::<Value>(s).unwrap()).collect::<Vec<_>>() }));
    (s, v)
}
async fn get(p: &BffProvider, path: &str) -> Value {
    let (s, v) = call(p, "GET", path, None, CURRENT_SESSION, Uuid::new_v4(), "").await;
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
    )
    .await;
    assert_eq!(s, 200, "{g}");
    json!({"mfaChallengeRef":c["challengeRef"],"reauthTokenRef":g["reauthTokenRef"],"reason":"owned A5 controlled action"})
}
fn query(v: &Value) -> String {
    url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(
            v.as_object()
                .unwrap()
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str().unwrap())),
        )
        .finish()
}
async fn setup(p: &BffProvider) -> (Value, Value, Value) {
    let _ = get(p, "/v1/operations/health").await;
    let runs = get(p, "/v1/reconciliation/runs").await;
    let summary = get(p, "/v1/performance/summary").await;
    let q = json!({"accountId":summary["accountId"],"currency":"USD","method":"simple","period":"custom","periodMode":"rolling","start":summary["coverage"]["start"],"end":summary["coverage"]["end"]});
    (runs, q, summary)
}
#[tokio::test]
async fn governance_ack_and_reconciliation_never_rewrite_frozen_financial_facts() {
    let p = BffProvider::shadow_reference();
    let (runs, q, _) = setup(&p).await;
    let ledger = get(&p, "/v1/ledger/entries").await;
    let (s, receipt) = call(
        &p,
        "POST",
        "/v1/performance/reports",
        Some(q.clone()),
        CURRENT_SESSION,
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 202, "{receipt}");
    let id = receipt["reportId"].as_str().unwrap();
    let _ = get(&p, &format!("/v1/performance/reports/{id}/status")).await;
    let frozen = get(&p, &format!("/v1/performance/reports/{id}")).await;
    let alert = get(&p, "/v1/alerts").await["items"][0].clone();
    let body = proof(&p, CURRENT_SESSION).await;
    let (s, ack) = call(
        &p,
        "POST",
        &format!("/v1/alerts/{}/ack", alert["alertId"].as_str().unwrap()),
        Some(body),
        CURRENT_SESSION,
        Uuid::new_v4(),
        alert["objectVersion"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 200, "{ack}");
    assert_eq!(ack["resolved"], false);
    p.renew_operations_reference().await.unwrap();
    assert_eq!(
        get(
            &p,
            &format!("/v1/alerts/{}", alert["alertId"].as_str().unwrap())
        )
        .await["resolved"],
        true
    );
    let run = &runs["items"][0];
    let (s, rerun) = call(
        &p,
        "POST",
        &format!(
            "/v1/reconciliation/runs/{}/reruns",
            run["runId"].as_str().unwrap()
        ),
        Some(json!({"reason":"A5 rerun"})),
        CURRENT_SESSION,
        Uuid::new_v4(),
        run["objectVersion"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 202, "{rerun}");
    assert_eq!(
        get(
            &p,
            &format!(
                "/v1/reconciliation/runs/{}",
                rerun["jobId"].as_str().unwrap()
            )
        )
        .await["provisional"],
        true
    );
    assert_eq!(
        get(&p, &format!("/v1/performance/reports/{id}")).await,
        frozen
    );
    assert_eq!(frozen["performance"]["provisional"], true);
    let after = get(&p, "/v1/ledger/entries").await;
    for row in ledger["items"].as_array().unwrap() {
        assert!(after["items"].as_array().unwrap().contains(row))
    }
    assert_eq!(
        get(&p, &format!("/v1/performance/summary?{}", query(&q))).await["ledgerVersion"],
        frozen["metadata"]["ledgerVersion"]
    );
    assert!(
        get(&p, "/v1/reconciliation/breaks").await["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|b| b["status"] == "open")
    );
}
#[tokio::test]
async fn same_key_across_domains_has_distinct_receipts_and_single_audit_roots() {
    let p = BffProvider::shadow_reference();
    let (runs, q, _) = setup(&p).await;
    let run = &runs["items"][0];
    let key = Uuid::new_v4();
    let path = format!(
        "/v1/reconciliation/runs/{}/reruns",
        run["runId"].as_str().unwrap()
    );
    let owner = proof(&p, "session-owner").await;
    let mut body = owner;
    body["spec"] = json!({"kind":"role","name":"a5-bounded-role","baseRole":"operator","permissions":["ops.read"]});
    let requests = [
        ("/v1/performance/reports", q, CURRENT_SESSION, "".to_owned()),
        (
            path.as_str(),
            json!({"reason":"A5 recovery"}),
            CURRENT_SESSION,
            run["objectVersion"].as_str().unwrap().to_owned(),
        ),
        ("/v1/admin/roles", body, "session-owner", "0".to_owned()),
    ];
    let mut ids = std::collections::BTreeSet::new();
    let results = tokio::join!(
        call(
            &p,
            "POST",
            requests[0].0,
            Some(requests[0].1.clone()),
            requests[0].2,
            key,
            &requests[0].3
        ),
        call(
            &p,
            "POST",
            requests[1].0,
            Some(requests[1].1.clone()),
            requests[1].2,
            key,
            &requests[1].3
        ),
        call(
            &p,
            "POST",
            requests[2].0,
            Some(requests[2].1.clone()),
            requests[2].2,
            key,
            &requests[2].3
        )
    );
    for ((path, body, session, version), (s, receipt)) in
        requests.into_iter().zip([results.0, results.1, results.2])
    {
        assert!([201, 202].contains(&s), "{receipt}");
        assert!(ids.insert(receipt["auditRef"].as_str().unwrap().to_owned()));
        for _ in 0..40 {
            let (status, v) =
                call(&p, "POST", path, Some(body.clone()), session, key, &version).await;
            assert_eq!((status, v), (s, receipt.clone()));
        }
        let chain = get(
            &p,
            &format!(
                "/v1/audit/evidence-chains/{}",
                receipt["correlationId"].as_str().unwrap()
            ),
        )
        .await;
        assert_eq!(
            chain["items"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|r| r["eventId"] == receipt["auditRef"])
                .count(),
            1
        );
    }
}
#[tokio::test]
async fn member_revocation_refuses_all_a5_replays_cursors_streams_and_downloads() {
    let p = BffProvider::shadow_reference();
    let (runs, q, _) = setup(&p).await;
    let report_key = Uuid::new_v4();
    let cursor_page = get(
        &p,
        "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444&pageSize=1",
    )
    .await;
    let cursor = cursor_page["nextCursor"].as_str().unwrap();
    let (s, receipt) = call(
        &p,
        "POST",
        "/v1/performance/reports",
        Some(q.clone()),
        CURRENT_SESSION,
        report_key,
        "",
    )
    .await;
    assert_eq!(s, 202);
    let id = receipt["reportId"].as_str().unwrap();
    let _ = get(&p, &format!("/v1/performance/reports/{id}/status")).await;
    let grant = get(&p, &format!("/v1/performance/reports/{id}/download")).await;
    let owner = proof(&p, "session-owner").await;
    let (s, members) = call(
        &p,
        "GET",
        "/v1/admin/members",
        None,
        "session-owner",
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 200);
    let actor = get(&p, "/v1/context").await["actorId"].clone();
    let current = members["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["spec"]["actorId"] == actor)
        .cloned();
    let current = current.unwrap();
    let mut b = owner;
    let mut spec = current["spec"].clone();
    spec["active"] = json!(false);
    b["spec"] = spec;
    let (s, v) = call(
        &p,
        "PUT",
        &format!("/v1/admin/members/{}", current["id"].as_str().unwrap()),
        Some(b),
        "session-owner",
        Uuid::new_v4(),
        current["objectVersion"].as_str().unwrap(),
    )
    .await;
    assert_eq!(s, 200, "{v}");
    let paths = [
        format!(
            "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444&pageSize=1&cursor={cursor}"
        ),
        "/v1/context".to_owned(),
        "/v1/performance/summary".into(),
        "/v1/reconciliation/runs".into(),
        "/v1/alerts/stream".into(),
        format!(
            "/v1/reconciliation/runs/{}/stream",
            runs["items"][0]["runId"].as_str().unwrap()
        ),
        grant["downloadPath"].as_str().unwrap().into(),
    ];
    for path in paths {
        assert_eq!(
            call(&p, "GET", &path, None, CURRENT_SESSION, Uuid::new_v4(), "")
                .await
                .0,
            401,
            "{path}"
        )
    }
    assert_eq!(
        call(
            &p,
            "POST",
            "/v1/performance/reports",
            Some(q),
            CURRENT_SESSION,
            report_key,
            ""
        )
        .await
        .0,
        401
    );
}
#[tokio::test]
async fn stale_observer_and_expired_download_never_turn_into_successful_recovery() {
    let p = BffProvider::shadow_reference();
    let (_, q, _) = setup(&p).await;
    let (s, v) = call(
        &p,
        "POST",
        "/v1/performance/reports",
        Some(q),
        CURRENT_SESSION,
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 202);
    let id = v["reportId"].as_str().unwrap();
    let _ = get(&p, &format!("/v1/performance/reports/{id}/status")).await;
    let grant = get(&p, &format!("/v1/performance/reports/{id}/download")).await;
    p.advance_reference_time(Duration::seconds(61)).await;
    p.renew_reference_session().await;
    assert_eq!(
        call(
            &p,
            "GET",
            grant["downloadPath"].as_str().unwrap(),
            None,
            CURRENT_SESSION,
            Uuid::new_v4(),
            ""
        )
        .await
        .0,
        410
    );
    for path in [
        "/v1/operations/health",
        "/v1/alerts/stream",
        "/v1/operations/runbook-actions/inspect-health/prechecks",
    ] {
        assert_eq!(
            call(&p, "GET", path, None, CURRENT_SESSION, Uuid::new_v4(), "")
                .await
                .0,
            409,
            "{path}"
        )
    }
    assert_eq!(
        get(&p, &format!("/v1/performance/reports/{id}")).await["metadata"]["reportVersion"],
        "1"
    );
}
#[tokio::test]
async fn poisoned_reconciliation_refuses_current_financial_reads_without_resolving_alerts() {
    let p = BffProvider::shadow_reference();
    let _ = setup(&p).await;
    p.data
        .lock()
        .await
        .reconciliation
        .as_mut()
        .unwrap()
        .poisoned = true;
    for path in [
        "/v1/reconciliation/runs",
        "/v1/ledger/entries",
        "/v1/performance/summary",
    ] {
        assert_eq!(
            call(&p, "GET", path, None, CURRENT_SESSION, Uuid::new_v4(), "")
                .await
                .0,
            503,
            "{path}"
        )
    }
    assert_eq!(get(&p, "/v1/alerts").await["items"][0]["resolved"], false);
}

#[tokio::test]
async fn renewed_observer_does_not_extend_old_leases_or_report_tickets() {
    let p = BffProvider::shadow_reference();
    let (_, q, _) = setup(&p).await;
    let ledger = get(&p, "/v1/ledger/entries").await;
    let (status, page) = call(
        &p,
        "GET",
        "/v1/admin/roles?pageSize=1",
        None,
        "session-owner",
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(status, 200, "{page}");
    let cursor = page["nextCursor"].as_str().unwrap();
    let stream = get(&p, "/v1/alerts/stream").await;
    let stream_id = stream["frames"][0]["streamId"].as_str().unwrap();
    let key = Uuid::new_v4();
    let (status, receipt) = call(
        &p,
        "POST",
        "/v1/performance/reports",
        Some(q.clone()),
        CURRENT_SESSION,
        key,
        "",
    )
    .await;
    assert_eq!(status, 202, "{receipt}");
    let report_id = receipt["reportId"].as_str().unwrap();
    let report_path = format!("/v1/performance/reports/{report_id}");
    let _ = get(&p, &format!("{report_path}/status")).await;
    let frozen = get(&p, &report_path).await;
    let grant = get(&p, &format!("{report_path}/download")).await;

    // Renewing only the independent observer changes alert facts, never an
    // already issued financial ticket, cursor deadline, or frozen report.
    p.advance_reference_time(Duration::seconds(301)).await;
    p.renew_reference_session().await;
    p.renew_operations_reference().await.unwrap();
    assert_eq!(get(&p, "/v1/operations/health").await["health"], "healthy");
    for (path, expected) in [
        (grant["downloadPath"].as_str().unwrap().to_owned(), 410),
        (format!("/v1/admin/roles?pageSize=1&cursor={cursor}"), 409),
        (format!("/v1/alerts/stream?streamId={stream_id}"), 409),
    ] {
        let (status, body) = call(
            &p,
            "GET",
            &path,
            None,
            if path.starts_with("/v1/admin/") {
                "session-owner"
            } else {
                CURRENT_SESSION
            },
            Uuid::new_v4(),
            "",
        )
        .await;
        assert_eq!(status, expected, "{path}: {body}");
    }
    assert_eq!(get(&p, &report_path).await, frozen);
    let renewed = get(&p, &format!("{report_path}/download")).await;
    assert_ne!(renewed["downloadPath"], grant["downloadPath"]);
    let document = get(&p, renewed["downloadPath"].as_str().unwrap()).await;
    assert_eq!(document, frozen);
    assert_eq!(
        call(
            &p,
            "POST",
            "/v1/performance/reports",
            Some(q),
            CURRENT_SESSION,
            key,
            ""
        )
        .await,
        (202, receipt)
    );
    assert_eq!(
        get(&p, "/v1/ledger/entries").await["items"],
        ledger["items"]
    );
    let fresh = get(&p, "/v1/alerts/stream").await;
    assert_ne!(fresh["frames"][0]["streamId"], stream_id);
}

#[tokio::test]
async fn shared_governance_quarantine_refuses_frozen_downloads_and_recovery() {
    let p = BffProvider::shadow_reference();
    let (_, q, _) = setup(&p).await;
    let key = Uuid::new_v4();
    let (status, receipt) = call(
        &p,
        "POST",
        "/v1/performance/reports",
        Some(q.clone()),
        CURRENT_SESSION,
        key,
        "",
    )
    .await;
    assert_eq!(status, 202);
    let report_path = format!(
        "/v1/performance/reports/{}",
        receipt["reportId"].as_str().unwrap()
    );
    let _ = get(&p, &format!("{report_path}/status")).await;
    let grant = get(&p, &format!("{report_path}/download")).await;
    let count = p.audit_count().await;
    p.data.lock().await.operations.as_mut().unwrap().poisoned = true;
    for path in [
        "/v1/operations/health",
        "/v1/reconciliation/runs",
        "/v1/performance/summary",
        "/v1/alerts/stream",
        &report_path,
        grant["downloadPath"].as_str().unwrap(),
    ] {
        assert_eq!(
            call(&p, "GET", path, None, CURRENT_SESSION, Uuid::new_v4(), "")
                .await
                .0,
            503,
            "{path}"
        );
    }
    assert_eq!(
        call(
            &p,
            "POST",
            "/v1/performance/reports",
            Some(q),
            CURRENT_SESSION,
            key,
            ""
        )
        .await
        .0,
        503
    );
    assert_eq!(p.audit_count().await, count);
}
