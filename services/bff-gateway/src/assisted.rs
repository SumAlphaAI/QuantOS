//! CORE:L03 public reference composition. The reusable native authority lives in
//! quantos-execution; this explicit loopback profile owns synthetic C01/F06 and
//! L01 IO ports. Live startup never mounts it or grants Assisted Live capability.
use crate::{ProviderData, research::Fault};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    AccountId, ContentHash, ProposalId, TenantId, WorkspaceId, canonical_json_bytes,
};
use quantos_execution::{
    assisted::*,
    assisted_execution::*,
    gateway::{BoundaryCommand, ExecutionKernel, GatewayLimits, KernelEvent},
    venue::VenueConfig,
    venue_protocol::*,
};
use quantos_policy::{Capability, Role, RunMode};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
fn fail(e: Error) -> Fault {
    match e {
        Error::Invalid => Fault::invalid(),
        Error::Conflict | Error::PolicyChanged | Error::Expired => {
            Fault(StatusCode::CONFLICT, "STATE_CONFLICT")
        }
        Error::Unavailable => Fault::unavailable(),
        _ => Fault(StatusCode::FORBIDDEN, "FORBIDDEN"),
    }
}
fn now(t: DateTime<Utc>) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(t.timestamp_millis()).expect("current time")
}
fn key() -> [u8; 32] {
    let mut b = [0; 32];
    b[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    b[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    b
}
fn hashed(s: &Subject) -> ContentHash {
    ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(s).expect("subject"))
            .expect("canonical subject"),
    )
}
/// No network implementation: reply is owned synthetic venue bytes, parsed by
/// the real ProtocolKernel and mapped into the real X04 GatewayOrder schema.
struct OwnedPort {
    sequence: u64,
}
impl ProtocolPort for OwnedPort {
    fn exchange(
        &mut self,
        r: &Request,
    ) -> Result<quantos_execution::venue_protocol::Response, TransportFault> {
        if r.method != "POST" || r.path != "/api/v3/order" {
            return Err(TransportFault::Disconnected);
        }
        self.sequence += 1;
        let p = &r.params;
        Ok(quantos_execution::venue_protocol::Response{status:200,retry_after_seconds:None,body:serde_json::to_vec(&json!({"symbol":p["symbol"],"orderId":self.sequence,"clientOrderId":p["newClientOrderId"],"transactTime":p["timestamp"].parse::<i64>().unwrap_or(0),"price":p["price"],"origQty":p["quantity"],"executedQty":"0","cummulativeQuoteQty":"0","status":"NEW","timeInForce":"GTC","type":"LIMIT","side":p["side"],"fills":[]})).expect("owned reply")})
    }
}
enum HostKernel {
    Owned(Box<ProtocolKernel<OwnedPort>>),
    Restricted(Box<execution_gateway::restricted_zone::ZoneExecutionKernel>),
}
impl ExecutionKernel for HostKernel {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.submit_at(c, Utc::now())
    }
    fn submit_at(&mut self, c: &BoundaryCommand, at: DateTime<Utc>) -> Result<(), String> {
        match self {
            Self::Owned(k) => k.submit_at(c, at),
            Self::Restricted(k) => k.submit_at(c, at),
        }
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        match self {
            Self::Owned(k) => k.drain_events(),
            Self::Restricted(k) => k.drain_events(),
        }
    }
}
/// Explicit local owner configuration, never deserialized from an HTTP request.
pub struct RestrictedReference {
    pub current_review_execution_enabled: bool,
    pub observer_certificate: Option<(Vec<u8>, String)>,
    pub directory: std::path::PathBuf,
    pub kernel: execution_gateway::restricted_zone::ZoneExecutionKernel,
    pub keys: [[u8; 32]; 4],
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub enabled: bool,
}
#[derive(serde::Serialize, serde::Deserialize)]
struct Replay {
    binding: Value,
    proof: StepUpProof,
}
pub(crate) struct OwnedHost {
    service: AssistedApprovalService,
    sources: quantos_execution::assisted_source::CurrentSubjectSource,
    mfa: MfaAttestor,
    native: AssistedExecution<HostKernel>,
    durable: Option<Arc<quantos_execution::durable::DurableStore>>,
    persisted: Option<Value>,
    ledger: Option<quantos_portfolio::native_ledger::NativeLedger>,
    ledger_store: Option<quantos_execution::durable::DurableStore>,
    ledger_anchor: quantos_portfolio::native_ledger::Anchor,
    valuation: quantos_portfolio::native_valuation::State,
    valuation_committed: quantos_portfolio::native_valuation::State,
    current_review_execution_enabled: bool,
    risk_refreshes: BTreeMap<(String, String), Value>,
    valuation_input: Option<quantos_execution::durable::DurableStore>,
    controls: control::Controls,
    activation: activation::Activation,
    activation_origin: activation::Activation,
    native_anchor: Option<Value>,
    control_fixture_directory: Option<std::path::PathBuf>,
    alert_inbox: Option<alerts::Inbox>,
    alert_store: Option<quantos_execution::durable::DurableStore>,
    alert_anchor: quantos_portfolio::native_ledger::Anchor,
    observer: Option<reconciliation::ObserverReader>,
    reconciliation: Option<quantos_reconcile::current::CurrentReconciliation>,
    reconciliation_store: Option<quantos_execution::durable::DurableStore>,
    reconciliation_anchor: quantos_portfolio::native_ledger::Anchor,
    book_input_fence: Option<quantos_execution::durable::DurableStore>,
    financial_reviews: quantos_reconcile::financial_review::Journal,
    subjects: BTreeMap<ProposalId, Subject>,
    requests: BTreeMap<ProposalId, ProposalId>,
    opened_at: BTreeMap<ProposalId, DateTime<Utc>>,
    open_keys: BTreeMap<(String, String), ProposalId>,
    proofs: BTreeMap<(String, String), Replay>,
}
impl std::fmt::Debug for OwnedHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("OwnedAssistedHost(REDACTED)")
    }
}
impl OwnedHost {
    pub(crate) fn enabled(&self) -> bool {
        self.service.reachable().unwrap_or(false)
    }
    pub(crate) fn new(enabled: bool, at: DateTime<Utc>, expiry: DateTime<Utc>) -> Self {
        Self::configured(enabled, at, expiry, [key(), key(), key()], None).expect("owned host")
    }
    fn configured(
        enabled: bool,
        at: DateTime<Utc>,
        expiry: DateTime<Utc>,
        keys: [[u8; 32]; 3],
        restricted: Option<HostKernel>,
    ) -> Result<Self, Error> {
        let at = now(at);
        let scope = Scope {
            tenant: TenantId::parse_str("22222222-2222-4222-8222-222222222222").unwrap(),
            workspace: WorkspaceId::parse_str("33333333-3333-4333-8333-333333333333").unwrap(),
            account: AccountId::parse_str("44444444-4444-4444-8444-444444444444").unwrap(),
        };
        let mfa_key = keys[0];
        let service = AssistedApprovalService::new(
            scope.clone(),
            Policy {
                enabled,
                ..Policy::default()
            },
            mfa_key,
            keys[1],
            at,
        )
        .unwrap();
        for name in ["session-current", "session-approver", "session-owner"] {
            let role = match name {
                "session-current" => Role::Operator,
                "session-approver" => Role::Approver,
                _ => Role::Owner,
            };
            let actor = crate::execution::reference_actor(name);
            let mut caps = vec![ASSISTED_CAPABILITY, Capability::EXECUTION_OPERATE];
            if role != Role::Operator {
                caps.push(Capability::STRATEGY_APPROVE)
            }
            service
                .register_session(
                    name.into(),
                    Session {
                        auth: AuthContext {
                            tenant_id: scope.tenant,
                            workspace_id: scope.workspace,
                            account_id: Some(scope.account),
                            actor_id: actor,
                            user_id: *actor.as_uuid(),
                            workspace_slug: "reference".into(),
                            workspace_name: "reference".into(),
                            role,
                            mode: RunMode::AssistedLive,
                            capabilities: caps
                                .into_iter()
                                .map(|s| Capability::parse(s).unwrap())
                                .collect(),
                        },
                        revision: 1,
                        issued_at: at,
                        expires_at: expiry,
                        active: true,
                    },
                )
                .unwrap();
        }
        let rules = SymbolRules {
            symbol: "BTCUSDT".into(),
            price_tick: rust_decimal::Decimal::new(1, 2),
            quantity_step: rust_decimal::Decimal::new(1, 4),
            min_quantity: rust_decimal::Decimal::new(1, 4),
            max_quantity: 1000.into(),
            min_price: 1.into(),
            max_price: 1_000_000.into(),
            min_notional: 5.into(),
            observed_at: at - Duration::seconds(1),
            expires_at: at + Duration::hours(1),
            source_hash: ContentHash::sha256_bytes(b"owned instrument projection not exchangeInfo"),
        };
        let mut venue = VenueConfig::approved_testnet();
        venue.rate_limit_per_second = 1000;
        let kernel = ProtocolKernel::new(venue, rules, OwnedPort { sequence: 0 }).unwrap();
        let native = AssistedExecution::new(
            service.clone(),
            GatewayLimits {
                max_quantity: 1000.into(),
                max_notional: 50000.into(),
                allowed_venues: vec![EXECUTION_VENUE.into()],
            },
            restricted.unwrap_or(HostKernel::Owned(Box::new(kernel))),
            keys[2],
        )
        .unwrap();
        let (sources, subjects) = source_seed::current(&service, &scope, keys[2], at, expiry)?;
        let activation = activation::Activation::new(scope, enabled, at, expiry)?;
        service.apply_runtime_activation(activation.lease()?)?;
        Ok(Self {
            activation: activation.clone(),
            activation_origin: activation,
            service,
            sources,
            durable: None,
            persisted: None,
            ledger: None,
            ledger_store: None,
            ledger_anchor: Default::default(),
            valuation: Default::default(),
            valuation_committed: Default::default(),
            valuation_input: None,
            current_review_execution_enabled: false,
            risk_refreshes: Default::default(),
            controls: Default::default(),
            native_anchor: None,
            control_fixture_directory: None,
            alert_inbox: None,
            alert_store: None,
            alert_anchor: Default::default(),
            observer: None,
            reconciliation: None,
            reconciliation_store: None,
            reconciliation_anchor: Default::default(),
            book_input_fence: None,
            financial_reviews: Default::default(),
            mfa: MfaAttestor::new(mfa_key).unwrap(),
            native,
            subjects,
            requests: BTreeMap::new(),
            opened_at: BTreeMap::new(),
            open_keys: BTreeMap::new(),
            proofs: BTreeMap::new(),
        })
    }
    fn subject(&self, id: ProposalId) -> Result<Value, Error> {
        let s = self.subjects.get(&id).ok_or(Error::Invalid)?;
        let mut v = json!({"subjectId":id,"subjectHash":hashed(s),"proposalHash":s.proposal_hash,"decisionId":s.decision,"originator":s.originator,"accountId":s.scope.account,"symbol":s.symbol,"side":s.side,"quantity":s.quantity,"limitPrice":s.limit_price,"expiresAt":s.expires_at});
        if let Some(binding) = self.sources.native_risk_binding(id)? {
            v["nativeRiskBinding"] = binding;
        }
        Ok(v)
    }

