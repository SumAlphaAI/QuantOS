mod audit_core;
use std::{collections::BTreeMap, sync::Arc};

mod input_contract;
pub mod live;

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
const VIEWER_SESSION: &str = "session-viewer";
const CSRF_TOKEN: &str = "csrf-token-0000000000000001";
const ALLOWED_ORIGIN: &str = "http://localhost:3190";
const AUDIT_CORRELATION: &str = "aaaaaaaa-1111-4111-8111-111111111111";
const EXPIRED_EXPORT: &str = "eeeeeeee-1111-4111-8111-111111111111";

#[derive(Debug, Clone)]
struct ReauthGrant {
    expires_at: chrono::DateTime<Utc>,
    session: String,
}

#[derive(Debug, Clone)]
struct MfaChallenge {
    session: String,
    purpose: String,
    verified_at: Option<chrono::DateTime<Utc>>,
    expires_at: chrono::DateTime<Utc>,
    consumed: bool,
}

#[derive(Debug, Clone)]
struct MfaWindow {
    started_at: chrono::DateTime<Utc>,
    failures: u8,
}

#[derive(Debug)]
struct ProviderData {
    session_active: bool,
    clock_offset: Duration,
    session_expires_at: chrono::DateTime<Utc>,
    mfa_windows: BTreeMap<String, MfaWindow>,
    challenges: BTreeMap<String, MfaChallenge>,
    reauth_grants: BTreeMap<String, ReauthGrant>,
    profile_version: u64,
    notification_version: u64,
    profile: Value,
    notifications: Value,
    sessions: BTreeMap<String, Value>,
    devices: BTreeMap<String, Value>,
    factors: BTreeMap<String, Value>,
    events: Vec<Value>,
    audits: Vec<Value>,
    exports: BTreeMap<String, Value>,
    export_artifacts: BTreeMap<String, (Vec<u8>, String)>,
    audit_cursors: BTreeMap<String, (String, Vec<Value>, usize, chrono::DateTime<Utc>)>,
    idempotency: BTreeMap<String, Value>,
    idempotency_intents: BTreeMap<String, Value>,
}

