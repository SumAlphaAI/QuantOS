use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, ContentHash, TenantId, WorkspaceId, canonical_json_bytes};
use quantos_execution::{authority::SignedCommand, dispatch::OrderEvidence};
use quantos_policy::RunMode;
use quantos_portfolio::{PortfolioEvent, PortfolioSnapshot};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const AUDIT_READ: &str = "audit.read";
pub const OPS_READ: &str = "ops.read";
pub const OPS_OPERATE: &str = "ops.operate";
pub const OPS_APPROVE: &str = "ops.approve";
pub const OPS_OBSERVE: &str = "ops.observe";

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum Error {
    #[error("operation unavailable or forbidden")]
    Denied,
    #[error("stale authentication, observation or clock")]
    Stale,
    #[error("revision, binding or idempotency conflict")]
    Conflict,
    #[error("invalid or unsupported input")]
    Invalid,
    #[error("bounded service capacity reached")]
    Capacity,
    #[error("source or operation needs controlled recovery")]
    RecoveryRequired,
}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub account_id: AccountId,
    pub mode: RunMode,
}
impl Scope {
    pub(crate) fn authorize(&self, a: &AuthContext, capability: &str) -> Result<()> {
        if a.tenant_id != self.tenant_id
            || a.workspace_id != self.workspace_id
            || a.account_id != Some(self.account_id)
            || a.mode != self.mode
            || a.actor_id.as_uuid().is_nil()
            || a.user_id.is_nil()
            || !a.capabilities.iter().any(|c| c.as_str() == capability)
        {
            return Err(Error::Denied);
        }
        Ok(())
    }
}
/// A backend assertion from an already verified MFA/session provider, not a
/// client deserializable claim. This constructor is a trusted host boundary.
#[derive(Clone)]
pub struct VerifiedStepUp {
    auth_hash: ContentHash,
    verified_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
}
impl VerifiedStepUp {
    pub fn from_verified_session(
        a: &AuthContext,
        verified_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<Self> {
        if expires_at <= verified_at || expires_at - verified_at > Duration::minutes(5) {
            return Err(Error::Invalid);
        }
        Ok(Self {
            auth_hash: hash(a)?,
            verified_at,
            expires_at,
        })
    }
    /// Recheck the trusted assertion against the current exact caller and clock.
    pub fn check(&self, a: &AuthContext, now: DateTime<Utc>) -> Result<()> {
        if self.auth_hash != hash(a)? || self.verified_at > now || now >= self.expires_at {
            return Err(Error::Stale);
        }
        Ok(())
    }
}
#[derive(Clone)]
pub struct Config {
    pub scope: Scope,
    pub quote_unit: String,
    pub observer: ActorId,
    pub started_at: DateTime<Utc>,
    pub max_actions: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case", deny_unknown_fields)]
pub enum Outcome {
    Prepared,
    Applied { reference: ContentHash },
    Rejected,
    Uncertain,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Operation {
    pub id: ContentHash,
    pub kind: String,
    pub actor: ActorId,
    pub user: String,
    pub binding: ContentHash,
    pub outcome: Outcome,
    pub prepared_at: DateTime<Utc>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AuditRow {
    pub sequence: u64,
    pub actor: ActorId,
    pub at: DateTime<Utc>,
    pub kind: String,
    pub subject: ContentHash,
    pub outcome: Outcome,
    pub previous: Option<ContentHash>,
    pub hash: ContentHash,
}
#[derive(Clone, Debug, Serialize)]
pub struct AuditPage {
    pub rows: Vec<AuditRow>,
    pub head: Option<ContentHash>,
    pub total: u64,
}
/// Anchor issued by the trusted checkpoint path. It cannot be deserialized from
/// an operator request. Durable anchor storage/reattestation is a separate target.
#[derive(Clone, Debug)]
pub struct CheckpointAnchor {
    pub(crate) digest: ContentHash,
    pub(crate) scope: Scope,
    pub(crate) sequence: u64,
    pub(crate) lease: quantos_execution::dispatch::GatewayLease,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FillLink {
    pub command_id: String,
    pub fill_id: String,
    pub event_id: String,
    pub sequence: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OrderRecord {
    pub command: SignedCommand,
    pub evidence: OrderEvidence,
    pub captured_at: DateTime<Utc>,
}
/// Safe account view; signing material, arbitrary kernel text and session data
/// never enter this DTO. Fact refs are a scoped subset, not global replay proof.
#[derive(Clone, Debug, Serialize)]
pub struct EvidenceChain {
    pub command_id: String,
    pub proposal_id: String,
    pub proposal_hash: ContentHash,
    pub decision_id: String,
    pub risk_snapshot_hash: ContentHash,
    pub approval_id: Option<String>,
    pub approval: Option<ApprovalView>,
    pub risk_verdict: String,
    pub risk_kill_revision: u64,
    pub risk_expires_at: DateTime<Utc>,
    pub order: quantos_execution::gateway::GatewayOrder,
    pub order_id: String,
    pub order_status: String,
    pub fills: Vec<quantos_execution::gateway::GatewayFill>,
    pub facts: Vec<FactRef>,
    pub fill_links: Vec<FillLink>,
    pub opening_events_hash: ContentHash,
    pub portfolio_events_hash: ContentHash,
    pub portfolio: PortfolioSnapshot,
    pub portfolio_source_current: bool,
    pub captured_at: DateTime<Utc>,
}
#[derive(Clone, Debug, Serialize)]
pub struct ApprovalView {
    pub id: String,
    pub requester: ActorId,
    pub approver: Option<ActorId>,
    pub state: quantos_execution::authority::ApprovalState,
    pub revision: u64,
    pub consumed_by_command: Option<String>,
    pub expires_at: DateTime<Utc>,
}
#[derive(Clone, Debug, Serialize)]
pub struct FactRef {
    pub sequence: u64,
    pub hash: ContentHash,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaseStatus {
    Open,
    Acknowledged,
    Resolved,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Alert {
    pub id: ContentHash,
    pub rule: String,
    pub active: bool,
    pub acknowledged: bool,
    pub revision: u64,
    pub source_revision: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Incident {
    pub id: ContentHash,
    pub alert_id: ContentHash,
    pub status: CaseStatus,
    pub revision: u64,
    pub requester: ActorId,
    pub requester_user: String,
    pub acknowledged_by: Option<ActorId>,
    pub acknowledged_user: Option<String>,
    pub opened_source: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Health {
    pub revision: u64,
    pub ready: bool,
    pub observed_at: DateTime<Utc>,
    pub source_hash: ContentHash,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Resume {
    pub requester: ActorId,
    pub user: String,
    pub revision: u64,
    pub source_revision: u64,
    pub expires_at: DateTime<Utc>,
    pub approver: Option<(ActorId, String)>,
    pub consumed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "runbook", rename_all = "snake_case", deny_unknown_fields)]
pub enum Runbook {
    InspectEvidence { command_id: String },
    InspectHealth {},
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct State {
    pub schema: String,
    pub scope: Scope,
    pub quote_unit: String,
    pub seed_hash: ContentHash,
    pub seed_len: usize,
    pub events: Vec<PortfolioEvent>,
    pub links: Vec<FillLink>,
    pub orders: BTreeMap<String, OrderRecord>,
    pub operations: BTreeMap<ContentHash, Operation>,
    pub pending: BTreeMap<ContentHash, SignedCommand>,
    pub audit: Vec<AuditRow>,
    pub at: DateTime<Utc>,
    pub health: Option<Health>,
    pub alerts: BTreeMap<ContentHash, Alert>,
    pub incidents: BTreeMap<ContentHash, Incident>,
    pub resumes: BTreeMap<ContentHash, Resume>,
}
pub(crate) fn hash<T: Serialize + ?Sized>(v: &T) -> Result<ContentHash> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error::Invalid)?)
            .map_err(|_| Error::Invalid)?,
    ))
}
pub(crate) fn identifier(s: &str) -> Result<()> {
    if s.is_empty()
        || s.len() > 160
        || !s
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_:-.".contains(&c))
    {
        return Err(Error::Invalid);
    }
    Ok(())
}
