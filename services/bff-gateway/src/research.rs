//! C03/C04 page semantics shared by the loopback fixture and persistent adapter.
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

pub(crate) type Result<T> = std::result::Result<T, Fault>;
#[derive(Debug)]
pub(crate) struct Fault(pub StatusCode, pub &'static str);
impl Fault {
    pub(crate) fn invalid() -> Self {
        Self(StatusCode::UNPROCESSABLE_ENTITY, "INVALID_REQUEST")
    }
    pub(crate) fn hidden() -> Self {
        Self(StatusCode::NOT_FOUND, "NOT_FOUND")
    }
    pub(crate) fn unavailable() -> Self {
        Self(StatusCode::SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE")
    }
    pub(crate) fn response(self) -> Response {
        if self.0 == StatusCode::TOO_MANY_REQUESTS {
            let correlation = Uuid::new_v4().to_string();
            let mut response = crate::response(
                self.0,
                json!({"code":self.1,"message":"Research request rate exceeded.","correlationId":correlation,"retryAfter":60}),
                &correlation,
            );
            response
                .headers_mut()
                .insert("retry-after", "60".parse().unwrap());
            response
        } else {
            crate::error(self.0, self.1, "Research request could not be completed.")
        }
    }
}
pub(crate) fn uuid(v: &str) -> Result<Uuid> {
    Uuid::parse_str(v).map_err(|_| Fault::invalid())
}
pub(crate) fn digest(v: &Value) -> String {
    ContentHash::sha256_bytes(&canonical_json_bytes(v).expect("JSON value")).to_string()
}
pub(crate) fn snapshot_window(start: DateTime<Utc>, end: DateTime<Utc>) -> Value {
    json!({"start":start,"end":end})
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Create {
    pub capability: String,
    pub data_snapshot_id: Uuid,
    pub question: String,
    pub budget: String,
    pub deadline_at: DateTime<Utc>,
    #[serde(default)]
    pub attachments: Vec<Uuid>,
}
impl Create {
    pub fn validate(&self, now: DateTime<Utc>) -> Result<u64> {
        let units = self.budget.parse::<u64>().map_err(|_| Fault::invalid())?;
        if !matches!(
            self.capability.as_str(),
            "research.hypothesis.v1" | "research.experiment.v1"
        ) || self.question.trim().is_empty()
            || self.question.len() > 8000
            || units == 0
            || units > 1_000_000
            || self.budget != units.to_string()
            || self.deadline_at <= now
            || self.deadline_at > now + Duration::hours(24)
            || self.attachments.len() > 16
        {
            return Err(Fault::invalid());
        }
        Ok(units)
    }
}
/// RD-Agent accepts prompt/fixture/tools, never an arbitrary attachments key.
/// Resolve authorized immutable content before constructing its bounded prompt.
pub(crate) fn engine_input(question: &str, attachments: &[Value]) -> Result<Value> {
    let mut prompt = question.to_owned();
    for content in attachments {
        prompt.push_str("\nAuthorized research attachment:\n");
        prompt.push_str(
            &String::from_utf8(canonical_json_bytes(content).map_err(|_| Fault::invalid())?)
                .map_err(|_| Fault::invalid())?,
        );
    }
    if prompt.len() > 8192 {
        return Err(Fault::invalid());
    }
    Ok(json!({"prompt":prompt}))
}
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ListQuery {
    pub cursor: Option<String>,
    pub page_size: Option<usize>,
    pub sort: Option<String>,
    pub filter: Option<String>,
    pub status: Option<String>,
    pub data_snapshot_id: Option<String>,
    pub quality: Option<String>,
    pub after_sequence: Option<u64>,
}
// Immutable materialized pages, actor/query-bound, bounded and short lived. A
// missing cursor (including after a process restart) explicitly requires refresh.
#[derive(Debug, Default)]
pub(crate) struct Pages(BTreeMap<String, (String, Vec<Value>, usize, DateTime<Utc>)>);
impl Pages {
    pub fn list(
        &mut self,
        scope: &str,
        kind: &str,
        mut items: Vec<Value>,
        q: &ListQuery,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        let size = q.page_size.unwrap_or(50);
        if size == 0 || size > 200 || q.after_sequence.is_some() {
            return Err(Fault::invalid());
        }
        let fields: &[&str] = if kind == "runs" {
            &[
                "runId",
                "dataSnapshotId",
                "deadlineAt",
                "status",
                "correlationId",
                "createdAt",
            ]
        } else {
            &[
                "snapshotId",
                "schemaVersion",
                "quality",
                "capturedAt",
                "contentHash",
                "licenseLabel",
            ]
        };
        let default = if kind == "runs" {
            "createdAt"
        } else {
            "capturedAt"
        };
        let sort = q.sort.as_deref().unwrap_or(default);
        let (field, direction) = sort.split_once(':').unwrap_or((sort, "asc"));
        if !fields.contains(&field) || !matches!(direction, "asc" | "desc") {
            return Err(Fault::invalid());
        }
        if kind == "runs" && q.quality.is_some()
            || kind != "runs" && (q.status.is_some() || q.data_snapshot_id.is_some())
        {
            return Err(Fault::invalid());
        }
        let binding = format!(
            "{scope}:{kind}:{}",
            digest(&json!([
                size,
                q.sort,
                q.filter,
                q.status,
                q.data_snapshot_id,
                q.quality
            ]))
        );
        self.0.retain(|_, v| v.3 > now);
        let (items, offset) = if let Some(cursor) = &q.cursor {
            let stored = self
                .0
                .get(cursor)
                .ok_or(Fault(StatusCode::GONE, "CURSOR_EXPIRED"))?;
            if stored.0 != binding {
                return Err(Fault::invalid());
            }
            (stored.1.clone(), stored.2)
        } else {
            if let Some(status) = &q.status {
                items.retain(|v| v["status"] == *status);
            }
            if let Some(snapshot) = &q.data_snapshot_id {
                uuid(snapshot)?;
                items.retain(|v| v["dataSnapshotId"] == *snapshot);
            }
            if let Some(quality) = &q.quality {
                items.retain(|v| v["quality"] == *quality);
            }
            if let Some(filter) = &q.filter {
                let parts = filter.splitn(3, ':').collect::<Vec<_>>();
                let allowed = if kind == "runs" {
                    &["runId", "dataSnapshotId", "status", "correlationId"][..]
                } else {
                    &["snapshotId", "quality", "licenseLabel"][..]
                };
                if parts.len() != 3
                    || parts[1] != "eq"
                    || parts[2].is_empty()
                    || !allowed.contains(&parts[0])
                {
                    return Err(Fault::invalid());
                }
                items.retain(|v| v[parts[0]].as_str() == Some(parts[2]));
            }
            // The adapters bound their materialization before crossing this layer.
            if items.len() > 2000 {
                return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "NARROW_QUERY"));
            }
            let id = if kind == "runs" {
                "runId"
            } else {
                "snapshotId"
            };
            items.sort_by(|a, b| {
                let cmp = a[field]
                    .as_str()
                    .cmp(&b[field].as_str())
                    .then(a[id].as_str().cmp(&b[id].as_str()));
                if direction == "desc" {
                    cmp.reverse()
                } else {
                    cmp
                }
            });
            (items, 0)
        };
        let end = (offset + size).min(items.len());
        let mut result = json!({"items":items[offset..end]});
        if end < items.len() {
            if self.0.len() >= 128 {
                return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
            }
            let cursor = Uuid::new_v4().to_string();
            self.0.insert(
                cursor.clone(),
                (binding, items, end, now + Duration::minutes(5)),
            );
            result["nextCursor"] = json!(cursor);
        }
        Ok(result)
    }
}
#[derive(Debug, Default)]
pub(crate) struct Quota(BTreeMap<String, (i64, u16)>);
impl Quota {
    pub fn take(&mut self, scope: &str, operation: &str, now: DateTime<Utc>) -> Result<()> {
        let minute = now.timestamp() / 60;
        self.0.retain(|_, v| v.0 == minute);
        if self.0.len() >= 2048 {
            return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
        }
        let counter = self
            .0
            .entry(format!("{scope}:{operation}"))
            .or_insert((minute, 0));
        if counter.1 >= 120 {
            return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
        }
        counter.1 += 1;
        Ok(())
    }
}
pub(crate) trait Repository {
    fn snapshots(&mut self, q: &ListQuery) -> Result<Vec<Value>>;
    fn snapshot(&mut self, id: Uuid) -> Result<Value>;
    fn runs(&mut self, q: &ListQuery) -> Result<Vec<Value>>;
    fn run(&mut self, id: Uuid) -> Result<Value>;
    fn create(&mut self, key: Uuid, input: Create) -> Result<Value>;
    fn cancel(&mut self, id: Uuid, key: Uuid) -> Result<Value>;
    fn artifact(&mut self, id: Uuid, attachment: bool) -> Result<Value>;
    fn events(&mut self, id: Uuid, after: u64) -> Result<Vec<Value>>;
}
pub(crate) enum Output {
    Json(StatusCode, Value),
    Events(Vec<Value>),
}
impl Output {
    pub fn response(self) -> Response {
        match self {
            Self::Json(status, payload) => {
                let c = payload["correlationId"]
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| Uuid::new_v4().to_string());
                crate::response(status, payload, &c)
            }
            Self::Events(events) => {
                let text = events
                    .iter()
                    .map(|e| format!("id: {}\ndata: {}\n\n", e["sequence"], e))
                    .collect::<String>();
                use axum::response::IntoResponse;
                let mut r = (
                    [
                        (axum::http::header::CONTENT_TYPE, "text/event-stream"),
                        (axum::http::header::CACHE_CONTROL, "no-store"),
                    ],
                    text,
                )
                    .into_response();
                r.headers_mut().insert(
                    "x-correlation-id",
                    Uuid::new_v4().to_string().parse().unwrap(),
                );
                r
            }
        }
    }
}
#[allow(clippy::too_many_arguments)] // Explicit HTTP inputs shared by both service modes.
pub(crate) fn dispatch(
    repo: &mut impl Repository,
    pages: &mut Pages,
    scope: &str,
    method: &Method,
    path: &str,
    q: &ListQuery,
    headers: &HeaderMap,
    body: &[u8],
    now: DateTime<Utc>,
) -> Result<Output> {
    let parts = path
        .trim_start_matches("/v1/")
        .split('/')
        .collect::<Vec<_>>();
    let key = || {
        headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(Fault::invalid)
            .and_then(uuid)
    };
    let ok = |v| Ok(Output::Json(StatusCode::OK, v));
    match parts.as_slice() {
        ["research-runs"] if method == Method::GET => {
            let items = if q.cursor.is_some() {
                vec![]
            } else {
                repo.runs(q)?
            };
            ok(pages.list(scope, "runs", items, q, now)?)
        }
        ["research-runs"] if method == Method::POST => {
            let input: Create = serde_json::from_slice(body).map_err(|_| Fault::invalid())?;
            Ok(Output::Json(
                StatusCode::ACCEPTED,
                repo.create(key()?, input)?,
            ))
        }
        ["research-runs", id] => ok(repo.run(uuid(id)?)?),
        ["research-runs", id, "cancel"] => Ok(Output::Json(
            StatusCode::ACCEPTED,
            repo.cancel(uuid(id)?, key()?)?,
        )),
        ["research-runs", id, "stream"] => Ok(Output::Events(
            repo.events(uuid(id)?, q.after_sequence.unwrap_or(0))?,
        )),
        ["data-snapshots"] => {
            let items = if q.cursor.is_some() {
                vec![]
            } else {
                repo.snapshots(q)?
            };
            ok(pages.list(scope, "snapshots", items, q, now)?)
        }
        ["data-snapshots", id] => ok(repo.snapshot(uuid(id)?)?),
        ["artifacts", id] => ok(repo.artifact(uuid(id)?, false)?),
        ["artifacts", id, "attachment"] => ok(repo.artifact(uuid(id)?, true)?),
        _ => Err(Fault::hidden()),
    }
}
// Route method constraints are explicit: do not permit writes on detail/list reads.
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    Router::new()
        .route("/v1/research-runs", get(reference).post(reference))
        .route("/v1/research-runs/:id", get(reference))
        .route("/v1/research-runs/:id/cancel", post(reference))
        .route("/v1/research-runs/:id/stream", get(reference))
        .route("/v1/data-snapshots", get(reference))
        .route("/v1/data-snapshots/:id", get(reference))
        .route("/v1/artifacts/:id", get(reference))
        .route("/v1/artifacts/:id/attachment", get(reference))
}
async fn reference(
    State(state): State<Arc<Mutex<crate::ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    query: std::result::Result<Query<ListQuery>, axum::extract::rejection::QueryRejection>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let q = match query {
        Ok(Query(q)) => q,
        Err(_) => return Fault::invalid().response(),
    };
    if let Err(r) = crate::authenticate(&headers, &state).await {
        return r;
    }
    if crate::cookies(&headers).get("quantos_session") != Some(&crate::CURRENT_SESSION) {
        return Fault(StatusCode::FORBIDDEN, "FORBIDDEN").response();
    }
    let mut state = state.lock().await;
    let now = state.now();
    let operation = crate::input_contract::operation(method.as_str(), uri.path())
        .and_then(|v| v["operationId"].as_str())
        .unwrap_or("unknown");
    if let Err(e) = state
        .research
        .quota
        .take("reference-current", operation, now)
    {
        return e.response();
    }
    if method == Method::POST
        && uri.path() == "/v1/research-runs"
        && let Some(host) = &state.operations
        && let Err(e) = host.authorize_engine_input(&body, now)
    {
        return e.response();
    }
    state.research.now = now;
    let mut pages = std::mem::take(&mut state.research.pages);
    let output = dispatch(
        &mut state.research,
        &mut pages,
        "reference-current",
        &method,
        uri.path(),
        &q,
        &headers,
        &body,
        now,
    );
    state.research.pages = pages;
    match output {
        Ok(Output::Json(status, mut payload)) => {
            // The shared state lock makes command replay and its audit fact atomic.
            if method == Method::POST || uri.path().starts_with("/v1/artifacts/") {
                let action = if method == Method::POST {
                    if uri.path().ends_with("/cancel") {
                        "research.cancel"
                    } else {
                        "research.create"
                    }
                } else {
                    "research.artifact.read"
                };
                record_reference_audit(&mut state, &mut payload, action);
            }
            Output::Json(status, payload).response()
        }
        Ok(o) => o.response(),
        Err(e) => e.response(),
    }
}
fn record_reference_audit(state: &mut crate::ProviderData, payload: &mut Value, action: &str) {
    if payload.get("auditRef").is_none() {
        payload["auditRef"] = json!(Uuid::new_v4());
    }
    if payload.get("correlationId").is_none() {
        payload["correlationId"] = json!(Uuid::new_v4());
    }
    let id = payload["auditRef"].clone();
    let correlation = payload["correlationId"].clone();
    if state.audits.iter().any(|e| e["eventId"] == id) {
        return;
    }
    let cause = state
        .audits
        .iter()
        .find(|e| e["correlationId"] == correlation && e.get("eventId").is_some())
        .map(|e| e["eventId"].clone())
        .unwrap_or_else(|| id.clone());
    let object = payload
        .get("jobId")
        .or_else(|| payload.get("artifactId"))
        .cloned()
        .unwrap_or(Value::Null);
    let redacted =
        crate::audit_core::redacted(&json!({"status":payload["status"],"outcome":"succeeded"}));
    state.audits.push(json!({"auditRef":id,"eventId":id,"correlationId":correlation,"causationId":cause,
        "sequence":state.audits.iter().filter(|e|e.get("eventId").is_some()).count()+1,"kind":action,
        "actor":"reference-current","objectRef":object,"occurredAt":state.now(),"redactionApplied":true,
        "redactedPayload":redacted,"payloadHash":crate::audit_core::payload_hash(&redacted),
        "route":format!("/research/{}",object.as_str().unwrap_or_default()),"retentionUntil":state.now()+Duration::days(365)}));
}

