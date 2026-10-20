use super::*;
use axum::{body::Body, http::Request};
use quantos_policy::{Capability, Role};
use tower::ServiceExt;
fn setup() -> (AuthContext, ReconciliationHost, DateTime<Utc>) {
    let a = reference_auth(crate::CURRENT_SESSION);
    let now = Utc::now();
    let input = fixture(&a, now);
    let host = ReconciliationHost::new(&a, input, now).unwrap();
    (a, host, now)
}
fn headers(key: Uuid, version: &str) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("idempotency-key", key.to_string().parse().unwrap());
    h.insert("if-match", version.parse().unwrap());
    h
}
fn first(h: &ReconciliationHost) -> Uuid {
    *h.runs.keys().next().unwrap()
}
fn call(
    h: &mut ReconciliationHost,
    a: &AuthContext,
    m: Method,
    path: &str,
    headers: &HeaderMap,
    b: Value,
    now: DateTime<Utc>,
) -> Result<(StatusCode, Value)> {
    h.handle(
        a,
        "trusted-session",
        &m,
        path,
        &BTreeMap::new(),
        headers,
        &b,
        now,
    )
}
#[test]
fn real_x05_run_and_immutable_ledger_projections() {
    let (a, mut h, n) = setup();
    let id = first(&h);
    let r = call(
        &mut h,
        &a,
        Method::GET,
        &format!("/v1/reconciliation/runs/{id}"),
        &HeaderMap::new(),
        json!({}),
        n,
    )
    .unwrap()
    .1;
    assert_eq!(r["result"], "differences");
    assert!(r["reportHash"].as_str().unwrap().starts_with("sha256:"));
    let old = h.ledger();
    assert!(!old.is_empty());
    assert!(
        old.iter()
            .filter(|r| r["kind"] == "snapshot")
            .all(|r| r["amounts"]["cash"].is_string())
    );
    let p = format!("/v1/reconciliation/runs/{id}/reruns");
    call(
        &mut h,
        &a,
        Method::POST,
        &p,
        &headers(Uuid::new_v4(), "0"),
        json!({"reason":"re-evaluate owner observations"}),
        n,
    )
    .unwrap();
    let new = h.ledger();
    assert!(new.len() > old.len());
    assert!(old.iter().all(|e| new.contains(e)));
}
#[test]
fn original_retry_recovers_without_rerun_even_after_source_expiry() {
    let (a, mut h, n) = setup();
    let p = format!("/v1/reconciliation/runs/{}/reruns", first(&h));
    let hdr = headers(Uuid::new_v4(), "0");
    let b = json!({"reason":"受控复核".repeat(25)});
    let r = call(&mut h, &a, Method::POST, &p, &hdr, b.clone(), n).unwrap();
    let journal = h.core.journal(&a).unwrap();
    for _ in 0..1000 {
        assert_eq!(
            call(
                &mut h,
                &a,
                Method::POST,
                &p,
                &hdr,
                b.clone(),
                n + Duration::minutes(8)
            )
            .unwrap(),
            r
        )
    }
    assert_eq!(h.core.journal(&a).unwrap(), journal);
    assert_eq!(h.runs.len(), 2);
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            &p,
            &hdr,
            json!({"reason":"other"}),
            n
        )
        .unwrap_err()
        .1,
        "IDEMPOTENCY_CONFLICT"
    );
}
#[test]
fn version_race_and_stale_sources_cannot_change_core_journal() {
    let (a, mut h, n) = setup();
    let p = format!("/v1/reconciliation/runs/{}/reruns", first(&h));
    let before = h.core.journal(&a).unwrap();
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            &p,
            &headers(Uuid::new_v4(), "9"),
            json!({"reason":"race"}),
            n
        )
        .unwrap_err()
        .1,
        "VERSION_CONFLICT"
    );
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            &p,
            &headers(Uuid::new_v4(), "0"),
            json!({"reason":"stale"}),
            n + Duration::minutes(6)
        )
        .unwrap_err()
        .1,
        "STALE_RECONCILIATION_SOURCE"
    );
    assert_eq!(h.core.journal(&a).unwrap(), before);
    assert_eq!(h.runs.len(), 1);
}
#[test]
fn tenant_workspace_account_mode_role_capability_are_authoritative() {
    let (a, mut h, n) = setup();
    let p = format!("/v1/reconciliation/runs/{}", first(&h));
    let mut cases = vec![];
    let mut b = a.clone();
    b.tenant_id = quantos_core::TenantId::new();
    cases.push(b);
    let mut b = a.clone();
    b.workspace_id = quantos_core::WorkspaceId::new();
    cases.push(b);
    let mut b = a.clone();
    b.account_id = Some(quantos_core::AccountId::new());
    cases.push(b);
    let mut b = a.clone();
    b.mode = RunMode::Paper;
    cases.push(b);
    let mut b = a.clone();
    b.role = Role::Viewer;
    cases.push(b);
    let mut b = a.clone();
    b.capabilities.clear();
    cases.push(b);
    for b in cases {
        assert_eq!(
            call(&mut h, &b, Method::GET, &p, &HeaderMap::new(), json!({}), n)
                .unwrap_err()
                .0,
            StatusCode::FORBIDDEN
        )
    }
    let q = BTreeMap::from([("accountId".into(), Uuid::new_v4().to_string())]);
    assert_eq!(
        h.handle(
            &a,
            "session",
            &Method::GET,
            "/v1/ledger/entries",
            &q,
            &HeaderMap::new(),
            &json!({}),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::NOT_FOUND
    );
}
#[test]
fn no_ledger_edit_or_browser_source_or_closure_injection() {
    let (a, mut h, n) = setup();
    let before = h.core.journal(&a).unwrap();
    let p = format!("/v1/reconciliation/runs/{}/reruns", first(&h));
    for b in [
        json!({"reason":"fix","cash":"1000"}),
        json!({"reason":"fix","input":h.input}),
        json!({"reason":"fix","status":"closed"}),
        json!({"reason":" "}),
    ] {
        assert!(
            call(
                &mut h,
                &a,
                Method::POST,
                &p,
                &headers(Uuid::new_v4(), "0"),
                b,
                n
            )
            .is_err()
        );
    }
    assert!(
        call(
            &mut h,
            &a,
            Method::POST,
            "/v1/ledger/entries",
            &headers(Uuid::new_v4(), "0"),
            json!({"cash":"10"}),
            n
        )
        .is_err()
    );
    assert_eq!(h.core.journal(&a).unwrap(), before);
}
#[test]
fn breaks_reflect_only_real_core_acknowledgement_and_verified_closure() {
    let (a, mut h, n) = setup();
    let e = h.core.records(&a).unwrap().remove(0);
    assert_eq!(h.breaks(&a).unwrap()[0]["status"], "open");
    h.core
        .acknowledge(&a, &e.exception_id, 0, n + Duration::seconds(1))
        .unwrap();
    assert_eq!(h.breaks(&a).unwrap()[0]["status"], "acknowledged");
    let at = n + Duration::seconds(2);
    let mut clean = h.input.clone();
    clean.actual.ledger = clean.expected.ledger.clone();
    clean.available_at = at;
    for b in [&mut clean.expected, &mut clean.actual] {
        b.captured_at = at;
        b.revision += 1;
        for p in &mut b.positions {
            p.mark.source_at = at;
            p.mark.sequence += 1;
        }
    }
    h.replace_input(&a, clean, at).unwrap();
    let p = format!("/v1/reconciliation/runs/{}/reruns", first(&h));
    let r = call(
        &mut h,
        &a,
        Method::POST,
        &p,
        &headers(Uuid::new_v4(), "0"),
        json!({"reason":"new trusted source"}),
        at,
    )
    .unwrap()
    .1;
    let id = Uuid::parse_str(r["jobId"].as_str().unwrap()).unwrap();
    h.core
        .close(
            &a,
            &e.exception_id,
            1,
            h.runs[&id].report.id(),
            "verified fresh correction",
            at,
        )
        .unwrap();
    let e = h.breaks(&a).unwrap().remove(0);
    assert_eq!(e["status"], "closed");
    assert!(e["closureReportHash"].is_string());
    assert_eq!(h.run(id, at).unwrap()["result"], "clean");
    assert_eq!(h.run(id, at).unwrap()["provisional"], true);
    h.core
        .close_day(&a, at.date_naive(), h.runs[&id].report.id(), at)
        .unwrap();
    let path = format!("/v1/reconciliation/runs/{id}/stream");
    let (_, stream) = call(
        &mut h,
        &a,
        Method::GET,
        &path,
        &HeaderMap::new(),
        json!({}),
        at,
    )
    .unwrap();
    assert_eq!(
        stream["events"].as_array().unwrap().last().unwrap()["payload"]["provisional"],
        false
    );
    assert_eq!(h.run(id, at).unwrap()["provisional"], false);
}
#[test]
fn frozen_page_rejects_role_capability_session_query_and_expiry_changes() {
    let (a, mut h, n) = setup();
    let q = BTreeMap::from([("pageSize".into(), "1".into())]);
    let (_, page) = h
        .handle(
            &a,
            "s",
            &Method::GET,
            "/v1/ledger/entries",
            &q,
            &HeaderMap::new(),
            &json!({}),
            n,
        )
        .unwrap();
    let mut next = q;
    next.insert("cursor".into(), page["nextCursor"].as_str().unwrap().into());
    let replay = h
        .handle(
            &a,
            "s",
            &Method::GET,
            "/v1/ledger/entries",
            &next,
            &HeaderMap::new(),
            &json!({}),
            n,
        )
        .unwrap();
    assert_ne!(page["items"], replay.1["items"]);
    let mut b = a.clone();
    b.role = Role::Owner;
    assert_eq!(
        h.handle(
            &b,
            "s",
            &Method::GET,
            "/v1/ledger/entries",
            &next,
            &HeaderMap::new(),
            &json!({}),
            n
        )
        .unwrap_err()
        .1,
        "CURSOR_SCOPE_CONFLICT"
    );
    let mut b = a.clone();
    b.capabilities
        .insert(Capability::parse("audit.read").unwrap());
    assert!(
        h.handle(
            &b,
            "s",
            &Method::GET,
            "/v1/ledger/entries",
            &next,
            &HeaderMap::new(),
            &json!({}),
            n
        )
        .is_err()
    );
    assert!(
        h.handle(
            &a,
            "other",
            &Method::GET,
            "/v1/ledger/entries",
            &next,
            &HeaderMap::new(),
            &json!({}),
            n
        )
        .is_err()
    );
    assert!(
        h.handle(
            &a,
            "s",
            &Method::GET,
            "/v1/ledger/entries",
            &next,
            &HeaderMap::new(),
            &json!({}),
            n + Duration::minutes(6)
        )
        .is_err()
    );
}
#[test]
fn journal_resume_gap_staleness_and_poison_refuse_false_success() {
    let (a, mut h, n) = setup();
    let p = format!("/v1/reconciliation/runs/{}/stream", first(&h));
    let (_, v) = call(&mut h, &a, Method::GET, &p, &HeaderMap::new(), json!({}), n).unwrap();
    assert_eq!(v["events"].as_array().unwrap().len(), 1);
    for (after, ok) in [("1", true), ("9", false)] {
        let q = BTreeMap::from([("afterSequence".into(), after.into())]);
        let r = h.handle(
            &a,
            "s",
            &Method::GET,
            &p,
            &q,
            &HeaderMap::new(),
            &json!({}),
            n,
        );
        assert_eq!(r.is_ok(), ok);
        if ok {
            assert!(r.unwrap().1["events"].as_array().unwrap().is_empty())
        }
    }
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::GET,
            &p,
            &HeaderMap::new(),
            json!({}),
            n + Duration::minutes(6)
        )
        .unwrap_err()
        .1,
        "SOURCE_LEASE_EXPIRED"
    );
    h.poisoned = true;
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::GET,
            "/v1/ledger/entries",
            &HeaderMap::new(),
            json!({}),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
