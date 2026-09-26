use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use pbjson_types::{Struct, Value, value::Kind};
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
    std::env::var_os("F08_TARGET_SOCKET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(format!("quantos-mock-{}.sock", Uuid::now_v7()))
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

fn fault_request(request_id: &str, field: &str, fault: &str) -> ExecuteRequest {
    let mut request = execute_request(request_id);
    request.input = Some(JsonDocument {
        value: Some(Struct {
            fields: std::collections::HashMap::from([(
                field.to_owned(),
                Value {
                    kind: Some(Kind::StringValue(fault.to_owned())),
                },
            )]),
        }),
    });
    request
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

async fn spawn_untrusted_engine(socket_path: &Path) -> anyhow::Result<Child> {
    spawn_untrusted_engine_with_fault(socket_path, "").await
}

async fn recover_untrusted_route(manager: &mut EngineManager) -> anyhow::Result<()> {
    let response = manager
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("raw-negative-recovery")),
            },
        )
        .await?;
    assert!(response.ready);
    Ok(())
}

async fn spawn_untrusted_engine_with_fault(
    socket_path: &Path,
    handshake_fault: &str,
) -> anyhow::Result<Child> {
    let fixture =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/f08_malformed_server.py");
    let mut child = Command::new(engines_dir().join(".venv/bin/python"))
        .arg(fixture)
        .arg("--socket")
        .arg(socket_path)
        .arg("--handshake-fault")
        .arg(handshake_fault)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    for _ in 0..100 {
        if socket_path.exists() {
            sleep(Duration::from_millis(50)).await;
            return Ok(child);
        }
        if child.try_wait()?.is_some() {
            anyhow::bail!("untrusted test Engine exited before binding its socket");
        }
        sleep(Duration::from_millis(50)).await;
    }
    anyhow::bail!("untrusted test Engine did not bind its socket")
}

async fn shutdown_child(mut child: Child, socket_path: &Path) {
    let _ = child.kill().await;
    let _ = child.wait().await;
    if socket_path.exists() {
        let _ = std::fs::remove_file(socket_path);
    }
}

