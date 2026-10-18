//! F06 caller remains unchanged. Both process-local leases are owner supplied.
use super::{
    LiveState,
    settings::{self, TrustedIdentity},
};
use crate::research::{Fault, Result};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method},
    response::Response,
    routing::{get, post},
};
use chrono::Utc;
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
pub(super) fn routes() -> Router<Arc<LiveState>> {
    crate::performance::routes(get(handle), post(handle))
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
    let performance = state
        .performance
        .clone()
        .ok_or_else(settings::ApiError::unavailable)?;
    let reconciliation = state
        .reconciliation
        .clone()
        .ok_or_else(settings::ApiError::unavailable)?;
    let b: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).map_err(|_| {
            settings::ApiError::new(
                axum::http::StatusCode::UNPROCESSABLE_ENTITY,
                "INVALID_REQUEST",
            )
        })?
    };
    tokio::task::spawn_blocking(move || -> Result<_> {
        let mut p = performance.lock().map_err(|_| Fault::unavailable())?;
        let mut r = reconciliation.lock().map_err(|_| Fault::unavailable())?;
        if m == Method::GET {
            return p.handle(
                &identity.0.auth,
                &identity.1,
                &m,
                uri.path(),
                &q,
                &h,
                &b,
                &mut r,
                Utc::now(),
            );
        }
        let mut db = state.a2.lock().map_err(|_| Fault::unavailable())?;
        let mut tx = db.client.transaction().map_err(|_| Fault::unavailable())?;
        let (s, v) = p.handle(
            &identity.0.auth,
            &identity.1,
            &m,
            uri.path(),
            &q,
            &h,
            &b,
            &mut r,
            Utc::now(),
        )?;
        if super::audit::execution_log(
            &mut tx,
            &identity,
            uri.path(),
            &v,
            &json!({"reason":"frozen X01/C15 performance report"}),
        )
        .is_err()
            || tx.commit().is_err()
        {
            p.poisoned = true;
            return Err(Fault::unavailable());
        }
        Ok((s, v))
    })
    .await
    .map_err(|_| settings::ApiError::unavailable())?
    .map(|(s, v)| crate::performance::output(s, v))
    .map_err(|e| {
        let mut error = settings::ApiError::new(e.0, e.1);
        if e.0 == axum::http::StatusCode::TOO_MANY_REQUESTS {
            error.details = json!({"retryAfter":60})
        }
        error
    })
}
