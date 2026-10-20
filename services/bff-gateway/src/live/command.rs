//! Authenticated bounded read composition. No reference seed or mutation path.
use super::{
    LiveState,
    settings::{self, TrustedIdentity},
};
use crate::{
    command::{self, unavailable},
    research::{Fault, Result},
};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::get,
};
use chrono::Utc;
use std::{collections::BTreeMap, sync::Arc};
pub(super) fn routes() -> Router<Arc<LiveState>> {
    command::routes(get(handle))
}
async fn handle(
    axum::Extension(TrustedIdentity(c, session)): axum::Extension<TrustedIdentity>,
    State(s): State<Arc<LiveState>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    h: HeaderMap,
    body: Bytes,
) -> std::result::Result<Response, settings::ApiError> {
    if !body.is_empty() {
        return Err(settings::ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "INVALID_REQUEST",
        ));
    }
    command::authorize(&c.auth, &q).map_err(|e| settings::ApiError::new(e.0, e.1))?;
    let result = tokio::task::spawn_blocking(move || -> Result<_> {
        let now = Utc::now();
        let mut a = c.auth.clone();
        // Keep the current governance lease through composition/publication. Never wait
        // for a busy host while holding another host: try_lock fails closed.
        let ops = s
            .operations
            .as_ref()
            .map(|h| h.try_lock().map_err(|_| Fault::unavailable()))
            .transpose()?;
        if let Some(h) = &ops {
            h.restrict_identity(&mut a)?
        }
        command::authorize(&a, &q)?;
        let research = if command::has(&a, "research.read") {
            super::research::command_source(&s.database_url, &c, now)
                .unwrap_or_else(|_| unavailable("research", "unavailable"))
        } else {
            unavailable("research", "forbidden")
        };
        let execution = s
            .execution
            .as_ref()
            .and_then(|h| h.try_lock().ok().map(|h| h.command_source(&a, now)))
            .unwrap_or_else(|| unavailable("execution", "unavailable"));
        let strategy = s
            .strategy
            .as_ref()
            .and_then(|h| h.try_lock().ok().map(|h| h.command_source(&a, now)))
            .unwrap_or_else(|| unavailable("strategy", "unavailable"));
        let operation = ops
            .as_ref()
            .map(|h| h.command_source(&a, now))
            .unwrap_or_else(|| unavailable("operations", "unavailable"));
        let summary = command::compose(&a, [research, execution, operation, strategy], Utc::now());
        s.command
            .try_lock()
            .map_err(|_| Fault::unavailable())?
            .response(&a, &session, uri.path(), &q, &h, summary, now)
    })
    .await
    .map_err(|_| settings::ApiError::unavailable())?;
    result
        .map(|v| crate::operations::output(StatusCode::OK, v))
        .map_err(|e| settings::ApiError::new(e.0, e.1))
}
