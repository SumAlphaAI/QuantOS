use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use hyper_util::rt::TokioIo;
use quantos_proto::generated::google::protobuf::Timestamp;
use quantos_proto::quantos::{
    common::v1::CommandMetadata,
    engine::v1::{
        CancelRequest, CancelResponse, Capability, ExecuteRequest, ExecuteResponse,
        GetMetadataRequest, GetMetadataResponse, HealthRequest, HealthResponse,
        StreamExecuteRequest, StreamExecuteResponse, engine_service_client::EngineServiceClient,
    },
};
use semver::Version;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::{
    net::UnixStream,
    sync::{OwnedSemaphorePermit, Semaphore},
};
use tonic::transport::{Channel, Endpoint};
use tower::service_fn;

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

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ManifestReviewError {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EngineCircuitState {
    pub consecutive_failures: u32,
    pub backoff_until: Option<DateTime<Utc>>,
    pub reported_rss_mb: u32,
}

impl EngineCircuitState {
    fn new() -> Self {
        Self {
            consecutive_failures: 0,
            backoff_until: None,
            reported_rss_mb: 0,
        }
    }
}

#[derive(Debug, Clone)]
struct ManagedEngine {
    manifest: EngineManifest,
    state: EngineCircuitState,
    execution_slots: Arc<Semaphore>,
}

#[derive(Debug, Clone)]
pub struct EngineManager {
    policy: BackoffPolicy,
    engines: BTreeMap<String, ManagedEngine>,
    capability_routes: BTreeMap<String, String>,
}

impl EngineManager {
    #[must_use]
    pub fn new(policy: BackoffPolicy) -> Self {
        Self {
            policy,
            engines: BTreeMap::new(),
            capability_routes: BTreeMap::new(),
        }
    }

    pub fn register_engine(&mut self, manifest: EngineManifest) -> Result<(), EngineManagerError> {
        review_manifest(&manifest)?;
        for capability in &manifest.capabilities {
            self.capability_routes
                .insert(capability.name.clone(), manifest.engine_name.clone());
        }
        let max_concurrency = manifest.quota.max_concurrency;
        self.engines.insert(
            manifest.engine_name.clone(),
            ManagedEngine {
                manifest,
                state: EngineCircuitState::new(),
                execution_slots: Arc::new(Semaphore::new(max_concurrency as usize)),
            },
        );
        Ok(())
    }

    pub fn manifest(&self, engine_name: &str) -> Option<&EngineManifest> {
        self.engines
            .get(engine_name)
            .map(|managed| &managed.manifest)
    }

    pub fn circuit_state(&self, engine_name: &str) -> Option<EngineCircuitState> {
        self.engines.get(engine_name).map(|managed| managed.state)
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
        managed.state.reported_rss_mb = rss_mb;
        Ok(())
    }

    pub async fn get_metadata(
        &mut self,
        engine_name: &str,
        request: GetMetadataRequest,
    ) -> Result<GetMetadataResponse, EngineManagerError> {
        self.await_backoff(engine_name).await?;
        let mut client = self.client_for_engine(engine_name).await?;
        match client.get_metadata(request).await {
            Ok(response) => {
                self.mark_success(engine_name)?;
                Ok(response.into_inner())
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
        self.await_backoff(engine_name).await?;
        let mut client = self.client_for_engine(engine_name).await?;
        match client.health(request).await {
            Ok(response) => {
                self.mark_success(engine_name)?;
                Ok(response.into_inner())
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
        let engine_name = self.route_engine_name(capability)?.to_owned();
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
                Err(error) => return Err(error),
            };
            let timeout = remaining_time(deadline_at)?;

            match tokio::time::timeout(timeout, client.execute(request.clone())).await {
                Ok(Ok(response)) => {
                    self.mark_success(&engine_name)?;
                    return Ok(response.into_inner());
                }
                Ok(Err(status)) => {
                    self.record_status(&engine_name, &status)?;
                    if should_retry_status(&status)
                        && attempts < self.policy.max_dispatch_attempts
                        && deadline_at > Utc::now()
                    {
                        continue;
                    }
                    return Err(Self::status_to_error(status));
                }
                Err(_) => return Err(EngineManagerError::DeadlineExceeded),
            }
        }
    }

    pub async fn stream_execute_collect(
        &mut self,
        capability: &str,
        request: StreamExecuteRequest,
    ) -> Result<Vec<StreamExecuteResponse>, EngineManagerError> {
        let engine_name = self.route_engine_name(capability)?.to_owned();
        let inner_request = request
            .request
            .clone()
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline = inner_request
            .deadline
            .ok_or(EngineManagerError::DeadlineExceeded)?;
        let deadline_at = timestamp_to_datetime(&deadline)?;
        self.await_backoff(&engine_name).await?;
        let mut client = self.client_for_engine(&engine_name).await?;
        let timeout = remaining_time(deadline_at)?;

        match tokio::time::timeout(timeout, client.stream_execute(request)).await {
            Ok(Ok(response)) => {
                let mut stream = response.into_inner();
                let mut events = Vec::new();
                while let Some(item) = stream.next().await {
                    match item {
                        Ok(message) => events.push(message),
                        Err(status) => {
                            self.record_status(&engine_name, &status)?;
                            return Err(Self::status_to_error(status));
                        }
                    }
                }
                self.mark_success(&engine_name)?;
                Ok(events)
            }
            Ok(Err(status)) => {
                self.record_status(&engine_name, &status)?;
                Err(Self::status_to_error(status))
            }
            Err(_) => Err(EngineManagerError::DeadlineExceeded),
        }
    }

    pub async fn cancel(
        &mut self,
        engine_name: &str,
        request: CancelRequest,
    ) -> Result<CancelResponse, EngineManagerError> {
        self.await_backoff(engine_name).await?;
        let mut client = self.client_for_engine(engine_name).await?;
        match client.cancel(request).await {
            Ok(response) => {
                self.mark_success(engine_name)?;
                Ok(response.into_inner())
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
        let engine_name = self.route_engine_name(capability)?.to_owned();
        self.cancel(&engine_name, request).await
    }

    async fn client_for_engine(
        &self,
        engine_name: &str,
    ) -> Result<EngineServiceClient<Channel>, EngineManagerError> {
        let manifest = self
            .manifest(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        connect_uds(manifest.socket_path()?)
            .await
            .map_err(|error| EngineManagerError::Transport(error.to_string()))
    }

    fn route_engine_name(&self, capability: &str) -> Result<&str, EngineManagerError> {
        self.capability_routes
            .get(capability)
            .map(String::as_str)
            .ok_or_else(|| EngineManagerError::CapabilityNotRouted(capability.to_owned()))
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
        if managed.state.reported_rss_mb > managed.manifest.quota.max_rss_mb {
            return Err(EngineManagerError::RssQuota {
                engine_name: engine_name.to_owned(),
                reported_mb: managed.state.reported_rss_mb,
                limit_mb: managed.manifest.quota.max_rss_mb,
            });
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
        Ok(())
    }

    fn mark_success(&mut self, engine_name: &str) -> Result<(), EngineManagerError> {
        let managed = self
            .engines
            .get_mut(engine_name)
            .ok_or_else(|| EngineManagerError::EngineNotFound(engine_name.to_owned()))?;
        managed.state.consecutive_failures = 0;
        managed.state.backoff_until = None;
        Ok(())
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
        managed.state.consecutive_failures += 1;
        if managed.state.consecutive_failures >= self.policy.crash_threshold {
            let exponent = managed
                .state
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
            managed.state.backoff_until = Some(Utc::now() + delay);
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
        let mut manager = EngineManager::new(BackoffPolicy {
            crash_threshold: 3,
            base_backoff: Duration::from_millis(25),
            max_backoff: Duration::from_millis(50),
            max_dispatch_attempts: 5,
        });
        manager
            .register_engine(EngineManifest {
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
            })
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
    }

    #[tokio::test]
    async fn remaining_time_rejects_expired_deadlines() {
        let error = remaining_time(Utc::now() - chrono::Duration::milliseconds(1))
            .expect_err("expired deadline rejected");
        assert_eq!(error.machine_code(), "ENGINE_DEADLINE_EXCEEDED");
    }
}