#[tokio::test]
async fn manager_rejects_broken_execute_and_interrupted_streams() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    let manifest = manifest_for_socket(socket_path.clone());
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.retry_safe = false;
    let approval = EngineApproval::sign_with_policy(
        &manifest,
        &"a".repeat(64),
        "F08 test reviewer",
        policy,
        TEST_APPROVAL_KEY,
    )?;
    manager.register_approved_engine(manifest, &approval)?;

    for (fault, expected) in [
        ("identity", "ENGINE_IDENTITY_MISMATCH"),
        ("rpc", "ENGINE_RPC"),
    ] {
        let request = fault_request(fault, "__mock_execute_fault", fault);
        assert_eq!(
            manager
                .execute("research.execute", request)
                .await
                .expect_err("faulty Execute response must fail closed")
                .machine_code(),
            expected,
        );
        manager
            .execute(
                "research.execute",
                execute_request(&format!("recovered-{fault}")),
            )
            .await?;
    }
    for (fault, expected) in [
        ("incomplete", "ENGINE_STREAM_INCOMPLETE"),
        ("duplicate", "ENGINE_STREAM_INCOMPLETE"),
        ("rpc", "ENGINE_RPC"),
    ] {
        let request = StreamExecuteRequest {
            request: Some(fault_request(fault, "__mock_stream_fault", fault)),
        };
        let error = manager
            .stream_execute_collect("research.execute", request)
            .await
            .expect_err("broken stream must fail closed");
        assert_eq!(error.machine_code(), expected, "fault={fault}");
    }
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn metadata_health_and_cancel_failures_preserve_route_state() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            crash_threshold: 100,
            ..BackoffPolicy::default()
        },
        TEST_APPROVAL_KEY.to_vec(),
    );
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    for (request_id, expected) in [
        ("f08-fault-metadata-identity", "ENGINE_RPC"),
        ("f08-fault-metadata-rpc", "ENGINE_RPC"),
    ] {
        let error = manager
            .get_metadata(
                "mock-engine",
                GetMetadataRequest {
                    metadata: Some(valid_metadata(request_id)),
                },
            )
            .await
            .expect_err("invalid metadata response must be rejected");
        assert_eq!(error.machine_code(), expected);
    }
    for (request_id, expected) in [
        ("f08-fault-health-identity", "ENGINE_RPC"),
        ("f08-fault-health-rpc", "ENGINE_RPC"),
        ("f08-fault-health-not-ready", "ENGINE_NOT_READY"),
    ] {
        let error = manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata(request_id)),
                },
            )
            .await
            .expect_err("unhealthy response must be rejected");
        assert_eq!(error.machine_code(), expected);
    }
    assert!(!manager.circuit_state("mock-engine").expect("state").ready);
    manager
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("health-recovered")),
            },
        )
        .await?;
    assert!(manager.circuit_state("mock-engine").expect("state").ready);
    let execution = manager
        .execute("research.execute", execute_request("cancel-fault-owner"))
        .await?;
    for (request_id, expected) in [
        ("f08-fault-cancel-identity", "ENGINE_RPC"),
        ("f08-fault-cancel-rpc", "ENGINE_RPC"),
    ] {
        let error = manager
            .cancel(
                "mock-engine",
                CancelRequest {
                    metadata: Some(valid_metadata(request_id)),
                    execution_id: execution.execution_id.clone(),
                    reason: "operator-request".to_owned(),
                },
            )
            .await
            .expect_err("faulty cancellation must not be confirmed");
        assert_eq!(error.machine_code(), expected);
    }
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn untrusted_engine_cannot_bypass_manager_response_identity_checks() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_untrusted_engine(&socket_path).await?;
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            crash_threshold: 100,
            ..BackoffPolicy::default()
        },
        TEST_APPROVAL_KEY.to_vec(),
    );
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

    let metadata_error = manager
        .get_metadata(
            "mock-engine",
            GetMetadataRequest {
                metadata: Some(valid_metadata("raw-metadata-mismatch")),
            },
        )
        .await
        .expect_err("forged metadata identity must be rejected");
    assert_eq!(metadata_error.machine_code(), "ENGINE_IDENTITY_MISMATCH");
    recover_untrusted_route(&mut manager).await?;
    let health_error = manager
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("raw-health-mismatch")),
            },
        )
        .await
        .expect_err("forged health identity must be rejected");
    assert_eq!(health_error.machine_code(), "ENGINE_IDENTITY_MISMATCH");
    for fault in [
        "raw-execute-mismatch",
        "raw-execute-metadata",
        "raw-execute-hash",
        "raw-execute-empty-id",
    ] {
        recover_untrusted_route(&mut manager).await?;
        let error = manager
            .execute("research.execute", execute_request(fault))
            .await
            .expect_err("forged Execute response must be rejected");
        assert_eq!(error.machine_code(), "ENGINE_IDENTITY_MISMATCH", "{fault}");
    }
    for fault in [
        "raw-stream-mismatch",
        "raw-stream-empty-id",
        "raw-stream-empty-sequence",
        "raw-stream-incomplete",
        "raw-stream-duplicate",
        "raw-stream-after-terminal",
        "raw-stream-switch-execution",
    ] {
        recover_untrusted_route(&mut manager).await?;
        let error = manager
            .stream_execute_collect(
                "research.execute",
                StreamExecuteRequest {
                    request: Some(execute_request(fault)),
                },
            )
            .await
            .expect_err("forged stream event must be rejected");
        assert_eq!(error.machine_code(), "ENGINE_STREAM_INCOMPLETE", "{fault}");
    }
    let mut stalled = execute_request("raw-stream-stall");
    recover_untrusted_route(&mut manager).await?;
    stalled.deadline = Some(timestamp_after(Duration::from_millis(300)));
    let stalled_error = manager
        .stream_execute_collect(
            "research.execute",
            StreamExecuteRequest {
                request: Some(stalled),
            },
        )
        .await
        .expect_err("stream stalled after its first event must obey deadline");
    assert_eq!(stalled_error.machine_code(), "ENGINE_DEADLINE_EXCEEDED");
    recover_untrusted_route(&mut manager).await?;
    let completed = manager
        .execute("research.execute", execute_request("raw-cancel-owner"))
        .await?;
    let completed_execution_id = completed.execution_id;
    let cancel_error = manager
        .cancel(
            "mock-engine",
            CancelRequest {
                metadata: Some(valid_metadata("raw-cancel-mismatch")),
                execution_id: completed_execution_id.clone(),
                reason: "operator-request".to_owned(),
            },
        )
        .await
        .expect_err("forged cancellation identity must be rejected");
    assert_eq!(cancel_error.machine_code(), "ENGINE_IDENTITY_MISMATCH");
    let cancel_metadata_error = manager
        .cancel(
            "mock-engine",
            CancelRequest {
                metadata: Some(valid_metadata("raw-cancel-metadata")),
                execution_id: completed_execution_id,
                reason: "operator-request".to_owned(),
            },
        )
        .await
        .expect_err("forged cancellation metadata must be rejected");
    assert_eq!(
        cancel_metadata_error.machine_code(),
        "ENGINE_IDENTITY_MISMATCH"
    );
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn unavailable_socket_fails_fast_then_recovers_without_request_loss() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let mut manager = EngineManager::with_approval_key(
        BackoffPolicy {
            max_dispatch_attempts: 1,
            ..BackoffPolicy::default()
        },
        TEST_APPROVAL_KEY.to_vec(),
    );
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    let error = manager
        .execute("research.execute", execute_request("socket-unavailable"))
        .await
        .expect_err("unavailable Engine must fail within dispatch budget");
    assert_eq!(error.machine_code(), "ENGINE_TRANSPORT");
    assert!(!manager.circuit_state("mock-engine").expect("state").ready);
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    manager
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("socket-restored")),
            },
        )
        .await?;
    let response = manager
        .execute("research.execute", execute_request("socket-unavailable"))
        .await?;
    assert_eq!(
        response.execution_id,
        "run-socket-unavailable:idem-socket-unavailable"
    );
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn control_rpcs_timeout_within_two_seconds_on_untrusted_engine() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_untrusted_engine(&socket_path).await?;
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    let execution = manager
        .execute("research.execute", execute_request("control-timeout-owner"))
        .await?;
    let start = std::time::Instant::now();
    assert_eq!(
        manager
            .get_metadata(
                "mock-engine",
                GetMetadataRequest {
                    metadata: Some(valid_metadata("raw-metadata-stall")),
                },
            )
            .await
            .expect_err("Metadata stall must time out")
            .machine_code(),
        "ENGINE_DEADLINE_EXCEEDED"
    );
    assert!(start.elapsed() < Duration::from_millis(2_500));
    let start = std::time::Instant::now();
    assert_eq!(
        manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata("raw-health-stall")),
                },
            )
            .await
            .expect_err("Health stall must time out")
            .machine_code(),
        "ENGINE_DEADLINE_EXCEEDED"
    );
    assert!(start.elapsed() < Duration::from_millis(2_500));
    let start = std::time::Instant::now();
    assert_eq!(
        manager
            .cancel(
                "mock-engine",
                CancelRequest {
                    metadata: Some(valid_metadata("raw-cancel-stall")),
                    execution_id: execution.execution_id,
                    reason: "operator-request".to_owned(),
                },
            )
            .await
            .expect_err("Cancel stall must time out")
            .machine_code(),
        "ENGINE_DEADLINE_EXCEEDED"
    );
    assert!(start.elapsed() < Duration::from_millis(2_500));
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[tokio::test]
async fn handshake_rejects_each_unreviewed_identity_and_readiness_dimension() -> anyhow::Result<()>
{
    for (fault, expected) in [
        ("name", "ENGINE_IDENTITY_MISMATCH"),
        ("version", "ENGINE_IDENTITY_MISMATCH"),
        ("schema", "ENGINE_IDENTITY_MISMATCH"),
        ("capability", "ENGINE_IDENTITY_MISMATCH"),
        ("metadata", "ENGINE_IDENTITY_MISMATCH"),
        ("readiness", "ENGINE_NOT_READY"),
        ("health-metadata", "ENGINE_NOT_READY"),
    ] {
        let socket_path = short_socket_path();
        let child = spawn_untrusted_engine_with_fault(&socket_path, fault).await?;
        let mut manager =
            EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
        let error = manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata(&format!("probe-{fault}"))),
                },
            )
            .await
            .expect_err("unreviewed handshake must not admit an Engine");
        assert_eq!(error.machine_code(), expected, "fault={fault}");
        shutdown_child(child, &socket_path).await;
    }
    Ok(())
}

