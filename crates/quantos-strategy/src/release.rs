use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ContentHash, CoreError, ProposalId, SnapshotId, StrategyDraftId, TenantId,
    WorkspaceId, canonical_json_bytes,
};
use quantos_policy::Capability;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

use crate::{DraftArtifactRef, backtest::BacktestValidationReport};

/// No public constructor or Deserialize: only DraftService may mint this proof.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ValidatedBacktest {
    pub(crate) report: BacktestValidationReport,
    pub(crate) snapshot_hash: ContentHash,
    pub(crate) artifact_payload: serde_json::Value,
    pub(crate) name: String,
    pub(crate) evidence_refs: Vec<DraftArtifactRef>,
    pub(crate) valid_until: DateTime<Utc>,
}
impl ValidatedBacktest {
    pub fn report(&self) -> &BacktestValidationReport {
        &self.report
    }
    pub fn snapshot_hash(&self) -> &ContentHash {
        &self.snapshot_hash
    }
    pub fn evidence_refs(&self) -> &[DraftArtifactRef] {
        &self.evidence_refs
    }
    pub fn valid_until(&self) -> DateTime<Utc> {
        self.valid_until
    }
    // Only trusted database rows may be rehydrated; never expose as request JSON.
    pub(crate) fn from_storage(value: serde_json::Value) -> Result<Self, serde_json::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Row {
            report: BacktestValidationReport,
            snapshot_hash: ContentHash,
            artifact_payload: serde_json::Value,
            name: String,
            evidence_refs: Vec<DraftArtifactRef>,
            valid_until: DateTime<Utc>,
        }
        let row: Row = serde_json::from_value(value)?;
        Ok(Self {
            report: row.report,
            snapshot_hash: row.snapshot_hash,
            artifact_payload: row.artifact_payload,
            name: row.name,
            evidence_refs: row.evidence_refs,
            valid_until: row.valid_until,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct ReleaseApproval {
    pub content_hash: ContentHash,
    pub actor_id: ActorId,
    pub approved_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Deployment targets open during M3/M4. `Assisted Live` is intentionally absent
/// until the M5 gate passes, so the enum itself cannot represent it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentTarget {
    Paper,
    Shadow,
}

impl DeploymentTarget {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Paper => "paper",
            Self::Shadow => "shadow",
        }
    }

    pub fn parse(value: &str) -> Result<Self, StrategyReleaseError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "paper" => Ok(Self::Paper),
            "shadow" => Ok(Self::Shadow),
            other => Err(StrategyReleaseError::UnsupportedDeploymentTarget {
                target: other.to_owned(),
            }),
        }
    }

    #[must_use]
    pub fn m3_m4_allowed() -> BTreeSet<Self> {
        BTreeSet::from([Self::Paper, Self::Shadow])
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StrategyRelease {
    pub release_id: ProposalId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub(crate) validation: Option<ValidatedBacktest>,
    pub(crate) approval: Option<ReleaseApproval>,
    pub draft_id: StrategyDraftId,
    pub draft_version: u64,
    pub name: String,
    pub source_digest: String,
    pub image_digest: String,
    pub parameter_hash: ContentHash,
    pub backtest_report_hash: Option<ContentHash>,
    pub data_snapshot_id: SnapshotId,
    pub evidence_refs: Vec<DraftArtifactRef>,
    pub allowed_targets: Vec<DeploymentTarget>,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<ActorId>,
    pub content_hash: ContentHash,
    pub created_by: ActorId,
    pub created_at: DateTime<Utc>,
}

impl StrategyRelease {
    pub fn parameters(&self) -> Option<&serde_json::Value> {
        self.validation
            .as_ref()
            .map(|v| &v.artifact_payload["strategy"])
    }
    pub fn is_verified(&self) -> bool {
        let Some(v) = &self.validation else {
            return false;
        };
        let Some(d) = &v.report.draft else {
            return false;
        };
        canonical_json_bytes(&v.artifact_payload["strategy"])
            .is_ok_and(|b| ContentHash::sha256_bytes(&b) == self.parameter_hash)
            && canonical_json_bytes(&v.artifact_payload).is_ok_and(|b| {
                v.evidence_refs
                    .iter()
                    .any(|r| r.content_hash == ContentHash::sha256_bytes(&b))
            })
            && v.report.verify_integrity().is_ok()
            && v.report.leak_check.violations == 0
            && d.tenant_id == self.tenant_id
            && d.workspace_id == self.workspace_id
            && d.draft_id == self.draft_id
            && d.version == self.draft_version
            && d.parameter_hash == self.parameter_hash
            && v.report.parameter_hash == self.parameter_hash
            && v.report.snapshot_id == self.data_snapshot_id
            && self.backtest_report_hash.as_ref() == Some(&v.report.report_hash)
            && self.source_digest == v.report.candidate.source_commit
            && self.image_digest == v.report.candidate.image_digest.as_str()
            && self.name == v.name
            && self.evidence_refs == v.evidence_refs
            && self.created_at >= v.report.generated_at
            && self.created_at <= v.valid_until
            && self.recompute_hash().is_ok_and(|h| h == self.content_hash)
    }
    pub fn is_approved(&self) -> bool {
        self.is_verified()
            && self.approved_by.is_some()
            && self.approved_at.is_some_and(|at| at >= self.created_at)
            && self.approval.as_ref().is_some_and(|a| {
                a.content_hash == self.content_hash
                    && Some(a.actor_id) == self.approved_by
                    && Some(a.approved_at) == self.approved_at
                    && self.approved_at.is_some_and(|at| at < a.expires_at)
                    && self
                        .validation
                        .as_ref()
                        .is_some_and(|v| a.expires_at <= v.valid_until)
            })
    }
    pub(crate) fn recompute_hash(&self) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "schema":"quantos-strategy-release/v2", "tenant_id":self.tenant_id,
            "workspace_id":self.workspace_id,"draft_id":self.draft_id,"draft_version":self.draft_version,
            "name":self.name,"source_digest":self.source_digest,"image_digest":self.image_digest,
            "parameter_hash":self.parameter_hash,"backtest_report_hash":self.backtest_report_hash,
            "data_snapshot_id":self.data_snapshot_id,"evidence_refs":self.evidence_refs,
            "allowed_targets":self.allowed_targets,"validation":self.validation,
        }))?))
    }
    pub(crate) fn ensure_scope(&self, auth: &AuthContext) -> Result<(), StrategyReleaseError> {
        if self.tenant_id != auth.tenant_id || self.workspace_id != auth.workspace_id {
            return Err(StrategyReleaseError::ReleaseNotFound {
                release_id: self.release_id,
            });
        }
        Ok(())
    }
    pub(crate) fn approve_bound(
        &mut self,
        auth: &AuthContext,
        expected: &ContentHash,
        at: DateTime<Utc>,
        expires: DateTime<Utc>,
    ) -> Result<(), StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_APPROVE)?;
        self.ensure_scope(auth)?;
        if self.approval.is_some() {
            return Err(StrategyReleaseError::AlreadyApproved {
                release_id: self.release_id,
            });
        }
        if !self.is_verified()
            || expected != &self.content_hash
            || at < self.created_at
            || at >= expires
            || self
                .validation
                .as_ref()
                .is_none_or(|v| expires > v.valid_until)
        {
            return Err(StrategyReleaseError::InvalidEvidence);
        }
        self.approval = Some(ReleaseApproval {
            content_hash: expected.clone(),
            actor_id: auth.actor_id,
            approved_at: at,
            expires_at: expires,
        });
        self.approved_at = Some(at);
        self.approved_by = Some(auth.actor_id);
        Ok(())
    }
    pub(crate) fn authorize_deployment(
        &self,
        auth: &AuthContext,
        target: DeploymentTarget,
        at: DateTime<Utc>,
    ) -> Result<(), StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_WRITE)?;
        self.ensure_scope(auth)?;
        let violations = DeploymentPolicy::evaluate_at(self, target, at);
        if !violations.is_empty() {
            return Err(StrategyReleaseError::DeploymentRejected {
                violations: violations
                    .iter()
                    .map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(","),
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReleasePublishInput {
    pub draft_id: StrategyDraftId,
    pub draft_version: u64,
    pub name: String,
    pub source_digest: String,
    pub image_digest: String,
    pub parameter_hash: ContentHash,
    pub backtest_report_hash: Option<ContentHash>,
    pub data_snapshot_id: SnapshotId,
    pub evidence_refs: Vec<DraftArtifactRef>,
    pub allowed_targets: Vec<DeploymentTarget>,
    pub published_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DeploymentTicket {
    pub release_id: ProposalId,
    pub target: DeploymentTarget,
    pub requested_by: ActorId,
    pub requested_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentViolation {
    ReleaseUnverified,
    ReleaseUnapproved,
    EvidenceExpired,
    TargetNotAllowed,
}

impl DeploymentViolation {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ReleaseUnverified => "release_unverified",
            Self::ReleaseUnapproved => "release_unapproved",
            Self::EvidenceExpired => "evidence_expired",
            Self::TargetNotAllowed => "target_not_allowed",
        }
    }
}

#[derive(Debug, Error)]
pub enum StrategyReleaseError {
    #[error(
        "STRATEGY_RELEASE_INVALID_EVIDENCE: verified provenance, content, scope or time mismatch"
    )]
    InvalidEvidence,
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("STRATEGY_RELEASE_UNAUTHORIZED: actor is missing capability `{capability}`")]
    Unauthorized { capability: String },
    #[error("STRATEGY_RELEASE_UNSUPPORTED_TARGET: deployment target `{target}` is not available")]
    UnsupportedDeploymentTarget { target: String },
    #[error("STRATEGY_RELEASE_NOT_FOUND: release `{release_id}` is not available")]
    ReleaseNotFound { release_id: ProposalId },
    #[error(
        "STRATEGY_RELEASE_CONTENT_CONFLICT: draft `{draft_id}` version {draft_version} is already bound to a different release hash"
    )]
    ContentConflict {
        draft_id: StrategyDraftId,
        draft_version: u64,
    },
    #[error("STRATEGY_RELEASE_ALREADY_APPROVED: release `{release_id}` is already approved")]
    AlreadyApproved { release_id: ProposalId },
    #[error("STRATEGY_DEPLOYMENT_REJECTED: {violations}")]
    DeploymentRejected { violations: String },
}

