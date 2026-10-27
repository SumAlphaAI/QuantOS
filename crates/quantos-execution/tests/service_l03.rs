#[path = "support/l03_fixture.rs"]
mod fixture;
use chrono::Duration;
use fixture::*;
use quantos_core::{ActorId, ContentHash, ProposalId};
use quantos_execution::assisted::*;
use quantos_policy::{Role, RunMode};
use serde_json::json;
#[test]
fn l03_fifty_dual_workflows_produce_one_hundred_keyed_chained_audits() {
    let f = Fixture::new(true);
    let mut rows = vec![];
    for i in 0..50 {
        let mut subject = f.subject.clone();
        subject.id = ProposalId::new();
        subject.proposal_hash = ContentHash::sha256_bytes(format!("owned-subject-{i}").as_bytes());
        subject.quantity = format!("{}", i + 1);
        f.service.register_subject(subject.clone()).unwrap();
        let r = f
            .service
            .open("operator", subject.id, &format!("open-{i}"), f.now)
            .unwrap()
            .receipt;
        let a = f.proof("first", r.request);
        let b = f.proof("second", r.request);
        let one = f
            .service
            .approve(
                "first",
                r.request,
                0,
                &format!("first-{i}"),
                a.clone(),
                f.now,
            )
            .unwrap();
        assert_eq!(one.receipt.status, "awaiting_second");
        let two = f
            .service
            .approve(
                "second",
                r.request,
                1,
                &format!("second-{i}"),
                b.clone(),
                f.now,
            )
            .unwrap();
        assert_eq!(two.receipt.status, "approved");
        assert!(!two.receipt.execution_authority);
        assert_eq!(two.receipt.approvers.len(), 2);
        assert!(
            f.service
                .approve("first", r.request, 0, &format!("first-{i}"), a, f.now)
                .unwrap()
                .replayed
        );
        assert!(
            f.service
                .approve("second", r.request, 1, &format!("second-{i}"), b, f.now)
                .unwrap()
                .replayed
        );
        assert_eq!(
            f.service.inspect("operator", r.request, f.now).unwrap(),
            two.receipt
        );
        rows.push(json!({"case":i,"request":r.request,"subjectHash":r.subject_hash,"status":"approved","approvals":2,"auditEntries":2,"executionAuthority":false}));
    }
    let (audit, anchor) = f.service.audit_snapshot().unwrap();
    assert_eq!(audit.len(), 100);
    f.service.verify_audit(&audit, &anchor).unwrap();
    assert_eq!(
        audit
            .iter()
            .map(|a| a.signature.clone())
            .collect::<std::collections::BTreeSet<_>>()
            .len(),
        100
    );
    if let Ok(path) = std::env::var("QUANTOS_SERVICE_L03_MATRIX") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-service-l03-matrix/v1","scope":"ACTUAL_KEYED_IN_MEMORY_APPROVAL_WORKFLOW_NOT_REAL_MFA_OR_TRADING","cases":rows,"audit":audit,"anchor":anchor,"auditSignaturesVerifiedInProcess":true,"mfa":"KEYED_SYNTHETIC_TRUSTED_ATTESTATION_PORT","ordersIssued":0,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
#[test]
fn l03_default_off_denies_every_workflow_action_and_advertises_no_authority() {
    let f = Fixture::new(false);
    assert_eq!(
        f.service
            .open("operator", f.subject.id, "open", f.now)
            .unwrap_err(),
        Error::Disabled
    );
    assert_eq!(
        f.service.challenge("first", ProposalId::new(), f.now).err(),
        Some(Error::Disabled)
    );
    assert_eq!(
        f.service
            .inspect("operator", ProposalId::new(), f.now)
            .err(),
        Some(Error::Disabled)
    );
    let cap = f.service.capabilities("operator", f.now).unwrap();
    assert_eq!(cap["request"], false);
    assert_eq!(cap["approve"], false);
    assert_eq!(cap["executionAuthority"], false);
    assert!(f.service.audit_snapshot().unwrap().0.is_empty());
}
#[test]
fn l03_exact_cap_symbol_currency_risk_and_signed_subject_boundaries() {
    for mutation in [
        "zero",
        "nan",
        "exponent",
        "precision",
        "overcap",
        "symbol",
        "currency",
        "deny",
        "future",
        "expired",
        "venue",
    ] {
        let f = Fixture::new(true);
        let mut s = f.subject.clone();
        s.id = ProposalId::new();
        match mutation {
            "zero" => s.quantity = "0".into(),
            "nan" => s.quantity = "NaN".into(),
            "exponent" => s.quantity = "1e2".into(),
            "precision" => s.limit_price = "1000.000000001".into(),
            "overcap" => s.quantity = "50.00000001".into(),
            "symbol" => s.symbol = "DOGEUSDT".into(),
            "currency" => s.quote_currency = "BTC".into(),
            "deny" => s.verdict = quantos_risk::RiskVerdict::Deny,
            "future" => s.created_at = f.now + Duration::seconds(1),
            "expired" => {
                s.created_at = f.now - Duration::minutes(1);
                s.expires_at = f.now
            }
            _ => s.venue = "unapproved".into(),
        };
        f.service.register_subject(s.clone()).unwrap();
        assert!(
            f.service.open("operator", s.id, "bad", f.now).is_err(),
            "{mutation}"
        );
        assert!(f.service.audit_snapshot().unwrap().0.is_empty());
    }
}
#[test]
fn l03_distinct_actors_and_distinct_humans_must_be_independent() {
    let f = Fixture::new(true);
    let mut originator = f.sessions["operator"].clone();
    originator.revision = 2;
    originator.auth.role = Role::Owner;
    f.service.update_session("operator", 1, originator).unwrap();
    let r = f.open();
    assert!(f.service.challenge("owner", r.request, f.now).is_ok());
    assert!(f.service.challenge("operator", r.request, f.now).is_err());
    let a = f.proof("first", r.request);
    f.service
        .approve("first", r.request, 0, "a", a, f.now)
        .unwrap();
    assert_eq!(
        f.service.challenge("first", r.request, f.now).err(),
        Some(Error::SameApprover)
    );
    assert_eq!(
        f.service.challenge("twin", r.request, f.now).err(),
        Some(Error::SameApprover)
    );
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 1);
}
#[test]
fn l03_forged_wrong_bound_and_future_mfa_never_write_audit() {
    for mutation in [
        "prefix",
        "wrong-key",
        "request",
        "actor",
        "user",
        "session",
        "generation",
        "scope",
        "future",
        "expiry",
        "unknown-challenge",
    ] {
        let f = Fixture::new(true);
        let r = f.open();
        let mut p = f.proof("first", r.request);
        match mutation {
            "prefix" => p.signature = "mfa-client-claim".into(),
            "wrong-key" => {
                p = MfaAttestor::new(key())
                    .unwrap()
                    .attest_provider_completed(p.challenge, f.now)
                    .unwrap()
            }
            "request" => p.challenge.request = ProposalId::new(),
            "actor" => p.challenge.actor = ActorId::new(),
            "user" => p.challenge.user = uuid::Uuid::new_v4(),
            "session" => p.challenge.session = "second".into(),
            "generation" => p.challenge.session_revision += 1,
            "scope" => p.challenge.scope.tenant = quantos_core::TenantId::new(),
            "future" => p.completed_at += Duration::seconds(1),
            "expiry" => p.challenge.expires_at = f.now,
            _ => p.challenge.id = ProposalId::new(),
        };
        assert!(
            f.service
                .approve("first", r.request, 0, "forged", p, f.now)
                .is_err(),
            "{mutation}"
        );
        assert!(f.service.audit_snapshot().unwrap().0.is_empty());
        assert_eq!(
            f.service
                .inspect("operator", r.request, f.now)
                .unwrap()
                .revision,
            0
        );
    }
}
#[test]
fn l03_recovery_is_same_body_same_response_without_second_audit() {
    let f = Fixture::new(true);
    let r = f.open();
    let p = f.proof("first", r.request);
    let one = f
        .service
        .approve("first", r.request, 0, "a", p.clone(), f.now)
        .unwrap();
    let two = f
        .service
        .approve("first", r.request, 0, "a", p.clone(), f.now)
        .unwrap();
    assert!(two.replayed);
    assert_eq!(one.receipt, two.receipt);
    assert_eq!(
        f.service
            .approve("first", r.request, 1, "a", p.clone(), f.now)
            .err(),
        Some(Error::Conflict)
    );
    assert!(
        f.service
            .approve("first", r.request, 1, "other", p, f.now)
            .is_err()
    );
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 1);
    let same = f
        .service
        .open("operator", f.subject.id, "open", f.now)
        .unwrap();
    assert!(same.replayed);
    assert_eq!(same.receipt, r);
}
#[test]
fn l03_second_slot_failure_is_atomic_and_does_not_consume_proof() {
    let f = Fixture::new(true);
    let r = f.open();
    let a = f.proof("first", r.request);
    let mut b = f.proof("second", r.request);
    f.service
        .approve("first", r.request, 0, "a", a, f.now)
        .unwrap();
    let original = b.clone();
    b.signature = "not-authentic".into();
    assert!(
        f.service
            .approve("second", r.request, 1, "b", b, f.now)
            .is_err()
    );
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 1);
    let final_r = f
        .service
        .approve("second", r.request, 1, "b", original, f.now)
        .unwrap();
    assert_eq!(final_r.receipt.status, "approved");
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 2);
}
#[test]
fn l03_concurrent_duplicate_is_one_cas_transition() {
    let f = Fixture::new(true);
    let r = f.open();
    let p = f.proof("first", r.request);
    let mut jobs = vec![];
    for _ in 0..32 {
        let service = f.service.clone();
        let p = p.clone();
        let now = f.now;
        jobs.push(std::thread::spawn(move || {
            service
                .approve("first", r.request, 0, "same", p, now)
                .unwrap()
        }));
    }
    let receipts: Vec<_> = jobs.into_iter().map(|j| j.join().unwrap()).collect();
    assert_eq!(receipts.iter().filter(|r| !r.replayed).count(), 1);
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 1);
}
#[test]
fn l03_feature_or_policy_changes_invalidate_old_approval_and_replay() {
    let f = Fixture::new(true);
    let r = f.pair();
    let rev = f
        .service
        .update_policy(1, Policy::default(), f.now)
        .unwrap();
    assert_eq!(
        f.service.inspect("operator", r.request, f.now).err(),
        Some(Error::Disabled)
    );
    f.service
        .update_policy(
            rev,
            Policy {
                enabled: true,
                ..Policy::default()
            },
            f.now,
        )
        .unwrap();
    assert_eq!(
        f.service.inspect("operator", r.request, f.now).err(),
        Some(Error::PolicyChanged)
    );
    assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 2);
}
#[test]
fn l03_revocation_current_capability_and_session_generation_invalidate_prior_witness() {
    for mutation in ["revoked", "role", "capability", "generation", "subject"] {
        let f = Fixture::new(true);
        let r = f.open();
        let a = f.proof("first", r.request);
        let b = f.proof("second", r.request);
        f.service
            .approve("first", r.request, 0, "a", a, f.now)
            .unwrap();
        if mutation == "revoked" {
            f.service.revoke_session("first").unwrap();
        } else if mutation == "subject" {
            f.service.revoke_subject(f.subject.id).unwrap();
        } else {
            let mut next = f.sessions["first"].clone();
            next.revision = 2;
            match mutation {
                "role" => next.auth.role = Role::Viewer,
                "capability" => next.auth.capabilities.clear(),
                _ => {}
            };
            f.service.update_session("first", 1, next).unwrap();
        }
        assert!(
            f.service
                .approve("second", r.request, 1, "b", b, f.now)
                .is_err()
        );
        assert!(f.service.inspect("operator", r.request, f.now).is_err());
        assert_eq!(f.service.audit_snapshot().unwrap().0.len(), 1);
    }
}
#[test]
fn l03_half_open_mfa_approval_and_monotone_clock() {
    let f = Fixture::new(true);
    let r = f.open();
    let a = f.proof("first", r.request);
    assert!(
        f.service
            .approve(
                "first",
                r.request,
                0,
                "a",
                a.clone(),
                f.now + Duration::seconds(120)
            )
            .is_err()
    );
    assert!(
        f.service
            .approve("first", r.request, 0, "a", a, f.now)
            .is_err()
    );
    assert!(f.service.audit_snapshot().unwrap().0.is_empty());
}
#[test]
fn l03_audit_authentication_rejects_edit_reorder_duplicate_truncation_and_public_checksum() {
    let f = Fixture::new(true);
    f.pair();
    let (a, anchor) = f.service.audit_snapshot().unwrap();
    f.service.verify_audit(&a, &anchor).unwrap();
    for mutation in [
        "edit",
        "reorder",
        "duplicate",
        "truncate",
        "checksum",
        "scope",
    ] {
        let mut copy = a.clone();
        match mutation {
            "edit" => copy[0].slot = 2,
            "reorder" => copy.reverse(),
            "duplicate" => copy.push(copy[0].clone()),
            "truncate" => {
                copy.pop();
            }
            "scope" => copy[0].scope.account = quantos_core::AccountId::new(),
            _ => copy[0].signature = ContentHash::sha256_bytes(b"public checksum").to_string(),
        };
        assert!(
            f.service.verify_audit(&copy, &anchor).is_err(),
            "{mutation}"
        );
    }
}
#[test]
fn l03_wrong_roles_modes_scope_and_no_capability_cannot_act() {
    for mutation in [
        "role",
        "mode",
        "tenant",
        "workspace",
        "account",
        "capability",
        "expired",
    ] {
        let f = Fixture::new(true);
        let mut s = f.sessions["operator"].clone();
        s.revision = 2;
        match mutation {
            "role" => s.auth.role = Role::Viewer,
            "mode" => s.auth.mode = RunMode::Paper,
            "tenant" => s.auth.tenant_id = quantos_core::TenantId::new(),
            "workspace" => s.auth.workspace_id = quantos_core::WorkspaceId::new(),
            "account" => s.auth.account_id = None,
            "capability" => s.auth.capabilities.clear(),
            _ => s.active = false,
        };
        f.service.update_session("operator", 1, s).unwrap();
        assert!(
            f.service
                .open("operator", f.subject.id, "bad", f.now)
                .is_err()
        );
        assert!(f.service.audit_snapshot().unwrap().0.is_empty());
    }
}
