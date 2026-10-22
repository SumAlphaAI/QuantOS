//! In-memory reference delivery: same consumer contract as live, no DB/Storage.
use crate::{
    CURRENT_SESSION, ProviderData, audit_core, cookies,
    download_contract::{DownloadOrigin, content_response},
    error, expire_reference_export, platform, record_audit_action, response,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode, Uri},
    response::Response,
};
use chrono::{DateTime, Utc};
use serde_json::json;
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone)]
struct Ticket {
    export_id: String,
    session: String,
    until: DateTime<Utc>,
    sha256: String,
    size: usize,
    consumed: bool,
}
#[derive(Debug)]
pub(crate) struct Downloads {
    pub(crate) origin: DownloadOrigin,
    key: [u8; 32],
    tickets: BTreeMap<Uuid, Ticket>,
    #[cfg(test)]
    fail_next_read: bool,
}
impl Default for Downloads {
    fn default() -> Self {
        let mut key = [0; 32];
        key[..16].copy_from_slice(Uuid::new_v4().as_bytes());
        key[16..].copy_from_slice(Uuid::new_v4().as_bytes());
        Self {
            origin: DownloadOrigin::parse("https://bff.reference.invalid").unwrap(),
            key,
            tickets: BTreeMap::new(),
            #[cfg(test)]
            fail_next_read: false,
        }
    }
}
impl Downloads {
    fn sign(&self, ticket: Uuid) -> Result<String, openssl::error::ErrorStack> {
        use openssl::{hash::MessageDigest, pkey::PKey, sign::Signer};
        let key = PKey::hmac(&self.key)?;
        let mut signer = Signer::new(MessageDigest::sha256(), &key)?;
        signer.update(format!("quantos-export-ticket-v1:{ticket}").as_bytes())?;
        Ok(signer
            .sign_to_vec()?
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect())
    }
}
// Check under the same lock as issue/consume; a concurrent logout may not win
// between an auth guard and content delivery. The reference has one export owner.
fn authorized(state: &ProviderData, headers: &HeaderMap) -> Result<(), Box<Response>> {
    let session = cookies(headers).get("quantos_session").copied();
    if state.now() >= state.session_expires_at
        || session.is_none()
        || (session == Some(CURRENT_SESSION)
            && (!state.session_active || !state.sessions.contains_key(CURRENT_SESSION)))
    {
        return Err(Box::new(error(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "会话已失效。",
        )));
    }
    if session != Some(CURRENT_SESSION) {
        let authenticated = matches!(
            session,
            Some("session-viewer" | "session-approver" | "session-owner")
        ) || session.is_some_and(|s| state.sessions.contains_key(s));
        return Err(Box::new(error(
            if authenticated {
                StatusCode::FORBIDDEN
            } else {
                StatusCode::UNAUTHORIZED
            },
            if authenticated {
                "FORBIDDEN"
            } else {
                "UNAUTHENTICATED"
            },
            "资源不可访问。",
        )));
    }
    if let Some(ops) = &state.operations {
        if ops.poisoned {
            return Err(Box::new(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "DEPENDENCY_UNAVAILABLE",
                "服务暂不可用。",
            )));
        }
        if !ops.context_current(CURRENT_SESSION, state.reference_shadow) {
            return Err(Box::new(error(
                StatusCode::UNAUTHORIZED,
                "IDENTITY_CHANGED",
                "Identity changed; reauthenticate.",
            )));
        }
    }
    Ok(())
}
fn denied(state: &mut ProviderData, correlation: &str, object: &str) -> Response {
    record_audit_action(
        state,
        "export.consume_denied",
        correlation,
        object,
        json!({"outcome":"denied"}),
    );
    error(
        StatusCode::GONE,
        "EXPORT_EXPIRED",
        "下载凭据已失效，请重新申请。",
    )
}

