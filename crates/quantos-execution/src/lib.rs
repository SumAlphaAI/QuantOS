pub mod dual;
pub mod gateway;
pub mod paper;
pub mod venue;
pub mod zone;

use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{
    ActorId, CommandId, ContentHash, CoreError, DecisionId, TenantId, canonical_json_bytes,
};
use quantos_risk::{RiskDecision, RiskVerdict};
use quantos_runtime::signal_proposal::{TradeProposalEvaluationGate, TradeProposalRecord};
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

pub const EXECUTION_SIGNER: &str = "quantos-execution.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VenueKind {
    Cex,
    Dex,
}

impl VenueKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Cex => "cex",
            Self::Dex => "dex",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderIntent {
    Market,
    Limit,
    Stop,
    StopLimit,
}

impl OrderIntent {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Market => "market",
            Self::Limit => "limit",
            Self::Stop => "stop",
            Self::StopLimit => "stop_limit",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderSide {
    Buy,
    Sell,
}

impl OrderSide {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Buy => "buy",
            Self::Sell => "sell",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApprovalRecord {
    pub decision_id: DecisionId,
    pub approver: ActorId,
    pub approved_at: DateTime<Utc>,
    pub signature: String,
}

impl ApprovalRecord {
    /// Deterministic approval signature over (decision, approver, time).
    #[must_use]
    pub fn sign(decision_id: DecisionId, approver: ActorId, approved_at: DateTime<Utc>) -> String {
        ContentHash::sha256_bytes(
            &canonical_json_bytes(&json!({
                "decision_id": decision_id.to_string(),
                "approver": approver.to_string(),
                "approved_at": approved_at,
            }))
            .expect("approval payload canonicalizes"),
        )
        .to_string()
    }

