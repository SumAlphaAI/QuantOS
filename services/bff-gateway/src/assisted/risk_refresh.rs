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
        at: DateTime<Utc>,
    ) -> Result<(), Error> {
        if let Some(expected) = self.sources.native_snapshot(id)? {
            let v = self.sync_valuation(session, at)?;
            if v["riskInputReady"] != true || v["snapshot"]["snapshotHash"] != json!(expected) {
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
        at: DateTime<Utc>,
    ) -> Result<Value, Error> {
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
        let current = self.sync_valuation(session, at)?;
        if current["riskInputReady"] != true
            || current["snapshot"]["snapshotHash"] != body["snapshotHash"]
            || current["killGeneration"] != body["expectedGeneration"]
        {
            return Err(Error::PolicyChanged);
        }
        let binding = json!([id, body]);
        let cache_key = (session.to_owned(), key.to_owned());
        if let Some(previous) = self.risk_refreshes.get(&cache_key) {
            if previous["binding"] != binding {
                return Err(Error::Conflict);
            }
            let until: DateTime<Utc> =
                serde_json::from_value(previous["response"]["decision"]["expiresAt"].clone())
                    .map_err(|_| Error::Unavailable)?;
            if at >= until {
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
        let review = self.sources.refresh_native(id, context, at)?;
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
