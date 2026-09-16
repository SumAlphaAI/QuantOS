use std::{collections::BTreeMap, sync::Arc};

use axum::{
    Json, Router,
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

const CURRENT_SESSION: &str = "session-current";
const CSRF_TOKEN: &str = "csrf-token-0000000000000001";
const ALLOWED_ORIGIN: &str = "http://localhost:3190";

#[derive(Debug, Clone)]
struct ReauthGrant {
    expires_at: chrono::DateTime<Utc>,
}

#[derive(Debug)]
struct ProviderData {
    session_active: bool,
    failed_mfa_attempts: u8,
    challenges: BTreeMap<String, bool>,
    reauth_grants: BTreeMap<String, ReauthGrant>,
    profile_version: u64,
    notification_version: u64,
    sessions: BTreeMap<String, Value>,
    devices: BTreeMap<String, Value>,
    factors: BTreeMap<String, Value>,
    events: Vec<Value>,
    audits: Vec<Value>,
    idempotency: BTreeMap<String, Value>,
}

impl Default for ProviderData {
    fn default() -> Self {
        Self {
            session_active: true,
            failed_mfa_attempts: 0,
            challenges: BTreeMap::new(),
            reauth_grants: BTreeMap::new(),
            profile_version: 1,
            notification_version: 1,
            sessions: BTreeMap::from([
                (
                    CURRENT_SESSION.to_owned(),
                    json!({
                        "sessionId": CURRENT_SESSION, "client": "Chrome", "platform": "macOS",
                        "location": "Shanghai", "lastActiveAt": "2026-09-16T10:00:00Z",
                        "ipMasked": "203.0.113.xxx", "current": true
                    }),
                ),
                (
                    "session-remote".to_owned(),
                    json!({
                        "sessionId": "session-remote", "client": "Safari", "platform": "iOS",
                        "location": "Shanghai", "lastActiveAt": "2026-09-15T08:00:00Z",
                        "ipMasked": "198.51.100.xxx", "current": false
                    }),
                ),
            ]),
            devices: BTreeMap::from([(
                "device-remote".to_owned(),
                json!({"deviceId":"device-remote","label":"MacBook","verificationMethod":"passkey","trustedUntil":"2026-10-16T10:00:00Z","current":false}),
            )]),
            factors: BTreeMap::from([
                (
                    "factor-passkey".to_owned(),
                    factor("factor-passkey", "passkey"),
                ),
                (
                    "factor-totp".to_owned(),
                    factor("factor-totp", "authenticator"),
                ),
            ]),
            events: Vec::new(),
            audits: Vec::new(),
            idempotency: BTreeMap::new(),
        }
    }
}

fn factor(id: &str, method: &str) -> Value {
    json!({
        "factorId": id, "method": method, "label": method,
        "createdAt": "2026-08-01T00:00:00Z", "lastUsedAt": "2026-09-16T09:00:00Z",
        "currentDevice": method == "passkey"
    })
}

#[derive(Clone)]
pub struct BffProvider {
    data: Arc<Mutex<ProviderData>>,
}

impl Default for BffProvider {
    fn default() -> Self {
        Self {
            data: Arc::new(Mutex::new(ProviderData::default())),
        }
    }
}

impl BffProvider {
    pub fn router(&self) -> Router {
        Router::new()
            .route("/v1/session", get(get_session))
            .route("/v1/context", get(get_session))
            .route("/v1/auth/mfa/challenges", post(mfa_challenge))
            .route("/v1/auth/reauth", post(reauth))
            .route("/v1/auth/logout", post(logout))
            .route("/v1/access-requests", post(access_request))
            .route("/v1/settings/profile", get(get_profile).put(save_profile))
            .route(
                "/v1/settings/notification-preferences",
                get(get_notifications).put(save_notifications),
            )
            .route("/v1/settings/security", get(get_security))
            .route("/v1/settings/sessions", get(list_sessions))
            .route("/v1/settings/sessions/stream", get(session_stream))
            .route("/v1/settings/sessions/:session_id", delete(revoke_session))
            .route("/v1/settings/trusted-devices", get(list_devices))
            .route(
                "/v1/settings/trusted-devices/:device_id",
                delete(revoke_device),
            )
            .route("/v1/settings/mfa/setup", post(setup_mfa))
            .route("/v1/settings/mfa/factors/:factor_id", delete(revoke_factor))
            .route("/v1/settings/downloads", get(list_downloads))
            .route(
                "/v1/platform/browser-capabilities",
                get(browser_capabilities),
            )
            .with_state(self.data.clone())
    }

    pub async fn audit_count(&self) -> usize {
        self.data.lock().await.audits.len()
    }
}

fn correlation_id() -> String {
    Uuid::now_v7().to_string()
}

fn response(status: StatusCode, payload: Value, correlation: &str) -> Response {
    let mut response = (status, Json(payload)).into_response();
    response.headers_mut().insert(
        "x-correlation-id",
        HeaderValue::from_str(correlation).expect("generated UUID is a valid header"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

fn error(status: StatusCode, code: &str, message: &str) -> Response {
    let correlation = correlation_id();
    response(
        status,
        json!({"code":code,"message":message,"correlationId":correlation}),
        &correlation,
    )
}

fn cookies(headers: &HeaderMap) -> BTreeMap<&str, &str> {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .into_iter()
        .flat_map(|value| value.split(';'))
        .filter_map(|part| part.trim().split_once('='))
        .collect()
}

async fn authenticate(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
) -> Result<(), Response> {
    let session = cookies(headers).get("quantos_session").copied();
    if session != Some(CURRENT_SESSION) || !data.lock().await.session_active {
        return Err(error(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "会话已失效，请重新登录。",
        ));
    }
    Ok(())
}

async fn mutation_guard(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
) -> Result<(), Response> {
    authenticate(headers, data).await?;
    let cookie_csrf = cookies(headers).get("quantos_csrf").copied();
    let header_csrf = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok());
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok());
    if cookie_csrf != Some(CSRF_TOKEN)
        || header_csrf != Some(CSRF_TOKEN)
        || origin != Some(ALLOWED_ORIGIN)
    {
        return Err(error(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "资源不存在或无权访问。",
        ));
    }
    Ok(())
}

async fn require_reauth(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
) -> Result<(), Response> {
    let token = headers
        .get("x-reauth-token-ref")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| {
            error(
                StatusCode::FORBIDDEN,
                "RECENT_AUTH_REQUIRED",
                "需要近期身份验证。",
            )
        })?;
    let valid = data
        .lock()
        .await
        .reauth_grants
        .get(token)
        .is_some_and(|grant| grant.expires_at > Utc::now());
    if !valid {
        return Err(error(
            StatusCode::FORBIDDEN,
            "RECENT_AUTH_REQUIRED",
            "需要近期身份验证。",
        ));
    }
    Ok(())
}

fn idempotency_key(headers: &HeaderMap) -> Result<String, Box<Response>> {
    headers
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .ok_or_else(|| {
            Box::new(error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "IDEMPOTENCY_REQUIRED",
                "缺少幂等键。",
            ))
        })
}

