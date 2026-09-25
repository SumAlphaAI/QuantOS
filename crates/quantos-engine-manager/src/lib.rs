use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex as StdMutex},
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use hmac::{Hmac, Mac};
use hyper_util::rt::TokioIo;
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::{ActorRef, CommandMetadata},
    engine::v1::{
        CancelRequest, CancelResponse, Capability, ExecuteRequest, ExecuteResponse,
        GetMetadataRequest, GetMetadataResponse, HealthRequest, HealthResponse,
        StreamExecuteRequest, StreamExecuteResponse, engine_service_client::EngineServiceClient,
    },
};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::{
    net::UnixStream,
    process::{Child, Command},
    sync::{Mutex, OwnedSemaphorePermit, Semaphore},
};
use tonic::transport::{Channel, Endpoint};
use tower::service_fn;
use tracing::{info, warn};

mod durable;
use durable::{BeginRequest, DurableLedger};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineCapabilityManifest {
    pub name: String,
    pub version: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineQuota {
    pub max_concurrency: u32,
    pub max_rss_mb: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "transport", rename_all = "snake_case")]
pub enum EngineTransport {
    Uds { socket_path: PathBuf },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineManifest {
    pub engine_name: String,
    pub engine_version: String,
    pub supported_schema_versions: Vec<String>,
    pub capabilities: Vec<EngineCapabilityManifest>,
    pub transport: EngineTransport,
    pub quota: EngineQuota,
}

/// A reviewed release is bound to the exact manifest, including its endpoint,
/// and to an immutable engine artifact digest. The authority key is supplied by
/// the host, never by the engine or its manifest.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineApproval {
    pub manifest_sha256: String,
    pub artifact_sha256: String,
    pub reviewer: String,
    pub signature_hex: String,
    pub routing_policy: EngineRoutingPolicy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineRoutingPolicy {
    pub allowed_tenants: BTreeSet<String>,
    pub allowed_regions: BTreeSet<String>,
    pub max_classification: i32,
    pub max_cost_units: u64,
    pub gpu_available: bool,
    pub max_requests_per_second: u32,
    pub max_cpu_percent: u32,
    pub requires_supervision: bool,
    pub retry_safe: bool,
}

impl EngineRoutingPolicy {
    #[must_use]
    pub fn local_fixture() -> Self {
        Self {
            allowed_tenants: BTreeSet::from(["*".to_owned()]),
            allowed_regions: BTreeSet::from(["local".to_owned()]),
            max_classification: 4,
            max_cost_units: u64::MAX,
            gpu_available: true,
            max_requests_per_second: 1000,
            max_cpu_percent: 1000,
            requires_supervision: false,
            retry_safe: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EngineDispatchContext {
    pub region: String,
    pub classification: i32,
    pub estimated_cost_units: u64,
    pub requires_gpu: bool,
}

impl EngineDispatchContext {
    #[must_use]
    pub fn conservative_local() -> Self {
        Self {
            region: "local".to_owned(),
            classification: 4,
            estimated_cost_units: u64::MAX,
            requires_gpu: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SidecarSpec {
    pub executable: PathBuf,
    pub artifact_path: PathBuf,
    pub args: Vec<String>,
}

#[derive(Debug)]
struct SidecarProcess {
    spec: SidecarSpec,
    approved_artifact_sha256: String,
    child: Option<Child>,
}

impl EngineApproval {
    pub fn sign_for_local_fixture(
        manifest: &EngineManifest,
        artifact_sha256: &str,
        reviewer: &str,
        authority_key: &[u8],
    ) -> Result<Self, ManifestReviewError> {
        Self::sign_with_policy(
            manifest,
            artifact_sha256,
            reviewer,
            EngineRoutingPolicy::local_fixture(),
            authority_key,
        )
    }

    pub fn sign_with_policy(
        manifest: &EngineManifest,
        artifact_sha256: &str,
        reviewer: &str,
        routing_policy: EngineRoutingPolicy,
        authority_key: &[u8],
    ) -> Result<Self, ManifestReviewError> {
        let manifest_sha256 = manifest_digest(manifest)?;
        let mut approval = Self {
            manifest_sha256,
            artifact_sha256: artifact_sha256.to_owned(),
            reviewer: reviewer.to_owned(),
            signature_hex: String::new(),
            routing_policy,
        };
        approval.signature_hex = approval.expected_signature(authority_key)?;
        Ok(approval)
    }

    fn verify(
        &self,
        manifest: &EngineManifest,
        authority_key: &[u8],
    ) -> Result<(), ManifestReviewError> {
        if self.manifest_sha256 != manifest_digest(manifest)?
            || self.reviewer.trim().is_empty()
            || !is_sha256(&self.artifact_sha256)
            || self.routing_policy.allowed_tenants.is_empty()
            || self.routing_policy.allowed_regions.is_empty()
            || self.routing_policy.max_requests_per_second == 0
            || self.routing_policy.max_cpu_percent == 0
        {
            return Err(ManifestReviewError::Unapproved);
        }
        let signature = hex_decode(&self.signature_hex).ok_or(ManifestReviewError::Unapproved)?;
        let mut mac = Hmac::<Sha256>::new_from_slice(authority_key)
            .map_err(|_| ManifestReviewError::Unapproved)?;
        mac.update(self.signed_payload().as_bytes());
        mac.verify_slice(&signature)
            .map_err(|_| ManifestReviewError::Unapproved)
    }

    fn expected_signature(&self, key: &[u8]) -> Result<String, ManifestReviewError> {
        let mut mac =
            Hmac::<Sha256>::new_from_slice(key).map_err(|_| ManifestReviewError::Unapproved)?;
        mac.update(self.signed_payload().as_bytes());
        Ok(hex_encode(&mac.finalize().into_bytes()))
    }

    fn signed_payload(&self) -> String {
        format!(
            "quantos-engine-approval/v1\n{}\n{}\n{}\n{}",
            self.manifest_sha256,
            self.artifact_sha256,
            self.reviewer,
            serde_json::to_string(&self.routing_policy).unwrap_or_default(),
        )
    }
}

fn manifest_digest(manifest: &EngineManifest) -> Result<String, ManifestReviewError> {
    let bytes = serde_json::to_vec(manifest).map_err(|_| ManifestReviewError::Unapproved)?;
    Ok(hex_encode(&Sha256::digest(bytes)))
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.as_bytes().iter().all(u8::is_ascii_hexdigit)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn hex_decode(value: &str) -> Option<Vec<u8>> {
    if !value.len().is_multiple_of(2) {
        return None;
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|part| {
            let text = std::str::from_utf8(part).ok()?;
            u8::from_str_radix(text, 16).ok()
        })
        .collect()
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ManifestReviewError {
    #[error("ENGINE_MANIFEST_UNAPPROVED: approval signature or artifact digest is invalid")]
    Unapproved,
    #[error("ENGINE_MANIFEST_INVALID_NAME: engine name must be non-empty and ASCII-safe")]
    InvalidEngineName,
    #[error("ENGINE_MANIFEST_INVALID_VERSION: engine version `{0}` is not valid semver")]
    InvalidVersion(String),
    #[error("ENGINE_MANIFEST_EMPTY_CAPABILITIES: manifest must declare at least one capability")]
    EmptyCapabilities,
    #[error("ENGINE_MANIFEST_DUPLICATE_CAPABILITY: capability `{0}` is declared more than once")]
    DuplicateCapability(String),
    #[error(
        "ENGINE_MANIFEST_INVALID_CAPABILITY_VERSION: capability `{0}` has invalid version `{1}`"
    )]
    InvalidCapabilityVersion(String, String),
    #[error(
        "ENGINE_MANIFEST_EMPTY_SCHEMAS: manifest must declare at least one supported schema version"
    )]
    EmptySupportedSchemas,
    #[error("ENGINE_MANIFEST_INVALID_SOCKET: UDS socket path must be absolute")]
    InvalidSocketPath,
    #[error("ENGINE_MANIFEST_INVALID_QUOTA: quota values must be positive")]
    InvalidQuota,
}

#[derive(Debug, Error)]
pub enum EngineManagerError {
    #[error(transparent)]
    Review(#[from] ManifestReviewError),
    #[error("ENGINE_NOT_FOUND: engine `{0}` is not registered")]
    EngineNotFound(String),
    #[error("ENGINE_CAPABILITY_NOT_ROUTED: capability `{0}` is not registered")]
    CapabilityNotRouted(String),
    #[error("ENGINE_DEADLINE_EXCEEDED: request deadline expired before engine returned a result")]
    DeadlineExceeded,
    #[error("ENGINE_TRANSPORT: {0}")]
    Transport(String),
    #[error("ENGINE_RPC: {0}")]
    Rpc(String),
    #[error("ENGINE_IDENTITY_MISMATCH: endpoint metadata does not match approved manifest")]
    IdentityMismatch,
    #[error("ENGINE_ARTIFACT_MISMATCH: sidecar executable digest differs from approval")]
    ArtifactMismatch,
    #[error("ENGINE_INVALID_REQUEST: {0}")]
    InvalidRequest(&'static str),
    #[error("ENGINE_IDEMPOTENCY_CONFLICT: key is already bound to a different request")]
    IdempotencyConflict,
    #[error("ENGINE_ROUTE_DENIED: signed route policy rejects this request")]
    RouteDenied,
    #[error("ENGINE_RATE_LIMITED: signed route rate is exhausted")]
    RateLimited,
    #[error("ENGINE_CAPABILITY_CONFLICT: capability already belongs to another engine")]
    CapabilityConflict,
    #[error("ENGINE_NOT_READY: engine health check rejected dispatch")]
    NotReady,
    #[error("ENGINE_CIRCUIT_OPEN: another half-open probe is in flight")]
    CircuitOpen,
    #[error("ENGINE_ACTIVE: stop the supervised engine before replacing its approved release")]
    ActiveEngine,
    #[error("ENGINE_CANCEL_DENIED: execution is not owned by this tenant and engine")]
    CancellationDenied,
    #[error("ENGINE_STREAM_INCOMPLETE: stream ended without a unique terminal event")]
    StreamIncomplete,
    #[error("ENGINE_CPU_QUOTA: supervised sidecar exceeds its signed CPU limit")]
    CpuQuota,
    #[error("ENGINE_SUPERVISION_REQUIRED: signed policy requires a managed sidecar")]
    SupervisionRequired,
    #[error("ENGINE_DURABLE_STATE_REQUIRED: supervised production sidecar requires durable state")]
    DurableStateRequired,
    #[error("ENGINE_DURABLE_BUSY: another Manager is executing this idempotency key")]
    DurableBusy,
    #[error("ENGINE_RESULT_UNCERTAIN: interrupted non-retry-safe request requires reconciliation")]
    ResultUncertain,
    #[error("ENGINE_CONCURRENCY_QUOTA: engine `{0}` has no execution slot available")]
    ConcurrencyQuota(String),
    #[error(
        "ENGINE_RSS_QUOTA: engine `{engine_name}` reports {reported_mb} MiB, limit is {limit_mb} MiB"
    )]
    RssQuota {
        engine_name: String,
        reported_mb: u32,
        limit_mb: u32,
    },
}

impl EngineManagerError {
    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        match self {
            Self::Review(error) => match error {
                ManifestReviewError::InvalidEngineName => "ENGINE_MANIFEST_INVALID_NAME",
                ManifestReviewError::Unapproved => "ENGINE_MANIFEST_UNAPPROVED",
                ManifestReviewError::InvalidVersion(_) => "ENGINE_MANIFEST_INVALID_VERSION",
                ManifestReviewError::EmptyCapabilities => "ENGINE_MANIFEST_EMPTY_CAPABILITIES",
                ManifestReviewError::DuplicateCapability(_) => {
                    "ENGINE_MANIFEST_DUPLICATE_CAPABILITY"
                }
                ManifestReviewError::InvalidCapabilityVersion(_, _) => {
                    "ENGINE_MANIFEST_INVALID_CAPABILITY_VERSION"
                }
                ManifestReviewError::EmptySupportedSchemas => "ENGINE_MANIFEST_EMPTY_SCHEMAS",
                ManifestReviewError::InvalidSocketPath => "ENGINE_MANIFEST_INVALID_SOCKET",
                ManifestReviewError::InvalidQuota => "ENGINE_MANIFEST_INVALID_QUOTA",
            },
            Self::EngineNotFound(_) => "ENGINE_NOT_FOUND",
            Self::CapabilityNotRouted(_) => "ENGINE_CAPABILITY_NOT_ROUTED",
            Self::DeadlineExceeded => "ENGINE_DEADLINE_EXCEEDED",
            Self::Transport(_) => "ENGINE_TRANSPORT",
            Self::Rpc(_) => "ENGINE_RPC",
            Self::IdentityMismatch => "ENGINE_IDENTITY_MISMATCH",
            Self::ArtifactMismatch => "ENGINE_ARTIFACT_MISMATCH",
            Self::InvalidRequest(_) => "ENGINE_INVALID_REQUEST",
            Self::IdempotencyConflict => "ENGINE_IDEMPOTENCY_CONFLICT",
            Self::RouteDenied => "ENGINE_ROUTE_DENIED",
            Self::RateLimited => "ENGINE_RATE_LIMITED",
            Self::CapabilityConflict => "ENGINE_CAPABILITY_CONFLICT",
            Self::NotReady => "ENGINE_NOT_READY",
            Self::CircuitOpen => "ENGINE_CIRCUIT_OPEN",
            Self::ActiveEngine => "ENGINE_ACTIVE",
            Self::CancellationDenied => "ENGINE_CANCEL_DENIED",
            Self::StreamIncomplete => "ENGINE_STREAM_INCOMPLETE",
            Self::CpuQuota => "ENGINE_CPU_QUOTA",
            Self::SupervisionRequired => "ENGINE_SUPERVISION_REQUIRED",
            Self::DurableStateRequired => "ENGINE_DURABLE_STATE_REQUIRED",
            Self::DurableBusy => "ENGINE_DURABLE_BUSY",
            Self::ResultUncertain => "ENGINE_RESULT_UNCERTAIN",
            Self::ConcurrencyQuota(_) => "ENGINE_CONCURRENCY_QUOTA",
            Self::RssQuota { .. } => "ENGINE_RSS_QUOTA",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BackoffPolicy {
    pub crash_threshold: u32,
    pub base_backoff: Duration,
    pub max_backoff: Duration,
    pub max_dispatch_attempts: u32,
}

impl Default for BackoffPolicy {
    fn default() -> Self {
        Self {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_secs(2),
            max_dispatch_attempts: 8,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineCircuitState {
    pub consecutive_failures: u32,
    pub backoff_until: Option<DateTime<Utc>>,
    pub reported_rss_mb: u32,
    pub half_open_probe: bool,
    pub quarantined: bool,
    pub ready: bool,
}

impl EngineCircuitState {
    fn new() -> Self {
        Self {
            consecutive_failures: 0,
            backoff_until: None,
            reported_rss_mb: 0,
            half_open_probe: false,
            quarantined: false,
            ready: true,
        }
    }
}

#[derive(Clone)]
struct ManagedEngine {
    manifest: EngineManifest,
    routing_policy: EngineRoutingPolicy,
    state: Arc<StdMutex<EngineCircuitState>>,
    execution_slots: Arc<Semaphore>,
    sidecar: Option<Arc<Mutex<SidecarProcess>>>,
}

type CompletedSlot = Arc<Mutex<Option<(String, ExecuteResponse)>>>;
type CompletedMap = Arc<Mutex<BTreeMap<String, CompletedSlot>>>;
type RateWindows = Arc<Mutex<BTreeMap<(String, String), VecDeque<Instant>>>>;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct EngineManagerSnapshot {
    pub registered_engines: usize,
    pub supervised_engines: usize,
    pub open_circuits: usize,
    pub completed_idempotency_keys: usize,
    pub rate_windows: usize,
}

#[derive(Clone)]
pub struct EngineManager {
    policy: BackoffPolicy,
    approval_key: Option<Arc<[u8]>>,
    engines: BTreeMap<String, ManagedEngine>,
    capability_routes: BTreeMap<String, String>,
    completed: CompletedMap,
    rates: RateWindows,
    execution_owners: Arc<Mutex<BTreeMap<String, (String, String)>>>,
    durable: Option<Arc<DurableLedger>>,
}

impl std::fmt::Debug for EngineManager {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("EngineManager")
            .field("policy", &self.policy)
            .field("registered_engines", &self.engines.len())
            .field("durable_enabled", &self.durable.is_some())
            .finish_non_exhaustive()
    }
}

impl EngineManager {
    #[must_use]
    pub fn new(policy: BackoffPolicy) -> Self {
        Self {
            policy,
            approval_key: None,
            engines: BTreeMap::new(),
            capability_routes: BTreeMap::new(),
            completed: Arc::new(Mutex::new(BTreeMap::new())),
            rates: Arc::new(Mutex::new(BTreeMap::new())),
            execution_owners: Arc::new(Mutex::new(BTreeMap::new())),
            durable: None,
        }
    }

    #[must_use]
    pub fn with_approval_key(policy: BackoffPolicy, key: impl Into<Vec<u8>>) -> Self {
        let mut manager = Self::new(policy);
        manager.approval_key = Some(Arc::from(key.into()));
        manager
    }

    pub fn with_durable_state(
        policy: BackoffPolicy,
        key: impl Into<Vec<u8>>,
        state_directory: PathBuf,
    ) -> Result<Self, EngineManagerError> {
        let durable = Arc::new(DurableLedger::new(state_directory)?);
        let mut manager = Self::with_approval_key(policy, key);
        manager.execution_owners = Arc::new(Mutex::new(durable.completed_owners()?));
        manager.durable = Some(durable);
        Ok(manager)
    }

    /// Legacy registration is deliberately closed. Callers must supply a
    /// reviewed, signed approval through `register_approved_engine`.
    pub fn register_engine(&mut self, manifest: EngineManifest) -> Result<(), EngineManagerError> {
        let _ = manifest;
        Err(ManifestReviewError::Unapproved.into())
    }

    pub fn register_approved_engine(
        &mut self,
        manifest: EngineManifest,
        approval: &EngineApproval,
    ) -> Result<(), EngineManagerError> {
        self.register_reviewed(manifest, approval, false)
    }

    fn register_reviewed(
        &mut self,
        manifest: EngineManifest,
        approval: &EngineApproval,
        supervised: bool,
    ) -> Result<(), EngineManagerError> {
        review_manifest(&manifest)?;
        let key = self
            .approval_key
            .as_deref()
            .ok_or(ManifestReviewError::Unapproved)?;
        approval.verify(&manifest, key)?;
        if approval.routing_policy.requires_supervision && !supervised {
            return Err(EngineManagerError::SupervisionRequired);
        }
        if approval.routing_policy.requires_supervision && self.durable.is_none() {
            return Err(EngineManagerError::DurableStateRequired);
        }
        for capability in &manifest.capabilities {
            if let Some(owner) = self.capability_routes.get(&capability.name)
                && owner != &manifest.engine_name
            {
                return Err(EngineManagerError::CapabilityConflict);
            }
        }
        if let Some(previous) = self.engines.get(&manifest.engine_name) {
            if previous.sidecar.is_some() {
                return Err(EngineManagerError::ActiveEngine);
            }
            for capability in &previous.manifest.capabilities {
                self.capability_routes.remove(&capability.name);
            }
        }
        for capability in &manifest.capabilities {
            self.capability_routes
                .insert(capability.name.clone(), manifest.engine_name.clone());
        }
        let max_concurrency = manifest.quota.max_concurrency;
        let restored = if let Some(durable) = &self.durable {
            durable.circuit(&manifest.engine_name, &approval.manifest_sha256)?
        } else {
            None
        };
        self.engines.insert(
            manifest.engine_name.clone(),
            ManagedEngine {
                manifest,
                routing_policy: approval.routing_policy.clone(),
                state: Arc::new(StdMutex::new(
                    restored.unwrap_or_else(EngineCircuitState::new),
                )),
                execution_slots: Arc::new(Semaphore::new(max_concurrency as usize)),
                sidecar: None,
            },
        );
        info!(engine = %approval.manifest_sha256, reviewer = %approval.reviewer, "approved engine registered");
        Ok(())
    }

    pub fn register_supervised_engine(
        &mut self,
        manifest: EngineManifest,
        approval: &EngineApproval,
        spec: SidecarSpec,
    ) -> Result<(), EngineManagerError> {
        if !spec.executable.is_absolute()
            || !spec.executable.is_file()
            || !spec.artifact_path.is_absolute()
            || !spec.artifact_path.is_file()
        {
            return Err(EngineManagerError::ArtifactMismatch);
        }
        let artifact = fs::read(&spec.artifact_path)
            .map_err(|error| EngineManagerError::Transport(error.to_string()))?;
        if hex_encode(&Sha256::digest(artifact)) != approval.artifact_sha256 {
            return Err(EngineManagerError::ArtifactMismatch);
        }
        let engine_name = manifest.engine_name.clone();
        self.register_reviewed(manifest, approval, true)?;
        if let Some(managed) = self.engines.get_mut(&engine_name) {
            managed.sidecar = Some(Arc::new(Mutex::new(SidecarProcess {
                spec,
                approved_artifact_sha256: approval.artifact_sha256.clone(),
                child: None,
            })));
        }
        Ok(())
    }

    pub async fn stop_supervised_engine(
        &mut self,
        engine_name: &str,
    ) -> Result<(), EngineManagerError> {
        let sidecar = self
            .engines
            .get(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        if let Ok(mut state) = sidecar.state.lock() {
            state.quarantined = true;
        }
        self.persist_circuit(engine_name)?;
        if let Some(sidecar) = &sidecar.sidecar {
            let mut process = sidecar.lock().await;
            if let Some(mut child) = process.child.take() {
                let _ = child.kill().await;
                child
                    .wait()
                    .await
                    .map_err(|error| EngineManagerError::Transport(error.to_string()))?;
            }
        }
        if let Some(previous) = self.engines.remove(engine_name) {
            for capability in previous.manifest.capabilities {
                self.capability_routes.remove(&capability.name);
            }
        }
        info!(engine = engine_name, "engine stopped and deregistered");
        Ok(())
    }

    /// The caller owns the returned task and must abort it during shutdown.
    /// Every tick probes approved engines through the same identity and health
    /// path used by dispatch, so a stale or mismatched endpoint is not ready.
    pub fn start_health_monitor(&self, interval: Duration) -> tokio::task::JoinHandle<()> {
        let mut manager = self.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                let names: Vec<String> = manager.engines.keys().cloned().collect();
                for engine_name in names {
                    let _ = manager
                        .health(
                            &engine_name,
                            HealthRequest {
                                metadata: Some(service_metadata("manager-heartbeat")),
                            },
                        )
                        .await;
                    let _ = manager.refresh_supervised_rss(&engine_name).await;
                }
            }
        })
    }

    pub fn manifest(&self, engine_name: &str) -> Option<&EngineManifest> {
        self.engines
            .get(engine_name)
            .map(|managed| &managed.manifest)
    }

    pub async fn snapshot(&self) -> EngineManagerSnapshot {
        let completed_count = if let Some(durable) = &self.durable {
            durable.completed_count().unwrap_or_default()
        } else {
            self.completed.lock().await.len()
        };
        EngineManagerSnapshot {
            registered_engines: self.engines.len(),
            supervised_engines: self
                .engines
                .values()
                .filter(|engine| engine.sidecar.is_some())
                .count(),
            open_circuits: self
                .engines
                .values()
                .filter(|engine| {
                    engine.state.lock().is_ok_and(|state| {
                        state.backoff_until.is_some_and(|until| until > Utc::now())
                    })
                })
                .count(),
            completed_idempotency_keys: completed_count,
            rate_windows: self.rates.lock().await.len(),
        }
    }

    pub async fn completed_execution(
        &self,
        tenant_id: &str,
        capability: &str,
        idempotency_key: &str,
    ) -> Option<ExecuteResponse> {
        let key = format!("{tenant_id}\0{capability}\0{idempotency_key}");
        if let Some(slot) = self.completed.lock().await.get(&key).cloned()
            && let Some((_, response)) = &*slot.lock().await
        {
            return Some(response.clone());
        }
        self.durable.as_ref()?.completed(&key).ok().flatten()
    }

    pub fn circuit_state(&self, engine_name: &str) -> Option<EngineCircuitState> {
        self.engines
            .get(engine_name)
            .and_then(|managed| managed.state.lock().ok().map(|state| *state))
    }

    /// Updates the latest supervisor-observed resident set size. Dispatch is
    /// rejected while the reported value exceeds the manifest quota.
    pub fn report_rss_mb(
        &mut self,
        engine_name: &str,
        rss_mb: u32,
    ) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get_mut(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        managed
            .state
            .lock()
            .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?
            .reported_rss_mb = rss_mb;
        Ok(())
    }

    pub async fn get_metadata(
        &mut self,
        engine_name: &str,
        request: GetMetadataRequest,
    ) -> Result<GetMetadataResponse, EngineManagerError> {
        tokio::time::timeout(
            Duration::from_secs(2),
            self.get_metadata_inner(engine_name, request),
        )
        .await
        .map_err(|_| EngineManagerError::DeadlineExceeded)?
    }

    async fn get_metadata_inner(
        &mut self,
        engine_name: &str,
        request: GetMetadataRequest,
    ) -> Result<GetMetadataResponse, EngineManagerError> {
        self.await_backoff(engine_name).await?;
        let mut client = match self.client_for_engine(engine_name).await {
            Ok(client) => client,
            Err(error) => {
                self.record_failure(engine_name)?;
                return Err(error);
            }
        };
        let expected_metadata = request.metadata.clone();
        match client.get_metadata(request).await {
            Ok(response) => {
                let response = response.into_inner();
                if response.metadata != expected_metadata {
                    self.record_failure(engine_name)?;
                    return Err(EngineManagerError::IdentityMismatch);
                }
                self.mark_success(engine_name)?;
                Ok(response)
            }
            Err(status) => {
                self.record_status(engine_name, &status)?;
                Err(Self::status_to_error(status))
            }
        }
    }

    pub async fn health(
        &mut self,
        engine_name: &str,
        request: HealthRequest,
    ) -> Result<HealthResponse, EngineManagerError> {
        tokio::time::timeout(
            Duration::from_secs(2),
            self.health_inner(engine_name, request),
        )
        .await
        .map_err(|_| EngineManagerError::DeadlineExceeded)?
    }

    async fn health_inner(
        &mut self,
        engine_name: &str,
        request: HealthRequest,
    ) -> Result<HealthResponse, EngineManagerError> {
        self.await_backoff(engine_name).await?;
        let mut client = match self.client_for_engine(engine_name).await {
            Ok(client) => client,
            Err(error) => {
                self.record_failure(engine_name)?;
                return Err(error);
            }
        };
        let expected_metadata = request.metadata.clone();
        match client.health(request).await {
            Ok(response) => {
                let response = response.into_inner();
                if response.metadata != expected_metadata {
                    self.record_failure(engine_name)?;
                    return Err(EngineManagerError::IdentityMismatch);
                }
                if !response.ready {
                    self.record_failure(engine_name)?;
                    return Err(EngineManagerError::NotReady);
                }
                self.mark_success(engine_name)?;
                Ok(response)
            }
            Err(status) => {
                self.record_status(engine_name, &status)?;
                Err(Self::status_to_error(status))
            }
        }
    }

    pub async fn execute(
        &mut self,
        capability: &str,
        request: ExecuteRequest,
    ) -> Result<ExecuteResponse, EngineManagerError> {
        self.execute_with_context(
            capability,
            request,
            EngineDispatchContext::conservative_local(),
        )
        .await
    }

    pub async fn execute_with_context(
        &mut self,
        capability: &str,
        request: ExecuteRequest,
        context: EngineDispatchContext,
    ) -> Result<ExecuteResponse, EngineManagerError> {
        let deadline = request
            .deadline
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline_at = timestamp_to_datetime(&deadline)?;
        let engine_name = self.route_ready(capability, deadline_at).await?;
        self.validate_execution_request(&engine_name, capability, &request)?;
        self.enforce_route_policy(&engine_name, &request, &context)?;
        let remaining = remaining_time(deadline_at)?;
        let metadata = request
            .metadata
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("metadata"))?;
        let key = format!(
            "{}\0{}\0{}",
            metadata.tenant_id, capability, request.idempotency_key
        );
        let fingerprint = format!(
            "{}\0{}\0{}\0{}\0{}\0{}\0{}",
            request.workflow_run_id,
            request.capability,
            request.input_schema_version,
            request.data_snapshot_ref,
            request.policy_context_ref,
            metadata
                .actor
                .as_ref()
                .map_or("", |actor| actor.actor_id.as_str()),
            serde_json::to_string(&request.input).unwrap_or_default(),
        );
        let pending_execution_id =
            format!("{}:{}", request.workflow_run_id, request.idempotency_key);
        let durable = self.durable.clone();
        let retry_safe = self.engines[&engine_name].routing_policy.retry_safe;
        let slot = {
            let mut completed = self.completed.lock().await;
            completed
                .entry(key.clone())
                .or_insert_with(|| Arc::new(Mutex::new(None)))
                .clone()
        };
        let outcome = tokio::time::timeout(remaining, async {
            let mut entry = slot.lock().await;
            if let Some((recorded_fingerprint, response)) = &*entry {
                return if recorded_fingerprint == &fingerprint {
                    Ok(response.clone())
                } else {
                    Err(EngineManagerError::IdempotencyConflict)
                };
            }
            let _request_guard = if let Some(ledger) = &durable {
                match ledger.begin_request(&key, &fingerprint, retry_safe)? {
                    BeginRequest::Cached(response) => {
                        *entry = Some((fingerprint.clone(), (*response).clone()));
                        return Ok(*response);
                    }
                    BeginRequest::Dispatch(guard) => Some(guard),
                }
            } else {
                None
            };
            self.enforce_rate_limit(&engine_name, &request).await?;
            let tenant_id = request
                .metadata
                .as_ref()
                .map_or(String::new(), |value| value.tenant_id.clone());
            self.execution_owners.lock().await.insert(
                pending_execution_id.clone(),
                (tenant_id.clone(), engine_name.clone()),
            );
            let response = match self.execute_inner(capability, request).await {
                Ok(response) => response,
                Err(error) => {
                    self.execution_owners
                        .lock()
                        .await
                        .remove(&pending_execution_id);
                    return Err(error);
                }
            };
            if response.execution_id != pending_execution_id {
                self.execution_owners
                    .lock()
                    .await
                    .remove(&pending_execution_id);
            }
            if let Some(ledger) = &durable {
                ledger.complete_request(&key, &fingerprint, &tenant_id, &engine_name, &response)?;
            }
            self.execution_owners.lock().await.insert(
                response.execution_id.clone(),
                (tenant_id, engine_name.clone()),
            );
            *entry = Some((fingerprint, response.clone()));
            Ok(response)
        })
        .await;
        match outcome {
            Ok(result) => result,
            Err(_) => {
                self.execution_owners
                    .lock()
                    .await
                    .remove(&pending_execution_id);
                self.record_failure(&engine_name)?;
                Err(EngineManagerError::DeadlineExceeded)
            }
        }
    }

    async fn execute_inner(
        &mut self,
        capability: &str,
        request: ExecuteRequest,
    ) -> Result<ExecuteResponse, EngineManagerError> {
        let engine_name = self.route_engine_name(capability)?.to_owned();
        self.validate_execution_request(&engine_name, capability, &request)?;
        self.enforce_rss_quota(&engine_name)?;
        let _execution_permit = self.acquire_execution_slot(&engine_name)?;
        let deadline = request
            .deadline
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline_at = timestamp_to_datetime(&deadline)?;
        let mut attempts = 0_u32;

        loop {
            attempts += 1;
            self.await_backoff(&engine_name).await?;
            let mut client = match self.client_for_engine(&engine_name).await {
                Ok(client) => client,
                Err(error @ EngineManagerError::Transport(_)) => {
                    self.record_failure(&engine_name)?;
                    if attempts < self.policy.max_dispatch_attempts && deadline_at > Utc::now() {
                        tokio::time::sleep(self.policy.base_backoff).await;
                        continue;
                    }
                    return Err(error);
                }
                Err(error) => {
                    self.record_failure(&engine_name)?;
                    return Err(error);
                }
            };
            self.refresh_supervised_rss(&engine_name).await?;
            self.enforce_rss_quota(&engine_name)?;
            let timeout = remaining_time(deadline_at)?;

            match tokio::time::timeout(timeout, client.execute(request.clone())).await {
                Ok(Ok(response)) => {
                    let response = response.into_inner();
                    if response.metadata.as_ref() != request.metadata.as_ref()
                        || response.engine_version
                            != self.engines[&engine_name].manifest.engine_version
                        || !response.input_hash.starts_with("sha256:")
                        || response.execution_id.trim().is_empty()
                    {
                        self.record_failure(&engine_name)?;
                        return Err(EngineManagerError::IdentityMismatch);
                    }
                    self.mark_success(&engine_name)?;
                    return Ok(response);
                }
                Ok(Err(status)) => {
                    self.record_status(&engine_name, &status)?;
                    if should_retry_status(&status)
                        && self.engines[&engine_name].routing_policy.retry_safe
                        && attempts < self.policy.max_dispatch_attempts
                        && deadline_at > Utc::now()
                    {
                        continue;
                    }
                    return Err(Self::status_to_error(status));
                }
                Err(_) => {
                    self.record_failure(&engine_name)?;
                    return Err(EngineManagerError::DeadlineExceeded);
                }
            }
        }
    }

    pub async fn stream_execute_collect(
        &mut self,
        capability: &str,
        request: StreamExecuteRequest,
    ) -> Result<Vec<StreamExecuteResponse>, EngineManagerError> {
        self.stream_execute_with_context(
            capability,
            request,
            EngineDispatchContext::conservative_local(),
        )
        .await
    }

    pub async fn stream_execute_with_context(
        &mut self,
        capability: &str,
        request: StreamExecuteRequest,
        context: EngineDispatchContext,
    ) -> Result<Vec<StreamExecuteResponse>, EngineManagerError> {
        let inner = request
            .request
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("request"))?;
        let deadline = inner.deadline.ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline_at = timestamp_to_datetime(&deadline)?;
        let engine_name = self.route_ready(capability, deadline_at).await?;
        self.validate_execution_request(&engine_name, capability, inner)?;
        self.enforce_route_policy(&engine_name, inner, &context)?;
        self.enforce_rate_limit(&engine_name, inner).await?;
        let remaining = remaining_time(deadline_at)?;
        let pending_execution_id = format!("{}:{}", inner.workflow_run_id, inner.idempotency_key);
        let tenant_id = inner
            .metadata
            .as_ref()
            .map_or(String::new(), |value| value.tenant_id.clone());
        self.execution_owners.lock().await.insert(
            pending_execution_id.clone(),
            (tenant_id, engine_name.clone()),
        );
        let outcome =
            tokio::time::timeout(remaining, self.stream_execute_inner(capability, request)).await;
        match outcome {
            Ok(Ok(events)) => {
                if events
                    .last()
                    .is_some_and(|event| event.execution_id != pending_execution_id)
                {
                    self.execution_owners
                        .lock()
                        .await
                        .remove(&pending_execution_id);
                }
                Ok(events)
            }
            Ok(Err(error)) => {
                self.execution_owners
                    .lock()
                    .await
                    .remove(&pending_execution_id);
                Err(error)
            }
            Err(_) => {
                self.execution_owners
                    .lock()
                    .await
                    .remove(&pending_execution_id);
                self.record_failure(&engine_name)?;
                Err(EngineManagerError::DeadlineExceeded)
            }
        }
    }

    async fn stream_execute_inner(
        &mut self,
        capability: &str,
        request: StreamExecuteRequest,
    ) -> Result<Vec<StreamExecuteResponse>, EngineManagerError> {
        let engine_name = self.route_engine_name(capability)?.to_owned();
        let inner_request = request
            .request
            .clone()
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        self.validate_execution_request(&engine_name, capability, &inner_request)?;
        self.enforce_rss_quota(&engine_name)?;
        let _execution_permit = self.acquire_execution_slot(&engine_name)?;
        let deadline = inner_request
            .deadline
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline_at = timestamp_to_datetime(&deadline)?;
        self.await_backoff(&engine_name).await?;
        let mut client = self.client_for_engine(&engine_name).await?;
        self.refresh_supervised_rss(&engine_name).await?;
        self.enforce_rss_quota(&engine_name)?;
        let timeout = remaining_time(deadline_at)?;

        match tokio::time::timeout(timeout, client.stream_execute(request)).await {
            Ok(Ok(response)) => {
                let mut stream = response.into_inner();
                let mut events: Vec<StreamExecuteResponse> = Vec::new();
                while let Some(item) = stream.next().await {
                    match item {
                        Ok(message) => {
                            if message.metadata.as_ref() != inner_request.metadata.as_ref()
                                || message.execution_id.trim().is_empty()
                                || message.sequence_id.trim().is_empty()
                                || events.iter().any(|previous| {
                                    previous.sequence_id == message.sequence_id
                                        || previous.done
                                        || previous.execution_id != message.execution_id
                                })
                                || events.len() >= 10_000
                            {
                                self.record_failure(&engine_name)?;
                                return Err(EngineManagerError::StreamIncomplete);
                            }
                            self.execution_owners.lock().await.insert(
                                message.execution_id.clone(),
                                (
                                    inner_request
                                        .metadata
                                        .as_ref()
                                        .map_or(String::new(), |value| value.tenant_id.clone()),
                                    engine_name.clone(),
                                ),
                            );
                            events.push(message);
                        }
                        Err(status) => {
                            self.record_status(&engine_name, &status)?;
                            return Err(Self::status_to_error(status));
                        }
                    }
                }
                if !events.last().is_some_and(|event| event.done) {
                    self.record_failure(&engine_name)?;
                    return Err(EngineManagerError::StreamIncomplete);
                }
                self.mark_success(&engine_name)?;
                Ok(events)
            }
            Ok(Err(status)) => {
                self.record_status(&engine_name, &status)?;
                Err(Self::status_to_error(status))
            }
            Err(_) => {
                self.record_failure(&engine_name)?;
                Err(EngineManagerError::DeadlineExceeded)
            }
        }
    }

    pub async fn cancel(
        &mut self,
        engine_name: &str,
        request: CancelRequest,
    ) -> Result<CancelResponse, EngineManagerError> {
        let tenant_id = request
            .metadata
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("metadata"))?
            .tenant_id
            .clone();
        let mut owner = self
            .execution_owners
            .lock()
            .await
            .get(&request.execution_id)
            .cloned();
        if owner.is_none()
            && let Some(durable) = &self.durable
        {
            owner = durable.owner_for_execution(&request.execution_id)?;
        }
        if owner != Some((tenant_id, engine_name.to_owned())) {
            return Err(EngineManagerError::CancellationDenied);
        }
        tokio::time::timeout(
            Duration::from_secs(2),
            self.cancel_inner(engine_name, request),
        )
        .await
        .map_err(|_| EngineManagerError::DeadlineExceeded)?
    }

    async fn cancel_inner(
        &mut self,
        engine_name: &str,
        request: CancelRequest,
    ) -> Result<CancelResponse, EngineManagerError> {
        self.await_backoff(engine_name).await?;
        let mut client = self.client_for_engine(engine_name).await?;
        let expected_metadata = request.metadata.clone();
        let expected_execution_id = request.execution_id.clone();
        match client.cancel(request).await {
            Ok(response) => {
                let response = response.into_inner();
                if response.metadata != expected_metadata
                    || response.execution_id != expected_execution_id
                {
                    self.record_failure(engine_name)?;
                    return Err(EngineManagerError::IdentityMismatch);
                }
                self.mark_success(engine_name)?;
                Ok(response)
            }
            Err(status) => {
                self.record_status(engine_name, &status)?;
                Err(Self::status_to_error(status))
            }
        }
    }

    pub async fn cancel_capability(
        &mut self,
        capability: &str,
        request: CancelRequest,
    ) -> Result<CancelResponse, EngineManagerError> {
        let engine_name = self
            .capability_routes
            .get(capability)
            .ok_or_else(|| EngineManagerError::CapabilityNotRouted(capability.to_owned()))?
            .clone();
        self.cancel(&engine_name, request).await
    }

    async fn route_ready(
        &mut self,
        capability: &str,
        deadline_at: DateTime<Utc>,
    ) -> Result<String, EngineManagerError> {
        match self.route_engine_name(capability) {
            Ok(engine_name) => Ok(engine_name.to_owned()),
            Err(EngineManagerError::NotReady) => {
                let engine_name = self
                    .capability_routes
                    .get(capability)
                    .ok_or_else(|| EngineManagerError::CapabilityNotRouted(capability.to_owned()))?
                    .clone();
                if self
                    .circuit_state(&engine_name)
                    .is_some_and(|state| state.quarantined)
                {
                    return Err(EngineManagerError::NotReady);
                }
                let timeout = remaining_time(deadline_at)?;
                match tokio::time::timeout(
                    timeout,
                    self.health(
                        &engine_name,
                        HealthRequest {
                            metadata: Some(service_metadata("route-readiness-reprobe")),
                        },
                    ),
                )
                .await
                .map_err(|_| EngineManagerError::DeadlineExceeded)?
                {
                    Ok(_) => {}
                    Err(EngineManagerError::Transport(_)) => {
                        return Err(EngineManagerError::NotReady);
                    }
                    Err(error) => return Err(error),
                }
                Ok(self.route_engine_name(capability)?.to_owned())
            }
            Err(error) => Err(error),
        }
    }

    async fn client_for_engine(
        &self,
        engine_name: &str,
    ) -> Result<EngineServiceClient<Channel>, EngineManagerError> {
        let manifest = self
            .manifest(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        if let Some(sidecar) = &self.engines[engine_name].sidecar {
            let mut process = sidecar.lock().await;
            let exited = match process.child.as_mut() {
                Some(child) => child
                    .try_wait()
                    .map_err(|error| EngineManagerError::Transport(error.to_string()))?
                    .is_some(),
                None => true,
            };
            if exited {
                let artifact = fs::read(&process.spec.artifact_path)
                    .map_err(|error| EngineManagerError::Transport(error.to_string()))?;
                if hex_encode(&Sha256::digest(artifact)) != process.approved_artifact_sha256 {
                    return Err(EngineManagerError::ArtifactMismatch);
                }
                let mut command = Command::new(&process.spec.executable);
                command.args(&process.spec.args).kill_on_drop(true);
                process.child = Some(
                    command
                        .spawn()
                        .map_err(|error| EngineManagerError::Transport(error.to_string()))?,
                );
                info!(engine = engine_name, "supervised sidecar started");
            }
        }
        let mut client = connect_uds(manifest.socket_path()?)
            .await
            .map_err(|error| EngineManagerError::Transport(error.to_string()))?;
        let metadata = service_metadata("manager-handshake");
        let response = tokio::time::timeout(
            Duration::from_secs(2),
            client.get_metadata(GetMetadataRequest {
                metadata: Some(metadata.clone()),
            }),
        )
        .await
        .map_err(|_| EngineManagerError::DeadlineExceeded)?
        .map_err(Self::status_to_error)?
        .into_inner();
        let expected_capabilities: BTreeSet<_> = manifest
            .capabilities
            .iter()
            .map(|value| (&value.name, &value.version))
            .collect();
        let actual_capabilities: BTreeSet<_> = response
            .capabilities
            .iter()
            .map(|value| (&value.name, &value.version))
            .collect();
        if response.metadata != Some(metadata)
            || response.engine_name != manifest.engine_name
            || response.engine_version != manifest.engine_version
            || response.supported_schema_versions != manifest.supported_schema_versions
            || actual_capabilities != expected_capabilities
        {
            return Err(EngineManagerError::IdentityMismatch);
        }
        let health = tokio::time::timeout(
            Duration::from_secs(2),
            client.health(HealthRequest {
                metadata: Some(service_metadata("manager-readiness")),
            }),
        )
        .await
        .map_err(|_| EngineManagerError::DeadlineExceeded)?
        .map_err(Self::status_to_error)?
        .into_inner();
        if health.metadata != Some(service_metadata("manager-readiness")) || !health.ready {
            return Err(EngineManagerError::NotReady);
        }
        Ok(client)
    }

    fn route_engine_name(&self, capability: &str) -> Result<&str, EngineManagerError> {
        let engine_name = self
            .capability_routes
            .get(capability)
            .map(String::as_str)
            .ok_or_else(|| EngineManagerError::CapabilityNotRouted(capability.to_owned()))?;
        if self
            .circuit_state(engine_name)
            .is_some_and(|state| state.quarantined || !state.ready)
        {
            return Err(EngineManagerError::NotReady);
        }
        Ok(engine_name)
    }

    fn validate_execution_request(
        &self,
        engine_name: &str,
        capability: &str,
        request: &ExecuteRequest,
    ) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        let metadata = request
            .metadata
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("metadata"))?;
        let actor = metadata
            .actor
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("actor"))?;
        if metadata.request_id.trim().is_empty()
            || metadata.tenant_id.trim().is_empty()
            || metadata.workspace_id.trim().is_empty()
            || metadata.correlation_id.trim().is_empty()
            || metadata.causation_id.trim().is_empty()
            || metadata.issued_at.is_none()
            || metadata.mode == 0
            || metadata.environment == 0
            || actor.actor_id.trim().is_empty()
            || actor.actor_kind == 0
        {
            return Err(EngineManagerError::InvalidRequest("identity"));
        }
        if request.capability != capability
            || !managed
                .manifest
                .capabilities
                .iter()
                .any(|value| value.name == capability)
        {
            return Err(EngineManagerError::InvalidRequest("capability"));
        }
        if request.workflow_run_id.trim().is_empty()
            || request.idempotency_key.trim().is_empty()
            || request.data_snapshot_ref.trim().is_empty()
            || request.policy_context_ref.trim().is_empty()
            || request.input.is_none()
            || !managed
                .manifest
                .supported_schema_versions
                .contains(&request.input_schema_version)
        {
            return Err(EngineManagerError::InvalidRequest("execution contract"));
        }
        Ok(())
    }

    fn enforce_route_policy(
        &self,
        engine_name: &str,
        request: &ExecuteRequest,
        context: &EngineDispatchContext,
    ) -> Result<(), EngineManagerError> {
        let policy = &self.engines[engine_name].routing_policy;
        let tenant = &request
            .metadata
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("metadata"))?
            .tenant_id;
        if !(policy.allowed_tenants.contains(tenant) || policy.allowed_tenants.contains("*"))
            || !policy.allowed_regions.contains(&context.region)
            || context.classification > policy.max_classification
            || context.estimated_cost_units > policy.max_cost_units
            || (context.requires_gpu && !policy.gpu_available)
        {
            return Err(EngineManagerError::RouteDenied);
        }
        Ok(())
    }

