mod settings;
mod settings_policy;

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use quantos_auth::{AuthError, GatewayAuthMiddleware, SupabaseAuthVerifier};
use quantos_core::{AccountId, CorrelationId};
use quantos_observability::service::ServiceObservability;
use serde_json::{Value, json};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

struct LiveState {
    verifier: SupabaseAuthVerifier,
    middleware: Mutex<GatewayAuthMiddleware>,
    terminal_origin: String,
    environment: String,
    a2: Mutex<settings::A2Store>,
    database_url: String,
    proofs: Mutex<BTreeMap<String, settings::AuthProof>>,
    mfa: settings::SupabaseMfa,
}

struct LiveError(StatusCode);

impl From<StatusCode> for LiveError {
    fn from(status: StatusCode) -> Self {
        Self(status)
    }
}

impl IntoResponse for LiveError {
    fn into_response(self) -> Response {
        let correlation_id = Uuid::new_v4().to_string();
        let (code, message) = match self.0 {
            StatusCode::UNAUTHORIZED => ("UNAUTHENTICATED", "Session is unavailable."),
            StatusCode::FORBIDDEN => ("FORBIDDEN", "Access denied."),
            StatusCode::NOT_FOUND => ("NOT_FOUND", "Resource not found."),
            StatusCode::BAD_REQUEST => ("BAD_REQUEST", "Invalid request."),
            StatusCode::INTERNAL_SERVER_ERROR => ("INTERNAL_ERROR", "Internal error."),
            _ => ("SERVICE_UNAVAILABLE", "Service is unavailable."),
        };
        let mut headers = HeaderMap::new();
        headers.insert("x-correlation-id", correlation_id.parse().unwrap());
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        (
            self.0,
            headers,
            Json(json!({
                "code": code, "message": message, "correlationId": correlation_id,
            })),
        )
            .into_response()
    }
}

fn auth_status(error: AuthError) -> StatusCode {
    let category = match &error {
        AuthError::Http(error) if error.is_timeout() => Some("auth_http_timeout"),
        AuthError::Http(error) if error.is_connect() => Some("auth_http_connect"),
        AuthError::Http(_) => Some("auth_http_error"),
        AuthError::Postgres(_) => Some("auth_database_error"),
        _ => None,
    };
    if let Some(category) = category {
        // No URL, bearer, session, identity or underlying error text is logged.
        eprintln!(
            "{}",
            json!({"service":"bff-gateway","event":"auth_dependency_failed","category":category})
        );
    }
    match error {
        AuthError::HiddenAccount => StatusCode::NOT_FOUND,
        AuthError::UnverifiedSession
        | AuthError::AmbiguousPrimaryContext
        | AuthError::MissingIdentityMapping { .. } => StatusCode::UNAUTHORIZED,
        AuthError::Policy(_) => StatusCode::FORBIDDEN,
        _ => StatusCode::SERVICE_UNAVAILABLE,
    }
}

/// Real identity surface. The reference-provider routes are deliberately not
/// mounted here, so fixed fixture cookies cannot reach this service mode.
pub fn router(
    database_url: &str,
    project_url: &str,
    publishable_key: String,
    terminal_origin: String,
    environment: String,
    observability: Arc<ServiceObservability>,
) -> anyhow::Result<Router> {
    anyhow::ensure!(
        terminal_origin.starts_with("https://"),
        "live BFF requires an HTTPS Terminal origin"
    );
    anyhow::ensure!(
        matches!(environment.as_str(), "dev" | "staging" | "prod"),
        "live BFF requires a valid environment"
    );
    let cors = cors_layer(HeaderValue::from_str(&terminal_origin)?);
    let state = Arc::new(LiveState {
        verifier: SupabaseAuthVerifier::new(project_url, publishable_key.clone())?,
        a2: Mutex::new(settings::A2Store::new(database_url)?),
        database_url: database_url.to_owned(),
        proofs: Mutex::new(BTreeMap::new()),
        mfa: settings::SupabaseMfa::new(project_url, publishable_key)?,
        middleware: Mutex::new(GatewayAuthMiddleware::connect_as_bff(database_url)?),
        terminal_origin,
        environment,
    });
    Ok(Router::new()
        .route("/v1/session", get(session))
        .route("/v1/context", get(session))
        .route("/v1/auth/session", post(establish_session))
        .route("/v1/auth/logout", post(logout))
        .merge(settings::routes())
        .fallback(|| async { settings::ApiError::new(StatusCode::NOT_FOUND, "NOT_FOUND") })
        .layer(middleware::from_fn_with_state(
            state.clone(),
            settings::guard,
        ))
        .with_state(state)
        .layer(middleware::from_fn_with_state(
            observability,
            trace_write_request,
        ))
        .layer(cors))
}

