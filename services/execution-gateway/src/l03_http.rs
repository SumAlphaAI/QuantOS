//! Private owner adapter for SERVICE:L03. The production service does not bind
//! this router. Trusted F06 identity/MFA adapters remain deployment obligations.
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use quantos_core::ProposalId;
use quantos_execution::assisted::*;
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
#[derive(Clone)]
pub struct HttpHost {
    pub service: AssistedApprovalService,
    pub clock: Arc<dyn Fn() -> DateTime<Utc> + Send + Sync>,
}
pub fn router(host: HttpHost) -> Router {
    Router::new()
        .route("/v1/assisted-testnet/capabilities", get(capabilities))
        .route("/v1/assisted-testnet/approval-requests", post(open))
        .route("/v1/assisted-testnet/approval-requests/:id", get(inspect))
        .route(
            "/v1/assisted-testnet/approval-requests/:id/challenges",
            post(challenge),
        )
        .route(
            "/v1/assisted-testnet/approval-requests/:id/approvals",
            post(approve),
        )
        .route(
            "/v1/assisted-testnet/approval-requests/:id/audit",
            get(audit),
        )
        .layer(DefaultBodyLimit::max(32768))
        .with_state(Arc::new(host))
}
pub fn response<T: serde::Serialize>(result: Result<T, Error>) -> Response {
    match result {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(e) => {
            let code = match e {
                Error::Disabled => "ASSISTED_TESTNET_DISABLED",
                Error::Unauthorized
                | Error::SelfApproval
                | Error::SameApprover
                | Error::MfaInvalid
                | Error::MfaConsumed => "ASSISTED_APPROVAL_FORBIDDEN",
                Error::Expired => "ASSISTED_APPROVAL_EXPIRED",
                Error::Conflict | Error::PolicyChanged => "ASSISTED_APPROVAL_CONFLICT",
                Error::Invalid => "INVALID_REQUEST",
                Error::Unavailable => "PROVIDER_UNAVAILABLE",
            };
            let status = match e {
                Error::Invalid => StatusCode::UNPROCESSABLE_ENTITY,
                Error::Conflict | Error::PolicyChanged => StatusCode::CONFLICT,
                Error::Expired => StatusCode::GONE,
                Error::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
                _ => StatusCode::FORBIDDEN,
            };
            (status, Json(json!({"error":{"code":code}}))).into_response()
        }
    }
}
pub fn session(headers: &HeaderMap) -> Result<&str, Error> {
    headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| !v.is_empty() && v.len() <= 128)
        .ok_or(Error::Unauthorized)
}
fn guard(host: &HttpHost) -> Result<(), Error> {
    if !host.service.reachable()? {
        return Err(Error::Disabled);
    }
    Ok(())
}
fn key(headers: &HeaderMap) -> Result<&str, Error> {
    headers
        .get("idempotency-key")
        .and_then(|h| h.to_str().ok())
        .ok_or(Error::Invalid)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Open {
    subject_id: ProposalId,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Approve {
    expected_revision: u64,
    proof: StepUpProof,
}
async fn capabilities(State(h): State<Arc<HttpHost>>, headers: HeaderMap) -> Response {
    response(
        h.service
            .capabilities(session(&headers).unwrap_or(""), h.clock.as_ref()),
    )
}
async fn open(State(h): State<Arc<HttpHost>>, headers: HeaderMap, body: Bytes) -> Response {
    response((|| {
        guard(&h)?;
        let b: Open = serde_json::from_slice(&body).map_err(|_| Error::Invalid)?;
        h.service.open(
            session(&headers)?,
            b.subject_id,
            key(&headers)?,
            h.clock.as_ref(),
        )
    })())
}
async fn challenge(
    State(h): State<Arc<HttpHost>>,
    Path(id): Path<ProposalId>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    response((|| {
        guard(&h)?;
        if !body.is_empty() {
            return Err(Error::Invalid);
        }
        h.service
            .challenge(session(&headers)?, id, h.clock.as_ref())
    })())
}
async fn approve(
    State(h): State<Arc<HttpHost>>,
    Path(id): Path<ProposalId>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    response((|| {
        guard(&h)?;
        let b: Approve = serde_json::from_slice(&body).map_err(|_| Error::Invalid)?;
        h.service.approve(
            session(&headers)?,
            id,
            b.expected_revision,
            key(&headers)?,
            b.proof,
            h.clock.as_ref(),
        )
    })())
}
async fn inspect(
    State(h): State<Arc<HttpHost>>,
    Path(id): Path<ProposalId>,
    headers: HeaderMap,
) -> Response {
    response((|| {
        guard(&h)?;
        h.service.inspect(session(&headers)?, id, h.clock.as_ref())
    })())
}
async fn audit(
    State(h): State<Arc<HttpHost>>,
    Path(id): Path<ProposalId>,
    headers: HeaderMap,
) -> Response {
    response((|| {
        guard(&h)?;
        h.service
            .inspect(session(&headers)?, id, h.clock.as_ref())?;
        let (entries, anchor) = h.service.audit_snapshot()?;
        h.service.verify_audit(&entries, &anchor)?;
        Ok::<Value, Error>(
            json!({"entries":entries.into_iter().filter(|e|e.request==id).collect::<Vec<_>>(),"globalAnchor":anchor,"scope":"PROCESS_LOCAL_APPROVAL_JOURNAL"}),
        )
    })())
}
