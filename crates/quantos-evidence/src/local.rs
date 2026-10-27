//! SERVICE:L04 owned local evidence. No execution-state restore, DB connection,
//! credential loading or release admission. Paths and anchors are trusted-owner inputs.
use crate::{DrillReport, EvidenceError};
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_event::RecordedEvent;
use quantos_observability::{ServiceHealthReport, service::ExportedTraceRecord};
use quantos_operations::{AuditRow, Scope};
use quantos_policy::RunMode;
use quantos_portfolio::{InMemoryPortfolioProjection, PortfolioEventKind, PortfolioSnapshot};
use quantos_reconcile::reconciliation::{Report, offline_check};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{File, OpenOptions},
    io::{Read, Write},
    path::Path,
};

pub const MAX_BYTES: usize = 8 * 1024 * 1024;
pub const PROFILE: &str = "OWNED_LOCAL_ARCHIVE_NOT_DATABASE_OR_EXECUTION_STATE";
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("incomplete, contradictory or tampered local evidence")]
    Invalid,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
fn digest<T: Serialize>(v: &T) -> Result<ContentHash, Error> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error::Invalid)?)
            .map_err(|_| Error::Invalid)?,
    ))
}
fn id(v: &str) -> bool {
    !v.is_empty() && v.len() <= 256 && !v.chars().any(char::is_control)
}

