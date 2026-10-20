use super::*;
fn setup() -> (
    AuthContext,
    PerformanceHost,
    ReconciliationHost,
    DateTime<Utc>,
    BTreeMap<String, String>,
) {
    let a = crate::reconciliation::reference_auth(crate::CURRENT_SESSION);
    let n = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let (p, r) = seed(&a, n, None).unwrap();
    let q = BTreeMap::from([
        ("period".into(), "custom".into()),
        ("start".into(), (n - Duration::minutes(2)).to_rfc3339()),
        ("end".into(), n.to_rfc3339()),
        ("method".into(), "simple".into()),
        ("currency".into(), "USD".into()),
    ]);
    (a, p, r, n, q)
}
fn headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    h
}
#[test]
fn x01_x05_actual_books_golden_metrics_and_provisional() {
    let (a, p, mut r, n, q) = setup();
    let v = p.calculate(&a, &q, &mut r, n).unwrap();
    assert_eq!(v["pnl"], "10");
    assert_eq!(v["fees"], "0");
    assert_eq!(v["return"], "0.010020040080160321");
    assert_eq!(v["drawdown"], "0.009823182711198428");
    assert_eq!(v["coverage"]["complete"], true);
    assert_eq!(v["provisional"], true);
    assert_eq!(v["series"].as_array().unwrap().len(), 3);
    assert_eq!(v["attribution"][0]["pnl"], "10");
    assert_eq!(v["attribution"][1]["pnl"], "0");
    for row in v["series"].as_array().unwrap() {
        assert!(
            row["ledgerVersion"]
                .as_str()
                .unwrap()
                .starts_with("sha256:")
        );
        assert!(
            row["valuationSnapshotId"]
                .as_str()
                .unwrap()
                .starts_with("sha256:")
        );
    }
    assert_eq!(r.service().journal(&a).unwrap().1.count, 3);
}
#[test]
fn exact_retry_single_job_and_frozen_worker_recovery() {
    let (a, mut p, mut r, n, q) = setup();
    let b = json!(q);
    let h = headers();
    let receipt = p
        .handle(
            &a,
            "session",
            &Method::POST,
            "/v1/performance/reports",
            &BTreeMap::new(),
            &h,
            &b,
            &mut r,
            n,
        )
        .unwrap();
    let id = receipt.1["reportId"].as_str().unwrap();
    let path = format!("/v1/performance/reports/{id}");
    assert_eq!(
        p.handle(
            &a,
            "session",
            &Method::GET,
            &path,
            &BTreeMap::new(),
            &h,
            &json!({}),
            &mut r,
            n
        )
        .unwrap_err()
        .1,
        "REPORT_NOT_READY"
    );
    for _ in 0..1000 {
        assert_eq!(
            p.handle(
                &a,
                "session",
                &Method::POST,
                "/v1/performance/reports",
                &BTreeMap::new(),
                &h,
                &b,
                &mut r,
                n + Duration::minutes(20)
            )
            .unwrap(),
            receipt
        )
    }
    assert_eq!(p.jobs.len(), 1);
    let status = format!("{path}/status");
    let v = p
        .handle(
            &a,
            "session",
            &Method::GET,
            &status,
            &BTreeMap::new(),
            &h,
            &json!({}),
            &mut r,
            n,
        )
        .unwrap();
    assert_eq!(v.1["status"], "succeeded");
    let doc = p
        .handle(
            &a,
            "session",
            &Method::GET,
            &path,
            &BTreeMap::new(),
            &h,
            &json!({}),
            &mut r,
            n,
        )
        .unwrap()
        .1;
    assert_eq!(doc["metadata"]["status"], "succeeded");
    assert_eq!(doc["performance"]["pnl"], "10");
    let bytes = p.jobs.values().next().unwrap().bytes.clone();
    p.handle(
        &a,
        "session",
        &Method::GET,
        &status,
        &BTreeMap::new(),
        &h,
        &json!({}),
        &mut r,
        n,
    )
    .unwrap();
    assert_eq!(p.jobs.values().next().unwrap().bytes, bytes);
    let mut changed = b.clone();
    changed["method"] = json!("twr");
    assert_eq!(
        p.handle(
            &a,
            "session",
            &Method::POST,
            "/v1/performance/reports",
            &BTreeMap::new(),
            &h,
            &changed,
            &mut r,
            n
        )
        .unwrap_err()
        .1,
        "IDEMPOTENCY_CONFLICT"
    );
}
#[test]
fn scope_roles_mode_capability_poison_and_no_browser_source() {
    let (a, mut p, mut r, n, q) = setup();
    for k in 0..7 {
        let mut b = a.clone();
        match k {
            0 => b.tenant_id = quantos_core::TenantId::new(),
            1 => b.workspace_id = quantos_core::WorkspaceId::new(),
            2 => b.account_id = Some(quantos_core::AccountId::new()),
            3 => b.role = quantos_policy::Role::Viewer,
            4 => b.mode = quantos_policy::RunMode::Paper,
            5 => b.capabilities.clear(),
            _ => b.actor_id = quantos_core::ActorId::from_uuid(Uuid::nil()),
        };
        assert_eq!(
            p.handle(
                &b,
                "s",
                &Method::GET,
                "/v1/performance/summary",
                &q,
                &HeaderMap::new(),
                &json!({}),
                &mut r,
                n
            )
            .unwrap_err()
            .0,
            StatusCode::FORBIDDEN
        )
    }
    let mut bad = q.clone();
    bad.insert("cash".into(), "100000".into());
    assert!(p.calculate(&a, &bad, &mut r, n).is_err());
    p.poisoned = true;
    assert_eq!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            "/v1/performance/summary",
            &q,
            &HeaderMap::new(),
            &json!({}),
            &mut r,
            n
        )
        .unwrap_err()
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
#[test]
fn periods_partial_coverage_method_currency_and_invalid_basis_refuse() {
    let (a, p, mut r, n, q) = setup();
    for (k, v, code) in [
        ("method", "twr", "UNSUPPORTED_METHOD"),
        ("method", "mwr", "UNSUPPORTED_METHOD"),
        ("currency", "EUR", "UNSUPPORTED_CURRENCY"),
        ("accountId", "wrong", "NOT_FOUND"),
    ] {
        let mut b = q.clone();
        b.insert(k.into(), v.into());
        assert_eq!(p.calculate(&a, &b, &mut r, n).unwrap_err().1, code)
    }
    let mut b = q.clone();
    b.insert("start".into(), (n - Duration::minutes(3)).to_rfc3339());
    let v = p.calculate(&a, &b, &mut r, n).unwrap();
    assert_eq!(v["coverage"]["complete"], false);
    assert_eq!(v["provisional"], true);
    for period in ["week", "month", "quarter", "year"] {
        for mode in ["rolling", "calendar"] {
            let map = BTreeMap::from([
                ("period".into(), period.into()),
                ("periodMode".into(), mode.into()),
            ]);
            assert!(PerformanceHost::window(&map, n).is_ok());
        }
    }
    assert!(div(Decimal::ONE, Decimal::ZERO).is_err());
    assert!(add(Decimal::MAX, Decimal::ONE).is_err());
}
#[test]
fn download_hash_scope_token_expiry_and_report_retention() {
    let (a, mut p, mut r, n, q) = setup();
    let h = headers();
    let (_, receipt) = p
        .handle(
            &a,
            "s",
            &Method::POST,
            "/v1/performance/reports",
            &BTreeMap::new(),
            &h,
            &json!(q),
            &mut r,
            n,
        )
        .unwrap();
    let path = format!(
        "/v1/performance/reports/{}",
        receipt["reportId"].as_str().unwrap()
    );
    p.handle(
        &a,
        "s",
        &Method::GET,
        &format!("{path}/status"),
        &BTreeMap::new(),
        &h,
        &json!({}),
        &mut r,
        n,
    )
    .unwrap();
    let (_, grant) = p
        .handle(
            &a,
            "s",
            &Method::GET,
            &format!("{path}/download"),
            &BTreeMap::new(),
            &h,
            &json!({}),
            &mut r,
            n,
        )
        .unwrap();
    let bytes = p.jobs.values().next().unwrap().bytes.as_ref().unwrap();
    assert_eq!(
        grant["sha256"],
        quantos_core::ContentHash::sha256_bytes(bytes).to_string()
    );
    assert_eq!(grant["sizeBytes"], bytes.len());
    let token = grant["downloadPath"]
        .as_str()
        .unwrap()
        .split("ticket=")
        .nth(1)
        .unwrap();
    let query = BTreeMap::from([("ticket".into(), token.into())]);
    assert!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            &format!("{path}/content"),
            &query,
            &h,
            &json!({}),
            &mut r,
            n
        )
        .is_ok()
    );
    assert_eq!(
        p.handle(
            &a,
            "other",
            &Method::GET,
            &format!("{path}/content"),
            &query,
            &h,
            &json!({}),
            &mut r,
            n
        )
        .unwrap_err()
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            &format!("{path}/content"),
            &query,
            &h,
            &json!({}),
            &mut r,
            n + Duration::seconds(60)
        )
        .unwrap_err()
        .1,
        "DOWNLOAD_EXPIRED"
    );
    assert_eq!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            &path,
            &BTreeMap::new(),
            &h,
            &json!({}),
            &mut r,
            n + Duration::minutes(15)
        )
        .unwrap_err()
        .1,
        "REPORT_EXPIRED"
    );
}
#[test]
fn c15_history_preserved_and_lease_loss_fail_closed() {
    let (a, p, r, n, q) = setup();
    let before: Value = serde_json::from_slice(&r.service().journal(&a).unwrap().0).unwrap();
    let (_, mut appended) = seed(&a, n + Duration::minutes(3), Some(r)).unwrap();
    let after: Value = serde_json::from_slice(&appended.service().journal(&a).unwrap().0).unwrap();
    assert!(
        after["events"]
            .as_array()
            .unwrap()
            .starts_with(before["events"].as_array().unwrap())
    );
    appended.poisoned = true;
    assert_eq!(
        p.calculate(&a, &q, &mut appended, n).unwrap_err().0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    let mut empty = PerformanceHost::new(a.clone());
    let mut fresh = ReconciliationHost::new(&a, crate::reconciliation::fixture(&a, n), n).unwrap();
    assert_eq!(
        empty
            .handle(
                &a,
                "s",
                &Method::GET,
                "/v1/performance/summary",
                &q,
                &HeaderMap::new(),
                &json!({}),
                &mut fresh,
                n
            )
            .unwrap_err()
            .1,
        "INSUFFICIENT_COVERAGE"
    );
}
#[tokio::test]
async fn concurrent_http_job_unique_audit_chain_and_revoked_download() {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    let provider = crate::BffProvider::shadow_reference();
    let app = provider.clone().router();
    let req = || {
        Request::builder().uri("/v1/performance/summary?accountId=44444444-4444-4444-8444-444444444444&currency=USD&method=simple&period=week&periodMode=rolling").header("cookie","quantos_session=session-current").body(Body::empty()).unwrap()
    };
    let res = app.clone().oneshot(req()).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let summary: Value = serde_json::from_slice(&bytes).unwrap();
    let b = json!({"accountId":summary["accountId"],"currency":"USD","method":"simple","period":"custom","periodMode":"rolling","start":summary["coverage"]["start"],"end":summary["coverage"]["end"]});
    let key = Uuid::new_v4();
    let mut tasks = vec![];
    for _ in 0..40 {
        let app = app.clone();
        let b = b.clone();
        tasks.push(tokio::spawn(async move {
            let request = Request::builder()
                .method("POST")
                .uri("/v1/performance/reports")
                .header("content-type", "application/json")
                .header(
                    "cookie",
                    "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
                )
                .header("origin", "http://localhost:3190")
                .header("x-csrf-token", "csrf-token-0000000000000001")
                .header("x-request-id", Uuid::new_v4().to_string())
                .header("idempotency-key", key.to_string())
                .body(Body::from(b.to_string()))
                .unwrap();
            let res = app.oneshot(request).await.unwrap();
            assert_eq!(res.status(), StatusCode::ACCEPTED);
            serde_json::from_slice::<Value>(
                &axum::body::to_bytes(res.into_body(), 1024 * 1024)
                    .await
                    .unwrap(),
            )
            .unwrap()
        }));
    }
    let mut replies = vec![];
    for task in tasks {
        replies.push(task.await.unwrap())
    }
    assert!(replies.iter().all(|v| v == &replies[0]));
    let mut state = provider.data.lock().await;
    assert_eq!(state.performance.as_ref().unwrap().jobs.len(), 1);
    assert_eq!(
        state
            .audits
            .iter()
            .filter(|v| v["auditRef"] == replies[0]["auditRef"])
            .count(),
        1
    );
    state.session_active = false;
    drop(state);
    assert_eq!(
        app.oneshot(req()).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
}
#[test]
fn altered_valuation_and_out_of_order_versions_never_append() {
    let (a, mut p, mut r, n, _) = setup();
    let id = p.points[0].run;
    let before = p.points.len();
    let empty = InMemoryPortfolioProjection::new(a.tenant_id, n);
    assert_eq!(
        p.observe_checked(&a, id, &empty, &mut r, n).unwrap_err().1,
        "VALUATION_LEDGER_MISMATCH"
    );
    assert_eq!(p.points.len(), before);
    use quantos_portfolio::{
        FillEvent, FillSide, MarkPriceEvent, PortfolioEvent, PortfolioEventKind,
    };
    let first = n - Duration::minutes(2);
    let mut input = r.performance_source(&a, id, n).unwrap().0;
    input.actual.revision = 4;
    input.expected.revision = 4;
    let next = r.observe(&a, input, n).unwrap();
    let projection = InMemoryPortfolioProjection::rebuild(
        a.tenant_id,
        first,
        &[
            PortfolioEvent {
                event_id: "first-fill".into(),
                sequence: 1,
                occurred_at: first,
                kind: PortfolioEventKind::Fill(FillEvent {
                    account_id: a.account_id.unwrap(),
                    symbol: "BTCUSD".into(),
                    side: FillSide::Buy,
                    quantity: 2.,
                    price: 100.,
                    fee: 1.,
                }),
            },
            PortfolioEvent {
                event_id: "first-mark".into(),
                sequence: 2,
                occurred_at: first,
                kind: PortfolioEventKind::MarkPrice(MarkPriceEvent {
                    symbol: "BTCUSD".into(),
                    price: 100.,
                }),
            },
        ],
    )
    .unwrap();
    assert_eq!(
        p.observe_checked(&a, next, &projection, &mut r, n)
            .unwrap_err()
            .1,
        "VALUATION_TIME_CONFLICT"
    );
    assert_eq!(p.points.len(), before);
}
#[test]
fn trusted_cash_flow_refuses_simple_return_instead_of_fabricating_attribution() {
    use quantos_portfolio::{
        FillEvent, FillSide, MarkPriceEvent, PortfolioEvent, PortfolioEventKind,
    };
    let (a, mut p, mut r, n, mut q) = setup();
    let at = n + Duration::minutes(1);
    let mut i = r.performance_source(&a, p.points[2].run, n).unwrap().0;
    for book in [&mut i.expected, &mut i.actual] {
        book.revision = 4;
        book.seed.cash += Decimal::from(100);
        book.ledger.cash += Decimal::from(100);
        book.captured_at = at;
        book.positions[0].mark.source_at = at;
        book.positions[0].mark.sequence += 1;
    }
    i.available_at = at;
    i.day = at.date_naive();
    let id = r.observe(&a, i, at).unwrap();
    let projection = InMemoryPortfolioProjection::rebuild(
        a.tenant_id,
        n - Duration::minutes(2),
        &[
            PortfolioEvent {
                event_id: "actual-fill".into(),
                sequence: 1,
                occurred_at: n - Duration::minutes(2),
                kind: PortfolioEventKind::Fill(FillEvent {
                    account_id: a.account_id.unwrap(),
                    symbol: "BTCUSD".into(),
                    side: FillSide::Buy,
                    quantity: 2.,
                    price: 100.,
                    fee: 1.,
                }),
            },
            PortfolioEvent {
                event_id: "actual-mark".into(),
                sequence: 2,
                occurred_at: at,
                kind: PortfolioEventKind::MarkPrice(MarkPriceEvent {
                    symbol: "BTCUSD".into(),
                    price: 105.,
                }),
            },
        ],
    )
    .unwrap();
    p.observe_checked(&a, id, &projection, &mut r, at).unwrap();
    q.insert("end".into(), at.to_rfc3339());
    assert_eq!(
        p.calculate(&a, &q, &mut r, at).unwrap_err().1,
        "CASH_FLOW_UNSUPPORTED"
    );
}

#[test]
fn expired_report_tickets_release_capacity_without_reviving_old_grants() {
    let (a, mut p, mut r, n, q) = setup();
    let headers = headers();
    let body = json!(q);
    let request = |p: &mut PerformanceHost,
                   r: &mut ReconciliationHost,
                   method: Method,
                   path: &str,
                   h: &HeaderMap,
                   b: &Value,
                   now: DateTime<Utc>| {
        p.handle(&a, "s", &method, path, &BTreeMap::new(), h, b, r, now)
    };
    let first = request(
        &mut p,
        &mut r,
        Method::POST,
        "/v1/performance/reports",
        &headers,
        &body,
        n,
    )
    .unwrap();
    let old = format!(
        "/v1/performance/reports/{}",
        first.1["reportId"].as_str().unwrap()
    );
    request(
        &mut p,
        &mut r,
        Method::GET,
        &format!("{old}/status"),
        &headers,
        &json!({}),
        n,
    )
    .unwrap();
    let mut first_grant = Value::Null;
    for index in 0..1000 {
        let grant = request(
            &mut p,
            &mut r,
            Method::GET,
            &format!("{old}/download"),
            &headers,
            &json!({}),
            n,
        )
        .unwrap()
        .1;
        if index == 0 {
            first_grant = grant;
        }
    }
    assert_eq!(
        request(
            &mut p,
            &mut r,
            Method::GET,
            &format!("{old}/download"),
            &headers,
            &json!({}),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::TOO_MANY_REQUESTS
    );
    let token = first_grant["downloadPath"]
        .as_str()
        .unwrap()
        .split("ticket=")
        .nth(1)
        .unwrap();
    let query = BTreeMap::from([("ticket".into(), token.into())]);
    assert_eq!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            &format!("{old}/content"),
            &query,
            &headers,
            &json!({}),
            &mut r,
            n + Duration::seconds(60)
        )
        .unwrap_err()
        .1,
        "DOWNLOAD_EXPIRED"
    );
    let later = n + Duration::minutes(15);
    let mut next_headers = HeaderMap::new();
    next_headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    let next = request(
        &mut p,
        &mut r,
        Method::POST,
        "/v1/performance/reports",
        &next_headers,
        &body,
        later,
    )
    .unwrap()
    .1;
    let path = format!(
        "/v1/performance/reports/{}",
        next["reportId"].as_str().unwrap()
    );
    request(
        &mut p,
        &mut r,
        Method::GET,
        &format!("{path}/status"),
        &next_headers,
        &json!({}),
        later,
    )
    .unwrap();
    assert_eq!(
        request(
            &mut p,
            &mut r,
            Method::GET,
            &format!("{path}/download"),
            &next_headers,
            &json!({}),
            later
        )
        .unwrap()
        .0,
        StatusCode::OK
    );
    assert_eq!(p.tickets.len(), 1);
    assert_eq!(
        p.handle(
            &a,
            "s",
            &Method::GET,
            &format!("{old}/content"),
            &query,
            &headers,
            &json!({}),
            &mut r,
            later
        )
        .unwrap_err()
        .1,
        "REPORT_EXPIRED"
    );
    assert_eq!(
        request(
            &mut p,
            &mut r,
            Method::POST,
            "/v1/performance/reports",
            &headers,
            &body,
            later
        )
        .unwrap(),
        first
    );
    assert_eq!(p.jobs.len(), 2);
}
