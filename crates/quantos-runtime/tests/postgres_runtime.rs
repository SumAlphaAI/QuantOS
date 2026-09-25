use std::{
    collections::HashSet,
    env, fs,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use chrono::{Duration as ChronoDuration, Utc};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, types::Type};
use postgres_openssl::MakeTlsConnector;
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, ContentHash, CorrelationId, TenantId, WorkspaceId};
use quantos_policy::{Capability, Role, RunMode};
use quantos_runtime::{NewWorkflowRun, ToolRegistration, WorkflowRunStatus, pg::PgRuntimeStore};
use quantos_storage::ArtifactManifest;
use url::Url;
use uuid::Uuid;

struct Cleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            if let Err(error) = client.execute_typed(
                "update quantos.workflow_runs
                 set status='failed', completed_at=now(), lease_owner=null,
                     lease_expires_at=null, attempt_id=null,
                     last_error='F07 fixture retired', updated_at=now()
                 where tenant_id=$1 and status in ('queued','running','cancel_requested')",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            ) {
                eprintln!("F07 fixture run retirement failed: {error}");
            }
            if let Err(error) = client.execute_typed(
                "update quantos.tool_registry set enabled=false, updated_at=now()
                 where tenant_id=$1 and enabled=true",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            ) {
                eprintln!("F07 fixture tool retirement failed: {error}");
            }
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
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        assert_ne!(
            env::var("QUANTOS_F07_DB_REQUIRED").as_deref(),
            Ok("1"),
            "F07 database acceptance requires DATABASE_URL"
        );
        eprintln!("NOT RUN: live PostgreSQL runtime test requires DATABASE_URL");
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
        .unwrap_or(200);
    eprintln!(
        "runtime schedule direct PostgreSQL P95: {:.2} ms (limit: {p95_limit_ms} ms, samples: {run_count})",
        scheduling_p95.as_secs_f64() * 1_000.0
    );
    if let Ok(path) = env::var("QUANTOS_F07_METRICS_PATH") {
        fs::write(
            path,
            serde_json::to_vec_pretty(&serde_json::json!({
                "schema": "quantos-f07-recovery-measurements/v1",
                "scheduledRuns": run_count,
                "scheduleP95Ms": scheduling_p95.as_secs_f64() * 1_000.0,
                "scheduleP95LimitMs": p95_limit_ms,
                "recoveryCompleted": false
            }))
            .expect("F07 measurements serialize"),
        )
        .expect("F07 measurements write");
    }
    if env::var("QUANTOS_F07_COVERAGE_MEASUREMENT").as_deref() != Ok("1") {
        assert!(
            scheduling_p95 <= Duration::from_millis(p95_limit_ms),
            "schedule P95 {:.2} ms exceeds configured limit {p95_limit_ms} ms",
            scheduling_p95.as_secs_f64() * 1_000.0
        );
    }

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

    let recovery_at = Utc::now() + ChronoDuration::minutes(31);
    let mut recovered = PgRuntimeStore::connect(&database_url).expect("recovered store connects");
    let resumed = recovered
        .claim_runs(
            fixture.auth.tenant_id,
            "worker-b",
            run_count as i64,
            recovery_at,
            ChronoDuration::minutes(30),
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
            .record_artifact(lease, &manifest, recovery_at)
            .expect("artifact dedupe holds");
        recovered
            .complete_run(lease, recovery_at)
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
    if let Ok(path) = env::var("QUANTOS_F07_METRICS_PATH") {
        fs::write(
            path,
            serde_json::to_vec_pretty(&serde_json::json!({
                "schema": "quantos-f07-recovery-measurements/v1",
                "scheduledRuns": run_count,
                "scheduleP95Ms": scheduling_p95.as_secs_f64() * 1_000.0,
                "scheduleP95LimitMs": p95_limit_ms,
                "recoveryCompleted": true,
                "recoveredRuns": run_count,
                "uniqueArtifactBindings": run_count
            }))
            .expect("F07 measurements serialize"),
        )
        .expect("F07 measurements write");
    }
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
            ChronoDuration::minutes(30),
        )
        .expect("child claims runs");
    assert_eq!(claimed.len(), run_count);
    for lease in &claimed {
        store
            .save_checkpoint(
                lease,
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
            .record_artifact(lease, &manifest, now)
            .expect("child artifact records");
    }
    fs::write(marker_path, format!("checkpointed={run_count}\n")).expect("child marker writes");
    thread::sleep(Duration::from_secs(3_600));
}

