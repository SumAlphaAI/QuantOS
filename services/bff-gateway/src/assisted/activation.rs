//! Current C11 projection for one immutable execution domain. The initial owned
//! owner configuration is an explicit version-zero import, never target approval.
//! Public updates and C10 origins share the authenticated approvals transaction.
use super::*;
use quantos_execution::assisted_activation::RuntimeActivation;
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Activation {
    scope: Scope,
    ceiling: bool,
    created_at: DateTime<Utc>,
    ceiling_expires_at: DateTime<Utc>,
    records: Vec<Record>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Record {
    version: u64,
    event_id: Uuid,
    enabled: bool,
    at: DateTime<Utc>,
    valid_until: DateTime<Utc>,
    source: String,
    actor: Option<quantos_core::ActorId>,
    session: Option<String>,
    key_hash: Option<ContentHash>,
    binding: Option<ContentHash>,
    proof: Option<String>,
    proof_deadline: DateTime<Utc>,
    reason: String,
    previous: Option<ContentHash>,
    hash: ContentHash,
}
fn digest(v: &Value) -> Result<ContentHash, Error> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(v).map_err(|_| Error::Unavailable)?,
    ))
}
impl Activation {
    pub(super) fn new(
        scope: Scope,
        ceiling: bool,
        at: DateTime<Utc>,
        expiry: DateTime<Utc>,
    ) -> Result<Self, Error> {
        let mut s = Self {
            scope,
            ceiling,
            created_at: at,
            ceiling_expires_at: expiry,
            records: vec![],
        };
        let mut r = Record {
            version: 0,
            event_id: persistence::event_id(&format!("c11-owned-genesis:{}:{at}", s.id())),
            enabled: ceiling,
            at,
            valid_until: expiry,
            source: "owner_reference_bootstrap".into(),
            actor: None,
            session: None,
            key_hash: None,
            binding: None,
            proof: None,
            proof_deadline: at,
            reason: "Imported bounded owned owner configuration; not target admission".into(),
            previous: None,
            hash: ContentHash::sha256_bytes(b"pending"),
        };
        r.hash = s.hash(&r)?;
        s.records.push(r);
        Ok(s)
    }
    pub(super) fn id(&self) -> Uuid {
        persistence::event_id(&format!(
            "quantos-c11-current-activation/v1:{}:{}:{}:assisted_live",
            self.scope.tenant, self.scope.workspace, self.scope.account
        ))
    }
    fn hash(&self, r: &Record) -> Result<ContentHash, Error> {
        let mut v = json!(r);
        v.as_object_mut().ok_or(Error::Unavailable)?.remove("hash");
        digest(&json!([
            "quantos-current-c11-activation-record/v1",
            self.scope,
            v
        ]))
    }
    fn last(&self) -> Result<&Record, Error> {
        self.records.last().ok_or(Error::Unavailable)
    }
    pub(super) fn lease(&self) -> Result<RuntimeActivation, Error> {
        let r = self.last()?;
        Ok(RuntimeActivation {
            version: r.version,
            enabled: self.ceiling && r.enabled,
            valid_from: r.at,
            valid_until: r.valid_until,
            head: r.hash.clone(),
        })
    }
    pub(super) fn effective(&self, at: DateTime<Utc>) -> bool {
        self.ceiling && self.lease().is_ok_and(|a| a.effective(at))
    }
    pub(super) fn verify(&self, expected: &Self) -> Result<(), Error> {
        if self.scope != expected.scope
            || self.ceiling != expected.ceiling
            || self.created_at != expected.created_at
            || self.ceiling_expires_at != expected.ceiling_expires_at
            || self.records.is_empty()
            || self.records.len() > 4096
            || json!(self.records[0]) != json!(expected.records[0])
        {
            return Err(Error::Unavailable);
        }
        let mut previous = None;
        let mut keys = std::collections::BTreeSet::new();
        let mut proofs = std::collections::BTreeSet::new();
        for (i, r) in self.records.iter().enumerate() {
            if r.version != i as u64
                || r.previous != previous
                || r.hash != self.hash(r)?
                || r.at < self.created_at
                || r.valid_until <= r.at
                || r.valid_until > self.ceiling_expires_at
                || r.enabled && !self.ceiling
            {
                return Err(Error::Unavailable);
            }
            if i > 0
                && (r.source != "public_c11"
                    || r.actor.is_none()
                    || r.session.is_none()
                    || r.binding.is_none()
                    || r.proof.is_none()
                    || r.key_hash.is_none()
                    || r.proof_deadline <= r.at
                    || r.proof_deadline - r.at > Duration::seconds(120)
                    || r.valid_until - r.at > Duration::minutes(10)
                    || r.at < self.records[i - 1].at
                    || !keys.insert((r.actor, r.key_hash.clone()))
                    || !proofs.insert(r.proof.clone()))
            {
                return Err(Error::Unavailable);
            }
            previous = Some(r.hash.clone());
        }
        Ok(())
    }
    fn event(&self, r: &Record) -> Value {
        json!({"resourceId":self.id(),"eventId":r.event_id,"correlationId":self.id(),"version":r.version.to_string(),"enabled":r.enabled,"validFrom":r.at,"validUntil":r.valid_until,"source":r.source,"actorId":r.actor,"reason":r.reason,"previous":r.previous,"recordHash":r.hash,"unknownPreserved":true,"executionAuthority":false})
    }
}
impl OwnedHost {
    pub(super) fn verify_activation(&self) -> Result<(), Error> {
        self.activation.verify(&self.activation_origin)
    }
    pub(super) fn sync_activation(&self) -> Result<(), Error> {
        self.verify_activation()?;
        let a = self.activation.lease()?;
        self.service
            .apply_runtime_activation(a.clone())
            .map_err(|_| Error::Unavailable)?;
        self.native
            .apply_runtime_activation(a)
            .map_err(|_| Error::Unavailable)
    }
    pub(super) fn activation_audit(&self, all: &mut Vec<Value>) {
        for r in &self.activation.records {
            let payload = self.activation.event(r);
            all.push(json!({"auditRef":r.event_id,"eventId":r.event_id,"correlationId":self.activation.id(),"causationId":if r.version==0{r.event_id}else{self.activation.records[r.version as usize-1].event_id},"sequence":r.version+1,"kind":if r.version==0{"assisted.activation_bootstrap"}else{"assisted.activation_changed"},"actor":r.actor.map(|a|a.to_string()).unwrap_or_else(||"owned-c11-bootstrap".into()),"objectRef":format!("activation:{}",self.activation.id()),"occurredAt":r.at,"route":"/admin/flags","redactionApplied":true,"redactedPayload":payload,"payloadHash":crate::audit_core::payload_hash(&payload),"retentionUntil":self.activation.created_at+Duration::days(90)}));
        }
    }
    fn activation_view(
        &self,
        sid: &str,
        at: DateTime<Utc>,
        session_expiry: DateTime<Utc>,
    ) -> Result<Value, Error> {
        let auth = self.service.control_auth(sid, at)?;
        self.verify_activation()?;
        let a = &self.activation;
        let n = self.native.control_status()?;
        let r = a.last()?;
        if n["activation"] != json!(a.lease()?) {
            return Err(Error::Unavailable);
        }
        let effective = a.effective(at);
        let stopped = n["stopped"].as_bool().ok_or(Error::Unavailable)?;
        Ok(
            json!({"schemaVersion":"quantos-current-c11-activation.v1","resourceId":a.id(),"tenantId":a.scope.tenant,"workspaceId":a.scope.workspace,"accountId":a.scope.account,"mode":"assisted_live","featureKey":"execution.assisted-testnet","version":r.version.to_string(),"enabled":r.enabled,"effective":effective,"targetPermitted":a.ceiling,"validFrom":r.at,"validUntil":r.valid_until,"ceilingExpiresAt":a.ceiling_expires_at,"source":r.source,"head":r.hash,"canWrite":auth.role==Role::Owner,"nativeActivationVersion":r.version.to_string(),"nativeActivationEffective":effective,"nativeStopped":stopped,"runtimeWritable":effective&&!stopped,"killGeneration":n["generation"].as_u64().ok_or(Error::Unavailable)?.to_string(),"unknownCommands":n["unknownCount"],"historyCount":a.records.len(),"checkedAt":at,"expiresAt":session_expiry.min(at+Duration::seconds(8)),"unknownPreserved":true,"executionAuthority":false}),
        )
    }
}
/// Existing public C11 owner routes dispatch here before any Paper/Shadow seed.
pub(crate) async fn handle(
    data: Arc<Mutex<ProviderData>>,
    headers: HeaderMap,
    method: Method,
    path: &str,
    q: BTreeMap<String, String>,
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
    let session_expiry = now(state.session_expires_at);
    let result = (|| -> Result<Value, Error> {
        let h = state.assisted.as_ref().ok_or(Error::Unavailable)?;
        if h.durable.is_none() {
            h.sync_activation()?;
        }
        h.service.control_auth(&sid, at)?;
        let a = &h.activation;
        let collection = "/v1/admin/feature-flags";
        let resource = format!("{collection}/{}", a.id());
        let history = format!("{resource}/history");
        if method == Method::GET {
            if !input.is_empty() {
                return Err(Error::Invalid);
            }
            if path == history {
                if q.keys()
                    .any(|k| !["pageSize", "cursor"].contains(&k.as_str()))
                {
                    return Err(Error::Invalid);
                }
                let size = q
                    .get("pageSize")
                    .map(|v| v.parse::<usize>().map_err(|_| Error::Invalid))
                    .transpose()?
                    .unwrap_or(100);
                if !(1..=100).contains(&size) {
                    return Err(Error::Invalid);
                }
                let offset = if let Some(cursor) = q.get("cursor") {
                    let r = a
                        .records
                        .iter()
                        .find(|r| format!("{}:{}", r.version, r.hash) == *cursor)
                        .ok_or(Error::Invalid)?;
                    r.version as usize + 1
                } else {
                    0
                };
                let items = a
                    .records
                    .iter()
                    .skip(offset)
                    .take(size)
                    .map(|r| a.event(r))
                    .collect::<Vec<_>>();
                let last = offset + items.len();
                let next = if last < a.records.len() {
                    let r = &a.records[last - 1];
                    Some(format!("{}:{}", r.version, r.hash))
                } else {
                    None
                };
                return Ok(
                    json!({"resourceId":a.id(),"version":a.last()?.version.to_string(),"totalCount":a.records.len(),"items":items,"nextCursor":next,"executionAuthority":false}),
                );
            }
            if !q.is_empty() {
                return Err(Error::Invalid);
            }
            let view = h.activation_view(&sid, at, session_expiry)?;
            return if path == collection {
                Ok(
                    json!({"items":[view],"configVersion":a.last()?.version.to_string(),"nextCursor":null}),
                )
            } else if path == resource {
                Ok(view)
            } else {
                Err(Error::Unauthorized)
            };
        }
        if method != Method::PUT || path != resource || !q.is_empty() {
            return Err(Error::Unauthorized);
        }
        if crate::cookies(&headers).get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN)
        {
            return Err(Error::Unauthorized);
        }
        let b: Value = serde_json::from_slice(&input).map_err(|_| Error::Invalid)?;
        if b.as_object().is_none_or(|b| {
            b.keys().any(|k| {
                ![
                    "scope",
                    "enabled",
                    "validUntil",
                    "reason",
                    "confirmPhrase",
                    "mfaChallengeRef",
                    "reauthTokenRef",
                ]
                .contains(&k.as_str())
            })
        }) {
            return Err(Error::Invalid);
        }
        if b["scope"]
            != json!({"tenantId":a.scope.tenant,"workspaceId":a.scope.workspace,"accountId":a.scope.account,"mode":"assisted_live","featureKey":"execution.assisted-testnet"})
        {
            return Err(Error::Unauthorized);
        }
        let auth = h.service.control_auth(&sid, at)?;
        if auth.role != Role::Owner {
            return Err(Error::Unauthorized);
        }
        let enabled = b["enabled"].as_bool().ok_or(Error::Invalid)?;
        if enabled && !a.ceiling {
            return Err(Error::Disabled);
        }
        let reason = b["reason"]
            .as_str()
            .filter(|r| !r.trim().is_empty() && r.len() <= 256 && !r.chars().any(char::is_control))
            .ok_or(Error::Invalid)?;
        if b["confirmPhrase"]
            != if enabled {
                json!("ENABLE ASSISTED TESTNET")
            } else {
                json!("DISABLE ASSISTED TESTNET")
            }
        {
            return Err(Error::Invalid);
        }
        let until = now(
            serde_json::from_value::<DateTime<Utc>>(b["validUntil"].clone())
                .map_err(|_| Error::Invalid)?,
        );
        let version = headers
            .get("if-match")
            .and_then(|v| v.to_str().ok())
            .ok_or(Error::Conflict)?;
        let expected = version.parse::<u64>().map_err(|_| Error::Invalid)?;
        if version != expected.to_string() {
            return Err(Error::Invalid);
        }
        let key = headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .filter(|s| Uuid::parse_str(s).is_ok())
            .ok_or(Error::Invalid)?;
        let key_hash = ContentHash::sha256_bytes(key.as_bytes());
        let binding = digest(&json!([
            "quantos-c11-activation-intent/v1",
            version,
            path,
            b
        ]))?;
        let challenge = b["mfaChallengeRef"].as_str().ok_or(Error::Invalid)?;
        let grant = b["reauthTokenRef"].as_str().ok_or(Error::Invalid)?;
        let proof = format!("{sid}:{grant}");
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
                    .min(session_expiry)
            }
            _ => return Err(Error::Unauthorized),
        };
        if let Some(old) = a
            .records
            .iter()
            .find(|r| r.actor == Some(auth.actor_id) && r.key_hash.as_ref() == Some(&key_hash))
        {
            if old.binding.as_ref() != Some(&binding) {
                return Err(Error::Conflict);
            }
            if deadline <= at || old.proof_deadline <= at {
                return Err(Error::Expired);
            }
            return Ok(
                json!({"schemaVersion":"quantos-current-c11-activation-receipt.v1","event":a.event(old),"readCurrentState":true,"executionAuthority":false}),
            );
        }
        if deadline <= at
            || state.consumed_step_proofs.contains(&proof)
            || a.records.iter().any(|r| r.proof.as_deref() == Some(&proof))
        {
            return Err(Error::Unauthorized);
        }
        if a.last()?.version != expected {
            return Err(Error::Conflict);
        }
        if at < a.last()?.at {
            return Err(Error::Expired);
        }
        if until <= at
            || until > at + Duration::minutes(10)
            || until > a.ceiling_expires_at
            || until > session_expiry
        {
            return Err(Error::Invalid);
        }
        if a.records.len() >= 4096 {
            return Err(Error::Unavailable);
        }
        let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
        let a = &mut h.activation;
        let mut r = Record {
            version: expected.checked_add(1).ok_or(Error::Unavailable)?,
            event_id: Uuid::now_v7(),
            enabled,
            at,
            valid_until: until,
            source: "public_c11".into(),
            actor: Some(auth.actor_id),
            session: Some(sid.clone()),
            key_hash: Some(key_hash),
            binding: Some(binding),
            proof: Some(proof.clone()),
            proof_deadline: deadline,
            reason: reason.into(),
            previous: Some(a.last()?.hash.clone()),
            hash: ContentHash::sha256_bytes(b"pending"),
        };
        r.hash = a.hash(&r)?;
        a.records.push(r.clone());
        let event = a.event(&r);
        if h.durable.is_none() {
            h.sync_activation()?;
        }
        state.consumed_step_proofs.insert(proof);
        Ok(
            json!({"schemaVersion":"quantos-current-c11-activation-receipt.v1","event":event,"readCurrentState":true,"executionAuthority":false}),
        )
    })();
    match result {
        Ok(v) => crate::response(StatusCode::OK, v, &crate::correlation_id()),
        Err(e) => fail(e).response(),
    }
}
async fn history_handle(
    State(data): State<Arc<Mutex<ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    axum::extract::Query(q): axum::extract::Query<BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    input: Bytes,
) -> Response {
    handle(data, headers, method, uri.path(), q, input).await
}
pub(super) fn routes() -> Router<Arc<Mutex<ProviderData>>> {
    Router::new().route(
        "/v1/admin/feature-flags/:resourceId/history",
        get(history_handle),
    )
}

#[cfg(test)]
mod tests;
