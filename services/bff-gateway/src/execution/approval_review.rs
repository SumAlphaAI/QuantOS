//! C08 opt-in owner-side review; never registers or issues execution authority.
use super::*;
impl ExecutionService {
    pub(super) fn review_access(a: &AuthContext, q: &BTreeMap<String, String>) -> Result<bool> {
        match q.get("includeReviewContext").map(String::as_str) {
            None | Some("false") => Ok(false),
            Some("true")
                if matches!(a.role, Role::Owner | Role::Approver)
                    && a.capabilities
                        .iter()
                        .any(|c| c.as_str() == Capability::STRATEGY_APPROVE) =>
            {
                Ok(true)
            }
            Some("true") => Err(forbidden()),
            _ => Err(Fault::invalid()),
        }
    }
    pub(super) fn review_page(
        &self,
        a: &AuthContext,
        p: &Proposal,
        q: &BTreeMap<String, String>,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        let mut page = self.approval_page(p, now)?;
        if !Self::review_access(a, q)? {
            return Ok(page);
        }
        let (original, context) = p.review_decision.as_ref().ok_or_else(Fault::unavailable)?;
        mapped(self.guard.verify_decision(original))?;
        let current = self.evaluate(p, false, now)?;
        let number = |v: f64| {
            rust_decimal::Decimal::from_f64_retain(v)
                .map(|d| d.to_string())
                .ok_or_else(Fault::unavailable)
        };
        let gross = self.input.portfolio.exposure_gross;
        let symbol = self
            .input
            .portfolio
            .positions
            .iter()
            .find(|v| v.symbol == p.intent.symbol)
            .map_or(0.0, |v| v.market_value.abs());
        let notional = p
            .intent
            .quantity
            .parse::<f64>()
            .map_err(|_| Fault::unavailable())?
            * p.intent
                .limit_price
                .parse::<f64>()
                .map_err(|_| Fault::unavailable())?;
        let limits = &current.policy.limits;
        let decision = json!({"decisionId":original.decision_id,"proposalId":p.page["proposalId"],"accountId":original.account_id,"mode":p.requester.mode.as_str(),"verdict":original.verdict.as_str(),"checks":checks(original),"policyVersion":original.policy.version,"policyRevision":original.kill_revision.to_string(),"signer":original.signer,"signatureVerifiedByOwner":true,"snapshotHash":original.snapshot_hash,"factsHash":original.facts_hash,"intentHash":original.intent_hash,"contextHash":context,"decidedAt":original.decided_at,"expiresAt":original.expires_at,"issuable":false});
        page["reviewContext"] = json!({"accountId":self.auth.account_id,"mode":self.auth.mode.as_str(),"proposal":self.proposal_page(p,now),"riskDecision":decision,"currentRisk":{"contextHash":self.context_hash(p),"asOf":now,"expiresAt":current.expires_at,"verdict":current.verdict.as_str(),"checks":checks(&current),"policyVersion":current.policy.version,"policyRevision":current.kill_revision.to_string()},"impact":{"quoteUnit":self.financials.quote_unit,"equity":number(self.financials.equity)?,"grossBefore":number(gross)?,"grossAfter":number(gross+notional)?,"symbolBefore":number(symbol)?,"symbolAfter":number(symbol+notional)?,"portfolioAsOf":self.input.portfolio.as_of,"financialAsOf":self.financials.as_of,"venue":self.venue.venue,"venueHealthy":self.venue.healthy,"maxOrderNotional":number(limits.max_notional_per_order)?,"maxLeverage":number(limits.max_leverage)?,"maxConcentration":number(limits.max_symbol_concentration)?,"approvalThreshold":number(limits.approval_notional_threshold)?,"maxDailyLoss":number(limits.max_daily_loss)?,"model":"x02_conservative_gross_addition"}});
        Ok(page)
    }
    pub(crate) fn has_approval_correlation(&self, auth: &AuthContext, correlation: &str) -> bool {
        auth.tenant_id == self.auth.tenant_id
            && auth.workspace_id == self.auth.workspace_id
            && auth.account_id == self.auth.account_id
            && auth.mode == self.auth.mode
            && matches!(auth.role, Role::Approver | Role::Owner)
            && auth
                .capabilities
                .iter()
                .any(|c| c.as_str() == Capability::STRATEGY_APPROVE)
            && self
                .proposals
                .values()
                .any(|p| p.approval.is_some() && p.correlation.to_string() == correlation)
    }
}
fn checks(d: &GuardDecision) -> Vec<Value> {
    d.checks
        .iter()
        .map(|c| json!({"rule":format!("{:?}",c.rule),"breached":c.breached,"limitId":c.limit_id}))
        .collect()
}
