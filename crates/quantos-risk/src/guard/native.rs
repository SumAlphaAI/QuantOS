//! Exact native X01 review namespace. Owner-provided context is rebuilt; never
//! convert the signed financial values through the legacy f64 projection.
use super::*;
use quantos_portfolio::{
    native_ledger::NativeLedger,
    native_valuation::{Inputs, Snapshot},
};
use rust_decimal::Decimal;
use serde_json::Value;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeRiskContext {
    pub snapshot: Snapshot,
    pub input: Inputs,
    pub ledger_checkpoint: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub books: Option<quantos_portfolio::books_risk::BooksRiskInput>,
}
impl NativeRiskContext {
    pub fn validate(&self, generation: u64, at: DateTime<Utc>) -> Result<(), GuardError> {
        let ledger = NativeLedger::restore(self.snapshot.scope.clone(), &self.ledger_checkpoint)
            .map_err(|_| GuardError::DecisionInvalid)?;
        self.snapshot
            .validate_for(&ledger, &self.input, generation, at)
            .map_err(|_| GuardError::DecisionInvalid)?;
        if self.books.as_ref().is_some_and(|b| {
            b.scope != self.snapshot.scope
                || b.ledger_hash != self.snapshot.ledger_hash
                || b.financial_review
                    .as_ref()
                    .is_some_and(|r| r.kill_generation != generation.to_string())
        }) {
            return Err(GuardError::DecisionInvalid);
        }
        Ok(())
    }
}
fn number(s: &str) -> Result<Decimal, GuardError> {
    if s.is_empty() || s.len() > 80 || s.contains(['e', 'E', '+']) {
        return Err(GuardError::Invalid("decimal"));
    }
    Decimal::from_str_exact(s).map_err(|_| GuardError::Invalid("decimal"))
}
fn exact(mut n: i128, mut scale: u32) -> Result<Decimal, GuardError> {
    while scale > 0 && n % 10 == 0 {
        n /= 10;
        scale -= 1;
    }
    Decimal::try_from_i128_with_scale(n, scale).map_err(|_| GuardError::Invalid("exact arithmetic"))
}
fn mul(a: Decimal, b: Decimal) -> Result<Decimal, GuardError> {
    let (a, b) = (a.normalize(), b.normalize());
    exact(
        a.mantissa()
            .checked_mul(b.mantissa())
            .ok_or(GuardError::Invalid("overflow"))?,
        a.scale() + b.scale(),
    )
}
fn add(a: Decimal, b: Decimal) -> Result<Decimal, GuardError> {
    let scale = a.scale().max(b.scale());
    let scaled = |v: Decimal| {
        v.mantissa()
            .checked_mul(10_i128.checked_pow(scale - v.scale())?)
    };
    exact(
        scaled(a)
            .and_then(|x| scaled(b).and_then(|y| x.checked_add(y)))
            .ok_or(GuardError::Invalid("overflow"))?,
        scale,
    )
}
fn facts(
    context: &NativeRiskContext,
    venue: &VenueState,
    release: &StrategyRelease,
) -> Result<ContentHash, GuardError> {
    Ok(ContentHash::sha256_bytes(&canonical_json_bytes(
        &json!({"schema":"quantos-native-risk-facts/v1","context":context,"venue":venue,"release":release,"concentrationBasis":"GROSS_AFTER_CONSERVATIVE_ADDITIVE","approval":"ALWAYS_INDEPENDENT_PUBLIC_PAIR"}),
    )?))
}
impl RiskGuard {
    pub fn verify_native_binding(
        &self,
        d: &GuardDecision,
        c: &NativeRiskContext,
        venue: &VenueState,
        release: &StrategyRelease,
    ) -> Result<(), GuardError> {
        self.verify_decision(d)?;
        c.validate(d.kill_revision, d.decided_at)?;
        if let Some(b) = &c.books
            && d.verdict == RiskVerdict::ApprovalRequired
            && (!b.eligible(d.decided_at) || b.deadline().is_none_or(|until| d.expires_at > until))
        {
            return Err(GuardError::DecisionInvalid);
        }
        if d.facts_hash != facts(c, venue, release)?
            || d.snapshot_hash != c.snapshot.snapshot_hash
            || d.tenant_id != c.snapshot.scope.tenant_id
            || d.workspace_id != c.snapshot.scope.workspace_id
            || d.account_id != c.snapshot.scope.account_id
            || d.expires_at > c.snapshot.expires_at
            || d.expires_at <= d.decided_at
            || d.purpose != "assisted_testnet_review"
            || d.phase != Phase::Pre
        {
            return Err(GuardError::DecisionInvalid);
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    fn compute_native(
        &self,
        state: &State,
        auth: &AuthContext,
        intent: &TradeIntent,
        context: &NativeRiskContext,
        venue: &VenueState,
        release: &StrategyRelease,
        proposal: &ContentHash,
        at: DateTime<Utc>,
    ) -> Result<GuardDecision, GuardError> {
        self.authorize(auth, intent)?;
        if auth.mode != RunMode::AssistedLive
            || !Self::capable(auth, "execution.assisted_testnet")
            || state.at.is_some_and(|t| at < t)
        {
            return Err(GuardError::DecisionInvalid);
        }
        context.validate(state.revision, at)?;
        let s = &context.snapshot;
        if s.scope.tenant_id != self.0.tenant
            || s.scope.workspace_id != self.0.workspace
            || s.scope.account_id != intent.account_id
            || s.quote_currency != self.0.policy.quote_unit
        {
            return Err(GuardError::DecisionInvalid);
        }
        let q = number(&intent.quantity)?;
        let p = number(&intent.limit_price)?;
        let n = mul(q, p)?;
        let gross = number(&s.exposure_gross)?;
        let symbol = s
            .positions
            .iter()
            .find(|p| p.symbol == intent.symbol)
            .map(|p| number(&p.market_value).map(|v| v.abs()))
            .transpose()?
            .unwrap_or(Decimal::ZERO);
        let after = add(gross, n)?;
        let symbol_after = add(symbol, n)?;
        let equity = number(&s.equity)?;
        let l = &self.0.policy.limits;
        let limit = |v: f64| number(&v.to_string());
        let valid_release = intent.target == DeploymentTarget::Shadow
            && intent.release_id == release.release_id
            && release.tenant_id == self.0.tenant
            && release.workspace_id == self.0.workspace
            && DeploymentPolicy::evaluate_at(release, intent.target, at).is_empty()
            && release
                .parameters()
                .and_then(|v| v["parameters"]["universe"].as_array())
                .is_some_and(|v| v.iter().any(|s| s.as_str() == Some(intent.symbol.as_str())));
        let fresh = |t: DateTime<Utc>| {
            t <= at && at - t <= Duration::seconds(self.0.policy.max_age_seconds)
        };
        let breaches = [
            !symbol_valid(&intent.symbol)
                || intent.command_key.trim().is_empty()
                || intent.command_key.len() > 128,
            q <= Decimal::ZERO || p <= Decimal::ZERO || gross < Decimal::ZERO || symbol > gross,
            q.scale() > l.max_quantity_scale || p.scale() > l.max_price_scale,
            state.global,
            state.accounts.contains(&intent.account_id),
            !valid_release,
            false,
            false,
            !venue.healthy
                || venue.venue != "OWNED_TESTNET"
                || venue.symbol != intent.symbol
                || venue.quote_unit != s.quote_currency
                || !fresh(venue.observed_at),
            state
                .seen
                .contains(&(intent.account_id, intent.command_key.clone())),
            n > limit(l.max_notional_per_order)?,
            equity <= Decimal::ZERO || after > mul(equity, limit(l.max_leverage)?)?,
            symbol_after > mul(after, limit(l.max_symbol_concentration)?)?,
            number(&s.realized_pnl_today)? < -limit(l.max_daily_loss)?,
            // Every native refresh requires the independent public approvals,
            // including orders below the legacy optional approval threshold.
            true,
        ];
        let mut checks = rules::Rule::ALL
            .into_iter()
            .zip(breaches)
            .map(|(rule, breached)| RuleCheck {
                rule,
                breached,
                limit_id: format!("x02.{rule:?}"),
            })
            .collect::<Vec<_>>();
        let books_reason = context
            .books
            .as_ref()
            .map(|b| b.reason(at))
            .unwrap_or("BOOKS_SOURCE_UNAVAILABLE");
        let books_eligible = context.books.as_ref().is_some_and(|b| b.eligible(at));
        checks.push(RuleCheck {
            rule: rules::Rule::AccountBooks,
            breached: !books_eligible,
            limit_id: format!("x02.accountBooks.{books_reason}"),
        });
        let verdict = if checks
            .iter()
            .any(|c| c.breached && c.rule != rules::Rule::Approval)
        {
            RiskVerdict::Deny
        } else {
            RiskVerdict::ApprovalRequired
        };
        let facts_hash = facts(context, venue, release)?;
        let mut expires = s
            .expires_at
            .min(
                at.checked_add_signed(Duration::seconds(self.0.policy.decision_ttl_seconds))
                    .ok_or(GuardError::DecisionInvalid)?,
            )
            .min(
                venue
                    .observed_at
                    .checked_add_signed(Duration::seconds(self.0.policy.max_age_seconds))
                    .ok_or(GuardError::DecisionInvalid)?,
            );
        for source_at in [
            context.input.as_of,
            context.input.account_status_at,
            context.input.cash_coverage_through,
        ]
        .into_iter()
        .chain(context.input.marks.iter().map(|m| m.observed_at))
        {
            expires = expires.min(
                source_at
                    .checked_add_signed(Duration::seconds(self.0.policy.max_age_seconds))
                    .ok_or(GuardError::DecisionInvalid)?,
            );
        }
        if let Some(until) = release.authorization_expires_at() {
            expires = expires.min(until);
        }
        if books_eligible {
            expires = expires.min(
                context
                    .books
                    .as_ref()
                    .and_then(|b| b.deadline())
                    .ok_or(GuardError::DecisionInvalid)?,
            );
        }
        if at >= expires {
            return Err(GuardError::DecisionInvalid);
        }
        let mut d = GuardDecision {
            decision_id: DecisionId::new(),
            tenant_id: self.0.tenant,
            workspace_id: self.0.workspace,
            account_id: intent.account_id,
            requester: auth.actor_id,
            phase: Phase::Pre,
            purpose: "assisted_testnet_review".into(),
            proposal_hash: Some(proposal.clone()),
            intent_hash: self.intent_hash(auth.actor_id, intent)?,
            snapshot_hash: s.snapshot_hash.clone(),
            facts_hash,
            policy: self.0.policy.clone(),
            kill_revision: state.revision,
            verdict,
            checks,
            decided_at: at,
            expires_at: expires,
            signer: self.0.signer.clone(),
            signature: String::new(),
        };
        d.signature = self.sign("decision", &d)?;
        Ok(d)
    }
    /// Explicit owner evaluation; does not consume or renew any old decision.
    #[allow(clippy::too_many_arguments)]
    pub fn evaluate_native_review(
        &self,
        auth: &AuthContext,
        intent: &TradeIntent,
        context: &NativeRiskContext,
        venue: &VenueState,
        release: &StrategyRelease,
        proposal: &ContentHash,
        at: DateTime<Utc>,
    ) -> Result<GuardDecision, GuardError> {
        let mut state = self.lock()?;
        if state.decisions.len() >= 4096 {
            return Err(GuardError::Unavailable);
        }
        let d = self.compute_native(&state, auth, intent, context, venue, release, proposal, at)?;
        state.at = Some(at);
        state.decisions.insert(d.decision_id, d.clone());
        Ok(d)
    }
    #[allow(clippy::too_many_arguments)]
    pub fn with_current_native_review<T>(
        &self,
        d: &GuardDecision,
        auth: &AuthContext,
        intent: &TradeIntent,
        context: &NativeRiskContext,
        venue: &VenueState,
        release: &StrategyRelease,
        clock: impl FnOnce() -> DateTime<Utc>,
        action: impl FnOnce(DateTime<Utc>) -> T,
    ) -> Result<T, GuardError> {
        let mut state = self.lock()?;
        let at = clock();
        self.verify_decision(d)?;
        if state.decisions.get(&d.decision_id) != Some(d)
            || d.purpose != "assisted_testnet_review"
            || d.phase != Phase::Pre
            || d.verdict != RiskVerdict::ApprovalRequired
            || d.policy != self.0.policy
            || d.kill_revision != state.revision
            || d.decided_at > at
            || at >= d.expires_at
        {
            return Err(GuardError::DecisionInvalid);
        }
        let current = self.compute_native(
            &state,
            auth,
            intent,
            context,
            venue,
            release,
            d.proposal_hash
                .as_ref()
                .ok_or(GuardError::DecisionInvalid)?,
            at,
        )?;
        if current.verdict != d.verdict
            || current.facts_hash != d.facts_hash
            || current.intent_hash != d.intent_hash
            || current.snapshot_hash != d.snapshot_hash
            || d.requester != auth.actor_id
            || d.account_id != intent.account_id
        {
            return Err(GuardError::DecisionInvalid);
        }
        state.at = Some(at);
        Ok(action(at))
    }
}
