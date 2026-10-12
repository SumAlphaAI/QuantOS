use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use anyhow::Result;
use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, CorrelationId, TenantId, WorkspaceId};
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineManager, EngineManifest,
    EngineQuota, EngineTransport,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_runtime::{
    InMemoryRuntimeKernel, ToolRegistration, WorkflowRunStatus,
    signal_proposal::{
        InMemorySignalProposalRepository, SignalProposalWorkflowCoordinator,
        SignalProposalWorkflowCoordinatorConfig, SignalProposalWorkflowError,
        SignalProposalWorkflowInput, TradeProposalEvaluationGate,
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

fn llmquant_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-r04-llmquant-{}.sock", fixture_id()))
}

fn trading_agents_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-r04-trading-agents-{}.sock", fixture_id()))
}

fn openbb_adapter_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-r04-openbb-adapter-{}.sock", fixture_id()))
}

fn llmquant_manifest(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "llmquant".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "quant.signal.v1".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Generate deterministic QuantOS signals from feature snapshots."
                .to_owned(),
        }],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

fn trading_agents_manifest(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "trading-agents".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "decision.proposal.v1".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Generate deterministic non-executable TradeProposals.".to_owned(),
        }],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

fn openbb_adapter_manifest(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "openbb-adapter".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "data.query.v1".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Generate deterministic lineage-rich data query responses.".to_owned(),
        }],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

async fn spawn_python_llmquant(socket_path: &Path) -> Result<Child> {
    let mut command = Command::new(engines_dir().join(".venv/bin/python"));
    command
        .current_dir(engines_dir())
        .arg("-m")
        .arg("llmquant.server")
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
        "llmquant socket did not appear at {}",
        socket_path.display()
    ))
}

async fn spawn_python_trading_agents(socket_path: &Path) -> Result<Child> {
    let mut command = Command::new(engines_dir().join(".venv/bin/python"));
    command
        .current_dir(engines_dir())
        .arg("-m")
        .arg("trading_agents.server")
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
        "trading-agents socket did not appear at {}",
        socket_path.display()
    ))
}

async fn spawn_python_openbb_adapter(socket_path: &Path) -> Result<Child> {
    let mut command = Command::new(engines_dir().join(".venv/bin/python"));
    command
        .current_dir(engines_dir())
        .arg("-m")
        .arg("openbb_adapter.server")
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
        "openbb-adapter socket did not appear at {}",
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
            Capability::parse("signal.proposal.workflow.v1").expect("capability parses"),
            Capability::parse("data.query.v1").expect("capability parses"),
            Capability::parse("quant.signal.v1").expect("capability parses"),
            Capability::parse("decision.proposal.v1").expect("capability parses"),
        ]),
    }
}

fn snapshot_catalog(tenant_id: TenantId) -> InMemoryDataSnapshotCatalog {
    let created_at = Utc
        .with_ymd_and_hms(2026, 1, 1, 0, 0, 10)
        .single()
        .expect("valid timestamp");
    let captured_at = Utc
        .with_ymd_and_hms(2026, 1, 1, 0, 0, 5)
        .single()
        .expect("valid timestamp");
    let fixtures = [
        ("BTCUSDT", "approved.binance.spot:BTCUSDT"),
        ("ETHUSDT", "approved.binance.spot:ETHUSDT"),
        ("SOLUSDT", "approved.binance.spot:SOLUSDT"),
    ];

    let mut catalog = InMemoryDataSnapshotCatalog::new();
    for (symbol, source_id) in fixtures {
        let snapshot = DataSnapshotRecord::new(
            tenant_id,
            DataSnapshotInput {
                schema_name: "DataSnapshot".to_owned(),
                schema_version: quantos_core::SchemaVersion::parse("v1")
                    .expect("schema version parses"),
                schema_entry_id: None,
                window: SnapshotWindow {
                    start_at: Utc
                        .with_ymd_and_hms(2026, 1, 1, 0, 0, 0)
                        .single()
                        .expect("valid timestamp"),
                    end_at: captured_at,
                },
                sources: vec![SnapshotSourceRef {
                    source_id: source_id.to_owned(),
                    provider: "approved.binance.spot".to_owned(),
                    dataset: "crypto.top_of_book.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                }],
                quality: SnapshotQuality::Passed,
                quality_findings: vec![],
                license_label: "internal-approved".to_owned(),
                captured_at,
                max_age_secs: 7_200,
                symbols: vec![symbol.to_owned()],
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: quantos_core::ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: quantos_core::ContentHash::sha256_bytes(
                        format!("{{\"snapshot\":\"{symbol}\"}}").as_bytes(),
                    ),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: format!("tenant/example/snapshots/{symbol}"),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "market_event_range".to_owned(),
                    reference: format!("market:{symbol}"),
                    details: serde_json::json!({ "from_sequence": 1, "to_sequence": 100 }),
                }],
            },
            created_at,
        )
        .expect("snapshot builds")
        .clone();
        catalog.upsert(snapshot).expect("valid snapshot");
    }
    catalog
}

