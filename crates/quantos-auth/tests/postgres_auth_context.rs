use std::{collections::HashSet, env, time::Instant};

use chrono::{Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_auth::{ExecutionSecretStore, GatewayAuthMiddleware, PgAuthStore};
use quantos_core::{AccountId, TenantId};
use quantos_policy::{AuthorizationRequirement, Capability, RunMode};
use sha2::{Digest, Sha256};
use url::Url;
use uuid::Uuid;

struct Cleanup {
    database_url: String,
    tenant_id: TenantId,
    user_id: Uuid,
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute_typed(
                "delete from quantos.tenants where id = $1",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            );
            let _ = client.execute_typed(
                "delete from auth.users where id = $1",
                &[(&self.user_id, Type::UUID)],
            );
        }
    }
}

#[test]
fn gateway_auth_loads_primary_workspace_context_and_enforces_capability_checks() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        assert_ne!(
            env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
            Ok("1"),
            "F06 live Gate requires DATABASE_URL"
        );
        eprintln!("NOT RUN: F06 PostgreSQL test requires DATABASE_URL");
        return;
    };

    let tenant_id = TenantId::new();
    let user_id = Uuid::now_v7();
    let fixture = seed_auth_fixture(&database_url, tenant_id, user_id);

    let mut middleware =
        GatewayAuthMiddleware::connect(&database_url).expect("connects to PostgreSQL");
    let request = quantos_auth::UserRequestContext {
        user_id,
        tenant_id,
        mode: RunMode::Paper,
        account_id: Some(fixture.account_id),
    };

    let context = middleware
        .authorize_user_request(
            &request,
            &AuthorizationRequirement::new(
                Capability::parse(Capability::EXECUTION_OPERATE).expect("static capability parses"),
            )
            .requiring_account(),
        )
        .expect("operator with execution capability is authorized");

    assert_eq!(context.tenant_id, tenant_id);
    assert_eq!(context.workspace_slug, "primary");
    assert_eq!(context.account_id, Some(fixture.account_id));

    let denied = middleware
        .authorize_user_request(
            &request,
            &AuthorizationRequirement::new(
                Capability::parse(Capability::STRATEGY_APPROVE).expect("static capability parses"),
            ),
        )
        .expect_err("operator should not inherit strategy approval");
    assert!(denied.to_string().contains("POLICY_CAPABILITY_DENIED"));

    // An account cannot be authorized under a caller-selected different mode.
    let mut client = connect_client(&database_url).expect("connect for mode probe");
    client
        .execute_typed(
            "update quantos.accounts set mode = 'shadow' where id = $1",
            &[(fixture.account_id.as_uuid(), Type::UUID)],
        )
        .expect("switch fixture account mode");
    assert!(
        middleware
            .authorize_user_request(
                &request,
                &AuthorizationRequirement::new(
                    Capability::parse(Capability::EXECUTION_OPERATE).unwrap()
                )
                .requiring_account(),
            )
            .is_err()
    );
}