#[tokio::test]
async fn supervised_sidecar_refuses_tampered_artifact_then_recovers() -> anyhow::Result<()> {
    let directory = tempfile::tempdir()?;
    let socket_path = short_socket_path();
    let artifact_path = directory.path().join("mock-server.py");
    let source = std::fs::read(engines_dir().join("mock-engine/src/mock_engine/server.py"))?;
    std::fs::write(&artifact_path, &source)?;
    let digest: String = Sha256::digest(&source)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let manifest = manifest_for_socket(socket_path.clone());
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.requires_supervision = true;
    let approval = EngineApproval::sign_with_policy(
        &manifest,
        &digest,
        "F08 test reviewer",
        policy,
        TEST_APPROVAL_KEY,
    )?;
    let mut manager = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        TEST_APPROVAL_KEY.to_vec(),
        directory.path().join("manager-state"),
    )?;
    manager.register_supervised_engine(
        manifest,
        &approval,
        SidecarSpec {
            executable: engines_dir().join(".venv/bin/python"),
            artifact_path: artifact_path.clone(),
            args: vec![
                "-m".to_owned(),
                "mock_engine.server".to_owned(),
                "--socket".to_owned(),
                socket_path.display().to_string(),
            ],
        },
    )?;
    std::fs::write(&artifact_path, b"tampered")?;
    assert_eq!(
        manager
            .execute("research.execute", execute_request("tampered-artifact"))
            .await
            .expect_err("tampered approved code must not start")
            .machine_code(),
        "ENGINE_ARTIFACT_MISMATCH"
    );
    assert!(!socket_path.exists());
    std::fs::write(&artifact_path, &source)?;
    let mut recovered = false;
    for _ in 0..20 {
        if manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata("artifact-restored")),
                },
            )
            .await
            .is_ok()
        {
            recovered = true;
            break;
        }
        sleep(Duration::from_millis(50)).await;
    }
    assert!(
        recovered,
        "approved sidecar must recover after artifact restore"
    );
    let response = manager
        .execute("research.execute", execute_request("tampered-artifact"))
        .await?;
    assert!(!response.execution_id.is_empty());
    manager.stop_supervised_engine("mock-engine").await?;
    assert!(manager.manifest("mock-engine").is_none());
    Ok(())
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
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.requires_supervision = true;
    let approval = EngineApproval::sign_with_policy(
        &manifest,
        &artifact_sha256,
        "F08 test reviewer",
        policy,
        TEST_APPROVAL_KEY,
    )?;
    let mut manager = EngineManager::with_durable_state(
        BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(50),
            max_backoff: Duration::from_millis(100),
            max_dispatch_attempts: 40,
        },
        TEST_APPROVAL_KEY.to_vec(),
        tempdir.path().join("manager-state"),
    )?;
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
                "--state-db".to_owned(),
                tempdir
                    .path()
                    .join("manager-state/mock-results.sqlite")
                    .display()
                    .to_string(),
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
    let missing_args = Command::new(env!("CARGO_BIN_EXE_f08-approval"))
        .output()
        .await?;
    assert!(!missing_args.status.success());
    assert!(String::from_utf8_lossy(&missing_args.stderr).contains("usage: f08-approval"));
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
    let short_key = invoke()
        .env("QUANTOS_ENGINE_APPROVAL_KEY_HEX", "ab")
        .output()
        .await?;
    assert!(!short_key.status.success());
    assert!(String::from_utf8_lossy(&short_key.stderr).contains("at least 32 bytes"));
    assert!(!output_path.exists());
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
async fn dispatch_reprobes_ready_engine_without_background_monitor() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let mut manager =
        EngineManager::with_approval_key(BackoffPolicy::default(), TEST_APPROVAL_KEY.to_vec());
    register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;
    shutdown_child(child, &socket_path).await;
    assert!(
        manager
            .health(
                "mock-engine",
                HealthRequest {
                    metadata: Some(valid_metadata("route-probe-down")),
                },
            )
            .await
            .is_err()
    );
    assert!(!manager.circuit_state("mock-engine").expect("state").ready);
    let recovered = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let response = manager
        .execute("research.execute", execute_request("route-probe-up"))
        .await?;
    assert_eq!(
        response.execution_id,
        "run-route-probe-up:idem-route-probe-up"
    );
    assert!(manager.circuit_state("mock-engine").expect("state").ready);
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
        .cancel_capability(
            "research.execute",
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
async fn durable_result_and_circuit_survive_manager_reconstruction() -> anyhow::Result<()> {
    let state = tempfile::tempdir()?;
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    let manifest = manifest_for_socket(socket_path.clone());
    let mut first = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        TEST_APPROVAL_KEY.to_vec(),
        state.path().join("manager"),
    )?;
    register_reviewed_engine(&mut first, manifest.clone())?;
    let request = execute_request("durable-result");
    let original = first.execute("research.execute", request.clone()).await?;
    shutdown_child(child, &socket_path).await;
    let failed_health = first
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("durable-health-down")),
            },
        )
        .await;
    assert!(failed_health.is_err());
    drop(first);

    let mut recovered = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        TEST_APPROVAL_KEY.to_vec(),
        state.path().join("manager"),
    )?;
    register_reviewed_engine(&mut recovered, manifest)?;
    assert!(!recovered.circuit_state("mock-engine").expect("state").ready);
    assert_eq!(
        recovered
            .completed_execution("tenant-primary", "research.execute", "idem-durable-result")
            .await,
        Some(original.clone())
    );
    let denied = recovered
        .execute("research.execute", request.clone())
        .await
        .expect_err("unhealthy route must remain closed across restart");
    assert_eq!(denied.machine_code(), "ENGINE_NOT_READY");

    let child = spawn_python_mock_engine(&socket_path, 0, 0, false).await?;
    recovered
        .health(
            "mock-engine",
            HealthRequest {
                metadata: Some(valid_metadata("durable-health-restored")),
            },
        )
        .await?;
    assert_eq!(
        recovered
            .execute("research.execute", request.clone())
            .await?,
        original
    );
    let mut changed = request;
    changed.data_snapshot_ref = "different-snapshot".to_owned();
    let error = recovered
        .execute("research.execute", changed)
        .await
        .expect_err("key is bound");
    assert_eq!(error.machine_code(), "ENGINE_IDEMPOTENCY_CONFLICT");
    let cancelled = recovered
        .cancel(
            "mock-engine",
            CancelRequest {
                metadata: Some(valid_metadata("durable-owner-cancel")),
                execution_id: original.execution_id,
                reason: "reconciled-by-runtime".to_owned(),
            },
        )
        .await?;
    assert!(cancelled.cancelled);
    shutdown_child(child, &socket_path).await;
    Ok(())
}