    async fn enforce_rate_limit(
        &self,
        engine_name: &str,
        request: &ExecuteRequest,
    ) -> Result<(), EngineManagerError> {
        let tenant = request
            .metadata
            .as_ref()
            .ok_or(EngineManagerError::InvalidRequest("metadata"))?
            .tenant_id
            .clone();
        let limit = self.engines[engine_name]
            .routing_policy
            .max_requests_per_second as usize;
        let mut rates = self.rates.lock().await;
        let events = rates.entry((engine_name.to_owned(), tenant)).or_default();
        let now = Instant::now();
        while events
            .front()
            .is_some_and(|seen| now.duration_since(*seen) >= Duration::from_secs(1))
        {
            events.pop_front();
        }
        if events.len() >= limit {
            return Err(EngineManagerError::RateLimited);
        }
        events.push_back(now);
        Ok(())
    }

    fn acquire_execution_slot(
        &self,
        engine_name: &str,
    ) -> Result<OwnedSemaphorePermit, EngineManagerError> {
        let managed = self
            .engines
            .get(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        managed
            .execution_slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| EngineManagerError::ConcurrencyQuota(engine_name.to_owned()))
    }

    fn enforce_rss_quota(&self, engine_name: &str) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        let reported_rss_mb = managed
            .state
            .lock()
            .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?
            .reported_rss_mb;
        if reported_rss_mb > managed.manifest.quota.max_rss_mb {
            return Err(EngineManagerError::RssQuota {
                engine_name: engine_name.to_owned(),
                reported_mb: reported_rss_mb,
                limit_mb: managed.manifest.quota.max_rss_mb,
            });
        }
        Ok(())
    }

