//! Production C03/C04 adapter: verified BFF identity, durable command intent,
//! R03 scheduling/cancellation, R02 source policy and verified private Storage.
use super::{
    LiveState,
    settings::{self, TrustedIdentity},
};
use crate::research::{self, Create, Fault, ListQuery, Pages, Repository, Result};
use axum::{
    Router,
    body::{Body, Bytes},
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post},
};
use chrono::Utc;
use postgres::Client;
use quantos_auth::BffSessionContext;
use quantos_core::{CorrelationId, SnapshotId, WorkflowRunId};
use quantos_policy::{Capability, Role};
use quantos_runtime::{
    pg::PgRuntimeStore,
    research::{ResearchArtifactRecord, ResearchWorkflowInput},
    research_pg::PgResearchArtifactRepository,
};
use quantos_storage::{
    SnapshotUsage,
    pg::PgStorageStore,
    provenance::{SnapshotSourcePolicy, SourceApproval},
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig},
};
use serde_json::{Value, json};
use std::{
    sync::{Arc, Mutex, OnceLock},
    time::Duration as StdDuration,
};
use uuid::Uuid;

fn env(name: &str) -> Result<String> {
    std::env::var(name).map_err(|_| Fault::unavailable())
}
pub(super) fn source_policy() -> Result<SnapshotSourcePolicy> {
    let approvals: Vec<SourceApproval> = serde_json::from_slice(
        &std::fs::read(env("QUANTOS_BFF_RESEARCH_SOURCE_POLICY")?)
            .map_err(|_| Fault::unavailable())?,
    )
    .map_err(|_| Fault::unavailable())?;
    SnapshotSourcePolicy::new(approvals).map_err(|_| Fault::unavailable())
}
fn evidence_id(artifact: Uuid, raw: &str) -> Uuid {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(format!("{artifact}:{raw}").as_bytes());
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&hash[..16]);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    Uuid::from_bytes(bytes)
}
fn pages() -> &'static Mutex<Pages> {
    static P: OnceLock<Mutex<Pages>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(Pages::default()))
}
pub(super) fn routes() -> Router<Arc<LiveState>> {
    Router::new()
        .route("/v1/research-runs", get(handle).post(handle))
        .route("/v1/research-runs/:id", get(handle))
        .route("/v1/research-runs/:id/cancel", post(handle))
        .route("/v1/research-runs/:id/stream", get(handle))
        .route("/v1/data-snapshots", get(handle))
        .route("/v1/data-snapshots/:id", get(handle))
        .route("/v1/artifacts/:id", get(handle))
        .route("/v1/artifacts/:id/attachment", get(handle))
}
fn authorize(c: &BffSessionContext, path: &str, write: bool) -> Result<()> {
    let capability = if path.contains("data-snapshots") {
        "snapshot.read"
    } else if write {
        "research.write"
    } else {
        "research.read"
    };
    if !c.auth.capabilities.iter().any(|v| v.as_str() == capability)
        || write && c.auth.role == Role::Viewer
    {
        return Err(Fault(StatusCode::FORBIDDEN, "FORBIDDEN"));
    }
    Ok(())
}
fn scope(c: &BffSessionContext) -> String {
    format!(
        "{}:{}:{}:{:?}:{}",
        c.auth.tenant_id,
        c.auth.actor_id,
        c.auth.workspace_id,
        c.auth.account_id,
        c.auth.mode.as_str()
    )
}
async fn handle(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
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
    if let Err(e) = authorize(&identity.0, uri.path(), method == Method::POST) {
        return e.response();
    }
    static QUOTA: OnceLock<Mutex<research::Quota>> = OnceLock::new();
    let operation = crate::input_contract::operation(method.as_str(), uri.path())
        .and_then(|v| v["operationId"].as_str())
        .unwrap_or("unknown");
    let quota = QUOTA
        .get_or_init(|| Mutex::new(research::Quota::default()))
        .lock()
        .map_err(|_| Fault::unavailable())
        .and_then(|mut quota| quota.take(&scope(&identity.0), operation, Utc::now()));
    if let Err(e) = quota {
        return e.response();
    }
    if uri.path().starts_with("/v1/artifacts/")
        && let Some(host) = state.strategy.clone()
    {
        let artifact = uri
            .path()
            .split('/')
            .nth(3)
            .and_then(|s| Uuid::parse_str(s).ok());
        if let Some(id) = artifact {
            let state_copy = state.clone();
            let identity_copy = identity.clone();
            let attachment = uri.path().ends_with("/attachment");
            let path = uri.path().to_owned();
            let result = tokio::task::spawn_blocking(move || -> Result<Option<Value>> {
                let host = host.lock().map_err(|_| Fault::unavailable())?;
                let Some(mut value) = host.artifact(&identity_copy.0.auth, id, attachment)? else {
                    return Ok(None);
                };
                value["auditRef"] = json!(Uuid::now_v7());
                value["correlationId"] = json!(Uuid::now_v7());
                let mut db = state_copy.a2.lock().map_err(|_| Fault::unavailable())?;
                let mut tx = db.client.transaction().map_err(|_| Fault::unavailable())?;
                super::audit::execution_log(
                    &mut tx,
                    &identity_copy,
                    &path,
                    &value,
                    &json!({"reason":"strategy report read"}),
                )
                .map_err(|_| Fault::unavailable())?;
                tx.commit().map_err(|_| Fault::unavailable())?;
                Ok(Some(value))
            })
            .await;
            match result {
                Ok(Ok(Some(v))) => return crate::execution::output(StatusCode::OK, v),
                Ok(Ok(None)) => {}
                Ok(Err(e)) => return e.response(),
                Err(_) => return Fault::unavailable().response(),
            }
        }
    }
    if uri.path().ends_with("/stream") {
        return stream(
            state,
            identity.0,
            headers,
            uri.path().to_owned(),
            q.after_sequence.unwrap_or(0),
        )
        .await;
    }
    let path = uri.path().to_owned();
    let c = identity.0;
    let database = state.database_url.clone();
    let operations = state.operations.clone();
    let result = tokio::task::spawn_blocking(move || {
        // Hold the same governance lease through the workflow transaction so a
        // concurrent revocation cannot cross capability admission and enqueue.
        let ops = operations
            .as_ref()
            .map(|h| h.lock().map_err(|_| Fault::unavailable()))
            .transpose()?;
        if method == Method::POST
            && path == "/v1/research-runs"
            && let Some(host) = &ops
        {
            host.authorize_engine_input(&body, Utc::now())?;
        }
        let scope = scope(&c);
        let mut repo = PgPages::connect(database, &c)?;
        research::dispatch(
            &mut repo,
            &mut *pages().lock().map_err(|_| Fault::unavailable())?,
            &scope,
            &method,
            &path,
            &q,
            &headers,
            &body,
            Utc::now(),
        )
    })
    .await;
    match result {
        Ok(Ok(o)) => o.response(),
        Ok(Err(e)) => e.response(),
        Err(_) => Fault::unavailable().response(),
    }
}
async fn stream(
    state: Arc<LiveState>,
    c: BffSessionContext,
    headers: HeaderMap,
    path: String,
    after: u64,
) -> Response {
    let id = match path.split('/').nth(3).and_then(|v| Uuid::parse_str(v).ok()) {
        Some(v) => v,
        None => return Fault::invalid().response(),
    };
    let db = state.database_url.clone();
    let identity = c.clone();
    // Resolve and validate before committing HTTP 200; no hidden-resource stream.
    let initial =
        tokio::task::spawn_blocking(move || PgPages::connect(db, &identity)?.events(id, after))
            .await;
    let initial = match initial {
        Ok(Ok(v)) => v,
        Ok(Err(e)) => return e.response(),
        Err(_) => return Fault::unavailable().response(),
    };
    static LIMIT: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    let permit = match LIMIT
        .get_or_init(|| Arc::new(tokio::sync::Semaphore::new(64)))
        .clone()
        .try_acquire_owned()
    {
        Ok(p) => p,
        Err(_) => return Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED").response(),
    };
    let output = futures_util::stream::unfold(
        (state, c, headers, id, after, Some(initial), false, permit),
        |(state, c, headers, id, mut after, initial, done, permit)| async move {
            if done {
                return None;
            }
            if initial.is_none() {
                tokio::time::sleep(StdDuration::from_secs(1)).await;
            }
            let auth = settings::authorized(state.clone(), headers.clone(), false).await;
            let allowed = auth.as_ref().is_ok_and(|(fresh, _)| {
                scope(fresh) == scope(&c) && authorize(fresh, "/v1/research-runs", false).is_ok()
            });
            let (text, done) = if !allowed {
                let e = json!({"streamId":id,"sequence":after+1,"eventId":Uuid::new_v4(),"occurredAt":Utc::now(),"correlationId":Uuid::new_v4(),"payloadVersion":"v1","payload":{"type":"permission_revoked"}});
                (format!("data: {e}\n\n"), true)
            } else {
                let events = if let Some(v) = initial {
                    Ok(v)
                } else {
                    let db = state.database_url.clone();
                    let identity = c.clone();
                    tokio::task::spawn_blocking(move || {
                        PgPages::connect(db, &identity)?.events(id, after)
                    })
                    .await
                    .unwrap_or_else(|_| Err(Fault::unavailable()))
                };
                match events {
                    Ok(events) => {
                        let mut text = String::new();
                        for e in events {
                            after = e["sequence"].as_u64().unwrap();
                            text.push_str(&format!("id: {after}\ndata: {e}\n\n"));
                        }
                        if text.is_empty() {
                            text = ": heartbeat\n\n".to_owned();
                        }
                        (text, false)
                    }
                    Err(_) => (
                        ": dependency unavailable; reconnect with afterSequence\n\n".to_owned(),
                        true,
                    ),
                }
            };
            Some((
                Ok::<_, std::convert::Infallible>(Bytes::from(text)),
                (state, c, headers, id, after, None, done, permit),
            ))
        },
    );
    let mut response = Response::new(Body::from_stream(output));
    response
        .headers_mut()
        .insert("content-type", "text/event-stream".parse().unwrap());
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().unwrap());
    response.headers_mut().insert(
        "x-correlation-id",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    response
}

