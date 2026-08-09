use std::{
    collections::HashSet,
    env, fs,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use chrono::{Duration as ChronoDuration, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, ContentHash, CorrelationId, TenantId, WorkspaceId};
use quantos_policy::{Capability, Role, RunMode};
use quantos_runtime::{NewWorkflowRun, ToolRegistration, pg::PgRuntimeStore};
use quantos_storage::ArtifactManifest;
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

#[derive(Clone)]
struct RuntimeFixture {
    auth: AuthContext,
    _cleanup: std::sync::Arc<Cleanup>,
}

#[test]
fn postgres_runtime_recovers_one_hundred_runs_without_duplicate_artifacts() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL runtime test: DATABASE_URL is not set");
        return;
    };

    let fixture = seed_runtime_fixture(&database_url);
    let run_count = env::var("QUANTOS_RUNTIME_RECOVERY_RUNS")
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .expect("recovery run count is numeric")
        })
        .unwrap_or(100);
    assert!(run_count > 0);
    let now = Utc::now();
    let mut store = PgRuntimeStore::connect(&database_url).expect("runtime store connects");
    let session = store
        .create_session(&fixture.auth, now, now + ChronoDuration::hours(1))
        .expect("session creates");
    store
        .register_tool(fixture.auth.tenant_id, &tool_registration(), now)
        .expect("tool registers");

    let mut run_ids = Vec::new();
    let mut scheduling_samples = Vec::with_capacity(run_count);
    for index in 0..run_count {
        let started_at = Instant::now();
        let run = store
            .schedule_run(&new_run(session.runtime_session_id, index, now), now)
            .expect("run schedules");
        scheduling_samples.push(started_at.elapsed());
        run_ids.push(run.workflow_run_id);
    }
    scheduling_samples.sort_unstable();
    let p95_index = ((scheduling_samples.len() * 95).div_ceil(100)).saturating_sub(1);
    let scheduling_p95 = scheduling_samples[p95_index];
    let p95_limit_ms = env::var("QUANTOS_RUNTIME_SCHEDULE_P95_LIMIT_MS")
        .ok()
        .map(|value| value.parse::<u64>().expect("P95 limit is numeric"))
        .unwrap_or(1_500);
    eprintln!(
        "runtime schedule direct PostgreSQL P95: {:.2} ms (limit: {p95_limit_ms} ms, samples: {run_count})",
        scheduling_p95.as_secs_f64() * 1_000.0
    );
    assert!(
        scheduling_p95 <= Duration::from_millis(p95_limit_ms),
        "schedule P95 {:.2} ms exceeds configured limit {p95_limit_ms} ms",
        scheduling_p95.as_secs_f64() * 1_000.0
    );

    let marker_dir = tempfile::tempdir().expect("worker marker tempdir creates");
    let marker_path = marker_dir.path().join("checkpointed");
    let mut worker = Command::new(env::current_exe().expect("current test executable resolves"))
        .arg("--exact")
        .arg("postgres_runtime_worker_child_claims_checkpoints_and_waits")
        .arg("--ignored")
        .arg("--nocapture")
        .env("QUANTOS_WORKER_CHILD", "1")
        .env(
            "QUANTOS_WORKER_TENANT_ID",
            fixture.auth.tenant_id.to_string(),
        )
        .env("QUANTOS_WORKER_RUN_COUNT", run_count.to_string())
        .env("QUANTOS_WORKER_MARKER", &marker_path)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("worker child spawns");
    let marker_deadline = Instant::now() + Duration::from_secs(600);
    while !marker_path.exists() {
        assert!(
            Instant::now() < marker_deadline,
            "worker did not checkpoint in time"
        );
        if let Some(status) = worker.try_wait().expect("worker status reads") {
            panic!("worker exited before forced kill: {status}");
        }
        thread::sleep(Duration::from_millis(100));
    }
    worker.kill().expect("worker receives OS-level kill");
    let killed_status = worker.wait().expect("killed worker reaps");
    assert!(
        !killed_status.success(),
        "forced worker kill must be observable"
    );

    let recovery_at = Utc::now() + ChronoDuration::seconds(31);
    let mut recovered = PgRuntimeStore::connect(&database_url).expect("recovered store connects");
    let resumed = recovered
        .claim_runs(
            fixture.auth.tenant_id,
            "worker-b",
            run_count as i64,
            recovery_at,
            ChronoDuration::seconds(30),
        )
        .expect("expired leases reclaim");
    assert_eq!(resumed.len(), run_count);

    for lease in &resumed {
        let checkpoint = recovered
            .load_checkpoint(lease.run.workflow_run_id)
            .expect("checkpoint query succeeds")
            .expect("checkpoint exists");
        assert_eq!(checkpoint.step_index, 1);

        let manifest = ArtifactManifest::new(
            fixture.auth.tenant_id,
            "application/json",
            ContentHash::sha256_bytes(format!("artifact-{}", lease.run.workflow_run_id).as_bytes()),
            "quantos-artifacts",
            16,
            now,
        );
        recovered
            .record_artifact(lease.run.workflow_run_id, &manifest, recovery_at)
            .expect("artifact dedupe holds");
        recovered
            .complete_run(lease.run.workflow_run_id, "worker-b", recovery_at)
            .expect("run completes");
    }

    let mut client = connect_client(&database_url).expect("direct client connects");
    let artifact_count = client
        .query_typed_one(
            "select count(*) as count
             from quantos.object_artifacts
             where tenant_id = $1",
            &[(fixture.auth.tenant_id.as_uuid(), Type::UUID)],
        )
        .expect("artifact count query succeeds")
        .get::<_, i64>("count");
    assert_eq!(artifact_count, run_count as i64);

    let run_uuids = run_ids
        .iter()
        .map(|run_id| *run_id.as_uuid())
        .collect::<Vec<_>>();
    let run_summary = client
        .query_typed_one(
            "select count(*) as run_count,
                    count(*) filter (where status = 'succeeded') as succeeded_count
             from quantos.workflow_runs
             where id = any($1)",
            &[(&run_uuids, Type::UUID_ARRAY)],
        )
        .expect("run summary query succeeds");
    assert_eq!(run_summary.get::<_, i64>("run_count"), run_count as i64);
    assert_eq!(
        run_summary.get::<_, i64>("succeeded_count"),
        run_count as i64
    );

    let artifact_link_summary = client
        .query_typed_one(
            "select count(*) as run_count,
                    count(*) filter (where artifact_count = 1) as single_artifact_count
             from (
               select workflow_run_id, count(*) as artifact_count
               from quantos.workflow_run_artifacts
               where workflow_run_id = any($1)
               group by workflow_run_id
             ) as links",
            &[(&run_uuids, Type::UUID_ARRAY)],
        )
        .expect("artifact link summary query succeeds");
    assert_eq!(
        artifact_link_summary.get::<_, i64>("run_count"),
        run_count as i64
    );
    assert_eq!(
        artifact_link_summary.get::<_, i64>("single_artifact_count"),
        run_count as i64
    );
}

