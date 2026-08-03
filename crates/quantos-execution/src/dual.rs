use std::collections::BTreeSet;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{ActorId, ContentHash, canonical_json_bytes};
use quantos_risk::RiskDecision;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

use crate::{ApprovalRecord, ApprovalVerifier};

// ---------------------------------------------------------------------------
// M5 feature gate: Assisted Live surfaces only exist when the server-side
// flag is on. With the flag off, both API and UI paths are unreachable.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct M5FeatureGate {
    pub assisted_live_testnet_enabled: bool,
}

impl M5FeatureGate {
    #[must_use]
    pub const fn disabled() -> Self {
        Self {
            assisted_live_testnet_enabled: false,
        }
    }

    #[must_use]
    pub const fn testnet_enabled() -> Self {
        Self {
            assisted_live_testnet_enabled: true,
        }
    }

    pub fn ensure_assisted_live_reachable(&self) -> Result<(), DualApprovalError> {
        if self.assisted_live_testnet_enabled {
            return Ok(());
        }
        Err(DualApprovalError::AssistedLiveUnreachable)
    }
}

// ---------------------------------------------------------------------------
// Dual approval policy: separation of duties, notional caps, allowlists
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub struct DualApprovalPolicy {
    pub max_notional: f64,
    pub symbol_allowlist: BTreeSet<String>,
    pub approval_ttl: ChronoDuration,
}

impl Default for DualApprovalPolicy {
    fn default() -> Self {
        Self {
            max_notional: 50_000.0,
            symbol_allowlist: BTreeSet::from(["BTCUSDT".to_owned(), "ETHUSDT".to_owned()]),
            approval_ttl: ChronoDuration::minutes(10),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct DualApprovalRequest {
    pub proposal_id: String,
    pub symbol: String,
    pub notional: f64,
    pub originator: ActorId,
    pub first: ApprovalRecord,
    pub first_mfa_token: String,
    pub second: ApprovalRecord,
    pub second_mfa_token: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignedApprovalAuditEntry {
    pub proposal_id: String,
    pub approver: ActorId,
    pub slot: String,
    pub approved_at: DateTime<Utc>,
    pub signature: String,
    pub audit_hash: ContentHash,
}

#[derive(Debug, Error)]
pub enum DualApprovalError {
    #[error(transparent)]
    Core(#[from] quantos_core::CoreError),
    #[error("ASSISTED_LIVE_UNREACHABLE: the M5 feature flag is disabled")]
    AssistedLiveUnreachable,
    #[error("DUAL_APPROVAL_SYMBOL_NOT_ALLOWED: symbol `{symbol}` is not on the allowlist")]
    SymbolNotAllowed { symbol: String },
    #[error(
        "DUAL_APPROVAL_NOTIONAL_EXCEEDED: notional {notional} exceeds dual-approval cap {max_notional}"
    )]
    NotionalExceeded { notional: f64, max_notional: f64 },
    #[error("DUAL_APPROVAL_SAME_APPROVER: both approvals were signed by the same actor")]
    SameApprover,
    #[error("DUAL_APPROVAL_SELF_APPROVAL: approver `{approver}` is the proposal originator")]
    SelfApproval { approver: ActorId },
    #[error("DUAL_APPROVAL_MFA_INVALID: slot `{slot}` did not present a valid MFA proof")]
    MfaInvalid { slot: String },
    #[error("DUAL_APPROVAL_EXPIRED: approval in slot `{slot}` expired at {approved_at}")]
    ApprovalExpired {
        slot: String,
        approved_at: DateTime<Utc>,
    },
    #[error("DUAL_APPROVAL_SIGNATURE_INVALID: approval in slot `{slot}` does not verify")]
    SignatureInvalid { slot: String },
}

pub struct DualApprovalVerifier;

impl DualApprovalVerifier {
    /// Verify a dual approval end to end and emit one signed audit entry per
    /// approver. Any failure aborts before any audit entry is produced.
    pub fn verify(
        gate: &M5FeatureGate,
        policy: &DualApprovalPolicy,
        request: &DualApprovalRequest,
        decision: &RiskDecision,
        now: DateTime<Utc>,
    ) -> Result<Vec<SignedApprovalAuditEntry>, DualApprovalError> {
        gate.ensure_assisted_live_reachable()?;

        if !policy.symbol_allowlist.contains(&request.symbol) {
            return Err(DualApprovalError::SymbolNotAllowed {
                symbol: request.symbol.clone(),
            });
        }
        if request.notional > policy.max_notional {
            return Err(DualApprovalError::NotionalExceeded {
                notional: request.notional,
                max_notional: policy.max_notional,
            });
        }
        if request.first.approver == request.second.approver {
            return Err(DualApprovalError::SameApprover);
        }
        for (slot, approval, mfa_token) in [
            ("first", &request.first, &request.first_mfa_token),
            ("second", &request.second, &request.second_mfa_token),
        ] {
            if approval.approver == request.originator {
                return Err(DualApprovalError::SelfApproval {
                    approver: approval.approver,
                });
            }
            if !mfa_token.starts_with("mfa-") {
                return Err(DualApprovalError::MfaInvalid {
                    slot: slot.to_owned(),
                });
            }
            if approval.approved_at + policy.approval_ttl <= now {
                return Err(DualApprovalError::ApprovalExpired {
                    slot: slot.to_owned(),
                    approved_at: approval.approved_at,
                });
            }
            if ApprovalVerifier::verify(approval, decision).is_err() {
                return Err(DualApprovalError::SignatureInvalid {
                    slot: slot.to_owned(),
                });
            }
        }

        let mut entries = Vec::with_capacity(2);
        for (slot, approval) in [("first", &request.first), ("second", &request.second)] {
            let audit_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
                "proposal_id": request.proposal_id,
                "approver": approval.approver.to_string(),
                "slot": slot,
                "approved_at": approval.approved_at,
                "signature": approval.signature,
                "decision_id": decision.decision_id.to_string(),
            }))?);
            entries.push(SignedApprovalAuditEntry {
                proposal_id: request.proposal_id.clone(),
                approver: approval.approver,
                slot: slot.to_owned(),
                approved_at: approval.approved_at,
                signature: approval.signature.clone(),
                audit_hash,
            });
        }
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{ContentHash, DecisionId, TenantId};
    use quantos_risk::{RISK_ENGINE_VERSION, RiskVerdict};