/// Read-only latency Gate over the same restricted login as the live BFF.
/// Existing isolated identity data is used; this test creates no fixture.
#[test]
fn f06_dedicated_bff_auth_read_p95() {
    if env::var("QUANTOS_RUN_F06_P95").as_deref() != Ok("1") {
        eprintln!("NOT RUN: set QUANTOS_RUN_F06_P95=1 for the dedicated BFF P95 Gate");
        return;
    }
    let database_url = env::var("QUANTOS_BFF_DATABASE_URL")
        .expect("F06 P95 Gate requires QUANTOS_BFF_DATABASE_URL");
    let topology =
        env::var("QUANTOS_F06_TOPOLOGY").expect("F06 P95 Gate requires an explicit topology");
    assert_eq!(
        topology, "developer_remote",
        "F06 P95 only measures developer_remote"
    );
    let limit_ms = 500;
    let user_id =
        Uuid::parse_str(&env::var("QUANTOS_F06_TEST_USER_ID").expect("F06 test user is required"))
            .expect("F06 test user must be a UUID");
    let tenant_id = TenantId::from_uuid(
        Uuid::parse_str(&env::var("QUANTOS_F06_TEST_TENANT_ID").expect("F06 tenant is required"))
            .expect("F06 tenant must be a UUID"),
    );
    let account_id = AccountId::from_uuid(
        Uuid::parse_str(&env::var("QUANTOS_F06_TEST_ACCOUNT_ID").expect("F06 account is required"))
            .expect("F06 account must be a UUID"),
    );
    let request = quantos_auth::UserRequestContext {
        user_id,
        tenant_id,
        mode: RunMode::Paper,
        account_id: Some(account_id),
    };
    let requirement = AuthorizationRequirement::new(
        Capability::parse(Capability::EXECUTION_OPERATE).expect("static capability parses"),
    )
    .requiring_account();
    let mut middleware = GatewayAuthMiddleware::connect_as_bff(&database_url)
        .expect("dedicated BFF login with verified TLS is required");
    for _ in 0..5 {
        middleware
            .authorize_user_request(&request, &requirement)
            .expect("warm-up authorization succeeds");
    }
    let mut samples = Vec::with_capacity(100);
    for _ in 0..100 {
        let started = Instant::now();
        middleware
            .authorize_user_request(&request, &requirement)
            .expect("authorization succeeds");
        samples.push(started.elapsed());
    }
    samples.sort_unstable();
    let p95 = samples[94];
    let p50 = samples[49];
    eprintln!(
        "F06_P95_RESULT {{\"topology\":\"{topology}\",\"samples\":100,\"p50Micros\":{},\"p95Micros\":{},\"limitMillis\":{limit_ms},\"dedicatedBffLogin\":true,\"verifiedTls\":true}}",
        p50.as_micros(),
        p95.as_micros()
    );
    assert!(
        p95 < std::time::Duration::from_millis(limit_ms),
        "F06 dedicated BFF authorization P95 exceeded the {topology} <{limit_ms}ms Gate"
    );
}

#[test]
fn gateway_auth_only_allows_service_secret_resolution_via_allowlist_session() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        assert_ne!(
            env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
            Ok("1"),
            "F06 live Gate requires DATABASE_URL"
        );
        eprintln!("NOT RUN: F06 PostgreSQL test requires DATABASE_URL");
        return;
    };

    let tenant_id = TenantId::new();
    let user_id = Uuid::now_v7();
    let fixture = seed_auth_fixture(&database_url, tenant_id, user_id);

    let mut middleware =
        GatewayAuthMiddleware::connect(&database_url).expect("connects to PostgreSQL");
    let grant = middleware
        .authorize_secret_resolution(
            &fixture.session_token_hash,
            "venue.binance.paper",
            Utc::now(),
        )
        .expect("service allowlist secret access should succeed");
    assert_eq!(grant.secret_name, "venue.binance.paper");
    assert_eq!(
        grant.required_capability.as_str(),
        Capability::EXECUTION_OPERATE
    );

    let denied = middleware
        .authorize_secret_resolution(&fixture.session_token_hash, "missing.secret", Utc::now())
        .expect_err("unknown secret should fail");
    assert!(
        denied
            .to_string()
            .contains("secret allowlist entry `missing.secret` is unavailable")
    );

    let mut client = connect_client(&database_url).expect("connect for revocation probe");
    client
        .execute_typed(
            "update quantos.secret_references set rotation_state = 'revoked' where tenant_id = $1",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )
        .expect("revoke fixture reference");
    assert!(
        middleware
            .authorize_secret_resolution(
                &fixture.session_token_hash,
                "venue.binance.paper",
                Utc::now(),
            )
            .is_err()
    );
}