fn tool_registration() -> ToolRegistration {
    ToolRegistration {
        tool_name: "signal.proposal.workflow".to_owned(),
        capability: Capability::parse("signal.proposal.workflow.v1").expect("capability parses"),
        description: "Run deterministic signal and proposal workflow".to_owned(),
        max_cost_units: 20_000,
        rate_limit_per_minute: 600,
        enabled: true,
    }
}

fn fixture_quartet(index: usize) -> (&'static str, &'static str, &'static str, &'static str) {
    match index % 3 {
        0 => (
            "BTCUSDT",
            "trend_long_quality",
            "committee_bull_breakout",
            "crypto_market_btc",
        ),
        1 => (
            "ETHUSDT",
            "mean_reversion_short",
            "committee_reduce_overheat",
            "macro_research_rates",
        ),
        _ => (
            "SOLUSDT",
            "neutral_flat_wait",
            "committee_hold_crosscurrents",
            "equity_fundamentals_nvda",
        ),
    }
}

fn snapshot_id_for_symbol(
    catalog: &InMemoryDataSnapshotCatalog,
    tenant_id: TenantId,
    symbol: &str,
) -> quantos_core::SnapshotId {
    catalog.list_by_symbol(tenant_id, symbol)[0].snapshot_id
}

#[tokio::test]
async fn signal_proposal_workflow_runs_hundred_cases_with_evidence_expiry_and_non_executable_proposals()
-> Result<()> {
    let openbb_adapter_socket = openbb_adapter_socket_path();
    let llmquant_socket = llmquant_socket_path();
    let trading_agents_socket = trading_agents_socket_path();
    let openbb_adapter_child = spawn_python_openbb_adapter(&openbb_adapter_socket).await?;
    let llmquant_child = spawn_python_llmquant(&llmquant_socket).await?;
    let trading_agents_child = spawn_python_trading_agents(&trading_agents_socket).await?;

    let result = async {
        let now = Utc
            .with_ymd_and_hms(2026, 1, 1, 0, 1, 0)
            .single()
            .expect("valid timestamp");
        let runtime_deadline = Utc::now() + ChronoDuration::minutes(5);
        let auth = auth_context();
        let snapshots = snapshot_catalog(auth.tenant_id);
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .expect("valid snapshot rules");

        let mut runtime = InMemoryRuntimeKernel::new();
        runtime.register_tool(tool_registration())?;
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut repository = InMemorySignalProposalRepository::new();
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(
            &mut manager,
            openbb_adapter_manifest(openbb_adapter_socket.clone()),
        )?;
        register_reviewed_engine(&mut manager, llmquant_manifest(llmquant_socket.clone()))?;
        register_reviewed_engine(
            &mut manager,
            trading_agents_manifest(trading_agents_socket.clone()),
        )?;

        let mut run_ids = Vec::new();
        let mut proposals = Vec::new();
        {
            let mut coordinator = SignalProposalWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                SignalProposalWorkflowCoordinatorConfig {
                    worker_name: "signal-proposal-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    data_query_capability: "data.query.v1".to_owned(),
                    signal_capability: "quant.signal.v1".to_owned(),
                    proposal_capability: "decision.proposal.v1".to_owned(),
                },
            );

            for index in 0..100 {
                let (symbol, signal_fixture, proposal_fixture, data_query_fixture) =
                    fixture_quartet(index);
                let snapshot_id = snapshot_id_for_symbol(&snapshots, auth.tenant_id, symbol);
                let run = coordinator.schedule_workflow_run(
                    SignalProposalWorkflowInput {
                        runtime_session_id: session.runtime_session_id,
                        tool_name: "signal.proposal.workflow".to_owned(),
                        capability: Capability::parse("signal.proposal.workflow.v1")?,
                        workflow_kind: "signal_proposal".to_owned(),
                        idempotency_key: format!("signal-proposal-{index:03}"),
                        correlation_id: CorrelationId::new(),
                        feature_snapshot_id: snapshot_id,
                        policy_context_ref: format!("policy-snapshot-{index:03}"),
                        data_query_input_schema_version: Some("v1".to_owned()),
                        data_query_input: Some(serde_json::json!({
                            "provider": "mock",
                            "fixture": data_query_fixture,
                            "query_text": format!("research query {index:03}"),
                            "intended_use": "research",
                            "deployment_target": "test",
                            "tools": ["query_snapshot", "query_artifact"],
                        })),
                        provided_data_query: None,
                        signal_input_schema_version: "v1".to_owned(),
                        signal_input: serde_json::json!({
                            "fixture": signal_fixture,
                            "strategy_release_id": format!("strategy.release.{index:03}"),
                            "feature_snapshot_id": snapshot_id.to_string(),
                            "tools": ["query_snapshot", "query_artifact"],
                        }),
                        provided_signal: None,
                        research_input: None,
                        proposal_input_schema_version: "v1".to_owned(),
                        proposal_input: serde_json::json!({
                            "fixture": proposal_fixture,
                            "account_id": format!("paper-account-{}", index % 5),
                            "policy_snapshot_id": format!("policy-snapshot-{index:03}"),
                            "portfolio_snapshot_id": format!("portfolio-snapshot-{index:03}"),
                            "tools": ["query_signal", "query_snapshot", "query_artifact"],
                        }),
                        max_attempts: 1,
                        deadline_at: runtime_deadline,
                        cost_budget_units: 500,
                        rate_limit_per_minute: 120,
                    },
                    now,
                )?;
                run_ids.push(run.workflow_run_id);
            }

            for _ in 0..100 {
                let result = coordinator
                    .execute_next(now)
                    .await?
                    .expect("workflow result");
                assert_eq!(result.run.status, WorkflowRunStatus::Succeeded);
                let data_query = result.data_query.as_ref().expect("data query record");
                assert_eq!(data_query.auxiliary_artifact_manifests.len(), 2);
                assert!(!data_query.trading_approved);
                assert!(!result.signal.evidence_refs.is_empty());
                assert_eq!(result.signal.auxiliary_artifact_manifests.len(), 1);
                assert!(!result.proposal.evidence_refs.is_empty());
                assert_eq!(result.proposal.counter_views.len(), 2);
                assert!(
                    result
                        .proposal
                        .counter_views
                        .iter()
                        .all(|view| view.starts_with("Counterpoint:"))
                );
                assert_eq!(result.proposal.auxiliary_artifact_manifests.len(), 2);
                assert!(!result.proposal.executable);
                assert!(
                    result
                        .signal
                        .output
                        .to_string()
                        .contains(data_query.response_hash.as_str())
                );
                TradeProposalEvaluationGate::ensure_evaluable(
                    &result.proposal,
                    result.proposal.expires_at - ChronoDuration::seconds(1),
                )?;
                let expired = TradeProposalEvaluationGate::ensure_evaluable(
                    &result.proposal,
                    result.proposal.expires_at + ChronoDuration::seconds(1),
                )
                .expect_err("expired proposal should be rejected");
                assert!(matches!(
                    expired,
                    SignalProposalWorkflowError::ProposalExpired { .. }
                ));
                proposals.push(result.proposal);
            }
        }

        write_r04_evidence("proposal-matrix.json", &serde_json::json!({"schema":"quantos-r04-proposal-matrix/v1","fixture":true,"formalAccepted":false,"databaseExecution":false,"proposals":proposals}))?;
        assert_eq!(proposals.len(), 100);
        assert_eq!(repository.physical_signal_count(), 100);
        assert_eq!(repository.physical_proposal_count(), 100);
        for run_id in &run_ids {
            assert_eq!(runtime.run_artifact_count(*run_id), 8);
            assert!(repository.signal_for_run(*run_id).is_some());
            assert!(repository.proposal_for_run(*run_id).is_some());
        }

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(openbb_adapter_child, &openbb_adapter_socket).await;
    shutdown_child(llmquant_child, &llmquant_socket).await;
    shutdown_child(trading_agents_child, &trading_agents_socket).await;
    result
}

