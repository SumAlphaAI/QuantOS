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

fn engines_dir() -> PathBuf {
    repo_root().join("engines")
}

fn llmquant_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-r04-llmquant-{}.sock", Uuid::now_v7()))
}

fn trading_agents_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!(
        "quantos-r04-trading-agents-{}.sock",
        Uuid::now_v7()
    ))
}

fn openbb_adapter_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!(
        "quantos-r04-openbb-adapter-{}.sock",
        Uuid::now_v7()
    ))
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
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-llmquant")
        .arg("python")
        .arg("-m")
        .arg("llmquant.server")
        .arg("--socket")
        .arg(socket_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
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
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-trading-agents")
        .arg("python")
        .arg("-m")
        .arg("trading_agents.server")
        .arg("--socket")
        .arg(socket_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
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
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-openbb-adapter")
        .arg("python")
        .arg("-m")
        .arg("openbb_adapter.server")
        .arg("--socket")
        .arg(socket_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
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
    let _ = child.wait().await;
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
                    end_at: Utc
                        .with_ymd_and_hms(2026, 1, 1, 0, 30, 0)
                        .single()
                        .expect("valid timestamp"),
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
        catalog.upsert(snapshot);
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
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now));

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
                        policy_context_ref: format!("policy-context-{index:03}"),
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
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now));
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
                        policy_context_ref: "policy-context-replay".to_owned(),
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
        let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now));
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
                    policy_context_ref: "policy-context-deny".to_owned(),
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

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(openbb_adapter_child, &openbb_adapter_socket).await;
    shutdown_child(llmquant_child, &llmquant_socket).await;
    shutdown_child(trading_agents_child, &trading_agents_socket).await;
    result
}
