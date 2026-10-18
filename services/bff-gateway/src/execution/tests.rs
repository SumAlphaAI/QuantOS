use super::*;
fn headers(version: Option<&str>) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(
        "idempotency-key",
        Uuid::now_v7().to_string().parse().unwrap(),
    );
    if let Some(v) = version {
        h.insert("if-match", v.parse().unwrap());
    }
    h
}
fn call(
    s: &mut ExecutionService,
    a: &AuthContext,
    path: &str,
    body: Value,
    h: &HeaderMap,
    now: DateTime<Utc>,
) -> Result<(StatusCode, Value)> {
    s.handle(
        a,
        "owned-session",
        &Method::POST,
        path,
        &BTreeMap::new(),
        h,
        &body,
        Some(h["idempotency-key"].to_str().unwrap().into()),
        now,
    )
}
fn actors(s: &ExecutionService) -> (AuthContext, AuthContext) {
    let a = s.auth.clone();
    let mut b = a.clone();
    b.actor_id = quantos_core::ActorId::new();
    b.role = Role::Approver;
    (a, b)
}
fn pending(s: &mut ExecutionService, now: DateTime<Utc>) -> (Uuid, Uuid) {
    let a = s.auth.clone();
    let pid = *s.proposals.keys().next().unwrap();
    let hash = s.context_hash(s.proposal(pid).unwrap());
    let out = call(
        s,
        &a,
        &format!("/v1/proposals/{pid}/risk-evaluations"),
        json!({"contextHash":hash}),
        &headers(Some("0")),
        now,
    )
    .unwrap()
    .1;
    (
        pid,
        Uuid::parse_str(out["jobId"].as_str().unwrap()).unwrap(),
    )
}
fn approved(s: &mut ExecutionService, now: DateTime<Utc>) -> (Uuid, Uuid, Value) {
    let (pid, aid) = pending(s, now);
    let (_, b) = actors(s);
    let out = call(
        s,
        &b,
        &format!("/v1/approvals/{aid}/decisions"),
        json!({"decision":"approve"}),
        &headers(Some("0")),
        now,
    )
    .unwrap()
    .1;
    (pid, aid, out)
}
#[test]
fn real_modules_approve_issue_submit_cancel_and_thousand_replays() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (a, _) = actors(&s);
    let (_, _, approval) = approved(&mut s, now);
    assert_eq!(approval["status"], "approved");
    assert_eq!(approval["issuanceState"], "consumed");
    let h = headers(None);
    let body = json!({"commandRef":approval["commandRef"]});
    let (status, first) = call(&mut s, &a, "/v1/commands", body.clone(), &h, now).unwrap();
    assert_eq!(status, StatusCode::ACCEPTED);
    let id = Uuid::parse_str(first["jobId"].as_str().unwrap()).unwrap();
    assert_eq!(s.order(id, now).unwrap()["status"], "accepted");
    for _ in 0..1000 {
        assert_eq!(
            call(&mut s, &a, "/v1/commands", body.clone(), &h, now)
                .unwrap()
                .1,
            first
        )
    }
    assert_eq!(s.downstream_counts(), (Some(1), Some(0)));
    let now = now + Duration::seconds(6);
    assert_eq!(
        s.order(id, now).unwrap()["cancelCommandRef"],
        body["commandRef"]
    );
    let c = headers(None);
    let path = format!("/v1/orders/{id}/cancel-requests");
    let r = call(&mut s, &a, &path, body.clone(), &c, now).unwrap();
    assert_eq!(r.1["status"], "cancel_requested");
    assert_eq!(call(&mut s, &a, &path, body, &c, now).unwrap().1, r.1);
    assert_eq!(s.order(id, now).unwrap()["status"], "cancelled");
    assert_eq!(s.downstream_counts(), (Some(1), Some(1)));
}
#[test]
fn self_approval_capability_and_scope_are_denied() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (a, b) = actors(&s);
    let (_, aid) = pending(&mut s, now);
    let path = format!("/v1/approvals/{aid}/decisions");
    let body = json!({"decision":"approve"});
    assert_eq!(
        call(&mut s, &a, &path, body.clone(), &headers(Some("0")), now)
            .unwrap_err()
            .0,
        StatusCode::FORBIDDEN
    );
    let mut c = b.clone();
    c.capabilities.clear();
    assert_eq!(
        call(&mut s, &c, &path, body.clone(), &headers(Some("0")), now)
            .unwrap_err()
            .0,
        StatusCode::FORBIDDEN
    );
    c = b;
    c.workspace_id = quantos_core::WorkspaceId::new();
    assert_eq!(
        call(&mut s, &c, &path, body, &headers(Some("0")), now)
            .unwrap_err()
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(s.downstream_counts().0, Some(0));
}
#[test]
fn context_version_mismatch_and_changed_idempotency_intent_conflict() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let a = s.auth.clone();
    let pid = *s.proposals.keys().next().unwrap();
    let path = format!("/v1/proposals/{pid}/risk-evaluations");
    let hash = s.context_hash(s.proposal(pid).unwrap());
    assert_eq!(
        call(
            &mut s,
            &a,
            &path,
            json!({"contextHash":hash}),
            &headers(Some("1")),
            now
        )
        .unwrap_err()
        .0,
        StatusCode::CONFLICT
    );
    assert!(
        call(
            &mut s,
            &a,
            &path,
            json!({"contextHash":"forged"}),
            &headers(Some("0")),
            now
        )
        .is_err()
    );
    let h = headers(Some("0"));
    call(&mut s, &a, &path, json!({"contextHash":hash}), &h, now).unwrap();
    assert_eq!(
        call(&mut s, &a, &path, json!({"contextHash":"changed"}), &h, now)
            .unwrap_err()
            .0,
        StatusCode::CONFLICT
    );
}
#[test]
fn stale_inputs_and_expired_proposal_never_create_approval() {
    let mut s = ExecutionService::reference();
    let a = s.auth.clone();
    let pid = *s.proposals.keys().next().unwrap();
    let future = Utc::now() + Duration::seconds(61);
    assert_eq!(s.portfolio(future)["stale"], true);
    let body = json!({"contextHash":s.context_hash(s.proposal(pid).unwrap())});
    assert!(
        call(
            &mut s,
            &a,
            &format!("/v1/proposals/{pid}/risk-evaluations"),
            body,
            &headers(Some("0")),
            future
        )
        .is_err()
    );
    assert!(s.proposal(pid).unwrap().approval.is_none());
}
#[test]
fn kill_between_issue_and_submit_prevents_downstream() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (a, _) = actors(&s);
    let (_, _, approval) = approved(&mut s, now);
    let mut owner = a.clone();
    owner.role = Role::Owner;
    let r = call(
        &mut s,
        &owner,
        "/v1/risk/kill-switch/engage",
        json!({"reason":"owned incident","confirmPhrase":"ENGAGE KILL SWITCH"}),
        &headers(None),
        now,
    )
    .unwrap();
    assert_eq!(r.1["killSwitch"]["state"], "engaged");
    assert!(
        call(
            &mut s,
            &a,
            "/v1/commands",
            json!({"commandRef":approval["commandRef"]}),
            &headers(None),
            now
        )
        .is_err()
    );
    assert_eq!(s.downstream_counts().0, Some(0));
}
#[test]
fn approval_conflict_expiry_missing_proof_and_reject_are_terminal() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (_, aid) = pending(&mut s, now);
    let (_, b) = actors(&s);
    let path = format!("/v1/approvals/{aid}/decisions");
    assert!(
        call(
            &mut s,
            &b,
            &path,
            json!({"decision":"approve"}),
            &headers(Some("1")),
            now
        )
        .is_err()
    );
    assert!(
        s.handle(
            &b,
            "s",
            &Method::POST,
            &path,
            &BTreeMap::new(),
            &headers(Some("0")),
            &json!({"decision":"approve"}),
            None,
            now
        )
        .is_err()
    );
    let r = call(
        &mut s,
        &b,
        &path,
        json!({"decision":"reject","reason":"risk owner decline"}),
        &headers(Some("0")),
        now,
    )
    .unwrap();
    assert_eq!(r.1["status"], "rejected");
    assert!(
        call(
            &mut s,
            &b,
            &path,
            json!({"decision":"approve"}),
            &headers(Some("1")),
            now
        )
        .is_err()
    );
    assert!(s.proposals.values().all(|p| p.command.is_none()));
}
#[test]
fn expired_command_ref_and_approver_cannot_submit() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (a, b) = actors(&s);
    let (_, _, approval) = approved(&mut s, now);
    let body = json!({"commandRef":approval["commandRef"]});
    assert_eq!(
        call(
            &mut s,
            &b,
            "/v1/commands",
            body.clone(),
            &headers(None),
            now
        )
        .unwrap_err()
        .0,
        StatusCode::FORBIDDEN
    );
    assert!(
        call(
            &mut s,
            &a,
            "/v1/commands",
            body,
            &headers(None),
            now + Duration::seconds(6)
        )
        .is_err()
    );
    assert_eq!(s.downstream_counts().0, Some(0));
}
#[test]
fn seven_current_risk_denial_families_are_enforced() {
    for variant in 0..7 {
        let mut s = ExecutionService::reference();
        let now = Utc::now();
        let a = s.auth.clone();
        let pid = *s.proposals.keys().next().unwrap();
        match variant {
            0 => {
                s.guard
                    .set_kill_switch(
                        &a,
                        KillScope::Account(a.account_id.unwrap()),
                        true,
                        0,
                        "incident",
                        now,
                    )
                    .unwrap();
            }
            1 => s.input.input_hash = ContentHash::sha256_bytes(b"tampered"),
            2 => s.financials.as_of = now - Duration::seconds(61),
            3 => s.venue.healthy = false,
            4 => s.release.allowed_targets.clear(),
            5 => s.financials.realized_pnl_today = -100000.0,
            6 => s.financials.equity = 100.0,
            _ => unreachable!(),
        };
        let body = json!({"contextHash":s.context_hash(s.proposal(pid).unwrap())});
        assert!(
            call(
                &mut s,
                &a,
                &format!("/v1/proposals/{pid}/risk-evaluations"),
                body,
                &headers(Some("0")),
                now
            )
            .is_err(),
            "variant {variant}"
        );
        assert_eq!(s.downstream_counts().0, Some(0));
    }
}
#[test]
fn bounded_immutable_cursor_is_actor_query_and_deadline_scoped() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (a, b) = actors(&s);
    let q = BTreeMap::from([("pageSize".into(), "1".into())]);
    let out = s
        .page(
            &a,
            "/v1/orders",
            &q,
            vec![json!({"orderId":"a"}), json!({"orderId":"b"})],
            now,
        )
        .unwrap();
    let mut next = q.clone();
    next.insert("cursor".into(), out["nextCursor"].as_str().unwrap().into());
    assert_eq!(
        s.page(&a, "/v1/orders", &next, vec![], now).unwrap()["items"][0]["orderId"],
        "b"
    );
    assert!(s.page(&b, "/v1/orders", &next, vec![], now).is_err());
    assert!(s.page(&a, "/v1/approvals", &next, vec![], now).is_err());
    assert!(
        s.page(&a, "/v1/orders", &next, vec![], now + Duration::minutes(6))
            .is_err()
    );
}
#[tokio::test]
async fn concurrent_http_reference_issuance_has_single_command_and_one_downstream() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let provider = crate::BffProvider::default();
    let app = provider.router();
    let wrong_method = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/v1/commands")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(wrong_method.status(), StatusCode::METHOD_NOT_ALLOWED);
    let request = |method: &str,
                   path: String,
                   body: Value,
                   key: String,
                   session: &str,
                   version: Option<&str>| {
        let mut r = Request::builder()
            .method(method)
            .uri(path)
            .header(
                "cookie",
                format!(
                    "quantos_session={session}; quantos_csrf={}",
                    crate::CSRF_TOKEN
                ),
            )
            .header("origin", crate::ALLOWED_ORIGIN)
            .header("x-csrf-token", crate::CSRF_TOKEN)
            .header("idempotency-key", key)
            .header("x-request-id", Uuid::now_v7().to_string())
            .header("content-type", "application/json");
        if let Some(v) = version {
            r = r.header("if-match", v)
        }
        r.body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap()
    };
    let json_body = |r: Response| async move {
        let status = r.status();
        let bytes = r.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice::<Value>(&bytes).unwrap())
    };
    let (_, list) = json_body(
        app.clone()
            .oneshot(request(
                "GET",
                "/v1/proposals".into(),
                json!({}),
                Uuid::now_v7().to_string(),
                crate::CURRENT_SESSION,
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    let pid = list["items"][0]["proposalId"].as_str().unwrap();
    let account = list["items"][0]["accountId"].as_str().unwrap();
    let (_, pre) = json_body(
        app.clone()
            .oneshot(request(
                "GET",
                format!("/v1/trade-preflight?accountId={account}&proposalId={pid}"),
                json!({}),
                Uuid::now_v7().to_string(),
                crate::CURRENT_SESSION,
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    let (status, pending) = json_body(
        app.clone()
            .oneshot(request(
                "POST",
                format!("/v1/proposals/{pid}/risk-evaluations"),
                json!({"contextHash":pre["contextHash"]}),
                Uuid::now_v7().to_string(),
                crate::CURRENT_SESSION,
                Some("0"),
            ))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::ACCEPTED, "{pending}");
    let (_, mfa) = json_body(
        app.clone()
            .oneshot(request(
                "POST",
                "/v1/auth/mfa/challenges".into(),
                json!({"purpose":"security_change","code":"123456"}),
                Uuid::now_v7().to_string(),
                "session-approver",
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    let (_, grant) = json_body(
        app.clone()
            .oneshot(request(
                "POST",
                "/v1/auth/reauth".into(),
                json!({"challengeRef":mfa["challengeRef"]}),
                Uuid::now_v7().to_string(),
                "session-approver",
                None,
            ))
            .await
            .unwrap(),
    )
    .await;
    let(status,approval)=json_body(app.clone().oneshot(request("POST",format!("/v1/approvals/{}/decisions",pending["jobId"].as_str().unwrap()),json!({"decision":"approve","mfaChallengeRef":mfa["challengeRef"],"reauthTokenRef":grant["reauthTokenRef"]}),Uuid::now_v7().to_string(),"session-approver",Some("0"))).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK, "{approval}");
    let key = Uuid::now_v7().to_string();
    let mut tasks = vec![];
    for _ in 0..1000 {
        let app = app.clone();
        let r = request(
            "POST",
            "/v1/commands".into(),
            json!({"commandRef":approval["commandRef"]}),
            key.clone(),
            crate::CURRENT_SESSION,
            None,
        );
        tasks.push(tokio::spawn(async move {
            app.oneshot(r).await.unwrap().status()
        }));
    }
    for t in tasks {
        assert_eq!(t.await.unwrap(), StatusCode::ACCEPTED)
    }
    assert_eq!(
        provider
            .data
            .lock()
            .await
            .execution
            .as_ref()
            .unwrap()
            .downstream_counts()
            .0,
        Some(1)
    );
}
#[test]
fn actual_allow_approval_required_and_deny_decisions_remain_distinct() {
    let mut f = reference_seed::Fixture::new();
    f.intent.quantity = "10".into();
    let guard = f.guard();
    let d = guard
        .evaluate(
            &f.auth,
            Phase::Pre,
            &f.intent,
            &f.input,
            &f.financials,
            &f.venue,
            &f.release,
            None,
            f.now,
        )
        .unwrap();
    assert_eq!(d.verdict, RiskVerdict::Allow);
    f.intent.quantity = "1500".into();
    f.intent.command_key = "owned-approval-scenario".into();
    assert_eq!(
        guard
            .evaluate(
                &f.auth,
                Phase::Pre,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                None,
                f.now
            )
            .unwrap()
            .verdict,
        RiskVerdict::ApprovalRequired
    );
    f.venue.healthy = false;
    f.intent.command_key = "owned-deny-scenario".into();
    assert_eq!(
        guard
            .evaluate(
                &f.auth,
                Phase::Pre,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                None,
                f.now
            )
            .unwrap()
            .verdict,
        RiskVerdict::Deny
    );
}
#[test]
fn filled_kernel_facts_and_fill_lineage_are_real() {
    let f = reference_seed::Fixture::new();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let gateway = SignedExecutionGateway::new(
        issuer.clone(),
        GatewayLimits {
            max_quantity: rust_decimal::Decimal::from(10000),
            max_notional: rust_decimal::Decimal::from(250000),
            allowed_venues: vec![f.venue.venue.clone()],
        },
        PaperKernel::new("100"),
    )
    .unwrap();
    let mut s = ExecutionService::new(
        f.auth.clone(),
        f.input.clone(),
        f.projection.clone(),
        f.financials.clone(),
        f.venue.clone(),
        f.release.clone(),
        guard,
        issuer,
        gateway,
    )
    .unwrap();
    s.register(&f.auth, f.record(), f.intent.clone(), f.now)
        .unwrap();
    let now = Utc::now();
    let (_, aid, approval) = approved(&mut s, now);
    let a = s.auth.clone();
    let r = call(
        &mut s,
        &a,
        "/v1/commands",
        json!({"commandRef":approval["commandRef"]}),
        &headers(None),
        now,
    )
    .unwrap();
    let id = Uuid::parse_str(r.1["jobId"].as_str().unwrap()).unwrap();
    let o = s.order(id, now).unwrap();
    assert_eq!(o["status"], "filled");
    assert_eq!(o["intent"], "increase");
    assert_eq!(
        s.input
            .portfolio
            .positions
            .iter()
            .find(|p| p.symbol == "BTCUSDT")
            .unwrap()
            .quantity,
        2500.0
    );
    assert_eq!(o["fills"].as_array().unwrap().len(), 1);
    assert_eq!(o["evidence"]["approvalId"], aid.to_string());
    assert!(o["evidence"]["factHashes"].as_array().unwrap().len() >= 3);
    assert!(
        o["evidence"]["snapshotHash"]
            .as_str()
            .unwrap()
            .starts_with("sha256:")
    );
}
#[test]
fn fail_closed_lease_source_update_and_proof_reuse() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let a = s.auth.clone();
    let mut owner = a.clone();
    owner.role = Role::Owner;
    let h = headers(None);
    let body = json!({"reason":"incident","confirmPhrase":"ENGAGE KILL SWITCH"});
    call(
        &mut s,
        &owner,
        "/v1/risk/kill-switch/engage",
        body.clone(),
        &h,
        now,
    )
    .unwrap();
    assert_eq!(
        call(&mut s, &owner, "/v1/risk/kill-switch/engage", body, &h, now)
            .unwrap()
            .0,
        StatusCode::OK
    );
    let mut next = headers(None);
    next.insert(
        "idempotency-key",
        Uuid::now_v7().to_string().parse().unwrap(),
    );
    assert!(
        s.handle(
            &owner,
            "owned-session",
            &Method::POST,
            "/v1/risk/kill-switch/release",
            &BTreeMap::new(),
            &next,
            &json!({"reason":"reuse"}),
            Some(h["idempotency-key"].to_str().unwrap().into()),
            now
        )
        .is_err()
    );
    let mut input = s.input.clone();
    input.input_hash = ContentHash::sha256_bytes(b"forged");
    assert!(
        s.replace_sources(
            input,
            s.projection.clone(),
            s.financials.clone(),
            s.venue.clone(),
            s.release.clone(),
            now
        )
        .is_err()
    );
    s.poisoned = true;
    assert_eq!(
        s.handle(
            &a,
            "owned-session",
            &Method::GET,
            "/v1/portfolio",
            &BTreeMap::new(),
            &HeaderMap::new(),
            &json!({}),
            None,
            now
        )
        .unwrap_err()
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
#[test]
fn shadow_has_read_projection_and_no_dispatch_path() {
    let mut f = reference_seed::Fixture::new();
    f.auth.mode = RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let gateway = SignedExecutionGateway::new(
        issuer.clone(),
        GatewayLimits {
            max_quantity: rust_decimal::Decimal::from(10000),
            max_notional: rust_decimal::Decimal::from(250000),
            allowed_venues: vec![f.venue.venue.clone()],
        },
        PaperKernel::resting("100"),
    )
    .unwrap();
    let mut s = ExecutionService::new(
        f.auth.clone(),
        f.input.clone(),
        f.projection.clone(),
        f.financials.clone(),
        f.venue.clone(),
        f.release.clone(),
        guard,
        issuer,
        gateway,
    )
    .unwrap();
    s.register(&f.auth, f.record(), f.intent.clone(), f.now)
        .unwrap();
    let a = f.auth.clone();
    let now = Utc::now();
    let cap = s
        .handle(
            &a,
            "shadow",
            &Method::GET,
            "/v1/order-capabilities",
            &BTreeMap::new(),
            &HeaderMap::new(),
            &json!({}),
            None,
            now,
        )
        .unwrap()
        .1;
    assert_eq!(cap["mode"], "shadow");
    assert_eq!(cap["canSubmit"], false);
    assert_eq!(cap["venueSubmit"], false);
    assert!(
        call(
            &mut s,
            &a,
            "/v1/commands",
            json!({"commandRef":Uuid::now_v7()}),
            &headers(None),
            now
        )
        .is_err()
    );
    assert_eq!(s.downstream_counts().0, Some(0));
}
#[test]
fn retry_recovers_same_reserved_approval_without_consuming_another_proof() {
    let mut s = ExecutionService::reference();
    let now = Utc::now();
    let (pid, aid) = pending(&mut s, now);
    let (_, b) = actors(&s);
    let path = format!("/v1/approvals/{aid}/decisions");
    let h = headers(Some("0"));
    let body = json!({"decision":"approve"});
    let intent = digest(&json!([
        "POST",
        path,
        BTreeMap::<String, String>::new(),
        body,
        Some("0")
    ]));
    let key = format!(
        "{}:{}:owned-session:{}",
        b.tenant_id,
        b.actor_id,
        h["idempotency-key"].to_str().unwrap()
    );
    let receipt = s
        .issuer
        .transition_approval(
            &b,
            ProposalId::from_uuid(aid),
            0,
            ApprovalState::Approved,
            now,
        )
        .unwrap();
    s.proposals.get_mut(&pid).unwrap().approval = Some(receipt);
    s.inflight.insert(key, intent);
    s.used_proofs
        .insert(h["idempotency-key"].to_str().unwrap().into(), now);
    let a = s.auth.clone();
    s.guard
        .set_kill_switch(
            &a,
            KillScope::Account(a.account_id.unwrap()),
            true,
            0,
            "owned injected interruption",
            now,
        )
        .unwrap();
    assert!(call(&mut s, &b, &path, body.clone(), &h, now).is_err());
    let mut owner = a;
    owner.role = Role::Owner;
    s.guard
        .set_kill_switch(
            &owner,
            KillScope::Account(owner.account_id.unwrap()),
            false,
            1,
            "owned resumed",
            now,
        )
        .unwrap();
    let result = call(&mut s, &b, &path, body.clone(), &h, now).unwrap();
    assert_eq!(result.1["issuanceState"], "consumed");
    assert!(s.inflight.is_empty());
    assert_eq!(call(&mut s, &b, &path, body, &h, now).unwrap().1, result.1);
    assert_eq!(
        s.proposal(pid).unwrap().approval.as_ref().unwrap().revision,
        2
    );
    assert_eq!(s.downstream_counts().0, Some(0));
}
