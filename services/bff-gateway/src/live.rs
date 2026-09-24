use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, header},
    routing::{get, post},
};
use quantos_auth::{GatewayAuthMiddleware, SupabaseAuthVerifier};
use quantos_core::AccountId;
use serde_json::{Value, json};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

struct LiveState {
    verifier: SupabaseAuthVerifier,
    middleware: Mutex<GatewayAuthMiddleware>,
    terminal_origin: String,
    environment: String,
}

/// Real identity surface. The reference-provider routes are deliberately not
/// mounted here, so fixed fixture cookies cannot reach this service mode.
pub fn router(
    database_url: &str,
    project_url: &str,
    publishable_key: String,
    terminal_origin: String,
    environment: String,
) -> anyhow::Result<Router> {
    anyhow::ensure!(
        terminal_origin.starts_with("https://"),
        "live BFF requires an HTTPS Terminal origin"
    );
    anyhow::ensure!(
        matches!(environment.as_str(), "dev" | "staging" | "prod"),
        "live BFF requires a valid environment"
    );
    let origin_header = HeaderValue::from_str(&terminal_origin)?;
    let state = Arc::new(LiveState {
        verifier: SupabaseAuthVerifier::new(project_url, publishable_key)?,
        middleware: Mutex::new(GatewayAuthMiddleware::connect_as_bff(database_url)?),
        terminal_origin,
        environment,
    });
    Ok(Router::new()
        .route("/v1/session", get(session))
        .route("/v1/context", get(session))
        .route("/v1/auth/session", post(establish_session))
        .route("/v1/auth/logout", post(logout))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(origin_header)
                .allow_credentials(true)
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    HeaderName::from_static("x-account-id"),
                ])
                .expose_headers([HeaderName::from_static("x-correlation-id")]),
        ))
}

async fn session(
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<Value>), StatusCode> {
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
            .map_err(|_| StatusCode::UNAUTHORIZED)
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
) -> Result<(StatusCode, HeaderMap), StatusCode> {
    require_origin(&headers, &state.terminal_origin)?;
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?
        .to_owned();
    let raw = tokio::task::spawn_blocking(move || {
        let mut middleware = state
            .middleware
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        middleware
            .issue_bff_session(&state.verifier, &token)
            .map_err(|_| StatusCode::UNAUTHORIZED)
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
    Ok((StatusCode::NO_CONTENT, response_headers))
}

async fn logout(
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
) -> Result<(StatusCode, HeaderMap), StatusCode> {
    require_origin(&headers, &state.terminal_origin)?;
    if let Some(raw) = session_cookie(&headers) {
        tokio::task::spawn_blocking(move || {
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
    use super::{require_origin, session_cookie};
    use axum::http::{HeaderMap, HeaderValue, StatusCode, header};

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
}