/// Replays a full single-tenant portfolio stream obtained from a trusted F05
/// reader. Exact duplicate delivery is ignored; conflicting identity, gaps,
/// future/foreign records and payload tampering fail before returning a view.
/// This function grants no database provenance, rights or execution authority.
pub fn replay(
    scope: &Scope,
    started: DateTime<Utc>,
    records: &[RecordedEvent],
    now: DateTime<Utc>,
) -> Result<PortfolioSnapshot, Error> {
    if scope.mode != RunMode::Paper
        || scope.tenant_id.as_uuid().is_nil()
        || scope.workspace_id.as_uuid().is_nil()
        || scope.account_id.as_uuid().is_nil()
        || records.is_empty()
        || records.len() > 4096
        || started > now
    {
        return Err(Error::Invalid);
    }
    let mut p = InMemoryPortfolioProjection::new(scope.tenant_id, started);
    let mut seen = BTreeMap::new();
    let mut at = started;
    for r in records {
        let h = digest(r)?;
        if let Some(old) = seen.get(&r.event_id) {
            if old != &h {
                return Err(Error::Invalid);
            }
            continue;
        }
        if r.sequence != seen.len() as u64 + 1
            || r.occurred_at < at
            || r.occurred_at > now
            || r.actor_id.as_uuid().is_nil()
            || r.correlation_id.as_uuid().is_nil()
            || r.causation_id.as_uuid().is_nil()
        {
            return Err(Error::Invalid);
        }
        let kind: PortfolioEventKind =
            serde_json::from_value(r.payload.clone()).map_err(|_| Error::Invalid)?;
        if match kind {
            PortfolioEventKind::Fill(ref f) => f.account_id != scope.account_id,
            PortfolioEventKind::AccountStatus(ref a) => a.account_id != scope.account_id,
            _ => false,
        } {
            return Err(Error::Invalid);
        }
        p.apply_recorded(r, r.sequence)
            .map_err(|_| Error::Invalid)?;
        seen.insert(r.event_id, h);
        at = r.occurred_at;
    }
    p.snapshot(scope.account_id).map_err(|_| Error::Invalid)
}
/// Trusted read port for an existing database event stream. Implementations must
/// not reinterpret this as a write, requeue, grant, or command retry operation.
pub trait EventReader {
    fn load(
        &mut self,
        tenant: quantos_core::TenantId,
        correlation: quantos_core::CorrelationId,
    ) -> Result<Vec<RecordedEvent>, Error>;
}
impl EventReader for quantos_event::pg::PgEventStore {
    fn load(
        &mut self,
        tenant: quantos_core::TenantId,
        correlation: quantos_core::CorrelationId,
    ) -> Result<Vec<RecordedEvent>, Error> {
        self.events_by_correlation_id(tenant, correlation)
            .map_err(|_| Error::Invalid)
    }
}
/// Current verified F06 AuthContext is supplied by the trusted host. No client
/// DTO, environment lookup or connection is created here. Target DB remains an
/// independently authorized/tested obligation; this returns only a projection.
pub fn recover_from_reader(
    reader: &mut impl EventReader,
    scope: &Scope,
    auth: &quantos_auth::AuthContext,
    correlation: quantos_core::CorrelationId,
    started: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<PortfolioSnapshot, Error> {
    if auth.tenant_id != scope.tenant_id
        || auth.workspace_id != scope.workspace_id
        || auth.account_id != Some(scope.account_id)
        || auth.mode != scope.mode
        || auth.actor_id.as_uuid().is_nil()
        || auth.user_id.is_nil()
        || correlation.as_uuid().is_nil()
        || !matches!(
            auth.role,
            quantos_policy::Role::Owner
                | quantos_policy::Role::Operator
                | quantos_policy::Role::Service
        )
        || !auth
            .capabilities
            .iter()
            .any(|c| c.as_str() == quantos_operations::OPS_READ)
    {
        return Err(Error::Invalid);
    }
    let records = reader.load(scope.tenant_id, correlation)?;
    if records.iter().any(|r| r.correlation_id != correlation) {
        return Err(Error::Invalid);
    }
    replay(scope, started, &records, now)
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OrderObservation {
    pub command_id: String,
    pub order_id: String,
    pub fill_ids: Vec<String>,
    pub evidence_hash: ContentHash,
    pub portfolio_hash: ContentHash,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LocalPacket {
    pub schema: String,
    pub profile: String,
    pub source_commit: String,
    pub scope: Scope,
    pub started_at: DateTime<Utc>,
    pub checked_at: DateTime<Utc>,
    pub records: Vec<RecordedEvent>,
    pub portfolio: PortfolioSnapshot,
    pub orders: Vec<OrderObservation>,
    pub recovery_attempts: u64,
    pub downstream_submissions: u64,
    pub operations_audit: Vec<AuditRow>,
    pub operations_audit_head: ContentHash,
    pub drills: DrillReport,
    pub reconciliation: Report,
    pub health: ServiceHealthReport,
    pub traces: Vec<ExportedTraceRecord>,
}
impl LocalPacket {
    pub fn validate(&self) -> Result<(), Error> {
        if self.schema != "quantos-service-l04-local/v1"
            || self.profile != PROFILE
            || self.source_commit.len() != 40
            || !self
                .source_commit
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
            || self.checked_at < self.started_at
            || self.orders.is_empty()
            || self.orders.len() > 256
            || self.recovery_attempts < self.downstream_submissions
            || self.downstream_submissions != self.orders.len() as u64
            || self.operations_audit.len() < self.orders.len() * 2
            || self.operations_audit.len() > 4096
        {
            return Err(Error::Invalid);
        }
        self.portfolio.validate().map_err(|_| Error::Invalid)?;
        if replay(&self.scope, self.started_at, &self.records, self.checked_at)? != self.portfolio {
            return Err(Error::Invalid);
        }
        let mut commands = BTreeSet::new();
        let mut orders = BTreeSet::new();
        let mut fills = BTreeSet::new();
        for o in &self.orders {
            if !id(&o.command_id)
                || !id(&o.order_id)
                || !commands.insert(&o.command_id)
                || !orders.insert(&o.order_id)
                || o.portfolio_hash != self.portfolio.snapshot_hash
                || o.fill_ids.is_empty()
                || o.fill_ids.len() > 4096
                || o.fill_ids.iter().any(|f| !id(f) || !fills.insert(f))
            {
                return Err(Error::Invalid);
            }
        }
        let mut previous = None;
        let mut at = self.started_at;
        for (i, r) in self.operations_audit.iter().enumerate() {
            if r.sequence != i as u64 + 1
                || r.previous != previous
                || r.actor.as_uuid().is_nil()
                || r.at < at
                || r.at > self.checked_at
                || !id(&r.kind)
                || r.hash
                    != digest(&(
                        "service-x06-audit/v1",
                        &self.scope,
                        r.sequence,
                        r.actor,
                        r.at,
                        &r.kind,
                        &r.subject,
                        &r.outcome,
                        &r.previous,
                    ))?
            {
                return Err(Error::Invalid);
            }
            previous = Some(r.hash.clone());
            at = r.at;
        }
        if previous.as_ref() != Some(&self.operations_audit_head) {
            return Err(Error::Invalid);
        }
        let drills = DrillReport::build(self.drills.results.clone()).map_err(|_| Error::Invalid)?;
        if !drills.all_passed || drills != self.drills {
            return Err(Error::Invalid);
        }
        let report = offline_check(
            self.reconciliation.input(),
            self.reconciliation.checked_at(),
        )
        .map_err(|_| Error::Invalid)?;
        if report != self.reconciliation
            || !report.is_clean()
            || report.input().scope.tenant_id != self.scope.tenant_id
            || report.input().scope.workspace_id != self.scope.workspace_id
            || report.input().scope.account_id != self.scope.account_id
            || report.checked_at() > self.checked_at
            || self.checked_at - report.checked_at() > Duration::seconds(30)
        {
            return Err(Error::Invalid);
        }
        let h = &self.health;
        let names: BTreeSet<_> = h.components.iter().map(|c| c.name.as_str()).collect();
        if h.service != "service-x06"
            || !h.ready
            || h.components.len() != 4
            || names != BTreeSet::from(["execution", "portfolio", "risk", "reconciliation"])
            || h.checked_at > self.checked_at
            || self.checked_at - h.checked_at > Duration::seconds(30)
            || h.components.iter().any(|c| {
                !c.ready
                    || c.checked_at > h.checked_at
                    || self.checked_at - c.checked_at > Duration::seconds(30)
            })
            || self.traces.is_empty()
            || self.traces.len() > 128
        {
            return Err(Error::Invalid);
        }
        for t in &self.traces {
            if t.service != "service-l04-owned"
                || t.operation != "recovery.checkpoint"
                || t.status != "succeeded"
                || t.correlation_id.as_uuid().is_nil()
                || t.recorded_at < self.started_at
                || t.recorded_at > self.checked_at
                || t.attributes
                    != serde_json::json!({"scope":"owned-local", "executionAuthority":false})
            {
                return Err(Error::Invalid);
            }
        }
        Ok(())
    }
}
/// Create a bounded immutable evidence archive. A failed or partial write remains
/// quarantined at the path; never overwrite/truncate it or treat it as committed.
/// The returned digest must be kept independently by the trusted owner.
pub fn archive(path: &Path, packet: &LocalPacket) -> Result<ContentHash, Error> {
    packet.validate()?;
    let bytes = serde_json::to_vec(packet).map_err(|_| Error::Invalid)?;
    if bytes.len() > MAX_BYTES {
        return Err(Error::Invalid);
    }
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    file.try_lock().map_err(|_| Error::Invalid)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    File::open(
        path.parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new(".")),
    )?
    .sync_all()?;
    Ok(ContentHash::sha256_bytes(&bytes))
}
pub fn verify_archive(path: &Path, trusted_digest: &ContentHash) -> Result<LocalPacket, Error> {
    if !std::fs::symlink_metadata(path)?.file_type().is_file() {
        return Err(Error::Invalid);
    }
    let mut file = File::open(path)?;
    file.lock_shared()?;
    if file.metadata()?.len() > MAX_BYTES as u64 {
        return Err(Error::Invalid);
    }
    let mut bytes = Vec::new();
    std::io::Read::by_ref(&mut file)
        .take(MAX_BYTES as u64 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAX_BYTES || ContentHash::sha256_bytes(&bytes) != *trusted_digest {
        return Err(Error::Invalid);
    }
    let packet: LocalPacket = serde_json::from_slice(&bytes).map_err(|_| Error::Invalid)?;
    packet.validate()?;
    Ok(packet)
}
impl From<EvidenceError> for Error {
    fn from(_: EvidenceError) -> Self {
        Self::Invalid
    }
}
