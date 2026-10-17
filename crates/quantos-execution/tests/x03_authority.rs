#[path = "../../quantos-strategy/tests/support/release_fixture.rs"]
mod release_fixture;
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::ActorId;
use quantos_policy::{Capability, Role};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, InMemoryPortfolioProjection,
    MarketMarkEvent, PortfolioEvent, PortfolioEventKind, RiskInputSnapshot,
};
use quantos_risk::{RiskLimits, RiskVerdict, guard::*};
use quantos_strategy::release::{DeploymentTarget, InMemoryStrategyReleaseStore, StrategyRelease};

struct Fixture {
    auth: AuthContext,
    release: StrategyRelease,
    now: DateTime<Utc>,
    input: RiskInputSnapshot,
    financials: AccountFinancials,
    venue: VenueState,
    policy: RiskPolicy,
    intent: TradeIntent,
}
impl Fixture {
    fn new() -> Self {
        Self::with_expiry(1800)
    }
    fn with_expiry(seconds: i64) -> Self {
        let (mut auth, proof) = release_fixture::fixture(&release_fixture::payload());
        let now = proof.report().generated_at + Duration::seconds(10);
        let mut store = InMemoryStrategyReleaseStore::new();
        let release = store
            .publish_verified(
                &auth,
                proof,
                vec![DeploymentTarget::Paper, DeploymentTarget::Shadow],
                now - Duration::seconds(9),
            )
            .unwrap();
        let mut approver = auth.clone();
        approver.actor_id = ActorId::new();
        approver.role = Role::Approver;
        let release = store
            .approve(
                &approver,
                release.release_id,
                &release.content_hash,
                now - Duration::seconds(8),
                now + Duration::seconds(seconds),
            )
            .unwrap();
        auth.capabilities
            .insert(Capability::parse(Capability::EXECUTION_OPERATE).unwrap());
        let account = auth.account_id.unwrap();
        let kinds = [
            PortfolioEventKind::AccountStatus(AccountStatusEvent {
                account_id: account,
                status: AccountStatus::Active,
            }),
            PortfolioEventKind::Fill(FillEvent {
                account_id: account,
                symbol: "BTCUSDT".into(),
                side: FillSide::Buy,
                quantity: 1000.0,
                price: 100.0,
                fee: 0.0,
            }),
            PortfolioEventKind::Fill(FillEvent {
                account_id: account,
                symbol: "ETHUSDT".into(),
                side: FillSide::Buy,
                quantity: 4000.0,
                price: 100.0,
                fee: 0.0,
            }),
            PortfolioEventKind::MarketMark(MarketMarkEvent {
                symbol: "BTCUSDT".into(),
                price: 100.0,
                source_at: now - Duration::seconds(2),
            }),
            PortfolioEventKind::MarketMark(MarketMarkEvent {
                symbol: "ETHUSDT".into(),
                price: 100.0,
                source_at: now - Duration::seconds(1),
            }),
        ];
        let events: Vec<_> = kinds
            .into_iter()
            .enumerate()
            .map(|(i, kind)| PortfolioEvent {
                event_id: format!("x03-{i}"),
                sequence: (i + 1) as u64,
                occurred_at: now - Duration::seconds(5 - i as i64),
                kind,
            })
            .collect();
        let input = InMemoryPortfolioProjection::rebuild(
            auth.tenant_id,
            now - Duration::seconds(6),
            &events,
        )
        .unwrap()
        .risk_snapshot(account, now, 60)
        .unwrap();
        let financials = AccountFinancials {
            tenant_id: auth.tenant_id,
            account_id: account,
            quote_unit: "USDT".into(),
            equity: 1_000_000.0,
            realized_pnl_today: 0.0,
            utc_day: now.date_naive(),
            as_of: now,
            source_ref: "owned-cash-and-daily-ledger".into(),
        };
        let venue = VenueState {
            venue: "OWNED_PAPER".into(),
            symbol: "BTCUSDT".into(),
            quote_unit: "USDT".into(),
            healthy: true,
            observed_at: now,
        };
        let policy = RiskPolicy {
            version: "x03-test-v1".into(),
            quote_unit: "USDT".into(),
            limits: RiskLimits::default(),
            max_age_seconds: 60,
            decision_ttl_seconds: 10,
        };
        let intent = TradeIntent {
            account_id: account,
            command_key: "x03-0".into(),
            symbol: "BTCUSDT".into(),
            side: Side::Buy,
            quantity: "10".into(),
            limit_price: "100".into(),
            release_id: release.release_id,
            target: DeploymentTarget::Paper,
        };
        Self {
            auth,
            release,
            now,
            input,
            financials,
            venue,
            policy,
            intent,
        }
    }
    fn guard(&self) -> RiskGuard {
        RiskGuard::new(
            self.auth.tenant_id,
            self.auth.workspace_id,
            self.policy.clone(),
            "owned-fixture-key".into(),
            [73; 32],
        )
        .unwrap()
    }
    fn eval(&self, g: &RiskGuard, phase: Phase) -> GuardDecision {
        g.evaluate(
            &self.auth,
            phase,
            &self.intent,
            &self.input,
            &self.financials,
            &self.venue,
            &self.release,
            None,
            self.now,
        )
        .unwrap()
    }
    fn owner(&self) -> AuthContext {
        let mut a = self.auth.clone();
        a.role = Role::Owner;
        a.account_id = None;
        a
    }
}
use quantos_core::{ArtifactId, ContentHash, WorkflowRunId, canonical_json_bytes};
use quantos_execution::authority::*;
use quantos_runtime::signal_proposal::{TradeProposalRecord, WorkflowEvidenceRecord};
use quantos_storage::ArtifactManifest;
use serde_json::json;
use std::{
    sync::{Arc, Barrier},
    thread,
};
impl Fixture {
    fn issuer(&self, g: &RiskGuard) -> AtomicCommandIssuer {
        AtomicCommandIssuer::new(
            self.auth.tenant_id,
            self.auth.workspace_id,
            g.clone(),
            "owned-local-issuer".into(),
            [91; 32],
            5,
        )
        .unwrap()
    }
    fn sources(&self) -> CurrentSources<'_> {
        CurrentSources {
            snapshot: &self.input,
            financials: &self.financials,
            venue: &self.venue,
            release: &self.release,
        }
    }
    fn record(&self) -> TradeProposalRecord {
        let metadata = json!({"request_id":"x03","tenant_id":self.auth.tenant_id,"workspace_id":self.auth.workspace_id,"actor":{"actor_id":self.auth.actor_id,"actor_kind":"ACTOR_KIND_USER"},"correlation_id":"x03","mode":"RUNTIME_MODE_RESEARCH","environment":"ENVIRONMENT_LOCAL","issued_at":self.now});
        let evidence = json!([{"evidence_id":"owned-proof","artifact_id":"owned-artifact","summary":"synthetic local evidence"}]);
        let output = json!({"metadata":metadata,"proposal_id":format!("proposal:{}",self.intent.command_key),"account_id":self.intent.account_id,"symbol":self.intent.symbol,"action":"PROPOSAL_ACTION_BUY","quantity":{"value":self.intent.quantity},"notional":{"value":(self.intent.quantity.parse::<u64>().unwrap()*100).to_string()},"signal":{"metadata":metadata,"signal_id":"owned-signal","strategy_release_id":self.release.release_id,"symbol":self.intent.symbol,"direction":"SIGNAL_DIRECTION_LONG","strength":{"value":"0.5"},"confidence":{"value":"0.5"},"diagnostics":{"value":{"model_version":"local","strategy_version":"local","data_version":"local","model_digest":ContentHash::sha256_bytes(b"owned-model")}},"generated_at":self.now-Duration::seconds(1),"valid_until":self.now+Duration::seconds(60),"evidence_refs":evidence},"rationale":"owned fixture","confidence":{"value":"0.5"},"expires_at":self.now+Duration::seconds(30),"executable":false,"evidence_refs":evidence,"counter_views":["synthetic counter view"]});
        let bytes = canonical_json_bytes(&output).unwrap();
        TradeProposalRecord {
            workflow_run_id: WorkflowRunId::new(),
            artifact_manifest: ArtifactManifest::new(
                self.auth.tenant_id,
                "application/json",
                ContentHash::sha256_bytes(&bytes),
                "owned-local",
                bytes.len() as u64,
                self.now,
            ),
            auxiliary_artifact_manifests: vec![],
            capability: "decision.proposal.v1".into(),
            proposal_id: output["proposal_id"].as_str().unwrap().into(),
            account_id: self.intent.account_id.to_string(),
            symbol: self.intent.symbol.clone(),
            signal_id: "owned-signal".into(),
            signal_artifact_id: ArtifactId::new(),
            executable: false,
            expires_at: self.now + Duration::seconds(30),
            evidence_refs: vec![WorkflowEvidenceRecord {
                evidence_id: "owned-proof".into(),
                artifact_id: "owned-artifact".into(),
                summary: "synthetic local evidence".into(),
            }],
            counter_views: vec!["synthetic counter view".into()],
            engine_artifact_ids: vec!["owned-artifact".into()],
            output,
            stream_events: vec![],
            created_at: self.now,
        }
    }
    fn register(&self, i: &AtomicCommandIssuer) -> ContentHash {
        i.register_proposal(&self.auth, self.record(), self.intent.clone(), self.now)
            .unwrap()
    }
    fn approved(
        &self,
        g: &RiskGuard,
        i: &AtomicCommandIssuer,
        p: &ContentHash,
    ) -> (quantos_core::ProposalId, GuardDecision) {
        let r = i
            .request_approval(&self.auth, p, self.now, self.now + Duration::seconds(20))
            .unwrap();
        let mut a = self.auth.clone();
        a.actor_id = ActorId::new();
        a.role = Role::Approver;
        i.transition_approval(&a, r.id, 0, ApprovalState::Approved, self.now)
            .unwrap();
        let token = i.approval_token(&self.auth, r.id, self.now).unwrap();
        let d = g
            .evaluate(
                &self.auth,
                Phase::Pre,
                &self.intent,
                &self.input,
                &self.financials,
                &self.venue,
                &self.release,
                Some(&token),
                self.now,
            )
            .unwrap();
        assert_eq!(d.verdict, RiskVerdict::Allow);
        (r.id, d)
    }
}
#[test]
fn x03_real_modules_issue_replay_signatures_and_audit() {
    let f = Fixture::new();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    assert_eq!(c.expires_at, f.now + Duration::seconds(5));
    assert_eq!(c.intent, f.intent);
    i.verify_command(&f.auth, &c, f.now).unwrap();
    assert_eq!(
        i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap(),
        c
    );
    for field in ["command_id", "tenant_id", "requester", "venue", "signature"] {
        let mut v = serde_json::to_value(&c).unwrap();
        if field == "venue" || field == "signature" {
            v[field] = json!("tampered");
        } else {
            v[field] = json!(ActorId::new());
        }
        let changed: SignedCommand = serde_json::from_value(v).unwrap();
        assert!(i.verify_command(&f.auth, &changed, f.now).is_err());
    }
    let rows = i.audit_log(&f.owner()).unwrap();
    assert_eq!(
        rows.iter().filter(|r| r.event == "command_issued").count(),
        1
    );
    i.verify_audit(&rows).unwrap();
    let mut changed = rows.clone();
    changed[0].outcome = "changed".into();
    assert!(i.verify_audit(&changed).is_err());
    let mut changed = rows.clone();
    changed.remove(0);
    assert!(i.verify_audit(&changed).is_err());
    let wrong = f.issuer(&g);
    assert!(wrong.verify_command(&f.auth, &c, f.now).is_err());
}
#[test]
fn x03_seven_rejections_and_recovery_do_not_consume_approval() {
    // Seven classes from the original issuer contract: expiry, duplicate approval,
    // self approval, stale data, kill switch, invalid release, missing approval.
    let mut f = Fixture::new();
    f.intent.quantity = "1500".into();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let pending = i
        .request_approval(&f.auth, &p, f.now, f.now + Duration::seconds(20))
        .unwrap();
    assert!(
        i.transition_approval(&f.auth, pending.id, 0, ApprovalState::Approved, f.now)
            .is_err()
    ); // self
    let missing = f.eval(&g, Phase::Pre);
    assert_eq!(missing.verdict, RiskVerdict::ApprovalRequired);
    assert!(
        i.issue(&f.auth, &p, &missing, None, f.sources(), f.now)
            .is_err()
    ); // missing
    let (a, d) = f.approved(&g, &i, &p);
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            Some(a),
            f.sources(),
            f.now + Duration::seconds(31)
        )
        .is_err()
    ); // expired
    // Refusals below use monotonic time, separate issuer to avoid intentional backward-clock refusal.
    let i = f.issuer(&g);
    let p = f.register(&i);
    let r = i
        .request_approval(&f.auth, &p, f.now, f.now + Duration::seconds(20))
        .unwrap();
    let mut reviewer = f.auth.clone();
    reviewer.actor_id = ActorId::new();
    reviewer.role = Role::Approver;
    i.transition_approval(&reviewer, r.id, 0, ApprovalState::Approved, f.now)
        .unwrap();
    let mut stale = f.input.clone();
    stale.portfolio.as_of = f.now - Duration::seconds(61);
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            Some(r.id),
            CurrentSources {
                snapshot: &stale,
                ..f.sources()
            },
            f.now
        )
        .is_err()
    ); // stale
    let mut invalid = f.release.clone();
    invalid.content_hash = ContentHash::sha256_bytes(b"invalid");
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            Some(r.id),
            CurrentSources {
                release: &invalid,
                ..f.sources()
            },
            f.now
        )
        .is_err()
    ); // release
    assert_eq!(
        i.approval_status(&f.auth, r.id).unwrap().state,
        ApprovalState::Approved
    );
    let c = i
        .issue(&f.auth, &p, &d, Some(r.id), f.sources(), f.now)
        .unwrap(); // actual recovery, current risk rechecks token
    assert_eq!(
        i.approval_status(&f.auth, r.id).unwrap().state,
        ApprovalState::Consumed
    );
    let mut different_record = f.record();
    different_record.proposal_id = "other-proposal".into();
    different_record.output["proposal_id"] = json!("other-proposal");
    different_record.artifact_manifest.content_hash =
        ContentHash::sha256_bytes(&canonical_json_bytes(&different_record.output).unwrap());
    different_record.artifact_manifest.size_bytes = canonical_json_bytes(&different_record.output)
        .unwrap()
        .len() as u64;
    let mut different_intent = f.intent.clone();
    different_intent.command_key = "other-command".into();
    let other = i
        .register_proposal(&f.auth, different_record, different_intent, f.now)
        .unwrap();
    let reused = i
        .issue(&f.auth, &other, &d, Some(r.id), f.sources(), f.now)
        .unwrap_err();
    assert!(reused.to_string().contains("approval consumed or invalid"));

    assert_eq!(
        i.issue(&f.auth, &p, &d, Some(r.id), f.sources(), f.now)
            .unwrap(),
        c
    ); // idempotent retry, no second consume
    assert!(
        i.transition_approval(&reviewer, r.id, 1, ApprovalState::Approved, f.now)
            .is_err()
    ); // duplicate/terminal
    g.set_kill_switch(&f.owner(), KillScope::Global, true, 0, "owned race", f.now)
        .unwrap();
    assert!(
        i.issue(&f.auth, &p, &d, Some(r.id), f.sources(), f.now)
            .is_err()
    ); // kill, even cached
    assert!(i.verify_command(&f.auth, &c, f.now).is_err());
    let rows = i.audit_log(&f.owner()).unwrap();
    assert_eq!(
        rows.iter().filter(|r| r.event == "command_issued").count(),
        1
    );
    assert!(
        rows.iter()
            .filter(|r| r.event == "issuance_refused")
            .count()
            >= 3
    );
    i.verify_audit(&rows).unwrap();
}
#[test]
fn x03_approval_cas_rejection_cancellation_expiry_and_originator_separation() {
    let f = Fixture::new();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let mut requester = f.auth.clone();
    requester.actor_id = ActorId::new();
    let mut approver = f.auth.clone();
    approver.role = Role::Approver;
    let r = i
        .request_approval(&requester, &p, f.now, f.now + Duration::seconds(2))
        .unwrap();
    assert!(
        i.transition_approval(&approver, r.id, 0, ApprovalState::Approved, f.now)
            .is_err()
    ); // proposal originator
    approver.actor_id = ActorId::new();
    assert!(
        i.transition_approval(&approver, r.id, 1, ApprovalState::Approved, f.now)
            .is_err()
    ); // bad CAS
    let mut wrong = approver.clone();
    wrong.tenant_id = quantos_core::TenantId::new();
    assert!(
        i.transition_approval(&wrong, r.id, 0, ApprovalState::Approved, f.now)
            .is_err()
    );
    i.transition_approval(&approver, r.id, 0, ApprovalState::Rejected, f.now)
        .unwrap();
    assert!(
        i.transition_approval(&approver, r.id, 1, ApprovalState::Approved, f.now)
            .is_err()
    );
    let r = i
        .request_approval(&requester, &p, f.now, f.now + Duration::seconds(2))
        .unwrap();
    i.transition_approval(&approver, r.id, 0, ApprovalState::Approved, f.now)
        .unwrap();
    assert!(
        i.transition_approval(&f.auth, r.id, 1, ApprovalState::Cancelled, f.now)
            .is_err()
    );
    i.transition_approval(&requester, r.id, 1, ApprovalState::Cancelled, f.now)
        .unwrap();
    assert!(i.approval_token(&requester, r.id, f.now).is_err());
    let r = i
        .request_approval(&requester, &p, f.now, f.now + Duration::seconds(2))
        .unwrap();
    assert!(
        i.transition_approval(
            &approver,
            r.id,
            0,
            ApprovalState::Approved,
            f.now + Duration::seconds(2)
        )
        .is_err()
    );
    let rows = i.audit_log(&f.owner()).unwrap();
    i.verify_audit(&rows).unwrap();
}
#[tokio::test(flavor = "multi_thread", worker_threads = 16)]
async fn x03_one_thousand_concurrent_requests_one_signed_command_one_consumption() {
    let mut f = Fixture::new();
    f.intent.quantity = "1500".into();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let (a, d) = f.approved(&g, &i, &p);
    let f = Arc::new(f);
    let barrier = Arc::new(tokio::sync::Barrier::new(1001));
    let mut tasks = vec![];
    for _ in 0..1000 {
        let f = f.clone();
        let i = i.clone();
        let p = p.clone();
        let d = d.clone();
        let barrier = barrier.clone();
        tasks.push(tokio::spawn(async move {
            barrier.wait().await;
            i.issue(&f.auth, &p, &d, Some(a), f.sources(), f.now)
                .unwrap()
        }));
    }
    barrier.wait().await;
    let mut commands = std::collections::BTreeSet::new();
    for task in tasks {
        commands.insert(task.await.unwrap().command_id);
    }
    assert_eq!(commands.len(), 1);
    let r = i.approval_status(&f.auth, a).unwrap();
    assert_eq!(r.state, ApprovalState::Consumed);
    assert_eq!(r.revision, 2);
    let rows = i.audit_log(&f.owner()).unwrap();
    assert_eq!(
        rows.iter().filter(|r| r.event == "command_issued").count(),
        1
    );
    assert_eq!(
        rows.iter()
            .filter(|r| r.event == "command_replayed")
            .count(),
        999
    );
    i.verify_audit(&rows).unwrap();
}
#[test]
fn x03_conflicting_requester_proposal_decision_and_source_changes_fail_closed() {
    let f = Fixture::new();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    let mut changed = f.auth.clone();
    changed.actor_id = ActorId::new();
    assert!(i.issue(&changed, &p, &d, None, f.sources(), f.now).is_err());
    changed = f.auth.clone();
    changed.capabilities.clear();
    assert!(i.issue(&changed, &p, &d, None, f.sources(), f.now).is_err());
    changed = f.auth.clone();
    changed.mode = quantos_policy::RunMode::Shadow;
    assert!(i.issue(&changed, &p, &d, None, f.sources(), f.now).is_err());
    let mut bad = d.clone();
    bad.expires_at += Duration::seconds(1);
    assert!(
        i.issue(&f.auth, &p, &bad, None, f.sources(), f.now)
            .is_err()
    );
    let mut venue = f.venue.clone();
    venue.healthy = false;
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            None,
            CurrentSources {
                venue: &venue,
                ..f.sources()
            },
            f.now
        )
        .is_err()
    );
    venue.healthy = true;
    venue.venue = "OTHER_PAPER".into();
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            None,
            CurrentSources {
                venue: &venue,
                ..f.sources()
            },
            f.now
        )
        .is_err()
    );
    let mut financials = f.financials.clone();
    financials.realized_pnl_today = -1_000_000.0;
    assert!(
        i.issue(
            &f.auth,
            &p,
            &d,
            None,
            CurrentSources {
                financials: &financials,
                ..f.sources()
            },
            f.now
        )
        .is_err()
    );
    assert!(
        i.issue(&f.auth, &p, &d, None, f.sources(), c.expires_at)
            .is_err()
    );
}
#[test]
fn x03_risk_lock_kill_linearization_and_other_issuer_cannot_double_consume() {
    let f = Arc::new(Fixture::new());
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    let other = f.issuer(&g);
    let q = f.register(&other);
    assert!(
        other
            .issue(&f.auth, &q, &d, None, f.sources(), f.now)
            .is_err()
    );
    let barrier = Arc::new(Barrier::new(33));
    let mut handles = vec![];
    for _ in 0..32 {
        let f = f.clone();
        let i = i.clone();
        let p = p.clone();
        let d = d.clone();
        let b = barrier.clone();
        handles.push(thread::spawn(move || {
            b.wait();
            i.issue(&f.auth, &p, &d, None, f.sources(), f.now)
        }));
    }
    barrier.wait();
    g.set_kill_switch(
        &f.owner(),
        KillScope::Account(f.intent.account_id),
        true,
        0,
        "linearized kill",
        f.now,
    )
    .unwrap();
    for h in handles {
        if let Ok(cmd) = h.join().unwrap() {
            assert_eq!(cmd.command_id, c.command_id);
        }
    }
    assert!(i.issue(&f.auth, &p, &d, None, f.sources(), f.now).is_err());
    g.set_kill_switch(
        &f.owner(),
        KillScope::Account(f.intent.account_id),
        false,
        1,
        "local recovery",
        f.now,
    )
    .unwrap();
    assert!(i.verify_command(&f.auth, &c, f.now).is_err());
}
#[test]
fn x03_proposal_bytes_quantity_scope_and_configuration_are_not_client_authority() {
    let f = Fixture::new();
    let g = f.guard();
    let i = f.issuer(&g);
    for field in [
        "executable",
        "quantity",
        "notional",
        "account_id",
        "signal",
        "metadata",
    ] {
        let mut p = f.record();
        p.output[field] = json!("changed");
        assert!(
            i.register_proposal(&f.auth, p, f.intent.clone(), f.now)
                .is_err()
        );
    }
    let mut p = f.record();
    p.account_id = "other".into();
    assert!(
        i.register_proposal(&f.auth, p, f.intent.clone(), f.now)
            .is_err()
    );
    let p = f.record();
    let mut intent = f.intent.clone();
    intent.limit_price = "101".into();
    assert!(i.register_proposal(&f.auth, p, intent, f.now).is_err());
    assert!(
        AtomicCommandIssuer::new(
            f.auth.tenant_id,
            f.auth.workspace_id,
            g,
            "owned".into(),
            [0; 32],
            5
        )
        .is_err()
    );
}

