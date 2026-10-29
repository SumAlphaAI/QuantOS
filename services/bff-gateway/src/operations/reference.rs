//! Explicit synthetic source composition, never called by live constructors.
use super::*;
use quantos_operations::{Config, OPS_OBSERVE, OPS_READ, Scope};
use quantos_policy::{Capability, Role};
pub(crate) fn seed(shadow: bool, now: DateTime<Utc>) -> OperationsHost {
    let owner = governance::reference_auth("session-owner", shadow);
    let mut f = crate::execution::reference_seed::Fixture::new();
    f.auth = owner.clone();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let gateway = quantos_execution::dispatch::SignedExecutionGateway::new(
        issuer.clone(),
        quantos_execution::gateway::GatewayLimits {
            max_quantity: 10000.into(),
            max_notional: 250000.into(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        PaperKernel::resting("100"),
    )
    .unwrap();
    // This owned seed uses the caller's clock, including on a cold image-hash
    // initialization. Do not let later fixture materialization put X01 events
    // after the observation that initializes the service.
    let shift = now - f.now;
    for event in &mut f.events {
        event.occurred_at += shift;
        if let quantos_portfolio::PortfolioEventKind::MarketMark(mark) = &mut event.kind {
            mark.source_at += shift;
        }
    }
    let scope = Scope {
        tenant_id: owner.tenant_id,
        workspace_id: owner.workspace_id,
        account_id: owner.account_id.unwrap(),
        mode: owner.mode,
    };
    let mut observer = owner.clone();
    observer.actor_id = quantos_core::ActorId::from_uuid(id("c11-observer"));
    observer.user_id = id("c11-observer-user");
    observer.role = Role::Service;
    observer.capabilities = [OPS_OBSERVE, OPS_READ]
        .into_iter()
        .map(|c| Capability::parse(c).unwrap())
        .collect();
    let core = OperationsService::new(
        Config {
            scope: scope.clone(),
            quote_unit: "USD".into(),
            observer: observer.actor_id,
            started_at: now - Duration::seconds(6),
            max_actions: 4096,
        },
        f.events,
        issuer,
        guard,
        gateway,
    )
    .unwrap();
    let mut h = OperationsHost::new(
        core,
        scope,
        vec![
            owner.clone(),
            governance::reference_auth(crate::CURRENT_SESSION, shadow),
            governance::reference_auth("session-approver", shadow),
            governance::reference_auth(crate::VIEWER_SESSION, shadow),
        ],
    )
    .unwrap();
    let mut standby = governance::reference_auth(crate::CURRENT_SESSION, shadow);
    standby.actor_id = quantos_core::ActorId::from_uuid(
        Uuid::parse_str("66666666-6666-4666-8666-666666666666").unwrap(),
    );
    standby.user_id = id("c11-standby-user");
    h.register_identity(&owner, standby).unwrap();
    use quantos_engine_manager::{
        EngineApproval, EngineCapabilityManifest, EngineManifest, EngineQuota, EngineRoutingPolicy,
        EngineTransport,
    };
    let manifest = EngineManifest {
        engine_name: "owned-reviewed-research".into(),
        engine_version: "1.0.0".into(),
        supported_schema_versions: vec!["v1".into()],
        capabilities: vec![EngineCapabilityManifest {
            name: "research.hypothesis.v1".into(),
            version: "1.0.0".into(),
            description: "Owned reviewed local research capability".into(),
        }],
        transport: EngineTransport::Uds {
            socket_path: "/tmp/quantos-owned-review.sock".into(),
        },
        quota: EngineQuota {
            max_concurrency: 1,
            max_rss_mb: 128,
        },
    };
    let mut routing = EngineRoutingPolicy::local_fixture();
    routing.allowed_tenants = [owner.tenant_id.to_string()].into_iter().collect();
    let reviewer = governance::reference_auth("session-approver", shadow)
        .user_id
        .to_string();
    let approval = EngineApproval::sign_with_policy(
        &manifest,
        &"a".repeat(64),
        &reviewer,
        routing,
        b"owned-c11-fixture-approval-key",
    )
    .unwrap();
    h.register_engine_review(
        &owner,
        manifest,
        &approval,
        b"owned-c11-fixture-approval-key",
        now + Duration::minutes(5),
        now,
    )
    .unwrap();
    let (report, alerts) = observation(now, true);
    h.observe(
        &observer,
        &report,
        &alerts,
        MetricObservation {
            latency_ms: 12,
            dlq_depth: 1,
        },
        now,
    )
    .unwrap();
    h
}
pub(crate) fn renew(
    host: &mut OperationsHost,
    shadow: bool,
    now: DateTime<Utc>,
    active: bool,
) -> anyhow::Result<()> {
    let mut observer = governance::reference_auth("session-owner", shadow);
    observer.actor_id = quantos_core::ActorId::from_uuid(id("c11-observer"));
    observer.user_id = id("c11-observer-user");
    observer.role = Role::Service;
    observer.capabilities = [OPS_OBSERVE, OPS_READ]
        .into_iter()
        .map(|c| Capability::parse(c).unwrap())
        .collect();
    let (report, alerts) = observation(now, active);
    host.observe(
        &observer,
        &report,
        &alerts,
        MetricObservation {
            latency_ms: 8,
            dlq_depth: if active { 1 } else { 0 },
        },
        now,
    )
}
pub(super) fn observation(
    now: DateTime<Utc>,
    active: bool,
) -> (
    quantos_observability::ServiceHealthReport,
    Vec<quantos_observability::AlertRecord>,
) {
    let report = quantos_observability::build_health_report(
        "service-x06",
        ["execution", "portfolio", "risk", "reconciliation"]
            .into_iter()
            .map(|s| quantos_observability::HealthComponent {
                name: s.into(),
                ready: true,
                detail: "private synthetic secret must never escape".into(),
                checked_at: now,
            })
            .collect(),
        now,
    );
    let alerts = if active {
        vec![quantos_observability::AlertRecord {
            rule_id: "outbox_oldest_age".into(),
            severity: quantos_observability::AlertSeverity::Warning,
            summary: "private synthetic secret".into(),
            observed_value: json!({"credential":"not exposed"}),
            threshold: json!(1),
            triggered_at: now,
        }]
    } else {
        vec![]
    };
    (report, alerts)
}
pub(super) async fn handle(
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
    let assisted = data.lock().await.assisted.is_some();
    if assisted {
        if uri.path().starts_with("/v1/admin/feature-flags") {
            return crate::assisted::activation::handle(data, h, m, uri.path(), q, bytes).await;
        }
        let sid = crate::cookies(&h)
            .get("quantos_session")
            .copied()
            .unwrap_or("")
            .to_owned();
        return crate::assisted::alerts::handle(data, &sid, m, uri.path(), q, bytes.is_empty())
            .await;
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
    let b = if bytes.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice::<Value>(&bytes) {
            Ok(v) => v,
            Err(_) => return Fault::invalid().response(),
        }
    };
    let mut state = data.lock().await;
    let now = state.now();
    let shadow = state.reference_shadow;
    let a = governance::reference_auth(&session, shadow);
    let proof = {
        let c = b["mfaChallengeRef"]
            .as_str()
            .and_then(|id| state.challenges.get(id));
        let g = b["reauthTokenRef"]
            .as_str()
            .and_then(|id| state.reauth_grants.get(id));
        match (c, g) {
            (Some(c), Some(g))
                if c.session == session
                    && g.session == session
                    && b["mfaChallengeRef"].as_str() == Some(g.challenge_ref.as_str())
                    && c.consumed
                    && c.verified_at.is_some()
                    && c.expires_at > now
                    && g.expires_at > now =>
            {
                VerifiedStepUp::from_verified_session(
                    &a,
                    c.verified_at.unwrap(),
                    c.expires_at.min(g.expires_at),
                )
                .ok()
            }
            _ => None,
        }
    };
    let host = state.operations.get_or_insert_with(|| seed(shadow, now));
    let result = host.handle(&a, &session, &m, uri.path(), &q, &h, &b, proof, now);
    match result {
        Ok((s, v)) => {
            if m != Method::GET && !state.audits.iter().any(|r| r["auditRef"] == v["auditRef"]) {
                crate::record_audit_action(
                    &mut state,
                    uri.path(),
                    v["correlationId"].as_str().unwrap(),
                    uri.path(),
                    json!({"actor":a.actor_id,"outcome":"accepted"}),
                );
                if let Some(e) = state.audits.last_mut() {
                    e["auditRef"] = v["auditRef"].clone();
                    e["eventId"] = v["auditRef"].clone();
                    e["causationId"] = v["auditRef"].clone();
                    e["actor"] = json!(a.actor_id);
                }
            }
            output(s, v)
        }
        Err(e) => {
            let status = e.0;
            let code = e.1;
            let mut r = e.response();
            if code == "VERSION_CONFLICT"
                && let Some(v) = state
                    .operations
                    .as_ref()
                    .and_then(|s| s.current_version(uri.path(), &a))
            {
                let correlation = Uuid::new_v4();
                r = crate::response(
                    status,
                    json!({"code":code,"message":"Version changed; refresh before retry.","currentVersion":v,"correlationId":correlation}),
                    &correlation.to_string(),
                )
            }
            r
        }
    }
}
