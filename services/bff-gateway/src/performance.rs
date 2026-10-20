//! C14: owner-injected X01 valuations pinned to C15 actual books. Simple returns
//! exclude opening fees and reject cash-flow/currency/method ambiguity. No venue IO.
use crate::reconciliation::ReconciliationHost;
use crate::research::{Fault, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use chrono::{DateTime, Datelike, Duration, Months, TimeZone, Utc};
use quantos_auth::AuthContext;
use quantos_portfolio::{InMemoryPortfolioProjection, PortfolioSnapshot};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
fn fault(n: u16, c: &'static str) -> Fault {
    Fault(StatusCode::from_u16(n).unwrap(), c)
}
fn num(v: Decimal) -> String {
    v.round_dp(18).normalize().to_string()
}
fn add(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_add(b).ok_or_else(Fault::invalid)
}
fn sub(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_sub(b).ok_or_else(Fault::invalid)
}
fn div(a: Decimal, b: Decimal) -> Result<Decimal> {
    a.checked_div(b)
        .ok_or_else(|| fault(409, "INVALID_RETURN_BASIS"))
}
#[derive(Clone)]
struct Point {
    run: Uuid,
    snapshot: PortfolioSnapshot,
}
struct Job {
    binding: String,
    frozen: Value,
    page: Value,
    bytes: Option<Vec<u8>>,
    expires: DateTime<Utc>,
}
struct Ticket {
    binding: String,
    report: Uuid,
    expires: DateTime<Utc>,
}
pub struct PerformanceHost {
    auth: AuthContext,
    points: Vec<Point>,
    jobs: BTreeMap<Uuid, Job>,
    replays: BTreeMap<String, (String, Value)>,
    tickets: BTreeMap<Uuid, Ticket>,
    pub(crate) poisoned: bool,
}
impl std::fmt::Debug for PerformanceHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("PerformanceHost(trusted-X01-C15,process-local)")
    }
}
impl PerformanceHost {
    pub fn new(auth: AuthContext) -> Self {
        Self {
            auth,
            points: vec![],
            jobs: BTreeMap::new(),
            replays: BTreeMap::new(),
            tickets: BTreeMap::new(),
            poisoned: false,
        }
    }
    fn authorize(&self, a: &AuthContext) -> Result<()> {
        if a.tenant_id != self.auth.tenant_id
            || a.workspace_id != self.auth.workspace_id
            || a.account_id != self.auth.account_id
            || a.mode != self.auth.mode
            || a.actor_id.as_uuid().is_nil()
            || !matches!(
                a.role,
                quantos_policy::Role::Owner
                    | quantos_policy::Role::Operator
                    | quantos_policy::Role::Service
            )
            || !a
                .capabilities
                .iter()
                .any(|c| c.as_str() == quantos_policy::Capability::EXECUTION_OPERATE)
        {
            return Err(fault(403, "FORBIDDEN"));
        }
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        Ok(())
    }
    fn binding(a: &AuthContext, session: &str) -> String {
        digest(&json!([
            a.tenant_id,
            a.workspace_id,
            a.account_id,
            a.actor_id,
            a.mode,
            a.role,
            a.capabilities,
            session
        ]))
    }
    /// Owner-only ingress; accepts an actual X01 projection, never browser metrics.
    pub fn observe(
        &mut self,
        a: &AuthContext,
        run: Uuid,
        projection: &InMemoryPortfolioProjection,
        reconciliation: &mut ReconciliationHost,
        now: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        self.observe_checked(a, run, projection, reconciliation, now)
            .map_err(|e| anyhow::anyhow!("{}", e.1))
    }
    fn observe_checked(
        &mut self,
        a: &AuthContext,
        run: Uuid,
        projection: &InMemoryPortfolioProjection,
        reconciliation: &mut ReconciliationHost,
        now: DateTime<Utc>,
    ) -> Result<()> {
        self.authorize(a)?;
        let snapshot = projection
            .snapshot(a.account_id.ok_or_else(Fault::invalid)?)
            .map_err(|_| Fault::invalid())?;
        let (i, _) = reconciliation.performance_source(a, run, now)?;
        snapshot.validate().map_err(|_| Fault::invalid())?;
        if snapshot.tenant_id != i.scope.tenant_id
            || snapshot.account_id != i.scope.account_id
            || snapshot.as_of != i.actual.captured_at
            || snapshot.positions.len() != i.actual.positions.len()
        {
            return Err(fault(409, "VALUATION_LEDGER_MISMATCH"));
        }
        for p in &snapshot.positions {
            let b = i
                .actual
                .positions
                .iter()
                .find(|b| b.symbol == p.symbol)
                .ok_or_else(|| fault(409, "VALUATION_LEDGER_MISMATCH"))?;
            for (x, y) in [
                (p.quantity, b.quantity),
                (p.average_entry_price, b.average_entry_price),
                (p.mark_price, b.mark.price),
                (p.realized_pnl, b.realized_pnl),
                (p.unrealized_pnl, b.unrealized_pnl),
            ] {
                if !y
                    .to_f64()
                    .is_some_and(|y| quantos_portfolio::approx_eq(x, y))
                {
                    return Err(fault(409, "VALUATION_LEDGER_MISMATCH"));
                }
            }
        }
        if let Some(old) = self.points.iter().find(|p| p.run == run) {
            if old.snapshot == snapshot {
                return Ok(());
            }
            return Err(fault(409, "VALUATION_VERSION_CONFLICT"));
        }
        if self.points.len() >= 1000 {
            return Err(fault(429, "LEASE_CAPACITY"));
        }
        if self
            .points
            .last()
            .is_some_and(|p| p.snapshot.as_of >= snapshot.as_of)
        {
            return Err(fault(409, "VALUATION_TIME_CONFLICT"));
        }
        self.points.push(Point { run, snapshot });
        Ok(())
    }
    fn window(
        q: &BTreeMap<String, String>,
        now: DateTime<Utc>,
    ) -> Result<(DateTime<Utc>, DateTime<Utc>, String, String)> {
        let parse = |s: &str| {
            DateTime::parse_from_rfc3339(s)
                .map(|t| t.with_timezone(&Utc))
                .map_err(|_| Fault::invalid())
        };
        let period = q.get("period").map(String::as_str).unwrap_or("week");
        let mode = q.get("periodMode").map(String::as_str).unwrap_or("rolling");
        if !["rolling", "calendar"].contains(&mode) {
            return Err(Fault::invalid());
        }
        let end = q.get("end").map(|s| parse(s)).transpose()?.unwrap_or(now);
        let start = if period == "custom" {
            parse(q.get("start").ok_or_else(Fault::invalid)?)?
        } else {
            if q.contains_key("start") {
                return Err(Fault::invalid());
            }
            let midnight = Utc.from_utc_datetime(&end.date_naive().and_hms_opt(0, 0, 0).unwrap());
            match (period, mode) {
                ("week", "rolling") => end - Duration::days(7),
                ("week", "calendar") => {
                    midnight - Duration::days(end.weekday().num_days_from_monday().into())
                }
                ("month" | "quarter" | "year", "rolling") => end
                    .checked_sub_months(Months::new(match period {
                        "month" => 1,
                        "quarter" => 3,
                        _ => 12,
                    }))
                    .ok_or_else(Fault::invalid)?,
                ("month" | "quarter" | "year", "calendar") => Utc
                    .with_ymd_and_hms(
                        end.year(),
                        match period {
                            "month" => end.month(),
                            "quarter" => ((end.month() - 1) / 3) * 3 + 1,
                            _ => 1,
                        },
                        1,
                        0,
                        0,
                        0,
                    )
                    .single()
                    .ok_or_else(Fault::invalid)?,
                _ => return Err(Fault::invalid()),
            }
        };
        if start >= end || end > now || end - start > Duration::days(366) {
            return Err(Fault::invalid());
        }
        Ok((start, end, period.into(), mode.into()))
    }
    fn calculate(
        &self,
        a: &AuthContext,
        q: &BTreeMap<String, String>,
        r: &mut ReconciliationHost,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        if q.keys().any(|k| {
            ![
                "accountId",
                "currency",
                "method",
                "period",
                "periodMode",
                "start",
                "end",
            ]
            .contains(&k.as_str())
        }) {
            return Err(Fault::invalid());
        }
        if q.get("accountId")
            .is_some_and(|s| Some(s.as_str()) != a.account_id.map(|id| id.to_string()).as_deref())
        {
            return Err(Fault::hidden());
        }
        if q.get("currency").is_some_and(|s| s != "USD") {
            return Err(fault(422, "UNSUPPORTED_CURRENCY"));
        }
        if q.get("method").is_some_and(|s| s != "simple") {
            return Err(fault(422, "UNSUPPORTED_METHOD"));
        }
        let (start, end, period, mode) = Self::window(q, now)?;
        let points = self
            .points
            .iter()
            .filter(|p| p.snapshot.as_of >= start && p.snapshot.as_of <= end)
            .collect::<Vec<_>>();
        if points.len() < 2 {
            return Err(fault(409, "INSUFFICIENT_COVERAGE"));
        }
        let mut rows = vec![];
        let mut books = vec![];
        let mut provisional = false;
        let mut peak = Decimal::ZERO;
        let mut max_draw = Decimal::ZERO;
        for p in &points {
            let (input, page) = r.performance_source(a, p.run, now)?;
            if input.scope.quote_unit != "USD" {
                return Err(fault(422, "UNSUPPORTED_CURRENCY"));
            }
            provisional |= page["provisional"] != false;
            let book = input.actual;
            let mut equity = book.ledger.cash;
            for position in &book.positions {
                equity = add(
                    equity,
                    position
                        .quantity
                        .checked_mul(position.mark.price)
                        .ok_or_else(Fault::invalid)?,
                )?;
            }
            if equity <= Decimal::ZERO {
                return Err(fault(409, "INVALID_RETURN_BASIS"));
            }
            peak = peak.max(equity);
            let draw = div(sub(peak, equity)?, peak)?;
            max_draw = max_draw.max(draw);
            let fees = book
                .fills
                .iter()
                .try_fold(Decimal::ZERO, |s, f| add(s, f.fee))?;
            rows.push(json!({"asOf":p.snapshot.as_of,"equity":num(equity),"cumulativeFees":num(fees),"drawdown":num(draw),"ledgerVersion":book.content_hash(),"valuationSnapshotId":p.snapshot.snapshot_hash,"reconciliationRunId":p.run,"provisional":page["provisional"]}));
            books.push((book, equity, fees));
        }
        let first = &books[0];
        let last = books.last().unwrap();
        for pair in books.windows(2) {
            if pair[0].0.seed != pair[1].0.seed {
                return Err(fault(422, "CASH_FLOW_UNSUPPORTED"));
            }
            if pair[0].0.source_ref != pair[1].0.source_ref
                || pair[0].0.revision > pair[1].0.revision
                || pair[0].0.fills.iter().any(|f| !pair[1].0.fills.contains(f))
            {
                return Err(fault(409, "LEDGER_HISTORY_CONFLICT"));
            }
        }
        let complete = points[0].snapshot.as_of == start
            && points.last().unwrap().snapshot.as_of == end
            && points
                .windows(2)
                .all(|p| p[1].snapshot.as_of - p[0].snapshot.as_of <= Duration::minutes(1));
        provisional |= !complete;
        let pnl = sub(last.1, first.1)?;
        let fees = sub(last.2, first.2)?;
        let mut attribution = vec![];
        let symbols = first
            .0
            .positions
            .iter()
            .chain(last.0.positions.iter())
            .map(|p| p.symbol.clone())
            .collect::<std::collections::BTreeSet<_>>();
        let mut attributed = Decimal::ZERO;
        for symbol in symbols {
            let value = |b: &quantos_reconcile::model::Book| -> Result<Decimal> {
                b.positions
                    .iter()
                    .filter(|p| p.symbol == symbol)
                    .try_fold(Decimal::ZERO, |v, p| {
                        add(v, add(p.realized_pnl, p.unrealized_pnl)?)
                    })
            };
            let delta = sub(value(&last.0)?, value(&first.0)?)?;
            attributed = add(attributed, delta)?;
            attribution.push(json!({"symbol":symbol,"pnl":num(delta)}));
        }
        attribution.push(json!({"symbol":"LEDGER_RESIDUAL","pnl":num(sub(pnl,attributed)?)}));
        Ok(
            json!({"accountId":a.account_id,"currency":"USD","method":"simple","period":period,"periodMode":mode,"asOf":points.last().unwrap().snapshot.as_of,"ledgerVersion":last.0.content_hash(),"valuationSnapshotId":points.last().unwrap().snapshot.snapshot_hash,"coverage":{"requestedStart":start,"requestedEnd":end,"start":points[0].snapshot.as_of,"end":points.last().unwrap().snapshot.as_of,"complete":complete,"points":points.len(),"maxIntervalSeconds":60},"provisional":provisional,"pnl":num(pnl),"return":num(div(pnl,first.1)?),"drawdown":num(max_draw),"fees":num(fees),"series":rows,"attribution":attribution,"precision":"X01-f64-validated-against-X05-Decimal; output-rounded-18dp","venueSubmit":false}),
        )
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
        r: &mut ReconciliationHost,
        now: DateTime<Utc>,
    ) -> Result<(StatusCode, Value)> {
        self.authorize(a)?;
        // Keep expired grants while their report is live so they still return 410.
        // Once a report expires, its own 410 check preserves that behavior and
        // its grants must stop consuming the bounded ticket lease.
        self.tickets.retain(|_, ticket| {
            self.jobs
                .get(&ticket.report)
                .is_some_and(|job| now < job.expires)
        });
        let binding = Self::binding(a, session);
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        if m == Method::POST {
            if path != "/v1/performance/reports" || !q.is_empty() {
                return Err(Fault::invalid());
            }
            let object = b.as_object().ok_or_else(Fault::invalid)?;
            let mut query = BTreeMap::new();
            for (k, v) in object {
                query.insert(k.clone(), v.as_str().ok_or_else(Fault::invalid)?.to_owned());
            }
            let key = h
                .get("idempotency-key")
                .and_then(|s| s.to_str().ok())
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or_else(Fault::invalid)?;
            let replay = digest(&json!([binding, key, path]));
            let intent = digest(b);
            if let Some((old, v)) = self.replays.get(&replay) {
                if old != &intent {
                    return Err(fault(409, "IDEMPOTENCY_CONFLICT"));
                }
                return Ok((StatusCode::ACCEPTED, v.clone()));
            }
            if self.jobs.len() >= 1000 {
                return Err(fault(429, "LEASE_CAPACITY"));
            }
            let frozen = self.calculate(a, &query, r, now)?;
            let id = Uuid::new_v4();
            let correlation = Uuid::new_v4();
            let audit = Uuid::now_v7();
            let expires = now + Duration::minutes(15);
            let page = json!({"reportId":id,"status":"queued","reportVersion":"1","accountId":frozen["accountId"],"currency":frozen["currency"],"method":frozen["method"],"period":frozen["period"],"periodMode":frozen["periodMode"],"asOf":frozen["asOf"],"coverage":frozen["coverage"],"ledgerVersion":frozen["ledgerVersion"],"valuationSnapshotId":frozen["valuationSnapshotId"],"provisional":frozen["provisional"],"createdAt":now,"expiresAt":expires,"correlationId":correlation,"auditRef":audit,"supersededBy":null});
            self.jobs.insert(
                id,
                Job {
                    binding,
                    frozen,
                    page: page.clone(),
                    bytes: None,
                    expires,
                },
            );
            self.replays.insert(replay, (intent, page.clone()));
            return Ok((StatusCode::ACCEPTED, page));
        }
        if matches!(
            parts.as_slice(),
            ["v1", "performance", "summary" | "series" | "attribution"]
        ) {
            return Ok((StatusCode::OK, self.calculate(a, q, r, now)?));
        }
        if !matches!(
            parts.as_slice(),
            ["v1", "performance", "reports", _]
                | [
                    "v1",
                    "performance",
                    "reports",
                    _,
                    "status" | "download" | "content"
                ]
        ) {
            return Err(Fault::hidden());
        }
        if q.keys().any(|k| k != "ticket") || (!path.ends_with("/content") && !q.is_empty()) {
            return Err(Fault::invalid());
        }
        let id = Uuid::parse_str(parts[3]).map_err(|_| Fault::invalid())?;
        let job = self.jobs.get_mut(&id).ok_or_else(Fault::hidden)?;
        if job.binding != binding {
            return Err(Fault::hidden());
        }
        if now >= job.expires {
            return Err(fault(410, "REPORT_EXPIRED"));
        }
        if path.ends_with("/status") && job.bytes.is_none() {
            job.page["status"] = json!("succeeded");
            let report = json!({"metadata":job.page,"performance":job.frozen});
            let bytes = serde_json::to_vec(&report).map_err(|_| Fault::invalid())?;
            job.bytes = Some(bytes);
            job.page["status"] = json!("succeeded");
        }
        if path.ends_with("/status") {
            return Ok((StatusCode::OK, job.page.clone()));
        }
        let bytes = job
            .bytes
            .as_ref()
            .ok_or_else(|| fault(409, "REPORT_NOT_READY"))?;
        if path.ends_with("/download") {
            if self.tickets.len() >= 1000 {
                return Err(fault(429, "LEASE_CAPACITY"));
            }
            let token = Uuid::new_v4();
            let expires = (now + Duration::seconds(60)).min(job.expires);
            self.tickets.insert(
                token,
                Ticket {
                    binding,
                    report: id,
                    expires,
                },
            );
            let mut out = job.page.clone();
            out["downloadPath"] = json!(format!(
                "/v1/performance/reports/{id}/content?ticket={token}"
            ));
            out["sha256"] = json!(quantos_core::ContentHash::sha256_bytes(bytes));
            out["sizeBytes"] = json!(bytes.len());
            out["mediaType"] = json!("application/json");
            out["downloadExpiresAt"] = json!(expires);
            return Ok((StatusCode::OK, out));
        }
        if path.ends_with("/content") {
            let token = q
                .get("ticket")
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or_else(Fault::hidden)?;
            let t = self.tickets.get(&token).ok_or_else(Fault::hidden)?;
            if t.binding != binding || t.report != id {
                return Err(Fault::hidden());
            }
            if now >= t.expires {
                return Err(fault(410, "DOWNLOAD_EXPIRED"));
            }
        }
        Ok((
            StatusCode::OK,
            serde_json::from_slice(bytes).map_err(|_| Fault::invalid())?,
        ))
    }
}
pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
    write: axum::routing::MethodRouter<S>,
) -> Router<S> {
    Router::new()
        .route("/v1/performance/summary", read.clone())
        .route("/v1/performance/series", read.clone())
        .route("/v1/performance/attribution", read.clone())
        .route("/v1/performance/reports", write)
        .route("/v1/performance/reports/:reportId", read.clone())
        .route("/v1/performance/reports/:reportId/status", read.clone())
        .route("/v1/performance/reports/:reportId/download", read.clone())
        .route("/v1/performance/reports/:reportId/content", read)
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(get(reference), post(reference))
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
    let a = crate::reconciliation::reference_auth(&session);
    let b = if bytes.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&bytes) {
            Ok(v) => v,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let mut state = data.lock().await;
    if !state.reference_shadow {
        return fault(403, "CONTEXT_MODE_REQUIRED").response();
    }
    let now = state.now();
    if state.performance.is_none() {
        match seed(
            &crate::reconciliation::reference_auth(crate::CURRENT_SESSION),
            now,
            state.reconciliation.take(),
        ) {
            Ok((host, r)) => {
                state.performance = Some(host);
                state.reconciliation = Some(r)
            }
            Err(e) => return e.response(),
        }
    }
    let crate::ProviderData {
        performance,
        reconciliation,
        ..
    } = &mut *state;
    let result = performance.as_mut().unwrap().handle(
        &a,
        &session,
        &m,
        uri.path(),
        &q,
        &h,
        &b,
        reconciliation.as_mut().unwrap(),
        now,
    );
    match result {
        Ok((s, v)) => {
            if m == Method::POST && !state.audits.iter().any(|r| r["auditRef"] == v["auditRef"]) {
                crate::record_audit_action(
                    &mut state,
                    "performance.report.create",
                    v["correlationId"].as_str().unwrap(),
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":"accepted"}),
                );
                if let Some(e) = state.audits.last_mut() {
                    e["eventId"] = v["auditRef"].clone();
                    e["auditRef"] = v["auditRef"].clone();
                    e["causationId"] = v["auditRef"].clone();
                }
            }
            output(s, v)
        }
        Err(e) => e.response(),
    }
}
pub(crate) fn output(s: StatusCode, v: Value) -> Response {
    let mut r = crate::response(s, v, &Uuid::now_v7().to_string());
    if s == StatusCode::TOO_MANY_REQUESTS {
        r.headers_mut().insert("retry-after", "60".parse().unwrap());
    }
    r
}
// Explicit synthetic reference composition only. Real live startup never calls it.
fn seed(
    a: &AuthContext,
    now: DateTime<Utc>,
    existing: Option<ReconciliationHost>,
) -> Result<(PerformanceHost, ReconciliationHost)> {
    use quantos_portfolio::{
        FillEvent, FillSide, MarkPriceEvent, PortfolioEvent, PortfolioEventKind,
    };
    let observed_at = now;
    let now = DateTime::from_timestamp(now.timestamp(), 0).unwrap();
    let mut host = PerformanceHost::new(a.clone());
    let first_revision = existing
        .as_ref()
        .map(ReconciliationHost::next_source_revision)
        .unwrap_or(1);
    let mut r = existing;
    for (index, mark) in [100i64, 110, 105].into_iter().enumerate() {
        let at = now - Duration::seconds((2 - index) as i64 * 60);
        let mut input = crate::reconciliation::fixture(a, at);
        for book in [&mut input.expected, &mut input.actual] {
            book.captured_at = at;
            book.revision = first_revision + index as u64;
            book.fills[0].at = now - Duration::minutes(2);
            book.positions[0].mark.price = Decimal::from(mark);
            book.positions[0].mark.source_at = at;
            book.positions[0].unrealized_pnl = Decimal::from(2 * (mark - 100));
            book.ledger.unrealized_pnl = book.positions[0].unrealized_pnl;
            book.ledger.exposure_gross = Decimal::from(2 * mark);
        }
        let run = if let Some(r) = &mut r {
            ReconciliationHost::observe(r, a, input, observed_at).map_err(|_| Fault::invalid())?
        } else {
            let next =
                ReconciliationHost::new(a, input, observed_at).map_err(|_| Fault::invalid())?;
            let id = next.latest_run().unwrap();
            r = Some(next);
            id
        };
        let projection = InMemoryPortfolioProjection::rebuild(
            a.tenant_id,
            now - Duration::minutes(2),
            &[
                PortfolioEvent {
                    event_id: "performance-fill".into(),
                    sequence: 1,
                    occurred_at: now - Duration::minutes(2),
                    kind: PortfolioEventKind::Fill(FillEvent {
                        account_id: a.account_id.unwrap(),
                        symbol: "BTCUSD".into(),
                        side: FillSide::Buy,
                        quantity: 2.,
                        price: 100.,
                        fee: 1.,
                    }),
                },
                PortfolioEvent {
                    event_id: format!("mark-{index}"),
                    sequence: 2,
                    occurred_at: at,
                    kind: PortfolioEventKind::MarkPrice(MarkPriceEvent {
                        symbol: "BTCUSD".into(),
                        price: mark as f64,
                    }),
                },
            ],
        )
        .map_err(|_| Fault::invalid())?;
        host.observe_checked(a, run, &projection, r.as_mut().unwrap(), observed_at)?;
    }
    Ok((host, r.unwrap()))
}
#[cfg(test)]
mod tests;