fn accepted(data: &mut ProviderData, key: String, action: &str) -> Value {
    if let Some(existing) = data.idempotency.get(&key) {
        return existing.clone();
    }
    let audit_ref = Uuid::now_v7().to_string();
    let correlation = correlation_id();
    let payload = json!({
        "jobId": Uuid::now_v7(), "status":"accepted", "correlationId":correlation,
        "auditRef":audit_ref
    });
    data.audits
        .push(json!({"auditRef":audit_ref,"action":action,"correlationId":correlation}));
    data.idempotency.insert(key, payload.clone());
    payload
}

fn session_payload() -> Value {
    json!({
        "actorId":"11111111-1111-4111-8111-111111111111",
        "tenantId":"22222222-2222-4222-8222-222222222222",
        "workspaceId":"33333333-3333-4333-8333-333333333333",
        "accountId":"44444444-4444-4444-8444-444444444444",
        "mode":"paper","environment":"dev","capabilities":["settings.read","settings.write"],
        "mfaState":"verified","expiresAt":"2026-09-17T10:00:00Z"
    })
}

async fn get_session(State(data): State<Arc<Mutex<ProviderData>>>, headers: HeaderMap) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let correlation = correlation_id();
    response(StatusCode::OK, session_payload(), &correlation)
}

#[derive(Deserialize)]
struct MfaInput {
    code: Option<String>,
}

async fn mfa_challenge(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<MfaInput>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let mut state = data.lock().await;
    if input.code.as_deref() != Some("123456") {
        state.failed_mfa_attempts += 1;
        if state.failed_mfa_attempts >= 5 {
            let correlation = correlation_id();
            return response(
                StatusCode::TOO_MANY_REQUESTS,
                json!({
                    "code":"RATE_LIMITED","message":"验证请求过于频繁，请稍后重试。",
                    "correlationId":correlation,"retryAfter":60
                }),
                &correlation,
            );
        }
    }
    let challenge = Uuid::now_v7().to_string();
    let verified = input.code.as_deref() == Some("123456");
    state.challenges.insert(challenge.clone(), verified);
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        json!({"challengeRef":challenge,"status":if verified {"verified"} else {"failed"}}),
        &correlation,
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReauthInput {
    challenge_ref: String,
}

async fn reauth(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<ReauthInput>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let mut state = data.lock().await;
    if state.challenges.get(&input.challenge_ref) != Some(&true) {
        return error(
            StatusCode::FORBIDDEN,
            "MFA_NOT_VERIFIED",
            "资源不存在或无权访问。",
        );
    }
    let token = Uuid::now_v7().to_string();
    let expires_at = Utc::now() + Duration::minutes(5);
    state
        .reauth_grants
        .insert(token.clone(), ReauthGrant { expires_at });
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        json!({"reauthTokenRef":token,"expiresAt":expires_at.to_rfc3339()}),
        &correlation,
    )
}

