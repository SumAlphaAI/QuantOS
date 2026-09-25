use super::*;
use std::collections::HashSet;

use axum::{body::Bytes as BodyBytes, extract::State as AxumState};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, types::Type};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{AccountId, ActorId, CorrelationId, RuntimeSessionId, TenantId, WorkspaceId};
use sha2::{Digest, Sha256};
use url::Url;

const ORIGIN: &str = "https://f07-runtime-test.invalid";

#[derive(Clone)]
struct MockStorage {
    payload: Arc<Mutex<Vec<u8>>>,
    fail_upload: Arc<AtomicBool>,
    fail_download: Arc<AtomicBool>,
}

#[test]
fn malformed_cookie_is_rejected_before_database_access() {
    let mut headers = HeaderMap::new();
    assert_eq!(session_cookie(&headers), None);
    headers.insert(
        header::COOKIE,
        "quantos_session=not-a-uuid".parse().unwrap(),
    );
    assert_eq!(session_cookie(&headers), None);
    let raw = Uuid::new_v4();
    headers.insert(
        header::COOKIE,
        format!("other=x; quantos_session={raw}; other=y")
            .parse()
            .unwrap(),
    );
    assert_eq!(session_cookie(&headers), Some(raw.to_string()));
}

struct Fixture {
    database_url: String,
    tenant_id: TenantId,
    actor_id: ActorId,
    workspace_id: WorkspaceId,
    account_id: AccountId,
    cookie: String,
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let database_url = self.database_url.clone();
        let tenant_id = self.tenant_id;
        let cookie = self.cookie.clone();
        let _ = std::thread::spawn(move || {
            if let Ok(mut db) = connect_admin(&database_url) {
                let _ = db.execute_typed(
                    "update quantos.workflow_runs set status='failed', completed_at=now(),
                 lease_owner=null, lease_expires_at=null, attempt_id=null,
                 last_error='F07 gateway test retired', updated_at=now()
                 where tenant_id=$1 and status in ('queued','running','cancel_requested')",
                    &[(tenant_id.as_uuid(), Type::UUID)],
                );
                let _ = db.execute_typed(
                    "update quantos.tool_registry set enabled=false, updated_at=now()
                 where tenant_id=$1 and enabled=true",
                    &[(tenant_id.as_uuid(), Type::UUID)],
                );
                let hash = format!("{:x}", Sha256::digest(cookie.as_bytes()));
                let _ = db.execute_typed(
                    "delete from quantos.bff_sessions where session_hash=$1",
                    &[(&hash, Type::TEXT)],
                );
            }
        })
        .join();
    }
}

fn connect_admin(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned());
    let options = url
        .query_pairs()
        .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let mut connection_url = url.clone();
    connection_url.set_query(None);
    if !options.is_empty() {
        connection_url.query_pairs_mut().extend_pairs(options);
    }
    let mut config: postgres::Config = connection_url
        .as_str()
        .parse()
        .expect("PostgreSQL URL parses");
    if disable_tls {
        config.ssl_mode(postgres::config::SslMode::Disable);
        config.connect(NoTls)
    } else {
        let mut builder = SslConnector::builder(SslMethod::tls()).expect("TLS connector builds");
        builder.set_verify(SslVerifyMode::PEER);
        if let Some(root) = root {
            builder.set_ca_file(root).expect("CA file loads");
        } else {
            builder
                .set_default_verify_paths()
                .expect("default CA paths load");
        }
        config.ssl_mode(postgres::config::SslMode::Require);
        config.connect(MakeTlsConnector::new(builder.build()))
    }
}

