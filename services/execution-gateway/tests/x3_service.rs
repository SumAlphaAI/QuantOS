//! Controlled X3 service composition. Independent financial calculations are
//! compared after an explicit one-to-one identity bridge; no copied Paper book.
#[allow(dead_code)]
#[path = "../../../crates/quantos-operations/tests/support/mod.rs"]
mod support;
use quantos_execution::oms::FactKind;
use quantos_reconcile::{
    BreakKind,
    exceptions::{ReconciliationService, Status},
    model::{Book, Mark, OrderStatus, Scope, Seed},
    reconciliation::{Input, from_x04_portfolio},
    shadow::ShadowRunner,
};
use rust_decimal::Decimal;
use serde_json::json;
use std::collections::BTreeSet;
use support::*;
fn d(n: i64) -> Decimal {
    Decimal::new(n, 0)
}
fn amount(key: &str) -> Decimal {
    golden()[key].as_str().unwrap().parse().unwrap()
}
fn golden() -> serde_json::Value {
    serde_json::from_str(include_str!("fixtures/x3-service-golden.json")).unwrap()
}
fn proof(id: &str, data: serde_json::Value) {
    println!(
        "X3_SERVICE_EVIDENCE={}",
        json!({"schema":"quantos-x3-service-behavior/v1","id":id,"data":data})
    );
}
fn scope(h: &Harness) -> Scope {
    Scope {
        tenant_id: h.f.auth.tenant_id,
        workspace_id: h.f.auth.workspace_id,
        account_id: h.f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    }
}
fn shadow(h: &Harness) -> (ShadowRunner, Fixture, Seed) {
    let mut f = h.f.clone();
    f.auth.mode = quantos_policy::RunMode::Shadow;
    f.intent.target = quantos_strategy::release::DeploymentTarget::Shadow;
    f.intent.command_key = format!("shadow-{}", f.intent.command_key);
    let seed = Seed::from_portfolio(&scope(h), &f.input.portfolio, amount("openingCash")).unwrap();
    let r = ShadowRunner::new(scope(h), seed.clone(), h.guard.clone()).unwrap();
    (r, f, seed)
}
fn tick(f: &Fixture) -> Mark {
    Mark {
        symbol: "BTCUSDT".into(),
        price: d(100),
        source_ref: "owned-fixed-market-window".into(),
        sequence: 6,
        source_at: f.now,
    }
}
fn paper_book(
    h: &Harness,
    s: &OperationsService<PaperKernel>,
    c: &SignedCommand,
    seed: Seed,
) -> Book {
    let e = h.gateway.inspect_order(&h.f.auth, c, h.f.now).unwrap();
    let view = s
        .evidence_chain(&h.f.auth, &c.command_id.to_string(), h.f.now)
        .unwrap();
    assert!(view.portfolio_source_current);
    assert_eq!(view.fills.len(), 1);
    assert_eq!(view.fill_links[0].fill_id, e.fills[0].fill_id);
    // Explicit controlled cash source, independently calculated from owned fills.
    let cash = e.fills.iter().fold(amount("openingCash"), |cash, f| {
        cash - f.quantity.parse::<Decimal>().unwrap() * f.price.parse::<Decimal>().unwrap()
            - f.fee_amount.parse::<Decimal>().unwrap()
    });
    from_x04_portfolio(
        &scope(h),
        &e.facts,
        &e.global_anchor,
        &view.portfolio,
        seed,
        cash,
        1,
        h.f.now,
    )
    .unwrap()
}
fn clean_chain() -> (
    Harness,
    OperationsService<PaperKernel>,
    SignedCommand,
    Input,
) {
    let h = Harness::new();
    assert_eq!(
        h.f.intent.quantity.parse::<Decimal>().unwrap(),
        amount("tradeQuantity")
    );
    assert_eq!(
        h.f.intent.limit_price.parse::<Decimal>().unwrap(),
        amount("tradePrice")
    );
    let s = h.service();
    let c = h.command();
    let n = h.f.now;
    let a = &h.f.auth;
    let m = step(a, n);
    let (runner, f, seed) = shadow(&h);
    let advice = runner
        .recommend(&f.auth, &f.intent, f.sources(), &tick(&f), n)
        .unwrap();
    assert!(!advice.executable);
    runner
        .simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "owned-fill-1",
            d(10),
            d(0),
            f.sources(),
            n,
        )
        .unwrap();
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
    let prepared = s.prepare_submit(a, &m, "paper-submit", &c, n).unwrap();
    reference(
        &s.dispatch_prepared(a, &m, &prepared.id, h.f.sources(), n)
            .unwrap(),
    );
    let actual = paper_book(&h, &s, &c, seed);
    let mut expected = runner.snapshot(&f.auth, n).unwrap();
    assert_eq!(expected.orders.len(), 1);
    assert_eq!(expected.fills.len(), 1);
    assert_eq!(expected.orders[0].symbol, actual.orders[0].symbol);
    assert_eq!(expected.orders[0].quantity, actual.orders[0].quantity);
    assert_eq!(expected.fills[0].quantity, actual.fills[0].quantity);
    assert_eq!(expected.fills[0].price, actual.fills[0].price);
    // IDs represent different namespaces, explicitly joined by this single
    // fixed account/symbol/side/quantity/proposal test case. Money is never copied.
    let bridge = json!({"shadowAdvice":advice.advice_id,"shadowFill":expected.fills[0].fill_id,"command":c.command_id,"paperOrder":actual.orders[0].order_id,"paperFill":actual.fills[0].fill_id});
    expected.source_hash = ContentHash::sha256_bytes(
        &quantos_core::canonical_json_bytes(&json!([
            "x3-owned-identity-bridge/v1",
            expected.source_hash,
            bridge
        ]))
        .unwrap(),
    );
    expected.source_ref = "independent-shadow-with-owned-id-bridge".into();
    expected.orders[0].order_id = actual.orders[0].order_id.clone();
    expected.orders[0].command_id = c.command_id.to_string();
    expected.fills[0].order_id = actual.orders[0].order_id.clone();
    expected.fills[0].command_id = c.command_id.to_string();
    expected.fills[0].fill_id = actual.fills[0].fill_id.clone();
    for b in [&expected, &actual] {
        assert_eq!(
            b.ledger.cash.to_string(),
            golden()["expectedCash"].as_str().unwrap()
        );
        assert_eq!(b.ledger.exposure_gross, amount("expectedGrossExposure"));
        assert_eq!(b.ledger.realized_pnl, amount("expectedPnl"));
        assert_eq!(b.ledger.unrealized_pnl, amount("expectedPnl"));
        assert_eq!(
            b.positions
                .iter()
                .find(|p| p.symbol == "BTCUSDT")
                .unwrap()
                .quantity,
            amount("expectedBtcQuantity")
        );
        assert_eq!(
            b.positions
                .iter()
                .find(|p| p.symbol == "ETHUSDT")
                .unwrap()
                .quantity,
            amount("expectedEthQuantity")
        );
    }
    let input = Input {
        scope: scope(&h),
        day: n.date_naive(),
        available_at: n,
        expected,
        actual,
        max_age_seconds: 60,
        tolerance: Decimal::new(1, 8),
    };
    let report = quantos_reconcile::reconciliation::offline_check(&input, n).unwrap();
    assert!(report.is_clean(), "{:?}", report.differences());
    (h, s, c, input)
}
#[test]
fn x3_service_paper_shadow_reconcile_concurrent_recovery_clean() {
    let (h, s, c, input) = clean_chain();
    let (a, n) = (&h.f.auth, h.f.now);
    let m = step(a, n);
    let before = s.audit(a, 0, 100, None).unwrap();
    let prepared = s.prepare_submit(a, &m, "paper-submit", &c, n).unwrap();
    let current = s.risk_snapshot(a, n).unwrap();
    let mut tasks = vec![];
    for _ in 0..32 {
        let (s, f, curr, id) = (s.clone(), h.f.clone(), current.clone(), prepared.id.clone());
        tasks.push(std::thread::spawn(move || {
            s.dispatch_prepared(
                &f.auth,
                &step(&f.auth, f.now),
                &id,
                CurrentSources {
                    snapshot: &curr,
                    ..f.sources()
                },
                f.now,
            )
            .unwrap()
        }));
    }
    for t in tasks {
        reference(&t.join().unwrap());
    }
    assert_eq!(s.audit(a, 0, 100, None).unwrap().total, before.total);
    let (bytes, anchor) = s.checkpoint(a, &m, n).unwrap();
    let restored = h.service();
    restored.restore(a, &m, &bytes, &anchor, n).unwrap();
    assert_eq!(
        restored
            .evidence_chain(a, &c.command_id.to_string(), n)
            .unwrap()
            .portfolio,
        input_portfolio(&s, a, &c, n)
    );
    let mut ra = a.clone();
    ra.mode = quantos_policy::RunMode::Shadow;
    let reconcile = ReconciliationService::new(scope(&h)).unwrap();
    let report = reconcile.run(&ra, "same-chain", &input, n).unwrap();
    assert!(report.is_clean());
    let mut threads = vec![];
    for _ in 0..32 {
        let (r, i, a) = (reconcile.clone(), input.clone(), ra.clone());
        threads.push(std::thread::spawn(move || {
            r.run(&a, "same-chain", &i, n).unwrap()
        }));
    }
    for t in threads {
        assert_eq!(t.join().unwrap(), report);
    }
    reconcile.close_day(&ra, input.day, report.id(), n).unwrap();
    let (journal, head) = reconcile.journal(&ra).unwrap();
    let rebuilt = ReconciliationService::restore(scope(&h), &journal, &head).unwrap();
    assert_eq!(rebuilt.run(&ra, "same-chain", &input, n).unwrap(), report);
    assert!(rebuilt.day_is_closed(&ra, input.day).unwrap());
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(h.gateway.downstream_cancel_count(), Some(0));
    proof(
        "chain",
        json!({"paperSubmits":1,"shadowSubmitCalls":0,"venueSubmitPath":"ABSENT","duplicates":0,"fills":1,"btcQuantity":"1010","cash":"999000","report":report.id(),"expectedSource":input.expected.source_hash,"actualSource":input.actual.source_hash,"command":c.command_id,"auditHead":before.head,"recoveryIo":0,"goldenSha256":ContentHash::sha256_bytes(include_bytes!("fixtures/x3-service-golden.json"))}),
    );
}
fn input_portfolio(
    s: &OperationsService<PaperKernel>,
    a: &AuthContext,
    c: &SignedCommand,
    n: chrono::DateTime<Utc>,
) -> quantos_portfolio::PortfolioSnapshot {
    s.evidence_chain(a, &c.command_id.to_string(), n)
        .unwrap()
        .portfolio
}
#[test]
fn x3_service_twenty_breaks_require_proof_ack_repair_and_reopen() {
    let (h, _, _, input) = clean_chain();
    let mut auth = h.f.auth.clone();
    auth.mode = quantos_policy::RunMode::Shadow;
    let (a, n) = (&auth, h.f.now);
    let mut found = BTreeSet::new();
    let mut closed = 0;
    for kind in BreakKind::all() {
        let r = ReconciliationService::new(scope(&h)).unwrap();
        let mut bad = input.clone();
        corrupt(&mut bad, *kind);
        if *kind == BreakKind::LedgerPnlMismatch {
            bad.actual.ledger.realized_pnl = input.actual.ledger.realized_pnl + d(1);
        }
        let report = r.run(a, "bad", &bad, n).unwrap();
        let diff = report
            .differences()
            .iter()
            .find(|d| d.kind == *kind)
            .unwrap_or_else(|| panic!("missing {kind:?}"));
        assert!(!diff.entity.is_empty());
        assert_eq!(diff.expected_source, input.expected.source_ref);
        assert_eq!(diff.actual_source, input.actual.source_ref);
        found.insert(*kind);
        assert!(r.close_day(a, bad.day, report.id(), n).is_err());
        let records = r.records(a).unwrap();
        assert!(!records.is_empty());
        assert!(
            r.close(
                a,
                &records[0].exception_id,
                records[0].revision,
                report.id(),
                "unproven",
                n
            )
            .is_err()
        );
        let later = n + Duration::seconds(1);
        let mut fixed = input.clone();
        refresh(&mut fixed, later);
        let repaired = r.run(a, "repaired", &fixed, later).unwrap();
        assert!(repaired.is_clean());
        for e in records {
            let ack = r
                .acknowledge(a, &e.exception_id, e.revision, later)
                .unwrap();
            let done = r
                .close(
                    a,
                    &e.exception_id,
                    ack.revision,
                    repaired.id(),
                    "actual source replay and independent shadow agree",
                    later,
                )
                .unwrap();
            assert_eq!(done.status, Status::Closed);
            closed += 1;
        }
        r.close_day(a, input.day, repaired.id(), later).unwrap();
        let (bytes, anchor) = r.journal(a).unwrap();
        let rebuilt = ReconciliationService::restore(scope(&h), &bytes, &anchor).unwrap();
        assert!(rebuilt.day_is_closed(a, input.day).unwrap());
        let again = later + Duration::seconds(1);
        refresh(&mut bad, again);
        bad.actual.revision = fixed.actual.revision + 1;
        bad.expected.revision = fixed.expected.revision + 1;
        corrupt(&mut bad, *kind);
        if *kind == BreakKind::LedgerPnlMismatch {
            bad.actual.ledger.realized_pnl = input.actual.ledger.realized_pnl + d(1);
        }
        r.run(a, "recurred", &bad, again).unwrap();
        assert!(!r.day_is_closed(a, input.day).unwrap());
        assert!(
            r.records(a)
                .unwrap()
                .iter()
                .any(|e| e.status == Status::Open)
        );
    }
    assert_eq!(found.len(), 20);
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    proof(
        "twenty-breaks",
        json!({"classes":20,"located":20,"casesClosed":closed,"unprovenClose":"REFUSED","recurrence":"REOPENED","venueSubmitPath":"ABSENT","latencyScope":"CONTROLLED_CLOCK_NOT_TARGET_SLA"}),
    );
}
#[test]
fn x3_service_stale_sources_and_revocation_refuse_paper_and_shadow() {
    let mut rejected = 0;
    for case in ["snapshot", "financials", "venue", "capability", "expiry"] {
        let h = Harness::new();
        let s = h.service();
        let c = h.command();
        let n = h.f.now;
        let a = &h.f.auth;
        let m = step(a, n);
        let p = s.prepare_submit(a, &m, "refused", &c, n).unwrap();
        let (r, mut f, _) = shadow(&h);
        r.recommend(&f.auth, &f.intent, f.sources(), &tick(&f), n)
            .unwrap();
        let mut sources = h.f.clone();
        let mut paper_auth = a.clone();
        let mut at = n;
        match case {
            "snapshot" => {
                let mut old = h.seed.clone();
                for event in &mut old {
                    event.occurred_at -= Duration::hours(1);
                    if let PortfolioEventKind::MarketMark(mark) = &mut event.kind {
                        mark.source_at -= Duration::hours(1);
                    }
                }
                let stale = quantos_portfolio::InMemoryPortfolioProjection::rebuild(
                    a.tenant_id,
                    h.config.started_at - Duration::hours(1),
                    &old,
                )
                .unwrap()
                .risk_snapshot(a.account_id.unwrap(), n - Duration::hours(1), 60)
                .unwrap();
                stale.portfolio.validate().unwrap();
                sources.input = stale.clone();
                f.input = stale;
            }
            "financials" => {
                sources.financials.as_of -= Duration::hours(1);
                f.financials.as_of -= Duration::hours(1);
            }
            "venue" => {
                sources.venue.observed_at -= Duration::hours(1);
                f.venue.observed_at -= Duration::hours(1);
            }
            "capability" => {
                paper_auth.capabilities.clear();
                f.auth.capabilities.clear();
            }
            _ => at = (n + Duration::seconds(10)).max(c.expires_at),
        }
        let result = s.dispatch_prepared(
            &paper_auth,
            &step(&paper_auth, n),
            &p.id,
            sources.sources(),
            at,
        );
        assert!(result.is_err() || !matches!(result.unwrap().outcome, Outcome::Applied { .. }));
        assert!(
            r.simulate_fill(
                &f.auth,
                &f.intent.command_key,
                "refused-fill",
                d(10),
                d(0),
                f.sources(),
                at
            )
            .is_err(),
            "{case}"
        );
        assert_eq!(h.gateway.downstream_submission_count(), Some(0));
        assert_eq!(
            s.audit(a, 0, 100, None)
                .unwrap()
                .rows
                .iter()
                .filter(|r| matches!(r.outcome, Outcome::Applied { .. }))
                .count(),
            0
        );
        assert_eq!(
            r.events(&{
                let mut x = f.auth.clone();
                x.capabilities = h.f.auth.capabilities.clone();
                x
            })
            .unwrap()
            .len(),
            0
        );
        rejected += 1;
    }
    proof(
        "refusals",
        json!({"sourceOrAuthorityClasses":rejected,"paperSubmits":0,"shadowFills":0,"sideEffects":0}),
    );
}
#[test]
fn x3_service_kill_resume_requires_separate_user_fresh_health_then_both_paths_recover() {
    let mut h = Harness::new();
    let s = h.service();
    let a = h.f.auth.clone();
    let n = h.f.now;
    let m = step(&a, n);
    let (r, mut f, _) = shadow(&h);
    r.recommend(&f.auth, &f.intent, f.sources(), &tick(&f), n)
        .unwrap();
    let c = h.command();
    let prepared = s.prepare_submit(&a, &m, "before-kill", &c, n).unwrap();
    reference(
        &s.engage_kill(&a, &m, "stop", 0, "aggregate controlled stop", n)
            .unwrap(),
    );
    let denied = s.dispatch_prepared(&a, &m, &prepared.id, h.f.sources(), n);
    assert!(denied.is_err() || !matches!(denied.unwrap().outcome, Outcome::Applied { .. }));
    assert!(
        r.simulate_fill(
            &f.auth,
            &f.intent.command_key,
            "blocked",
            d(10),
            d(0),
            f.sources(),
            n
        )
        .is_err()
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(0));
    s.observe(&h.observer(), &h.report(n, true), &[], n)
        .unwrap();
    let req = reference(&s.request_resume(&a, &m, "request", 1, n).unwrap());
    let mut same_user = h.approver();
    same_user.user_id = a.user_id;
    assert!(
        s.approve_resume(&same_user, &step(&same_user, n), "self", &req, n)
            .is_err()
    );
    let ap = h.approver();
    reference(
        &s.approve_resume(&ap, &step(&ap, n), "approve", &req, n)
            .unwrap(),
    );
    assert!(s.execute_resume(&a, &m, "too-early", &req, n).is_err());
    let later = n + Duration::seconds(1);
    s.observe(&h.observer(), &h.report(later, true), &[], later)
        .unwrap();
    reference(&s.execute_resume(&a, &m, "resume", &req, later).unwrap());
    assert!(s.execute_resume(&a, &m, "reuse", &req, later).is_err());
    h.f.now = later;
    h.f.intent.command_key = "after-resume".into();
    let c = h.command();
    let prepared = s.prepare_submit(&a, &m, "after-resume", &c, later).unwrap();
    reference(
        &s.dispatch_prepared(&a, &m, &prepared.id, h.f.sources(), later)
            .unwrap(),
    );
    f.now = later;
    f.intent.command_key = "shadow-after-resume".into();
    let mut fresh = tick(&f);
    fresh.sequence = 7;
    r.recommend(&f.auth, &f.intent, f.sources(), &fresh, later)
        .unwrap();
    r.simulate_fill(
        &f.auth,
        &f.intent.command_key,
        "recovered",
        d(10),
        d(0),
        f.sources(),
        later,
    )
    .unwrap();
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(r.events(&f.auth).unwrap().len(), 1);
    assert_eq!(h.guard.revision().unwrap(), 2);
    proof(
        "kill-recovery",
        json!({"killRefusedBoth":true,"sameUserApproval":"REFUSED","freshHealthRequired":true,"resumeConsumptions":1,"paperSubmitsAfterResume":1,"shadowFillsAfterResume":1,"venueSubmitPath":"ABSENT"}),
    );
}
#[test]
fn x3_service_adapter_refuses_foreign_nonzero_fee_and_forged_source() {
    let (h, s, c, input) = clean_chain();
    let n = h.f.now;
    let view = s
        .evidence_chain(&h.f.auth, &c.command_id.to_string(), n)
        .unwrap();
    let e = h.gateway.inspect_order(&h.f.auth, &c, n).unwrap();
    assert_eq!(e.fills[0].fee_currency, "USD");
    assert_eq!(e.fills[0].fee_amount.parse::<Decimal>().unwrap(), d(0));
    let mut contents: Vec<_> = e
        .facts
        .iter()
        .map(|f| (f.order_id.clone(), f.command_id.clone(), f.content.clone()))
        .collect();
    for (_, _, content) in &mut contents {
        if let FactKind::Kernel {
            event: KernelEvent::OrderFilled { fee_amount, .. },
        } = content
        {
            *fee_amount = "1".into();
        }
    }
    let (facts, anchor) = fact_chain(contents);
    assert!(
        from_x04_portfolio(
            &scope(&h),
            &facts,
            &anchor,
            &view.portfolio,
            input.actual.seed.clone(),
            d(998999),
            2,
            n
        )
        .is_err()
    );
    let mut invalid = e.global_anchor.clone();
    invalid.count -= 1;
    assert!(
        from_x04_portfolio(
            &scope(&h),
            &e.facts,
            &invalid,
            &view.portfolio,
            input.actual.seed.clone(),
            d(999000),
            2,
            n
        )
        .is_err()
    );
    let mut tampered = view.portfolio.clone();
    tampered.positions[0].quantity += 1.0;
    assert!(
        from_x04_portfolio(
            &scope(&h),
            &e.facts,
            &e.global_anchor,
            &tampered,
            input.actual.seed,
            d(999000),
            2,
            n
        )
        .is_err()
    );
    proof(
        "source-binding",
        json!({"zeroForeignFee":"ACCEPTED_WITHOUT_FX","nonzeroForeignFee":"REFUSED","wrongAnchor":"REFUSED","tamperedPortfolio":"REFUSED","sourceFacts":facts.len(),"venueSubmitPath":"ABSENT"}),
    );
}

