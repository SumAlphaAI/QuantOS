use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineManager, EngineManifest,
    EngineQuota, EngineRoutingPolicy, EngineTransport, SidecarSpec, build_metadata,
};
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::{ActorRef, CommandMetadata, JsonDocument},
    engine::v1::{
        CancelRequest, ExecuteRequest, GetMetadataRequest, HealthRequest, StreamExecuteRequest,
    },
};
use sha2::{Digest, Sha256};
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

fn short_socket_path() -> PathBuf {
    PathBuf::from("/tmp").join(format!("quantos-mock-{}.sock", Uuid::now_v7()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "mock-engine".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "research.execute".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Execute deterministic research fixtures.".to_owned(),
        }],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

fn execute_request(request_id: &str) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(valid_metadata(request_id)),
        workflow_run_id: format!("run-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        capability: "research.execute".to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: "snapshot-1".to_owned(),
        policy_context_ref: "policy-1".to_owned(),
        input: Some(JsonDocument::default()),
        deadline: Some(timestamp_after(Duration::from_secs(5))),
    }
}

fn valid_metadata(request_id: &str) -> CommandMetadata {
    let mut metadata = build_metadata(request_id);
    metadata.actor = Some(ActorRef {
        actor_id: "actor-primary".to_owned(),
        actor_kind: 1,
        display_name: "QuantOS Tester".to_owned(),
        capabilities: vec!["research.execute".to_owned()],
    });
    metadata.mode = 1;
    metadata
}

fn timestamp_after(duration: Duration) -> Timestamp {
    let target = Utc::now() + chrono::Duration::from_std(duration).expect("duration converts");
    Timestamp {
        seconds: target.timestamp(),
        nanos: target.timestamp_subsec_nanos() as i32,
    }
}