pub(crate) async fn issue(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(export_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    let mut state = data.lock().await;
    if let Err(r) = authorized(&state, &headers) {
        record_audit_action(
            &mut state,
            "export.access_denied",
            crate::AUDIT_CORRELATION,
            "exports",
            json!({"outcome":"denied"}),
        );
        return *r;
    }
    let Some(job) = expire_reference_export(&mut state, &export_id) else {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不可访问。");
    };
    if job["status"] == "expired" {
        return error(StatusCode::GONE, "EXPORT_EXPIRED", "导出已过期。");
    }
    if job["status"] != "ready" {
        return error(StatusCode::CONFLICT, "EXPORT_NOT_READY", "导出尚未就绪。");
    }
    let retention = DateTime::parse_from_rfc3339(job["retentionUntil"].as_str().unwrap())
        .unwrap()
        .with_timezone(&Utc);
    let Some(until) = platform::lease_expiry(state.now(), retention, state.session_expires_at)
    else {
        return error(StatusCode::UNAUTHORIZED, "UNAUTHENTICATED", "会话已过期。");
    };
    let now = state.now();
    state.downloads.tickets.retain(|_, t| t.until > now);
    if state.downloads.tickets.len() >= 512 {
        return error(
            StatusCode::TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "下载申请过于频繁。",
        );
    }
    let Some((bytes, media)) = state.export_artifacts.get(&export_id) else {
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "导出内容暂不可用。",
        );
    };
    let (size, sha256, media) = (bytes.len(), audit_core::digest(bytes), media.clone());
    let ticket = Uuid::new_v4();
    let Ok(signature) = state.downloads.sign(ticket) else {
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "下载暂不可用。",
        );
    };
    let url = state.downloads.origin.url(ticket, &signature);
    state.downloads.tickets.insert(
        ticket,
        Ticket {
            export_id: export_id.clone(),
            session: CURRENT_SESSION.to_owned(),
            until,
            sha256: sha256.clone(),
            size,
            consumed: false,
        },
    );
    let correlation = job["correlationId"].as_str().unwrap();
    let audit = record_audit_action(
        &mut state,
        "export.download_issued",
        correlation,
        &export_id,
        json!({"expiresAt":until.to_rfc3339(),"watermarked":true,"retentionUntil":job["retentionUntil"]}),
    );
    response(
        StatusCode::OK,
        json!({"exportId":export_id,"downloadUrl":url,"expiresAt":until.to_rfc3339(),"sha256":sha256,"sizeBytes":size,"mediaType":media,"watermarked":true,"retentionUntil":job["retentionUntil"],"auditRef":audit}),
        correlation,
    )
}

