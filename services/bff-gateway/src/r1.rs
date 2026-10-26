//! Test-only R1 native worker composition and audited result index. No venue or
//! OpenBB provider is registered. Reference Audit is an explicit storage port.
use crate::g3_research_tests::engine;
use chrono::{Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{ContentHash, WorkflowRunId, canonical_json_bytes};
use quantos_engine_manager::EngineManager;
use quantos_runtime::{
    InMemoryRuntimeKernel, WorkflowRunStatus,
    research::{InMemoryResearchArtifactRepository, ResearchArtifactRecord},
    signal_proposal::{
        InMemorySignalProposalRepository, ResearchInputRef, SignalProposalWorkflowCoordinator,
        SignalProposalWorkflowCoordinatorConfig, SignalProposalWorkflowInput,
        TradeProposalEvaluationGate,
    },
};
use quantos_storage::{InMemoryDataSnapshotCatalog, SnapshotQualityRuleset};
use serde_json::{Value, json};

#[allow(clippy::too_many_arguments)]
pub(crate) async fn run(
    runtime: &mut InMemoryRuntimeKernel,
    artifacts: &InMemoryResearchArtifactRepository,
    snapshots: &InMemoryDataSnapshotCatalog,
    rules: &SnapshotQualityRuleset,
    manager: &mut EngineManager,
    session: quantos_core::RuntimeSessionId,
    source: &ResearchArtifactRecord,
    auth: &AuthContext,
    recover: bool,
) -> Value {
    let now = Utc::now();
    let correlation = runtime.run(source.workflow_run_id).unwrap().correlation_id;
    let config = SignalProposalWorkflowCoordinatorConfig {
        worker_name: "r1-native-worker".into(),
        lease_duration: Duration::seconds(30),
        storage_bucket: "owned-memory".into(),
        data_query_capability: "data.query.v1".into(),
        signal_capability: "quant.signal.v1".into(),
        proposal_capability: "decision.proposal.v1".into(),
    };
    let base = SignalProposalWorkflowInput {
        runtime_session_id: session,
        tool_name: "signal.proposal.workflow.v1".into(),
        capability: quantos_policy::Capability::parse("signal.proposal.workflow.v1").unwrap(),
        workflow_kind: "signal_proposal".into(),
        idempotency_key: format!("r1-{}", source.workflow_run_id),
        correlation_id: correlation,
        feature_snapshot_id: source.data_snapshot_id,
        policy_context_ref: "u01-owned-policy".into(),
        data_query_input_schema_version: None,
        data_query_input: None,
        provided_data_query: None,
        signal_input_schema_version: "v1".into(),
        signal_input: json!({"fixture":"trend_long_quality","strategy_release_id":"r1-owned-reference","feature_snapshot_id":source.data_snapshot_id,"tools":["query_snapshot","query_artifact"]}),
        provided_signal: None,
        research_input: Some(ResearchInputRef {
            schema_version: "v1".into(),
            workflow_run_id: source.workflow_run_id,
            artifact_id: source.artifact_manifest.artifact_id,
            content_hash: source.artifact_manifest.content_hash.clone(),
            expires_at: now + Duration::minutes(10),
        }),
        proposal_input_schema_version: "v1".into(),
        proposal_input: json!({"fixture":"committee_bull_breakout","account_id":auth.account_id.unwrap(),"policy_snapshot_id":"u01-owned-policy","portfolio_snapshot_id":source.data_snapshot_id,"tools":["query_signal","query_snapshot","query_artifact"]}),
        max_attempts: 2,
        deadline_at: now + Duration::minutes(5),
        cost_budget_units: 500,
        rate_limit_per_minute: 600,
    };
    let foreign_sessions = [0, 1, 2, 3].map(|variant| {
        let mut a = auth.clone();
        match variant {
            0 => a.tenant_id = quantos_core::TenantId::new(),
            1 => a.workspace_id = quantos_core::WorkspaceId::new(),
            2 => a.actor_id = quantos_core::ActorId::new(),
            _ => {
                a.capabilities
                    .remove(&quantos_policy::Capability::parse(&source.capability).unwrap());
            }
        }
        runtime
            .open_session(&a, now, now + Duration::hours(1))
            .runtime_session_id
    });
    let mut repository = InMemorySignalProposalRepository::new();
    for case in 0..8 {
        let mut forged = source.clone();
        match case {
            0 => forged.output["summary"] = json!("tampered"),
            1 => forged.evidence_refs.clear(),
            2 => forged.evidence_refs[0].artifact_id = "forged".into(),
            3 => forged.input_hash = ContentHash::sha256_bytes(b"forged"),
            4 => forged.artifact_manifest.size_bytes += 1,
            5 => forged.capability = "execution.operate".into(),
            6 => forged.artifact_manifest.media_type = "text/plain".into(),
            _ => forged.artifact_manifest.tenant_id = quantos_core::TenantId::new(),
        };
        let mut bad_repository = InMemoryResearchArtifactRepository::new();
        bad_repository.upsert(forged);
        let mut c = SignalProposalWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            &mut repository,
            manager,
            config.clone(),
        )
        .with_research_repository(&bad_repository);
        assert!(c.schedule_workflow_run(base.clone(), now).is_err());
    }
    for case in 0..14 {
        let mut input = base.clone();
        input.idempotency_key = format!("rejected-{case}");
        let reference = input.research_input.as_mut().unwrap();
        match case {
            0 => reference.schema_version = "v2".into(),
            1 => reference.content_hash = ContentHash::sha256_bytes(b"forged"),
            2 => reference.artifact_id = quantos_core::ArtifactId::new(),
            3 => reference.workflow_run_id = WorkflowRunId::new(),
            4 => reference.expires_at = now,
            5 => input.policy_context_ref = "other".into(),
            6 => input.feature_snapshot_id = quantos_core::SnapshotId::new(),
            7..=10 => input.runtime_session_id = foreign_sessions[case - 7],
            11 => input.signal_input["research_context"] = json!({"forged":true}),
            12 => input.signal_input_schema_version = "v2".into(),
            _ => input.proposal_input_schema_version = "v2".into(),
        };
        let mut c = SignalProposalWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            &mut repository,
            manager,
            config.clone(),
        )
        .with_research_repository(artifacts);
        assert!(
            c.schedule_workflow_run(input, now).is_err(),
            "reference {case}"
        );
    }
    let scheduled = {
        let mut c = SignalProposalWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            &mut repository,
            manager,
            config.clone(),
        )
        .with_research_repository(artifacts);
        let scheduled = c.schedule_workflow_run(base.clone(), now).unwrap();
        assert_eq!(
            c.schedule_workflow_run(base.clone(), now)
                .unwrap()
                .workflow_run_id,
            scheduled.workflow_run_id
        );
        scheduled
    };
    let mut recovery = None;
    let mut recovered_engine = None;
    if recover {
        {
            let mut c = SignalProposalWorkflowCoordinator::new(
                runtime,
                snapshots,
                rules,
                &mut repository,
                manager,
                config.clone(),
            )
            .with_research_repository(artifacts);
            assert!(
                c.execute_next(now).await.is_err(),
                "missing proposal route must fail"
            );
        }
        let checkpoint = runtime
            .load_checkpoint(scheduled.workflow_run_id)
            .unwrap()
            .clone();
        assert_eq!(checkpoint.checkpoint_key, "signal_proposal.signal_ready");
        assert!(checkpoint.payload.get("signal_input").is_some());
        assert_eq!(repository.physical_proposal_count(), 0);
        *runtime = runtime.clone();
        repository = repository.clone();
        recovered_engine = Some(engine(manager, "trading-agents", "decision.proposal.v1").await);
        recovery = Some(
            json!({"failure":"PROPOSAL_ROUTE_NOT_REGISTERED","checkpoint":checkpoint,"mode":"CLONED_IN_PROCESS_RUNTIME_AND_REPOSITORY_NOT_DURABLE_RESTART"}),
        );
    }
    let observed = runtime
        .run(scheduled.workflow_run_id)
        .unwrap()
        .next_attempt_at
        .max(now);
    let result = {
        let mut c = SignalProposalWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            &mut repository,
            manager,
            config.clone(),
        )
        .with_research_repository(artifacts);
        c.execute_next(observed).await.unwrap().unwrap()
    };
    assert_eq!(result.run.status, WorkflowRunStatus::Succeeded);
    assert!(!result.proposal.executable);
    assert!(result.data_query.is_none());
    assert!(TradeProposalEvaluationGate::ensure_evaluable(&result.proposal, observed).is_ok());
    assert!(result.signal.valid_until > observed);
    let lineage = &result.signal.output["diagnostics"]["value"]["research_context"];
    assert_eq!(
        lineage["source"]["content_hash"],
        source.artifact_manifest.content_hash.as_str()
    );
    assert_eq!(
        result.proposal.output["signal"]["diagnostics"]["value"]["research_context"],
        *lineage
    );
    assert!(
        TradeProposalEvaluationGate::ensure_evaluable(&result.proposal, result.proposal.expires_at)
            .is_err()
    );
    let checkpoint = runtime
        .load_checkpoint(scheduled.workflow_run_id)
        .unwrap()
        .clone();
    assert_eq!(checkpoint.checkpoint_key, "signal_proposal.completed");
    {
        let mut c = SignalProposalWorkflowCoordinator::new(
            runtime,
            snapshots,
            rules,
            &mut repository,
            manager,
            config.clone(),
        )
        .with_research_repository(artifacts);
        assert_eq!(
            c.schedule_workflow_run(base.clone(), observed)
                .unwrap()
                .workflow_run_id,
            scheduled.workflow_run_id
        );
        assert!(c.execute_next(observed).await.unwrap().is_none());
    }
    assert_eq!(
        runtime.load_checkpoint(scheduled.workflow_run_id),
        Some(&checkpoint)
    );
    assert_eq!(repository.physical_signal_count(), 1);
    assert_eq!(repository.physical_proposal_count(), 1);
    for (manifest, output) in [
        (&result.signal.artifact_manifest, &result.signal.output),
        (&result.proposal.artifact_manifest, &result.proposal.output),
    ] {
        let bytes = canonical_json_bytes(output).unwrap();
        assert_eq!(manifest.content_hash, ContentHash::sha256_bytes(&bytes));
        assert_eq!(manifest.size_bytes, bytes.len() as u64);
    }
    let audits = runtime.audit_log().to_vec();
    assert!(
        audits
            .iter()
            .all(|e| !e.action.contains("order") && !e.action.contains("execution"))
    );
    let value = json!({"run":result.run,"signal":result.signal,"proposal":result.proposal,"rejectedReferences":22,"checkpointAfterReplay":checkpoint,"sameKeyReplayPreserved":true,"repository":{"signals":repository.physical_signal_count(),"proposals":repository.physical_proposal_count()},"recovery":recovery,"runtimeAudit":audits,"openbb":"NOT_REGISTERED","orderCapability":"NOT_REGISTERED"});
    drop(recovered_engine);
    value
}

