//! Explicit current financial review, committed with MFA and common C10 under
//! the existing authenticated approval transaction. Never acknowledges an Alert.
use super::*;
use axum::extract::Query;
use quantos_portfolio::books_risk::ReviewKind;
use quantos_reconcile::financial_review::{Action, Context, Record};
fn mapped(e: quantos_reconcile::model::Error) -> Error {
    match e {
        quantos_reconcile::model::Error::Unauthorized => Error::Unauthorized,
        quantos_reconcile::model::Error::Unavailable => Error::Unavailable,
        _ => Error::Conflict,
    }
}
fn hash(v: &Value) -> Result<ContentHash, Error> {
    quantos_reconcile::current::digest(v).map_err(mapped)
}
impl OwnedHost {
    pub(super) fn financial_context(&self) -> Result<Context, Error> {
        let r = self.reconciliation.as_ref().ok_or(Error::Unavailable)?;
        let account = r.risk_input().map_err(mapped)?.scope.account_id;
        let generation = self.sources.kill_status(account)?["revision"]
            .as_u64()
            .ok_or(Error::Unavailable)?;
        r.financial_review_context(generation).map_err(mapped)
    }
    /// Caller holds the account books publisher fence. Rebuild on every use;
    /// there is no cache of financial approval and no source-history rewrite.
    pub(super) fn reviewed_books(
        &self,
        at: DateTime<Utc>,
    ) -> Result<quantos_portfolio::books_risk::BooksRiskInput, Error> {
        let mut c = self.financial_context()?;
        let mut input = c.input.clone();
        for kind in [None, Some(ReviewKind::SourceHealth)] {
            c.review_kind = kind;
            if let Some(admission) = self.financial_reviews.admission(&c, at).map_err(mapped)?
                && self.financial_authorities_current(admission.case_id, at)
            {
                if kind.is_some() {
                    input.source_review = Some(admission);
                } else {
                    input.financial_review = Some(admission);
                }
            }
        }
        Ok(input)
    }
    fn financial_authorities_current(&self, case: ProposalId, at: DateTime<Utc>) -> bool {
        let actors = self
            .financial_reviews
            .records
            .iter()
            .filter(|r| r.case_id == case)
            .collect::<Vec<_>>();
        !actors.is_empty()
            && actors.iter().all(|r| {
                self.service
                    .control_session(&r.session, at)
                    .is_ok_and(|(a, revision, end)| {
                        a.actor_id == r.actor
                            && a.user_id == r.user
                            && a.role == r.role
                            && revision == r.authority_revision
                            && end == r.authority_expires_at
                    })
            })
    }
    pub(super) fn financial_audit(&self, all: &mut Vec<Value>) -> Result<(), Error> {
        for r in &self.financial_reviews.records {
            let payload = r.event().map_err(mapped)?;
            let corr = r.case_id.to_string();
            let prior = all
                .iter()
                .filter(|v| v["correlationId"] == corr)
                .collect::<Vec<_>>();
            all.push(json!({"auditRef":r.event_id,"eventId":r.event_id,"correlationId":r.case_id,"causationId":prior.last().map(|v|v["eventId"].clone()).unwrap_or(json!(r.event_id)),"sequence":prior.len()+1,"kind":format!("assisted.{}_{}",if r.context.is_source(){"source_health_review"}else{"financial_review"},serde_json::to_value(r.action).map_err(|_|Error::Unavailable)?.as_str().ok_or(Error::Unavailable)?),"actor":r.actor,"objectRef":format!("{}:{}",if r.context.is_source(){"source-health-review"}else{"financial-review"},r.case_id),"occurredAt":r.at,"route":"/alerts","redactionApplied":true,"redactedPayload":payload,"payloadHash":crate::audit_core::payload_hash(&payload),"retentionUntil":r.at+Duration::days(90)}));
        }
        Ok(())
    }
    fn financial_view(
        &self,
        sid: &str,
        at: DateTime<Utc>,
        session_end: DateTime<Utc>,
        source: bool,
    ) -> Result<Value, Error> {
        let a = self.service.control_auth(sid, at)?;
        let mut c = self.financial_context()?;
        let financial_hash = c.content_hash().map_err(mapped)?;
        c.review_kind = Some(ReviewKind::SourceHealth);
        let source_hash = c.content_hash().map_err(mapped)?;
        if !source {
            c.review_kind = None;
        }
        let reviewable = c.validate(at).is_ok();
        let input = self.reviewed_books(at)?;
        Ok(
            json!({"schemaVersion":if source{"quantos-source-health-review-view.v1"}else{"quantos-financial-review-view.v1"},"contextHashes":{"financial":financial_hash,"sourceHealth":source_hash},"scope":c.input.scope,"mode":"assisted_live","revision":self.financial_reviews.revision().to_string(),"contextHash":c.content_hash().map_err(mapped)?,"currentBooks":c.input,"riskBooks":input,"reviewable":reviewable,"canRequest":reviewable&&matches!(a.role,Role::Owner|Role::Operator),"canEndorse":reviewable&&matches!(a.role,Role::Owner|Role::Approver),"canAuthorize":reviewable&&a.role==Role::Owner,"canRetainBlock":reviewable&&matches!(a.role,Role::Owner|Role::Approver),"history":self.financial_reviews.records.iter().map(Record::event).collect::<std::result::Result<Vec<_>,_>>().map_err(mapped)?,"checkedAt":at,"expiresAt":(at+Duration::seconds(8)).min(session_end),"sourceStatus":"OPEN","executionAuthority":false}),
        )
    }
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str, Error> {
    v[k].as_str().ok_or(Error::Invalid)
}
pub(super) async fn handle(
    State(data): State<Arc<Mutex<ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    bytes: Bytes,
) -> Response {
    if let Err(r) = crate::authenticate(&headers, &data).await {
        return r;
    }
    let sid = crate::cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap_or("")
        .to_owned();
    let source = uri
        .path()
        .starts_with("/v1/assisted-testnet/source-reviews");
    let receipt_schema = if source {
        "quantos-source-health-review-receipt.v1"
    } else {
        "quantos-financial-review-receipt.v1"
    };
    let mut state = data.lock().await;
    let offset = state.clock_offset;
    let clock = || now(Utc::now() + offset);
    let result = (|| -> Result<Value, Error> {
        if !q.is_empty() {
            return Err(Error::Invalid);
        }
        let fence = state
            .assisted
            .as_ref()
            .and_then(|h| h.book_input_fence.clone())
            .ok_or(Error::Unavailable)?;
        let _guard = fence.lock()?;
        let at = clock();
        let session_end = now(state.session_expires_at);
        {
            let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
            if !h.enabled() {
                return Err(Error::Disabled);
            }
            h.service.control_auth(&sid, at)?;
            h.sync_reconciliation_locked(&sid, at)?;
        }
        if method == Method::GET {
            if !bytes.is_empty() {
                return Err(Error::Invalid);
            }
            return state.assisted.as_ref().unwrap().financial_view(
                &sid,
                clock(),
                session_end,
                source,
            );
        }
        if method != Method::POST
            || crate::cookies(&headers).get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN)
        {
            return Err(Error::Unauthorized);
        }
        let b: Value = serde_json::from_slice(&bytes).map_err(|_| Error::Invalid)?;
        if b.as_object().ok_or(Error::Invalid)?.len() != 6
            || b.as_object().unwrap().keys().any(|k| {
                ![
                    "expectedRevision",
                    "contextHash",
                    "reason",
                    "confirmPhrase",
                    "mfaChallengeRef",
                    "reauthTokenRef",
                ]
                .contains(&k.as_str())
            })
        {
            return Err(Error::Invalid);
        }
        let action = match uri.path().rsplit('/').next().unwrap_or("") {
            "financial-reviews" | "source-reviews" => Action::Request,
            "endorse" => Action::Endorse,
            "authorize" => Action::Authorize,
            "retain-block" => Action::RetainBlock,
            _ => return Err(Error::Invalid),
        };
        let phrase = if source {
            match action {
                Action::Request => "REQUEST SOURCE HEALTH REVIEW",
                Action::Endorse => "ENDORSE SOURCE HEALTH REVIEW",
                Action::Authorize => "AUTHORIZE CURRENT SOURCE REVIEW",
                Action::RetainBlock => "RETAIN SOURCE HEALTH BLOCK",
            }
        } else {
            match action {
                Action::Request => "REQUEST FINANCIAL REVIEW",
                Action::Endorse => "ENDORSE FINANCIAL REVIEW",
                Action::Authorize => "AUTHORIZE CURRENT RISK REVIEW",
                Action::RetainBlock => "RETAIN FINANCIAL BLOCK",
            }
        };
        if text(&b, "confirmPhrase")? != phrase {
            return Err(Error::Invalid);
        }
        let expected = text(&b, "expectedRevision")?
            .parse::<u64>()
            .map_err(|_| Error::Invalid)?;
        if expected.to_string() != text(&b, "expectedRevision")? {
            return Err(Error::Invalid);
        }
        if headers.get("if-match").and_then(|v| v.to_str().ok())
            != Some(text(&b, "expectedRevision")?)
        {
            return Err(Error::Conflict);
        }
        let key = headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty() && v.len() <= 128)
            .ok_or(Error::Invalid)?;
        let intent = hash(&json!([
            if source {
                "quantos-source-health-review-intent/v1"
            } else {
                "quantos-financial-review-intent/v1"
            },
            uri.path(),
            b
        ]))?;
        let key_hash = ContentHash::sha256_bytes(key.as_bytes());
        let grant = text(&b, "reauthTokenRef")?;
        let challenge = text(&b, "mfaChallengeRef")?;
        let proof = format!("{sid}:{grant}");
        let proof_hash = ContentHash::sha256_bytes(proof.as_bytes());
        let at = clock();
        let deadline = match (
            state.challenges.get(challenge),
            state.reauth_grants.get(grant),
        ) {
            (Some(c), Some(g))
                if c.session == sid
                    && g.session == sid
                    && c.purpose == "security_change"
                    && c.consumed
                    && c.verified_at.is_some_and(|t| now(t) <= at)
                    && g.challenge_ref == challenge =>
            {
                now(c.expires_at)
                    .min(now(g.expires_at))
                    .min(now(c.verified_at.unwrap()) + Duration::seconds(120))
                    .min(session_end)
            }
            _ => return Err(Error::MfaInvalid),
        };
        if deadline <= at {
            return Err(Error::Expired);
        }
        let consumed = state.consumed_step_proofs.contains(&proof);
        let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
        let (auth, authority_revision, authority_expires_at) =
            h.service.control_session(&sid, at)?;
        let mut c = h.financial_context()?;
        c.review_kind = source.then_some(ReviewKind::SourceHealth);
        if let Some(old) = h
            .financial_reviews
            .records
            .iter()
            .find(|r| r.actor == auth.actor_id && r.key_hash == key_hash)
        {
            if old.intent_hash != intent {
                return Err(Error::Conflict);
            }
            if at >= old.expires_at {
                return Err(Error::Expired);
            }
            // Original receipt only: do not reapply or bind it to newer sources.
            return Ok(
                json!({"schemaVersion":receipt_schema,"event":old.event().map_err(mapped)?,"readCurrentState":true,"executionAuthority":false}),
            );
        }
        if consumed {
            return Err(Error::MfaConsumed);
        }
        if c.content_hash().map_err(mapped)?.to_string() != text(&b, "contextHash")? {
            return Err(Error::PolicyChanged);
        }
        c.validate(at).map_err(mapped)?;
        let case_id = if action == Action::Request {
            ProposalId::new()
        } else {
            uri.path()
                .split('/')
                .nth(4)
                .and_then(|s| ProposalId::parse_str(s).ok())
                .ok_or(Error::Invalid)?
        };
        let last = h
            .financial_reviews
            .records
            .iter()
            .rev()
            .find(|r| r.case_id == case_id);
        let end = deadline
            .min(authority_expires_at)
            .min(c.input.deadline().ok_or(Error::Expired)?)
            .min(last.map(|r| r.expires_at).unwrap_or(deadline));
        let r = h
            .financial_reviews
            .append(
                Record {
                    sequence: 0,
                    event_id: ProposalId::new(),
                    case_id,
                    action,
                    context: c,
                    actor: auth.actor_id,
                    user: auth.user_id,
                    role: auth.role,
                    session: sid.clone(),
                    authority_revision,
                    authority_expires_at,
                    key_hash,
                    intent_hash: intent,
                    proof_hash,
                    reason: text(&b, "reason")?.into(),
                    at: clock(),
                    expires_at: end,
                    previous: None,
                    hash: ContentHash::sha256_bytes(b"uncommitted"),
                },
                expected,
            )
            .map_err(mapped)?;
        state.consumed_step_proofs.insert(proof);
        Ok(
            json!({"schemaVersion":receipt_schema,"event":r.event().map_err(mapped)?,"readCurrentState":true,"executionAuthority":false}),
        )
    })();
    match result {
        Ok(v) => crate::response(StatusCode::OK, v, &crate::correlation_id()),
        Err(e) => fail(e).response(),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn financial_review_authority_revision_or_revocation_cannot_revive_disposition() {
        let p:Value=serde_json::from_str(include_str!("../../../../docs/audit/evidence/core-x02-books-risk-local-20261030/attempt-01/open.json")).unwrap();
        let at: DateTime<Utc> =
            serde_json::from_value(p["correctedDeny"]["decision"]["decidedAt"].clone()).unwrap();
        for revoke in [false, true] {
            let mut h = OwnedHost::configured(
                true,
                at,
                at + Duration::seconds(120),
                [[1; 32], [2; 32], [3; 32]],
                None,
            )
            .unwrap();
            let mut evidence: Vec<quantos_reconcile::current::AlertEvidence> = p["alerts"]["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|v| serde_json::from_value(v["sourceEvidence"].clone()).unwrap())
                .collect();
            evidence.sort_by_key(|e| e.evidence_id.clone());
            let context = Context {
                review_kind: None,
                input: serde_json::from_value(
                    p["correctedDeny"]["booksAdmission"]["input"].clone(),
                )
                .unwrap(),
                evidence,
                kill_generation: 0,
            };
            let id = ProposalId::new();
            for (action, sid) in [
                (Action::Request, "session-current"),
                (Action::Endorse, "session-approver"),
                (Action::Authorize, "session-owner"),
            ] {
                let (a, revision, end) = h.service.control_session(sid, at).unwrap();
                h.financial_reviews
                    .append(
                        Record {
                            sequence: 0,
                            event_id: ProposalId::new(),
                            case_id: id,
                            action,
                            context: context.clone(),
                            actor: a.actor_id,
                            user: a.user_id,
                            role: a.role,
                            session: sid.into(),
                            authority_revision: revision,
                            authority_expires_at: end,
                            key_hash: ContentHash::sha256_bytes(sid.as_bytes()),
                            intent_hash: ContentHash::sha256_bytes(b"model"),
                            proof_hash: ContentHash::sha256_bytes(sid.as_bytes()),
                            reason: "Owner adapter model, not public MFA proof".into(),
                            at,
                            expires_at: context.input.deadline().unwrap(),
                            previous: None,
                            hash: ContentHash::sha256_bytes(b"uncommitted"),
                        },
                        h.financial_reviews.revision(),
                    )
                    .unwrap();
            }
            assert!(h.financial_authorities_current(id, at));
            if revoke {
                h.service.revoke_session("session-approver").unwrap();
            } else {
                let (auth, revision, end) =
                    h.service.control_session("session-approver", at).unwrap();
                h.service
                    .update_session(
                        "session-approver",
                        revision,
                        Session {
                            auth,
                            revision: revision + 1,
                            issued_at: at,
                            expires_at: end,
                            active: true,
                        },
                    )
                    .unwrap();
            }
            assert!(!h.financial_authorities_current(id, at));
            assert_eq!(h.financial_reviews.records[1].authority_revision, 1);
        }
    }
}