#[test]
fn postgres_runtime_records_cancel_and_timeout_audits() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        assert_ne!(
            env::var("QUANTOS_F07_DB_REQUIRED").as_deref(),
            Ok("1"),
            "F07 database acceptance requires DATABASE_URL"
        );
        eprintln!("NOT RUN: live PostgreSQL runtime test requires DATABASE_URL");
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
    store
        .request_cancel(cancellable.workflow_run_id, now)
        .expect("terminal cancellation is idempotent");
    store
        .finalize_cancelled(cancellable.workflow_run_id, now)
        .expect("terminal finalize is idempotent");

    let mut timed_out_input = new_run(session.runtime_session_id, 201, now);
    timed_out_input.deadline_at = now - ChronoDuration::seconds(1);
    let timed_out = store
        .schedule_run(&timed_out_input, now - ChronoDuration::seconds(2))
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

#[test]
fn postgres_runtime_rejects_revocation_capability_conflicts_and_rate_overflow() {
    let Some(database_url) = env::var("DATABASE_URL").ok().filter(|s| !s.is_empty()) else {
        assert_ne!(env::var("QUANTOS_F07_DB_REQUIRED").as_deref(), Ok("1"));
        return;
    };
    let fixture = seed_runtime_fixture(&database_url);
    let now = Utc::now();
    let mut store = PgRuntimeStore::connect(&database_url).unwrap();
    assert!(store.create_session(&fixture.auth, now, now).is_err());
    let session = store
        .create_session(&fixture.auth, now, now + ChronoDuration::hours(1))
        .unwrap();
    store
        .register_tool(fixture.auth.tenant_id, &tool_registration(), now)
        .unwrap();
    let mut expired_deadline = new_run(session.runtime_session_id, 298, now);
    expired_deadline.deadline_at = now;
    assert!(store.schedule_run(&expired_deadline, now).is_err());
    let mut zero_rate = new_run(session.runtime_session_id, 299, now);
    zero_rate.rate_limit_per_minute = 0;
    assert!(store.schedule_run(&zero_rate, now).is_err());
    let mut wrong = new_run(session.runtime_session_id, 300, now);
    wrong.capability = Capability::parse("strategy.write").unwrap();
    assert!(store.schedule_run(&wrong, now).is_err());

    let first = new_run(session.runtime_session_id, 301, now);
    let accepted = store.schedule_run(&first, now).unwrap();
    assert_eq!(
        store.schedule_run(&first, now).unwrap().workflow_run_id,
        accepted.workflow_run_id
    );
    let mut changed = first.clone();
    changed.input_hash = ContentHash::sha256_bytes(b"changed-input");
    assert!(store.schedule_run(&changed, now).is_err());

    let mut client = connect_client(&database_url).unwrap();
    client
        .execute_typed(
            "update quantos.runtime_sessions set revoked_at = $2 where id = $1",
            &[
                (session.runtime_session_id.as_uuid(), Type::UUID),
                (&now, Type::TIMESTAMPTZ),
            ],
        )
        .unwrap();
    assert!(
        store
            .schedule_run(&new_run(session.runtime_session_id, 302, now), now)
            .is_err()
    );

    let second_session = store
        .create_session(&fixture.auth, now, now + ChronoDuration::hours(1))
        .unwrap();
    let mut limited = new_run(
        second_session.runtime_session_id,
        303,
        now + ChronoDuration::minutes(1),
    );
    limited.rate_limit_per_minute = 1;
    store
        .schedule_run(&limited, now + ChronoDuration::minutes(1))
        .unwrap();
    limited.idempotency_key = "different-rate-key".to_owned();
    assert!(
        store
            .schedule_run(&limited, now + ChronoDuration::minutes(1))
            .is_err()
    );
    let window = (now + ChronoDuration::minutes(1))
        .timestamp()
        .div_euclid(60)
        * 60;
    let rate = client
        .query_typed_one(
            "select accepted_count from quantos.workflow_tool_rate_windows
             where tenant_id=$1 and tool_name=$2 and window_start=to_timestamp($3)",
            &[
                (fixture.auth.tenant_id.as_uuid(), Type::UUID),
                (&limited.tool_name, Type::TEXT),
                (&window, Type::INT8),
            ],
        )
        .unwrap();
    assert_eq!(
        rate.get::<_, i32>(0),
        1,
        "rejected schedule must not consume quota"
    );
    let rejected = client
        .query_typed_one(
            "select count(*) from quantos.workflow_runs
             where tenant_id=$1 and idempotency_key=$2",
            &[
                (fixture.auth.tenant_id.as_uuid(), Type::UUID),
                (&limited.idempotency_key, Type::TEXT),
            ],
        )
        .unwrap();
    assert_eq!(
        rejected.get::<_, i64>(0),
        0,
        "rejected schedule must roll back run"
    );
}

