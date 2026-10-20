//! Read-only C02 composition. No HTTP fanout or execution authority is acquired.
use crate::research::{Fault, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::get,
};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
pub(crate) const ROW_LIMIT: usize = 2000;
const STREAM_LIMIT: usize = 1000;
const EVENTS: usize = 32;
pub(crate) fn has(a: &AuthContext, c: &str) -> bool {
    a.capabilities.iter().any(|x| x.as_str() == c)
}
pub(crate) fn authorize(a: &AuthContext, q: &BTreeMap<String, String>) -> Result<()> {
    if a.account_id.is_none() || !has(a, "ops.read") {
        return Err(Fault(StatusCode::FORBIDDEN, "FORBIDDEN"));
    }
    if q.get("accountId")
        .is_some_and(|v| Some(v.clone()) != a.account_id.map(|x| x.to_string()))
    {
        return Err(Fault::hidden());
    }
    Ok(())
}
pub(crate) fn unavailable(domain: &str, status: &str) -> Value {
    json!({"domain":domain,"status":status,"asOf":null,"sourceHash":null,"data":null})
}
pub(crate) fn source(
    domain: &str,
    mut data: Value,
    as_of: DateTime<Utc>,
    now: DateTime<Utc>,
    ttl: i64,
) -> Value {
    let rows = data["items"].as_array().cloned().unwrap_or_default();
    if rows.len() > ROW_LIMIT {
        return unavailable(domain, "unavailable");
    }
    let mut priority = rows
        .iter()
        .filter(|v| v["severity"] != "info")
        .cloned()
        .collect::<Vec<_>>();
    priority.sort_by_key(|v| {
        (
            if v["severity"] == "critical" { 0 } else { 1 },
            v["id"].as_str().unwrap_or("").to_owned(),
        )
    });
    priority.truncate(50);
    let mut recent = rows;
    recent.sort_by_key(|v| {
        (
            std::cmp::Reverse(v["occurredAt"].as_str().unwrap_or("").to_owned()),
            v["id"].as_str().unwrap_or("").to_owned(),
        )
    });
    data["truncated"] = json!(data["truncated"] == true || recent.len() > 50);
    recent.truncate(50);
    data["items"] = json!(recent);
    data["priority"] = json!(priority);
    let status = if as_of > now || now - as_of >= Duration::seconds(ttl) {
        "stale"
    } else {
        "ready"
    };
    json!({"domain":domain,"status":status,"asOf":as_of,"sourceHash":digest(&data),"data":data})
}
pub(crate) fn research_source(a: &AuthContext, rows: &[Value], now: DateTime<Utc>) -> Value {
    if !has(a, "research.read") {
        return unavailable("research", "forbidden");
    }
    if rows.len() > ROW_LIMIT {
        return unavailable("research", "unavailable");
    }
    let failed = rows
        .iter()
        .filter(|v| matches!(v["status"].as_str(), Some("failed" | "timed_out")))
        .count();
    let running = rows
        .iter()
        .filter(|v| {
            matches!(
                v["status"].as_str(),
                Some("queued" | "running" | "cancel_requested")
            )
        })
        .count();
    let items=rows.iter().filter_map(|v|{
  let id=Uuid::parse_str(v["runId"].as_str()?).ok()?;
  let status=v["status"].as_str()?;
  if !matches!(status,"queued"|"running"|"succeeded"|"failed"|"cancelled"|"timed_out") {return None}
  Some(json!({"kind":"run","id":id,"severity":if status=="failed"||status=="timed_out"{"warning"}else{"info"},"status":status,"occurredAt":v["createdAt"],"objectRef":format!("/research/runs/{id}")}))
 }).collect::<Vec<_>>();
    source(
        "research",
        json!({"failedRuns":failed,"runningRuns":running,"items":items,"truncated":rows.len()>50}),
        now,
        now,
        30,
    )
}
pub(crate) fn compose(a: &AuthContext, mut sources: [Value; 4], now: DateTime<Utc>) -> Value {
    let mut expires = now + Duration::seconds(30);
    for s in &mut sources {
        if s["status"] == "ready" {
            if let Some(at) = s["asOf"]
                .as_str()
                .and_then(|x| DateTime::parse_from_rfc3339(x).ok())
                .map(|x| x.with_timezone(&Utc))
            {
                let deadline =
                    at + Duration::seconds(if s["domain"] == "execution" { 60 } else { 30 });
                if at > now || deadline <= now {
                    s["status"] = json!("stale")
                } else {
                    expires = expires.min(deadline)
                }
            } else {
                s["status"] = json!("unavailable")
            }
        }
    }
    let research = &sources[0];
    let execution = &sources[1];
    let ops = &sources[2];
    let strategy = &sources[3];
    let ready = |s: &Value| s["status"] == "ready";
    let field = |s: &Value, k: &str| {
        if ready(s) {
            s["data"][k].clone()
        } else {
            Value::Null
        }
    };
    let mut priority = Vec::new();
    let mut activity = Vec::new();
    for s in &sources {
        if ready(s) {
            for item in s["data"]["items"].as_array().into_iter().flatten() {
                activity.push(item.clone());
            }
            for item in s["data"]["priority"].as_array().into_iter().flatten() {
                priority.push(item.clone());
            }
        }
    }
    priority.sort_by_key(|v| {
        (
            if v["severity"] == "critical" { 0 } else { 1 },
            v["id"].as_str().unwrap_or("").to_owned(),
        )
    });
    priority.truncate(50);
    activity.sort_by_key(|v| {
        (
            std::cmp::Reverse(v["occurredAt"].as_str().unwrap_or("").to_owned()),
            v["id"].as_str().unwrap_or("").to_owned(),
        )
    });
    activity.truncate(50);
    let as_of = sources
        .iter()
        .filter_map(|s| {
            s["asOf"]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        })
        .map(|s| s.with_timezone(&Utc))
        .min();
    let revision = digest(&json!([
        a.tenant_id,
        a.workspace_id,
        a.account_id,
        a.mode.as_str(),
        a.actor_id,
        a.role.as_str(),
        a.capabilities,
        sources
            .iter()
            .map(|s| json!([s["domain"], s["status"], s["sourceHash"]]))
            .collect::<Vec<_>>()
    ]));
    json!({"accountId":a.account_id,"mode":a.mode.as_str(),"sampledAt":now,"asOf":as_of,"expiresAt":expires,"revision":revision,"partial":sources.iter().any(|s|!ready(s)),"dataFreshness":if ready(execution){"fresh"}else if execution["status"]=="stale"{"stale"}else{"unavailable"},"riskPosture":if ready(execution){execution["data"]["riskPosture"].clone()}else{json!("unknown")},"pendingApprovals":if ready(execution)&&ready(strategy){json!(field(execution,"pendingApprovals").as_u64().unwrap_or(0)+field(strategy,"pendingApprovals").as_u64().unwrap_or(0))}else{Value::Null},"systemHealth":field(ops,"health"),"failedRuns":field(research,"failedRuns"),"runningRuns":field(research,"runningRuns"),"openRiskAlerts":field(ops,"openRiskAlerts"),"orderSummary":field(execution,"orderSummary"),"priority":priority,"recentActivity":activity,"sources":sources.iter().map(|s|json!({"domain":s["domain"],"status":s["status"],"asOf":s["asOf"],"sourceHash":s["sourceHash"]})).collect::<Vec<_>>(),"bounded":{"sourceCount":4,"rowLimit":ROW_LIMIT,"itemLimit":50,"truncated":sources.iter().any(|s|s["data"]["truncated"]==true)}})
}
#[derive(Debug)]
struct Lease {
    binding: String,
    expires: DateTime<Utc>,
    revision: String,
    events: Vec<Value>,
    last: u64,
}
#[derive(Default, Debug)]
pub(crate) struct CommandStreams {
    leases: BTreeMap<Uuid, Lease>,
}
impl CommandStreams {
    #[allow(clippy::too_many_arguments)] // Explicit identity, HTTP resume input and frozen read facts.
    pub(crate) fn response(
        &mut self,
        a: &AuthContext,
        session: &str,
        path: &str,
        q: &BTreeMap<String, String>,
        h: &HeaderMap,
        summary: Value,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        authorize(a, q)?;
        let stream = path == "/v1/command/stream";
        if q.keys().any(|k| {
            k != "accountId" && (!stream || !matches!(k.as_str(), "streamId" | "afterSequence"))
        }) {
            return Err(Fault::invalid());
        }
        if !stream {
            return Ok(summary);
        }
        let query_after = q
            .get("afterSequence")
            .map(|s| s.parse::<u64>().map_err(|_| Fault::invalid()))
            .transpose()?;
        let header_after = h
            .get("last-event-id")
            .map(|s| {
                s.to_str()
                    .ok()
                    .and_then(|s| s.parse::<u64>().ok())
                    .ok_or_else(Fault::invalid)
            })
            .transpose()?;
        if query_after.is_some() && header_after.is_some() && query_after != header_after {
            return Err(Fault::invalid());
        }
        let after = query_after.or(header_after).unwrap_or(0);
        let binding = digest(&json!([
            a.tenant_id,
            a.workspace_id,
            a.actor_id,
            a.account_id,
            a.mode.as_str(),
            a.role.as_str(),
            a.capabilities,
            session
        ]));
        self.leases.retain(|_, v| v.expires > now);
        let id = if let Some(id) = q.get("streamId") {
            Uuid::parse_str(id).map_err(|_| Fault::invalid())?
        } else {
            if after != 0 {
                return Err(Fault(StatusCode::CONFLICT, "STREAM_SCOPE_CONFLICT"));
            }
            if self.leases.len() >= STREAM_LIMIT {
                return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
            }
            let id = Uuid::new_v4();
            self.leases.insert(
                id,
                Lease {
                    binding: binding.clone(),
                    expires: summary["expiresAt"]
                        .as_str()
                        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
                        .map(|v| v.with_timezone(&Utc))
                        .unwrap_or(now)
                        .min(now + Duration::seconds(30)),
                    revision: String::new(),
                    events: vec![],
                    last: 0,
                },
            );
            id
        };
        let lease = self
            .leases
            .get_mut(&id)
            .filter(|l| l.binding == binding)
            .ok_or(Fault(StatusCode::CONFLICT, "STREAM_SCOPE_CONFLICT"))?;
        if after > lease.last
            || lease
                .events
                .first()
                .is_some_and(|e| after + 1 < e["sequence"].as_u64().unwrap())
        {
            return Err(Fault(StatusCode::CONFLICT, "STREAM_GAP"));
        }
        let rev = summary["revision"]
            .as_str()
            .ok_or_else(Fault::unavailable)?;
        if lease.revision != rev {
            lease.last += 1;
            lease.revision = rev.into();
            lease.events.push(json!({"streamId":id,"sequence":lease.last,"eventId":Uuid::new_v4(),"occurredAt":now,"correlationId":Uuid::new_v4(),"payloadVersion":"v1","payload":summary}));
            if lease.events.len() > EVENTS {
                lease.events.remove(0);
            }
        }
        Ok(
            json!({"streamId":id,"events":lease.events.iter().filter(|e|e["sequence"].as_u64().unwrap()>after).collect::<Vec<_>>()}),
        )
    }
}
pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
) -> Router<S> {
    Router::new()
        .route("/v1/command/summary", read.clone())
        .route("/v1/command/stream", read)
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(get(reference))
}
async fn reference(
    State(data): State<Arc<Mutex<crate::ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    Query(q): Query<BTreeMap<String, String>>,
    h: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(r) = crate::authenticate(&h, &data).await {
        return r;
    }
    if !body.is_empty() {
        return Fault::invalid().response();
    }
    let session = crate::cookies(&h)
        .get("quantos_session")
        .unwrap_or(&"")
        .to_string();
    let mut s = data.lock().await;
    let now = s.now();
    let shadow = s.reference_shadow;
    let mut a = crate::operations::command_auth(&session, shadow);
    if let Some(ops) = &s.operations
        && let Err(e) = ops.restrict_identity(&mut a)
    {
        return e.response();
    }
    if let Err(e) = authorize(&a, &q) {
        return e.response();
    }
    if !shadow && s.execution.is_none() {
        s.execution = Some(crate::execution::ExecutionService::reference())
    }
    if s.operations.is_none() {
        s.operations = Some(crate::operations::reference::seed(shadow, now))
    }
    if !shadow {
        crate::strategy::seed(&mut s);
    }
    let now = s.now();
    let research = if session == crate::CURRENT_SESSION {
        let rows = s
            .research
            .runs
            .values()
            .take(ROW_LIMIT + 1)
            .cloned()
            .collect::<Vec<_>>();
        research_source(&a, &rows, now)
    } else {
        unavailable("research", "forbidden")
    };
    let execution = match &s.execution {
        Some(e) => e.command_source(&a, now),
        None => unavailable("execution", "unavailable"),
    };
    let ops = s.operations.as_ref().unwrap().command_source(&a, now);
    let strategy = s
        .strategy
        .as_ref()
        .map(|h| h.command_source(&a, now))
        .unwrap_or_else(|| unavailable("strategy", "unavailable"));
    let summary = compose(&a, [research, execution, ops, strategy], now);
    match s
        .command
        .response(&a, &session, uri.path(), &q, &h, summary, now)
    {
        Ok(v) => crate::operations::output(StatusCode::OK, v),
        Err(e) => e.response(),
    }
}
#[cfg(test)]
mod tests;