#[test]
fn x03_failed_transaction_does_not_reserve_consumer_and_kill_waits_for_commit() {
    let f = Fixture::new();
    let g = f.guard();
    let d = f.eval(&g, Phase::Pre);
    let refused: Result<(), CommandError> = g.with_current_allow(
        quantos_core::CommandId::new(),
        &d,
        &f.auth,
        &f.intent,
        &f.input,
        &f.financials,
        &f.venue,
        &f.release,
        None,
        f.now,
        |_| Err(CommandError::Rejected("injected precommit refusal")),
    );
    assert!(refused.is_err());
    let i = f.issuer(&g);
    let p = f.register(&i);
    i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    let f = Arc::new(Fixture::new());
    let g = f.guard();
    let d = f.eval(&g, Phase::Pre);
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let committed = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let gf = g.clone();
    let ff = f.clone();
    let flag = committed.clone();
    let transaction = thread::spawn(move || {
        gf.with_current_allow::<(), CommandError>(
            quantos_core::CommandId::new(),
            &d,
            &ff.auth,
            &ff.intent,
            &ff.input,
            &ff.financials,
            &ff.venue,
            &ff.release,
            None,
            ff.now,
            |_| {
                entered_tx.send(()).unwrap();
                release_rx.recv().unwrap();
                flag.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
        )
        .unwrap();
    });
    entered_rx.recv().unwrap();
    let ff = f.clone();
    let flag = committed.clone();
    let kill = thread::spawn(move || {
        g.set_kill_switch(
            &ff.owner(),
            KillScope::Global,
            true,
            0,
            "ordered after commit",
            ff.now,
        )
        .unwrap();
        assert!(flag.load(std::sync::atomic::Ordering::SeqCst));
    });
    release_tx.send(()).unwrap();
    transaction.join().unwrap();
    kill.join().unwrap();
}
