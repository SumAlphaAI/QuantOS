use super::*;
fn setup() -> (OperationsHost, AuthContext, AuthContext, DateTime<Utc>) {
    let now = Utc::now();
    (
        reference::seed(false, now),
        governance::reference_auth("session-owner", false),
        governance::reference_auth(crate::CURRENT_SESSION, false),
        now,
    )
}
#[test]
fn actual_x06_f09_read_projections_are_redacted_and_stale_refused() {
    let (mut h, _, a, n) = setup();
    let (_, v) = h
        .handle(
            &a,
            "s",
            &Method::GET,
            "/v1/operations/health",
            &BTreeMap::new(),
            &HeaderMap::new(),
            &json!({}),
            None,
            n,
        )
        .unwrap();
    assert_eq!(v["ready"], false);
    assert_eq!(v["dlqDepth"], 1);
    assert!(!v.to_string().contains("private synthetic secret"));
    assert_eq!(
        h.handle(
            &a,
            "s",
            &Method::GET,
            "/v1/operations/health",
            &BTreeMap::new(),
            &HeaderMap::new(),
            &json!({}),
            None,
            n + Duration::seconds(31)
        )
        .unwrap_err()
        .1,
        "STALE_OBSERVATION"
    );
    assert!(
        h.alerts.values().all(|v| v["severity"] == "warning"
            && v["resolved"] == false
            && v["status"] == "unacked")
    );
}
fn call(
    h: &mut OperationsHost,
    a: &AuthContext,
    m: Method,
    path: &str,
    version: &str,
    mut b: Value,
    n: DateTime<Utc>,
) -> Result<(StatusCode, Value)> {
    let mut headers = HeaderMap::new();
    headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers.insert("if-match", version.parse().unwrap());
    if m != Method::GET && !path.ends_with("/subscriptions") {
        b["reason"] = json!("controlled fixture action");
    }
    let proof = VerifiedStepUp::from_verified_session(a, n, n + Duration::minutes(5)).unwrap();
    h.handle(
        a,
        "trusted-session",
        &m,
        path,
        &BTreeMap::new(),
        &headers,
        &b,
        Some(proof),
        n,
    )
}
#[test]
fn ack_unack_are_core_cas_and_never_change_source_resolution() {
    let (mut h, _, a, n) = setup();
    let aid = *h.alerts.keys().next().unwrap();
    let path = format!("/v1/alerts/{aid}");
    let ack = call(
        &mut h,
        &a,
        Method::POST,
        &format!("{path}/ack"),
        "1",
        json!({}),
        n,
    )
    .unwrap()
    .1;
    assert_eq!(ack["status"], "acked");
    assert_eq!(ack["resolved"], false);
    assert_eq!(ack["active"], true);
    assert!(ack["ackActor"].is_string());
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            &format!("{path}/unack"),
            "0",
            json!({}),
            n
        )
        .unwrap_err()
        .1,
        "VERSION_CONFLICT"
    );
    let unack = call(
        &mut h,
        &a,
        Method::POST,
        &format!("{path}/unack"),
        "2",
        json!({}),
        n,
    )
    .unwrap()
    .1;
    assert_eq!(unack["status"], "unacked");
    assert_eq!(unack["resolved"], false);
    assert_eq!(unack["ackActor"], Value::Null);
    reference::renew(&mut h, false, n + Duration::seconds(1), false).unwrap();
    let v = h.alerts.get(&aid).unwrap();
    assert_eq!(v["resolved"], true);
    assert_eq!(v["status"], "unacked");
    assert_eq!(v["severity"], "warning");
}
#[test]
fn governance_crud_versions_tombstones_and_last_admin_are_atomic() {
    let (mut h, owner, _, n) = setup();
    let ownpath = format!("/v1/admin/members/{}", owner.actor_id);
    let before = h.gov.entries.len();
    assert_eq!(
        call(&mut h, &owner, Method::DELETE, &ownpath, "0", json!({}), n)
            .unwrap_err()
            .1,
        "LAST_ADMIN"
    );
    assert_eq!(h.gov.entries.len(), before);
    let v=call(&mut h,&owner,Method::POST,"/v1/admin/roles","0",json!({"spec":{"kind":"role","name":"limited","baseRole":"operator","permissions":["ops.read"]}}),n).unwrap().1;
    let id = v["id"].as_str().unwrap();
    let path = format!("/v1/admin/roles/{id}");
    assert_eq!(call(&mut h,&owner,Method::PUT,&path,"999",json!({"spec":{"kind":"role","name":"modified","baseRole":"operator","permissions":["ops.read"]}}),n).unwrap_err().1,"VERSION_CONFLICT");
    let deleted = call(&mut h, &owner, Method::DELETE, &path, "0", json!({}), n)
        .unwrap()
        .1;
    assert_eq!(deleted["deleted"], true);
    assert_eq!(deleted["objectVersion"], "1");
    assert_eq!(h.gov.entries.len(), before + 1);
    let version = h.gov.version.to_string();
    assert_eq!(call(&mut h,&owner,Method::POST,"/v1/admin/roles",&version,json!({"spec":{"kind":"role","name":"limited","baseRole":"operator","permissions":["ops.read"]}}),n).unwrap_err().1,"RESOURCE_EXISTS");
}
#[test]
fn scope_identity_role_capability_and_fresh_proof_refuse() {
    let (mut h, owner, a, n) = setup();
    for k in 0..7 {
        let mut b = a.clone();
        match k {
            0 => b.tenant_id = quantos_core::TenantId::new(),
            1 => b.workspace_id = quantos_core::WorkspaceId::new(),
            2 => b.account_id = Some(quantos_core::AccountId::new()),
            3 => b.mode = quantos_policy::RunMode::Shadow,
            4 => b.role = quantos_policy::Role::Owner,
            5 => b.capabilities.clear(),
            _ => b.user_id = Uuid::new_v4(),
        };
        assert_eq!(
            call(
                &mut h,
                &b,
                Method::GET,
                "/v1/operations/health",
                "0",
                json!({}),
                n
            )
            .unwrap_err()
            .0,
            StatusCode::FORBIDDEN
        )
    }
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::GET,
            "/v1/admin/members",
            "0",
            json!({}),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::FORBIDDEN
    );
    let mut headers = HeaderMap::new();
    headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers.insert("if-match", "0".parse().unwrap());
    let aid = *h.alerts.keys().next().unwrap();
    assert_eq!(
        h.handle(
            &a,
            "s",
            &Method::POST,
            &format!("/v1/alerts/{aid}/ack"),
            &BTreeMap::new(),
            &headers,
            &json!({"reason":"trusted"}),
            None,
            n
        )
        .unwrap_err()
        .1,
        "RECENT_AUTH_REQUIRED"
    );
    let _ = owner;
}
#[test]
fn typed_runbooks_cannot_run_shell_write_ledger_or_skip_prechecks() {
    let (mut h, _, a, n) = setup();
    let before = h.core.audit(&a, 0, 100, None).unwrap().total;
    assert_eq!(
        call(
            &mut h,
            &a,
            Method::POST,
            "/v1/operations/runbook-actions/inspect-health/runs",
            "1",
            json!({"command":"sh"}),
            n
        )
        .unwrap_err()
        .1,
        "INVALID_REQUEST"
    );
    assert!(
        call(
            &mut h,
            &a,
            Method::POST,
            "/v1/operations/runbook-actions/edit-ledger/runs",
            "1",
            json!({}),
            n
        )
        .is_err()
    );
    assert_eq!(h.core.audit(&a, 0, 100, None).unwrap().total, before);
    let done = call(
        &mut h,
        &a,
        Method::POST,
        "/v1/operations/runbook-actions/inspect-health/runs",
        "1",
        json!({}),
        n,
    )
    .unwrap()
    .1;
    assert_eq!(done["status"], "succeeded");
    assert_eq!(h.core.audit(&a, 0, 100, None).unwrap().total, before + 2);
}
#[test]
fn exact_replay_survives_config_changes_and_current_revocation_precedes_replay() {
    let (mut h, owner, a, n) = setup();
    let aid = *h.alerts.keys().next().unwrap();
    let path = format!("/v1/alerts/{aid}/ack");
    let mut headers = HeaderMap::new();
    headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers.insert("if-match", "1".parse().unwrap());
    let b = json!({"reason":"exact retry"});
    let proof = VerifiedStepUp::from_verified_session(&a, n, n + Duration::minutes(5)).unwrap();
    let first = h
        .handle(
            &a,
            "s",
            &Method::POST,
            &path,
            &BTreeMap::new(),
            &headers,
            &b,
            Some(proof.clone()),
            n,
        )
        .unwrap();
    for _ in 0..1000 {
        assert_eq!(
            h.handle(
                &a,
                "s",
                &Method::POST,
                &path,
                &BTreeMap::new(),
                &headers,
                &b,
                None,
                n
            )
            .unwrap(),
            first
        )
    }
    assert_eq!(h.replays.len(), 1);
    let cap = h
        .gov
        .entries
        .values()
        .find(|e| matches!(&e.spec,Spec::Capability{name,..}if name=="ops.operate"))
        .unwrap()
        .id;
    call(
        &mut h,
        &owner,
        Method::PUT,
        &format!("/v1/admin/capabilities/{cap}"),
        "0",
        json!({"spec":{"kind":"capability","name":"ops.operate","enabled":false}}),
        n,
    )
    .unwrap();
    assert_eq!(
        h.handle(
            &a,
            "s",
            &Method::POST,
            &path,
            &BTreeMap::new(),
            &headers,
            &b,
            Some(proof),
            n
        )
        .unwrap_err()
        .0,
        StatusCode::FORBIDDEN
    );
}
#[test]
fn incident_resolution_needs_repair_new_source_and_separate_user() {
    let (mut h, owner, a, n) = setup();
    call(
        &mut h,
        &owner,
        Method::POST,
        "/v1/admin/capabilities",
        "0",
        json!({"spec":{"kind":"capability","name":"ops.approve","enabled":true}}),
        n,
    )
    .unwrap();
    let aid = *h.alerts.keys().next().unwrap();
    let opened = call(
        &mut h,
        &a,
        Method::POST,
        "/v1/operations/incidents",
        "1",
        json!({"alertId":aid}),
        n,
    )
    .unwrap()
    .1;
    let iid = opened["id"].as_str().unwrap();
    call(
        &mut h,
        &a,
        Method::POST,
        &format!("/v1/operations/incidents/{iid}/ack"),
        "0",
        json!({}),
        n,
    )
    .unwrap();
    call(
        &mut h,
        &a,
        Method::POST,
        &format!("/v1/alerts/{aid}/ack"),
        "1",
        json!({}),
        n,
    )
    .unwrap();
    let approver = governance::reference_auth("session-approver", false);
    assert!(
        call(
            &mut h,
            &approver,
            Method::POST,
            &format!("/v1/operations/incidents/{iid}/resolve"),
            "1",
            json!({}),
            n
        )
        .is_err()
    );
    reference::renew(&mut h, false, n + Duration::seconds(1), false).unwrap();
    let resolved = call(
        &mut h,
        &approver,
        Method::POST,
        &format!("/v1/operations/incidents/{iid}/resolve"),
        "1",
        json!({}),
        n + Duration::seconds(1),
    )
    .unwrap()
    .1;
    assert_eq!(resolved["status"], "resolved");
    let timeline = h.timeline[&parse(iid).unwrap()].clone();
    reference::renew(&mut h, false, n + Duration::seconds(2), true).unwrap();
    assert_eq!(h.incidents[&parse(iid).unwrap()]["status"], "open");
    assert!(h.timeline[&parse(iid).unwrap()].starts_with(&timeline));
}
#[test]
fn frozen_cursors_bind_session_query_config_and_expiry() {
    let (mut h, owner, _, n) = setup();
    let q = BTreeMap::from([("pageSize".into(), "1".into())]);
    let page = h
        .handle(
            &owner,
            "s",
            &Method::GET,
            "/v1/admin/roles",
            &q,
            &HeaderMap::new(),
            &json!({}),
            None,
            n,
        )
        .unwrap()
        .1;
    let mut q = q;
    q.insert("cursor".into(), page["nextCursor"].as_str().unwrap().into());
    assert!(
        h.handle(
            &owner,
            "s",
            &Method::GET,
            "/v1/admin/roles",
            &q,
            &HeaderMap::new(),
            &json!({}),
            None,
            n
        )
        .is_ok()
    );
    assert_eq!(
        h.handle(
            &owner,
            "other",
            &Method::GET,
            "/v1/admin/roles",
            &q,
            &HeaderMap::new(),
            &json!({}),
            None,
            n
        )
        .unwrap_err()
        .1,
        "CURSOR_SCOPE_CONFLICT"
    );
    assert!(
        h.handle(
            &owner,
            "s",
            &Method::GET,
            "/v1/admin/roles",
            &q,
            &HeaderMap::new(),
            &json!({}),
            None,
            n + Duration::minutes(5)
        )
        .is_err()
    );
}
#[test]
fn stream_resume_is_dense_bound_to_subscriptions_and_never_masks_gaps() {
    let (mut h, _, a, n) = setup();
    let first = call(
        &mut h,
        &a,
        Method::GET,
        "/v1/alerts/stream",
        "0",
        json!({}),
        n,
    )
    .unwrap()
    .1;
    let stream = first["streamId"].as_str().unwrap();
    assert_eq!(first["events"][0]["sequence"], 1);
    let query = BTreeMap::from([
        ("streamId".into(), stream.into()),
        ("afterSequence".into(), "1".into()),
    ]);
    assert_eq!(
        h.handle(
            &a,
            "trusted-session",
            &Method::GET,
            "/v1/alerts/stream",
            &query,
            &HeaderMap::new(),
            &json!({}),
            None,
            n
        )
        .unwrap()
        .1["events"],
        json!([])
    );
    let mut gap = query.clone();
    gap.insert("afterSequence".into(), "999".into());
    assert_eq!(
        h.handle(
            &a,
            "trusted-session",
            &Method::GET,
            "/v1/alerts/stream",
            &gap,
            &HeaderMap::new(),
            &json!({}),
            None,
            n
        )
        .unwrap_err()
        .1,
        "STREAM_GAP"
    );
    call(
        &mut h,
        &a,
        Method::PUT,
        "/v1/alerts/subscriptions",
        "0",
        json!({"severities":["warning"],"domains":["system"]}),
        n,
    )
    .unwrap();
    assert_eq!(
        h.handle(
            &a,
            "trusted-session",
            &Method::GET,
            "/v1/alerts/stream",
            &query,
            &HeaderMap::new(),
            &json!({}),
            None,
            n
        )
        .unwrap_err()
        .1,
        "STREAM_SCOPE_CONFLICT"
    );
}
#[test]
fn roles_policies_and_flags_cannot_grant_above_f06_or_disable_safety() {
    let (mut h, owner, a, n) = setup();
    assert!(call(&mut h,&owner,Method::POST,"/v1/admin/roles","0",json!({"spec":{"kind":"role","name":"bypass","baseRole":"operator","permissions":["admin.write"]}}),n).is_err());
    assert!(call(&mut h,&owner,Method::POST,"/v1/admin/feature-flags","0",json!({"spec":{"kind":"flag","name":"disable-kill-switch","enabled":true,"rolloutPercent":100}}),n).is_err());
    let spec = json!({"spec":{"kind":"policy","name":"deny-self-admin","roleId":governance::id("c11-role:owner"),"deniedCapabilities":["admin.write"],"active":true}});
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::POST,
            "/v1/admin/policies",
            "0",
            spec,
            n
        )
        .unwrap_err()
        .1,
        "LAST_ADMIN"
    );
    assert!(h.gov.allows(&owner, "admin.write"));
    assert!(!h.gov.allows(&a, "admin.write"));
}
#[test]
fn member_revocation_changes_all_page_context_admission_and_poison_refuses() {
    let (mut h, owner, a, n) = setup();
    let path = format!("/v1/admin/members/{}", a.actor_id);
    call(&mut h,&owner,Method::PUT,&path,"0",json!({"spec":{"kind":"member","actorId":a.actor_id,"roleId":governance::id("c11-role:operator"),"active":false}}),n).unwrap();
    assert!(!h.context_current(crate::CURRENT_SESSION, false));
    assert_eq!(
        h.admit_identity(&a).unwrap_err().0,
        StatusCode::UNAUTHORIZED
    );
    h.poisoned = true;
    assert_eq!(
        h.admit_identity(&owner).unwrap_err().0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
#[tokio::test]
async fn concurrent_governance_retries_are_unique_and_revocation_blocks_other_pages() {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    let provider = crate::BffProvider::default();
    let app = provider.clone().router();
    let (host, owner, a, n) = setup();
    let spec = json!({"spec":{"kind":"role","name":"concurrent-role","baseRole":"operator","permissions":["ops.read"]},"reason":"controlled concurrent mutation"});
    let shared = std::sync::Arc::new(std::sync::Mutex::new(host));
    let mut jobs = vec![];
    let key = Uuid::new_v4();
    for _ in 0..40 {
        let host = shared.clone();
        let owner = owner.clone();
        let b = spec.clone();
        jobs.push(std::thread::spawn(move || {
            let mut headers = HeaderMap::new();
            headers.insert("idempotency-key", key.to_string().parse().unwrap());
            headers.insert("if-match", "0".parse().unwrap());
            host.lock()
                .unwrap()
                .handle(
                    &owner,
                    "s",
                    &Method::POST,
                    "/v1/admin/roles",
                    &BTreeMap::new(),
                    &headers,
                    &b,
                    Some(
                        VerifiedStepUp::from_verified_session(&owner, n, n + Duration::minutes(5))
                            .unwrap(),
                    ),
                    n,
                )
                .unwrap()
                .1
        }));
    }
    let replies = jobs
        .into_iter()
        .map(|j| j.join().unwrap())
        .collect::<Vec<_>>();
    assert!(replies.iter().all(|v| v == &replies[0]));
    let mut host = std::sync::Arc::try_unwrap(shared)
        .unwrap()
        .into_inner()
        .unwrap();
    assert_eq!(host.replays.len(), 1);
    call(&mut host,&owner,Method::PUT,&format!("/v1/admin/members/{}",a.actor_id),"0",json!({"spec":{"kind":"member","actorId":a.actor_id,"roleId":governance::id("c11-role:operator"),"active":false}}),n).unwrap();
    provider.data.lock().await.operations = Some(host);
    for path in [
        "/v1/context",
        "/v1/reconciliation/runs",
        "/v1/performance/summary",
    ] {
        let r = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(path)
                    .header("cookie", "quantos_session=session-current")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::UNAUTHORIZED)
    }
}

#[test]
fn signed_engine_reviews_bind_metadata_expiry_independence_and_workflow_admission() {
    let (mut h, owner, _, n) = setup();
    let input = serde_json::to_vec(&json!({"capability":"research.hypothesis.v1","dataSnapshotId":Uuid::new_v4(),"question":"owned","budget":"1","deadlineAt":n+Duration::hours(1),"attachments":[]})).unwrap();
    assert_eq!(
        h.authorize_engine_input(&input, n).unwrap_err().1,
        "CAPABILITY_NOT_APPROVED"
    );
    let review = h.gov.reviews.values().next().unwrap().clone();
    let c = &review.capabilities[0];
    let spec = json!({"kind":"engine_capability","reviewId":review.id,"name":c.name,"version":c.version,"description":c.description,"enabled":true});
    let mut bad = spec.clone();
    bad["reviewId"] = json!(Uuid::new_v4());
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::POST,
            "/v1/admin/capabilities",
            "0",
            json!({"spec":bad}),
            n
        )
        .unwrap_err()
        .1,
        "ENGINE_REVIEW_REQUIRED"
    );
    bad = spec.clone();
    bad["version"] = json!("unreviewed");
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::POST,
            "/v1/admin/capabilities",
            "0",
            json!({"spec":bad}),
            n
        )
        .unwrap_err()
        .1,
        "ENGINE_REVIEW_MISMATCH"
    );
    h.gov.reviews.get_mut(&review.id).unwrap().reviewer = owner.user_id;
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::POST,
            "/v1/admin/capabilities",
            "0",
            json!({"spec":spec}),
            n
        )
        .unwrap_err()
        .1,
        "SELF_APPROVAL"
    );
    h.gov.reviews.insert(review.id, review.clone());
    let accepted = call(
        &mut h,
        &owner,
        Method::POST,
        "/v1/admin/capabilities",
        "0",
        json!({"spec":spec}),
        n,
    )
    .unwrap()
    .1;
    h.authorize_engine_input(&input, n).unwrap();
    assert!(!h.engine_capability_allowed("research.experiment.v1", n));
    assert!(!h.engine_capability_allowed(&c.name, n + Duration::minutes(6)));
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::PUT,
            &format!(
                "/v1/admin/capabilities/{}",
                accepted["id"].as_str().unwrap()
            ),
            "0",
            json!({"spec":spec}),
            n + Duration::minutes(6)
        )
        .unwrap_err()
        .1,
        "ENGINE_REVIEW_EXPIRED"
    );
    // Expired grants can be tombstoned without reviving the expired review.
    call(
        &mut h,
        &owner,
        Method::DELETE,
        &format!(
            "/v1/admin/capabilities/{}",
            accepted["id"].as_str().unwrap()
        ),
        "0",
        json!({}),
        n + Duration::minutes(6),
    )
    .unwrap();
    assert!(!h.engine_capability_allowed(&c.name, n));
    use quantos_engine_manager::*;
    let manifest = EngineManifest {
        engine_name: "reviewed-engine".into(),
        engine_version: "1.0.0".into(),
        supported_schema_versions: vec!["v1".into()],
        capabilities: review.capabilities.clone(),
        transport: EngineTransport::Uds {
            socket_path: "/tmp/quantos-reviewed-test.sock".into(),
        },
        quota: EngineQuota {
            max_concurrency: 1,
            max_rss_mb: 128,
        },
    };
    let mut policy = EngineRoutingPolicy::local_fixture();
    policy.allowed_tenants = [owner.tenant_id.to_string()].into_iter().collect();
    let approval = EngineApproval::sign_with_policy(
        &manifest,
        &"b".repeat(64),
        &review.reviewer.to_string(),
        policy,
        b"owned-review-unit-test-key",
    )
    .unwrap();
    assert!(
        h.register_engine_review(
            &owner,
            manifest.clone(),
            &approval,
            b"wrong-authority",
            n + Duration::minutes(5),
            n
        )
        .is_err()
    );
    assert!(
        h.register_engine_review(
            &owner,
            manifest.clone(),
            &approval,
            b"owned-review-unit-test-key",
            n,
            n
        )
        .is_err()
    );
    let mut changed = manifest.clone();
    changed.capabilities[0].version = "2.0.0".into();
    assert!(
        h.register_engine_review(
            &owner,
            changed,
            &approval,
            b"owned-review-unit-test-key",
            n + Duration::minutes(5),
            n
        )
        .is_err()
    );
    h.register_engine_review(
        &owner,
        manifest,
        &approval,
        b"owned-review-unit-test-key",
        n + Duration::minutes(5),
        n,
    )
    .unwrap();
    h.poisoned = true;
    assert!(!h.engine_capability_allowed(&c.name, n));
}

