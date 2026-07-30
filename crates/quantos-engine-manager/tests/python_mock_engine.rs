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
    common::v1::JsonDocument,
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
        metadata: Some(build_metadata(request_id)),
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
) -> anyhow::Result<Child> {
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
    let child = spawn_python_mock_engine(&socket_path, 0, 0).await?;

    let result = async {
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "mock-engine",
                GetMetadataRequest {
                    metadata: Some(build_metadata("contract")),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "mock-engine");
        assert_eq!(metadata.capabilities.len(), 1);

        let health = manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(build_metadata("health")),
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
                    metadata: Some(build_metadata("cancel")),
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
    let child = spawn_python_mock_engine(&socket_path, 3, 0).await?;

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
    let child = spawn_python_mock_engine(&socket_path, 0, 3_000).await?;

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
