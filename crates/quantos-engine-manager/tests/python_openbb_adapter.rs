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
    PathBuf::from("/tmp").join(format!("quantos-openbb-adapter-{}.sock", Uuid::now_v7()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "openbb-adapter".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "data.query.v1".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Generate deterministic lineage-rich data query responses.".to_owned(),
        }],
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

fn execute_request(request_id: &str, input: JsonDocument) -> ExecuteRequest {
    ExecuteRequest {
        metadata: Some(build_actor_metadata(request_id, &["data.query.v1"])),
        workflow_run_id: format!("run-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        capability: "data.query.v1".to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: format!("query-snapshot-{request_id}"),
        policy_context_ref: format!("policy-{request_id}"),
        input: Some(input),
        deadline: Some(timestamp_after(Duration::from_secs(5))),
    }
}

struct QueryInputSpec<'a> {
    provider: &'a str,
    fixture: &'a str,
    dataset: &'a str,
    schema_ref: &'a str,
    query_text: &'a str,
    symbols: &'a [&'a str],
    intended_use: &'a str,
    deployment_target: &'a str,
}

fn query_input(spec: QueryInputSpec<'_>) -> JsonDocument {
    let mut root = HashMap::new();
    root.insert("provider".to_owned(), string_value(spec.provider));
    root.insert("fixture".to_owned(), string_value(spec.fixture));
    root.insert("dataset".to_owned(), string_value(spec.dataset));
    root.insert("schema_ref".to_owned(), string_value(spec.schema_ref));
    root.insert("query_text".to_owned(), string_value(spec.query_text));
    root.insert("intended_use".to_owned(), string_value(spec.intended_use));
    root.insert(
        "deployment_target".to_owned(),
        string_value(spec.deployment_target),
    );
    root.insert(
        "symbols".to_owned(),
        list_value(
            spec.symbols
                .iter()
                .map(|value| string_value(value))
                .collect(),
        ),
    );
    JsonDocument {
        value: Some(Struct { fields: root }),
    }
}

fn list_value(values: Vec<Value>) -> Value {
    Value {
        kind: Some(Kind::ListValue(pbjson_types::ListValue { values })),
    }
}

fn string_value(value: &str) -> Value {
    Value {
        kind: Some(Kind::StringValue(value.to_owned())),
    }
}

fn timestamp_after(duration: Duration) -> Timestamp {
    let target = Utc::now() + chrono::Duration::from_std(duration).expect("duration converts");
    Timestamp {
        seconds: target.timestamp(),
        nanos: target.timestamp_subsec_nanos() as i32,
    }
}

async fn spawn_python_openbb_adapter(socket_path: &Path) -> anyhow::Result<Child> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-openbb-adapter")
        .arg("python")
        .arg("-m")
        .arg("openbb_adapter.server")
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
        "openbb-adapter socket did not appear at {}",
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
async fn python_openbb_adapter_contracts_round_trip_over_uds() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_openbb_adapter(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "openbb-adapter",
                GetMetadataRequest {
                    metadata: Some(build_actor_metadata("contract", &["data.query.v1"])),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "openbb-adapter");
        assert_eq!(metadata.capabilities.len(), 1);

        let health = manager
            .health(
                "openbb-adapter",
                HealthRequest {
                    metadata: Some(build_actor_metadata("health", &["data.query.v1"])),
                },
            )
            .await?;
        assert!(health.ready);

        let execute = manager
            .execute(
                "data.query.v1",
                execute_request(
                    "exec",
                    query_input(QueryInputSpec {
                        provider: "mock",
                        fixture: "crypto_market_btc",
                        dataset: "crypto.market.snapshot",
                        schema_ref: "schema.crypto.market.v1",
                        query_text: "btc market snapshot",
                        symbols: &["BTCUSDT"],
                        intended_use: "research",
                        deployment_target: "test",
                    }),
                ),
            )
            .await?;
        assert_eq!(execute.execution_id, "run-exec:idem-exec");
        assert_eq!(execute.artifact_refs.len(), 2);
        assert_eq!(execute.evidence_refs.len(), 2);

        let stream = manager
            .stream_execute_collect(
                "data.query.v1",
                StreamExecuteRequest {
                    request: Some(execute_request(
                        "stream",
                        query_input(QueryInputSpec {
                            provider: "openbb",
                            fixture: "macro_research_rates",
                            dataset: "macro.research.snapshot",
                            schema_ref: "schema.macro.rates.v1",
                            query_text: "macro rates snapshot",
                            symbols: &["US10Y", "DXY"],
                            intended_use: "evaluation",
                            deployment_target: "evaluation",
                        }),
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
                "openbb-adapter",
                CancelRequest {
                    metadata: Some(build_actor_metadata("cancel", &["data.query.v1"])),
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
async fn python_openbb_adapter_blocks_production_license_enablement() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_openbb_adapter(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        register_reviewed_engine(&mut manager, manifest_for_socket(socket_path.clone()))?;

        let error = manager
            .execute(
                "data.query.v1",
                execute_request(
                    "deny",
                    query_input(QueryInputSpec {
                        provider: "openbb",
                        fixture: "crypto_market_btc",
                        dataset: "crypto.market.snapshot",
                        schema_ref: "schema.crypto.market.v1",
                        query_text: "btc market snapshot",
                        symbols: &["BTCUSDT"],
                        intended_use: "evaluation",
                        deployment_target: "production",
                    }),
                ),
            )
            .await
            .expect_err("production enablement should be blocked");
        assert_eq!(error.machine_code(), "ENGINE_RPC");
        assert!(
            error
                .to_string()
                .contains("restricted to isolated evaluation")
        );
        Ok::<(), anyhow::Error>(())
    }
    .await;

    shutdown_child(child, &socket_path).await;
    result
}
