//! X06 append-only financial disposition. Authenticated owner adapters supply
//! current identity/MFA; this module cannot edit X05 OPEN facts or submit IO.
use crate::{
    current::{AlertEvidence, digest},
    model::Error,
};
use chrono::{DateTime, Utc};
use quantos_core::{ActorId, ContentHash, ProposalId};
use quantos_policy::Role;
use quantos_portfolio::books_risk::{
    BooksRiskInput, FinancialReviewAdmission, ObligationCoverage, ReviewKind,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;
type Result<T> = std::result::Result<T, Error>;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Context {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_kind: Option<ReviewKind>,
    pub input: BooksRiskInput,
    pub evidence: Vec<AlertEvidence>,
    pub kill_generation: u64,
}
pub fn coverage<'a>(e: impl Iterator<Item = &'a AlertEvidence>) -> ObligationCoverage {
    let mut c = ObligationCoverage {
        financial: 0,
        source_health: 0,
        blocked: 0,
    };
    for e in e {
        match e.finding.kind.as_str() {
            "ACCOUNT_BOOKS_POSITION_DIFFERENCE"
            | "ACCOUNT_BOOKS_CASH_DIFFERENCE"
            | "ACCOUNT_BOOKS_FEE_DIFFERENCE" => c.financial += 1,
            "ACCOUNT_BOOKS_STALE" | "ACCOUNT_BOOKS_UNAVAILABLE" => c.source_health += 1,
            _ => c.blocked += 1,
        }
    }
    c
}
impl Context {
    pub fn is_source(&self) -> bool {
        self.review_kind == Some(ReviewKind::SourceHealth)
    }
    pub fn covered_obligations(&self) -> u64 {
        let c = coverage(self.evidence.iter());
        if self.is_source() {
            c.source_health
        } else {
            c.financial
        }
    }
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!([
            if self.is_source() {
                "quantos-source-health-review-context/v1"
            } else {
                "quantos-financial-review-context/v1"
            },
            self
        ]))
    }
    pub fn validate(&self, at: DateTime<Utc>) -> Result<()> {
        if self.input.financial_review.is_some()
            || self.input.source_review.is_some()
            || self.input.open_obligations == 0
            || self.covered_obligations() == 0
            || self.evidence.len() > 128
            || self.input.open_obligations != self.evidence.len() as u64
        {
            return Err(Error::Transition);
        }
        let mut clean = self.input.clone();
        clean.open_obligations = 0;
        clean.obligation_coverage = None;
        if !clean.eligible(at) {
            return Err(Error::Transition);
        }
        let counts = coverage(self.evidence.iter());
        if counts.blocked > 0
            || self.input.obligation_coverage
                != (if counts.source_health > 0 {
                    Some(counts)
                } else {
                    None
                })
        {
            return Err(Error::Transition);
        }
        let mut source = BTreeMap::new();
        for e in &self.evidence {
            let health = matches!(
                e.finding.kind.as_str(),
                "ACCOUNT_BOOKS_STALE" | "ACCOUNT_BOOKS_UNAVAILABLE"
            );
            if e.scope != self.input.scope
                || e.status != "OPEN"
                || e.execution_authority
                || e.binding.is_some()
                || e.finding.command_id.is_some()
                || e.observed_at > at
                || (!health || e.finding.kind == "ACCOUNT_BOOKS_STALE") && e.books_hash.is_none()
                || health
                    && (e.finding.entity != "account"
                        || self.input.captured_at.is_none_or(|t| t < e.observed_at)
                        || self
                            .input
                            .coverage_through
                            .is_none_or(|t| t < e.observed_at))
                || e.evidence_id
                    != digest(&json!([
                        "quantos-x05-alert-evidence/v1",
                        e.scope,
                        e.finding,
                        e.binding,
                        e.ledger_hash,
                        e.books_hash
                    ]))?
                || source.insert(e.evidence_id.clone(), e).is_some()
            {
                return Err(Error::Transition);
            }
        }
        if self.input.obligations_hash
            != digest(&json!([
                "quantos-x05-open-risk-obligations/v1",
                self.input.scope,
                source
            ]))?
        {
            return Err(Error::Conflict);
        }
        Ok(())
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Request,
    Endorse,
    Authorize,
    RetainBlock,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Record {
    pub sequence: u64,
    pub event_id: ProposalId,
    pub case_id: ProposalId,
    pub action: Action,
    pub context: Context,
    pub actor: ActorId,
    pub user: Uuid,
    pub role: Role,
    pub session: String,
    pub authority_revision: u64,
    pub authority_expires_at: DateTime<Utc>,
    pub key_hash: ContentHash,
    pub intent_hash: ContentHash,
    pub proof_hash: ContentHash,
    pub reason: String,
    pub at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub previous: Option<ContentHash>,
    pub hash: ContentHash,
}
impl Record {
    pub fn event(&self) -> Result<Value> {
        let mut v = json!({"sequence":self.sequence.to_string(),"eventId":self.event_id,"caseId":self.case_id,"action":self.action,"actorId":self.actor,"userId":self.user,"role":self.role,"contextHash":self.context.content_hash()?,"inputHash":self.context.input.content_hash().map_err(|_|Error::Unavailable)?,"obligationsHash":self.context.input.obligations_hash,"evidenceIds":self.context.evidence.iter().map(|e|&e.evidence_id).collect::<Vec<_>>(),"openObligations":self.context.input.open_obligations,"killGeneration":self.context.kill_generation.to_string(),"reason":self.reason,"occurredAt":self.at,"expiresAt":self.expires_at,"recordHash":self.hash,"sourceStatus":"OPEN","executionAuthority":false});
        if self.context.is_source() {
            v["reviewKind"] = json!("source_health");
        }
        if self.context.input.obligation_coverage.is_some() {
            v["coveredObligations"] = json!(self.context.covered_obligations());
        }
        Ok(v)
    }
    fn content_hash(&self) -> Result<ContentHash> {
        let mut v = serde_json::to_value(self).map_err(|_| Error::Unavailable)?;
        v.as_object_mut().ok_or(Error::Unavailable)?.remove("hash");
        digest(&json!([
            if self.context.is_source() {
                "quantos-source-health-review-record/v1"
            } else {
                "quantos-financial-review-record/v1"
            },
            v
        ]))
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Journal {
    pub records: Vec<Record>,
}
impl Journal {
    pub fn revision(&self) -> u64 {
        self.records.len() as u64
    }
    pub fn verify_extension(&self, old: &Self) -> Result<()> {
        self.verify()?;
        if self.records.len() < old.records.len()
            || self.records[..old.records.len()]
                .iter()
                .zip(&old.records)
                .any(|(a, b)| a.hash != b.hash)
        {
            return Err(Error::Conflict);
        }
        Ok(())
    }
    pub fn verify(&self) -> Result<()> {
        if self.records.len() > 256 {
            return Err(Error::Unavailable);
        }
        let mut before = Self::default();
        let (mut ids, mut keys, mut proofs) = (BTreeSet::new(), BTreeSet::new(), BTreeSet::new());
        for r in &self.records {
            if r.sequence != before.revision() + 1
                || r.previous != before.records.last().map(|e| e.hash.clone())
                || r.hash != r.content_hash()?
                || r.at >= r.expires_at
                || r.context
                    .input
                    .deadline()
                    .is_none_or(|end| r.expires_at > end)
                || r.actor.as_uuid().is_nil()
                || r.authority_revision == 0
                || r.expires_at > r.authority_expires_at
                || r.user.is_nil()
                || r.event_id.as_uuid().is_nil()
                || r.case_id.as_uuid().is_nil()
                || r.session.is_empty()
                || r.session.len() > 128
                || r.reason.trim().is_empty()
                || r.reason.chars().count() > 256
                || r.reason.chars().any(char::is_control)
                || !ids.insert(r.event_id)
                || !keys.insert((r.actor, r.key_hash.clone()))
                || !proofs.insert(r.proof_hash.clone())
                || before.records.last().is_some_and(|v| v.at > r.at)
            {
                return Err(Error::Conflict);
            }
            r.context.validate(r.at)?;
            before.transition(r)?;
            before.records.push(r.clone());
        }
        Ok(())
    }
    fn transition(&self, r: &Record) -> Result<()> {
        let prior: Vec<_> = self
            .records
            .iter()
            .filter(|e| e.case_id == r.case_id)
            .collect();
        if r.action == Action::Request {
            if !prior.is_empty() || !matches!(r.role, Role::Owner | Role::Operator) {
                return Err(Error::Unauthorized);
            }
            return Ok(());
        }
        let first = prior.first().ok_or(Error::Transition)?;
        let last = prior.last().ok_or(Error::Transition)?;
        if first.context.content_hash()? != r.context.content_hash()?
            || r.expires_at > last.expires_at
            || r.at >= last.expires_at
        {
            return Err(Error::Conflict);
        }
        match r.action {
            Action::Endorse
                if last.action == Action::Request
                    && matches!(r.role, Role::Owner | Role::Approver)
                    && r.user != first.user
                    && r.actor != first.actor =>
            {
                Ok(())
            }
            Action::Authorize
                if last.action == Action::Endorse
                    && r.role == Role::Owner
                    && r.user != first.user
                    && r.user != last.user
                    && r.actor != first.actor
                    && r.actor != last.actor =>
            {
                Ok(())
            }
            Action::RetainBlock
                if last.action != Action::RetainBlock
                    && matches!(r.role, Role::Owner | Role::Approver) =>
            {
                Ok(())
            }
            _ => Err(Error::Unauthorized),
        }
    }
    /// Exact current source/context is checked by caller before this operation.
    /// The journal is committed atomically with proof consumption by the adapter.
    pub fn append(&mut self, mut r: Record, expected: u64) -> Result<Record> {
        self.verify()?;
        if self.revision() != expected || self.records.len() >= 256 {
            return Err(Error::Conflict);
        }
        r.sequence = self.revision() + 1;
        r.previous = self.records.last().map(|e| e.hash.clone());
        r.hash = r.content_hash()?;
        let mut next = self.clone();
        next.records.push(r.clone());
        next.verify()?;
        *self = next;
        Ok(r)
    }
    pub fn admission(
        &self,
        current: &Context,
        at: DateTime<Utc>,
    ) -> Result<Option<FinancialReviewAdmission>> {
        self.verify()?;
        if current.validate(at).is_err() {
            return Ok(None);
        }
        let key = current.content_hash()?;
        let Some(r) = self
            .records
            .iter()
            .rev()
            .find(|r| r.context.content_hash().ok().as_ref() == Some(&key))
        else {
            return Ok(None);
        };
        if r.action != Action::Authorize || r.at > at || at >= r.expires_at {
            return Ok(None);
        }
        Ok(Some(FinancialReviewAdmission {
            review_kind: current.review_kind,
            case_id: r.case_id,
            record_hash: r.hash.clone(),
            raw_input_hash: current
                .input
                .content_hash()
                .map_err(|_| Error::Unavailable)?,
            obligations_hash: current.input.obligations_hash.clone(),
            covered_obligations: current.covered_obligations(),
            kill_generation: current.kill_generation.to_string(),
            decided_at: r.at,
            valid_until: r.expires_at,
        }))
    }
}