pub struct DeploymentPolicy;

impl DeploymentPolicy {
    /// Evaluate a deployment request against the M3/M4 gate.
    #[must_use]
    pub fn evaluate(
        release: &StrategyRelease,
        target: DeploymentTarget,
    ) -> Vec<DeploymentViolation> {
        Self::evaluate_at(release, target, Utc::now())
    }
    #[must_use]
    pub fn evaluate_at(
        release: &StrategyRelease,
        target: DeploymentTarget,
        at: DateTime<Utc>,
    ) -> Vec<DeploymentViolation> {
        let mut violations = Vec::new();
        if at < release.created_at
            || release.approved_at.is_some_and(|t| at < t)
            || release
                .approval
                .as_ref()
                .is_some_and(|a| at >= a.expires_at)
            || release
                .validation
                .as_ref()
                .is_some_and(|v| at > v.valid_until)
        {
            violations.push(DeploymentViolation::EvidenceExpired);
        }
        if !release.is_verified() {
            violations.push(DeploymentViolation::ReleaseUnverified);
        }
        if !release.is_approved() {
            violations.push(DeploymentViolation::ReleaseUnapproved);
        }
        if !release.allowed_targets.contains(&target) {
            violations.push(DeploymentViolation::TargetNotAllowed);
        }
        violations
    }
}

