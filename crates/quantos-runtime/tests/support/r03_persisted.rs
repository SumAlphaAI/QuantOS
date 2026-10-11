use super::*;
use quantos_core::{ContentHash, SchemaVersion, SnapshotId};
use quantos_runtime::{
    pg::PgRuntimeStore,
    research_pg::{PgResearchArtifactRepository, PgResearchWorkflowCoordinator},
};
use quantos_storage::{
    ArtifactManifest, SnapshotUsage,
    pg::{PgStorageStore, SnapshotWriteContext},
    provenance::{SnapshotSourcePolicy, SourceApproval},
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig},
};
use serde_json::{Value, json};

fn target_dir() -> PathBuf {
    PathBuf::from(std::env::var("QUANTOS_R03_TARGET_DIR").expect("explicit target directory"))
}
fn fixture() -> Value {
    serde_json::from_slice(&std::fs::read(target_dir().join("fixture.json")).unwrap()).unwrap()
}
fn config(name: &str) -> ResearchWorkflowCoordinatorConfig {
    ResearchWorkflowCoordinatorConfig {
        worker_name: name.into(),
        lease_duration: ChronoDuration::seconds(120),
        storage_bucket: std::env::var("SUPABASE_STORAGE_BUCKET").unwrap(),
    }
}
fn storage(fail: bool) -> Result<SupabaseStorageAdapter> {
    Ok(SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: if fail {
            "http://127.0.0.1:9".into()
        } else {
            std::env::var("SUPABASE_URL")?
        },
        bucket_name: std::env::var("SUPABASE_STORAGE_BUCKET")?,
        api_key: std::env::var("SUPABASE_SERVICE_ROLE_KEY")?,
        authorization_token: std::env::var("SUPABASE_STORAGE_AUTH_TOKEN")
            .ok()
            .filter(|s| !s.is_empty()),
        upsert: false,
    })?)
}
fn policy(f: &Value) -> Result<SnapshotSourcePolicy> {
    Ok(SnapshotSourcePolicy::new(vec![SourceApproval {
        provider: f["provider"].as_str().unwrap().into(),
        dataset: "synthetic.v1".into(),
        license_label: "owned-synthetic-fixture-only".into(),
        approval_reference: "scripts/r03-target-check.cjs".into(),
        approval_version: "r03-fixture-v1".into(),
        approval_document_hash: ContentHash::sha256_bytes(b"owned-synthetic-fixture"),
        scope_hash: ContentHash::sha256_bytes(b"R03-test-only"),
        tenant_id: serde_json::from_value(f["tenant"].clone())?,
        symbols: vec!["FIXTURE".into()],
        allowed_usages: vec![SnapshotUsage::Research],
        expires_at: Utc::now() + ChronoDuration::hours(1),
        enabled: true,
    }])?)
}
fn input(f: &Value, snapshot: SnapshotId, name: &str) -> ResearchWorkflowInput {
    ResearchWorkflowInput {
        runtime_session_id: serde_json::from_value(f["session"].clone()).unwrap(),
        tool_name: "research.hypothesis.v1".into(),
        capability: Capability::parse("research.hypothesis.v1").unwrap(),
        workflow_kind: "research".into(),
        idempotency_key: name.into(),
        correlation_id: CorrelationId::new(),
        data_snapshot_id: snapshot,
        policy_context_ref: "owned-synthetic-policy".into(),
        input_schema_version: "v1".into(),
        input: json!({"fixture":"hypothesis_regime_shift","prompt":"研究 🧪"}),
        max_attempts: 4,
        deadline_at: Utc::now() + ChronoDuration::minutes(15),
        cost_budget_units: 1,
        rate_limit_per_minute: 60,
    }
}
fn manager(socket: PathBuf) -> Result<EngineManager> {
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    register_reviewed_engine(&mut manager, manifest_for_socket(socket))?;
    Ok(manager)
}
fn executor() -> Result<tokio::runtime::Runtime> {
    Ok(tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()?)
}