impl Default for ProviderData {
    fn default() -> Self {
        Self {
            session_active: true,
            clock_offset: Duration::zero(),
            session_expires_at: Utc::now() + Duration::minutes(5),
            mfa_windows: BTreeMap::new(),
            challenges: BTreeMap::new(),
            reauth_grants: BTreeMap::new(),
            profile_version: 1,
            notification_version: 1,
            profile: profile(1),
            notifications: notifications(1),
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
            audits: seed_audits(),
            exports: BTreeMap::from([(
                EXPIRED_EXPORT.to_owned(),
                json!({
                    "exportId":EXPIRED_EXPORT,"status":"expired","format":"jsonl",
                    "requestedBy":"audit-user","requestedAt":"2026-08-01T00:00:00Z",
                    "completedAt":"2026-08-01T00:01:00Z","watermark":"QuantOS audit copy",
                    "retentionUntil":"2026-08-02T00:00:00Z","correlationId":AUDIT_CORRELATION,
                    "auditRef":"eeeeeeee-2222-4222-8222-222222222222"
                }),
            )]),
            export_artifacts: BTreeMap::new(),
            audit_cursors: BTreeMap::new(),
            idempotency: BTreeMap::new(),
            idempotency_intents: BTreeMap::new(),
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
    /// Deterministic time advancement for loopback reference-provider regressions.
    pub async fn advance_reference_time(&self, elapsed: Duration) {
        self.data.lock().await.clock_offset += elapsed;
    }

    /// Renew only the deterministic fixture session, leaving challenges and grants unchanged.
    pub async fn renew_reference_session(&self) {
        let mut state = self.data.lock().await;
        state.session_expires_at = state.now() + Duration::minutes(5);
    }

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
            .route("/v1/audit/events", get(search_audit_events))
            .route(
                "/v1/audit/evidence-chains/:correlation_id",
                get(get_evidence_chain),
            )
            .route("/v1/exports", post(create_export))
            .route("/v1/exports/:export_id", get(get_export_status))
            .route("/v1/exports/:export_id/cancel", post(cancel_export))
            .route("/v1/exports/:export_id/download", get(get_export_download))
            .with_state(self.data.clone())
            .layer(axum::middleware::from_fn_with_state(
                self.data.clone(),
                input_contract::guard,
            ))
    }

    pub async fn audit_count(&self) -> usize {
        self.data
            .lock()
            .await
            .audits
            .iter()
            .filter(|entry| entry.get("eventId").is_none())
            .count()
    }

    pub async fn audit_action_count(&self, action: &str) -> usize {
        self.data
            .lock()
            .await
            .audits
            .iter()
            .filter(|entry| {
                entry.get("kind").and_then(Value::as_str) == Some(action)
                    || entry.get("action").and_then(Value::as_str) == Some(action)
            })
            .count()
    }
}

fn correlation_id() -> String {
    Uuid::now_v7().to_string()
}

fn seed_audits() -> Vec<Value> {
    let kinds = [
        (
            "snapshot.captured",
            "snapshot",
            "/data-snapshots/snapshot-1",
        ),
        ("release.created", "release", "/releases/release-1"),
        ("proposal.created", "proposal", "/proposals/proposal-1"),
        ("risk.decided", "risk-decision", "/approvals/approval-1"),
        ("approval.granted", "approval", "/approvals/approval-1"),
        ("command.issued", "command", "/orders/order-1"),
        ("order.accepted", "order", "/orders/order-1"),
        ("fill.recorded", "fill", "/orders/order-1"),
    ];
    kinds
        .iter()
        .enumerate()
        .map(|(index, (kind, object_ref, route))| {
            let event_id = format!("00000000-0000-4000-8000-{:012}", index + 1);
            let causation_id = (index > 0).then(|| {
                format!("00000000-0000-4000-8000-{:012}", index)
            });
            let mut event = json!({
                "auditRef":Uuid::now_v7(),"eventId":event_id,"correlationId":AUDIT_CORRELATION,
                "sequence":index + 1,"kind":kind,"actor":"quantos-service",
                "objectRef":object_ref,"occurredAt":format!("2026-09-16T10:00:{index:02}Z"),
                "redactionApplied":true,"redactedPayload":{"account":"acct-…xxx","redactionSummary":"[REDACTED]"},
                "payloadHash":audit_core::payload_hash(&json!({"account":"acct-…xxx","redactionSummary":"[REDACTED]"})),"route":route,
                "retentionUntil":"2027-09-16T10:00:00Z"
            });
            if let Some(causation_id) = causation_id {
                event["causationId"] = json!(causation_id);
            }
            event
        })
        .collect()
}

fn response(status: StatusCode, payload: Value, correlation: &str) -> Response {
    let correlation = payload
        .get("correlationId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .map(|id| id.to_string())
        .unwrap_or_else(|| correlation.to_owned());
    let version = payload
        .get("objectVersion")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let mut response = (status, Json(payload)).into_response();
    response.headers_mut().insert(
        "x-correlation-id",
        HeaderValue::from_str(&correlation).expect("generated UUID is a valid header"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    if let Some(version) = version {
        response.headers_mut().insert(
            header::ETAG,
            HeaderValue::from_str(&version).expect("version header"),
        );
    }
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
    let state = data.lock().await;
    let active = session.is_some_and(|id| id == VIEWER_SESSION || state.sessions.contains_key(id));
    if !active
        || state.now() >= state.session_expires_at
        || (session == Some(CURRENT_SESSION) && !state.session_active)
    {
        return Err(error(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "会话已失效，请重新登录。",
        ));
    }
    Ok(())
}

async fn require_capability(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
    capability: &str,
) -> Result<(), Response> {
    authenticate(headers, data).await?;
    let session = cookies(headers).get("quantos_session").copied();
    let allowed =
        session == Some(CURRENT_SESSION) && matches!(capability, "audit:read" | "audit:export");
    if !allowed {
        return Err(error(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "资源不存在或无权访问。",
        ));
    }
    Ok(())
}

async fn mutation_guard(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
) -> Result<(), Response> {
    authenticate(headers, data).await?;
    if cookies(headers).get("quantos_session").copied() != Some(CURRENT_SESSION) {
        return Err(error(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "资源不存在或无权访问。",
        ));
    }
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
    let state = data.lock().await;
    let valid = state.reauth_grants.get(token).is_some_and(|grant| {
        grant.expires_at > state.now()
            && Some(grant.session.as_str()) == cookies(headers).get("quantos_session").copied()
    });
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

impl ProviderData {
    fn now(&self) -> chrono::DateTime<Utc> {
        Utc::now() + self.clock_offset
    }
}

struct IdempotentCommand {
    key: String,
    intent: Value,
}
impl IdempotentCommand {
    fn new(
        headers: &HeaderMap,
        operation: &str,
        resource: &str,
        body: &Value,
    ) -> Result<Self, Box<Response>> {
        let key = idempotency_key(headers)?;
        let session = cookies(headers)
            .get("quantos_session")
            .copied()
            .unwrap_or("");
        Ok(Self {
            key: json!(["a2", session, operation, key]).to_string(),
            intent: json!([resource, body]),
        })
    }
    fn replay(&self, data: &ProviderData) -> Result<Option<Value>, Box<Response>> {
        if data
            .idempotency_intents
            .get(&self.key)
            .is_some_and(|intent| intent != &self.intent)
        {
            return Err(Box::new(error(
                StatusCode::CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                "幂等键已用于不同请求。",
            )));
        }
        Ok(data.idempotency.get(&self.key).cloned())
    }
    fn save(self, data: &mut ProviderData, payload: Value) -> Value {
        data.idempotency_intents
            .insert(self.key.clone(), self.intent);
        data.idempotency.insert(self.key, payload.clone());
        payload
    }
}

fn accepted(data: &mut ProviderData, command: IdempotentCommand, action: &str) -> Value {
    let audit_ref = Uuid::now_v7().to_string();
    let correlation = correlation_id();
    let payload = json!({
        "jobId": Uuid::now_v7(), "status":"accepted", "correlationId":correlation,
        "auditRef":audit_ref
    });
    data.audits
        .push(json!({"auditRef":audit_ref,"action":action,"correlationId":correlation}));
    command.save(data, payload)
}

fn session_payload(headers: &HeaderMap, expires_at: chrono::DateTime<Utc>) -> Value {
    let capabilities = if cookies(headers).get("quantos_session").copied() == Some(CURRENT_SESSION)
    {
        json!([
            "settings.read",
            "settings.write",
            "audit:read",
            "audit:export"
        ])
    } else {
        json!(["settings.read"])
    };
    json!({
        "actorId":"11111111-1111-4111-8111-111111111111",
        "tenantId":"22222222-2222-4222-8222-222222222222",
        "workspaceId":"33333333-3333-4333-8333-333333333333",
        "accountId":"44444444-4444-4444-8444-444444444444",
        "mode":"paper","environment":"dev","capabilities":capabilities,
        "mfaState":"verified","expiresAt":expires_at.to_rfc3339()
    })
}

async fn get_session(State(data): State<Arc<Mutex<ProviderData>>>, headers: HeaderMap) -> Response {
    if let Err(response) = authenticate(&headers, &data).await {
        return response;
    }
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        session_payload(&headers, data.lock().await.session_expires_at),
        &correlation,
    )
}

#[derive(Deserialize)]
struct MfaInput {
    purpose: String,
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
    let session = cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap()
        .to_owned();
    let mut state = data.lock().await;
    let now = state.now();
    let window = state
        .mfa_windows
        .entry(session.clone())
        .or_insert(MfaWindow {
            started_at: now,
            failures: 0,
        });
    if now >= window.started_at + Duration::seconds(60) {
        *window = MfaWindow {
            started_at: now,
            failures: 0,
        };
    }
    if window.failures >= 5 {
        return rate_limited(
            (window.started_at + Duration::seconds(60) - now)
                .num_seconds()
                .max(1),
        );
    }
    let verified = input.code.as_deref() == Some("123456"); // loopback fixture only
    if input.code.is_some() && !verified {
        window.failures += 1;
        if window.failures >= 5 {
            return rate_limited(60);
        }
    }
    let challenge = Uuid::now_v7().to_string();
    state.challenges.insert(
        challenge.clone(),
        MfaChallenge {
            session,
            purpose: input.purpose,
            verified_at: verified.then_some(now),
            expires_at: now + Duration::minutes(5),
            consumed: false,
        },
    );
    let correlation = correlation_id();
    response(
        StatusCode::OK,
        json!({"challengeRef":challenge,"status":if verified {"verified"} else if input.code.is_none() {"pending"} else {"failed"}}),
        &correlation,
    )
}

fn rate_limited(retry_after: i64) -> Response {
    let correlation = correlation_id();
    response(
        StatusCode::TOO_MANY_REQUESTS,
        json!({"code":"RATE_LIMITED","message":"验证请求过于频繁，请稍后重试。","correlationId":correlation,"retryAfter":retry_after}),
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
    let now = state.now();
    let session = cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap()
        .to_owned();
    let Some(challenge) = state
        .challenges
        .get_mut(&input.challenge_ref)
        .filter(|challenge| {
            challenge.session == session
                && matches!(challenge.purpose.as_str(), "login" | "security_change")
                && !challenge.consumed
                && challenge.expires_at > now
                && challenge
                    .verified_at
                    .is_some_and(|at| at + Duration::minutes(5) > now)
        })
    else {
        return error(
            StatusCode::FORBIDDEN,
            "MFA_NOT_VERIFIED",
            "资源不存在或无权访问。",
        );
    };
    challenge.consumed = true;
    let expires_at =
        (challenge.verified_at.unwrap() + Duration::minutes(5)).min(challenge.expires_at);
    let token = Uuid::now_v7().to_string();
    state.reauth_grants.insert(
        token.clone(),
        ReauthGrant {
            expires_at,
            session,
        },
    );
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
    let payload = data.lock().await.profile.clone();
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

async fn save_profile(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let command = match IdempotentCommand::new(&headers, "saveProfile", "profile", &input) {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => return response(StatusCode::OK, payload, &correlation_id()),
        Err(response) => return *response,
        Ok(None) => {}
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
    for (key, value) in input.as_object().expect("validated settings object") {
        state.profile[key] = value.clone();
    }
    state.profile["objectVersion"] = json!(format!("profile-v{}", state.profile_version));
    let payload = {
        let payload = state.profile.clone();
        command.save(&mut state, payload)
    };
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
    let payload = data.lock().await.notifications.clone();
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

async fn save_notifications(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    let command =
        match IdempotentCommand::new(&headers, "saveNotificationPrefs", "notifications", &input) {
            Ok(command) => command,
            Err(response) => return *response,
        };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => return response(StatusCode::OK, payload, &correlation_id()),
        Err(response) => return *response,
        Ok(None) => {}
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
    for (key, value) in input.as_object().expect("validated settings object") {
        state.notifications[key] = value.clone();
    }
    state.notifications["objectVersion"] =
        json!(format!("notifications-v{}", state.notification_version));
    let payload = {
        let payload = state.notifications.clone();
        command.save(&mut state, payload)
    };
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
    let command = match IdempotentCommand::new(&headers, "revokeSession", &session_id, &Value::Null)
    {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => {
            let correlation = payload["correlationId"].as_str().unwrap().to_owned();
            return response(StatusCode::ACCEPTED, payload, &correlation);
        }
        Err(response) => return *response,
        Ok(None) => {}
    }
    if state.sessions.remove(&session_id).is_none() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    push_event(&mut state, "session_revoked", &session_id);
    let payload = accepted(&mut state, command, "session.revoke");
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
    let session = cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap()
        .to_owned();
    let stream = futures_util::stream::unfold(
        (data, after, session, false),
        |(data, mut after, session, closed)| async move {
            if closed {
                return None;
            }
            loop {
                let state = data.lock().await;
                if let Some(mut event) = state
                    .events
                    .iter()
                    .find(|event| event["sequence"].as_u64().unwrap() > after)
                    .cloned()
                {
                    after = event["sequence"].as_u64().unwrap();
                    let target = event["payload"]["objectId"].as_str() == Some(session.as_str());
                    if matches!(
                        event["payload"]["type"].as_str(),
                        Some("permission_revoked" | "session_revoked")
                    ) {
                        event["payload"]["type"] = json!(if target {
                            "permission_revoked"
                        } else {
                            "session_revoked"
                        });
                    }
                    let terminal = event["payload"]["type"] == "permission_revoked";
                    let frame = format!("data: {event}\n\n");
                    drop(state);
                    return Some((
                        Ok::<_, std::convert::Infallible>(frame),
                        (data, after, session, terminal),
                    ));
                }
                if state.now() >= state.session_expires_at
                    || (session != VIEWER_SESSION && !state.sessions.contains_key(&session))
                    || (session == CURRENT_SESSION && !state.session_active)
                {
                    let frame = format!(
                        "data: {}\n\n",
                        json!({"streamId":"55555555-5555-4555-8555-555555555555","sequence":after+1,"eventId":Uuid::now_v7(),"occurredAt":state.now().to_rfc3339(),"correlationId":Uuid::now_v7(),"payloadVersion":"v1","payload":{"type":"permission_revoked","objectId":session}})
                    );
                    drop(state);
                    return Some((Ok(frame), (data, after + 1, session, true)));
                }
                drop(state);
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
        },
    );
    let mut response = Response::new(Body::from_stream(stream));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        "x-correlation-id",
        HeaderValue::from_str(&correlation_id()).expect("correlation header"),
    );
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
    let command = match IdempotentCommand::new(&headers, "revokeDevice", &device_id, &Value::Null) {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => {
            let correlation = payload["correlationId"].as_str().unwrap().to_owned();
            return response(StatusCode::ACCEPTED, payload, &correlation);
        }
        Err(response) => return *response,
        Ok(None) => {}
    }
    if state.devices.remove(&device_id).is_none() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    let payload = accepted(&mut state, command, "device.revoke");
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
    let command = match IdempotentCommand::new(&headers, "setupMfa", "mfa", &input) {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => {
            let correlation = payload["correlationId"].as_str().unwrap().to_owned();
            return response(StatusCode::ACCEPTED, payload, &correlation);
        }
        Err(response) => return *response,
        Ok(None) => {}
    }
    let id = format!("factor-{}", Uuid::now_v7());
    state.factors.insert(
        id.clone(),
        factor(&id, input["method"].as_str().unwrap_or("authenticator")),
    );
    let payload = accepted(&mut state, command, "mfa.setup");
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
    let command =
        match IdempotentCommand::new(&headers, "revokeMfaFactor", &factor_id, &Value::Null) {
            Ok(command) => command,
            Err(response) => return *response,
        };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(payload)) => {
            let correlation = payload["correlationId"].as_str().unwrap().to_owned();
            return response(StatusCode::ACCEPTED, payload, &correlation);
        }
        Err(response) => return *response,
        Ok(None) => {}
    }
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
    let payload = accepted(&mut state, command, "mfa.factor.revoke");
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

#[derive(Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditQuery {
    cursor: Option<String>,
    page_size: Option<usize>,
    sort: Option<String>,
    filter: Option<String>,
    correlation_id: Option<String>,
    causation_id: Option<String>,
    object_ref: Option<String>,
    kind: Option<String>,
    start_at: Option<String>,
    end_at: Option<String>,
}

type ReferencePage = (Vec<Value>, usize, Option<String>);
fn reference_page(
    state: &mut ProviderData,
    cursor: Option<&str>,
    binding: &str,
    events: Vec<Value>,
    size: usize,
) -> Result<ReferencePage, Box<Response>> {
    state
        .audit_cursors
        .retain(|_, (_, _, _, until)| *until > Utc::now());
    let (events, offset) = if let Some(token) = cursor {
        match state.audit_cursors.get(token) {
            Some((owner, rows, offset, until)) if owner == binding && *until > state.now() => {
                (rows.clone(), *offset)
            }
            _ => {
                return Err(Box::new(error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "INVALID_CURSOR",
                    "分页游标无效。",
                )));
            }
        }
    } else {
        (events, 0)
    };
    let next = if offset + size < events.len() {
        let token = Uuid::new_v4().to_string();
        state.audit_cursors.insert(
            token.clone(),
            (
                binding.to_owned(),
                events.clone(),
                offset + size,
                state.now() + Duration::minutes(5),
            ),
        );
        Some(token)
    } else {
        None
    };
    Ok((events, offset, next))
}

fn page_window(
    cursor: Option<&str>,
    page_size: Option<usize>,
) -> Result<(usize, usize), Box<Response>> {
    let size = page_size.unwrap_or(50);
    if !(1..=200).contains(&size) {
        return Err(Box::new(error(
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_FAILED",
            "分页参数无效。",
        )));
    }
    let _ = cursor;
    let offset = 0;
    Ok((offset, size))
}

async fn search_audit_events(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Query(query): Query<AuditQuery>,
) -> Response {
    if let Err(response) = require_capability(&headers, &data, "audit:read").await {
        return response;
    }
    let (_, size) = match page_window(query.cursor.as_deref(), query.page_size) {
        Ok(window) => window,
        Err(response) => return *response,
    };
    let parse_bound =
        |value: Option<&str>| value.map(chrono::DateTime::parse_from_rfc3339).transpose();
    let (start_at, end_at) = match (
        parse_bound(query.start_at.as_deref()),
        parse_bound(query.end_at.as_deref()),
    ) {
        (Ok(start_at), Ok(end_at))
            if start_at.zip(end_at).is_none_or(|(start, end)| start <= end) =>
        {
            (start_at, end_at)
        }
        _ => {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_FAILED",
                "审计时间范围无效。",
            );
        }
    };
    let sort = match query
        .sort
        .as_deref()
        .unwrap_or("occurredAt:asc")
        .split_once(':')
    {
        Some((field @ ("occurredAt" | "kind" | "eventId"), direction @ ("asc" | "desc"))) => {
            (field, direction)
        }
        _ => {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_FAILED",
                "排序参数无效。",
            );
        }
    };
    let filter = match query.filter.as_deref() {
        None => None,
        Some(raw) => match raw.splitn(3, ':').collect::<Vec<_>>().as_slice() {
            [field @ ("kind" | "eventId"), "eq", value] if !value.is_empty() => {
                Some((*field, *value))
            }
            _ => {
                return error(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "VALIDATION_FAILED",
                    "筛选参数无效。",
                );
            }
        },
    };
    let mut state = data.lock().await;
    let mut matching = state
        .audits
        .iter()
        .filter(|entry| entry.get("eventId").is_some())
        .filter(|entry| {
            query.correlation_id.as_deref().is_none_or(|value| {
                entry.get("correlationId").and_then(Value::as_str) == Some(value)
            }) && query
                .causation_id
                .as_deref()
                .is_none_or(|value| entry.get("causationId").and_then(Value::as_str) == Some(value))
                && query.object_ref.as_deref().is_none_or(|value| {
                    entry
                        .get("objectRef")
                        .and_then(Value::as_str)
                        .is_some_and(|candidate| candidate.contains(value))
                })
                && query
                    .kind
                    .as_deref()
                    .is_none_or(|value| entry.get("kind").and_then(Value::as_str) == Some(value))
                && entry
                    .get("occurredAt")
                    .and_then(Value::as_str)
                    .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                    .is_some_and(|occurred_at| {
                        start_at.is_none_or(|start| occurred_at >= start)
                            && end_at.is_none_or(|end| occurred_at <= end)
                    })
        })
        .filter(|entry| filter.is_none_or(|(field, value)| entry[field].as_str() == Some(value)))
        .cloned()
        .collect::<Vec<_>>();
    matching.sort_by(|a, b| {
        let order = a[sort.0]
            .as_str()
            .cmp(&b[sort.0].as_str())
            .then_with(|| a["eventId"].as_str().cmp(&b["eventId"].as_str()));
        if sort.1 == "desc" {
            order.reverse()
        } else {
            order
        }
    });
    let mut binding = serde_json::to_value(&query).unwrap();
    binding.as_object_mut().unwrap().remove("cursor");
    let binding = format!(
        "search:{}:{}",
        cookies(&headers)
            .get("quantos_session")
            .copied()
            .unwrap_or_default(),
        binding
    );
    let (matching, offset, next) = match reference_page(
        &mut state,
        query.cursor.as_deref(),
        &binding,
        matching,
        size,
    ) {
        Ok(page) => page,
        Err(r) => return *r,
    };
    let items = matching
        .iter()
        .skip(offset)
        .take(size)
        .cloned()
        .collect::<Vec<_>>();
    let correlation = correlation_id();
    let mut payload = json!({"items":items});
    if let Some(next) = next {
        payload["nextCursor"] = json!(next);
    }
    record_audit_action(
        &mut state,
        "audit.search_accessed",
        &correlation,
        "audit",
        json!({"outcome":"succeeded"}),
    );
    response(StatusCode::OK, payload, &correlation)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvidenceQuery {
    cursor: Option<String>,
    page_size: Option<usize>,
}

async fn get_evidence_chain(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(correlation_id_value): Path<String>,
    headers: HeaderMap,
    Query(query): Query<EvidenceQuery>,
) -> Response {
    if let Err(response) = require_capability(&headers, &data, "audit:read").await {
        return response;
    }
    if Uuid::parse_str(&correlation_id_value).is_err() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    let (_, size) = match page_window(query.cursor.as_deref(), query.page_size) {
        Ok(window) => window,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    let events = state
        .audits
        .iter()
        .filter(|entry| {
            entry.get("correlationId").and_then(Value::as_str)
                == Some(correlation_id_value.as_str())
                && entry.get("eventId").is_some()
        })
        .cloned()
        .collect::<Vec<_>>();
    if events.is_empty() {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    let binding = format!(
        "chain:{}:{}:{}",
        cookies(&headers)
            .get("quantos_session")
            .copied()
            .unwrap_or_default(),
        correlation_id_value,
        size
    );
    let (events, offset, next) =
        match reference_page(&mut state, query.cursor.as_deref(), &binding, events, size) {
            Ok(page) => page,
            Err(r) => return *r,
        };
    let items = events
        .iter()
        .skip(offset)
        .take(size)
        .map(|entry| {
            let mut node = json!({
                "eventId":entry["eventId"],"sequence":entry["sequence"],"kind":entry["kind"],
                "objectRef":entry["objectRef"],"occurredAt":entry["occurredAt"],
                "payloadHash":entry["payloadHash"],"route":entry["route"],
                "retentionUntil":entry["retentionUntil"]
            });
            if let Some(causation) = entry.get("causationId").filter(|value| !value.is_null()) {
                node["causationId"] = causation.clone();
            }
            node
        })
        .collect::<Vec<_>>();
    let complete = offset + items.len() >= events.len();

    let correlation = correlation_id();
    let mut payload =
        json!({"correlationId":correlation_id_value,"items":items,"complete":complete});
    if let Some(next) = next {
        payload["nextCursor"] = json!(next);
    }
    record_audit_action(
        &mut state,
        "audit.chain_accessed",
        &correlation,
        "audit",
        json!({"outcome":"succeeded"}),
    );
    response(StatusCode::OK, payload, &correlation)
}

use audit_core::ExportInput;

fn record_audit_action(
    data: &mut ProviderData,
    action: &str,
    correlation: &str,
    object_ref: &str,
    redacted_payload: Value,
) -> String {
    let audit_ref = Uuid::now_v7().to_string();
    let sequence = data
        .audits
        .iter()
        .filter(|entry| entry.get("eventId").is_some())
        .count()
        + 1;
    let redacted_payload = audit_core::redacted(&redacted_payload);
    data.audits.push(json!({
        "auditRef":audit_ref,"eventId":Uuid::now_v7(),"correlationId":correlation,
        "sequence":sequence,"kind":action,"actor":"audit-user","objectRef":object_ref,
        "occurredAt":data.now().to_rfc3339(),"redactionApplied":true,
        "redactedPayload":redacted_payload,"payloadHash":audit_core::payload_hash(&redacted_payload),
        "route":format!("/exports/{object_ref}"),"retentionUntil":(data.now() + Duration::days(365)).to_rfc3339()
    }));
    audit_ref
}

async fn create_export(
    State(data): State<Arc<Mutex<ProviderData>>>,
    headers: HeaderMap,
    Json(input): Json<ExportInput>,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_capability(&headers, &data, "audit:export").await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    let input = match input.normalize() {
        Ok(input) => input,
        Err(()) => {
            return error(
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_FAILED",
                "导出范围或保留策略无效。",
            );
        }
    };
    let intent = serde_json::to_value(&input).expect("export input");
    let command = match IdempotentCommand::new(&headers, "createExport", "exports", &intent) {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(existing)) => return response(StatusCode::ACCEPTED, existing, &correlation_id()),
        Err(response) => return *response,
        Ok(None) => {}
    }
    if input.scope.correlation_ids.iter().any(|id| {
        !state
            .audits
            .iter()
            .any(|e| e["correlationId"].as_str() == Some(id))
    }) {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    }
    let export_id = Uuid::now_v7().to_string();
    let correlation = input.scope.correlation_ids[0].clone();
    let audit_ref = record_audit_action(
        &mut state,
        "export.created",
        &correlation,
        &export_id,
        json!({
            "scope":input.scope,
            "format":input.format,"reason":input.reason,"watermark":input.watermark,
            "retentionDays":input.retention_days
        }),
    );
    let now = state.now();
    let payload = json!({
        "exportId":export_id,"status":"queued","format":input.format,"requestedBy":"audit-user",
        "requestedAt":now.to_rfc3339(),"watermark":audit_core::watermark(&input.watermark),
        "retentionUntil":(now + Duration::days(input.retention_days)).to_rfc3339(),
        "correlationId":correlation,"auditRef":audit_ref
    });
    state.exports.insert(export_id.clone(), payload.clone());
    let events = state
        .audits
        .iter()
        .filter(|e| input.includes(e))
        .cloned()
        .collect::<Vec<_>>();
    let (bytes, media) = audit_core::artifact(
        &input.format,
        payload["watermark"].as_str().unwrap(),
        &events,
    );
    state
        .export_artifacts
        .insert(export_id.clone(), (bytes, media.to_owned()));
    let job = state.exports.get_mut(&export_id).unwrap();
    job["status"] = json!("ready");
    job["completedAt"] = json!(now.to_rfc3339());
    record_audit_action(
        &mut state,
        "export.ready",
        &correlation,
        &export_id,
        json!({"status":"ready"}),
    );
    command.save(&mut state, payload.clone());
    let response_correlation = correlation_id();
    response(StatusCode::ACCEPTED, payload, &response_correlation)
}

async fn get_export_status(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(export_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = require_capability(&headers, &data, "audit:read").await {
        return response;
    }
    let mut state = data.lock().await;
    let payload = {
        let Some(job) = state.exports.get_mut(&export_id) else {
            return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
        };
        // Status reads do not execute generation.

        job.clone()
    };
    let job_correlation = payload["correlationId"]
        .as_str()
        .unwrap_or(AUDIT_CORRELATION);
    record_audit_action(
        &mut state,
        "export.status_viewed",
        job_correlation,
        &export_id,
        json!({"status":payload["status"]}),
    );
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

async fn cancel_export(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(export_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = mutation_guard(&headers, &data).await {
        return response;
    }
    if let Err(response) = require_capability(&headers, &data, "audit:export").await {
        return response;
    }
    if let Err(response) = require_reauth(&headers, &data).await {
        return response;
    }
    let command = match IdempotentCommand::new(&headers, "cancelExport", &export_id, &Value::Null) {
        Ok(command) => command,
        Err(response) => return *response,
    };
    let mut state = data.lock().await;
    match command.replay(&state) {
        Ok(Some(existing)) => return response(StatusCode::ACCEPTED, existing, &correlation_id()),
        Err(response) => return *response,
        Ok(None) => {}
    }
    let payload = {
        let Some(job) = state.exports.get_mut(&export_id) else {
            return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
        };
        if matches!(
            job["status"].as_str(),
            Some("cancelled" | "expired" | "failed")
        ) {
            return error(StatusCode::CONFLICT, "STATE_CONFLICT", "导出状态已变更。");
        }
        job["status"] = json!("cancelled");
        job.clone()
    };
    let job_correlation = payload["correlationId"]
        .as_str()
        .unwrap_or(AUDIT_CORRELATION);
    let audit_ref = record_audit_action(
        &mut state,
        "export.cancelled",
        job_correlation,
        &export_id,
        json!({"status":"cancelled"}),
    );
    let mut payload = payload;
    payload["auditRef"] = json!(audit_ref);
    state.exports.insert(export_id, payload.clone());
    command.save(&mut state, payload.clone());
    let correlation = correlation_id();
    response(StatusCode::ACCEPTED, payload, &correlation)
}

async fn get_export_download(
    State(data): State<Arc<Mutex<ProviderData>>>,
    Path(export_id): Path<String>,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = require_capability(&headers, &data, "audit:export").await {
        return response;
    }
    let mut state = data.lock().await;
    let Some(job) = state.exports.get(&export_id).cloned() else {
        return error(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在或无权访问。");
    };
    if job["status"] == "expired" {
        return error(
            StatusCode::GONE,
            "EXPORT_EXPIRED",
            "导出已过期，请重新创建。",
        );
    }
    if job["status"] != "ready" {
        return error(StatusCode::CONFLICT, "EXPORT_NOT_READY", "导出尚未就绪。");
    }
    let job_correlation = job["correlationId"].as_str().unwrap_or(AUDIT_CORRELATION);
    let retention = chrono::DateTime::parse_from_rfc3339(job["retentionUntil"].as_str().unwrap())
        .unwrap()
        .with_timezone(&Utc);
    if retention <= state.now() {
        return error(
            StatusCode::GONE,
            "EXPORT_EXPIRED",
            "导出已过期，请重新创建。",
        );
    }
    let expires_at = (state.now() + Duration::minutes(5)).min(retention);
    let audit_ref = record_audit_action(
        &mut state,
        "export.download_issued",
        job_correlation,
        &export_id,
        json!({
            "expiresAt":expires_at.to_rfc3339(),"watermarked":true,
            "retentionUntil":job["retentionUntil"]
        }),
    );
    let media_type = match job["format"].as_str() {
        Some("csv") => "text/csv",
        Some("pdf") => "application/pdf",
        _ => "application/x-ndjson",
    };
    let (bytes, _) = state
        .export_artifacts
        .get(&export_id)
        .expect("reference artifact");
    let payload = json!({
        "exportId":export_id,
        "downloadUrl":format!("https://downloads.invalid/v1/exports/{export_id}?ticket={}", Uuid::now_v7()),
        "expiresAt":expires_at.to_rfc3339(),"sha256":audit_core::digest(bytes),
        "sizeBytes":bytes.len(),"mediaType":media_type,"watermarked":true,
        "retentionUntil":job["retentionUntil"],"auditRef":audit_ref
    });
    let correlation = correlation_id();
    response(StatusCode::OK, payload, &correlation)
}

fn push_event(data: &mut ProviderData, kind: &str, object_id: &str) {
    let sequence = data.events.len() + 1;
    data.events.push(json!({
        "streamId":"55555555-5555-4555-8555-555555555555","sequence":sequence,
        "eventId":Uuid::now_v7(),"occurredAt":Utc::now().to_rfc3339(),"correlationId":Uuid::now_v7(),
        "payloadVersion":"v1","payload":{"type":kind,"objectId":object_id}
    }));
}
