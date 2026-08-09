use std::{collections::HashSet, env, time::Instant};

use chrono::{Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_auth::GatewayAuthMiddleware;
use quantos_core::{AccountId, TenantId};
use quantos_policy::{AuthorizationRequirement, Capability, RunMode};
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
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL auth test: DATABASE_URL is not set");
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

    let mut auth_read_samples = Vec::with_capacity(20);
    for _ in 0..20 {
        let started_at = Instant::now();
        middleware
            .authorize_user_request(
                &request,
                &AuthorizationRequirement::new(
                    Capability::parse(Capability::EXECUTION_OPERATE)
                        .expect("static capability parses"),
                )
                .requiring_account(),
            )
            .expect("repeated authorization succeeds");
        auth_read_samples.push(started_at.elapsed());
    }
    auth_read_samples.sort();
    let p95_index = (auth_read_samples.len() * 95).div_ceil(100) - 1;
    let auth_read_p95 = auth_read_samples[p95_index];
    let remote_p95_limit_ms = env::var("QUANTOS_AUTH_READ_P95_LIMIT_MS")
        .ok()
        .map(|value| value.parse::<u128>().expect("Auth P95 limit is numeric"))
        .unwrap_or(500);
    eprintln!(
        "gateway auth read p95={}ms (remote limit={}ms)",
        auth_read_p95.as_millis(),
        remote_p95_limit_ms
    );
    assert!(
        auth_read_p95.as_millis() < remote_p95_limit_ms,
        "gateway auth read p95 must stay under {remote_p95_limit_ms}ms for the configured environment, got {}ms",
        auth_read_p95.as_millis()
    );

    let denied = middleware
        .authorize_user_request(
            &request,
            &AuthorizationRequirement::new(
                Capability::parse(Capability::STRATEGY_APPROVE).expect("static capability parses"),
            ),
        )
        .expect_err("operator should not inherit strategy approval");
    assert!(denied.to_string().contains("POLICY_CAPABILITY_DENIED"));
}

#[test]
fn gateway_auth_only_allows_service_secret_resolution_via_allowlist_session() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL auth test: DATABASE_URL is not set");
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
            "insert into quantos.execution_service_sessions (tenant_id, actor_id, session_token_hash, allowed_capability, expires_at)
             values ($1, $2, $3, $4, $5)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&service_actor_id, Type::UUID),
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