fn prepare_snapshot(store: &mut PgStorageStore, f: &Value) -> Result<SnapshotId> {
    let context: SnapshotWriteContext = serde_json::from_value(f["context"].clone())?;
    let tenant = context.tenant_id;
    let at: chrono::DateTime<Utc> = serde_json::from_value(f["at"].clone())?;
    for rule in default_quality_rules(tenant, Utc::now()) {
        store.upsert_snapshot_quality_rule(&rule, &context)?;
    }
    let schema = store.register_schema(
        tenant,
        "events",
        "DataSnapshot",
        &SchemaVersion::parse("v1")?,
        &json!({"type":"object"}),
        Utc::now(),
    )?;
    let bytes = serde_json::to_vec(&json!({"fixture":"R03-owned-synthetic","tenant":tenant}))?;
    let manifest = ArtifactManifest::new(
        tenant,
        "application/json",
        ContentHash::sha256_bytes(&bytes),
        std::env::var("SUPABASE_STORAGE_BUCKET")?,
        bytes.len() as u64,
        Utc::now(),
    );
    let artifact = storage(false)?.upload_and_register(store, &manifest, bytes.into(), &context)?;
    let snapshot = DataSnapshotRecord::new(
        tenant,
        DataSnapshotInput {
            schema_name: "DataSnapshot".into(),
            schema_version: SchemaVersion::parse("v1")?,
            schema_entry_id: Some(schema.schema_entry_id),
            window: SnapshotWindow {
                start_at: at,
                end_at: at,
            },
            sources: vec![SnapshotSourceRef {
                source_id: format!("market:{}:FIXTURE", f["provider"].as_str().unwrap()),
                provider: f["provider"].as_str().unwrap().into(),
                dataset: "synthetic.v1".into(),
                license_label: "owned-synthetic-fixture-only".into(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: "owned-synthetic-fixture-only".into(),
            captured_at: at,
            max_age_secs: 3600,
            symbols: vec!["FIXTURE".into()],
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: artifact.artifact_id,
                media_type: artifact.media_type,
                content_hash: artifact.content_hash,
                storage_bucket: artifact.storage_bucket,
                object_key: artifact.object_key,
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".into(),
                reference: format!("market:{}", f["aggregate"].as_str().unwrap()),
                details: json!({"from_sequence":1,"to_sequence":1}),
            }],
        },
        Utc::now(),
    )?;
    Ok(store.upsert_data_snapshot(&snapshot, &context)?.snapshot_id)
}

fn child_worker(test: &str, log: &str) -> Result<()> {
    let output = std::process::Command::new(std::env::current_exe()?)
        .args([test, "--exact", "--nocapture"])
        .env("QUANTOS_R03_WORKER_CHILD", "1")
        .output()?;
    std::fs::write(
        target_dir().join(log),
        [output.stdout, output.stderr].concat(),
    )?;
    anyhow::ensure!(output.status.success(), "worker failed; see {log}");
    Ok(())
}

#[test]
fn r03_worker_prepares_before_storage_failure() -> Result<()> {
    if std::env::var("QUANTOS_R03_WORKER_CHILD").as_deref() != Ok("1") {
        return Ok(());
    }
    let f = fixture();
    let tenant: TenantId = serde_json::from_value(f["tenant"].clone())?;
    let url = std::env::var("DATABASE_URL")?;
    let mut runtime = PgRuntimeStore::connect(&url)?;
    let mut snapshots = PgStorageStore::connect(&url)?;
    let policy = policy(&f)?;
    let storage = storage(true)?;
    let rt = executor()?;
    let socket = short_socket_path();
    let child = rt.block_on(spawn_python_rd_agent(&socket))?;
    let mut manager = manager(socket.clone())?;
    let result = rt.block_on(async {
        PgResearchWorkflowCoordinator::new(
            &mut runtime,
            &mut snapshots,
            &policy,
            &storage,
            &mut manager,
            config("crashing-worker"),
        )
        .execute_next(tenant)
        .await
    });
    rt.block_on(shutdown_child(child, &socket));
    anyhow::ensure!(result.is_err(), "controlled upload failure expected");
    let run: WorkflowRunId =
        serde_json::from_slice(&std::fs::read(target_dir().join("recovery-run.json"))?)?;
    let cp = runtime.load_checkpoint(run)?.unwrap();
    assert_eq!(cp.checkpoint_key, "research.prepared");
    assert_eq!(cp.step_index, 2);
    assert_eq!(runtime.workflow_artifact_count(run)?, 0);
    Ok(())
}

#[test]
fn r03_worker_recovers_without_engine() -> Result<()> {
    if std::env::var("QUANTOS_R03_WORKER_CHILD").as_deref() != Ok("1") {
        return Ok(());
    }
    let f = fixture();
    let tenant: TenantId = serde_json::from_value(f["tenant"].clone())?;
    let url = std::env::var("DATABASE_URL")?;
    let mut runtime = PgRuntimeStore::connect(&url)?;
    let mut snapshots = PgStorageStore::connect(&url)?;
    let policy = policy(&f)?;
    let storage = storage(false)?;
    // This fresh process deliberately has no Engine route; recovery must use durable bytes.
    let mut manager = EngineManager::new(BackoffPolicy::default());
    let rt = executor()?;
    let result = rt
        .block_on(async {
            PgResearchWorkflowCoordinator::new(
                &mut runtime,
                &mut snapshots,
                &policy,
                &storage,
                &mut manager,
                config("restarted-worker"),
            )
            .execute_next(tenant)
            .await
        })?
        .unwrap();
    assert_eq!(result.run.status, WorkflowRunStatus::Succeeded);
    assert_eq!(
        runtime.workflow_artifact_count(result.run.workflow_run_id)?,
        1
    );
    std::fs::write(
        target_dir().join("restarted-artifact.json"),
        serde_json::to_vec_pretty(&result.artifact)?,
    )?;
    Ok(())
}

#[test]
fn r03_configured_supabase_lifecycle() -> Result<()> {
    if std::env::var("QUANTOS_RUN_R03_TARGET_TESTS").as_deref() != Ok("1") {
        eprintln!("R03_TARGET_NOT_RUN");
        return Ok(());
    }
    let f = fixture();
    let tenant: TenantId = serde_json::from_value(f["tenant"].clone())?;
    let actor: ActorId = serde_json::from_value(f["actor"].clone())?;
    let url = std::env::var("DATABASE_URL")?;
    let mut runtime = PgRuntimeStore::connect(&url)?;
    let mut snapshots = PgStorageStore::connect(&url)?;
    let policy = policy(&f)?;
    let snapshot = prepare_snapshot(&mut snapshots, &f)?;
    let storage = storage(false)?;
    runtime.register_tool(
        tenant,
        &tool_registration("research.hypothesis.v1"),
        Utc::now(),
    )?;
    let rt = executor()?;
    let socket = short_socket_path();
    let child = rt.block_on(spawn_python_rd_agent(&socket))?;
    let mut manager = manager(socket.clone())?;
    let mut hashes = BTreeSet::new();
    let mut records = Vec::new();
    let result = (|| -> Result<()> {
        for i in 0..10 {
            let request = input(&f, snapshot, &format!("ten-runs-{i}"));
            let mut coordinator = PgResearchWorkflowCoordinator::new(
                &mut runtime,
                &mut snapshots,
                &policy,
                &storage,
                &mut manager,
                config("ten-run-worker"),
            );
            let scheduled = coordinator.schedule_research_run(request.clone(), Utc::now())?;
            let executed = rt
                .block_on(async { coordinator.execute_next(tenant).await })?
                .unwrap();
            hashes.insert(executed.run.input_hash.clone());
            assert_eq!(scheduled.workflow_run_id, executed.run.workflow_run_id);
            assert_eq!(
                coordinator
                    .schedule_research_run(request.clone(), Utc::now())?
                    .workflow_run_id,
                scheduled.workflow_run_id
            );
            let mut conflict = request;
            conflict.policy_context_ref = "conflicting".into();
            assert!(
                coordinator
                    .schedule_research_run(conflict, Utc::now())
                    .is_err()
            );
            let replay = PgResearchArtifactRepository {
                runtime: &mut runtime,
                storage: &storage,
            }
            .replay(tenant, actor, scheduled.workflow_run_id)?;
            assert_eq!(replay, executed.artifact);
            assert_eq!(
                runtime.workflow_artifact_count(scheduled.workflow_run_id)?,
                1
            );
            assert!(!replay.evidence_refs.is_empty());
            assert_eq!(replay.stream_events.len(), 3);
            records.push(replay);
        }
        assert_eq!(hashes.len(), 1);
        let id = records[0].workflow_run_id;
        for (t, a) in [(TenantId::new(), actor), (tenant, ActorId::new())] {
            assert!(
                PgResearchArtifactRepository {
                    runtime: &mut runtime,
                    storage: &storage
                }
                .replay(t, a, id)
                .is_err()
            );
        }
        let request = input(&f, snapshot, "recover-after-crash");
        let run = PgResearchWorkflowCoordinator::new(
            &mut runtime,
            &mut snapshots,
            &policy,
            &storage,
            &mut manager,
            config("schedule-only"),
        )
        .schedule_research_run(request, Utc::now())?;
        std::fs::write(
            target_dir().join("recovery-run.json"),
            serde_json::to_vec(&run.workflow_run_id)?,
        )?;
        child_worker(
            "r03_persisted::r03_worker_prepares_before_storage_failure",
            "prepare-worker.log",
        )?;
        std::thread::sleep(Duration::from_millis(1100));
        let old = runtime
            .claim_runs_of_kind(
                tenant,
                "worker-dies-after-binding",
                1,
                Utc::now(),
                ChronoDuration::seconds(15),
                Some("research"),
            )?
            .pop()
            .unwrap();
        let cp = runtime.load_checkpoint(run.workflow_run_id)?.unwrap();
        let prepared: quantos_runtime::research::ResearchArtifactRecord =
            serde_json::from_value(cp.payload["artifact"].clone())?;
        storage.put_artifact(
            &prepared.artifact_manifest,
            quantos_core::canonical_json_bytes(&prepared.output)?.into(),
        )?;
        // The process disappears after upload+binding, before completion. The
        // next process must reconcile the duplicate upload and binding.
        runtime.record_artifact(&old, &prepared.artifact_manifest, Utc::now())?;
        std::thread::sleep(
            (old.lease_expires_at - Utc::now())
                .to_std()
                .unwrap_or_default()
                + Duration::from_millis(100),
        );
        child_worker(
            "r03_persisted::r03_worker_recovers_without_engine",
            "recover-worker.log",
        )?;
        assert_eq!(runtime.workflow_artifact_count(run.workflow_run_id)?, 1);
        assert!(runtime.complete_run(&old, Utc::now()).is_err());
        let replay = PgResearchArtifactRepository {
            runtime: &mut runtime,
            storage: &storage,
        }
        .replay(tenant, actor, run.workflow_run_id)?;
        assert_eq!(
            replay.artifact_manifest.artifact_id,
            prepared.artifact_manifest.artifact_id
        );
        assert_eq!(replay.output, prepared.output);
        // Queue cancellation and running Engine cancellation are separate assertions.
        let queued = PgResearchWorkflowCoordinator::new(
            &mut runtime,
            &mut snapshots,
            &policy,
            &storage,
            &mut manager,
            config("schedule-cancel"),
        )
        .schedule_research_run(input(&f, snapshot, "queued-cancel"), Utc::now())?;
        for (t, a) in [(TenantId::new(), actor), (tenant, ActorId::new())] {
            assert!(
                runtime
                    .request_research_cancel(t, a, queued.workflow_run_id, Utc::now())
                    .is_err()
            );
        }
        let started = std::time::Instant::now();
        runtime.request_research_cancel(tenant, actor, queued.workflow_run_id, Utc::now())?;
        let queued_ms = started.elapsed().as_millis();
        assert_eq!(
            runtime.load_run(queued.workflow_run_id)?.unwrap().status,
            WorkflowRunStatus::Cancelled
        );
        eprintln!("R03_QUEUED_CANCEL_MS={queued_ms}");
        assert!(queued_ms <= 2000);
        let mut request = input(&f, snapshot, "running-cancel");
        request.input["sleep_ms"] = json!(1500);
        let running = PgResearchWorkflowCoordinator::new(
            &mut runtime,
            &mut snapshots,
            &policy,
            &storage,
            &mut manager,
            config("schedule-running"),
        )
        .schedule_research_run(request, Utc::now())?;
        let control_url = url.clone();
        let id = running.workflow_run_id;
        let control = std::thread::spawn(move || -> Result<std::time::Instant> {
            let mut store = PgRuntimeStore::connect(&control_url)?;
            for _ in 0..100 {
                if store
                    .load_checkpoint(id)?
                    .is_some_and(|cp| cp.checkpoint_key == "research.dispatch")
                {
                    std::thread::sleep(Duration::from_millis(750));
                    let started = std::time::Instant::now();
                    store.request_research_cancel(tenant, actor, id, Utc::now())?;
                    return Ok(started);
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            anyhow::bail!("running cancellation never dispatched")
        });
        let cancelled = rt.block_on(async {
            PgResearchWorkflowCoordinator::new(
                &mut runtime,
                &mut snapshots,
                &policy,
                &storage,
                &mut manager,
                config("running-worker"),
            )
            .execute_next(tenant)
            .await
        });
        let finished = std::time::Instant::now();
        let started = control.join().expect("control thread")?;
        assert!(matches!(
            cancelled,
            Err(quantos_runtime::research::ResearchWorkflowError::Cancelled)
        ));
        let run = runtime.load_run(id)?.unwrap();
        assert_eq!(run.status, WorkflowRunStatus::Cancelled);
        let running_ms = finished.duration_since(started).as_millis();
        eprintln!("R03_RUNNING_CANCEL_MS={running_ms}");
        assert!(running_ms <= 2000);
        assert_eq!(runtime.workflow_artifact_count(id)?, 0);
        std::fs::write(
            target_dir().join("lifecycle-result.json"),
            serde_json::to_vec_pretty(
                &json!({"status":"PASS","fixture":true,"runs":records,"uniqueInputHashes":hashes.len(),"queuedCancellationMs":queued_ms,"runningCancellationMs":running_ms,"recovery":"independent-process-without-engine","recoveryArtifact":replay.artifact_manifest,"crossTenantAndActor":"REJECTED","staleLease":"REJECTED","formalAccepted":false}),
            )?,
        )?;
        Ok(())
    })();
    rt.block_on(shutdown_child(child, &socket));
    result
}
