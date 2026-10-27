//! Current service aggregation: same native scope/proposal/risk decision, but
//! SERVICE:L03's approved reference workflow does not grant X03 authority.
#[allow(dead_code)]
#[path = "support/tp07_fixture.rs"]
mod native;
use chrono::Duration;
use quantos_core::{ActorId, ProposalId};
use quantos_execution::{assisted::*, venue_protocol::EXECUTION_VENUE};
use quantos_policy::{Capability, Role, RunMode};
use quantos_risk::{RiskVerdict, guard::Phase};
use uuid::Uuid;
fn key() -> [u8; 32] {
    let mut k = [0; 32];
    k[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    k[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    k
}
#[test]
fn l4_same_account_proposal_and_risk_service_approval_never_becomes_native_authority() {
    let mut f = native::Fixture::new();
    f.venue.venue = EXECUTION_VENUE.into();
    f.policy.limits.approval_notional_threshold = 500.0;
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let proposal = f.register(&issuer);
    let risk = f.eval(&guard, Phase::Pre);
    assert_eq!(risk.verdict, RiskVerdict::ApprovalRequired);
    assert!(
        issuer
            .issue(&f.auth, &proposal, &risk, None, f.sources(), f.now)
            .is_err()
    );
    let scope = Scope {
        tenant: f.auth.tenant_id,
        workspace: f.auth.workspace_id,
        account: f.auth.account_id.unwrap(),
    };
    let mfa_key = key();
    let service = AssistedApprovalService::new(
        scope.clone(),
        Policy {
            enabled: true,
            ..Policy::default()
        },
        mfa_key,
        key(),
        f.now,
    )
    .unwrap();
    let attestor = MfaAttestor::new(mfa_key).unwrap();
    for (name, role) in [
        ("requester", Role::Operator),
        ("first", Role::Approver),
        ("second", Role::Approver),
    ] {
        let mut auth = f.auth.clone();
        auth.mode = RunMode::AssistedLive;
        auth.role = role;
        auth.capabilities
            .insert(Capability::parse(ASSISTED_CAPABILITY).unwrap());
        auth.capabilities
            .insert(Capability::parse(Capability::STRATEGY_APPROVE).unwrap());
        if name != "requester" {
            auth.actor_id = ActorId::new();
            auth.user_id = Uuid::new_v4();
        }
        service
            .register_session(
                name.into(),
                Session {
                    auth,
                    revision: 1,
                    issued_at: f.now,
                    expires_at: f.now + Duration::minutes(5),
                    active: true,
                },
            )
            .unwrap();
    }
    let subject = Subject {
        id: ProposalId::new(),
        scope: scope.clone(),
        originator: f.auth.actor_id,
        originator_user: f.auth.user_id,
        proposal_hash: proposal.clone(),
        decision: risk.decision_id,
        verdict: risk.verdict,
        venue: f.venue.venue.clone(),
        symbol: f.intent.symbol.clone(),
        quote_currency: "USDT".into(),
        quantity: f.intent.quantity.clone(),
        limit_price: f.intent.limit_price.clone(),
        created_at: f.now,
        expires_at: risk.expires_at,
    };
    service.register_subject(subject.clone()).unwrap();
    let request = service
        .open("requester", subject.id, "same-native-subject", f.now)
        .unwrap()
        .receipt;
    assert!(
        service
            .challenge("requester", request.request, f.now)
            .is_err()
    );
    for (revision, name) in ["first", "second"].into_iter().enumerate() {
        let challenge = service.challenge(name, request.request, f.now).unwrap();
        let proof = attestor
            .attest_provider_completed(challenge, f.now)
            .unwrap();
        service
            .approve(name, request.request, revision as u64, name, proof, f.now)
            .unwrap();
    }
    let receipt = service
        .inspect("requester", request.request, f.now)
        .unwrap();
    assert_eq!(receipt.status, "approved");
    assert!(!receipt.execution_authority);
    assert!(
        serde_json::from_value::<quantos_execution::authority::SignedCommand>(
            serde_json::to_value(&receipt).unwrap()
        )
        .is_err()
    );
    assert!(
        issuer
            .issue(&f.auth, &proposal, &risk, None, f.sources(), f.now)
            .is_err()
    );
    let mut assisted = f.auth.clone();
    assisted.mode = RunMode::AssistedLive;
    assert!(
        issuer
            .issue(&assisted, &proposal, &risk, None, f.sources(), f.now)
            .is_err()
    );
    let native_audit = issuer.audit_log(&f.owner()).unwrap();
    issuer.verify_audit(&native_audit).unwrap();
    assert!(!native_audit.iter().any(|r| r.event == "command_issued"));
    let (audit, anchor) = service.audit_snapshot().unwrap();
    assert_eq!(audit.len(), 2);
    service.verify_audit(&audit, &anchor).unwrap();
    assert!(
        service
            .inspect("requester", request.request, risk.expires_at)
            .is_err()
    );
    if let Ok(path) = std::env::var("QUANTOS_L4_BOUNDARY") {
        std::fs::write(path,serde_json::to_vec_pretty(&serde_json::json!({"schema":"quantos-l4-service-boundary/v1","scope":"ACTUAL_SAME_SCOPE_NATIVE_SUBJECT_REFUSAL_NOT_ASSISTED_EXECUTION","tenant":scope.tenant,"workspace":scope.workspace,"account":scope.account,"proposalHash":proposal,"serviceProposalHash":subject.proposal_hash,"decisionId":risk.decision_id,"serviceDecisionId":subject.decision,"riskVerdict":"approval_required","workflow":"approved","auditEntries":2,"auditVerified":true,"sourcePort":"OWNED_TRUSTED_PROJECTION_OF_ACTUAL_NATIVE_RISK","mfa":"KEYED_SYNTHETIC_ATTESTOR","executionAuthority":false,"receiptIsSignedCommand":false,"paperIssuerWithoutNativeApproval":"DENIED","assistedIssuer":"DENIED","issuedCommands":0,"atExpiry":"DENIED","productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
