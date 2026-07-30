use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use pbjson_types::{Struct, Value, value::Kind};
use quantos_engine_manager::{
    BackoffPolicy, EngineCapabilityManifest, EngineManager, EngineManifest, EngineQuota,
    EngineTransport, build_metadata,
};
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::{ActorRef, JsonDocument},
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
    PathBuf::from("/tmp").join(format!("quantos-vibe-{}.sock", Uuid::now_v7()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "vibe-adapter".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "research.vibe_adapter.execute".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Replay research-safe Vibe-Trading fixtures.".to_owned(),
        }],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

fn execute_request(request_id: &str, input: JsonDocument) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(build_actor_metadata(request_id)),
        workflow_run_id: format!("run-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        capability: "research.vibe_adapter.execute".to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: "snapshot-1".to_owned(),
        policy_context_ref: "policy-1".to_owned(),
        input: Some(input),
        deadline: Some(timestamp_after(Duration::from_secs(5))),
    }
}

fn build_actor_metadata(request_id: &str) -> quantos_proto::quantos::common::v1::CommandMetadata {
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

fn json_document_with_string(key: &str, value: &str) -> JsonDocument {
    let mut fields = HashMap::new();
    fields.insert(
        key.to_owned(),
        Value {
            kind: Some(Kind::StringValue(value.to_owned())),
        },
    );
    JsonDocument {
        value: Some(Struct { fields }),
    }
}

fn timestamp_after(duration: Duration) -> Timestamp {
    let target = Utc::now() + chrono::Duration::from_std(duration).expect("duration converts");
    Timestamp {
        seconds: target.timestamp(),
        nanos: target.timestamp_subsec_nanos() as i32,
    }
}

async fn spawn_python_vibe_adapter(socket_path: &Path) -> anyhow::Result<Child> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-vibe-adapter")
        .arg("python")
        .arg("-m")
        .arg("vibe_adapter.server")
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
        "vibe adapter socket did not appear at {}",
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
async fn python_vibe_adapter_contracts_round_trip_over_uds() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_vibe_adapter(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "vibe-adapter",
                GetMetadataRequest {
                    metadata: Some(build_actor_metadata("contract")),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "vibe-adapter");
        assert_eq!(
            metadata.capabilities[0].name,
            "research.vibe_adapter.execute"
        );

        let health = manager
            .health(
                "vibe-adapter",
                HealthRequest {
                    metadata: Some(build_actor_metadata("health")),
                },
            )
            .await?;
        assert!(health.ready);

        let execute = manager
            .execute(
                "research.vibe_adapter.execute",
                execute_request("exec", JsonDocument::default()),
            )
            .await?;
        assert_eq!(execute.execution_id, "run-exec:idem-exec");
        assert_eq!(execute.artifact_refs.len(), 1);
        assert_eq!(execute.evidence_refs.len(), 1);

        let stream = manager
            .stream_execute_collect(
                "research.vibe_adapter.execute",
                StreamExecuteRequest {
                    request: Some(execute_request("stream", JsonDocument::default())),
                },
            )
            .await?;
        assert_eq!(stream.len(), 3);
        assert!(!stream[0].done);
        assert!(!stream[1].done);
        assert!(stream[2].done);

        let cancel = manager
            .cancel(
                "vibe-adapter",
                CancelRequest {
                    metadata: Some(build_actor_metadata("cancel")),
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
async fn python_vibe_adapter_rejects_forbidden_boundary_fields() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_vibe_adapter(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

        let error = manager
            .execute(
                "research.vibe_adapter.execute",
                execute_request("deny", json_document_with_string("venue", "binance")),
            )
            .await
            .expect_err("forbidden venue should be denied");
        assert_eq!(error.machine_code(), "ENGINE_RPC");
        assert!(error.to_string().contains("forbidden"));
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}