async fn spawn_python_mock_engine(
    socket_path: &Path,
    failures_before_success: u32,
    default_sleep_ms: u32,
    exit_on_execute: bool,
) -> anyhow::Result<Child> {
    if socket_path.exists() {
        std::fs::remove_file(socket_path)?;
    }
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-mock-engine")
        .arg("python")
        .arg("-m")
        .arg("mock_engine.server")
        .arg("--socket")
        .arg(socket_path)
        .arg("--failures-before-success")
        .arg(failures_before_success.to_string())
        .arg("--default-sleep-ms")
        .arg(default_sleep_ms.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if exit_on_execute {
        command.arg("--exit-on-execute");
    }
    let child = command.spawn()?;

    for _ in 0..100 {
        if socket_path.exists() {
            sleep(Duration::from_millis(100)).await;
            return Ok(child);
        }
        sleep(Duration::from_millis(50)).await;
    }

    Err(anyhow::anyhow!(
        "mock engine socket did not appear at {}",
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

#[tokio::test]
async fn python_mock_engine_contracts_round_trip_over_uds() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "mock-engine",
                GetMetadataRequest {
                    metadata: Some(valid_metadata("contract")),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "mock-engine");
        assert_eq!(metadata.capabilities.len(), 1);

        let health = manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata("health")),
                },
            )
            .await?;
        assert!(health.ready);

        let execute = manager
            .execute("research.execute", execute_request("exec"))
            .await?;
        assert_eq!(execute.execution_id, "run-exec:idem-exec");
        assert_eq!(execute.artifact_refs.len(), 1);

        let stream = manager
            .stream_execute_collect(
                "research.execute",
                StreamExecuteRequest {
                    request: Some(execute_request("stream")),
                },
            )
            .await?;
        assert_eq!(stream.len(), 2);
        assert!(!stream[0].done);
        assert!(stream[1].done);

        let mut wrong_tenant = valid_metadata("cancel-cross-tenant");
        wrong_tenant.tenant_id = "tenant-other".to_owned();
        let denied = manager
            .cancel(
                "mock-engine",
                CancelRequest {
                    metadata: Some(wrong_tenant),
                    execution_id: execute.execution_id.clone(),
                    reason: "cross-tenant".to_owned(),
                },
            )
            .await
            .expect_err("cross tenant cancel denied");
        assert_eq!(denied.machine_code(), "ENGINE_CANCEL_DENIED");

        let cancel = manager
            .cancel(
                "mock-engine",
                CancelRequest {
                    metadata: Some(valid_metadata("cancel")),
                    execution_id: execute.execution_id,
                    reason: "operator-request".to_owned(),
                },
            )
            .await?;
        assert!(cancel.cancelled);

        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn python_mock_engine_recovers_after_three_unavailable_failures() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 3, 0, false).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy {
                crash_threshold: 3,
                base_backoff: Duration::from_millis(25),
                max_backoff: Duration::from_millis(100),
                max_dispatch_attempts: 5,
            },
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let started_at = std::time::Instant::now();
        let response = manager
            .execute("research.execute", execute_request("retry"))
            .await?;
        assert_eq!(response.execution_id, "run-retry:idem-retry");
        assert!(started_at.elapsed() >= Duration::from_millis(25));
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn python_mock_engine_deadline_timeout_is_deterministic() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 3_000, false).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let started_at = std::time::Instant::now();
        let mut request = execute_request("timeout");
        request.deadline = Some(timestamp_after(Duration::from_millis(500)));
        let error = manager
            .execute("research.execute", request)
            .await
            .expect_err("deadline should expire");
        assert_eq!(error.machine_code(), "ENGINE_DEADLINE_EXCEEDED");
        assert!(started_at.elapsed() < Duration::from_secs(2));
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn missing_vibe_adapter_does_not_block_mock_workflow_routing() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let execute = manager
            .execute("research.execute", execute_request("adapter-absent"))
            .await?;
        assert_eq!(
            execute.execution_id,
            "run-adapter-absent:idem-adapter-absent"
        );

        let error = manager
            .execute(
                "research.vibe_adapter.execute",
                execute_request("missing-vibe-adapter"),
            )
            .await
            .expect_err("unregistered vibe capability should stay isolated");
        assert_eq!(error.machine_code(), "ENGINE_CAPABILITY_NOT_ROUTED");
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn execution_concurrency_and_rss_quotas_reject_excess_work() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 500, false).await?;

    let result = async {
        let mut manifest = manifest_for_socket(socket_path.clone());
        manifest.quota.max_concurrency = 1;
        manifest.quota.max_rss_mb = 64;
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest)?;

        let mut first = manager.clone();
        let first_call = tokio::spawn(async move {
            first
                .execute("research.execute", execute_request("quota-first"))
                .await
        });
        sleep(Duration::from_millis(100)).await;
        let concurrency_error = manager
            .execute("research.execute", execute_request("quota-second"))
            .await
            .expect_err("second concurrent call must be rejected");
        assert_eq!(concurrency_error.machine_code(), "ENGINE_CONCURRENCY_QUOTA");
        first_call.await??;

        manager.report_rss_mb("mock-engine", 65)?;
        let rss_error = manager
            .execute("research.execute", execute_request("rss-over-limit"))
            .await
            .expect_err("reported RSS above quota must be rejected");
        assert_eq!(rss_error.machine_code(), "ENGINE_RSS_QUOTA");
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn one_request_survives_three_real_engine_process_crashes() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let first_child = spawn_python_mock_engine(&socket_path, 0, 0, true).await?;
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_millis(200),
            max_dispatch_attempts: 30,
        },
        b"f08-test-approval-key".to_vec(),
    );
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

    let request_task = tokio::spawn(async move {
        manager
            .execute("research.execute", execute_request("three-process-crashes"))
            .await
    });

    let mut child = first_child;
    for crash_index in 0..3 {
        let status = tokio::time::timeout(Duration::from_secs(3), child.wait()).await??;
        assert_eq!(
            status.code(),
            Some(70),
            "crash {crash_index} must be intentional"
        );
        child = spawn_python_mock_engine(&socket_path, 0, 0, crash_index < 2).await?;
    }

    let response = tokio::time::timeout(Duration::from_secs(5), request_task).await???;
    assert_eq!(
        response.execution_id,
        "run-three-process-crashes:idem-three-process-crashes"
    );
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn manager_supervises_three_real_crashes_without_test_owned_restarts() -> anyhow::Result<()> {
    let tempdir = tempfile::tempdir()?;
    let socket_path = short_socket_path();
    let crash_state = tempdir.path().join("crashes-left.txt");
    std::fs::write(&crash_state, "3")?;
    let python = engines_dir().join(".venv/bin/python");
    let artifact_path = engines_dir().join("mock-engine/src/mock_engine/server.py");
    let digest = Sha256::digest(std::fs::read(&artifact_path)?);
    let artifact_sha256: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    let manifest = manifest_for_socket(socket_path.clone());
    let approval = EngineApproval::sign_for_local_fixture(
        &manifest,
        &artifact_sha256,
        "F08 test reviewer",
        TEST_APPROVAL_KEY,
    )?;
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(50),
            max_backoff: Duration::from_millis(100),
            max_dispatch_attempts: 40,
        },
        TEST_APPROVAL_KEY.to_vec(),
    );
    manager.register_supervised_engine(
        manifest,
        &approval,
        SidecarSpec {
            executable: python,
            artifact_path,
            args: vec![
                "-m".to_owned(),
                "mock_engine.server".to_owned(),
                "--socket".to_owned(),
                socket_path.display().to_string(),
                "--crash-state-file".to_owned(),
                crash_state.display().to_string(),
            ],
        },
    )?;
    let response = manager
        .execute("research.execute", execute_request("managed-crashes"))
        .await?;
    assert_eq!(
        response.execution_id,
        "run-managed-crashes:idem-managed-crashes"
    );
    assert_eq!(std::fs::read_to_string(&crash_state)?, "0");
    manager.stop_supervised_engine("mock-engine").await?;
    Ok(())
}