#[test]
fn cross_tenant_membership_is_rejected_by_database_constraint() {
    let Some(database_url) = env::var("DATABASE_URL").ok().filter(|v| !v.is_empty()) else {
        assert_ne!(
            env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
            Ok("1"),
            "F06 live Gate requires DATABASE_URL"
        );
        eprintln!("NOT RUN: F06 PostgreSQL test requires DATABASE_URL");
        return;
    };
    let mut client = connect_client(&database_url).expect("connect for tenant isolation probe");
    client.batch_execute("begin").expect("begin isolated probe");
    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    let actor: Uuid = client
        .query_one(
            "with tenants as (
           insert into quantos.tenants(id, slug, name)
           values ($1, $3, 'A'), ($2, $4, 'B') returning id
         )
         insert into quantos.actors(tenant_id, actor_kind, display_name, service_name)
         values ($1, 'service', 'F06 probe', 'f06-probe') returning id",
            &[&a, &b, &format!("f06-a-{a}"), &format!("f06-b-{b}")],
        )
        .expect("seed actor")
        .get(0);
    let workspace: Uuid = client
        .query_one(
            "insert into quantos.workspaces(tenant_id, slug, name, is_primary)
         values ($1, 'primary', 'Primary', true) returning id",
            &[&b],
        )
        .expect("seed workspace")
        .get(0);
    let err = client
        .execute(
            "insert into quantos.workspace_memberships(tenant_id, workspace_id, actor_id, role)
         values ($1, $2, $3, 'service')",
            &[&a, &workspace, &actor],
        )
        .expect_err("cross-tenant membership must fail");
    assert_eq!(
        err.code(),
        Some(&postgres::error::SqlState::FOREIGN_KEY_VIOLATION)
    );
    client.batch_execute("rollback").expect("rollback probe");
}

#[test]
fn authenticated_role_cannot_read_other_tenant_workspace() {
    let Some(database_url) = env::var("DATABASE_URL").ok().filter(|v| !v.is_empty()) else {
        assert_ne!(
            env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
            Ok("1"),
            "F06 live Gate requires DATABASE_URL"
        );
        eprintln!("NOT RUN: F06 PostgreSQL test requires DATABASE_URL");
        return;
    };
    let tenant_a = TenantId::new();
    let tenant_b = TenantId::new();
    let user_a = Uuid::now_v7();
    let user_b = Uuid::now_v7();
    let _fixture_a = seed_auth_fixture(&database_url, tenant_a, user_a);
    let _fixture_b = seed_auth_fixture(&database_url, tenant_b, user_b);
    let mut client = connect_client(&database_url).expect("connect for RLS probe");
    client
        .batch_execute(
            "begin;
        grant usage on schema quantos to authenticated;
        grant select on quantos.workspaces to authenticated;
        set local role authenticated",
        )
        .expect("assume user role with fixture API grants");
    client
        .query_one(
            "select set_config('request.jwt.claim.sub',$1,true)",
            &[&user_a.to_string()],
        )
        .expect("set authenticated subject");
    let rows = client
        .query(
            "select tenant_id from quantos.workspaces where tenant_id in ($1,$2)",
            &[tenant_a.as_uuid(), tenant_b.as_uuid()],
        )
        .expect("RLS workspace query");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].get::<_, Uuid>(0), *tenant_a.as_uuid());
    let denied_without_mode: bool = client
        .query_one(
            "select quantos.current_user_has_capability($1, 'execution.operate', null, $2)",
            &[tenant_a.as_uuid(), _fixture_a.account_id.as_uuid()],
        )
        .expect("capability helper rejects missing mode")
        .get(0);
    assert!(!denied_without_mode);
    let allowed_with_mode: bool = client
        .query_one(
            "select quantos.current_user_has_capability($1, 'execution.operate', 'paper', $2)",
            &[tenant_a.as_uuid(), _fixture_a.account_id.as_uuid()],
        )
        .expect("capability helper accepts matching mode")
        .get(0);
    assert!(allowed_with_mode);
    client
        .batch_execute("rollback")
        .expect("rollback RLS probe");
}

