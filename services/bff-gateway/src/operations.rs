//! C11/C16 page service over real X06 observations, typed safe runbooks and
//! a scoped governance lease. No shell, ledger editor, venue or credential IO.
mod governance;
pub(crate) mod reference;
use crate::research::{Fault, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::{delete, get, post, put},
};
use chrono::{DateTime, Duration, Utc};
use governance::{Governance, Spec, id};
use quantos_auth::AuthContext;
use quantos_core::ContentHash;
use quantos_execution::gateway::PaperKernel;
use quantos_operations::{OperationsService, Runbook, VerifiedStepUp};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
fn fault(n: u16, c: &'static str) -> Fault {
    Fault(StatusCode::from_u16(n).unwrap(), c)
}
fn mapped<T>(r: quantos_operations::Result<T>) -> Result<T> {
    r.map_err(|e| {
        use quantos_operations::Error;
        match e {
            Error::Denied => fault(403, "FORBIDDEN"),
            Error::Conflict => fault(409, "STATE_CONFLICT"),
            Error::Stale => fault(409, "STALE_OBSERVATION"),
            Error::Capacity => fault(429, "LEASE_CAPACITY"),
            Error::RecoveryRequired => Fault::unavailable(),
            Error::Invalid => Fault::invalid(),
        }
    })
}
fn parse(s: &str) -> Result<Uuid> {
    Uuid::parse_str(s).map_err(|_| Fault::invalid())
}
#[derive(Clone)]
struct Cursor {
    binding: String,
    rows: Vec<Value>,
    offset: usize,
    expires: DateTime<Utc>,
}
#[derive(Clone)]
struct Replay {
    intent: String,
    body: Value,
    status: StatusCode,
}
struct StreamLease {
    binding: String,
    expires: DateTime<Utc>,
}
/// Trusted numeric F09 observations; raw metric labels and detail JSON never reach pages.
#[derive(Clone, Debug)]
pub struct MetricObservation {
    pub latency_ms: u32,
    pub dlq_depth: u64,
}
pub struct OperationsHost {
    core: OperationsService<PaperKernel>,
    gov: Governance,
    severities: BTreeMap<String, String>,
    health: Option<Value>,
    alerts: BTreeMap<Uuid, Value>,
    incidents: BTreeMap<Uuid, Value>,
    timeline: BTreeMap<Uuid, Vec<Value>>,
    events: Vec<Value>,
    cursors: BTreeMap<Uuid, Cursor>,
    replays: BTreeMap<String, Replay>,
    streams: BTreeMap<Uuid, StreamLease>,
    subscriptions: BTreeMap<String, Value>,
    pub(crate) poisoned: bool,
}
impl std::fmt::Debug for OperationsHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("OperationsHost(owner-X06-F09,scoped-process-lease)")
    }
}
impl OperationsHost {
    pub fn new(
        core: OperationsService<PaperKernel>,
        scope: quantos_operations::Scope,
        identities: Vec<AuthContext>,
    ) -> anyhow::Result<Self> {
        let gov = Governance::new(scope, identities).map_err(|e| anyhow::anyhow!("{}", e.1))?;
        Ok(Self {
            core,
            gov,
            severities: BTreeMap::new(),
            health: None,
            alerts: BTreeMap::new(),
            incidents: BTreeMap::new(),
            timeline: BTreeMap::new(),
            events: vec![],
            cursors: BTreeMap::new(),
            replays: BTreeMap::new(),
            streams: BTreeMap::new(),
            subscriptions: BTreeMap::new(),
            poisoned: false,
        })
    }
    /// Owner imports signed, already reviewed Engine/plugin metadata. No IPC,
    /// process spawn or secrets are accepted through page requests.
    #[allow(clippy::too_many_arguments)]
    pub fn register_engine_review(
        &mut self,
        owner: &AuthContext,
        manifest: quantos_engine_manager::EngineManifest,
        approval: &quantos_engine_manager::EngineApproval,
        key: &[u8],
        expires: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> anyhow::Result<Uuid> {
        self.authorize(owner, "admin.write")
            .map_err(|e| anyhow::anyhow!("{}", e.1))?;
        let reviewer = Uuid::parse_str(&approval.reviewer)?;
        anyhow::ensure!(
            reviewer != owner.user_id
                && self
                    .gov
                    .registry
                    .values()
                    .any(|a| a.user_id == reviewer && a.role == quantos_policy::Role::Approver)
                && expires > now
                && expires - now <= Duration::minutes(5),
            "independent reviewed identity and bounded lifetime required"
        );
        anyhow::ensure!(
            approval
                .routing_policy
                .allowed_tenants
                .contains(&owner.tenant_id.to_string()),
            "explicit tenant review scope required"
        );
        anyhow::ensure!(
            self.gov.reviews.len() < 1000
                && self
                    .gov
                    .reviews
                    .values()
                    .map(|r| r.capabilities.len())
                    .sum::<usize>()
                    + manifest.capabilities.len()
                    <= 1000
                && manifest.capabilities.len() <= 64
                && manifest.capabilities.iter().all(|c| !c.name.is_empty()
                    && c.name.len() <= 160
                    && !c.version.is_empty()
                    && c.version.len() <= 64
                    && c.description.len() <= 512),
            "bounded reviewed metadata required"
        );
        let mut manager = quantos_engine_manager::EngineManager::with_approval_key(
            quantos_engine_manager::BackoffPolicy::default(),
            key.to_vec(),
        );
        manager.register_approved_engine(manifest.clone(), approval)?;
        let id = id(&digest(&json!([
            approval.manifest_sha256,
            approval.artifact_sha256,
            reviewer,
            expires,
            self.gov.scope
        ])));
        self.gov.reviews.insert(
            id,
            governance::EngineReview {
                id,
                reviewer,
                expires,
                capabilities: manifest.capabilities,
            },
        );
        Ok(id)
    }
    pub(crate) fn engine_capability_allowed(&self, name: &str, now: DateTime<Utc>) -> bool {
        !self.poisoned&&self.gov.entries.values().any(|e|!e.deleted&&matches!(&e.spec,Spec::EngineCapability{review_id,name:n,version,enabled:true,..} if n==name&&self.gov.reviews.get(review_id).is_some_and(|r|r.expires>now&&r.capabilities.iter().any(|c|&c.name==n&&&c.version==version))))
    }
    pub(crate) fn authorize_engine_input(&self, body: &[u8], now: DateTime<Utc>) -> Result<()> {
        let input: crate::research::Create =
            serde_json::from_slice(body).map_err(|_| Fault::invalid())?;
        if !self.engine_capability_allowed(&input.capability, now) {
            return Err(fault(403, "CAPABILITY_NOT_APPROVED"));
        }
        Ok(())
    }
    /// F06 owner-side refresh/registration; never accepts client-created identities.
    pub fn register_identity(
        &mut self,
        owner: &AuthContext,
        identity: AuthContext,
    ) -> anyhow::Result<()> {
        self.authorize(owner, "admin.write")
            .map_err(|e| anyhow::anyhow!("{}", e.1))?;
        anyhow::ensure!(
            identity.tenant_id == self.gov.scope.tenant_id
                && identity.workspace_id == self.gov.scope.workspace_id
                && identity.account_id == Some(self.gov.scope.account_id)
                && identity.mode == self.gov.scope.mode
                && !identity.actor_id.as_uuid().is_nil()
                && !identity.user_id.is_nil(),
            "verified identity scope required"
        );
        self.gov
            .registry
            .insert(*identity.actor_id.as_uuid(), identity);
        Ok(())
    }
    pub(crate) fn admit_identity(&self, a: &AuthContext) -> Result<()> {
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        if !self.gov.context_current(a) {
            return Err(fault(401, "IDENTITY_CHANGED"));
        }
        Ok(())
    }
    pub(crate) fn restrict_identity(&self, a: &mut AuthContext) -> Result<()> {
        self.admit_identity(a)?;
        let remove = a
            .capabilities
            .iter()
            .filter(|c| governance::CAPS.contains(&c.as_str()) && !self.gov.allows(a, c.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        for cap in remove {
            a.capabilities.remove(&cap);
        }
        Ok(())
    }
    pub(crate) fn effective_reference_capabilities(
        &self,
        session: &str,
        shadow: bool,
    ) -> Vec<String> {
        let a = governance::reference_auth(session, shadow);
        governance::CAPS
            .iter()
            .filter(|c| self.gov.allows(&a, c))
            .map(|c| (*c).to_owned())
            .collect()
    }
    pub(crate) fn context_current(&self, session: &str, shadow: bool) -> bool {
        !self.poisoned
            && self
                .gov
                .context_current(&governance::reference_auth(session, shadow))
    }
    fn authorize(&self, a: &AuthContext, cap: &str) -> Result<()> {
        if self.poisoned {
            return Err(Fault::unavailable());
        }
        if !self.gov.allows(a, cap) {
            return Err(fault(403, "FORBIDDEN"));
        }
        Ok(())
    }
    /// Exact verified F09 observer feeds the X06 service. No public observation route.
    pub fn observe(
        &mut self,
        observer: &AuthContext,
        report: &quantos_observability::ServiceHealthReport,
        alerts: &[quantos_observability::AlertRecord],
        metrics: MetricObservation,
        now: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        self.observe_checked(observer, report, alerts, metrics, now)
            .map_err(|e| anyhow::anyhow!("{}", e.1))
    }
    fn observe_checked(
        &mut self,
        observer: &AuthContext,
        report: &quantos_observability::ServiceHealthReport,
        alerts: &[quantos_observability::AlertRecord],
        metrics: MetricObservation,
        now: DateTime<Utc>,
    ) -> Result<()> {
        if self.poisoned || self.events.len() + 64 > 10000 {
            return Err(Fault::unavailable());
        }
        let health = mapped(self.core.observe(observer, report, alerts, now))?;
        self.severities = alerts
            .iter()
            .map(|a| {
                (
                    a.rule_id.clone(),
                    match a.severity {
                        quantos_observability::AlertSeverity::Critical => "critical",
                        quantos_observability::AlertSeverity::Warning => "warning",
                    }
                    .to_owned(),
                )
            })
            .collect();
        self.health = Some(
            json!({"service":"service-x06","health":if health.ready{"healthy"}else{"degraded"},"ready":health.ready,"objectVersion":health.revision.to_string(),"sourceHash":health.source_hash,"asOf":health.observed_at,"expiresAt":health.observed_at+Duration::seconds(30),"accountId":self.gov.scope.account_id,"mode":self.gov.scope.mode,"latencyMs":metrics.latency_ms,"dlqDepth":metrics.dlq_depth,"metricsHash":digest(&json!([health.source_hash,metrics.latency_ms,metrics.dlq_depth])),"components":report.components.iter().map(|c|json!({"name":c.name,"ready":c.ready,"asOf":c.checked_at})).collect::<Vec<_>>()}),
        );
        self.sync(observer, now)
    }
    fn sync(&mut self, a: &AuthContext, now: DateTime<Utc>) -> Result<()> {
        let source = self.health.as_ref().ok_or_else(Fault::unavailable)?;
        for row in mapped(self.core.alerts(a))? {
            let aid = id(&row.id.to_string());
            let previous = self.alerts.get(&aid);
            let occurred = previous
                .map(|p| p["occurredAt"].clone())
                .unwrap_or_else(|| source["asOf"].clone());
            let ack_actor = previous
                .and_then(|p| p["ackActor"].as_str())
                .map(str::to_owned);
            let mut p = json!({"id":aid,"alertId":aid,"sourceRef":row.id,"rule":row.rule,"severity":self.severities.get(&row.rule).map(String::as_str).or_else(||previous.and_then(|p|p["severity"].as_str())).unwrap_or("critical"),"domain":"system","accountId":self.gov.scope.account_id,"mode":self.gov.scope.mode,"status":if row.acknowledged{"acked"}else{"unacked"},"active":row.active,"resolved":!row.active,"objectVersion":row.revision.to_string(),"sourceVersion":row.source_revision.to_string(),"occurredAt":occurred,"asOf":source["asOf"],"ackActor":if row.acknowledged{ack_actor}else{None},"ackAt":if row.acknowledged{previous.map(|p|p["ackAt"].clone()).unwrap_or(Value::Null)}else{Value::Null},"objectRef":"/operations/health"});
            let mut original = previous.cloned();
            if let Some(o) = original.as_mut().and_then(Value::as_object_mut) {
                o.remove("auditRef");
                o.remove("correlationId");
            }
            let changed = original.as_ref() != Some(&p);
            let correlation = if changed {
                json!(Uuid::now_v7())
            } else {
                previous.unwrap()["correlationId"].clone()
            };
            p["correlationId"] = correlation.clone();
            if !changed && let Some(audit) = previous.and_then(|p| p.get("auditRef")) {
                p["auditRef"] = audit.clone();
            }
            self.alerts.insert(aid, p.clone());
            if changed {
                self.events.push(json!({"eventId":Uuid::now_v7(),"occurredAt":now,"correlationId":correlation,"payloadVersion":"v1","payload":p}));
            }
        }
        for row in mapped(self.core.incidents(a))? {
            let iid = id(&row.id.to_string());
            let p = json!({"id":iid,"incidentId":iid,"sourceRef":row.id,"alertId":id(&row.alert_id.to_string()),"status":row.status,"objectVersion":row.revision.to_string(),"openedSource":row.opened_source.to_string(),"asOf":source["asOf"],"accountId":self.gov.scope.account_id,"mode":self.gov.scope.mode});
            if self.incidents.get(&iid) != Some(&p) {
                self.incidents.insert(iid, p.clone());
                self.timeline
                    .entry(iid)
                    .or_default()
                    .push(json!({"eventId":Uuid::now_v7(),"occurredAt":now,"payload":p}));
            }
        }
        Ok(())
    }
    fn binding(&self, a: &AuthContext, session: &str) -> String {
        digest(&json!([a, session, self.gov.version]))
    }
    fn subscription(&self, binding: &str) -> Value {
        self.subscriptions.get(binding).cloned().unwrap_or_else(||json!({"objectVersion":"0","severities":["critical","warning","info"],"domains":["risk","order","market","reconciliation","report","system"]}))
    }
    fn subscription_key(a: &AuthContext) -> String {
        digest(&json!([
            a.tenant_id,
            a.workspace_id,
            a.account_id,
            a.actor_id
        ]))
    }
    pub(crate) fn current_version(&self, path: &str, a: &AuthContext) -> Option<String> {
        let p = path.split('/').collect::<Vec<_>>();
        if path.ends_with("/subscriptions") {
            return self.subscription(&Self::subscription_key(a))["objectVersion"]
                .as_str()
                .map(str::to_owned);
        }
        if path.starts_with("/v1/admin/") {
            return p
                .get(4)
                .and_then(|v| Uuid::parse_str(v).ok())
                .and_then(|id| self.gov.entries.get(&id).map(|e| e.version))
                .or(Some(self.gov.version))
                .map(|v| v.to_string());
        }
        if path.contains("/runbook-actions/") {
            return self.health.as_ref()?["objectVersion"]
                .as_str()
                .map(str::to_owned);
        }
        let id = p
            .get(if path.starts_with("/v1/operations/incidents/") {
                4
            } else {
                3
            })
            .and_then(|v| Uuid::parse_str(v).ok())?;
        self.alerts.get(&id).or_else(|| self.incidents.get(&id))?["objectVersion"]
            .as_str()
            .map(str::to_owned)
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
        if q.keys().any(|k| {
            ![
                "accountId",
                "cursor",
                "pageSize",
                "sort",
                "status",
                "domain",
                "severity",
                "active",
                "kind",
            ]
            .contains(&k.as_str())
        }) {
            return Err(Fault::invalid());
        }
        let size = q
            .get("pageSize")
            .map(|s| s.parse::<usize>())
            .transpose()
            .map_err(|_| Fault::invalid())?
            .unwrap_or(50);
        if !(1..=200).contains(&size) {
            return Err(Fault::invalid());
        }
        if q.get("accountId")
            .is_some_and(|s| s != &self.gov.scope.account_id.to_string())
        {
            return Err(Fault::hidden());
        }
        if q.get("sort")
            .is_some_and(|s| !["id:asc", "id:desc"].contains(&s.as_str()))
        {
            return Err(Fault::invalid());
        }
        let mut b = q.clone();
        b.remove("cursor");
        let binding = digest(&json!([self.binding(a, session), path, b]));
        self.cursors.retain(|_, cursor| now < cursor.expires);
        let (offset, expires) = if let Some(c) = q.get("cursor") {
            let c = self
                .cursors
                .get(&parse(c)?)
                .ok_or_else(|| fault(409, "CURSOR_EXPIRED"))?;
            if c.binding != binding || c.expires <= now {
                return Err(fault(409, "CURSOR_SCOPE_CONFLICT"));
            }
            rows = c.rows.clone();
            (c.offset, c.expires)
        } else {
            for key in ["status", "domain", "severity", "active", "kind"] {
                if let Some(v) = q.get(key) {
                    if !rows.iter().any(|r| r.get(key).is_some()) {
                        return Err(Fault::invalid());
                    }
                    rows.retain(|r| {
                        r[key].as_str() == Some(v)
                            || r[key].as_bool().is_some_and(|b| b.to_string() == *v)
                    });
                }
            }
            rows.sort_by_key(|v| v["id"].as_str().unwrap().to_owned());
            if q.get("sort").is_some_and(|s| s == "id:desc") {
                rows.reverse()
            }
            (0, now + Duration::minutes(5))
        };
        let end = (offset + size).min(rows.len());
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
                    expires,
                },
            );
            Some(id)
        } else {
            None
        };
        Ok(
            json!({"items":rows[offset..end],"nextCursor":next,"configVersion":self.gov.version.to_string()}),
        )
    }
    fn precheck(
        &self,
        a: &AuthContext,
        action: &str,
        q: &BTreeMap<String, String>,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        if q.keys().any(|k| k != "commandId") {
            return Err(Fault::invalid());
        }
        let healthy = mapped(self.core.health(a, now))?;
        let allowed = match action {
            "inspect-health" => true,
            "inspect-evidence" => q
                .get("commandId")
                .is_some_and(|s| self.core.evidence_chain(a, s, now).is_ok()),
            _ => return Err(Fault::hidden()),
        };
        Ok(
            json!({"actionId":action,"allowed":allowed,"reason":if allowed{"allowed"}else{"source_evidence_unavailable"},"sourceVersion":healthy.revision.to_string(),"expiresAt":healthy.observed_at+Duration::seconds(30)}),
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
        proof: Option<VerifiedStepUp>,
        now: DateTime<Utc>,
    ) -> Result<(StatusCode, Value)> {
        let admin = path.starts_with("/v1/admin/");
        let cap = if admin {
            "admin.read"
        } else if path.starts_with("/v1/alerts") {
            "alerts.read"
        } else {
            "ops.read"
        };
        self.authorize(a, cap)?;
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        let binding = self.binding(a, session);
        let subkey = Self::subscription_key(a);
        if m == Method::GET
            && !q.is_empty()
            && !path.ends_with("/prechecks")
            && path != "/v1/alerts/stream"
            && !(parts.len() == 3 && path.starts_with("/v1/admin/"))
            && path != "/v1/alerts"
            && path != "/v1/operations/incidents"
        {
            return Err(Fault::invalid());
        }

        if m != Method::GET {
            if !q.is_empty() {
                return Err(Fault::invalid());
            }
            let is_sub = path == "/v1/alerts/subscriptions";
            let required = if admin {
                "admin.write"
            } else if path.ends_with("/resolve") {
                "ops.approve"
            } else if is_sub {
                "alerts.read"
            } else {
                "ops.operate"
            };
            self.authorize(a, required)?;
            let allowed_body = if admin && m != Method::DELETE {
                vec!["reason", "mfaChallengeRef", "reauthTokenRef", "spec"]
            } else if is_sub {
                vec!["severities", "domains"]
            } else if path.ends_with("/runs") {
                vec!["reason", "mfaChallengeRef", "reauthTokenRef", "commandId"]
            } else if path == "/v1/operations/incidents" {
                vec!["reason", "mfaChallengeRef", "reauthTokenRef", "alertId"]
            } else {
                vec!["reason", "mfaChallengeRef", "reauthTokenRef"]
            };
            if b.as_object()
                .is_none_or(|b| b.keys().any(|k| !allowed_body.contains(&k.as_str())))
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
                .and_then(|s| s.to_str().ok())
                .ok_or_else(|| fault(409, "VERSION_CONFLICT"))?;
            let replay = digest(&json!([
                a.tenant_id,
                a.workspace_id,
                a.account_id,
                a.actor_id,
                session,
                path,
                m.as_str(),
                key
            ]));
            let intent = digest(&json!([b, version]));
            // Current authorization is checked again before replay; configuration version
            // is excluded from key so unrelated writes cannot execute an old intent twice.
            if let Some(r) = self.replays.get(&replay) {
                if r.intent != intent {
                    return Err(fault(409, "IDEMPOTENCY_CONFLICT"));
                }
                return Ok((r.status, r.body.clone()));
            }
            if self.replays.len() >= 1000 || self.events.len() + 64 > 10000 {
                return Err(fault(429, "LEASE_CAPACITY"));
            }
            let is_sub = path == "/v1/alerts/subscriptions";
            let required = if admin {
                "admin.write"
            } else if path.ends_with("/resolve") {
                "ops.approve"
            } else if is_sub {
                "alerts.read"
            } else {
                "ops.operate"
            };
            self.authorize(a, required)?;
            if !is_sub {
                let step = proof
                    .as_ref()
                    .ok_or_else(|| fault(403, "RECENT_AUTH_REQUIRED"))?;
                mapped(step.check(a, now))?;
            }
            let reason = b["reason"].as_str().unwrap_or("");
            if !is_sub
                && (reason.trim().is_empty()
                    || reason.chars().count() > 256
                    || reason.chars().any(char::is_control))
            {
                return Err(Fault::invalid());
            }
            let mut v;
            if admin {
                let kind = *parts.get(2).ok_or_else(Fault::invalid)?;
                if ![
                    "members",
                    "roles",
                    "policies",
                    "capabilities",
                    "feature-flags",
                ]
                .contains(&kind)
                    || parts.len() > 4
                {
                    return Err(Fault::hidden());
                }
                let target = parts.get(3).map(|s| parse(s)).transpose()?;
                if m == Method::DELETE && target.is_none()
                    || m == Method::POST && target.is_some()
                    || m == Method::PUT && target.is_none()
                {
                    return Err(Fault::invalid());
                }
                let spec = b
                    .get("spec")
                    .map(|v| {
                        serde_json::from_value::<Spec>(v.clone()).map_err(|_| Fault::invalid())
                    })
                    .transpose()?;
                v = self
                    .gov
                    .mutate(a, kind, target, spec, version, m == Method::DELETE, now)?;
            } else if is_sub {
                let old = self.subscription(&subkey);
                if old["objectVersion"].as_str() != Some(version) {
                    return Err(fault(409, "VERSION_CONFLICT"));
                }
                let sev = b["severities"].as_array().ok_or_else(Fault::invalid)?;
                let dom = b["domains"].as_array().ok_or_else(Fault::invalid)?;
                if sev.is_empty()
                    || dom.is_empty()
                    || sev.len() > 3
                    || dom.len() > 6
                    || sev
                        .iter()
                        .any(|s| !matches!(s.as_str(), Some("critical" | "warning" | "info")))
                    || dom.iter().any(|s| {
                        !matches!(
                            s.as_str(),
                            Some(
                                "risk"
                                    | "order"
                                    | "market"
                                    | "reconciliation"
                                    | "report"
                                    | "system"
                            )
                        )
                    })
                {
                    return Err(Fault::invalid());
                }
                v = json!({"objectVersion":(version.parse::<u64>().map_err(|_|Fault::invalid())?+1).to_string(),"severities":sev,"domains":dom});
                self.subscriptions.insert(subkey.clone(), v.clone());
            } else {
                let step = proof.as_ref().unwrap();
                let operation = match parts.as_slice() {
                    ["v1", "alerts", aid, "ack" | "unack"] => {
                        let aid = parse(aid)?;
                        let row = self.alerts.get(&aid).ok_or_else(Fault::hidden)?;
                        if row["objectVersion"].as_str() != Some(version) {
                            return Err(fault(409, "VERSION_CONFLICT"));
                        }
                        let source: ContentHash = serde_json::from_value(row["sourceRef"].clone())
                            .map_err(|_| Fault::invalid())?;
                        let revision = version.parse().map_err(|_| Fault::invalid())?;
                        if parts[3] == "ack" {
                            mapped(
                                self.core
                                    .acknowledge_alert(a, step, &replay, &source, revision, now),
                            )?
                        } else {
                            mapped(
                                self.core
                                    .unacknowledge_alert(a, step, &replay, &source, revision, now),
                            )?
                        }
                    }
                    ["v1", "operations", "incidents"] => {
                        if version != self.gov.version.to_string() {
                            return Err(fault(409, "VERSION_CONFLICT"));
                        }
                        let aid = parse(b["alertId"].as_str().ok_or_else(Fault::invalid)?)?;
                        let row = self.alerts.get(&aid).ok_or_else(Fault::hidden)?;
                        let source: ContentHash = serde_json::from_value(row["sourceRef"].clone())
                            .map_err(|_| Fault::invalid())?;
                        mapped(self.core.open_incident(a, step, &replay, &source, now))?
                    }
                    ["v1", "operations", "incidents", iid, "ack" | "resolve"] => {
                        let row = self.incidents.get(&parse(iid)?).ok_or_else(Fault::hidden)?;
                        if row["objectVersion"].as_str() != Some(version) {
                            return Err(fault(409, "VERSION_CONFLICT"));
                        }
                        let source: ContentHash = serde_json::from_value(row["sourceRef"].clone())
                            .map_err(|_| Fault::invalid())?;
                        let revision = version.parse().map_err(|_| Fault::invalid())?;
                        if parts[4] == "ack" {
                            mapped(
                                self.core
                                    .acknowledge_incident(a, step, &replay, &source, revision, now),
                            )?
                        } else {
                            mapped(
                                self.core
                                    .resolve_incident(a, step, &replay, &source, revision, now),
                            )?
                        }
                    }
                    ["v1", "operations", "runbook-actions", action, "runs"] => {
                        let command = b.get("commandId").and_then(Value::as_str);
                        let query = command
                            .map(|s| BTreeMap::from([("commandId".into(), s.into())]))
                            .unwrap_or_default();
                        let pre = self.precheck(a, action, &query, now)?;
                        if pre["sourceVersion"].as_str() != Some(version) {
                            return Err(fault(409, "VERSION_CONFLICT"));
                        }
                        if pre["allowed"] != true {
                            return Err(fault(409, "RUNBOOK_PRECHECK_FAILED"));
                        }
                        let runbook = match *action {
                            "inspect-health" => Runbook::InspectHealth {},
                            "inspect-evidence" => Runbook::InspectEvidence {
                                command_id: command.ok_or_else(Fault::invalid)?.into(),
                            },
                            _ => return Err(Fault::invalid()),
                        };
                        mapped(self.core.runbook(a, step, &replay, runbook, now))?
                    }
                    _ => return Err(Fault::hidden()),
                };
                self.sync(a, now)?;
                v = if path.starts_with("/v1/alerts/") {
                    let aid = parse(parts[2])?;
                    let row = self.alerts.get_mut(&aid).unwrap();
                    if parts[3] == "ack" {
                        row["ackActor"] = json!(a.actor_id);
                        row["ackAt"] = json!(now)
                    }
                    let copy = row.clone();
                    if let Some(frame) = self.events.last_mut() {
                        frame["payload"] = copy.clone()
                    }
                    copy
                } else if path.contains("/incidents") {
                    let source = match &operation.outcome {
                        quantos_operations::Outcome::Applied { reference } => reference.clone(),
                        _ => return Err(Fault::unavailable()),
                    };
                    if parts.len() == 3 {
                        self.incidents
                            .values()
                            .find(|i| i["sourceRef"] == source.to_string())
                            .cloned()
                            .ok_or_else(Fault::unavailable)?
                    } else {
                        self.incidents
                            .get(&parse(parts[3])?)
                            .cloned()
                            .ok_or_else(Fault::hidden)?
                    }
                } else {
                    json!({"operationId":id(&operation.id.to_string()),"status":"succeeded","sourceOperationRef":operation.id,"outcome":operation.outcome})
                };
            }
            let audit = Uuid::now_v7();
            let correlation = Uuid::new_v4();
            v["auditRef"] = json!(audit);
            v["correlationId"] = json!(correlation);
            if path.starts_with("/v1/alerts/") && !is_sub {
                if let Some(row) = self.alerts.get_mut(&parse(parts[2])?) {
                    *row = v.clone();
                }
                if let Some(frame) = self.events.last_mut() {
                    frame["correlationId"] = json!(correlation);
                    frame["payload"] = v.clone();
                }
            }
            if path.contains("/incidents")
                && let Some(iid) = v["incidentId"]
                    .as_str()
                    .and_then(|s| Uuid::parse_str(s).ok())
                && let Some(item) = self.timeline.get_mut(&iid).and_then(|v| v.last_mut())
            {
                item["auditRef"] = json!(audit);
                item["correlationId"] = json!(correlation);
            }
            let status = if m == Method::POST && (admin || path == "/v1/operations/incidents") {
                StatusCode::CREATED
            } else {
                StatusCode::OK
            };
            self.replays.insert(
                replay,
                Replay {
                    intent,
                    body: v.clone(),
                    status,
                },
            );
            return Ok((status, v));
        }
        let v = match parts.as_slice() {
            ["v1", "operations", "health" | "metrics"] => {
                mapped(self.core.health(a, now))?;
                self.health.clone().ok_or_else(Fault::unavailable)?
            }
            ["v1", "operations", "runbook-actions"] => {
                json!({"items":[{"actionId":"inspect-health","parameters":[]},{"actionId":"inspect-evidence","parameters":["commandId"]}]})
            }
            ["v1", "operations", "runbook-actions", action, "prechecks"] => {
                self.precheck(a, action, q, now)?
            }
            ["v1", "operations", "incidents"] => self.page(
                a,
                session,
                path,
                q,
                self.incidents.values().cloned().collect(),
                now,
            )?,
            ["v1", "operations", "incidents", iid] => self
                .incidents
                .get(&parse(iid)?)
                .cloned()
                .ok_or_else(Fault::hidden)?,
            ["v1", "operations", "incidents", iid, "timeline"] => {
                if !self.gov.flag("incident-timeline", *a.actor_id.as_uuid()) {
                    return Err(fault(409, "FEATURE_DISABLED"));
                }
                json!({"items":self.timeline.get(&parse(iid)?).ok_or_else(Fault::hidden)?})
            }
            ["v1", "admin", kind] => self.page(
                a,
                session,
                path,
                q,
                self.gov
                    .entries
                    .values()
                    .filter(|e| e.spec.kind() == *kind)
                    .map(|e| e.page(self.gov.version))
                    .collect(),
                now,
            )?,
            ["v1", "admin", kind, eid] => {
                let e = self
                    .gov
                    .entries
                    .get(&parse(eid)?)
                    .filter(|e| e.spec.kind() == *kind)
                    .ok_or_else(Fault::hidden)?;
                e.page(self.gov.version)
            }
            ["v1", "alerts"] => self.page(
                a,
                session,
                path,
                q,
                self.alerts.values().cloned().collect(),
                now,
            )?,
            ["v1", "alerts", "subscriptions"] => self.subscription(&subkey),
            ["v1", "alerts", "stream"] => {
                if !self.gov.flag("alerts-live-view", *a.actor_id.as_uuid()) {
                    return Err(fault(409, "FEATURE_DISABLED"));
                }
                mapped(self.core.health(a, now))?;
                if q.keys()
                    .any(|k| !["afterSequence", "streamId"].contains(&k.as_str()))
                {
                    return Err(Fault::invalid());
                }
                let after = q
                    .get("afterSequence")
                    .map(|v| v.parse::<usize>())
                    .transpose()
                    .map_err(|_| Fault::invalid())?
                    .unwrap_or(0);
                let subscription = self.subscription(&subkey);
                let stream_binding = digest(&json!([binding, subscription]));
                self.streams.retain(|_, lease| now < lease.expires);
                let sid = if let Some(s) = q.get("streamId") {
                    let sid = parse(s)?;
                    let l = self
                        .streams
                        .get(&sid)
                        .ok_or_else(|| fault(409, "STREAM_EXPIRED"))?;
                    if l.binding != stream_binding || now >= l.expires {
                        return Err(fault(409, "STREAM_SCOPE_CONFLICT"));
                    }
                    sid
                } else {
                    if after != 0 {
                        return Err(fault(409, "STREAM_ID_REQUIRED"));
                    }
                    if self.streams.len() >= 1000 {
                        return Err(fault(429, "LEASE_CAPACITY"));
                    }
                    let sid = Uuid::new_v4();
                    self.streams.insert(
                        sid,
                        StreamLease {
                            binding: stream_binding,
                            expires: now + Duration::minutes(5),
                        },
                    );
                    sid
                };
                let filtered = self
                    .events
                    .iter()
                    .filter(|e| {
                        subscription["severities"]
                            .as_array()
                            .unwrap()
                            .contains(&e["payload"]["severity"])
                            && subscription["domains"]
                                .as_array()
                                .unwrap()
                                .contains(&e["payload"]["domain"])
                    })
                    .collect::<Vec<_>>();
                if after > filtered.len() {
                    return Err(fault(409, "STREAM_GAP"));
                }
                let mut frames = vec![];
                for (i, e) in filtered.iter().enumerate().skip(after) {
                    let mut e = (*e).clone();
                    e["streamId"] = json!(sid);
                    e["sequence"] = json!(i + 1);
                    frames.push(e)
                }
                json!({"events":frames,"streamId":sid})
            }
            ["v1", "alerts", aid] => self
                .alerts
                .get(&parse(aid)?)
                .cloned()
                .ok_or_else(Fault::hidden)?,
            _ => return Err(Fault::hidden()),
        };
        let mut v = v;
        if path == "/v1/admin/capabilities" {
            v["availableReviews"]=json!(self.gov.reviews.values().filter(|r|r.expires>now).flat_map(|r|r.capabilities.iter().map(move|c|json!({"kind":"engine_capability","reviewId":r.id,"name":c.name,"version":c.version,"description":c.description,"enabled":false}))).collect::<Vec<_>>());
        }
        Ok((StatusCode::OK, v))
    }
}
pub(crate) fn routes<S: Clone + Send + Sync + 'static>(
    read: axum::routing::MethodRouter<S>,
    write: axum::routing::MethodRouter<S>,
    update: axum::routing::MethodRouter<S>,
    remove: axum::routing::MethodRouter<S>,
) -> Router<S> {
    let mut r = Router::new();
    for path in [
        "/v1/operations/health",
        "/v1/operations/metrics",
        "/v1/operations/incidents/:incidentId",
        "/v1/operations/incidents/:incidentId/timeline",
        "/v1/operations/runbook-actions",
        "/v1/operations/runbook-actions/:actionId/prechecks",
        "/v1/alerts/:alertId",
        "/v1/alerts/stream",
        "/v1/alerts",
    ] {
        r = r.route(path, read.clone())
    }
    r = r
        .route(
            "/v1/operations/incidents",
            read.clone().merge(write.clone()),
        )
        .route(
            "/v1/alerts/subscriptions",
            read.clone().merge(update.clone()),
        );
    for path in [
        "/v1/operations/incidents/:incidentId/ack",
        "/v1/operations/incidents/:incidentId/resolve",
        "/v1/operations/runbook-actions/:actionId/runs",
        "/v1/alerts/:alertId/ack",
        "/v1/alerts/:alertId/unack",
    ] {
        r = r.route(path, write.clone())
    }
    for kind in [
        "members",
        "roles",
        "policies",
        "capabilities",
        "feature-flags",
    ] {
        r = r
            .route(
                &format!("/v1/admin/{kind}"),
                read.clone().merge(write.clone()),
            )
            .route(
                &format!("/v1/admin/{kind}/:resourceId"),
                read.clone().merge(update.clone()).merge(remove.clone()),
            )
    }
    r
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    routes(
        get(reference::handle),
        post(reference::handle),
        put(reference::handle),
        delete(reference::handle),
    )
}
pub(crate) fn output(s: StatusCode, v: Value) -> Response {
    let stream = v.get("streamId").and_then(Value::as_str).map(str::to_owned);
    let mut r = crate::execution::output(s, v);
    if let Some(id) = stream {
        r.headers_mut().insert("x-stream-id", id.parse().unwrap());
    }
    r
}
pub(crate) fn is_governed_capability(cap: &str) -> bool {
    governance::CAPS.contains(&cap)
}
pub(crate) fn reference_capabilities(session: &str) -> Vec<String> {
    let a = governance::reference_auth(session, false);
    a.capabilities
        .into_iter()
        .map(|c| c.as_str().to_owned())
        .filter(|c| governance::CAPS.contains(&c.as_str()))
        .collect()
}

#[cfg(test)]
mod tests;