#[test]
#[ignore = "helper process invoked by the PostgreSQL recovery test"]
fn postgres_runtime_worker_child_claims_checkpoints_and_waits() {
    assert_eq!(env::var("QUANTOS_WORKER_CHILD").as_deref(), Ok("1"));
    let database_url = env::var("DATABASE_URL").expect("child DATABASE_URL exists");
    let tenant_uuid =
        Uuid::parse_str(&env::var("QUANTOS_WORKER_TENANT_ID").expect("child tenant ID exists"))
            .expect("child tenant ID parses");
    let tenant_id = TenantId::from_uuid(tenant_uuid);
    let run_count = env::var("QUANTOS_WORKER_RUN_COUNT")
        .expect("child run count exists")
        .parse::<usize>()
        .expect("child run count parses");
    let marker_path = env::var("QUANTOS_WORKER_MARKER").expect("child marker path exists");
    let now = Utc::now();
    let mut store = PgRuntimeStore::connect(&database_url).expect("child runtime store connects");
    let claimed = store
        .claim_runs(
            tenant_id,
            "worker-a",
            run_count as i64,
            now,
            ChronoDuration::seconds(30),
        )
        .expect("child claims runs");
    assert_eq!(claimed.len(), run_count);
    for lease in &claimed {
        store
            .save_checkpoint(
                lease.run.workflow_run_id,
                "step.execute",
                1,
                &serde_json::json!({ "step": 1, "run_id": lease.run.workflow_run_id }),
                now,
            )
            .expect("child checkpoint saves");
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            ContentHash::sha256_bytes(format!("artifact-{}", lease.run.workflow_run_id).as_bytes()),
            "quantos-artifacts",
            16,
            now,
        );
        store
            .record_artifact(lease.run.workflow_run_id, &manifest, now)
            .expect("child artifact records");
    }
    fs::write(marker_path, format!("checkpointed={run_count}\n")).expect("child marker writes");
    thread::sleep(Duration::from_secs(3_600));
}

