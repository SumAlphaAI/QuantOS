//! C05 page boundary over the real S01/S02/S03/S04 service. Trusted inputs
//! are supplied by an owner; neither source code nor validation can be forged
//! by an HTTP body. This lease is process-local and is denied after audit failure.
use crate::research::{Fault, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{get, post, put},
};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_policy::{Capability, Role, RunMode};
use quantos_strategy::{
    drafts::DraftService,
    service::{Clock, Page, StrategyInput, StrategyService},
};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{
        Arc,
        atomic::{AtomicI64, Ordering},
    },
};
use tokio::sync::Mutex;
use uuid::Uuid;
struct HostClock(AtomicI64);
impl Clock for HostClock {
    fn now(&self) -> DateTime<Utc> {
        DateTime::from_timestamp_micros(self.0.load(Ordering::SeqCst)).expect("trusted clock")
    }
}
#[derive(Clone)]
struct Draft {
    scope: (String, String),
    input: Uuid,
    page: Value,
}
#[derive(Clone)]
struct Replay {
    intent: String,
    status: StatusCode,
    page: Value,
}
#[derive(Clone)]
struct Cursor {
    binding: String,
    rows: Vec<Value>,
    offset: usize,
    expires: DateTime<Utc>,
}
pub struct StrategyHost {
    core: StrategyService,
    clock: Arc<HostClock>,
    inputs: BTreeMap<Uuid, StrategyInput>,
    drafts: BTreeMap<Uuid, Draft>,
    runs: BTreeMap<Uuid, Value>,
    releases: BTreeMap<Uuid, Value>,
    approvals: BTreeMap<Uuid, Value>,
    replays: BTreeMap<String, Replay>,
    cursors: BTreeMap<Uuid, Cursor>,
    proofs: BTreeSet<String>,
    journals: BTreeMap<Uuid, Vec<Value>>,
    quota: crate::research::Quota,
    pub(crate) poisoned: bool,
}
impl std::fmt::Debug for StrategyHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("StrategyHost(process-local,trusted-inputs)")
    }
}
fn fault(s: u16, c: &'static str) -> Fault {
    Fault(StatusCode::from_u16(s).unwrap(), c)
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v[k].as_str().ok_or_else(Fault::invalid)
}
fn uid(v: &Value, k: &str) -> Result<Uuid> {
    crate::research::uuid(text(v, k)?)
}
fn scope(a: &AuthContext) -> (String, String) {
    (a.tenant_id.to_string(), a.workspace_id.to_string())
}
fn can(a: &AuthContext, c: &str) -> bool {
    a.capabilities.iter().any(|v| v.as_str() == c)
        && matches!(
            (c, a.role),
            (Capability::STRATEGY_WRITE, Role::Owner | Role::Operator)
                | (Capability::STRATEGY_APPROVE, Role::Owner | Role::Approver)
        )
}
impl StrategyHost {
    pub fn new(
        drafts: DraftService,
        inputs: Vec<StrategyInput>,
    ) -> std::result::Result<Self, &'static str> {
        let clock = Arc::new(HostClock(AtomicI64::new(Utc::now().timestamp_micros())));
        let core = StrategyService::new(drafts, inputs.clone(), clock.clone())?;
        Ok(Self {
            core,
            clock,
            inputs: inputs.into_iter().map(|i| (i.input_id, i)).collect(),
            drafts: BTreeMap::new(),
            runs: BTreeMap::new(),
            releases: BTreeMap::new(),
            approvals: BTreeMap::new(),
            replays: BTreeMap::new(),
            cursors: BTreeMap::new(),
            proofs: BTreeSet::new(),
            journals: BTreeMap::new(),
            quota: Default::default(),
            poisoned: false,
        })
    }
    fn execute(&self, a: &AuthContext, m: &str, p: &str, b: Value) -> Result<Value> {
        let r = self.core.execute(
            a,
            m,
            p,
            if b.is_null() {
                vec![]
            } else {
                serde_json::to_vec(&b).unwrap()
            }
            .as_slice(),
            Page::default(),
            Uuid::now_v7(),
        );
        if r.status >= 400 {
            let code = match r.body["code"].as_str() {
                Some("VERSION_CONFLICT") => "VERSION_CONFLICT",
                Some("SELF_APPROVAL_FORBIDDEN") => "SELF_APPROVAL_FORBIDDEN",
                Some("STATIC_CHECK_FAILED") => "STATIC_CHECK_FAILED",
                Some("RELEASE_EXPIRED") => "RELEASE_EXPIRED",
                Some("RELEASE_UNAPPROVED") => "RELEASE_UNAPPROVED",
                Some("TARGET_NOT_ALLOWED") => "TARGET_NOT_ALLOWED",
                Some("BACKTEST_REJECTED") => "BACKTEST_REJECTED",
                Some("FORBIDDEN") => "FORBIDDEN",
                _ => "STRATEGY_REJECTED",
            };
            return Err(fault(r.status, code));
        }
        Ok(r.body)
    }
    /// Owner registration only, never an HTTP create endpoint or browser-owned catalog.
    pub fn register_strategy(
        &mut self,
        a: &AuthContext,
        name: &str,
        input: Uuid,
        now: DateTime<Utc>,
    ) -> std::result::Result<Uuid, &'static str> {
        self.register_owned_strategy(a, name, input, now)
            .map_err(|e| e.1)
    }
    fn register_owned_strategy(
        &mut self,
        a: &AuthContext,
        name: &str,
        input: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Uuid> {
        self.clock.0.store(now.timestamp_micros(), Ordering::SeqCst);
        let material = self.inputs.get(&input).ok_or_else(Fault::hidden)?;
        if scope(a)
            != (
                material.tenant_id.to_string(),
                material.workspace_id.to_string(),
            )
        {
            return Err(Fault::hidden());
        }
        let params = material.payload["strategy"].clone();
        let files = json!({"strategy.rule":material.payload["strategy"]["rule_source"]});
        let d = self.execute(a, "POST", "/drafts", json!({"name":name}))?;
        let id = crate::research::uuid(text(&d, "draft_id")?)?;
        let v = self.execute(
            a,
            "PUT",
            &format!("/drafts/{id}"),
            json!({"base_version":0,"parameters":params,"input_id":input}),
        )?;
        self.drafts.insert(id,Draft{scope:scope(a),input,page:json!({"strategyId":id,"name":name,"objectVersion":v["version"].to_string(),"files":files,"parameters":params,"dataSnapshotId":material_snapshot(&self.inputs[&input]),"artifactRefs":self.inputs[&input].artifact_refs,"updatedAt":now})});
        Ok(id)
    }
    fn draft(&self, a: &AuthContext, id: Uuid) -> Result<&Draft> {
        self.drafts
            .get(&id)
            .filter(|d| d.scope == scope(a))
            .ok_or_else(Fault::hidden)
    }
    fn run(&self, a: &AuthContext, id: Uuid) -> Result<Value> {
        let r = self.runs.get(&id).ok_or_else(Fault::hidden)?;
        self.draft(a, uid(r, "strategyId")?)?;
        Ok(r.clone())
    }
    fn release(&self, a: &AuthContext, id: Uuid) -> Result<Value> {
        let r = self.releases.get(&id).ok_or_else(Fault::hidden)?;
        self.draft(a, uid(r, "strategyId")?)?;
        let raw = self.execute(a, "GET", &format!("/releases/{id}"), Value::Null)?;
        let mut r = r.clone();
        r["approvalState"] = raw["approval_state"].clone();
        if !r["submitted"].as_bool().unwrap_or(false) && r["approvalState"] == "pending" {
            r["approvalState"] = json!("none")
        }
        Ok(r)
    }
    /// Resolve only server-created reports in this exact lease and workspace.
    pub(crate) fn artifact(
        &self,
        a: &AuthContext,
        id: Uuid,
        attachment: bool,
    ) -> Result<Option<Value>> {
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        let Some(r) = self
            .runs
            .values()
            .find(|r| r["reportArtifactId"] == id.to_string())
        else {
            return Ok(None);
        };
        self.draft(a, uid(r, "strategyId")?)?;
        if !(can(a, Capability::STRATEGY_WRITE) || can(a, Capability::STRATEGY_APPROVE)) {
            return Err(fault(403, "FORBIDDEN"));
        }
        let mut content = report_artifact(r);
        let hash = digest(&content);
        if attachment {
            Ok(Some(
                json!({"artifactId":id,"mediaType":"application/json","contentHash":hash,"content":content}),
            ))
        } else {
            content["contentHash"] = json!(hash);
            Ok(Some(content))
        }
    }
    pub(crate) fn owns_approval(&self, id: Uuid) -> bool {
        self.approvals.contains_key(&id)
    }
    fn check_version(&self, a: &AuthContext, id: Uuid, v: &str) -> Result<()> {
        if self.draft(a, id)?.page["objectVersion"] != v {
            return Err(fault(409, "VERSION_CONFLICT"));
        }
        Ok(())
    }
    pub(crate) fn current(&self, a: &AuthContext, path: &str) -> Option<Value> {
        path.split('/')
            .nth(3)
            .and_then(|s| Uuid::parse_str(s).ok())
            .and_then(|id| self.draft(a, id).ok())
            .map(|d| d.page.clone())
            .or_else(|| {
                path.split('/')
                    .nth(3)
                    .and_then(|s| Uuid::parse_str(s).ok())
                    .and_then(|id| self.release(a, id).ok())
            })
            .or_else(|| {
                path.split('/')
                    .nth(3)
                    .and_then(|s| Uuid::parse_str(s).ok())
                    .and_then(|id| {
                        self.approvals(a, self.clock.now())
                            .into_iter()
                            .find(|v| v["approvalId"] == id.to_string())
                    })
            })
    }
    fn static_check(&self, a: &AuthContext, id: Uuid) -> Result<Value> {
        let d = self.draft(a, id)?;
        let input = &self.inputs[&d.input];
        if d.page["files"] != json!({"strategy.rule":input.payload["strategy"]["rule_source"]}) {
            return Err(fault(422, "STATIC_CHECK_FAILED"));
        }
        self.execute(
            a,
            "POST",
            &format!("/drafts/{id}/static-check"),
            json!({"input_id":d.input}),
        )
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
        query.remove("cursor");
        let binding = digest(&json!([scope(a), a.actor_id, session, path, query]));
        self.cursors.retain(|_, c| c.expires > now);
        let (rows, offset) = if let Some(v) = q.get("cursor") {
            let c = self
                .cursors
                .get(&crate::research::uuid(v)?)
                .filter(|c| c.binding == binding)
                .ok_or_else(Fault::invalid)?;
            (c.rows.clone(), c.offset)
        } else {
            if let Some(filter) = q.get("filter") {
                let v = filter.splitn(3, ':').collect::<Vec<_>>();
                if v.len() != 3
                    || v[1] != "eq"
                    || !matches!(
                        v[0],
                        "strategyId"
                            | "name"
                            | "releaseId"
                            | "backtestReportArtifactId"
                            | "snapshotId"
                    )
                {
                    return Err(Fault::invalid());
                }
                rows.retain(|r| r[v[0]].as_str() == Some(v[2]));
            }
            if let Some(s) = q.get("status") {
                rows.retain(|r| r["status"] == *s)
            }
            let sort = q
                .get("sort")
                .map(String::as_str)
                .unwrap_or("strategyId:asc");
            let v = sort.split(':').collect::<Vec<_>>();
            if v.len() != 2
                || !matches!(
                    v[0],
                    "strategyId"
                        | "name"
                        | "updatedAt"
                        | "releaseId"
                        | "createdAt"
                        | "backtestReportArtifactId"
                        | "snapshotId"
                )
                || !matches!(v[1], "asc" | "desc")
            {
                return Err(Fault::invalid());
            }
            rows.sort_by_key(|r| format!("{}:{}", r[v[0]], r));
            if v[1] == "desc" {
                rows.reverse()
            }
            (rows, 0)
        };
        let end = (offset + size).min(rows.len());
        let mut result = json!({"items":rows[offset..end]});
        if end < rows.len() {
            if self.cursors.len() >= 128 {
                return Err(fault(429, "RATE_LIMITED"));
            }
            let id = Uuid::new_v4();
            self.cursors.insert(
                id,
                Cursor {
                    binding,
                    rows,
                    offset: end,
                    expires: now + Duration::minutes(5),
                },
            );
            result["nextCursor"] = json!(id)
        }
        Ok(result)
    }
    pub(crate) fn approvals(&self, a: &AuthContext, now: DateTime<Utc>) -> Vec<Value> {
        self.approvals
            .iter()
            .filter_map(|(id, v)| {
                let release = self.release(a, uid(v, "objectRef").ok()?).ok()?;
                let mut v = v.clone();
                v["status"] = release["approvalState"].clone();
                v["objectVersion"] = json!(if v["status"] == "pending" { "0" } else { "1" });
                v["expiresAt"] = release["expiresAt"].clone();
                v["timeline"] = release["approvalTimeline"].clone();
                v["expired"] = json!(
                    v["expiresAt"]
                        .as_str()
                        .is_some_and(|s| DateTime::parse_from_rfc3339(s).is_ok_and(|e| now >= e))
                );
                v["approvalId"] = json!(id);
                Some(v)
            })
            .collect()
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
        proof: Option<String>,
        now: DateTime<Utc>,
    ) -> Result<(StatusCode, Value)> {
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        if !matches!(a.mode, RunMode::Paper | RunMode::Shadow)
            || !(can(a, Capability::STRATEGY_WRITE) || can(a, Capability::STRATEGY_APPROVE))
        {
            return Err(fault(403, "FORBIDDEN"));
        }
        self.clock.0.store(now.timestamp_micros(), Ordering::SeqCst);
        let write = *m != Method::GET;
        let decision = path.starts_with("/v1/approvals/") && path.ends_with("/decisions");
        if write
            && !(if decision {
                can(a, Capability::STRATEGY_APPROVE)
            } else {
                can(a, Capability::STRATEGY_WRITE)
            })
        {
            return Err(fault(403, "FORBIDDEN"));
        }
        let key = h
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let replay_key = format!("{}:{}:{}:{key}", a.tenant_id, a.workspace_id, a.actor_id);
        let intent = digest(&json!([
            session,
            m.as_str(),
            path,
            b,
            h.get("if-match").and_then(|v| v.to_str().ok())
        ]));
        if write {
            Uuid::parse_str(key).map_err(|_| Fault::invalid())?;
            if let Some(r) = self.replays.get(&replay_key) {
                if r.intent != intent {
                    return Err(fault(409, "IDEMPOTENCY_CONFLICT"));
                }
                return Ok((r.status, r.page.clone()));
            }
            if self.replays.len() >= 2000 {
                return Err(fault(429, "CAPACITY_EXCEEDED"));
            }
        }
        self.quota.take(
            &format!("{}:{}:{}", a.tenant_id, a.workspace_id, a.actor_id),
            path,
            now,
        )?;
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        let id = parts.get(2).map(|v| crate::research::uuid(v)).transpose()?;
        let correlation = Uuid::now_v7();
        let mut status = StatusCode::OK;
        let mut out = match (m.as_str(), parts.as_slice()) {
            ("GET", ["v1", "strategies"]) => {
                let rows=self.drafts.values().filter(|d|d.scope==scope(a)).map(|d|json!({"strategyId":d.page["strategyId"],"name":d.page["name"],"updatedAt":d.page["updatedAt"]})).collect();
                self.page(a, session, path, q, rows, now)?
            }
            ("GET", ["v1", "strategies", _, "draft"]) => self.draft(a, id.unwrap())?.page.clone(),
            ("PUT", ["v1", "strategies", _, "draft"]) => {
                let id = id.unwrap();
                let d = self.draft(a, id)?.clone();
                self.check_version(
                    a,
                    id,
                    h.get("if-match")
                        .and_then(|v| v.to_str().ok())
                        .ok_or_else(Fault::invalid)?,
                )?;
                if !b["files"].is_object()
                    || !b["parameters"].is_object()
                    || serde_json::to_vec(b).unwrap().len() > 32768
                {
                    return Err(Fault::invalid());
                }
                let v=self.execute(a,"PUT",&format!("/drafts/{id}"),json!({"base_version":text(&d.page,"objectVersion")?.parse::<u64>().map_err(|_|Fault::invalid())?,"parameters":b["parameters"],"input_id":d.input}))?;
                let page = &mut self.drafts.get_mut(&id).unwrap().page;
                page["files"] = b["files"].clone();
                page["parameters"] = b["parameters"].clone();
                page["objectVersion"] = json!(v["version"].as_u64().unwrap().to_string());
                page["updatedAt"] = json!(now);
                page.clone()
            }
            ("POST", ["v1", "strategies", _, "static-checks"]) => {
                let v = self.static_check(a, id.unwrap())?;
                status = StatusCode::ACCEPTED;
                json!({"jobId":correlation,"status":"accepted","result":v})
            }
            ("POST", ["v1", "backtests"]) => {
                let sid = uid(b, "strategyId")?;
                self.check_version(a, sid, text(b, "objectVersion")?)?;
                let d = self.draft(a, sid)?.clone();
                if d.page["dataSnapshotId"] != b["dataSnapshotId"] {
                    return Err(fault(422, "SNAPSHOT_NOT_BOUND"));
                }
                self.static_check(a, sid)?;
                let v = self.execute(
                    a,
                    "POST",
                    "/backtests",
                    json!({"draft_id":sid,"input_id":d.input}),
                )?;
                let run = crate::research::uuid(text(&v, "backtest_id")?)?;
                let mut metrics = serde_json::Map::new();
                for (k, v) in v["report"]["metrics"].as_object().unwrap() {
                    if v.as_f64().is_none_or(|x| !x.is_finite()) {
                        return Err(Fault::unavailable());
                    }
                    metrics.insert(k.clone(), json!(v.to_string()));
                }
                let artifact = Uuid::now_v7();
                let r = json!({"runId":run,"strategyId":sid,"objectVersion":b["objectVersion"],"dataSnapshotId":b["dataSnapshotId"],"status":"succeeded","metrics":metrics,"leakViolations":[],"reportArtifactId":artifact,"reportHash":v["report"]["report_hash"],"report":v["report"],"parameters":d.page["parameters"],"createdAt":now});
                self.runs.insert(run, r.clone());
                let stream = Uuid::new_v4();
                self.journals.insert(run,vec![json!({"streamId":stream,"sequence":1,"eventId":Uuid::now_v7(),"payloadVersion":"v1","occurredAt":now,"correlationId":correlation,"payload":r})]);
                status = StatusCode::ACCEPTED;
                json!({"jobId":run,"status":"accepted"})
            }
            ("GET", ["v1", "backtests", _]) => self.run(a, id.unwrap())?,
            ("GET", ["v1", "backtests", _, "stream"]) => {
                let id = id.unwrap();
                self.run(a, id)?;
                let after = q
                    .get("afterSequence")
                    .map(|s| s.parse::<u64>())
                    .transpose()
                    .map_err(|_| Fault::invalid())?
                    .unwrap_or(0);
                if after > 1 {
                    return Err(fault(409, "STREAM_GAP"));
                }
                json!({"events":self.journals[&id].iter().filter(|e|e["sequence"].as_u64().unwrap()>after).collect::<Vec<_>>()})
            }
            ("GET", ["v1", "releases"]) => {
                let rows = self
                    .releases
                    .keys()
                    .filter_map(|id| self.release(a, *id).ok())
                    .collect();
                self.page(a, session, path, q, rows, now)?
            }
            ("POST", ["v1", "releases"]) => {
                let sid = uid(b, "strategyId")?;
                self.check_version(a, sid, text(b, "objectVersion")?)?;
                let run = uid(b, "backtestRunId")?;
                let r = self.run(a, run)?;
                if r["strategyId"] != b["strategyId"]
                    || r["objectVersion"] != b["objectVersion"]
                    || r["parameters"] != b["parameters"]
                {
                    return Err(fault(409, "BACKTEST_BINDING_CONFLICT"));
                }
                let raw = self.execute(
                    a,
                    "POST",
                    "/releases",
                    json!({"backtest_id":run,"allowed_targets":["paper","shadow"]}),
                )?;
                let release = &raw["release"];
                let id = crate::research::uuid(text(release, "release_id")?)?;
                let page = json!({"releaseId":id,"strategyId":sid,"objectVersion":release["content_hash"],"contentHash":release["content_hash"],"backtestReportArtifactId":r["reportArtifactId"],"sourceDigest":release["source_digest"],"imageDigest":release["image_digest"],"parameterHash":release["parameter_hash"],"parameters":b["parameters"],"snapshotId":release["data_snapshot_id"],"allowedTargets":release["allowed_targets"],"approvalState":"none","createdAt":release["created_at"],"expiresAt":self.inputs[&self.drafts[&sid].input].request.snapshot.expires_at,"approvalTimeline":[],"submitted":false});
                self.releases.entry(id).or_insert(page);
                status = StatusCode::CREATED;
                self.release(a, id)?
            }
            ("GET", ["v1", "releases", _]) => self.release(a, id.unwrap())?,
            ("POST", ["v1", "releases", _, "approval-submissions"]) => {
                let id = id.unwrap();
                let r = self.release(a, id)?;
                if h.get("if-match").and_then(|v| v.to_str().ok()) != r["objectVersion"].as_str() {
                    return Err(fault(409, "VERSION_CONFLICT"));
                }
                if !matches!(r["approvalState"].as_str(), Some("none" | "pending")) {
                    return Err(fault(409, "APPROVAL_CLOSED"));
                }
                let approval = self
                    .approvals
                    .iter()
                    .find(|(_, v)| v["objectRef"] == id.to_string())
                    .map(|(id, _)| *id)
                    .unwrap_or_else(Uuid::new_v4);
                let timeline = json!({"action":"submitted","actorId":a.actor_id,"occurredAt":now,"correlationId":correlation});
                if !self.approvals.contains_key(&approval) {
                    self.releases.get_mut(&id).unwrap()["approvalTimeline"]
                        .as_array_mut()
                        .unwrap()
                        .push(timeline);
                }
                self.releases.get_mut(&id).unwrap()["submitted"] = json!(true);
                self.approvals.insert(approval,json!({"approvalId":approval,"objectRef":id,"kind":"strategy_release","status":"pending","objectVersion":"0","requestedAt":now,"requester":a.actor_id,"originator":a.actor_id,"correlationId":correlation,"timeline":[]}));
                status = StatusCode::ACCEPTED;
                json!({"jobId":approval,"status":"accepted"})
            }
            ("GET", ["v1", "approvals", _]) => self
                .approvals(a, now)
                .into_iter()
                .find(|v| v["approvalId"] == id.unwrap().to_string())
                .ok_or_else(Fault::hidden)?,
            ("POST", ["v1", "approvals", _, "decisions"]) => {
                let approval = id.unwrap();
                let entry = self
                    .approvals(a, now)
                    .into_iter()
                    .find(|v| v["approvalId"] == approval.to_string())
                    .ok_or_else(Fault::hidden)?;
                if h.get("if-match").and_then(|v| v.to_str().ok()) != Some("0")
                    || entry["status"] != "pending"
                {
                    return Err(fault(409, "VERSION_CONFLICT"));
                }
                if entry["requester"] == a.actor_id.to_string() {
                    return Err(fault(403, "SELF_APPROVAL_FORBIDDEN"));
                }
                let proof = proof.ok_or_else(|| fault(403, "RECENT_AUTH_REQUIRED"))?;
                if self.proofs.contains(&proof) {
                    return Err(fault(403, "PROOF_ALREADY_CONSUMED"));
                }
                let release = uid(&entry, "objectRef")?;
                let r = self.release(a, release)?;
                let decision = text(b, "decision")?;
                if !matches!(decision, "approve" | "reject") {
                    return Err(Fault::invalid());
                }
                let mut req = json!({"content_hash":r["contentHash"],"decision":decision});
                if decision == "approve" {
                    req["ttl_seconds"] = json!(300)
                }
                self.execute(a, "POST", &format!("/releases/{release}/approval"), req)?;
                self.proofs.insert(proof);
                if decision == "approve" {
                    let expiry = (now + Duration::seconds(300)).min(
                        self.inputs[&self.drafts[&uid(&r, "strategyId")?].input]
                            .request
                            .snapshot
                            .expires_at,
                    );
                    self.releases.get_mut(&release).unwrap()["expiresAt"] = json!(expiry);
                }
                self.releases.get_mut(&release).unwrap()["approvalTimeline"].as_array_mut().unwrap().push(json!({"action":decision,"actorId":a.actor_id,"occurredAt":now,"correlationId":correlation}));
                self.approvals(a, now)
                    .into_iter()
                    .find(|v| v["approvalId"] == approval.to_string())
                    .unwrap()
            }
            ("POST", ["v1", "releases", _, "rollback-requests"]) => {
                let source = self.release(a, id.unwrap())?;
                let target = uid(b, "targetReleaseId")?;
                let r = self.release(a, target)?;
                if source["strategyId"] != r["strategyId"] || source["releaseId"] == r["releaseId"]
                {
                    return Err(fault(422, "INVALID_ROLLBACK_TARGET"));
                }
                if r["approvalState"] != "approved" || source["approvalState"] != "approved" {
                    return Err(fault(409, "RELEASE_UNAPPROVED"));
                }
                if DateTime::parse_from_rfc3339(text(&r, "createdAt")?)
                    .map_err(|_| Fault::invalid())?
                    >= DateTime::parse_from_rfc3339(text(&source, "createdAt")?)
                        .map_err(|_| Fault::invalid())?
                {
                    return Err(fault(422, "INVALID_ROLLBACK_TARGET"));
                }
                status = StatusCode::ACCEPTED;
                json!({"jobId":correlation,"status":"accepted","targetReleaseId":target,"effect":"request_only_no_deployment"})
            }
            _ => return Err(Fault::hidden()),
        };
        if write {
            out["correlationId"] = json!(correlation);
            out["auditRef"] = json!(Uuid::now_v7());
            self.replays.insert(
                replay_key,
                Replay {
                    intent,
                    status,
                    page: out.clone(),
                },
            );
        }
        Ok((status, out))
    }
}
fn material_snapshot(i: &StrategyInput) -> Value {
    json!(i.request.snapshot.snapshot_id)
}
pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
    write: axum::routing::MethodRouter<S>,
    save: axum::routing::MethodRouter<S>,
) -> Router<S> {
    Router::new()
        .route("/v1/strategies", read.clone())
        .route("/v1/strategies/:strategyId/draft", read.clone().merge(save))
        .route("/v1/strategies/:strategyId/static-checks", write.clone())
        .route("/v1/backtests", write.clone())
        .route("/v1/backtests/:runId", read.clone())
        .route("/v1/backtests/:runId/stream", read.clone())
        .route("/v1/releases", read.clone().merge(write.clone()))
        .route("/v1/releases/:releaseId", read)
        .route(
            "/v1/releases/:releaseId/approval-submissions",
            write.clone(),
        )
        .route("/v1/releases/:releaseId/rollback-requests", write)
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(get(reference), post(reference), put(reference))
}
pub(crate) fn reference_auth(session: &str) -> AuthContext {
    use quantos_core::{AccountId, TenantId, WorkspaceId};
    let role = match session {
        crate::CURRENT_SESSION => Role::Operator,
        "session-owner" => Role::Owner,
        "session-approver" => Role::Approver,
        _ => Role::Viewer,
    };
    let names = match role {
        Role::Operator => vec![Capability::STRATEGY_WRITE],
        Role::Owner => vec![Capability::STRATEGY_WRITE, Capability::STRATEGY_APPROVE],
        Role::Approver => vec![Capability::STRATEGY_APPROVE],
        _ => vec![],
    };
    AuthContext {
        tenant_id: TenantId::from_uuid(
            Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap(),
        ),
        actor_id: crate::execution::reference_actor(session),
        user_id: Uuid::nil(),
        workspace_id: WorkspaceId::from_uuid(
            Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap(),
        ),
        workspace_slug: "reference".into(),
        workspace_name: "Owned synthetic reference".into(),
        role,
        mode: RunMode::Paper,
        account_id: Some(AccountId::from_uuid(
            Uuid::parse_str("44444444-4444-4444-8444-444444444444").unwrap(),
        )),
        capabilities: names
            .into_iter()
            .map(|s| Capability::parse(s).unwrap())
            .collect(),
    }
}
pub(crate) fn seed(data: &mut crate::ProviderData) {
    if data.strategy.is_some() {
        return;
    }
    let payload = crate::execution::reference_release::payload();
    let (auth, drafts, request, refs) = crate::execution::reference_release::material(&payload);
    let snapshot = &request.snapshot;
    let now = data.now();
    data.research.snapshots.insert(*snapshot.snapshot_id.as_uuid(),json!({"snapshotId":snapshot.snapshot_id,"schemaVersion":"v1","window":{"start":snapshot.window.start_at,"end":snapshot.window.end_at},"sources":["owned-synthetic-strategy"],"quality":"verified","qualityBlocked":false,"contentHash":snapshot.content_hash,"licenseLabel":"fixture-only","capturedAt":snapshot.captured_at,"maxAgeSeconds":86400}));
    for r in &refs {
        data.research.artifacts.insert(*r.artifact_id.as_uuid(),json!({"artifactId":r.artifact_id,"hypothesis":"Owned synthetic momentum strategy; no R03 inference claim","summary":"Owned synthetic strategy payload, real core validation required","engineVersion":"owned-fixture-v1","promptVersion":"none","codeVersion":request.candidate.source_commit,"environmentHash":request.candidate.runtime_digest,"dataSnapshotId":snapshot.snapshot_id,"createdAt":now,"payloadHash":r.content_hash}));
    }
    let input = StrategyInput {
        tenant_id: auth.tenant_id,
        workspace_id: auth.workspace_id,
        input_id: Uuid::new_v4(),
        request,
        payload,
        artifact_refs: refs,
    };
    let id = input.input_id;
    let mut host = StrategyHost::new(drafts, vec![input]).unwrap();
    host.register_strategy(&auth, "Owned momentum", id, now)
        .unwrap();
    host.register_strategy(&auth, "Owned momentum alternative", id, now)
        .unwrap();
    data.strategy = Some(host);
}
fn report_artifact(r: &Value) -> Value {
    json!({"artifactId":r["reportArtifactId"],"hypothesis":"Strategy hypothesis evaluated by real S02 adapter","summary":"Owner-supplied inputs evaluated by bounded S02; lease-scoped report, no target acceptance claim","engineVersion":"quantos-strategy.backtest.v2","promptVersion":"none","codeVersion":r["report"]["candidate"]["source_commit"],"environmentHash":r["report"]["environment_hash"],"dataSnapshotId":r["dataSnapshotId"],"createdAt":r["createdAt"],"payloadHash":r["reportHash"],"backtestReport":r["report"]})
}
pub(crate) fn publish_reports(data: &mut crate::ProviderData) {
    if let Some(host) = &data.strategy {
        for r in host.runs.values() {
            let id = uid(r, "reportArtifactId").unwrap();
            data.research
                .artifacts
                .entry(id)
                .or_insert_with(|| report_artifact(r));
        }
    }
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
            Ok(v) => v,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let mut state = data.lock().await;
    let now = state.now();
    seed(&mut state);
    let result = state.strategy.as_mut().unwrap().handle(
        &a,
        &session,
        &m,
        uri.path(),
        &q,
        &h,
        &b,
        None,
        now,
    );
    match result {
        Ok((s, v)) => {
            if m != Method::GET && !state.audits.iter().any(|a| a["auditRef"] == v["auditRef"]) {
                let c = v["correlationId"].as_str().unwrap();
                crate::record_audit_action(
                    &mut state,
                    uri.path(),
                    c,
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":"accepted"}),
                );
                if let Some(e) = state.audits.last_mut() {
                    e["auditRef"] = v["auditRef"].clone();
                    e["eventId"] = v["auditRef"].clone();
                    e["actor"] = json!(a.actor_id);
                }
            }
            publish_reports(&mut state);
            crate::execution::output(s, v)
        }
        Err(e) => {
            let c = Uuid::now_v7().to_string();
            if m != Method::GET {
                crate::record_audit_action(
                    &mut state,
                    "strategy.denied",
                    &c,
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":e.1}),
                );
            }
            let mut v = json!({"code":e.1,"message":"Strategy request refused.","correlationId":c});
            if e.1 == "VERSION_CONFLICT"
                && let Some(d) = state.strategy.as_ref().and_then(|s| {
                    s.current(
                        &a,
                        &b["strategyId"]
                            .as_str()
                            .map(|id| format!("/v1/strategies/{id}/draft"))
                            .unwrap_or_else(|| uri.path().into()),
                    )
                })
            {
                v["currentVersion"] = d["objectVersion"].clone();
                if d.get("files").is_some() {
                    v["conflictDiff"] = json!({"files":d["files"],"parameters":d["parameters"]});
                }
            }
            crate::response(e.0, v, &c)
        }
    }
}
#[cfg(test)]
mod tests;
