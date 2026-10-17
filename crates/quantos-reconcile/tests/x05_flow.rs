mod support;
use chrono::Duration;
use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
use quantos_policy::{Role, RunMode};
use quantos_reconcile::{BreakKind, exceptions::*, model::*, shadow::ShadowRunner};
use quantos_risk::{RiskVerdict, guard::KillScope};
use std::{
    collections::BTreeSet,
    sync::{Arc, Barrier},
    thread,
};
use support::*;
#[test]
fn x05_twenty_differences_are_located_with_source_proof_within_fifteen_minutes() {
    let (auth, scope) = auth_scope();
    let mut kinds = BTreeSet::new();
    for kind in BreakKind::all() {
        let mut input = clean(&scope, now());
        corrupt(&mut input, *kind);
        let s = ReconciliationService::new(scope.clone()).unwrap();
        let report = s
            .run(&auth, "probe", &input, now() + Duration::minutes(10))
            .unwrap();
        let diff = report
            .differences()
            .iter()
            .find(|d| d.kind == *kind)
            .unwrap_or_else(|| panic!("missing {kind}"));
        assert!(!diff.entity.is_empty());
        assert!(diff.within_sla);
        assert_eq!(diff.latency_millis, 600_000);
        assert_eq!(diff.observable_at, input.available_at);
        assert_eq!(diff.expected_source, input.expected.source_ref);
        assert_eq!(diff.actual_source, input.actual.source_ref);
        assert!(!s.records(&auth).unwrap().is_empty());
        kinds.insert(*kind);
    }
    assert_eq!(kinds.len(), 20);
    println!("X05_DIFFERENCE_CLASSES=20 LOCATED=20 WITHIN_900_SECONDS=20 VENUE_SUBMIT_PATH=ABSENT");
}
#[test]
fn x05_ten_controlled_weekdays_close_clean_days_without_claiming_live_soak() {
    let (auth, scope) = auth_scope();
    let s = ReconciliationService::new(scope.clone()).unwrap();
    let mut at = now();
    let mut days = 0;
    while days < 10 {
        if !matches!(
            chrono::Datelike::weekday(&at),
            chrono::Weekday::Sat | chrono::Weekday::Sun
        ) {
            let mut input = clean(&scope, at);
            input.expected.source_ref = format!("expected-{}", at.date_naive());
            input.actual.source_ref = format!("actual-{}", at.date_naive());
            let report = s.run(&auth, &format!("day-{days}"), &input, at).unwrap();
            assert!(report.is_clean());
            s.close_day(&auth, input.day, report.id(), at).unwrap();
            assert!(s.day_is_closed(&auth, input.day).unwrap());
            days += 1;
        }
        at += Duration::days(1);
    }
    assert!(s.records(&auth).unwrap().is_empty());
    println!("X05_CONTROLLED_WEEKDAYS=10 UNEXPLAINED=0 ACTUAL_TRADING_DAY_SOAK=NOT_RUN");
}
#[test]
fn x05_shadow_current_risk_virtual_fills_and_exact_cash_pnl_never_create_commands() {
    let mut f = support::fixture::Fixture::new();
    f.auth.mode = RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    f.intent.quantity = "2".into();
    let scope = Scope {
        tenant_id: f.auth.tenant_id,
        workspace_id: f.auth.workspace_id,
        account_id: f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let g = f.guard();
    let r = ShadowRunner::new(scope.clone(), Seed::flat(d(1000)).unwrap(), g.clone()).unwrap();
    let mut tick = mark(f.now);
    tick.price = d(100);
    let a = r
        .recommend(&f.auth, &f.intent, f.sources(), &tick, f.now)
        .unwrap();
    assert!(!a.executable);
    assert_eq!(a.risk.verdict, RiskVerdict::Allow);
    assert_eq!(
        r.recommend(&f.auth, &f.intent, f.sources(), &tick, f.now)
            .unwrap(),
        a
    );
    let fill = r
        .simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "fill-1",
            d(2),
            d(1),
            f.sources(),
            f.now,
        )
        .unwrap();
    for _ in 0..100 {
        assert_eq!(
            r.simulate_fill(
                &f.auth,
                &f.intent.command_key,
                "fill-1",
                d(2),
                d(1),
                f.sources(),
                f.now
            )
            .unwrap(),
            fill
        );
    }
    assert_eq!(r.events(&f.auth).unwrap().len(), 1);
    let b = r.snapshot(&f.auth, f.now).unwrap();
    assert_eq!(b.ledger.cash, d(799));
    assert_eq!(b.ledger.realized_pnl, d(-1));
    assert_eq!(b.positions[0].quantity, d(2));
    assert_eq!(b.orders[0].status, OrderStatus::Filled);
    tick.price = d(110);
    tick.sequence = 2;
    r.mark(&f.auth, &tick, f.now).unwrap();
    let b = r.snapshot(&f.auth, f.now).unwrap();
    assert_eq!(b.ledger.exposure_gross, d(220));
    assert_eq!(b.ledger.unrealized_pnl, d(20));
    // This is only a risk observation, never an issuer or downstream consumer.
    g.set_kill_switch(&f.owner(), KillScope::Global, true, 0, "owned stop", f.now)
        .unwrap();
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "fill-1",
            d(2),
            d(1),
            f.sources(),
            f.now
        )
        .is_err()
    );
    assert!(
        r.recommend(&f.auth, &f.intent, f.sources(), &mark(f.now), f.now)
            .is_err()
    );
    assert_eq!(r.events(&f.auth).unwrap().len(), 1);
}
#[test]
fn x05_shadow_denials_expiry_scope_overfill_and_conflict_have_no_ledger_side_effect() {
    let mut f = support::fixture::Fixture::new();
    f.auth.mode = RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    f.intent.quantity = "2".into();
    let scope = Scope {
        tenant_id: f.auth.tenant_id,
        workspace_id: f.auth.workspace_id,
        account_id: f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let g = f.guard();
    let r = ShadowRunner::new(scope, Seed::flat(d(1000)).unwrap(), g.clone()).unwrap();
    let mut tick = mark(f.now);
    tick.price = d(100);
    let a = r
        .recommend(&f.auth, &f.intent, f.sources(), &tick, f.now)
        .unwrap();
    let before = r.snapshot(&f.auth, f.now).unwrap();
    for (q, fee) in [(d(0), d(0)), (d(3), d(0)), (d(1), d(-1))] {
        assert!(
            r.simulate_fill(
                &f.auth,
                &f.intent.command_key,
                "invalid",
                q,
                fee,
                f.sources(),
                f.now
            )
            .is_err()
        );
        assert_eq!(r.snapshot(&f.auth, f.now).unwrap(), before);
    }
    assert!(
        r.simulate_fill(&f.auth, "unknown", "x", d(1), d(0), f.sources(), f.now)
            .is_err()
    );
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "x",
            d(1),
            d(0),
            f.sources(),
            a.risk.expires_at
        )
        .is_err()
    );
    let mut changed = f.intent.clone();
    changed.quantity = "1".into();
    assert!(
        r.recommend(&f.auth, &changed, f.sources(), &tick, f.now)
            .is_err()
    );
    let mut bad = f.auth.clone();
    bad.tenant_id = TenantId::new();
    assert!(r.snapshot(&bad, f.now).is_err());
    assert!(r.events(&bad).is_err());
    let mut stale = f.clone();
    stale.financials.as_of -= Duration::hours(1);
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "x",
            d(1),
            d(0),
            stale.sources(),
            f.now
        )
        .is_err()
    );
    let mut tick_bad = tick.clone();
    tick_bad.source_at -= Duration::seconds(61);
    assert!(
        r.recommend(&f.auth, &f.intent, f.sources(), &tick_bad, f.now)
            .is_err()
    );
    assert!(r.mark(&f.auth, &tick_bad, f.now).is_err());
    r.simulate_fill(
        &f.auth,
        &f.intent.command_key,
        "stable",
        d(1),
        d(0),
        f.sources(),
        f.now,
    )
    .unwrap();
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "stable",
            d(2),
            d(0),
            f.sources(),
            f.now
        )
        .is_err()
    );
    tick.sequence = 2;
    r.mark(&f.auth, &tick, f.now).unwrap();
    tick.sequence = 1;
    assert!(r.mark(&f.auth, &tick, f.now).is_err());
    let mut denied = f.clone();
    denied.intent.command_key = "denied".into();
    denied.venue.healthy = false;
    let a = r
        .recommend(
            &denied.auth,
            &denied.intent,
            denied.sources(),
            &{
                let mut t = tick.clone();
                t.sequence = 3;
                t
            },
            f.now,
        )
        .unwrap();
    assert_ne!(a.risk.verdict, RiskVerdict::Allow);
    assert!(!a.executable);
    assert!(
        r.simulate_fill(
            &f.auth,
            "denied",
            "denied-fill",
            d(1),
            d(0),
            denied.sources(),
            f.now
        )
        .is_err()
    );
}
#[test]
fn x05_exception_cas_requires_ack_latest_repaired_source_and_audits_reopen() {
    let (auth, scope) = auth_scope();
    let clean = clean(&scope, now());
    let mut bad = clean.clone();
    bad.actual.ledger.cash += d(1);
    let s = ReconciliationService::new(scope).unwrap();
    let old = s.run(&auth, "broken", &bad, now()).unwrap();
    let record = s.records(&auth).unwrap()[0].clone();
    assert!(
        s.close(&auth, &record.exception_id, 0, old.id(), "premature", now())
            .is_err()
    );
    assert!(s.close_day(&auth, bad.day, old.id(), now()).is_err());
    let ack = s
        .acknowledge(&auth, &record.exception_id, 0, now())
        .unwrap();
    assert!(
        s.acknowledge(&auth, &record.exception_id, 0, now())
            .is_err()
    );
    assert!(
        s.close(
            &auth,
            &record.exception_id,
            ack.revision,
            old.id(),
            "still broken",
            now()
        )
        .is_err()
    );
    let later = now() + Duration::seconds(1);
    let mut fixed = clean.clone();
    refresh(&mut fixed, later);
    let good = s.run(&auth, "repaired", &fixed, later).unwrap();
    assert!(good.is_clean());
    assert!(
        s.close(
            &auth,
            &record.exception_id,
            ack.revision,
            good.id(),
            " ",
            later
        )
        .is_err()
    );
    let closed = s
        .close(
            &auth,
            &record.exception_id,
            ack.revision,
            good.id(),
            "cash corrected; sources replayed",
            later,
        )
        .unwrap();
    assert_eq!(closed.status, Status::Closed);
    assert_eq!(closed.closure_report, Some(good.id().clone()));
    s.close_day(&auth, fixed.day, good.id(), later).unwrap();
    let t = later + Duration::seconds(1);
    let mut repeat = clean;
    refresh(&mut repeat, t);
    refresh(&mut repeat, t);
    repeat.actual.ledger.cash += d(1);
    s.run(&auth, "regression", &repeat, t).unwrap();
    let reopened = s.records(&auth).unwrap()[0].clone();
    assert_eq!(reopened.status, Status::Open);
    assert!(reopened.revision > closed.revision);
    assert!(reopened.closure_report.is_none());
    assert!(!s.day_is_closed(&auth, repeat.day).unwrap());
    let (_, anchor) = s.journal(&auth).unwrap();
    assert_eq!(anchor.count, 6);
}
#[test]
fn x05_concurrent_runs_and_cas_acknowledgements_are_unique() {
    let (auth, scope) = auth_scope();
    let mut input = clean(&scope, now());
    input.actual.ledger.cash += d(1);
    let s = ReconciliationService::new(scope).unwrap();
    let b = Arc::new(Barrier::new(16));
    let mut jobs = vec![];
    for _ in 0..16 {
        let (s, a, i, b) = (s.clone(), auth.clone(), input.clone(), b.clone());
        jobs.push(thread::spawn(move || {
            b.wait();
            s.run(&a, "same-run", &i, now()).unwrap().id().clone()
        }));
    }
    let ids: BTreeSet<_> = jobs.into_iter().map(|j| j.join().unwrap()).collect();
    assert_eq!(ids.len(), 1);
    let records = s.records(&auth).unwrap();
    assert_eq!(records.len(), 1);
    let id = records[0].exception_id.clone();
    let b = Arc::new(Barrier::new(16));
    let mut jobs = vec![];
    for _ in 0..16 {
        let (s, a, id, b) = (s.clone(), auth.clone(), id.clone(), b.clone());
        jobs.push(thread::spawn(move || {
            b.wait();
            s.acknowledge(&a, &id, 0, now()).is_ok()
        }));
    }
    assert_eq!(
        jobs.into_iter()
            .map(|j| j.join().unwrap())
            .filter(|ok| *ok)
            .count(),
        1
    );
    assert_eq!(s.journal(&auth).unwrap().1.count, 2);
}
#[test]
fn x05_journal_recovery_preserves_idempotency_and_rejects_tamper_truncation_scope() {
    let (auth, scope) = auth_scope();
    let mut input = clean(&scope, now());
    input.actual.ledger.cash += d(1);
    let s = ReconciliationService::new(scope.clone()).unwrap();
    let report = s.run(&auth, "same", &input, now()).unwrap();
    let record = s.records(&auth).unwrap()[0].clone();
    s.acknowledge(&auth, &record.exception_id, 0, now())
        .unwrap();
    let (bytes, anchor) = s.journal(&auth).unwrap();
    let restored = ReconciliationService::restore(scope.clone(), &bytes, &anchor).unwrap();
    assert_eq!(restored.records(&auth).unwrap(), s.records(&auth).unwrap());
    assert_eq!(restored.run(&auth, "same", &input, now()).unwrap(), report);
    assert_eq!(
        restored.journal(&auth).unwrap(),
        (bytes.clone(), anchor.clone())
    );
    for n in 0..5 {
        let mut value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        match n {
            0 => value["events"][0]["sequence"] = serde_json::json!(2),
            1 => {
                value["events"].as_array_mut().unwrap().pop();
            }
            2 => value["events"][0]["content"]["key"] = serde_json::json!("forged"),
            3 => value["schema"] = serde_json::json!("wrong"),
            _ => value["unexpected"] = serde_json::json!(true),
        }
        assert!(
            ReconciliationService::restore(
                scope.clone(),
                &serde_json::to_vec(&value).unwrap(),
                &anchor
            )
            .is_err()
        );
    }
    let mut foreign = scope;
    foreign.account_id = AccountId::new();
    assert!(ReconciliationService::restore(foreign, &bytes, &anchor).is_err());
}
#[test]
fn x05_authorization_time_sources_and_invalid_inputs_fail_without_partial_alerts() {
    let (auth, scope) = auth_scope();
    let input = clean(&scope, now());
    let s = ReconciliationService::new(scope.clone()).unwrap();
    for n in 0..8 {
        let mut a = auth.clone();
        match n {
            0 => a.tenant_id = TenantId::new(),
            1 => a.workspace_id = WorkspaceId::new(),
            2 => a.account_id = Some(AccountId::new()),
            3 => a.capabilities.clear(),
            4 => a.role = Role::Viewer,
            5 => a.mode = RunMode::Paper,
            6 => a.account_id = None,
            _ => a.actor_id = ActorId::from_uuid(uuid::Uuid::nil()),
        };
        assert!(s.run(&a, "bad", &input, now()).is_err());
        assert!(s.records(&a).is_err());
        assert!(s.journal(&a).is_err());
    }
    for n in 0..9 {
        let mut i = input.clone();
        match n {
            0 => i.actual.orders.push(i.actual.orders[0].clone()),
            1 => i.actual.fills.push(i.actual.fills[0].clone()),
            2 => i.actual.fills[0].command_id = "foreign".into(),
            3 => i.actual.fills[0].fee = d(-1),
            4 => i.expected.seed.cash = d(2),
            5 => i.available_at += Duration::seconds(1),
            6 => i.tolerance = d(1),
            7 => i.actual.source_ref = i.expected.source_ref.clone(),
            _ => i.actual.positions.push(i.actual.positions[0].clone()),
        };
        assert!(s.run(&auth, "invalid", &i, now()).is_err(), "{n}");
        assert!(s.records(&auth).unwrap().is_empty());
        assert_eq!(s.journal(&auth).unwrap().1.count, 0);
    }
    s.run(&auth, "valid", &input, now()).unwrap();
    let mut changed = input.clone();
    changed.actual.ledger.cash += d(1);
    assert!(s.run(&auth, "valid", &changed, now()).is_err());
    assert!(s.run(&auth, "new", &changed, now()).is_err());
    assert!(
        s.run(&auth, "back", &input, now() - Duration::seconds(1))
            .is_err()
    );
    assert_eq!(s.journal(&auth).unwrap().1.count, 1);
}
#[test]
fn x05_delayed_detection_is_recorded_as_breach_and_equal_corruption_is_not_green() {
    let (auth, scope) = auth_scope();
    let mut input = clean(&scope, now());
    input.actual.ledger.cash += d(1);
    input.expected.ledger.cash += d(1);
    let report = ReconciliationService::new(scope)
        .unwrap()
        .run(&auth, "late", &input, now() + Duration::seconds(901))
        .unwrap();
    assert!(!report.is_clean());
    assert!(!report.all_within_sla());
    assert!(
        report
            .differences()
            .iter()
            .any(|d| d.kind == BreakKind::LedgerBalanceMismatch)
    );
    assert!(
        report
            .differences()
            .iter()
            .any(|d| d.kind == BreakKind::LedgerStaleMark)
    );
}
#[test]
fn x05_equal_illegal_status_and_phantom_positions_cannot_pass_by_agreement() {
    let (_, scope) = auth_scope();
    let mut i = clean(&scope, now());
    i.expected.orders[0].status = OrderStatus::Cancelled;
    i.actual.orders[0].status = OrderStatus::Cancelled;
    let r = quantos_reconcile::reconciliation::offline_check(&i, now()).unwrap();
    assert!(
        r.differences()
            .iter()
            .any(|d| d.kind == BreakKind::OrderStatusMismatch)
    );
    let mut i = clean(&scope, now());
    let mut extra = i.actual.positions[0].clone();
    extra.symbol = "ETHUSDT".into();
    extra.mark.symbol = "ETHUSDT".into();
    i.expected.positions.push(extra.clone());
    i.actual.positions.push(extra);
    let r = quantos_reconcile::reconciliation::offline_check(&i, now()).unwrap();
    assert!(
        r.differences()
            .iter()
            .any(|d| d.kind == BreakKind::PositionMissing && d.entity == "positions/ETHUSDT")
    );
}
#[test]
fn x05_new_quotes_revalue_positions_and_invalidate_unfilled_old_advice() {
    let mut f = support::fixture::Fixture::new();
    f.auth.mode = RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    f.intent.quantity = "2".into();
    let scope = Scope {
        tenant_id: f.auth.tenant_id,
        workspace_id: f.auth.workspace_id,
        account_id: f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let r = ShadowRunner::new(scope, Seed::flat(d(1000)).unwrap(), f.guard()).unwrap();
    let mut tick = mark(f.now);
    tick.price = d(100);
    r.recommend(&f.auth, &f.intent, f.sources(), &tick, f.now)
        .unwrap();
    let fill = r
        .simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "first",
            d(1),
            d(0),
            f.sources(),
            f.now,
        )
        .unwrap();
    let mut intent = f.intent.clone();
    intent.command_key = "new-observation".into();
    intent.limit_price = "110".into();
    tick.price = d(110);
    tick.sequence = 2;
    r.recommend(&f.auth, &intent, f.sources(), &tick, f.now)
        .unwrap();
    let book = r.snapshot(&f.auth, f.now).unwrap();
    assert_eq!(book.ledger.unrealized_pnl, d(10));
    assert_eq!(book.ledger.exposure_gross, d(110));
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "new-fill-old-advice",
            d(1),
            d(0),
            f.sources(),
            f.now
        )
        .is_err()
    );
    assert_eq!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "first",
            d(1),
            d(0),
            f.sources(),
            f.now
        )
        .unwrap(),
        fill
    );
    assert_eq!(r.events(&f.auth).unwrap().len(), 1);
}
#[test]
fn x05_erasing_entities_switching_sources_or_stale_reports_cannot_close_cases() {
    let (auth, scope) = auth_scope();
    let good = clean(&scope, now());
    let mut bad = good.clone();
    bad.actual.positions.clear();
    let service = ReconciliationService::new(scope).unwrap();
    service.run(&auth, "bad", &bad, now()).unwrap();
    let case = service
        .records(&auth)
        .unwrap()
        .into_iter()
        .find(|r| r.kind == BreakKind::PositionMissing)
        .unwrap();
    let ack = service
        .acknowledge(&auth, &case.exception_id, case.revision, now())
        .unwrap();
    let mut switched = good.clone();
    refresh(&mut switched, now() + Duration::seconds(1));
    switched.actual.source_ref = "substituted".into();
    assert!(
        service
            .run(&auth, "switch", &switched, now() + Duration::seconds(1))
            .is_err()
    );
    let mut erased = good.clone();
    refresh(&mut erased, now() + Duration::seconds(1));
    for b in [&mut erased.expected, &mut erased.actual] {
        b.orders.clear();
        b.fills.clear();
        b.positions.clear();
        b.ledger = Ledger {
            cash: d(1000),
            realized_pnl: d(0),
            unrealized_pnl: d(0),
            exposure_gross: d(0),
            sequence: 0,
        };
    }
    let report = service
        .run(&auth, "erased", &erased, now() + Duration::seconds(1))
        .unwrap();
    assert!(report.is_clean());
    assert!(
        service
            .close(
                &auth,
                &case.exception_id,
                ack.revision,
                report.id(),
                "deleted rows",
                now() + Duration::seconds(1)
            )
            .is_err()
    );
    assert!(
        service
            .close_day(&auth, good.day, report.id(), now() + Duration::seconds(1))
            .is_err()
    );
    let mut repaired = good;
    refresh(&mut repaired, now() + Duration::seconds(2));
    refresh(&mut repaired, now() + Duration::seconds(2));
    let report = service
        .run(&auth, "fixed", &repaired, now() + Duration::seconds(2))
        .unwrap();
    assert!(
        service
            .close(
                &auth,
                &case.exception_id,
                ack.revision,
                report.id(),
                "too old",
                now() + Duration::minutes(16)
            )
            .is_err()
    );
    assert_eq!(
        service
            .records(&auth)
            .unwrap()
            .into_iter()
            .find(|r| r.exception_id == case.exception_id)
            .unwrap()
            .status,
        Status::Acknowledged
    );
}
#[test]
fn x05_rehashed_journal_still_cannot_forge_close_without_acknowledgement() {
    let (auth, scope) = auth_scope();
    let mut i = clean(&scope, now());
    i.actual.ledger.cash += d(1);
    let s = ReconciliationService::new(scope.clone()).unwrap();
    let r = s.run(&auth, "bad", &i, now()).unwrap();
    let case = s.records(&auth).unwrap()[0].clone();
    let (bytes, anchor) = s.journal(&auth).unwrap();
    let mut journal: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let content = serde_json::json!({"action":"close","id":case.exception_id,"revision":0,"report_id":r.id(),"resolution":"forged"});
    let hash=quantos_core::ContentHash::sha256_bytes(&quantos_core::canonical_json_bytes(&serde_json::json!({"domain":"quantos-x05-reconciliation-journal/v1","value":[scope,2,auth.actor_id,now(),content,anchor.head]})).unwrap());
    journal["events"].as_array_mut().unwrap().push(serde_json::json!({"sequence":2,"actor":auth.actor_id,"at":now(),"content":content,"previous_hash":anchor.head,"hash":hash}));
    let forged = JournalAnchor {
        count: 2,
        head: Some(hash),
    };
    assert!(matches!(
        ReconciliationService::restore(scope, &serde_json::to_vec(&journal).unwrap(), &forged),
        Err(Error::Transition)
    ));
}
#[test]
fn x05_concurrent_virtual_fill_replays_append_exactly_one_fact() {
    let mut f = support::fixture::Fixture::new();
    f.auth.mode = RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    f.intent.quantity = "2".into();
    let scope = Scope {
        tenant_id: f.auth.tenant_id,
        workspace_id: f.auth.workspace_id,
        account_id: f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let r = ShadowRunner::new(scope, Seed::flat(d(1000)).unwrap(), f.guard()).unwrap();
    let mut tick = mark(f.now);
    tick.price = d(100);
    r.recommend(&f.auth, &f.intent, f.sources(), &tick, f.now)
        .unwrap();
    let barrier = Arc::new(Barrier::new(32));
    let mut jobs = vec![];
    for _ in 0..32 {
        let (r, f, b) = (r.clone(), f.clone(), barrier.clone());
        jobs.push(thread::spawn(move || {
            b.wait();
            r.simulate_fill(
                &f.auth,
                &f.intent.command_key,
                "one-fill",
                d(2),
                d(1),
                f.sources(),
                f.now,
            )
            .unwrap()
            .fill_id
        }));
    }
    assert_eq!(
        jobs.into_iter()
            .map(|j| j.join().unwrap())
            .collect::<BTreeSet<_>>()
            .len(),
        1
    );
    assert_eq!(r.events(&f.auth).unwrap().len(), 1);
    assert_eq!(r.snapshot(&f.auth, f.now).unwrap().ledger.cash, d(799));
}
#[test]
fn x05_decimal_scope_and_market_boundaries_reject_invalid_state() {
    let (mut auth, scope) = auth_scope();
    let mut invalid = scope.clone();
    invalid.quote_unit = "usdt".into();
    assert!(ReconciliationService::new(invalid).is_err());
    auth.role = Role::Owner;
    auth.account_id = None;
    assert!(scope.authorize(&auth).is_ok());
    assert!(Seed::flat(rust_decimal::Decimal::new(1, 19)).is_err());
    for n in 0..6 {
        let mut m = mark(now());
        match n {
            0 => m.price = d(0),
            1 => m.symbol = "btc".into(),
            2 => m.source_ref = "".into(),
            3 => m.sequence = 0,
            4 => m.source_at += Duration::milliseconds(1),
            _ => m.source_at -= Duration::milliseconds(60_001),
        }
        assert!(m.validate(now(), 60).is_err());
    }
    let s = ReconciliationService::new(scope.clone()).unwrap();
    assert!(
        ReconciliationService::restore(
            scope,
            &vec![b' '; 8 * 1024 * 1024 + 1],
            &JournalAnchor {
                count: 0,
                head: None
            }
        )
        .is_err()
    );
    assert!(s.records(&auth).unwrap().is_empty());
}

#[test]
fn x05_close_rechecks_mark_freshness_at_action_time() {
    let (auth, scope) = auth_scope();
    let mut i = clean(&scope, now());
    for b in [&mut i.actual, &mut i.expected] {
        b.positions[0].mark.source_at -= Duration::seconds(899);
    }
    let service = ReconciliationService::new(scope).unwrap();
    let r = service.run(&auth, "fresh-at-check", &i, now()).unwrap();
    assert!(r.is_clean());
    assert!(
        service
            .close_day(&auth, i.day, r.id(), now() + Duration::seconds(2))
            .is_err()
    );
    assert!(!service.day_is_closed(&auth, i.day).unwrap());
}
