//! C06–C09/C13. Page references never carry executable payloads. All execution
//! passes through the X03 issuer and X04 gateway. This host is process local;
//! loss of its lease must stop admission, never rebuild a command from a browser.
mod reference_seed;
use crate::research::{Fault, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{ContentHash, ProposalId};
use quantos_execution::{
    authority::*,
    dispatch::SignedExecutionGateway,
    gateway::{GatewayLimits, PaperKernel},
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_portfolio::{
    FillEvent, FillSide, InMemoryPortfolioProjection, PortfolioEvent, PortfolioEventKind,
    RiskInputSnapshot,
};
use quantos_risk::{RiskVerdict, guard::*};
use quantos_runtime::signal_proposal::TradeProposalRecord;
use quantos_strategy::release::StrategyRelease;
pub(crate) use reference_seed::release_fixture as reference_release;
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
struct Proposal {
    requester: AuthContext,
    hash: ContentHash,
    record: TradeProposalRecord,
    intent: TradeIntent,
    page: Value,
    approval: Option<ApprovalReceipt>,
    command: Option<(Uuid, SignedCommand)>,
    correlation: Uuid,
    last_decision: Option<String>,
    position_before: f64,
}
#[derive(Clone)]
struct Replay {
    intent: String,
    status: StatusCode,
    body: Value,
}
#[derive(Clone)]
struct Cursor {
    actor: String,
    query: String,
    rows: Vec<Value>,
    offset: usize,
    expires: DateTime<Utc>,
}
/// Trusted owner-side resources only. Never deserialize this service from HTTP.
/// An injected live host must retain this same lease until durable recovery is admitted.
pub struct ExecutionService {
    auth: AuthContext,
    pub(crate) linked_approvals: Vec<Value>,
    input: RiskInputSnapshot,
    projection: InMemoryPortfolioProjection,
    applied_fills: BTreeSet<String>,
    financials: AccountFinancials,
    venue: VenueState,
    release: StrategyRelease,
    guard: RiskGuard,
    issuer: AtomicCommandIssuer,
    gateway: SignedExecutionGateway<PaperKernel>,
    proposals: BTreeMap<Uuid, Proposal>,
    orders: BTreeMap<Uuid, Uuid>,
    replays: BTreeMap<String, Replay>,
    inflight: BTreeMap<String, String>,
    cursors: BTreeMap<Uuid, Cursor>,
    journals: BTreeMap<String, (Uuid, Vec<Value>)>,
    used_proofs: BTreeMap<String, DateTime<Utc>>,
    requests: BTreeMap<String, (DateTime<Utc>, usize)>,
    pub(crate) poisoned: bool,
}
impl std::fmt::Debug for ExecutionService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ExecutionService(REDACTED,process-local-paper)")
    }
}
fn conflict() -> Fault {
    Fault(StatusCode::CONFLICT, "STATE_CONFLICT")
}
fn forbidden() -> Fault {
    Fault(StatusCode::FORBIDDEN, "FORBIDDEN")
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v[k].as_str()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(Fault::invalid)
}
fn id(v: &Value, k: &str) -> Result<Uuid> {
    crate::research::uuid(text(v, k)?)
}
fn mapped<T, E>(v: std::result::Result<T, E>) -> Result<T> {
    v.map_err(|_| conflict())
}
fn stable_id(s: &str) -> Uuid {
    let hash = ContentHash::sha256_bytes(s.as_bytes()).to_string();
    let bytes = hash.trim_start_matches("sha256:");
    let mut b = [0u8; 16];
    for (i, n) in b.iter_mut().enumerate() {
        *n = u8::from_str_radix(&bytes[i * 2..i * 2 + 2], 16).expect("digest");
    }
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    Uuid::from_bytes(b)
}
/// Same server-owned reference identities are used by Context and execution.
pub(crate) fn reference_actor(session: &str) -> quantos_core::ActorId {
    quantos_core::ActorId::from_uuid(match session {
        "session-approver" => stable_id("reference-independent-approver"),
        "session-owner" => stable_id("reference-owner"),
        _ => Uuid::parse_str("11111111-1111-4111-8111-111111111111").expect("owned actor"),
    })
}
impl ExecutionService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        auth: AuthContext,
        input: RiskInputSnapshot,
        projection: InMemoryPortfolioProjection,
        financials: AccountFinancials,
        venue: VenueState,
        release: StrategyRelease,
        guard: RiskGuard,
        issuer: AtomicCommandIssuer,
        gateway: SignedExecutionGateway<PaperKernel>,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            matches!(auth.mode, RunMode::Paper | RunMode::Shadow)
                && auth.account_id == Some(input.portfolio.account_id)
                && auth.tenant_id == input.portfolio.tenant_id
                && gateway.uses_issuer(&issuer)
                && issuer.uses_risk_guard(&guard)
                && financials.quote_unit == "USD"
                && projection
                    .snapshot(input.portfolio.account_id)?
                    .snapshot_hash
                    == input.portfolio.snapshot_hash,
            "trusted Paper resource binding required"
        );
        Ok(Self {
            linked_approvals: Vec::new(),
            auth,
            input,
            projection,
            applied_fills: BTreeSet::new(),
            financials,
            venue,
            release,
            guard,
            issuer,
            gateway,
            proposals: BTreeMap::new(),
            orders: BTreeMap::new(),
            replays: BTreeMap::new(),
            inflight: BTreeMap::new(),
            cursors: BTreeMap::new(),
            journals: BTreeMap::new(),
            used_proofs: BTreeMap::new(),
            requests: BTreeMap::new(),
            poisoned: false,
        })
    }
    /// Trusted feed replacement. Browser selectors cannot call this owner API.
    /// Old signatures are rechecked against these current sources at dispatch.
    pub fn replace_sources(
        &mut self,
        input: RiskInputSnapshot,
        projection: InMemoryPortfolioProjection,
        financials: AccountFinancials,
        venue: VenueState,
        release: StrategyRelease,
        now: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        input.validate_for(
            self.auth.tenant_id,
            self.auth.account_id.expect("bound account"),
            now,
            60,
        )?;
        anyhow::ensure!(
            input.portfolio.as_of >= self.input.portfolio.as_of
                && financials.tenant_id == self.auth.tenant_id
                && Some(financials.account_id) == self.auth.account_id
                && financials.quote_unit == "USD"
                && release.tenant_id == self.auth.tenant_id
                && release.workspace_id == self.auth.workspace_id,
            "source binding"
        );
        anyhow::ensure!(
            projection.last_sequence() >= self.projection.last_sequence()
                && projection
                    .snapshot(input.portfolio.account_id)?
                    .snapshot_hash
                    == input.portfolio.snapshot_hash,
            "projection binding"
        );
        self.input = input;
        self.projection = projection;
        self.financials = financials;
        self.venue = venue;
        self.release = release;
        Ok(())
    }
    pub fn register(
        &mut self,
        requester: &AuthContext,
        record: TradeProposalRecord,
        intent: TradeIntent,
        now: DateTime<Utc>,
    ) -> anyhow::Result<Uuid> {
        self.authorize(requester, false)
            .map_err(|_| anyhow::anyhow!("scope"))?;
        anyhow::ensure!(self.proposals.len() < 200, "proposal capacity");
        let hash = self
            .issuer
            .register_proposal(requester, record.clone(), intent.clone(), now)?;
        let id = stable_id(&format!("proposal:{hash}"));
        if self.proposals.contains_key(&id) {
            return Ok(id);
        }
        let out = &record.output;
        let page = json!({"proposalId":id,"accountId":intent.account_id,"symbol":intent.symbol,"action":if intent.side==Side::Buy{"buy"}else{"sell"},"quantity":intent.quantity,"notional":out["notional"]["value"],"signal":{"signalId":stable_id(&record.signal_id),"strategyReleaseId":self.release.release_id,"symbol":intent.symbol,"direction":if intent.side==Side::Buy{"long"}else{"short"},"strength":out["signal"]["strength"]["value"],"confidence":out["confidence"]["value"],"generatedAt":out["signal"]["generated_at"],"validUntil":out["signal"]["valid_until"]},"rationale":out["rationale"],"counterViews":record.counter_views,"evidenceRefs":[record.artifact_manifest.artifact_id],"confidence":out["confidence"]["value"],"expiresAt":record.expires_at,"executable":false,"objectVersion":"0"});
        self.proposals.insert(
            id,
            Proposal {
                requester: requester.clone(),
                hash,
                record,
                intent: intent.clone(),
                page,
                approval: None,
                command: None,
                correlation: Uuid::now_v7(),
                last_decision: None,
                position_before: self
                    .input
                    .portfolio
                    .positions
                    .iter()
                    .find(|p| p.symbol == intent.symbol)
                    .map(|p| p.quantity)
                    .unwrap_or(0.0),
            },
        );
        Ok(id)
    }
    pub(crate) fn reference() -> Self {
        let f = reference_seed::Fixture::new();
        let guard = f.guard();
        let issuer = f.issuer(&guard);
        let gateway = SignedExecutionGateway::new(
            issuer.clone(),
            GatewayLimits {
                max_quantity: rust_decimal::Decimal::from(10000),
                max_notional: rust_decimal::Decimal::from(250000),
                allowed_venues: vec![f.venue.venue.clone()],
            },
            PaperKernel::resting("100"),
        )
        .expect("owned Paper kernel");
        let mut s = Self::new(
            f.auth.clone(),
            f.input.clone(),
            f.projection.clone(),
            f.financials.clone(),
            f.venue.clone(),
            f.release.clone(),
            guard,
            issuer,
            gateway,
        )
        .expect("reference resources");
        s.register(&f.auth, f.record(), f.intent.clone(), f.now)
            .expect("owned real proposal");
        s
    }
    pub fn downstream_counts(&self) -> (Option<usize>, Option<usize>) {
        (
            self.gateway.downstream_submission_count(),
            self.gateway.downstream_cancel_count(),
        )
    }
    fn authorize(&self, a: &AuthContext, write: bool) -> Result<()> {
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        if a.tenant_id != self.auth.tenant_id
            || a.workspace_id != self.auth.workspace_id
            || a.account_id != self.auth.account_id
            || a.mode != self.auth.mode
        {
            return Err(Fault::hidden());
        }
        let cap = if write && a.role == Role::Approver {
            Capability::STRATEGY_APPROVE
        } else {
            Capability::EXECUTION_OPERATE
        };
        if a.role == Role::Viewer || !a.capabilities.iter().any(|v| v.as_str() == cap) {
            return Err(forbidden());
        }
        Ok(())
    }
    fn sources(&self) -> CurrentSources<'_> {
        CurrentSources {
            snapshot: &self.input,
            financials: &self.financials,
            venue: &self.venue,
            release: &self.release,
        }
    }
    fn context_hash(&self, p: &Proposal) -> String {
        digest(
            &json!({"account":self.auth.account_id,"tenant":self.auth.tenant_id,"workspace":self.auth.workspace_id,"mode":self.auth.mode.as_str(),"input":self.input.input_hash,"financials":self.financials,"venue":self.venue,"release":self.release.content_hash,"policyRevision":self.guard.revision().ok(),"proposal":p.hash}),
        )
    }
    fn evaluate(&self, p: &Proposal, approved: bool, now: DateTime<Utc>) -> Result<GuardDecision> {
        let token = if approved {
            Some(mapped(self.issuer.approval_token(
                &p.requester,
                p.approval.as_ref().ok_or_else(conflict)?.id,
                now,
            ))?)
        } else {
            None
        };
        mapped(self.guard.evaluate(
            &p.requester,
            Phase::Pre,
            &p.intent,
            &self.input,
            &self.financials,
            &self.venue,
            &self.release,
            token.as_ref(),
            now,
        ))
    }
    pub(crate) fn current_version(&self, path: &str) -> Option<String> {
        let id = path
            .split('/')
            .nth(3)
            .and_then(|v| Uuid::parse_str(v).ok())?;
        if path.ends_with("/risk-evaluations") {
            self.proposals
                .get(&id)
                .and_then(|p| p.page["objectVersion"].as_str().map(str::to_owned))
        } else {
            self.proposals.values().find_map(|p| {
                p.approval
                    .as_ref()
                    .filter(|r| *r.id.as_uuid() == id)
                    .map(|r| r.revision.to_string())
            })
        }
    }
    fn proposal(&self, id: Uuid) -> Result<&Proposal> {
        self.proposals.get(&id).ok_or_else(Fault::hidden)
    }
    fn proposal_page(&self, p: &Proposal, now: DateTime<Utc>) -> Value {
        let mut page = p.page.clone();
        let submitted = p.command.as_ref().is_some_and(|(_, cmd)| {
            self.orders
                .contains_key(&stable_id(&format!("order:{}", cmd.command_id)))
        });
        let status = if submitted {
            "submitted"
        } else if now >= p.record.expires_at {
            "expired"
        } else {
            match p.approval.as_ref().map(|a| a.state) {
                None => "active",
                Some(ApprovalState::Pending) => "awaiting_approval",
                Some(ApprovalState::Approved) => "approved",
                Some(ApprovalState::Consumed) => "command_ready",
                Some(ApprovalState::Rejected) => {
                    if p.last_decision.as_deref() == Some("request_info") {
                        "request_info"
                    } else {
                        "rejected"
                    }
                }
                Some(ApprovalState::Cancelled) => "request_info",
            }
        };
        page["status"] = json!(status);
        page["correlationId"] = json!(p.correlation);
        page
    }
    fn approval_page(&self, p: &Proposal, now: DateTime<Utc>) -> Result<Value> {
        let a = p.approval.as_ref().ok_or_else(Fault::hidden)?;
        let state = if now >= a.expires_at
            && matches!(a.state, ApprovalState::Pending | ApprovalState::Approved)
        {
            "expired"
        } else {
            match a.state {
                ApprovalState::Pending => "pending",
                ApprovalState::Approved => "approved",
                ApprovalState::Rejected => "rejected",
                ApprovalState::Cancelled => "rejected",
                ApprovalState::Consumed => "approved",
            }
        };
        let mut v = json!({"approvalId":a.id,"originator":a.requester,"objectVersion":a.revision.to_string(),"status":state,"issuanceState":if a.state==ApprovalState::Consumed{"consumed"}else{"not_issued"},"expiresAt":a.expires_at,"correlationId":p.correlation});
        if let Some(decision) = &p.last_decision {
            v["decision"] = json!(decision);
        }
        if let Some((id, cmd)) = &p.command
            && now < cmd.expires_at
        {
            v["commandRef"] = json!(id);
            v["commandExpiresAt"] = json!(cmd.expires_at);
        }
        Ok(v)
    }
    fn risk(&self, now: DateTime<Utc>) -> Result<Value> {
        let p = self.proposals.values().next().ok_or_else(Fault::hidden)?;
        let d = self.evaluate(p, false, now)?;
        let kills: Vec<_> = d
            .hit_rules()
            .filter(|c| {
                matches!(
                    c.rule,
                    quantos_risk::rules::Rule::GlobalKill | quantos_risk::rules::Rule::AccountKill
                )
            })
            .collect();
        Ok(
            json!({"accountId":self.auth.account_id,"asOf":self.input.portfolio.as_of,"hitRules":d.hit_rules().map(|c|format!("{:?}",c.rule)).collect::<Vec<_>>(),"limitIds":d.hit_rules().map(|c|stable_id(&c.limit_id)).collect::<Vec<_>>(),"killSwitch":{"state":if kills.is_empty(){"disengaged"}else{"engaged"}},"objectVersion":self.guard.revision().map_err(|_|Fault::unavailable())?.to_string()}),
        )
    }
    fn portfolio(&self, now: DateTime<Utc>) -> Value {
        let p = &self.input.portfolio;
        let pnl = rust_decimal::Decimal::from_f64_retain(p.realized_pnl + p.unrealized_pnl)
            .unwrap_or_default()
            .round_dp(9);
        use rust_decimal::prelude::ToPrimitive;
        json!({"accountId":p.account_id,"asOf":p.as_of,"stale":self.input.validate_for(self.auth.tenant_id,p.account_id,now,60).is_err(),"positions":p.positions.iter().map(|v|json!({"symbol":v.symbol,"side":if v.quantity>=0.0{"long"}else{"short"},"quantity":v.quantity.abs().to_string(),"avgPrice":v.average_entry_price.to_string()})).collect::<Vec<_>>(),"pnl":{"currencyCode":"USD","units":pnl.trunc().to_string(),"nanos":(pnl.fract()*rust_decimal::Decimal::from(1000000000)).to_i32().unwrap_or(0)},"exposure":p.exposure_gross.to_string()})
    }
    fn order(&self, id: Uuid, now: DateTime<Utc>) -> Result<Value> {
        let pid = *self.orders.get(&id).ok_or_else(Fault::hidden)?;
        let p = self.proposal(pid)?;
        let (_, cmd) = p.command.as_ref().ok_or_else(conflict)?;
        let e = mapped(self.gateway.inspect_order(&p.requester, cmd, now))?;
        let o = e.order;
        let quantity = p
            .intent
            .quantity
            .parse::<f64>()
            .map_err(|_| Fault::unavailable())?;
        let opposite = (p.position_before > 0.0 && p.intent.side == Side::Sell)
            || (p.position_before < 0.0 && p.intent.side == Side::Buy);
        let business_intent = if p.position_before == 0.0 {
            "open"
        } else if opposite {
            if quantity < p.position_before.abs() {
                "reduce"
            } else if quantity == p.position_before.abs() {
                "close"
            } else {
                "open"
            }
        } else {
            "increase"
        };
        Ok(
            json!({"orderId":id,"cancelCommandRef":p.command.as_ref().map(|c|c.0),"commandId":cmd.command_id,"proposalId":pid,"decisionId":cmd.source_decision_id,"releaseId":p.intent.release_id,"accountId":p.intent.account_id,"venue":cmd.venue,"venueKind":"mock","symbol":o.symbol,"intent":business_intent,"side":o.side,"quantity":o.quantity,"status":o.status,"filledQuantity":o.filled_quantity,"averageFillPrice":o.average_fill_price.unwrap_or_else(||"0".into()),"fills":e.fills.iter().map(|f|json!({"fillId":stable_id(&f.fill_id),"quantity":f.quantity,"price":f.price,"at":f.filled_at})).collect::<Vec<_>>(),"mode":"paper","correlationId":p.correlation,"submittedAt":o.submitted_at,"evidence":{"proposalHash":p.hash,"riskDecisionId":cmd.current_risk.decision_id,"approvalId":cmd.approval.as_ref().map(|a|a.id),"commandId":cmd.command_id,"releaseId":p.intent.release_id,"snapshotHash":cmd.current_risk.snapshot_hash,"portfolioHash":self.input.portfolio.snapshot_hash,"factHashes":e.facts.iter().map(|f|f.hash.clone()).collect::<Vec<_>>() }}),
        )
    }
    fn preflight(&self, pid: Uuid, now: DateTime<Utc>) -> Result<Value> {
        let p = self.proposal(pid)?;
        let d = self.evaluate(p, false, now)?;
        Ok(
            json!({"proposalId":pid,"correlationId":p.correlation,"accountId":p.intent.account_id,"mode":self.auth.mode.as_str(),"contextHash":self.context_hash(p),"objectVersion":p.page["objectVersion"],"asOf":self.input.portfolio.as_of,"expiresAt":p.record.expires_at.min(d.expires_at),"verdict":match d.verdict{RiskVerdict::Allow=>"allow",RiskVerdict::ApprovalRequired=>"approval_required",RiskVerdict::Deny=>"deny"},"hitRules":d.hit_rules().map(|c|format!("{:?}",c.rule)).collect::<Vec<_>>(),"executable":false}),
        )
    }
    fn event(&mut self, key: &str, body: Value, now: DateTime<Utc>) -> Result<Value> {
        if self.journals.len() >= 1000 && !self.journals.contains_key(key) {
            return Err(Fault::unavailable());
        }
        let (stream, rows) = self
            .journals
            .entry(key.into())
            .or_insert_with(|| (Uuid::now_v7(), vec![]));
        if rows.last().is_none_or(|v| v["payload"] != body) {
            if rows.len() >= 10000 {
                return Err(Fault::unavailable());
            }
            let correlation = body
                .get("correlationId")
                .cloned()
                .unwrap_or_else(|| json!(Uuid::now_v7()));
            rows.push(json!({"streamId":stream,"sequence":rows.len()+1,"eventId":Uuid::now_v7(),"occurredAt":now,"correlationId":correlation,"payloadVersion":"v1","payload":body}));
        }
        Ok(json!(rows))
    }
    fn page(
        &mut self,
        a: &AuthContext,
        path: &str,
        q: &BTreeMap<String, String>,
        mut rows: Vec<Value>,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        let actor = digest(&json!([
            a.tenant_id,
            a.actor_id,
            a.workspace_id,
            a.account_id,
            a.mode.as_str(),
            format!("{:?}", a.role),
            a.capabilities
                .iter()
                .map(|c| c.as_str())
                .collect::<Vec<_>>()
        ]));
        let mut query = q.clone();
        let cursor = query.remove("cursor");
        let query = digest(&json!([path, query]));
        let size = q
            .get("pageSize")
            .map(|v| v.parse::<usize>())
            .transpose()
            .map_err(|_| Fault::invalid())?
            .unwrap_or(50);
        if !(1..=200).contains(&size) {
            return Err(Fault::invalid());
        }
        let offset = if let Some(c) = cursor {
            let c = self
                .cursors
                .get(&crate::research::uuid(&c)?)
                .ok_or_else(conflict)?;
            if c.actor != actor || c.query != query || now >= c.expires {
                return Err(conflict());
            }
            rows = c.rows.clone();
            c.offset
        } else {
            if let Some(f) = q.get("filter") {
                let parts: Vec<_> = f.splitn(3, ':').collect();
                if parts.len() != 3 || parts[1] != "eq" {
                    return Err(Fault::invalid());
                }
                rows.retain(|r| r[parts[0]].as_str() == Some(parts[2]));
            }
            for field in ["status", "symbol"] {
                if let Some(v) = q.get(field) {
                    rows.retain(|r| r[field].as_str() == Some(v));
                }
            }
            if let Some(sort) = q.get("sort") {
                let (field, direction) = sort.split_once(':').ok_or_else(Fault::invalid)?;
                if !matches!(direction, "asc" | "desc") {
                    return Err(Fault::invalid());
                }
                rows.sort_by_key(|r| r[field].as_str().unwrap_or("").to_owned());
                if direction == "desc" {
                    rows.reverse();
                }
            }
            0
        };
        let end = (offset + size).min(rows.len());
        let mut out = json!({"items":rows[offset..end]});
        if end < rows.len() {
            if self.cursors.len() >= 2000 {
                return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
            }
            let id = Uuid::now_v7();
            self.cursors.insert(
                id,
                Cursor {
                    actor,
                    query,
                    rows,
                    offset: end,
                    expires: now + Duration::minutes(5),
                },
            );
            out["nextCursor"] = json!(id);
        }
        Ok(out)
    }
    /// Call only after verified cookie/CSRF and recent-auth checks. `proof` is
    /// server-verified (session/challenge/grant), never an assertion from JSON.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn handle(
        &mut self,
        a: &AuthContext,
        session: &str,
        method: &Method,
        path: &str,
        q: &BTreeMap<String, String>,
        headers: &HeaderMap,
        body: &Value,
        proof: Option<String>,
        now: DateTime<Utc>,
    ) -> Result<(StatusCode, Value)> {
        let write = method == Method::POST;
        self.authorize(a, write)?;
        if let Some(account) = q
            .get("accountId")
            .map(String::as_str)
            .or_else(|| body["accountId"].as_str())
            && Some(account) != self.auth.account_id.map(|v| v.to_string()).as_deref()
        {
            return Err(Fault::hidden());
        }
        if write && a.mode == RunMode::Shadow && !path.contains("kill-switch") {
            return Err(forbidden());
        }
        let parts: Vec<_> = path.trim_matches('/').split('/').collect();
        let resource = parts.get(2).and_then(|s| Uuid::parse_str(s).ok());
        if !write {
            let val = match path {
                "/v1/portfolio" => self.portfolio(now),
                "/v1/risk" => self.risk(now)?,
                "/v1/order-capabilities" => {
                    let limits = self
                        .gateway
                        .boundary_limits()
                        .ok_or_else(Fault::unavailable)?;
                    let policy = self.guard.policy();
                    let max_notional = limits.max_notional.min(
                        rust_decimal::Decimal::from_f64_retain(
                            policy.limits.max_notional_per_order,
                        )
                        .ok_or_else(Fault::unavailable)?,
                    );
                    json!({"accountId":self.auth.account_id,"mode":self.auth.mode.as_str(),"canSubmit":self.auth.mode==RunMode::Paper&&matches!(a.role,Role::Owner|Role::Operator),"canCancel":self.auth.mode==RunMode::Paper&&matches!(a.role,Role::Owner|Role::Operator),"venueSubmit":false,"quantityScale":policy.limits.max_quantity_scale,"priceScale":policy.limits.max_price_scale,"maxQuantity":limits.max_quantity.normalize().to_string(),"maxNotional":max_notional.normalize().to_string()})
                }
                "/v1/trade-preflight" | "/v1/trade-preflight/stream" => self.preflight(
                    crate::research::uuid(q.get("proposalId").ok_or_else(Fault::invalid)?)?,
                    now,
                )?,
                "/v1/portfolio/stream" => {
                    json!({"type":"portfolio","portfolio":self.portfolio(now),"risk":self.risk(now)?})
                }
                "/v1/proposals" => {
                    if q.get("status").is_some_and(|v| {
                        !matches!(
                            v.as_str(),
                            "active"
                                | "awaiting_approval"
                                | "approved"
                                | "command_ready"
                                | "request_info"
                                | "rejected"
                                | "expired"
                                | "submitted"
                        )
                    }) {
                        return Err(Fault::invalid());
                    }
                    let rows = self
                        .proposals
                        .values()
                        .map(|p| self.proposal_page(p, now))
                        .collect();
                    return Ok((StatusCode::OK, self.page(a, path, q, rows, now)?));
                }
                "/v1/approvals" => {
                    let mut rows = self
                        .proposals
                        .values()
                        .filter(|p| p.approval.is_some())
                        .map(|p| self.approval_page(p, now))
                        .collect::<Result<Vec<_>>>()?;
                    rows.extend(self.linked_approvals.clone());
                    return Ok((StatusCode::OK, self.page(a, path, q, rows, now)?));
                }
                "/v1/orders" => {
                    let rows = self
                        .orders
                        .keys()
                        .map(|id| self.order(*id, now))
                        .collect::<Result<Vec<_>>>()?;
                    return Ok((StatusCode::OK, self.page(a, path, q, rows, now)?));
                }
                _ => match parts.get(1).copied() {
                    Some("proposals") => self
                        .proposal_page(self.proposal(resource.ok_or_else(Fault::invalid)?)?, now),
                    Some("approvals") => {
                        let p = self
                            .proposals
                            .values()
                            .find(|p| {
                                p.approval
                                    .as_ref()
                                    .is_some_and(|r| Some(*r.id.as_uuid()) == resource)
                            })
                            .ok_or_else(Fault::hidden)?;
                        self.approval_page(p, now)?
                    }
                    Some("orders") => self.order(resource.ok_or_else(Fault::invalid)?, now)?,
                    _ => return Err(Fault::hidden()),
                },
            };
            if path.ends_with("/stream") {
                let vals = self.event(
                    &format!(
                        "{path}:{}",
                        q.get("proposalId").map(String::as_str).unwrap_or("")
                    ),
                    val,
                    now,
                )?;
                let after = q
                    .get("afterSequence")
                    .map(|v| v.parse::<u64>())
                    .transpose()
                    .map_err(|_| Fault::invalid())?
                    .unwrap_or(0);
                let rows = vals.as_array().expect("events");
                if after > rows.len() as u64 {
                    return Err(conflict());
                }
                return Ok((
                    StatusCode::OK,
                    json!({"events":rows.iter().filter(|e|e["sequence"].as_u64().unwrap()>after).collect::<Vec<_>>()}),
                ));
            }
            return Ok((StatusCode::OK, val));
        }
        if !matches!(a.role, Role::Owner | Role::Operator | Role::Approver) {
            return Err(forbidden());
        }
        let key = headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty() && v.len() <= 200)
            .ok_or_else(Fault::invalid)?;
        let replaykey = format!("{}:{}:{}:{}", a.tenant_id, a.actor_id, session, key);
        let intent = digest(&json!([
            method.as_str(),
            path,
            q,
            body,
            headers.get("if-match").and_then(|v| v.to_str().ok())
        ]));
        if let Some(r) = self.replays.get(&replaykey) {
            if r.intent != intent {
                return Err(conflict());
            }
            return Ok((r.status, r.body.clone()));
        }
        let recovering = self.inflight.get(&replaykey).is_some_and(|v| v == &intent);
        if self.inflight.contains_key(&replaykey) && !recovering {
            return Err(conflict());
        }
        self.cursors.retain(|_, v| now < v.expires);
        let window = self
            .requests
            .entry(format!(
                "{}:{}:{}",
                a.actor_id,
                parts.get(1).unwrap_or(&""),
                parts
                    .last()
                    .filter(|v| Uuid::parse_str(v).is_err())
                    .unwrap_or(&"resource")
            ))
            .or_insert((now, 0));
        if now - window.0 >= Duration::minutes(1) {
            *window = (now, 0)
        }
        if window.1 >= 200 {
            return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
        }
        window.1 += 1;
        if self.replays.len() + self.inflight.len() >= 10000 {
            return Err(Fault::unavailable());
        }
        let privileged = path.contains("kill-switch") || path.ends_with("/decisions");
        if privileged {
            let proof = proof.as_ref().ok_or_else(forbidden)?;
            if self.used_proofs.contains_key(proof) && !recovering {
                return Err(forbidden());
            }
        }
        let correlation = resource
            .and_then(|id| {
                self.proposals
                    .get(&id)
                    .or_else(|| {
                        self.proposals
                            .values()
                            .find(|p| p.approval.as_ref().is_some_and(|r| *r.id.as_uuid() == id))
                    })
                    .or_else(|| self.orders.get(&id).and_then(|pid| self.proposals.get(pid)))
            })
            .or_else(|| {
                body["commandRef"].as_str().and_then(|r| {
                    self.proposals.values().find(|p| {
                        p.command
                            .as_ref()
                            .is_some_and(|(id, _)| id.to_string() == r)
                    })
                })
            })
            .map(|p| p.correlation)
            .unwrap_or_else(Uuid::now_v7);
        let (status, mut out) = if path.contains("kill-switch") {
            if text(body, "reason")?.len() > 1000 {
                return Err(Fault::invalid());
            }
            let engage = path.ends_with("/engage");
            if !matches!(a.role, Role::Owner | Role::Operator) || (!engage && a.role != Role::Owner)
            {
                return Err(forbidden());
            }
            if engage && text(body, "confirmPhrase")? != "ENGAGE KILL SWITCH" {
                return Err(Fault::invalid());
            }
            mapped(self.guard.set_kill_switch(
                a,
                KillScope::Account(self.auth.account_id.unwrap()),
                engage,
                self.guard.revision().map_err(|_| Fault::unavailable())?,
                text(body, "reason")?,
                now,
            ))?;
            (StatusCode::OK, self.risk(now)?)
        } else if path.ends_with("/risk-evaluations") {
            let pid = resource.ok_or_else(Fault::invalid)?;
            let p = self.proposal(pid)?.clone();
            if a.actor_id != p.requester.actor_id {
                return Err(forbidden());
            }
            if headers.get("if-match").and_then(|v| v.to_str().ok())
                != p.page["objectVersion"].as_str()
            {
                return Err(Fault(StatusCode::CONFLICT, "VERSION_CONFLICT"));
            }
            if text(body, "contextHash")? != self.context_hash(&p) {
                return Err(conflict());
            }
            let d = self.evaluate(&p, false, now)?;
            if d.verdict == RiskVerdict::Deny {
                return Err(Fault(StatusCode::CONFLICT, "RISK_DENIED"));
            }
            if p.approval.is_none() {
                let receipt = mapped(self.issuer.request_approval(
                    a,
                    &p.hash,
                    now,
                    p.record.expires_at.min(now + Duration::seconds(60)),
                ))?;
                self.proposals.get_mut(&pid).unwrap().approval = Some(receipt);
            }
            (
                StatusCode::ACCEPTED,
                json!({"jobId":self.proposal(pid)?.approval.as_ref().unwrap().id,"status":"accepted"}),
            )
        } else if path.ends_with("/decisions") {
            let aid = ProposalId::from_uuid(resource.ok_or_else(Fault::invalid)?);
            let pid = *self
                .proposals
                .iter()
                .find(|(_, p)| p.approval.as_ref().is_some_and(|r| r.id == aid))
                .map(|(id, _)| id)
                .ok_or_else(Fault::hidden)?;
            let p = self.proposal(pid)?.clone();
            let approval = p.approval.as_ref().unwrap();
            if a.actor_id == p.requester.actor_id || !matches!(a.role, Role::Owner | Role::Approver)
            {
                return Err(forbidden());
            }
            let expected = headers
                .get("if-match")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .ok_or_else(conflict)?;
            if !recovering && expected != approval.revision {
                return Err(Fault(StatusCode::CONFLICT, "VERSION_CONFLICT"));
            }
            let decision = text(body, "decision")?;
            let next = match decision {
                "approve" => ApprovalState::Approved,
                "reject" | "request_info" => {
                    if text(body, "reason")?.len() > 1000 {
                        return Err(Fault::invalid());
                    }
                    ApprovalState::Rejected
                }
                _ => return Err(Fault::invalid()),
            };
            // Check current facts before changing approval state. Issuer repeats them atomically when signing.
            if decision == "approve" && self.evaluate(&p, false, now)?.verdict == RiskVerdict::Deny
            {
                return Err(Fault(StatusCode::CONFLICT, "RISK_DENIED"));
            }
            if recovering {
                if approval.state != ApprovalState::Approved
                    || approval.revision != expected + 1
                    || approval.approver != Some(a.actor_id)
                {
                    return Err(conflict());
                }
            } else {
                let r = mapped(self.issuer.transition_approval(a, aid, expected, next, now))?;
                self.proposals.get_mut(&pid).unwrap().approval = Some(r);
                self.proposals.get_mut(&pid).unwrap().last_decision = Some(decision.into());
                if decision == "approve" {
                    self.inflight.insert(replaykey.clone(), intent.clone());
                    if let Some(proof) = &proof {
                        self.used_proofs.insert(proof.clone(), now);
                    }
                }
            }
            if decision == "approve" {
                let p = self.proposal(pid)?.clone();
                let d = self.evaluate(&p, true, now)?;
                let cmd = mapped(self.issuer.issue(
                    &p.requester,
                    &p.hash,
                    &d,
                    Some(approval.id),
                    self.sources(),
                    now,
                ))?;
                let receipt = mapped(self.issuer.approval_status(&p.requester, aid))?;
                let before = self
                    .input
                    .portfolio
                    .positions
                    .iter()
                    .find(|v| v.symbol == p.intent.symbol)
                    .map(|v| v.quantity)
                    .unwrap_or(0.0);
                let p = self.proposals.get_mut(&pid).unwrap();
                p.position_before = before;
                p.approval = Some(receipt);
                p.command = Some((Uuid::now_v7(), cmd));
            }
            let mut page = self.approval_page(self.proposal(pid)?, now)?;
            page["decision"] = json!(decision);
            (StatusCode::OK, page)
        } else if path == "/v1/commands" || path.ends_with("/cancel-requests") {
            let commandref = id(body, "commandRef")?;
            let pid = *self
                .proposals
                .iter()
                .find(|(_, p)| p.command.as_ref().is_some_and(|(id, _)| *id == commandref))
                .map(|(id, _)| id)
                .ok_or_else(Fault::hidden)?;
            let p = self.proposal(pid)?.clone();
            if p.requester.actor_id != a.actor_id || !matches!(a.role, Role::Owner | Role::Operator)
            {
                return Err(forbidden());
            }
            let (_, cmd) = p.command.as_ref().unwrap();
            let orderid = stable_id(&format!("order:{}", cmd.command_id));
            if path == "/v1/commands" {
                let receipt = mapped(self.gateway.submit(a, cmd, self.sources(), now))?;
                for fill in &receipt.fills {
                    if self.applied_fills.contains(&fill.fill_id) {
                        continue;
                    }
                    let result = (|| -> Result<()> {
                        let quantity = fill
                            .quantity
                            .parse::<f64>()
                            .map_err(|_| Fault::unavailable())?;
                        let price = fill
                            .price
                            .parse::<f64>()
                            .map_err(|_| Fault::unavailable())?;
                        let fee = fill
                            .fee_amount
                            .parse::<f64>()
                            .map_err(|_| Fault::unavailable())?;
                        if fee != 0.0 && fill.fee_currency != self.financials.quote_unit {
                            return Err(Fault::unavailable());
                        }
                        let before = &self.input.portfolio;
                        let before_realized = before.realized_pnl;
                        let before_total = before.realized_pnl + before.unrealized_pnl;
                        mapped(self.projection.apply(&PortfolioEvent {
                            event_id: format!("x04-fill:{}", fill.fill_id),
                            sequence: self.projection.last_sequence() + 1,
                            occurred_at: fill.filled_at,
                            kind: PortfolioEventKind::Fill(FillEvent {
                                account_id: p.intent.account_id,
                                symbol: fill.symbol.clone(),
                                side: if p.intent.side == Side::Buy {
                                    FillSide::Buy
                                } else {
                                    FillSide::Sell
                                },
                                quantity,
                                price,
                                fee,
                            }),
                        }))?;
                        self.input =
                            mapped(self.projection.risk_snapshot(p.intent.account_id, now, 60))?;
                        self.financials.realized_pnl_today +=
                            self.input.portfolio.realized_pnl - before_realized;
                        self.financials.equity += (self.input.portfolio.realized_pnl
                            + self.input.portfolio.unrealized_pnl)
                            - before_total;
                        self.financials.as_of = now;
                        self.financials.source_ref = digest(&json!([
                            self.financials.source_ref,
                            fill.fill_id,
                            self.input.input_hash
                        ]));
                        self.applied_fills.insert(fill.fill_id.clone());
                        Ok(())
                    })();
                    if result.is_err() {
                        self.poisoned = true;
                        return Err(Fault::unavailable());
                    }
                }
                self.orders.insert(orderid, pid);
                let order = self.order(orderid, now)?;
                self.event(&format!("/v1/orders/{orderid}/stream"), order, now)?;
                (
                    StatusCode::ACCEPTED,
                    json!({"jobId":orderid,"status":"accepted"}),
                )
            } else {
                if resource != Some(orderid) || !self.orders.contains_key(&orderid) {
                    return Err(Fault::hidden());
                }
                mapped(self.gateway.cancel(a, cmd, key, now))?;
                let order = self.order(orderid, now)?;
                self.event(&format!("/v1/orders/{orderid}/stream"), order, now)?;
                (
                    StatusCode::ACCEPTED,
                    json!({"jobId":orderid,"status":"cancel_requested"}),
                )
            }
        } else {
            return Err(Fault::hidden());
        };
        out["correlationId"] = json!(correlation);
        out["auditRef"] = json!(stable_id(&format!("execution-audit:{replaykey}")));
        if let Some(proof) = proof {
            self.used_proofs.insert(proof, now);
        }
        self.inflight.remove(&replaykey);
        self.replays.insert(
            replaykey,
            Replay {
                intent,
                status,
                body: out.clone(),
            },
        );
        Ok((status, out))
    }
}

pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
    write: axum::routing::MethodRouter<S>,
) -> Router<S> {
    let mut r = Router::new();
    for p in [
        "/v1/portfolio",
        "/v1/risk",
        "/v1/portfolio/stream",
        "/v1/proposals",
        "/v1/proposals/:proposalId",
        "/v1/proposals/:proposalId/stream",
        "/v1/approvals",
        "/v1/approvals/:approvalId",
        "/v1/orders",
        "/v1/orders/:orderId",
        "/v1/orders/:orderId/stream",
        "/v1/order-capabilities",
        "/v1/trade-preflight",
        "/v1/trade-preflight/stream",
    ] {
        r = r.route(p, read.clone());
    }
    for p in [
        "/v1/risk/kill-switch/engage",
        "/v1/risk/kill-switch/release",
        "/v1/proposals/:proposalId/risk-evaluations",
        "/v1/approvals/:approvalId/decisions",
        "/v1/commands",
        "/v1/orders/:orderId/cancel-requests",
    ] {
        r = r.route(p, write.clone());
    }
    r
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(get(reference), post(reference))
}
pub(crate) fn output(status: StatusCode, body: Value) -> Response {
    if let Some(events) = body.get("events").and_then(Value::as_array) {
        let text = events
            .iter()
            .map(|v| format!("id: {}\nevent: message\ndata: {}\n\n", v["sequence"], v))
            .collect::<String>();
        let mut r = (
            status,
            [
                ("content-type", "text/event-stream"),
                ("cache-control", "no-store"),
            ],
            text,
        )
            .into_response();
        r.headers_mut().insert(
            "x-correlation-id",
            Uuid::now_v7().to_string().parse().unwrap(),
        );
        r
    } else {
        crate::response(status, body, &Uuid::now_v7().to_string())
    }
}
use axum::response::IntoResponse;
async fn reference(
    State(data): State<Arc<Mutex<crate::ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    method: Method,
    headers: HeaderMap,
    input: Bytes,
) -> Response {
    if let Err(r) = crate::authenticate(&headers, &data).await {
        return r;
    }
    let session = crate::cookies(&headers)
        .get("quantos_session")
        .copied()
        .unwrap_or("")
        .to_owned();
    if method == Method::POST {
        let cookies = crate::cookies(&headers);
        if cookies.get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN)
        {
            return forbidden().response();
        }
    }
    let mut state = data.lock().await;
    let now = state.now();
    let elapsed = state.clock_offset;
    let body: Value = if input.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&input) {
            Ok(v) => v,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let privileged = uri.path().contains("kill-switch") || uri.path().ends_with("/decisions");
    let proof = if privileged {
        let c = body["mfaChallengeRef"]
            .as_str()
            .and_then(|id| state.challenges.get(id));
        let grant = body["reauthTokenRef"]
            .as_str()
            .and_then(|id| state.reauth_grants.get(id));
        match (c, grant) {
            (Some(c), Some(g))
                if c.session == session
                    && g.session == session
                    && body["mfaChallengeRef"].as_str() == Some(g.challenge_ref.as_str())
                    && c.consumed
                    && c.verified_at.is_some()
                    && c.expires_at > now
                    && g.expires_at > now =>
            {
                Some(format!("{session}:{}", body["reauthTokenRef"]))
            }
            _ => None,
        }
    } else {
        None
    };
    let proof = proof.filter(|p| !state.consumed_step_proofs.contains(p));
    let strategy_auth = crate::strategy::reference_auth(&session);
    let linked = if uri.path() == "/v1/approvals" {
        match state
            .strategy
            .as_ref()
            .map(|s| s.checked_approvals(&strategy_auth, now))
            .transpose()
        {
            Ok(rows) => rows.unwrap_or_default(),
            Err(e) => return e.response(),
        }
    } else {
        Vec::new()
    };
    let strategy_approval = uri.path().starts_with("/v1/approvals/")
        && uri
            .path()
            .split('/')
            .nth(3)
            .and_then(|s| Uuid::parse_str(s).ok())
            .is_some_and(|id| state.strategy.as_ref().is_some_and(|s| s.owns_approval(id)));
    let service = state
        .execution
        .get_or_insert_with(ExecutionService::reference);
    let mut auth = service.auth.clone();
    match session.as_str() {
        crate::CURRENT_SESSION => {}
        "session-approver" => {
            auth.actor_id = reference_actor(&session);
            auth.role = Role::Approver;
        }
        "session-owner" => {
            auth.actor_id = reference_actor(&session);
            auth.role = Role::Owner;
        }
        _ => auth.role = Role::Viewer,
    };
    let now = Utc::now() + elapsed;
    service.linked_approvals = linked;
    let consumed_proof = proof.clone();
    let result = if strategy_approval {
        state.strategy.as_mut().unwrap().handle(
            &strategy_auth,
            &session,
            &method,
            uri.path(),
            &q,
            &headers,
            &body,
            proof,
            now,
        )
    } else {
        service.handle(
            &auth,
            &session,
            &method,
            uri.path(),
            &q,
            &headers,
            &body,
            proof,
            now,
        )
    };
    match result {
        Ok((status, v)) => {
            if let Some(proof) = consumed_proof {
                state.consumed_step_proofs.insert(proof);
            }
            if method == Method::POST
                && !state.audits.iter().any(|a| a["auditRef"] == v["auditRef"])
            {
                let correlation = v["correlationId"]
                    .as_str()
                    .unwrap_or(crate::AUDIT_CORRELATION);
                crate::record_audit_action(
                    &mut state,
                    uri.path(),
                    correlation,
                    uri.path(),
                    json!({"operation":uri.path(),"actor":auth.actor_id,"outcome":"accepted","decision":body["decision"],"reason":body["reason"]}),
                );
                if let Some(last) = state.audits.last_mut() {
                    let original = last["auditRef"].clone();
                    if last["causationId"] == original {
                        last["causationId"] = v["auditRef"].clone();
                    }
                    last["auditRef"] = v["auditRef"].clone();
                    last["eventId"] = v["auditRef"].clone();
                    last["actor"] = json!(auth.actor_id);
                    last["route"] = json!(uri.path());
                }
            }
            output(status, v)
        }
        Err(e) => {
            let correlation = Uuid::now_v7().to_string();
            if method == Method::POST {
                crate::record_audit_action(
                    &mut state,
                    "execution.denied",
                    &correlation,
                    uri.path(),
                    json!({"operation":uri.path(),"actor":auth.actor_id,"outcome":e.1}),
                );
            }
            let mut body = json!({"code":e.1,"message":"Execution request refused.","correlationId":correlation});
            if e.1 == "VERSION_CONFLICT" {
                body["currentVersion"] = if strategy_approval {
                    state
                        .strategy
                        .as_ref()
                        .and_then(|s| s.current(&strategy_auth, uri.path()))
                        .map(|v| v["objectVersion"].clone())
                        .unwrap_or(Value::Null)
                } else {
                    json!(
                        state
                            .execution
                            .as_ref()
                            .and_then(|s| s.current_version(uri.path()))
                    )
                };
            }
            crate::response(e.0, body, &correlation)
        }
    }
}

pub(crate) async fn reference_step_guard(
    headers: &HeaderMap,
    data: &Arc<Mutex<crate::ProviderData>>,
) -> std::result::Result<(), Response> {
    let session = crate::cookies(headers).get("quantos_session").copied();
    if matches!(session, Some("session-approver" | "session-owner")) {
        crate::authenticate(headers, data).await?;
        if crate::cookies(headers).get("quantos_csrf").copied() != Some(crate::CSRF_TOKEN)
            || headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) != Some(crate::CSRF_TOKEN)
            || headers.get("origin").and_then(|v| v.to_str().ok()) != Some(crate::ALLOWED_ORIGIN)
        {
            return Err(forbidden().response());
        }
        Ok(())
    } else {
        crate::mutation_guard(headers, data).await
    }
}

#[cfg(test)]
mod tests;