// Shared by the live router and its database-free browser preflight regressions.
fn cors_layer(origin: HeaderValue) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(origin)
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static("x-account-id"),
            HeaderName::from_static("x-csrf-token"),
            HeaderName::from_static("x-reauth-token-ref"),
            HeaderName::from_static("idempotency-key"),
            HeaderName::from_static("if-match"),
            HeaderName::from_static("x-request-id"),
            HeaderName::from_static("x-correlation-id"),
            HeaderName::from_static("traceparent"),
        ])
        .expose_headers([HeaderName::from_static("x-correlation-id"), header::ETAG])
}

async fn trace_write_request(
    State(observer): State<Arc<ServiceObservability>>,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let requested_id = request
        .headers()
        .get("x-correlation-id")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| CorrelationId::parse_str(value).ok());
    let mut response = next.run(request).await;
    if matches!(
        method,
        Method::POST | Method::PUT | Method::DELETE | Method::PATCH
    ) {
        let correlation_id = response
            .headers()
            .get("x-correlation-id")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| CorrelationId::parse_str(value).ok())
            .or(requested_id)
            .unwrap_or_else(CorrelationId::new);
        if let Err(error) = observer.record_trace(
            correlation_id,
            format!("http.{} {path}", method.as_str().to_ascii_lowercase()),
            if response.status().is_success() {
                "succeeded"
            } else {
                "failed"
            },
            json!({ "http_status": response.status().as_u16() }),
        ) {
            eprintln!("BFF trace export failed: {error}");
        }
        response.headers_mut().insert(
            "x-correlation-id",
            HeaderValue::from_str(&correlation_id.to_string()).expect("UUID header value"),
        );
    }
    response
}

#[cfg(test)]
mod f09_trace_tests {
    use std::sync::Arc;

    use axum::{
        Router,
        body::Body,
        http::{Method, Request, StatusCode},
        middleware,
        routing::post,
    };
    use quantos_observability::service::ServiceObservability;
    use tower::ServiceExt;

    use super::trace_write_request;

    #[tokio::test]
    async fn auth_write_returns_queryable_correlation_trace() {
        let path = std::env::temp_dir().join(format!("f09-bff-{}.jsonl", uuid::Uuid::new_v4()));
        let observer =
            Arc::new(ServiceObservability::with_jsonl_exporter("bff-gateway", &path).unwrap());
        let router = Router::new()
            .route("/v1/auth/logout", post(|| async { StatusCode::NO_CONTENT }))
            .layer(middleware::from_fn_with_state(
                observer.clone(),
                trace_write_request,
            ));
        let response = router
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/auth/logout")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let correlation = response.headers()["x-correlation-id"].to_str().unwrap();
        let result = observer.render(&format!("/trace/{correlation}"));
        assert!(result.contains("http.post /v1/auth/logout"));
        std::fs::remove_file(path).unwrap();
    }
}

#[cfg(test)]
mod f09_live_tests;

