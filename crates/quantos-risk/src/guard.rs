//! Process-local risk authority. Callers supply F06-authenticated identity and trusted
//! source data; deployment, durable kill state and command issuance are separate gates.
use crate::{
    RiskLimits, RiskVerdict,
    rules::{self, Facts, RuleCheck},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use hmac::{Hmac, Mac};
use quantos_auth::AuthContext;
use quantos_core::{
    AccountId, ActorId, CommandId, ContentHash, DecisionId, ProposalId, TenantId, WorkspaceId,
    canonical_json_bytes,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_portfolio::RiskInputSnapshot;
use quantos_strategy::release::{DeploymentPolicy, DeploymentTarget, StrategyRelease};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Arc, Mutex, MutexGuard},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GuardError {
    #[error("X02 invalid configuration or input: {0}")]
    Invalid(&'static str),
    #[error("X02 authorization denied")]
    Unauthorized,
    #[error("X02 state revision conflict")]
    Conflict,
    #[error("X02 signature, binding, verdict or freshness invalid")]
    DecisionInvalid,
    #[error("X02 shared state unavailable; fail closed")]
    Unavailable,
    #[error(transparent)]
    Core(#[from] quantos_core::CoreError),
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RiskPolicy {
    pub version: String,
    pub quote_unit: String,
    pub limits: RiskLimits,
    pub max_age_seconds: i64,
    pub decision_ttl_seconds: i64,
}
impl RiskPolicy {
    fn validate(&self) -> Result<(), GuardError> {
        let l = &self.limits;
        if self.version.is_empty()
            || !symbol_valid(&self.quote_unit)
            || !(1..=3600).contains(&self.max_age_seconds)
            || !(1..=60).contains(&self.decision_ttl_seconds)
            || [
                l.max_notional_per_order,
                l.max_leverage,
                l.max_symbol_concentration,
                l.approval_notional_threshold,
                l.max_daily_loss,
            ]
            .iter()
            .any(|v| !v.is_finite() || *v <= 0.0)
            || l.max_symbol_concentration > 1.0
            || l.max_quantity_scale > 18
            || l.max_price_scale > 18
            || l.approval_notional_threshold > l.max_notional_per_order
        {
            return Err(GuardError::Invalid("policy"));
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    Buy,
    Sell,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TradeIntent {
    pub account_id: AccountId,
    pub command_key: String,
    pub symbol: String,
    pub side: Side,
    pub quantity: String,
    pub limit_price: String,
    pub release_id: ProposalId,
    pub target: DeploymentTarget,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AccountFinancials {
    pub tenant_id: TenantId,
    pub account_id: AccountId,
    pub quote_unit: String,
    pub equity: f64,
    pub realized_pnl_today: f64,
    pub utc_day: NaiveDate,
    pub as_of: DateTime<Utc>,
    pub source_ref: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VenueState {
    pub venue: String,
    pub symbol: String,
    pub quote_unit: String,
    pub healthy: bool,
    pub observed_at: DateTime<Utc>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KillScope {
    Global,
    Account(AccountId),
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KillReceipt {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub revision: u64,
    pub actor_id: ActorId,
    pub scope: KillScope,
    pub engaged: bool,
    pub reason: String,
    pub at: DateTime<Utc>,
    pub signer: String,
    pub signature: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApprovalToken {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub account_id: AccountId,
    pub requester: ActorId,
    pub approver: ActorId,
    pub intent_hash: ContentHash,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub signer: String,
    pub signature: String,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Pre,
    Post,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GuardDecision {
    pub decision_id: DecisionId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub account_id: AccountId,
    pub requester: ActorId,
    pub phase: Phase,
    /// Review purpose is signed and cannot be consumed by the order issuer.
    pub purpose: String,
    pub proposal_hash: Option<ContentHash>,
    pub intent_hash: ContentHash,
    pub snapshot_hash: ContentHash,
    pub facts_hash: ContentHash,
    pub policy: RiskPolicy,
    pub kill_revision: u64,
    pub verdict: RiskVerdict,
    pub checks: Vec<RuleCheck>,
    pub decided_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub signer: String,
    pub signature: String,
}
impl GuardDecision {
    pub fn hit_rules(&self) -> impl Iterator<Item = &RuleCheck> {
        self.checks.iter().filter(|c| c.breached)
    }
}
#[derive(Default)]
struct State {
    revision: u64,
    global: bool,
    accounts: BTreeSet<AccountId>,
    seen: BTreeSet<(AccountId, String)>,
    posts: BTreeSet<(AccountId, String)>,
    at: Option<DateTime<Utc>>,
    receipts: Vec<KillReceipt>,
    decisions: BTreeMap<DecisionId, GuardDecision>,
    consumers: BTreeMap<DecisionId, CommandId>,
}
struct Inner {
    tenant: TenantId,
    workspace: WorkspaceId,
    key: [u8; 32],
    signer: String,
    policy: RiskPolicy,
    state: Mutex<State>,
}
/// Clones share the same state and lock; no clone can bypass an engaged switch.
/// Key material is intentionally neither Debug nor Serialize.
#[derive(Clone)]
pub struct RiskGuard(Arc<Inner>);
impl RiskGuard {
    /// Wiring identity only; exposes no key or mutation authority.
    pub fn same_instance(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
    pub fn scope_matches(&self, tenant: TenantId, workspace: WorkspaceId) -> bool {
        self.0.tenant == tenant && self.0.workspace == workspace
    }
    pub fn new(
        tenant: TenantId,
        workspace: WorkspaceId,
        policy: RiskPolicy,
        signer: String,
        key: [u8; 32],
    ) -> Result<Self, GuardError> {
        policy.validate()?;
        if signer.is_empty() || key.iter().all(|b| *b == 0) {
            return Err(GuardError::Invalid("signer/key"));
        }
        Ok(Self(Arc::new(Inner {
            tenant,
            workspace,
            key,
            signer,
            policy,
            state: Mutex::new(State::default()),
        })))
    }
    fn lock(&self) -> Result<MutexGuard<'_, State>, GuardError> {
        self.0.state.lock().map_err(|_| GuardError::Unavailable)
    }
    fn scoped(&self, auth: &AuthContext, account: Option<AccountId>) -> bool {
        auth.tenant_id == self.0.tenant
            && auth.workspace_id == self.0.workspace
            && (auth.account_id.is_none() || auth.account_id == account)
    }
    fn capable(auth: &AuthContext, cap: &str) -> bool {
        auth.capabilities.iter().any(|c| c.as_str() == cap)
    }
    /// Read-only configured limits for trusted owner capability projections.
    pub fn policy(&self) -> &RiskPolicy {
        &self.0.policy
    }
    /// Owner adapter projection of this exact guard; no mutation or credential.
    pub fn kill_status(&self, account: AccountId) -> Result<serde_json::Value, GuardError> {
        let s = self.lock()?;
        Ok(
            json!({"revision":s.revision,"global":s.global,"account":s.accounts.contains(&account),"receipts":s.receipts}),
        )
    }
    pub fn revision(&self) -> Result<u64, GuardError> {
        Ok(self.lock()?.revision)
    }
    pub fn receipts(&self, auth: &AuthContext) -> Result<Vec<KillReceipt>, GuardError> {
        if !self.scoped(auth, None) || auth.role != Role::Owner {
            return Err(GuardError::Unauthorized);
        }
        Ok(self.lock()?.receipts.clone())
    }
    pub fn set_kill_switch(
        &self,
        auth: &AuthContext,
        scope: KillScope,
        engaged: bool,
        expected_revision: u64,
        reason: &str,
        at: DateTime<Utc>,
    ) -> Result<KillReceipt, GuardError> {
        let account = match scope {
            KillScope::Global => None,
            KillScope::Account(id) => Some(id),
        };
        if !self.scoped(auth, account)
            || !Self::capable(auth, Capability::EXECUTION_OPERATE)
            || !matches!(auth.role, Role::Owner | Role::Operator)
            || (!engaged && auth.role != Role::Owner)
        {
            return Err(GuardError::Unauthorized);
        }
        if reason.trim().is_empty() || reason.len() > 256 {
            return Err(GuardError::Invalid("kill reason"));
        }
        let mut state = self.lock()?;
        if state.revision != expected_revision {
            return Err(GuardError::Conflict);
        }
        if state.at.is_some_and(|t| at < t) {
            return Err(GuardError::Invalid("backward clock"));
        }
        let revision = state
            .revision
            .checked_add(1)
            .ok_or(GuardError::Unavailable)?;
        let mut receipt = KillReceipt {
            tenant_id: self.0.tenant,
            workspace_id: self.0.workspace,
            revision,
            actor_id: auth.actor_id,
            scope,
            engaged,
            reason: reason.into(),
            at,
            signer: self.0.signer.clone(),
            signature: String::new(),
        };
        receipt.signature = self.sign("kill", &receipt)?;
        match scope {
            KillScope::Global => state.global = engaged,
            KillScope::Account(id) => {
                if engaged {
                    state.accounts.insert(id);
                } else {
                    state.accounts.remove(&id);
                }
            }
        }
        state.revision = revision;
        state.at = Some(at);
        state.receipts.push(receipt.clone());
        Ok(receipt)
    }
    pub fn approve(
        &self,
        auth: &AuthContext,
        requester: ActorId,
        intent: &TradeIntent,
        at: DateTime<Utc>,
        expires: DateTime<Utc>,
    ) -> Result<ApprovalToken, GuardError> {
        if !self.scoped(auth, Some(intent.account_id))
            || !Self::capable(auth, Capability::STRATEGY_APPROVE)
            || !matches!(auth.role, Role::Owner | Role::Approver)
            || requester == auth.actor_id
        {
            return Err(GuardError::Unauthorized);
        }
        if expires <= at || expires - at > Duration::seconds(60) {
            return Err(GuardError::Invalid("approval expiry"));
        }
        let mut token = ApprovalToken {
            tenant_id: self.0.tenant,
            workspace_id: self.0.workspace,
            account_id: intent.account_id,
            requester,
            approver: auth.actor_id,
            intent_hash: self.intent_hash(requester, intent)?,
            issued_at: at,
            expires_at: expires,
            signer: self.0.signer.clone(),
            signature: String::new(),
        };
        token.signature = self.sign("approval", &token)?;
        Ok(token)
    }
    pub fn intent_hash(
        &self,
        actor: ActorId,
        intent: &TradeIntent,
    ) -> Result<ContentHash, GuardError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(
            &json!({"tenant":self.0.tenant,"workspace":self.0.workspace,"actor":actor,"intent":intent}),
        )?))
    }
    /// Read-only preflight. The signed projection is deliberately not registered
    /// as an issuable decision; only `evaluate` can reserve execution authority.
    #[allow(clippy::too_many_arguments)]
    pub fn preview(
        &self,
        auth: &AuthContext,
        phase: Phase,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        approval: Option<&ApprovalToken>,
        now: DateTime<Utc>,
    ) -> Result<GuardDecision, GuardError> {
        self.authorize(auth, intent)?;
        let state = self.lock()?;
        self.compute(
            &state, auth, phase, intent, snapshot, financials, venue, release, approval, now,
            false, None,
        )
    }
    /// Current account rules, independent of a Proposal or a proposed order.
    /// Reads the same kill state and rule predicates without recording decisions.
    pub fn account_checks(
        &self,
        auth: &AuthContext,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        now: DateTime<Utc>,
    ) -> Result<(u64, Vec<RuleCheck>), GuardError> {
        let account = snapshot.portfolio.account_id;
        if !self.scoped(auth, Some(account))
            || !Self::capable(auth, Capability::EXECUTION_OPERATE)
            || !matches!(auth.role, Role::Owner | Role::Operator | Role::Service)
        {
            return Err(GuardError::Unauthorized);
        }
        let state = self.lock()?;
        if state.at.is_some_and(|t| now < t) {
            return Err(GuardError::Invalid("backward clock"));
        }
        let gross = snapshot.portfolio.exposure_gross;
        let symbol = snapshot
            .portfolio
            .positions
            .iter()
            .map(|p| p.market_value.abs())
            .fold(0.0, f64::max);
        let facts = Facts {
            pre: false,
            identity: true,
            numbers: [
                gross,
                symbol,
                financials.equity,
                financials.realized_pnl_today,
            ]
            .iter()
            .all(|v| v.is_finite())
                && snapshot
                    .portfolio
                    .positions
                    .iter()
                    .all(|p| p.market_value.is_finite())
                && gross >= 0.0
                && symbol <= gross + 1e-9,
            precision: true,
            global_kill: state.global,
            account_kill: state.accounts.contains(&account),
            release: true,
            snapshot: snapshot
                .validate_for(self.0.tenant, account, now, self.0.policy.max_age_seconds)
                .is_ok(),
            financials: financials.tenant_id == self.0.tenant
                && financials.account_id == account
                && financials.quote_unit == self.0.policy.quote_unit
                && financials.utc_day == now.date_naive()
                && financials.as_of <= now
                && now - financials.as_of <= Duration::seconds(self.0.policy.max_age_seconds)
                && !financials.source_ref.trim().is_empty(),
            venue: true,
            duplicate: false,
            notional: 0.0,
            gross_after: gross,
            symbol_after: symbol,
            equity: financials.equity,
            daily_pnl: financials.realized_pnl_today,
            approval: true,
        };
        let (_, checks) = rules::evaluate(&facts, &self.0.policy.limits);
        Ok((state.revision, checks))
    }
    #[allow(clippy::too_many_arguments)]
    pub fn evaluate(
        &self,
        auth: &AuthContext,
        phase: Phase,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        approval: Option<&ApprovalToken>,
        now: DateTime<Utc>,
    ) -> Result<GuardDecision, GuardError> {
        self.authorize(auth, intent)?;
        let mut state = self.lock()?;
        let decision = self.compute(
            &state, auth, phase, intent, snapshot, financials, venue, release, approval, now,
            false, None,
        )?;
        if decision.verdict == RiskVerdict::Allow {
            if phase == Phase::Pre {
                state
                    .seen
                    .insert((intent.account_id, intent.command_key.clone()));
            } else {
                state
                    .posts
                    .insert((intent.account_id, intent.command_key.clone()));
            }
        }
        state.at = Some(now);
        state
            .decisions
            .insert(decision.decision_id, decision.clone());
        Ok(decision)
    }
    /// Native Assisted review uses the actual AssistedLive identity. The Shadow
    /// release is a research prerequisite only; this never grants deployment or
    /// an X03 Allow. The public two-person/native policy remains a separate gate.
    #[allow(clippy::too_many_arguments)]
    pub fn evaluate_assisted_review(
        &self,
        auth: &AuthContext,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        proposal_hash: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<GuardDecision, GuardError> {
        self.authorize(auth, intent)?;
        if auth.mode != RunMode::AssistedLive || !Self::capable(auth, "execution.assisted_testnet")
        {
            return Err(GuardError::Unauthorized);
        }
        let mut state = self.lock()?;
        let d = self.compute(
            &state,
            auth,
            Phase::Pre,
            intent,
            snapshot,
            financials,
            venue,
            release,
            None,
            now,
            false,
            Some(proposal_hash),
        )?;
        state.at = Some(now);
        state.decisions.insert(d.decision_id, d.clone());
        Ok(d)
    }
    /// Service -> current sources -> RiskGuard is the lock order. Hold the kill
    /// CAS lock through bounded native dispatch; callback must never reenter it.
    #[allow(clippy::too_many_arguments)]
    pub fn with_current_assisted_review<T>(
        &self,
        decision: &GuardDecision,
        auth: &AuthContext,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        clock: impl FnOnce() -> DateTime<Utc>,
        action: impl FnOnce(DateTime<Utc>) -> T,
    ) -> Result<T, GuardError> {
        self.authorize(auth, intent)?;
        if auth.mode != RunMode::AssistedLive || !Self::capable(auth, "execution.assisted_testnet")
        {
            return Err(GuardError::Unauthorized);
        }
        let mut state = self.lock()?;
        let now = clock();
        self.verify_decision(decision)?;
        if decision.proposal_hash.is_none()
            || decision.purpose != "assisted_testnet_review"
            || decision.phase != Phase::Pre
            || decision.verdict != RiskVerdict::ApprovalRequired
            || state.decisions.get(&decision.decision_id) != Some(decision)
            || decision.kill_revision != state.revision
            || state.global
            || state.accounts.contains(&intent.account_id)
            || decision.policy != self.0.policy
            || decision.decided_at > now
            || now >= decision.expires_at
            || state.at.is_some_and(|at| now < at)
            || decision.requester != auth.actor_id
            || decision.account_id != intent.account_id
            || decision.intent_hash != self.intent_hash(auth.actor_id, intent)?
        {
            return Err(GuardError::DecisionInvalid);
        }
        let current = self.compute(
            &state,
            auth,
            Phase::Pre,
            intent,
            snapshot,
            financials,
            venue,
            release,
            None,
            now,
            false,
            decision.proposal_hash.as_ref(),
        )?;
        if current.verdict != RiskVerdict::ApprovalRequired
            || current.expires_at <= now
            || current.snapshot_hash != decision.snapshot_hash
            || current.facts_hash != decision.facts_hash
        {
            return Err(GuardError::DecisionInvalid);
        }
        state.at = Some(now);
        Ok(action(now))
    }
    /// Authenticated owner storage, specifically the review namespace. No Allow
    /// decision, approval token or issuer consumer can be restored through here.
    pub fn assisted_checkpoint(&self) -> Result<serde_json::Value, GuardError> {
        let s = self.lock()?;
        let v = json!({"tenant":self.0.tenant,"workspace":self.0.workspace,"policy":self.0.policy,
            "revision":s.revision,"global":s.global,"accounts":s.accounts,"at":s.at,
            "receipts":s.receipts,"decisions":s.decisions.values().filter(|d|d.purpose=="assisted_testnet_review").collect::<Vec<_>>()});
        Ok(json!({"value":v,"signature":self.sign("assisted-checkpoint",&v)?}))
    }
    pub fn restore_assisted_checkpoint(
        &self,
        checkpoint: &serde_json::Value,
    ) -> Result<(), GuardError> {
        let v = &checkpoint["value"];
        self.verify_signature(
            "assisted-checkpoint",
            v,
            checkpoint["signature"]
                .as_str()
                .ok_or(GuardError::DecisionInvalid)?,
        )?;
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Saved {
            tenant: TenantId,
            workspace: WorkspaceId,
            policy: RiskPolicy,
            revision: u64,
            global: bool,
            accounts: BTreeSet<AccountId>,
            at: Option<DateTime<Utc>>,
            receipts: Vec<KillReceipt>,
            decisions: Vec<GuardDecision>,
        }
        let saved: Saved =
            serde_json::from_value(v.clone()).map_err(|_| GuardError::DecisionInvalid)?;
        if saved.tenant != self.0.tenant
            || saved.workspace != self.0.workspace
            || saved.policy != self.0.policy
        {
            return Err(GuardError::DecisionInvalid);
        }
        for d in &saved.decisions {
            self.verify_decision(d)?;
            if d.purpose != "assisted_testnet_review" {
                return Err(GuardError::DecisionInvalid);
            }
        }
        for r in &saved.receipts {
            self.verify_kill_receipt(r)?;
        }
        let mut s = self.lock()?;
        if saved.revision < s.revision
            || saved.at < s.at
            || (saved.revision == s.revision
                && (s.global != saved.global || s.accounts != saved.accounts))
        {
            return Err(GuardError::Conflict);
        }
        s.revision = saved.revision;
        s.global = saved.global;
        s.accounts = saved.accounts;
        s.at = saved.at;
        s.receipts = saved.receipts;
        s.decisions
            .retain(|_, d| d.purpose != "assisted_testnet_review");
        for d in saved.decisions {
            s.decisions.insert(d.decision_id, d);
        }
        Ok(())
    }
    fn authorize(&self, auth: &AuthContext, intent: &TradeIntent) -> Result<(), GuardError> {
        if !self.scoped(auth, Some(intent.account_id))
            || !Self::capable(auth, Capability::EXECUTION_OPERATE)
            || !matches!(auth.role, Role::Owner | Role::Operator | Role::Service)
        {
            return Err(GuardError::Unauthorized);
        }
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    fn compute(
        &self,
        state: &State,
        auth: &AuthContext,
        phase: Phase,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        approval: Option<&ApprovalToken>,
        now: DateTime<Utc>,
        reserved: bool,
        review_proposal: Option<&ContentHash>,
    ) -> Result<GuardDecision, GuardError> {
        if state.at.is_some_and(|t| now < t) {
            return Err(GuardError::Invalid("backward clock"));
        }
        let intent_hash = self.intent_hash(auth.actor_id, intent)?;
        let fresh = |at: DateTime<Utc>| {
            at <= now && now - at <= Duration::seconds(self.0.policy.max_age_seconds)
        };
        let decimals = decimal(&intent.quantity).zip(decimal(&intent.limit_price));
        let (notional, precision) = decimals.map_or((f64::NAN, false), |((q, qs), (p, ps))| {
            (
                q * p,
                qs <= self.0.policy.limits.max_quantity_scale
                    && ps <= self.0.policy.limits.max_price_scale,
            )
        });
        let gross = snapshot.portfolio.exposure_gross;
        let symbol = snapshot
            .portfolio
            .positions
            .iter()
            .find(|p| p.symbol == intent.symbol)
            .map_or(0.0, |p| p.market_value.abs());
        let pre = phase == Phase::Pre;
        // Conservative pre-trade envelope: opposite-side intents never reduce the projected bound.
        let gross_after = if pre { gross + notional } else { gross };
        let symbol_after = if pre { symbol + notional } else { symbol };
        let valid_approval = approval.is_some_and(|a| {
            a.tenant_id == self.0.tenant
                && a.workspace_id == self.0.workspace
                && a.account_id == intent.account_id
                && a.requester == auth.actor_id
                && a.approver != auth.actor_id
                && a.intent_hash == intent_hash
                && a.issued_at <= now
                && now < a.expires_at
                && a.expires_at - a.issued_at <= Duration::seconds(60)
                && self.verify_signature("approval", a, &a.signature).is_ok()
        });
        let facts = Facts {
            pre,
            identity: !intent.command_key.trim().is_empty()
                && intent.command_key.len() <= 128
                && symbol_valid(&intent.symbol)
                && (if review_proposal.is_some() {
                    auth.mode == RunMode::AssistedLive && intent.target == DeploymentTarget::Shadow
                } else {
                    matches!(
                        (auth.mode, intent.target),
                        (RunMode::Paper, DeploymentTarget::Paper)
                            | (RunMode::Shadow, DeploymentTarget::Shadow)
                    )
                })
                && intent.release_id == release.release_id
                && release.tenant_id == self.0.tenant
                && release.workspace_id == self.0.workspace,
            numbers: decimals.is_some()
                && [
                    notional,
                    gross,
                    symbol,
                    gross_after,
                    symbol_after,
                    financials.equity,
                    financials.realized_pnl_today,
                ]
                .iter()
                .all(|v| v.is_finite())
                && gross >= 0.0
                && symbol >= 0.0
                && symbol <= gross + 1e-9,
            precision,
            global_kill: state.global,
            account_kill: state.accounts.contains(&intent.account_id),
            release: DeploymentPolicy::evaluate_at(release, intent.target, now).is_empty()
                && release
                    .parameters()
                    .and_then(|v| v["parameters"]["universe"].as_array())
                    .is_some_and(|symbols| {
                        symbols
                            .iter()
                            .any(|v| v.as_str() == Some(intent.symbol.as_str()))
                    }),
            snapshot: snapshot
                .validate_for(
                    self.0.tenant,
                    intent.account_id,
                    now,
                    self.0.policy.max_age_seconds,
                )
                .is_ok(),
            financials: financials.tenant_id == self.0.tenant
                && financials.account_id == intent.account_id
                && financials.quote_unit == self.0.policy.quote_unit
                && financials.utc_day == now.date_naive()
                && fresh(financials.as_of)
                && !financials.source_ref.trim().is_empty(),
            venue: venue.healthy
                && fresh(venue.observed_at)
                && symbol_valid(&venue.venue)
                && venue.symbol == intent.symbol
                && venue.quote_unit == self.0.policy.quote_unit,
            duplicate: !reserved
                && if pre {
                    state
                        .seen
                        .contains(&(intent.account_id, intent.command_key.clone()))
                } else {
                    state
                        .posts
                        .contains(&(intent.account_id, intent.command_key.clone()))
                },
            notional,
            gross_after,
            symbol_after,
            equity: financials.equity,
            daily_pnl: financials.realized_pnl_today,
            approval: valid_approval,
        };
        let (verdict, checks) = rules::evaluate(&facts, &self.0.policy.limits);
        // JSON can represent rejected non-finite facts as null. They are still signed as rejected inputs.
        let facts_hash = ContentHash::sha256_bytes(&canonical_json_bytes(
            &json!({"financials":financials,"venue":venue,"release":release,"approval":approval}),
        )?);
        let age = Duration::seconds(
            snapshot
                .max_age_seconds
                .clamp(1, self.0.policy.max_age_seconds),
        );
        let deadline = |at: DateTime<Utc>| {
            at.checked_add_signed(age)
                .unwrap_or(DateTime::<Utc>::MAX_UTC)
        };
        let mut expires = now
            .checked_add_signed(Duration::seconds(self.0.policy.decision_ttl_seconds))
            .ok_or(GuardError::Invalid("clock range"))?
            .min(deadline(snapshot.portfolio.as_of))
            .min(deadline(snapshot.account_status_at))
            .min(deadline(financials.as_of))
            .min(deadline(venue.observed_at));
        for mark in &snapshot.marks {
            expires = expires.min(deadline(mark.source_at));
        }
        if let Some(until) = release.authorization_expires_at() {
            expires = expires.min(until);
        }
        if let Some(token) = approval {
            expires = expires.min(token.expires_at);
        }
        let mut decision = GuardDecision {
            decision_id: DecisionId::new(),
            tenant_id: self.0.tenant,
            workspace_id: self.0.workspace,
            account_id: intent.account_id,
            requester: auth.actor_id,
            phase,
            purpose: if review_proposal.is_some() {
                "assisted_testnet_review"
            } else {
                "order"
            }
            .into(),
            proposal_hash: review_proposal.cloned(),
            intent_hash,
            snapshot_hash: snapshot.input_hash.clone(),
            facts_hash,
            policy: self.0.policy.clone(),
            kill_revision: state.revision,
            verdict,
            checks,
            decided_at: now,
            expires_at: expires,
            signer: self.0.signer.clone(),
            signature: String::new(),
        };
        decision.signature = self.sign("decision", &decision)?;
        Ok(decision)
    }
    /// Hold the same lock used by kill CAS while rechecking a stored Pre Allow,
    /// all current source facts and the bound approval, then committing the issuer.
    /// Callers must not reenter this guard from `commit`. Acquire issuer locks first.
    /// A rejected callback consumes neither risk decision nor approval/command state.
    #[allow(clippy::too_many_arguments)]
    pub fn with_current_allow<T, E: From<GuardError>>(
        &self,
        consumer: CommandId,
        decision: &GuardDecision,
        auth: &AuthContext,
        intent: &TradeIntent,
        snapshot: &RiskInputSnapshot,
        financials: &AccountFinancials,
        venue: &VenueState,
        release: &StrategyRelease,
        approval: Option<&ApprovalToken>,
        now: DateTime<Utc>,
        commit: impl FnOnce(&GuardDecision) -> Result<T, E>,
    ) -> Result<T, E> {
        let mut state = self.lock()?;
        self.validate_locked(&state, decision, auth, intent, now)?;
        if state
            .consumers
            .get(&decision.decision_id)
            .is_some_and(|id| *id != consumer)
        {
            return Err(GuardError::Conflict.into());
        }
        let current = self.compute(
            &state,
            auth,
            Phase::Pre,
            intent,
            snapshot,
            financials,
            venue,
            release,
            approval,
            now,
            true,
            None,
        )?;
        if current.verdict != RiskVerdict::Allow || current.expires_at <= now {
            return Err(GuardError::DecisionInvalid.into());
        }
        let value = commit(&current)?;
        state.consumers.insert(decision.decision_id, consumer);
        state.at = Some(now);
        Ok(value)
    }
    /// A current risk validation, not an executable order/command permission. X03
    /// must integrate this with its own atomic issuer and approval consumption.
    pub fn validate_allow(
        &self,
        decision: &GuardDecision,
        auth: &AuthContext,
        intent: &TradeIntent,
        now: DateTime<Utc>,
    ) -> Result<(), GuardError> {
        let state = self.lock()?;
        self.validate_locked(&state, decision, auth, intent, now)
    }
    fn validate_locked(
        &self,
        state: &State,
        decision: &GuardDecision,
        auth: &AuthContext,
        intent: &TradeIntent,
        now: DateTime<Utc>,
    ) -> Result<(), GuardError> {
        if !self.scoped(auth, Some(intent.account_id))
            || !Self::capable(auth, Capability::EXECUTION_OPERATE)
            || !matches!(auth.role, Role::Owner | Role::Operator | Role::Service)
            || decision.tenant_id != self.0.tenant
            || decision.workspace_id != self.0.workspace
            || decision.account_id != intent.account_id
            || decision.requester != auth.actor_id
            || decision.purpose != "order"
            || decision.phase != Phase::Pre
            || decision.intent_hash != self.intent_hash(auth.actor_id, intent)?
            || decision.verdict != RiskVerdict::Allow
            || decision.policy != self.0.policy
            || decision.decided_at > now
            || now >= decision.expires_at
            || state.at.is_some_and(|t| now < t)
            || decision.kill_revision != state.revision
            || state.global
            || state.accounts.contains(&intent.account_id)
            || state.decisions.get(&decision.decision_id) != Some(decision)
        {
            return Err(GuardError::DecisionInvalid);
        }
        self.verify_signature("decision", decision, &decision.signature)
    }
    pub fn verify_decision(&self, decision: &GuardDecision) -> Result<(), GuardError> {
        if decision.tenant_id != self.0.tenant
            || decision.workspace_id != self.0.workspace
            || decision.signer != self.0.signer
        {
            return Err(GuardError::DecisionInvalid);
        }
        self.verify_signature("decision", decision, &decision.signature)
    }
    pub fn verify_kill_receipt(&self, receipt: &KillReceipt) -> Result<(), GuardError> {
        if receipt.tenant_id != self.0.tenant
            || receipt.workspace_id != self.0.workspace
            || receipt.signer != self.0.signer
        {
            return Err(GuardError::DecisionInvalid);
        }
        self.verify_signature("kill", receipt, &receipt.signature)
    }
    fn payload<T: Serialize>(&self, domain: &str, value: &T) -> Result<Vec<u8>, GuardError> {
        let mut v =
            serde_json::to_value(value).map_err(|_| GuardError::Invalid("serialization"))?;
        v.as_object_mut()
            .ok_or(GuardError::Invalid("payload"))?
            .remove("signature");
        Ok(canonical_json_bytes(
            &json!({"schema":"quantos-risk-hmac/v2","domain":domain,"key_id":self.0.signer,"value":v}),
        )?)
    }
    fn sign<T: Serialize>(&self, domain: &str, value: &T) -> Result<String, GuardError> {
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.0.key).map_err(|_| GuardError::Invalid("key"))?;
        mac.update(&self.payload(domain, value)?);
        Ok(hex::encode(mac.finalize().into_bytes()))
    }
    fn verify_signature<T: Serialize>(
        &self,
        domain: &str,
        value: &T,
        signature: &str,
    ) -> Result<(), GuardError> {
        let bytes = hex::decode(signature).map_err(|_| GuardError::DecisionInvalid)?;
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.0.key).map_err(|_| GuardError::DecisionInvalid)?;
        mac.update(&self.payload(domain, value)?);
        mac.verify_slice(&bytes)
            .map_err(|_| GuardError::DecisionInvalid)
    }
}
fn symbol_valid(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b"/_-".contains(&b))
}
fn decimal(s: &str) -> Option<(f64, u32)> {
    if s.is_empty() || s.len() > 48 {
        return None;
    }
    let mut parts = s.split('.');
    let whole = parts.next()?;
    let fraction = parts.next();
    if parts.next().is_some() || whole.is_empty() || !whole.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let scale = if let Some(f) = fraction {
        if f.is_empty() || !f.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        f.len() as u32
    } else {
        0
    };
    let value = s.parse::<f64>().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some((value, scale))
}
