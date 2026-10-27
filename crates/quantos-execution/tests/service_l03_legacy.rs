use chrono::{Duration, TimeZone, Utc};
use quantos_core::{ActorId, ContentHash, DecisionId};
use quantos_execution::{ApprovalRecord, dual::*};
use quantos_risk::{RISK_ENGINE_VERSION, RiskDecision, RiskVerdict};
fn fixture() -> (RiskDecision, DualApprovalRequest) {
    let at = Utc.with_ymd_and_hms(2026, 10, 27, 0, 0, 0).unwrap();
    let d = RiskDecision {
        decision_id: DecisionId::new(),
        verdict: RiskVerdict::ApprovalRequired,
        hit_rules: vec![],
        limit_ids: vec![],
        signer: RISK_ENGINE_VERSION.into(),
        reason: "owned fixture".into(),
        signature: ContentHash::sha256_bytes(b"owned"),
        decided_at: at,
    };
    let r = DualApprovalRequest {
        proposal_id: "owned-request".into(),
        symbol: "BTCUSDT".into(),
        notional: 100.0,
        originator: ActorId::new(),
        first: ApprovalRecord::new(d.decision_id, ActorId::new(), at),
        first_mfa_token: "mfa-owned-first".into(),
        second: ApprovalRecord::new(d.decision_id, ActorId::new(), at),
        second_mfa_token: "mfa-owned-second".into(),
    };
    (d, r)
}
#[test]
fn l03_legacy_nonfinite_and_nonpositive_amounts_are_not_approvable() {
    for amount in [f64::NAN, f64::INFINITY, 0.0, -1.0] {
        let (d, mut r) = fixture();
        r.notional = amount;
        assert!(
            DualApprovalVerifier::verify(
                &M5FeatureGate::testnet_enabled(),
                &DualApprovalPolicy::default(),
                &r,
                &d,
                d.decided_at
            )
            .is_err()
        );
    }
}
#[test]
fn l03_legacy_future_approval_is_not_current_authority() {
    let (d, mut r) = fixture();
    r.first = ApprovalRecord::new(
        d.decision_id,
        r.first.approver,
        d.decided_at + Duration::seconds(1),
    );
    assert!(
        DualApprovalVerifier::verify(
            &M5FeatureGate::testnet_enabled(),
            &DualApprovalPolicy::default(),
            &r,
            &d,
            d.decided_at
        )
        .is_err()
    );
}
#[test]
fn l03_legacy_denied_risk_decision_is_not_approvable() {
    let (mut d, r) = fixture();
    d.verdict = RiskVerdict::Deny;
    assert!(
        DualApprovalVerifier::verify(
            &M5FeatureGate::testnet_enabled(),
            &DualApprovalPolicy::default(),
            &r,
            &d,
            d.decided_at
        )
        .is_err()
    );
}