    #[must_use]
    pub fn new(decision_id: DecisionId, approver: ActorId, approved_at: DateTime<Utc>) -> Self {
        Self {
            decision_id,
            approver,
            approved_at,
            signature: Self::sign(decision_id, approver, approved_at),
        }
    }
}

#[derive(Debug, Error)]
pub enum ApprovalVerificationError {
    #[error("APPROVAL_DECISION_MISMATCH: approval targets a different risk decision")]
    DecisionMismatch,
    #[error("APPROVAL_SIGNATURE_INVALID: approval signature does not verify")]
    InvalidSignature,
}

pub struct ApprovalVerifier;

impl ApprovalVerifier {
    pub fn verify(
        approval: &ApprovalRecord,
        decision: &RiskDecision,
    ) -> Result<(), ApprovalVerificationError> {
        if approval.decision_id != decision.decision_id {
            return Err(ApprovalVerificationError::DecisionMismatch);
        }
        let expected = ApprovalRecord::sign(
            approval.decision_id,
            approval.approver,
            approval.approved_at,
        );
        if approval.signature != expected {
            return Err(ApprovalVerificationError::InvalidSignature);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TradeCommand {
    pub command_id: CommandId,
    pub decision_id: DecisionId,
    pub account_id: String,
    pub venue: String,
    pub venue_kind: VenueKind,
    pub symbol: String,
    pub intent: OrderIntent,
    pub side: OrderSide,
    pub quantity: String,
    pub limit_price: Option<String>,
    pub stop_price: Option<String>,
    pub idempotency_key: String,
    pub approval_signature: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub signature: ContentHash,
    pub issued_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct IssuanceInput {
    pub venue: String,
    pub venue_kind: VenueKind,
    pub intent: OrderIntent,
    pub side: OrderSide,
    pub quantity: String,
    pub limit_price: Option<String>,
    pub stop_price: Option<String>,
    pub idempotency_key: String,
    pub proposal_originator: ActorId,
    pub approval: Option<ApprovalRecord>,
    pub release_valid: bool,
    pub kill_switch_engaged: bool,
    pub data_expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IssuanceRejection {
    ProposalExpired,
    DuplicateApproval,
    SelfApproval,
    StaleData,
    KillSwitchEngaged,
    ReleaseInvalid,
    ApprovalMissing,
}

impl std::fmt::Display for IssuanceRejection {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl IssuanceRejection {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ProposalExpired => "proposal_expired",
            Self::DuplicateApproval => "duplicate_approval",
            Self::SelfApproval => "self_approval",
            Self::StaleData => "stale_data",
            Self::KillSwitchEngaged => "kill_switch_engaged",
            Self::ReleaseInvalid => "release_invalid",
            Self::ApprovalMissing => "approval_missing",
        }
    }
}

#[derive(Debug, Error)]
pub enum IssuanceError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("TRADE_COMMAND_REJECTED: {rejection}")]
    Rejected { rejection: IssuanceRejection },
}

#[derive(Debug, Clone)]
pub struct CommandIssuer {
    tenant_id: TenantId,
    command_ttl: ChronoDuration,
    issued_by_key: BTreeMap<String, TradeCommand>,
    consumed_approvals: BTreeSet<(DecisionId, ActorId)>,
}

impl CommandIssuer {
    #[must_use]
    pub fn new(tenant_id: TenantId, command_ttl: ChronoDuration) -> Self {
        Self {
            tenant_id,
            command_ttl,
            issued_by_key: BTreeMap::new(),
            consumed_approvals: BTreeSet::new(),
        }
    }

    /// Issue a short-lived, signed, idempotent TradeCommand from a valid proposal,
    /// risk decision, and (when required) approval. Re-issuing with the same
    /// idempotency key returns the already-issued command.
    pub fn issue(
        &mut self,
        proposal: &TradeProposalRecord,
        decision: &RiskDecision,
        input: IssuanceInput,
        requested_by: ActorId,
        requested_at: DateTime<Utc>,
    ) -> Result<TradeCommand, IssuanceError> {
        let key = format!("{}:{}", self.tenant_id, input.idempotency_key);
        if let Some(existing) = self.issued_by_key.get(&key) {
            return Ok(existing.clone());
        }

        if input.kill_switch_engaged {
            return Err(reject(IssuanceRejection::KillSwitchEngaged));
        }
        if !input.release_valid {
            return Err(reject(IssuanceRejection::ReleaseInvalid));
        }
        if TradeProposalEvaluationGate::ensure_evaluable(proposal, requested_at).is_err() {
            return Err(reject(IssuanceRejection::ProposalExpired));
        }
        if input.data_expires_at <= requested_at {
            return Err(reject(IssuanceRejection::StaleData));
        }

        let approval_signature = match decision.verdict {
            RiskVerdict::Allow => None,
            RiskVerdict::ApprovalRequired => {
                let approval = input
                    .approval
                    .as_ref()
                    .ok_or(reject(IssuanceRejection::ApprovalMissing))?;
                if approval.approver == input.proposal_originator
                    || approval.approver == requested_by
                {
                    return Err(reject(IssuanceRejection::SelfApproval));
                }
                if ApprovalVerifier::verify(approval, decision).is_err() {
                    return Err(reject(IssuanceRejection::ApprovalMissing));
                }
                let consumption_key = (approval.decision_id, approval.approver);
                if !self.consumed_approvals.insert(consumption_key) {
                    return Err(reject(IssuanceRejection::DuplicateApproval));
                }
                Some(approval.signature.clone())
            }
            RiskVerdict::Deny => {
                return Err(reject(IssuanceRejection::ApprovalMissing));
            }
        };

        let expires_at = proposal
            .expires_at
            .min(requested_at + self.command_ttl)
            .min(input.data_expires_at);
        let signature = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "signer": EXECUTION_SIGNER,
            "proposal_id": proposal.proposal_id,
            "decision_id": decision.decision_id.to_string(),
            "account_id": proposal.account_id,
            "venue": input.venue,
            "venue_kind": input.venue_kind.as_str(),
            "symbol": proposal.symbol,
            "intent": input.intent.as_str(),
            "side": input.side.as_str(),
            "quantity": input.quantity,
            "limit_price": input.limit_price,
            "stop_price": input.stop_price,
            "idempotency_key": input.idempotency_key,
            "approval_signature": approval_signature,
            "expires_at": expires_at,
            "issued_at": requested_at,
        }))?);
        let command = TradeCommand {
            command_id: CommandId::new(),
            decision_id: decision.decision_id,
            account_id: proposal.account_id.clone(),
            venue: input.venue,
            venue_kind: input.venue_kind,
            symbol: proposal.symbol.clone(),
            intent: input.intent,
            side: input.side,
            quantity: input.quantity,
            limit_price: input.limit_price,
            stop_price: input.stop_price,
            idempotency_key: input.idempotency_key,
            approval_signature,
            expires_at,
            signature,
            issued_at: requested_at,
        };
        self.issued_by_key.insert(key, command.clone());
        Ok(command)
    }