pub(crate) async fn content(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path((id, signature)): Path<(String, String)>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
) -> Response {
    if method != Method::GET {
        return error(
            StatusCode::METHOD_NOT_ALLOWED,
            "METHOD_NOT_ALLOWED",
            "内容仅允许GET。",
        );
    }
    if uri.query().is_some() {
        return error(
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_FAILED",
            "内容URL不允许查询参数。",
        );
    }
    let mut state = data.lock().await;
    if let Err(r) = authorized(&state, &headers) {
        record_audit_action(
            &mut state,
            "export.access_denied",
            crate::AUDIT_CORRELATION,
            "exports",
            json!({"outcome":"denied"}),
        );
        return *r;
    }
    let Ok(id) = Uuid::parse_str(&id) else {
        return denied(&mut state, crate::AUDIT_CORRELATION, "exports");
    };
    let Ok(expected) = state.downloads.sign(id) else {
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "下载暂不可用。",
        );
    };
    if signature.len() != expected.len()
        || !openssl::memcmp::eq(signature.as_bytes(), expected.as_bytes())
    {
        return denied(&mut state, crate::AUDIT_CORRELATION, "exports");
    }
    let Some(t) = state.downloads.tickets.get(&id).cloned() else {
        return denied(&mut state, crate::AUDIT_CORRELATION, "exports");
    };
    let Some(job) = expire_reference_export(&mut state, &t.export_id) else {
        return denied(&mut state, crate::AUDIT_CORRELATION, "exports");
    };
    let correlation = job["correlationId"].as_str().unwrap();
    if t.consumed
        || t.until <= state.now()
        || t.session != CURRENT_SESSION
        || job["status"] != "ready"
    {
        return denied(&mut state, correlation, &t.export_id);
    }
    // Consume before the storage read, exactly as live. A failed read requires a
    // fresh explicit lease; retrying this URL never returns content.
    state.downloads.tickets.get_mut(&id).unwrap().consumed = true;
    #[cfg(test)]
    if std::mem::take(&mut state.downloads.fail_next_read) {
        record_audit_action(
            &mut state,
            "export.download_failed",
            correlation,
            &t.export_id,
            json!({"outcome":"failed"}),
        );
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "读取失败，请重新申请下载。",
        );
    }
    let Some((bytes, media)) = state.export_artifacts.get(&t.export_id).cloned() else {
        record_audit_action(
            &mut state,
            "export.download_failed",
            correlation,
            &t.export_id,
            json!({"outcome":"failed"}),
        );
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "导出内容暂不可用。",
        );
    };
    if bytes.len() != t.size || audit_core::digest(&bytes) != t.sha256 {
        record_audit_action(
            &mut state,
            "export.integrity_failed",
            correlation,
            &t.export_id,
            json!({"outcome":"failed"}),
        );
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "DEPENDENCY_UNAVAILABLE",
            "内容完整性校验失败。",
        );
    }
    record_audit_action(
        &mut state,
        "export.download_consumed",
        correlation,
        &t.export_id,
        json!({"outcome":"succeeded"}),
    );
    let mut r = content_response(bytes, media);
    r.headers_mut()
        .insert("x-correlation-id", correlation.parse().unwrap());
    r
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ALLOWED_ORIGIN, AUDIT_CORRELATION, BffProvider, CSRF_TOKEN};
    use axum::{
        Router,
        body::{Body, to_bytes},
        http::Request,
    };
    use chrono::Duration;
    use serde_json::Value;
    use tower::ServiceExt;

    fn request(method: &str, path: &str, session: &str, body: Option<Value>) -> Request<Body> {
        let mut builder = Request::builder()
            .method(method)
            .uri(path)
            .header(
                "cookie",
                format!("quantos_session={session}; quantos_csrf={CSRF_TOKEN}"),
            )
            .header("origin", ALLOWED_ORIGIN)
            .header("x-csrf-token", CSRF_TOKEN)
            .header("x-request-id", Uuid::new_v4().to_string())
            .header("content-type", "application/json");
        if method == "POST" {
            builder = builder.header("idempotency-key", Uuid::new_v4().to_string());
        }
        builder
            .body(Body::from(body.map(|b| b.to_string()).unwrap_or_default()))
            .unwrap()
    }
    async fn json(r: Response) -> Value {
        serde_json::from_slice(&to_bytes(r.into_body(), 20_000_000).await.unwrap()).unwrap()
    }
    async fn setup(format: &str) -> (BffProvider, Router, String, String) {
        let p = BffProvider::default()
            .with_download_origin("https://bff.test:8443")
            .unwrap();
        let router = p.router();
        let challenge = json(
            router
                .clone()
                .oneshot(request(
                    "POST",
                    "/v1/auth/mfa/challenges",
                    CURRENT_SESSION,
                    Some(json!({"purpose":"security_change","code":"123456"})),
                ))
                .await
                .unwrap(),
        )
        .await;
        let grant = json(
            router
                .clone()
                .oneshot(request(
                    "POST",
                    "/v1/auth/reauth",
                    CURRENT_SESSION,
                    Some(json!({"challengeRef":challenge["challengeRef"]})),
                ))
                .await
                .unwrap(),
        )
        .await;
        let grant = grant["reauthTokenRef"].as_str().unwrap().to_owned();
        let mut req = request(
            "POST",
            "/v1/exports",
            CURRENT_SESSION,
            Some(
                json!({"scope":{"correlationIds":[AUDIT_CORRELATION]},"format":format,"reason":"Reference download verification","watermark":"QuantOS controlled audit copy","retentionDays":7}),
            ),
        );
        req.headers_mut()
            .insert("x-reauth-token-ref", grant.parse().unwrap());
        let r = router.clone().oneshot(req).await.unwrap();
        assert_eq!(r.status(), StatusCode::ACCEPTED);
        let id = json(r).await["exportId"].as_str().unwrap().to_owned();
        (p, router, id, grant)
    }
    async fn lease(router: &Router, id: &str) -> Value {
        let r = router
            .clone()
            .oneshot(request(
                "GET",
                &format!("/v1/exports/{id}/download"),
                CURRENT_SESSION,
                None,
            ))
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::OK);
        json(r).await
    }
    fn path(lease: &Value) -> String {
        url::Url::parse(lease["downloadUrl"].as_str().unwrap())
            .unwrap()
            .path()
            .to_owned()
    }
    async fn consume(router: &Router, path: &str, session: &str) -> Response {
        router
            .clone()
            .oneshot(request("GET", path, session, None))
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn formats_deliver_original_hashed_bytes_headers_and_audit_without_url_leakage() {
        for format in ["csv", "jsonl", "pdf"] {
            let (p, r, id, _) = setup(format).await;
            let l = lease(&r, &id).await;
            assert!(
                l["downloadUrl"]
                    .as_str()
                    .unwrap()
                    .starts_with("https://bff.test:8443/_bff/export-content/")
            );
            assert!(!path(&l).contains(&id));
            let content = consume(&r, &path(&l), CURRENT_SESSION).await;
            assert_eq!(content.status(), StatusCode::OK);
            for (key, expected) in [
                ("cache-control", "no-store"),
                ("x-content-type-options", "nosniff"),
                ("referrer-policy", "no-referrer"),
                (
                    "content-disposition",
                    "attachment; filename=quantos-audit-export",
                ),
            ] {
                assert_eq!(content.headers()[key], expected);
            }
            assert_eq!(
                content.headers()["content-type"],
                l["mediaType"].as_str().unwrap()
            );
            let bytes = to_bytes(content.into_body(), 20_000_000).await.unwrap();
            assert_eq!(audit_core::digest(&bytes), l["sha256"]);
            assert_eq!(bytes.len() as u64, l["sizeBytes"].as_u64().unwrap());
            assert!(
                String::from_utf8_lossy(&bytes)
                    .contains(&audit_core::watermark("QuantOS controlled audit copy"))
            );
            assert_eq!(p.audit_action_count("export.download_consumed").await, 1);
            let state = p.data.lock().await;
            let audit = serde_json::to_string(&state.audits).unwrap();
            assert!(!audit.contains(l["downloadUrl"].as_str().unwrap()));
            assert!(!audit.contains(path(&l).rsplit('/').next().unwrap()));
            drop(state);
            let history = json(
                r.clone()
                    .oneshot(request(
                        "GET",
                        "/v1/settings/downloads",
                        CURRENT_SESSION,
                        None,
                    ))
                    .await
                    .unwrap(),
            )
            .await;
            assert!(!history.to_string().contains("downloadUrl"));
        }
    }
    #[tokio::test]
    async fn concurrent_consumption_has_exactly_one_winner_and_fresh_lease_recovers() {
        let (p, r, id, _) = setup("jsonl").await;
        let l = lease(&r, &id).await;
        let path = path(&l);
        let (a, b) = tokio::join!(
            consume(&r, &path, CURRENT_SESSION),
            consume(&r, &path, CURRENT_SESSION)
        );
        let statuses = [a.status(), b.status()];
        assert!(statuses.contains(&StatusCode::OK));
        assert!(statuses.contains(&StatusCode::GONE));
        assert_eq!(p.audit_action_count("export.download_consumed").await, 1);
        let fresh = lease(&r, &id).await;
        assert_ne!(l["downloadUrl"], fresh["downloadUrl"]);
        assert_eq!(
            consume(&r, &self::path(&fresh), CURRENT_SESSION)
                .await
                .status(),
            StatusCode::OK
        );
    }
    #[tokio::test]
    async fn capability_session_signature_and_ticket_scope_cannot_be_substituted() {
        let (p, r, id, _) = setup("csv").await;
        let l = lease(&r, &id).await;
        let path = path(&l);
        for (session, status) in [
            ("session-viewer", StatusCode::FORBIDDEN),
            ("session-owner", StatusCode::FORBIDDEN),
            ("invalid-session", StatusCode::UNAUTHORIZED),
        ] {
            assert_eq!(consume(&r, &path, session).await.status(), status);
        }
        let mut bad = path.clone();
        let last = bad.pop().unwrap();
        bad.push(if last == 'a' { 'b' } else { 'a' });
        assert_eq!(
            consume(&r, &bad, CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        let second = lease(&r, &id).await;
        let other = self::path(&second);
        let mixed = format!(
            "{}/{}",
            other.rsplit_once('/').unwrap().0,
            path.rsplit('/').next().unwrap()
        );
        assert_eq!(
            consume(&r, &mixed, CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        // Even a correctly signed ticket may not target a resource outside its owner.
        {
            let mut s = p.data.lock().await;
            let t = s.downloads.tickets.values_mut().next().unwrap();
            t.session = "session-viewer".to_owned();
        }
        let statuses = [
            consume(&r, &path, CURRENT_SESSION).await.status(),
            consume(&r, &other, CURRENT_SESSION).await.status(),
        ];
        assert!(statuses.contains(&StatusCode::GONE));
        assert_eq!(p.audit_action_count("export.access_denied").await, 3);
    }
    #[tokio::test]
    async fn head_query_and_unknown_resource_do_not_consume_a_valid_ticket() {
        let (_, r, id, _) = setup("csv").await;
        let l = lease(&r, &id).await;
        let path = path(&l);
        assert_eq!(
            r.clone()
                .oneshot(request("HEAD", &path, CURRENT_SESSION, None))
                .await
                .unwrap()
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        assert_eq!(
            consume(&r, &format!("{path}?x=1"), CURRENT_SESSION)
                .await
                .status(),
            StatusCode::UNPROCESSABLE_ENTITY
        );
        let unknown = format!("/v1/exports/{}/download", Uuid::new_v4());
        assert_eq!(
            consume(&r, &unknown, CURRENT_SESSION).await.status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            consume(&r, &path, CURRENT_SESSION).await.status(),
            StatusCode::OK
        );
    }
    #[tokio::test]
    async fn lease_deadline_is_minimum_of_retention_session_and_five_minutes() {
        let (p, r, id, _) = setup("jsonl").await;
        for (retention, session, bound) in [(900, 900, 300), (80, 900, 80), (900, 50, 50)] {
            let before = {
                let mut s = p.data.lock().await;
                let now = s.now();
                s.session_expires_at = now + Duration::seconds(session);
                s.exports.get_mut(&id).unwrap()["retentionUntil"] =
                    json!((now + Duration::seconds(retention)).to_rfc3339());
                now
            };
            let l = lease(&r, &id).await;
            let expiry = DateTime::parse_from_rfc3339(l["expiresAt"].as_str().unwrap())
                .unwrap()
                .with_timezone(&Utc);
            assert!(expiry >= before + Duration::seconds(bound));
            assert!(expiry <= before + Duration::seconds(bound) + Duration::seconds(1));
        }
    }
    #[tokio::test]
    async fn expired_ticket_refuses_then_new_lease_delivers_and_retention_is_authoritative() {
        let (p, r, id, _) = setup("jsonl").await;
        p.data.lock().await.session_expires_at = Utc::now() + Duration::minutes(20);
        let l = lease(&r, &id).await;
        p.advance_reference_time(Duration::seconds(301)).await;
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        let fresh = lease(&r, &id).await;
        assert_eq!(
            consume(&r, &path(&fresh), CURRENT_SESSION).await.status(),
            StatusCode::OK
        );
        let l = lease(&r, &id).await;
        {
            let mut s = p.data.lock().await;
            let now = s.now();
            s.exports.get_mut(&id).unwrap()["retentionUntil"] =
                json!((now - Duration::seconds(1)).to_rfc3339());
        }
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
    }
    #[tokio::test]
    async fn cancellation_and_logout_invalidate_outstanding_content_tickets() {
        let (p, r, id, grant) = setup("csv").await;
        let l = lease(&r, &id).await;
        let mut req = request(
            "POST",
            &format!("/v1/exports/{id}/cancel"),
            CURRENT_SESSION,
            None,
        );
        req.headers_mut()
            .insert("x-reauth-token-ref", grant.parse().unwrap());
        assert_eq!(
            r.clone().oneshot(req).await.unwrap().status(),
            StatusCode::ACCEPTED
        );
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        assert_eq!(p.audit_action_count("export.cancelled").await, 1);
        let (_, r, id, _) = setup("csv").await;
        let l = lease(&r, &id).await;
        assert_eq!(
            r.clone()
                .oneshot(request("POST", "/v1/auth/logout", CURRENT_SESSION, None))
                .await
                .unwrap()
                .status(),
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    #[tokio::test]
    async fn storage_failure_consumes_ticket_and_explicit_new_lease_recovers() {
        let (p, r, id, _) = setup("jsonl").await;
        let l = lease(&r, &id).await;
        p.data.lock().await.downloads.fail_next_read = true;
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        let fresh = lease(&r, &id).await;
        assert_eq!(
            consume(&r, &path(&fresh), CURRENT_SESSION).await.status(),
            StatusCode::OK
        );
        assert_eq!(p.audit_action_count("export.download_failed").await, 1);
    }
    #[tokio::test]
    async fn corruption_and_missing_artifact_fail_closed_without_panicking_or_replaying() {
        let (p, r, id, _) = setup("jsonl").await;
        let l = lease(&r, &id).await;
        let original = {
            let mut s = p.data.lock().await;
            let artifact = s.export_artifacts.get_mut(&id).unwrap();
            let original = artifact.clone();
            artifact.0.push(0);
            original
        };
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            consume(&r, &path(&l), CURRENT_SESSION).await.status(),
            StatusCode::GONE
        );
        assert_eq!(p.audit_action_count("export.integrity_failed").await, 1);
        p.data
            .lock()
            .await
            .export_artifacts
            .insert(id.clone(), original.clone());
        let fresh = lease(&r, &id).await;
        p.data.lock().await.export_artifacts.remove(&id);
        assert_eq!(
            consume(&r, &path(&fresh), CURRENT_SESSION).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            consume(&r, &format!("/v1/exports/{id}/download"), CURRENT_SESSION)
                .await
                .status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        p.data
            .lock()
            .await
            .export_artifacts
            .insert(id.clone(), original);
        let fresh = lease(&r, &id).await;
        assert_eq!(
            consume(&r, &path(&fresh), CURRENT_SESSION).await.status(),
            StatusCode::OK
        );
    }
    #[tokio::test]
    async fn ticket_memory_is_bounded_and_expired_entries_can_be_reclaimed() {
        let (p, r, id, _) = setup("csv").await;
        p.data.lock().await.session_expires_at = Utc::now() + Duration::minutes(20);
        let l = lease(&r, &id).await;
        {
            let mut s = p.data.lock().await;
            let t = s.downloads.tickets.values().next().unwrap().clone();
            for _ in 1..512 {
                s.downloads.tickets.insert(Uuid::new_v4(), t.clone());
            }
        }
        assert_eq!(
            consume(&r, &format!("/v1/exports/{id}/download"), CURRENT_SESSION)
                .await
                .status(),
            StatusCode::TOO_MANY_REQUESTS
        );
        p.advance_reference_time(Duration::seconds(301)).await;
        let fresh = lease(&r, &id).await;
        assert_ne!(l["downloadUrl"], fresh["downloadUrl"]);
        assert_eq!(p.data.lock().await.downloads.tickets.len(), 1);
    }
}
