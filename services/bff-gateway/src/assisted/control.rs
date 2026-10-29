//! Current public kill controls. The authenticated approval transaction commits
//! risk generation, review, proof consumption and audit together, then synchronizes
//! the native durable stop before returning. Never edits issued/UNKNOWN facts.
use super::*;
use quantos_risk::guard::{KillReceipt, KillScope};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ControlRecord {
    sequence: u64,
    id: Uuid,
    correlation_id: Uuid,
    action: String,
    global: bool,
    actor: quantos_core::ActorId,
    user: Uuid,
    session: String,
    key_hash: ContentHash,
    binding: ContentHash,
    proof: String,
    reason: String,
    expected_generation: u64,
    at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    approval_ref: Option<Uuid>,
    risk: Option<KillReceipt>,
    previous: Option<ContentHash>,
    hash: ContentHash,
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Controls {
    records: Vec<ControlRecord>,
}
fn digest(v: &Value) -> Result<ContentHash, Error> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(v).map_err(|_| Error::Unavailable)?,
    ))
}
impl Controls {
    pub(super) fn has_transition(&self) -> bool {
        self.records.iter().any(|r| r.risk.is_some())
    }
    fn generation(&self) -> u64 {
        self.records
            .iter()
            .filter_map(|r| r.risk.as_ref().map(|r| r.revision))
            .next_back()
            .unwrap_or(0)
    }
    fn flags(&self) -> (bool, bool) {
        let (mut g, mut a) = (false, false);
        for r in &self.records {
            if let Some(k) = &r.risk {
                if r.global {
                    g = k.engaged
                } else {
                    a = k.engaged
                }
            }
        }
        (g, a)
    }
    fn record_hash(r: &ControlRecord) -> Result<ContentHash, Error> {
        let mut v = serde_json::to_value(r).map_err(|_| Error::Unavailable)?;
        v.as_object_mut().ok_or(Error::Unavailable)?.remove("hash");
        digest(&json!(["quantos-current-kill-control-record/v1", v]))
    }
    fn valid_approval(&self, r: &ControlRecord, generation: u64, at: DateTime<Utc>) -> bool {
        r.action == "approve_release"
            && r.expected_generation == generation
            && r.expires_at > at
            && !self
                .records
                .iter()
                .any(|e| e.action == "release" && e.approval_ref == Some(r.id))
    }
    pub(super) fn has_correlation(&self, id: &str) -> bool {
        self.records
            .iter()
            .any(|r| r.correlation_id.to_string() == id)
    }
    fn event(r: &ControlRecord) -> Value {
        json!({"eventId":r.id,"correlationId":r.correlation_id,"sequence":r.sequence.to_string(),"action":r.action,"scope":if r.global{"global"}else{"account"},"actorId":r.actor,"generation":r.risk.as_ref().map(|v|v.revision).unwrap_or(r.expected_generation).to_string(),"reason":r.reason,"occurredAt":r.at,"expiresAt":r.expires_at,"approvalRef":r.approval_ref,"riskReceiptHash":r.risk.as_ref().map(|v|digest(&json!(v))).transpose().expect("typed receipt"),"recordHash":r.hash,"unknownPreserved":true,"executionAuthority":false})
    }
    fn append(&mut self, mut r: ControlRecord) -> Result<ControlRecord, Error> {
        r.sequence = self.records.len() as u64 + 1;
        r.previous = self.records.last().map(|r| r.hash.clone());
        r.hash = Self::record_hash(&r)?;
        self.records.push(r.clone());
        Ok(r)
    }
}
impl OwnedHost {
    pub(super) fn verify_controls(&self) -> Result<(), Error> {
        if self.controls.records.len() > 4096 {
            return Err(Error::Unavailable);
        }
        let scope = &self
            .subjects
            .values()
            .next()
            .ok_or(Error::Unavailable)?
            .scope;
        let mut ids = std::collections::BTreeSet::new();
        let mut keys = std::collections::BTreeSet::new();
        let mut proofs = std::collections::BTreeSet::new();
        let mut previous = None;
        let mut generation = 0;
        for (i, r) in self.controls.records.iter().enumerate() {
            if r.sequence != i as u64 + 1
                || r.previous != previous
                || r.hash != Controls::record_hash(r)?
                || !ids.insert(r.id)
                || !keys.insert((r.actor, r.key_hash.clone()))
                || !proofs.insert(r.proof.clone())
                || r.expires_at <= r.at
                || r.expires_at - r.at > Duration::seconds(120)
                || r.expected_generation != generation
            {
                return Err(Error::Unavailable);
            }
            if let Some(k) = &r.risk {
                self.sources.verify_kill_receipt(k)?;
                if !matches!(r.action.as_str(), "engage" | "release")
                    || k.revision != generation.checked_add(1).ok_or(Error::Unavailable)?
                    || k.actor_id != r.actor
                    || k.at != r.at
                    || k.reason != r.reason
                    || k.engaged != (r.action == "engage")
                    || k.scope
                        != if r.global {
                            KillScope::Global
                        } else {
                            KillScope::Account(scope.account)
                        }
                {
                    return Err(Error::Unavailable);
                }
                if r.action == "release" {
                    let permit = self.controls.records[..i]
                        .iter()
                        .find(|p| Some(p.id) == r.approval_ref)
                        .ok_or(Error::Unavailable)?;
                    if !self
                        .controls
                        .valid_approval_before(permit, generation, r.at, i)
                        || permit.global != r.global
                        || permit.user == r.user
                    {
                        return Err(Error::Unavailable);
                    }
                }
                generation = k.revision;
            } else if r.action != "approve_release" {
                return Err(Error::Unavailable);
            }
            previous = Some(r.hash.clone());
        }
        let actual = self.sources.kill_status(scope.account)?;
        let (g, a) = self.controls.flags();
        if actual["revision"] != generation || actual["global"] != g || actual["account"] != a {
            return Err(Error::Unavailable);
        }
        let signed = self
            .controls
            .records
            .iter()
            .filter_map(|r| r.risk.as_ref())
            .collect::<Vec<_>>();
        if actual["receipts"] != json!(signed) {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
    pub(super) fn verify_native_anchor(&self) -> Result<(), Error> {
        let n = self.native.control_status()?;
        if let Some(old) = &self.native_anchor {
            // A command may have durably reserved before the BFF died. Accept
            // authenticated additions bound to an existing approval, never a
            // changed or missing reservation protected by the prior anchor.
            let reservations = n["reservations"].as_object().ok_or(Error::Unavailable)?;
            let preserved = if let Some(prior) = old["reservations"].as_object() {
                prior.iter().all(|(k, v)| reservations.get(k) == Some(v))
            } else {
                old["reservationAnchor"] == n["reservationAnchor"]
            };
            if !preserved
                || old["initialized"] == true && n["initialized"] != true
                || old["permanentStop"] == true && n["permanentStop"] != true
            {
                return Err(Error::Unavailable);
            }
        } else if !self.requests.is_empty() && n["initialized"] != true {
            return Err(Error::Unavailable);
        }
        // Verifies each durable reservation against its immutable approval
        // binding; additions are not an authorization to create new commands.
        self.native.audit_facts()?;
        Ok(())
    }
    pub(super) fn sync_native_control(&self) -> Result<(), Error> {
        self.verify_controls()?;
        let (g, a) = self.controls.flags();
        self.native
            .apply_kill_control(self.controls.generation(), g || a)
            .map_err(|_| Error::Unavailable)
    }
    pub(super) fn native_anchor_now(&self) -> Result<Value, Error> {
        let n = self.native.control_status()?;
        Ok(
            json!({"reservations":n["reservations"],"reservationAnchor":n["reservationAnchor"],"initialized":n["initialized"],"permanentStop":n["permanentStop"]}),
        )
    }
    fn control_view(&self, sid: &str, at: DateTime<Utc>) -> Result<Value, Error> {
        let auth = self.service.control_auth(sid, at)?;
        self.sync_native_control()?;
        let n = self.native.control_status()?;
        let scope = &self
            .subjects
            .values()
            .next()
            .ok_or(Error::Unavailable)?
            .scope;
        let (g, a) = self.controls.flags();
        let enabled = self.enabled();
        Ok(
            json!({"schemaVersion":"quantos-current-kill-controls.v1","tenantId":scope.tenant,"workspaceId":scope.workspace,"accountId":scope.account,"mode":"assisted_live","generation":self.controls.generation().to_string(),"globalActive":g,"accountActive":a,"nativeStopped":n["stopped"],"permanentNativeStop":n["permanentStop"],"nativeGeneration":n["generation"].as_u64().ok_or(Error::Unavailable)?.to_string(),"protectedCommands":n["issuedCount"],"unknownCommands":n["unknownCount"],"canEngageAccount":enabled&&matches!(auth.role,Role::Owner|Role::Operator),"canEngageGlobal":enabled&&auth.role==Role::Owner,"canApproveRelease":enabled&&matches!(auth.role,Role::Owner|Role::Approver),"canRelease":enabled&&auth.role==Role::Owner,"history":self.controls.records.iter().skip(self.controls.records.len().saturating_sub(100)).map(Controls::event).collect::<Vec<_>>(),"historyTruncated":self.controls.records.len()>100,"releaseApprovals":self.controls.records.iter().filter(|r|self.controls.valid_approval(r,self.controls.generation(),at)).map(Controls::event).collect::<Vec<_>>(),"checkedAt":at,"expiresAt":at+Duration::seconds(8),"unknownPreserved":true,"executionAuthority":false}),
        )
    }
    pub(super) fn control_audit(&self, all: &mut Vec<Value>) {
        for r in &self.controls.records {
            let prior = all
                .iter()
                .filter(|e| e["correlationId"] == r.correlation_id.to_string())
                .collect::<Vec<_>>();
            let payload = Controls::event(r);
            all.push(json!({"auditRef":r.id,"eventId":r.id,"correlationId":r.correlation_id,"causationId":prior.last().map(|e|e["eventId"].clone()).unwrap_or(json!(r.id)),"sequence":prior.len()+1,"kind":format!("assisted.kill_{}",r.action),"actor":r.actor,"objectRef":format!("kill-control:{}",r.id),"occurredAt":r.at,"route":"/orders","redactionApplied":true,"redactedPayload":payload,"payloadHash":crate::audit_core::payload_hash(&payload),"retentionUntil":r.at+Duration::days(90)}));
        }
    }
}
impl Controls {
    fn valid_approval_before(
        &self,
        p: &ControlRecord,
        g: u64,
        at: DateTime<Utc>,
        end: usize,
    ) -> bool {
        p.action == "approve_release"
            && p.expected_generation == g
            && p.expires_at > at
            && !self.records[..end]
                .iter()
                .any(|r| r.action == "release" && r.approval_ref == Some(p.id))
    }
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str, Error> {
    v[k].as_str().ok_or(Error::Invalid)
}
/// Called only by public current-owner routes, under the stable approval OS lock.
pub(crate) async fn handle(
    data: Arc<Mutex<ProviderData>>,
    headers: HeaderMap,
    method: Method,
    path: &str,
    q: std::collections::BTreeMap<String, String>,
    input: Bytes,
) -> Response {
    if let Err(r) = crate::authenticate(&headers, &data).await {
        return r;
    }
    let sid = crate::cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap_or("")
        .to_owned();
    let mut state = data.lock().await;
    let at = now(state.now());
    if method == Method::GET {
        if !q.is_empty() || !input.is_empty() {
            return fail(Error::Invalid).response();
        }
        return match state
            .assisted
            .as_ref()
            .ok_or(Error::Unavailable)
            .and_then(|h| h.control_view(&sid, at))
        {
            Ok(mut v) => {
                v["expiresAt"] =
                    json!((at + Duration::seconds(8)).min(now(state.session_expires_at)));
                crate::response(StatusCode::OK, v, &crate::correlation_id())
            }
            Err(e) => fail(e).response(),
        };
    }
    let result = (|| -> Result<Value, Error> {
        if !q.is_empty()
            || crate::cookies(&headers).get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN)
        {
            return Err(Error::Unauthorized);
        }
        let body: Value = serde_json::from_slice(&input).map_err(|_| Error::Invalid)?;
        let action = if path.ends_with("/engage") {
            "engage"
        } else if path.ends_with("/release-approvals") {
            "approve_release"
        } else if path.ends_with("/release") {
            "release"
        } else {
            return Err(Error::Invalid);
        };
        if body.as_object().ok_or(Error::Invalid)?.keys().any(|k| {
            ![
                "scope",
                "accountId",
                "expectedGeneration",
                "reason",
                "confirmPhrase",
                "mfaChallengeRef",
                "reauthTokenRef",
                "approvalRef",
            ]
            .contains(&k.as_str())
        }) {
            return Err(Error::Invalid);
        }
        let global = match text(&body, "scope")? {
            "global" => true,
            "account" => false,
            _ => return Err(Error::Invalid),
        };
        let expected = text(&body, "expectedGeneration")?
            .parse::<u64>()
            .map_err(|_| Error::Invalid)?;
        if text(&body, "expectedGeneration")? != expected.to_string() {
            return Err(Error::Invalid);
        }
        let reason = text(&body, "reason")?;
        if reason.trim().is_empty() || reason.len() > 256 || reason.chars().any(char::is_control) {
            return Err(Error::Invalid);
        }
        let phrase = format!(
            "{} {} {}",
            if action == "engage" {
                "ENGAGE"
            } else if action == "release" {
                "RELEASE"
            } else {
                "APPROVE"
            },
            if global { "GLOBAL" } else { "ACCOUNT" },
            if action == "approve_release" {
                "RELEASE"
            } else {
                "KILL"
            }
        );
        if text(&body, "confirmPhrase")? != phrase {
            return Err(Error::Invalid);
        }
        let key = headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty() && v.len() <= 128)
            .ok_or(Error::Invalid)?;
        let challenge = text(&body, "mfaChallengeRef")?;
        let grant = text(&body, "reauthTokenRef")?;
        let proof = format!("{sid}:{grant}");
        let binding = digest(&json!(["quantos-public-kill-intent/v1", action, body]))?;
        let key_hash = ContentHash::sha256_bytes(key.as_bytes());
        let (verified, deadline) = match (
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
                let end = now(c.expires_at)
                    .min(now(g.expires_at))
                    .min(now(c.verified_at.unwrap()) + Duration::seconds(120))
                    .min(now(state.session_expires_at));
                (end > at, end)
            }
            _ => (false, at),
        };
        let already = state.consumed_step_proofs.contains(&proof);
        let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
        if !h.enabled() {
            return Err(Error::Disabled);
        }
        let mut auth = h.service.control_auth(&sid, at)?;
        let scope = &h.subjects.values().next().ok_or(Error::Unavailable)?.scope;
        if global {
            if !body["accountId"].is_null() {
                return Err(Error::Invalid);
            }
        } else if body["accountId"] != scope.account.to_string() {
            return Err(Error::Unauthorized);
        }
        let allowed = match action {
            "engage" => {
                if global {
                    auth.role == Role::Owner
                } else {
                    matches!(auth.role, Role::Owner | Role::Operator)
                }
            }
            "approve_release" => matches!(auth.role, Role::Owner | Role::Approver),
            "release" => auth.role == Role::Owner,
            _ => false,
        };
        if !allowed {
            return Err(Error::Unauthorized);
        }
        if let Some(old) = h
            .controls
            .records
            .iter()
            .find(|r| r.actor == auth.actor_id && r.key_hash == key_hash)
        {
            if old.binding != binding {
                return Err(Error::Conflict);
            }
            if !verified || old.expires_at <= at {
                return Err(Error::Expired);
            }
            return Ok(
                json!({"schemaVersion":"quantos-current-kill-receipt.v1","event":Controls::event(old),"readCurrentState":true,"executionAuthority":false}),
            );
        }
        if !verified || already || h.controls.records.iter().any(|r| r.proof == proof) {
            return Err(Error::Unauthorized);
        }
        h.verify_controls()?;
        if h.controls.generation() != expected {
            return Err(Error::Conflict);
        }
        if h.controls.records.len() >= 4096 {
            return Err(Error::Unavailable);
        }
        let (g, a) = h.controls.flags();
        let active = if global { g } else { a };
        if action == "engage" && active || action != "engage" && !active {
            return Err(Error::Conflict);
        }
        let approval_ref = body
            .get("approvalRef")
            .filter(|v| !v.is_null())
            .map(|v| Uuid::parse_str(v.as_str().ok_or(Error::Invalid)?).map_err(|_| Error::Invalid))
            .transpose()?;
        if action != "release" && approval_ref.is_some() {
            return Err(Error::Invalid);
        }
        if action == "release" {
            let p = h
                .controls
                .records
                .iter()
                .find(|r| Some(r.id) == approval_ref)
                .ok_or(Error::Unauthorized)?;
            if !h.controls.valid_approval(p, expected, at)
                || p.global != global
                || p.user == auth.user_id
            {
                return Err(Error::Unauthorized);
            }
        }
        if action == "approve_release"
            && h.controls.records.iter().any(|r| {
                r.global == global
                    && r.user == auth.user_id
                    && h.controls.valid_approval(r, expected, at)
            })
        {
            return Err(Error::Conflict);
        }
        if action == "approve_release"
            && h.controls
                .records
                .iter()
                .filter(|r| h.controls.valid_approval(r, expected, at))
                .count()
                >= 100
        {
            return Err(Error::Unavailable);
        }
        let correlation = if action == "engage" {
            Uuid::now_v7()
        } else {
            h.controls
                .records
                .iter()
                .rev()
                .find(|r| r.global == global && r.action == "engage")
                .ok_or(Error::Unavailable)?
                .correlation_id
        };
        let account = scope.account;
        let risk = if action == "approve_release" {
            None
        } else {
            if global {
                auth.account_id = None;
            }
            Some(
                h.sources
                    .set_kill_switch(
                        &auth,
                        if global {
                            KillScope::Global
                        } else {
                            KillScope::Account(account)
                        },
                        action == "engage",
                        expected,
                        reason,
                        at,
                    )
                    .map_err(|e| match e {
                        quantos_risk::guard::GuardError::Conflict => Error::Conflict,
                        _ => Error::Unavailable,
                    })?,
            )
        };
        let r = h.controls.append(ControlRecord {
            sequence: 0,
            id: Uuid::now_v7(),
            correlation_id: correlation,
            action: action.into(),
            global,
            actor: auth.actor_id,
            user: auth.user_id,
            session: sid.clone(),
            key_hash,
            binding,
            proof: proof.clone(),
            reason: reason.into(),
            expected_generation: expected,
            at,
            expires_at: deadline,
            approval_ref,
            risk,
            previous: None,
            hash: ContentHash::sha256_bytes(b"pending typed record"),
        })?;
        if h.durable.is_none() {
            h.sync_native_control()?;
        }
        state.consumed_step_proofs.insert(proof);
        Ok(
            json!({"schemaVersion":"quantos-current-kill-receipt.v1","event":Controls::event(&r),"readCurrentState":true,"executionAuthority":false}),
        )
    })();
    match result {
        Ok(v) => crate::response(StatusCode::OK, v, &crate::correlation_id()),
        Err(e) => fail(e).response(),
    }
}
pub(super) fn routes() -> Router<Arc<Mutex<ProviderData>>> {
    Router::new()
        .route("/v1/risk/kill-switch", get(read_handle))
        .route("/v1/risk/kill-switch/release-approvals", post(read_handle))
}
async fn read_handle(
    State(data): State<Arc<Mutex<ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    axum::extract::Query(q): axum::extract::Query<std::collections::BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    input: Bytes,
) -> Response {
    handle(data, headers, method, uri.path(), q, input).await
}

#[cfg(test)]
mod tests;
