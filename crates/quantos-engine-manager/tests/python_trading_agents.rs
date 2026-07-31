use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use chrono::Utc;
use pbjson_types::{ListValue, Struct, Value, value::Kind};
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
    PathBuf::from("/tmp").join(format!("quantos-trading-agents-{}.sock", Uuid::now_v7()))
}

fn manifest_for_socket(socket_path: PathBuf) -> EngineManifest {
    EngineManifest {
        engine_name: "trading-agents".to_owned(),
        engine_version: "0.1.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "decision.proposal.v1".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Generate deterministic non-executable TradeProposals.".to_owned(),
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
        metadata: Some(build_actor_metadata(request_id, &["decision.proposal.v1"])),
        workflow_run_id: format!("run-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        capability: "decision.proposal.v1".to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: format!("portfolio-snapshot-{request_id}"),
        policy_context_ref: format!("policy-{request_id}"),
        input: Some(input),
        deadline: Some(timestamp_after(Duration::from_secs(5))),
    }
}

struct ProposalInputSpec<'a> {
    fixture: &'a str,
    account_id: &'a str,
    policy_snapshot_id: &'a str,
    portfolio_snapshot_id: &'a str,
    signal_request_id: &'a str,
    symbol: &'a str,
    strategy_release_id: &'a str,
    direction: &'a str,
}

fn proposal_input(spec: ProposalInputSpec<'_>) -> JsonDocument {
    json_document_from_struct(struct_value([
        ("fixture", string_value(spec.fixture)),
        ("account_id", string_value(spec.account_id)),
        ("policy_snapshot_id", string_value(spec.policy_snapshot_id)),
        ("portfolio_snapshot_id", string_value(spec.portfolio_snapshot_id)),
        (
            "signal",
            struct_value([
                (
                    "metadata",
                    struct_value([
                        ("request_id", string_value(spec.signal_request_id)),
                        ("tenant_id", string_value("tenant-primary")),
                        ("workspace_id", string_value("workspace-primary")),
                        (
                            "actor",
                            struct_value([
                                ("actor_id", string_value("signal-actor")),
                                ("actor_kind", string_value("ACTOR_KIND_USER")),
                                ("display_name", string_value("QuantOS Signal Engine")),
                                (
                                    "capabilities",
                                    list_value(vec![string_value("quant.signal.v1")]),
                                ),
                            ]),
                        ),
                        ("correlation_id", string_value("corr-signal")),
                        ("causation_id", string_value("cause-signal")),
                        ("mode", string_value("RUNTIME_MODE_RESEARCH")),
                        ("environment", string_value("ENVIRONMENT_TEST")),
                        ("issued_at", string_value("2026-01-01T00:00:00Z")),
                    ]),
                ),
                (
                    "signal_id",
                    string_value(&format!("signal:{}", spec.signal_request_id)),
                ),
                ("strategy_release_id", string_value(spec.strategy_release_id)),
                ("symbol", string_value(spec.symbol)),
                ("direction", string_value(spec.direction)),
                ("strength", struct_value([("value", string_value("0.82"))])),
                (
                    "confidence",
                    struct_value([("value", string_value("0.77"))]),
                ),
                (
                    "diagnostics",
                    struct_value([(
                        "value",
                        struct_value([
                            ("strategy_version", string_value("strategy.trend.v3")),
                            ("model_version", string_value("llmquant-factor-2026.07.31")),
                            (
                                "model_digest",
                                string_value("sha256:llmquant-model-trend-long"),
                            ),
                            (
                                "data_version",
                                string_value("feature-snapshot-2026-07-31-a"),
                            ),
                        ]),
                    )]),
                ),
                ("generated_at", string_value("2026-01-01T00:05:00Z")),
                ("valid_until", string_value("2026-01-01T00:45:00Z")),
                (
                    "evidence_refs",
                    list_value(vec![struct_value([
                        ("evidence_id", string_value("signal-evidence:1")),
                        ("artifact_id", string_value("signal-artifact:1")),
                        ("summary", string_value("signal:trend-breakout")),
                    ])]),
                ),
            ]),
        ),
    ]))
}

fn struct_value<const N: usize>(fields: [(&str, Value); N]) -> Value {
    let mut mapping = HashMap::new();
    for (key, value) in fields {
        mapping.insert(key.to_owned(), value);
    }
    Value {
        kind: Some(Kind::StructValue(Struct { fields: mapping })),
    }
}

