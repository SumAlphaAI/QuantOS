use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use quantos_core::{AccountId, ContentHash, CoreError, DecisionId, canonical_json_bytes};
use quantos_portfolio::PortfolioSnapshot;
use quantos_strategy::release::StrategyRelease;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

pub const RISK_ENGINE_VERSION: &str = "quantos-risk.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskVerdict {
    Allow,
    Deny,
    ApprovalRequired,
}

impl RiskVerdict {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Allow => "allow",
            Self::Deny => "deny",
            Self::ApprovalRequired => "approval_required",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskRule {
    KillSwitchGlobal,
    KillSwitchAccount,
    VenueUnhealthy,
    AccountInactive,
    ReleaseInvalid,
    DataStale,
    DuplicateCommand,
    PrecisionExceeded,
    NotionalLimitExceeded,
    ApprovalRequired,
    LeverageExceeded,
    ConcentrationExceeded,
}

impl RiskRule {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::KillSwitchGlobal => "kill_switch_global",
            Self::KillSwitchAccount => "kill_switch_account",
            Self::VenueUnhealthy => "venue_unhealthy",
            Self::AccountInactive => "account_inactive",
            Self::ReleaseInvalid => "release_invalid",
            Self::DataStale => "data_stale",
            Self::DuplicateCommand => "duplicate_command",
            Self::PrecisionExceeded => "precision_exceeded",
            Self::NotionalLimitExceeded => "notional_limit_exceeded",
            Self::ApprovalRequired => "approval_required",
            Self::LeverageExceeded => "leverage_exceeded",
            Self::ConcentrationExceeded => "concentration_exceeded",
        }
    }

    #[must_use]
    pub const fn all() -> &'static [Self] {
        &[
            Self::KillSwitchGlobal,
            Self::KillSwitchAccount,
            Self::VenueUnhealthy,
            Self::AccountInactive,
            Self::ReleaseInvalid,
            Self::DataStale,
            Self::DuplicateCommand,
            Self::PrecisionExceeded,
            Self::NotionalLimitExceeded,
            Self::ApprovalRequired,
            Self::LeverageExceeded,
            Self::ConcentrationExceeded,
        ]
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RiskRuleHit {
    pub rule: RiskRule,
    pub detail: String,
    pub limit_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RiskLimits {
    pub max_notional_per_order: f64,
    pub max_leverage: f64,
    pub max_symbol_concentration: f64,
    pub max_quantity_scale: u32,
    pub max_price_scale: u32,
    pub approval_notional_threshold: f64,
    pub max_daily_loss: f64,
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            max_notional_per_order: 250_000.0,
            max_leverage: 3.0,
            max_symbol_concentration: 0.6,
            max_quantity_scale: 4,
            max_price_scale: 2,
            approval_notional_threshold: 100_000.0,
            max_daily_loss: 50_000.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReleaseRiskInput {
    pub verified: bool,
    pub approved: bool,
    pub target_allowed: bool,
}

impl From<&StrategyRelease> for ReleaseRiskInput {
    fn from(release: &StrategyRelease) -> Self {
        Self {
            verified: release.is_verified(),
            approved: release.is_approved(),
            target_allowed: !release.allowed_targets.is_empty(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PortfolioRiskInput {
    pub equity: f64,
    pub exposure_gross: f64,
    pub symbol_notional: f64,
    pub realized_pnl_today: f64,
}

impl PortfolioRiskInput {
    #[must_use]
    pub fn from_snapshot(snapshot: &PortfolioSnapshot, equity: f64, symbol: &str) -> Self {
        let symbol_notional = snapshot
            .positions
            .iter()
            .find(|position| position.symbol == symbol)
            .map_or(0.0, |position| position.market_value.abs());
        Self {
            equity,
            exposure_gross: snapshot.exposure_gross,
            symbol_notional,
            realized_pnl_today: snapshot.realized_pnl,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RiskCheckInput {
    pub account_id: AccountId,
    pub command_key: String,
    pub symbol: String,
    pub side: String,
    pub quantity: String,
    pub limit_price: String,
    pub notional: f64,
    pub release: ReleaseRiskInput,
    pub portfolio: PortfolioRiskInput,
    pub account_active: bool,
    pub venue_healthy: bool,
    pub data_expires_at: DateTime<Utc>,
    pub approval_signature: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RiskDecision {
    pub decision_id: DecisionId,
    pub verdict: RiskVerdict,
    pub hit_rules: Vec<RiskRuleHit>,
    pub limit_ids: Vec<String>,
    pub signer: String,
    pub reason: String,
    pub signature: ContentHash,
    pub decided_at: DateTime<Utc>,
}

#[derive(Debug, Error)]
pub enum RiskError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("RISK_QUANTITY_INVALID: `{value}` is not a valid non-negative decimal")]
    InvalidDecimal { value: String },
}

#[derive(Debug, Default, Clone)]
pub struct KillSwitchRegistry {
    global_engaged: Option<DateTime<Utc>>,
    account_engaged: BTreeMap<AccountId, DateTime<Utc>>,
}

impl KillSwitchRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn engage_global(&mut self, engaged_at: DateTime<Utc>) {
        self.global_engaged = Some(engaged_at);
    }

    pub fn disengage_global(&mut self) {
        self.global_engaged = None;
    }

    pub fn engage_account(&mut self, account_id: AccountId, engaged_at: DateTime<Utc>) {
        self.account_engaged.insert(account_id, engaged_at);
    }

    pub fn disengage_account(&mut self, account_id: AccountId) {
        self.account_engaged.remove(&account_id);
    }

    #[must_use]
    pub fn is_global_engaged(&self) -> bool {
        self.global_engaged.is_some()
    }

    #[must_use]
    pub fn is_account_engaged(&self, account_id: AccountId) -> bool {
        self.account_engaged.contains_key(&account_id)
    }
}

#[derive(Debug, Clone)]
pub struct RiskEngine {
    limits: RiskLimits,
    kill_switch: KillSwitchRegistry,
    seen_command_keys: BTreeSet<String>,
}

impl RiskEngine {
    #[must_use]
    pub fn new(limits: RiskLimits) -> Self {
        Self {
            limits,
            kill_switch: KillSwitchRegistry::new(),
            seen_command_keys: BTreeSet::new(),
        }
    }

    pub fn kill_switch(&mut self) -> &mut KillSwitchRegistry {
        &mut self.kill_switch
    }

    pub fn evaluate_pre_trade(
        &mut self,
        input: &RiskCheckInput,
        decided_at: DateTime<Utc>,
    ) -> Result<RiskDecision, RiskError> {
        parse_decimal(&input.quantity)?;
        parse_decimal(&input.limit_price)?;

        let mut hits: Vec<RiskRuleHit> = Vec::new();
        let mut verdict = RiskVerdict::Allow;

        if self.kill_switch.is_global_engaged() {
            hits.push(hit(
                RiskRule::KillSwitchGlobal,
                "global kill switch engaged",
            ));
            verdict = RiskVerdict::Deny;
        } else if self.kill_switch.is_account_engaged(input.account_id) {
            hits.push(hit(
                RiskRule::KillSwitchAccount,
                "account kill switch engaged",
            ));
            verdict = RiskVerdict::Deny;
        } else if !input.venue_healthy {
            hits.push(hit(RiskRule::VenueUnhealthy, "venue health check failed"));
            verdict = RiskVerdict::Deny;
        } else if !input.account_active {
            hits.push(hit(RiskRule::AccountInactive, "account is not active"));
            verdict = RiskVerdict::Deny;
        } else if !input.release.verified
            || !input.release.approved
            || !input.release.target_allowed
        {
            hits.push(hit(
                RiskRule::ReleaseInvalid,
                "strategy release is unverified, unapproved, or has no allowed target",
            ));
            verdict = RiskVerdict::Deny;
        } else if input.data_expires_at <= decided_at {
            hits.push(hit(RiskRule::DataStale, "risk input snapshot is stale"));
            verdict = RiskVerdict::Deny;
        } else if self.seen_command_keys.contains(&input.command_key) {
            hits.push(hit(RiskRule::DuplicateCommand, "duplicate idempotency key"));
            verdict = RiskVerdict::Deny;
        } else if decimal_scale(&input.quantity) > self.limits.max_quantity_scale
            || decimal_scale(&input.limit_price) > self.limits.max_price_scale
        {
            hits.push(hit_with_limit(
                RiskRule::PrecisionExceeded,
                "quantity or price exceeds precision limits",
                "limit.precision",
            ));
            verdict = RiskVerdict::Deny;
        } else if input.notional > self.limits.max_notional_per_order {
            hits.push(hit_with_limit(
                RiskRule::NotionalLimitExceeded,
                format!(
                    "notional {:.2} exceeds per-order limit {:.2}",
                    input.notional, self.limits.max_notional_per_order
                ),
                "limit.notional_per_order",
            ));
            verdict = RiskVerdict::Deny;
        } else {
            let gross_after = input.portfolio.exposure_gross + input.notional;
            if input.portfolio.equity <= 0.0
                || gross_after / input.portfolio.equity > self.limits.max_leverage
            {
                hits.push(hit_with_limit(
                    RiskRule::LeverageExceeded,
                    format!(
                        "leverage {:.4} exceeds limit {:.2}",
                        gross_after / input.portfolio.equity.max(f64::MIN_POSITIVE),
                        self.limits.max_leverage
                    ),
                    "limit.leverage",
                ));
                verdict = RiskVerdict::Deny;
            } else if gross_after > 0.0
                && (input.portfolio.symbol_notional + input.notional) / gross_after
                    > self.limits.max_symbol_concentration
            {
                hits.push(hit_with_limit(
                    RiskRule::ConcentrationExceeded,
                    format!(
                        "symbol concentration {:.4} exceeds limit {:.2}",
                        (input.portfolio.symbol_notional + input.notional) / gross_after,
                        self.limits.max_symbol_concentration
                    ),
                    "limit.symbol_concentration",
                ));
                verdict = RiskVerdict::Deny;
            } else if input.notional > self.limits.approval_notional_threshold
                && input.approval_signature.is_none()
            {
                hits.push(hit_with_limit(
                    RiskRule::ApprovalRequired,
                    format!(
                        "notional {:.2} requires approval above {:.2}",
                        input.notional, self.limits.approval_notional_threshold
                    ),
                    "limit.approval_threshold",
                ));
                verdict = RiskVerdict::ApprovalRequired;
            }
        }
        self.seen_command_keys.insert(input.command_key.clone());
        self.decision(verdict, hits, decided_at)
    }

    pub fn evaluate_post_trade(
        &mut self,
        input: &RiskCheckInput,
        decided_at: DateTime<Utc>,
    ) -> Result<RiskDecision, RiskError> {
        let mut hits = Vec::new();
        let mut verdict = RiskVerdict::Allow;

        if self.kill_switch.is_global_engaged() {
            hits.push(hit(
                RiskRule::KillSwitchGlobal,
                "global kill switch engaged",
            ));
            verdict = RiskVerdict::Deny;
        } else if self.kill_switch.is_account_engaged(input.account_id) {
            hits.push(hit(
                RiskRule::KillSwitchAccount,
                "account kill switch engaged",
            ));
            verdict = RiskVerdict::Deny;
        } else if input.portfolio.realized_pnl_today < -self.limits.max_daily_loss {
            hits.push(hit_with_limit(
                RiskRule::NotionalLimitExceeded,
                format!(
                    "daily loss {:.2} breaches limit {:.2}",
                    input.portfolio.realized_pnl_today, -self.limits.max_daily_loss
                ),
                "limit.max_daily_loss",
            ));
            verdict = RiskVerdict::Deny;
        } else if input.portfolio.equity > 0.0
            && input.portfolio.exposure_gross / input.portfolio.equity > self.limits.max_leverage
        {
            hits.push(hit_with_limit(
                RiskRule::LeverageExceeded,
                "post-trade leverage exceeds limit",
                "limit.leverage",
            ));
            verdict = RiskVerdict::Deny;
        }

        self.decision(verdict, hits, decided_at)
    }

    fn decision(
        &self,
        verdict: RiskVerdict,
        hits: Vec<RiskRuleHit>,
        decided_at: DateTime<Utc>,
    ) -> Result<RiskDecision, RiskError> {
        let limit_ids: Vec<String> = hits.iter().filter_map(|hit| hit.limit_id.clone()).collect();
        let reason = if hits.is_empty() {
            "all risk rules passed".to_owned()
        } else {
            hits.iter()
                .map(|hit| format!("{}: {}", hit.rule.as_str(), hit.detail))
                .collect::<Vec<_>>()
                .join("; ")
        };
        let signature = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "signer": RISK_ENGINE_VERSION,
            "verdict": verdict.as_str(),
            "hit_rules": hits.iter().map(|hit| hit.rule.as_str()).collect::<Vec<_>>(),
            "limit_ids": limit_ids,
            "reason": reason,
            "decided_at": decided_at,
        }))?);
        Ok(RiskDecision {
            decision_id: DecisionId::new(),
            verdict,
            hit_rules: hits,
            limit_ids,
            signer: RISK_ENGINE_VERSION.to_owned(),
            reason,
            signature,
            decided_at,
        })
    }
}

fn hit(rule: RiskRule, detail: impl Into<String>) -> RiskRuleHit {
    RiskRuleHit {
        rule,
        detail: detail.into(),
        limit_id: None,
    }
}

fn hit_with_limit(rule: RiskRule, detail: impl Into<String>, limit_id: &str) -> RiskRuleHit {
    RiskRuleHit {
        rule,
        detail: detail.into(),
        limit_id: Some(limit_id.to_owned()),
    }
}

fn parse_decimal(value: &str) -> Result<f64, RiskError> {
    let parsed = value
        .trim()
        .parse::<f64>()
        .map_err(|_| RiskError::InvalidDecimal {
            value: value.to_owned(),
        })?;
    if parsed < 0.0 || !parsed.is_finite() {
        return Err(RiskError::InvalidDecimal {
            value: value.to_owned(),
        });
    }
    Ok(parsed)
}

#[must_use]
pub fn decimal_scale(value: &str) -> u32 {
    value
        .trim()
        .split_once('.')
        .map_or(0, |(_, fraction)| fraction.len() as u32)
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::AccountId;

    use super::*;

    fn decided_at() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn baseline_input(account_id: AccountId, seed: u64) -> RiskCheckInput {
        RiskCheckInput {
            account_id,
            command_key: format!("cmd-{seed:04}"),
            symbol: "BTCUSDT".to_owned(),
            side: "buy".to_owned(),
            quantity: "1.5".to_owned(),
            limit_price: "100.25".to_owned(),
            notional: 1_000.0 + (seed % 50) as f64,
            release: ReleaseRiskInput {
                verified: true,
                approved: true,
                target_allowed: true,
            },
            portfolio: PortfolioRiskInput {
                equity: 1_000_000.0,
                exposure_gross: 500_000.0,
                symbol_notional: 100_000.0,
                realized_pnl_today: 0.0,
            },
            account_active: true,
            venue_healthy: true,
            data_expires_at: decided_at() + ChronoDuration::minutes(10),
            approval_signature: None,
        }
    }

    #[test]
    fn fifty_allow_fixtures_all_pass() {
        let account_id = AccountId::new();
        let mut engine = RiskEngine::new(RiskLimits::default());
        for seed in 0..50_u64 {
            let decision = engine
                .evaluate_pre_trade(&baseline_input(account_id, seed), decided_at())
                .expect("evaluation succeeds");
            assert_eq!(decision.verdict, RiskVerdict::Allow);
            assert!(decision.hit_rules.is_empty());
            assert_eq!(decision.signer, RISK_ENGINE_VERSION);
            assert!(!decision.signature.as_str().is_empty());
        }
    }

    #[test]
    fn fifty_approval_required_fixtures_all_route_to_approval() {
        let account_id = AccountId::new();
        let mut engine = RiskEngine::new(RiskLimits::default());
        for seed in 0..50_u64 {
            let mut input = baseline_input(account_id, seed);
            input.notional = 150_000.0 + seed as f64;
            let decision = engine
                .evaluate_pre_trade(&input, decided_at())
                .expect("evaluation succeeds");
            assert_eq!(decision.verdict, RiskVerdict::ApprovalRequired);
            assert!(
                decision
                    .hit_rules
                    .iter()
                    .any(|hit| hit.rule == RiskRule::ApprovalRequired)
            );
            assert!(
                decision
                    .limit_ids
                    .contains(&"limit.approval_threshold".to_owned())
            );
        }
    }

    #[test]
    fn fifty_deny_fixtures_cover_every_rule_and_include_limits_and_signature() {
        let account_id = AccountId::new();
        type DenyVariant = Box<dyn Fn(&mut RiskEngine, &mut RiskCheckInput)>;
        let deny_variants: Vec<DenyVariant> = vec![
            Box::new(|engine, _| engine.kill_switch().engage_global(decided_at())),
            Box::new(|engine, input| {
                engine
                    .kill_switch()
                    .engage_account(input.account_id, decided_at())
            }),
            Box::new(|_, input| input.venue_healthy = false),
            Box::new(|_, input| input.account_active = false),
            Box::new(|_, input| input.release.verified = false),
            Box::new(|_, input| input.data_expires_at = decided_at() - ChronoDuration::seconds(1)),
            Box::new(|_, input| input.quantity = "1.123456".to_owned()),
            Box::new(|_, input| input.notional = 500_000.0),
            Box::new(|_, input| input.portfolio.equity = 100_000.0),
            Box::new(|_, input| {
                input.portfolio.symbol_notional = 490_000.0;
                input.portfolio.exposure_gross = 500_000.0;
                input.portfolio.equity = 10_000_000.0;
            }),
        ];
        let mut covered: BTreeSet<RiskRule> = BTreeSet::new();
        let mut engine = RiskEngine::new(RiskLimits::default());
        for seed in 0..50_u64 {
            engine.kill_switch().disengage_global();
            engine.kill_switch().disengage_account(account_id);
            let mut input = baseline_input(account_id, seed);
            let variant = &deny_variants[(seed as usize) % deny_variants.len()];
            variant(&mut engine, &mut input);
            let decision = engine
                .evaluate_pre_trade(&input, decided_at())
                .expect("evaluation succeeds");
            assert_eq!(decision.verdict, RiskVerdict::Deny);
            assert!(!decision.hit_rules.is_empty());
            assert!(!decision.reason.is_empty());
            assert!(!decision.signature.as_str().is_empty());
            for hit in &decision.hit_rules {
                covered.insert(hit.rule);
            }
        }

        let duplicate_input = baseline_input(account_id, 9_999);
        engine
            .evaluate_pre_trade(&duplicate_input, decided_at())
            .expect("first pass");
        let duplicate = engine
            .evaluate_pre_trade(&duplicate_input, decided_at())
            .expect("duplicate detected");
        assert_eq!(duplicate.verdict, RiskVerdict::Deny);
        assert!(
            duplicate
                .hit_rules
                .iter()
                .any(|hit| hit.rule == RiskRule::DuplicateCommand)
        );
        covered.insert(RiskRule::DuplicateCommand);

        let approval_probe = {
            let mut engine = RiskEngine::new(RiskLimits::default());
            let mut input = baseline_input(account_id, 8_888);
            input.notional = 120_000.0;
            engine
                .evaluate_pre_trade(&input, decided_at())
                .expect("probe")
        };
        for hit in &approval_probe.hit_rules {
            covered.insert(hit.rule);
        }

        let coverage = covered.len() as f64 / RiskRule::all().len() as f64;
        assert!(
            coverage >= 0.95,
            "rule branch coverage {coverage:.2} below 0.95 (covered {covered:?})"
        );
    }

    #[test]
    fn kill_switch_rejects_new_commands_under_one_second_p95() {
        let account_id = AccountId::new();
        let mut engine = RiskEngine::new(RiskLimits::default());
        engine.kill_switch().engage_global(decided_at());

        let mut durations = Vec::new();
        for seed in 0..100_u64 {
            let input = baseline_input(account_id, seed);
            let started = Instant::now();
            let decision = engine
                .evaluate_pre_trade(&input, decided_at())
                .expect("evaluation succeeds");
            durations.push(started.elapsed());
            assert_eq!(decision.verdict, RiskVerdict::Deny);
            assert!(
                decision
                    .hit_rules
                    .iter()
                    .any(|hit| hit.rule == RiskRule::KillSwitchGlobal)
            );
        }
        durations.sort();
        let p95 = durations[(durations.len() * 95 / 100).min(durations.len() - 1)];
        assert!(
            p95 < std::time::Duration::from_secs(1),
            "kill switch rejection p95 {p95:?} exceeded 1s"
        );
    }

    #[test]
    fn post_trade_rules_catch_daily_loss_and_leverage_breach() {
        let account_id = AccountId::new();
        let mut engine = RiskEngine::new(RiskLimits::default());

        let mut loss_input = baseline_input(account_id, 1);
        loss_input.portfolio.realized_pnl_today = -60_000.0;
        let decision = engine
            .evaluate_post_trade(&loss_input, decided_at())
            .expect("evaluation succeeds");
        assert_eq!(decision.verdict, RiskVerdict::Deny);
        assert!(
            decision
                .limit_ids
                .contains(&"limit.max_daily_loss".to_owned())
        );

        let mut leverage_input = baseline_input(account_id, 2);
        leverage_input.portfolio.equity = 100_000.0;
        leverage_input.portfolio.exposure_gross = 500_000.0;
        let decision = engine
            .evaluate_post_trade(&leverage_input, decided_at())
            .expect("evaluation succeeds");
        assert_eq!(decision.verdict, RiskVerdict::Deny);
        assert!(decision.limit_ids.contains(&"limit.leverage".to_owned()));
    }
}