#[derive(Debug, Default, Clone)]
pub struct InMemoryStrategyReleaseStore {
    releases_by_id: BTreeMap<(TenantId, ProposalId), StrategyRelease>,
    release_id_by_hash: BTreeMap<(TenantId, ContentHash), ProposalId>,
    release_hash_by_draft: BTreeMap<(TenantId, StrategyDraftId, u64), ContentHash>,
    tickets: Vec<DeploymentTicket>,
}

impl InMemoryStrategyReleaseStore {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn publish_verified(
        &mut self,
        auth: &AuthContext,
        proof: ValidatedBacktest,
        targets: Vec<DeploymentTarget>,
        at: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        let d = proof
            .report
            .draft
            .as_ref()
            .ok_or(StrategyReleaseError::InvalidEvidence)?;
        if d.tenant_id != auth.tenant_id || d.workspace_id != auth.workspace_id {
            return Err(StrategyReleaseError::InvalidEvidence);
        }
        let input = ReleasePublishInput {
            draft_id: d.draft_id,
            draft_version: d.version,
            name: proof.name.clone(),
            source_digest: proof.report.candidate.source_commit.clone(),
            image_digest: proof.report.candidate.image_digest.to_string(),
            parameter_hash: proof.report.parameter_hash.clone(),
            backtest_report_hash: Some(proof.report.report_hash.clone()),
            data_snapshot_id: proof.report.snapshot_id,
            evidence_refs: proof.evidence_refs.clone(),
            allowed_targets: targets,
            published_at: at,
        };
        self.publish_inner(auth, input, Some(proof))
    }
    /// Legacy candidates remain unverified even when a caller supplies a report hash.
    pub fn publish(
        &mut self,
        auth: &AuthContext,
        input: ReleasePublishInput,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        self.publish_inner(auth, input, None)
    }
    fn publish_inner(
        &mut self,
        auth: &AuthContext,
        input: ReleasePublishInput,
        validation: Option<ValidatedBacktest>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_WRITE)?;
        let mut allowed_targets = input.allowed_targets;
        allowed_targets.sort();
        allowed_targets.dedup();
        if allowed_targets.is_empty() || input.draft_version == 0 || input.name.trim().is_empty() {
            return Err(StrategyReleaseError::InvalidEvidence);
        }
        let mut release = StrategyRelease {
            release_id: ProposalId::new(),
            tenant_id: auth.tenant_id,
            workspace_id: auth.workspace_id,
            validation,
            approval: None,
            draft_id: input.draft_id,
            draft_version: input.draft_version,
            name: input.name,
            source_digest: input.source_digest,
            image_digest: input.image_digest,
            parameter_hash: input.parameter_hash,
            backtest_report_hash: input.backtest_report_hash,
            data_snapshot_id: input.data_snapshot_id,
            evidence_refs: input.evidence_refs,
            allowed_targets,
            approved_at: None,
            approved_by: None,
            content_hash: ContentHash::sha256_bytes(b"pending"),
            created_by: auth.actor_id,
            created_at: input.published_at,
        };
        let content_hash = release.recompute_hash()?;
        release.content_hash = content_hash.clone();
        if release.validation.is_some() && !release.is_verified() {
            return Err(StrategyReleaseError::InvalidEvidence);
        }

