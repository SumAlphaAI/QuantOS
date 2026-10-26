//! Actual local R03 workers and both owned Python engines. No output file import.
use crate::strategy::reference_auth;
use chrono::{Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{CorrelationId, WorkflowRunId};
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineManager, EngineManifest,
    EngineQuota, EngineTransport,
};
use quantos_policy::Capability;
use quantos_runtime::{
    InMemoryRuntimeKernel, ToolRegistration,
    research::{
        InMemoryResearchArtifactRepository, ResearchWorkflowCoordinator,
        ResearchWorkflowCoordinatorConfig, ResearchWorkflowInput,
    },
};
use quantos_storage::{InMemoryDataSnapshotCatalog, SnapshotQualityRuleset, default_quality_rules};
use quantos_strategy::backtest::BacktestRequest;
use serde_json::{Value, json};
use std::{path::PathBuf, process::Stdio};
use uuid::Uuid;

pub(crate) struct Pipeline {
    pub auth: AuthContext,
    pub runtime: InMemoryRuntimeKernel,
    pub repository: InMemoryResearchArtifactRepository,
    pub snapshots: InMemoryDataSnapshotCatalog,
    pub rules: SnapshotQualityRuleset,
    pub runs: Vec<(WorkflowRunId, BacktestRequest)>,
    pub probes: Value,
}
impl Pipeline {
    pub async fn install(
        &self,
        p: &crate::BffProvider,
    ) -> std::result::Result<Vec<Value>, &'static str> {
        p.install_completed_research_strategies(
            &self.auth,
            &self.runtime,
            &self.repository,
            self.snapshots.clone(),
            self.rules.clone(),
            self.runs.clone(),
        )
        .await
    }
}
pub(crate) struct Engine {
    child: tokio::process::Child,
    socket: PathBuf,
}
const ENGINE_STARTUP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

async fn wait_for_engine(
    engine: &mut Engine,
    name: &str,
    budget: std::time::Duration,
) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + budget;
    loop {
        if let Some(status) = engine.child.try_wait().map_err(|error| error.to_string())? {
            return Err(format!("engine {name} exited during startup: {status}"));
        }
        if engine.socket.exists()
            && let Ok(Ok(_connection)) =
                tokio::time::timeout_at(deadline, tokio::net::UnixStream::connect(&engine.socket))
                    .await
        {
            return Ok(());
        }
        let now = tokio::time::Instant::now();
        if now >= deadline {
            return Err(format!(
                "engine {name} startup timed out after {budget:?}; socket {}",
                engine.socket.display()
            ));
        }
        tokio::time::sleep_until((now + std::time::Duration::from_millis(50)).min(deadline)).await;
    }
}
impl Drop for Engine {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
        let _ = std::fs::remove_file(&self.socket);
    }
}
pub(crate) async fn engine(manager: &mut EngineManager, name: &str, capability: &str) -> Engine {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let socket = PathBuf::from(format!("/tmp/q-g3-{}.sock", Uuid::new_v4()));
    let module = name.replace('-', "_") + ".server";
    let child = tokio::process::Command::new(root.join("engines/.venv/bin/python"))
        .current_dir(root.join("engines"))
        .env_clear()
        .env("PATH", std::env::var("PATH").unwrap())
        .env("HOME", std::env::var("HOME").unwrap())
        .args(["-m", &module, "--socket", socket.to_str().unwrap()])
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    // Cold Python imports compete with the rest of the parallel BFF suite on
    // small CI runners. Bound listener readiness independently of work deadlines,
    // fail immediately on child exit, and keep RAII cleanup active on failures.
    let mut engine = Engine { child, socket };
    wait_for_engine(&mut engine, name, ENGINE_STARTUP_TIMEOUT)
        .await
        .unwrap_or_else(|error| panic!("{error}"));
    let socket = engine.socket.clone();
    let mut manifest = EngineManifest {
        engine_name: name.into(),
        engine_version: "0.1.0".into(),
        supported_schema_versions: vec!["v1".into()],
        capabilities: vec![EngineCapabilityManifest {
            name: capability.into(),
            version: "1.0.0".into(),
            description: "owned local G3 engine".into(),
        }],
        transport: EngineTransport::Uds {
            socket_path: socket.clone(),
        },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    };
    if name == "rd-agent" {
        manifest.capabilities.push(EngineCapabilityManifest {
            name: "research.experiment.v1".into(),
            version: "1.0.0".into(),
            description: "Generate deterministic experiment ResearchArtifacts.".into(),
        });
    }
    let approval = EngineApproval::sign_for_local_fixture(
        &manifest,
        &"a".repeat(64),
        "G3 local fixture reviewer",
        b"g3-local-only",
    )
    .unwrap();
    manager
        .register_approved_engine(manifest, &approval)
        .unwrap();
    engine
}