#[tokio::test]
async fn signal_proposal_workflow_replay_keeps_signal_and_proposal_hashes_stable() -> Result<()> {
    let openbb_adapter_socket = openbb_adapter_socket_path();
    let llmquant_socket = llmquant_socket_path();
    let trading_agents_socket = trading_agents_socket_path();
    let openbb_adapter_child = spawn_python_openbb_adapter(&openbb_adapter_socket).await?;
    let llmquant_child = spawn_python_llmquant(&llmquant_socket).await?;
    let trading_agents_child = spawn_python_trading_agents(&trading_agents_socket).await?;

    let result = async {
        let now = Utc
            .with_ymd_and_hms(2026, 1, 1, 0, 1, 0)
            .single()
            .expect("valid timestamp");
        let runtime_deadline = Utc::now() + ChronoDuration::minutes(5);
        let auth = auth_context();
        let snapshots = snapshot_catalog(auth.tenant_id);
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .expect("valid snapshot rules");
        let snapshot_id = snapshot_id_for_symbol(&snapshots, auth.tenant_id, "BTCUSDT");
        let shared_correlation_id = CorrelationId::new();

        let mut runtime = InMemoryRuntimeKernel::new();
        runtime.register_tool(tool_registration())?;
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut repository = InMemorySignalProposalRepository::new();
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(
            &mut manager,
            openbb_adapter_manifest(openbb_adapter_socket.clone()),
        )?;
        register_reviewed_engine(&mut manager, llmquant_manifest(llmquant_socket.clone()))?;
        register_reviewed_engine(
            &mut manager,
            trading_agents_manifest(trading_agents_socket.clone()),
        )?;

        let mut results = Vec::new();
        {
            let mut coordinator = SignalProposalWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                SignalProposalWorkflowCoordinatorConfig {
                    worker_name: "signal-proposal-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    data_query_capability: "data.query.v1".to_owned(),
                    signal_capability: "quant.signal.v1".to_owned(),
                    proposal_capability: "decision.proposal.v1".to_owned(),
                },
            );

            for index in 0..2 {
                coordinator.schedule_workflow_run(
                    SignalProposalWorkflowInput {
                        runtime_session_id: session.runtime_session_id,
                        tool_name: "signal.proposal.workflow".to_owned(),
                        capability: Capability::parse("signal.proposal.workflow.v1")?,
                        workflow_kind: "signal_proposal".to_owned(),
                        idempotency_key: format!("signal-proposal-replay-{index:03}"),
                        correlation_id: shared_correlation_id,
                        feature_snapshot_id: snapshot_id,
                        policy_context_ref: "policy-snapshot-replay".to_owned(),
                        data_query_input_schema_version: Some("v1".to_owned()),
                        data_query_input: Some(serde_json::json!({
                            "provider": "mock",
                            "fixture": "crypto_market_btc",
                            "query_text": "research replay query",
                            "intended_use": "research",
                            "deployment_target": "test",
                            "tools": ["query_snapshot", "query_artifact"],
                        })),
                        provided_data_query: None,
                        signal_input_schema_version: "v1".to_owned(),
                        signal_input: serde_json::json!({
                            "fixture": "trend_long_quality",
                            "strategy_release_id": "strategy.release.replay",
                            "feature_snapshot_id": snapshot_id.to_string(),
                            "tools": ["query_snapshot", "query_artifact"],
                        }),
                        provided_signal: None,
                        research_input: None,
                        proposal_input_schema_version: "v1".to_owned(),
                        proposal_input: serde_json::json!({
                            "fixture": "committee_bull_breakout",
                            "account_id": "paper-account-replay",
                            "policy_snapshot_id": "policy-snapshot-replay",
                            "portfolio_snapshot_id": "portfolio-snapshot-replay",
                            "tools": ["query_signal", "query_snapshot", "query_artifact"],
                        }),
                        max_attempts: 1,
                        deadline_at: runtime_deadline,
                        cost_budget_units: 500,
                        rate_limit_per_minute: 120,
                    },
                    now,
                )?;
            }

            for _ in 0..2 {
                results.push(
                    coordinator
                        .execute_next(now)
                        .await?
                        .expect("workflow result"),
                );
            }
        }

        assert_eq!(results.len(), 2);
        assert_eq!(
            results[0].signal.artifact_manifest.content_hash,
            results[1].signal.artifact_manifest.content_hash
        );
        assert_eq!(
            results[0].proposal.artifact_manifest.content_hash,
            results[1].proposal.artifact_manifest.content_hash
        );
        assert_eq!(
            results[0]
                .data_query
                .as_ref()
                .expect("data query")
                .artifact_manifest
                .content_hash,
            results[1]
                .data_query
                .as_ref()
                .expect("data query")
                .artifact_manifest
                .content_hash
        );
        assert_eq!(repository.physical_signal_count(), 1);
        assert_eq!(repository.physical_proposal_count(), 1);
        assert_eq!(runtime.physical_artifact_count(), 8);

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(openbb_adapter_child, &openbb_adapter_socket).await;
    shutdown_child(llmquant_child, &llmquant_socket).await;
    shutdown_child(trading_agents_child, &trading_agents_socket).await;
    result
}