// Test-only controlled corruption and source version advancement, never a repair API.

fn refresh(input: &mut Input, at: chrono::DateTime<Utc>) {
    input.available_at = at;
    for b in [&mut input.actual, &mut input.expected] {
        b.captured_at = at;
        for p in &mut b.positions {
            p.mark.source_at = at;
            p.mark.sequence += 1;
        }
        b.revision += 1;
    }
}

fn corrupt(input: &mut Input, kind: quantos_reconcile::BreakKind) {
    use quantos_reconcile::BreakKind::*;
    match kind {
        OrderCountMismatch | OrderMissing => {
            input.actual.orders.clear();
            input.actual.fills.clear();
        }
        OrderStatusMismatch => input.actual.orders[0].status = OrderStatus::Cancelled,
        OrderQuantityMismatch => input.actual.orders[0].filled_quantity = d(1),
        OrderPriceMismatch => input.actual.orders[0].average_fill_price = Some(d(101)),
        FillCountMismatch | FillMissing => input.actual.fills.clear(),
        FillQuantityMismatch => input.actual.fills[0].quantity = d(1),
        FillPriceMismatch => input.actual.fills[0].price = d(101),
        FillFeeMismatch => input.actual.fills[0].fee = d(2),
        PositionQuantityMismatch => input.actual.positions[0].quantity = d(1),
        PositionPriceMismatch => input.actual.positions[0].average_entry_price = d(101),
        PositionMissing => input.actual.positions.clear(),
        PositionUnrealizedMismatch => input.actual.positions[0].unrealized_pnl = d(21),
        PositionRealizedMismatch => input.actual.positions[0].realized_pnl = d(-2),
        LedgerPnlMismatch => input.actual.ledger.realized_pnl = d(0),
        LedgerExposureMismatch => input.actual.ledger.exposure_gross = d(221),
        LedgerBalanceMismatch => input.actual.ledger.cash = d(800),
        LedgerSequenceGap => input.actual.ledger.sequence = 2,
        LedgerStaleMark => {
            input.actual.positions[0].mark.source_at -= chrono::Duration::seconds(901)
        }
    }
}

fn fact_chain(
    contents: Vec<(String, String, quantos_execution::oms::FactKind)>,
) -> (
    Vec<quantos_execution::oms::OrderFact>,
    quantos_execution::oms::FactAnchor,
) {
    let mut facts: Vec<quantos_execution::oms::OrderFact> = vec![];
    for (order_id, command_id, content) in contents {
        let sequence = facts.len() as u64 + 1;
        let previous_hash = facts.last().map(|f| f.hash.clone());
        let hash=ContentHash::sha256_bytes(&quantos_core::canonical_json_bytes(&serde_json::json!({"domain":"quantos-x04-order-fact/v1","sequence":sequence,"order_id":order_id,"command_id":command_id,"previous_hash":previous_hash,"content":content})).unwrap());
        facts.push(quantos_execution::oms::OrderFact {
            sequence,
            order_id,
            command_id,
            previous_hash,
            content,
            hash,
        });
    }
    let anchor = quantos_execution::oms::FactAnchor {
        count: facts.len() as u64,
        head: facts.last().map(|f| f.hash.clone()),
    };
    (facts, anchor)
}