async fn logout(State(data): State<Arc<Mutex<ProviderData>>>, headers: HeaderMap) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let mut state = data.lock().await;
    state.session_active = false;
    push_event(&mut state, "permission_revoked", CURRENT_SESSION);
    let correlation = correlation_id();
    let mut result = response(StatusCode::NO_CONTENT, Value::Null, &correlation);
    result.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static(
            "quantos_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict",
        ),
    );
    result
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccessRequestInput {
    team_name: String,
    contact_email: String,
    purpose: String,
    markets: Vec<String>,
    expected_mode: String,
    privacy_notice_version: String,
}

async fn access_request(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<AccessRequestInput>,
) -> Response {
    if headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        != Some(ALLOWED_ORIGIN)
    {
        return error(StatusCode::FORBIDDEN, "FORBIDDEN", "请求来源不受信任。");
    }
    if input.team_name.trim().is_empty()
        || !input.contact_email.contains('@')
        || input.purpose.trim().is_empty()
        || input.markets.is_empty()
        || !matches!(
            input.expected_mode.as_str(),
            "paper" | "shadow" | "assisted_live"
        )
        || input.privacy_notice_version.trim().is_empty()
    {
        return error(
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_FAILED",
            "请检查输入后重试。",
        );
    }
    let correlation = correlation_id();
    let audit_ref = Uuid::now_v7().to_string();
    data.lock().await.audits.push(json!({
        "auditRef": audit_ref,
        "action": "access.request",
        "correlationId": correlation
    }));
    response(
        StatusCode::ACCEPTED,
        json!({"jobId":Uuid::now_v7(),"status":"accepted","correlationId":correlation,"auditRef":audit_ref}),
        &correlation,
    )
}

fn profile(version: u64) -> Value {
    json!({
        "displayName":"Quant Researcher","locale":"zh-CN","timezone":"Asia/Shanghai","theme":"system",
        "numberFormat":"comma_dot","timeDisplay":"utc_local","defaultRoute":"/command","density":"comfortable",
        "highContrast":false,"reducedMotion":false,"memberId":"member-1","email":"user@example.com",
        "emailVerified":true,"roleLabels":["operator"],"objectVersion":format!("profile-v{version}")
    })
}

async fn get_profile(State(data): State<Arc<Mutex<ProviderData>>>, headers: HeaderMap) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let version = data.lock().await.profile_version;
    let correlation = correlation_id();
    response(StatusCode::OK, profile(version), &correlation)
}

async fn save_profile(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(_input): Json<Value>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    if let Some(existing) = state.idempotency.get(&key) {
        let correlation = correlation_id();
        return response(StatusCode::OK, existing.clone(), &correlation);
    }
    let expected = format!("profile-v{}", state.profile_version);
    if headers
        .get(header::IF_MATCH)
        .and_then(|value| value.to_str().ok())
        != Some(expected.as_str())
    {
        let correlation = correlation_id();
        return response(
            StatusCode::CONFLICT,
            json!({"code":"VERSION_CONFLICT","message":"对象版本已变化。","correlationId":correlation,"currentVersion":expected}),
            &correlation,
        );
    }
    state.profile_version += 1;
    let payload = profile(state.profile_version);
    state.idempotency.insert(key, payload.clone());
    let correlation = correlation_id();
    state.audits.push(
        json!({"auditRef":Uuid::now_v7(),"action":"profile.save","correlationId":correlation}),
    );
    response(StatusCode::OK, payload, &correlation)
}

fn notifications(version: u64) -> Value {
    json!({"rules":[],"quietHoursEnabled":false,"quietHoursStart":"22:00","quietHoursEnd":"07:00","criticalBypass":true,"digestFrequency":"daily","objectVersion":format!("notifications-v{version}"),"browserPermission":"default"})
}

async fn get_notifications(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let version = data.lock().await.notification_version;
    let correlation = correlation_id();
    response(StatusCode::OK, notifications(version), &correlation)
}