#[tokio::test]
async fn signal_proposal_workflow_rejects_forbidden_order_tools() -> Result<()> {
    let openbb_adapter_socket = openbb_adapter_socket_path();
    let llmquant_socket = llmquant_socket_path();
    let trading_agents_socket = trading_agents_socket_path();
    let openbb_adapter_child = spawn_python_openbb_adapter(&openbb_adapter_socket).await?;
    let llmquant_child = spawn_python_llmquant(&llmquant_socket).await?;
    let trading_agents_child = spawn_python_trading_agents(&trading_agents_socket).await?;

    let result = async {
        let now = Utc
            .with_ymd_and_hms(2026, 1, 1, 0, 1, 0)
            .single()
            .expect("valid timestamp");
        let runtime_deadline = Utc::now() + ChronoDuration::minutes(5);
        let auth = auth_context();
        let snapshots = snapshot_catalog(auth.tenant_id);
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .expect("valid snapshot rules");
        let snapshot_id = snapshot_id_for_symbol(&snapshots, auth.tenant_id, "BTCUSDT");

        let mut runtime = InMemoryRuntimeKernel::new();
        runtime.register_tool(tool_registration())?;
        let session = runtime.open_session(&auth, now, now + ChronoDuration::hours(1));

        let mut repository = InMemorySignalProposalRepository::new();
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(
            &mut manager,
            openbb_adapter_manifest(openbb_adapter_socket.clone()),
        )?;
        register_reviewed_engine(&mut manager, llmquant_manifest(llmquant_socket.clone()))?;
        register_reviewed_engine(
            &mut manager,
            trading_agents_manifest(trading_agents_socket.clone()),
        )?;

        let run_id;
        {
            let mut coordinator = SignalProposalWorkflowCoordinator::new(
                &mut runtime,
                &snapshots,
                &rules,
                &mut repository,
                &mut manager,
                SignalProposalWorkflowCoordinatorConfig {
                    worker_name: "signal-proposal-worker".to_owned(),
                    lease_duration: ChronoDuration::seconds(5),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    data_query_capability: "data.query.v1".to_owned(),
                    signal_capability: "quant.signal.v1".to_owned(),
                    proposal_capability: "decision.proposal.v1".to_owned(),
                },
            );

            let run = coordinator.schedule_workflow_run(
                SignalProposalWorkflowInput {
                    runtime_session_id: session.runtime_session_id,
                    tool_name: "signal.proposal.workflow".to_owned(),
                    capability: Capability::parse("signal.proposal.workflow.v1")?,
                    workflow_kind: "signal_proposal".to_owned(),
                    idempotency_key: "signal-proposal-deny".to_owned(),
                    correlation_id: CorrelationId::new(),
                    feature_snapshot_id: snapshot_id,
                    policy_context_ref: "policy-snapshot-deny".to_owned(),
                    data_query_input_schema_version: Some("v1".to_owned()),
                    data_query_input: Some(serde_json::json!({
                        "provider": "mock",
                        "fixture": "crypto_market_btc",
                        "query_text": "btc market snapshot",
                        "intended_use": "research",
                        "deployment_target": "test",
                        "tools": ["query_snapshot", "query_artifact"],
                    })),
                    provided_data_query: None,
                    signal_input_schema_version: "v1".to_owned(),
                    signal_input: serde_json::json!({
                        "fixture": "trend_long_quality",
                        "strategy_release_id": "strategy.release.deny",
                        "feature_snapshot_id": snapshot_id.to_string(),
                        "tools": ["query_snapshot", "query_artifact"],
                    }),
                    provided_signal: None,
                    research_input: None,
                    proposal_input_schema_version: "v1".to_owned(),
                    proposal_input: serde_json::json!({
                        "fixture": "committee_bull_breakout",
                        "account_id": "paper-account-deny",
                        "policy_snapshot_id": "policy-snapshot-deny",
                        "portfolio_snapshot_id": "portfolio-snapshot-deny",
                        "tools": ["query_signal", "order.execute"],
                    }),
                    max_attempts: 1,
                    deadline_at: runtime_deadline,
                    cost_budget_units: 500,
                    rate_limit_per_minute: 120,
                },
                now,
            )?;
            run_id = run.workflow_run_id;

            let error = coordinator
                .execute_next(now)
                .await
                .expect_err("forbidden order tool should fail");
            assert!(!error.to_string().trim().is_empty());
        }

        let run = runtime.run(run_id).expect("run exists");
        assert_eq!(run.status, WorkflowRunStatus::Failed);
        assert!(
            run.last_error
                .as_deref()
                .unwrap_or_default()
                .contains("forbidden")
        );
        assert!(repository.signal_for_run(run_id).is_some());
        assert!(repository.proposal_for_run(run_id).is_none());
        write_r04_evidence("order-denial.json", &serde_json::json!({"status":"REJECTED","tool":"order.execute","workflowStatus":run.status,"proposalCreated":false,"lastError":run.last_error}))?;

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(openbb_adapter_child, &openbb_adapter_socket).await;
    shutdown_child(llmquant_child, &llmquant_socket).await;
    shutdown_child(trading_agents_child, &trading_agents_socket).await;
    result
}

#[tokio::test]
async fn r04_consumes_r03_artifact_with_bound_provenance_and_rejects_invalid_references()
-> Result<()> {
    use quantos_runtime::research::{
        InMemoryResearchArtifactRepository, ResearchWorkflowCoordinator,
        ResearchWorkflowCoordinatorConfig, ResearchWorkflowInput,
    };
    use quantos_runtime::signal_proposal::ResearchInputRef;
    let rd_socket =
        PathBuf::from("/tmp").join(format!("quantos-r04-rd-agent-{}.sock", fixture_id()));
    let mut rd_command = Command::new(engines_dir().join(".venv/bin/python"));
    let rd_child = rd_command
        .current_dir(engines_dir())
        .args(["-m", "rd_agent.server", "--socket"])
        .arg(&rd_socket)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()?;
    for _ in 0..100 {
        if rd_socket.exists() {
            sleep(Duration::from_millis(100)).await;
            break;
        }
        sleep(Duration::from_millis(50)).await;
    }
    let llm_socket = llmquant_socket_path();
    let ta_socket = trading_agents_socket_path();
    let llm_child = spawn_python_llmquant(&llm_socket).await?;
    let ta_child = spawn_python_trading_agents(&ta_socket).await?;
    let result = async {
        let now=Utc.with_ymd_and_hms(2026,1,1,0,1,0).single().unwrap();
        let mut auth=auth_context(); let research_cap=Capability::parse("research.hypothesis.v1")?;
        auth.capabilities.insert(research_cap.clone());
        let snapshots=snapshot_catalog(auth.tenant_id);
        let snapshot=snapshot_id_for_symbol(&snapshots,auth.tenant_id,"BTCUSDT");
        let rules=SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id,now))?;
        let mut runtime=InMemoryRuntimeKernel::new();runtime.register_tool(tool_registration())?;
        runtime.register_tool(ToolRegistration {tool_name:research_cap.as_str().into(),capability:research_cap.clone(),description:"Synthetic research".into(),max_cost_units:10000,rate_limit_per_minute:600,enabled:true})?;
        let session=runtime.open_session(&auth,now,now+ChronoDuration::hours(1));
        let mut manager=EngineManager::with_approval_key(BackoffPolicy::default(),TEST_APPROVAL_KEY.to_vec());
        let mut rd_manifest=llmquant_manifest(rd_socket.clone());rd_manifest.engine_name="rd-agent".into();rd_manifest.capabilities=vec![EngineCapabilityManifest {name:research_cap.as_str().into(),version:"1.0.0".into(),description:"Generate deterministic hypothesis ResearchArtifacts.".into()},EngineCapabilityManifest {name:"research.experiment.v1".into(),version:"1.0.0".into(),description:"Generate deterministic experiment ResearchArtifacts.".into()}];
        register_reviewed_engine(&mut manager,rd_manifest)?;
        register_reviewed_engine(&mut manager,llmquant_manifest(llm_socket.clone()))?;
        register_reviewed_engine(&mut manager,trading_agents_manifest(ta_socket.clone()))?;
        let mut research=InMemoryResearchArtifactRepository::new();
        let artifact={let mut coordinator=ResearchWorkflowCoordinator::new(&mut runtime,&snapshots,&rules,&mut research,&mut manager,ResearchWorkflowCoordinatorConfig {worker_name:"r04-research".into(),lease_duration:ChronoDuration::seconds(5),storage_bucket:"quantos-artifacts".into()});
            coordinator.schedule_research_run(ResearchWorkflowInput {runtime_session_id:session.runtime_session_id,tool_name:research_cap.as_str().into(),capability:research_cap,workflow_kind:"research".into(),idempotency_key:"r04-research-source".into(),correlation_id:CorrelationId::new(),data_snapshot_id:snapshot,policy_context_ref:"policy-r04".into(),input_schema_version:"v1".into(),input:serde_json::json!({"fixture":"hypothesis_regime_shift","prompt":"Synthetic R04 consumption"}),max_attempts:1,deadline_at:Utc::now()+ChronoDuration::minutes(5),cost_budget_units:250,rate_limit_per_minute:60},now)?;
            coordinator.execute_next(now).await?.unwrap().artifact};
        let reference=ResearchInputRef {schema_version:"v1".into(),workflow_run_id:artifact.workflow_run_id,artifact_id:artifact.artifact_manifest.artifact_id,content_hash:artifact.artifact_manifest.content_hash.clone(),expires_at:now+ChronoDuration::minutes(10)};
        let base=SignalProposalWorkflowInput {runtime_session_id:session.runtime_session_id,tool_name:"signal.proposal.workflow".into(),capability:Capability::parse("signal.proposal.workflow.v1")?,workflow_kind:"signal_proposal".into(),idempotency_key:"r04-research-consumer".into(),correlation_id:CorrelationId::new(),feature_snapshot_id:snapshot,policy_context_ref:"policy-r04".into(),data_query_input_schema_version:None,data_query_input:None,provided_data_query:None,signal_input_schema_version:"v1".into(),signal_input:serde_json::json!({"fixture":"trend_long_quality","strategy_release_id":"strategy.r04","feature_snapshot_id":snapshot.to_string(),"tools":["query_snapshot","query_artifact"]}),provided_signal:None,research_input:Some(reference),proposal_input_schema_version:"v1".into(),proposal_input:serde_json::json!({"fixture":"committee_bull_breakout","account_id":"paper-r04","policy_snapshot_id":"policy-r04","portfolio_snapshot_id":"portfolio-r04","tools":["query_signal","query_snapshot","query_artifact"]}),max_attempts:1,deadline_at:Utc::now()+ChronoDuration::minutes(5),cost_budget_units:500,rate_limit_per_minute:120};
        let mut repository=InMemorySignalProposalRepository::new();
        let config=SignalProposalWorkflowCoordinatorConfig {worker_name:"r04-consumer".into(),lease_duration:ChronoDuration::seconds(5),storage_bucket:"quantos-artifacts".into(),data_query_capability:"data.query.v1".into(),signal_capability:"quant.signal.v1".into(),proposal_capability:"decision.proposal.v1".into()};
        // Rejections occur before queue/artifact/Engine dispatch; malformed references cannot consume authority.
        let mut foreign_auth=auth.clone();foreign_auth.tenant_id=TenantId::new();let foreign=runtime.open_session(&foreign_auth,now,now+ChronoDuration::hours(1));
        let mut actor_auth=auth.clone();actor_auth.actor_id=ActorId::new();let actor=runtime.open_session(&actor_auth,now,now+ChronoDuration::hours(1));
        let mut workspace_auth=auth.clone();workspace_auth.workspace_id=WorkspaceId::new();let workspace=runtime.open_session(&workspace_auth,now,now+ChronoDuration::hours(1));
        let mut ungranted_auth=auth.clone();ungranted_auth.capabilities.remove(&Capability::parse("research.hypothesis.v1")?);let ungranted=runtime.open_session(&ungranted_auth,now,now+ChronoDuration::hours(1));
        let expired_run;
        for case in 0..8 {
            let mut forged=artifact.clone();
            match case {0=>forged.output["summary"]=serde_json::json!("tampered"),1=>forged.evidence_refs.clear(),2=>forged.evidence_refs[0].artifact_id="forged".into(),3=>forged.input_hash=quantos_core::ContentHash::sha256_bytes(b"other"),4=>forged.artifact_manifest.size_bytes+=1,5=>forged.capability="order.execute.v1".into(),6=>forged.artifact_manifest.media_type="text/plain".into(),7=>forged.artifact_manifest.tenant_id=TenantId::new(),_=>unreachable!()}
            let mut forged_repository=InMemoryResearchArtifactRepository::new();forged_repository.upsert(forged);
            let mut coordinator=SignalProposalWorkflowCoordinator::new(&mut runtime,&snapshots,&rules,&mut repository,&mut manager,config.clone()).with_research_repository(&forged_repository);
            assert!(coordinator.schedule_workflow_run(base.clone(),now).is_err(),"forged repository {case}");
        }
        {let mut coordinator=SignalProposalWorkflowCoordinator::new(&mut runtime,&snapshots,&rules,&mut repository,&mut manager,config.clone()).with_research_repository(&research);
        for case in 0..14 { let mut bad=base.clone();bad.idempotency_key=format!("bad-r04-{case}");let r=bad.research_input.as_mut().unwrap();match case {0=>r.schema_version="v2".into(),1=>r.content_hash=quantos_core::ContentHash::sha256_bytes(b"tampered"),2=>r.artifact_id=quantos_core::ArtifactId::new(),3=>r.workflow_run_id=quantos_core::WorkflowRunId::new(),4=>r.expires_at=now,5=>bad.policy_context_ref="other".into(),6=>bad.feature_snapshot_id=quantos_core::SnapshotId::new(),7=>bad.runtime_session_id=foreign.runtime_session_id,8=>bad.runtime_session_id=actor.runtime_session_id,9=>bad.runtime_session_id=workspace.runtime_session_id,10=>bad.runtime_session_id=ungranted.runtime_session_id,11=>bad.signal_input["research_context"]=serde_json::json!({"source":"forged"}),12=>bad.signal_input_schema_version="v2".into(),13=>bad.proposal_input_schema_version="v2".into(),_=>unreachable!()};assert!(coordinator.schedule_workflow_run(bad,now).is_err(),"case {case}");}
        let run=coordinator.schedule_workflow_run(base.clone(),now)?;
        assert_eq!(coordinator.schedule_workflow_run(base.clone(),now)?.workflow_run_id,run.workflow_run_id);
        let consumed=coordinator.execute_next(now).await?.unwrap();
        assert_eq!(consumed.run.status,WorkflowRunStatus::Succeeded);
        let context=&consumed.signal.output["diagnostics"]["value"]["research_context"];
        assert_eq!(context["source"]["content_hash"],artifact.artifact_manifest.content_hash.as_str());
        assert_eq!(context["source"]["workflow_run_id"],artifact.workflow_run_id.to_string());
        assert_eq!(context["summary"],artifact.output["summary"]);
        assert_eq!(context["evidence_refs"],serde_json::to_value(&artifact.evidence_refs)?);
        assert_eq!(&consumed.proposal.output["signal"]["diagnostics"]["value"]["research_context"],context);
        for evidence in &artifact.evidence_refs {
            assert!(consumed.signal.evidence_refs.iter().any(|e| e.evidence_id == evidence.evidence_id && e.artifact_id == evidence.artifact_id && e.summary == evidence.summary));
            assert!(consumed.proposal.evidence_refs.iter().any(|e| e.evidence_id == evidence.evidence_id && e.artifact_id == evidence.artifact_id && e.summary == evidence.summary));
        }
        assert!(!consumed.proposal.executable);assert!(!consumed.proposal.counter_views.is_empty());
        write_r04_evidence("research-consumption.json", &serde_json::json!({"schema":"quantos-r04-research-consumption/v1","source":artifact,"signal":consumed.signal,"proposal":consumed.proposal,"rejectedReferences":22,"ordersExecuted":0,"fixture":true,"formalAccepted":false,"databaseExecution":false}))?;
        assert!(TradeProposalEvaluationGate::ensure_evaluable(&consumed.proposal,consumed.proposal.expires_at).is_err());
        let mut replay=base.clone();replay.idempotency_key="r04-consumer-replay".into();let replay_run=coordinator.schedule_workflow_run(replay,now)?;let replay_result=coordinator.execute_next(now).await?.unwrap();assert_eq!(replay_result.run.workflow_run_id,replay_run.workflow_run_id);
        // Run identity is part of Engine provenance; source binding remains exact on replay.
        assert_eq!(replay_result.signal.output["diagnostics"]["value"]["research_context"],*context);
        let mut expiring=base.clone();expiring.idempotency_key="r04-expiring".into();expiring.research_input.as_mut().unwrap().expires_at=now+ChronoDuration::seconds(1);expired_run=coordinator.schedule_workflow_run(expiring,now)?;assert!(matches!(coordinator.execute_next(now+ChronoDuration::seconds(1)).await,Err(SignalProposalWorkflowError::InvalidResearchInput)));
        }
        assert_eq!(runtime.run(expired_run.workflow_run_id).unwrap().status,WorkflowRunStatus::Failed);
        assert_eq!(runtime.run_artifact_count(expired_run.workflow_run_id),0);
        assert_eq!(repository.physical_proposal_count(),1);
        assert!(runtime.audit_log().iter().all(|entry| !format!("{entry:?}").contains("order.execute")));
        Ok::<(),anyhow::Error>(())
    }.await;
    shutdown_child(rd_child, &rd_socket).await;
    shutdown_child(llm_child, &llm_socket).await;
    shutdown_child(ta_child, &ta_socket).await;
    result
}

fn write_r04_evidence(name: &str, value: &serde_json::Value) -> Result<()> {
    if let Ok(directory) = std::env::var("QUANTOS_R04_EVIDENCE_DIR") {
        let path = PathBuf::from(directory);
        std::fs::create_dir_all(&path)?;
        std::fs::write(path.join(name), serde_json::to_vec_pretty(value)?)?;
    }
    Ok(())
}