fn ensure_auth_user(db: &mut Client, user_id: Uuid) {
    let columns = db
        .query_typed(
            "select column_name from information_schema.columns
         where table_schema='auth' and table_name='users'",
            &[],
        )
        .unwrap()
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<HashSet<_>>();
    let email = format!("f07-gateway-{user_id}@example.com");
    let candidates = [
        ("id", format!("'{user_id}'::uuid")),
        ("aud", "'authenticated'".into()),
        ("role", "'authenticated'".into()),
        ("email", format!("'{email}'")),
        ("encrypted_password", "'not-used'".into()),
        ("email_confirmed_at", "now()".into()),
        ("raw_app_meta_data", "'{}'::jsonb".into()),
        ("raw_user_meta_data", "'{}'::jsonb".into()),
        ("created_at", "now()".into()),
        ("updated_at", "now()".into()),
        ("confirmation_token", "''".into()),
        ("recovery_token", "''".into()),
        ("email_change", "''".into()),
        ("email_change_token_new", "''".into()),
        ("email_change_token_current", "''".into()),
        ("email_change_confirm_status", "0".into()),
        ("is_super_admin", "false".into()),
        ("is_sso_user", "false".into()),
        ("is_anonymous", "false".into()),
    ];
    let selected = candidates
        .into_iter()
        .filter(|(name, _)| columns.contains(*name))
        .collect::<Vec<_>>();
    let names = selected
        .iter()
        .map(|(name, _)| *name)
        .collect::<Vec<_>>()
        .join(", ");
    let values = selected
        .iter()
        .map(|(_, value)| value.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    db.batch_execute(&format!(
        "insert into auth.users ({names}) values ({values}) on conflict (id) do nothing"
    ))
    .expect("isolated Auth user inserts");
}

fn seed_fixture(database_url: &str, role: &str) -> Fixture {
    assert!(matches!(role, "owner" | "operator"));
    let tenant_id = TenantId::new();
    let user_id = Uuid::now_v7();
    let mut db = connect_admin(database_url).expect("admin connects");
    ensure_auth_user(&mut db, user_id);
    let slug = format!("f07-gateway-{tenant_id}");
    db.execute_typed(
        "insert into quantos.tenants (id, slug, name) values ($1,$2,$3)",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (&slug, Type::TEXT),
            (&slug, Type::TEXT),
        ],
    )
    .unwrap();
    let workspace_id: Uuid = db
        .query_typed_one(
            "insert into quantos.workspaces (tenant_id,slug,name,is_primary)
         values ($1,'primary','Primary workspace',true) returning id",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )
        .unwrap()
        .get(0);
    let account_id: Uuid = db.query_typed_one(
        "insert into quantos.accounts (tenant_id,workspace_id,venue,external_account_ref,name,mode)
         values ($1,$2,'binance','paper-main','Paper account','paper') returning id",
        &[(tenant_id.as_uuid(), Type::UUID), (&workspace_id, Type::UUID)]).unwrap().get(0);
    db.execute_typed(
        "insert into quantos.tenant_memberships (tenant_id,user_id,role)
        values ($1,$2,$3)",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (&user_id, Type::UUID),
            (&role, Type::TEXT),
        ],
    )
    .unwrap();
    let actor_id: Uuid = db
        .query_typed_one(
            "insert into quantos.actors (tenant_id,user_id,actor_kind,display_name)
         values ($1,$2,'user','Runtime owner') returning id",
            &[(tenant_id.as_uuid(), Type::UUID), (&user_id, Type::UUID)],
        )
        .unwrap()
        .get(0);
    db.execute_typed(
        "insert into quantos.workspace_memberships
        (tenant_id,workspace_id,actor_id,role) values ($1,$2,$3,$4)",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (&workspace_id, Type::UUID),
            (&actor_id, Type::UUID),
            (&role, Type::TEXT),
        ],
    )
    .unwrap();
    db.execute_typed(
        "insert into quantos.actor_capabilities
        (tenant_id,actor_id,workspace_id,account_id,capability,mode_scope)
        values ($1,$2,$3,$4,'research.write','paper')",
        &[
            (tenant_id.as_uuid(), Type::UUID),
            (&actor_id, Type::UUID),
            (&workspace_id, Type::UUID),
            (&account_id, Type::UUID),
        ],
    )
    .unwrap();
    let cookie = Uuid::new_v4().to_string();
    let hash = format!("{:x}", Sha256::digest(cookie.as_bytes()));
    db.execute_typed("insert into quantos.bff_sessions
        (session_hash,user_id,expires_at,mfa_verified) values ($1,$2,now()+interval '5 minutes',true)",
        &[(&hash, Type::TEXT), (&user_id, Type::UUID)]).unwrap();
    Fixture {
        database_url: database_url.to_owned(),
        tenant_id,
        actor_id: ActorId::from_uuid(actor_id),
        workspace_id: WorkspaceId::from_uuid(workspace_id),
        account_id: AccountId::from_uuid(account_id),
        cookie,
    }
}