#[test]
fn f06_four_category_denial_matrix() {
    let database_url = match env::var("DATABASE_URL").ok().filter(|v| !v.is_empty()) {
        Some(url) => url,
        None => {
            assert_ne!(
                env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
                Ok("1"),
                "F06 denial matrix requires DATABASE_URL"
            );
            eprintln!("NOT RUN: F06 denial matrix requires DATABASE_URL");
            return;
        }
    };
    let tenant_a = TenantId::new();
    let tenant_b = TenantId::new();
    let user_a = Uuid::now_v7();
    let user_b = Uuid::now_v7();
    let fixture_a = seed_auth_fixture(&database_url, tenant_a, user_a);
    let _fixture_b = seed_auth_fixture(&database_url, tenant_b, user_b);
    let mut denied = 0;
    let engine_sqlstate;
    let mut middleware = GatewayAuthMiddleware::connect(&database_url).expect("connect auth store");
    let requirement =
        AuthorizationRequirement::new(Capability::parse(Capability::EXECUTION_OPERATE).unwrap())
            .requiring_account();

    // 1: An unknown actor or caller-selected tenant cannot create a context.
    for (user_id, tenant_id) in [(Uuid::now_v7(), tenant_a), (user_a, tenant_b)] {
        assert!(
            middleware
                .authorize_user_request(
                    &quantos_auth::UserRequestContext {
                        user_id,
                        tenant_id,
                        mode: RunMode::Paper,
                        account_id: Some(fixture_a.account_id),
                    },
                    &requirement
                )
                .is_err()
        );
    }
    denied += 1;

    // 2: A real mapped actor cannot invoke an ungranted capability.
    assert!(
        middleware
            .authorize_user_request(
                &quantos_auth::UserRequestContext {
                    user_id: user_a,
                    tenant_id: tenant_a,
                    mode: RunMode::Paper,
                    account_id: Some(fixture_a.account_id),
                },
                &AuthorizationRequirement::new(
                    Capability::parse(Capability::STRATEGY_APPROVE).unwrap()
                )
            )
            .is_err()
    );
    denied += 1;

    let mut client = connect_client(&database_url).expect("connect role probes");
    let login: String = client.query_one("select current_user", &[]).unwrap().get(0);
    let quoted_login = format!("\"{}\"", login.replace('"', "\"\""));
    client
        .batch_execute("begin")
        .expect("start rollback-only role probes");
    {
        client
            .batch_execute(&format!(
                "grant authenticated, quantos_engine to {quoted_login}; \
             grant usage on schema quantos to authenticated; \
             grant select on quantos.workspaces to authenticated; \
             set local role authenticated"
            ))
            .expect("assume authenticated role");
        client
            .query_one(
                "select set_config('request.jwt.claim.sub',$1,true)",
                &[&user_a.to_string()],
            )
            .expect("set authenticated subject");
        // 3: A direct SQL read cannot bypass RLS to see a second tenant.
        let count: i64 = client
            .query_one(
                "select count(*) from quantos.workspaces where tenant_id=$1",
                &[tenant_b.as_uuid()],
            )
            .expect("RLS read")
            .get(0);
        assert_eq!(count, 0, "cross-tenant workspace leaked through RLS");
        denied += 1;
        client
            .batch_execute("reset role; savepoint engine_denial")
            .unwrap();
        client
            .batch_execute("set local role quantos_engine")
            .expect("assume engine role");
        // 4: Engine cannot execute the Vault decryption function.
        let error = client
            .query(
                "select quantos.resolve_execution_vault_secret($1,$2,$3,$4)",
                &[
                    &"invalid-session",
                    &"invalid-secret",
                    &Utc::now(),
                    &Uuid::nil(),
                ],
            )
            .expect_err("Engine reached Vault secret resolver");
        assert_eq!(
            error.code(),
            Some(&postgres::error::SqlState::INSUFFICIENT_PRIVILEGE)
        );
        engine_sqlstate = error.code().map(|code| code.code().to_owned());
        denied += 1;
    }
    client
        .batch_execute("rollback")
        .expect("rollback role probes");
    assert_eq!(denied, 4);
    eprintln!(
        "F06_DENIAL_MATRIX={}",
        serde_json::json!({
            "status": "PASS",
            "denied": denied,
            "total": 4,
            "cases": [
                { "category": "missing_actor_or_tenant", "probes": 2, "denied": 2, "layer": "auth_middleware" },
                { "category": "capability", "probes": 1, "denied": 1, "layer": "auth_middleware" },
                { "category": "rls_bypass", "probes": 1, "denied": 1, "role": "authenticated", "result": "zero_rows" },
                { "category": "engine_secret", "probes": 1, "denied": 1, "role": "quantos_engine", "sqlstate": engine_sqlstate },
            ],
        })
    );
}

