//! A2 storage uses the dedicated quantos_bff connection, never fixture state.
use std::sync::Arc;

use axum::{
    Json, Router,
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
};
use chrono::{DateTime, Duration, Utc};
use postgres::{Client, Transaction};
use quantos_auth::BffSessionContext;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::{LiveState, auth_status, require_origin, session_cookie, settings_policy};

#[derive(Clone)]
pub(super) struct TrustedIdentity(pub BffSessionContext, pub String);

pub(super) struct AuthProof {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

struct StreamDatabase(Option<Client>);
impl Drop for StreamDatabase {
    fn drop(&mut self) {
        if let Some(client) = self.0.take() {
            // postgres owns a blocking runtime; dispose it outside Tokio, also on cancelled streams.
            std::thread::spawn(move || drop(client));
        }
    }
}

pub(super) struct A2Store {
    pub client: Client,
}

#[derive(Debug)]
pub(super) struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub details: Value,
}
impl ApiError {
    pub fn new(status: StatusCode, code: &'static str) -> Self {
        Self {
            status,
            code,
            details: json!({}),
        }
    }
    pub fn unavailable() -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE")
    }
}
impl From<postgres::Error> for ApiError {
    fn from(_: postgres::Error) -> Self {
        Self::unavailable()
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let correlation = Uuid::new_v4().to_string();
        let mut body =
            json!({"code":self.code,"message":"暂时无法完成请求。","correlationId":correlation});
        for (key, value) in self.details.as_object().unwrap() {
            body[key] = value.clone();
        }
        crate::response(self.status, body, &correlation)
    }
}
pub(super) fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
fn csrf_cookie(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("cookie")?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| part.trim().strip_prefix("quantos_csrf="))
}

impl A2Store {
    pub fn new(database_url: &str) -> anyhow::Result<Self> {
        Ok(Self {
            client: quantos_auth::connect_bff_database(database_url)?,
        })
    }
    // The F09 logout-only router must construct its unused A2 state without a
    // production login secret. This adapter exists only in test binaries.
    #[cfg(test)]
    pub(super) fn for_observability_fixture(client: Client) -> Self {
        Self { client }
    }
    pub fn register(
        &mut self,
        raw: &str,
        csrf: &str,
        context: &BffSessionContext,
        user: &Value,
    ) -> Result<(), ApiError> {
        let mut profile = crate::profile(1);
        profile["displayName"] = json!(
            user["user_metadata"]["display_name"]
                .as_str()
                .filter(|s| !s.is_empty() && s.len() <= 80)
                .unwrap_or("QuantOS member")
        );
        profile["memberId"] = json!(context.auth.actor_id.to_string());
        profile["email"] = json!(user["email"].as_str().ok_or_else(ApiError::unavailable)?);
        profile["emailVerified"] = json!(!user["email_confirmed_at"].is_null());
        profile["roleLabels"] = json!([context.auth.role.as_str()]);
        let raw_hash = hash(raw);
        let session_id = Uuid::new_v4();
        let device_id = Uuid::new_v4();
        let mut tx = self.client.transaction()?;
        tx.execute("insert into quantos.bff_profiles(user_id,profile,notifications) values($1,$2,$3) on conflict(user_id) do nothing", &[&context.user_id,&profile,&crate::notifications(1)])?;
        tx.execute("insert into quantos.bff_devices(device_id,user_id,label,trusted,trusted_until) values($1,$2,'Web session',$3,$4)", &[&device_id,&context.user_id,&context.mfa_verified,&context.expires_at])?;
        tx.execute("insert into quantos.bff_session_details(session_hash,session_id,device_id,csrf_hash) values($1,$2,$3,$4)", &[&raw_hash,&session_id,&device_id,&hash(csrf)])?;
        tx.commit()?;
        Ok(())
    }
    pub fn locked<T>(
        &mut self,
        user: Uuid,
        f: impl FnOnce(&mut Self) -> Result<T, ApiError>,
    ) -> Result<T, ApiError> {
        let key = user.to_string();
        self.client
            .query_one("select pg_advisory_lock(hashtextextended($1, 2))", &[&key])?;
        let result = f(self);
        self.client.query_one(
            "select pg_advisory_unlock(hashtextextended($1, 2))",
            &[&key],
        )?;
        result
    }
}

