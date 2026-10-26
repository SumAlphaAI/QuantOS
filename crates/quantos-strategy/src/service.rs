//! SERVICE:S04 application boundary. All catalogs, clocks and identity come from
//! the trusted host. This process-local service never imports caller reports.
use crate::{
    DraftArtifactRef, DraftSaveKind, DraftVersionInput, StrategyDraft, StrategyDraftVersion,
    backtest::{BacktestRequest, StrategyAdapter},
    drafts::DraftService,
    generated::GeneratedStrategyAdapter,
    release::{
        DeploymentTarget, DeploymentTicket, InMemoryStrategyReleaseStore, StrategyRelease,
        StrategyReleaseError, ValidatedBacktest,
    },
};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ContentHash, ProposalId, StrategyDraftId, TenantId, WorkspaceId, canonical_json_bytes,
};
use quantos_policy::Capability;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}
pub struct SystemClock;
impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}
/// Server-owned, immutable replay material. Never Deserialize this from a request.
#[derive(Clone)]
pub struct StrategyInput {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub input_id: Uuid,
    pub request: BacktestRequest,
    pub payload: Value,
    pub artifact_refs: Vec<DraftArtifactRef>,
}
#[derive(Debug, Clone, Serialize)]
pub struct AuditEvent {
    pub sequence: u64,
    pub tenant_id: Option<TenantId>,
    pub workspace_id: Option<WorkspaceId>,
    pub actor_id: Option<ActorId>,
    pub correlation_id: Uuid,
    pub operation: String,
    pub resource_id: Option<Uuid>,
    pub code: String,
    pub status: u16,
    pub recorded_at: DateTime<Utc>,
    pub resource_hash: Option<ContentHash>,
    pub previous_hash: ContentHash,
    pub content_hash: ContentHash,
}
#[derive(Debug, Clone)]
pub struct Reply {
    pub status: u16,
    pub correlation_id: Uuid,
    pub body: Value,
}
#[derive(Clone, Copy, Debug)]
struct Fault(u16, &'static str);
type Result<T> = std::result::Result<T, Fault>;
#[derive(Clone, Copy, PartialEq, Eq)]
enum Decision {
    Approved,
    Rejected,
}
struct SavedDraft {
    draft: StrategyDraft,
    versions: Vec<StrategyDraftVersion>,
}
struct State {
    drafts: DraftService,
    catalog: BTreeMap<StrategyDraftId, SavedDraft>,
    inputs: BTreeMap<Uuid, StrategyInput>,
    backtests: BTreeMap<Uuid, ValidatedBacktest>,
    releases: InMemoryStrategyReleaseStore,
    decisions: BTreeMap<ProposalId, Decision>,
    deployments: BTreeMap<Uuid, DeploymentTicket>,
    audit: Vec<AuditEvent>,
    heads: BTreeMap<(Option<TenantId>, Option<WorkspaceId>), (u64, ContentHash)>,
}
pub struct StrategyService {
    state: Mutex<State>,
    clock: Arc<dyn Clock>,
}
const MAX_OBJECTS: usize = 1_000;
const MAX_AUDIT: usize = 10_000;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Create {
    name: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Save {
    base_version: u64,
    parameters: Value,
    input_id: Option<Uuid>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Backtest {
    draft_id: StrategyDraftId,
    input_id: Uuid,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InputRef {
    input_id: Uuid,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Publish {
    backtest_id: Uuid,
    allowed_targets: Vec<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Approval {
    content_hash: ContentHash,
    decision: String,
    ttl_seconds: Option<i64>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Deploy {
    target: String,
}
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    pub limit: Option<usize>,
    pub after: Option<Uuid>,
    pub after_sequence: Option<u64>,
}
fn decode<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T> {
    serde_json::from_slice(body).map_err(|_| Fault(422, "INVALID_REQUEST"))
}
fn id(v: &str) -> Result<Uuid> {
    Uuid::parse_str(v).map_err(|_| Fault(422, "INVALID_ID"))
}
fn capability(auth: &AuthContext, name: &str) -> bool {
    auth.capabilities.iter().any(|c| c.as_str() == name)
        && crate::release::ensure_capability(auth, name).is_ok()
}
fn read_allowed(auth: &AuthContext) -> bool {
    capability(auth, Capability::STRATEGY_WRITE) || capability(auth, Capability::STRATEGY_APPROVE)
}
fn scope(auth: &AuthContext, tenant: TenantId, workspace: WorkspaceId) -> Result<()> {
    if auth.tenant_id == tenant && auth.workspace_id == workspace {
        Ok(())
    } else {
        Err(Fault(404, "NOT_FOUND"))
    }
}
fn release_error(error: StrategyReleaseError) -> Fault {
    match error {
        StrategyReleaseError::SelfApprovalForbidden { .. } => Fault(403, "SELF_APPROVAL_FORBIDDEN"),
        StrategyReleaseError::Unauthorized { .. } => Fault(403, "FORBIDDEN"),
        StrategyReleaseError::ReleaseNotFound { .. } => Fault(404, "NOT_FOUND"),
        StrategyReleaseError::ContentConflict { .. } => Fault(409, "CONTENT_CONFLICT"),
        StrategyReleaseError::AlreadyApproved { .. } => Fault(409, "APPROVAL_CONFLICT"),
        StrategyReleaseError::UnsupportedDeploymentTarget { .. } => {
            Fault(422, "TARGET_NOT_ALLOWED")
        }
        StrategyReleaseError::InvalidEvidence => Fault(409, "INVALID_EVIDENCE"),
        StrategyReleaseError::DeploymentRejected { .. } => Fault(409, "DEPLOYMENT_REJECTED"),
        _ => Fault(503, "SERVICE_UNAVAILABLE"),
    }
}
impl StrategyService {
    pub fn new(
        drafts: DraftService,
        inputs: Vec<StrategyInput>,
        clock: Arc<dyn Clock>,
    ) -> std::result::Result<Self, &'static str> {
        let mut catalog = BTreeMap::new();
        if inputs.len() > MAX_OBJECTS {
            return Err("too many trusted inputs");
        }
        for input in inputs {
            if input.request.snapshot.tenant_id != input.tenant_id
                || catalog.insert(input.input_id, input).is_some()
            {
                return Err("invalid trusted input catalog");
            }
        }
        Ok(Self {
            clock,
            state: Mutex::new(State {
                drafts,
                catalog: BTreeMap::new(),
                inputs: catalog,
                backtests: BTreeMap::new(),
                releases: InMemoryStrategyReleaseStore::new(),
                decisions: BTreeMap::new(),
                deployments: BTreeMap::new(),
                audit: Vec::new(),
                heads: BTreeMap::new(),
            }),
        })
    }
    pub fn now(&self) -> DateTime<Utc> {
        self.clock.now()
    }
    /// Only the HTTP identity adapter calls this. It never stores token/header/body text.
    pub fn reject(
        &self,
        auth: Option<&AuthContext>,
        correlation: Uuid,
        code: &'static str,
        status: u16,
    ) -> Reply {
        let Ok(mut state) = self.state.lock() else {
            return reply(correlation, Err(Fault(503, "AUDIT_UNAVAILABLE")));
        };
        if state.audit.len() >= MAX_AUDIT {
            return reply(correlation, Err(Fault(503, "AUDIT_UNAVAILABLE")));
        }
        let fault = Fault(status, code);
        state.record(
            auth,
            correlation,
            "http.reject",
            (None, None),
            Err(fault),
            self.now(),
        );
        reply(correlation, Err(fault))
    }
    /// Trusted host recovery/import seam, never mounted as an HTTP endpoint.
    /// A legacy caller hash remains unverified and cannot become approved here.
    pub fn import_legacy(
        &self,
        auth: &AuthContext,
        input: crate::release::ReleasePublishInput,
    ) -> std::result::Result<StrategyRelease, StrategyReleaseError> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| StrategyReleaseError::InvalidEvidence)?;
        if state.audit.len() >= MAX_AUDIT {
            return Err(StrategyReleaseError::InvalidEvidence);
        }
        let r = state.releases.publish(auth, input)?;
        state.record(
            Some(auth),
            Uuid::now_v7(),
            "release.legacy_import",
            (Some(*r.release_id.as_uuid()), Some(r.content_hash.clone())),
            Ok(()),
            self.now(),
        );
        Ok(r)
    }
    pub fn execute(
        &self,
        auth: &AuthContext,
        method: &str,
        path: &str,
        body: &[u8],
        page: Page,
        correlation: Uuid,
    ) -> Reply {
        let Ok(mut state) = self.state.lock() else {
            return reply(correlation, Err(Fault(503, "SERVICE_UNAVAILABLE")));
        };
        // A queued request must evaluate expiry when it owns the transaction lock.
        let now = self.now();
        // Exhaustion denies before any business mutation. No old audit is evicted.
        if state.audit.len() >= MAX_AUDIT {
            return reply(correlation, Err(Fault(503, "AUDIT_UNAVAILABLE")));
        }
        let parts: Vec<_> = path.trim_matches('/').split('/').collect();
        let resource = parts.get(1).and_then(|v| Uuid::parse_str(v).ok());
        let operation = match (method, parts.as_slice()) {
            ("GET", ["catalog"]) => "catalog.list",
            ("GET", ["lab", "inputs"]) => "lab.inputs",
            ("POST", ["lab", "preview"]) => "lab.preview",
            ("POST", ["drafts"]) => "draft.create",
            ("GET", ["drafts", _]) => "draft.read",
            ("PUT", ["drafts", _]) => "draft.save",
            ("POST", ["drafts", _, "static-check"]) => "draft.static_check",
            ("POST", ["backtests"]) => "backtest.create",
            ("GET", ["backtests", _]) => "backtest.read",
            ("POST", ["releases"]) => "release.publish",
            ("GET", ["releases", _]) => "release.read",
            ("POST", ["releases", _, "approval"]) => "release.approve",
            ("POST", ["releases", _, "deployments"]) => "deployment.create",
            ("POST", ["deployments", _, "consume"]) => "deployment.consume",
            ("GET", ["audit"]) => "audit.read",
            _ => "unknown",
        };
        let result = (|| {
            if operation == "unknown" {
                return Err(Fault(404, "NOT_FOUND"));
            }
            let permitted = if operation == "release.approve" {
                capability(auth, Capability::STRATEGY_APPROVE)
            } else if method == "GET" {
                read_allowed(auth)
            } else {
                capability(auth, Capability::STRATEGY_WRITE)
            };
            if !permitted {
                return Err(Fault(403, "FORBIDDEN"));
            }
            if body.len() > 65_536 {
                return Err(Fault(413, "BODY_TOO_LARGE"));
            }
            let limit = page.limit.unwrap_or(50);
            if limit == 0 || limit > 200 {
                return Err(Fault(422, "INVALID_PAGE"));
            }
            let object_page = matches!(operation, "catalog.list" | "lab.inputs");
            let audit_page = operation == "audit.read";
            if (page.after.is_some() && !object_page)
                || (page.after_sequence.is_some() && !audit_page)
                || (page.limit.is_some() && !object_page && !audit_page)
            {
                return Err(Fault(422, "INVALID_PAGE"));
            }
            if method == "GET" && !body.is_empty() {
                return Err(Fault(422, "INVALID_REQUEST"));
            }
            match (method, parts.as_slice()) {
                ("GET", ["catalog"]) => {
                    let items:Vec<_>=state.catalog.values().filter(|v|v.draft.tenant_id==auth.tenant_id&&v.draft.workspace_id==auth.workspace_id&&page.after.is_none_or(|a|*v.draft.draft_id.as_uuid()>a)).take(limit).map(|v|json!({"draft":v.draft,"can_write":capability(auth,Capability::STRATEGY_WRITE),"can_approve":capability(auth,Capability::STRATEGY_APPROVE),"allowed_targets":if capability(auth,Capability::STRATEGY_WRITE){vec!["paper","shadow"]}else{vec![]}})).collect();
                    Ok(
                        json!({"items":items,"next_after":items.last().map(|i|i["draft"]["draft_id"].clone())}),
                    )
                }
                ("GET", ["lab", "inputs"]) => Ok(
                    json!({"items":state.inputs.values().filter(|i|i.tenant_id==auth.tenant_id&&i.workspace_id==auth.workspace_id&&page.after.is_none_or(|a|i.input_id>a)).take(limit).map(|i|json!({"input_id":i.input_id,"snapshot_id":i.request.snapshot.snapshot_id,"parameters":i.payload["strategy"],"artifact_refs":i.artifact_refs})).collect::<Vec<_>>()}),
                ),
                ("POST", ["lab", "preview"]) => {
                    let input: InputRef = decode(body)?;
                    let material = state.input(auth, input.input_id)?;
                    let adapter = GeneratedStrategyAdapter::from_draft_payload(&material.payload)
                        .map_err(|_| Fault(422, "STATIC_CHECK_FAILED"))?;
                    Ok(
                        json!({"input_id":material.input_id,"parameters":adapter.configuration(),"static_check":"passed","release_eligible":false}),
                    )
                }
                ("POST", ["drafts"]) => {
                    let input: Create = decode(body)?;
                    if input.name.trim().is_empty() || input.name.len() > 128 {
                        return Err(Fault(422, "INVALID_NAME"));
                    }
                    if state.catalog.len() >= MAX_OBJECTS {
                        return Err(Fault(429, "CAPACITY_EXCEEDED"));
                    }
                    let draft = state
                        .drafts
                        .create(auth, &input.name, now)
                        .map_err(|_| Fault(422, "INVALID_DRAFT"))?;
                    state.catalog.insert(
                        draft.draft_id,
                        SavedDraft {
                            draft: draft.clone(),
                            versions: Vec::new(),
                        },
                    );
                    Ok(json!(draft))
                }
                ("GET", ["drafts", key]) => {
                    let draft = state.draft(auth, StrategyDraftId::from_uuid(id(key)?))?;
                    Ok(json!({"draft":draft.draft,"versions":draft.versions}))
                }
                ("PUT", ["drafts", key]) => {
                    let draft_id = StrategyDraftId::from_uuid(id(key)?);
                    state.draft(auth, draft_id)?;
                    let input: Save = decode(body)?;
                    if !input.parameters.is_object()
                        || canonical_json_bytes(&input.parameters)
                            .map_err(|_| Fault(422, "INVALID_REQUEST"))?
                            .len()
                            > 16_384
                    {
                        return Err(Fault(422, "INVALID_PARAMETERS"));
                    }
                    let reference = input
                        .input_id
                        .map(|i| state.input(auth, i).cloned())
                        .transpose()?;
                    let saved = state
                        .drafts
                        .save(
                            auth,
                            DraftVersionInput {
                                draft_id,
                                parameters: input.parameters,
                                base_version: input.base_version,
                                data_snapshot_id: reference
                                    .as_ref()
                                    .map(|i| i.request.snapshot.snapshot_id),
                                artifact_refs: reference
                                    .map(|i| i.artifact_refs)
                                    .unwrap_or_default(),
                                save_kind: DraftSaveKind::Manual,
                                saved_at: now,
                            },
                        )
                        .map_err(|e| match e {
                            crate::StrategyDraftError::VersionConflict { .. } => {
                                Fault(409, "VERSION_CONFLICT")
                            }
                            _ => Fault(422, "INVALID_DRAFT"),
                        })?;
                    let entry = state.catalog.get_mut(&draft_id).expect("scoped draft");
                    entry.draft.head_version = saved.version;
                    entry.draft.updated_at = now;
                    entry.versions.push(saved.clone());
                    Ok(json!(saved))
                }
                ("POST", ["drafts", key, "static-check"]) => {
                    let draft = state.draft(auth, StrategyDraftId::from_uuid(id(key)?))?;
                    let input: InputRef = decode(body)?;
                    let input = state.input(auth, input.input_id)?;
                    let head = draft
                        .versions
                        .last()
                        .ok_or(Fault(409, "DRAFT_INCOMPLETE"))?;
                    let adapter = GeneratedStrategyAdapter::from_draft_payload(&input.payload)
                        .map_err(|_| Fault(422, "STATIC_CHECK_FAILED"))?;
                    if head.parameters != adapter.configuration()
                        || head.data_snapshot_id != Some(input.request.snapshot.snapshot_id)
                        || head.artifact_refs != input.artifact_refs
                    {
                        return Err(Fault(422, "STATIC_CHECK_FAILED"));
                    }
                    state
                        .drafts
                        .validate(auth, draft.draft.draft_id, now)
                        .map_err(|_| Fault(422, "STATIC_CHECK_FAILED"))?;
                    Ok(
                        json!({"passed":true,"version":head.version,"version_hash":head.content_hash}),
                    )
                }
                ("POST", ["backtests"]) => {
                    let input: Backtest = decode(body)?;
                    state.draft(auth, input.draft_id)?;
                    if state.backtests.len() >= MAX_OBJECTS {
                        return Err(Fault(429, "CAPACITY_EXCEEDED"));
                    }
                    let material = state.input(auth, input.input_id)?.clone();
                    let mut request = material.request;
                    request.candidate.clock = now;
                    let proof = state
                        .drafts
                        .validated_backtest(auth, input.draft_id, request, &material.payload)
                        .map_err(|_| Fault(422, "BACKTEST_REJECTED"))?;
                    let run_id = Uuid::now_v7();
                    let report = proof.report().clone();
                    state.backtests.insert(run_id, proof);
                    Ok(json!({"backtest_id":run_id,"report":report}))
                }
                ("GET", ["backtests", key]) => {
                    let proof = state.proof(auth, id(key)?)?;
                    Ok(json!(proof.report()))
                }
                ("POST", ["releases"]) => {
                    let input: Publish = decode(body)?;
                    let proof = state.proof(auth, input.backtest_id)?.clone();
                    let targets = input
                        .allowed_targets
                        .iter()
                        .map(|v| DeploymentTarget::parse(v).map_err(release_error))
                        .collect::<Result<Vec<_>>>()?;
                    let release = state
                        .releases
                        .publish_verified(auth, proof, targets, now)
                        .map_err(release_error)?;
                    Ok(state.view(auth, &release, now))
                }
                ("GET", ["releases", key]) => {
                    let release = state.release(auth, ProposalId::from_uuid(id(key)?))?;
                    Ok(state.view(auth, release, now))
                }
                ("POST", ["releases", key, "approval"]) => {
                    let release_id = ProposalId::from_uuid(id(key)?);
                    let release = state.release(auth, release_id)?.clone();
                    let input: Approval = decode(body)?;
                    if release.content_hash != input.content_hash {
                        return Err(Fault(412, "CONTENT_HASH_MISMATCH"));
                    }
                    if state.decisions.contains_key(&release_id) {
                        return Err(Fault(409, "APPROVAL_CONFLICT"));
                    }
                    if !release.is_verified() {
                        return Err(Fault(409, "RELEASE_UNVERIFIED"));
                    }
                    if release
                        .validation
                        .as_ref()
                        .is_none_or(|v| now > v.valid_until)
                    {
                        return Err(Fault(410, "RELEASE_EXPIRED"));
                    }
                    if auth.actor_id == release.created_by {
                        return Err(Fault(403, "SELF_APPROVAL_FORBIDDEN"));
                    }
                    match input.decision.as_str() {
                        "approve" => {
                            let ttl = input
                                .ttl_seconds
                                .filter(|t| (1..=86_400).contains(t))
                                .ok_or(Fault(422, "INVALID_EXPIRY"))?;
                            state
                                .releases
                                .approve(
                                    auth,
                                    release_id,
                                    &input.content_hash,
                                    now,
                                    now + Duration::seconds(ttl),
                                )
                                .map_err(release_error)?;
                            state.decisions.insert(release_id, Decision::Approved);
                        }
                        "reject" if input.ttl_seconds.is_none() => {
                            state.decisions.insert(release_id, Decision::Rejected);
                        }
                        _ => return Err(Fault(422, "INVALID_DECISION")),
                    }
                    Ok(state.view(auth, state.release(auth, release_id)?, now))
                }
                ("POST", ["releases", key, "deployments"]) => {
                    let release_id = ProposalId::from_uuid(id(key)?);
                    let input: Deploy = decode(body)?;
                    let target = DeploymentTarget::parse(&input.target).map_err(release_error)?;
                    let release = state.release(auth, release_id)?.clone();
                    state.deployable(&release, now)?;
                    if state.deployments.len() >= MAX_OBJECTS {
                        return Err(Fault(429, "CAPACITY_EXCEEDED"));
                    }
                    let ticket = state
                        .releases
                        .request_deployment(auth, release_id, target, now)
                        .map_err(release_error)?;
                    if let Some((id, _)) = state.deployments.iter().find(|(_, t)| **t == ticket) {
                        return Ok(
                            json!({"deployment_id":id,"target":ticket.target,"release_hash":release.content_hash}),
                        );
                    }
                    let deployment_id = Uuid::now_v7();
                    state.deployments.insert(deployment_id, ticket);
                    Ok(
                        json!({"deployment_id":deployment_id,"target":target,"release_hash":state.release(auth,release_id)?.content_hash}),
                    )
                }
                ("POST", ["deployments", key, "consume"]) => {
                    let ticket = state
                        .deployments
                        .get(&id(key)?)
                        .ok_or(Fault(404, "NOT_FOUND"))?;
                    if now < ticket.requested_at {
                        return Err(Fault(409, "TICKET_NOT_YET_VALID"));
                    }
                    let release = state.release(auth, ticket.release_id)?;
                    state.deployable(release, now)?;
                    release
                        .authorize_deployment(auth, ticket.target, now)
                        .map_err(release_error)?;
                    let adapter = GeneratedStrategyAdapter::from_draft_payload(
                        &release
                            .validation
                            .as_ref()
                            .ok_or(Fault(409, "RELEASE_UNVERIFIED"))?
                            .artifact_payload,
                    )
                    .map_err(|_| Fault(409, "INVALID_EVIDENCE"))?;
                    if !body.is_empty() && body != b"{}" {
                        return Err(Fault(422, "INVALID_REQUEST"));
                    }
                    Ok(
                        json!({"target":ticket.target,"release_hash":release.content_hash,"report_hash":release.backtest_report_hash,"parameters":adapter.configuration()}),
                    )
                }
                ("GET", ["audit"]) => Ok(
                    json!({"items":state.audit.iter().filter(|e|e.tenant_id==Some(auth.tenant_id)&&e.workspace_id==Some(auth.workspace_id)&&e.sequence>page.after_sequence.unwrap_or(0)).take(limit).collect::<Vec<_>>()}),
                ),
                _ => Err(Fault(404, "NOT_FOUND")),
            }
        })();
        let resource = resource.or_else(|| {
            result.as_ref().ok().and_then(|v| {
                [
                    v.get("draft_id"),
                    v.get("backtest_id"),
                    v.get("deployment_id"),
                    v.get("release").and_then(|r| r.get("release_id")),
                ]
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .find_map(|v| Uuid::parse_str(v).ok())
            })
        });
        let resource_hash = result.as_ref().ok().and_then(|v| {
            [
                v.get("content_hash"),
                v.get("release_hash"),
                v.get("release").and_then(|r| r.get("content_hash")),
                v.get("report").and_then(|r| r.get("report_hash")),
            ]
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .find_map(|v| ContentHash::parse(v).ok())
        });
        state.record(
            Some(auth),
            correlation,
            operation,
            (resource, resource_hash),
            result.as_ref().map(|_| ()).map_err(|e| *e),
            now,
        );
        reply(correlation, result)
    }
}
fn reply(correlation_id: Uuid, result: Result<Value>) -> Reply {
    match result {
        Ok(body) => Reply {
            status: 200,
            correlation_id,
            body,
        },
        Err(Fault(status, code)) => Reply {
            status,
            correlation_id,
            body: json!({"code":code,"correlation_id":correlation_id}),
        },
    }
}
impl State {
    fn draft(&self, auth: &AuthContext, id: StrategyDraftId) -> Result<&SavedDraft> {
        let d = self.catalog.get(&id).ok_or(Fault(404, "NOT_FOUND"))?;
        scope(auth, d.draft.tenant_id, d.draft.workspace_id)?;
        Ok(d)
    }
    fn input(&self, auth: &AuthContext, id: Uuid) -> Result<&StrategyInput> {
        let i = self.inputs.get(&id).ok_or(Fault(404, "NOT_FOUND"))?;
        scope(auth, i.tenant_id, i.workspace_id)?;
        Ok(i)
    }
    fn proof(&self, auth: &AuthContext, id: Uuid) -> Result<&ValidatedBacktest> {
        let p = self.backtests.get(&id).ok_or(Fault(404, "NOT_FOUND"))?;
        let d = p
            .report()
            .draft
            .as_ref()
            .ok_or(Fault(409, "INVALID_EVIDENCE"))?;
        scope(auth, d.tenant_id, d.workspace_id)?;
        Ok(p)
    }
    fn release(&self, auth: &AuthContext, id: ProposalId) -> Result<&StrategyRelease> {
        let r = self
            .releases
            .get_release(auth.tenant_id, id)
            .ok_or(Fault(404, "NOT_FOUND"))?;
        scope(auth, r.tenant_id, r.workspace_id)?;
        Ok(r)
    }
    fn status(&self, r: &StrategyRelease, now: DateTime<Utc>) -> &'static str {
        if !r.is_verified() {
            "unverified"
        } else if r.validation.as_ref().is_none_or(|v| now > v.valid_until)
            || r.approval.as_ref().is_some_and(|a| now >= a.expires_at)
        {
            "expired"
        } else if self.decisions.get(&r.release_id) == Some(&Decision::Rejected) {
            "rejected"
        } else if r.is_approved() {
            "approved"
        } else {
            "pending"
        }
    }
    fn deployable(&self, r: &StrategyRelease, now: DateTime<Utc>) -> Result<()> {
        match self.status(r, now) {
            "approved" => Ok(()),
            "expired" => Err(Fault(410, "RELEASE_EXPIRED")),
            "unverified" => Err(Fault(409, "RELEASE_UNVERIFIED")),
            "rejected" => Err(Fault(409, "RELEASE_REJECTED")),
            _ => Err(Fault(409, "RELEASE_UNAPPROVED")),
        }
    }
    fn view(&self, auth: &AuthContext, r: &StrategyRelease, now: DateTime<Utc>) -> Value {
        json!({"release":r,"approval_state":self.status(r,now),"can_approve":capability(auth,Capability::STRATEGY_APPROVE)&&auth.actor_id!=r.created_by&&self.status(r,now)=="pending","deployable_targets":if capability(auth,Capability::STRATEGY_WRITE)&&self.deployable(r,now).is_ok(){r.allowed_targets.clone()}else{Vec::new()}})
    }
    fn record(
        &mut self,
        auth: Option<&AuthContext>,
        correlation_id: Uuid,
        operation: &str,
        resource: (Option<Uuid>, Option<ContentHash>),
        outcome: Result<()>,
        recorded_at: DateTime<Utc>,
    ) {
        let (resource_id, resource_hash) = resource;
        let scope = (auth.map(|a| a.tenant_id), auth.map(|a| a.workspace_id));
        let (previous_sequence, previous_hash) = self
            .heads
            .get(&scope)
            .cloned()
            .unwrap_or((0, ContentHash::sha256_bytes(b"strategy-audit/v1")));
        let (status, code) = match outcome {
            Ok(()) => (200, "OK"),
            Err(Fault(s, c)) => (s, c),
        };
        let mut event = AuditEvent {
            sequence: previous_sequence + 1,
            tenant_id: scope.0,
            workspace_id: scope.1,
            actor_id: auth.map(|a| a.actor_id),
            correlation_id,
            operation: operation.into(),
            resource_id,
            resource_hash,
            code: code.into(),
            status,
            recorded_at,
            previous_hash,
            content_hash: ContentHash::sha256_bytes(b"pending"),
        };
        let mut payload = serde_json::to_value(&event).expect("audit metadata");
        payload.as_object_mut().unwrap().remove("content_hash");
        event.content_hash =
            ContentHash::sha256_bytes(&canonical_json_bytes(&payload).expect("audit metadata"));
        self.heads
            .insert(scope, (event.sequence, event.content_hash.clone()));
        self.audit.push(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quantos_policy::{Role, RunMode};
    use quantos_storage::{
        InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotQualityRuleset,
    };
    use std::sync::Weak;

    // Reading time outside the transaction deterministically fails, without a
    // scheduler-dependent sleep. This protects expiry checks after lock queuing.
    struct TransactionClock(Mutex<Weak<StrategyService>>);
    impl Clock for TransactionClock {
        fn now(&self) -> DateTime<Utc> {
            let service = self.0.lock().unwrap().upgrade().unwrap();
            assert!(
                service.state.try_lock().is_err(),
                "expiry clock read before transaction lock"
            );
            DateTime::from_timestamp(1_800_000_000, 0).unwrap()
        }
    }
    #[test]
    fn service_s04_clock_is_sampled_under_service_lock() {
        let clock = Arc::new(TransactionClock(Mutex::new(Weak::new())));
        let service = Arc::new(
            StrategyService::new(
                DraftService::new(
                    InMemoryDataSnapshotCatalog::new(),
                    InMemoryArtifactCatalog::new(),
                    SnapshotQualityRuleset::from_rules(vec![]).unwrap(),
                ),
                vec![],
                clock.clone(),
            )
            .unwrap(),
        );
        *clock.0.lock().unwrap() = Arc::downgrade(&service);
        let auth = AuthContext {
            tenant_id: TenantId::new(),
            actor_id: ActorId::new(),
            user_id: Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "clock-regression".into(),
            workspace_name: "Clock regression".into(),
            role: Role::Owner,
            mode: RunMode::Paper,
            account_id: None,
            capabilities: [Capability::parse(Capability::STRATEGY_WRITE).unwrap()]
                .into_iter()
                .collect(),
        };
        let result = service.execute(
            &auth,
            "GET",
            "catalog",
            b"",
            Page::default(),
            Uuid::now_v7(),
        );
        assert_eq!(result.status, 200);
        let state = service.state.lock().unwrap();
        assert_eq!(
            state.audit[0].recorded_at,
            DateTime::from_timestamp(1_800_000_000, 0).unwrap()
        );
    }
}