    async fn refresh_supervised_rss(
        &mut self,
        engine_name: &str,
    ) -> Result<(), EngineManagerError> {
        let Some(sidecar) = self
            .engines
            .get(engine_name)
            .and_then(|managed| managed.sidecar.as_ref().cloned())
        else {
            return Ok(());
        };
        let pid = {
            let process = sidecar.lock().await;
            process.child.as_ref().and_then(Child::id)
        };
        let Some(pid) = pid else {
            return Ok(());
        };
        let output = Command::new("/bin/ps")
            .args(["-o", "rss=", "-o", "%cpu=", "-p", &pid.to_string()])
            .output()
            .await
            .map_err(|error| EngineManagerError::Transport(error.to_string()))?;
        if !output.status.success() {
            return Err(EngineManagerError::Transport(
                "supervised RSS observation failed".to_owned(),
            ));
        }
        let observed = String::from_utf8_lossy(&output.stdout);
        let mut fields = observed.split_whitespace();
        let rss_kb: u64 = fields
            .next()
            .unwrap_or_default()
            .parse()
            .map_err(|_| EngineManagerError::Transport("invalid RSS observation".to_owned()))?;
        let cpu_percent: f64 = fields
            .next()
            .unwrap_or_default()
            .parse()
            .map_err(|_| EngineManagerError::Transport("invalid CPU observation".to_owned()))?;
        let rss_mb = rss_kb.div_ceil(1024).min(u64::from(u32::MAX)) as u32;
        self.report_rss_mb(engine_name, rss_mb)?;
        if let Err(error) = self.enforce_rss_quota(engine_name) {
            self.stop_supervised_engine(engine_name).await?;
            return Err(error);
        }
        if cpu_percent > f64::from(self.engines[engine_name].routing_policy.max_cpu_percent) {
            self.stop_supervised_engine(engine_name).await?;
            return Err(EngineManagerError::CpuQuota);
        }
        Ok(())
    }