struct PgPages {
    client: Client,
    context: BffSessionContext,
}
impl PgPages {
    fn connect(database: String, c: &BffSessionContext) -> Result<Self> {
        let mut client =
            quantos_auth::connect_bff_database(&database).map_err(|_| Fault::unavailable())?;
        client
            .batch_execute("set statement_timeout='15s'")
            .map_err(|_| Fault::unavailable())?;
        // Session lock is released on connection drop, including every error path.
        client
            .query_one(
                "select pg_advisory_lock(hashtextextended($1,33))",
                &[&scope(c)],
            )
            .map_err(|_| Fault::unavailable())?;
        client.query_one("select set_config('quantos.page_tenant',$1,false),set_config('quantos.page_actor',$2,false),set_config('quantos.page_workspace',$3,false),set_config('quantos.page_account',$4,false),set_config('quantos.page_mode',$5,false)", &[&c.auth.tenant_id.to_string(),&c.auth.actor_id.to_string(),&c.auth.workspace_id.to_string(),&c.auth.account_id.map(|v|v.to_string()).unwrap_or_default(),&c.auth.mode.as_str()]).map_err(|_|Fault::unavailable())?;
        Ok(Self {
            client,
            context: c.clone(),
        })
    }
    fn runtime(&self) -> Result<PgRuntimeStore> {
        PgRuntimeStore::connect_as_runtime(&env("QUANTOS_RUNTIME_DATABASE_URL")?)
            .map_err(|_| Fault::unavailable())
    }
    fn snapshots_store(&self) -> Result<PgStorageStore> {
        PgStorageStore::connect(&env("QUANTOS_BFF_SNAPSHOT_DATABASE_URL")?)
            .map_err(|_| Fault::unavailable())
    }
    fn stored(&mut self, id: Uuid) -> Result<Value> {
        self.client.query_opt("select response from quantos.bff_research_commands where run_id=$1 and operation='create' and completed",&[&id]).map_err(|_|Fault::unavailable())?.map(|r|r.get(0)).ok_or_else(Fault::hidden)
    }
    fn owned_run(&mut self, id: Uuid) -> Result<quantos_runtime::WorkflowRun> {
        self.stored(id)?;
        let c = &self.context;
        self.runtime()?
            .load_run(WorkflowRunId::from_uuid(id))
            .map_err(|_| Fault::unavailable())?
            .filter(|r| {
                r.tenant_id == c.auth.tenant_id
                    && r.actor_id == c.auth.actor_id
                    && r.workspace_id == c.auth.workspace_id
                    && r.account_id == c.auth.account_id
                    && r.workflow_kind == "research"
            })
            .ok_or_else(Fault::hidden)
    }
    fn command(
        &mut self,
        op: &str,
        key: Uuid,
        intent: &Value,
    ) -> Result<Option<(Value, Value, bool)>> {
        let row=self.client.query_opt("select intent,plan,response,completed from quantos.bff_research_commands where operation=$1 and idempotency_key=$2", &[&op,&key]).map_err(|_|Fault::unavailable())?;
        if let Some(row) = row {
            if row.get::<_, Value>(0) != *intent {
                return Err(Fault(StatusCode::CONFLICT, "IDEMPOTENCY_CONFLICT"));
            }
            Ok(Some((row.get(1), row.get(2), row.get(3))))
        } else {
            Ok(None)
        }
    }
    fn prepare(&mut self, op: &str, key: Uuid, intent: &Value, plan: &Value) -> Result<()> {
        let c = &self.context;
        self.client.execute("insert into quantos.bff_research_commands(tenant_id,actor_id,workspace_id,account_id,mode,operation,idempotency_key,intent,plan) values($1,$2,$3,$4,$5,$6,$7,$8,$9)", &[c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),c.auth.workspace_id.as_uuid(),&c.auth.account_id.map(|v|*v.as_uuid()),&c.auth.mode.as_str(),&op,&key,&intent,&plan]).map_err(|_|Fault::unavailable())?;
        Ok(())
    }
    fn finish(&mut self, op: &str, key: Uuid, id: Uuid, response: &Value) -> Result<()> {
        let mut tx = self
            .client
            .transaction()
            .map_err(|_| Fault::unavailable())?;
        tx.execute("update quantos.bff_research_commands set response=$3,run_id=$4,completed=true where operation=$1 and idempotency_key=$2",&[&op,&key,&response,&id]).map_err(|_|Fault::unavailable())?;
        let c = &self.context;
        let correlation = research::uuid(
            response["correlationId"]
                .as_str()
                .ok_or_else(Fault::unavailable)?,
        )?;
        let audit = research::uuid(
            response["auditRef"]
                .as_str()
                .ok_or_else(Fault::unavailable)?,
        )?;
        tx.execute("insert into quantos.bff_settings_audits(audit_ref,user_id,tenant_id,actor_id,action,object_ref,correlation_id) values($1,$2,$3,$4,$5,$6,$7) on conflict(audit_ref) do nothing",&[&audit,&c.user_id,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),&format!("research.{op}"),&id.to_string(),&correlation]).map_err(|_|Fault::unavailable())?;
        let event = json!({"streamId":id,"sequence":0,"eventId":audit,"occurredAt":Utc::now(),"correlationId":correlation,"payloadVersion":"v1","payload":{"type":format!("research.{op}"),"runId":id}});
        tx.execute("insert into quantos.bff_research_events(run_id,sequence,source_id,event) select $1,coalesce(max(sequence),0)+1,$2,$3 from quantos.bff_research_events where run_id=$1 on conflict(run_id,source_id) do nothing",&[&id,&audit,&event]).map_err(|_|Fault::unavailable())?;
        tx.commit().map_err(|_| Fault::unavailable())?;
        Ok(())
    }
    fn record(&mut self, id: Uuid) -> Result<ResearchArtifactRecord> {
        let row=self.client.query_opt("select run_id from quantos.bff_research_commands where operation='create' and completed and run_id in(select workflow_run_id from quantos.workflow_run_artifacts where artifact_id=$1)",&[&id]).map_err(|_|Fault::unavailable())?.ok_or_else(Fault::hidden)?;
        let run_id: Uuid = row.get(0);
        self.owned_run(run_id)?;
        let key = env("QUANTOS_RUNTIME_STORAGE_KEY")?;
        let storage = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
            project_url: env("SUPABASE_URL")?,
            bucket_name: "quantos-artifacts".into(),
            api_key: key.clone(),
            authorization_token: Some(key),
            upsert: false,
        })
        .map_err(|_| Fault::unavailable())?;
        let mut runtime = self.runtime()?;
        let record = PgResearchArtifactRepository {
            runtime: &mut runtime,
            storage: &storage,
        }
        .replay(
            self.context.auth.tenant_id,
            self.context.auth.actor_id,
            WorkflowRunId::from_uuid(run_id),
        )
        .map_err(|_| Fault::unavailable())?;
        if *record.artifact_manifest.artifact_id.as_uuid() != id {
            return Err(Fault::hidden());
        }
        Ok(record)
    }
}
impl Repository for PgPages {
    fn snapshots(&mut self, q: &ListQuery) -> Result<Vec<Value>> {
        // Push supported predicates into SQL before the bounded materialization.
        let quality = q.quality.as_deref().map(|v| match v {
            "verified" => "passed",
            "provisional" => "pending",
            v => v,
        });
        let (field, value) = q
            .filter
            .as_deref()
            .and_then(|f| f.split_once(":eq:"))
            .map(|(f, v)| (Some(f), Some(v)))
            .unwrap_or_default();
        let rows=self.client.query("select id from quantos.data_snapshots where ($1::text is null or quality=$1) and ($2::text is null or case $2 when 'snapshotId' then id::text when 'quality' then case quality when 'passed' then 'verified' when 'pending' then 'provisional' else quality end when 'licenseLabel' then license_label end=$3) order by captured_at,id limit 2001",&[&quality,&field,&value]).map_err(|_|Fault::unavailable())?;
        if rows.len() > 2000 {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "NARROW_QUERY"));
        }
        rows.into_iter().map(|r| self.snapshot(r.get(0))).collect()
    }
    fn snapshot(&mut self, id: Uuid) -> Result<Value> {
        let c = &self.context;
        let snapshot = self
            .snapshots_store()?
            .get_data_snapshot(c.auth.tenant_id, SnapshotId::from_uuid(id))
            .map_err(|_| Fault::unavailable())?
            .ok_or_else(Fault::hidden)?;
        let mut store = self.snapshots_store()?;
        let allowed = source_policy().ok().is_some_and(|policy| {
            store
                .load_authorized_snapshot(
                    c.auth.tenant_id,
                    SnapshotId::from_uuid(id),
                    SnapshotUsage::Research,
                    Utc::now(),
                    &policy,
                )
                .is_ok()
        });
        let quality = match snapshot.quality.as_str() {
            "passed" => "verified",
            "pending" => "provisional",
            v => v,
        };
        Ok(
            json!({"snapshotId":snapshot.snapshot_id,"schemaVersion":snapshot.schema_version,"window":research::snapshot_window(snapshot.window.start_at,snapshot.window.end_at),"sources":snapshot.sources.iter().map(|s|s.source_id.clone()).collect::<Vec<_>>(),"quality":quality,"qualityBlocked":!allowed,"contentHash":snapshot.content_hash,"licenseLabel":snapshot.license_label,"capturedAt":snapshot.captured_at,"maxAgeSeconds":snapshot.max_age_secs}),
        )
    }
    fn runs(&mut self, q: &ListQuery) -> Result<Vec<Value>> {
        let (field, value) = q
            .filter
            .as_deref()
            .and_then(|f| f.split_once(":eq:"))
            .map(|(f, v)| (Some(f), Some(v)))
            .unwrap_or_default();
        let rows=self.client.query("select run_id from quantos.bff_research_commands c join quantos.workflow_runs r on r.id=c.run_id where c.operation='create' and c.completed and ($1::text is null or case r.status when 'timed_out' then 'failed' else r.status end=$1) and ($2::text is null or c.intent->>'dataSnapshotId'=$2) and ($3::text is null or case $3 when 'runId' then r.id::text when 'dataSnapshotId' then c.intent->>'dataSnapshotId' when 'status' then case r.status when 'timed_out' then 'failed' else r.status end when 'correlationId' then r.correlation_id::text end=$4) order by c.created_at,c.run_id limit 2001", &[&q.status,&q.data_snapshot_id,&field,&value]).map_err(|_|Fault::unavailable())?;
        if rows.len() > 2000 {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "NARROW_QUERY"));
        }
        rows.into_iter().map(|r| self.run(r.get(0))).collect()
    }
    fn run(&mut self, id: Uuid) -> Result<Value> {
        let run = self.owned_run(id)?;
        let row=self.client.query_one("select intent,response,(select cost_used_units::text from quantos.workflow_runs where id=$1) as cost from quantos.bff_research_commands where run_id=$1 and operation='create' and completed",&[&id]).map_err(|_|Fault::unavailable())?;
        let intent: Value = row.get(0);
        let accepted: Value = row.get(1);
        let mut runtime = self.runtime()?;
        let cp = runtime
            .load_checkpoint(run.workflow_run_id)
            .map_err(|_| Fault::unavailable())?;
        let artifact = cp
            .as_ref()
            .and_then(|cp| cp.payload.get("artifact"))
            .map(|v| serde_json::from_value::<ResearchArtifactRecord>(v.clone()))
            .transpose()
            .map_err(|_| Fault::unavailable())?;
        let engine = artifact
            .as_ref()
            .and_then(|a| a.output["environment"]["engine_version"].as_str())
            .unwrap_or("pending");
        Ok(
            json!({"runId":id,"capability":run.capability,"dataSnapshotId":intent["dataSnapshotId"],"budget":run.cost_budget_units.to_string(),"costUnits":row.get::<_,String>("cost"),"deadlineAt":run.deadline_at,"status":if run.status.as_str()=="timed_out"{"failed"}else{run.status.as_str()},"inputHash":run.input_hash,"engineVersion":engine,"artifactRefs":artifact.as_ref().map(|a|vec![a.artifact_manifest.artifact_id]).unwrap_or_default(),"evidenceRefs":artifact.as_ref().map(|a|a.evidence_refs.iter().map(|e|evidence_id(*a.artifact_manifest.artifact_id.as_uuid(),&e.evidence_id)).collect::<Vec<_>>()).unwrap_or_default(),"correlationId":run.correlation_id,"auditRef":accepted["auditRef"],"createdAt":run.created_at}),
        )
    }
    fn create(&mut self, key: Uuid, input: Create) -> Result<Value> {
        let intent = serde_json::to_value(&input).map_err(|_| Fault::invalid())?;
        let prior = self.command("create", key, &intent)?;
        if let Some((_, response, true)) = &prior {
            return Ok(response.clone());
        }
        input.validate(Utc::now())?;
        if !self
            .context
            .auth
            .capabilities
            .iter()
            .any(|v| v.as_str() == input.capability)
        {
            return Err(Fault(StatusCode::FORBIDDEN, "CAPABILITY_DENIED"));
        }
        let policy = source_policy()?;
        self.snapshots_store()?
            .load_authorized_snapshot(
                self.context.auth.tenant_id,
                SnapshotId::from_uuid(input.data_snapshot_id),
                SnapshotUsage::Research,
                Utc::now(),
                &policy,
            )
            .map_err(|_| Fault(StatusCode::UNPROCESSABLE_ENTITY, "SNAPSHOT_BLOCKED"))?;
        let contents = input
            .attachments
            .iter()
            .map(|id| self.record(*id).map(|r| r.output))
            .collect::<Result<Vec<_>>>()?;
        let engine_input = research::engine_input(&input.question, &contents)?;
        let plan = if let Some((plan, _, false)) = prior {
            plan
        } else {
            let n:i64=self.client.query_one("select count(*) from quantos.bff_research_commands where created_at>now()-interval '1 minute'",&[]).map_err(|_|Fault::unavailable())?.get(0);
            if n >= 30 {
                return Err(Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED"));
            }
            let mut runtime = self.runtime()?;
            let now = Utc::now();
            let session = runtime
                .create_session(
                    &self.context.auth,
                    now,
                    self.context.expires_at.min(input.deadline_at),
                )
                .map_err(|_| Fault::unavailable())?;
            let request = ResearchWorkflowInput {
                runtime_session_id: session.runtime_session_id,
                tool_name: input.capability.clone(),
                capability: Capability::parse(&input.capability).map_err(|_| Fault::invalid())?,
                workflow_kind: "research".into(),
                idempotency_key: format!(
                    "bff:{}:{}:{}",
                    self.context.auth.actor_id,
                    scope(&self.context),
                    key
                ),
                correlation_id: CorrelationId::new(),
                data_snapshot_id: SnapshotId::from_uuid(input.data_snapshot_id),
                policy_context_ref: format!(
                    "bff:{}",
                    research::digest(&json!(scope(&self.context)))
                ),
                input_schema_version: "v1".into(),
                input: engine_input,
                max_attempts: 3,
                deadline_at: input.deadline_at,
                cost_budget_units: input.validate(now)?,
                rate_limit_per_minute: 30,
            };
            let plan = serde_json::to_value(request).map_err(|_| Fault::unavailable())?;
            self.prepare("create", key, &intent, &plan)?;
            plan
        };
        let request = serde_json::from_value(plan).map_err(|_| Fault::unavailable())?;
        let run = self
            .runtime()?
            .enqueue_research(request, Utc::now())
            .map_err(|_| Fault::unavailable())?;
        let id = *run.workflow_run_id.as_uuid();
        let response = json!({"jobId":id,"status":"accepted","statusRef":format!("/v1/research-runs/{id}"),"correlationId":run.correlation_id,"auditRef":Uuid::new_v4()});
        self.finish("create", key, id, &response)?;
        Ok(response)
    }
    fn cancel(&mut self, id: Uuid, key: Uuid) -> Result<Value> {
        let intent = json!({"runId":id});
        if let Some((_, response, true)) = self.command("cancel", key, &intent)? {
            return Ok(response);
        }
        let run = self.owned_run(id)?;
        if self.command("cancel", key, &intent)?.is_none() {
            self.prepare("cancel", key, &intent, &Value::Null)?;
        }
        let status = run.status.as_str();
        if !matches!(
            status,
            "queued" | "running" | "cancel_requested" | "cancelled"
        ) {
            return Err(Fault(StatusCode::CONFLICT, "STATE_CONFLICT"));
        }
        if matches!(status, "queued" | "running") {
            self.runtime()?
                .request_research_cancel(
                    self.context.auth.tenant_id,
                    self.context.auth.actor_id,
                    run.workflow_run_id,
                    Utc::now(),
                )
                .map_err(|_| Fault::unavailable())?;
        }
        let response = json!({"jobId":id,"status":"cancel_requested","statusRef":format!("/v1/research-runs/{id}"),"correlationId":run.correlation_id,"auditRef":Uuid::new_v4()});
        self.finish("cancel", key, id, &response)?;
        Ok(response)
    }
    fn artifact(&mut self, id: Uuid, attachment: bool) -> Result<Value> {
        let record = self.record(id)?;
        let content = record.output;
        let manifest = record.artifact_manifest;
        let audit = Uuid::new_v4();
        let correlation = Uuid::new_v4();
        let c = &self.context;
        self.client.execute("insert into quantos.bff_settings_audits(audit_ref,user_id,tenant_id,actor_id,action,object_ref,correlation_id) values($1,$2,$3,$4,'research.artifact.read',$5,$6)",&[&audit,&c.user_id,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),&id.to_string(),&correlation]).map_err(|_|Fault::unavailable())?;
        if attachment {
            return Ok(
                json!({"artifactId":id,"mediaType":manifest.media_type,"contentHash":manifest.content_hash,"content":content,"auditRef":audit,"correlationId":correlation}),
            );
        }
        let required = |v: &Value| {
            v.as_str()
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .ok_or_else(Fault::unavailable)
        };
        Ok(
            json!({"artifactId":id,"hypothesis":required(&content["hypothesis"])? ,"summary":required(&content["summary"])? ,"engineVersion":required(&content["environment"]["engine_version"])? ,"promptVersion":content["prompt_version"].as_str().unwrap_or("unreported") ,"codeVersion":content["environment"]["code_version"].as_str().unwrap_or("unreported") ,"environmentHash":research::digest(&content["environment"]),"dataSnapshotId":record.data_snapshot_id,"contentHash":manifest.content_hash,"createdAt":record.created_at,"auditRef":audit,"correlationId":correlation,"evidence":record.evidence_refs.iter().map(|e|json!({"evidenceId":evidence_id(id,&e.evidence_id),"artifactId":id,"summary":e.summary})).collect::<Vec<_>>()}),
        )
    }
    fn events(&mut self, id: Uuid, after: u64) -> Result<Vec<Value>> {
        let run = self.owned_run(id)?;
        let source = self
            .runtime()?
            .research_page_events(run.tenant_id, run.actor_id, run.workflow_run_id, 0)
            .map_err(|_| Fault::unavailable())?;
        for event in source {
            let source_id =
                research::uuid(event["eventId"].as_str().ok_or_else(Fault::unavailable)?)?;
            self.client.execute("insert into quantos.bff_research_events(run_id,sequence,source_id,event) select $1,coalesce(max(sequence),0)+1,$2,$3 from quantos.bff_research_events where run_id=$1 on conflict(run_id,source_id) do nothing",&[&id,&source_id,&event]).map_err(|_|Fault::unavailable())?;
        }
        let max: i64 = self
            .client
            .query_one(
                "select coalesce(max(sequence),0) from quantos.bff_research_events where run_id=$1",
                &[&id],
            )
            .map_err(|_| Fault::unavailable())?
            .get(0);
        if after > max as u64 {
            return Err(Fault(StatusCode::CONFLICT, "SEQUENCE_AHEAD"));
        }
        let rows=self.client.query("select sequence,event from quantos.bff_research_events where run_id=$1 and sequence>$2 order by sequence limit 2001",&[&id,&(after as i64)]).map_err(|_|Fault::unavailable())?;
        if rows.len() > 2000 {
            return Err(Fault(StatusCode::CONFLICT, "REPLAY_WINDOW_EXCEEDED"));
        }
        Ok(rows
            .into_iter()
            .map(|r| {
                let mut event: Value = r.get(1);
                event["sequence"] = json!(r.get::<_, i64>(0));
                event
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quantos_auth::AuthContext;
    use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
    use quantos_policy::RunMode;
    fn context() -> BffSessionContext {
        BffSessionContext {
            user_id: Uuid::new_v4(),
            auth: AuthContext {
                tenant_id: TenantId::from_uuid(Uuid::new_v4()),
                actor_id: ActorId::from_uuid(Uuid::new_v4()),
                user_id: Uuid::new_v4(),
                workspace_id: WorkspaceId::from_uuid(Uuid::new_v4()),
                workspace_slug: "test".into(),
                workspace_name: "Test".into(),
                role: Role::Owner,
                mode: RunMode::Paper,
                account_id: Some(AccountId::from_uuid(Uuid::new_v4())),
                capabilities: ["research.read", "research.write", "snapshot.read"]
                    .into_iter()
                    .map(|v| Capability::parse(v).unwrap())
                    .collect(),
            },
            mfa_verified: true,
            expires_at: Utc::now() + chrono::Duration::minutes(5),
        }
    }
    #[test]
    fn live_authority_uses_server_grants_and_viewer_cannot_write() {
        let mut c = context();
        assert!(authorize(&c, "/v1/research-runs", true).is_ok());
        assert!(authorize(&c, "/v1/data-snapshots", false).is_ok());
        c.auth.role = Role::Viewer;
        assert!(authorize(&c, "/v1/research-runs", true).is_err());
        assert!(authorize(&c, "/v1/research-runs", false).is_ok());
        c.auth.capabilities.clear();
        assert!(authorize(&c, "/v1/research-runs", false).is_err());
        assert!(authorize(&c, "/v1/data-snapshots", false).is_err());
    }
    #[test]
    fn cache_scope_changes_on_tenant_actor_workspace_account_or_mode_switch() {
        let c = context();
        let before = scope(&c);
        for dimension in 0..5 {
            let mut changed = c.clone();
            match dimension {
                0 => changed.auth.tenant_id = TenantId::from_uuid(Uuid::new_v4()),
                1 => changed.auth.actor_id = ActorId::from_uuid(Uuid::new_v4()),
                2 => changed.auth.workspace_id = WorkspaceId::from_uuid(Uuid::new_v4()),
                3 => changed.auth.account_id = None,
                _ => changed.auth.mode = RunMode::Shadow,
            }
            assert_ne!(scope(&changed), before);
        }
    }
    #[test]
    fn evidence_ids_are_stable_locatable_and_bound_to_the_artifact() {
        let id = Uuid::new_v4();
        let a = evidence_id(id, "engine-evidence-1");
        assert_eq!(a, evidence_id(id, "engine-evidence-1"));
        assert_ne!(a, evidence_id(id, "engine-evidence-2"));
        assert_ne!(a, evidence_id(Uuid::new_v4(), "engine-evidence-1"));
        assert_eq!(a.get_version_num(), 4);
    }
}

/// One bounded read query; never load artifacts, start a workflow, or call an Engine.
/// The connection is dropped with all page settings on every path. Target/RLS
/// execution remains an explicit release obligation.
pub(super) fn command_source(
    database: &str,
    c: &BffSessionContext,
    now: chrono::DateTime<Utc>,
) -> Result<Value> {
    authorize(c, "/v1/research-runs", false)?;
    let mut client =
        quantos_auth::connect_bff_database(database).map_err(|_| Fault::unavailable())?;
    client
        .batch_execute("set statement_timeout='2s'; set lock_timeout='100ms'")
        .map_err(|_| Fault::unavailable())?;
    let a = &c.auth;
    client.query_one("select set_config('quantos.page_tenant',$1,false),set_config('quantos.page_actor',$2,false),set_config('quantos.page_workspace',$3,false),set_config('quantos.page_account',$4,false),set_config('quantos.page_mode',$5,false)",&[&a.tenant_id.to_string(),&a.actor_id.to_string(),&a.workspace_id.to_string(),&a.account_id.map(|v|v.to_string()).unwrap_or_default(),&a.mode.as_str()]).map_err(|_|Fault::unavailable())?;
    let rows=client.query("select r.id,r.status,r.created_at from quantos.bff_research_commands c join quantos.workflow_runs r on r.id=c.run_id join quantos.runtime_sessions rs on rs.id=r.runtime_session_id where c.operation='create' and c.completed and c.tenant_id=$1 and c.workspace_id=$2 and c.actor_id=$3 and c.account_id=$4 and c.mode=$5 and r.tenant_id=$1 and r.workspace_id=$2 and r.actor_id=$3 and r.account_id=$4 and rs.tenant_id=$1 and rs.workspace_id=$2 and rs.actor_id=$3 and rs.account_id=$4 and rs.mode=$5 and r.workflow_kind='research' order by r.created_at desc,r.id limit 2001",&[a.tenant_id.as_uuid(),a.workspace_id.as_uuid(),a.actor_id.as_uuid(),&a.account_id.map(|v|*v.as_uuid()),&a.mode.as_str()]).map_err(|_|Fault::unavailable())?;
    let rows=rows.iter().map(|r|json!({"runId":r.get::<_,Uuid>(0),"status":r.get::<_,String>(1),"createdAt":r.get::<_,chrono::DateTime<Utc>>(2)})).collect::<Vec<_>>();
    Ok(crate::command::research_source(a, &rows, now))
}
