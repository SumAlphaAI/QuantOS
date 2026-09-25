use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use pbjson_types::{Struct, Value, value::Kind};
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineManager, EngineManifest,
    EngineQuota, EngineTransport, build_metadata,
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
    PathBuf::from("/tmp").join(format!("quantos-rd-agent-{}.sock", Uuid::now_v7()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "rd-agent".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![
            EngineCapabilityManifest {
                name: "research.hypothesis.v1".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Generate deterministic hypothesis ResearchArtifacts.".to_owned(),
            },
            EngineCapabilityManifest {
                name: "research.experiment.v1".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Generate deterministic experiment ResearchArtifacts.".to_owned(),
            },
        ],
        transport: EngineTransport::Uds { socket_path },
        quota: EngineQuota {
            max_concurrency: 4,
            max_rss_mb: 512,
        },
    }
}

fn build_actor_metadata(
    request_id: &str,
    capabilities: &[&str],
) -> quantos_proto::quantos::common::v1::CommandMetadata {
    let mut metadata = build_metadata(request_id);
    metadata.actor = Some(ActorRef {
        actor_id: "actor-primary".to_owned(),
        actor_kind: 1,
        display_name: "QuantOS Tester".to_owned(),
        capabilities: capabilities
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
    });
    metadata.mode = 1;
    metadata
}

fn execute_request(request_id: &str, capability: &str, input: JsonDocument) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(build_actor_metadata(request_id, &[capability])),
        workflow_run_id: format!("run-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        capability: capability.to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: "snapshot-fixed-1".to_owned(),
        policy_context_ref: "policy-1".to_owned(),
        input: Some(input),
        deadline: Some(timestamp_after(Duration::from_secs(5))),
    }
}

fn json_document_with_fields(fields: &[(&str, &str)]) -> JsonDocument {
    let mut mapping = HashMap::new();
    for (key, value) in fields {
        mapping.insert(
            (*key).to_owned(),
            Value {
                kind: Some(Kind::StringValue((*value).to_owned())),
            },
        );
    }
    JsonDocument {
        value: Some(Struct { fields: mapping }),
    }
}

fn timestamp_after(duration: Duration) -> Timestamp {
    let target = Utc::now() + chrono::Duration::from_std(duration).expect("duration converts");
    Timestamp {
        seconds: target.timestamp(),
        nanos: target.timestamp_subsec_nanos() as i32,
    }
}

async fn spawn_python_rd_agent(socket_path: &Path) -> anyhow::Result<Child> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-rd-agent")
        .arg("python")
        .arg("-m")
        .arg("rd_agent.server")
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
        "rd-agent socket did not appear at {}",
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
async fn python_rd_agent_contracts_round_trip_over_uds() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_rd_agent(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "rd-agent",
                GetMetadataRequest {
                    metadata: Some(build_actor_metadata(
                        "contract",
                        &["research.hypothesis.v1", "research.experiment.v1"],
                    )),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "rd-agent");
        assert_eq!(metadata.capabilities.len(), 2);

        let health = manager
            .health(
                "rd-agent",
                HealthRequest {
                    metadata: Some(build_actor_metadata("health", &["research.hypothesis.v1"])),
                },
            )
            .await?;
        assert!(health.ready);

        let execute = manager
            .execute(
                "research.hypothesis.v1",
                execute_request(
                    "exec",
                    "research.hypothesis.v1",
                    json_document_with_fields(&[
                        ("fixture", "hypothesis_regime_shift"),
                        ("prompt", "Generate hypothesis"),
                    ]),
                ),
            )
            .await?;
        assert_eq!(execute.execution_id, "run-exec:idem-exec");
        assert_eq!(execute.artifact_refs.len(), 1);
        assert_eq!(execute.evidence_refs.len(), 1);

        let stream = manager
            .stream_execute_collect(
                "research.experiment.v1",
                StreamExecuteRequest {
                    request: Some(execute_request(
                        "stream",
                        "research.experiment.v1",
                        json_document_with_fields(&[
                            ("fixture", "experiment_factor_stability"),
                            ("prompt", "Run experiment"),
                        ]),
                    )),
                },
            )
            .await?;
        assert_eq!(stream.len(), 3);
        assert!(!stream[0].done);
        assert!(!stream[1].done);
        assert!(stream[2].done);

        let cancel = manager
            .cancel(
                "rd-agent",
                CancelRequest {
                    metadata: Some(build_actor_metadata("cancel", &["research.hypothesis.v1"])),
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
async fn python_rd_agent_rejects_forbidden_boundary_fields() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_rd_agent(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let error = manager
            .execute(
                "research.hypothesis.v1",
                execute_request(
                    "deny",
                    "research.hypothesis.v1",
                    json_document_with_fields(&[("network_access", "true")]),
                ),
            )
            .await
            .expect_err("forbidden network access should be denied");
        assert_eq!(error.machine_code(), "ENGINE_RPC");
        assert!(error.to_string().contains("forbidden"));
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}
