//! Owned U01 composition host, absent from production binaries. C03 uses the
//! reference intent store; R03 coordinator and RD-Agent execute actual UDS calls.
//! Control port is separate from browser API and never supplies terminal output.
use crate::{BffProvider, g3_research_tests::engine, research};
use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
};
use chrono::{Duration, Utc};
use quantos_core::{CorrelationId, WorkflowRunId};
use quantos_engine_manager::{BackoffPolicy, EngineManager};
use quantos_policy::Capability;
use quantos_runtime::{
    InMemoryRuntimeKernel, ToolRegistration,
    research::{
        InMemoryResearchArtifactRepository, ResearchWorkflowCoordinator,
        ResearchWorkflowCoordinatorConfig, ResearchWorkflowInput,
    },
};
use quantos_storage::{InMemoryDataSnapshotCatalog, SnapshotQualityRuleset, default_quality_rules};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

struct Worker {
    provider: BffProvider,
    runtime: InMemoryRuntimeKernel,
    artifacts: InMemoryResearchArtifactRepository,
    snapshots: InMemoryDataSnapshotCatalog,
    rules: SnapshotQualityRuleset,
    manager: EngineManager,
    session: quantos_core::RuntimeSessionId,
    mapped: BTreeMap<Uuid, WorkflowRunId>,
}
async fn execute(
    State(worker): State<Arc<Mutex<Worker>>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if headers
        .get("x-u01-owned-control")
        .and_then(|v| v.to_str().ok())
        != Some("1")
    {
        return (StatusCode::FORBIDDEN, Json(json!({})));
    }
    let mut worker = worker.lock().await;
    let Worker {
        provider,
        runtime,
        artifacts,
        snapshots,
        rules,
        manager,
        session,
        mapped,
    } = &mut *worker;
    let inputs = provider.data.lock().await.research.owned_inputs();
    let mut results = vec![];
    for (id, input) in inputs {
        if mapped.contains_key(&id) {
            continue;
        }
        let current = provider.data.lock().await.research.runs[&id].clone();
        let now = Utc::now();
        let mut coordinator = ResearchWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            artifacts,
            manager,
            ResearchWorkflowCoordinatorConfig {
                worker_name: "u01-owned-worker".into(),
                lease_duration: Duration::seconds(30),
                storage_bucket: "owned-memory".into(),
            },
        );
        let source = ResearchWorkflowInput {
            runtime_session_id: *session,
            tool_name: input.capability.clone(),
            capability: Capability::parse(&input.capability).unwrap(),
            workflow_kind: "research".into(),
            idempotency_key: format!("u01-{id}"),
            correlation_id: CorrelationId::from_uuid(
                Uuid::parse_str(current["correlationId"].as_str().unwrap()).unwrap(),
            ),
            data_snapshot_id: quantos_core::SnapshotId::from_uuid(input.data_snapshot_id),
            policy_context_ref: "u01-owned-policy".into(),
            input_schema_version: "v1".into(),
            input: research::engine_input(&input.question, &[]).unwrap(),
            max_attempts: 1,
            deadline_at: input.deadline_at,
            cost_budget_units: input.budget.parse().unwrap(),
            rate_limit_per_minute: 600,
        };
        let scheduled = coordinator.schedule_research_run(source, now).unwrap();
        mapped.insert(id, scheduled.workflow_run_id);
        if current["status"] == "cancelled" {
            coordinator
                .cancel_run(scheduled.workflow_run_id, now)
                .await
                .unwrap();
            results.push(json!({"bffRunId":id,"workerRunId":scheduled.workflow_run_id,"status":"cancelled","artifactPublished":false}));
            continue;
        }
        {
            let mut data = provider.data.lock().await;
            data.research.runs.get_mut(&id).unwrap()["status"] = json!("running");
            data.research.emit(id, "research.running");
        }
        let result = coordinator.execute_next(Utc::now()).await.unwrap().unwrap();
        let record = result.artifact;
        assert_eq!(record.workflow_run_id, scheduled.workflow_run_id);
        let artifact_id = *record.artifact_manifest.artifact_id.as_uuid();
        let mut data = provider.data.lock().await;
        let run = data.research.runs.get_mut(&id).unwrap();
        run["status"] = json!(result.run.status.as_str());
        run["engineVersion"] = json!("r03-worker-owned-uds");
        run["artifactRefs"] = json!([artifact_id]);
        run["evidenceRefs"] = json!(
            record
                .evidence_refs
                .iter()
                .map(|e| research::worker_evidence_id(artifact_id, &e.evidence_id))
                .collect::<Vec<_>>()
        );
        let output = json!({"bffRunId":id,"workerRunId":record.workflow_run_id,"input":input,"record":record});
        data.research.worker_records.insert(artifact_id, record);
        data.research.emit(id, "research.completed");
        let mut audit = json!({"jobId":id,"status":"succeeded","correlationId":current["correlationId"],"auditRef":Uuid::new_v4()});
        research::record_reference_audit(&mut data, &mut audit, "research.worker.completed");
        results.push(output);
    }
    (StatusCode::OK, Json(json!({"results":results})))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "explicit U01 owned browser host only"]