fn list_value(values: Vec<Value>) -> Value {
    Value {
        kind: Some(Kind::ListValue(ListValue { values })),
    }
}

fn string_value(value: &str) -> Value {
    Value {
        kind: Some(Kind::StringValue(value.to_owned())),
    }
}

fn json_document_from_struct(root: Value) -> JsonDocument {
    let Kind::StructValue(value) = root.kind.expect("root struct") else {
        panic!("root must be a struct");
    };
    JsonDocument { value: Some(value) }
}

fn timestamp_after(duration: Duration) -> Timestamp {
    let target = Utc::now() + chrono::Duration::from_std(duration).expect("duration converts");
    Timestamp {
        seconds: target.timestamp(),
        nanos: target.timestamp_subsec_nanos() as i32,
    }
}

async fn spawn_python_trading_agents(socket_path: &Path) -> anyhow::Result<Child> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("--directory")
        .arg(engines_dir())
        .arg("--package")
        .arg("quantos-trading-agents")
        .arg("python")
        .arg("-m")
        .arg("trading_agents.server")
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
        "trading-agents socket did not appear at {}",
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
async fn python_trading_agents_contracts_round_trip_over_uds() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_trading_agents(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

        let metadata = manager
            .get_metadata(
                "trading-agents",
                GetMetadataRequest {
                    metadata: Some(build_actor_metadata("contract", &["decision.proposal.v1"])),
                },
            )
            .await?;
        assert_eq!(metadata.engine_name, "trading-agents");
        assert_eq!(metadata.capabilities.len(), 1);

        let health = manager
            .health(
                "trading-agents",
                HealthRequest {
                    metadata: Some(build_actor_metadata("health", &["decision.proposal.v1"])),
                },
            )
            .await?;
        assert!(health.ready);

        let execute = manager
            .execute(
                "decision.proposal.v1",
                execute_request(
                    "exec",
                    proposal_input(ProposalInputSpec {
                        fixture: "committee_bull_breakout",
                        account_id: "paper-account-primary",
                        policy_snapshot_id: "policy-snapshot-btc-breakout",
                        portfolio_snapshot_id: "portfolio-snapshot-exec",
                        signal_request_id: "signal-exec",
                        symbol: "BTCUSDT",
                        strategy_release_id: "strategy.trend.v3.release.primary",
                        direction: "SIGNAL_DIRECTION_LONG",
                    }),
                ),
            )
            .await?;
        assert_eq!(execute.execution_id, "run-exec:idem-exec");
        assert_eq!(execute.artifact_refs.len(), 2);
        assert_eq!(execute.evidence_refs.len(), 3);

        let stream = manager
            .stream_execute_collect(
                "decision.proposal.v1",
                StreamExecuteRequest {
                    request: Some(execute_request(
                        "stream",
                        proposal_input(ProposalInputSpec {
                            fixture: "committee_reduce_overheat",
                            account_id: "paper-account-secondary",
                            policy_snapshot_id: "policy-snapshot-eth-reduce",
                            portfolio_snapshot_id: "portfolio-snapshot-stream",
                            signal_request_id: "signal-stream",
                            symbol: "ETHUSDT",
                            strategy_release_id: "strategy.reversion.v2.release.primary",
                            direction: "SIGNAL_DIRECTION_SHORT",
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
                "trading-agents",
                CancelRequest {
                    metadata: Some(build_actor_metadata("cancel", &["decision.proposal.v1"])),
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
async fn python_trading_agents_rejects_forbidden_boundary_fields() -> anyhow::Result<()> {
    let socket_path = short_socket_path();
    let child = spawn_python_trading_agents(&socket_path).await?;

    let result = async {
        let mut manager = EngineManager::new(BackoffPolicy::default());
        manager.register_engine(manifest_for_socket(socket_path.clone()))?;

        let mut root = proposal_input(ProposalInputSpec {
            fixture: "committee_bull_breakout",
            account_id: "paper-account-primary",
            policy_snapshot_id: "policy-snapshot-btc-breakout",
            portfolio_snapshot_id: "portfolio-snapshot-deny",
            signal_request_id: "signal-deny",
            symbol: "BTCUSDT",
            strategy_release_id: "strategy.trend.v3.release.primary",
            direction: "SIGNAL_DIRECTION_LONG",
        });
        root.value
            .as_mut()
            .expect("json document root")
            .fields
            .insert("network_access".to_owned(), string_value("true"));

        let error = manager
            .execute("decision.proposal.v1", execute_request("deny", root))
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