#[derive(Debug)]
pub(crate) struct Fixture {
    now: DateTime<Utc>,
    pub pages: Pages,
    pub quota: Quota,
    pub snapshots: BTreeMap<Uuid, Value>,
    pub runs: BTreeMap<Uuid, Value>,
    pub artifacts: BTreeMap<Uuid, Value>,
    pub events: BTreeMap<Uuid, Vec<Value>>,
    commands: BTreeMap<String, (Value, Value)>,
}
impl Default for Fixture {
    fn default() -> Self {
        let now = Utc::now();
        let mut snapshots = BTreeMap::new();
        for (last, quality) in [(1, "verified"), (2, "failed"), (3, "license_missing")] {
            let id = Uuid::parse_str(&format!("11111111-1111-4111-8111-{last:012}")).unwrap();
            snapshots.insert(id,json!({"snapshotId":id,"schemaVersion":"v1","window":snapshot_window(now-Duration::hours(1),now),"sources":["reference-fixture"],"quality":quality,"qualityBlocked":quality!="verified","contentHash":digest(&json!([id,quality])),"licenseLabel":"fixture-only","capturedAt":now,"maxAgeSeconds":3600}));
        }
        // Explicit immutable example for local contract consumers; this is not
        // the output of a completed R03 worker or private Storage execution.
        let id = Uuid::parse_str("44444444-4444-4444-8444-444444444444").unwrap();
        let artifact = json!({"artifactId":id,"hypothesis":"Synthetic reference hypothesis","summary":"Explicit synthetic fixture; no worker completion claimed","engineVersion":"fixture-v1","promptVersion":"fixture-v1","codeVersion":"fixture-v1","environmentHash":digest(&json!("fixture")),"dataSnapshotId":"11111111-1111-4111-8111-000000000001","createdAt":now});
        Self {
            now,
            pages: Pages::default(),
            quota: Quota::default(),
            snapshots,
            runs: BTreeMap::new(),
            artifacts: BTreeMap::from([(id, artifact)]),
            events: BTreeMap::new(),
            commands: BTreeMap::new(),
        }
    }
}
impl Fixture {
    fn replay(&self, key: &str, intent: &Value) -> Result<Option<Value>> {
        self.commands
            .get(key)
            .map(|(i, r)| {
                if i == intent {
                    Ok(r.clone())
                } else {
                    Err(Fault(StatusCode::CONFLICT, "IDEMPOTENCY_CONFLICT"))
                }
            })
            .transpose()
    }
    pub fn emit(&mut self, id: Uuid, kind: &str) {
        let run = &self.runs[&id];
        let events = self.events.entry(id).or_default();
        events.push(json!({"streamId":id,"sequence":events.len()+1,"eventId":Uuid::new_v4(),"occurredAt":Utc::now(),"correlationId":run["correlationId"],"payloadVersion":"v1","payload":{"type":kind,"status":run["status"],"runId":id}}));
    }
}
impl Repository for Fixture {
    fn snapshots(&mut self, _: &ListQuery) -> Result<Vec<Value>> {
        let ids = self.snapshots.keys().copied().collect::<Vec<_>>();
        ids.into_iter().map(|id| self.snapshot(id)).collect()
    }
    fn snapshot(&mut self, id: Uuid) -> Result<Value> {
        let mut value = self.snapshots.get(&id).cloned().ok_or_else(Fault::hidden)?;
        let fresh = value["capturedAt"]
            .as_str()
            .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
            .zip(value["maxAgeSeconds"].as_i64())
            .is_some_and(|(captured, max_age)| {
                max_age >= 0
                    && captured <= self.now
                    && Duration::try_seconds(max_age).is_some_and(|age| {
                        captured
                            .checked_add_signed(age)
                            .is_some_and(|deadline| self.now <= deadline)
                            && value["window"]["end"]
                                .as_str()
                                .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
                                .is_some_and(|end| {
                                    end <= captured
                                        && end
                                            .checked_add_signed(age)
                                            .is_some_and(|deadline| self.now <= deadline)
                                })
                    })
            });
        value["qualityBlocked"] = json!(
            value["qualityBlocked"] != false
                || value["quality"] != "verified"
                || value["licenseLabel"]
                    .as_str()
                    .is_none_or(|v| v.trim().is_empty())
                || !fresh
        );
        Ok(value)
    }
    fn runs(&mut self, _: &ListQuery) -> Result<Vec<Value>> {
        Ok(self.runs.values().cloned().collect())
    }
    fn run(&mut self, id: Uuid) -> Result<Value> {
        self.runs.get(&id).cloned().ok_or_else(Fault::hidden)
    }
    fn create(&mut self, key: Uuid, input: Create) -> Result<Value> {
        let intent = serde_json::to_value(&input).unwrap();
        let key = format!("create:{key}");
        if let Some(v) = self.replay(&key, &intent)? {
            return Ok(v);
        }
        input.validate(self.now)?;
        let snapshot = self.snapshot(input.data_snapshot_id)?;
        if snapshot["qualityBlocked"] == true {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "SNAPSHOT_BLOCKED"));
        }
        let contents = input
            .attachments
            .iter()
            .map(|id| self.artifact(*id, true).map(|v| v["content"].clone()))
            .collect::<Result<Vec<_>>>()?;
        engine_input(&input.question, &contents)?;
        if self.runs.len() >= 2000 {
            return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
        }
        let id = Uuid::new_v4();
        let c = Uuid::new_v4();
        let audit = Uuid::new_v4();
        self.runs.insert(id,json!({"runId":id,"capability":input.capability,"dataSnapshotId":input.data_snapshot_id,"budget":input.budget,"deadlineAt":input.deadline_at,"status":"queued","inputHash":digest(&intent),"engineVersion":"pending","artifactRefs":[],"evidenceRefs":[],"correlationId":c,"auditRef":audit,"createdAt":Utc::now()}));
        self.emit(id, "research.queued");
        let accepted = json!({"jobId":id,"status":"accepted","statusRef":format!("/v1/research-runs/{id}"),"correlationId":c,"auditRef":audit});
        self.commands.insert(key, (intent, accepted.clone()));
        Ok(accepted)
    }
    fn cancel(&mut self, id: Uuid, key: Uuid) -> Result<Value> {
        let intent = json!({"runId":id});
        let key = format!("cancel:{key}");
        if let Some(v) = self.replay(&key, &intent)? {
            return Ok(v);
        }
        let run = self.runs.get_mut(&id).ok_or_else(Fault::hidden)?;
        if !matches!(
            run["status"].as_str(),
            Some("queued" | "running" | "cancel_requested" | "cancelled")
        ) {
            return Err(Fault(StatusCode::CONFLICT, "STATE_CONFLICT"));
        }
        if run["status"] == "queued" {
            run["status"] = json!("cancelled");
        } else if run["status"] == "running" {
            run["status"] = json!("cancel_requested");
        }
        let response = json!({"jobId":id,"status":"cancel_requested","correlationId":run["correlationId"],"statusRef":format!("/v1/research-runs/{id}"),"auditRef":Uuid::new_v4()});
        self.emit(id, "research.cancel_requested");
        self.commands.insert(key, (intent, response.clone()));
        Ok(response)
    }
    fn artifact(&mut self, id: Uuid, attachment: bool) -> Result<Value> {
        let mut artifact = self.artifacts.get(&id).cloned().ok_or_else(Fault::hidden)?;
        // Metadata and attachment describe the same canonical content. Response
        // audit fields and the hash itself are not part of the content document.
        for field in ["contentHash", "auditRef", "correlationId"] {
            artifact.as_object_mut().unwrap().remove(field);
        }
        let content_hash = digest(&artifact);
        if attachment {
            Ok(
                json!({"artifactId":id,"mediaType":"application/json","contentHash":content_hash,"content":artifact,"auditRef":Uuid::new_v4()}),
            )
        } else {
            artifact["contentHash"] = json!(content_hash);
            Ok(artifact)
        }
    }
    fn events(&mut self, id: Uuid, after: u64) -> Result<Vec<Value>> {
        self.run(id)?;
        let events = self.events.get(&id).cloned().unwrap_or_default();
        if after > events.len() as u64 {
            return Err(Fault(StatusCode::CONFLICT, "SEQUENCE_AHEAD"));
        }
        Ok(events
            .into_iter()
            .filter(|e| e["sequence"].as_u64().unwrap() > after)
            .collect())
    }
}

#[cfg(test)]
#[path = "research_tests.rs"]
mod tests;