fn startup_fixture(script: &str) -> Engine {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let socket = PathBuf::from(format!("/tmp/q-g3-startup-{}.sock", Uuid::new_v4()));
    let child = tokio::process::Command::new(root.join("engines/.venv/bin/python"))
        .args(["-c", script, socket.to_str().unwrap()])
        .env_clear()
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    Engine { child, socket }
}

#[tokio::test]
async fn engine_startup_accepts_a_listener_that_needs_more_than_five_seconds() {
    let mut engine = startup_fixture(
        "import socket,sys,time; time.sleep(5.2); s=socket.socket(socket.AF_UNIX); s.bind(sys.argv[1]); s.listen(1); time.sleep(30)",
    );
    wait_for_engine(&mut engine, "slow-fixture", ENGINE_STARTUP_TIMEOUT)
        .await
        .unwrap();
}

#[tokio::test]
async fn engine_startup_rejects_child_exit_and_retains_the_status() {
    let mut engine = startup_fixture("raise SystemExit(7)");
    let error = wait_for_engine(&mut engine, "exit-fixture", ENGINE_STARTUP_TIMEOUT)
        .await
        .unwrap_err();
    assert!(error.contains("exit-fixture") && error.contains("exited") && error.contains('7'));
}

#[tokio::test]
async fn engine_startup_refuses_an_alive_child_without_a_listener_at_the_deadline() {
    let mut engine = startup_fixture("import time; time.sleep(30)");
    let error = wait_for_engine(
        &mut engine,
        "unready-fixture",
        std::time::Duration::from_millis(100),
    )
    .await
    .unwrap_err();
    assert!(error.contains("unready-fixture") && error.contains("timed out"));
}

