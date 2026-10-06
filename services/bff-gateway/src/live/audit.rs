//! Persistent Audit / export provider. Reads never generate files. A leased
//! worker writes a private object before publishing READY; signed BFF resource
//! leases are session-bound, revocable and consumed atomically once.
use super::{
    LiveState,
    settings::{self, ApiError, TrustedIdentity},
};
use crate::audit_core::{self, ExportInput};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use postgres::Transaction;
use serde_json::{Value, json};
use std::sync::Arc;
use uuid::Uuid;

const BUCKET: &str = "quantos-bff-exports";
const MAX_EVENTS: usize = 10_000;
const MAX_BYTES: usize = 16 * 1024 * 1024;
// Status/authorization/cleanup must never fetch a job snapshot. Workers reject
// oversized snapshots in PostgreSQL before transferring them to the process.
const JOB_COLUMNS: &str = "export_id,user_id,tenant_id,actor_id,workspace_id,account_id,job,status,retention_until,object_key,sha256,size_bytes,media_type,attempts,lease_token,lease_until";
fn invalid() -> ApiError {
    ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_FAILED")
}
fn hidden() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "NOT_FOUND")
}
fn conflict() -> ApiError {
    ApiError::new(StatusCode::CONFLICT, "STATE_CONFLICT")
}
fn uuid(s: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(s).map_err(|_| hidden())
}
fn response(status: StatusCode, payload: Value) -> Response {
    let correlation = payload["correlationId"]
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    crate::response(status, payload, &correlation)
}
fn scope(tx: &mut Transaction<'_>, identity: &TrustedIdentity) -> Result<(), ApiError> {
    let c = &identity.0;
    tx.query_one("select set_config('quantos.audit_tenant',$1,true),set_config('quantos.audit_actor',$2,true),set_config('quantos.audit_workspace',$3,true),set_config('quantos.audit_account',$4,true)", &[&c.auth.tenant_id.to_string(),&c.auth.actor_id.to_string(),&c.auth.workspace_id.to_string(),&c.auth.account_id.map(|a|a.to_string()).unwrap_or_default()])?;
    Ok(())
}
fn cause(tx: &mut Transaction<'_>, correlation: Uuid, root: Uuid) -> Result<Uuid, ApiError> {
    Ok(tx.query_opt("select coalesce(event_id,id) from quantos.audit_entries where correlation_id=$1 order by recorded_at,id limit 1", &[&correlation])?.map(|r|r.get(0)).unwrap_or(root))
}
fn log(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    action: &str,
    correlation: Uuid,
    object: &str,
    details: Value,
) -> Result<Uuid, ApiError> {
    let id = Uuid::new_v4();
    let c = &identity.0;
    let clean = audit_core::redacted(&details);
    let details = json!({"objectRef":object,"redactedPayload":clean,"payloadHash":audit_core::payload_hash(&clean),"redactionPolicy":"audit-v1","workspaceId":c.auth.workspace_id,"accountId":c.auth.account_id});
    let cause = cause(tx, correlation, id)?;
    tx.execute("insert into quantos.audit_entries(id,tenant_id,actor_id,actor_user_id,correlation_id,causation_id,action,details) values($1,$2,$3,$4,$5,$6,$7,$8)", &[&id,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),&c.user_id,&correlation,&cause,&action,&details])?;
    Ok(id)
}
fn permission(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    cap: &str,
    op: &str,
) -> Result<(), ApiError> {
    if !identity
        .0
        .auth
        .capabilities
        .iter()
        .any(|c| c.as_str() == cap)
    {
        log(
            tx,
            identity,
            "audit.access_denied",
            Uuid::new_v4(),
            op,
            json!({"outcome":"denied"}),
        )?;
        return Err(ApiError::new(StatusCode::FORBIDDEN, "FORBIDDEN"));
    }
    Ok(())
}
fn capability(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    cap: &str,
    op: &str,
) -> Result<(), ApiError> {
    permission(tx, identity, cap, op)?;
    let quota = if op == "createExport" { 5 } else { 120 };
    let row=tx.query_one("insert into quantos.bff_audit_quotas(user_id,operation,window_at,used) values($1,$2,date_trunc('minute',now()),1) on conflict(user_id,operation,window_at) do update set used=quantos.bff_audit_quotas.used+1 returning used", &[&identity.0.user_id,&op])?;
    if row.get::<_, i32>(0) > quota {
        log(
            tx,
            identity,
            "audit.quota_denied",
            Uuid::new_v4(),
            op,
            json!({"outcome":"denied"}),
        )?;
        return Err(ApiError {
            status: StatusCode::TOO_MANY_REQUESTS,
            code: "RATE_LIMITED",
            details: json!({"retryAfter":60}),
        });
    }
    Ok(())
}
// Commit security denials, but roll back business mutations and conflicting
// intents. Authentication/CSRF denials are separately recorded by the guard.
fn admit(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    cap: &str,
    op: &str,
) -> Result<(), ApiError> {
    scope(tx, identity)?;
    capability(tx, identity, cap, op)
}
fn rows(tx: &mut Transaction<'_>) -> Result<Vec<Value>, ApiError> {
    let records=tx.query("select a.id,coalesce(a.event_id,a.id) as domain_event_id,a.correlation_id,a.causation_id,a.action,a.details,a.recorded_at,e.event_kind,e.sequence,e.aggregate_type,e.aggregate_id,e.payload from quantos.audit_entries a left join quantos.event_log e on e.tenant_id=a.tenant_id and e.event_id=a.event_id order by a.recorded_at,a.id limit 10001",&[])?;
    if records.len() > MAX_EVENTS {
        return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
    }
    Ok(records.iter().enumerate().map(|(i,r)|{
  let raw:Value=r.get("details");let domain:Option<Value>=r.get("payload");let clean=audit_core::redacted(domain.as_ref().unwrap_or_else(||raw.get("redactedPayload").unwrap_or(&raw)));
  let at:DateTime<Utc>=r.get("recorded_at");let id:Uuid=r.get("id");let correlation:Uuid=r.get("correlation_id");let cause:Uuid=r.get("causation_id");
  let source_object=r.get::<_,Option<String>>("aggregate_type").zip(r.get::<_,Option<String>>("aggregate_id")).map(|(kind,id)|format!("{kind}/{id}"));
  let object=source_object.as_deref().or_else(||raw["objectRef"].as_str()).filter(|s|s.len()<=120 && s.bytes().all(|b|b.is_ascii_alphanumeric() || b"-_:/".contains(&b))).unwrap_or("audit-resource");
  let object=if object.to_ascii_lowercase().contains("account") || object.to_ascii_lowercase().contains("acct") {"account:[REDACTED]"}else{object};
  let mut event=json!({"auditRef":id,"eventId":r.get::<_,Uuid>("domain_event_id"),"correlationId":correlation,"sequence":r.get::<_,Option<i64>>("sequence").filter(|n|*n>0).unwrap_or((i+1) as i64),"kind":if r.get::<_,String>("action")=="event.appended" {r.get::<_,Option<String>>("event_kind").unwrap_or_else(||r.get("action"))}else{r.get::<_,String>("action")},"actor":"authorized-actor","objectRef":object,"occurredAt":at.to_rfc3339(),"redactionApplied":true,"redactedPayload":clean,"payloadHash":audit_core::payload_hash(&clean),"route":"/audit","retentionUntil":(at+Duration::days(365)).to_rfc3339()});
  if cause!=correlation {event["causationId"]=json!(cause);}event
 }).collect())
}
fn filter(mut events: Vec<Value>, q: &Value) -> Result<Vec<Value>, ApiError> {
    let date = |name: &str| {
        q[name]
            .as_str()
            .map(|s| DateTime::parse_from_rfc3339(s).map(|t| t.with_timezone(&Utc)))
            .transpose()
            .map_err(|_| invalid())
    };
    let start = date("startAt")?;
    let end = date("endAt")?;
    if start.zip(end).is_some_and(|(s, e)| s > e) {
        return Err(invalid());
    }
    let sort = q["sort"].as_str().unwrap_or("occurredAt:asc");
    let (field, direction) = sort.split_once(':').ok_or_else(invalid)?;
    if !matches!(field, "occurredAt" | "kind" | "eventId") || !matches!(direction, "asc" | "desc") {
        return Err(invalid());
    }
    let f = q["filter"]
        .as_str()
        .map(|s| s.splitn(3, ':').collect::<Vec<_>>());
    if f.as_ref().is_some_and(|f| {
        f.len() != 3 || !matches!(f[0], "kind" | "eventId") || f[1] != "eq" || f[2].is_empty()
    }) {
        return Err(invalid());
    }
    events.retain(|e| {
        ["correlationId", "causationId", "kind"]
            .iter()
            .all(|k| q[k].as_str().is_none_or(|v| e[k].as_str() == Some(v)))
            && q["objectRef"]
                .as_str()
                .is_none_or(|v| e["objectRef"].as_str().is_some_and(|s| s.contains(v)))
            && f.as_ref().is_none_or(|f| e[f[0]].as_str() == Some(f[2]))
            && DateTime::parse_from_rfc3339(e["occurredAt"].as_str().unwrap())
                .is_ok_and(|at| start.is_none_or(|s| at >= s) && end.is_none_or(|t| at <= t))
    });
    events.sort_by(|a, b| {
        let order = a[field]
            .as_str()
            .cmp(&b[field].as_str())
            .then(a["eventId"].as_str().cmp(&b["eventId"].as_str()));
        if direction == "desc" {
            order.reverse()
        } else {
            order
        }
    });
    Ok(events)
}
fn page(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    q: &Value,
    kind: &str,
    chain: Option<Uuid>,
) -> Result<Value, ApiError> {
    let size = q["pageSize"]
        .as_str()
        .unwrap_or("50")
        .parse::<usize>()
        .map_err(|_| invalid())?;
    if !(1..=200).contains(&size) {
        return Err(invalid());
    }
    let mut binding = q.clone();
    binding.as_object_mut().unwrap().remove("cursor");
    binding["resource"] = json!([kind, chain]);
    binding["identity"] = json!([
        identity.0.auth.tenant_id,
        identity.0.auth.actor_id,
        identity.0.auth.workspace_id,
        identity.0.auth.account_id
    ]);
    let (events, offset) = if let Some(cursor) = q["cursor"].as_str() {
        let row=tx.query_opt("select binding,snapshot,position from quantos.bff_audit_cursors where token_hash=$1 and user_id=$2 and expires_at>now()", &[&settings::hash(cursor),&identity.0.user_id])?.ok_or_else(invalid)?;
        if row.get::<_, Value>(0) != binding {
            return Err(invalid());
        }
        (
            row.get::<_, Value>(1)
                .as_array()
                .cloned()
                .ok_or_else(ApiError::unavailable)?,
            row.get::<_, i32>(2) as usize,
        )
    } else {
        let mut events = filter(rows(tx)?, q)?;
        if chain.is_some() {
            let mut seen = std::collections::BTreeSet::new();
            events.retain(|e| seen.insert(e["eventId"].to_string()));
        }
        if chain.is_some() && events.is_empty() {
            return Err(hidden());
        }
        (events, 0)
    };
    let mut body =
        json!({"items":events.iter().skip(offset).take(size).cloned().collect::<Vec<_>>()});
    let complete = offset + size >= events.len();
    if !complete {
        let token = Uuid::new_v4().to_string() + &Uuid::new_v4().to_string();
        tx.execute("insert into quantos.bff_audit_cursors(token_hash,user_id,binding,snapshot,position,expires_at) values($1,$2,$3,$4,$5,now()+interval '5 minutes')", &[&settings::hash(&token),&identity.0.user_id,&binding,&json!(events),&((offset+size) as i32)])?;
        body["nextCursor"] = json!(token);
    }
    if let Some(chain) = chain {
        let nodes = body["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| {
                let mut n = e.clone();
                for key in [
                    "auditRef",
                    "actor",
                    "redactionApplied",
                    "redactedPayload",
                    "correlationId",
                ] {
                    n.as_object_mut().unwrap().remove(key);
                }
                n
            })
            .collect::<Vec<_>>();
        body["items"] = json!(nodes);
        body["correlationId"] = json!(chain);
        let causal = events.iter().all(|e| {
            e["causationId"]
                .as_str()
                .is_none_or(|cause| events.iter().any(|p| p["eventId"].as_str() == Some(cause)))
        });
        body["complete"] = json!(complete && causal);
    }
    Ok(body)
}
pub(super) fn routes() -> Router<Arc<LiveState>> {
    Router::new()
        .route("/v1/audit/events", get(search))
        .route("/v1/audit/evidence-chains/:id", get(chain))
        .route("/v1/exports", post(create))
        .route("/v1/exports/:id", get(status))
        .route("/v1/exports/:id/cancel", post(cancel))
        .route("/v1/exports/:id/download", get(download))
        .route("/_bff/export-content/:id/:signature", get(content))
}
async fn read(
    identity: TrustedIdentity,
    state: Arc<LiveState>,
    mut q: Value,
    chain: Option<Uuid>,
) -> Result<Response, ApiError> {
    let op = if chain.is_some() {
        "getEvidenceChain"
    } else {
        "searchAuditEvents"
    };
    if let Some(chain) = chain {
        q["correlationId"] = json!(chain.to_string());
    }
    let (value, access_correlation) = tokio::task::spawn_blocking(move || {
        let mut store = state.a2.lock().map_err(|_| ApiError::unavailable())?;
        let mut tx = store.client.transaction()?;
        if let Err(e) = admit(&mut tx, &identity, "audit:read", op) {
            tx.commit()?;
            return Err(e);
        }
        let result = page(&mut tx, &identity, &q, op, chain);
        let access_correlation = Uuid::new_v4();
        log(
            &mut tx,
            &identity,
            if chain.is_some() {
                "audit.chain_accessed"
            } else {
                "audit.search_accessed"
            },
            access_correlation,
            "audit",
            json!({"outcome":if result.is_ok(){"succeeded"}else{"denied"},"scope":q}),
        )?;
        tx.commit()?;
        result.map(|value| (value, access_correlation))
    })
    .await
    .map_err(|_| ApiError::unavailable())??;
    Ok(crate::response(
        StatusCode::OK,
        value,
        &access_correlation.to_string(),
    ))
}
async fn search(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Query(query): Query<std::collections::BTreeMap<String, String>>,
) -> Result<Response, ApiError> {
    read(identity, state, json!(query), None).await
}
async fn chain(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Path(id): Path<String>,
    Query(query): Query<std::collections::BTreeMap<String, String>>,
) -> Result<Response, ApiError> {
    read(identity, state, json!(query), Some(uuid(&id)?)).await
}
async fn create(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    headers: HeaderMap,
    Json(input): Json<ExportInput>,
) -> Result<Response, ApiError> {
    let input = input.normalize().map_err(|_| invalid())?;
    let key = settings::command_key(&headers)?;
    let value=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(identity.0.user_id,|store|{
  let mut tx=store.client.transaction()?;scope(&mut tx,&identity)?;
  let intent=json!([identity.0.auth.tenant_id,identity.0.auth.actor_id,identity.0.auth.workspace_id,identity.0.auth.account_id,"exports",input]);
  if let Err(e)=permission(&mut tx,&identity,"audit:export","createExport"){tx.commit()?;return Err(e);}
  if let Err(e)=settings::recent(&mut tx,&identity.1,&headers,"createExport"){log(&mut tx,&identity,"export.reauth_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}
  if let Some(value)=settings::replay(&mut tx,identity.0.user_id,"createExport",key,&intent)?{tx.commit()?;return Ok(value);}
  if let Err(e)=capability(&mut tx,&identity,"audit:export","createExport"){tx.commit()?;return Err(e);}
  if let Err(e)=settings::recent(&mut tx,&identity.1,&headers,"createExport"){log(&mut tx,&identity,"export.create_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}
  let records=rows(&mut tx)?;
  if input.scope.correlation_ids.iter().any(|id|!records.iter().any(|e|e["correlationId"].as_str()==Some(id))){log(&mut tx,&identity,"export.scope_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(hidden());}
  let records=records.into_iter().filter(|e|input.includes(e)).collect::<Vec<_>>();
  let id=Uuid::new_v4();let correlation=Uuid::new_v4();let now:DateTime<Utc>=tx.query_one("select now()",&[])?.get(0);let retention=now+Duration::days(input.retention_days);
  let audit=log(&mut tx,&identity,"export.created",correlation,&id.to_string(),json!({"scope":input.scope,"format":input.format,"reason":input.reason,"watermark":input.watermark,"retentionDays":input.retention_days,"outcome":"succeeded"}))?;
  let job=json!({"exportId":id,"status":"queued","format":input.format,"requestedBy":"authorized-actor","requestedAt":now.to_rfc3339(),"watermark":audit_core::watermark(&input.watermark),"retentionUntil":retention.to_rfc3339(),"correlationId":correlation,"auditRef":audit});
  let c=&identity.0;let object=format!("{}/{id}.{}",c.auth.tenant_id,input.format);
  tx.execute("insert into quantos.bff_export_jobs(export_id,user_id,tenant_id,actor_id,workspace_id,account_id,session_hash,intent,snapshot,job,status,retention_until,object_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'queued',$11,$12)", &[&id,&c.user_id,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),c.auth.workspace_id.as_uuid(),&c.auth.account_id.map(|a|*a.as_uuid()),&identity.1,&json!(input),&json!(records),&job,&retention,&object])?;
  settings::save_command(&mut tx,c.user_id,"createExport",key,&intent,&job)?;tx.commit()?;Ok(job)
 })).await.map_err(|_|ApiError::unavailable())??;
    Ok(response(StatusCode::ACCEPTED, value))
}
fn job_row(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    id: Uuid,
) -> Result<postgres::Row, ApiError> {
    tx.query_opt(&format!("select {JOB_COLUMNS} from quantos.bff_export_jobs where export_id=$1 and user_id=$2 and tenant_id=$3 and actor_id=$4 and workspace_id=$5 and account_id is not distinct from $6 for update"), &[&id,&identity.0.user_id,identity.0.auth.tenant_id.as_uuid(),identity.0.auth.actor_id.as_uuid(),identity.0.auth.workspace_id.as_uuid(),&identity.0.auth.account_id.map(|a|*a.as_uuid())])?.ok_or_else(hidden)
}
fn expire(
    tx: &mut Transaction<'_>,
    identity: &TrustedIdentity,
    row: &postgres::Row,
) -> Result<Value, ApiError> {
    let mut job: Value = row.get("job");
    let id: Uuid = row.get("export_id");
    let retention: DateTime<Utc> = row.get("retention_until");
    let now: DateTime<Utc> = tx.query_one("select now()", &[])?.get(0);
    if retention <= now && !matches!(job["status"].as_str(), Some("expired" | "cancelled")) {
        job["status"] = json!("expired");
        tx.execute("update quantos.bff_export_jobs set status='expired',job=$2,updated_at=now() where export_id=$1", &[&id,&job])?;
        tx.execute("update quantos.bff_export_tickets set revoked_at=now() where export_id=$1 and revoked_at is null", &[&id])?;
        log(
            tx,
            identity,
            "export.expired",
            uuid(job["correlationId"].as_str().unwrap())?,
            &id.to_string(),
            json!({"status":"expired"}),
        )?;
    }
    Ok(job)
}
async fn status(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = uuid(&id)?;
    let value = tokio::task::spawn_blocking(move || {
        let mut store = state.a2.lock().map_err(|_| ApiError::unavailable())?;
        let mut tx = store.client.transaction()?;
        if let Err(e) = admit(&mut tx, &identity, "audit:read", "getExportStatus") {
            tx.commit()?;
            return Err(e);
        }
        let row = match job_row(&mut tx, &identity, id) {
            Ok(r) => r,
            Err(e) => {
                log(
                    &mut tx,
                    &identity,
                    "export.status_denied",
                    Uuid::new_v4(),
                    "exports",
                    json!({"outcome":"denied"}),
                )?;
                tx.commit()?;
                return Err(e);
            }
        };
        let job = expire(&mut tx, &identity, &row)?;
        log(
            &mut tx,
            &identity,
            "export.status_viewed",
            uuid(job["correlationId"].as_str().unwrap())?,
            &id.to_string(),
            json!({"status":job["status"],"outcome":"succeeded"}),
        )?;
        tx.commit()?;
        Ok(job)
    })
    .await
    .map_err(|_| ApiError::unavailable())??;
    Ok(response(StatusCode::OK, value))
}
async fn cancel(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let id = uuid(&id)?;
    let key = settings::command_key(&headers)?;
    let value=tokio::task::spawn_blocking(move||state.a2.lock().map_err(|_|ApiError::unavailable())?.locked(identity.0.user_id,|store|{
  let mut tx=store.client.transaction()?;scope(&mut tx,&identity)?;let intent=json!([identity.0.auth.tenant_id,identity.0.auth.actor_id,identity.0.auth.workspace_id,identity.0.auth.account_id,id]);
  if let Err(e)=permission(&mut tx,&identity,"audit:export","cancelExport"){tx.commit()?;return Err(e);}
  if let Err(e)=settings::recent(&mut tx,&identity.1,&headers,"cancelExport"){log(&mut tx,&identity,"export.reauth_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}
  if let Some(job)=settings::replay(&mut tx,identity.0.user_id,"cancelExport",key,&intent)?{tx.commit()?;return Ok(job);}
  if let Err(e)=capability(&mut tx,&identity,"audit:export","cancelExport"){tx.commit()?;return Err(e);}
  let row=match job_row(&mut tx,&identity,id){Ok(row)=>row,Err(e)=>{log(&mut tx,&identity,"export.resource_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}};let mut job=expire(&mut tx,&identity,&row)?;if matches!(job["status"].as_str(),Some("expired"|"cancelled"|"failed")){tx.commit()?;return Err(conflict());}
  let terminal=if job["status"]=="generating" {"cancel_requested"}else{"cancelled"};job["status"]=json!(terminal);let audit=log(&mut tx,&identity,if terminal=="cancel_requested" {"export.cancel_requested"}else{"export.cancelled"},uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"status":terminal,"outcome":"succeeded"}))?;job["auditRef"]=json!(audit);
  tx.execute("update quantos.bff_export_jobs set status=$3,job=$2,lease_token=null,updated_at=now() where export_id=$1", &[&id,&job,&terminal])?;
  tx.execute("update quantos.bff_export_tickets set revoked_at=now() where export_id=$1 and revoked_at is null", &[&id])?;
  settings::save_command(&mut tx,identity.0.user_id,"cancelExport",key,&intent,&job)?;tx.commit()?;Ok(job)
 })).await.map_err(|_|ApiError::unavailable())??;
    Ok(response(StatusCode::ACCEPTED, value))
}
struct Objects {
    url: String,
    key: String,
    client: reqwest::blocking::Client,
}
impl Objects {
    fn configured() -> Result<Self, ApiError> {
        let url = std::env::var("SUPABASE_URL").map_err(|_| ApiError::unavailable())?;
        let key = std::env::var("QUANTOS_BFF_STORAGE_KEY")
            .or_else(|_| std::env::var("SUPABASE_SERVICE_ROLE_KEY"))
            .map_err(|_| ApiError::unavailable())?;
        let parsed = url::Url::parse(&url).map_err(|_| ApiError::unavailable())?;
        if key.trim().is_empty()
            || parsed.scheme() != "https"
            || !parsed
                .host_str()
                .is_some_and(|h| h.ends_with(".supabase.co"))
        {
            return Err(ApiError::unavailable());
        }
        Ok(Self {
            url,
            key,
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .map_err(|_| ApiError::unavailable())?,
        })
    }
    fn request(&self, method: reqwest::Method, object: &str) -> reqwest::blocking::RequestBuilder {
        self.client
            .request(
                method,
                format!(
                    "{}/storage/v1/object/{BUCKET}/{object}",
                    self.url.trim_end_matches('/')
                ),
            )
            .header("apikey", &self.key)
            .bearer_auth(&self.key)
    }
    fn put(&self, object: &str, bytes: Vec<u8>, media: &str) -> Result<(), ApiError> {
        let r = self
            .request(reqwest::Method::POST, object)
            .header("x-upsert", "true")
            .header("content-type", media)
            .body(bytes)
            .send()
            .map_err(|_| ApiError::unavailable())?;
        if !r.status().is_success() {
            return Err(ApiError::unavailable());
        }
        Ok(())
    }
    fn get(&self, object: &str) -> Result<Vec<u8>, ApiError> {
        let r = self
            .request(reqwest::Method::GET, object)
            .send()
            .map_err(|_| ApiError::unavailable())?;
        if !r.status().is_success() || r.content_length().is_some_and(|n| n > MAX_BYTES as u64) {
            return Err(ApiError::unavailable());
        }
        use std::io::Read;
        let mut bytes = Vec::new();
        r.take((MAX_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| ApiError::unavailable())?;
        if bytes.len() > MAX_BYTES {
            return Err(ApiError::unavailable());
        }
        Ok(bytes)
    }
    fn delete(&self, object: &str) -> Result<(), ApiError> {
        let r = self
            .request(reqwest::Method::DELETE, object)
            .send()
            .map_err(|_| ApiError::unavailable())?;
        if !r.status().is_success() && r.status() != reqwest::StatusCode::NOT_FOUND {
            let missing = r.status() == reqwest::StatusCode::BAD_REQUEST
                && r.json::<Value>().is_ok_and(|error| {
                    error["statusCode"] == "404"
                        || error["statusCode"] == 404
                        || error["code"] == "NoSuchKey"
                });
            if !missing {
                return Err(ApiError::unavailable());
            }
        }
        Ok(())
    }
    fn sign(&self, id: Uuid) -> Result<String, ApiError> {
        use openssl::{hash::MessageDigest, pkey::PKey, sign::Signer};
        let key = PKey::hmac(self.key.as_bytes()).map_err(|_| ApiError::unavailable())?;
        let mut signer =
            Signer::new(MessageDigest::sha256(), &key).map_err(|_| ApiError::unavailable())?;
        signer
            .update(format!("quantos-export-ticket-v1:{id}").as_bytes())
            .map_err(|_| ApiError::unavailable())?;
        Ok(signer
            .sign_to_vec()
            .map_err(|_| ApiError::unavailable())?
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect())
    }
}
async fn download(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = uuid(&id)?;
    let value=tokio::task::spawn_blocking(move||{
  let objects=Objects::configured()?;let mut store=state.a2.lock().map_err(|_|ApiError::unavailable())?;let mut tx=store.client.transaction()?;
  if let Err(e)=admit(&mut tx,&identity,"audit:export","getExportDownload"){tx.commit()?;return Err(e);}
  let row=match job_row(&mut tx,&identity,id){Ok(row)=>row,Err(e)=>{log(&mut tx,&identity,"export.resource_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}};let job=expire(&mut tx,&identity,&row)?;
  if job["status"]=="expired"{tx.commit()?;return Err(ApiError::new(StatusCode::GONE,"EXPORT_EXPIRED"));}
  if job["status"]!="ready" {log(&mut tx,&identity,"export.download_denied",uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"outcome":"denied"}))?;tx.commit()?;return Err(conflict());}
  let until:DateTime<Utc>=tx.query_one("select least(now()+interval '5 minutes',$1::timestamptz)", &[&row.get::<_,DateTime<Utc>>("retention_until")])?.get(0);
  let ticket=Uuid::new_v4();let signature=objects.sign(ticket)?;
  tx.execute("insert into quantos.bff_export_tickets(ticket_id,signature_hash,export_id,user_id,session_hash,expires_at) values($1,$2,$3,$4,$5,$6)", &[&ticket,&settings::hash(&signature),&id,&identity.0.user_id,&identity.1,&until])?;
  let audit=log(&mut tx,&identity,"export.download_issued",uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"outcome":"succeeded"}))?;
  let value=json!({"exportId":id,"downloadUrl":format!("{}/_bff/export-content/{ticket}/{signature}",state.terminal_origin.trim_end_matches('/')),"expiresAt":until.to_rfc3339(),"sha256":row.get::<_,Option<String>>("sha256"),"sizeBytes":row.get::<_,Option<i64>>("size_bytes"),"mediaType":row.get::<_,Option<String>>("media_type"),"watermarked":true,"retentionUntil":job["retentionUntil"],"auditRef":audit});tx.commit()?;Ok(value)
 }).await.map_err(|_|ApiError::unavailable())??;
    Ok(response(StatusCode::OK, value))
}
async fn content(
    State(state): State<Arc<LiveState>>,
    Path((ticket, signature)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let (context, session) = settings::authorized(state.clone(), headers, false).await?;
    let identity = TrustedIdentity(context, session);
    let ticket = uuid(&ticket)?;
    let (bytes,media)=tokio::task::spawn_blocking(move||{
  let objects=Objects::configured()?;let mut store=state.a2.lock().map_err(|_|ApiError::unavailable())?;let mut tx=store.client.transaction()?;
  if let Err(e)=admit(&mut tx,&identity,"audit:export","consumeExportDownload"){tx.commit()?;return Err(e);}
  let expected=objects.sign(ticket)?;
  if signature.len()!=expected.len() || !openssl::memcmp::eq(signature.as_bytes(),expected.as_bytes()) {log(&mut tx,&identity,"export.consume_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(ApiError::new(StatusCode::GONE,"EXPORT_EXPIRED"));}
  let t=tx.query_opt("select export_id from quantos.bff_export_tickets where ticket_id=$1 and signature_hash=$2 and user_id=$3 and session_hash=$4 and expires_at>now() and consumed_at is null and revoked_at is null", &[&ticket,&settings::hash(&signature),&identity.0.user_id,&identity.1])?;
  let Some(t)=t else {log(&mut tx,&identity,"export.consume_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(ApiError::new(StatusCode::GONE,"EXPORT_EXPIRED"));};
  let id:Uuid=t.get(0);let row=match job_row(&mut tx,&identity,id){Ok(row)=>row,Err(e)=>{log(&mut tx,&identity,"export.resource_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(e);}};let job=expire(&mut tx,&identity,&row)?;
  if job["status"]!="ready"{tx.commit()?;return Err(ApiError::new(StatusCode::GONE,"EXPORT_EXPIRED"));}
  if tx.execute("update quantos.bff_export_tickets set consumed_at=now() where ticket_id=$1 and consumed_at is null and revoked_at is null and expires_at>now()", &[&ticket])?!=1 {log(&mut tx,&identity,"export.consume_denied",Uuid::new_v4(),"exports",json!({"outcome":"denied"}))?;tx.commit()?;return Err(ApiError::new(StatusCode::GONE,"EXPORT_EXPIRED"));}
  let bytes=match objects.get(&row.get::<_,String>("object_key")){Ok(bytes)=>bytes,Err(e)=>{log(&mut tx,&identity,"export.download_failed",uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"outcome":"failed"}))?;tx.commit()?;return Err(e);}};
  if Some(audit_core::digest(&bytes))!=row.get::<_,Option<String>>("sha256") || Some(bytes.len() as i64)!=row.get::<_,Option<i64>>("size_bytes") {log(&mut tx,&identity,"export.integrity_failed",uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"outcome":"failed"}))?;tx.commit()?;return Err(ApiError::unavailable());}
  log(&mut tx,&identity,"export.download_consumed",uuid(job["correlationId"].as_str().unwrap())?,&id.to_string(),json!({"outcome":"succeeded"}))?;let media:String=row.get("media_type");tx.commit()?;Ok((bytes,media))
 }).await.map_err(|_|ApiError::unavailable())??;
    Ok((
        [
            (header::CONTENT_TYPE, media),
            (header::CACHE_CONTROL, "no-store".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=quantos-audit-export".to_owned(),
            ),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_owned()),
        ],
        bytes,
    )
        .into_response())
}

fn worker_scope(tx: &mut Transaction<'_>, row: &postgres::Row) -> Result<(), ApiError> {
    tx.query_one("select set_config('quantos.audit_tenant',$1,true),set_config('quantos.audit_actor',$2,true),set_config('quantos.audit_workspace',$3,true),set_config('quantos.audit_account',$4,true)", &[&row.get::<_,Uuid>("tenant_id").to_string(),&row.get::<_,Uuid>("actor_id").to_string(),&row.get::<_,Uuid>("workspace_id").to_string(),&row.get::<_,Option<Uuid>>("account_id").map(|a|a.to_string()).unwrap_or_default()])?;
    Ok(())
}
fn worker_log(
    tx: &mut Transaction<'_>,
    row: &postgres::Row,
    action: &str,
    status: &str,
) -> Result<(), ApiError> {
    worker_scope(tx, row)?;
    let job: Value = row.get("job");
    let correlation = uuid(job["correlationId"].as_str().unwrap())?;
    let id: Uuid = row.get("export_id");
    let clean = audit_core::redacted(
        &json!({"status":status,"outcome":if status=="failed"{"failed"}else{"succeeded"}}),
    );
    let details = json!({"workspaceId":row.get::<_,Uuid>("workspace_id"),"accountId":row.get::<_,Option<Uuid>>("account_id"),"objectRef":id,"redactedPayload":clean,"payloadHash":audit_core::payload_hash(&clean)});
    let event = Uuid::new_v4();
    let cause = cause(tx, correlation, event)?;
    tx.execute("insert into quantos.audit_entries(id,tenant_id,actor_id,actor_user_id,correlation_id,causation_id,action,details) values($1,$2,$3,$4,$5,$6,$7,$8)", &[&event,&row.get::<_,Uuid>("tenant_id"),&row.get::<_,Uuid>("actor_id"),&row.get::<_,Uuid>("user_id"),&correlation,&cause,&action,&details])?;
    Ok(())
}
fn tick(
    client: &mut postgres::Client,
    objects: &Objects,
    observer: &quantos_observability::service::ServiceObservability,
) -> Result<(), ApiError> {
    // Expiry is authoritative even without a consumer polling the resource.
    let mut tx = client.transaction()?;
    let requested=tx.query(&format!("select {JOB_COLUMNS} from quantos.bff_export_jobs where status='cancel_requested' for update skip locked limit 20"),&[])?;
    for row in requested {
        let id: Uuid = row.get("export_id");
        let mut job: Value = row.get("job");
        job["status"] = json!("cancelled");
        tx.execute("update quantos.bff_export_jobs set status='cancelled',job=$2,updated_at=now() where export_id=$1", &[&id,&job])?;
        worker_log(&mut tx, &row, "export.cancelled", "cancelled")?;
    }
    let expired=tx.query(&format!("select {JOB_COLUMNS} from quantos.bff_export_jobs where retention_until<=now() and status not in ('expired','cancelled','failed') for update skip locked limit 20"),&[])?;
    for row in expired {
        let id: Uuid = row.get("export_id");
        let mut job: Value = row.get("job");
        job["status"] = json!("expired");
        tx.execute("update quantos.bff_export_jobs set status='expired',job=$2,lease_token=null,updated_at=now() where export_id=$1", &[&id,&job])?;
        tx.execute("update quantos.bff_export_tickets set revoked_at=now() where export_id=$1 and revoked_at is null", &[&id])?;
        worker_log(&mut tx, &row, "export.expired", "expired")?;
    }
    tx.execute(
        "delete from quantos.bff_audit_cursors where expires_at<now()",
        &[],
    )?;
    tx.execute(
        "delete from quantos.bff_audit_quotas where window_at<now()-interval '1 hour'",
        &[],
    )?;
    tx.commit()?;
    // Persist cleanup progress. A cancelled generation cannot publish its lease;
    // its own completion branch also removes any object uploaded after cancellation.
    let cleanup=client.query("select export_id,object_key from quantos.bff_export_jobs where status in ('expired','cancelled','failed') and object_deleted_at is null limit 20",&[])?;
    for row in cleanup {
        if objects.delete(&row.get::<_, String>("object_key")).is_err() {
            continue;
        }
        client.execute("update quantos.bff_export_jobs set object_deleted_at=now(),snapshot='[]'::jsonb where export_id=$1", &[&row.get::<_,Uuid>("export_id")])?;
    }
    let mut tx = client.transaction()?;
    let candidate=tx.query_opt(&format!("select {JOB_COLUMNS},octet_length(snapshot::text)>{MAX_BYTES} as oversized,case when octet_length(snapshot::text)>{MAX_BYTES} then '[]'::jsonb else snapshot end as snapshot from quantos.bff_export_jobs where (status='queued' or status='generating' and lease_until<now()) and retention_until>now() order by created_at for update skip locked limit 1"),&[])?;
    let Some(row) = candidate else {
        tx.commit()?;
        return Ok(());
    };
    let id: Uuid = row.get("export_id");
    let lease = Uuid::new_v4();
    let mut job: Value = row.get("job");
    let attempt: i32 = row.get("attempts");
    if attempt >= 3 {
        job["status"] = json!("failed");
        tx.execute("update quantos.bff_export_jobs set status='failed',job=$2,lease_token=null where export_id=$1", &[&id,&job])?;
        worker_log(&mut tx, &row, "export.failed", "failed")?;
        tx.commit()?;
        return Ok(());
    }
    job["status"] = json!("generating");
    tx.execute("update quantos.bff_export_jobs set status='generating',job=$2,attempts=attempts+1,lease_token=$3,lease_until=now()+interval '1 minute',updated_at=now() where export_id=$1", &[&id,&job,&lease])?;
    worker_log(&mut tx, &row, "export.generating", "generating")?;
    tx.commit()?;
    let snapshot: Value = row.get("snapshot");
    let object: String = row.get("object_key");
    let (bytes, media) = audit_core::artifact(
        job["format"].as_str().unwrap(),
        job["watermark"].as_str().unwrap(),
        snapshot.as_array().ok_or_else(ApiError::unavailable)?,
    );
    let hash = audit_core::digest(&bytes);
    let size = bytes.len();
    let generated = if !row.get::<_, bool>("oversized") && size <= MAX_BYTES {
        objects.put(&object, bytes, media)
    } else {
        Err(ApiError::unavailable())
    };
    let mut tx = client.transaction()?;
    if generated.is_ok() {
        job["status"] = json!("ready");
        let now: DateTime<Utc> = tx.query_one("select now()", &[])?.get(0);
        job["completedAt"] = json!(now.to_rfc3339());
        let published=tx.execute("update quantos.bff_export_jobs set status='ready',job=$3,sha256=$4,size_bytes=$5,media_type=$6,lease_token=null,lease_until=null,updated_at=now() where export_id=$1 and lease_token=$2 and status='generating' and retention_until>now()", &[&id,&lease,&job,&hash,&(size as i64),&media])?;
        if published == 1 {
            worker_log(&mut tx, &row, "export.ready", "ready")?;
        }
        tx.commit()?;
        if published == 0 {
            objects.delete(&object)?;
        }
    } else {
        job["status"] = json!("queued");
        tx.execute("update quantos.bff_export_jobs set status='queued',job=$3,lease_token=null,lease_until=null,updated_at=now() where export_id=$1 and lease_token=$2 and status='generating'", &[&id,&lease,&job])?;
        worker_log(&mut tx, &row, "export.generation_failed", "failed")?;
        tx.commit()?;
    }
    observer
        .record_trace(
            quantos_core::CorrelationId::parse_str(job["correlationId"].as_str().unwrap())
                .map_err(|_| ApiError::unavailable())?,
            "export.generate",
            if generated.is_ok() {
                "succeeded"
            } else {
                "failed"
            },
            json!({"export_id":id,"attempt":attempt+1}),
        )
        .map_err(|_| ApiError::unavailable())?;
    Ok(())
}
pub(super) fn start_worker(
    database: &str,
    observer: Arc<quantos_observability::service::ServiceObservability>,
) -> anyhow::Result<()> {
    // Validate live configuration before serving; database-free observability
    // fixtures construct their own router and never start this worker.
    Objects::configured()
        .map_err(|_| anyhow::anyhow!("live export Storage configuration unavailable"))?;
    let database = database.to_owned();
    std::thread::Builder::new().name("bff-export-worker".into()).spawn(move||{
  let mut client=None;
  loop {
   let outcome=(||{
    if client.is_none(){client=Some(quantos_auth::connect_bff_database(&database).map_err(|_|ApiError::unavailable())?);}
    tick(client.as_mut().unwrap(),&Objects::configured()?, &observer)
   })();
   if outcome.is_err(){client=None;eprintln!("{{\"service\":\"bff-gateway\",\"event\":\"export_worker_dependency_unavailable\"}}");}
   std::thread::sleep(std::time::Duration::from_secs(1));
  }
 })?;
    Ok(())
}