async fn browser_host() {
    assert_eq!(std::env::var("QUANTOS_U01_HOST").as_deref(), Ok("1"));
    for name in [
        "DATABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "QUANTOS_BFF_DATABASE_URL",
    ] {
        assert!(std::env::var(name).is_err());
    }
    let provider = BffProvider::default()
        .with_download_origin("https://127.0.0.1:4010")
        .unwrap();
    let mut auth = crate::strategy::reference_auth(crate::CURRENT_SESSION);
    for capability in ["research.hypothesis.v1", "research.experiment.v1"] {
        auth.capabilities
            .insert(Capability::parse(capability).unwrap());
    }
    let now = Utc::now();
    let (_, _, request, _) = crate::execution::reference_release::material(
        &crate::execution::reference_release::payload(),
    );
    let snapshot = request.snapshot;
    let mut snapshots = InMemoryDataSnapshotCatalog::new();
    snapshots.upsert(snapshot.clone()).unwrap();
    {
        let mut data = provider.data.lock().await;
        data.research.snapshots.insert(*snapshot.snapshot_id.as_uuid(), json!({"snapshotId":snapshot.snapshot_id,"schemaVersion":"v1","window":{"start":snapshot.window.start_at,"end":snapshot.window.end_at},"sources":["u01-owned-synthetic"],"quality":"verified","qualityBlocked":false,"contentHash":snapshot.content_hash,"licenseLabel":"fixture-only","capturedAt":snapshot.captured_at,"maxAgeSeconds":86400}));
    }
    let mut runtime = InMemoryRuntimeKernel::new();
    for capability in ["research.hypothesis.v1", "research.experiment.v1"] {
        runtime
            .register_tool(ToolRegistration {
                tool_name: capability.into(),
                capability: Capability::parse(capability).unwrap(),
                description: "U01 owned worker".into(),
                max_cost_units: 10000,
                rate_limit_per_minute: 600,
                enabled: true,
            })
            .unwrap();
    }
    let session = runtime.open_session(&auth, now, now + Duration::hours(1));
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), b"g3-local-only".to_vec());
    let _engine = engine(&mut manager, "rd-agent", "research.hypothesis.v1").await;
    let worker = Arc::new(Mutex::new(Worker {
        provider: provider.clone(),
        runtime,
        artifacts: InMemoryResearchArtifactRepository::new(),
        snapshots,
        rules: SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now))
            .unwrap(),
        manager,
        session: session.runtime_session_id,
        mapped: BTreeMap::new(),
    }));
    let address: std::net::SocketAddr = std::env::var("QUANTOS_BFF_BIND").unwrap().parse().unwrap();
    assert!(address.ip().is_loopback());
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    let control = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let control_address = control.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(
            control,
            Router::new()
                .route("/execute", post(execute))
                .with_state(worker),
        )
        .await
        .unwrap();
    });
    println!(
        "{}",
        json!({"ready":true,"control":format!("http://{control_address}"),"snapshotId":snapshot.snapshot_id,"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"storage":"OWNED_IN_MEMORY_PORT_SUBSTITUTION","worker":"ACTUAL_R03_RD_AGENT_UDS"})
    );
    axum::serve(
        listener,
        provider
            .router()
            .into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .unwrap();
}