#[test]
fn governance_checks_exact_step_up_caller_and_clock_before_commit() {
    let (mut h, owner, other, n) = setup();
    let mut headers = HeaderMap::new();
    headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers.insert("if-match", "0".parse().unwrap());
    let body = json!({"reason":"bounded","spec":{"kind":"role","name":"step-bound","baseRole":"operator","permissions":["ops.read"]}});
    for (a, when) in [
        (&other, n),
        (&owner, n - Duration::minutes(6)),
        (&owner, n + Duration::seconds(1)),
    ] {
        let step =
            VerifiedStepUp::from_verified_session(a, when, when + Duration::minutes(5)).unwrap();
        assert_eq!(
            h.handle(
                &owner,
                "s",
                &Method::POST,
                "/v1/admin/roles",
                &BTreeMap::new(),
                &headers,
                &body,
                Some(step),
                n
            )
            .unwrap_err()
            .1,
            "STALE_OBSERVATION"
        );
        assert_eq!(h.gov.version, 0);
    }
    let step = VerifiedStepUp::from_verified_session(&owner, n, n + Duration::minutes(5)).unwrap();
    h.handle(
        &owner,
        "s",
        &Method::POST,
        "/v1/admin/roles",
        &BTreeMap::new(),
        &headers,
        &body,
        Some(step),
        n,
    )
    .unwrap();
    assert_eq!(h.gov.version, 1);
}

