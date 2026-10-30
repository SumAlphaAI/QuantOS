//! Public explicit X02 review. Only a current hash/expected generation is accepted;
//! financial values and the immutable R04 Proposal never come from the client.
use super::*;
use quantos_portfolio::native_valuation::Snapshot;
use quantos_risk::guard::NativeRiskContext;
impl OwnedHost {
    pub(super) fn require_native_snapshot(
        &mut self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
    ) -> Result<(), Error> {
        let store = self.book_input_fence.clone();
        let _lock = store.as_ref().map(|s| s.lock()).transpose()?;
        self.require_native_snapshot_locked(session, id, clock)
    }
    pub(super) fn require_native_snapshot_locked(
        &mut self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
    ) -> Result<(), Error> {
        if let Some(expected) = self.sources.native_snapshot(id)? {
            let at = clock.sample();
            let v = self.sync_valuation(session, at)?;
            if v["riskInputReady"] != true || v["snapshot"]["snapshotHash"] != json!(expected) {
                return Err(Error::PolicyChanged);
            }
            self.sync_reconciliation_locked(session, at)?;
            let current = self.reviewed_books(clock.sample())?;
            if !current.eligible(clock.sample())
                || self.sources.native_books(id)?.as_ref() != Some(&current)
            {
                return Err(Error::PolicyChanged);
            }
        }
        Ok(())
    }
    pub(super) fn refresh_risk(
        &mut self,
        session: &str,
        id: ProposalId,
        key: &str,
        body: &Value,
        clock: impl ClockInput,
    ) -> Result<Value, Error> {
        let at = clock.sample();
        let caps = self.service.capabilities(session, at)?;
        if caps["request"] != true {
            return Err(Error::Unauthorized);
        }
        if body.as_object().is_none_or(|o| o.len() != 2)
            || !body["snapshotHash"].is_string()
            || !body["expectedGeneration"].is_string()
        {
            return Err(Error::Invalid);
        }
        let store = self.book_input_fence.clone().ok_or(Error::Unavailable)?;
        let _books_lock = store.lock()?;
        let at = clock.sample();
        let current = self.sync_valuation(session, at)?;
        if current["riskInputReady"] != true
            || current["snapshot"]["snapshotHash"] != body["snapshotHash"]
            || current["killGeneration"] != body["expectedGeneration"]
        {
            return Err(Error::PolicyChanged);
        }
        self.sync_reconciliation_locked(session, at)?;
        let books = self.reviewed_books(clock.sample())?;
        let binding = json!([id, body]);
        let cache_key = (session.to_owned(), key.to_owned());
        if let Some(previous) = self.risk_refreshes.get(&cache_key) {
            if previous["binding"] != binding {
                return Err(Error::Conflict);
            }
            if previous["response"]["booksAdmission"]["inputHash"]
                != json!(books.content_hash().map_err(|_| Error::Unavailable)?)
            {
                return Err(Error::PolicyChanged);
            }
            let until: DateTime<Utc> =
                serde_json::from_value(previous["response"]["decision"]["expiresAt"].clone())
                    .map_err(|_| Error::Unavailable)?;
            if clock.sample() >= until {
                return Err(Error::Expired);
            }
            return Ok(previous["response"].clone());
        }
        if self.risk_refreshes.len() >= 512 {
            return Err(Error::Unavailable);
        }
        let snapshot: Snapshot =
            serde_json::from_value(current["snapshot"].clone()).map_err(|_| Error::Unavailable)?;
        let context = NativeRiskContext {
            books: Some(books),
            input: self
                .valuation
                .input_for(&snapshot)
                .map_err(|_| Error::Unavailable)?,
            snapshot,
            ledger_checkpoint: self
                .ledger
                .as_ref()
                .ok_or(Error::Unavailable)?
                .checkpoint()
                .map_err(|_| Error::Unavailable)?,
        };
        let review = self.sources.refresh_native(id, context, clock.sample())?;
        if let Some(subject) = &review.subject {
            self.service.register_subject(subject.clone())?;
            self.subjects.insert(subject.id, subject.clone());
        }
        let response = review.public_view()?;
        self.risk_refreshes
            .insert(cache_key, json!({"binding":binding,"response":response}));
        Ok(response)
    }
}
impl OwnedHost {
    pub(super) fn risk_refresh_audit(&self, all: &mut Vec<Value>) -> Result<(), Error> {
        for ((session, _), row) in &self.risk_refreshes {
            let response = &row["response"];
            let id = &response["decision"]["decisionId"];
            let event_id = super::persistence::event_id(&format!("x02-native-review:{id}"));
            let payload = json!({"review":response,"originalApprovalInherited":false});
            let at: DateTime<Utc> =
                serde_json::from_value(response["decision"]["decidedAt"].clone())
                    .map_err(|_| Error::Unavailable)?;
            all.push(json!({"auditRef":event_id,"eventId":event_id,"correlationId":id,"causationId":event_id,"sequence":1,"kind":"risk.native_review_created","actor":crate::execution::reference_actor(session),"objectRef":format!("risk-decision:{}",id.as_str().unwrap_or("")),"occurredAt":at,"route":format!("/orders?subjectId={}",response["previousSubjectId"].as_str().unwrap_or("")),"redactionApplied":true,"redactedPayload":payload,"payloadHash":crate::audit_core::payload_hash(&payload),"retentionUntil":at+Duration::days(90)}));
        }
        Ok(())
    }
}