        let draft_key = (auth.tenant_id, release.draft_id, release.draft_version);
        if let Some(existing_hash) = self.release_hash_by_draft.get(&draft_key) {
            if *existing_hash == content_hash {
                let existing_id = self
                    .release_id_by_hash
                    .get(&(auth.tenant_id, content_hash.clone()))
                    .expect("hash index is consistent");
                return Ok(self
                    .releases_by_id
                    .get(&(auth.tenant_id, *existing_id))
                    .expect("release index is consistent")
                    .clone());
            }
            return Err(StrategyReleaseError::ContentConflict {
                draft_id: release.draft_id,
                draft_version: release.draft_version,
            });
        }

        self.release_hash_by_draft
            .insert(draft_key, content_hash.clone());
        self.release_id_by_hash
            .insert((auth.tenant_id, content_hash), release.release_id);
        self.releases_by_id
            .insert((auth.tenant_id, release.release_id), release.clone());
        Ok(release)
    }

    pub fn approve(
        &mut self,
        auth: &AuthContext,
        release_id: ProposalId,
        expected: &ContentHash,
        at: DateTime<Utc>,
        expires: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_APPROVE)?;
        let release = self
            .releases_by_id
            .get_mut(&(auth.tenant_id, release_id))
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        release.approve_bound(auth, expected, at, expires)?;
        Ok(release.clone())
    }
    pub fn request_deployment(
        &mut self,
        auth: &AuthContext,
        release_id: ProposalId,
        target: DeploymentTarget,
        requested_at: DateTime<Utc>,
    ) -> Result<DeploymentTicket, StrategyReleaseError> {
        let release = self
            .releases_by_id
            .get(&(auth.tenant_id, release_id))
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        release.authorize_deployment(auth, target, requested_at)?;
        if let Some(ticket) = self
            .tickets
            .iter()
            .find(|t| t.release_id == release_id && t.target == target)
        {
            return Ok(ticket.clone());
        }
        let ticket = DeploymentTicket {
            release_id,
            target,
            requested_by: auth.actor_id,
            requested_at,
        };
        self.tickets.push(ticket.clone());
        Ok(ticket)
    }

    #[must_use]
    pub fn get_release(
        &self,
        tenant_id: TenantId,
        release_id: ProposalId,
    ) -> Option<&StrategyRelease> {
        self.releases_by_id.get(&(tenant_id, release_id))
    }

    #[must_use]
    pub fn tickets(&self) -> &[DeploymentTicket] {
        &self.tickets
    }
}