#[tokio::test]
async fn observed_sidecar_rss_excess_quarantines_shared_route() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let python = engines_dir().join(".venv/bin/python");
    let artifact_path = engines_dir().join("mock-engine/src/mock_engine/server.py");
    let digest = Sha256::digest(std::fs::read(&artifact_path)?);
    let artifact_sha256: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    let mut manifest = manifest_for_socket(socket_path.clone());
    manifest.quota.max_rss_mb = 1;
    let approval = EngineApproval::sign_for_local_fixture(
        &manifest,
        &artifact_sha256,
        "F08 test reviewer",
        TEST_APPROVAL_KEY,
    )?;
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    manager.register_supervised_engine(
        manifest,
        &approval,
        SidecarSpec {
            executable: python,
            artifact_path,
            args: vec![
                "-m".to_owned(),
                "mock_engine.server".to_owned(),
                "--socket".to_owned(),
                socket_path.display().to_string(),
            ],
        },
    )?;
    let mut dispatch_clone = manager.clone();
    let error = dispatch_clone
        .execute("research.execute", execute_request("observed-rss"))
        .await
        .expect_err("observed sidecar RSS must exceed 1 MiB");
    assert_eq!(error.machine_code(), "ENGINE_RSS_QUOTA");
    let error = manager
        .execute("research.execute", execute_request("quarantined-rss"))
        .await
        .expect_err("quota shutdown must quarantine other manager clones");
    assert_eq!(error.machine_code(), "ENGINE_NOT_READY");
    Ok(())
}

#[tokio::test]
async fn approval_cli_signs_reviewed_manifest_and_refuses_overwrite() -> anyhow::Result<()> {
    let tempdir = tempfile::tempdir()?;
    let manifest_path = tempdir.path().join("manifest.json");
    let policy_path = tempdir.path().join("policy.json");
    let artifact_path = tempdir.path().join("artifact.whl");
    let output_path = tempdir.path().join("approval.json");
    let manifest = manifest_for_socket(tempdir.path().join("engine.sock"));
    std::fs::write(&manifest_path, serde_json::to_vec(&manifest)?)?;
    std::fs::write(
        &policy_path,
        serde_json::to_vec(&EngineRoutingPolicy::local_fixture())?,
    )?;
    std::fs::write(&artifact_path, b"reviewed immutable artifact")?;
    let invoke = || {
        let mut command = Command::new(env!("CARGO_BIN_EXE_f08-approval"));
        command
            .env("QUANTOS_ENGINE_APPROVAL_KEY_HEX", "ab".repeat(32))
            .arg(&manifest_path)
            .arg(&policy_path)
            .arg(&artifact_path)
            .arg("F08 reviewer")
            .arg(&output_path);
        command
    };
    assert!(invoke().status().await?.success());
    let approval: EngineApproval = serde_json::from_slice(&std::fs::read(&output_path)?)?;
    let mut manager = EngineManager::with_approval_key(BackoffPolicy::default(), vec![0xab; 32]);
    manager.register_approved_engine(manifest, &approval)?;
    assert!(!invoke().status().await?.success());
    Ok(())
}

