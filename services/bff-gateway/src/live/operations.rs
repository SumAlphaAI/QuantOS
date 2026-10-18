//! Explicit process-local X06/governance lease. F06 remains the authority ceiling;
//! recent authentication is checked against the existing A2 verified grants.
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
    routing::{delete, get, post, put},
};
use chrono::Utc;
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;
pub(super) fn routes() -> Router<Arc<LiveState>> {
    crate::operations::routes(get(handle), post(handle), put(handle), delete(handle))
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
        .operations
        .clone()
        .ok_or_else(settings::ApiError::unavailable)?;
    let b: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).map_err(|_| {
            settings::ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST")
        })?
    };
    let error_host = host.clone();
    let error_a = identity.0.auth.clone();
    let error_path = uri.path().to_owned();
    tokio::task::spawn_blocking(move||->Result<_>{let mut host=host.lock().map_err(|_|Fault::unavailable())?;
  if m==Method::GET{return host.handle(&identity.0.auth,&identity.1,&m,uri.path(),&q,&h,&b,None,Utc::now())}
  let mut store=state.a2.lock().map_err(|_|Fault::unavailable())?;let mut tx=store.client.transaction().map_err(|_|Fault::unavailable())?;
  let proof=if uri.path()=="/v1/alerts/subscriptions"{None}else{
   let challenge=b["mfaChallengeRef"].as_str().and_then(|s|Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"RECENT_AUTH_REQUIRED"))?;
   let grant=b["reauthTokenRef"].as_str().and_then(|s|Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"RECENT_AUTH_REQUIRED"))?;
   let row=tx.query_opt("select c.verified_at,c.expires_at,g.expires_at from quantos.bff_auth_challenges c join quantos.bff_reauth_grants g on g.session_hash=c.session_hash where c.challenge_ref=$1 and c.user_id=$2 and c.session_hash=$3 and c.consumed and c.verified_at>now()-interval '5 minutes' and c.expires_at>now() and g.grant_ref=$4 and g.scope='security' and g.expires_at>now() for update of c,g",&[&challenge,&identity.0.user_id,&identity.1,&grant]).map_err(|_|Fault::unavailable())?;
   row.and_then(|row|quantos_operations::VerifiedStepUp::from_verified_session(&identity.0.auth,row.get(0),row.get::<_,chrono::DateTime<Utc>>(1).min(row.get(2))).ok())
  };
  let(s,v)=host.handle(&identity.0.auth,&identity.1,&m,uri.path(),&q,&h,&b,proof,Utc::now())?;
  if super::audit::execution_log(&mut tx,&identity,uri.path(),&v,&json!({"reason":b["reason"]})).is_err()||tx.commit().is_err(){host.poisoned=true;return Err(Fault::unavailable())}Ok((s,v))
 }).await.map_err(|_|settings::ApiError::unavailable())?.map(|(s,v)|crate::operations::output(s,v)).map_err(|e|{let mut out=settings::ApiError::new(e.0,e.1);if e.0==StatusCode::TOO_MANY_REQUESTS{out.details=json!({"retryAfter":60})}
if e.1=="VERSION_CONFLICT"{out.details=json!({"currentVersion":error_host.lock().ok().and_then(|h|h.current_version(&error_path,&error_a))});}out})
}