#[test]
fn untrusted_source_renewal_is_rejected_and_report_unchanged() {
    let (a, mut h, n) = setup();
    let before = h.input.clone();
    let mut i = before.clone();
    i.scope.account_id = quantos_core::AccountId::new();
    assert!(h.replace_input(&a, i, n).is_err());
    let mut i = before.clone();
    i.available_at = n + Duration::minutes(1);
    assert!(h.replace_input(&a, i, n).is_err());
    assert_eq!(h.input, before);
}
async fn http(
    p: &crate::BffProvider,
    m: &str,
    path: &str,
    key: Uuid,
    body: Value,
    session: &str,
) -> (StatusCode, Value) {
    let req = Request::builder()
        .method(m)
        .uri(path)
        .header(
            "cookie",
            format!(
                "quantos_session={session}; quantos_csrf={}",
                crate::CSRF_TOKEN
            ),
        )
        .header("origin", crate::ALLOWED_ORIGIN)
        .header("x-csrf-token", crate::CSRF_TOKEN)
        .header("idempotency-key", key.to_string())
        .header("if-match", "0")
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("content-type", "application/json")
        .body(if m == "GET" {
            Body::empty()
        } else {
            Body::from(body.to_string())
        })
        .unwrap();
    let r = p.router().oneshot(req).await.unwrap();
    let s = r.status();
    let b = axum::body::to_bytes(r.into_body(), 1024 * 1024)
        .await
        .unwrap();
    (s, serde_json::from_slice(&b).unwrap_or(Value::Null))
}
#[tokio::test]
async fn concurrent_http_retries_have_one_run_and_closed_f05_root() {
    let p = crate::BffProvider::shadow_reference();
    let list = http(
        &p,
        "GET",
        "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444",
        Uuid::new_v4(),
        json!({}),
        crate::CURRENT_SESSION,
    )
    .await;
    assert_eq!(list.0, StatusCode::OK);
    let id = list.1["items"][0]["runId"].as_str().unwrap();
    let path = format!("/v1/reconciliation/runs/{id}/reruns");
    let key = Uuid::new_v4();
    let mut joins = vec![];
    for _ in 0..40 {
        let p = p.clone();
        let path = path.clone();
        joins.push(tokio::spawn(async move {
            http(
                &p,
                "POST",
                &path,
                key,
                json!({"reason":"concurrent recovery"}),
                crate::CURRENT_SESSION,
            )
            .await
        }));
    }
    let mut results = vec![];
    for j in joins {
        results.push(j.await.unwrap())
    }
    assert!(
        results
            .iter()
            .all(|r| r == &results[0] && r.0 == StatusCode::ACCEPTED)
    );
    let breaks = http(
        &p,
        "GET",
        "/v1/reconciliation/breaks?accountId=44444444-4444-4444-8444-444444444444",
        Uuid::new_v4(),
        json!({}),
        crate::CURRENT_SESSION,
    )
    .await;
    let member = format!(
        "/v1/reconciliation/breaks/{}",
        breaks.1["items"][0]["breakId"]
            .as_str()
            .unwrap()
            .replace(":", "%3A")
    );
    assert_eq!(
        http(
            &p,
            "GET",
            &member,
            Uuid::new_v4(),
            json!({}),
            crate::CURRENT_SESSION
        )
        .await
        .1["status"],
        "open"
    );
    let s = p.data.lock().await;
    assert_eq!(s.reconciliation.as_ref().unwrap().runs.len(), 2);
    let root = results[0].1["auditRef"].clone();
    let roots = s
        .audits
        .iter()
        .filter(|r| r["eventId"] == root)
        .collect::<Vec<_>>();
    assert_eq!(roots.len(), 1);
    assert_eq!(roots[0]["causationId"], root);
    assert_eq!(
        roots[0]["actor"],
        reference_auth(crate::CURRENT_SESSION).actor_id.to_string()
    );
}
#[tokio::test]
async fn denied_session_no_capability_and_logout_cannot_read_or_rerun() {
    let p = crate::BffProvider::shadow_reference();
    for (session, status) in [
        ("missing", 401),
        (crate::VIEWER_SESSION, 403),
        ("session-approver", 403),
    ] {
        let r = http(
            &p,
            "GET",
            "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444",
            Uuid::new_v4(),
            json!({}),
            session,
        )
        .await;
        assert_eq!(r.0.as_u16(), status);
    }
    p.data.lock().await.session_active = false;
    assert_eq!(
        http(
            &p,
            "GET",
            "/v1/ledger/entries?accountId=44444444-4444-4444-8444-444444444444",
            Uuid::new_v4(),
            json!({}),
            crate::CURRENT_SESSION
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
}
#[tokio::test]
async fn explicit_context_never_crosses_shadow_into_paper_dispatch_or_strategy() {
    let paper = crate::BffProvider::default();
    assert_eq!(
        http(
            &paper,
            "GET",
            "/v1/reconciliation/runs?accountId=44444444-4444-4444-8444-444444444444",
            Uuid::new_v4(),
            json!({}),
            crate::CURRENT_SESSION
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let shadow = crate::BffProvider::shadow_reference();
    let context = http(
        &shadow,
        "GET",
        "/v1/context",
        Uuid::new_v4(),
        json!({}),
        crate::CURRENT_SESSION,
    )
    .await;
    assert_eq!(context.1["mode"], "shadow");
    for (m, path, b) in [
        ("GET", "/v1/strategies", json!({})),
        ("GET", "/v1/proposals", json!({})),
        ("POST", "/v1/commands", json!({"commandRef":Uuid::new_v4()})),
    ] {
        assert_eq!(
            http(&shadow, m, path, Uuid::new_v4(), b, crate::CURRENT_SESSION)
                .await
                .0,
            StatusCode::FORBIDDEN
        )
    }
    let state = shadow.data.lock().await;
    assert!(state.execution.is_none());
    assert!(state.strategy.is_none());
}

#[tokio::test]
async fn bounded_cursor_abuse_returns_retry_envelope_without_ledger_mutation() {
    let p = crate::BffProvider::shadow_reference();
    for _ in 0..1000 {
        assert_eq!(
            http(
                &p,
                "GET",
                "/v1/ledger/entries?accountId=44444444-4444-4444-8444-444444444444&pageSize=1",
                Uuid::new_v4(),
                json!({}),
                crate::CURRENT_SESSION
            )
            .await
            .0,
            StatusCode::OK
        );
    }
    let r = http(
        &p,
        "GET",
        "/v1/ledger/entries?accountId=44444444-4444-4444-8444-444444444444&pageSize=1",
        Uuid::new_v4(),
        json!({}),
        crate::CURRENT_SESSION,
    )
    .await;
    assert_eq!(r.0, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(r.1["retryAfter"], 60);
    let s = p.data.lock().await;
    assert_eq!(s.reconciliation.as_ref().unwrap().runs.len(), 1);
    assert_eq!(s.reconciliation.as_ref().unwrap().ledger().len(), 4);
}

#[test]
fn rerun_cannot_silently_switch_the_original_day_and_owner_feed_keeps_history() {
    let (a, mut h, n) = setup();
    let old = first(&h);
    let before = h.ledger();
    let next = n + Duration::days(1);
    let mut input = h.input.clone();
    input.day = next.date_naive();
    input.available_at = next;
    for b in [&mut input.actual, &mut input.expected] {
        b.captured_at = next;
        b.revision += 1;
        for p in &mut b.positions {
            p.mark.source_at = next;
            p.mark.sequence += 1;
        }
    }
    let id = h.observe(&a, input, next).unwrap();
    assert_eq!(
        h.run(id, next).unwrap()["day"],
        next.date_naive().to_string()
    );
    assert!(before.iter().all(|e| h.ledger().contains(e)));
    let journal = h.core.journal(&a).unwrap();
    let p = format!("/v1/reconciliation/runs/{old}/reruns");
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            &p,
            &headers(Uuid::new_v4(), "0"),
            json!({"reason":"wrong window"}),
            next
        )
        .unwrap_err()
        .1,
        "RECONCILIATION_WINDOW_CHANGED"
    );
    assert_eq!(h.core.journal(&a).unwrap(), journal);
}

fn observe_cash(
    h: &mut ReconciliationHost,
    a: &AuthContext,
    now: DateTime<Utc>,
    cash: i64,
) -> Uuid {
    let mut input = h.input.clone();
    input.day = now.date_naive();
    input.available_at = now;
    input.actual.ledger.cash = rust_decimal::Decimal::new(cash, 0);
    for book in [&mut input.expected, &mut input.actual] {
        book.captured_at = now;
        book.revision += 1;
        for position in &mut book.positions {
            position.mark.source_at = now;
            position.mark.sequence += 1;
        }
    }
    h.observe(a, input, now).unwrap()
}

#[test]
fn break_values_follow_latest_report_for_each_day() {
    let (a, mut h, n) = setup();
    let ledger = h.ledger();
    let same_day = observe_cash(&mut h, &a, n, 797);
    let next = n + Duration::days(1);
    let next_day = observe_cash(&mut h, &a, next, 796);
    let journal = h.core.journal(&a).unwrap();
    let rows = call(
        &mut h,
        &a,
        Method::GET,
        "/v1/reconciliation/breaks",
        &HeaderMap::new(),
        json!({}),
        next,
    )
    .unwrap()
    .1;
    for (day, run, cash) in [
        (n.date_naive(), same_day, "797"),
        (next.date_naive(), next_day, "796"),
    ] {
        let item = rows["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| {
                v["day"] == day.to_string()
                    && v["kind"] == "LedgerBalanceMismatch"
                    && v["entity"] == "ledger/cash"
            })
            .unwrap();
        assert_eq!(item["runId"], run.to_string());
        assert_eq!(
            serde_json::from_str::<Value>(item["expectedJson"].as_str().unwrap()).unwrap(),
            json!("799")
        );
        assert_eq!(
            serde_json::from_str::<Value>(item["actualJson"].as_str().unwrap()).unwrap(),
            json!(cash)
        );
        let member = format!(
            "/v1/reconciliation/breaks/{}",
            item["breakId"].as_str().unwrap()
        );
        assert_eq!(
            call(
                &mut h,
                &a,
                Method::GET,
                &member,
                &HeaderMap::new(),
                json!({}),
                next
            )
            .unwrap()
            .1,
            *item
        );
    }
    assert_eq!(h.core.journal(&a).unwrap(), journal);
    assert!(ledger.iter().all(|entry| h.ledger().contains(entry)));
}

#[test]
fn missing_break_report_is_unavailable_without_history_fallback() {
    let (a, mut h, n) = setup();
    let id = observe_cash(&mut h, &a, n, 797);
    h.runs.remove(&id);
    let journal = h.core.journal(&a).unwrap();
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::GET,
            "/v1/reconciliation/breaks",
            &HeaderMap::new(),
            json!({}),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    assert_eq!(h.core.journal(&a).unwrap(), journal);
}

#[test]
fn cursor_chain_expires_at_original_deadline_for_all_c15_pages() {
    let (a, mut h, n) = setup();
    observe_cash(&mut h, &a, n + Duration::days(1), 797);
    let now = n + Duration::days(2);
    observe_cash(&mut h, &a, now, 796);
    let ledger = h.ledger();
    for path in [
        "/v1/reconciliation/runs",
        "/v1/reconciliation/breaks",
        "/v1/ledger/entries",
    ] {
        let mut query = BTreeMap::from([("pageSize".into(), "1".into())]);
        let first = h
            .handle(
                &a,
                "s",
                &Method::GET,
                path,
                &query,
                &HeaderMap::new(),
                &json!({}),
                now,
            )
            .unwrap()
            .1;
        query.insert(
            "cursor".into(),
            first["nextCursor"].as_str().unwrap().into(),
        );
        let second = h
            .handle(
                &a,
                "s",
                &Method::GET,
                path,
                &query,
                &HeaderMap::new(),
                &json!({}),
                now + Duration::minutes(4),
            )
            .unwrap()
            .1;
        query.insert(
            "cursor".into(),
            second["nextCursor"].as_str().unwrap().into(),
        );
        let third = h
            .handle(
                &a,
                "s",
                &Method::GET,
                path,
                &query,
                &HeaderMap::new(),
                &json!({}),
                now + Duration::seconds(270),
            )
            .unwrap()
            .1;
        assert_ne!(second["items"], third["items"]);
        assert_eq!(
            h.handle(
                &a,
                "s",
                &Method::GET,
                path,
                &query,
                &HeaderMap::new(),
                &json!({}),
                now + Duration::minutes(5)
            )
            .unwrap_err()
            .1,
            "CURSOR_EXPIRED"
        );
    }
    assert_eq!(h.ledger(), ledger);
}

#[tokio::test]
async fn http_sort_contract_accepts_registered_expressions_and_rejects_unsafe_fields() {
    let p = crate::BffProvider::shadow_reference();
    for route in [
        "/v1/reconciliation/runs",
        "/v1/reconciliation/breaks",
        "/v1/ledger/entries",
    ] {
        for (sort, status) in [
            ("id:asc", 200),
            ("id:desc", 200),
            ("runId:asc", 422),
            ("id:invalid", 422),
            ("id:desc:extra", 422),
        ] {
            let path =
                format!("{route}?accountId=44444444-4444-4444-8444-444444444444&sort={sort}");
            assert_eq!(
                http(
                    &p,
                    "GET",
                    &path,
                    Uuid::new_v4(),
                    json!({}),
                    crate::CURRENT_SESSION
                )
                .await
                .0
                .as_u16(),
                status,
                "{path}"
            );
        }
    }
    let paper = crate::BffProvider::default();
    for (sort, status) in [
        ("orderId:desc", 200),
        ("password:asc", 422),
        ("orderId:invalid", 422),
        ("orderId:desc:extra", 422),
    ] {
        let path = format!("/v1/orders?accountId=44444444-4444-4444-8444-444444444444&sort={sort}");
        assert_eq!(
            http(
                &paper,
                "GET",
                &path,
                Uuid::new_v4(),
                json!({}),
                crate::CURRENT_SESSION
            )
            .await
            .0
            .as_u16(),
            status,
            "{path}"
        );
    }
}
