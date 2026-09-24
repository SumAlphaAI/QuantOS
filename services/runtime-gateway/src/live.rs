use std::{
    env,
    net::SocketAddr,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use anyhow::{Context, Result, ensure};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    routing::{get, post},
};
use bytes::Bytes;
use chrono::{Duration as ChronoDuration, Utc};
use quantos_auth::{BffSessionContext, GatewayAuthMiddleware};
use quantos_core::{ArtifactId, ContentHash, WorkflowRunId};
use quantos_observability::service::ServiceObservability;
use quantos_policy::{AuthorizationRequirement, Capability, Role};
use quantos_runtime::{NewWorkflowRun, ToolRegistration, pg::PgRuntimeStore};
use quantos_storage::{
    ArtifactManifest,
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig},
};
use serde_json::{Value, json};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

struct AppState {
    auth: Mutex<GatewayAuthMiddleware>,
    store: Mutex<PgRuntimeStore>,
    storage: SupabaseStorageAdapter,
    origin: String,
    worker_healthy: Arc<AtomicBool>,
}

fn storage_config() -> Result<SupabaseStorageConfig> {
    let key = env::var("QUANTOS_RUNTIME_STORAGE_KEY").context("runtime Storage key is required")?;
    Ok(SupabaseStorageConfig {
        project_url: env::var("SUPABASE_URL").context("Supabase URL is required")?,
        bucket_name: "quantos-artifacts".to_owned(),
        api_key: key.clone(),
        authorization_token: Some(key),
        upsert: true,
    })
}

pub async fn serve() -> Result<()> {
    let runtime_url =
        env::var("QUANTOS_RUNTIME_DATABASE_URL").context("runtime database URL is required")?;
    let bff_url = env::var("QUANTOS_BFF_DATABASE_URL").context("BFF database URL is required")?;
    let origin = env::var("QUANTOS_TERMINAL_ORIGIN").context("Terminal origin is required")?;
    ensure!(
        origin.starts_with("https://"),
        "Terminal origin must use HTTPS"
    );
    let origin_header = HeaderValue::from_str(&origin)?;
    let auth = tokio::task::spawn_blocking(move || GatewayAuthMiddleware::connect_as_bff(&bff_url))
        .await
        .context("auth initialization failed")??;
    let store = PgRuntimeStore::connect_as_runtime(&runtime_url)?;
    let worker_store = PgRuntimeStore::connect_as_runtime(&runtime_url)?;
    let storage = SupabaseStorageAdapter::connect(storage_config()?)?;
    let worker_storage = SupabaseStorageAdapter::connect(storage_config()?)?;
    let worker_healthy = Arc::new(AtomicBool::new(false));
    let worker_status = worker_healthy.clone();
    std::thread::Builder::new()
        .name("runtime-worker".to_owned())
        .spawn(move || {
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                worker_loop(worker_store, worker_storage, &worker_status)
            }));
            worker_status.store(false, Ordering::SeqCst);
        })?;
    for _ in 0..100 {
        if worker_healthy.load(Ordering::SeqCst) {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    ensure!(
        worker_healthy.load(Ordering::SeqCst),
        "runtime worker did not become healthy"
    );
    if let Ok(address) = env::var("QUANTOS_OBSERVABILITY_ADDR") {
        let address = address.parse()?;
        std::thread::Builder::new()
            .name("runtime-observability".to_owned())
            .spawn(move || {
                if let Ok(service) = ServiceObservability::from_env("runtime-gateway") {
                    let _ = service.serve(address);
                }
            })?;
    }
    let state = Arc::new(AppState {
        auth: Mutex::new(auth),
        store: Mutex::new(store),
        storage,
        origin,
        worker_healthy,
    });
    let router = Router::new()
        .route("/healthz", get(health))
        .route("/v1/runtime/sessions", post(create_session))
        .route("/v1/runtime/tools", post(register_tool))
        .route("/v1/runtime/runs", post(schedule))
        .route("/v1/runtime/runs/:run_id", get(get_run))
        .route("/v1/runtime/runs/:run_id/cancel", post(cancel_run))
        .route(
            "/v1/runtime/runs/:run_id/artifacts/:artifact_id",
            get(get_artifact),
        )
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(origin_header)
                .allow_credentials(true)
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([header::CONTENT_TYPE, header::COOKIE]),
        );
    let address: SocketAddr = env::var("QUANTOS_RUNTIME_BIND")
        .unwrap_or_else(|_| "127.0.0.1:4020".to_owned())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("{{\"service\":\"runtime-gateway\",\"ready\":true,\"address\":\"{address}\"}}");
    axum::serve(listener, router).await?;
    Ok(())
}