async fn save_notifications(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(_input): Json<Value>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    if let Some(existing) = state.idempotency.get(&key) {
        let correlation = correlation_id();
        return response(StatusCode::OK, existing.clone(), &correlation);
    }
    let expected = format!("notifications-v{}", state.notification_version);
    if headers
        .get(header::IF_MATCH)
        .and_then(|value| value.to_str().ok())
        != Some(expected.as_str())
    {
        let correlation = correlation_id();
        return response(
            StatusCode::CONFLICT,
            json!({"code":"VERSION_CONFLICT","message":"对象版本已变化。","correlationId":correlation,"currentVersion":expected}),
            &correlation,
        );
    }
    state.notification_version += 1;
    let payload = notifications(state.notification_version);
    state.idempotency.insert(key, payload.clone());
    let correlation = correlation_id();
    state.audits.push(json!({"auditRef":Uuid::now_v7(),"action":"notification_preferences.save","correlationId":correlation}));
    response(StatusCode::OK, payload, &correlation)
}

async fn get_security(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let state = data.lock().await;
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        json!({"posture":"strong","score":92,"mfaEnabled":!state.factors.is_empty(),"factors":state.factors.values().cloned().collect::<Vec<_>>(),"recoveryCodesRemaining":8,"lastVerifiedAt":"2026-09-16T09:00:00Z","correlationId":correlation}),
        &correlation,
    )
}

async fn list_sessions(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let payload = Value::Array(data.lock().await.sessions.values().cloned().collect());
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

async fn revoke_session(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(session_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    if session_id == CURRENT_SESSION {
        return error(
            StatusCode::CONFLICT,
            "CURRENT_SESSION_PROTECTED",
            "当前会话不能从此操作撤销。",
        );
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    if let Some(existing) = state.idempotency.get(&key).cloned() {
        let correlation = correlation_id();
        return response(StatusCode::ACCEPTED, existing, &correlation);
    }
    if state.sessions.remove(&session_id).is_none() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    push_event(&mut state, "permission_revoked", &session_id);
    let payload = accepted(&mut state, key, "session.revoke");
    let correlation = payload["correlationId"]
        .as_str()
        .expect("accepted correlation");
    response(StatusCode::ACCEPTED, payload.clone(), correlation)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StreamQuery {
    after_sequence: Option<u64>,
}

async fn session_stream(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Query(query): Query<StreamQuery>,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let after = query.after_sequence.unwrap_or(0);
    let body = data
        .lock()
        .await
        .events
        .iter()
        .filter(|event| event["sequence"].as_u64().unwrap_or(0) > after)
        .map(|event| format!("data: {event}\n\n"))
        .collect::<String>();
    let mut response = Response::new(Body::from(body));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

async fn list_devices(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let payload = Value::Array(data.lock().await.devices.values().cloned().collect());
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

async fn revoke_device(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(device_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    if state.devices.remove(&device_id).is_none() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    let payload = accepted(&mut state, key, "device.revoke");
    let correlation = payload["correlationId"]
        .as_str()
        .expect("accepted correlation");
    response(StatusCode::ACCEPTED, payload.clone(), correlation)
}

async fn setup_mfa(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    let id = format!("factor-{}", state.factors.len() + 1);
    state.factors.insert(
        id.clone(),
        factor(&id, input["method"].as_str().unwrap_or("authenticator")),
    );
    let payload = accepted(&mut state, key, "mfa.setup");
    let correlation = payload["correlationId"]
        .as_str()
        .expect("accepted correlation");
    response(StatusCode::ACCEPTED, payload.clone(), correlation)
}

async fn revoke_factor(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(factor_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    let key = match idempotency_key(&headers) {
        Ok(key) => key,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    if !state.factors.contains_key(&factor_id) {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    if state.factors.len() <= 1 {
        return error(
            StatusCode::CONFLICT,
            "LAST_FACTOR_PROTECTED",
            "不能撤销最后一个有效 MFA 因素。",
        );
    }
    state.factors.remove(&factor_id);
    let payload = accepted(&mut state, key, "mfa.factor.revoke");
    let correlation = payload["correlationId"]
        .as_str()
        .expect("accepted correlation");
    response(StatusCode::ACCEPTED, payload.clone(), correlation)
}

async fn list_downloads(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let correlation = correlation_id();
    response(StatusCode::OK, json!({"items":[]}), &correlation)
}

async fn browser_capabilities(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        json!({"kind":"web","authFlow":"browser_redirect","notifications":"browser","localFileImport":false,"deepLinkScheme":"https://app.sumalpha.test","downloadsViaBff":true,"offlineDomainActions":false,"businessPagesNoIndex":true,"cspEnforced":true,"sessionProtected":true}),
        &correlation,
    )
}

fn push_event(data: &mut ProviderData, kind: &str, object_id: &str) {
    let sequence = data.events.len() + 1;
    data.events.push(json!({
        "streamId":"55555555-5555-4555-8555-555555555555","sequence":sequence,
        "eventId":Uuid::now_v7(),"occurredAt":Utc::now().to_rfc3339(),"correlationId":Uuid::now_v7(),
        "payloadVersion":"1","payload":{"type":kind,"objectId":object_id}
    }));
}
