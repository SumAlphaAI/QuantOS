use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use anyhow::Result;
use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, CorrelationId, TenantId, WorkflowRunId, WorkspaceId};
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineManager, EngineManifest,
    EngineQuota, EngineTransport,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_runtime::{
    InMemoryRuntimeKernel, ToolRegistration, WorkflowRunStatus,
    research::{
        InMemoryResearchArtifactRepository, ResearchWorkflowCoordinator,
        ResearchWorkflowCoordinatorConfig, ResearchWorkflowInput,
    },
};
use quantos_storage::{
    DataSnapshotInput, DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotArtifactRef,
    SnapshotLineageEntry, SnapshotQuality, SnapshotQualityRuleset, SnapshotSourceRef,
    SnapshotWindow, default_quality_rules,
};
use tokio::{
    process::{Child, Command},
    time::sleep,
};
use uuid::Uuid;

const TEST_APPROVAL_KEY: &[u8] = b"f08-test-approval-key";

fn register_reviewed_engine(
    manager: &mut EngineManager,
    manifest: EngineManifest,
) -> anyhow::Result<()> {
    let approval = EngineApproval::sign_for_local_fixture(
        &manifest,
        &"a".repeat(64),
        "F08 test reviewer",
        TEST_APPROVAL_KEY,
    )?;
    manager.register_approved_engine(manifest, &approval)?;
    Ok(())
}

fn repo_root() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .expect("repo root exists")
}

fn fixture_id() -> String {
    let id = Uuid::now_v7();
    match std::env::var("QUANTOS_TEST_ENGINE_SCOPE") {
        Ok(scope) => {
            assert!(scope.len() == 8 && scope.bytes().all(|b| b.is_ascii_hexdigit()));
            format!("{scope}-{id}")
        }
        Err(_) => id.to_string(),
    }
}

fn engines_dir() -> PathBuf {
    repo_root().join("engines")
}

fn short_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-r03-rd-agent-{}.sock", fixture_id()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "rd-agent".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![
            EngineCapabilityManifest {
                name: "research.hypothesis.v1".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Generate deterministic hypothesis ResearchArtifacts.".to_owned(),
            },
            EngineCapabilityManifest {
                name: "research.experiment.v1".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Generate deterministic experiment ResearchArtifacts.".to_owned(),
            },
        ],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

