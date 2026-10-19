#[path = "../../quantos-strategy/tests/support/release_fixture.rs"]
mod release_fixture;
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, TenantId};
use quantos_policy::{Capability, Role};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, InMemoryPortfolioProjection,
    MarketMarkEvent, PortfolioEvent, PortfolioEventKind, RiskInputSnapshot,
};
use quantos_risk::{RiskLimits, RiskVerdict, guard::*, rules::Rule};
use quantos_strategy::release::{DeploymentTarget, InMemoryStrategyReleaseStore, StrategyRelease};
use std::collections::BTreeSet;
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
#[test]
fn preview_is_repeatable_but_never_an_issuable_decision() {
    let mut f = Fixture::new();
    f.intent.quantity = "10".into();
    let guard = f.guard();
    for _ in 0..3 {
        let preview = guard
            .preview(
                &f.auth,
                Phase::Pre,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                None,
                f.now,
            )
            .unwrap();
        assert_eq!(preview.verdict, RiskVerdict::Allow);
        assert!(
            guard
                .validate_allow(&preview, &f.auth, &f.intent, f.now)
                .is_err()
        );
    }
    let (_, checks) = guard
        .account_checks(&f.auth, &f.input, &f.financials, f.now)
        .unwrap();
    assert!(
        !checks
            .iter()
            .any(|c| c.breached && matches!(c.rule, Rule::Duplicate | Rule::Approval))
    );
    let mut foreign = f.auth.clone();
    foreign.tenant_id = TenantId::new();
    assert!(
        guard
            .account_checks(&foreign, &f.input, &f.financials, f.now)
            .is_err()
    );
    foreign = f.auth.clone();
    foreign.capabilities.clear();
    assert!(
        guard
            .account_checks(&foreign, &f.input, &f.financials, f.now)
            .is_err()
    );
    let mut stale = f.financials.clone();
    stale.as_of = f.now - Duration::hours(1);
    stale.realized_pnl_today = -1e9;
    let (_, checks) = guard
        .account_checks(&f.auth, &f.input, &stale, f.now)
        .unwrap();
    for rule in [Rule::Financials, Rule::DailyLoss] {
        assert!(checks.iter().any(|c| c.rule == rule && c.breached));
    }
    let actual = guard
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            f.now,
        )
        .unwrap();
    assert_eq!(actual.verdict, RiskVerdict::Allow);
    guard
        .validate_allow(&actual, &f.auth, &f.intent, f.now)
        .unwrap();
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
                event_id: format!("x02-{i}"),
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
            version: "x02-test-v1".into(),
            quote_unit: "USDT".into(),
            limits: RiskLimits::default(),
            max_age_seconds: 60,
            decision_ttl_seconds: 10,
        };
        let intent = TradeIntent {
            account_id: account,
            command_key: "x02-0".into(),
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
#[test]
fn x02_fifty_allow_and_fifty_bound_approval_fixtures() {
    let mut f = Fixture::new();
    let g = f.guard();
    for i in 0..50 {
        f.intent.command_key = format!("allow-{i}");
        f.intent.quantity = (10 + i).to_string();
        let d = f.eval(&g, Phase::Pre);
        assert_eq!(d.verdict, RiskVerdict::Allow);
        g.verify_decision(&d).unwrap();
        g.validate_allow(&d, &f.auth, &f.intent, f.now).unwrap();
        assert_eq!(d.checks.len(), 15);
    }
    for i in 0..50 {
        f.intent.command_key = format!("approval-{i}");
        f.intent.quantity = (1500 + i).to_string();
        let d = f.eval(&g, Phase::Pre);
        assert_eq!(d.verdict, RiskVerdict::ApprovalRequired);
        assert!(g.validate_allow(&d, &f.auth, &f.intent, f.now).is_err());
        let mut approver = f.auth.clone();
        approver.actor_id = ActorId::new();
        approver.role = Role::Approver;
        let token = g
            .approve(
                &approver,
                f.auth.actor_id,
                &f.intent,
                f.now,
                f.now + Duration::seconds(30),
            )
            .unwrap();
        let approved = g
            .evaluate(
                &f.auth,
                Phase::Pre,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                Some(&token),
                f.now,
            )
            .unwrap();
        assert_eq!(approved.verdict, RiskVerdict::Allow);
        assert_eq!(f.eval(&g, Phase::Pre).verdict, RiskVerdict::Deny);
    }
}
#[test]
fn x02_fifty_denials_and_all_rule_outcomes() {
    let baseline = Fixture::new();
    let mut outcomes = BTreeSet::new();
    let initial = baseline.eval(&baseline.guard(), Phase::Pre);
    for c in initial.checks {
        outcomes.insert((c.rule, c.breached));
    }
    for i in 0..60 {
        let mut f = Fixture {
            auth: baseline.auth.clone(),
            release: baseline.release.clone(),
            now: baseline.now,
            input: baseline.input.clone(),
            financials: baseline.financials.clone(),
            venue: baseline.venue.clone(),
            policy: baseline.policy.clone(),
            intent: baseline.intent.clone(),
        };
        f.intent.command_key = format!("deny-{i}");
        let g = f.guard();
        let expected = match i % 14 {
            0 => {
                f.intent.symbol = "bad symbol".into();
                Rule::Identity
            }
            1 => {
                f.intent.quantity = "NaN".into();
                Rule::Numbers
            }
            2 => {
                f.intent.quantity = "1.00001".into();
                Rule::Precision
            }
            3 => {
                g.set_kill_switch(&f.owner(), KillScope::Global, true, 0, "incident", f.now)
                    .unwrap();
                Rule::GlobalKill
            }
            4 => {
                g.set_kill_switch(
                    &f.auth,
                    KillScope::Account(f.intent.account_id),
                    true,
                    0,
                    "incident",
                    f.now,
                )
                .unwrap();
                Rule::AccountKill
            }
            5 => {
                f.release.approved_at = None;
                Rule::Release
            }
            6 => {
                f.input.input_hash = quantos_core::ContentHash::sha256_bytes(b"tamper");
                Rule::Snapshot
            }
            7 => {
                f.financials.utc_day = f.financials.utc_day.pred_opt().unwrap();
                Rule::Financials
            }
            8 => {
                f.venue.healthy = false;
                Rule::Venue
            }
            9 => {
                assert_eq!(f.eval(&g, Phase::Pre).verdict, RiskVerdict::Allow);
                Rule::Duplicate
            }
            10 => {
                f.intent.quantity = "3000".into();
                Rule::OrderNotional
            }
            11 => {
                f.financials.equity = 10.0;
                Rule::Leverage
            }
            12 => {
                f.intent.symbol = "ETHUSDT".into();
                f.venue.symbol = "ETHUSDT".into();
                Rule::Concentration
            }
            _ => {
                f.financials.realized_pnl_today = -50_001.0;
                Rule::DailyLoss
            }
        };
        let d = f.eval(&g, Phase::Pre);
        assert_eq!(d.verdict, RiskVerdict::Deny, "{expected:?}");
        assert!(d.hit_rules().any(|c| c.rule == expected));
        assert!(d.hit_rules().all(|c| !c.limit_id.is_empty()));
        g.verify_decision(&d).unwrap();
        for c in d.checks {
            outcomes.insert((c.rule, c.breached));
        }
    }
    let mut f = baseline;
    f.intent.quantity = "1500".into();
    for c in f.eval(&f.guard(), Phase::Pre).checks {
        outcomes.insert((c.rule, c.breached));
    }
    assert_eq!(
        outcomes.len(),
        Rule::ALL.len() * 2,
        "both outcomes for every rule"
    );
}
#[test]
fn x02_tamper_expiry_approval_binding_and_daily_boundary() {
    let mut f = Fixture::new();
    let g = f.guard();
    let d = f.eval(&g, Phase::Pre);
    let mut altered = d.clone();
    altered.account_id = AccountId::new();
    assert!(g.verify_decision(&altered).is_err());
    altered = d.clone();
    altered.policy.limits.max_daily_loss *= 2.0;
    assert!(g.verify_decision(&altered).is_err());
    assert!(
        g.validate_allow(&d, &f.auth, &f.intent, d.expires_at)
            .is_err()
    );
    f.intent.command_key = "different".into();
    assert!(g.validate_allow(&d, &f.auth, &f.intent, f.now).is_err());
    f.intent.quantity = "1500".into();
    assert!(
        g.approve(
            &f.auth,
            f.auth.actor_id,
            &f.intent,
            f.now,
            f.now + Duration::seconds(20)
        )
        .is_err()
    );
    let mut a = f.auth.clone();
    a.actor_id = ActorId::new();
    a.role = Role::Approver;
    let token = g
        .approve(
            &a,
            f.auth.actor_id,
            &f.intent,
            f.now,
            f.now + Duration::seconds(20),
        )
        .unwrap();
    f.intent.limit_price = "101".into();
    let d = g
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            Some(&token),
            f.now,
        )
        .unwrap();
    assert_eq!(d.verdict, RiskVerdict::ApprovalRequired);
    f.intent.limit_price = "100".into();
    let mut token = token;
    token.signature = "00".repeat(32);
    let d = g
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            Some(&token),
            f.now,
        )
        .unwrap();
    assert_eq!(d.verdict, RiskVerdict::ApprovalRequired);
    f.financials.realized_pnl_today = -50_001.0;
    assert_eq!(f.eval(&g, Phase::Post).verdict, RiskVerdict::Deny);
    f.financials.realized_pnl_today = 0.0;
    assert_eq!(f.eval(&g, Phase::Post).verdict, RiskVerdict::Allow);
    assert_eq!(f.eval(&g, Phase::Post).verdict, RiskVerdict::Deny);
    // Lifetime realized P&L is not used as today's P&L by the legacy adapter either.
    let p = quantos_risk::PortfolioRiskInput::from_snapshot(
        &f.input.portfolio,
        123.0,
        -12.0,
        "BTCUSDT",
    );
    assert_eq!(p.realized_pnl_today, -12.0);
}
#[test]
fn x02_kill_shared_clones_cas_account_isolation_and_stale_allow() {
    let mut f = Fixture::new();
    let g = f.guard();
    let before = f.eval(&g, Phase::Pre);
    let owner = f.owner();
    let receipt = g
        .set_kill_switch(&owner, KillScope::Global, true, 0, "incident", f.now)
        .unwrap();
    g.verify_kill_receipt(&receipt).unwrap();
    assert!(
        g.validate_allow(&before, &f.auth, &f.intent, f.now)
            .is_err()
    );
    let clone = g.clone();
    std::thread::scope(|scope| {
        for i in 0..50 {
            let c = clone.clone();
            let f = &f;
            scope.spawn(move || {
                let mut intent = f.intent.clone();
                intent.command_key = format!("blocked-{i}");
                let d = c
                    .evaluate(
                        &f.auth,
                        Phase::Pre,
                        &intent,
                        &f.input,
                        &f.financials,
                        &f.venue,
                        &f.release,
                        None,
                        f.now,
                    )
                    .unwrap();
                assert!(d.hit_rules().any(|r| r.rule == Rule::GlobalKill));
            });
        }
    });
    assert!(
        g.set_kill_switch(&owner, KillScope::Global, false, 0, "stale", f.now)
            .is_err()
    );
    assert!(
        g.set_kill_switch(
            &f.auth,
            KillScope::Account(f.intent.account_id),
            false,
            1,
            "operator release",
            f.now
        )
        .is_err()
    );
    g.set_kill_switch(&owner, KillScope::Global, false, 1, "resolved", f.now)
        .unwrap();
    g.set_kill_switch(
        &owner,
        KillScope::Account(AccountId::new()),
        true,
        2,
        "another account",
        f.now,
    )
    .unwrap();
    f.intent.command_key = "after-release".into();
    assert_eq!(f.eval(&g, Phase::Pre).verdict, RiskVerdict::Allow);
    assert!(
        g.validate_allow(&before, &f.auth, &f.intent, f.now)
            .is_err()
    );
    assert_eq!(g.receipts(&owner).unwrap().len(), 3);
    let mut bad = f.auth.clone();
    bad.tenant_id = TenantId::new();
    assert!(
        g.set_kill_switch(&bad, KillScope::Global, true, 3, "foreign", f.now)
            .is_err()
    );
    assert!(
        g.evaluate(
            &bad,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            f.now
        )
        .is_err()
    );
}
#[test]
fn x02_invalid_decimals_sources_and_limit_boundaries_fail_closed() {
    let mut f = Fixture::new();
    for text in [
        "",
        "0",
        "-1",
        "+1",
        "1e2",
        " 1",
        "1.",
        ".1",
        "1..1",
        "inf",
        "999999999999999999999999999999999999999999999999999",
    ] {
        f.intent.quantity = text.into();
        assert_eq!(
            f.eval(&f.guard(), Phase::Pre).verdict,
            RiskVerdict::Deny,
            "{text}"
        );
    }
    f.intent.quantity = "10".into();
    for v in [f64::NAN, f64::INFINITY, -1.0, 0.0] {
        f.financials.equity = v;
        assert_eq!(f.eval(&f.guard(), Phase::Pre).verdict, RiskVerdict::Deny);
    }
    f.financials.equity = 1e6;
    f.financials.tenant_id = TenantId::new();
    assert_eq!(f.eval(&f.guard(), Phase::Pre).verdict, RiskVerdict::Deny);
    f.financials.tenant_id = f.auth.tenant_id;
    f.venue.observed_at = f.now + Duration::seconds(1);
    assert_eq!(f.eval(&f.guard(), Phase::Pre).verdict, RiskVerdict::Deny);
    f.venue.observed_at = f.now;
    f.intent.limit_price = "100.001".into();
    assert_eq!(f.eval(&f.guard(), Phase::Pre).verdict, RiskVerdict::Deny);
}