async fn authorized(
    state: Arc<LiveState>,
    headers: HeaderMap,
    write: bool,
) -> Result<(BffSessionContext, String), ApiError> {
    if write {
        require_origin(&headers, &state.terminal_origin)
            .map_err(|s| ApiError::new(s, "FORBIDDEN"))?;
    }
    let raw = session_cookie(&headers)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "UNAUTHENTICATED"))?;
    let raw_hash = hash(&raw);
    let hash_for_db = raw_hash.clone();
    let context = tokio::task::spawn_blocking(move || {
        let context = state
            .middleware
            .lock()
            .map_err(|_| ApiError::unavailable())?
            .load_bff_session_context(&raw, None)
            .map_err(|e| ApiError::new(auth_status(e), "UNAUTHENTICATED"))?;
        let mut store = state.a2.lock().map_err(|_| ApiError::unavailable())?;
        let row = store.client.query_typed_opt(
            "update quantos.bff_session_details set last_active_at=now() where session_hash=$1 returning csrf_hash",
            &[(&hash_for_db,postgres::types::Type::TEXT)],
        )?.ok_or_else(||ApiError::new(StatusCode::UNAUTHORIZED,"UNAUTHENTICATED"))?;
        if write {
            let cookie = csrf_cookie(&headers)
                .ok_or_else(|| ApiError::new(StatusCode::FORBIDDEN, "FORBIDDEN"))?;
            let token = headers
                .get("x-csrf-token")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| ApiError::new(StatusCode::FORBIDDEN, "FORBIDDEN"))?;
            if !settings_policy::csrf_valid(&row.get::<_, String>(0), Some(cookie), Some(token)) {
                return Err(ApiError::new(StatusCode::FORBIDDEN, "FORBIDDEN"));
            }
        }
        Ok(context)
    })
    .await
    .map_err(|_| ApiError::unavailable())??;
    Ok((context, raw_hash))
}
fn respond(mut payload: Value) -> Response {
    let stored_correlation = payload
        .as_object_mut()
        .and_then(|p| p.remove("_correlationId"))
        .and_then(|v| v.as_str().map(str::to_owned));
    let correlation = payload["correlationId"]
        .as_str()
        .map(str::to_owned)
        .or(stored_correlation)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    crate::response(StatusCode::OK, payload, &correlation)
}
fn recent(
    tx: &mut Transaction<'_>,
    session: &str,
    headers: &HeaderMap,
    operation: &str,
) -> Result<String, ApiError> {
    let reference = headers
        .get("x-reauth-token-ref")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or_else(|| ApiError::new(StatusCode::FORBIDDEN, "RECENT_AUTH_REQUIRED"))?;
    let grant=tx.query_opt("select scope from quantos.bff_reauth_grants where grant_ref=$1 and session_hash=$2 and expires_at>now()", &[&reference,&session])?;
    let scope = grant
        .map(|row| row.get::<_, String>(0))
        .ok_or_else(|| ApiError::new(StatusCode::FORBIDDEN, "RECENT_AUTH_REQUIRED"))?;
    if !(scope == "security"
        || matches!(operation, "setupMfa" | "cancelUnverifiedMfa") && scope == "first_factor")
    {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "RECENT_AUTH_REQUIRED"));
    }
    Ok(scope)
}
fn accepted() -> Value {
    json!({"jobId":Uuid::new_v4(),"status":"accepted","correlationId":Uuid::new_v4(),"auditRef":Uuid::new_v4()})
}
fn audit(
    tx: &mut Transaction<'_>,
    context: &BffSessionContext,
    action: &str,
    resource: &str,
    payload: &Value,
) -> Result<(), ApiError> {
    let audit_ref = payload["auditRef"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4);
    let correlation = payload["correlationId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4);
    tx.execute("insert into quantos.bff_settings_audits(audit_ref,user_id,tenant_id,actor_id,action,object_ref,correlation_id) values($1,$2,$3,$4,$5,$6,$7) on conflict(audit_ref) do nothing", &[&audit_ref,&context.user_id,context.auth.tenant_id.as_uuid(),context.auth.actor_id.as_uuid(),&action,&resource,&correlation])?;
    Ok(())
}
fn command_key(headers: &HeaderMap) -> Result<Uuid, ApiError> {
    headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or_else(|| ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST"))
}
fn replay(
    tx: &mut Transaction<'_>,
    user: Uuid,
    operation: &str,
    key: Uuid,
    intent: &Value,
) -> Result<Option<Value>, ApiError> {
    if let Some(row)=tx.query_opt("select intent,response,completed from quantos.bff_security_commands where user_id=$1 and operation=$2 and idempotency_key=$3", &[&user,&operation,&key])? {
        if row.get::<_,Value>(0)!=*intent {return Err(ApiError::new(StatusCode::CONFLICT,"IDEMPOTENCY_CONFLICT"));}
        if row.get::<_,bool>(2) {return Ok(Some(row.get(1)));}
    }
    Ok(None)
}
fn save_command(
    tx: &mut Transaction<'_>,
    user: Uuid,
    operation: &str,
    key: Uuid,
    intent: &Value,
    payload: &Value,
) -> Result<(), ApiError> {
    tx.execute("insert into quantos.bff_security_commands(user_id,operation,idempotency_key,intent,response,completed) values($1,$2,$3,$4,$5,true) on conflict(user_id,operation,idempotency_key) do update set response=excluded.response,completed=true", &[&user,&operation,&key,intent,payload])?;
    Ok(())
}
fn emit(
    tx: &mut Transaction<'_>,
    user: Uuid,
    session_id: Uuid,
    correlation: &str,
) -> Result<(), ApiError> {
    let event = json!({"streamId":user,"eventId":Uuid::new_v4(),"occurredAt":Utc::now().to_rfc3339(),"correlationId":correlation,"payloadVersion":"v1","payload":{"type":"session_revoked","objectId":session_id}});
    tx.execute("insert into quantos.bff_settings_events(user_id,sequence,event) select $1,coalesce(max(sequence),0)+1,$2 from quantos.bff_settings_events where user_id=$1", &[&user,&event])?;
    Ok(())
}

pub(super) fn routes() -> Router<Arc<LiveState>> {
    Router::new()
        .route("/v1/settings/profile", get(get_profile).put(save_profile))
        .route(
            "/v1/settings/notification-preferences",
            get(get_notifications).put(save_notifications),
        )
        .route("/v1/settings/security", get(security))
        .route("/v1/settings/sessions", get(sessions))
        .route("/v1/settings/sessions/:id", delete(revoke_session))
        .route("/v1/settings/sessions/stream", get(stream))
        .route("/v1/settings/trusted-devices", get(devices))
        .route("/v1/settings/trusted-devices/:id", delete(revoke_device))
        .route("/v1/settings/mfa/setup", post(setup_mfa))
        .route("/v1/settings/mfa/factors/:id", delete(revoke_factor))
        .route("/v1/settings/downloads", get(downloads))
        .route("/v1/platform/browser-capabilities", get(capabilities))
        .route("/v1/auth/mfa/challenges", post(challenge))
        .route("/v1/auth/reauth", post(reauth))
        .route("/v1/access-requests", post(access_request))
}
async fn read_preferences(
    identity: axum::Extension<TrustedIdentity>,
    state: Arc<LiveState>,
    _headers: HeaderMap,
    kind: &'static str,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, _)) = identity;
    let value = tokio::task::spawn_blocking(move || {
        let row = state
            .a2
            .lock()
            .map_err(|_| ApiError::unavailable())?
            .client
            .query_one(
                "select profile,notifications from quantos.bff_profiles where user_id=$1",
                &[&context.user_id],
            )?;
        Ok::<Value, ApiError>(row.get(kind))
    })
    .await
    .map_err(|_| ApiError::unavailable())??;
    Ok(respond(value))
}
async fn get_profile(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
) -> Result<Response, ApiError> {
    read_preferences(identity, s, h, "profile").await
}
async fn get_notifications(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
) -> Result<Response, ApiError> {
    read_preferences(identity, s, h, "notifications").await
}
async fn save_preferences(
    identity: axum::Extension<TrustedIdentity>,
    state: Arc<LiveState>,
    headers: HeaderMap,
    input: Value,
    kind: &'static str,
    operation: &'static str,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, _)) = identity;
    let key = command_key(&headers)?;
    let value=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(context.user_id,|store|{
        let mut tx=store.client.transaction()?;let intent=json!([kind,input]);
        if let Some(payload)=replay(&mut tx,context.user_id,operation,key,&intent)? {tx.commit()?;return Ok(payload);}
        let row=tx.query_one("select profile,notifications from quantos.bff_profiles where user_id=$1 for update", &[&context.user_id])?;
        let mut payload:Value=row.get(kind);let expected=payload["objectVersion"].as_str().ok_or_else(ApiError::unavailable)?;
        if headers.get("if-match").and_then(|v|v.to_str().ok())!=Some(expected) {
            return Err(ApiError {status:StatusCode::CONFLICT,code:"VERSION_CONFLICT",details:json!({"currentVersion":expected})});
        }
        let version=expected.rsplit('v').next().and_then(|v|v.parse::<u64>().ok()).ok_or_else(ApiError::unavailable)?+1;
        for (k,v) in input.as_object().ok_or_else(||ApiError::new(StatusCode::UNPROCESSABLE_ENTITY,"INVALID_REQUEST"))? {payload[k]=v.clone();}
        payload["objectVersion"]=json!(format!("{kind}-v{version}"));
        let query=if kind=="profile" {"update quantos.bff_profiles set profile=$2,updated_at=now() where user_id=$1"} else {"update quantos.bff_profiles set notifications=$2,updated_at=now() where user_id=$1"};
        tx.execute(query,&[&context.user_id,&payload])?;
        let correlation=Uuid::new_v4();payload["_correlationId"]=json!(correlation);
        save_command(&mut tx,context.user_id,operation,key,&intent,&payload)?;
        audit(&mut tx,&context,operation,kind,&json!({"correlationId":correlation}))?;
        tx.commit()?;Ok(payload)
    })).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(value))
}
async fn save_profile(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> Result<Response, ApiError> {
    save_preferences(identity, s, h, v, "profile", "saveProfile").await
}
async fn save_notifications(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> Result<Response, ApiError> {
    save_preferences(identity, s, h, v, "notifications", "saveNotificationPrefs").await
}
async fn sessions(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, hash)) = identity;
    let values=tokio::task::spawn_blocking(move|| {
        let rows=state.a2.lock().map_err(|_|ApiError::unavailable())?.client.query("select d.session_id,d.client,d.platform,d.last_active_at,s.session_hash from quantos.bff_sessions s join quantos.bff_session_details d using(session_hash) where s.user_id=$1 and s.expires_at>now() order by d.session_id", &[&context.user_id])?;
        Ok::<_,ApiError>(rows.into_iter().map(|r|json!({"sessionId":r.get::<_,Uuid>(0),"client":r.get::<_,String>(1),"platform":r.get::<_,String>(2),"location":"Unknown","lastActiveAt":r.get::<_,DateTime<Utc>>(3).to_rfc3339(),"ipMasked":"[REDACTED]","current":r.get::<_,String>(4)==hash})).collect::<Vec<_>>())
    }).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(json!(values)))
}
async fn devices(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, hash)) = identity;
    let values=tokio::task::spawn_blocking(move|| {
        let rows=state.a2.lock().map_err(|_|ApiError::unavailable())?.client.query("select d.device_id,d.label,d.trusted_until,exists(select 1 from quantos.bff_session_details s where s.device_id=d.device_id and s.session_hash=$2) from quantos.bff_devices d where d.user_id=$1 and d.trusted and d.trusted_until>now() order by d.device_id", &[&context.user_id,&hash])?;
        Ok::<_,ApiError>(rows.into_iter().map(|r|json!({"deviceId":r.get::<_,Uuid>(0),"label":r.get::<_,String>(1),"verificationMethod":"authenticator","trustedUntil":r.get::<_,DateTime<Utc>>(2).to_rfc3339(),"current":r.get::<_,bool>(3)})).collect::<Vec<_>>())
    }).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(json!(values)))
}
async fn revoke(
    identity: axum::Extension<TrustedIdentity>,
    state: Arc<LiveState>,
    headers: HeaderMap,
    id: String,
    device: bool,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    let target =
        Uuid::parse_str(&id).map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "NOT_FOUND"))?;
    let operation = if device {
        "revokeDevice"
    } else {
        "revokeSession"
    };
    let key = command_key(&headers)?;
    let payload=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(context.user_id,|store|{
        let mut tx=store.client.transaction()?;recent(&mut tx,&session,&headers,operation)?;let intent=json!([target]);
        if let Some(payload)=replay(&mut tx,context.user_id,operation,key,&intent)? {tx.commit()?;return Ok(payload);}
        let rows=if device {
            if tx.query_opt("select device_id from quantos.bff_devices where device_id=$1 and user_id=$2 and trusted", &[&target,&context.user_id])?.is_none(){return Err(ApiError::new(StatusCode::NOT_FOUND,"NOT_FOUND"));}
            tx.query("select s.session_hash,d.session_id from quantos.bff_sessions s join quantos.bff_session_details d using(session_hash) where d.device_id=$1 and s.user_id=$2", &[&target,&context.user_id])?
        }else{tx.query("select s.session_hash,d.session_id from quantos.bff_sessions s join quantos.bff_session_details d using(session_hash) where d.session_id=$1 and s.user_id=$2 and s.expires_at>now()", &[&target,&context.user_id])?};
        if !device && rows.is_empty(){return Err(ApiError::new(StatusCode::NOT_FOUND,"NOT_FOUND"));}
        if !device && rows.iter().any(|row|row.get::<_,String>(0)==session){return Err(ApiError::new(StatusCode::CONFLICT,"CURRENT_SESSION_PROTECTED"));}
        let payload=accepted();
        for row in rows {let hash:String=row.get(0);tx.execute("delete from quantos.bff_sessions where session_hash=$1", &[&hash])?;emit(&mut tx,context.user_id,row.get(1),payload["correlationId"].as_str().unwrap())?;}
        if device {tx.execute("update quantos.bff_devices set trusted=false where device_id=$1 and user_id=$2", &[&target,&context.user_id])?;}
        save_command(&mut tx,context.user_id,operation,key,&intent,&payload)?;audit(&mut tx,&context,operation,&id,&payload)?;tx.commit()?;Ok(payload)
    })).await.map_err(|_|ApiError::unavailable())??;
    let correlation = payload["correlationId"].as_str().unwrap().to_owned();
    Ok(crate::response(StatusCode::ACCEPTED, payload, &correlation))
}
async fn revoke_session(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    revoke(identity, s, h, id, false).await
}
async fn revoke_device(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    revoke(identity, s, h, id, true).await
}

