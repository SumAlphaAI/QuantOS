#![allow(unused_imports)]
#[path = "../../../quantos-execution/tests/support/tp07_fixture.rs"]
#[allow(dead_code)]
mod fixture;
pub(crate) use chrono::{Duration, Utc};
pub(crate) use fixture::Fixture;
pub(crate) use quantos_auth::AuthContext;
pub(crate) use quantos_core::{ActorId, ContentHash};
pub(crate) use quantos_execution::{authority::*, dispatch::*, gateway::*};
pub(crate) use quantos_observability::{
    AlertRecord, AlertSeverity, HealthComponent, build_health_report,
};
pub(crate) use quantos_operations::*;
pub(crate) use quantos_policy::{Capability, Role};
pub(crate) use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, MarketMarkEvent, PortfolioEvent,
    PortfolioEventKind,
};
pub(crate) use quantos_risk::guard::{KillScope, Phase, RiskGuard};
pub(crate) use std::sync::{Arc, Barrier};
pub(crate) use std::thread;
pub(crate) struct Harness {
    pub(crate) f: Fixture,
    pub(crate) config: Config,
    pub(crate) seed: Vec<PortfolioEvent>,
    pub(crate) issuer: AtomicCommandIssuer,
    pub(crate) guard: RiskGuard,
    pub(crate) gateway: SignedExecutionGateway<PaperKernel>,
}
pub(crate) fn step(a: &AuthContext, n: chrono::DateTime<Utc>) -> VerifiedStepUp {
    VerifiedStepUp::from_verified_session(a, n, n + Duration::minutes(5)).unwrap()
}
pub(crate) fn reference(o: &Operation) -> ContentHash {
    match &o.outcome {
        Outcome::Applied { reference } => reference.clone(),
        x => panic!("not applied {x:?}"),
    }
}
impl Harness {
    pub(crate) fn new() -> Self {
        let mut f = Fixture::new();
        f.auth.role = Role::Owner;
        for cap in [
            OPS_OPERATE,
            OPS_READ,
            OPS_APPROVE,
            OPS_OBSERVE,
            AUDIT_READ,
            Capability::ACCOUNT_READ,
        ] {
            f.auth.capabilities.insert(Capability::parse(cap).unwrap());
        }
        let ac = f.auth.account_id.unwrap();
        let n = f.now;
        let kinds = vec![
            PortfolioEventKind::AccountStatus(AccountStatusEvent {
                account_id: ac,
                status: AccountStatus::Active,
            }),
            PortfolioEventKind::Fill(FillEvent {
                account_id: ac,
                symbol: "BTCUSDT".into(),
                side: FillSide::Buy,
                quantity: 1000.0,
                price: 100.0,
                fee: 0.0,
            }),
            PortfolioEventKind::Fill(FillEvent {
                account_id: ac,
                symbol: "ETHUSDT".into(),
                side: FillSide::Buy,
                quantity: 4000.0,
                price: 100.0,
                fee: 0.0,
            }),
            PortfolioEventKind::MarketMark(MarketMarkEvent {
                symbol: "BTCUSDT".into(),
                price: 100.0,
                source_at: n - Duration::seconds(2),
            }),
            PortfolioEventKind::MarketMark(MarketMarkEvent {
                symbol: "ETHUSDT".into(),
                price: 100.0,
                source_at: n - Duration::seconds(1),
            }),
        ];
        let seed = kinds
            .into_iter()
            .enumerate()
            .map(|(i, kind)| PortfolioEvent {
                event_id: format!("x03-{i}"),
                sequence: (i + 1) as u64,
                occurred_at: n - Duration::seconds(5 - i as i64),
                kind,
            })
            .collect();
        let config = Config {
            quote_unit: "USDT".into(),
            scope: Scope {
                tenant_id: f.auth.tenant_id,
                workspace_id: f.auth.workspace_id,
                account_id: ac,
                mode: f.auth.mode,
            },
            observer: ActorId::new(),
            started_at: n - Duration::seconds(6),
            max_actions: 2048,
        };
        let guard = f.guard();
        let issuer = f.issuer(&guard);
        let gateway = SignedExecutionGateway::new(
            issuer.clone(),
            GatewayLimits {
                max_quantity: "100".parse().unwrap(),
                max_notional: "50000".parse().unwrap(),
                allowed_venues: vec!["OWNED_PAPER".into()],
            },
            PaperKernel::new("100"),
        )
        .unwrap();
        Self {
            f,
            config,
            seed,
            issuer,
            guard,
            gateway,
        }
    }
    pub(crate) fn service(&self) -> OperationsService<PaperKernel> {
        OperationsService::new(
            self.config.clone(),
            self.seed.clone(),
            self.issuer.clone(),
            self.guard.clone(),
            self.gateway.clone(),
        )
        .unwrap()
    }
    pub(crate) fn command(&self) -> SignedCommand {
        let p = self.f.register(&self.issuer);
        let d = self.f.eval(&self.guard, Phase::Pre);
        self.issuer
            .issue(&self.f.auth, &p, &d, None, self.f.sources(), self.f.now)
            .unwrap()
    }
    pub(crate) fn observer(&self) -> AuthContext {
        let mut a = self.f.auth.clone();
        a.actor_id = self.config.observer;
        a.role = Role::Service;
        a.user_id = uuid::Uuid::new_v4();
        a
    }
    pub(crate) fn approver(&self) -> AuthContext {
        let mut a = self.f.auth.clone();
        a.actor_id = ActorId::new();
        a.user_id = uuid::Uuid::new_v4();
        a.role = Role::Approver;
        a
    }
    pub(crate) fn report(
        &self,
        n: chrono::DateTime<Utc>,
        ready: bool,
    ) -> quantos_observability::ServiceHealthReport {
        build_health_report(
            "service-x06",
            ["execution", "portfolio", "risk", "reconciliation"]
                .into_iter()
                .map(|name| HealthComponent {
                    name: name.into(),
                    ready: ready || name != "execution",
                    detail: "private synthetic secret".into(),
                    checked_at: n,
                })
                .collect(),
            n,
        )
    }
    pub(crate) fn observe(
        &self,
        s: &OperationsService<PaperKernel>,
        n: chrono::DateTime<Utc>,
        ready: bool,
    ) {
        s.observe(&self.observer(), &self.report(n, ready), &[], n)
            .unwrap();
    }
}