    use super::*;

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn decision_fixture() -> RiskDecision {
        RiskDecision {
            decision_id: DecisionId::new(),
            verdict: RiskVerdict::ApprovalRequired,
            hit_rules: vec![],
            limit_ids: vec![],
            signer: RISK_ENGINE_VERSION.to_owned(),
            reason: "dual approval fixture".to_owned(),
            signature: ContentHash::sha256_bytes(br#"{"decision":"dual"}"#),
            decided_at: now(),
        }
    }

    fn request_fixture(
        originator: ActorId,
        first: ActorId,
        second: ActorId,
        decision: &RiskDecision,
        seed: u64,
    ) -> DualApprovalRequest {
        DualApprovalRequest {
            proposal_id: format!("proposal:dual-{seed:03}"),
            symbol: "BTCUSDT".to_owned(),
            notional: 10_000.0 + seed as f64,
            originator,
            first: ApprovalRecord::new(decision.decision_id, first, now()),
            first_mfa_token: format!("mfa-first-{seed}"),
            second: ApprovalRecord::new(decision.decision_id, second, now()),
            second_mfa_token: format!("mfa-second-{seed}"),
        }
    }

    #[test]
    fn m5_flag_off_makes_assisted_live_unreachable() {
        let originator = ActorId::new();
        let decision = decision_fixture();
        let request = request_fixture(originator, ActorId::new(), ActorId::new(), &decision, 1);
        let error = DualApprovalVerifier::verify(
            &M5FeatureGate::disabled(),
            &DualApprovalPolicy::default(),
            &request,
            &decision,
            now(),
        )
        .expect_err("flag off must be unreachable");
        assert!(matches!(error, DualApprovalError::AssistedLiveUnreachable));
    }

    #[test]
    fn fifty_dual_approvals_all_write_signed_audit_entries() {
        let gate = M5FeatureGate::testnet_enabled();
        let policy = DualApprovalPolicy::default();
        let originator = ActorId::new();
        let mut audit_hashes = BTreeSet::new();
        let mut total_entries = 0_usize;

        for seed in 0..50_u64 {
            let decision = decision_fixture();
            let request =
                request_fixture(originator, ActorId::new(), ActorId::new(), &decision, seed);
            let entries = DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now())
                .expect("dual approval verifies");
            assert_eq!(entries.len(), 2);
            assert_ne!(entries[0].approver, entries[1].approver);
            assert_ne!(entries[0].audit_hash, entries[1].audit_hash);
            for entry in entries {
                assert!(!entry.signature.is_empty());
                assert!(audit_hashes.insert(entry.audit_hash));
                total_entries += 1;
            }
        }
        assert_eq!(total_entries, 100);
        assert_eq!(audit_hashes.len(), 100);
        let _ = TenantId::new();
    }

    #[test]
    fn self_approval_cap_expiry_and_allowlist_are_all_rejected() {
        let gate = M5FeatureGate::testnet_enabled();
        let policy = DualApprovalPolicy::default();
        let originator = ActorId::new();
        let approver_a = ActorId::new();
        let approver_b = ActorId::new();

        // self approval (first slot is originator)
        let decision = decision_fixture();
        let request = request_fixture(originator, originator, approver_b, &decision, 1);
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::SelfApproval { .. })
        ));

        // same approver twice
        let request = request_fixture(originator, approver_a, approver_a, &decision, 2);
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::SameApprover)
        ));

        // notional above cap
        let mut request = request_fixture(originator, approver_a, approver_b, &decision, 3);
        request.notional = policy.max_notional + 1.0;
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::NotionalExceeded { .. })
        ));

        // symbol outside allowlist
        let mut request = request_fixture(originator, approver_a, approver_b, &decision, 4);
        request.symbol = "DOGEUSDT".to_owned();
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::SymbolNotAllowed { .. })
        ));

        // expired approval
        let mut request = request_fixture(originator, approver_a, approver_b, &decision, 5);
        request.first = ApprovalRecord::new(
            decision.decision_id,
            approver_a,
            now() - ChronoDuration::minutes(11),
        );
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::ApprovalExpired { .. })
        ));

        // invalid MFA proof
        let mut request = request_fixture(originator, approver_a, approver_b, &decision, 6);
        request.second_mfa_token = "no-token".to_owned();
        assert!(matches!(
            DualApprovalVerifier::verify(&gate, &policy, &request, &decision, now()),
            Err(DualApprovalError::MfaInvalid { .. })
        ));
    }
}