async fn capabilities(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let _ = (identity, headers);
    Ok(respond(
        json!({"kind":"web","authFlow":"browser_redirect","notifications":"browser","localFileImport":false,"deepLinkScheme":state.terminal_origin,"downloadsViaBff":true,"offlineDomainActions":false,"businessPagesNoIndex":true,"cspEnforced":true,"sessionProtected":true}),
    ))
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadsQuery {
    cursor: Option<String>,
    page_size: Option<usize>,
    sort: Option<String>,
    filter: Option<String>,
}
async fn downloads(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
    Query(q): Query<DownloadsQuery>,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, _)) = identity;
    // A2 lists persisted controlled-download metadata; signing/export production is owned by A2 BFF-FE-007.
    let rows=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.client.query("select response from quantos.bff_security_commands where user_id=$1 and operation='controlledDownload' and completed order by created_at,idempotency_key", &[&context.user_id]).map_err(ApiError::from)).await.map_err(|_|ApiError::unavailable())??;
    let mut items = rows
        .into_iter()
        .map(|r| r.get::<_, Value>(0))
        .collect::<Vec<_>>();
    if let Some(filter) = q.filter {
        let parts = filter.splitn(3, ':').collect::<Vec<_>>();
        if parts.len() != 3 || parts[1] != "eq" {
            return Err(ApiError::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
            ));
        }
        items.retain(|v| v[parts[0]].as_str() == Some(parts[2]));
    }
    if let Some(sort) = q.sort {
        let parts = sort.split(':').collect::<Vec<_>>();
        if parts.len() != 2 {
            return Err(ApiError::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
            ));
        }
        items.sort_by(|a, b| a[parts[0]].as_str().cmp(&b[parts[0]].as_str()));
        if parts[1] == "desc" {
            items.reverse();
        }
    }
    let offset = q
        .cursor
        .as_deref()
        .map(|s| {
            s.strip_prefix("downloads:")
                .and_then(|v| v.parse::<usize>().ok())
                .ok_or_else(|| ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST"))
        })
        .transpose()?
        .unwrap_or(0);
    let size = q.page_size.unwrap_or(50);
    if !(1..=200).contains(&size) || offset > items.len() {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "INVALID_REQUEST",
        ));
    }
    let end = (offset + size).min(items.len());
    let mut payload = json!({"items":items[offset..end]});
    if end < items.len() {
        payload["nextCursor"] = json!(format!("downloads:{end}"));
    }
    Ok(respond(payload))
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StreamQuery {
    after_sequence: Option<i64>,
}
async fn stream(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Query(q): Query<StreamQuery>,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    // Each subscriber has an independent narrow connection, so idle polling
    // cannot starve ordinary mutations on the settings transaction connection.
    let database_url = state.database_url.clone();
    let session_for_connection = session.clone();
    let (client, current) = tokio::task::spawn_blocking(move || {
        let mut client = quantos_auth::connect_bff_database(&database_url)
            .map_err(|_| ApiError::unavailable())?;
        let row = client.query_one(
            "select session_id from quantos.bff_session_details where session_hash=$1",
            &[&session_for_connection],
        )?;
        Ok::<_, ApiError>((
            std::sync::Arc::new(std::sync::Mutex::new(StreamDatabase(Some(client)))),
            row.get::<_, Uuid>(0),
        ))
    })
    .await
    .map_err(|_| ApiError::unavailable())??;
    let stream = futures_util::stream::unfold(
        (
            client,
            context,
            session,
            current,
            q.after_sequence.unwrap_or(0),
            false,
        ),
        |(client, context, session, current, after, closed)| async move {
            if closed {
                return None;
            }
            loop {
                let result = tokio::task::spawn_blocking({
                    let client=client.clone();let context=context.clone();let session=session.clone();
                    move || {
                        use postgres::types::Type;
                        let user=context.user_id;
                        let account=context.auth.account_id.map(|id|*id.as_uuid());
                        let capabilities=context.auth.capabilities.iter().map(|c|c.as_str().to_owned()).collect::<Vec<_>>();
                        // Revalidate expiry, actor, membership, account and capabilities
                        // for every delivery. No bearer or raw session is needed here.
                        let row=client.lock().map_err(|_|ApiError::unavailable())?.0.as_mut().ok_or_else(ApiError::unavailable)?.query_typed_one(
                            "select exists(
                              select 1 from quantos.bff_sessions s
                              join quantos.actors a on a.user_id=s.user_id and a.is_active and a.actor_kind='user'
                              join quantos.workspace_memberships wm on wm.actor_id=a.id and wm.tenant_id=a.tenant_id
                              join quantos.workspaces w on w.id=wm.workspace_id and w.tenant_id=a.tenant_id and w.is_primary
                              join quantos.accounts account on account.workspace_id=w.id and account.tenant_id=a.tenant_id and account.is_active
                              where s.session_hash=$1 and s.user_id=$2 and s.expires_at>now()
                              and a.id=$3 and a.tenant_id=$4 and w.id=$5 and account.id=$6
                              and wm.role=$7 and account.mode=$8
                              and (select coalesce(array_remove(array_agg(distinct ac.capability order by ac.capability),null),array[]::text[])
                                from quantos.actor_capabilities ac where ac.actor_id=a.id and ac.tenant_id=a.tenant_id
                                and (ac.mode_scope is null or ac.mode_scope=$8)
                                and (ac.workspace_id is null or ac.workspace_id=w.id)
                                and (ac.account_id is null or ac.account_id=account.id))=$9
                            ), e.sequence, e.event from (select 1) seed
                            left join lateral (select sequence,event from quantos.bff_settings_events
                              where user_id=$2 and sequence>$10 order by sequence limit 1) e on true",
                            &[(&session,Type::TEXT),(&user,Type::UUID),(context.auth.actor_id.as_uuid(),Type::UUID),
                              (context.auth.tenant_id.as_uuid(),Type::UUID),(context.auth.workspace_id.as_uuid(),Type::UUID),
                              (&account,Type::UUID),(&context.auth.role.as_str(),Type::TEXT),(&context.auth.mode.as_str(),Type::TEXT),
                              (&capabilities,Type::TEXT_ARRAY),(&after,Type::INT8)])?;
                        if !settings_policy::delivery_authorized(row.get::<_,bool>(0)) {
                            return Ok::<_,ApiError>(Some((after+1,json!({"streamId":user,"eventId":Uuid::new_v4(),"occurredAt":Utc::now().to_rfc3339(),"correlationId":Uuid::new_v4(),"payloadVersion":"v1","payload":{"type":"permission_revoked","objectId":current}}),true)));
                        }
                        Ok(row.get::<_,Option<i64>>(1).map(|sequence| {
                            let mut event:Value=row.get(2);
                            let terminal=event["payload"]["objectId"].as_str()==Some(current.to_string().as_str());
                            if terminal {event["payload"]["type"]=json!("permission_revoked");}
                            (sequence,event,terminal)
                        }))
                    }
                }).await;
                match result {
                    Ok(Ok(Some((sequence, mut event, terminal)))) => {
                        event["sequence"] = json!(sequence);
                        return Some((
                            Ok::<_, std::convert::Infallible>(format!("data: {event}\n\n")),
                            (client, context, session, current, sequence, terminal),
                        ));
                    }
                    Ok(Ok(None)) => tokio::time::sleep(std::time::Duration::from_secs(1)).await,
                    _ => return None,
                }
            }
        },
    );
    let mut response = Response::new(Body::from_stream(stream));
    response
        .headers_mut()
        .insert("content-type", "text/event-stream".parse().unwrap());
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().unwrap());
    response.headers_mut().insert(
        "x-correlation-id",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    Ok(response)
}