    async fn await_backoff(&self, engine_name: &str) -> Result<(), EngineManagerError> {
        let state = self
            .circuit_state(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        if let Some(backoff_until) = state.backoff_until
            && backoff_until > Utc::now()
        {
            tokio::time::sleep((backoff_until - Utc::now()).to_std().unwrap_or_default()).await;
        }
        let managed = self
            .engines
            .get(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        let mut state = managed
            .state
            .lock()
            .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?;
        if state.consecutive_failures >= self.policy.crash_threshold {
            if state.half_open_probe {
                return Err(EngineManagerError::CircuitOpen);
            }
            state.half_open_probe = true;
        }
        Ok(())
    }

    fn mark_success(&mut self, engine_name: &str) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get_mut(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        let mut state = managed
            .state
            .lock()
            .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?;
        state.consecutive_failures = 0;
        state.backoff_until = None;
        state.half_open_probe = false;
        state.ready = true;
        drop(state);
        self.persist_circuit(engine_name)
    }

    fn record_status(
        &mut self,
        engine_name: &str,
        status: &tonic::Status,
    ) -> Result<(), EngineManagerError> {
        if !should_retry_status(status) {
            return Ok(());
        }
        self.record_failure(engine_name)
    }

    fn record_failure(&mut self, engine_name: &str) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get_mut(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        let mut state = managed
            .state
            .lock()
            .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?;
        state.consecutive_failures += 1;
        state.half_open_probe = false;
        state.ready = false;
        if state.consecutive_failures >= self.policy.crash_threshold {
            let exponent = state
                .consecutive_failures
                .saturating_sub(self.policy.crash_threshold);
            let multiplier = 1_u32.checked_shl(exponent.min(8)).unwrap_or(u32::MAX);
            let delay = self
                .policy
                .base_backoff
                .saturating_mul(multiplier)
                .min(self.policy.max_backoff);
            let delay =
                chrono::Duration::from_std(delay).unwrap_or_else(|_| chrono::Duration::zero());
            state.backoff_until = Some(Utc::now() + delay);
            warn!(
                engine = engine_name,
                failures = state.consecutive_failures,
                "engine circuit opened"
            );
        }
        drop(state);
        self.persist_circuit(engine_name)
    }

    fn persist_circuit(&self, engine_name: &str) -> Result<(), EngineManagerError> {
        if let Some(durable) = &self.durable {
            let managed = self
                .engines
                .get(engine_name)
                .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
            let state = *managed
                .state
                .lock()
                .map_err(|_| EngineManagerError::Transport("circuit lock poisoned".to_owned()))?;
            durable.save_circuit(engine_name, &manifest_digest(&managed.manifest)?, state)?;
        }
        Ok(())
    }

    fn status_to_error(status: tonic::Status) -> EngineManagerError {
        if status.code() == tonic::Code::DeadlineExceeded {
            EngineManagerError::DeadlineExceeded
        } else {
            EngineManagerError::Rpc(status.to_string())
        }
    }
}

pub fn review_manifest(manifest: &EngineManifest) -> Result<(), ManifestReviewError> {
    if manifest.engine_name.trim().is_empty()
        || !manifest
            .engine_name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(ManifestReviewError::InvalidEngineName);
    }
    Version::parse(&manifest.engine_version)
        .map_err(|_| ManifestReviewError::InvalidVersion(manifest.engine_version.clone()))?;
    if manifest.capabilities.is_empty() {
        return Err(ManifestReviewError::EmptyCapabilities);
    }
    if manifest.supported_schema_versions.is_empty() {
        return Err(ManifestReviewError::EmptySupportedSchemas);
    }
    if manifest.quota.max_concurrency == 0 || manifest.quota.max_rss_mb == 0 {
        return Err(ManifestReviewError::InvalidQuota);
    }
    let mut seen_capabilities = BTreeSet::new();
    for capability in &manifest.capabilities {
        if !seen_capabilities.insert(capability.name.clone()) {
            return Err(ManifestReviewError::DuplicateCapability(
                capability.name.clone(),
            ));
        }
        Version::parse(&capability.version).map_err(|_| {
            ManifestReviewError::InvalidCapabilityVersion(
                capability.name.clone(),
                capability.version.clone(),
            )
        })?;
    }
    if !manifest.socket_path()?.is_absolute() {
        return Err(ManifestReviewError::InvalidSocketPath);
    }
    Ok(())
}

impl EngineManifest {
    fn socket_path(&self) -> Result<&Path, ManifestReviewError> {
        match &self.transport {
            EngineTransport::Uds { socket_path } => Ok(socket_path.as_path()),
        }
    }
}

async fn connect_uds(path: &Path) -> Result<EngineServiceClient<Channel>, tonic::transport::Error> {
    let socket_path = Arc::new(path.to_path_buf());
    let endpoint = Endpoint::try_from("http://[::]:50051")?;
    let channel = endpoint
        .connect_with_connector(service_fn(move |_| {
            let socket_path = socket_path.clone();
            async move {
                UnixStream::connect(socket_path.as_path())
                    .await
                    .map(TokioIo::new)
            }
        }))
        .await?;
    Ok(EngineServiceClient::new(channel))
}

fn timestamp_to_datetime(timestamp: &Timestamp) -> Result<DateTime<Utc>, EngineManagerError> {
    DateTime::<Utc>::from_timestamp(timestamp.seconds, timestamp.nanos as u32)
        .ok_or(EngineManagerError::DeadlineExceeded)
}

fn remaining_time(deadline_at: DateTime<Utc>) -> Result<Duration, EngineManagerError> {
    let remaining = deadline_at - Utc::now();
    if remaining <= chrono::Duration::zero() {
        return Err(EngineManagerError::DeadlineExceeded);
    }
    remaining
        .to_std()
        .map_err(|_| EngineManagerError::DeadlineExceeded)
}

fn should_retry_status(status: &tonic::Status) -> bool {
    matches!(
        status.code(),
        tonic::Code::Unavailable | tonic::Code::Unknown | tonic::Code::Internal
    )
}

#[must_use]
pub fn build_metadata(request_id: &str) -> CommandMetadata {
    CommandMetadata {
        request_id: request_id.to_owned(),
        tenant_id: "tenant-primary".to_owned(),
        workspace_id: "workspace-primary".to_owned(),
        actor: None,
        correlation_id: format!("corr-{request_id}"),
        causation_id: format!("cause-{request_id}"),
        mode: 2,
        environment: 2,
        issued_at: Some(Timestamp {
            seconds: Utc::now().timestamp(),
            nanos: 0,
        }),
    }
}

fn service_metadata(request_id: &str) -> CommandMetadata {
    let mut metadata = build_metadata(request_id);
    metadata.actor = Some(ActorRef {
        actor_id: "engine-manager".to_owned(),
        actor_kind: 2,
        display_name: "Engine Manager".to_owned(),
        capabilities: Vec::new(),
    });
    metadata
}

#[must_use]
pub fn capability(name: &str, version: &str, description: &str) -> Capability {
    Capability {
        name: name.to_owned(),
        version: version.to_owned(),
        description: description.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_manifest(socket_path: PathBuf) -> EngineManifest {
        EngineManifest {
            engine_name: "mock-engine".to_owned(),
            engine_version: "0.1.0".to_owned(),
            supported_schema_versions: vec!["v1".to_owned()],
            capabilities: vec![EngineCapabilityManifest {
                name: "research.execute".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Run deterministic research".to_owned(),
            }],
            transport: EngineTransport::Uds { socket_path },
            quota: EngineQuota {
                max_concurrency: 4,
                max_rss_mb: 512,
            },
        }
    }

    #[test]
    fn approval_fails_closed_on_unsigned_or_modified_manifest() {
        let manifest = fixture_manifest(PathBuf::from("/tmp/f08-approval.sock"));
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        assert_eq!(
            manager
                .register_engine(manifest.clone())
                .unwrap_err()
                .machine_code(),
            "ENGINE_MANIFEST_UNAPPROVED"
        );
        let approval = EngineApproval::sign_for_local_fixture(
            &manifest,
            &"a".repeat(64),
            "reviewer",
            b"f08-test-approval-key",
        )
        .expect("approval signs");
        let mut changed = manifest.clone();
        changed.engine_version = "0.2.0".to_owned();
        assert_eq!(
            manager
                .register_approved_engine(changed, &approval)
                .unwrap_err()
                .machine_code(),
            "ENGINE_MANIFEST_UNAPPROVED"
        );
        let mut forged = approval.clone();
        forged.artifact_sha256 = "b".repeat(64);
        assert_eq!(
            manager
                .register_approved_engine(manifest.clone(), &forged)
                .unwrap_err()
                .machine_code(),
            "ENGINE_MANIFEST_UNAPPROVED"
        );
        let mut changed_policy = approval.clone();
        changed_policy.routing_policy.max_requests_per_second = 1;
        assert_eq!(
            manager
                .register_approved_engine(manifest.clone(), &changed_policy)
                .unwrap_err()
                .machine_code(),
            "ENGINE_MANIFEST_UNAPPROVED"
        );
        manager
            .register_approved_engine(manifest, &approval)
            .expect("reviewed release registers");
    }

    #[test]
    fn signed_route_policy_and_reregistration_fail_closed() {
        let manifest = fixture_manifest(PathBuf::from("/tmp/f08-route.sock"));
        let policy = EngineRoutingPolicy {
            allowed_tenants: BTreeSet::from(["tenant-a".to_owned()]),
            allowed_regions: BTreeSet::from(["cn-east".to_owned()]),
            max_classification: 2,
            max_cost_units: 10,
            gpu_available: false,
            max_requests_per_second: 1,
            max_cpu_percent: 100,
            requires_supervision: false,
            retry_safe: true,
        };
        let approval = EngineApproval::sign_with_policy(
            &manifest,
            &"a".repeat(64),
            "reviewer",
            policy,
            b"f08-test-approval-key",
        )
        .expect("approval signs");
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy::default(),
            b"f08-test-approval-key".to_vec(),
        );
        manager
            .register_approved_engine(manifest.clone(), &approval)
            .expect("registers");
        let mut metadata = service_metadata("route");
        metadata.tenant_id = "tenant-a".to_owned();
        let request = ExecuteRequest {
            metadata: Some(metadata),
            capability: "research.execute".to_owned(),
            ..ExecuteRequest::default()
        };
        let context = EngineDispatchContext {
            region: "cn-east".to_owned(),
            classification: 2,
            estimated_cost_units: 10,
            requires_gpu: false,
        };
        assert!(
            manager
                .enforce_route_policy("mock-engine", &request, &context)
                .is_ok()
        );
        let mut denied = context.clone();
        denied.requires_gpu = true;
        assert_eq!(
            manager
                .enforce_route_policy("mock-engine", &request, &denied)
                .unwrap_err()
                .machine_code(),
            "ENGINE_ROUTE_DENIED"
        );
        let mut replacement = manifest.clone();
        replacement.capabilities[0].name = "research.replacement".to_owned();
        let replacement_approval = EngineApproval::sign_for_local_fixture(
            &replacement,
            &"a".repeat(64),
            "reviewer",
            b"f08-test-approval-key",
        )
        .expect("approval signs");
        manager
            .register_approved_engine(replacement, &replacement_approval)
            .expect("replacement registers");
        assert!(manager.route_engine_name("research.execute").is_err());
        assert!(matches!(
            manager.route_engine_name("research.replacement"),
            Ok("mock-engine")
        ));
    }

    #[tokio::test]
    async fn review_manifest_rejects_duplicate_capabilities() {
        let manifest = EngineManifest {
            engine_name: "mock-engine".to_owned(),
            engine_version: "0.1.0".to_owned(),
            supported_schema_versions: vec!["v1".to_owned()],
            capabilities: vec![
                EngineCapabilityManifest {
                    name: "research.execute".to_owned(),
                    version: "1.0.0".to_owned(),
                    description: "first".to_owned(),
                },
                EngineCapabilityManifest {
                    name: "research.execute".to_owned(),
                    version: "1.0.0".to_owned(),
                    description: "second".to_owned(),
                },
            ],
            transport: EngineTransport::Uds {
                socket_path: PathBuf::from("/tmp/mock.sock"),
            },
            quota: EngineQuota {
                max_concurrency: 4,
                max_rss_mb: 512,
            },
        };

        let error = review_manifest(&manifest).expect_err("duplicate capability rejected");
        assert!(matches!(
            error,
            ManifestReviewError::DuplicateCapability(capability) if capability == "research.execute"
        ));
    }

    #[tokio::test]
    async fn manager_opens_backoff_window_after_three_recorded_failures() {
        let tempdir = tempfile::tempdir().expect("tempdir creates");
        let mut manager = EngineManager::with_approval_key(
            BackoffPolicy {
                crash_threshold: 3,
                base_backoff: Duration::from_millis(25),
                max_backoff: Duration::from_millis(50),
                max_dispatch_attempts: 5,
            },
            b"f08-test-approval-key".to_vec(),
        );
        let manifest = EngineManifest {
            engine_name: "mock-engine".to_owned(),
            engine_version: "0.1.0".to_owned(),
            supported_schema_versions: vec!["v1".to_owned()],
            capabilities: vec![EngineCapabilityManifest {
                name: "research.execute".to_owned(),
                version: "1.0.0".to_owned(),
                description: "Run deterministic research".to_owned(),
            }],
            transport: EngineTransport::Uds {
                socket_path: tempdir.path().join("engine.sock"),
            },
            quota: EngineQuota {
                max_concurrency: 4,
                max_rss_mb: 512,
            },
        };
        let approval = EngineApproval::sign_for_local_fixture(
            &manifest,
            &"a".repeat(64),
            "reviewer",
            b"f08-test-approval-key",
        )
        .expect("approval signs");
        manager
            .register_approved_engine(manifest, &approval)
            .expect("manifest registers");

        manager
            .record_failure("mock-engine")
            .expect("first failure records");
        manager
            .record_failure("mock-engine")
            .expect("second failure records");
        manager
            .record_failure("mock-engine")
            .expect("third failure records");

        let state = manager
            .circuit_state("mock-engine")
            .expect("engine state available");
        assert_eq!(state.consecutive_failures, 3);
        assert!(state.backoff_until.is_some());
        let first = manager.clone();
        let second = manager.clone();
        let (a, b) = tokio::join!(
            first.await_backoff("mock-engine"),
            second.await_backoff("mock-engine")
        );
        assert_ne!(a.is_ok(), b.is_ok(), "only one half-open probe may proceed");
    }

    #[tokio::test]
    async fn remaining_time_rejects_expired_deadlines() {
        let error = remaining_time(Utc::now() - chrono::Duration::milliseconds(1))
            .expect_err("expired deadline rejected");
        assert_eq!(error.machine_code(), "ENGINE_DEADLINE_EXCEEDED");
    }
}