#[test]
fn last_admin_retains_both_read_and_write_access_after_capability_or_policy_change() {
    let (mut h, owner, _, n) = setup();
    let rid = governance::id("c11-capability:admin.read");
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::PUT,
            &format!("/v1/admin/capabilities/{rid}"),
            "0",
            json!({"spec":{"kind":"capability","name":"admin.read","enabled":false}}),
            n
        )
        .unwrap_err()
        .1,
        "LAST_ADMIN"
    );
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::DELETE,
            &format!("/v1/admin/capabilities/{rid}"),
            "0",
            json!({}),
            n
        )
        .unwrap_err()
        .1,
        "LAST_ADMIN"
    );
    assert_eq!(call(&mut h,&owner,Method::POST,"/v1/admin/policies","0",json!({"spec":{"kind":"policy","name":"deny-admin-read","roleId":governance::id("c11-role:owner"),"deniedCapabilities":["admin.read"],"active":true}}),n).unwrap_err().1,"LAST_ADMIN");
    assert_eq!(h.gov.version, 0);
    assert!(h.gov.allows(&owner, "admin.read") && h.gov.allows(&owner, "admin.write"));
    h.handle(
        &owner,
        "s",
        &Method::GET,
        "/v1/admin/members",
        &BTreeMap::new(),
        &HeaderMap::new(),
        &json!({}),
        None,
        n,
    )
    .unwrap();
}