#[tokio::test]
async fn heartbeat_removes_failed_engine_and_restores_ready_route() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(20),
            max_backoff: Duration::from_millis(50),
            max_dispatch_attempts: 8,
        },
        TEST_APPROVAL_KEY.to_vec(),
    );
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    let monitor = manager.start_health_monitor(Duration::from_millis(20));
    assert_eq!(manager.snapshot().await.registered_engines, 1);
    sleep(Duration::from_millis(100)).await;
    shutdown_child(child, &socket_path).await;
    tokio::time::timeout(Duration::from_secs(3), async {
        while manager
            .circuit_state("mock-engine")
            .is_some_and(|state| state.ready)
        {
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await?;
    let denied = manager
        .execute("research.execute", execute_request("heartbeat-down"))
        .await
        .expect_err("unhealthy engine must be removed from routing");
    assert_eq!(denied.machine_code(), "ENGINE_NOT_READY");
    let recovered = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    tokio::time::timeout(Duration::from_secs(3), async {
        while !manager
            .circuit_state("mock-engine")
            .is_some_and(|state| state.ready)
        {
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await?;
    manager
        .execute("research.execute", execute_request("heartbeat-restored"))
        .await?;
    monitor.abort();
    shutdown_child(recovered, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn manager_cancel_interrupts_owned_running_execution() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 1_500, false).await?;
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    let mut execution_manager = manager.clone();
    let execution = tokio::spawn(async move {
        execution_manager
            .execute("research.execute", execute_request("running-cancel"))
            .await
    });
    sleep(Duration::from_millis(150)).await;
    let started = std::time::Instant::now();
    let confirmation = manager
        .cancel(
            "mock-engine",
            CancelRequest {
                metadata: Some(valid_metadata("running-cancel-command")),
                execution_id: "run-running-cancel:idem-running-cancel".to_owned(),
                reason: "operator-request".to_owned(),
            },
        )
        .await?;
    assert!(confirmation.cancelled);
    let error = execution
        .await?
        .expect_err("running request must stop after cancellation");
    assert_eq!(error.machine_code(), "ENGINE_RPC");
    assert!(started.elapsed() < Duration::from_secs(2));
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn duplicate_key_returns_same_result_and_changed_input_is_rejected() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let result = async {
        let mut manager =
            EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
        let request = execute_request("idempotency");
        let first = manager.execute("research.execute", request.clone()).await?;
        let second = manager.execute("research.execute", request.clone()).await?;
        assert_eq!(first, second);
        assert_eq!(
            manager
                .completed_execution("tenant-primary", "research.execute", "idem-idempotency")
                .await,
            Some(first)
        );
        let mut changed = request;
        changed.data_snapshot_ref = "other-snapshot".to_owned();
        let error = manager
            .execute("research.execute", changed)
            .await
            .expect_err("same key cannot change payload");
        assert_eq!(error.machine_code(), "ENGINE_IDEMPOTENCY_CONFLICT");
        Ok::<(), anyhow::Error>(())
    }
    .await;
    shutdown_child(child, &socket_path).await;
    result
}

#[tokio::test]
async fn signed_rate_limit_and_stream_deadline_are_enforced() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 3_000, false).await?;
    let result = async {
        let manifest = manifest_for_socket(socket_path.clone());
        let mut policy = EngineRoutingPolicy::local_fixture();
        policy.max_requests_per_second = 1;
        let approval = EngineApproval::sign_with_policy(
            &manifest,
            &"a".repeat(64),
            "F08 test reviewer",
            policy,
            TEST_APPROVAL_KEY,
        )?;
        let mut manager =
            EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
        manager.register_approved_engine(manifest, &approval)?;
        let mut request = execute_request("stream-deadline");
        request.deadline = Some(timestamp_after(Duration::from_millis(500)));
        let started = std::time::Instant::now();
        let error = manager
            .stream_execute_collect(
                "research.execute",
                StreamExecuteRequest {
                    request: Some(request),
                },
            )
            .await
            .expect_err("stream must expire");
        assert_eq!(error.machine_code(), "ENGINE_DEADLINE_EXCEEDED");
        assert!(started.elapsed() < Duration::from_secs(2));
        manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata("post-timeout-health")),
                },
            )
            .await?;
        let error = manager
            .execute("research.execute", execute_request("rate-exhausted"))
            .await
            .expect_err("one request per second enforced");
        assert_eq!(error.machine_code(), "ENGINE_RATE_LIMITED");
        Ok::<(), anyhow::Error>(())
    }
    .await;
    shutdown_child(child, &socket_path).await;
    result
}
