use super::*;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeReview {
    pub previous_subject_id: ProposalId,
    pub proposal_id: String,
    pub proposal_hash: ContentHash,
    pub decision: GuardDecision,
    pub context: NativeRiskContext,
    pub subject: Option<Subject>,
}
impl CurrentSubjectSource {
    /// Explicit refresh creates a new decision and (only when eligible) a new
    /// Subject. The original R04 record, prior decision and request stay immutable.
    pub fn refresh_native(
        &self,
        id: ProposalId,
        context: NativeRiskContext,
        at: DateTime<Utc>,
    ) -> Result<NativeReview, Error> {
        let mut state = self.state.lock().map_err(|_| Error::Unavailable)?;
        if state.native_reviews.len() >= 512 || state.entries.len() >= 4096 {
            return Err(Error::Unavailable);
        }
        let old = state.entries.get(&id).cloned().ok_or(Error::Invalid)?;
        // Refresh is an explicit re-evaluation, including after kill release or
        // source revocation; it cannot repair an expired/changed Proposal.
        validate_proposal_binding(&old.auth, &old.record, &old.intent).map_err(invalid)?;
        if at < old.record.created_at || at >= old.record.expires_at {
            return Err(Error::Expired);
        }
        let proposal_hash = digest(&old.record)?;
        let decision = self
            .guard
            .evaluate_native_review(
                &old.auth,
                &old.intent,
                &context,
                &old.current.venue,
                &old.current.release,
                &proposal_hash,
                at,
            )
            .map_err(invalid)?;
        let mut next = old.clone();
        next.native = Some(context.clone());
        next.decision = decision.clone();
        next.subject.id = ProposalId::new();
        next.subject.decision = decision.decision_id;
        next.subject.created_at = at;
        next.subject.expires_at = old.record.expires_at.min(decision.expires_at);
        let subject = if decision.verdict == RiskVerdict::ApprovalRequired {
            bind(&next)?;
            self.check(&next, at, |_| ())?;
            Some(next.subject.clone())
        } else {
            None
        };
        let r = NativeReview {
            previous_subject_id: id,
            proposal_id: old.record.proposal_id,
            proposal_hash,
            decision,
            context,
            subject,
        };
        // Preserve every old record, but never fall back to an earlier review
        // of this immutable Proposal after an explicit current evaluation.
        let superseded = state
            .entries
            .iter()
            .filter(|(_, e)| e.record.proposal_id == r.proposal_id)
            .map(|(id, _)| *id)
            .collect::<Vec<_>>();
        state.revoked.extend(superseded);
        if r.subject.is_some() {
            state.entries.insert(next.subject.id, next);
        }
        state
            .native_reviews
            .insert(r.decision.decision_id, r.clone());
        state.immutable_checkpoint = None;
        Ok(r)
    }
    pub fn native_snapshot(&self, id: ProposalId) -> Result<Option<ContentHash>, Error> {
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        Ok(state
            .entries
            .get(&id)
            .ok_or(Error::Invalid)?
            .native
            .as_ref()
            .map(|c| c.snapshot.snapshot_hash.clone()))
    }
}
impl NativeReview {
    /// Safe provenance projection, not an independently verifiable public-key token.
    pub fn public_view(&self) -> Result<Value, Error> {
        let d = &self.decision;
        let s = &self.context.snapshot;
        let mut response = json!({"schemaVersion":"quantos-native-risk-review.v1","previousSubjectId":self.previous_subject_id,"proposalId":self.proposal_id,"proposalHash":self.proposal_hash,"snapshotHash":d.snapshot_hash,"ledgerHash":s.ledger_hash,"sourceHash":s.source_hash,"sourceVersion":s.source_version.to_string(),"sourceTrust":s.source_trust,"killGeneration":d.kill_revision.to_string(),"decision":{"decisionId":d.decision_id,"verdict":d.verdict,"purpose":d.purpose,"proposalHash":d.proposal_hash,"snapshotHash":d.snapshot_hash,"intentHash":d.intent_hash,"factsHash":d.facts_hash,"policyVersion":d.policy.version,"killGeneration":d.kill_revision.to_string(),"checks":d.checks,"decidedAt":d.decided_at,"expiresAt":d.expires_at,"signer":d.signer,"signature":d.signature,"executionAuthority":false},"executionAuthority":false});
        if let Some(s) = &self.subject {
            response["subject"] = json!({"subjectId":s.id,"subjectHash":digest(s)?,"proposalHash":s.proposal_hash,"decisionId":s.decision,"originator":s.originator,"accountId":s.scope.account,"symbol":s.symbol,"side":s.side,"quantity":s.quantity,"limitPrice":s.limit_price,"expiresAt":s.expires_at});
        }
        if let Some(subject) = response.get_mut("subject") {
            subject["nativeRiskBinding"] = native_binding(&self.context);
        }
        Ok(response)
    }
}
impl CurrentSubjectSource {
    pub fn verify_native_response(&self, value: &Value) -> Result<(), Error> {
        let id =
            serde_json::from_value(value["decision"]["decisionId"].clone()).map_err(invalid)?;
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        if state
            .native_reviews
            .get(&id)
            .ok_or(Error::Invalid)?
            .public_view()?
            != *value
        {
            return Err(Error::Invalid);
        }
        Ok(())
    }
}
fn native_binding(c: &NativeRiskContext) -> Value {
    let s = &c.snapshot;
    json!({"snapshotHash":s.snapshot_hash,"ledgerHash":s.ledger_hash,"sourceHash":s.source_hash,"sourceVersion":s.source_version.to_string(),"killGeneration":s.kill_generation,"expiresAt":s.expires_at,"executionAuthority":false})
}
impl CurrentSubjectSource {
    /// Immutable R04 catalog for explicit re-evaluation. A stale old risk review
    /// is not a reason to hide the still-live Proposal or renew its lifetime.
    pub fn review_candidates(&self, at: DateTime<Utc>) -> Result<Vec<Value>, Error> {
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        state.entries.values().filter(|e|e.native.is_none()&&e.record.created_at<=at&&at<e.record.expires_at).map(|e|Ok(json!({"subjectId":e.subject.id,"proposalId":e.record.proposal_id,"proposalHash":e.subject.proposal_hash,"proposalExpiresAt":e.record.expires_at,"accountId":e.subject.scope.account,"symbol":e.subject.symbol,"side":e.subject.side,"quantity":e.subject.quantity,"limitPrice":e.subject.limit_price,"executionAuthority":false}))).collect()
    }
    pub fn native_risk_binding(&self, id: ProposalId) -> Result<Option<Value>, Error> {
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        Ok(state
            .entries
            .get(&id)
            .ok_or(Error::Invalid)?
            .native
            .as_ref()
            .map(native_binding))
    }
}