// MFA endpoints below use the real Supabase factor API and durable challenge/grant records.

pub(super) struct SupabaseMfa {
    base: url::Url,
    key: String,
    client: reqwest::blocking::Client,
}
impl SupabaseMfa {
    pub fn new(project: &str, key: String) -> anyhow::Result<Self> {
        Ok(Self {
            base: url::Url::parse(project)?.join("/auth/v1/")?,
            key,
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()?,
        })
    }
    fn request(
        &self,
        token: &str,
        method: reqwest::Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Value, ApiError> {
        let url = self.base.join(path).map_err(|_| ApiError::unavailable())?;
        let mut request = self
            .client
            .request(method, url)
            .header("apikey", &self.key)
            .bearer_auth(token);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().map_err(|_| ApiError::unavailable())?;
        if !response.status().is_success() {
            let status = match response.status().as_u16() {
                401 => StatusCode::UNAUTHORIZED,
                403 => StatusCode::FORBIDDEN,
                404 => StatusCode::NOT_FOUND,
                429 => StatusCode::TOO_MANY_REQUESTS,
                400 | 422 => StatusCode::UNPROCESSABLE_ENTITY,
                _ => StatusCode::SERVICE_UNAVAILABLE,
            };
            let mut error = ApiError::new(
                status,
                if status == StatusCode::TOO_MANY_REQUESTS {
                    "RATE_LIMITED"
                } else {
                    "MFA_UNAVAILABLE"
                },
            );
            if status == StatusCode::TOO_MANY_REQUESTS {
                error.details = json!({"retryAfter":60});
            }
            return Err(error); // Never expose upstream response, credentials or enrollment material.
        }
        if response.status().as_u16() == 204 {
            return Ok(Value::Null);
        }
        response.json().map_err(|_| ApiError::unavailable())
    }
    pub fn user(&self, token: &str) -> Result<Value, ApiError> {
        self.request(token, reqwest::Method::GET, "user", None)
    }
    fn factors(&self, token: &str) -> Result<Vec<Value>, ApiError> {
        settings_policy::factors_from_user(&self.user(token)?)
    }
    fn challenge(&self, token: &str, factor: Uuid) -> Result<Value, ApiError> {
        self.request(
            token,
            reqwest::Method::POST,
            &format!("factors/{factor}/challenge"),
            Some(json!({})),
        )
    }
    fn verify(
        &self,
        token: &str,
        factor: Uuid,
        challenge: Uuid,
        code: &str,
    ) -> Result<Value, ApiError> {
        self.request(
            token,
            reqwest::Method::POST,
            &format!("factors/{factor}/verify"),
            Some(json!({"challenge_id":challenge,"code":code})),
        )
    }
}
fn proof(state: &LiveState, session: &str) -> Result<String, ApiError> {
    let mut proofs = state.proofs.lock().map_err(|_| ApiError::unavailable())?;
    proofs.retain(|_, p| p.expires_at > Utc::now());
    proofs
        .get(session)
        .map(|p| p.token.clone())
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "AUTH_REFRESH_REQUIRED"))
}
fn uuid(value: &Value) -> Result<Uuid, ApiError> {
    value
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(ApiError::unavailable)
}

