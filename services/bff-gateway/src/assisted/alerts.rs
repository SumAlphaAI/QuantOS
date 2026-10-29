//! X06 consumes only the authenticated X05 outbox. Read-only in-app delivery;
//! source obligations remain OPEN. No Paper adapter, ack, close, or command IO.
use super::*;
use quantos_portfolio::native_ledger::{Anchor, Scope};
use quantos_reconcile::current::{AlertEvidence, CurrentReconciliation, digest};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Inbox {
    schema_version: String,
    scope: Scope,
    records: Vec<AlertEvidence>,
    anchor: Anchor,
}
impl Inbox {
    fn new(scope: Scope) -> Self {
        Self {
            schema_version: "quantos-x06-current-alert-inbox.v1".into(),
            scope,
            records: vec![],
            anchor: Anchor::default(),
        }
    }
    fn heads(&self) -> Result<Vec<ContentHash>, Error> {
        let mut heads = vec![];
        let mut seen = std::collections::BTreeSet::new();
        if self.records.len() > 20000 {
            return Err(Error::Unavailable);
        }
        for e in &self.records {
            let expected = digest(&json!([
                "quantos-x05-alert-evidence/v1",
                self.scope,
                e.finding,
                e.binding,
                e.ledger_hash,
                e.books_hash
            ]))
            .map_err(|_| Error::Unavailable)?;
            if e.scope != self.scope
                || e.status != "OPEN"
                || e.execution_authority
                || e.evidence_id != expected
                || !seen.insert(e.evidence_id.clone())
            {
                return Err(Error::Unavailable);
            }
            heads.push(
                digest(&json!([
                    "quantos-x06-alert-consumption/v1",
                    heads.len() + 1,
                    heads.last(),
                    e
                ]))
                .map_err(|_| Error::Unavailable)?,
            );
        }
        Ok(heads)
    }
    fn verify(
        &self,
        scope: &Scope,
        anchor: &Anchor,
        sources: &[AlertEvidence],
    ) -> Result<(), Error> {
        if self.schema_version != "quantos-x06-current-alert-inbox.v1" || &self.scope != scope {
            return Err(Error::Unavailable);
        }
        let heads = self.heads()?;
        if self.anchor
            != (Anchor {
                sequence: heads.len() as u64,
                head: heads.last().cloned(),
            })
            || anchor.sequence > heads.len() as u64
            || (if anchor.sequence == 0 {
                None
            } else {
                heads.get(anchor.sequence as usize - 1).cloned()
            }) != anchor.head
        {
            return Err(Error::Unavailable);
        }
        for e in &self.records {
            if !sources.iter().any(|s| {
                s.evidence_id == e.evidence_id
                    && serde_json::to_value(s).ok() == serde_json::to_value(e).ok()
            }) {
                return Err(Error::Unavailable);
            }
        }
        Ok(())
    }
    fn consume(&mut self, source: &[AlertEvidence]) -> Result<bool, Error> {
        let mut next = self.clone();
        for e in source {
            if !next.records.iter().any(|v| v.evidence_id == e.evidence_id) {
                next.records.push(e.clone());
            }
        }
        let heads = next.heads()?;
        next.anchor = Anchor {
            sequence: heads.len() as u64,
            head: heads.last().cloned(),
        };
        next.verify(&self.scope, &self.anchor, source)?;
        let changed = next.anchor != self.anchor;
        *self = next;
        Ok(changed)
    }
    fn row(e: &AlertEvidence, sequence: usize) -> Value {
        let id = persistence::event_id(&format!("x06-alert:{}", e.evidence_id));
        let event = persistence::event_id(&format!("x06-consumed:{}", e.evidence_id));
        let correlation = e
            .binding
            .as_ref()
            .map(|b| b.request_id.to_string())
            .unwrap_or_else(|| id.to_string());
        json!({"id":id,"alertId":id,"sourceRef":e.evidence_id,"rule":e.finding.kind,"severity":"critical","domain":"reconciliation","accountId":e.scope.account_id,"mode":"assisted_live","status":"unacked","active":true,"resolved":false,"objectVersion":"1","sourceVersion":sequence.to_string(),"occurredAt":e.observed_at,"asOf":e.observed_at,"ackActor":null,"ackAt":null,"objectRef":"/orders","correlationId":correlation,"auditRef":event,"sourceEvidence":e,"readOnly":true})
    }
    pub(super) fn rows(&self) -> Vec<Value> {
        self.records
            .iter()
            .enumerate()
            .map(|(i, e)| Self::row(e, i + 1))
            .collect()
    }
}
impl OwnedHost {
    fn alert_scope(&self) -> Result<Scope, Error> {
        let s = &self
            .subjects
            .values()
            .next()
            .ok_or(Error::Unavailable)?
            .scope;
        Ok(Scope {
            tenant_id: s.tenant,
            workspace_id: s.workspace,
            account_id: s.account,
        })
    }
    /// Restore provenance without refreshing captures or consuming new items.
    /// C10 can reconstruct the same consumption events after process restart.
    pub(super) fn load_alerts(&mut self) -> Result<(), Error> {
        let scope = self.alert_scope()?;
        let source = if let Some(store) = &self.reconciliation_store {
            let v = store.lock()?.read()?;
            match v {
                Some(v) => {
                    let origin = self
                        .observer
                        .as_ref()
                        .map(|o| o.identity.clone())
                        .unwrap_or_else(|| "UNCONFIGURED_INDEPENDENT_BOOKS".into());
                    let r = CurrentReconciliation::restore(scope.clone(), origin, &v)
                        .map_err(|_| Error::Unavailable)?;
                    r.verify_anchor(&self.reconciliation_anchor)
                        .map_err(|_| Error::Unavailable)?;
                    Some(r)
                }
                None => {
                    if self.reconciliation_anchor != Anchor::default() {
                        return Err(Error::Unavailable);
                    }
                    None
                }
            }
        } else {
            self.reconciliation.clone()
        };
        let sources: Vec<AlertEvidence> = match source {
            Some(r) => serde_json::from_value(
                r.view().map_err(|_| Error::Unavailable)?["alertEvidence"].clone(),
            )
            .map_err(|_| Error::Unavailable)?,
            None => vec![],
        };
        let stored = self
            .alert_store
            .as_ref()
            .map(|s| s.lock()?.read())
            .transpose()?
            .flatten();
        if stored.is_none()
            && self.alert_store.is_some()
            && (self
                .alert_inbox
                .as_ref()
                .is_some_and(|i| i.anchor != Anchor::default())
                || self.alert_anchor != Anchor::default())
        {
            return Err(Error::Unavailable);
        }
        let inbox = match stored {
            Some(v) => serde_json::from_value::<Inbox>(v).map_err(|_| Error::Unavailable)?,
            None => self
                .alert_inbox
                .clone()
                .unwrap_or_else(|| Inbox::new(scope.clone())),
        };
        inbox.verify(&scope, &self.alert_anchor, &sources)?;
        if let Some(old) = &self.alert_inbox {
            inbox.verify(&scope, &old.anchor, &sources)?;
        }
        self.alert_anchor = inbox.anchor.clone();
        self.alert_inbox = Some(inbox);
        Ok(())
    }
    pub(super) fn sync_alerts(
        &mut self,
        sid: &str,
        at: DateTime<Utc>,
    ) -> Result<Vec<Value>, Error> {
        let view = self.sync_reconciliation(sid, at)?;
        self.load_alerts()?;
        let sources: Vec<AlertEvidence> = serde_json::from_value(view["alertEvidence"].clone())
            .map_err(|_| Error::Unavailable)?;
        let mut inbox = self.alert_inbox.clone().ok_or(Error::Unavailable)?;
        let changed = inbox.consume(&sources)?;
        if let Some(store) = &self.alert_store {
            let tx = store.lock()?;
            if changed || tx.read()?.is_none() {
                tx.write(&serde_json::to_value(&inbox).map_err(|_| Error::Unavailable)?)?;
            }
        }
        let rows = inbox.rows();
        self.alert_anchor = inbox.anchor.clone();
        self.alert_inbox = Some(inbox);
        Ok(rows)
    }
    pub(super) fn alert_audit(&self, all: &mut Vec<Value>) -> Result<(), Error> {
        if let Some(inbox) = &self.alert_inbox {
            for (i, e) in inbox.records.iter().enumerate() {
                if let Some(b) = &e.binding
                    && !self.requests.contains_key(&b.request_id)
                {
                    return Err(Error::Unavailable);
                }
                let row = Inbox::row(e, i + 1);
                let corr = row["correlationId"].as_str().ok_or(Error::Unavailable)?;
                let prior = all
                    .iter()
                    .filter(|n| n["correlationId"] == corr)
                    .collect::<Vec<_>>();
                let payload = json!({"alertId":row["alertId"],"evidenceId":e.evidence_id,"reportId":e.report_id,"ledgerHash":e.ledger_hash,"booksHash":e.books_hash,"binding":e.binding,"findingKind":e.finding.kind,"sourceStatus":"OPEN","executionAuthority":false,"unknownObligationsRetained":true});
                all.push(json!({"auditRef":row["auditRef"],"eventId":row["auditRef"],"correlationId":corr,"causationId":prior.last().map(|n|n["eventId"].clone()).unwrap_or(row["auditRef"].clone()),"sequence":prior.len()+1,"kind":"assisted.x05_alert_consumed","actor":"x06-current-alert-consumer","objectRef":format!("alert:{}",row["alertId"].as_str().unwrap()),"occurredAt":e.observed_at,"route":format!("/alerts/{}",row["alertId"].as_str().unwrap()),"redactionApplied":true,"redactedPayload":payload,"payloadHash":crate::audit_core::payload_hash(&payload),"retentionUntil":e.observed_at+Duration::days(90)}));
            }
        }
        Ok(())
    }
}
/// Mounted at existing public C11 endpoints; never instantiates the Paper host.
pub(crate) async fn handle(
    data: Arc<Mutex<ProviderData>>,
    sid: &str,
    method: Method,
    path: &str,
    q: BTreeMap<String, String>,
    body_empty: bool,
) -> Response {
    let mut state = data.lock().await;
    let at = state.now();
    let result = (|| -> Result<Value, Fault> {
        if !matches!(
            sid,
            crate::CURRENT_SESSION | "session-owner" | "session-approver"
        ) {
            return Err(Fault(StatusCode::FORBIDDEN, "FORBIDDEN"));
        }
        let host = state.assisted.as_mut().ok_or_else(Fault::unavailable)?;
        if !host.enabled() {
            return Err(fail(Error::Disabled));
        }
        // Mutations/stream/subscriptions remain refused, even with forged UI capabilities.
        if method != Method::GET || !body_empty || !path.starts_with("/v1/alerts") {
            return Err(Fault(StatusCode::FORBIDDEN, "READ_ONLY_PROFILE"));
        }
        let mut rows = host.sync_alerts(sid, at).map_err(fail)?;
        persistence::refresh_common(&mut state).map_err(fail)?;
        if path == "/v1/alerts" {
            if q.keys().any(|k| {
                ![
                    "accountId",
                    "pageSize",
                    "sort",
                    "cursor",
                    "status",
                    "domain",
                    "severity",
                    "active",
                ]
                .contains(&k.as_str())
            }) {
                return Err(Fault::invalid());
            }
            if q.get("accountId")
                .is_some_and(|v| v != "44444444-4444-4444-8444-444444444444")
            {
                return Err(Fault::hidden());
            }
            for (key, allowed) in [
                ("status", vec!["unacked", "acked"]),
                (
                    "domain",
                    vec![
                        "risk",
                        "order",
                        "market",
                        "reconciliation",
                        "report",
                        "system",
                    ],
                ),
                ("severity", vec!["critical", "warning", "info"]),
                ("active", vec!["true", "false"]),
                ("sort", vec!["id:asc", "id:desc"]),
            ] {
                if let Some(v) = q.get(key) {
                    if !allowed.contains(&v.as_str()) {
                        return Err(Fault::invalid());
                    }
                    if key != "sort" {
                        rows.retain(|r| {
                            r[key].as_str() == Some(v)
                                || r[key].as_bool().is_some_and(|b| b.to_string() == *v)
                        });
                    }
                }
            }
            rows.sort_by_key(|r| r["id"].as_str().unwrap().to_owned());
            if q.get("sort").is_some_and(|v| v == "id:desc") {
                rows.reverse();
            }
            let size = q
                .get("pageSize")
                .map(|s| s.parse::<usize>())
                .transpose()
                .map_err(|_| Fault::invalid())?
                .unwrap_or(100);
            if !(1..=100).contains(&size) {
                return Err(Fault::invalid());
            }
            let mut binding = q.clone();
            binding.remove("cursor");
            let binding = format!(
                "x06-alerts:{sid}:{}",
                digest(&binding).map_err(|_| Fault::invalid())?
            );
            state
                .audit_cursors
                .retain(|_, (_, _, _, until)| *until > at);
            if rows.len() > size && state.audit_cursors.len() >= 1000 {
                return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "CURSOR_LIMIT"));
            }
            let (snapshot, offset, next) = crate::reference_page(
                &mut state,
                q.get("cursor").map(String::as_str),
                &binding,
                rows,
                size,
            )
            .map_err(|_| Fault(StatusCode::CONFLICT, "CURSOR_SCOPE_CONFLICT"))?;
            Ok(
                json!({"items":snapshot.iter().skip(offset).take(size).collect::<Vec<_>>(),"nextCursor":next,"configVersion":"1"}),
            )
        } else {
            if !q.is_empty() {
                return Err(Fault::invalid());
            }
            let id = path.strip_prefix("/v1/alerts/").ok_or_else(Fault::hidden)?;
            Uuid::parse_str(id).map_err(|_| Fault::hidden())?;
            rows.into_iter()
                .find(|r| r["id"] == id)
                .ok_or_else(Fault::hidden)
        }
    })();
    match result {
        Ok(v) => crate::operations::output(StatusCode::OK, v),
        Err(e) => e.response(),
    }
}
#[cfg(test)]
mod tests;
