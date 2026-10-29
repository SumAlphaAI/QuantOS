#[allow(dead_code)]
#[path = "support/tp07_fixture.rs"]
mod base;
use base::Fixture;
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{ActorId, ContentHash, ProposalId, canonical_json_bytes};
use quantos_execution::{
    assisted::*, assisted_execution::AssistedExecution, assisted_source::*, gateway::*,
};
use quantos_policy::{Role, RunMode};
use quantos_risk::{RiskVerdict, guard::*};
use quantos_strategy::release::DeploymentTarget;
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
struct F {
    f: Fixture,
    guard: RiskGuard,
    source: CurrentSubjectSource,
    service: AssistedApprovalService,
    mfa: MfaAttestor,
    subject: Subject,
    decision: GuardDecision,
}
impl F {
    fn inputs() -> Fixture {
        let mut f = Fixture::new();
        f.auth.mode = RunMode::AssistedLive;
        f.auth
            .capabilities
            .insert(quantos_policy::Capability::parse(ASSISTED_CAPABILITY).unwrap());
        f.intent.target = DeploymentTarget::Shadow;
        f.intent.quantity = "1".into();
        f.intent.limit_price = "1000".into();
        f.policy.limits.approval_notional_threshold = 500.0;
        f.policy.decision_ttl_seconds = 60;
        f.venue.venue = "OWNED_TESTNET".into();
        f
    }
    fn current(f: &Fixture) -> CurrentRiskSources {
        CurrentRiskSources {
            snapshot: f.input.clone(),
            financials: f.financials.clone(),
            venue: f.venue.clone(),
            release: f.release.clone(),
        }
    }
    fn record(f: &Fixture) -> quantos_runtime::signal_proposal::TradeProposalRecord {
        let mut r = f.record();
        r.output["notional"]["value"] = json!("1000");
        let bytes = canonical_json_bytes(&r.output).unwrap();
        r.artifact_manifest.content_hash = ContentHash::sha256_bytes(&bytes);
        r.artifact_manifest.size_bytes = bytes.len() as u64;
        r
    }
    fn service(f: &Fixture, source: &CurrentSubjectSource) -> AssistedApprovalService {
        let svc = AssistedApprovalService::new(
            Scope {
                tenant: f.auth.tenant_id,
                workspace: f.auth.workspace_id,
                account: f.intent.account_id,
            },
            Policy {
                enabled: true,
                ..Policy::default()
            },
            [71; 32],
            [72; 32],
            f.now,
        )
        .unwrap();
        svc.with_current_sources(source.clone()).unwrap();
        for (who, role) in [
            ("requester", Role::Operator),
            ("first", Role::Approver),
            ("second", Role::Approver),
        ] {
            let mut auth = f.auth.clone();
            auth.role = role;
            if who != "requester" {
                auth.actor_id = ActorId::new();
                auth.user_id = *auth.actor_id.as_uuid();
            }
            svc.register_session(
                who.into(),
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
        svc
    }
    fn new() -> Self {
        let f = Self::inputs();
        let guard = f.guard();
        let source = CurrentSubjectSource::new(guard.clone(), [74; 32]).unwrap();
        let record = Self::record(&f);
        let proposal_hash = ContentHash::sha256_bytes(
            &canonical_json_bytes(&serde_json::to_value(&record).unwrap()).unwrap(),
        );
        let d = guard
            .evaluate_assisted_review(
                &f.auth,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                &proposal_hash,
                f.now,
            )
            .unwrap();
        assert_eq!(d.verdict, RiskVerdict::ApprovalRequired);
        let subject = source
            .register(
                f.auth.clone(),
                record,
                f.intent.clone(),
                d.clone(),
                Self::current(&f),
                f.now,
            )
            .unwrap();
        let service = Self::service(&f, &source);
        service.register_subject(subject.clone()).unwrap();
        Self {
            f,
            guard,
            source,
            service,
            mfa: MfaAttestor::new([71; 32]).unwrap(),
            subject,
            decision: d,
        }
    }
    fn pair(&self) -> Receipt {
        let r = self
            .service
            .open("requester", self.subject.id, "open", self.f.now)
            .unwrap()
            .receipt;
        for (i, who) in ["first", "second"].iter().enumerate() {
            let proof = self
                .mfa
                .attest_provider_completed(
                    self.service.challenge(who, r.request, self.f.now).unwrap(),
                    self.f.now,
                )
                .unwrap();
            self.service
                .approve(who, r.request, i as u64, who, proof, self.f.now)
                .unwrap();
        }
        self.service
            .inspect("requester", r.request, self.f.now)
            .unwrap()
    }
    fn native(&self) -> (AssistedExecution<K>, Arc<AtomicUsize>) {
        let calls = Arc::new(AtomicUsize::new(0));
        let n = AssistedExecution::new(
            self.service.clone(),
            GatewayLimits {
                max_quantity: 1000.into(),
                max_notional: 50000.into(),
                allowed_venues: vec![self.subject.venue.clone()],
            },
            K {
                calls: calls.clone(),
                events: vec![],
            },
            [73; 32],
        )
        .unwrap();
        (n, calls)
    }
    fn review(&self, d: &GuardDecision, auth: &AuthContext, at: DateTime<Utc>) -> bool {
        self.guard
            .with_current_assisted_review(
                d,
                auth,
                &self.f.intent,
                &self.f.input,
                &self.f.financials,
                &self.f.venue,
                &self.f.release,
                || at,
                |_| (),
            )
            .is_ok()
    }
}
struct K {
    calls: Arc<AtomicUsize>,
    events: Vec<KernelEvent>,
}
impl ExecutionKernel for K {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.events.push(KernelEvent::OrderAccepted {
            command_id: c.command_id.clone(),
            venue_order_id: "owned".into(),
            at: c.expires_at - Duration::seconds(30),
        });
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.events)
    }
}
#[test]
fn actual_r04_signed_review_same_subject_dual_approval_and_one_command() {
    let f = F::new();
    let r = f.pair();
    let (n, calls) = f.native();
    let a = n
        .submit("requester", r.request, "original", f.f.now)
        .unwrap();
    for _ in 0..5 {
        assert_eq!(
            n.submit("requester", r.request, "original", f.f.now)
                .unwrap(),
            a
        );
    }
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(a.subject_hash, r.subject_hash);
    assert_eq!(f.f.auth.mode, RunMode::AssistedLive);
    assert_eq!(f.decision.purpose, "assisted_testnet_review");
    assert_eq!(
        f.source.provenance(f.subject.id).unwrap()["killGeneration"],
        0
    );
    assert!(
        f.guard
            .validate_allow(&f.decision, &f.f.auth, &f.f.intent, f.f.now)
            .is_err()
    );
}
#[test]
fn forged_signature_decision_scope_verdict_policy_and_kill_generation_are_refused() {
    let f = F::new();
    for i in 0..11 {
        let mut d = f.decision.clone();
        match i {
            0 => d.signature = "0".repeat(64),
            1 => d.decision_id = quantos_core::DecisionId::new(),
            2 => d.account_id = quantos_core::AccountId::new(),
            3 => d.tenant_id = quantos_core::TenantId::new(),
            4 => d.workspace_id = quantos_core::WorkspaceId::new(),
            5 => d.requester = ActorId::new(),
            6 => d.verdict = RiskVerdict::Allow,
            7 => d.purpose = "order".into(),
            8 => d.kill_revision += 1,
            9 => d.policy.limits.max_notional_per_order = 1e9,
            _ => d.snapshot_hash = ContentHash::sha256_bytes(b"forged"),
        }
        assert!(!f.review(&d, &f.f.auth, f.f.now), "case {i}");
        assert!(
            f.source
                .register(
                    f.f.auth.clone(),
                    F::record(&f.f),
                    f.f.intent.clone(),
                    d,
                    F::current(&f.f),
                    f.f.now
                )
                .is_err()
        );
    }
}
#[test]
fn unsigned_preview_deny_allow_post_and_foreign_guard_cannot_register() {
    let f = F::new();
    let foreign = f.f.guard();
    let d = foreign
        .evaluate_assisted_review(
            &f.f.auth,
            &f.f.intent,
            &f.f.input,
            &f.f.financials,
            &f.f.venue,
            &f.f.release,
            &f.subject.proposal_hash,
            f.f.now,
        )
        .unwrap();
    assert!(!f.review(&d, &f.f.auth, f.f.now));
    let preview = f
        .guard
        .preview(
            &f.f.auth,
            Phase::Pre,
            &f.f.intent,
            &f.f.input,
            &f.f.financials,
            &f.f.venue,
            &f.f.release,
            None,
            f.f.now,
        )
        .unwrap();
    assert!(!f.review(&preview, &f.f.auth, f.f.now)); // actual Assisted mode cannot take legacy order path
    let mut post = f.decision.clone();
    post.phase = Phase::Post;
    assert!(!f.review(&post, &f.f.auth, f.f.now));
}
#[test]
fn proposal_content_hash_scope_signal_identity_quantity_and_future_tampering_refused() {
    let f = F::new();
    for i in 0..12 {
        let mut r = F::record(&f.f);
        match i {
            0 => r.output["quantity"]["value"] = json!("2"),
            1 => r.output["account_id"] = json!("foreign"),
            2 => r.output["metadata"]["workspace_id"] = json!(quantos_core::WorkspaceId::new()),
            3 => r.output["metadata"]["actor"]["actor_id"] = json!(ActorId::new()),
            4 => r.output["signal"]["symbol"] = json!("ETHUSDT"),
            5 => r.output["signal"]["valid_until"] = json!(f.f.now),
            6 => r.executable = true,
            7 => r.created_at = f.f.now + Duration::seconds(1),
            8 => r.output["action"] = json!("PROPOSAL_ACTION_SELL"),
            9 => r.output["signal"]["strategy_release_id"] = json!(ProposalId::new()),
            10 => r.artifact_manifest.size_bytes += 1,
            _ => r.expires_at = f.f.now,
        }
        // Resealing output must not bypass record/order/identity binding either.
        if i < 10 {
            let b = canonical_json_bytes(&r.output).unwrap();
            r.artifact_manifest.content_hash = ContentHash::sha256_bytes(&b);
            r.artifact_manifest.size_bytes = b.len() as u64;
        }
        assert!(
            f.source
                .register(
                    f.f.auth.clone(),
                    r,
                    f.f.intent.clone(),
                    f.decision.clone(),
                    F::current(&f.f),
                    f.f.now
                )
                .is_err(),
            "case {i}"
        );
    }
}
#[test]
fn current_stale_account_release_venue_daily_loss_or_facts_changes_deny_original_and_new_keys() {
    for i in 0..9 {
        let f = F::new();
        let r = f.pair();
        let (n, calls) = f.native();
        let mut c = F::current(&f.f);
        match i {
            0 => c.financials.as_of = f.f.now - Duration::hours(1),
            1 => c.financials.account_id = quantos_core::AccountId::new(),
            2 => c.snapshot.portfolio.account_id = quantos_core::AccountId::new(),
            3 => c.venue.healthy = false,
            4 => c.financials.realized_pnl_today = -1e9,
            5 => c.release.approved_by = None,
            6 => c.financials.equity = 1.0,
            7 => c.financials.source_ref = "changed-current-ledger".into(),
            _ => c.venue.observed_at = f.f.now + Duration::seconds(1),
        }
        f.source.replace_current(f.subject.id, c).unwrap();
        assert!(
            n.submit("requester", r.request, "original", f.f.now)
                .is_err(),
            "case {i}"
        );
        assert!(n.submit("requester", r.request, "new", f.f.now).is_err());
        assert_eq!(calls.load(Ordering::SeqCst), 0);
        assert!(
            f.service
                .open("requester", f.subject.id, "new-open", f.f.now)
                .is_err()
        );
        assert!(
            f.service
                .execution_view("requester", r.request, f.f.now)
                .is_ok()
        );
    }
}
#[test]
fn global_and_account_kill_engage_release_never_revalidate_old_generation() {
    for scope in [
        KillScope::Global,
        KillScope::Account(F::inputs().intent.account_id),
    ] {
        let f = F::new();
        let scope = if matches!(scope, KillScope::Global) {
            KillScope::Global
        } else {
            KillScope::Account(f.f.intent.account_id)
        };
        let r = f.pair();
        let (n, calls) = f.native();
        let old = f.guard.assisted_checkpoint().unwrap();
        let owner = f.f.owner();
        f.guard
            .set_kill_switch(&owner, scope, true, 0, "owned stop", f.f.now)
            .unwrap();
        assert!(
            n.submit("requester", r.request, "original", f.f.now)
                .is_err()
        );
        assert!(f.guard.restore_assisted_checkpoint(&old).is_err());
        f.guard
            .set_kill_switch(&owner, scope, false, 1, "explicit owner release", f.f.now)
            .unwrap();
        assert!(!f.review(&f.decision, &f.f.auth, f.f.now));
        assert!(
            n.submit("requester", r.request, "original", f.f.now)
                .is_err()
        );
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }
}
#[test]
fn source_revocation_and_deadline_are_half_open_never_extended_by_recovery() {
    let f = F::new();
    let r = f.pair();
    let (n, calls) = f.native();
    let until = f.subject.expires_at;
    assert!(n.submit("requester", r.request, "original", until).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(
        f.service
            .execution_view("requester", r.request, until)
            .is_ok()
    );
    let f = F::new();
    let r = f.pair();
    let old = f.service.checkpoint().unwrap();
    f.source.revoke(f.subject.id).unwrap();
    f.service.restore_checkpoint(&old).unwrap();
    assert!(f.service.inspect("requester", r.request, f.f.now).is_err());
}
#[test]
fn risk_source_lock_serializes_kill_against_native_dispatch_without_deadlock() {
    use std::sync::mpsc;
    use std::time::Duration as Wait;
    let f = F::new();
    let (entered, rx) = mpsc::channel();
    let (release, wait) = mpsc::channel();
    let (done, completed) = mpsc::channel();
    std::thread::scope(|s| {
        let source = f.source.clone();
        let subject = f.subject.clone();
        let now = f.f.now;
        s.spawn(move || {
            source
                .with_current(&subject, now, || {
                    entered.send(()).unwrap();
                    wait.recv().unwrap();
                })
                .unwrap()
        });
        rx.recv_timeout(Wait::from_secs(3)).unwrap();
        let owner = f.f.owner();
        let guard = f.guard.clone();
        let now = f.f.now;
        s.spawn(move || {
            guard
                .set_kill_switch(&owner, KillScope::Global, true, 0, "ordered stop", now)
                .unwrap();
            done.send(()).unwrap();
        });
        assert!(completed.recv_timeout(Wait::from_millis(50)).is_err());
        release.send(()).unwrap();
        completed.recv_timeout(Wait::from_secs(3)).unwrap();
    });
    assert!(!f.review(&f.decision, &f.f.auth, f.f.now));
}
#[test]
fn authenticated_restart_keeps_original_source_decision_deadline_and_kill_state() {
    let f = F::new();
    let r = f.pair();
    f.guard
        .set_kill_switch(
            &f.f.owner(),
            KillScope::Global,
            true,
            0,
            "persist stop",
            f.f.now,
        )
        .unwrap();
    let saved = f.service.checkpoint().unwrap();
    let next_guard = f.f.guard();
    let next_source = CurrentSubjectSource::new(next_guard.clone(), [74; 32]).unwrap();
    let svc = F::service(&f.f, &next_source);
    svc.restore_checkpoint(&saved).unwrap();
    assert_eq!(next_guard.revision().unwrap(), 1);
    assert_eq!(
        next_source.provenance(f.subject.id).unwrap()["expiresAt"],
        json!(f.subject.expires_at)
    );
    assert!(svc.inspect("requester", r.request, f.f.now).is_err());
    assert!(svc.execution_view("requester", r.request, f.f.now).is_ok());
    let mut tampered = saved.clone();
    tampered["value"]["currentSources"]["risk"]["value"]["revision"] = json!(0);
    assert!(svc.restore_checkpoint(&tampered).is_err());
}
#[test]
fn raw_subject_registration_or_authority_removal_cannot_bypass_bound_source() {
    let f = F::new();
    let mut forged = f.subject.clone();
    forged.id = ProposalId::new();
    assert!(f.service.register_subject(forged).is_err());
    assert!(f.service.with_current_sources(f.source.clone()).is_err());
    let bare = AssistedApprovalService::new(
        f.subject.scope.clone(),
        Policy::default(),
        [71; 32],
        [72; 32],
        f.f.now,
    )
    .unwrap();
    assert!(
        bare.restore_checkpoint(&f.service.checkpoint().unwrap())
            .is_err()
    );
}
#[test]
fn same_order_with_another_valid_immutable_proposal_cannot_reuse_signed_review() {
    let f = F::new();
    let mut record = F::record(&f.f);
    record.output["rationale"] = json!("another immutable proposal with the same order");
    let b = canonical_json_bytes(&record.output).unwrap();
    record.artifact_manifest.content_hash = ContentHash::sha256_bytes(&b);
    record.artifact_manifest.size_bytes = b.len() as u64;
    let source = CurrentSubjectSource::new(f.guard.clone(), [74; 32]).unwrap();
    assert!(
        source
            .register(
                f.f.auth.clone(),
                record,
                f.f.intent.clone(),
                f.decision.clone(),
                F::current(&f.f),
                f.f.now
            )
            .is_err()
    );
    for i in 0..2 {
        let mut auth = f.f.auth.clone();
        match i {
            0 => auth.mode = RunMode::Paper,
            1 => auth.capabilities.clear(),
            _ => auth.account_id = None,
        }
        assert!(!f.review(&f.decision, &auth, f.f.now));
    }
}
#[test]
fn current_review_has_fifty_each_allow_deny_approval_without_bypassing_subject_gate() {
    let f = F::inputs();
    let guard = f.guard();
    for (label, qty, want) in [
        ("allow", "0.1", RiskVerdict::Allow),
        ("deny", "1000", RiskVerdict::Deny),
        ("approval", "1", RiskVerdict::ApprovalRequired),
    ] {
        for i in 0..50 {
            let mut intent = f.intent.clone();
            intent.quantity = qty.into();
            intent.command_key = format!("review-{label}-{i}");
            let hash = ContentHash::sha256_bytes(intent.command_key.as_bytes());
            let d = guard
                .evaluate_assisted_review(
                    &f.auth,
                    &intent,
                    &f.input,
                    &f.financials,
                    &f.venue,
                    &f.release,
                    &hash,
                    f.now,
                )
                .unwrap();
            assert_eq!(d.verdict, want);
            assert_eq!(d.checks.len(), 15);
            assert!(!d.signature.is_empty());
            guard.verify_decision(&d).unwrap();
            if want != RiskVerdict::ApprovalRequired {
                assert!(
                    guard
                        .with_current_assisted_review(
                            &d,
                            &f.auth,
                            &intent,
                            &f.input,
                            &f.financials,
                            &f.venue,
                            &f.release,
                            || f.now,
                            |_| ()
                        )
                        .is_err()
                );
            }
        }
    }
}
#[test]
fn source_clock_is_sampled_after_waiting_for_kill_lock_and_refuses_expired_callback() {
    use std::sync::mpsc;
    use std::time::Duration as Wait;
    let f = F::new();
    let (entered, rx) = mpsc::channel();
    let (release, wait) = mpsc::channel();
    let (sampled, sample) = mpsc::channel();
    let source = f.source.clone();
    let subject = f.subject.clone();
    let now = f.f.now;
    let until = subject.expires_at;
    std::thread::scope(|s| {
        let f = &f;
        s.spawn(move || {
            f.guard
                .with_current_assisted_review(
                    &f.decision,
                    &f.f.auth,
                    &f.f.intent,
                    &f.f.input,
                    &f.f.financials,
                    &f.f.venue,
                    &f.f.release,
                    || now,
                    |_| {
                        entered.send(()).unwrap();
                        wait.recv().unwrap();
                    },
                )
                .unwrap()
        });
        rx.recv_timeout(Wait::from_secs(3)).unwrap();
        let worker = s.spawn(move || {
            source.with_current(
                &subject,
                &|| {
                    sampled.send(()).unwrap();
                    until
                },
                || panic!("expired source executed"),
            )
        });
        assert!(sample.recv_timeout(Wait::from_millis(50)).is_err());
        release.send(()).unwrap();
        assert!(worker.join().unwrap().is_err());
        sample.recv_timeout(Wait::from_secs(3)).unwrap();
    });
}
#[test]
fn owner_release_restore_rechecks_integrity_and_rejects_mutated_private_proof() {
    use quantos_strategy::release::StrategyRelease;
    let f = F::new();
    let saved = f.f.release.owner_checkpoint(&[74; 32]).unwrap();
    assert!(StrategyRelease::from_owner_checkpoint(saved.clone(), &[75; 32]).is_err());
    assert!(
        StrategyRelease::from_owner_checkpoint(
            serde_json::to_value(&f.f.release).unwrap(),
            &[74; 32]
        )
        .is_err()
    );
    assert_eq!(
        StrategyRelease::from_owner_checkpoint(saved.clone(), &[74; 32]).unwrap(),
        f.f.release
    );
    for i in 0..4 {
        let mut v = saved.clone();
        match i {
            0 => v["value"]["approved_by"] = json!(f.f.release.created_by),
            1 => v["value"]["validation"]["artifact_payload"]["strategy"]["rule"] = json!("forged"),
            2 => v["value"]["allowed_targets"] = json!(["paper"]),
            _ => v["value"]["workspace_id"] = json!(quantos_core::WorkspaceId::new()),
        }
        assert!(StrategyRelease::from_owner_checkpoint(v.clone(), &[74; 32]).is_err());
        // Even authenticated owner bytes must satisfy private proof integrity.
        use hmac::{Hmac, Mac};
        let mut mac = Hmac::<sha2::Sha256>::new_from_slice(&[74; 32]).unwrap();
        mac.update(
            &canonical_json_bytes(&json!(["quantos-strategy-owner-checkpoint/v1", v["value"]]))
                .unwrap(),
        );
        v["signature"] = json!(hex::encode(mac.finalize().into_bytes()));
        assert!(StrategyRelease::from_owner_checkpoint(v, &[74; 32]).is_err());
    }
}
#[test]
fn immutable_source_cache_never_caches_kill_clock_or_current_revocation() {
    let f = F::new();
    let r = f.pair();
    let saved = f.service.checkpoint().unwrap();
    f.service.restore_checkpoint(&saved).unwrap(); // exact immutable cache hit
    let (native, calls) = f.native();
    f.guard
        .set_kill_switch(
            &f.f.owner(),
            KillScope::Account(f.f.intent.account_id),
            true,
            0,
            "current cached stop",
            f.f.now,
        )
        .unwrap();
    assert!(f.service.restore_checkpoint(&saved).is_err()); // cache cannot reset generation
    let stopped = f.service.checkpoint().unwrap();
    assert_eq!(
        stopped["value"]["currentSources"]["entries"],
        saved["value"]["currentSources"]["entries"]
    );
    assert_eq!(
        stopped["value"]["currentSources"]["risk"]["value"]["revision"],
        1
    );
    f.service.restore_checkpoint(&stopped).unwrap();
    assert!(
        native
            .submit("requester", r.request, "original", f.f.now)
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    let mut tampered = stopped.clone();
    tampered["value"]["currentSources"]["entries"][0]["subject"]["quantity"] = json!("2");
    assert!(f.service.restore_checkpoint(&tampered).is_err());
}
