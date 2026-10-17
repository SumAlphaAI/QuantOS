//! X02 rule predicates. Every rule is evaluated, so a deny always dominates approval.
use crate::{RiskLimits, RiskVerdict};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rule {
    Identity,
    Numbers,
    Precision,
    GlobalKill,
    AccountKill,
    Release,
    Snapshot,
    Financials,
    Venue,
    Duplicate,
    OrderNotional,
    Leverage,
    Concentration,
    DailyLoss,
    Approval,
}
impl Rule {
    pub const ALL: [Self; 15] = [
        Self::Identity,
        Self::Numbers,
        Self::Precision,
        Self::GlobalKill,
        Self::AccountKill,
        Self::Release,
        Self::Snapshot,
        Self::Financials,
        Self::Venue,
        Self::Duplicate,
        Self::OrderNotional,
        Self::Leverage,
        Self::Concentration,
        Self::DailyLoss,
        Self::Approval,
    ];
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuleCheck {
    pub rule: Rule,
    pub breached: bool,
    pub limit_id: String,
}
/// Facts are constructed only by the service from scoped, validated inputs.
pub(crate) struct Facts {
    pub pre: bool,
    pub identity: bool,
    pub numbers: bool,
    pub precision: bool,
    pub global_kill: bool,
    pub account_kill: bool,
    pub release: bool,
    pub snapshot: bool,
    pub financials: bool,
    pub venue: bool,
    pub duplicate: bool,
    pub notional: f64,
    pub gross_after: f64,
    pub symbol_after: f64,
    pub equity: f64,
    pub daily_pnl: f64,
    pub approval: bool,
}
pub(crate) fn evaluate(f: &Facts, limits: &RiskLimits) -> (RiskVerdict, Vec<RuleCheck>) {
    let breaches = [
        !f.identity,
        !f.numbers,
        !f.precision,
        f.global_kill,
        f.account_kill,
        !f.release,
        !f.snapshot,
        !f.financials,
        !f.venue,
        f.duplicate,
        f.pre && f.notional > limits.max_notional_per_order,
        f.equity <= 0.0 || f.gross_after / f.equity > limits.max_leverage,
        f.gross_after > 0.0 && f.symbol_after / f.gross_after > limits.max_symbol_concentration,
        f.daily_pnl < -limits.max_daily_loss,
        f.pre && f.notional > limits.approval_notional_threshold && !f.approval,
    ];
    let checks: Vec<_> = Rule::ALL
        .into_iter()
        .zip(breaches)
        .map(|(rule, breached)| RuleCheck {
            rule,
            breached,
            limit_id: format!("x02.{rule:?}"),
        })
        .collect();
    let verdict = if checks
        .iter()
        .any(|c| c.breached && c.rule != Rule::Approval)
    {
        RiskVerdict::Deny
    } else if checks.last().expect("fixed rule catalogue").breached {
        RiskVerdict::ApprovalRequired
    } else {
        RiskVerdict::Allow
    };
    (verdict, checks)
}
