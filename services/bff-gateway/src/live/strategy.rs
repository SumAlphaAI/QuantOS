//! F06 verified owner adapter; absent host is 503, never fixture fallback.
use super::{
    LiveState,
    settings::{self, TrustedIdentity},
};
use crate::research::{Fault, Result};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post, put},
};
use chrono::Utc;
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
pub(super) fn routes() -> Router<Arc<LiveState>> {
    crate::strategy::routes(get(handle), post(handle), put(handle))
}
async fn handle(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    m: Method,
    h: HeaderMap,
    bytes: Bytes,
) -> std::result::Result<Response, settings::ApiError> {
    let host = state
        .strategy
        .clone()
        .ok_or_else(settings::ApiError::unavailable)?;
    let body: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).map_err(|_| {
            settings::ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST")
        })?
    };
    let error_host = host.clone();
    let error_auth = identity.0.auth.clone();
    let error_path = body["strategyId"]
        .as_str()
        .map(|id| format!("/v1/strategies/{id}/draft"))
        .unwrap_or_else(|| uri.path().to_owned());
    let result = tokio::task::spawn_blocking(move || -> Result<(StatusCode, Value)> {
        let mut host = host.lock().map_err(|_| Fault::unavailable())?;
        if m == Method::GET {
            return host.handle(
                &identity.0.auth,
                &identity.1,
                &m,
                uri.path(),
                &q,
                &h,
                &body,
                None,
                Utc::now(),
            );
        }
        let mut db = state.a2.lock().map_err(|_| Fault::unavailable())?;
        let mut tx = db.client.transaction().map_err(|_| Fault::unavailable())?;
        let (s, v) = host.handle(
            &identity.0.auth,
            &identity.1,
            &m,
            uri.path(),
            &q,
            &h,
            &body,
            None,
            Utc::now(),
        )?;
        if super::audit::execution_log(
            &mut tx,
            &identity,
            uri.path(),
            &v,
            &json!({"reason":"strategy controlled mutation"}),
        )
        .is_err()
            || tx.commit().is_err()
        {
            host.poisoned = true;
            return Err(Fault::unavailable());
        }
        Ok((s, v))
    })
    .await
    .map_err(|_| settings::ApiError::unavailable())?;
    result
        .map(|(s, v)| crate::execution::output(s, v))
        .map_err(|e| {
            let mut error = settings::ApiError::new(e.0, e.1);
            if e.1 == "VERSION_CONFLICT"
                && let Some(d) = error_host
                    .lock()
                    .ok()
                    .and_then(|s| s.current(&error_auth, &error_path))
            {
                error.details = json!({"currentVersion":d["objectVersion"]});
                if d.get("files").is_some() {
                    error.details["conflictDiff"] =
                        json!({"files":d["files"],"parameters":d["parameters"]});
                }
            }
            if e.0 == StatusCode::TOO_MANY_REQUESTS {
                error.details = json!({"retryAfter":60});
            }
            error
        })
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn approval(
    identity: TrustedIdentity,
    state: Arc<LiveState>,
    path: String,
    q: BTreeMap<String, String>,
    m: Method,
    h: HeaderMap,
    bytes: Bytes,
) -> std::result::Result<Response, settings::ApiError> {
    let host = state
        .strategy
        .clone()
        .ok_or_else(settings::ApiError::unavailable)?;
    let body: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).map_err(|_| {
            settings::ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST")
        })?
    };
    let error_host = host.clone();
    let error_auth = identity.0.auth.clone();
    let error_path = path.clone();
    let result=tokio::task::spawn_blocking(move||->Result<(StatusCode,Value)>{let mut service=host.lock().map_err(|_|Fault::unavailable())?;if m==Method::GET{return service.handle(&identity.0.auth,&identity.1,&m,&path,&q,&h,&body,None,Utc::now())}let mut consumed=state.consumed_step_proofs.lock().map_err(|_|Fault::unavailable())?;let mut db=state.a2.lock().map_err(|_|Fault::unavailable())?;let mut tx=db.client.transaction().map_err(|_|Fault::unavailable())?;
 let challenge=body["mfaChallengeRef"].as_str().and_then(|s|uuid::Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"MFA_NOT_VERIFIED"))?;let grant=body["reauthTokenRef"].as_str().and_then(|s|uuid::Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"RECENT_AUTH_REQUIRED"))?;
 let valid=tx.query_opt("select c.challenge_ref from quantos.bff_auth_challenges c join quantos.bff_reauth_grants g on g.session_hash=c.session_hash where c.challenge_ref=$1 and c.user_id=$2 and c.session_hash=$3 and c.consumed and c.verified_at>now()-interval '5 minutes' and c.expires_at>now() and g.grant_ref=$4 and g.scope='security' and g.expires_at>now() for update of c,g", &[&challenge,&identity.0.user_id,&identity.1,&grant]).map_err(|_|Fault::unavailable())?;
 let proof=valid.map(|_|format!("{}:{grant}",identity.1)).filter(|p|!consumed.contains(p));let used=proof.clone();let(s,v)=service.handle(&identity.0.auth,&identity.1,&m,&path,&q,&h,&body,proof,Utc::now())?;
 if super::audit::execution_log(&mut tx,&identity,&path,&v,&json!({"decision":body["decision"]})).is_err()||tx.commit().is_err(){service.poisoned=true;return Err(Fault::unavailable())}
 if let Some(proof)=used{consumed.insert(proof);}Ok((s,v))}).await.map_err(|_|settings::ApiError::unavailable())?;
    result
        .map(|(s, v)| crate::execution::output(s, v))
        .map_err(|e| {
            let mut error = settings::ApiError::new(e.0, e.1);
            if e.1 == "VERSION_CONFLICT"
                && let Some(v) = error_host
                    .lock()
                    .ok()
                    .and_then(|s| s.current(&error_auth, &error_path))
            {
                error.details = json!({"currentVersion":v["objectVersion"]});
            }
            error
        })
}
