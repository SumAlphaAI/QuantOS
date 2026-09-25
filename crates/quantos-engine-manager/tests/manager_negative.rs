use std::{collections::BTreeSet, path::PathBuf, time::Duration};

use chrono::Utc;
use quantos_engine_manager::{
    BackoffPolicy, EngineApproval, EngineCapabilityManifest, EngineDispatchContext, EngineManager,
    EngineManagerError, EngineManifest, EngineQuota, EngineRoutingPolicy, EngineTransport,
    ManifestReviewError, SidecarSpec, build_metadata, review_manifest,
};
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::{ActorRef, JsonDocument},
    engine::v1::{
        CancelRequest, ExecuteRequest, GetMetadataRequest, HealthRequest, StreamExecuteRequest,
    },
};
use sha2::{Digest, Sha256};

const KEY: &[u8] = b"f08-negative-fixture-approval-key";

fn manifest() -> EngineManifest {
    EngineManifest {
        engine_name: "fixture-engine".to_owned(),
        engine_version: "1.0.0".to_owned(),
        supported_schema_versions: vec!["v1".to_owned()],
        capabilities: vec![EngineCapabilityManifest {
            name: "research.execute".to_owned(),
            version: "1.0.0".to_owned(),
            description: "Fixture".to_owned(),
        }],
        transport: EngineTransport::Uds {
            socket_path: PathBuf::from("/tmp/f08-negative.sock"),
        },
        quota: EngineQuota {
            max_concurrency: 1,
            max_rss_mb: 128,
        },
    }
}

fn request() -> ExecuteRequest {
    let mut metadata = build_metadata("negative");
    metadata.actor = Some(ActorRef {
        actor_id: "actor".to_owned(),
        actor_kind: 1,
        display_name: String::new(),
        capabilities: vec!["research.execute".to_owned()],
    });
    let deadline = Utc::now() + chrono::Duration::from_std(Duration::from_secs(5)).unwrap();
    ExecuteRequest {
        metadata: Some(metadata),
        workflow_run_id: "run-negative".to_owned(),
        idempotency_key: "key-negative".to_owned(),
        capability: "research.execute".to_owned(),
        input_schema_version: "v1".to_owned(),
        data_snapshot_ref: "snapshot".to_owned(),
        policy_context_ref: "policy".to_owned(),
        input: Some(JsonDocument::default()),
        deadline: Some(Timestamp {
            seconds: deadline.timestamp(),
            nanos: deadline.timestamp_subsec_nanos() as i32,
        }),
    }
}