async fn security(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    let value=tokio::task::spawn_blocking(move||{
        let token=proof(&state,&session)?;let user=state.mfa.user(&token)?;let factors=settings_policy::factors_from_user(&user)?;
        let mfa_at=state.a2.lock().map_err(|_|ApiError::unavailable())?.client.query_one("select max(created_at) from quantos.bff_settings_audits where user_id=$1 and action='mfa.verify'", &[&context.user_id])?.get::<_,Option<DateTime<Utc>>>(0);
        let last_verified=settings_policy::last_verified_at(&user,mfa_at)?;
        let verified=factors.iter().filter(|f|f["status"]=="verified").collect::<Vec<_>>();
        let payload_factors=verified.iter().filter(|f|matches!(f["factor_type"].as_str(),Some("totp"|"webauthn"))).map(|f|json!({"factorId":f["id"],"method":if f["factor_type"]=="webauthn"{"passkey"}else{"authenticator"},"label":f["friendly_name"].as_str().unwrap_or("MFA"),"createdAt":f["created_at"],"lastUsedAt":f["updated_at"],"currentDevice":false})).collect::<Vec<_>>();
        let mut payload=json!({"posture":if verified.is_empty(){"attention_required"}else{"strong"},"score":if verified.is_empty(){50}else{90},"mfaEnabled":!verified.is_empty(),"factors":payload_factors,"recoveryCodesRemaining":0,"lastVerifiedAt":last_verified.to_rfc3339(),"correlationId":Uuid::new_v4(),"availableMfaMethods":["authenticator"]});
        if verified.is_empty(){
            let mut store=state.a2.lock().map_err(|_|ApiError::unavailable())?;
            if let Some(row)=store.client.query_opt("select grant_ref from quantos.bff_reauth_grants where session_hash=$1 and scope='first_factor' and expires_at>now() order by expires_at desc limit 1", &[&session])?{payload["firstFactorSetupRef"]=json!(row.get::<_,Uuid>(0));}
        }
        Ok::<_,ApiError>(payload)
    }).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(value))
}

