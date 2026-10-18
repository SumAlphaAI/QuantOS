//! C15 owns read projections and controlled re-evaluation over X05. Only an
//! owner can supply books; HTTP never accepts balances, closures or source data.
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
use quantos_policy::RunMode;
use quantos_reconcile::{
    exceptions::ReconciliationService,
    model::Scope,
    reconciliation::{Input, Report, offline_check},
};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
#[derive(Clone)]
struct Run {
    report: Report,
    page: Value,
    stream: Uuid,
    events: Vec<Value>,
}
#[derive(Clone)]
struct Replay {
    intent: String,
    body: Value,
}
#[derive(Clone)]
struct Cursor {
    binding: String,
    rows: Vec<Value>,
    offset: usize,
    expires: DateTime<Utc>,
}
pub struct ReconciliationHost {
    scope: Scope,
    core: ReconciliationService,
    input: Input,
    runs: BTreeMap<Uuid, Run>,
    replays: BTreeMap<String, Replay>,
    cursors: BTreeMap<Uuid, Cursor>,
    pub(crate) poisoned: bool,
}
impl std::fmt::Debug for ReconciliationHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ReconciliationHost(trusted-input,process-local,no-submit)")
    }
}
fn fault(n: u16, c: &'static str) -> Fault {
    Fault(StatusCode::from_u16(n).unwrap(), c)
}
fn core_error(e: quantos_reconcile::model::Error) -> Fault {
    use quantos_reconcile::model::Error;
    match e {
        Error::Unauthorized => fault(403, "FORBIDDEN"),
        Error::Conflict | Error::Transition => fault(409, "RECONCILIATION_CONFLICT"),
        Error::Unavailable => Fault::unavailable(),
        _ => Fault::invalid(),
    }
}
fn evidence(kind: &str, id: impl ToString, source: &str, resolution: &str) -> Value {
    json!({"kind":kind,"ref":id.to_string(),"sourceRef":source,"resolution":resolution})
}
fn source_refs(input: &Input) -> Vec<Value> {
    let mut refs = vec![];
    for book in [&input.expected, &input.actual] {
        for o in &book.orders {
            refs.push(evidence(
                "order",
                &o.order_id,
                &book.source_ref,
                "source_record",
            ));
        }
        for f in &book.fills {
            refs.push(evidence(
                "fill",
                &f.fill_id,
                &book.source_ref,
                "source_record",
            ));
        }
    }
    refs
}
fn frame(stream: Uuid, sequence: usize, page: &Value, now: DateTime<Utc>) -> Value {
    json!({"streamId":stream,"sequence":sequence,"eventId":Uuid::now_v7(),"occurredAt":now,"correlationId":page["correlationId"],"payloadVersion":"v1","payload":page})
}
impl ReconciliationHost {
    pub fn new(
        a: &AuthContext,
        input: Input,
        now: DateTime<Utc>,
    ) -> std::result::Result<Self, quantos_reconcile::model::Error> {
        input.scope.authorize(a)?;
        let core = ReconciliationService::new(input.scope.clone())?;
        let report = core.run(a, "owner-initial", &input, now)?;
        let mut host = Self {
            scope: input.scope.clone(),
            core,
            input,
            runs: BTreeMap::new(),
            replays: BTreeMap::new(),
            cursors: BTreeMap::new(),
            poisoned: false,
        };
        host.insert(report, None, Uuid::new_v4());
        Ok(host)
    }
    /// Trusted source renewal, not a route. A browser cannot invoke this seam.
    pub fn replace_input(
        &mut self,
        a: &AuthContext,
        input: Input,
        now: DateTime<Utc>,
    ) -> std::result::Result<(), quantos_reconcile::model::Error> {
        self.scope.authorize(a)?;
        if input.scope != self.scope {
            return Err(quantos_reconcile::model::Error::Unauthorized);
        }
        offline_check(&input, now)?;
        self.input = input;
        Ok(())
    }
    /// X05 owner transitions remain X05 CAS/closure-proof operations, never edit-ledger HTTP.
    pub fn service(&self) -> ReconciliationService {
        self.core.clone()
    }
    pub(crate) fn current_version(&self, a: &AuthContext, path: &str) -> Option<String> {
        self.scope.authorize(a).ok()?;
        if self.poisoned {
            return None;
        }
        let id = Uuid::parse_str(path.split('/').nth(4)?).ok()?;
        self.runs.get(&id)?.page["objectVersion"]
            .as_str()
            .map(str::to_owned)
    }
    /// Owner observation feed only; never a page route or a browser Book.
    pub fn observe(
        &mut self,
        a: &AuthContext,
        input: Input,
        now: DateTime<Utc>,
    ) -> std::result::Result<Uuid, quantos_reconcile::model::Error> {
        self.scope.authorize(a)?;
        if self.poisoned {
            return Err(quantos_reconcile::model::Error::Unavailable);
        }
        if input.scope != self.scope {
            return Err(quantos_reconcile::model::Error::Unauthorized);
        }
        if self.runs.len() >= 1000 {
            return Err(quantos_reconcile::model::Error::Invalid("lease capacity"));
        }
        let key = format!("owner-{}", Uuid::new_v4());
        let report = self.core.run(a, &key, &input, now)?;
        let day = input.day;
        self.input = input;
        let id = self.insert(report, None, Uuid::new_v4());
        self.invalidate_day(day, now);
        Ok(id)
    }
    fn invalidate_day(&mut self, day: chrono::NaiveDate, now: DateTime<Utc>) {
        for r in self
            .runs
            .values_mut()
            .filter(|r| r.report.input().day == day)
        {
            if r.page["provisional"] == false {
                r.page["provisional"] = json!(true);
                r.events
                    .push(frame(r.stream, r.events.len() + 1, &r.page, now));
            }
        }
    }
    fn insert(&mut self, report: Report, audit: Option<Uuid>, correlation: Uuid) -> Uuid {
        let id = Uuid::new_v4();
        let i = report.input();
        let mut refs = source_refs(i);
        if let Some(a) = audit {
            refs.push(evidence("audit", a, "quantos-bff-f05", "bff_audit"));
        }
        let page = json!({"runId":id,"day":i.day,"accountId":self.scope.account_id,"mode":"shadow","currency":self.scope.quote_unit,"status":"succeeded","result":if report.is_clean(){"clean"}else{"differences"},"objectVersion":"0","reportHash":report.id(),"inputHash":digest(&json!(i)),"asOf":report.checked_at(),"expiresAt":i.expected.captured_at.min(i.actual.captured_at)+Duration::seconds(i.max_age_seconds),"provisional":true,"breakCount":report.differences().len(),"correlationId":correlation,"auditRef":audit,"evidenceRefs":refs});
        let stream = Uuid::new_v4();
        let event = frame(stream, 1, &page, report.checked_at());
        self.runs.insert(
            id,
            Run {
                report,
                page,
                stream,
                events: vec![event],
            },
        );
        id
    }
    fn refresh_closure(&mut self, a: &AuthContext, now: DateTime<Utc>) -> Result<()> {
        for r in self.runs.values_mut() {
            let proof = self
                .core
                .closed_day_report(a, r.report.input().day)
                .map_err(core_error)?;
            let expired =
                DateTime::parse_from_rfc3339(r.page["expiresAt"].as_str().unwrap()).unwrap() <= now;
            let provisional =
                expired || !r.report.is_clean() || proof.as_ref() != Some(r.report.id());
            if r.page["provisional"] != provisional {
                r.page["provisional"] = json!(provisional);
                r.events
                    .push(frame(r.stream, r.events.len() + 1, &r.page, now));
            }
        }
        Ok(())
    }
    fn run(&self, id: Uuid, now: DateTime<Utc>) -> Result<Value> {
        let r = self.runs.get(&id).ok_or_else(Fault::hidden)?;
        let mut page = r.page.clone();
        let expired =
            DateTime::parse_from_rfc3339(page["expiresAt"].as_str().unwrap()).unwrap() <= now;
        page["provisional"] = json!(page["provisional"] == true || expired);
        Ok(page)
    }
    fn breaks(&self, a: &AuthContext) -> Result<Vec<Value>> {
        let mut rows = vec![];
        for e in self.core.records(a).map_err(core_error)? {
            let r = self
                .runs
                .iter()
                .find(|(_, r)| r.report.id() == &e.last_report)
                .or_else(|| {
                    self.runs
                        .iter()
                        .find(|(_, r)| r.report.input().day == e.day)
                });
            let Some((id, r)) = r else {
                return Err(Fault::unavailable());
            };
            let d = self
                .runs
                .values()
                .flat_map(|r| r.report.differences())
                .find(|d| d.kind == e.kind && d.entity == e.entity)
                .ok_or_else(Fault::unavailable)?;
            let mut refs = source_refs(r.report.input());
            refs.push(evidence(
                "alert",
                &e.exception_id,
                "quantos-x05-exceptions",
                "x05_exception",
            ));
            if let Some(audit) = r.page["auditRef"].as_str() {
                refs.push(evidence("audit", audit, "quantos-bff-f05", "bff_audit"));
            }
            rows.push(json!({"breakId":e.exception_id,"runId":id,"day":e.day,"accountId":self.scope.account_id,"mode":"shadow","kind":format!("{:?}",e.kind),"entity":e.entity,"status":e.status,"objectVersion":e.revision.to_string(),"expectedJson":d.expected.to_string(),"actualJson":d.actual.to_string(),"expectedSource":e.expected_source,"actualSource":e.actual_source,"detectedAt":e.first_detected_at,"lastDetectedAt":e.last_detected_at,"closureReportHash":e.closure_report,"evidenceRefs":refs}));
        }
        Ok(rows)
    }
    fn ledger(&self) -> Vec<Value> {
        let mut rows = vec![];
        for (id, r) in &self.runs {
            for (side, book) in [
                ("expected", &r.report.input().expected),
                ("actual", &r.report.input().actual),
            ] {
                let mut refs: Vec<Value> =
                    book.orders
                        .iter()
                        .map(|o| evidence("order", &o.order_id, &book.source_ref, "source_record"))
                        .chain(book.fills.iter().map(|f| {
                            evidence("fill", &f.fill_id, &book.source_ref, "source_record")
                        }))
                        .collect();
                if let Some(audit) = r.page["auditRef"].as_str() {
                    refs.push(evidence("audit", audit, "quantos-bff-f05", "bff_audit"));
                }
                let mut push = |kind: &str, identity: Value, amounts: Value, at: DateTime<Utc>| {
                    rows.push(json!({"entryId":digest(&json!([id,side,kind,identity,book.content_hash()])),"runId":id,"day":r.report.input().day,"accountId":self.scope.account_id,"mode":"shadow","currency":self.scope.quote_unit,"kind":kind,"side":side,"ledgerVersion":book.revision.to_string(),"sourceRef":book.source_ref,"sourceHash":book.content_hash(),"asOf":at,"amounts":amounts,"evidenceRefs":refs}));
                };
                push(
                    "snapshot",
                    json!(book.ledger.sequence),
                    json!({"cash":book.ledger.cash.to_string(),"realizedPnl":book.ledger.realized_pnl.to_string(),"unrealizedPnl":book.ledger.unrealized_pnl.to_string(),"exposureGross":book.ledger.exposure_gross.to_string()}),
                    book.captured_at,
                );
                for f in &book.fills {
                    push(
                        "fill",
                        json!(f.fill_id),
                        json!({"quantity":f.quantity.to_string(),"price":f.price.to_string(),"fee":f.fee.to_string()}),
                        f.at,
                    )
                }
            }
        }
        rows
    }
    fn page(
        &mut self,
        a: &AuthContext,
        session: &str,
        path: &str,
        q: &BTreeMap<String, String>,
        mut rows: Vec<Value>,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        let size = q
            .get("pageSize")
            .map(|v| v.parse::<usize>())
            .transpose()
            .map_err(|_| Fault::invalid())?
            .unwrap_or(50);
        if !(1..=200).contains(&size) {
            return Err(Fault::invalid());
        }
        let mut query = q.clone();
        let cursor = query.remove("cursor");
        let binding = digest(&json!([
            a.tenant_id,
            a.workspace_id,
            a.actor_id,
            a.account_id,
            a.mode.as_str(),
            format!("{:?}", a.role),
            a.capabilities
                .iter()
                .map(|v| v.as_str())
                .collect::<Vec<_>>(),
            session,
            path,
            query
        ]));
        self.cursors.retain(|_, c| c.expires > now);
        let key = if path.ends_with("runs") {
            "runId"
        } else if path.ends_with("breaks") {
            "breakId"
        } else {
            "entryId"
        };
        let (rows, start) = if let Some(token) = cursor {
            let id = Uuid::parse_str(&token).map_err(|_| Fault::invalid())?;
            let c = self
                .cursors
                .get(&id)
                .ok_or_else(|| fault(409, "CURSOR_EXPIRED"))?;
            if c.binding != binding {
                return Err(fault(409, "CURSOR_SCOPE_CONFLICT"));
            }
            (c.rows.clone(), c.offset)
        } else {
            if let Some(status) = q.get("status") {
                rows.retain(|r| r["status"].as_str() == Some(status))
            }
            for key in ["kind", "side", "day"] {
                if let Some(value) = q.get(key) {
                    rows.retain(|r| r[key].as_str() == Some(value));
                }
            }
            if let Some(id) = q.get("runId") {
                rows.retain(|r| r["runId"].as_str() == Some(id))
            }
            rows.sort_by_key(|r| r[key].as_str().unwrap().to_owned());
            if q.get("sort").map(String::as_str) == Some("id:desc") {
                rows.reverse()
            }
            (rows, 0)
        };
        let end = (start + size).min(rows.len());
        let next = if end < rows.len() {
            if self.cursors.len() >= 1000 {
                return Err(fault(429, "CURSOR_LIMIT"));
            }
            let id = Uuid::new_v4();
            self.cursors.insert(
                id,
                Cursor {
                    binding,
                    rows: rows.clone(),
                    offset: end,
                    expires: now + Duration::minutes(5),
                },
            );
            Some(id)
        } else {
            None
        };
        let mut items = rows[start..end].to_vec();
        for item in &mut items {
            if item["expiresAt"]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .is_some_and(|t| t <= now)
            {
                item["provisional"] = json!(true);
            }
        }
        Ok(json!({"items":items,"nextCursor":next}))
    }
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn handle(
        &mut self,
        a: &AuthContext,
        session: &str,
        m: &Method,
        path: &str,
        q: &BTreeMap<String, String>,
        h: &HeaderMap,
        b: &Value,
        now: DateTime<Utc>,
    ) -> Result<(StatusCode, Value)> {
        self.scope.authorize(a).map_err(core_error)?;
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        if let Some(account) = q.get("accountId")
            && account != &self.scope.account_id.to_string()
        {
            return Err(Fault::hidden());
        }
        self.refresh_closure(a, now)?;
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        let parse = |s: &str| Uuid::parse_str(s).map_err(|_| Fault::invalid());
        let write = m == Method::POST;
        let correlation = h
            .get("x-request-id")
            .and_then(|s| s.to_str().ok())
            .map(parse)
            .transpose()?
            .unwrap_or_else(Uuid::new_v4);
        if write {
            if !matches!(
                parts.as_slice(),
                ["v1", "reconciliation", "runs", _, "reruns"]
            ) {
                return Err(Fault::hidden());
            }
            if b.as_object().is_none_or(|v| v.len() != 1)
                || b["reason"]
                    .as_str()
                    .is_none_or(|s| s.trim().is_empty() || s.chars().count() > 256)
            {
                return Err(Fault::invalid());
            }
            let key = h
                .get("idempotency-key")
                .and_then(|v| v.to_str().ok())
                .map(parse)
                .transpose()?
                .ok_or_else(Fault::invalid)?;
            let version = h
                .get("if-match")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| fault(409, "VERSION_CONFLICT"))?;
            let replay = digest(&json!([a.actor_id, session, path, key]));
            let intent = digest(&json!([b, version]));
            if let Some(r) = self.replays.get(&replay) {
                if r.intent != intent {
                    return Err(fault(409, "IDEMPOTENCY_CONFLICT"));
                }
                return Ok((StatusCode::ACCEPTED, r.body.clone()));
            }
            if self.runs.len() >= 1000 || self.replays.len() >= 1000 {
                return Err(fault(429, "LEASE_CAPACITY"));
            }
            let parent = parse(parts[3])?;
            let current = self.run(parent, now)?;
            if current["objectVersion"].as_str() != Some(version) {
                return Err(fault(409, "VERSION_CONFLICT"));
            }
            let i = &self.input;
            if i.day != self.runs[&parent].report.input().day {
                return Err(fault(409, "RECONCILIATION_WINDOW_CHANGED"));
            }
            if now < i.available_at
                || [&i.expected, &i.actual]
                    .iter()
                    .any(|book| now - book.captured_at > Duration::seconds(i.max_age_seconds))
            {
                return Err(fault(409, "STALE_RECONCILIATION_SOURCE"));
            }
            let next_version = version
                .parse::<u64>()
                .ok()
                .and_then(|v| v.checked_add(1))
                .ok_or_else(Fault::invalid)?;
            let report = self.core.run(a, &replay, i, now).map_err(core_error)?;
            let audit = Uuid::now_v7();
            let day = report.input().day;
            let id = self.insert(report, Some(audit), correlation);
            self.invalidate_day(day, now);
            let p = self.runs.get_mut(&parent).unwrap();
            p.page["objectVersion"] = json!(next_version.to_string());
            p.events
                .push(frame(p.stream, p.events.len() + 1, &p.page, now));
            let body = json!({"jobId":id,"status":"accepted","correlationId":correlation,"auditRef":audit});
            self.replays.insert(
                replay,
                Replay {
                    intent,
                    body: body.clone(),
                },
            );
            return Ok((StatusCode::ACCEPTED, body));
        }
        let body = match parts.as_slice() {
            ["v1", "reconciliation", "runs"] => {
                let rows = self
                    .runs
                    .keys()
                    .map(|id| self.run(*id, now))
                    .collect::<Result<Vec<_>>>()?;
                self.page(a, session, path, q, rows, now)?
            }
            ["v1", "reconciliation", "runs", id] => self.run(parse(id)?, now)?,
            ["v1", "reconciliation", "runs", id, "stream"] => {
                let id = parse(id)?;
                let r = self.runs.get(&id).ok_or_else(Fault::hidden)?;
                let after = q
                    .get("afterSequence")
                    .map(|v| v.parse::<usize>())
                    .transpose()
                    .map_err(|_| Fault::invalid())?
                    .unwrap_or(0);
                if after > r.events.len() {
                    return Err(fault(409, "STREAM_GAP"));
                }
                if DateTime::parse_from_rfc3339(r.page["expiresAt"].as_str().unwrap()).unwrap()
                    <= now
                {
                    return Err(fault(409, "SOURCE_LEASE_EXPIRED"));
                }
                json!({"events":r.events.iter().skip(after).cloned().collect::<Vec<_>>()})
            }
            ["v1", "reconciliation", "breaks"] => {
                let rows = self.breaks(a)?;
                self.page(a, session, path, q, rows, now)?
            }
            ["v1", "reconciliation", "breaks", id] => {
                let decoded = percent_encoding::percent_decode_str(id)
                    .decode_utf8()
                    .map_err(|_| Fault::invalid())?;
                self.breaks(a)?
                    .into_iter()
                    .find(|v| v["breakId"] == decoded.as_ref())
                    .ok_or_else(Fault::hidden)?
            }
            ["v1", "ledger", "entries"] => {
                let rows = self.ledger();
                self.page(a, session, path, q, rows, now)?
            }
            _ => return Err(Fault::hidden()),
        };
        Ok((StatusCode::OK, body))
    }
}
pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
    write: axum::routing::MethodRouter<S>,
) -> Router<S> {
    Router::new()
        .route("/v1/reconciliation/runs", read.clone())
        .route("/v1/reconciliation/runs/:runId", read.clone())
        .route("/v1/reconciliation/runs/:runId/reruns", write)
        .route("/v1/reconciliation/runs/:runId/stream", read.clone())
        .route("/v1/reconciliation/breaks", read.clone())
        .route("/v1/reconciliation/breaks/:breakId", read.clone())
        .route("/v1/ledger/entries", read)
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(get(reference), post(reference))
}
fn reference_auth(session: &str) -> AuthContext {
    let mut a = crate::strategy::reference_auth(session);
    a.mode = RunMode::Shadow;
    a.capabilities.clear();
    if matches!(
        a.role,
        quantos_policy::Role::Owner | quantos_policy::Role::Operator
    ) {
        a.capabilities.insert(
            quantos_policy::Capability::parse(quantos_policy::Capability::EXECUTION_OPERATE)
                .unwrap(),
        );
    }
    a
}
async fn reference(
    State(data): State<Arc<Mutex<crate::ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    m: Method,
    h: HeaderMap,
    bytes: Bytes,
) -> Response {
    if let Err(r) = crate::authenticate(&h, &data).await {
        return r;
    }
    if m != Method::GET
        && let Err(r) = crate::execution::reference_step_guard(&h, &data).await
    {
        return r;
    }
    let session = crate::cookies(&h)
        .get("quantos_session")
        .copied()
        .unwrap_or("")
        .to_owned();
    let a = reference_auth(&session);
    let b = if bytes.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&bytes) {
            Ok(b) => b,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let mut state = data.lock().await;
    if !state.reference_shadow {
        return fault(403, "CONTEXT_MODE_REQUIRED").response();
    }
    let now = state.now();
    if state.reconciliation.is_none() {
        let seed = fixture(&reference_auth(crate::CURRENT_SESSION), now);
        state.reconciliation = Some(
            ReconciliationHost::new(&reference_auth(crate::CURRENT_SESSION), seed, now).unwrap(),
        );
    }
    let result = state.reconciliation.as_mut().unwrap().handle(
        &a,
        &session,
        &m,
        uri.path(),
        &q,
        &h,
        &b,
        now,
    );
    match result {
        Ok((s, v)) => {
            if m == Method::POST && !state.audits.iter().any(|r| r["auditRef"] == v["auditRef"]) {
                crate::record_audit_action(
                    &mut state,
                    uri.path(),
                    v["correlationId"].as_str().unwrap(),
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":"accepted"}),
                );
                if let Some(e) = state.audits.last_mut() {
                    let old = e["auditRef"].clone();
                    if e["causationId"] == old {
                        e["causationId"] = v["auditRef"].clone()
                    }
                    e["auditRef"] = v["auditRef"].clone();
                    e["eventId"] = v["auditRef"].clone();
                    e["actor"] = json!(a.actor_id);
                    e["route"] = json!(uri.path());
                }
            }
            crate::execution::output(s, v)
        }
        Err(e) => {
            let c = Uuid::now_v7().to_string();
            if m == Method::POST {
                crate::record_audit_action(
                    &mut state,
                    "reconciliation.denied",
                    &c,
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":e.1}),
                );
            }
            let mut v =
                json!({"code":e.1,"message":"Reconciliation request refused.","correlationId":c});
            if e.1 == "VERSION_CONFLICT"
                && let Some(version) = state
                    .reconciliation
                    .as_ref()
                    .and_then(|s| s.current_version(&a, uri.path()))
            {
                v["currentVersion"] = json!(version);
            }
            if e.0 == StatusCode::TOO_MANY_REQUESTS {
                v["retryAfter"] = json!(60);
            }
            let mut response = crate::response(e.0, v, &c);
            if e.0 == StatusCode::TOO_MANY_REQUESTS {
                response
                    .headers_mut()
                    .insert("retry-after", "60".parse().unwrap());
            }
            response
        }
    }
}
// Explicit synthetic input provider. Never called by live startup or live routes.
fn fixture(a: &AuthContext, now: DateTime<Utc>) -> Input {
    use quantos_reconcile::model::*;
    use rust_decimal::Decimal;
    let scope = Scope {
        tenant_id: a.tenant_id,
        workspace_id: a.workspace_id,
        account_id: a.account_id.unwrap(),
        quote_unit: "USD".into(),
    };
    let mut expected = Book {
        source_hash: quantos_core::ContentHash::sha256_bytes(b"owned-shadow"),
        source_ref: "owned-synthetic-shadow".into(),
        revision: 1,
        captured_at: now,
        seed: Seed::flat(Decimal::new(1000, 0)).unwrap(),
        orders: vec![],
        fills: vec![],
        positions: vec![],
        ledger: Ledger {
            cash: Decimal::new(1000, 0),
            realized_pnl: Decimal::ZERO,
            unrealized_pnl: Decimal::ZERO,
            exposure_gross: Decimal::ZERO,
            sequence: 0,
        },
    };
    expected.orders.push(Order {
        order_id: "owned-paper-order-1".into(),
        command_id: "owned-command-1".into(),
        symbol: "BTCUSD".into(),
        side: quantos_risk::guard::Side::Buy,
        quantity: Decimal::new(2, 0),
        filled_quantity: Decimal::new(2, 0),
        average_fill_price: Some(Decimal::new(100, 0)),
        status: OrderStatus::Filled,
    });
    expected.fills.push(Fill {
        fill_id: "owned-fill-1".into(),
        order_id: "owned-paper-order-1".into(),
        command_id: "owned-command-1".into(),
        symbol: "BTCUSD".into(),
        side: quantos_risk::guard::Side::Buy,
        quantity: Decimal::new(2, 0),
        price: Decimal::new(100, 0),
        fee: Decimal::ONE,
        sequence: 1,
        at: now,
    });
    expected.positions.push(Position {
        symbol: "BTCUSD".into(),
        quantity: Decimal::new(2, 0),
        average_entry_price: Decimal::new(100, 0),
        mark: Mark {
            symbol: "BTCUSD".into(),
            price: Decimal::new(110, 0),
            source_ref: "owned-synthetic-mark".into(),
            sequence: 1,
            source_at: now,
        },
        realized_pnl: -Decimal::ONE,
        unrealized_pnl: Decimal::new(20, 0),
    });
    expected.ledger = Ledger {
        cash: Decimal::new(799, 0),
        realized_pnl: -Decimal::ONE,
        unrealized_pnl: Decimal::new(20, 0),
        exposure_gross: Decimal::new(220, 0),
        sequence: 1,
    };
    let mut actual = expected.clone();
    actual.source_hash = quantos_core::ContentHash::sha256_bytes(b"owned-observed");
    actual.source_ref = "owned-synthetic-observed".into();
    actual.ledger.cash = Decimal::new(798, 0);
    Input {
        scope,
        day: now.date_naive(),
        available_at: now,
        expected,
        actual,
        max_age_seconds: 300,
        tolerance: Decimal::ZERO,
    }
}
#[cfg(test)]
mod tests;