    #[must_use]
    pub fn issued_count(&self) -> usize {
        self.issued_by_key.len()
    }
}

fn reject(rejection: IssuanceRejection) -> IssuanceError {
    IssuanceError::Rejected { rejection }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeSet,
        sync::{Arc, Barrier, Mutex},
        thread,
        time::Instant,
    };

    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{ArtifactId, ContentHash, TenantId, WorkflowRunId};
    use quantos_runtime::signal_proposal::{
        TradeProposalRecord, WorkflowEvidenceRecord, WorkflowStreamEvent,
    };
    use quantos_storage::ArtifactManifest;

    use super::*;

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn proposal_fixture(originator: ActorId, expires_at: DateTime<Utc>) -> TradeProposalRecord {
        let _ = originator;
        let tenant_id = TenantId::new();
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            ContentHash::sha256_bytes(br#"{"proposal":"fixture"}"#),
            "quantos-artifacts",
            24,
            now(),
        );
        TradeProposalRecord {
            workflow_run_id: WorkflowRunId::new(),
            artifact_manifest: manifest,
            auxiliary_artifact_manifests: vec![],
            capability: "decision.proposal.v1".to_owned(),
            proposal_id: "proposal:fixture".to_owned(),
            account_id: "paper-account-0".to_owned(),
            symbol: "BTCUSDT".to_owned(),
            signal_id: "signal:fixture".to_owned(),
            signal_artifact_id: ArtifactId::new(),
            executable: false,
            expires_at,
            evidence_refs: vec![WorkflowEvidenceRecord {
                evidence_id: "evidence:1".to_owned(),
                artifact_id: "committee:1".to_owned(),
                summary: "supporting view".to_owned(),
            }],
            counter_views: vec!["counter: overheated momentum".to_owned()],
            engine_artifact_ids: vec!["committee:1".to_owned()],
            output: serde_json::json!({"proposal": "fixture"}),
            stream_events: Vec::<WorkflowStreamEvent>::new(),
            created_at: now(),
        }
    }

    fn decision_fixture(verdict: RiskVerdict) -> RiskDecision {
        RiskDecision {
            decision_id: DecisionId::new(),
            verdict,
            hit_rules: vec![],
            limit_ids: vec![],
            signer: quantos_risk::RISK_ENGINE_VERSION.to_owned(),
            reason: "fixture decision".to_owned(),
            signature: ContentHash::sha256_bytes(br#"{"decision":"fixture"}"#),
            decided_at: now(),
        }
    }

    #[derive(Clone)]
    struct FixtureActors {
        originator: ActorId,
        approver: ActorId,
        requester: ActorId,
    }

    fn actors() -> FixtureActors {
        FixtureActors {
            originator: ActorId::new(),
            approver: ActorId::new(),
            requester: ActorId::new(),
        }
    }

    fn baseline_input(actors: &FixtureActors, key: &str) -> IssuanceInput {
        IssuanceInput {
            venue: "paper-venue".to_owned(),
            venue_kind: VenueKind::Cex,
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: "1.5".to_owned(),
            limit_price: Some("100.25".to_owned()),
            stop_price: None,
            idempotency_key: key.to_owned(),
            proposal_originator: actors.originator,
            approval: None,
            release_valid: true,
            kill_switch_engaged: false,
            data_expires_at: now() + ChronoDuration::minutes(5),
        }
    }

    #[test]
    fn seven_rejection_classes_are_all_enforced() {
        let tenant_id = TenantId::new();
        let actors = actors();
        let mut rejected = BTreeSet::new();

        // 1. proposal expired
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let expired_proposal =
            proposal_fixture(actors.originator, now() - ChronoDuration::seconds(1));
        let error = issuer
            .issue(
                &expired_proposal,
                &decision_fixture(RiskVerdict::Allow),
                baseline_input(&actors, "expired"),
                actors.requester,
                now(),
            )
            .expect_err("expired proposal rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::ProposalExpired
            }
        ));
        rejected.insert(IssuanceRejection::ProposalExpired.as_str());

        // 2. duplicate approval consumption
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let decision = decision_fixture(RiskVerdict::ApprovalRequired);
        let approval = ApprovalRecord::new(decision.decision_id, actors.approver, now());
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        issuer
            .issue(
                &proposal,
                &decision,
                IssuanceInput {
                    approval: Some(approval.clone()),
                    ..baseline_input(&actors, "dup-approval-1")
                },
                actors.requester,
                now(),
            )
            .expect("first approval use succeeds");
        let error = issuer
            .issue(
                &proposal,
                &decision,
                IssuanceInput {
                    approval: Some(approval),
                    ..baseline_input(&actors, "dup-approval-2")
                },
                actors.requester,
                now(),
            )
            .expect_err("reused approval rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::DuplicateApproval
            }
        ));
        rejected.insert(IssuanceRejection::DuplicateApproval.as_str());

        // 3. self approval
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let decision = decision_fixture(RiskVerdict::ApprovalRequired);
        let self_approval = ApprovalRecord::new(decision.decision_id, actors.originator, now());
        let error = issuer
            .issue(
                &proposal,
                &decision,
                IssuanceInput {
                    approval: Some(self_approval),
                    ..baseline_input(&actors, "self-approval")
                },
                actors.requester,
                now(),
            )
            .expect_err("self approval rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::SelfApproval
            }
        ));
        rejected.insert(IssuanceRejection::SelfApproval.as_str());

        // 4. stale data
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let error = issuer
            .issue(
                &proposal,
                &decision_fixture(RiskVerdict::Allow),
                IssuanceInput {
                    data_expires_at: now() - ChronoDuration::seconds(1),
                    ..baseline_input(&actors, "stale")
                },
                actors.requester,
                now(),
            )
            .expect_err("stale data rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::StaleData
            }
        ));
        rejected.insert(IssuanceRejection::StaleData.as_str());

        // 5. kill switch
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let error = issuer
            .issue(
                &proposal,
                &decision_fixture(RiskVerdict::Allow),
                IssuanceInput {
                    kill_switch_engaged: true,
                    ..baseline_input(&actors, "kill-switch")
                },
                actors.requester,
                now(),
            )
            .expect_err("kill switch rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::KillSwitchEngaged
            }
        ));
        rejected.insert(IssuanceRejection::KillSwitchEngaged.as_str());

        // 6. invalid strategy release
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let error = issuer
            .issue(
                &proposal,
                &decision_fixture(RiskVerdict::Allow),
                IssuanceInput {
                    release_valid: false,
                    ..baseline_input(&actors, "release-invalid")
                },
                actors.requester,
                now(),
            )
            .expect_err("invalid release rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::ReleaseInvalid
            }
        ));
        rejected.insert(IssuanceRejection::ReleaseInvalid.as_str());

        // 7. missing approval for approval-required decision / deny verdict
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));
        let error = issuer
            .issue(
                &proposal,
                &decision_fixture(RiskVerdict::ApprovalRequired),
                baseline_input(&actors, "approval-missing"),
                actors.requester,
                now(),
            )
            .expect_err("missing approval rejected");
        assert!(matches!(
            error,
            IssuanceError::Rejected {
                rejection: IssuanceRejection::ApprovalMissing
            }
        ));
        rejected.insert(IssuanceRejection::ApprovalMissing.as_str());

        assert_eq!(rejected.len(), 7);
    }

    #[test]
    fn thousand_concurrent_issuances_with_same_key_emit_exactly_one_command() {
        let tenant_id = TenantId::new();
        let actors = actors();
        let proposal = Arc::new(proposal_fixture(
            actors.originator,
            now() + ChronoDuration::minutes(10),
        ));
        let decision = Arc::new(decision_fixture(RiskVerdict::Allow));
        let issuer = Arc::new(Mutex::new(CommandIssuer::new(
            tenant_id,
            ChronoDuration::minutes(2),
        )));
        let barrier = Arc::new(Barrier::new(32));

        let mut handles = Vec::new();
        for _ in 0..32 {
            let issuer = Arc::clone(&issuer);
            let proposal = Arc::clone(&proposal);
            let decision = Arc::clone(&decision);
            let barrier = Arc::clone(&barrier);
            let actors = actors.clone();
            handles.push(thread::spawn(move || {
                let mut issued = Vec::new();
                barrier.wait();
                for _ in 0..32 {
                    let input = baseline_input(&actors, "shared-key");
                    let command = issuer
                        .lock()
                        .expect("issuer lock")
                        .issue(&proposal, &decision, input, actors.requester, now())
                        .expect("issuance succeeds");
                    issued.push(command);
                }
                issued
            }));
        }

        let mut command_ids = BTreeSet::new();
        let mut signatures = BTreeSet::new();
        let mut total = 0_usize;
        for handle in handles {
            for command in handle.join().expect("thread joins") {
                command_ids.insert(command.command_id);
                signatures.insert(command.signature);
                total += 1;
            }
        }
        assert!(total >= 1_000);
        assert_eq!(command_ids.len(), 1);
        assert_eq!(signatures.len(), 1);
        assert_eq!(issuer.lock().expect("issuer lock").issued_count(), 1);
    }

    #[test]
    fn issuance_stays_under_two_hundred_millis_p95_and_is_short_lived() {
        let tenant_id = TenantId::new();
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::Allow);
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));

        let mut durations = Vec::new();
        for index in 0..200_u32 {
            let started = Instant::now();
            let command = issuer
                .issue(
                    &proposal,
                    &decision,
                    baseline_input(&actors, &format!("latency-{index:04}")),
                    actors.requester,
                    now(),
                )
                .expect("issuance succeeds");
            durations.push(started.elapsed());
            assert_eq!(
                command.expires_at,
                now() + ChronoDuration::minutes(2),
                "command TTL is the shortest bound"
            );
            assert!(!command.signature.as_str().is_empty());
        }
        durations.sort();
        let p95 = durations[(durations.len() * 95 / 100).min(durations.len() - 1)];
        assert!(
            p95 < std::time::Duration::from_millis(200),
            "issuance p95 {p95:?} exceeded 200ms"
        );
        assert_eq!(issuer.issued_count(), 200);
    }

    #[test]
    fn approved_command_carries_approval_signature() {
        let tenant_id = TenantId::new();
        let actors = actors();
        let proposal = proposal_fixture(actors.originator, now() + ChronoDuration::minutes(10));
        let decision = decision_fixture(RiskVerdict::ApprovalRequired);
        let approval = ApprovalRecord::new(decision.decision_id, actors.approver, now());
        let mut issuer = CommandIssuer::new(tenant_id, ChronoDuration::minutes(2));

        let command = issuer
            .issue(
                &proposal,
                &decision,
                IssuanceInput {
                    approval: Some(approval.clone()),
                    ..baseline_input(&actors, "approved-command")
                },
                actors.requester,
                now(),
            )
            .expect("approved issuance succeeds");
        assert_eq!(command.approval_signature, Some(approval.signature));
        assert_eq!(command.decision_id, decision.decision_id);
        assert!(command.expires_at <= proposal.expires_at);
    }
}