#[derive(serde::Deserialize)]
struct ChallengeInput {
    purpose: String,
    code: Option<String>,
}
async fn challenge(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
    Json(input): Json<ChallengeInput>,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    let value=tokio::task::spawn_blocking(move||{
        let token=proof(&state,&session)?;
        state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(context.user_id,|store|{
            store.client.execute("insert into quantos.bff_mfa_windows(user_id,started_at) values($1,now()) on conflict(user_id) do update set started_at=case when bff_mfa_windows.started_at<=now()-interval '60 seconds' then now() else bff_mfa_windows.started_at end,failures=case when bff_mfa_windows.started_at<=now()-interval '60 seconds' then 0 else bff_mfa_windows.failures end", &[&context.user_id])?;
            let window=store.client.query_one("select failures,greatest(1,ceil(extract(epoch from started_at+interval '60 seconds'-now())))::bigint from quantos.bff_mfa_windows where user_id=$1", &[&context.user_id])?;
            if window.get::<_,i32>(0)>=5{return Err(ApiError{status:StatusCode::TOO_MANY_REQUESTS,code:"RATE_LIMITED",details:json!({"retryAfter":window.get::<_,i64>(1)})});}
            let pending=store.client.query_opt("select challenge_ref,factor_id,upstream_challenge from quantos.bff_auth_challenges where user_id=$1 and session_hash=$2 and purpose=$3 and expires_at>now() and verified_at is null and not consumed order by expires_at desc limit 1", &[&context.user_id,&session,&input.purpose])?;
            let (reference,factor,upstream)=if let Some(row)=pending{(row.get::<_,Uuid>(0),row.get::<_,Uuid>(1),row.get::<_,Uuid>(2))}else{
                let factors=state.mfa.factors(&token)?;
                let factor=factors.iter().find(|f|f["factor_type"]=="totp" && f["status"]=="verified").or_else(||factors.iter().find(|f|f["factor_type"]=="totp" && f["status"]=="unverified")).ok_or_else(||ApiError::new(StatusCode::FORBIDDEN,"MFA_NOT_ENROLLED"))?;
                let factor_id=uuid(&factor["id"])?;let upstream=uuid(&state.mfa.challenge(&token,factor_id)?["id"])?;let reference=Uuid::new_v4();
                store.client.execute("insert into quantos.bff_auth_challenges(challenge_ref,user_id,session_hash,purpose,factor_id,upstream_challenge,expires_at) values($1,$2,$3,$4,$5,$6,$7)", &[&reference,&context.user_id,&session,&input.purpose,&factor_id,&upstream,&settings_policy::challenge_expiry(Utc::now())])?;(reference,factor_id,upstream)
            };
            let mut status="pending";let correlation=Uuid::new_v4();
            if let Some(code)=input.code{
                match state.mfa.verify(&token,factor,upstream,&code){
                    Ok(verified)=>{
                        let new_token=verified["access_token"].as_str().ok_or_else(ApiError::unavailable)?;
                        // Auth server validated the code; bind its exact verified identity before retaining new proof.
                        let verified_user=state.verifier.verify_access_token(new_token).map_err(|_|ApiError::new(StatusCode::FORBIDDEN,"MFA_UNAVAILABLE"))?;
                        if !verified_user.mfa_verified(){return Err(ApiError::new(StatusCode::FORBIDDEN,"MFA_UNAVAILABLE"));}
                        let mut middleware=state.middleware.lock().map_err(|_|ApiError::unavailable())?;
                        let checked=middleware.load_access_token_context(&state.verifier,new_token,None).map_err(|e|ApiError::new(auth_status(e),"MFA_UNAVAILABLE"))?;
                        if checked.actor_id!=context.auth.actor_id{return Err(ApiError::new(StatusCode::FORBIDDEN,"FORBIDDEN"));}
                        state.proofs.lock().map_err(|_|ApiError::unavailable())?.insert(session.clone(),AuthProof{token:new_token.to_owned(),expires_at:context.expires_at});
                        let mut tx=store.client.transaction()?;
                        tx.execute("update quantos.bff_auth_challenges set verified_at=now() where challenge_ref=$1", &[&reference])?;
                        tx.execute("update quantos.bff_sessions set mfa_verified=true where session_hash=$1", &[&session])?;
                        tx.execute("update quantos.bff_devices set trusted=true where device_id=(select device_id from quantos.bff_session_details where session_hash=$1)", &[&session])?;
                        audit(&mut tx,&context,"mfa.verify",&factor.to_string(),&json!({"correlationId":correlation}))?;tx.commit()?;status="verified";
                    },
                    Err(error) if matches!(error.status,StatusCode::UNPROCESSABLE_ENTITY|StatusCode::FORBIDDEN)=>{
                        let row=store.client.query_one("update quantos.bff_mfa_windows set failures=failures+1 where user_id=$1 returning failures", &[&context.user_id])?;
                        if row.get::<_,i32>(0)>=5{return Err(ApiError{status:StatusCode::TOO_MANY_REQUESTS,code:"RATE_LIMITED",details:json!({"retryAfter":60})});}status="failed";
                    },
                    Err(error)=>return Err(error),
                }
            }
            Ok(json!({"challengeRef":reference,"status":status,"_correlationId":correlation}))
        })
    }).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(value))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReauthInput {
    challenge_ref: Uuid,
}
async fn reauth(
    identity: axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    _headers: HeaderMap,
    Json(input): Json<ReauthInput>,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    let value=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(context.user_id,|store|{
        let mut tx=store.client.transaction()?;
        let row=tx.query_opt("update quantos.bff_auth_challenges set consumed=true where challenge_ref=$1 and user_id=$2 and session_hash=$3 and purpose in ('login','security_change') and not consumed and expires_at>now() and verified_at>now()-interval '5 minutes' returning least(expires_at,verified_at+interval '5 minutes')", &[&input.challenge_ref,&context.user_id,&session])?.ok_or_else(||ApiError::new(StatusCode::FORBIDDEN,"MFA_NOT_VERIFIED"))?;
        let expiry:DateTime<Utc>=row.get(0);let grant=Uuid::new_v4();tx.execute("insert into quantos.bff_reauth_grants(grant_ref,session_hash,expires_at,scope) values($1,$2,$3,'security')", &[&grant,&session,&expiry])?;
        let correlation=Uuid::new_v4();audit(&mut tx,&context,"auth.reauth",&input.challenge_ref.to_string(),&json!({"correlationId":correlation}))?;tx.commit()?;Ok(json!({"reauthTokenRef":grant,"expiresAt":expiry.to_rfc3339(),"_correlationId":correlation}))
    })).await.map_err(|_|ApiError::unavailable())??;
    Ok(respond(value))
}

