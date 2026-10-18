//! Verified F06 identity only. No fixed-cookie or synthetic fallback is reachable.
//! Default live startup leaves this host absent until an owned Paper lease is
//! explicitly composed. Target persistence/restart admission remains separate.
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
    routing::{get, post},
};
use chrono::Utc;
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

pub(super) fn routes() -> Router<Arc<LiveState>> {
    crate::execution::routes(get(handle), post(handle))
}
async fn handle(
    axum::Extension(TrustedIdentity(context, session)): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    bytes: Bytes,
) -> std::result::Result<Response, settings::ApiError> {
    if uri.path().starts_with("/v1/approvals/")
        && uri
            .path()
            .split('/')
            .nth(3)
            .and_then(|s| Uuid::parse_str(s).ok())
            .is_some_and(|id| {
                state
                    .strategy
                    .as_ref()
                    .is_some_and(|s| s.lock().is_ok_and(|h| h.owns_approval(id)))
            })
    {
        return super::strategy::approval(
            TrustedIdentity(context, session),
            state,
            uri.path().to_owned(),
            q,
            method,
            headers,
            bytes,
        )
        .await;
    }
    // Authenticated unsupported host is unavailable, never a successful empty page.
    let host = state
        .execution
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
    let resource_path = uri.path().to_owned();
    let result=tokio::task::spawn_blocking(move||->Result<(StatusCode,Value)>{
        let mut service=host.lock().map_err(|_|Fault::unavailable())?;
        service.linked_approvals=state.strategy.as_ref().and_then(|s|s.lock().ok()).map(|s|s.approvals(&context.auth,Utc::now())).unwrap_or_default();
        if method!=Method::POST {return service.handle(&context.auth,&session,&method,uri.path(),&q,&headers,&body,None,Utc::now())}
        // Same host mutex serializes proof reservation, domain mutation and response
        // publication. A failed database commit quarantines the lease. A replacement
        // process cannot mount this lease without the separate recovery admission.
        let mut consumed=state.consumed_step_proofs.lock().map_err(|_|Fault::unavailable())?;
        let mut store=state.a2.lock().map_err(|_|Fault::unavailable())?;
        let mut tx=store.client.transaction().map_err(|_|Fault::unavailable())?;
        let privileged=uri.path().contains("kill-switch")||uri.path().ends_with("/decisions");
        let proof=if privileged {
            let challenge=body["mfaChallengeRef"].as_str().and_then(|s|Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"MFA_NOT_VERIFIED"))?;
            let grant=body["reauthTokenRef"].as_str().and_then(|s|Uuid::parse_str(s).ok()).ok_or(Fault(StatusCode::FORBIDDEN,"RECENT_AUTH_REQUIRED"))?;
            // A2 reauth has already consumed this verified challenge to mint the
            // recent-auth grant. Host additionally consumes the proof tuple once;
            // retry of the exact successful HTTP intent is replayed before reuse.
            let valid=tx.query_opt("select c.challenge_ref from quantos.bff_auth_challenges c join quantos.bff_reauth_grants g on g.session_hash=c.session_hash where c.challenge_ref=$1 and c.user_id=$2 and c.session_hash=$3 and c.consumed and c.verified_at>now()-interval '5 minutes' and c.expires_at>now() and g.grant_ref=$4 and g.scope='security' and g.expires_at>now() for update of c,g", &[&challenge,&context.user_id,&session,&grant]).map_err(|_|Fault::unavailable())?;
            if valid.is_none(){None}else{Some(format!("{session}:{grant}"))}
        }else{None};
        let proof=proof.filter(|p|!consumed.contains(p));let used=proof.clone();
        let input_details=json!({"reason":body["reason"],"decision":body["decision"]});
        let (status,body)=service.handle(&context.auth,&session,&method,uri.path(),&q,&headers,&body,proof,Utc::now())?;
        if super::audit::execution_log(&mut tx,&TrustedIdentity(context.clone(),session.clone()),uri.path(),&body,&input_details).is_err()||tx.commit().is_err(){service.poisoned=true;return Err(Fault::unavailable())}
        if let Some(proof)=used{consumed.insert(proof);}
        Ok((status,body))
    }).await.map_err(|_|settings::ApiError::unavailable())?;
    result
        .map(|(s, v)| crate::execution::output(s, v))
        .map_err(|e|{let mut error=settings::ApiError::new(e.0,e.1);if e.1=="VERSION_CONFLICT"{error.details=json!({"currentVersion":error_host.lock().ok().and_then(|s|s.current_version(&resource_path))});}error})
}
