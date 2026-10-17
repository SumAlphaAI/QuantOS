#[allow(dead_code)]
mod support;
use support::*;
#[test]
fn service_x06_actual_signed_execution_fill_position_and_safe_evidence_chain() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    assert_eq!(s.risk_snapshot(a, n).unwrap(), h.f.input);
    let p = s.prepare_submit(a, &m, "submit-1", &c, n).unwrap();
    let done = s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n).unwrap();
    reference(&done);
    let e = s.evidence_chain(a, &c.command_id.to_string(), n).unwrap();
    assert_eq!(e.proposal_hash, c.proposal_hash);
    assert_eq!(e.decision_id, c.source_decision_id.to_string());
    assert_eq!(e.fills.len(), 1);
    assert_eq!(e.fill_links.len(), 1);
    assert_eq!(e.fill_links[0].fill_id, e.fills[0].fill_id);
    assert_eq!(e.portfolio.last_event_sequence, 6);
    assert_eq!(
        e.portfolio
            .positions
            .iter()
            .find(|p| p.symbol == "BTCUSDT")
            .unwrap()
            .quantity,
        1010.0
    );
    let wire = serde_json::to_string(&e).unwrap();
    for bad in ["signature", "signer", "private synthetic secret"] {
        assert!(!wire.contains(bad));
    }
    let current = s.risk_snapshot(a, n).unwrap();
    assert_eq!(
        s.dispatch_prepared(
            a,
            &m,
            &p.id,
            CurrentSources {
                snapshot: &current,
                ..h.f.sources()
            },
            n
        )
        .unwrap(),
        done
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(
        s.evidence_chain(a, &e.command_id, n)
            .unwrap()
            .fill_links
            .len(),
        1
    );
    println!(
        "SERVICE_X06_EVIDENCE=COMMAND_RISK_APPROVAL_ORDER_FILL_POSITION LEDGER_EVENTS=6 DOWNSTREAM_CALLS=1"
    );
}
#[test]
fn service_x06_scope_roles_capabilities_and_fresh_stepup_are_current() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let mut actors = vec![];
    let mut x = a.clone();
    x.tenant_id = quantos_core::TenantId::new();
    actors.push(x);
    let mut x = a.clone();
    x.workspace_id = quantos_core::WorkspaceId::new();
    actors.push(x);
    let mut x = a.clone();
    x.account_id = Some(quantos_core::AccountId::new());
    actors.push(x);
    let mut x = a.clone();
    x.mode = quantos_policy::RunMode::AssistedLive;
    actors.push(x);
    for x in actors {
        assert!(s.risk_snapshot(&x, n).is_err());
        assert!(s.prepare_submit(&x, &m, "scope", &c, n).is_err());
    }
    for role in [Role::Viewer, Role::Approver, Role::Service] {
        let mut x = a.clone();
        x.role = role;
        assert!(s.prepare_submit(&x, &step(&x, n), "role", &c, n).is_err());
    }
    let mut revoked = a.clone();
    revoked
        .capabilities
        .remove(&Capability::parse(OPS_OPERATE).unwrap());
    assert!(s.prepare_submit(&revoked, &m, "revoked", &c, n).is_err());
    assert!(
        s.prepare_submit(a, &m, "expired", &c, n + Duration::minutes(5))
            .is_err()
    );
    let mut x = a.clone();
    x.workspace_name = "changed".into();
    assert!(s.prepare_submit(&x, &m, "binding", &c, n).is_err());
    assert_eq!(s.audit(a, 0, 100, None).unwrap().total, 0);
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
}
#[test]
fn service_x06_forgery_conflicting_keys_and_current_risk_refuse_without_fills() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let mut fake = c.clone();
    fake.signature = "synthetic-forged".into();
    assert!(s.prepare_submit(a, &m, "fake", &fake, n).is_err());
    let p = s.prepare_submit(a, &m, "same", &c, n).unwrap();
    assert!(s.prepare_submit(a, &m, "other", &c, n).is_err());
    h.guard
        .set_kill_switch(
            a,
            KillScope::Account(h.config.scope.account_id),
            true,
            0,
            "synthetic risk refusal",
            n,
        )
        .unwrap();
    assert_eq!(
        s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n)
            .unwrap()
            .outcome,
        Outcome::Rejected
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
    assert!(s.evidence_chain(a, &c.command_id.to_string(), n).is_err());
    assert_eq!(
        s.risk_snapshot(a, n).unwrap().portfolio,
        h.f.input.portfolio
    );
}
#[test]
fn service_x06_concurrent_prepare_and_current_replays_are_unique() {
    let h = Arc::new(Harness::new());
    let s = Arc::new(h.service());
    let c = Arc::new(h.command());
    let b = Arc::new(Barrier::new(32));
    let mut tasks = vec![];
    for _ in 0..32 {
        let (h, s, c, b) = (h.clone(), s.clone(), c.clone(), b.clone());
        tasks.push(thread::spawn(move || {
            b.wait();
            s.prepare_submit(
                &h.f.auth,
                &step(&h.f.auth, h.f.now),
                "concurrent",
                &c,
                h.f.now,
            )
            .unwrap()
        }));
    }
    let ids: std::collections::BTreeSet<_> =
        tasks.into_iter().map(|t| t.join().unwrap().id).collect();
    assert_eq!(ids.len(), 1);
    let id = ids.first().unwrap();
    s.dispatch_prepared(
        &h.f.auth,
        &step(&h.f.auth, h.f.now),
        id,
        h.f.sources(),
        h.f.now,
    )
    .unwrap();
    let input = s.risk_snapshot(&h.f.auth, h.f.now).unwrap();
    let mut tasks = vec![];
    for _ in 0..32 {
        let (h, s, input, id) = (h.clone(), s.clone(), input.clone(), id.clone());
        tasks.push(thread::spawn(move || {
            s.dispatch_prepared(
                &h.f.auth,
                &step(&h.f.auth, h.f.now),
                &id,
                CurrentSources {
                    snapshot: &input,
                    ..h.f.sources()
                },
                h.f.now,
            )
            .unwrap()
        }));
    }
    for t in tasks {
        reference(&t.join().unwrap());
    }
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(s.audit(&h.f.auth, 0, 100, None).unwrap().total, 2);
}
#[test]
fn service_x06_kill_resume_requires_independent_user_new_health_cas_and_one_consumption() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    reference(
        &s.engage_kill(a, &m, "kill", 0, "synthetic emergency", n)
            .unwrap(),
    );
    let request = reference(&s.request_resume(a, &m, "request", 1, n).unwrap());
    let mut same = h.approver();
    same.user_id = a.user_id;
    assert!(
        s.approve_resume(&same, &step(&same, n), "self", &request, n)
            .is_err()
    );
    let ap = h.approver();
    reference(
        &s.approve_resume(&ap, &step(&ap, n), "approve", &request, n)
            .unwrap(),
    );
    assert!(s.execute_resume(a, &m, "early", &request, n).is_err());
    h.observe(&s, n + Duration::seconds(1), true);
    let done = s
        .execute_resume(a, &m, "resume", &request, n + Duration::seconds(1))
        .unwrap();
    reference(&done);
    assert_eq!(h.guard.revision().unwrap(), 2);
    assert_eq!(
        s.execute_resume(a, &m, "resume", &request, n + Duration::seconds(1))
            .unwrap(),
        done
    );
    assert!(
        s.execute_resume(a, &m, "reuse", &request, n + Duration::seconds(1))
            .is_err()
    );
    assert_eq!(h.guard.revision().unwrap(), 2);
    println!("SERVICE_X06_SOD=INDEPENDENT_ACTOR_AND_USER RESUME_CAS=PASS APPROVAL_CONSUMPTIONS=1");
}
#[test]
fn service_x06_incident_ack_repair_independent_close_and_recurrence() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, false);
    let alert = s.alerts(a).unwrap().pop().unwrap();
    s.acknowledge_alert(a, &m, "ack-alert", &alert.id, alert.revision, n)
        .unwrap();
    let id = reference(&s.open_incident(a, &m, "incident", &alert.id, n).unwrap());
    let mut acknowledging = a.clone();
    acknowledging.actor_id = ActorId::new();
    acknowledging.user_id = uuid::Uuid::new_v4();
    s.acknowledge_incident(
        &acknowledging,
        &step(&acknowledging, n),
        "ack-case",
        &id,
        0,
        n,
    )
    .unwrap();
    let ap = h.approver();
    let ma = step(&ap, n);
    assert!(
        s.resolve_incident(&ap, &ma, "bad-close", &id, 1, n)
            .is_err()
    );
    h.observe(&s, n + Duration::seconds(1), true);
    let mut same_user = ap.clone();
    same_user.user_id = acknowledging.user_id;
    assert!(
        s.resolve_incident(
            &same_user,
            &step(&same_user, n),
            "ack-user-cannot-close",
            &id,
            1,
            n + Duration::seconds(1)
        )
        .is_err()
    );
    reference(
        &s.resolve_incident(&ap, &ma, "close", &id, 1, n + Duration::seconds(1))
            .unwrap(),
    );
    assert_eq!(s.incidents(a).unwrap()[0].status, CaseStatus::Resolved);
    h.observe(&s, n + Duration::seconds(2), false);
    assert_eq!(s.incidents(a).unwrap()[0].status, CaseStatus::Open);
    assert!(
        s.resolve_incident(&ap, &ma, "close-new", &id, 2, n + Duration::seconds(2))
            .is_err()
    );
    println!("SERVICE_X06_INCIDENT=ACK_FRESH_REPAIR_INDEPENDENT_CLOSE_REOPEN");
}
#[test]
fn service_x06_observer_authority_staleness_empty_health_and_redaction() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    assert!(s.health(a, n).is_err());
    let empty = build_health_report("service-x06", vec![], n);
    assert!(s.observe(&h.observer(), &empty, &[], n).is_err());
    let good = h.report(n, true);
    assert!(s.observe(a, &good, &[], n).is_err());
    let mut fake = h.observer();
    fake.actor_id = ActorId::new();
    assert!(s.observe(&fake, &good, &[], n).is_err());
    let first = s.observe(&h.observer(), &good, &[], n).unwrap();
    assert_eq!(
        first.revision,
        s.observe(&h.observer(), &good, &[], n).unwrap().revision
    );
    assert!(
        !serde_json::to_string(&s.health(a, n).unwrap())
            .unwrap()
            .contains("private synthetic secret")
    );
    assert!(s.health(a, n + Duration::seconds(31)).is_err());
    let mut stale = good.clone();
    stale.checked_at = n + Duration::seconds(31);
    assert!(
        s.observe(&h.observer(), &stale, &[], stale.checked_at)
            .is_err()
    );
    let invalid = AlertRecord {
        rule_id: "shell".into(),
        severity: AlertSeverity::Critical,
        summary: "synthetic secret".into(),
        observed_value: serde_json::json!({"api_key":"synthetic"}),
        threshold: serde_json::json!(1),
        triggered_at: n,
    };
    assert!(s.observe(&h.observer(), &good, &[invalid], n).is_err());
}
#[test]
fn service_x06_completed_checkpoint_rebuilds_ledger_and_dedupe_without_new_io() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let p = s.prepare_submit(a, &m, "stored", &c, n).unwrap();
    s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n).unwrap();
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    let restored = h.service();
    restored.restore(a, &m, &bytes, &anchor, n).unwrap();
    let snapshot = restored.risk_snapshot(a, n).unwrap();
    reference(
        &restored
            .dispatch_prepared(
                a,
                &m,
                &p.id,
                CurrentSources {
                    snapshot: &snapshot,
                    ..h.f.sources()
                },
                n,
            )
            .unwrap(),
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(
        restored
            .evidence_chain(a, &c.command_id.to_string(), n)
            .unwrap()
            .portfolio,
        s.evidence_chain(a, &c.command_id.to_string(), n)
            .unwrap()
            .portfolio
    );
    assert!(restored.restore(a, &m, &bytes, &anchor, n).is_err());
}
#[test]
fn service_x06_prepared_restore_is_quarantined_not_automatically_resubmitted() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let p = s.prepare_submit(a, &m, "prepared", &c, n).unwrap();
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    let restored = h.service();
    restored.restore(a, &m, &bytes, &anchor, n).unwrap();
    assert_eq!(
        restored.operation(a, &p.id).unwrap().outcome,
        Outcome::Uncertain
    );
    assert!(
        restored
            .dispatch_prepared(a, &m, &p.id, h.f.sources(), n)
            .is_err()
    );
    assert!(
        restored
            .prepare_submit(a, &m, "new-key-bypass", &c, n)
            .is_err()
    );
    assert!(restored.recover_order(a, &m, "recover", &p.id, n).is_err());
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
    println!("SERVICE_X06_RECOVERY=PREPARED_QUARANTINED AUTOMATIC_RETRY=ABSENT");
}
#[test]
fn service_x06_checkpoint_tamper_truncation_scope_and_backwards_clock_refuse() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    let mut changed = bytes.clone();
    changed.push(b' ');
    assert!(h.service().restore(a, &m, &changed, &anchor, n).is_err());
    assert!(
        h.service()
            .restore(a, &m, &bytes[..bytes.len() - 1], &anchor, n)
            .is_err()
    );
    assert!(
        h.service()
            .restore(a, &m, &bytes, &anchor, n - Duration::seconds(1))
            .is_err()
    );
    let other = Harness::new();
    assert!(
        other
            .service()
            .restore(
                &other.f.auth,
                &step(&other.f.auth, other.f.now),
                &bytes,
                &anchor,
                other.f.now
            )
            .is_err()
    );
    let mut viewer = a.clone();
    viewer.role = Role::Viewer;
    assert!(s.checkpoint(&viewer, &step(&viewer, n), n).is_err());
}
#[test]
fn service_x06_no_arbitrary_runbook_ledger_write_and_copy_queries_are_safe() {
    for body in [
        r#"{"runbook":"shell","command":"id"}"#,
        r#"{"runbook":"inspect_health","script":"ignored"}"#,
        r#"{"runbook":"adjust_balance","amount":100}"#,
    ] {
        assert!(serde_json::from_str::<Runbook>(body).is_err());
    }
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    reference(
        &s.runbook(a, &m, "inspect", Runbook::InspectHealth {}, n)
            .unwrap(),
    );
    let mut copy = s.risk_snapshot(a, n).unwrap();
    copy.portfolio.positions[0].quantity = 123456.0;
    assert_ne!(copy.portfolio, s.risk_snapshot(a, n).unwrap().portfolio);
    let page = s.audit(a, 0, 1, None).unwrap();
    assert!(page.total > 1);
    assert_eq!(page.rows.len(), 1);
    s.runbook(a, &m, "inspect-2", Runbook::InspectHealth {}, n)
        .unwrap();
    assert!(s.audit(a, 0, 1, page.head.as_ref()).is_err());
    assert!(s.audit(a, 0, 101, None).is_err());
}
#[test]
fn service_x06_capacity_refusal_has_no_partial_action() {
    let mut h = Harness::new();
    h.config.max_actions = 16;
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    for i in 0..7 {
        s.runbook(a, &m, &format!("run-{i}"), Runbook::InspectHealth {}, n)
            .unwrap();
    }
    let before = s.audit(a, 0, 100, None).unwrap().total;
    assert!(
        s.runbook(a, &m, "overflow", Runbook::InspectHealth {}, n)
            .is_err()
    );
    assert_eq!(before, s.audit(a, 0, 100, None).unwrap().total);
}
#[test]
fn service_x06_post_io_crash_recovers_authoritative_facts_without_resubmit() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    let c = h.command();
    let p = s.prepare_submit(a, &m, "crash-window", &c, n).unwrap();
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    h.gateway.submit(a, &c, h.f.sources(), n).unwrap();
    assert!(s.risk_snapshot(a, n).is_err());
    let restored = h.service();
    restored.restore(a, &m, &bytes, &anchor, n).unwrap();
    assert!(!restored.health(a, n).unwrap().ready);
    assert!(restored.risk_snapshot(a, n).is_err());
    reference(
        &restored
            .recover_order(a, &m, "recover-effect", &p.id, n)
            .unwrap(),
    );
    let evidence = restored
        .evidence_chain(a, &c.command_id.to_string(), n)
        .unwrap();
    assert!(evidence.portfolio_source_current);
    assert_eq!(evidence.fill_links.len(), 1);
    assert_eq!(
        restored.operation(a, &p.id).unwrap().outcome,
        Outcome::Applied {
            reference: reference(&restored.operation(a, &p.id).unwrap())
        }
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert!(restored.risk_snapshot(a, n).is_ok());
    assert!(
        restored
            .audit(a, 0, 100, None)
            .unwrap()
            .rows
            .iter()
            .any(|r| r.kind == "recover_original" && r.subject == p.id)
    );
    println!("SERVICE_X06_POST_IO_RECOVERY=ACTUAL_FACTS RESTORE_SOURCE_LAG=REFUSED NEW_SUBMITS=0");
}
struct UncertainKernel {
    calls: Arc<std::sync::atomic::AtomicUsize>,
}
impl ExecutionKernel for UncertainKernel {
    fn submit(&mut self, _: &BoundaryCommand) -> std::result::Result<(), String> {
        self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        Err("synthetic unknown transport outcome".into())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        vec![]
    }
}
#[test]
fn service_x06_uncertain_transport_cannot_be_retried_or_greenwashed() {
    let h = Harness::new();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let gateway = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        UncertainKernel {
            calls: calls.clone(),
        },
    )
    .unwrap();
    let s = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        gateway.clone(),
    )
    .unwrap();
    s.observe(&h.observer(), &h.report(n, true), &[], n)
        .unwrap();
    let p = s.prepare_submit(a, &m, "uncertain", &c, n).unwrap();
    assert_eq!(
        s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n)
            .unwrap()
            .outcome,
        Outcome::Uncertain
    );
    assert!(s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n).is_err());
    assert!(s.prepare_submit(a, &m, "bypass", &c, n).is_err());
    assert!(s.recover_order(a, &m, "unknown-recover", &p.id, n).is_err());
    assert!(
        !s.observe(
            &h.observer(),
            &h.report(n + Duration::seconds(1), true),
            &[],
            n + Duration::seconds(1)
        )
        .unwrap()
        .ready
    );
    assert!(
        s.alerts(a)
            .unwrap()
            .iter()
            .any(|a| a.rule == "execution_uncertain" && a.active)
    );
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    println!("SERVICE_X06_UNCERTAIN=QUARANTINED RETRY_CALLS=0 GREENWASH=REFUSED");
}
#[test]
fn service_x06_constructor_rejects_miswired_authority_scope_and_foreign_seed() {
    let h = Harness::new();
    assert!(
        OperationsService::new(
            h.config.clone(),
            h.seed.clone(),
            h.issuer.clone(),
            h.f.guard(),
            h.gateway.clone()
        )
        .is_err()
    );
    let other = h.f.issuer(&h.guard);
    assert!(
        OperationsService::new(
            h.config.clone(),
            h.seed.clone(),
            other,
            h.guard.clone(),
            h.gateway.clone()
        )
        .is_err()
    );
    let mut config = h.config.clone();
    config.scope.workspace_id = quantos_core::WorkspaceId::new();
    assert!(
        OperationsService::new(
            config,
            h.seed.clone(),
            h.issuer.clone(),
            h.guard.clone(),
            h.gateway.clone()
        )
        .is_err()
    );
    let mut seed = h.seed.clone();
    if let PortfolioEventKind::Fill(f) = &mut seed[1].kind {
        f.account_id = quantos_core::AccountId::new();
    }
    assert!(
        OperationsService::new(
            h.config.clone(),
            seed,
            h.issuer.clone(),
            h.guard.clone(),
            h.gateway.clone()
        )
        .is_err()
    );
    let mut config = h.config.clone();
    config.quote_unit = "invalid".into();
    assert!(
        OperationsService::new(
            config,
            h.seed.clone(),
            h.issuer.clone(),
            h.guard.clone(),
            h.gateway.clone()
        )
        .is_err()
    );
}
#[test]
fn service_x06_real_f09_alerts_keep_ack_until_repaired() {
    use quantos_observability::{AlertWindowState, CapacityAlertEvaluator, CapacitySnapshot};
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let alerts = CapacityAlertEvaluator.evaluate(
        &CapacitySnapshot {
            dead_letter_ratio: 0.1,
            ..Default::default()
        },
        n,
        &mut AlertWindowState::default(),
    );
    assert!(!alerts.is_empty());
    assert!(
        !s.observe(&h.observer(), &h.report(n, true), &alerts, n)
            .unwrap()
            .ready
    );
    let alert = s
        .alerts(a)
        .unwrap()
        .into_iter()
        .find(|a| a.rule == "dead_letter_ratio")
        .unwrap();
    s.acknowledge_alert(a, &m, "f09-ack", &alert.id, alert.revision, n)
        .unwrap();
    let revision = s
        .alerts(a)
        .unwrap()
        .into_iter()
        .find(|a| a.id == alert.id)
        .unwrap()
        .revision;
    s.observe(
        &h.observer(),
        &h.report(n + Duration::seconds(1), true),
        &alerts,
        n + Duration::seconds(1),
    )
    .unwrap();
    let row = s
        .alerts(a)
        .unwrap()
        .into_iter()
        .find(|a| a.id == alert.id)
        .unwrap();
    assert!(row.acknowledged);
    assert_eq!(row.revision, revision);
    h.observe(&s, n + Duration::seconds(2), true);
    let repaired = s
        .alerts(a)
        .unwrap()
        .into_iter()
        .find(|a| a.id == alert.id)
        .unwrap();
    assert!(!repaired.active);
    assert!(repaired.revision > revision);
}
#[test]
fn service_x06_cancel_reduces_risk_after_expiry_kill_and_rechecks_ownership() {
    let h = Harness::new();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let gateway = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        PaperKernel::resting("100"),
    )
    .unwrap();
    let s = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        gateway.clone(),
    )
    .unwrap();
    let p = s.prepare_submit(a, &m, "resting", &c, n).unwrap();
    s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n).unwrap();
    let mut wrong = a.clone();
    wrong.actor_id = ActorId::new();
    let before = s.audit(a, 0, 100, None).unwrap().total;
    assert!(
        s.cancel(
            &wrong,
            &step(&wrong, n),
            "foreign",
            &c.command_id.to_string(),
            n
        )
        .is_err()
    );
    assert_eq!(s.audit(a, 0, 100, None).unwrap().total, before);
    s.engage_kill(a, &m, "kill-before-cancel", 0, "synthetic emergency", n)
        .unwrap();
    let later = c.expires_at + Duration::seconds(1);
    let done = s
        .cancel(a, &m, "cancel", &c.command_id.to_string(), later)
        .unwrap();
    reference(&done);
    assert_eq!(
        s.cancel(a, &m, "cancel", &c.command_id.to_string(), later)
            .unwrap(),
        done
    );
    assert_eq!(gateway.downstream_cancel_count(), Some(1));
    let raw = s
        .evidence_chain(a, &c.command_id.to_string(), later)
        .unwrap();
    assert_eq!(raw.order_status, "expired");
    assert!(raw.fills.is_empty());
}
#[test]
fn service_x06_resume_revision_expiry_and_operator_restrictions_preserve_kill() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    h.observe(&s, n, true);
    s.engage_kill(a, &m, "kill", 0, "synthetic", n).unwrap();
    let req = reference(&s.request_resume(a, &m, "request", 1, n).unwrap());
    let ap = h.approver();
    s.approve_resume(&ap, &step(&ap, n), "approve", &req, n)
        .unwrap();
    h.observe(&s, n + Duration::seconds(1), true);
    let mut promoted = ap.clone();
    promoted.role = Role::Owner;
    assert!(
        s.execute_resume(
            &promoted,
            &step(&promoted, n),
            "self-execute",
            &req,
            n + Duration::seconds(1)
        )
        .is_err()
    );
    let mut operator = a.clone();
    operator.role = Role::Operator;
    assert!(
        s.execute_resume(
            &operator,
            &step(&operator, n),
            "operator",
            &req,
            n + Duration::seconds(1)
        )
        .is_err()
    );
    assert!(
        s.checkpoint(&operator, &step(&operator, n), n + Duration::seconds(1))
            .is_err()
    );
    h.guard
        .set_kill_switch(
            a,
            KillScope::Account(h.config.scope.account_id),
            true,
            1,
            "newer revision",
            n + Duration::seconds(1),
        )
        .unwrap();
    let before = s.audit(a, 0, 100, None).unwrap().total;
    assert!(
        s.execute_resume(a, &m, "stale-cas", &req, n + Duration::seconds(1))
            .is_err()
    );
    assert_eq!(s.audit(a, 0, 100, None).unwrap().total, before);
    assert_eq!(h.guard.revision().unwrap(), 2);
}
#[test]
fn service_x06_stale_anchor_and_fresh_execution_lease_cannot_rebind_checkpoint() {
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let op = s.prepare_submit(a, &m, "anchor", &c, n).unwrap();
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    let before = h.gateway.fact_anchor().unwrap();
    h.gateway.submit(a, &c, h.f.sources(), n).unwrap();
    assert!(
        h.gateway
            .submit_at_anchor(a, &c, h.f.sources(), &before, n)
            .is_err()
    );
    assert!(
        h.gateway
            .validate_current_at_anchor(a, &c, h.f.sources(), &before, n)
            .is_err()
    );
    assert!(
        s.dispatch_prepared(a, &m, &op.id, h.f.sources(), n)
            .is_err()
    );
    let other = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        PaperKernel::new("100"),
    )
    .unwrap();
    let restored = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        other,
    )
    .unwrap();
    assert!(restored.restore(a, &m, &bytes, &anchor, n).is_err());
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
}
#[test]
fn service_x06_consumed_x03_approval_is_visible_without_signature_material() {
    let mut h = Harness::new();
    h.f.policy.limits.approval_notional_threshold = 500.0;
    let guard = h.f.guard();
    let issuer = h.f.issuer(&guard);
    let proposal = h.f.register(&issuer);
    let approval = issuer
        .request_approval(
            &h.f.auth,
            &proposal,
            h.f.now,
            h.f.now + Duration::seconds(20),
        )
        .unwrap();
    let approver = h.approver();
    issuer
        .transition_approval(&approver, approval.id, 0, ApprovalState::Approved, h.f.now)
        .unwrap();
    let token = issuer
        .approval_token(&h.f.auth, approval.id, h.f.now)
        .unwrap();
    let decision = guard
        .evaluate(
            &h.f.auth,
            Phase::Pre,
            &h.f.intent,
            &h.f.input,
            &h.f.financials,
            &h.f.venue,
            &h.f.release,
            Some(&token),
            h.f.now,
        )
        .unwrap();
    let command = issuer
        .issue(
            &h.f.auth,
            &proposal,
            &decision,
            Some(approval.id),
            h.f.sources(),
            h.f.now,
        )
        .unwrap();
    let gateway = SignedExecutionGateway::new(
        issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        PaperKernel::new("100"),
    )
    .unwrap();
    let s =
        OperationsService::new(h.config.clone(), h.seed.clone(), issuer, guard, gateway).unwrap();
    let m = step(&h.f.auth, h.f.now);
    let p = s
        .prepare_submit(&h.f.auth, &m, "approval", &command, h.f.now)
        .unwrap();
    s.dispatch_prepared(&h.f.auth, &m, &p.id, h.f.sources(), h.f.now)
        .unwrap();
    let e = s
        .evidence_chain(&h.f.auth, &command.command_id.to_string(), h.f.now)
        .unwrap();
    assert_eq!(e.approval.unwrap().state, ApprovalState::Consumed);
    let out = s
        .runbook(
            &h.f.auth,
            &m,
            "evidence-runbook",
            Runbook::InspectEvidence {
                command_id: command.command_id.to_string(),
            },
            h.f.now,
        )
        .unwrap();
    reference(&out);
}

