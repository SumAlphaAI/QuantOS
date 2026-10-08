use super::*;
use quantos_core::{ContentHash, SchemaVersion};
use quantos_proto::quantos::common::v1::{ActorRef, CommandMetadata};
use quantos_storage::{
    ArtifactManifest, SnapshotUsage,
    pg::{PgStorageStore, SnapshotWriteContext},
    provenance::{SnapshotSourcePolicy, SourceApproval},
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig},
    wire::snapshot_to_wire,
};
use serde_json::{Value, json};

#[test]
fn r02_retained_market_persistent_research_chain() -> Result<()> {
    if std::env::var("QUANTOS_RUN_R02_CHAIN_TESTS").as_deref() != Ok("1") {
        eprintln!("R02_CHAIN_NOT_RUN: explicit configured Supabase target required");
        return Ok(());
    }
    let dir = PathBuf::from(std::env::var("QUANTOS_R02_CHAIN_DIR")?);
    let fixture: Value = serde_json::from_slice(&std::fs::read(dir.join("fixture.json"))?)?;
    let config: Value = serde_json::from_slice(&std::fs::read(dir.join("source-policy.json"))?)?;
    let approvals: Vec<SourceApproval> = serde_json::from_value(config["approvals"].clone())?;
    let policy = SnapshotSourcePolicy::new(approvals.clone())?;
    let ctx: SnapshotWriteContext = serde_json::from_value(fixture["context"].clone())?;
    let now = Utc::now();
    let rows = fixture["rows"].as_array().expect("retained rows");
    let times: Vec<chrono::DateTime<Utc>> = rows
        .iter()
        .map(|r| serde_json::from_value(r["payload"]["event_time"].clone()))
        .collect::<std::result::Result<_, _>>()?;
    let mut store = PgStorageStore::connect(&std::env::var("DATABASE_URL")?)?;
    if fixture["ownsRules"] == true {
        for r in default_quality_rules(ctx.tenant_id, now) {
            store.upsert_snapshot_quality_rule(&r, &ctx)?;
        }
    }
    let version = SchemaVersion::parse("v1")?;
    let schema = match store.get_schema(ctx.tenant_id, "events", "DataSnapshot", &version)? {
        Some(s) => s,
        None => store.register_schema(
            ctx.tenant_id,
            "events",
            "DataSnapshot",
            &version,
            &json!({"type":"object"}),
            now,
        )?,
    };
    let payload = serde_json::to_vec(&fixture)?;
    let manifest = ArtifactManifest::new(
        ctx.tenant_id,
        "application/json",
        ContentHash::sha256_bytes(&payload),
        std::env::var("SUPABASE_STORAGE_BUCKET")?,
        payload.len() as u64,
        now,
    );
    std::fs::write(
        dir.join("owned-artifact.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let adapter = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: std::env::var("SUPABASE_URL")?,
        bucket_name: std::env::var("SUPABASE_STORAGE_BUCKET")?,
        api_key: std::env::var("SUPABASE_SERVICE_ROLE_KEY")?,
        authorization_token: std::env::var("SUPABASE_STORAGE_AUTH_TOKEN").ok(),
        upsert: false,
    })?;
    let artifact = adapter.upload_and_register(&mut store, &manifest, payload.into(), &ctx)?;
    assert_eq!(
        adapter.get_artifact(&artifact)?.as_ref(),
        serde_json::to_vec(&fixture)?
    );
    let a = &approvals[0];
    let snapshot = DataSnapshotRecord::new(
        ctx.tenant_id,
        DataSnapshotInput {
            schema_name: "DataSnapshot".into(),
            schema_version: version,
            schema_entry_id: Some(schema.schema_entry_id),
            window: SnapshotWindow {
                start_at: *times.iter().min().unwrap(),
                end_at: *times.iter().max().unwrap(),
            },
            sources: a
                .symbols
                .iter()
                .map(|s| SnapshotSourceRef {
                    source_id: format!("market:{}:{s}", a.provider),
                    provider: a.provider.clone(),
                    dataset: a.dataset.clone(),
                    license_label: a.license_label.clone(),
                })
                .collect(),
            quality: SnapshotQuality::Degraded,
            quality_findings: vec![quantos_storage::SnapshotQualityFinding {
                code: "retained-source-age".into(),
                detail: "Retained historical window: current capture does not imply fresh source"
                    .into(),
            }],
            license_label: a.license_label.clone(),
            captured_at: now,
            max_age_secs: 86400,
            symbols: a.symbols.clone(),
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: artifact.artifact_id,
                media_type: artifact.media_type.clone(),
                content_hash: artifact.content_hash.clone(),
                storage_bucket: artifact.storage_bucket.clone(),
                object_key: artifact.object_key.clone(),
            }],
            lineage: a
                .symbols
                .iter()
                .map(|s| SnapshotLineageEntry {
                    lineage_kind: "market_event_range".into(),
                    reference: format!("market:{}:{s}", a.provider),
                    details: json!({"from_sequence":1,"to_sequence":16}),
                })
                .collect(),
        },
        now,
    )?;
    let snapshot = store.upsert_data_snapshot(&snapshot, &ctx)?;
    std::fs::write(
        dir.join("snapshot.json"),
        serde_json::to_vec_pretty(&snapshot)?,
    )?;
    assert_eq!(
        store
            .load_authorized_snapshot(
                ctx.tenant_id,
                snapshot.snapshot_id,
                SnapshotUsage::Research,
                Utc::now(),
                &policy
            )?
            .0
            .content_hash,
        snapshot.content_hash
    );
    for usage in [SnapshotUsage::Strategy, SnapshotUsage::Trading] {
        assert!(
            store
                .load_authorized_snapshot(
                    ctx.tenant_id,
                    snapshot.snapshot_id,
                    usage,
                    Utc::now(),
                    &policy
                )
                .is_err()
        );
    }
    assert!(
        store
            .load_authorized_snapshot(
                TenantId::new(),
                snapshot.snapshot_id,
                SnapshotUsage::Research,
                Utc::now(),
                &policy
            )
            .is_err()
    );
    for variant in 0..4 {
        let mut wrong = approvals.clone();
        match variant {
            0 => wrong[0].enabled = false,
            1 => wrong[0].expires_at = now - ChronoDuration::seconds(1),
            2 => wrong[0].approval_version = "unapproved".into(),
            _ => wrong[0].allowed_usages = vec![SnapshotUsage::Trading],
        };
        let denied = SnapshotSourcePolicy::new(wrong)?;
        assert!(
            store
                .load_authorized_snapshot(
                    ctx.tenant_id,
                    snapshot.snapshot_id,
                    SnapshotUsage::Research,
                    Utc::now(),
                    &denied
                )
                .is_err()
        );
    }
    let meta = CommandMetadata {
        request_id: Uuid::new_v4().to_string(),
        tenant_id: ctx.tenant_id.to_string(),
        workspace_id: Uuid::new_v4().to_string(),
        actor: Some(ActorRef {
            actor_id: ctx.actor_id.to_string(),
            actor_kind: 2,
            display_name: "R02 chain service".into(),
            capabilities: vec!["snapshot.read".into()],
        }),
        correlation_id: ctx.correlation_id.to_string(),
        causation_id: ctx.causation_id.to_string(),
        mode: 1,
        environment: 2,
        issued_at: Some(quantos_proto::generated::google::protobuf::Timestamp {
            seconds: now.timestamp(),
            nanos: now.timestamp_subsec_nanos() as i32,
        }),
    };
    assert!(
        store
            .authorize_snapshot_reader(ctx.tenant_id, ActorId::new())
            .is_err()
    );
    assert!(
        store
            .authorize_snapshot_reader(TenantId::new(), ctx.actor_id)
            .is_err()
    );
    let wire = snapshot_to_wire(&snapshot, meta)?;
    assert_eq!(
        store
            .resolve_snapshot_reference(&wire, &ctx, SnapshotUsage::Research, Utc::now(), &policy)?
            .snapshot_id,
        snapshot.snapshot_id
    );
    for variant in 0..4 {
        let mut bad = wire.clone();
        match variant {
            0 => bad.content_hash = ContentHash::sha256_bytes(b"forged").to_string(),
            1 => bad.quality = 2,
            2 => bad.metadata.as_mut().unwrap().tenant_id = TenantId::new().to_string(),
            _ => {
                bad.metadata
                    .as_mut()
                    .unwrap()
                    .actor
                    .as_mut()
                    .unwrap()
                    .actor_id = ActorId::new().to_string()
            }
        };
        assert!(
            store
                .resolve_snapshot_reference(
                    &bad,
                    &ctx,
                    SnapshotUsage::Research,
                    Utc::now(),
                    &policy
                )
                .is_err()
        );
    }
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    let result=rt.block_on(async {
        let socket=short_socket_path();let child=spawn_python_rd_agent(&socket).await?;
        let result=async {
            let mut auth=auth_context();auth.tenant_id=ctx.tenant_id;auth.actor_id=ctx.actor_id;
            let mut runtime=InMemoryRuntimeKernel::new();
            for cap in ["research.hypothesis.v1","research.experiment.v1"]{runtime.register_tool(tool_registration(cap))?;}
            let session=runtime.open_session(&auth,now,now+ChronoDuration::hours(1));
            let mut repo=InMemoryResearchArtifactRepository::new();let mut manager=EngineManager::with_approval_key(BackoffPolicy::default(),TEST_APPROVAL_KEY.to_vec());
            register_reviewed_engine(&mut manager,manifest_for_socket(socket.clone()))?;
            let mut output=Vec::new();
            for (cap,fixture_name) in [("research.hypothesis.v1","hypothesis_regime_shift"),("research.experiment.v1","experiment_factor_stability")] {
                let mut c=ResearchWorkflowCoordinator::new_persisted(&mut runtime,&mut store,&policy,&mut repo,&mut manager,ResearchWorkflowCoordinatorConfig{worker_name:"r02-persisted".into(),lease_duration:ChronoDuration::seconds(30),storage_bucket:artifact.storage_bucket.clone()});
                c.schedule_research_run(ResearchWorkflowInput{runtime_session_id:session.runtime_session_id,tool_name:cap.into(),capability:Capability::parse(cap)?,workflow_kind:"research".into(),idempotency_key:format!("{}-{cap}",fixture["run"]),correlation_id:CorrelationId::new(),data_snapshot_id:snapshot.snapshot_id,policy_context_ref:a.approval_reference.clone(),input_schema_version:"v1".into(),input:json!({"fixture":fixture_name,"prompt":"Evaluate retained historical market facts","retained_market":rows}),max_attempts:1,deadline_at:now+ChronoDuration::minutes(10),cost_budget_units:250,rate_limit_per_minute:60},Utc::now())?;
                let result=c.execute_next(Utc::now()).await?.expect("actual persisted run");assert_eq!(result.run.status,WorkflowRunStatus::Succeeded);assert!(!result.artifact.evidence_refs.is_empty());output.push(json!({"run":result.run.workflow_run_id,"input_hash":result.run.input_hash,"artifact":result.artifact.engine_artifact_id}));
            }
            use quantos_runtime::signal_proposal::{InMemorySignalProposalRepository, SignalProposalWorkflowCoordinator, SignalProposalWorkflowCoordinatorConfig, SignalProposalWorkflowInput, SignalProposalWorkflowError};
            let cap="signal.proposal.workflow.v1";auth.capabilities.insert(Capability::parse(cap)?);runtime.register_tool(tool_registration(cap))?;
            let signal_session=runtime.open_session(&auth,Utc::now(),now+ChronoDuration::hours(1));let mut signal_repo=InMemorySignalProposalRepository::new();
            let mut c=SignalProposalWorkflowCoordinator::new_persisted(&mut runtime,&mut store,&policy,&mut signal_repo,&mut manager,SignalProposalWorkflowCoordinatorConfig{worker_name:"r02-persisted-denial".into(),lease_duration:ChronoDuration::seconds(30),storage_bucket:artifact.storage_bucket.clone(),data_query_capability:"data.query.v1".into(),signal_capability:"quant.signal.v1".into(),proposal_capability:"trade.proposal.v1".into()});
            c.schedule_workflow_run(SignalProposalWorkflowInput{runtime_session_id:signal_session.runtime_session_id,tool_name:cap.into(),capability:Capability::parse(cap)?,workflow_kind:"signal_proposal".into(),idempotency_key:format!("{}-denied-signal",fixture["run"]),correlation_id:CorrelationId::new(),feature_snapshot_id:snapshot.snapshot_id,policy_context_ref:a.approval_reference.clone(),data_query_input_schema_version:None,data_query_input:None,provided_data_query:None,signal_input_schema_version:"v1".into(),signal_input:json!({}),provided_signal:None,proposal_input_schema_version:"v1".into(),proposal_input:json!({}),max_attempts:1,deadline_at:now+ChronoDuration::minutes(10),cost_budget_units:250,rate_limit_per_minute:60},Utc::now())?;
            assert!(matches!(c.execute_next(Utc::now()).await,Err(SignalProposalWorkflowError::PersistentSnapshot(_))));
            Ok::<_,anyhow::Error>(output)
        }.await;
        shutdown_child(child,&socket).await;result
    })?;
    // Current rules are cold-loaded. Modify only a rule first created by this run.
    let cold_rules = if fixture["ownsRules"] == true {
        let original = store
            .list_snapshot_quality_rules(ctx.tenant_id)?
            .into_iter()
            .find(|r| r.usage == SnapshotUsage::Research)
            .unwrap();
        let mut strict = original.clone();
        strict.allow_degraded = false;
        strict.updated_at = Utc::now();
        store.upsert_snapshot_quality_rule(&strict, &ctx)?;
        let rejected = store
            .load_authorized_snapshot(
                ctx.tenant_id,
                snapshot.snapshot_id,
                SnapshotUsage::Research,
                Utc::now(),
                &policy,
            )
            .is_err();
        let mut restored = original;
        restored.updated_at = Utc::now();
        store.upsert_snapshot_quality_rule(&restored, &ctx)?;
        assert!(rejected);
        "PASS_OWNED_RULE_CHANGE"
    } else {
        "NOT_MUTATED_PREEXISTING_RULE"
    };
    std::fs::write(
        dir.join("chain-result.json"),
        serde_json::to_vec_pretty(
            &json!({"result":"PASS","snapshot_id":snapshot.snapshot_id,"snapshot_hash":snapshot.content_hash,"quality":"degraded","sourceWindow":snapshot.window,"sourceAgeSecs":(Utc::now()-snapshot.window.end_at).num_seconds(),"actualMarketEvents":32,"research":result,"strategyTrading":"REJECTED","persistentSignalConsumer":"REJECTED_BEFORE_ENGINE","readerAuthorizationNegatives":2,"crossTenant":"REJECTED","sourceApprovalNegatives":4,"wireTamperingNegatives":4,"currentRules":cold_rules,"engineStopped":true,"workflowPersistence":"IN_MEMORY_R03_SCOPE","releasePerformance":"NOT_RUN"}),
        )?,
    )?;
    Ok(())
}