#[test]
fn postgres_runtime_fences_old_attempt_and_enforces_cost_and_retry_budget() {
    let Some(database_url) = env::var("DATABASE_URL").ok().filter(|s| !s.is_empty()) else {
        assert_ne!(env::var("QUANTOS_F07_DB_REQUIRED").as_deref(), Ok("1"));
        return;
    };
    let fixture = seed_runtime_fixture(&database_url);
    let now = Utc::now();
    let mut store = PgRuntimeStore::connect(&database_url).unwrap();
    let session = store
        .create_session(&fixture.auth, now, now + ChronoDuration::hours(1))
        .unwrap();
    store
        .register_tool(fixture.auth.tenant_id, &tool_registration(), now)
        .unwrap();
    let mut run = new_run(session.runtime_session_id, 400, now);
    run.max_attempts = 2;
    run.cost_budget_units = 0;
    let scheduled = store.schedule_run(&run, now).unwrap();
    let old = store
        .claim_runs(
            fixture.auth.tenant_id,
            "same-worker",
            1,
            now,
            ChronoDuration::seconds(1),
        )
        .unwrap()
        .remove(0);
    let later = now + ChronoDuration::seconds(2);
    let fresh = store
        .claim_runs(
            fixture.auth.tenant_id,
            "same-worker",
            1,
            later,
            ChronoDuration::seconds(30),
        )
        .unwrap()
        .remove(0);
    assert_ne!(old.task_attempt_id, fresh.task_attempt_id);
    assert!(
        store
            .save_checkpoint(&old, "stale", 1, &serde_json::json!({}), later)
            .is_err()
    );
    assert!(store.complete_run(&old, later).is_err());
    let manifest = ArtifactManifest::new(
        fixture.auth.tenant_id,
        "application/json",
        ContentHash::sha256_bytes(b"cost-limit"),
        "quantos-artifacts",
        10,
        later,
    );
    assert!(store.record_artifact(&fresh, &manifest, later).is_err());
    let foreign = ArtifactManifest::new(
        TenantId::new(),
        "application/json",
        ContentHash::sha256_bytes(b"foreign"),
        "quantos-artifacts",
        7,
        later,
    );
    assert_eq!(
        store
            .fail_and_retry(&fresh, "controlled failure", later)
            .unwrap(),
        WorkflowRunStatus::Failed
    );
    let another = store
        .schedule_run(&new_run(session.runtime_session_id, 401, now), now)
        .unwrap();
    let other_lease = store
        .claim_runs(
            fixture.auth.tenant_id,
            "worker-c",
            1,
            later,
            ChronoDuration::seconds(30),
        )
        .unwrap()
        .remove(0);
    assert_eq!(other_lease.run.workflow_run_id, another.workflow_run_id);
    assert!(
        store
            .record_artifact(&other_lease, &foreign, later)
            .is_err()
    );
    assert_eq!(
        store
            .load_run(scheduled.workflow_run_id)
            .unwrap()
            .unwrap()
            .status,
        WorkflowRunStatus::Failed
    );
}

fn tool_registration() -> ToolRegistration {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/f07-workflow.json")).unwrap();
    serde_json::from_value(fixture["toolRegistration"].clone()).unwrap()
}

fn new_run(
    runtime_session_id: quantos_core::RuntimeSessionId,
    index: usize,
    now: chrono::DateTime<Utc>,
) -> NewWorkflowRun {
    NewWorkflowRun {
        runtime_session_id,
        tool_name: tool_registration().tool_name,
        capability: tool_registration().capability,
        workflow_kind: "runtime.fixture.v1".to_owned(),
        idempotency_key: format!("runtime-run-{index}"),
        correlation_id: CorrelationId::new(),
        input_hash: ContentHash::sha256_bytes(format!("payload-{index}").as_bytes()),
        max_attempts: 3,
        deadline_at: now + ChronoDuration::hours(2),
        cost_budget_units: 1_000,
        rate_limit_per_minute: 600,
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
                (&Capability::RESEARCH_WRITE, Type::TEXT),
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
                Capability::RESEARCH_WRITE,
            )
            .expect("capability parses")]),
        },
        _cleanup: std::sync::Arc::new(Cleanup {
            database_url: database_url.to_owned(),
            tenant_id,
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
        .expect("postgres URL parses");
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
