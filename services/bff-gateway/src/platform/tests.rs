use super::*;
use crate::BffProvider;
use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use tower::ServiceExt;
fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-20T01:00:00Z")
        .unwrap()
        .with_timezone(&Utc)
}
fn job(id: u128) -> Value {
    json!({"exportId":Uuid::from_u128(id),"format":"csv","requestedAt":"2026-10-20T00:00:00Z","status":"ready","retentionUntil":"2026-10-20T02:00:00Z","correlationId":Uuid::nil(),"downloadUrl":"https://private.invalid/?secret=raw","object_key":"private/path","reason":"PRIVATE","session":"SECRET"})
}
fn items() -> Vec<Value> {
    (1..=4)
        .map(|id| record(&job(id), now(), true).unwrap())
        .collect()
}
fn query() -> HistoryQuery {
    HistoryQuery {
        page_size: Some(1),
        ..Default::default()
    }
}
#[test]
fn browser_policy_keeps_local_permission_unknown_and_degrades_without_prompts() {
    let p = policy("https://terminal.invalid");
    assert_eq!(p["permissionState"]["notifications"], "unknown");
    assert_eq!(p["permissionState"]["clipboard"], "unknown");
    assert_eq!(p["permissionState"]["requestedByServer"], false);
    assert_eq!(p["downloadLinkTtlSeconds"], 300);
    assert_eq!(p["downloadHistoryIncludesLinks"], false);
    assert_eq!(p["fallbacks"].as_array().unwrap().len(), 4);
}
#[test]
fn history_whitelist_never_replays_urls_tokens_labels_or_local_paths() {
    let r = record(&job(1), now(), true).unwrap();
    let raw = r.to_string();
    for s in [
        "secret",
        "PRIVATE",
        "SECRET",
        "object_key",
        "session",
        "downloadUrl",
        "private/path",
    ] {
        assert!(!raw.contains(s));
    }
    assert_eq!(
        r["downloadPath"],
        format!("/v1/exports/{}/download", Uuid::from_u128(1))
    );
    assert_eq!(r.as_object().unwrap().len(), 9);
}
#[test]
fn owner_capability_retention_and_state_control_download_action() {
    for (state, expected) in [
        ("queued", "preparing"),
        ("running", "preparing"),
        ("ready", "ready"),
        ("failed", "failed"),
        ("cancelled", "failed"),
        ("expired", "expired"),
    ] {
        let mut j = job(1);
        j["status"] = json!(state);
        let r = record(&j, now(), true).unwrap();
        assert_eq!(r["status"], expected);
        assert_eq!(r.get("downloadPath").is_some(), expected == "ready");
    }
    assert!(
        record(&job(1), now(), false)
            .unwrap()
            .get("downloadPath")
            .is_none()
    );
    let r = record(&job(1), now() + Duration::hours(1), true).unwrap();
    assert_eq!(r["status"], "expired");
    assert!(r.get("downloadPath").is_none());
}
#[test]
fn malformed_source_never_becomes_partial_or_empty_success() {
    for (field, value) in [
        ("exportId", "not-uuid"),
        ("correlationId", "bad"),
        ("requestedAt", "NaN"),
        ("retentionUntil", "bad"),
        ("format", "../../secret"),
        ("status", "invented"),
    ] {
        let mut j = job(1);
        j[field] = json!(value);
        assert_eq!(record(&j, now(), true), Err(Fault::Unavailable));
    }
}
#[test]
fn history_filters_sorts_and_breaks_equal_timestamp_ties_before_paging() {
    let mut h = History::default();
    let p = h.page("owner", items(), query(), now()).unwrap();
    assert_eq!(p["items"][0]["downloadId"], Uuid::from_u128(4).to_string());
    let next = p["nextCursor"].as_str().unwrap().to_owned();
    let q = HistoryQuery {
        cursor: Some(next),
        ..query()
    };
    let a = h.page("owner", items(), q.clone(), now()).unwrap();
    let b = h.page("owner", items(), q, now()).unwrap();
    assert_eq!(a["items"], b["items"]);
    assert_eq!(a["items"][0]["downloadId"], Uuid::from_u128(3).to_string());
    let q = HistoryQuery {
        filter: Some("status:eq:failed".into()),
        ..query()
    };
    assert_eq!(
        h.page("owner", items(), q, now()).unwrap()["items"],
        json!([])
    );
}
#[test]
fn cursor_binds_identity_session_query_page_size_and_current_revision() {
    let mut h = History::default();
    let p = h
        .page("session:tenant:account", items(), query(), now())
        .unwrap();
    let q = HistoryQuery {
        cursor: p["nextCursor"].as_str().map(str::to_owned),
        ..query()
    };
    for binding in ["other-session:tenant:account", "session:tenant:other"] {
        assert_eq!(
            h.page(binding, items(), q.clone(), now()),
            Err(Fault::Cursor)
        );
    }
    for q2 in [
        HistoryQuery {
            page_size: Some(2),
            ..q.clone()
        },
        HistoryQuery {
            sort: Some("status:asc".into()),
            ..q.clone()
        },
        HistoryQuery {
            filter: Some("status:eq:ready".into()),
            ..q.clone()
        },
    ] {
        assert_eq!(
            h.page("session:tenant:account", items(), q2, now()),
            Err(Fault::Cursor)
        );
    }
    let mut rows = items();
    rows.remove(0);
    assert_eq!(
        h.page("session:tenant:account", rows, q, now()),
        Err(Fault::Cursor)
    );
}
#[test]
fn cursor_expiry_tamper_and_row_limit_refuse_with_recoverable_reload() {
    let mut h = History::default();
    let p = h.page("a", items(), query(), now()).unwrap();
    let q = HistoryQuery {
        cursor: p["nextCursor"].as_str().map(str::to_owned),
        ..query()
    };
    assert_eq!(
        h.page("a", items(), q, now() + Duration::seconds(60)),
        Err(Fault::Cursor)
    );
    assert_eq!(
        h.page(
            "a",
            items(),
            HistoryQuery {
                cursor: Some("downloads:1".into()),
                ..query()
            },
            now()
        ),
        Err(Fault::Cursor)
    );
    assert_eq!(
        h.page("a", vec![json!({}); ROW_LIMIT + 1], query(), now()),
        Err(Fault::Unavailable)
    );
    assert!(h.page("a", items(), query(), now()).is_ok());
}
#[test]
fn cursor_capacity_is_bounded_and_recovered_after_deadline() {
    let mut h = History::default();
    for _ in 0..CURSOR_LIMIT {
        h.page("a", items(), query(), now()).unwrap();
    }
    assert_eq!(
        h.page("a", items(), query(), now()),
        Err(Fault::Unavailable)
    );
    assert!(
        h.page("a", items(), query(), now() + Duration::seconds(60))
            .is_ok()
    );
}
#[test]
fn query_fields_directions_ranges_and_unknowns_fail_closed() {
    for q in [
        HistoryQuery {
            page_size: Some(0),
            ..query()
        },
        HistoryQuery {
            page_size: Some(201),
            ..query()
        },
        HistoryQuery {
            sort: Some("secret:desc".into()),
            ..query()
        },
        HistoryQuery {
            sort: Some("status:sideways".into()),
            ..query()
        },
        HistoryQuery {
            filter: Some("status:ne:ready".into()),
            ..query()
        },
        HistoryQuery {
            filter: Some("secret:eq:x".into()),
            ..query()
        },
    ] {
        assert_eq!(
            History::default().page("a", items(), q, now()),
            Err(Fault::Invalid)
        );
    }
    assert!(serde_json::from_value::<HistoryQuery>(json!({"tenantId":"forged"})).is_err());
}
async fn request(p: &BffProvider, path: &str, cookie: &str) -> (StatusCode, Value) {
    let response = p
        .router()
        .oneshot(
            Request::builder()
                .uri(path)
                .header("cookie", format!("quantos_session={cookie}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["cache-control"], "no-store");
    let status = response.status();
    (
        status,
        serde_json::from_slice(&to_bytes(response.into_body(), 1_000_000).await.unwrap()).unwrap(),
    )
}
#[tokio::test]
async fn router_authentication_precedes_history_and_never_grants_browser_permission() {
    let p = BffProvider::default();
    for path in [
        "/v1/settings/downloads",
        "/v1/platform/browser-capabilities",
    ] {
        assert_eq!(
            request(&p, path, "missing").await.0,
            StatusCode::UNAUTHORIZED
        );
    }
    assert_eq!(
        request(&p, "/v1/settings/downloads", "session-viewer")
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(&p, "/v1/platform/browser-capabilities", "session-viewer")
            .await
            .1["permissionState"]["notifications"],
        "unknown"
    );
}
#[tokio::test]
async fn router_projects_actual_owner_exports_and_refuses_forged_scope() {
    let p = BffProvider::default();
    {
        let mut state = p.data.lock().await;
        state.exports.clear();
        state.exports.insert("one".into(), job(1));
    }
    let (status, page) = request(&p, "/v1/settings/downloads", "session-current").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert!(page["items"][0].get("downloadUrl").is_none());
    assert_eq!(
        request(
            &p,
            "/v1/settings/downloads?tenantId=forged",
            "session-current"
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let state = p.data.lock().await;
    assert_eq!(state.export_artifacts.len(), 0);
    assert_eq!(state.exports.len(), 1);
}
#[tokio::test]
async fn revoked_or_expired_session_cannot_read_even_saved_cursor() {
    let p = BffProvider::default();
    {
        let mut state = p.data.lock().await;
        state.exports = (1..=4).map(|id| (id.to_string(), job(id))).collect();
    }
    let page = request(&p, "/v1/settings/downloads?pageSize=1", "session-current")
        .await
        .1;
    let url = format!(
        "/v1/settings/downloads?pageSize=1&cursor={}",
        page["nextCursor"].as_str().unwrap()
    );
    {
        let mut state = p.data.lock().await;
        state.session_active = false;
    }
    assert_eq!(
        request(&p, &url, "session-current").await.0,
        StatusCode::UNAUTHORIZED
    );
    {
        let mut state = p.data.lock().await;
        state.session_active = true;
        state.session_expires_at = Utc::now() - Duration::seconds(1);
    }
    assert_eq!(
        request(&p, "/v1/platform/browser-capabilities", "session-current")
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
}

#[test]
fn short_link_never_outlives_session_retention_or_five_minutes() {
    for (retention, session, seconds) in [(3600, 3600, 300), (60, 3600, 60), (3600, 30, 30)] {
        assert_eq!(
            lease_expiry(
                now(),
                now() + Duration::seconds(retention),
                now() + Duration::seconds(session)
            ),
            Some(now() + Duration::seconds(seconds))
        );
    }
    assert_eq!(
        lease_expiry(now(), now(), now() + Duration::seconds(30)),
        None
    );
    assert_eq!(
        lease_expiry(now(), now() + Duration::seconds(30), now()),
        None
    );
}
#[test]
fn history_rechecks_retention_after_source_read_before_paging() {
    let page = History::default()
        .page("a", items(), query(), now() + Duration::hours(1))
        .unwrap();
    assert_eq!(page["items"][0]["status"], "expired");
    assert!(page["items"][0].get("downloadPath").is_none());
}