    fn receipt(&self, r: &Receipt) -> Value {
        json!({"requestId":r.request,"requesterId":r.requester,"subjectId":self.requests.get(&r.request),"subjectHash":r.subject_hash,"policyVersion":r.policy_revision.to_string(),"revision":r.revision,"status":r.status,"approvers":r.approvers,"expiresAt":r.expires_at,"notional":r.notional,"executionAuthority":false})
    }
    fn view(&mut self, session: &str, id: ProposalId, at: DateTime<Utc>) -> Result<Value, Error> {
        let r = self.service.execution_view(session, id, at)?;
        self.sync_ledger(session, at)?;
        let mut v = json!({"request":self.receipt(&r),"subject":self.subject(*self.requests.get(&id).ok_or(Error::Invalid)?)?});
        if let Some(c) = self.native.inspect(session, id, at)? {
            let command_id = c.command_id;
            v["command"] = command(c);
            if let Some(f) = self.native.execution_facts(session, id, at)? {
                v["facts"] = serde_json::to_value(f).map_err(|_| Error::Unavailable)?;
            }
            if let Some(receipt) = self.ledger.as_ref().and_then(|l| l.receipt(command_id)) {
                v["ledger"] = serde_json::to_value(receipt).map_err(|_| Error::Unavailable)?;
            }
        }
        Ok(v)
    }
}
fn command(c: CommandReceipt) -> Value {
    let mut v = json!({"requestId":c.request_id,"subjectHash":c.subject_hash,"commandId":c.command_id,"expiresAt":c.expires_at,"state":c.state,"signature":c.signature});
    if let Some(b) = c.current_risk {
        v["currentRisk"] = json!(b);
    }
    if let Some(o) = c.order {
        v["order"] = json!({"orderId":o.order_id,"commandId":o.command_id,"accountId":o.account_id,"symbol":o.symbol,"side":o.side,"quantity":o.quantity,"filledQuantity":o.filled_quantity,"status":o.status});
    }
    v
}
pub(crate) fn routes() -> Router<Arc<Mutex<ProviderData>>> {
    Router::new()
        .merge(control::routes())
        .merge(activation::routes())
        .route("/v1/assisted-testnet/capabilities", get(handle))
        .route("/v1/assisted-testnet/subjects", get(handle))
        .route("/v1/assisted-testnet/risk-review-candidates", get(handle))
        .route(
            "/v1/assisted-testnet/subjects/:subjectId/risk-reviews",
            post(handle),
        )
        .route("/v1/assisted-testnet/ledger", get(handle))
        .route("/v1/assisted-testnet/valuation", get(handle))
        .route("/v1/assisted-testnet/reconciliation", get(handle))
        .route(
            "/v1/assisted-testnet/financial-reviews",
            get(financial_review::handle).post(financial_review::handle),
        )
        .route(
            "/v1/assisted-testnet/financial-reviews/:caseId/endorse",
            post(financial_review::handle),
        )
        .route(
            "/v1/assisted-testnet/financial-reviews/:caseId/authorize",
            post(financial_review::handle),
        )
        .route(
            "/v1/assisted-testnet/financial-reviews/:caseId/retain-block",
            post(financial_review::handle),
        )
        .route("/v1/assisted-testnet/requests", get(handle).post(handle))
        .route("/v1/assisted-testnet/requests/:requestId", get(handle))
        .route(
            "/v1/assisted-testnet/requests/:requestId/approvals",
            post(handle),
        )
        .route(
            "/v1/assisted-testnet/requests/:requestId/commands",
            post(handle),
        )
        .route(
            "/v1/assisted-testnet/requests/:requestId/audit",
            get(handle),
        )
}
pub(crate) async fn guard(
    headers: &HeaderMap,
    data: &Arc<Mutex<ProviderData>>,
) -> Result<(), Response> {
    crate::authenticate(headers, data).await?;
    let s = data.lock().await;
    if !s
        .assisted
        .as_ref()
        .is_some_and(|h| h.service.reachable().unwrap_or(false))
    {
        return Err(fail(Error::Disabled).response());
    }
    Ok(())
}
async fn handle(
    State(data): State<Arc<Mutex<ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    headers: HeaderMap,
    input: Bytes,
) -> Response {
    if let Err(e) = crate::authenticate(&headers, &data).await {
        return e;
    }
    let sid = crate::cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap_or("")
        .to_owned();
    let mut state = data.lock().await;
    let at = now(state.now());
    if let Some(h) = state.assisted.as_ref()
        && let Err(e) = h.sync_activation()
    {
        return fail(e).response();
    }
    let capabilities = crate::session_payload(&headers, state.session_expires_at);
    let expiry = state.session_expires_at;
    if uri.path().ends_with("/capabilities") {
        let enabled = state
            .assisted
            .as_ref()
            .is_some_and(|h| h.activation.effective(at));
        let permission = state
            .assisted
            .as_ref()
            .and_then(|h| h.service.capabilities(&sid, at).ok())
            .unwrap_or(json!({"request":false,"approve":false}));
        return crate::response(
            StatusCode::OK,
            json!({"currentReviewExecutionEnabled":state.assisted.as_ref().is_some_and(|h|h.current_review_execution_enabled),"currentRiskReviewOnly":state.assisted.as_ref().is_some_and(|h|!h.risk_refreshes.is_empty()),"nativeRiskReviewEnabled":state.assisted.as_ref().is_some_and(|h|h.valuation_input.is_some()),"reconciliationReaderEnabled":state.assisted.is_some(),"schemaVersion":"quantos-assisted-testnet-capabilities.v1","actorId":capabilities["actorId"],"tenantId":capabilities["tenantId"],"workspaceId":capabilities["workspaceId"],"accountId":capabilities["accountId"],"mode":if state.assisted.is_some(){"assisted_live"}else if state.reference_shadow{"shadow"}else{"paper"},"serverFlagEnabled":enabled,"targetEnabled":state.assisted.as_ref().is_some_and(|h|h.enabled()),"activationVersion":state.assisted.as_ref().and_then(|h|h.activation.lease().ok()).map(|a|a.version.to_string()),"activationExpiresAt":state.assisted.as_ref().and_then(|h|h.activation.lease().ok()).map(|a|a.valid_until),"canRequest":permission["request"],"canApprove":permission["approve"],"executionAuthority":false,"policyVersion":"core-l03-local.v1","policyRevision":permission["policyRevision"].as_u64().unwrap_or(1),"checkedAt":at,"expiresAt":expiry.min(at+Duration::seconds(8))}),
            &crate::correlation_id(),
        );
    }
    if !state
        .assisted
        .as_ref()
        .is_some_and(|h| h.service.reachable().unwrap_or(false))
    {
        return fail(Error::Disabled).response();
    }
    if method == Method::POST
        && (crate::cookies(&headers).get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN))
    {
        return fail(Error::Unauthorized).response();
    }
    let body: Value = if input.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&input) {
            Ok(v) => v,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let path = uri.path();
    let parts = path.split('/').collect::<Vec<_>>();
    let id = parts.get(4).and_then(|v| ProposalId::parse_str(v).ok());
    // Resolve F06-style challenge/reauth from this exact current C01 session. The
    // trusted keyed L03 attestation is created only after those server records pass.
    let original_deadline = body["mfaChallengeRef"]
        .as_str()
        .and_then(|v| state.challenges.get(v))
        .and_then(|c| {
            c.verified_at
                .map(|t| now(c.expires_at).min(now(t) + Duration::seconds(120)))
        });
    let verified = if path.ends_with("/approvals") {
        let c = body["mfaChallengeRef"]
            .as_str()
            .and_then(|v| state.challenges.get(v));
        let g = body["reauthTokenRef"]
            .as_str()
            .and_then(|v| state.reauth_grants.get(v));
        matches!((c,g),(Some(c),Some(g)) if c.session==sid&&g.session==sid&&c.purpose=="security_change"&&c.consumed&&c.verified_at.is_some_and(|t|now(t)<=at)&&original_deadline.is_some_and(|d|d>at)&&c.expires_at>at&&g.expires_at>at&&Some(g.challenge_ref.as_str())==body["mfaChallengeRef"].as_str())
    } else {
        true
    };
    let grant = body["reauthTokenRef"]
        .as_str()
        .map(|g| format!("{sid}:{g}"));
    let already_used = grant
        .as_ref()
        .is_some_and(|g| state.consumed_step_proofs.contains(g));
    let clock_offset = state.clock_offset;
    let clock = || now(Utc::now() + clock_offset);
    let h = state.assisted.as_mut().unwrap();
    let result = (|| -> Result<Value, Error> {
        let caps = h.service.capabilities(&sid, &clock)?;
        if method == Method::GET {
            h.service.control_auth(&sid, at)?;
        } else if caps["request"] != true && caps["approve"] != true {
            return Err(Error::Disabled);
        }
        if method == Method::GET {
            if path == "/v1/assisted-testnet/risk-review-candidates" {
                if uri.query().is_some() || !input.is_empty() {
                    return Err(Error::Invalid);
                }
                return Ok(json!({"items":h.sources.review_candidates(at)?}));
            }
            if path == "/v1/assisted-testnet/reconciliation" {
                if uri.query().is_some() || !input.is_empty() {
                    return Err(Error::Invalid);
                }
                return h.sync_reconciliation(&sid, at);
            }
            if path == "/v1/assisted-testnet/valuation" {
                if uri.query().is_some() || !input.is_empty() {
                    return Err(Error::Invalid);
                }
                return h.sync_valuation(&sid, at);
            }
            if path == "/v1/assisted-testnet/ledger" {
                return h.sync_ledger(&sid, at);
            }
            if path.ends_with("/subjects") {
                let ids = h.subjects.keys().copied().collect::<Vec<_>>();
                let mut items = vec![];
                for id in ids {
                    if h.require_native_snapshot(&sid, id, &clock).is_ok()
                        && h.sources
                            .with_current(h.subjects.get(&id).ok_or(Error::Invalid)?, at, || ())
                            .is_ok()
                    {
                        items.push(h.subject(id)?);
                    }
                }
                return Ok(json!({"items":items}));
            }
            if path == "/v1/assisted-testnet/requests" {
                return Ok(
                    json!({"items":h.requests.keys().copied().collect::<Vec<_>>().into_iter().map(|id|h.view(&sid,id,at)).collect::<Result<Vec<_>,_>>()?}),
                );
            }
            let id = id.ok_or(Error::Invalid)?;
            if path.ends_with("/audit") {
                h.service.execution_view(&sid, id, at)?;
                let (entries, anchor) = h.service.audit_snapshot()?;
                h.service.verify_audit(&entries, &anchor)?;
                let items=entries.iter().filter(|e|e.request==id).map(|e|json!({"sequence":e.sequence,"requestId":e.request,"subjectHash":e.subject_hash,"actorId":e.actor,"userId":e.user,"slot":e.slot,"signature":e.signature})).collect::<Vec<_>>();
                return Ok(
                    json!({"items":items,"verified":true,"nativeSubmissions":h.native.submission_count()?}),
                );
            }
            return h.view(&sid, id, clock());
        }
        let key = headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .ok_or(Error::Invalid)?;
        if path.ends_with("/risk-reviews") {
            if uri.query().is_some() {
                return Err(Error::Invalid);
            }
            return h.refresh_risk(&sid, id.ok_or(Error::Invalid)?, key, &body, &clock);
        }
        if path == "/v1/assisted-testnet/requests" {
            if h.requests.len() >= 200 && !h.open_keys.contains_key(&(sid.clone(), key.to_owned()))
            {
                return Err(Error::Unavailable);
            }
            let subject = body["subjectId"]
                .as_str()
                .and_then(|s| ProposalId::parse_str(s).ok())
                .ok_or(Error::Invalid)?;
            let store = h.book_input_fence.clone();
            let _books_lock = store.as_ref().map(|s| s.lock()).transpose()?;
            h.require_native_snapshot_locked(&sid, subject, &clock)?;
            let r = h.service.open(&sid, subject, key, &clock)?.receipt;
            h.requests.insert(r.request, subject);
            h.opened_at.entry(r.request).or_insert(at);
            h.open_keys.insert((sid.clone(), key.to_owned()), r.request);
            return h.view(&sid, r.request, clock());
        }
        let id = id.ok_or(Error::Invalid)?;
        let expected = body["expectedRevision"].as_u64().ok_or(Error::Invalid)?;
        if path.ends_with("/approvals") {
            let store = h.book_input_fence.clone();
            let _books_lock = store.as_ref().map(|s| s.lock()).transpose()?;
            h.require_native_snapshot_locked(
                &sid,
                *h.requests.get(&id).ok_or(Error::Invalid)?,
                &clock,
            )?;
            if !verified {
                return Err(Error::MfaInvalid);
            }
            let k = (sid.clone(), key.to_owned());
            let binding = json!([id, body]);
            let proof = if let Some(replay) = h.proofs.get(&k) {
                if replay.binding != binding {
                    return Err(Error::Conflict);
                }
                replay.proof.clone()
            } else {
                if already_used || h.proofs.len() >= 4096 {
                    return Err(Error::MfaConsumed);
                }
                let proof = h.mfa.attest_provider_completed(
                    h.service
                        .challenge_until(&sid, id, original_deadline, clock())?,
                    clock(),
                )?;
                h.proofs.insert(
                    k,
                    Replay {
                        binding,
                        proof: proof.clone(),
                    },
                );
                proof
            };
            h.require_native_snapshot_locked(
                &sid,
                *h.requests.get(&id).ok_or(Error::Invalid)?,
                &clock,
            )?;
            h.service.approve(&sid, id, expected, key, proof, &clock)?;
            return h.view(&sid, id, clock());
        }
        if path.ends_with("/commands") {
            let r = h.service.inspect(&sid, id, &clock)?;
            if r.revision != expected {
                return Err(Error::Conflict);
            }
            let existing = h.native.inspect(&sid, id, clock())?;
            // Read-only recovery of an existing reservation never enters dispatch.
            if let Some(receipt) = existing {
                if receipt.current_risk.is_some() {
                    return Err(Error::Conflict);
                }
                return Ok(command(h.native.submit(&sid, id, key, &clock)?));
            }
            let subject_id = *h.requests.get(&id).ok_or(Error::Invalid)?;
            let receipt = if h.sources.native_snapshot(subject_id)?.is_some() {
                if !h.current_review_execution_enabled {
                    return Err(Error::Disabled);
                }
                // Stable authenticated owner-input inode lock remains held through
                // native reservation/fsync/IO. Outer approval lock serializes the
                // ledger and other cooperating BFF processes on this owner scope.
                let store = h.valuation_input.clone().ok_or(Error::Unavailable)?;
                let tx = store.lock()?;
                let input = tx.read()?.ok_or(Error::PolicyChanged)?;
                let books_store = h.book_input_fence.clone().ok_or(Error::Unavailable)?;
                let _books_lock = books_store.lock()?;
                let view = h.sync_valuation_input(&sid, clock(), Some(input))?;
                if view["riskInputReady"] != true {
                    return Err(Error::PolicyChanged);
                }
                let snapshot = serde_json::from_value(view["snapshot"].clone())
                    .map_err(|_| Error::Unavailable)?;
                h.sync_reconciliation_locked(&sid, clock())?;
                let books = h.reviewed_books(clock())?;
                if !books.eligible(clock()) {
                    return Err(Error::PolicyChanged);
                }
                let current = quantos_risk::guard::NativeRiskContext {
                    books: Some(books),
                    input: h
                        .valuation
                        .input_for(&snapshot)
                        .map_err(|_| Error::Unavailable)?,
                    snapshot,
                    ledger_checkpoint: h
                        .ledger
                        .as_ref()
                        .ok_or(Error::Unavailable)?
                        .checkpoint()
                        .map_err(|_| Error::Unavailable)?,
                };
                h.native.submit_current(&sid, id, key, &current, &clock)?
            } else {
                let ledger = h.sync_ledger(&sid, clock())?;
                if !h.risk_refreshes.is_empty()
                    || !h.financial_reviews.records.is_empty()
                    || ledger["appliedFillCount"].as_u64().unwrap_or(0) > 0
                    || ledger["consumerReady"] != true
                {
                    return Err(Error::PolicyChanged);
                }
                // The original empty-ledger reference seed is not current-risk
                // authority. Once X05 has observed financial state, it cannot
                // bypass unresolved books by falling back to that seed.
                let book_store = h.book_input_fence.clone();
                let _book_lock = book_store.as_ref().map(|s| s.lock()).transpose()?;
                if h.reconciliation.is_some()
                    || h.reconciliation_anchor.sequence > 0
                    || h.observer
                        .as_ref()
                        .map(|r| r.has_account_input())
                        .transpose()?
                        .unwrap_or(false)
                {
                    h.sync_reconciliation_locked(&sid, clock())?;
                    if !h
                        .reconciliation
                        .as_ref()
                        .ok_or(Error::Unavailable)?
                        .risk_input()
                        .map_err(|_| Error::Unavailable)?
                        .eligible(clock())
                    {
                        return Err(Error::PolicyChanged);
                    }
                }
                h.native.submit(&sid, id, key, &clock)?
            };
            h.sync_ledger(&sid, clock())?;
            return Ok(command(receipt));
        }
        Err(Error::Invalid)
    })();
    if path.ends_with("/approvals")
        && result.is_ok()
        && let Some(g) = grant
    {
        state.consumed_step_proofs.insert(g);
    }
    match result {
        Ok(v) => crate::response(StatusCode::OK, v, &crate::correlation_id()),
        Err(e) => fail(e).response(),
    }
}
pub(crate) mod persistence;
#[cfg(test)]
mod tests;

pub(crate) mod alerts;
pub(crate) mod control;
mod ledger;
mod reconciliation;
mod source_seed;

pub(crate) mod activation;

mod valuation;

mod financial_review;
mod risk_refresh;