#[test]
fn bff_session_is_bound_to_its_primary_account_and_revocation() {
    let database_url = match env::var("DATABASE_URL").ok().filter(|v| !v.is_empty()) {
        Some(url) => url,
        None => {
            assert_ne!(
                env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
                Ok("1"),
                "F06 BFF session test requires DATABASE_URL"
            );
            eprintln!("NOT RUN: F06 BFF session test requires DATABASE_URL");
            return;
        }
    };
    let user_a = Uuid::now_v7();
    let user_b = Uuid::now_v7();
    let tenant_a = TenantId::new();
    let tenant_b = TenantId::new();
    let fixture_a = seed_auth_fixture(&database_url, tenant_a, user_a);
    let fixture_b = seed_auth_fixture(&database_url, tenant_b, user_b);
    let raw = Uuid::new_v4().to_string();
    let hash = format!("{:x}", Sha256::digest(raw.as_bytes()));
    let mut client = connect_client(&database_url).expect("connect session fixture");
    client
        .execute(
            "insert into quantos.bff_sessions(session_hash,user_id,expires_at,mfa_verified)
        values($1,$2,now()+interval '5 minutes',false)",
            &[&hash, &user_a],
        )
        .expect("insert opaque BFF session fixture");
    let mut middleware = GatewayAuthMiddleware::connect(&database_url).expect("connect auth store");
    let context = middleware
        .load_bff_session_context(&raw, None)
        .expect("load primary account");
    assert_eq!(context.auth.account_id, Some(fixture_a.account_id));
    assert!(!context.mfa_verified);
    middleware
        .authorize_bff_session(
            &raw,
            None,
            &AuthorizationRequirement::new(
                Capability::parse(Capability::EXECUTION_OPERATE).unwrap(),
            )
            .requiring_account(),
        )
        .expect("primary BFF session has its scoped capability");
    assert!(matches!(
        middleware.authorize_bff_session(
            &raw,
            None,
            &AuthorizationRequirement::new(
                Capability::parse(Capability::STRATEGY_APPROVE).unwrap()
            ),
        ),
        Err(quantos_auth::AuthError::Policy(_))
    ));
    assert!(matches!(
        middleware.load_bff_session_context(&raw, Some(fixture_b.account_id)),
        Err(quantos_auth::AuthError::HiddenAccount)
    ));
    middleware
        .revoke_bff_session(&raw)
        .expect("revoke server session");
    assert!(middleware.load_bff_session_context(&raw, None).is_err());
}

#[test]
fn operator_connection_cannot_be_reused_without_verified_tls() {
    let Some(database_url) = env::var("DATABASE_URL").ok().filter(|v| !v.is_empty()) else {
        assert_ne!(
            env::var("QUANTOS_RUN_F06_POSTGRES_TESTS").as_deref(),
            Ok("1"),
            "F06 live Gate requires DATABASE_URL"
        );
        eprintln!("NOT RUN: F06 PostgreSQL test requires DATABASE_URL");
        return;
    };
    PgAuthStore::connect(&database_url).unwrap_or_else(|error| {
        let mut detail = error.to_string();
        let mut source = std::error::Error::source(&error);
        while let Some(cause) = source {
            detail.push_str(&format!(" -> {cause}"));
            source = cause.source();
        }
        panic!("operator URL must connect with verified TLS: {detail}")
    });
    assert!(
        PgAuthStore::connect_as_bff(&database_url).is_err(),
        "operator URL without verify-full must not become a BFF connection"
    );
    assert!(
        ExecutionSecretStore::connect(&database_url).is_err(),
        "operator URL without verify-full must not become an Execution connection"
    );
}