#[test]
fn manifest_rejects_each_invalid_boundary() {
    type InvalidManifestCase = (Box<dyn Fn(&mut EngineManifest)>, &'static str);
    let cases: Vec<InvalidManifestCase> = vec![
        (
            Box::new(|m| m.engine_name = "bad name".to_owned()),
            "ENGINE_MANIFEST_INVALID_NAME",
        ),
        (
            Box::new(|m| m.engine_version = "one".to_owned()),
            "ENGINE_MANIFEST_INVALID_VERSION",
        ),
        (
            Box::new(|m| m.capabilities.clear()),
            "ENGINE_MANIFEST_EMPTY_CAPABILITIES",
        ),
        (
            Box::new(|m| m.supported_schema_versions.clear()),
            "ENGINE_MANIFEST_EMPTY_SCHEMAS",
        ),
        (
            Box::new(|m| m.quota.max_concurrency = 0),
            "ENGINE_MANIFEST_INVALID_QUOTA",
        ),
        (
            Box::new(|m| m.capabilities[0].version = "one".to_owned()),
            "ENGINE_MANIFEST_INVALID_CAPABILITY_VERSION",
        ),
        (
            Box::new(|m| {
                m.transport = EngineTransport::Uds {
                    socket_path: PathBuf::from("relative.sock"),
                }
            }),
            "ENGINE_MANIFEST_INVALID_SOCKET",
        ),
    ];
    for (change, code) in cases {
        let mut invalid = manifest();
        change(&mut invalid);
        let error: EngineManagerError = review_manifest(&invalid).expect_err(code).into();
        assert_eq!(error.machine_code(), code);
    }
}

#[test]
fn machine_codes_are_stable_for_all_manager_failures() {
    let errors = vec![
        (
            EngineManagerError::Review(ManifestReviewError::Unapproved),
            "ENGINE_MANIFEST_UNAPPROVED",
        ),
        (
            EngineManagerError::Review(ManifestReviewError::DuplicateCapability("x".to_owned())),
            "ENGINE_MANIFEST_DUPLICATE_CAPABILITY",
        ),
        (
            EngineManagerError::EngineNotFound("x".to_owned()),
            "ENGINE_NOT_FOUND",
        ),
        (
            EngineManagerError::CapabilityNotRouted("x".to_owned()),
            "ENGINE_CAPABILITY_NOT_ROUTED",
        ),
        (
            EngineManagerError::DeadlineExceeded,
            "ENGINE_DEADLINE_EXCEEDED",
        ),
        (
            EngineManagerError::Transport("x".to_owned()),
            "ENGINE_TRANSPORT",
        ),
        (EngineManagerError::Rpc("x".to_owned()), "ENGINE_RPC"),
        (
            EngineManagerError::IdentityMismatch,
            "ENGINE_IDENTITY_MISMATCH",
        ),
        (
            EngineManagerError::ArtifactMismatch,
            "ENGINE_ARTIFACT_MISMATCH",
        ),
        (
            EngineManagerError::InvalidRequest("x"),
            "ENGINE_INVALID_REQUEST",
        ),
        (
            EngineManagerError::IdempotencyConflict,
            "ENGINE_IDEMPOTENCY_CONFLICT",
        ),
        (EngineManagerError::RouteDenied, "ENGINE_ROUTE_DENIED"),
        (EngineManagerError::RateLimited, "ENGINE_RATE_LIMITED"),
        (
            EngineManagerError::CapabilityConflict,
            "ENGINE_CAPABILITY_CONFLICT",
        ),
        (EngineManagerError::NotReady, "ENGINE_NOT_READY"),
        (EngineManagerError::CircuitOpen, "ENGINE_CIRCUIT_OPEN"),
        (EngineManagerError::ActiveEngine, "ENGINE_ACTIVE"),
        (
            EngineManagerError::CancellationDenied,
            "ENGINE_CANCEL_DENIED",
        ),
        (
            EngineManagerError::StreamIncomplete,
            "ENGINE_STREAM_INCOMPLETE",
        ),
        (EngineManagerError::CpuQuota, "ENGINE_CPU_QUOTA"),
        (
            EngineManagerError::SupervisionRequired,
            "ENGINE_SUPERVISION_REQUIRED",
        ),
        (
            EngineManagerError::DurableStateRequired,
            "ENGINE_DURABLE_STATE_REQUIRED",
        ),
        (EngineManagerError::DurableBusy, "ENGINE_DURABLE_BUSY"),
        (
            EngineManagerError::ResultUncertain,
            "ENGINE_RESULT_UNCERTAIN",
        ),
        (
            EngineManagerError::ConcurrencyQuota("x".to_owned()),
            "ENGINE_CONCURRENCY_QUOTA",
        ),
        (
            EngineManagerError::RssQuota {
                engine_name: "x".to_owned(),
                reported_mb: 2,
                limit_mb: 1,
            },
            "ENGINE_RSS_QUOTA",
        ),
    ];
    for (error, code) in errors {
        assert_eq!(error.machine_code(), code);
        assert!(error.to_string().contains(code));
    }
}

#[tokio::test]
async fn invalid_request_and_signed_route_dimensions_fail_before_network() {
    let manifest = manifest();
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.allowed_tenants = BTreeSet::from(["tenant-primary".to_owned()]);
    policy.allowed_regions = BTreeSet::from(["cn-east".to_owned()]);
    policy.max_classification = 2;
    policy.max_cost_units = 10;
    policy.gpu_available = false;
    let approval =
        EngineApproval::sign_with_policy(&manifest, &"a".repeat(64), "reviewer", policy, KEY)
            .unwrap();
    let mut manager = EngineManager::with_approval_key(BackoffPolicy::default(), KEY.to_vec());
    manager
        .register_approved_engine(manifest, &approval)
        .unwrap();
    let context = EngineDispatchContext {
        region: "cn-east".to_owned(),
        classification: 2,
        estimated_cost_units: 10,
        requires_gpu: false,
    };
    let mut invalid = request();
    invalid.metadata = None;
    assert_eq!(
        manager
            .execute_with_context("research.execute", invalid, context.clone())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    let mut invalid = request();
    invalid.metadata.as_mut().unwrap().actor = None;
    assert_eq!(
        manager
            .execute_with_context("research.execute", invalid, context.clone())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    let mut invalid = request();
    invalid.capability = "wrong".to_owned();
    assert_eq!(
        manager
            .execute_with_context("research.execute", invalid, context.clone())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    let mut invalid = request();
    invalid.input_schema_version = "v2".to_owned();
    assert_eq!(
        manager
            .execute_with_context("research.execute", invalid, context.clone())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    let mut invalid = request();
    invalid.input = None;
    assert_eq!(
        manager
            .execute_with_context("research.execute", invalid, context.clone())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );

    let mut contexts = Vec::new();
    let mut denied = context.clone();
    denied.region = "other".to_owned();
    contexts.push(denied);
    let mut denied = context.clone();
    denied.classification = 3;
    contexts.push(denied);
    let mut denied = context.clone();
    denied.estimated_cost_units = 11;
    contexts.push(denied);
    let mut denied = context.clone();
    denied.requires_gpu = true;
    contexts.push(denied);
    for denied in contexts {
        assert_eq!(
            manager
                .execute_with_context("research.execute", request(), denied)
                .await
                .unwrap_err()
                .machine_code(),
            "ENGINE_ROUTE_DENIED"
        );
    }
    let mut wrong_tenant = request();
    wrong_tenant.metadata.as_mut().unwrap().tenant_id = "tenant-other".to_owned();
    assert_eq!(
        manager
            .execute_with_context("research.execute", wrong_tenant, context)
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_ROUTE_DENIED"
    );
}

#[test]
fn supervised_release_requires_durable_state_and_exact_artifact() {
    let directory = tempfile::tempdir().unwrap();
    let artifact = directory.path().join("engine.whl");
    std::fs::write(&artifact, b"approved artifact").unwrap();
    let digest: String = Sha256::digest(std::fs::read(&artifact).unwrap())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let manifest = manifest();
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.requires_supervision = true;
    let approval =
        EngineApproval::sign_with_policy(&manifest, &digest, "reviewer", policy, KEY).unwrap();
    let spec = SidecarSpec {
        executable: PathBuf::from("/bin/echo"),
        artifact_path: artifact.clone(),
        args: Vec::new(),
    };
    let mut in_memory = EngineManager::with_approval_key(BackoffPolicy::default(), KEY.to_vec());
    assert_eq!(
        in_memory
            .register_supervised_engine(manifest.clone(), &approval, spec.clone())
            .unwrap_err()
            .machine_code(),
        "ENGINE_DURABLE_STATE_REQUIRED"
    );
    let mut durable = EngineManager::with_durable_state(
        BackoffPolicy::default(),
        KEY.to_vec(),
        directory.path().join("state"),
    )
    .unwrap();
    std::fs::write(&artifact, b"modified artifact").unwrap();
    assert_eq!(
        durable
            .register_supervised_engine(manifest.clone(), &approval, spec.clone())
            .unwrap_err()
            .machine_code(),
        "ENGINE_ARTIFACT_MISMATCH"
    );
    std::fs::write(&artifact, b"approved artifact").unwrap();
    durable
        .register_supervised_engine(manifest, &approval, spec)
        .unwrap();
}

#[test]
fn malformed_approvals_never_register() {
    let manifest = manifest();
    let approval =
        EngineApproval::sign_for_local_fixture(&manifest, &"a".repeat(64), "reviewer", KEY)
            .unwrap();
    let mut cases = Vec::new();
    let mut invalid = approval.clone();
    invalid.reviewer.clear();
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.artifact_sha256 = "bad".to_owned();
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.signature_hex = "not-hex".to_owned();
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.routing_policy.allowed_tenants.clear();
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.routing_policy.allowed_regions.clear();
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.routing_policy.max_requests_per_second = 0;
    cases.push(invalid);
    let mut invalid = approval.clone();
    invalid.routing_policy.max_cpu_percent = 0;
    cases.push(invalid);
    for invalid in cases {
        let mut manager = EngineManager::with_approval_key(BackoffPolicy::default(), KEY.to_vec());
        assert_eq!(
            manager
                .register_approved_engine(manifest.clone(), &invalid)
                .unwrap_err()
                .machine_code(),
            "ENGINE_MANIFEST_UNAPPROVED"
        );
    }
}

#[tokio::test]
async fn malformed_rpc_inputs_fail_before_transport() {
    let manifest = manifest();
    let approval =
        EngineApproval::sign_for_local_fixture(&manifest, &"a".repeat(64), "reviewer", KEY)
            .unwrap();
    let mut manager = EngineManager::with_approval_key(BackoffPolicy::default(), KEY.to_vec());
    assert_eq!(
        manager
            .register_engine(manifest.clone())
            .unwrap_err()
            .machine_code(),
        "ENGINE_MANIFEST_UNAPPROVED"
    );
    manager
        .register_approved_engine(manifest, &approval)
        .unwrap();
    type InvalidRequestCase = Box<dyn Fn(&mut ExecuteRequest)>;
    let mut changes: Vec<InvalidRequestCase> = Vec::new();
    changes.push(Box::new(|r| {
        r.metadata.as_mut().unwrap().request_id.clear()
    }));
    changes.push(Box::new(|r| {
        r.metadata.as_mut().unwrap().workspace_id.clear()
    }));
    changes.push(Box::new(|r| {
        r.metadata.as_mut().unwrap().correlation_id.clear()
    }));
    changes.push(Box::new(|r| {
        r.metadata.as_mut().unwrap().causation_id.clear()
    }));
    changes.push(Box::new(|r| r.metadata.as_mut().unwrap().issued_at = None));
    changes.push(Box::new(|r| r.metadata.as_mut().unwrap().mode = 0));
    changes.push(Box::new(|r| r.metadata.as_mut().unwrap().environment = 0));
    changes.push(Box::new(|r| {
        r.metadata
            .as_mut()
            .unwrap()
            .actor
            .as_mut()
            .unwrap()
            .actor_id
            .clear()
    }));
    changes.push(Box::new(|r| {
        r.metadata
            .as_mut()
            .unwrap()
            .actor
            .as_mut()
            .unwrap()
            .actor_kind = 0
    }));
    changes.push(Box::new(|r| r.workflow_run_id.clear()));
    changes.push(Box::new(|r| r.idempotency_key.clear()));
    changes.push(Box::new(|r| r.data_snapshot_ref.clear()));
    changes.push(Box::new(|r| r.policy_context_ref.clear()));
    for change in changes {
        let mut invalid = request();
        change(&mut invalid);
        assert_eq!(
            manager
                .execute("research.execute", invalid)
                .await
                .unwrap_err()
                .machine_code(),
            "ENGINE_INVALID_REQUEST"
        );
    }
    assert_eq!(
        manager
            .stream_execute_collect("research.execute", StreamExecuteRequest::default())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    assert_eq!(
        manager
            .cancel("fixture-engine", CancelRequest::default())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_INVALID_REQUEST"
    );
    assert_eq!(
        manager
            .cancel(
                "fixture-engine",
                CancelRequest {
                    metadata: Some(build_metadata("cancel")),
                    execution_id: "other".to_owned(),
                    reason: String::new()
                }
            )
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_CANCEL_DENIED"
    );
    assert_eq!(
        manager
            .get_metadata("missing", GetMetadataRequest::default())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_NOT_FOUND"
    );
    assert_eq!(
        manager
            .health("missing", HealthRequest::default())
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_NOT_FOUND"
    );
    assert_eq!(
        manager
            .report_rss_mb("missing", 1)
            .unwrap_err()
            .machine_code(),
        "ENGINE_NOT_FOUND"
    );
    assert_eq!(
        manager
            .stop_supervised_engine("missing")
            .await
            .unwrap_err()
            .machine_code(),
        "ENGINE_NOT_FOUND"
    );
}
