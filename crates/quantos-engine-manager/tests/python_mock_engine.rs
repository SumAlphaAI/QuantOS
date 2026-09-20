use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use quantos_engine_manager::{
    BackoffPolicy, EngineCapabilityManifest, EngineManager, EngineManifest, EngineQuota,
    EngineTransport, build_metadata,
};
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::{ActorRef, CommandMetadata, JsonDocument},
    engine::v1::{
        CancelRequest, ExecuteRequest, GetMetadataRequest, HealthRequest, StreamExecuteRequest,
    },
};
use tokio::{
    process::{Child, Command},
    time::sleep,
};
use uuid::Uuid;

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
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

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
        let mut manager = EngineManager::new(BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(25),
            max_backoff: Duration::from_millis(100),
            max_dispatch_attempts: 5,
        });
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

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
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

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
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

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
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest)?;

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
    let mut manager = EngineManager::new(BackoffPolicy {
        crash_threshold: 3,
        base_backoff: Duration::from_millis(100),
        max_backoff: Duration::from_millis(200),
        max_dispatch_attempts: 30,
    });
    manager.register_engine(manifest_for_socket(socket_path.clone()))?;

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
