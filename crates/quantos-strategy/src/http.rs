//! Owner-service HTTP adapter, distinct from the public BFF wire contract.
//! Bearer verification is supplied by a trusted host; identity headers/JSON are not authority.
use crate::service::{Page, Reply, StrategyService};
use axum::{
    Json, Router,
    body::to_bytes,
    extract::{Request, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::any,
};
use chrono::{DateTime, Utc};
use quantos_auth::{AuthContext, GatewayAuthMiddleware, SupabaseAuthVerifier};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub trait SessionResolver: Send + Sync {
    /// The implementation must verify an active session on every call. Never derive
    /// identity, role or grants from unverified request headers or JSON.
    fn resolve(&self, bearer: &str, now: DateTime<Utc>) -> Result<AuthContext, SessionError>;
}
#[derive(Debug)]
pub enum SessionError {
    Unauthenticated,
    Unavailable,
}
/// Optional target adapter. Construction connects only when explicitly invoked by
/// an authorized host with configured Supabase credentials; local tests never call it.
pub struct SupabaseSessions {
    middleware: Mutex<GatewayAuthMiddleware>,
    verifier: SupabaseAuthVerifier,
}
impl SupabaseSessions {
    pub fn connect(
        database_url: &str,
        project_url: &str,
        publishable_key: String,
    ) -> Result<Self, quantos_auth::AuthError> {
        Ok(Self {
            middleware: Mutex::new(GatewayAuthMiddleware::connect_as_bff(database_url)?),
            verifier: SupabaseAuthVerifier::new(project_url, publishable_key)?,
        })
    }
}
impl SessionResolver for SupabaseSessions {
    fn resolve(&self, bearer: &str, _now: DateTime<Utc>) -> Result<AuthContext, SessionError> {
        self.middleware
            .lock()
            .map_err(|_| SessionError::Unavailable)?
            .load_access_token_context(&self.verifier, bearer, None)
            .map_err(|error| match error {
                quantos_auth::AuthError::UnverifiedSession
                | quantos_auth::AuthError::AmbiguousPrimaryContext
                | quantos_auth::AuthError::MissingIdentityMapping { .. } => {
                    SessionError::Unauthenticated
                }
                _ => SessionError::Unavailable,
            })
    }
}
#[derive(Clone)]
struct HttpState {
    service: Arc<StrategyService>,
    sessions: Arc<dyn SessionResolver>,
    permits: Arc<tokio::sync::Semaphore>,
}
/// Mount only behind the trusted owner-service host. The BFF's /v1 API is mapped
/// separately by BFF-FE-004; fixture sessions are never a default production mode.
pub fn router(service: Arc<StrategyService>, sessions: Arc<dyn SessionResolver>) -> Router {
    Router::new()
        .route("/strategy/v1/*path", any(handle))
        .with_state(HttpState {
            service,
            sessions,
            permits: Arc::new(tokio::sync::Semaphore::new(64)),
        })
}
async fn handle(State(state): State<HttpState>, request: Request) -> Response {
    let correlation = Uuid::now_v7();
    let method = request.method().as_str().to_owned();
    let path = request
        .uri()
        .path()
        .strip_prefix("/strategy/v1/")
        .unwrap_or("")
        .to_owned();
    let raw_bearer = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| !v.is_empty() && v.len() <= 4096)
        .map(str::to_owned);
    let Some(bearer) = raw_bearer else {
        return response(
            state
                .service
                .reject(None, correlation, "UNAUTHENTICATED", 401),
        );
    };
    let permit = match state.permits.clone().try_acquire_owned() {
        Ok(p) => Arc::new(p),
        Err(_) => return response(state.service.reject(None, correlation, "SERVICE_BUSY", 503)),
    };
    let resolver = state.sessions.clone();
    let now = state.service.now();
    let auth_permit = permit.clone();
    let auth = match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::task::spawn_blocking(move || {
            let _permit = auth_permit;
            resolver.resolve(&bearer, now)
        }),
    )
    .await
    {
        Ok(Ok(Ok(auth))) => auth,
        Ok(Ok(Err(SessionError::Unauthenticated))) => {
            return response(
                state
                    .service
                    .reject(None, correlation, "UNAUTHENTICATED", 401),
            );
        }
        _ => {
            return response(
                state
                    .service
                    .reject(None, correlation, "AUTH_UNAVAILABLE", 503),
            );
        }
    };
    let json_type = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .next()
                .is_some_and(|v| v.trim() == "application/json")
        });
    let page = match request.uri().query().map_or(Ok(Page::default()), |q| {
        serde_urlencoded::from_str::<Page>(q)
    }) {
        Ok(p) => p,
        Err(_) => {
            return response(
                state
                    .service
                    .reject(Some(&auth), correlation, "INVALID_PAGE", 422),
            );
        }
    };
    let body = match tokio::time::timeout(
        std::time::Duration::from_secs(2),
        to_bytes(request.into_body(), 65_536),
    )
    .await
    {
        Ok(Ok(b)) => b,
        Ok(Err(_)) => {
            return response(
                state
                    .service
                    .reject(Some(&auth), correlation, "BODY_TOO_LARGE", 413),
            );
        }
        Err(_) => {
            return response(state.service.reject(
                Some(&auth),
                correlation,
                "REQUEST_TIMEOUT",
                408,
            ));
        }
    };
    if !body.is_empty() && method != "GET" && !json_type {
        return response(state.service.reject(
            Some(&auth),
            correlation,
            "UNSUPPORTED_MEDIA_TYPE",
            415,
        ));
    }
    let service = state.service.clone();
    match tokio::task::spawn_blocking(move || {
        let _permit = permit;
        service.execute(&auth, &method, &path, &body, page, correlation)
    })
    .await
    {
        Ok(reply) => response(reply),
        Err(_) => response(
            state
                .service
                .reject(None, correlation, "SERVICE_UNAVAILABLE", 503),
        ),
    }
}
fn response(reply: Reply) -> Response {
    let mut response = (
        StatusCode::from_u16(reply.status).unwrap_or(StatusCode::SERVICE_UNAVAILABLE),
        Json(reply.body),
    )
        .into_response();
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        "x-correlation-id",
        reply
            .correlation_id
            .to_string()
            .parse()
            .expect("uuid header"),
    );
    if reply.status == 429 {
        response
            .headers_mut()
            .insert("retry-after", HeaderValue::from_static("1"));
    }
    response
}