#[test]
fn service_x06_shadow_service_cannot_submit_even_with_valid_paper_authority() {
    let h = Harness::new();
    let mut config = h.config.clone();
    config.scope.mode = quantos_policy::RunMode::Shadow;
    let service = OperationsService::new(
        config,
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        h.gateway.clone(),
    )
    .unwrap();
    let mut auth = h.f.auth.clone();
    auth.mode = quantos_policy::RunMode::Shadow;
    let command = h.command();
    assert_eq!(
        service.prepare_submit(&auth, &step(&auth, h.f.now), "shadow", &command, h.f.now),
        Err(Error::Denied)
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
    assert_eq!(service.audit(&auth, 0, 100, None).unwrap().total, 0);
    service.risk_snapshot(&auth, h.f.now).unwrap();
}

struct DeferredCancelKernel {
    inner: PaperKernel,
    defer: Arc<std::sync::atomic::AtomicBool>,
}
impl ExecutionKernel for DeferredCancelKernel {
    fn submit(&mut self, c: &BoundaryCommand) -> std::result::Result<(), String> {
        self.inner.submit(c)
    }
    fn submit_at(
        &mut self,
        c: &BoundaryCommand,
        now: chrono::DateTime<Utc>,
    ) -> std::result::Result<(), String> {
        self.inner.submit_at(c, now)
    }
    fn cancel(
        &mut self,
        c: &quantos_execution::oms::BoundaryCancel,
    ) -> std::result::Result<(), String> {
        self.inner.cancel(c)?;
        Err("synthetic lost response; events remain pending".into())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        if self.defer.load(std::sync::atomic::Ordering::SeqCst) {
            vec![]
        } else {
            self.inner.drain_events()
        }
    }
}
#[test]
fn service_x06_uncertain_cancel_requires_late_terminal_receipt_without_retry() {
    let h = Harness::new();
    let (a, n) = (&h.f.auth, h.f.now);
    let m = step(a, n);
    let c = h.command();
    let defer = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let gateway = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        DeferredCancelKernel {
            inner: PaperKernel::resting("100"),
            defer: defer.clone(),
        },
    )
    .unwrap();
    let s = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        gateway.clone(),
    )
    .unwrap();
    let prepared = s.prepare_submit(a, &m, "deferred-submit", &c, n).unwrap();
    s.dispatch_prepared(a, &m, &prepared.id, h.f.sources(), n)
        .unwrap();
    defer.store(true, std::sync::atomic::Ordering::SeqCst);
    let cancelled = s
        .cancel(a, &m, "lost-cancel", &c.command_id.to_string(), n)
        .unwrap();
    assert_eq!(cancelled.outcome, Outcome::Uncertain);
    assert_eq!(
        s.cancel(a, &m, "lost-cancel", &c.command_id.to_string(), n)
            .unwrap(),
        cancelled
    );
    assert!(
        s.cancel(a, &m, "new-key", &c.command_id.to_string(), n)
            .is_err()
    );
    assert!(
        s.recover_order(a, &m, "too-early", &cancelled.id, n)
            .is_err()
    );
    let alert = s
        .alerts(a)
        .unwrap()
        .into_iter()
        .find(|r| r.rule == "execution_uncertain")
        .unwrap();
    s.acknowledge_alert(a, &m, "ack-unknown", &alert.id, alert.revision, n)
        .unwrap();
    let incident = reference(
        &s.open_incident(a, &m, "unknown-case", &alert.id, n)
            .unwrap(),
    );
    s.acknowledge_incident(a, &m, "ack-unknown-case", &incident, 0, n)
        .unwrap();
    defer.store(false, std::sync::atomic::Ordering::SeqCst);
    let recovered = s
        .recover_order(a, &m, "proven-cancel", &cancelled.id, n)
        .unwrap();
    reference(&recovered);
    reference(&s.operation(a, &cancelled.id).unwrap());
    assert_eq!(
        s.recover_order(a, &m, "proven-cancel", &cancelled.id, n)
            .unwrap(),
        recovered
    );
    assert_eq!(
        s.evidence_chain(a, &c.command_id.to_string(), n)
            .unwrap()
            .order_status,
        "cancelled"
    );
    assert!(s.risk_snapshot(a, n).is_ok());
    assert!(
        !s.alerts(a)
            .unwrap()
            .iter()
            .any(|r| r.rule == "execution_uncertain" && r.active)
    );
    assert_eq!(gateway.downstream_submission_count(), Some(1));
    assert_eq!(gateway.downstream_cancel_count(), Some(1));
    let later = n + Duration::seconds(1);
    s.observe(&h.observer(), &h.report(later, true), &[], later)
        .unwrap();
    let approver = h.approver();
    s.resolve_incident(
        &approver,
        &step(&approver, later),
        "closed-unknown",
        &incident,
        1,
        later,
    )
    .unwrap();
    assert_eq!(s.incidents(a).unwrap()[0].status, CaseStatus::Resolved);
    assert_eq!(
        s.cancel(a, &m, "second-unknown", &c.command_id.to_string(), later)
            .unwrap()
            .outcome,
        Outcome::Uncertain
    );
    assert_eq!(s.incidents(a).unwrap()[0].status, CaseStatus::Open);
    assert_eq!(gateway.downstream_submission_count(), Some(1));
    assert_eq!(gateway.downstream_cancel_count(), Some(2));
    println!(
        "SERVICE_X06_CANCEL_RECOVERY=TERMINAL_FACTS SUBMITS=1 INITIAL_CANCELS=1 RECOVERY_SUBMIT_CANCEL_IO=0 RECURRENCE_CANCELS=2"
    );
}