pub(crate) fn ensure_capability(
    auth: &AuthContext,
    capability: &str,
) -> Result<(), StrategyReleaseError> {
    let parsed = Capability::parse(capability).expect("capability constant parses");
    let requirement = quantos_policy::AuthorizationRequirement::new(parsed).allowing_modes([
        quantos_policy::RunMode::Paper,
        quantos_policy::RunMode::Shadow,
    ]);
    if quantos_policy::PolicyEngine::authorize_action(&auth.policy_context(), &requirement).is_ok()
    {
        return Ok(());
    }
    Err(StrategyReleaseError::Unauthorized {
        capability: capability.to_owned(),
    })
}

/// Shared process-local service. One lock makes approval CAS and ticket dedupe atomic.
/// Tickets authorize only a local Paper/Shadow consumer; no venue/deployment client exists here.
#[derive(Default)]
pub struct ReleaseService(std::sync::Mutex<InMemoryStrategyReleaseStore>);
impl ReleaseService {
    pub fn publish(
        &self,
        auth: &AuthContext,
        proof: ValidatedBacktest,
        targets: Vec<DeploymentTarget>,
        at: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        self.0
            .lock()
            .map_err(|_| StrategyReleaseError::InvalidEvidence)?
            .publish_verified(auth, proof, targets, at)
    }
    pub fn approve(
        &self,
        auth: &AuthContext,
        id: ProposalId,
        hash: &ContentHash,
        at: DateTime<Utc>,
        expires: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        self.0
            .lock()
            .map_err(|_| StrategyReleaseError::InvalidEvidence)?
            .approve(auth, id, hash, at, expires)
    }
    pub fn deploy(
        &self,
        auth: &AuthContext,
        id: ProposalId,
        target: DeploymentTarget,
        at: DateTime<Utc>,
    ) -> Result<DeploymentTicket, StrategyReleaseError> {
        self.0
            .lock()
            .map_err(|_| StrategyReleaseError::InvalidEvidence)?
            .request_deployment(auth, id, target, at)
    }
    /// Build the actual native strategy from the immutable validated Artifact, after
    /// checking the stored ticket. It cannot substitute caller-supplied parameters.
    pub fn consume_adapter(
        &self,
        auth: &AuthContext,
        ticket: &DeploymentTicket,
        at: DateTime<Utc>,
    ) -> Result<crate::generated::GeneratedStrategyAdapter, StrategyReleaseError> {
        let release = self.consume(auth, ticket, at)?;
        crate::generated::GeneratedStrategyAdapter::from_draft_payload(
            &release
                .validation
                .expect("verified consumer")
                .artifact_payload,
        )
        .map_err(|_| StrategyReleaseError::InvalidEvidence)
    }
    pub fn consume(
        &self,
        auth: &AuthContext,
        ticket: &DeploymentTicket,
        at: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        let store = self
            .0
            .lock()
            .map_err(|_| StrategyReleaseError::InvalidEvidence)?;
        if !store.tickets.contains(ticket) {
            return Err(StrategyReleaseError::InvalidEvidence);
        }
        let release = store.get_release(auth.tenant_id, ticket.release_id).ok_or(
            StrategyReleaseError::ReleaseNotFound {
                release_id: ticket.release_id,
            },
        )?;
        release.authorize_deployment(auth, ticket.target, at)?;
        Ok(release.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DraftSaveKind, DraftVersionInput, drafts::DraftService};
    use chrono::Duration;
    use quantos_core::AccountId;
    use quantos_policy::{Role, RunMode};
    use quantos_storage::{
        ArtifactManifest, InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog,
        SnapshotQualityRuleset, default_quality_rules,
    };
    use serde_json::Value;

    fn payload() -> Value {
        json!({"artifact_type":"StrategyDraftArtifact","release_eligible":true,"static_check":{"passed":true,"findings":[]},"strategy":{"rule":"momentum","rule_source":"momentum(close, lookback=6)","parameters":{"lookback":6,"entry_threshold_bps":20,"exit_threshold_bps":-10,"max_position_notional":"1000","universe":["BTCUSDT"]}}})
    }
    fn fixture(
        payload: &Value,
    ) -> (
        AuthContext,
        ValidatedBacktest,
        crate::backtest::BacktestRequest,
    ) {
        let mut request = crate::backtest::tests::honest_request();
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let git = std::process::Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(git.status.success());
        request.candidate.source_commit = String::from_utf8(git.stdout).unwrap().trim().into();
        request.candidate.image_digest =
            ContentHash::sha256_bytes(&std::fs::read(std::env::current_exe().unwrap()).unwrap());
        request.candidate.runtime_digest =
            ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap());
        let now = request.candidate.clock;
        let auth = AuthContext {
            tenant_id: request.snapshot.tenant_id,
            actor_id: ActorId::new(),
            user_id: uuid::Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "s03".into(),
            workspace_name: "S03 owned fixture".into(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::new()),
            capabilities: BTreeSet::from([
                Capability::parse(Capability::STRATEGY_WRITE).unwrap(),
                Capability::parse(Capability::STRATEGY_APPROVE).unwrap(),
            ]),
        };
        let artifact = ArtifactManifest::new(
            auth.tenant_id,
            "application/json",
            ContentHash::sha256_bytes(&canonical_json_bytes(payload).unwrap()),
            "owned-fixture",
            canonical_json_bytes(payload).unwrap().len() as u64,
            now,
        );
        let reference = DraftArtifactRef {
            artifact_id: artifact.artifact_id,
            content_hash: artifact.content_hash.clone(),
        };
        let mut artifacts = InMemoryArtifactCatalog::new();
        artifacts.upsert(artifact);
        let mut snapshots = InMemoryDataSnapshotCatalog::new();
        snapshots.upsert(request.snapshot.clone()).unwrap();
        let drafts = DraftService::new(
            snapshots,
            artifacts,
            SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now)).unwrap(),
        );
        let draft = drafts.create(&auth, "S03 strategy", now).unwrap();
        drafts
            .save(
                &auth,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    parameters: payload["strategy"].clone(),
                    data_snapshot_id: Some(request.snapshot.snapshot_id),
                    artifact_refs: vec![reference],
                    base_version: 0,
                    save_kind: DraftSaveKind::Manual,
                    saved_at: now,
                },
            )
            .unwrap();
        let proof = drafts
            .validated_backtest(&auth, draft.draft_id, request.clone(), payload)
            .unwrap();
        (auth, proof, request)
    }
    fn targets() -> Vec<DeploymentTarget> {
        vec![DeploymentTarget::Paper, DeploymentTarget::Shadow]
    }

    #[test]
    fn s03_targets_exclude_assisted_live_and_unknown_json() {
        for value in ["assisted_live", "ASSISTED_LIVE", "live", "paper_live", ""] {
            assert!(DeploymentTarget::parse(value).is_err());
            assert!(serde_json::from_value::<DeploymentTarget>(json!(value)).is_err());
        }
        assert_eq!(
            DeploymentTarget::m3_m4_allowed(),
            BTreeSet::from([DeploymentTarget::Paper, DeploymentTarget::Shadow])
        );
    }
    #[test]
    fn s03_hundred_unverified_or_unapproved_deployments_are_rejected() {
        let (auth, proof, _) = fixture(&payload());
        let at = proof.report.generated_at;
        let mut store = InMemoryStrategyReleaseStore::new();
        let verified = store
            .publish_verified(&auth, proof.clone(), targets(), at)
            .unwrap();
        let unverified = store
            .publish(
                &auth,
                ReleasePublishInput {
                    draft_id: StrategyDraftId::new(),
                    draft_version: 1,
                    name: "forged hash".into(),
                    source_digest: verified.source_digest.clone(),
                    image_digest: verified.image_digest.clone(),
                    parameter_hash: verified.parameter_hash.clone(),
                    backtest_report_hash: verified.backtest_report_hash.clone(),
                    data_snapshot_id: verified.data_snapshot_id,
                    evidence_refs: vec![],
                    allowed_targets: targets(),
                    published_at: at,
                },
            )
            .unwrap();
        assert!(!unverified.is_verified());
        assert!(verified.is_verified());
        for _ in 0..50 {
            for release in [&unverified, &verified] {
                assert!(matches!(
                    store.request_deployment(
                        &auth,
                        release.release_id,
                        DeploymentTarget::Paper,
                        at
                    ),
                    Err(StrategyReleaseError::DeploymentRejected { .. })
                ));
            }
        }
        assert!(store.tickets().is_empty());
        assert!(
            store
                .approve(
                    &auth,
                    unverified.release_id,
                    &unverified.content_hash,
                    at,
                    at + Duration::hours(1)
                )
                .is_err()
        );
    }
    #[test]
    fn s03_dedupe_and_content_conflict_are_deterministic() {
        let (auth, proof, _) = fixture(&payload());
        let at = proof.report.generated_at;
        let mut store = InMemoryStrategyReleaseStore::new();
        let first = store
            .publish_verified(&auth, proof.clone(), targets(), at)
            .unwrap();
        let second = store
            .publish_verified(
                &auth,
                proof.clone(),
                vec![
                    DeploymentTarget::Shadow,
                    DeploymentTarget::Paper,
                    DeploymentTarget::Paper,
                ],
                at + Duration::seconds(1),
            )
            .unwrap();
        assert_eq!(first, second);
        assert!(matches!(
            store.publish_verified(&auth, proof, vec![DeploymentTarget::Paper], at),
            Err(StrategyReleaseError::ContentConflict { .. })
        ));
    }
    #[test]
    fn s03_scope_capability_hash_expiry_and_tampering_fail_closed() {
        let (auth, proof, _) = fixture(&payload());
        let at = proof.report.generated_at;
        let service = ReleaseService::default();
        let r = service
            .publish(&auth, proof.clone(), targets(), at)
            .unwrap();
        let expires = at + Duration::hours(1);
        for scope in 0..4 {
            let mut foreign = auth.clone();
            match scope {
                0 => foreign.tenant_id = TenantId::new(),
                1 => foreign.workspace_id = WorkspaceId::new(),
                2 => foreign.capabilities.clear(),
                _ => foreign.mode = RunMode::AssistedLive,
            }
            assert!(
                service
                    .publish(&foreign, proof.clone(), targets(), at)
                    .is_err()
            );
            assert!(
                service
                    .approve(&foreign, r.release_id, &r.content_hash, at, expires)
                    .is_err()
            );
            assert!(
                service
                    .deploy(&foreign, r.release_id, DeploymentTarget::Paper, at)
                    .is_err()
            );
        }
        assert!(
            service
                .approve(
                    &auth,
                    r.release_id,
                    &ContentHash::sha256_bytes(b"wrong"),
                    at,
                    expires
                )
                .is_err()
        );
        for (time, end) in [
            (at - Duration::seconds(1), expires),
            (at, at),
            (at, proof.valid_until + Duration::seconds(1)),
        ] {
            assert!(
                service
                    .approve(&auth, r.release_id, &r.content_hash, time, end)
                    .is_err()
            );
        }
        let approved = service
            .approve(&auth, r.release_id, &r.content_hash, at, expires)
            .unwrap();
        assert_eq!(approved.content_hash, r.content_hash);
        for field in 0..10 {
            let mut forged = approved.clone();
            match field {
                0 => forged.source_digest = "b".repeat(40),
                1 => forged.image_digest = ContentHash::sha256_bytes(b"bad").to_string(),
                2 => forged.parameter_hash = ContentHash::sha256_bytes(b"bad"),
                3 => forged.data_snapshot_id = SnapshotId::new(),
                4 => forged.allowed_targets.clear(),
                5 => forged.evidence_refs.clear(),
                6 => {
                    forged.approval.as_mut().unwrap().content_hash =
                        ContentHash::sha256_bytes(b"wrong")
                }
                8 => forged.approved_by = Some(ActorId::new()),
                9 => forged.approved_at = Some(at + chrono::Duration::seconds(1)),
                _ => forged.validation.as_mut().unwrap().report.costs.fees_total += 1.0,
            }
            assert!(
                !DeploymentPolicy::evaluate_at(&forged, DeploymentTarget::Paper, at).is_empty()
            );
        }
        assert!(
            service
                .deploy(&auth, r.release_id, DeploymentTarget::Paper, expires)
                .is_err()
        );
        assert!(
            service
                .deploy(
                    &auth,
                    r.release_id,
                    DeploymentTarget::Paper,
                    at - Duration::seconds(1)
                )
                .is_err()
        );
        assert!(
            service
                .publish(
                    &auth,
                    proof.clone(),
                    targets(),
                    proof.valid_until + Duration::seconds(1)
                )
                .is_err()
        );
        let ticket = service
            .deploy(&auth, r.release_id, DeploymentTarget::Paper, at)
            .unwrap();
        assert!(service.consume(&auth, &ticket, expires).is_err());
        let mut fake = ticket.clone();
        fake.requested_by = ActorId::new();
        assert!(service.consume(&auth, &fake, at).is_err());
        assert_eq!(
            service.consume(&auth, &ticket, at).unwrap().content_hash,
            r.content_hash
        );
    }
    #[test]
    fn s03_concurrent_approval_and_deployment_are_atomic_and_idempotent() {
        let (auth, proof, _) = fixture(&payload());
        let at = proof.report.generated_at;
        let service = std::sync::Arc::new(ReleaseService::default());
        let r = service.publish(&auth, proof, targets(), at).unwrap();
        let outcomes = std::thread::scope(|scope| {
            let handles: Vec<_> = (0..20)
                .map(|_| {
                    scope.spawn(|| {
                        service.approve(
                            &auth,
                            r.release_id,
                            &r.content_hash,
                            at,
                            at + Duration::hours(1),
                        )
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().unwrap().is_ok())
                .collect::<Vec<_>>()
        });
        assert_eq!(outcomes.into_iter().filter(|v| *v).count(), 1);
        let tickets = std::thread::scope(|scope| {
            let handles: Vec<_> = (0..20)
                .map(|_| {
                    scope.spawn(|| {
                        service
                            .deploy(&auth, r.release_id, DeploymentTarget::Paper, at)
                            .unwrap()
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().unwrap())
                .collect::<Vec<_>>()
        });
        assert!(tickets.iter().all(|t| t == &tickets[0]));
        assert_eq!(service.0.lock().unwrap().tickets().len(), 1);
    }
    #[test]
    fn s03_owned_process_backtest_release_reject_recover_and_consume() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let output = std::process::Command::new(root.join("engines/.venv/bin/python"))
            .arg(root.join("scripts/tp06-produce.py"))
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let values: Vec<Value> = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(values.len(), 102);
        let (auth, proof, mut request) = fixture(&values[0]);
        request.draft = proof.report.draft.clone();
        let baseline = proof.report.clone();
        let at = proof.report.generated_at;
        let service = ReleaseService::default();
        let r = service.publish(&auth, proof, targets(), at).unwrap();
        assert!(
            service
                .deploy(&auth, r.release_id, DeploymentTarget::Paper, at)
                .is_err()
        );
        let approved = service
            .approve(
                &auth,
                r.release_id,
                &r.content_hash,
                at,
                at + Duration::hours(1),
            )
            .unwrap();
        let mut consumed = Vec::new();
        let mut consumer_replay_hashes = Vec::new();
        for target in targets() {
            let ticket = service.deploy(&auth, r.release_id, target, at).unwrap();
            let config = service.consume(&auth, &ticket, at).unwrap();
            assert_eq!(config.content_hash, approved.content_hash);
            assert_eq!(
                config.parameter_hash,
                config.validation.as_ref().unwrap().report.parameter_hash
            );
            let mut adapter = service.consume_adapter(&auth, &ticket, at).unwrap();
            let replay = crate::backtest::run_backtest(&request, &mut adapter).unwrap();
            assert_eq!(replay, baseline);
            consumer_replay_hashes.push(replay.report_hash);
            consumed.push(ticket.target);
        }
        println!("S03_RELEASE_EVIDENCE={}",serde_json::to_string(&json!({"release":approved,"consumed_targets":consumed,"consumer_replay_hashes":consumer_replay_hashes,"unapproved_rejected":true,"externalPublished":false})).unwrap());
    }
}