#[test]
fn x02_decision_expires_at_source_deadline_and_rechecks_identity() {
    let f = Fixture::new();
    let g = f.guard();
    let later = f.now + Duration::seconds(54);
    let d = g
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            later,
        )
        .unwrap();
    assert_eq!(d.verdict, RiskVerdict::Allow);
    assert_eq!(d.expires_at, f.now + Duration::seconds(55));
    g.validate_allow(&d, &f.auth, &f.intent, later).unwrap();
    assert!(
        g.validate_allow(&d, &f.auth, &f.intent, d.expires_at)
            .is_err()
    );
    let mut viewer = f.auth.clone();
    viewer.role = Role::Viewer;
    assert!(g.validate_allow(&d, &viewer, &f.intent, later).is_err());
    let wrong_key = RiskGuard::new(
        f.auth.tenant_id,
        f.auth.workspace_id,
        f.policy.clone(),
        "other".into(),
        [74; 32],
    )
    .unwrap();
    assert!(wrong_key.verify_decision(&d).is_err());
    let g = f.guard();
    let d = g
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            f.now + Duration::seconds(61),
        )
        .unwrap();
    assert_eq!(d.verdict, RiskVerdict::Deny);
}
#[test]
fn x02_concurrent_duplicate_admission_and_kill_revision_have_one_winner() {
    let f = Fixture::new();
    let g = f.guard();
    let results = std::thread::scope(|scope| {
        let jobs: Vec<_> = (0..50)
            .map(|_| {
                let f = &f;
                let g = &g;
                scope.spawn(move || f.eval(g, Phase::Pre).verdict)
            })
            .collect();
        jobs.into_iter()
            .map(|j| j.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert_eq!(
        results.iter().filter(|r| **r == RiskVerdict::Allow).count(),
        1
    );
    let owner = f.owner();
    let results = std::thread::scope(|scope| {
        let jobs: Vec<_> = (0..20)
            .map(|_| {
                let owner = &owner;
                let g = &g;
                let now = f.now;
                scope.spawn(move || {
                    g.set_kill_switch(owner, KillScope::Global, true, 0, "incident", now)
                        .is_ok()
                })
            })
            .collect();
        jobs.into_iter()
            .map(|j| j.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert_eq!(results.into_iter().filter(|r| *r).count(), 1);
    assert_eq!(g.revision().unwrap(), 1);
    assert!(
        g.set_kill_switch(&owner, KillScope::Global, false, 1, "", f.now)
            .is_err()
    );
    assert!(
        g.set_kill_switch(
            &owner,
            KillScope::Global,
            false,
            1,
            "backward",
            f.now - Duration::seconds(1)
        )
        .is_err()
    );
    assert_eq!(g.revision().unwrap(), 1);
    for limit in [f64::NAN, 0.0, -1.0, f64::INFINITY] {
        let mut policy = f.policy.clone();
        policy.limits.max_notional_per_order = limit;
        assert!(
            RiskGuard::new(
                f.auth.tenant_id,
                f.auth.workspace_id,
                policy,
                "fixture".into(),
                [73; 32]
            )
            .is_err()
        );
    }
}

#[test]
fn x02_release_deadline_and_auth_mode_are_part_of_risk_permission() {
    let f = Fixture::with_expiry(2);
    let g = f.guard();
    let decision = f.eval(&g, Phase::Pre);
    assert_eq!(decision.verdict, RiskVerdict::Allow);
    assert_eq!(decision.expires_at, f.now + Duration::seconds(2));
    assert!(
        g.validate_allow(&decision, &f.auth, &f.intent, f.now + Duration::seconds(2))
            .is_err()
    );
    let mut f = f;
    f.intent.command_key = "expired-release".into();
    let denied = g
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            f.now + Duration::seconds(2),
        )
        .unwrap();
    assert!(denied.hit_rules().any(|c| c.rule == Rule::Release));
    let mut fresh = Fixture::new();
    fresh.intent.target = DeploymentTarget::Shadow;
    let denied = fresh.eval(&fresh.guard(), Phase::Pre);
    assert!(denied.hit_rules().any(|c| c.rule == Rule::Identity));
    fresh.auth.mode = quantos_policy::RunMode::Shadow;
    assert_eq!(
        fresh.eval(&fresh.guard(), Phase::Pre).verdict,
        RiskVerdict::Allow
    );
}

#[test]
fn x02_release_universe_extreme_time_and_cross_authority_are_closed() {
    let mut f = Fixture::new();
    let g = f.guard();
    let original = f.eval(&g, Phase::Pre);
    let foreign = RiskGuard::new(
        TenantId::new(),
        f.auth.workspace_id,
        f.policy.clone(),
        "owned-fixture-key".into(),
        [73; 32],
    )
    .unwrap();
    assert!(foreign.verify_decision(&original).is_err());
    f.intent.command_key = "universe".into();
    f.intent.symbol = "ETHUSDT".into();
    f.venue.symbol = "ETHUSDT".into();
    assert!(
        f.eval(&g, Phase::Pre)
            .hit_rules()
            .any(|r| r.rule == Rule::Release)
    );
    f.intent.symbol = "BTCUSDT".into();
    f.venue.symbol = "BTCUSDT".into();
    f.input.max_age_seconds = i64::MIN;
    assert_eq!(f.eval(&g, Phase::Pre).verdict, RiskVerdict::Deny);
    f.input.max_age_seconds = 60;
    f.input.portfolio.as_of = DateTime::<Utc>::MAX_UTC;
    assert_eq!(f.eval(&g, Phase::Pre).verdict, RiskVerdict::Deny);
    assert!(
        g.evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            DateTime::<Utc>::MAX_UTC
        )
        .is_err()
    );
}