fn read_page_at(
    h: &mut OperationsHost,
    a: &AuthContext,
    path: &str,
    query: &BTreeMap<String, String>,
    now: DateTime<Utc>,
) -> Result<Value> {
    h.handle(
        a,
        "s",
        &Method::GET,
        path,
        query,
        &HeaderMap::new(),
        &json!({}),
        None,
        now,
    )
    .map(|(_, v)| v)
}

#[test]
fn cursor_chain_keeps_deadline_and_expired_capacity_recovers_without_writes() {
    let (mut h, owner, _, n) = setup();
    let path = "/v1/admin/roles";
    let mut query = BTreeMap::from([("pageSize".into(), "1".into())]);
    let first = read_page_at(&mut h, &owner, path, &query, n).unwrap();
    query.insert(
        "cursor".into(),
        first["nextCursor"].as_str().unwrap().into(),
    );
    let second = read_page_at(&mut h, &owner, path, &query, n + Duration::minutes(4)).unwrap();
    query.insert(
        "cursor".into(),
        second["nextCursor"].as_str().unwrap().into(),
    );
    let third = read_page_at(&mut h, &owner, path, &query, n + Duration::seconds(270)).unwrap();
    assert_ne!(second["items"], third["items"]);
    let expired = n + Duration::minutes(5);
    assert_eq!(
        read_page_at(&mut h, &owner, path, &query, expired)
            .unwrap_err()
            .1,
        "CURSOR_EXPIRED"
    );
    query.remove("cursor");
    for _ in 0..1000 {
        read_page_at(&mut h, &owner, path, &query, expired).unwrap();
    }
    assert_eq!(
        read_page_at(&mut h, &owner, path, &query, expired)
            .unwrap_err()
            .0,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert!(read_page_at(&mut h, &owner, path, &query, expired + Duration::minutes(5)).is_ok());
    assert_eq!(h.gov.version, 0);
    assert!(h.replays.is_empty());
}

#[test]
fn expired_stream_capacity_recovers_with_fresh_source_and_old_lease_refuses() {
    let (mut h, _, a, n) = setup();
    let path = "/v1/alerts/stream";
    let query = BTreeMap::new();
    let mut first = Value::Null;
    for index in 0..1000 {
        let page = read_page_at(&mut h, &a, path, &query, n).unwrap();
        if index == 0 {
            first = page;
        }
    }
    assert_eq!(
        read_page_at(&mut h, &a, path, &query, n).unwrap_err().0,
        StatusCode::TOO_MANY_REQUESTS
    );
    let later = n + Duration::minutes(5);
    assert_eq!(
        read_page_at(&mut h, &a, path, &query, later).unwrap_err().1,
        "STALE_OBSERVATION"
    );
    reference::renew(&mut h, false, later, true).unwrap();
    let next = read_page_at(&mut h, &a, path, &query, later).unwrap();
    assert_ne!(first["streamId"], next["streamId"]);
    let old = BTreeMap::from([(
        "streamId".into(),
        first["streamId"].as_str().unwrap().into(),
    )]);
    assert_eq!(
        read_page_at(&mut h, &a, path, &old, later).unwrap_err().1,
        "STREAM_EXPIRED"
    );
    assert_eq!(h.streams.len(), 1);
    assert_eq!(h.gov.version, 0);
    assert!(h.replays.is_empty());
}

#[test]
fn deleted_governance_resource_cannot_be_restored_or_deleted_again() {
    let (mut h, owner, _, n) = setup();
    let spec = json!({"spec":{"kind":"role","name":"tombstone-role","baseRole":"operator","permissions":["ops.read"]}});
    let created = call(
        &mut h,
        &owner,
        Method::POST,
        "/v1/admin/roles",
        "0",
        spec.clone(),
        n,
    )
    .unwrap()
    .1;
    let path = format!("/v1/admin/roles/{}", created["id"].as_str().unwrap());
    let tombstone = call(&mut h, &owner, Method::DELETE, &path, "0", json!({}), n)
        .unwrap()
        .1;
    let before = (h.gov.version, h.events.len(), h.replays.len());
    for (method, body) in [(Method::PUT, spec.clone()), (Method::DELETE, json!({}))] {
        assert_eq!(
            call(&mut h, &owner, method, &path, "1", body, n)
                .unwrap_err()
                .0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            read_page_at(&mut h, &owner, &path, &BTreeMap::new(), n).unwrap()["deleted"],
            true
        );
        assert_eq!((h.gov.version, h.events.len(), h.replays.len()), before);
    }
    let current = h.gov.version.to_string();
    assert_eq!(
        call(
            &mut h,
            &owner,
            Method::POST,
            "/v1/admin/roles",
            &current,
            spec,
            n
        )
        .unwrap_err()
        .1,
        "RESOURCE_EXISTS"
    );
    let id = parse(tombstone["id"].as_str().unwrap()).unwrap();
    assert!(h.gov.entries[&id].deleted);
    assert_eq!(h.gov.entries[&id].version, 1);
}

#[test]
fn reference_seed_uses_requested_clock_before_materialization() {
    let requested = Utc::now() - Duration::seconds(10);
    let mut host = reference::seed(false, requested);
    let a = governance::reference_auth(crate::CURRENT_SESSION, false);
    let health = read_page_at(
        &mut host,
        &a,
        "/v1/operations/health",
        &BTreeMap::new(),
        requested,
    )
    .unwrap();
    assert_eq!(health["asOf"], json!(requested));
    assert_eq!(
        health["expiresAt"],
        json!(requested + Duration::seconds(30))
    );
    assert_eq!(
        read_page_at(
            &mut host,
            &a,
            "/v1/operations/health",
            &BTreeMap::new(),
            requested + Duration::seconds(31)
        )
        .unwrap_err()
        .1,
        "STALE_OBSERVATION"
    );
}

#[test]
fn allowed_filters_return_empty_pages_without_data_dependent_authorization() {
    let (mut host, owner, a, now) = setup();
    let query = BTreeMap::from([
        ("status".into(), "acked".into()),
        ("domain".into(), "system".into()),
        ("severity".into(), "warning".into()),
        ("active".into(), "true".into()),
    ]);
    assert_eq!(
        read_page_at(&mut host, &a, "/v1/alerts", &query, now).unwrap()["items"],
        json!([])
    );
    let active = BTreeMap::from([
        ("domain".into(), "system".into()),
        ("severity".into(), "warning".into()),
        ("active".into(), "true".into()),
    ]);
    assert!(
        !read_page_at(&mut host, &a, "/v1/alerts", &active, now).unwrap()["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let status = BTreeMap::from([("status".into(), "resolved".into())]);
    assert_eq!(
        read_page_at(&mut host, &a, "/v1/operations/incidents", &status, now).unwrap()["items"],
        json!([])
    );
    for (path, query) in [
        ("/v1/admin/roles", status),
        ("/v1/operations/incidents", active),
    ] {
        assert_eq!(
            read_page_at(&mut host, &owner, path, &query, now)
                .unwrap_err()
                .0,
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }
    assert_eq!(host.gov.version, 0);
    assert!(host.replays.is_empty());
}