async fn mfa_command(
    identity: axum::Extension<TrustedIdentity>,
    state: Arc<LiveState>,
    headers: HeaderMap,
    resource: String,
    input: Value,
    enroll: bool,
) -> Result<Response, ApiError> {
    let axum::Extension(TrustedIdentity(context, session)) = identity;
    let key = command_key(&headers)?;
    let operation = if enroll {
        "setupMfa"
    } else {
        "revokeMfaFactor"
    };
    let payload=tokio::task::spawn_blocking(move||{
        state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(context.user_id,|store|{
            let intent=json!([resource,input]);
            let mut tx=store.client.transaction()?;
            if let Some(mut payload)=replay(&mut tx,context.user_id,operation,key,&intent)?{
                let policy=if !enroll && payload["_authOperation"]=="cancelUnverifiedMfa"{"cancelUnverifiedMfa"}else{operation};
                recent(&mut tx,&session,&headers,policy)?;
                payload.as_object_mut().unwrap().remove("_authOperation");
                tx.commit()?;return Ok(payload);
            }
            let pending=tx.query_opt("select response from quantos.bff_security_commands where user_id=$1 and operation=$2 and idempotency_key=$3", &[&context.user_id,&operation,&key])?.map(|r|r.get::<_,Value>(0));
            tx.commit()?;
            let token=proof(&state,&session)?;
            let factors=state.mfa.factors(&token)?;
            // Persist the narrow authorization policy with the checkpoint: the
            // upstream factor may already be absent when cancellation is retried.
            let current_factor=factors.iter().find(|f|f["id"]==resource);
            let auth_operation=if enroll{operation}else{settings_policy::cancellation_policy(current_factor,pending.as_ref().is_some_and(|p|p["_authOperation"]=="cancelUnverifiedMfa"))};
            let enrollment_name=pending.as_ref().map(|p|format!("QuantOS-{}",p["jobId"].as_str().unwrap()));
            let recovering_existing=enrollment_name.as_ref().is_some_and(|name|factors.iter().any(|f|f["friendly_name"]==*name));
            let mut tx=store.client.transaction()?;
            let scope=recent(&mut tx,&session,&headers,auth_operation)?;
            if enroll{settings_policy::authorize_enrollment(&scope,&factors,recovering_existing)?;}
            let mut payload=pending.unwrap_or_else(accepted);
            payload["_authOperation"]=json!(auth_operation);
            tx.execute("insert into quantos.bff_security_commands(user_id,operation,idempotency_key,intent,response) values($1,$2,$3,$4,$5) on conflict(user_id,operation,idempotency_key) do nothing", &[&context.user_id,&operation,&key,&intent,&payload])?;
            tx.commit()?;
            let mut output=payload.clone();
            if enroll {
                if input["method"]!="authenticator"{return Err(ApiError::new(StatusCode::UNPROCESSABLE_ENTITY,"MFA_METHOD_UNAVAILABLE"));}
                let name=format!("QuantOS-{}",payload["jobId"].as_str().unwrap());
                if let Some(existing)=factors.iter().find(|f|f["friendly_name"]==name){
                    output["mfaEnrollment"]=json!({"factorRef":existing["id"],"delivery":"restart_required"});
                } else {
                    let enrolled=state.mfa.request(&token,reqwest::Method::POST,"factors",Some(json!({"factor_type":"totp","friendly_name":name})))?;
                    output["mfaEnrollment"]=json!({"factorRef":enrolled["id"],"delivery":"one_time","uri":enrolled["totp"]["uri"]});
                }
            } else {
                let factor=Uuid::parse_str(&resource).map_err(|_|ApiError::new(StatusCode::NOT_FOUND,"NOT_FOUND"))?;
                if let Some(existing)=factors.iter().find(|f|f["id"]==resource){
                    settings_policy::protect_last_factor(&factors,existing)?;
                    store.client.execute("update quantos.bff_security_commands set upstream_started=true where user_id=$1 and operation=$2 and idempotency_key=$3", &[&context.user_id,&operation,&key])?;
                    state.mfa.request(&token,reqwest::Method::DELETE,&format!("factors/{factor}"),None)?;
                } else {
                    let started=store.client.query_one("select upstream_started from quantos.bff_security_commands where user_id=$1 and operation=$2 and idempotency_key=$3", &[&context.user_id,&operation,&key])?.get::<_,bool>(0);
                    if !started{return Err(ApiError::new(StatusCode::NOT_FOUND,"NOT_FOUND"));}
                }
            }
            let mut stored=output.clone();
            if let Some(enrollment)=stored.get_mut("mfaEnrollment"){
                enrollment.as_object_mut().unwrap().remove("uri");
                enrollment["delivery"]=json!("restart_required");
            }
            let mut tx=store.client.transaction()?;
            save_command(&mut tx,context.user_id,operation,key,&intent,&stored)?;
            audit(&mut tx,&context,operation,&resource,&payload)?;
            tx.commit()?;
            output.as_object_mut().unwrap().remove("_authOperation");
            Ok(output)
        })
    }).await.map_err(|_|ApiError::unavailable())??;
    let correlation = payload["correlationId"].as_str().unwrap().to_owned();
    Ok(crate::response(StatusCode::ACCEPTED, payload, &correlation))
}

