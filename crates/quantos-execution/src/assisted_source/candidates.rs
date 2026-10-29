//! Trusted immutable R04 records awaiting their first current evaluation.
//! These handles are not Subjects: they have no decision, approval or IO authority.
use super::*;
#[derive(Clone)]
pub(super) struct Candidate {
    pub record: TradeProposalRecord,
    pub auth: AuthContext,
    pub intent: TradeIntent,
    pub current: CurrentRiskSources,
}
fn validate(c: &Candidate) -> Result<(), Error> {
    validate_proposal_binding(&c.auth, &c.record, &c.intent).map_err(invalid)?;
    SignalProposalSchemaValidator::validate_signal_at(
        &c.record.output["signal"],
        c.record.created_at,
    )
    .map_err(invalid)?;
    if c.auth.mode != RunMode::AssistedLive
        || c.intent.target != DeploymentTarget::Shadow
        || c.auth.account_id != Some(c.intent.account_id)
        || c.auth.user_id.is_nil()
        || c.current.venue.venue != "OWNED_TESTNET"
        || c.current.venue.quote_unit != "USDT"
    {
        return Err(Error::Invalid);
    }
    Ok(())
}
impl CurrentSubjectSource {
    /// Owner repository port, never a browser upload or an execution permission.
    pub fn register_candidate(
        &self,
        auth: AuthContext,
        record: TradeProposalRecord,
        intent: TradeIntent,
        current: CurrentRiskSources,
    ) -> Result<ProposalId, Error> {
        let c = Candidate {
            auth,
            record,
            intent,
            current,
        };
        validate(&c)?;
        if !self.scope_matches(&Scope {
            tenant: c.auth.tenant_id,
            workspace: c.auth.workspace_id,
            account: c.intent.account_id,
        }) {
            return Err(Error::Invalid);
        }
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        if s.candidates.len() >= 512
            || s.entries
                .values()
                .any(|e| e.record.proposal_id == c.record.proposal_id)
            || s.candidates
                .values()
                .any(|e| e.record.proposal_id == c.record.proposal_id)
        {
            return Err(Error::Conflict);
        }
        let id = ProposalId::new();
        s.candidates.insert(id, c);
        s.immutable_checkpoint = None;
        Ok(id)
    }
}
pub(super) fn candidate_checkpoint(
    candidates: &BTreeMap<ProposalId, Candidate>,
    releases: &mut BTreeMap<String, Value>,
    key: &[u8; 32],
) -> Result<Value, Error> {
    let mut values = BTreeMap::new();
    for (id, c) in candidates {
        let hash = c.current.release.content_hash.to_string();
        if !releases.contains_key(&hash) {
            releases.insert(
                hash.clone(),
                c.current.release.owner_checkpoint(key).map_err(invalid)?,
            );
        }
        values.insert(id,json!({"auth":c.auth,"record":c.record,"intent":c.intent,"snapshot":c.current.snapshot,"financials":c.current.financials,"venue":c.current.venue,"releaseHash":hash}));
    }
    serde_json::to_value(values).map_err(invalid)
}
pub(super) fn restore_candidates(
    value: &Value,
    releases: &BTreeMap<String, StrategyRelease>,
) -> Result<BTreeMap<ProposalId, Candidate>, Error> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Saved {
        auth: AuthContext,
        record: TradeProposalRecord,
        intent: TradeIntent,
        snapshot: RiskInputSnapshot,
        financials: AccountFinancials,
        venue: VenueState,
        release_hash: String,
    }
    let rows: BTreeMap<ProposalId, Saved> =
        serde_json::from_value(value.clone()).map_err(invalid)?;
    if rows.len() > 512 {
        return Err(Error::Unavailable);
    }
    let mut result = BTreeMap::new();
    let mut ids = BTreeSet::new();
    for (id, r) in rows {
        let c = Candidate {
            auth: r.auth,
            record: r.record,
            intent: r.intent,
            current: CurrentRiskSources {
                snapshot: r.snapshot,
                financials: r.financials,
                venue: r.venue,
                release: releases.get(&r.release_hash).ok_or(Error::Invalid)?.clone(),
            },
        };
        validate(&c)?;
        if !ids.insert(c.record.proposal_id.clone()) {
            return Err(Error::Conflict);
        }
        result.insert(id, c);
    }
    Ok(result)
}

pub(super) fn candidate_digest(c: &Candidate) -> Result<ContentHash, Error> {
    digest(&json!([
        c.auth,
        c.record,
        c.intent,
        c.current.snapshot,
        c.current.financials,
        c.current.venue,
        c.current.release.content_hash
    ]))
}