pub(crate) async fn pipeline(count: usize) -> Pipeline {
    pipeline_fixture(count, "trend_momentum_btc").await
}
async fn pipeline_fixture(count: usize, fixture: &str) -> Pipeline {
    let now = Utc::now();
    let mut auth = reference_auth(crate::CURRENT_SESSION);
    for cap in ["research.hypothesis.v1", "strategy.generate.v1"] {
        auth.capabilities.insert(Capability::parse(cap).unwrap());
    }
    let rules =
        SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now)).unwrap();
    let mut snapshots = InMemoryDataSnapshotCatalog::new();
    let mut requests = Vec::new();
    for _ in 0..count {
        let (_, _, r, _) = crate::execution::reference_release::material(
            &crate::execution::reference_release::payload(),
        );
        snapshots.upsert(r.snapshot.clone()).unwrap();
        requests.push(r);
    }
    let mut runtime = InMemoryRuntimeKernel::new();
    for cap in ["research.hypothesis.v1", "strategy.generate.v1"] {
        runtime
            .register_tool(ToolRegistration {
                tool_name: cap.into(),
                capability: Capability::parse(cap).unwrap(),
                description: "owned G3 worker".into(),
                max_cost_units: 10000,
                rate_limit_per_minute: 600,
                enabled: true,
            })
            .unwrap();
    }
    let session = runtime.open_session(&auth, now, now + Duration::hours(1));
    let mut repository = InMemoryResearchArtifactRepository::new();
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), b"g3-local-only".to_vec());
    let mut engines = vec![
        engine(&mut manager, "rd-agent", "research.hypothesis.v1").await,
        engine(&mut manager, "strategy-lab", "strategy.generate.v1").await,
    ];
    let mut runs = Vec::new();
    let mut pending_rejected = false;
    for (i, request) in requests.into_iter().enumerate() {
        let mut c = ResearchWorkflowCoordinator::new(
            &mut runtime,
            &snapshots,
            &rules,
            &mut repository,
            &mut manager,
            ResearchWorkflowCoordinatorConfig {
                worker_name: "g3-r03-worker".into(),
                lease_duration: Duration::seconds(30),
                storage_bucket: "owned-local-memory".into(),
            },
        );
        let source = ResearchWorkflowInput {
            runtime_session_id: session.runtime_session_id,
            tool_name: "research.hypothesis.v1".into(),
            capability: Capability::parse("research.hypothesis.v1").unwrap(),
            workflow_kind: "research".into(),
            idempotency_key: format!("g3-parent-{i}"),
            correlation_id: CorrelationId::new(),
            data_snapshot_id: request.snapshot.snapshot_id,
            policy_context_ref: "g3-owned-policy".into(),
            input_schema_version: "v1".into(),
            input: json!({"fixture":"hypothesis_regime_shift","prompt":"Generate a bounded hypothesis"}),
            max_attempts: 1,
            deadline_at: now + Duration::minutes(10),
            cost_budget_units: 250,
            rate_limit_per_minute: 600,
        };
        let parent = c.schedule_research_run(source.clone(), now).unwrap();
        let child = ResearchWorkflowInput {
            tool_name: "strategy.generate.v1".into(),
            capability: Capability::parse("strategy.generate.v1").unwrap(),
            idempotency_key: format!("g3-child-{i}"),
            input: json!({"fixture":fixture}),
            ..source
        };
        assert!(
            c.schedule_research_run(child.clone(), now).is_err(),
            "unparented strategy denied"
        );
        pending_rejected |= c
            .schedule_strategy_from_research(parent.workflow_run_id, child.clone(), now)
            .is_err();
        let research = c.execute_next(Utc::now()).await.unwrap().unwrap();
        assert_eq!(research.run.workflow_run_id, parent.workflow_run_id);
        let mut wrong = child.clone();
        wrong.correlation_id = CorrelationId::new();
        assert!(
            c.schedule_strategy_from_research(parent.workflow_run_id, wrong, now)
                .is_err()
        );
        let mut wrong = child.clone();
        wrong.input["prompt"] = json!("caller override");
        assert!(
            c.schedule_strategy_from_research(parent.workflow_run_id, wrong, now)
                .is_err()
        );
        let scheduled = c
            .schedule_strategy_from_research(parent.workflow_run_id, child.clone(), Utc::now())
            .unwrap();
        assert_eq!(
            c.schedule_strategy_from_research(parent.workflow_run_id, child.clone(), Utc::now())
                .unwrap()
                .workflow_run_id,
            scheduled.workflow_run_id
        );
        let mut changed = child.clone();
        changed.input["fixture"] = json!("range_reversion_eth");
        assert!(
            c.schedule_strategy_from_research(parent.workflow_run_id, changed, Utc::now())
                .is_err(),
            "changed retry intent denied"
        );
        let result = c.execute_next(Utc::now()).await.unwrap().unwrap();
        assert_eq!(result.run.workflow_run_id, scheduled.workflow_run_id);
        assert_eq!(
            c.schedule_strategy_from_research(parent.workflow_run_id, child, Utc::now())
                .unwrap()
                .workflow_run_id,
            scheduled.workflow_run_id
        );
        runs.push((result.run.workflow_run_id, request));
    }
    for e in &mut engines {
        e.child.kill().await.unwrap();
        e.child.wait().await.unwrap();
    }
    Pipeline {
        auth,
        runtime,
        repository,
        snapshots,
        rules,
        runs,
        probes: json!({"pendingParentDenied":pending_rejected,"unparentedStrategyDenied":true,"crossCorrelationDenied":true,"callerPromptDenied":true,"queuedAndCompletedReplayStable":true,"enginesReaped":true}),
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn worker_to_registration_rejects_forgery_and_closes_twenty_causal_chains() {
    use crate::strategy::tests::{call, proof, release, submit};
    let f = pipeline(20).await;
    let p = crate::BffProvider::default();
    let mut denied = Vec::new();
    for mode in [
        "tenant",
        "workspace",
        "actor",
        "capability",
        "snapshot",
        "duplicate",
        "output",
    ] {
        let mut auth = f.auth.clone();
        let mut runs = f.runs.clone();
        let mut repo = f.repository.clone();
        match mode {
            "tenant" => auth.tenant_id = quantos_core::TenantId::new(),
            "workspace" => auth.workspace_id = quantos_core::WorkspaceId::new(),
            "actor" => auth.actor_id = quantos_core::ActorId::new(),
            "capability" => auth.capabilities.clear(),
            "snapshot" => runs[0].1.snapshot = runs[1].1.snapshot.clone(),
            "duplicate" => runs.push(runs[0].clone()),
            "output" => {
                let mut r =
                    quantos_runtime::research::completed_record(&f.runtime, &repo, runs[0].0)
                        .unwrap()
                        .clone();
                r.output["strategy"]["rule_source"] = json!("tampered");
                repo = InMemoryResearchArtifactRepository::new();
                repo.upsert(r);
            }
            _ => unreachable!(),
        }
        assert!(
            p.install_completed_research_strategies(
                &auth,
                &f.runtime,
                &repo,
                f.snapshots.clone(),
                f.rules.clone(),
                runs
            )
            .await
            .is_err(),
            "{mode}"
        );
        assert!(
            p.data.lock().await.strategy.is_none(),
            "failed admission must publish nothing"
        );
        denied.push(mode);
    }
    let (a, b) = tokio::join!(f.install(&p), f.install(&p));
    assert_eq!([a.is_ok(), b.is_ok()].into_iter().filter(|v| *v).count(), 1);
    let registrations = a.or(b).unwrap();
    assert!(
        f.install(&p).await.is_err(),
        "catalog replacement forbidden"
    );
    let router = p.router();
    let mut chains = Vec::new();
    for row in &registrations {
        // C04 members exposed to Web consumers must remain locatable through
        // their C03 parent after the incremental evidence projection is added.
        let run_id = row["researchRun"]["workflow_run_id"].as_str().unwrap();
        let artifact_id = row["researchArtifact"]["artifact_manifest"]["artifact_id"]
            .as_str()
            .unwrap();
        let (status, parent) = call(
            &router,
            "GET",
            &format!("/v1/research-runs/{run_id}"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None,
        )
        .await;
        assert_eq!(status, 200);
        let (status, artifact) = call(
            &router,
            "GET",
            &format!("/v1/artifacts/{artifact_id}"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None,
        )
        .await;
        assert_eq!(status, 200);
        let members: Vec<_> = artifact["evidence"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["evidenceId"].clone())
            .collect();
        assert!(!members.is_empty());
        assert_eq!(parent["evidenceRefs"], json!(members));
        let sid = row["strategyId"].as_str().unwrap();
        let correlation = row["correlationId"].as_str().unwrap();
        let (s, d) = call(
            &router,
            "GET",
            &format!("/v1/strategies/{sid}/draft"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None,
        )
        .await;
        assert_eq!(s, 200, "{d}");
        let (s, check) = call(
            &router,
            "POST",
            &format!("/v1/strategies/{sid}/static-checks"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            d["objectVersion"].as_str(),
        )
        .await;
        assert_eq!(s, 202, "{check}");
        for reference in d["artifactRefs"].as_array().unwrap() {
            let id = reference["artifact_id"].as_str().unwrap();
            let (s, metadata) = call(
                &router,
                "GET",
                &format!("/v1/artifacts/{id}"),
                None,
                crate::CURRENT_SESSION,
                Uuid::new_v4(),
                None,
            )
            .await;
            assert_eq!(s, 200);
            assert_eq!(metadata["contentHash"], reference["content_hash"]);
        }
        let v = release(&router, &d).await;
        assert_eq!(v["evidenceRefs"], d["artifactRefs"]);
        assert_eq!(v["correlationId"], correlation);
        let approval = submit(&router, &v).await;
        let decision = proof(&router, "session-approver").await;
        let decision_key = Uuid::new_v4();
        let (s, _) = call(
            &router,
            "POST",
            &format!(
                "/v1/approvals/{}/decisions",
                approval["jobId"].as_str().unwrap()
            ),
            Some(decision.clone()),
            "session-approver",
            decision_key,
            Some("0"),
        )
        .await;
        assert_eq!(s, 200);
        let before: Vec<_> = p
            .data
            .lock()
            .await
            .audits
            .iter()
            .filter(|e| e["correlationId"] == correlation)
            .cloned()
            .collect();
        let (s, _) = call(
            &router,
            "POST",
            &format!(
                "/v1/approvals/{}/decisions",
                approval["jobId"].as_str().unwrap()
            ),
            Some(decision),
            "session-approver",
            decision_key,
            Some("0"),
        )
        .await;
        assert_eq!(s, 200);
        let (s, chain) = call(
            &router,
            "GET",
            &format!("/v1/audit/evidence-chains/{correlation}?pageSize=100"),
            None,
            crate::CURRENT_SESSION,
            Uuid::new_v4(),
            None,
        )
        .await;
        assert_eq!(s, 200, "{chain}");
        let nodes = chain["items"].as_array().unwrap();
        assert!(nodes.len() >= 8, "{chain}");
        assert_eq!(nodes[0]["kind"], "research.worker.completed");
        assert!(nodes[0].get("causationId").is_none());
        for pair in nodes.windows(2) {
            assert_eq!(pair[1]["causationId"], pair[0]["eventId"], "{chain}");
        }
        assert_eq!(chain["complete"], true);
        let after: Vec<_> = p
            .data
            .lock()
            .await
            .audits
            .iter()
            .filter(|e| e["correlationId"] == correlation)
            .cloned()
            .collect();
        assert_eq!(
            before, after,
            "reads and replay must not rewrite committed audit events"
        );
        chains.push(json!({"registration":row,"release":v,"chain":chain}));
    }
    println!(
        "G3_R03_WORKER_EVIDENCE={}",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"probes":f.probes,"registrationDenials":denied,"journeys":chains,"database":"NOT_RUN","identity":"EXPLICIT_REFERENCE","fullG3":"NOT_READY"})
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn worker_static_rejection_publishes_nothing_and_fresh_valid_worker_recovers() {
    let p = crate::BffProvider::default();
    let rejected = pipeline_fixture(1, "peek_ahead_alpha").await;
    assert!(rejected.install(&p).await.is_err());
    assert!(p.data.lock().await.strategy.is_none());
    let valid = pipeline(1).await;
    assert_eq!(valid.install(&p).await.unwrap().len(), 1);
}