pub(crate) fn audit(
    provider: &mut crate::ProviderData,
    correlation: &str,
    chain: &Value,
    snapshot: Value,
    source: &ResearchArtifactRecord,
) -> Value {
    let mut cause = provider
        .audits
        .iter()
        .rev()
        .find(|e| e["correlationId"] == correlation)
        .unwrap()["eventId"]
        .clone();
    let mut entries = vec![
        (
            "research.artifact.registered",
            json!(source.artifact_manifest.artifact_id),
            json!(source),
        ),
        (
            "snapshot.consumed",
            snapshot["snapshotId"].clone(),
            snapshot,
        ),
    ];
    for (name, kind) in [
        ("signal", "signal.generated"),
        ("proposal", "proposal.generated"),
    ] {
        let record = &chain[name];
        entries.push((
            kind,
            record["artifact_manifest"]["artifact_id"].clone(),
            record.clone(),
        ));
        for m in record["auxiliary_artifact_manifests"].as_array().unwrap() {
            entries.push((
                "artifact.manifest.retained",
                m["artifact_id"].clone(),
                m.clone(),
            ));
        }
    }
    let mut commitments = Vec::new();
    for (kind, id, commitment) in entries {
        let bytes = canonical_json_bytes(&commitment).unwrap();
        commitments.push(
            json!({"kind":kind,"objectRef":id,"canonical":String::from_utf8(bytes).unwrap()}),
        );
        let event = crate::record_audit_action(
            provider,
            kind,
            correlation,
            id.as_str().unwrap(),
            json!({"outcome":"succeeded","scopeHash":crate::audit_core::payload_hash(&commitment)}),
        );
        let row = provider.audits.last_mut().unwrap();
        row["causationId"] = cause;
        row["route"] = json!(format!("/audit/{correlation}"));
        cause = json!(event);
    }
    json!(commitments)
}