#[test]
fn service_x06_late_fill_recovers_uncertain_submit_without_second_submission() {
    let h = Harness::new();
    let (a, n) = (&h.f.auth, h.f.now);
    let m = step(a, n);
    let c = h.command();
    let defer = Arc::new(std::sync::atomic::AtomicBool::new(true));
    let gateway = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        DeferredCancelKernel {
            inner: PaperKernel::new("100"),
            defer: defer.clone(),
        },
    )
    .unwrap();
    let s = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        gateway.clone(),
    )
    .unwrap();
    let prepared = s.prepare_submit(a, &m, "late-fill", &c, n).unwrap();
    assert_eq!(
        s.dispatch_prepared(a, &m, &prepared.id, h.f.sources(), n)
            .unwrap()
            .outcome,
        Outcome::Uncertain
    );
    assert!(s.risk_snapshot(a, n).is_err());
    let mut other = a.clone();
    other.actor_id = ActorId::new();
    defer.store(false, std::sync::atomic::Ordering::SeqCst);
    assert!(gateway.refresh_order(&other, &c, n).is_err());
    let recovered = s
        .recover_order(a, &m, "actual-late-fill", &prepared.id, n)
        .unwrap();
    reference(&recovered);
    let chain = s.evidence_chain(a, &c.command_id.to_string(), n).unwrap();
    assert_eq!(chain.order_status, "filled");
    assert_eq!(chain.fills.len(), 1);
    assert_eq!(chain.fill_links.len(), 1);
    assert!(chain.portfolio_source_current);
    assert_eq!(
        s.recover_order(a, &m, "actual-late-fill", &prepared.id, n)
            .unwrap(),
        recovered
    );
    assert_eq!(gateway.downstream_submission_count(), Some(1));
    assert_eq!(gateway.downstream_cancel_count(), Some(0));
    println!(
        "SERVICE_X06_LATE_FILL=AUTHORITATIVE UNIQUE_FILL=1 SUBMITS=1 RECOVERY_SUBMIT_CANCEL_IO=0"
    );
}