async fn health(State(state): State<Arc<AppState>>) -> StatusCode {
    if state.worker_healthy.load(Ordering::SeqCst) {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
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

async fn identity(
    state: Arc<AppState>,
    headers: HeaderMap,
    write: bool,
    requirement: Option<AuthorizationRequirement>,
) -> Result<BffSessionContext, StatusCode> {
    if write
        && headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) != Some(state.origin.as_str())
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let raw = session_cookie(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    tokio::task::spawn_blocking(move || {
        let mut auth = state
            .auth
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        let context = match requirement {
            Some(req) => auth
                .authorize_bff_session(&raw, None, &req)
                .map_err(|_| StatusCode::FORBIDDEN)?,
            None => auth
                .load_bff_session_context(&raw, None)
                .map_err(|_| StatusCode::UNAUTHORIZED)?,
        };
        Ok(context)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    let actor = identity(state.clone(), headers, true, None).await?;
    let session = tokio::task::spawn_blocking(move || {
        let now = Utc::now();
        state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .create_session(
                &actor.auth,
                now,
                actor.expires_at.min(now + ChronoDuration::hours(1)),
            )
            .map_err(|_| StatusCode::FORBIDDEN)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    Ok((StatusCode::CREATED, Json(json!(session))))
}

async fn register_tool(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(tool): Json<ToolRegistration>,
) -> Result<Json<Value>, StatusCode> {
    let actor = identity(state.clone(), headers, true, None).await?;
    if actor.auth.role != Role::Owner {
        return Err(StatusCode::FORBIDDEN);
    }
    if tool.tool_name != "runtime.fixture" || tool.capability.as_str() != Capability::RESEARCH_WRITE
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    let registered = tokio::task::spawn_blocking(move || {
        state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .register_tool(actor.auth.tenant_id, &tool, Utc::now())
            .map_err(|_| StatusCode::BAD_REQUEST)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    Ok(Json(json!(registered)))
}

async fn schedule(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<NewWorkflowRun>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if input.workflow_kind != "runtime.fixture.v1" {
        return Err(StatusCode::BAD_REQUEST);
    }
    if input.tool_name != "runtime.fixture"
        || input.capability.as_str() != Capability::RESEARCH_WRITE
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    let actor = identity(
        state.clone(),
        headers,
        true,
        Some(AuthorizationRequirement::new(input.capability.clone())),
    )
    .await?;
    let run = tokio::task::spawn_blocking(move || {
        let mut store = state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        let session = store
            .load_session(input.runtime_session_id)
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if session.actor_id != actor.auth.actor_id
            || session.tenant_id != actor.auth.tenant_id
            || session.workspace_id != actor.auth.workspace_id
            || session.account_id != actor.auth.account_id
            || session.mode != actor.auth.mode
            || session.expires_at <= Utc::now()
        {
            return Err(StatusCode::FORBIDDEN);
        }
        store
            .schedule_run(&input, Utc::now())
            .map_err(|_| StatusCode::CONFLICT)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    Ok((StatusCode::ACCEPTED, Json(json!(run))))
}

async fn get_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(run_id): Path<Uuid>,
) -> Result<Json<Value>, StatusCode> {
    let actor = identity(state.clone(), headers, false, None).await?;
    let run = tokio::task::spawn_blocking(move || {
        let run = state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .load_run(WorkflowRunId::from_uuid(run_id))
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if run.tenant_id != actor.auth.tenant_id || run.actor_id != actor.auth.actor_id {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok::<_, StatusCode>(run)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    Ok(Json(json!(run)))
}

async fn cancel_run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(run_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let actor = identity(state.clone(), headers, true, None).await?;
    tokio::task::spawn_blocking(move || {
        let mut store = state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        let id = WorkflowRunId::from_uuid(run_id);
        let run = store
            .load_run(id)
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if run.tenant_id != actor.auth.tenant_id || run.actor_id != actor.auth.actor_id {
            return Err(StatusCode::NOT_FOUND);
        }
        store
            .request_cancel(id, Utc::now())
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)??;
    Ok(StatusCode::ACCEPTED)
}

async fn get_artifact(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((run_id, artifact_id)): Path<(Uuid, Uuid)>,
) -> Result<([(axum::http::HeaderName, String); 1], Bytes), StatusCode> {
    let actor = identity(state.clone(), headers, false, None).await?;
    tokio::task::spawn_blocking(move || {
        let mut store = state
            .store
            .lock()
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        let id = WorkflowRunId::from_uuid(run_id);
        let run = store
            .load_run(id)
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if run.tenant_id != actor.auth.tenant_id || run.actor_id != actor.auth.actor_id {
            return Err(StatusCode::NOT_FOUND);
        }
        let manifest = store
            .load_artifact_for_run(run.tenant_id, id, ArtifactId::from_uuid(artifact_id))
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .ok_or(StatusCode::NOT_FOUND)?;
        let bytes = state
            .storage
            .get_artifact(&manifest)
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        Ok::<_, StatusCode>(([(header::CONTENT_TYPE, manifest.media_type)], bytes))
    })
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
}

fn worker_loop(mut store: PgRuntimeStore, storage: SupabaseStorageAdapter, healthy: &AtomicBool) {
    loop {
        match worker_once(&mut store, &storage) {
            Ok(()) => healthy.store(true, Ordering::SeqCst),
            Err(_) => {
                healthy.store(false, Ordering::SeqCst);
                eprintln!("{{\"service\":\"runtime-gateway\",\"event\":\"worker_scan_failed\"}}");
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}

fn worker_once(store: &mut PgRuntimeStore, storage: &SupabaseStorageAdapter) -> Result<()> {
    for tenant in store.pending_tenants()? {
        store.finalize_pending_cancellations(tenant, Utc::now())?;
        for lease in store.claim_runs(
            tenant,
            "runtime-gateway",
            1,
            Utc::now(),
            ChronoDuration::seconds(120),
        )? {
            if lease.run.workflow_kind != "runtime.fixture.v1" {
                store.fail_and_retry(&lease, "unsupported workflow kind", Utc::now())?;
                continue;
            }
            if lease.run.cost_budget_units < 1 {
                store.fail_and_retry(&lease, "artifact cost budget exhausted", Utc::now())?;
                continue;
            }
            let run_id = lease.run.workflow_run_id;
            if store.load_checkpoint(run_id)?.is_none() {
                store.save_checkpoint(
                    &lease,
                    "fixture.ready",
                    1,
                    &json!({"inputHash": lease.run.input_hash.as_str()}),
                    Utc::now(),
                )?;
            }
            let payload = serde_json::to_vec(
                &json!({"runId": run_id, "inputHash": lease.run.input_hash.as_str()}),
            )?;
            let manifest = ArtifactManifest::new(
                tenant,
                "application/json",
                ContentHash::sha256_bytes(&payload),
                "quantos-artifacts",
                payload.len() as u64,
                Utc::now(),
            );
            if storage
                .put_artifact(&manifest, Bytes::from(payload))
                .is_err()
            {
                store.fail_and_retry(&lease, "storage upload failed", Utc::now())?;
                continue;
            }
            store.record_artifact(&lease, &manifest, Utc::now())?;
            store.complete_run(&lease, Utc::now())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::session_cookie;
    use axum::http::{HeaderMap, header};
    #[test]
    fn invalid_or_missing_session_cookie_is_rejected() {
        let mut headers = HeaderMap::new();
        assert_eq!(session_cookie(&headers), None);
        headers.insert(
            header::COOKIE,
            "quantos_session=not-a-uuid".parse().unwrap(),
        );
        assert_eq!(session_cookie(&headers), None);
    }
}