#[test]
fn postgres_runtime_records_cancel_and_timeout_audits() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL runtime test: DATABASE_URL is not set");
        return;
    };

    let fixture = seed_runtime_fixture(&database_url);
    let now = Utc::now();
    let mut store = PgRuntimeStore::connect(&database_url).expect("runtime store connects");
    let session = store
        .create_session(&fixture.auth, now, now + ChronoDuration::hours(1))
        .expect("session creates");
    store
        .register_tool(fixture.auth.tenant_id, &tool_registration(), now)
        .expect("tool registers");

    let cancellable = store
        .schedule_run(&new_run(session.runtime_session_id, 200, now), now)
        .expect("run schedules");
    store
        .request_cancel(cancellable.workflow_run_id, now)
        .expect("cancel request persists");
    store
        .finalize_cancelled(cancellable.workflow_run_id, now)
        .expect("cancel finalize persists");

    let mut timed_out_input = new_run(session.runtime_session_id, 201, now);
    timed_out_input.deadline_at = now - ChronoDuration::seconds(1);
    let timed_out = store
        .schedule_run(&timed_out_input, now)
        .expect("timed out run schedules");
    assert_eq!(
        store
            .mark_timed_out_runs(fixture.auth.tenant_id, now)
            .expect("timeout sweep succeeds"),
        1
    );

    let cancel_actions = store
        .audit_actions_for_run(cancellable.workflow_run_id)
        .expect("cancel audit query succeeds");
    assert_eq!(
        cancel_actions,
        vec![
            "runtime.cancel_requested".to_owned(),
            "runtime.cancelled".to_owned()
        ]
    );

    let timeout_actions = store
        .audit_actions_for_run(timed_out.workflow_run_id)
        .expect("timeout audit query succeeds");
    assert_eq!(timeout_actions, vec!["runtime.timed_out".to_owned()]);
}

fn tool_registration() -> ToolRegistration {
    ToolRegistration {
        tool_name: "research.execute".to_owned(),
        capability: Capability::parse(Capability::EXECUTION_OPERATE).expect("capability parses"),
        description: "Run a deterministic research step".to_owned(),
        max_cost_units: 10_000,
        rate_limit_per_minute: 600,
        enabled: true,
    }
}

fn new_run(
    runtime_session_id: quantos_core::RuntimeSessionId,
    index: usize,
    now: chrono::DateTime<Utc>,
) -> NewWorkflowRun {
    NewWorkflowRun {
        runtime_session_id,
        tool_name: "research.execute".to_owned(),
        capability: Capability::parse(Capability::EXECUTION_OPERATE).expect("capability parses"),
        workflow_kind: "research".to_owned(),
        idempotency_key: format!("runtime-run-{index}"),
        correlation_id: CorrelationId::new(),
        input_hash: ContentHash::sha256_bytes(format!("payload-{index}").as_bytes()),
        max_attempts: 3,
        deadline_at: now + ChronoDuration::minutes(10),
        cost_budget_units: 1_000,
        rate_limit_per_minute: 60,
    }
}

fn seed_runtime_fixture(database_url: &str) -> RuntimeFixture {
    let tenant_id = TenantId::new();
    let user_id = Uuid::now_v7();
    let mut client = connect_client(database_url).expect("setup client connects");
    ensure_auth_user(&mut client, user_id, &format!("f07-{user_id}@example.com"));

    let slug = format!("f07-{}", tenant_id);
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

    let account_id: Uuid = client
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
            "insert into quantos.tenant_memberships (tenant_id, user_id, role)
             values ($1, $2, 'operator')",
            &[(tenant_id.as_uuid(), Type::UUID), (&user_id, Type::UUID)],
        )
        .expect("tenant membership inserts");

    let actor_id: Uuid = client
        .query_typed_one(
            "insert into quantos.actors (tenant_id, user_id, actor_kind, display_name)
             values ($1, $2, 'user', 'Runtime operator')
             returning id",
            &[(tenant_id.as_uuid(), Type::UUID), (&user_id, Type::UUID)],
        )
        .expect("actor inserts")
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

    client
        .execute_typed(
            "insert into quantos.actor_capabilities (tenant_id, actor_id, workspace_id, account_id, capability, mode_scope)
             values ($1, $2, $3, $4, $5, 'paper')",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&actor_id, Type::UUID),
                (&workspace_id, Type::UUID),
                (&account_id, Type::UUID),
                (&Capability::EXECUTION_OPERATE, Type::TEXT),
            ],
        )
        .expect("capability inserts");

    RuntimeFixture {
        auth: AuthContext {
            tenant_id,
            actor_id: ActorId::from_uuid(actor_id),
            user_id,
            workspace_id: WorkspaceId::from_uuid(workspace_id),
            workspace_slug: "primary".to_owned(),
            workspace_name: "Primary workspace".to_owned(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::from_uuid(account_id)),
            capabilities: std::collections::BTreeSet::from([Capability::parse(
                Capability::EXECUTION_OPERATE,
            )
            .expect("capability parses")]),
        },
        _cleanup: std::sync::Arc::new(Cleanup {
            database_url: database_url.to_owned(),
            tenant_id,
            user_id,
        }),
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
        format!("'{user_id}'::uuid"),
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
        format!("'{email}'"),
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