async fn spawn_python_rd_agent(socket_path: &Path) -> Result<Child> {
    // Prove that real Runtime -> Manager -> RD-Agent workflows boot with vibe absent.
    // The deliberate import probe fails the child if the removal guard is lost.
    const WITHOUT_VIBE: &str = r#"
import importlib.abc
import runpy
import sys
class VibeUnavailable(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'vibe_adapter' or fullname.startswith('vibe_adapter.'):
            raise ImportError('TP01_D_ADAPTER_REMOVED')
sys.meta_path.insert(0, VibeUnavailable())
try:
    __import__('vibe_adapter')
except ImportError:
    pass
else:
    raise AssertionError('vibe_adapter must be unavailable')
runpy.run_module('rd_agent.server', run_name='__main__')
"#;
    eprintln!("TP01-D: Python child cannot import vibe_adapter");
    let mut command = Command::new(engines_dir().join(".venv/bin/python"));
    command
        .current_dir(engines_dir())
        .arg("-c")
        .arg(WITHOUT_VIBE)
        .arg("--socket")
        .arg(socket_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    let child = command.spawn()?;

    for _ in 0..100 {
        if socket_path.exists() {
            sleep(Duration::from_millis(100)).await;
            return Ok(child);
        }
        sleep(Duration::from_millis(50)).await;
    }

    Err(anyhow::anyhow!(
        "rd-agent socket did not appear at {}",
        socket_path.display()
    ))
}

async fn shutdown_child(mut child: Child, socket_path: &Path) {
    let _ = child.kill().await;
    child
        .wait()
        .await
        .expect("owned Python Engine must be reaped");
    if socket_path.exists() {
        let _ = std::fs::remove_file(socket_path);
    }
}

fn auth_context() -> AuthContext {
    AuthContext {
        tenant_id: TenantId::new(),
        actor_id: ActorId::new(),
        user_id: uuid::Uuid::now_v7(),
        workspace_id: WorkspaceId::new(),
        workspace_slug: "primary".to_owned(),
        workspace_name: "Primary".to_owned(),
        role: Role::Operator,
        mode: RunMode::Paper,
        account_id: Some(AccountId::new()),
        capabilities: BTreeSet::from([
            Capability::parse("research.hypothesis.v1").expect("capability parses"),
            Capability::parse("research.experiment.v1").expect("capability parses"),
        ]),
    }
}

fn snapshot_catalog(tenant_id: TenantId) -> InMemoryDataSnapshotCatalog {
    let created_at = Utc
        .with_ymd_and_hms(2026, 7, 31, 0, 0, 10)
        .single()
        .expect("valid timestamp");
    let captured_at = Utc
        .with_ymd_and_hms(2026, 7, 31, 0, 0, 5)
        .single()
        .expect("valid timestamp");
    let mut catalog = InMemoryDataSnapshotCatalog::new();
    let snapshot = DataSnapshotRecord::new(
        tenant_id,
        DataSnapshotInput {
            schema_name: "DataSnapshot".to_owned(),
            schema_version: quantos_core::SchemaVersion::parse("v1")
                .expect("schema version parses"),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: Utc
                    .with_ymd_and_hms(2026, 7, 31, 0, 0, 0)
                    .single()
                    .expect("valid timestamp"),
                end_at: captured_at,
            },
            sources: vec![SnapshotSourceRef {
                source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                provider: "approved.binance.spot".to_owned(),
                dataset: "crypto.top_of_book.v1".to_owned(),
                license_label: "internal-approved".to_owned(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: "internal-approved".to_owned(),
            captured_at,
            max_age_secs: 600,
            symbols: vec!["BTCUSDT".to_owned()],
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: quantos_core::ArtifactId::new(),
                media_type: "application/json".to_owned(),
                content_hash: quantos_core::ContentHash::sha256_bytes(br#"{"snapshot":"fixture"}"#),
                storage_bucket: "quantos-artifacts".to_owned(),
                object_key: "tenant/example/snapshots/fixed".to_owned(),
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".to_owned(),
                reference: "market:BTCUSDT".to_owned(),
                details: serde_json::json!({ "from_sequence": 1, "to_sequence": 100 }),
            }],
        },
        created_at,
    )
    .expect("snapshot builds")
    .clone();
    catalog.upsert(snapshot).expect("valid snapshot");
    catalog
}

fn tool_registration(capability: &str) -> ToolRegistration {
    ToolRegistration {
        tool_name: capability.to_owned(),
        capability: Capability::parse(capability).expect("capability parses"),
        description: "Run deterministic research".to_owned(),
        max_cost_units: 10_000,
        rate_limit_per_minute: 600,
        enabled: true,
    }
}

#[tokio::test]
async fn research_workflow_runs_ten_times_with_stable_input_hash_and_locatable_evidence()
-> Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_rd_agent(&socket_path).await?;

    let result = async {
        let capability = "research.hypothesis.v1";
        let now = Utc::now();
        let auth = auth_context();
        let snapshots = snapshot_catalog(auth.tenant_id);
        let snapshot_id = snapshots.list_by_symbol(auth.tenant_id, "BTCUSDT")[0].snapshot_id;
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .expect("valid snapshot rules");

        let mut runtime = InMemoryRuntimeKernel::new();
        runtime.register_tool(tool_registration(capability))?;
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut repository = InMemoryResearchArtifactRepository::new();
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let mut outputs = Vec::new();
        {
            let mut coordinator = ResearchWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                ResearchWorkflowCoordinatorConfig {
                    worker_name: "research-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                },
            );

            for index in 0..10 {
                coordinator.schedule_research_run(
                    ResearchWorkflowInput {
                        runtime_session_id: session.runtime_session_id,
                        tool_name: capability.to_owned(),
                        capability: Capability::parse(capability)?,
                        workflow_kind: "research".to_owned(),
                        idempotency_key: format!("research-run-{index}"),
                        correlation_id: CorrelationId::new(),
                        data_snapshot_id: snapshot_id,
                        policy_context_ref: "policy-1".to_owned(),
                        input_schema_version: "v1".to_owned(),
                        input: serde_json::json!({
                            "fixture": "hypothesis_regime_shift",
                            "prompt": "Generate hypothesis"
                        }),
                        max_attempts: 1,
                        deadline_at: now + ChronoDuration::minutes(5),
                        cost_budget_units: 250,
                        rate_limit_per_minute: 60,
                    },
                    now,
                )?;
            }

            for index in 0..10 {
                let output = coordinator
                    .execute_next(now + ChronoDuration::seconds(index as i64 + 1))
                    .await?
                    .expect("run should execute");
                outputs.push(output);
            }
        }

        let unique_input_hashes = outputs
            .iter()
            .map(|result| result.run.input_hash.clone())
            .collect::<BTreeSet<_>>();
        assert_eq!(unique_input_hashes.len(), 1);

        for output in &outputs {
            assert_eq!(output.run.status, WorkflowRunStatus::Succeeded);
            assert_eq!(runtime.run_artifact_count(output.run.workflow_run_id), 1);
            assert!(!output.artifact.evidence_refs.is_empty());
            assert_eq!(output.artifact.stream_events.len(), 3);
            assert!(
                repository
                    .record_for_run(output.run.workflow_run_id)
                    .is_some()
            );
            assert!(
                repository
                    .find_by_artifact_id(&output.artifact.engine_artifact_id)
                    .is_some()
            );
        }

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn research_workflow_cancel_confirms_within_two_seconds() -> Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_rd_agent(&socket_path).await?;

    let result = async {
        let capability = "research.hypothesis.v1";
        let now = Utc::now();
        let auth = auth_context();
        let snapshots = snapshot_catalog(auth.tenant_id);
        let snapshot_id = snapshots.list_by_symbol(auth.tenant_id, "BTCUSDT")[0].snapshot_id;
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .expect("valid snapshot rules");

        let mut runtime = InMemoryRuntimeKernel::new();
        runtime.register_tool(tool_registration(capability))?;
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut repository = InMemoryResearchArtifactRepository::new();
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let run_id: WorkflowRunId;
        {
            let mut coordinator = ResearchWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                ResearchWorkflowCoordinatorConfig {
                    worker_name: "research-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                },
            );
            run_id = coordinator
                .schedule_research_run(
                    ResearchWorkflowInput {
                        runtime_session_id: session.runtime_session_id,
                        tool_name: capability.to_owned(),
                        capability: Capability::parse(capability)?,
                        workflow_kind: "research".to_owned(),
                        idempotency_key: "cancelled-run".to_owned(),
                        correlation_id: CorrelationId::new(),
                        data_snapshot_id: snapshot_id,
                        policy_context_ref: "policy-1".to_owned(),
                        input_schema_version: "v1".to_owned(),
                        input: serde_json::json!({
                            "fixture": "hypothesis_regime_shift",
                            "prompt": "Generate hypothesis",
                            "sleep_ms": 1500
                        }),
                        max_attempts: 1,
                        deadline_at: now + ChronoDuration::minutes(5),
                        cost_budget_units: 250,
                        rate_limit_per_minute: 60,
                    },
                    now,
                )?
                .workflow_run_id;
        }

        let confirmation = {
            let mut coordinator = ResearchWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                ResearchWorkflowCoordinatorConfig {
                    worker_name: "research-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                },
            );
            coordinator.cancel_run(run_id, now).await?
        };

        assert!(confirmation <= ChronoDuration::seconds(2));
        let run = runtime.run(run_id).expect("run should exist");
        assert_eq!(run.status, WorkflowRunStatus::Cancelled);
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[path = "support/r02_persisted_chain.rs"]
mod r02_persisted_chain;