async fn setup_mfa(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Json(v): Json<Value>,
) -> Result<Response, ApiError> {
    mfa_command(identity, s, h, "mfa".to_owned(), v, true).await
}
async fn revoke_factor(
    identity: axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    h: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    mfa_command(identity, s, h, id, Value::Null, false).await
}

async fn access_request(
    State(state): State<Arc<LiveState>>,
    axum::extract::ConnectInfo(peer): axum::extract::ConnectInfo<std::net::SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Result<Response, ApiError> {
    require_origin(&headers, &state.terminal_origin).map_err(|s| ApiError::new(s, "FORBIDDEN"))?;
    let source = hash(&format!("{}:{}", state.terminal_origin, peer.ip()));
    let payload=tokio::task::spawn_blocking(move||{
        let mut store=state.a2.lock().map_err(|_|ApiError::unavailable())?;
        // Advisory source lock keeps the anonymous rate limit atomic across instances.
        store.client.query_one("select pg_advisory_lock(hashtextextended($1,3))", &[&source])?;
        let result=(||{
            let mut tx=store.client.transaction()?;
            let n:i64=tx.query_one("select count(*) from quantos.bff_access_requests where source_hash=$1 and created_at>now()-interval '60 seconds'", &[&source])?.get(0);
            if n>=5{return Err(ApiError{status:StatusCode::TOO_MANY_REQUESTS,code:"RATE_LIMITED",details:json!({"retryAfter":60})});}
            let payload=accepted();let request=uuid(&payload["jobId"])?;let audit=uuid(&payload["auditRef"])?;let correlation=uuid(&payload["correlationId"])?;
            tx.execute("insert into quantos.bff_access_requests(request_id,request,source_hash) values($1,$2,$3)", &[&request,&input,&source])?;
            tx.execute("insert into quantos.bff_settings_audits(audit_ref,action,object_ref,correlation_id) values($1,'access.request',$2,$3)", &[&audit,&request.to_string(),&correlation])?;tx.commit()?;Ok(payload)
        })();
        store.client.query_one("select pg_advisory_unlock(hashtextextended($1,3))", &[&source])?;result
    }).await.map_err(|_|ApiError::unavailable())??;
    let correlation = payload["correlationId"].as_str().unwrap().to_owned();
    Ok(crate::response(StatusCode::ACCEPTED, payload, &correlation))
}

pub(super) async fn guard(
    State(state): State<Arc<LiveState>>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let mut request = request;
    if let Some(operation) =
        crate::input_contract::operation(request.method().as_str(), request.uri().path())
    {
        let write = matches!(
            request.method().as_str(),
            "POST" | "PUT" | "DELETE" | "PATCH"
        );
        if operation["authenticated"] == true {
            match authorized(state, request.headers().clone(), write).await {
                Ok((context, session)) => {
                    request
                        .extensions_mut()
                        .insert(TrustedIdentity(context, session));
                }
                Err(error) => return error.into_response(),
            }
        }
        match crate::input_contract::validate_request(request, operation).await {
            Ok(valid) => request = valid,
            Err(error) => return error,
        }
    }
    next.run(request).await
}

impl A2Store {
    pub fn bootstrap(
        &mut self,
        raw: &str,
        context: &BffSessionContext,
        token: &str,
        user: &Value,
    ) -> Result<(), ApiError> {
        use base64::Engine;
        let has_factor = user["factors"]
            .as_array()
            .is_some_and(|f| f.iter().any(|factor| factor["status"] == "verified"));
        if has_factor {
            return Ok(());
        }
        let claims = token
            .split('.')
            .nth(1)
            .and_then(|value| {
                base64::engine::general_purpose::URL_SAFE_NO_PAD
                    .decode(value)
                    .ok()
            })
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
            .ok_or_else(ApiError::unavailable)?;
        let fresh = claims["amr"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|method| method["timestamp"].as_i64())
            .filter_map(|at| DateTime::<Utc>::from_timestamp(at, 0))
            .filter(|at| {
                *at > Utc::now() - Duration::minutes(5) && *at <= Utc::now() + Duration::seconds(30)
            })
            .max();
        if let Some(at) = fresh {
            self.client.execute("insert into quantos.bff_reauth_grants(grant_ref,session_hash,expires_at,scope) values($1,$2,$3,'first_factor')", &[&Uuid::new_v4(),&hash(raw),&(at+Duration::minutes(5)).min(context.expires_at)])?;
        }
        Ok(())
    }
}