#[test]
fn durable_child_execute_entry() {
    let Ok(directory) = std::env::var("F08_DURABLE_CHILD_DIR") else {
        return;
    };
    let socket = std::env::var("F08_DURABLE_CHILD_SOCKET").expect("child socket");
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("child runtime");
    runtime.block_on(async {
        let mut manager = EngineManager::with_durable_state(
            BackoffPolicy::default(),
            TEST_APPROVAL_KEY.to_vec(),
            PathBuf::from(directory),
        )
        .expect("child manager");
        register_reviewed_engine(&mut manager, manifest_for_socket(PathBuf::from(socket)))
            .expect("child registration");
        let _ = manager
            .execute("research.execute", execute_request("killed-manager"))
            .await;
    });
}

#[tokio::test]
async fn os_killed_manager_replays_pending_key_into_one_durable_result() -> anyhow::Result<()> {
    let directory = tempfile::tempdir()?;
    let state_dir = directory.path().join("manager");
    let socket_path = short_socket_path();
    let child = spawn_python_mock_engine(&socket_path, 0, 2_000, false).await?;
    let mut manager_process = Command::new(std::env::current_exe()?)
        .arg("--exact")
        .arg("durable_child_execute_entry")
        .env("F08_DURABLE_CHILD_DIR", &state_dir)
        .env("F08_DURABLE_CHILD_SOCKET", &socket_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if let Ok(bytes) = std::fs::read(state_dir.join("state.json")) {
                let value: serde_json::Value = serde_json::from_slice(&bytes).expect("valid state");
                if value["pending"]
                    .as_object()
                    .is_some_and(|pending| !pending.is_empty())
                {
                    break;
                }
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await?;
    let mut recovered = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        TEST_APPROVAL_KEY.to_vec(),
        state_dir.clone(),
    )?;
    register_reviewed_engine(&mut recovered, manifest_for_socket(socket_path.clone()))?;
    let busy = recovered
        .execute("research.execute", execute_request("killed-manager"))
        .await
        .expect_err("second Manager cannot concurrently dispatch the same key");
    assert_eq!(busy.machine_code(), "ENGINE_DURABLE_BUSY");
    manager_process.kill().await?;
    manager_process.wait().await?;
    let mut unsafe_replay = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        TEST_APPROVAL_KEY.to_vec(),
        state_dir.clone(),
    )?;
    let manifest = manifest_for_socket(socket_path.clone());
    let mut no_retry_policy = EngineRoutingPolicy::local_fixture();
    no_retry_policy.retry_safe = false;
    let no_retry_approval = EngineApproval::sign_with_policy(
        &manifest,
        &"a".repeat(64),
        "F08 test reviewer",
        no_retry_policy,
        TEST_APPROVAL_KEY,
    )?;
    unsafe_replay.register_approved_engine(manifest, &no_retry_approval)?;
    assert_eq!(
        unsafe_replay
            .execute("research.execute", execute_request("killed-manager"))
            .await
            .expect_err("unreviewed retry safety must require reconciliation")
            .machine_code(),
        "ENGINE_RESULT_UNCERTAIN"
    );
    let response = recovered
        .execute("research.execute", execute_request("killed-manager"))
        .await?;
    let cancellation = unsafe_replay
        .cancel(
            "mock-engine",
            CancelRequest {
                metadata: Some(valid_metadata("cross-manager-cancel")),
                execution_id: response.execution_id.clone(),
                reason: "reconciled-by-runtime".to_owned(),
            },
        )
        .await?;
    assert!(cancellation.cancelled);
    assert_eq!(
        response.execution_id,
        "run-killed-manager:idem-killed-manager"
    );
    let state: serde_json::Value =
        serde_json::from_slice(&std::fs::read(state_dir.join("state.json"))?)?;
    assert_eq!(
        state["pending"].as_object().map(|entries| entries.len()),
        Some(0)
    );
    assert_eq!(
        state["completed"].as_object().map(|entries| entries.len()),
        Some(1)
    );
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
        sleep(Duration::from_millis(1_100)).await;
        manager
            .execute("research.execute", execute_request("rate-window-restored"))
            .await?;
        Ok::<(), anyhow::Error>(())
    }
    .await;
    shutdown_child(child, &socket_path).await;
    result
}