fn seed_peer_actor(database_url: &str, owner: &Fixture) -> Fixture {
    let user_id = Uuid::now_v7();
    let mut db = connect_admin(database_url).expect("admin connects for peer actor");
    ensure_auth_user(&mut db, user_id);
    db.execute_typed(
        "insert into quantos.tenant_memberships (tenant_id,user_id,role)
        values ($1,$2,'operator')",
        &[
            (owner.tenant_id.as_uuid(), Type::UUID),
            (&user_id, Type::UUID),
        ],
    )
    .unwrap();
    let actor_id: Uuid = db
        .query_typed_one(
            "insert into quantos.actors
        (tenant_id,user_id,actor_kind,display_name)
        values ($1,$2,'user','F07 same-tenant peer') returning id",
            &[
                (owner.tenant_id.as_uuid(), Type::UUID),
                (&user_id, Type::UUID),
            ],
        )
        .unwrap()
        .get(0);
    db.execute_typed(
        "insert into quantos.workspace_memberships
        (tenant_id,workspace_id,actor_id,role) values ($1,$2,$3,'operator')",
        &[
            (owner.tenant_id.as_uuid(), Type::UUID),
            (owner.workspace_id.as_uuid(), Type::UUID),
            (&actor_id, Type::UUID),
        ],
    )
    .unwrap();
    db.execute_typed(
        "insert into quantos.actor_capabilities
        (tenant_id,actor_id,workspace_id,account_id,capability,mode_scope)
        values ($1,$2,$3,$4,'research.write','paper')",
        &[
            (owner.tenant_id.as_uuid(), Type::UUID),
            (&actor_id, Type::UUID),
            (owner.workspace_id.as_uuid(), Type::UUID),
            (owner.account_id.as_uuid(), Type::UUID),
        ],
    )
    .unwrap();
    let cookie = Uuid::new_v4().to_string();
    let hash = format!("{:x}", Sha256::digest(cookie.as_bytes()));
    db.execute_typed("insert into quantos.bff_sessions
        (session_hash,user_id,expires_at,mfa_verified) values ($1,$2,now()+interval '5 minutes',true)",
        &[(&hash, Type::TEXT), (&user_id, Type::UUID)]).unwrap();
    Fixture {
        database_url: database_url.to_owned(),
        tenant_id: owner.tenant_id,
        actor_id: ActorId::from_uuid(actor_id),
        workspace_id: owner.workspace_id,
        account_id: owner.account_id,
        cookie,
    }
}

fn headers(cookie: &str, write: bool) -> HeaderMap {
    let mut result = HeaderMap::new();
    result.insert(
        header::COOKIE,
        format!("quantos_session={cookie}").parse().unwrap(),
    );
    if write {
        result.insert(header::ORIGIN, ORIGIN.parse().unwrap());
    }
    result
}

fn runtime_tool() -> ToolRegistration {
    ToolRegistration {
        tool_name: "runtime.fixture".into(),
        capability: Capability::parse(Capability::RESEARCH_WRITE).unwrap(),
        description: "F07 gateway exercise".into(),
        max_cost_units: 100,
        rate_limit_per_minute: 100,
        enabled: true,
    }
}

fn runtime_run(session_id: RuntimeSessionId, index: usize) -> NewWorkflowRun {
    NewWorkflowRun {
        runtime_session_id: session_id,
        tool_name: "runtime.fixture".into(),
        capability: Capability::parse(Capability::RESEARCH_WRITE).unwrap(),
        workflow_kind: "runtime.fixture.v1".into(),
        idempotency_key: format!("gateway-{index}"),
        correlation_id: CorrelationId::new(),
        input_hash: ContentHash::sha256_bytes(format!("gateway-input-{index}").as_bytes()),
        max_attempts: 3,
        deadline_at: Utc::now() + ChronoDuration::minutes(10),
        cost_budget_units: 10,
        rate_limit_per_minute: 100,
    }
}