#[test]
fn dedicated_bff_login_uses_verified_tls_and_narrow_role() {
    let database_url = match env::var("QUANTOS_BFF_DATABASE_URL")
        .ok()
        .filter(|v| !v.is_empty())
    {
        Some(url) => url,
        None => {
            assert_ne!(
                env::var("QUANTOS_RUN_F06_BFF_LOGIN_TESTS").as_deref(),
                Ok("1"),
                "F06 dedicated BFF login check requires QUANTOS_BFF_DATABASE_URL"
            );
            eprintln!("NOT RUN: dedicated BFF login is not configured");
            return;
        }
    };
    let mut store = PgAuthStore::connect_as_bff(&database_url)
        .expect("dedicated BFF login must connect with verified TLS and assume only quantos_bff");
    let missing = store.load_user_context(Uuid::now_v7(), TenantId::new(), RunMode::Paper, None);
    assert!(
        matches!(
            missing,
            Err(quantos_auth::AuthError::MissingIdentityMapping { .. })
        ),
        "BFF login must read scoped identity tables without broad privileges"
    );
}

struct SeededFixture {
    account_id: AccountId,
    session_token_hash: String,
    _cleanup: Cleanup,
}

fn seed_auth_fixture(database_url: &str, tenant_id: TenantId, user_id: Uuid) -> SeededFixture {
    let mut client = connect_client(database_url).expect("connects for setup");
    ensure_auth_user(&mut client, user_id, &format!("f06-{user_id}@example.com"));

    let slug = format!("f06-{}", tenant_id);
    client
        .execute_typed(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&slug, Type::TEXT),
                (&slug, Type::TEXT),
            ],
        )
        .expect("tenant inserts");

    let workspace_id: Uuid = client
        .query_typed_one(
            "insert into quantos.workspaces (tenant_id, slug, name, is_primary)
             values ($1, 'primary', 'Primary workspace', true)
             returning id",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )
        .expect("workspace inserts")
        .get("id");

    client
        .execute_typed(
            "insert into quantos.tenant_memberships (tenant_id, user_id, role)
             values ($1, $2, 'operator')",
            &[(tenant_id.as_uuid(), Type::UUID), (&user_id, Type::UUID)],
        )
        .expect("tenant membership inserts");

    let actor_id: Uuid = client
        .query_typed_one(
            "insert into quantos.actors (tenant_id, user_id, actor_kind, display_name)
             values ($1, $2, 'user', 'Primary operator')
             returning id",
            &[(tenant_id.as_uuid(), Type::UUID), (&user_id, Type::UUID)],
        )
        .expect("user actor inserts")
        .get("id");

    client
        .execute_typed(
            "insert into quantos.workspace_memberships (tenant_id, workspace_id, actor_id, role)
             values ($1, $2, $3, 'operator')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&workspace_id, Type::UUID),
                (&actor_id, Type::UUID),
            ],
        )
        .expect("workspace membership inserts");

    let account_uuid: Uuid = client
        .query_typed_one(
            "insert into quantos.accounts (tenant_id, workspace_id, venue, external_account_ref, name, mode)
             values ($1, $2, 'binance', 'paper-main', 'Paper account', 'paper')
             returning id",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&workspace_id, Type::UUID),
            ],
        )
        .expect("account inserts")
        .get("id");

    client
        .execute_typed(
            "insert into quantos.actor_capabilities (tenant_id, actor_id, workspace_id, account_id, capability, mode_scope)
             values ($1, $2, $3, $4, $5, 'paper')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&actor_id, Type::UUID),
                (&workspace_id, Type::UUID),
                (&account_uuid, Type::UUID),
                (&Capability::EXECUTION_OPERATE, Type::TEXT),
            ],
        )
        .expect("user execution capability inserts");

    let service_actor_id: Uuid = client
        .query_typed_one(
            "insert into quantos.actors (tenant_id, actor_kind, display_name, service_name)
             values ($1, 'service', 'Execution Gateway', 'execution-gateway')
             returning id",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )
        .expect("service actor inserts")
        .get("id");

    client
        .execute_typed(
            "insert into quantos.workspace_memberships (tenant_id, workspace_id, actor_id, role)
             values ($1, $2, $3, 'service')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&workspace_id, Type::UUID),
                (&service_actor_id, Type::UUID),
            ],
        )
        .expect("service workspace membership inserts");

    client
        .execute_typed(
            "insert into quantos.actor_capabilities (tenant_id, actor_id, workspace_id, account_id, capability, mode_scope)
             values ($1, $2, $3, $4, $5, 'paper'),
                    ($1, $2, $3, $4, $6, 'paper')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&service_actor_id, Type::UUID),
                (&workspace_id, Type::UUID),
                (&account_uuid, Type::UUID),
                (&Capability::EXECUTION_OPERATE, Type::TEXT),
                (&Capability::SECRET_RESOLVE, Type::TEXT),
            ],
        )
        .expect("service capabilities insert");

    client
        .execute_typed(
            "insert into quantos.secret_references (tenant_id, workspace_id, account_id, secret_name, vault_path, required_capability, rotation_state)
             values ($1, $2, $3, 'venue.binance.paper', 'vault://venue/binance/paper', $4, 'active')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&workspace_id, Type::UUID),
                (&account_uuid, Type::UUID),
                (&Capability::EXECUTION_OPERATE, Type::TEXT),
            ],
        )
        .expect("secret reference inserts");

    let session_token_hash = format!("session-{}", Uuid::now_v7());
    client
        .execute_typed(
            "insert into quantos.execution_service_sessions (tenant_id, actor_id, account_id, session_token_hash, allowed_capability, expires_at)
             values ($1, $2, $3, $4, $5, $6)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&service_actor_id, Type::UUID),
                (&account_uuid, Type::UUID),
                (&session_token_hash, Type::TEXT),
                (&Capability::EXECUTION_OPERATE, Type::TEXT),
                (&(Utc::now() + ChronoDuration::minutes(15)), Type::TIMESTAMPTZ),
            ],
        )
        .expect("service session inserts");

    let cleanup = Cleanup {
        database_url: database_url.to_owned(),
        tenant_id,
        user_id,
    };

    SeededFixture {
        account_id: AccountId::from_uuid(account_uuid),
        session_token_hash,
        _cleanup: cleanup,
    }
}

