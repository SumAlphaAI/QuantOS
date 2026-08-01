use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ContentHash, CoreError, ProposalId, SnapshotId, StrategyDraftId, TenantId,
    canonical_json_bytes,
};
use quantos_policy::Capability;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

use crate::DraftArtifactRef;

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StrategyRelease {
    pub release_id: ProposalId,
    pub tenant_id: TenantId,
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
    #[must_use]
    pub fn is_verified(&self) -> bool {
        self.backtest_report_hash.is_some()
    }

    #[must_use]
    pub fn is_approved(&self) -> bool {
        self.approved_at.is_some()
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
    TargetNotAllowed,
}

impl DeploymentViolation {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ReleaseUnverified => "release_unverified",
            Self::ReleaseUnapproved => "release_unapproved",
            Self::TargetNotAllowed => "target_not_allowed",
        }
    }
}

#[derive(Debug, Error)]
pub enum StrategyReleaseError {
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
        let mut violations = Vec::new();
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

    pub fn publish(
        &mut self,
        auth: &AuthContext,
        input: ReleasePublishInput,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_WRITE)?;
        let mut allowed_targets = input.allowed_targets;
        allowed_targets.sort();
        allowed_targets.dedup();
        let content_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "draft_id": input.draft_id.to_string(),
            "draft_version": input.draft_version,
            "name": input.name,
            "source_digest": input.source_digest,
            "image_digest": input.image_digest,
            "parameter_hash": input.parameter_hash.as_str(),
            "backtest_report_hash": input.backtest_report_hash.as_ref().map(|hash| hash.as_str()),
            "data_snapshot_id": input.data_snapshot_id.to_string(),
            "evidence_refs": input.evidence_refs,
            "allowed_targets": allowed_targets.iter().map(|target| target.as_str()).collect::<Vec<_>>(),
        }))?);

        let draft_key = (auth.tenant_id, input.draft_id, input.draft_version);
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
                draft_id: input.draft_id,
                draft_version: input.draft_version,
            });
        }

        let release = StrategyRelease {
            release_id: ProposalId::new(),
            tenant_id: auth.tenant_id,
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
            content_hash: content_hash.clone(),
            created_by: auth.actor_id,
            created_at: input.published_at,
        };
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
        approved_at: DateTime<Utc>,
    ) -> Result<StrategyRelease, StrategyReleaseError> {
        ensure_capability(auth, Capability::STRATEGY_APPROVE)?;
        let release = self
            .releases_by_id
            .get_mut(&(auth.tenant_id, release_id))
            .ok_or(StrategyReleaseError::ReleaseNotFound { release_id })?;
        if release.approved_at.is_some() {
            return Err(StrategyReleaseError::AlreadyApproved { release_id });
        }
        release.approved_at = Some(approved_at);
        release.approved_by = Some(auth.actor_id);
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
        let violations = DeploymentPolicy::evaluate(release, target);
        if !violations.is_empty() {
            return Err(StrategyReleaseError::DeploymentRejected {
                violations: violations
                    .iter()
                    .map(|violation| violation.as_str())
                    .collect::<Vec<_>>()
                    .join(","),
            });
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

fn ensure_capability(auth: &AuthContext, capability: &str) -> Result<(), StrategyReleaseError> {
    let parsed = Capability::parse(capability).expect("capability constant parses");
    if auth.capabilities.contains(&parsed) {
        return Ok(());
    }
    Err(StrategyReleaseError::Unauthorized {
        capability: capability.to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use chrono::{TimeZone, Utc};
    use quantos_core::{AccountId, ArtifactId, SnapshotId, WorkspaceId};
    use quantos_policy::{Role, RunMode};

    use super::*;

    fn auth_context(capabilities: &[&str]) -> AuthContext {
        auth_context_for(TenantId::new(), capabilities)
    }

    fn auth_context_for(tenant_id: TenantId, capabilities: &[&str]) -> AuthContext {
        AuthContext {
            tenant_id,
            actor_id: ActorId::new(),
            user_id: uuid::Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "primary".to_owned(),
            workspace_name: "Primary".to_owned(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::new()),
            capabilities: capabilities
                .iter()
                .map(|value| Capability::parse(value).expect("capability parses"))
                .collect::<BTreeSet<_>>(),
        }
    }

    fn fixed_now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn publish_input(draft_id: StrategyDraftId, verified: bool) -> ReleasePublishInput {
        ReleasePublishInput {
            draft_id,
            draft_version: 3,
            name: "trend.alpha".to_owned(),
            source_digest: "sha256:source".to_owned(),
            image_digest: "sha256:image".to_owned(),
            parameter_hash: ContentHash::sha256_bytes(br#"{"params":"v3"}"#),
            backtest_report_hash: verified
                .then(|| ContentHash::sha256_bytes(br#"{"backtest":"report"}"#)),
            data_snapshot_id: SnapshotId::new(),
            evidence_refs: vec![DraftArtifactRef {
                artifact_id: ArtifactId::new(),
                content_hash: ContentHash::sha256_bytes(br#"{"artifact":"evidence"}"#),
            }],
            allowed_targets: vec![DeploymentTarget::Paper, DeploymentTarget::Shadow],
            published_at: fixed_now(),
        }
    }

    #[test]
    fn assisted_live_is_not_representable_before_m5() {
        let error =
            DeploymentTarget::parse("assisted_live").expect_err("assisted live must not parse");
        assert!(matches!(
            error,
            StrategyReleaseError::UnsupportedDeploymentTarget { .. }
        ));
        let error = DeploymentTarget::parse("ASSISTED_LIVE")
            .expect_err("case variants must not parse either");
        assert!(matches!(
            error,
            StrategyReleaseError::UnsupportedDeploymentTarget { .. }
        ));
        assert_eq!(
            DeploymentTarget::m3_m4_allowed(),
            BTreeSet::from([DeploymentTarget::Paper, DeploymentTarget::Shadow])
        );
    }

    #[test]
    fn hundred_unverified_or_unapproved_deployments_are_all_rejected() {
        let publisher = auth_context(&[Capability::STRATEGY_WRITE]);
        let mut store = InMemoryStrategyReleaseStore::new();
        let unverified = store
            .publish(&publisher, publish_input(StrategyDraftId::new(), false))
            .expect("unverified release publishes");
        let verified = store
            .publish(&publisher, publish_input(StrategyDraftId::new(), true))
            .expect("verified release publishes");

        let mut rejected = 0_u32;
        for index in 0..50_u32 {
            let target = if index % 2 == 0 {
                DeploymentTarget::Paper
            } else {
                DeploymentTarget::Shadow
            };
            let unverified_error = store
                .request_deployment(&publisher, unverified.release_id, target, fixed_now())
                .expect_err("unverified release must not deploy");
            assert!(matches!(
                unverified_error,
                StrategyReleaseError::DeploymentRejected { .. }
            ));
            rejected += 1;

            let unapproved_error = store
                .request_deployment(&publisher, verified.release_id, target, fixed_now())
                .expect_err("unapproved release must not deploy");
            assert!(matches!(
                unapproved_error,
                StrategyReleaseError::DeploymentRejected { .. }
            ));
            rejected += 1;
        }
        assert_eq!(rejected, 100);
        assert!(store.tickets().is_empty());
    }

    #[test]
    fn duplicate_publish_returns_same_hash_and_modified_content_conflicts() {
        let publisher = auth_context(&[Capability::STRATEGY_WRITE]);
        let draft_id = StrategyDraftId::new();
        let mut store = InMemoryStrategyReleaseStore::new();

        let input = publish_input(draft_id, true);
        let first = store
            .publish(&publisher, input.clone())
            .expect("first publish succeeds");
        let second = store
            .publish(&publisher, input.clone())
            .expect("identical publish dedupes");
        assert_eq!(first.release_id, second.release_id);
        assert_eq!(first.content_hash, second.content_hash);

        let mut modified = input;
        modified.source_digest = "sha256:source-v2".to_owned();
        let error = store
            .publish(&publisher, modified)
            .expect_err("modified content for same draft version conflicts");
        assert!(matches!(
            error,
            StrategyReleaseError::ContentConflict { .. }
        ));
    }

    #[test]
    fn approved_release_deploys_to_paper_and_shadow_and_stays_immutable() {
        let publisher = auth_context(&[Capability::STRATEGY_WRITE]);
        let approver = auth_context_for(publisher.tenant_id, &[Capability::STRATEGY_APPROVE]);
        let mut store = InMemoryStrategyReleaseStore::new();
        let release = store
            .publish(&publisher, publish_input(StrategyDraftId::new(), true))
            .expect("release publishes");
        let content_hash_before = release.content_hash.clone();

        let unauthorized = auth_context_for(publisher.tenant_id, &[]);
        let error = store
            .approve(&unauthorized, release.release_id, fixed_now())
            .expect_err("unauthorized approval rejected");
        assert!(matches!(error, StrategyReleaseError::Unauthorized { .. }));

        let approved = store
            .approve(&approver, release.release_id, fixed_now())
            .expect("approval succeeds");
        assert!(approved.is_approved());
        assert_eq!(approved.content_hash, content_hash_before);
        assert_eq!(
            store
                .get_release(publisher.tenant_id, release.release_id)
                .expect("release exists")
                .content_hash,
            content_hash_before
        );

        let paper = store
            .request_deployment(
                &publisher,
                release.release_id,
                DeploymentTarget::Paper,
                fixed_now(),
            )
            .expect("paper deployment tickets");
        let shadow = store
            .request_deployment(
                &publisher,
                release.release_id,
                DeploymentTarget::Shadow,
                fixed_now(),
            )
            .expect("shadow deployment tickets");
        assert_eq!(paper.target, DeploymentTarget::Paper);
        assert_eq!(shadow.target, DeploymentTarget::Shadow);
        assert_eq!(store.tickets().len(), 2);
    }
}
