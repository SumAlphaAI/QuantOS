//! F06 verified identity; trusted X05 lease is supplied only by the service owner.
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
pub(super) fn routes() -> Router<Arc<LiveState>> {
    crate::reconciliation::routes(get(handle), post(handle))
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
        .reconciliation
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
    let error_auth = identity.0.auth.clone();
    let error_path = uri.path().to_owned();
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
                &b,
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
            &b,
            Utc::now(),
        )?;
        if super::audit::execution_log(
            &mut tx,
            &identity,
            uri.path(),
            &v,
            &json!({"reason":"trusted X05 re-evaluation; no ledger edit"}),
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
            if e.0 == StatusCode::TOO_MANY_REQUESTS {
                error.details = json!({"retryAfter":60});
            }
            if e.1 == "VERSION_CONFLICT"
                && let Some(version) = error_host
                    .lock()
                    .ok()
                    .and_then(|s| s.current_version(&error_auth, &error_path))
            {
                error.details = json!({"currentVersion":version});
            }
            error
        })
}
