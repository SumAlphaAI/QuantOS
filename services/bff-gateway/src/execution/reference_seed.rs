// Owned real-module fixture, derived from X03 tests; no upstream/target services.
#[path = "reference_release.rs"]
pub(crate) mod release_fixture;
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::ActorId;
use quantos_policy::{Capability, Role};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, InMemoryPortfolioProjection,
    MarketMarkEvent, PortfolioEvent, PortfolioEventKind, RiskInputSnapshot,
};
use quantos_risk::{RiskLimits, guard::*};
use quantos_strategy::release::{DeploymentTarget, InMemoryStrategyReleaseStore, StrategyRelease};

#[derive(Clone)]
pub(crate) struct Fixture {
    pub(crate) auth: AuthContext,
    pub(crate) release: StrategyRelease,
    pub(crate) now: DateTime<Utc>,
    pub(crate) input: RiskInputSnapshot,
    pub(crate) projection: InMemoryPortfolioProjection,
    pub(crate) financials: AccountFinancials,
    pub(crate) venue: VenueState,
    pub(crate) policy: RiskPolicy,
    pub(crate) intent: TradeIntent,
}
impl Fixture {
    pub(crate) fn new() -> Self {
        Self::with_expiry(1800)
    }
    pub(crate) fn with_expiry(seconds: i64) -> Self {
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
        let projection = InMemoryPortfolioProjection::rebuild(
            auth.tenant_id,
            now - Duration::seconds(6),
            &events,
        )
        .unwrap();
        let input = projection.risk_snapshot(account, now, 60).unwrap();
        let financials = AccountFinancials {
            tenant_id: auth.tenant_id,
            account_id: account,
            quote_unit: "USD".into(),
            equity: 1_000_000.0,
            realized_pnl_today: 0.0,
            utc_day: now.date_naive(),
            as_of: now,
            source_ref: "owned-cash-and-daily-ledger".into(),
        };
        let venue = VenueState {
            venue: "OWNED_PAPER".into(),
            symbol: "BTCUSDT".into(),
            quote_unit: "USD".into(),
            healthy: true,
            observed_at: now,
        };
        let policy = RiskPolicy {
            version: "x03-test-v1".into(),
            quote_unit: "USD".into(),
            limits: RiskLimits::default(),
            max_age_seconds: 60,
            decision_ttl_seconds: 10,
        };
        let intent = TradeIntent {
            account_id: account,
            command_key: "x03-0".into(),
            symbol: "BTCUSDT".into(),
            side: Side::Buy,
            quantity: "1500".into(),
            limit_price: "100".into(),
            release_id: release.release_id,
            target: DeploymentTarget::Paper,
        };
        Self {
            auth,
            release,
            now,
            input,
            projection,
            financials,
            venue,
            policy,
            intent,
        }
    }
    pub(crate) fn guard(&self) -> RiskGuard {
        RiskGuard::new(
            self.auth.tenant_id,
            self.auth.workspace_id,
            self.policy.clone(),
            "owned-fixture-key".into(),
            [73; 32],
        )
        .unwrap()
    }
}
use quantos_core::{ArtifactId, ContentHash, WorkflowRunId, canonical_json_bytes};
use quantos_execution::authority::*;
use quantos_runtime::signal_proposal::{TradeProposalRecord, WorkflowEvidenceRecord};
use quantos_storage::ArtifactManifest;
use serde_json::json;
impl Fixture {
    pub(crate) fn issuer(&self, g: &RiskGuard) -> AtomicCommandIssuer {
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
    pub(crate) fn record(&self) -> TradeProposalRecord {
        let metadata = json!({"request_id":"x03","tenant_id":self.auth.tenant_id,"workspace_id":self.auth.workspace_id,"actor":{"actor_id":self.auth.actor_id,"actor_kind":"ACTOR_KIND_USER"},"correlation_id":"x03","mode":"RUNTIME_MODE_RESEARCH","environment":"ENVIRONMENT_LOCAL","issued_at":self.now});
        let evidence = json!([{"evidence_id":"owned-proof","artifact_id":"owned-artifact","summary":"synthetic local evidence"}]);
        let output = json!({"metadata":metadata,"proposal_id":format!("proposal:{}",self.intent.command_key),"account_id":self.intent.account_id,"symbol":self.intent.symbol,"action":"PROPOSAL_ACTION_BUY","quantity":{"value":self.intent.quantity},"notional":{"value":(self.intent.quantity.parse::<u64>().unwrap()*100).to_string()},"signal":{"metadata":metadata,"signal_id":"owned-signal","strategy_release_id":self.release.release_id,"symbol":self.intent.symbol,"direction":"SIGNAL_DIRECTION_LONG","strength":{"value":"0.5"},"confidence":{"value":"0.5"},"diagnostics":{"value":{"model_version":"local","strategy_version":"local","data_version":"local","model_digest":ContentHash::sha256_bytes(b"owned-model")}},"generated_at":self.now-Duration::seconds(1),"valid_until":self.now+Duration::seconds(60),"evidence_refs":evidence},"rationale":"owned fixture","confidence":{"value":"0.5"},"expires_at":self.now+Duration::seconds(60),"executable":false,"evidence_refs":evidence,"counter_views":["synthetic counter view"]});
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
            expires_at: self.now + Duration::seconds(60),
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
}