async fn session(
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<Value>), LiveError> {
    let raw_session = session_cookie(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let environment = state.environment.clone();
    let account_id = match headers.get("x-account-id") {
        Some(value) => Some(AccountId::from_uuid(
            Uuid::parse_str(value.to_str().map_err(|_| StatusCode::BAD_REQUEST)?)
                .map_err(|_| StatusCode::BAD_REQUEST)?,
        )),
        None => None,
    };
    let context = tokio::task::spawn_blocking(move || {
        let mut middleware = state
            .middleware
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        middleware
            .load_bff_session_context(&raw_session, account_id)
            .map_err(auth_status)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    let account_id = context
        .auth
        .account_id
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        HeaderName::from_static("x-correlation-id"),
        HeaderValue::from_str(&Uuid::new_v4().to_string())
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    );
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok((
        response_headers,
        Json(json!({
            "actorId": context.auth.actor_id.to_string(),
            "tenantId": context.auth.tenant_id.to_string(),
            "workspaceId": context.auth.workspace_id.to_string(),
            "accountId": account_id.to_string(),
            "mode": context.auth.mode.as_str(),
            "environment": environment,
            "role": context.auth.role.as_str(),
            "capabilities": context.auth.capabilities.iter().map(|value| value.as_str()).collect::<Vec<_>>(),
            "mfaState": if context.mfa_verified { "verified" } else { "challenged" },
            "expiresAt": context.expires_at.to_rfc3339(),
        })),
    ))
}

async fn establish_session(
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<(StatusCode, HeaderMap), LiveError> {
    require_origin(&headers, &state.terminal_origin)?;
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?
        .to_owned();
    let csrf = Uuid::new_v4().to_string();
    let csrf_for_store = csrf.clone();
    let raw = tokio::task::spawn_blocking(move || {
        let mut middleware = state
            .middleware
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        let raw = middleware
            .issue_bff_session(&state.verifier, &token)
            .map_err(auth_status)?;
        let context = middleware
            .load_bff_session_context(&raw, None)
            .map_err(auth_status)?;
        drop(middleware);
        let user = state.mfa.user(&token).map_err(|e| e.status)?;
        if user["id"].as_str() != Some(context.user_id.to_string().as_str()) {
            return Err(StatusCode::FORBIDDEN);
        }
        let registered = (|| {
            let mut store = state
                .a2
                .lock()
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
            store
                .register(&raw, &csrf_for_store, &context, &user)
                .map_err(|e| e.status)?;
            store
                .bootstrap(&raw, &context, &token, &user)
                .map_err(|e| e.status)?;
            state
                .proofs
                .lock()
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
                .insert(
                    settings::hash(&raw),
                    settings::AuthProof {
                        token,
                        expires_at: context.expires_at,
                    },
                );
            Ok::<_, StatusCode>(())
        })();
        if let Err(error) = registered {
            if let Ok(mut middleware) = state.middleware.lock() {
                let _ = middleware.revoke_bff_session(&raw);
            }
            return Err(error);
        }
        Ok(raw)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    let mut response_headers = HeaderMap::new();
    let cookie =
        format!("quantos_session={raw}; Path=/; Max-Age=300; Secure; HttpOnly; SameSite=Strict");
    response_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    );
    response_headers.append(
        header::SET_COOKIE,
        HeaderValue::from_str(&format!(
            "quantos_csrf={csrf}; Path=/; Max-Age=300; Secure; SameSite=Strict"
        ))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    );
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok((StatusCode::NO_CONTENT, response_headers))
}

async fn logout(
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<(StatusCode, HeaderMap), LiveError> {
    require_origin(&headers, &state.terminal_origin)?;
    if let Some(raw) = session_cookie(&headers) {
        tokio::task::spawn_blocking(move || {
            state
                .proofs
                .lock()
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
                .remove(&settings::hash(&raw));
            let mut middleware = state
                .middleware
                .lock()
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
            middleware
                .revoke_bff_session(&raw)
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
        })
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    }
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_static(
            "quantos_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict",
        ),
    );
    response_headers.append(
        header::SET_COOKIE,
        HeaderValue::from_static("quantos_csrf=; Path=/; Max-Age=0; Secure; SameSite=Strict"),
    );
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok((StatusCode::NO_CONTENT, response_headers))
}

fn session_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .map(str::trim)
        .find_map(|part| part.strip_prefix("quantos_session="))
        .filter(|value| Uuid::parse_str(value).is_ok())
        .map(str::to_owned)
}

fn require_origin(headers: &HeaderMap, expected: &str) -> Result<(), StatusCode> {
    if headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        == Some(expected)
    {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

#[cfg(test)]
mod tests {
    use super::{LiveError, auth_status, require_origin, session_cookie};
    use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
    use axum::response::IntoResponse;
    use quantos_auth::AuthError;

    #[test]
    fn live_session_requires_opaque_cookie_and_exact_origin() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_static("quantos_session=fixed-session"),
        );
        assert_eq!(session_cookie(&headers), None);
        headers.insert(
            header::COOKIE,
            HeaderValue::from_static(
                "other=1; quantos_session=5f10d43a-406f-4700-a8f6-6bf85e84b006",
            ),
        );
        assert_eq!(
            session_cookie(&headers).as_deref(),
            Some("5f10d43a-406f-4700-a8f6-6bf85e84b006")
        );
        assert_eq!(
            require_origin(&headers, "https://terminal.example"),
            Err(StatusCode::FORBIDDEN)
        );
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://terminal.example"),
        );
        assert_eq!(require_origin(&headers, "https://terminal.example"), Ok(()));
    }

    #[test]
    fn live_errors_hide_account_existence_and_include_correlation() {
        assert_eq!(auth_status(AuthError::HiddenAccount), StatusCode::NOT_FOUND);
        assert_eq!(
            auth_status(AuthError::UnverifiedSession),
            StatusCode::UNAUTHORIZED
        );
        for status in [
            StatusCode::UNAUTHORIZED,
            StatusCode::FORBIDDEN,
            StatusCode::NOT_FOUND,
        ] {
            let response = LiveError(status).into_response();
            assert_eq!(response.status(), status);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
            assert!(response.headers().contains_key("x-correlation-id"));
        }
    }
}

#[cfg(test)]
mod cors_tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    const ORIGIN: &str = "https://terminal.example.invalid";
    async fn preflight(origin: &str, method: &str) -> HeaderMap {
        let response = Router::new()
            .layer(cors_layer(HeaderValue::from_static(ORIGIN)))
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/v1/settings/sessions/remote")
                    .header("origin", origin)
                    .header("access-control-request-method", method)
                    .header(
                        "access-control-request-headers",
                        "x-csrf-token,idempotency-key,x-request-id,x-reauth-token-ref",
                    )
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        response.headers().clone()
    }
    #[tokio::test]
    async fn trusted_recent_auth_preflight_allows_contract_headers() {
        for method in ["POST", "DELETE"] {
            let headers = preflight(ORIGIN, method).await;
            assert_eq!(headers["access-control-allow-origin"], ORIGIN);
            assert_eq!(headers["access-control-allow-credentials"], "true");
            for required in [
                "x-csrf-token",
                "idempotency-key",
                "x-request-id",
                "x-reauth-token-ref",
            ] {
                assert!(
                    headers["access-control-allow-headers"]
                        .to_str()
                        .unwrap()
                        .split(',')
                        .any(|h| h.trim() == required),
                    "missing {required}"
                );
            }
        }
    }
    #[tokio::test]
    async fn trusted_browser_can_read_contract_response_headers() {
        let response = Router::new()
            .layer(cors_layer(HeaderValue::from_static(ORIGIN)))
            .oneshot(
                Request::builder()
                    .uri("/v1/settings/profile")
                    .header("origin", ORIGIN)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let exposed = response.headers()["access-control-expose-headers"]
            .to_str()
            .unwrap();
        assert!(exposed.contains("etag") && exposed.contains("x-correlation-id"));
    }
    #[tokio::test]
    async fn untrusted_origin_and_undeclared_headers_are_not_allowed() {
        let headers = preflight("https://evil.example.invalid", "DELETE").await;
        assert_ne!(
            headers
                .get("access-control-allow-origin")
                .and_then(|h| h.to_str().ok()),
            Some("https://evil.example.invalid")
        );
        let trusted = preflight(ORIGIN, "DELETE").await;
        assert!(
            !trusted["access-control-allow-headers"]
                .to_str()
                .unwrap()
                .contains("x-forged-authority")
        );
        assert_ne!(trusted["access-control-allow-headers"], "*");
    }
}