fn ensure_auth_user(client: &mut Client, user_id: Uuid, email: &str) {
    let columns = client
        .query_typed(
            "select column_name
             from information_schema.columns
             where table_schema = 'auth' and table_name = 'users'",
            &[],
        )
        .expect("auth.users columns query succeeds")
        .into_iter()
        .map(|row| row.get::<_, String>("column_name"))
        .collect::<HashSet<_>>();

    let mut insert_columns = Vec::new();
    let mut insert_values = Vec::new();

    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "id",
        format!("'{}'::uuid", user_id),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "aud",
        "'authenticated'".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "role",
        "'authenticated'".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email",
        format!("'{}'", email),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "encrypted_password",
        "'not-used'".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email_confirmed_at",
        "now()".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "raw_app_meta_data",
        "'{}'::jsonb".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "raw_user_meta_data",
        "'{}'::jsonb".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "created_at",
        "now()".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "updated_at",
        "now()".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "confirmation_token",
        "''".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "recovery_token",
        "''".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email_change",
        "''".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email_change_token_new",
        "''".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email_change_token_current",
        "''".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "email_change_confirm_status",
        "0".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "is_super_admin",
        "false".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "is_sso_user",
        "false".to_owned(),
    );
    push_auth_column(
        &columns,
        &mut insert_columns,
        &mut insert_values,
        "is_anonymous",
        "false".to_owned(),
    );

    let sql = format!(
        "insert into auth.users ({}) values ({}) on conflict (id) do nothing",
        insert_columns.join(", "),
        insert_values.join(", ")
    );
    client
        .batch_execute(sql.as_str())
        .expect("auth user inserts");
}

fn push_auth_column(
    available_columns: &HashSet<String>,
    insert_columns: &mut Vec<String>,
    insert_values: &mut Vec<String>,
    column: &str,
    value_sql: String,
) {
    if available_columns.contains(column) {
        insert_columns.push(column.to_owned());
        insert_values.push(value_sql);
    }
}

fn connect_client(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Client::connect(database_url, NoTls)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build().expect("TLS connector builds");
        Client::connect(database_url, MakeTlsConnector::new(connector))
    }
}