#[test]
fn gateway_executes_owned_run_and_retrieves_verified_artifact() {
    let Some(raw_database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.is_empty())
    else {
        assert_ne!(
            env::var("QUANTOS_F07_DB_REQUIRED").as_deref(),
            Ok("1"),
            "F07 gateway test requires DATABASE_URL"
        );
        return;
    };
    let mut target_url = Url::parse(&raw_database_url).expect("database URL parses");
    if !matches!(
        target_url.host_str(),
        Some("localhost" | "127.0.0.1" | "::1")
    ) {
        let ca = env::var("QUANTOS_BFF_SSLROOTCERT").expect("isolated Supabase CA is required");
        let options = target_url
            .query_pairs()
            .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();
        target_url.set_query(None);
        target_url.query_pairs_mut().extend_pairs(options);
        target_url
            .query_pairs_mut()
            .append_pair("sslmode", "verify-full")
            .append_pair("sslrootcert", &ca);
    }
    let database_url = target_url.to_string();
    let fixture = seed_fixture(&database_url, "owner");
    let storage_data = MockStorage {
        payload: Arc::new(Mutex::new(Vec::new())),
        fail_upload: Arc::new(AtomicBool::new(false)),
        fail_download: Arc::new(AtomicBool::new(false)),
    };
    async fn upload(AxumState(data): AxumState<MockStorage>, body: BodyBytes) -> StatusCode {
        if data.fail_upload.load(Ordering::SeqCst) {
            return StatusCode::SERVICE_UNAVAILABLE;
        }
        *data.payload.lock().unwrap() = body.to_vec();
        StatusCode::OK
    }
    async fn download(AxumState(data): AxumState<MockStorage>) -> Result<BodyBytes, StatusCode> {
        if data.fail_download.load(Ordering::SeqCst) {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        Ok(BodyBytes::from(data.payload.lock().unwrap().clone()))
    }
    let storage_router = Router::new()
        .route("/storage/v1/object/*path", post(upload).get(download))
        .with_state(storage_data.clone());
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    std_listener.set_nonblocking(true).unwrap();
    let storage_url = format!("http://{}", std_listener.local_addr().unwrap());
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let listener =
        runtime.block_on(async move { tokio::net::TcpListener::from_std(std_listener).unwrap() });
    let storage_server = runtime.spawn(async move {
        axum::serve(listener, storage_router).await.unwrap();
    });
    let storage = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: storage_url.clone(),
        bucket_name: "quantos-artifacts".into(),
        api_key: "test-key".into(),
        authorization_token: None,
        upsert: true,
    })
    .unwrap();
    let state = Arc::new(AppState {
        auth: Mutex::new(GatewayAuthMiddleware::connect(&database_url).unwrap()),
        store: Mutex::new(PgRuntimeStore::connect(&database_url).unwrap()),
        storage,
        origin: ORIGIN.into(),
        worker_healthy: Arc::new(AtomicBool::new(true)),
    });
    runtime.block_on(async {
        assert_eq!(health(State(state.clone())).await, StatusCode::NO_CONTENT);
        state.worker_healthy.store(false, Ordering::SeqCst);
        assert_eq!(
            health(State(state.clone())).await,
            StatusCode::SERVICE_UNAVAILABLE
        );
        state.worker_healthy.store(true, Ordering::SeqCst);
        let missing = create_session(State(state.clone()), HeaderMap::new()).await;
        assert_eq!(missing.unwrap_err(), StatusCode::FORBIDDEN);
        let mut origin_only = HeaderMap::new();
        origin_only.insert(header::ORIGIN, ORIGIN.parse().unwrap());
        assert_eq!(
            create_session(State(state.clone()), origin_only)
                .await
                .unwrap_err(),
            StatusCode::UNAUTHORIZED
        );
        let foreign = headers(&fixture.cookie, false);
        assert_eq!(
            create_session(State(state.clone()), foreign)
                .await
                .unwrap_err(),
            StatusCode::FORBIDDEN
        );
        let (_, Json(session_value)) =
            create_session(State(state.clone()), headers(&fixture.cookie, true))
                .await
                .expect("owner session creates");
        assert_eq!(session_value["tenant_id"], fixture.tenant_id.to_string());
        assert_eq!(session_value["actor_id"], fixture.actor_id.to_string());
        assert_eq!(
            session_value["workspace_id"],
            fixture.workspace_id.to_string()
        );
        assert_eq!(session_value["account_id"], fixture.account_id.to_string());
        let session_id = RuntimeSessionId::from_uuid(
            Uuid::parse_str(session_value["runtime_session_id"].as_str().unwrap()).unwrap(),
        );
        let Json(tool_value) = register_tool(
            State(state.clone()),
            headers(&fixture.cookie, true),
            Json(runtime_tool()),
        )
        .await
        .expect("owner registers fixture tool");
        assert_eq!(tool_value["tool_name"], "runtime.fixture");
        assert!(
            register_tool(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(runtime_tool())
            )
            .await
            .is_ok(),
            "re-registering an identical tool is idempotent"
        );
        let mut invalid_tool = runtime_tool();
        invalid_tool.tool_name = "unsafe.tool".into();
        assert_eq!(
            register_tool(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(invalid_tool)
            )
            .await
            .unwrap_err(),
            StatusCode::BAD_REQUEST
        );
        let mut invalid_capability_tool = runtime_tool();
        invalid_capability_tool.capability = Capability::parse("strategy.write").unwrap();
        assert_eq!(register_tool(State(state.clone()), headers(&fixture.cookie, true),
            Json(invalid_capability_tool)).await.unwrap_err(), StatusCode::BAD_REQUEST);
        let invalid = NewWorkflowRun {
            workflow_kind: "other".into(),
            ..runtime_run(session_id, 0)
        };
        assert_eq!(
            schedule(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(invalid)
            )
            .await
            .unwrap_err(),
            StatusCode::BAD_REQUEST
        );
        let invalid_tool_run = NewWorkflowRun {
            tool_name: "unsafe.tool".into(),
            ..runtime_run(session_id, 0)
        };
        assert_eq!(
            schedule(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(invalid_tool_run)
            )
            .await
            .unwrap_err(),
            StatusCode::BAD_REQUEST
        );
        let invalid_capability_run = NewWorkflowRun {
            capability: Capability::parse("strategy.write").unwrap(),
            ..runtime_run(session_id, 0)
        };
        assert_eq!(schedule(State(state.clone()), headers(&fixture.cookie, true),
            Json(invalid_capability_run)).await.unwrap_err(), StatusCode::BAD_REQUEST);
        assert_eq!(
            schedule(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(runtime_run(RuntimeSessionId::new(), 0))
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        let (_, Json(run_value)) = schedule(
            State(state.clone()),
            headers(&fixture.cookie, true),
            Json(runtime_run(session_id, 1)),
        )
        .await
        .expect("run schedules");
        let run_id = Uuid::parse_str(run_value["workflow_run_id"].as_str().unwrap()).unwrap();
        let conflict = NewWorkflowRun {
            input_hash: ContentHash::sha256_bytes(b"different"),
            ..runtime_run(session_id, 1)
        };
        assert_eq!(
            schedule(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Json(conflict)
            )
            .await
            .unwrap_err(),
            StatusCode::CONFLICT
        );
        let Json(loaded) = get_run(
            State(state.clone()),
            headers(&fixture.cookie, false),
            Path(run_id),
        )
        .await
        .expect("owner reads run");
        assert_eq!(loaded["workflow_run_id"], run_value["workflow_run_id"]);
        assert_eq!(
            get_run(
                State(state.clone()),
                headers(&fixture.cookie, false),
                Path(Uuid::new_v4())
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        let worker_url = database_url.clone();
        let worker_storage_url = storage_url.clone();
        tokio::task::spawn_blocking(move || {
            let mut worker_store = PgRuntimeStore::connect(&worker_url).unwrap();
            let worker_storage = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
                project_url: worker_storage_url,
                bucket_name: "quantos-artifacts".into(),
                api_key: "test-key".into(),
                authorization_token: None,
                upsert: true,
            })
            .unwrap();
            worker_once(&mut worker_store, &worker_storage)
        })
        .await
        .unwrap()
        .expect("worker completes fixture run");
        let Json(completed) = get_run(
            State(state.clone()),
            headers(&fixture.cookie, false),
            Path(run_id),
        )
        .await
        .expect("owner reads completed run");
        assert_eq!(completed["status"], "succeeded");
        let artifact_id: Uuid =
            tokio::task::block_in_place(|| {
                let mut db = connect_admin(&database_url).unwrap();
                db.query_typed_one(
            "select artifact_id from quantos.workflow_run_artifacts where workflow_run_id=$1",
            &[(&run_id, Type::UUID)]).map(|row| row.get(0))
            })
            .expect("worker records the artifact binding");
        let (_, bytes) = get_artifact(
            State(state.clone()),
            headers(&fixture.cookie, false),
            Path((run_id, artifact_id)),
        )
        .await
        .expect("owner retrieves verified artifact");
        assert_eq!(
            bytes.as_ref(),
            storage_data.payload.lock().unwrap().as_slice()
        );
        storage_data.fail_download.store(true, Ordering::SeqCst);
        assert_eq!(
            get_artifact(
                State(state.clone()),
                headers(&fixture.cookie, false),
                Path((run_id, artifact_id))
            )
            .await
            .unwrap_err(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        storage_data.fail_download.store(false, Ordering::SeqCst);
        assert_eq!(
            get_artifact(
                State(state.clone()),
                headers(&fixture.cookie, false),
                Path((run_id, Uuid::new_v4()))
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            cancel_run(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Path(Uuid::new_v4())
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        let (_, Json(cancel_value)) = schedule(
            State(state.clone()),
            headers(&fixture.cookie, true),
            Json(runtime_run(session_id, 2)),
        )
        .await
        .expect("cancellable run schedules");
        let cancel_id = Uuid::parse_str(cancel_value["workflow_run_id"].as_str().unwrap()).unwrap();
        assert_eq!(
            cancel_run(
                State(state.clone()),
                headers(&fixture.cookie, true),
                Path(cancel_id)
            )
            .await
            .unwrap(),
            StatusCode::ACCEPTED
        );
        let cancel_url = database_url.clone();
        let cancel_storage_url = storage_url.clone();
        tokio::task::spawn_blocking(move || {
            let mut store = PgRuntimeStore::connect(&cancel_url).unwrap();
            let storage = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
                project_url: cancel_storage_url,
                bucket_name: "quantos-artifacts".into(),
                api_key: "test-key".into(),
                authorization_token: None,
                upsert: true,
            })
            .unwrap();
            worker_once(&mut store, &storage)
        })
        .await
        .unwrap()
        .expect("worker finalizes cancellation without Storage");
        let Json(cancelled) = get_run(
            State(state.clone()),
            headers(&fixture.cookie, false),
            Path(cancel_id),
        )
        .await
        .unwrap();
        assert_eq!(cancelled["status"], "cancelled");
        let failure_url = database_url.clone();
        let failure_storage_url = storage_url.clone();
        let fail_upload = storage_data.fail_upload.clone();
        tokio::task::spawn_blocking(move || {
            let mut store = PgRuntimeStore::connect(&failure_url).unwrap();
            let mut unsupported = runtime_run(session_id, 4);
            unsupported.workflow_kind = "unsupported".into();
            unsupported.max_attempts = 1;
            let unsupported_id = store
                .schedule_run(&unsupported, Utc::now())
                .unwrap()
                .workflow_run_id;
            let mut budget = runtime_run(session_id, 5);
            budget.cost_budget_units = 0;
            budget.max_attempts = 1;
            let budget_id = store
                .schedule_run(&budget, Utc::now())
                .unwrap()
                .workflow_run_id;
            let mut retry = runtime_run(session_id, 6);
            retry.max_attempts = 2;
            let retry_id = store
                .schedule_run(&retry, Utc::now())
                .unwrap()
                .workflow_run_id;
            let storage = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
                project_url: failure_storage_url,
                bucket_name: "quantos-artifacts".into(),
                api_key: "test-key".into(),
                authorization_token: None,
                upsert: true,
            })
            .unwrap();
            worker_once(&mut store, &storage).unwrap();
            worker_once(&mut store, &storage).unwrap();
            assert_eq!(
                store.load_run(unsupported_id).unwrap().unwrap().status,
                quantos_runtime::WorkflowRunStatus::Failed
            );
            assert_eq!(
                store.load_run(budget_id).unwrap().unwrap().status,
                quantos_runtime::WorkflowRunStatus::Failed
            );
            fail_upload.store(true, Ordering::SeqCst);
            worker_once(&mut store, &storage).unwrap();
            assert_eq!(
                store.load_run(retry_id).unwrap().unwrap().status,
                quantos_runtime::WorkflowRunStatus::Queued
            );
            assert!(store.load_checkpoint(retry_id).unwrap().is_some());
            fail_upload.store(false, Ordering::SeqCst);
            std::thread::sleep(Duration::from_millis(1100));
            worker_once(&mut store, &storage).unwrap();
            assert_eq!(
                store.load_run(retry_id).unwrap().unwrap().status,
                quantos_runtime::WorkflowRunStatus::Succeeded
            );
            assert_eq!(store.workflow_artifact_count(retry_id).unwrap(), 1);
        })
        .await
        .unwrap();
        let peer = tokio::task::block_in_place(|| seed_peer_actor(&database_url, &fixture));
        assert_eq!(get_run(State(state.clone()), headers(&peer.cookie, false), Path(run_id))
            .await.unwrap_err(), StatusCode::NOT_FOUND);
        assert_eq!(cancel_run(State(state.clone()), headers(&peer.cookie, true), Path(run_id))
            .await.unwrap_err(), StatusCode::NOT_FOUND);
        assert_eq!(get_artifact(State(state.clone()), headers(&peer.cookie, false),
            Path((run_id, artifact_id))).await.unwrap_err(), StatusCode::NOT_FOUND);
        assert_eq!(schedule(State(state.clone()), headers(&peer.cookie, true),
            Json(runtime_run(session_id, 9))).await.unwrap_err(), StatusCode::FORBIDDEN);
        let operator = tokio::task::block_in_place(|| seed_fixture(&database_url, "operator"));
        assert_eq!(
            register_tool(
                State(state.clone()),
                headers(&operator.cookie, true),
                Json(runtime_tool())
            )
            .await
            .unwrap_err(),
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            get_run(
                State(state.clone()),
                headers(&operator.cookie, false),
                Path(run_id)
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            cancel_run(
                State(state.clone()),
                headers(&operator.cookie, true),
                Path(run_id)
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            get_artifact(
                State(state.clone()),
                headers(&operator.cookie, false),
                Path((run_id, artifact_id))
            )
            .await
            .unwrap_err(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            schedule(
                State(state.clone()),
                headers(&operator.cookie, true),
                Json(runtime_run(session_id, 3))
            )
            .await
            .unwrap_err(),
            StatusCode::FORBIDDEN
        );
        let expired_url = database_url.clone();
        tokio::task::spawn_blocking(move || {
            let mut db = connect_admin(&expired_url).unwrap();
            db.execute_typed("update quantos.runtime_sessions set created_at=now()-interval '1 hour', expires_at=now()-interval '1 second' where id=$1",
                &[(session_id.as_uuid(), Type::UUID)]).unwrap();
        }).await.unwrap();
        assert_eq!(schedule(State(state.clone()), headers(&fixture.cookie, true),
            Json(runtime_run(session_id, 7))).await.unwrap_err(), StatusCode::FORBIDDEN);
        let poisoned_store = state.clone();
        let _ = std::thread::spawn(move || {
            let _guard = poisoned_store.store.lock().unwrap();
            panic!("intentional F07 poisoned-store probe");
        }).join();
        assert_eq!(create_session(State(state.clone()), headers(&fixture.cookie, true))
            .await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(register_tool(State(state.clone()), headers(&fixture.cookie, true),
            Json(runtime_tool())).await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(schedule(State(state.clone()), headers(&fixture.cookie, true),
            Json(runtime_run(session_id, 8))).await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(get_run(State(state.clone()), headers(&fixture.cookie, false), Path(run_id))
            .await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(cancel_run(State(state.clone()), headers(&fixture.cookie, true), Path(run_id))
            .await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(get_artifact(State(state.clone()), headers(&fixture.cookie, false),
            Path((run_id, artifact_id))).await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        let poisoned_auth = state.clone();
        let _ = std::thread::spawn(move || {
            let _guard = poisoned_auth.auth.lock().unwrap();
            panic!("intentional F07 poisoned-auth probe");
        }).join();
        assert_eq!(get_run(State(state.clone()), headers(&fixture.cookie, false), Path(run_id))
            .await.unwrap_err(), StatusCode::SERVICE_UNAVAILABLE);
        storage_server.abort();
        drop(peer);
        drop(operator);
    });
    drop(state);
    drop(runtime);
    drop(fixture);
}
