#[allow(dead_code)]
#[path = "support/tp07_fixture.rs"]
mod fixture;
use chrono::{DateTime, Duration, Utc};
use fixture::Fixture;
use quantos_core::{CommandId, ContentHash, DecisionId};
use quantos_execution::{authority::*, dispatch::*, gateway::*, oms::*, *};
use quantos_risk::guard::{KillScope, Phase};
use rust_decimal::Decimal;
fn limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: Decimal::new(1000, 0),
        max_notional: Decimal::new(100_000, 0),
        allowed_venues: vec!["OWNED_PAPER".into()],
    }
}
fn issued(
    f: &Fixture,
) -> (
    AtomicCommandIssuer,
    quantos_risk::guard::RiskGuard,
    SignedCommand,
) {
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    (i, g, c)
}
fn command(n: u64, now: DateTime<Utc>) -> TradeCommand {
    TradeCommand {
        command_id: CommandId::new(),
        decision_id: DecisionId::new(),
        account_id: "owned".into(),
        venue: "OWNED_PAPER".into(),
        venue_kind: VenueKind::Cex,
        symbol: "BTCUSDT".into(),
        intent: OrderIntent::Limit,
        side: OrderSide::Buy,
        quantity: "10".into(),
        limit_price: Some("100".into()),
        stop_price: None,
        idempotency_key: format!("owned-{n}"),
        approval_signature: None,
        issued_at: now,
        expires_at: now + Duration::seconds(5),
        signature: ContentHash::sha256_bytes(b"fixture-only"),
    }
}
fn fill(c: &TradeCommand, id: &str, q: &str, at: DateTime<Utc>) -> KernelEvent {
    KernelEvent::OrderFilled {
        command_id: c.command_id.to_string(),
        venue_order_id: format!("v:{}", c.command_id),
        venue_fill_id: id.into(),
        quantity: q.into(),
        price: "100".into(),
        fee_currency: "USD".into(),
        fee_amount: "0".into(),
        at,
    }
}
#[derive(Default)]
struct Controlled {
    pending: Vec<KernelEvent>,
    fault: u8,
}
impl ExecutionKernel for Controlled {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        unreachable!()
    }
    fn submit_at(&mut self, c: &BoundaryCommand, now: DateTime<Utc>) -> Result<(), String> {
        self.pending.push(KernelEvent::OrderAccepted {
            command_id: c.command_id.clone(),
            venue_order_id: format!("v:{}", c.command_id),
            at: now,
        });
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.pending)
    }
    fn cancel(&mut self, r: &BoundaryCancel) -> Result<(), String> {
        if self.fault == 1 {
            return Err("sensitive failure".into());
        }
        if self.fault == 2 {
            return Ok(());
        }
        let at = r.requested_at + Duration::milliseconds(25);
        self.pending.push(if self.fault == 3 {
            KernelEvent::CancelRejected {
                command_id: r.command_id.clone(),
                venue_order_id: r.venue_order_id.clone(),
                cancel_id: r.cancel_id.clone(),
                reason: "already terminal".into(),
                at,
            }
        } else {
            KernelEvent::OrderCancelled {
                command_id: r.command_id.clone(),
                venue_order_id: r.venue_order_id.clone(),
                cancel_id: if self.fault == 4 {
                    "foreign".into()
                } else {
                    r.cancel_id.clone()
                },
                at,
            }
        });
        Ok(())
    }
}
#[test]
fn x04_one_hundred_thousand_mixed_kernel_events_replay_with_command_provenance() {
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut g = ExecutionGateway::new(limits(), Controlled::default());
    let mut count = 0;
    for n in 0..20_000 {
        let c = command(n, now);
        let r = g.submit(&c, now).unwrap();
        g.try_collect_events().unwrap();
        count += 1;
        let prefix = g.facts().last().unwrap().clone();
        for (id, q) in [("p1", "1"), ("p2", "2")] {
            g.kernel_mut().pending.push(fill(&c, id, q, now));
        }
        g.try_collect_events().unwrap();
        count += 2;
        assert_eq!(g.facts()[prefix.sequence as usize - 1], prefix);
        match n % 3 {
            0 => {
                g.kernel_mut().pending.push(fill(&c, "final", "7", now));
                g.try_collect_events().unwrap();
                g.kernel_mut().fault = 3;
                g.cancel(&c.command_id.to_string(), "terminal", now)
                    .unwrap();
            }
            1 => {
                g.kernel_mut().fault = 0;
                g.cancel(&c.command_id.to_string(), "first", now).unwrap();
                g.kernel_mut().fault = 3;
                g.cancel(
                    &c.command_id.to_string(),
                    "second",
                    now + Duration::milliseconds(25),
                )
                .unwrap();
            }
            _ => {
                g.kernel_mut().pending.push(KernelEvent::OrderExpired {
                    command_id: c.command_id.to_string(),
                    at: c.expires_at,
                });
                g.try_collect_events().unwrap();
                g.kernel_mut().fault = 3;
                g.cancel(&c.command_id.to_string(), "expired", c.expires_at)
                    .unwrap();
            }
        }
        count += 2;
        assert!(matches!(
            g.order(&r.order_id).unwrap().status.as_str(),
            "filled" | "cancelled" | "expired"
        ));
    }
    assert_eq!(count, 100_000);
    assert_eq!(g.fills().len(), 46_667);
    assert_eq!(g.cancel_audits().len(), 26_667);
    assert_eq!(g.facts().len(), 146_667);
    assert_eq!(
        g.facts()
            .iter()
            .filter(|f| matches!(f.content, FactKind::Kernel { .. }))
            .count(),
        100_000
    );
    assert!(
        g.fills()
            .iter()
            .all(|f| g.order(&f.order_id).unwrap().command_id == f.command_id)
    );
    let replay =
        ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts(g.facts(), &g.fact_anchor())
            .unwrap();
    assert_eq!(replay.facts(), g.facts());
    assert!(
        replay.fills() == g.fills(),
        "replayed fills must retain fact order across different drain batches"
    );
    assert_eq!(replay.cancel_audits(), g.cancel_audits());
    for f in g.fills() {
        assert_eq!(replay.order(&f.order_id), g.order(&f.order_id));
    }
    println!("X04_ORDERS=20000 FACTS=146667 FILLS=46667 CANCEL_AUDITS=26667");
    println!("X04_EVENTS=100000 LEGAL=100000 ILLEGAL=0 REPLAY=PASS FILL_COMMAND=100%");
}
#[test]
fn x04_signed_cancel_remains_available_after_expiry_and_kill_and_replays_once() {
    let f = Fixture::new();
    let (i, g, c) = issued(&f);
    let s = SignedExecutionGateway::new(i, limits(), PaperKernel::resting("100")).unwrap();
    s.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    g.set_kill_switch(
        &f.owner(),
        KillScope::Global,
        true,
        0,
        "stop new exposure",
        f.now,
    )
    .unwrap();
    let now = f.now + Duration::seconds(1);
    let a = s.cancel(&f.auth, &c, "cancel-1", now).unwrap();
    assert_eq!(a.outcome, CancelOutcome::Cancelled);
    assert_eq!(a.latency_micros, Some(10_000));
    for _ in 0..1000 {
        assert_eq!(s.cancel(&f.auth, &c, "cancel-1", now).unwrap(), a);
    }
    let refused = s
        .cancel(&f.auth, &c, "cancel-2", c.expires_at + Duration::seconds(1))
        .unwrap();
    assert_eq!(refused.outcome, CancelOutcome::Rejected);
    assert!(refused.reason.is_some());
    assert_eq!(s.downstream_submission_count(), Some(1));
    assert_eq!(s.downstream_cancel_count(), Some(2));
    assert!(s.submit(&f.auth, &c, f.sources(), now).is_err());
    assert_eq!(s.order_history(&f.auth, &c, now).unwrap().len(), 6);
    let (i, _, c) = issued(&f);
    let expired = SignedExecutionGateway::new(i, limits(), PaperKernel::resting("100")).unwrap();
    expired.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    let later = c.expires_at + Duration::seconds(1);
    let audit = expired.cancel(&f.auth, &c, "expired", later).unwrap();
    assert_eq!(audit.outcome, CancelOutcome::Rejected);
    assert!(
        expired
            .order_history(&f.auth, &c, later)
            .unwrap()
            .iter()
            .any(|f| matches!(
                f.content,
                FactKind::Kernel {
                    event: KernelEvent::OrderExpired { .. }
                }
            ))
    );
}
#[test]
fn x04_cancel_control_rejects_forgery_scope_revocation_unknown_and_other_consumer() {
    let f = Fixture::new();
    let (i, _, c) = issued(&f);
    let s = SignedExecutionGateway::new(i.clone(), limits(), PaperKernel::resting("100")).unwrap();
    assert!(s.cancel(&f.auth, &c, "x", f.now).is_err());
    s.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    for n in 0..7 {
        let mut a = f.auth.clone();
        match n {
            0 => a.actor_id = quantos_core::ActorId::new(),
            1 => a.tenant_id = quantos_core::TenantId::new(),
            2 => a.workspace_id = quantos_core::WorkspaceId::new(),
            3 => a.account_id = Some(quantos_core::AccountId::new()),
            4 => a.capabilities.clear(),
            5 => a.role = quantos_policy::Role::Viewer,
            _ => a.mode = quantos_policy::RunMode::AssistedLive,
        };
        assert!(s.cancel(&a, &c, "x", f.now).is_err());
        assert!(s.order_history(&a, &c, f.now).is_err());
    }
    let mut bad = c.clone();
    bad.signature = "public checksum".into();
    assert!(s.cancel(&f.auth, &bad, "x", f.now).is_err());
    bad = c.clone();
    bad.intent.quantity = "1".into();
    assert!(s.cancel(&f.auth, &bad, "x", f.now).is_err());
    let other = SignedExecutionGateway::new(i, limits(), PaperKernel::resting("100")).unwrap();
    assert!(other.cancel(&f.auth, &c, "x", f.now).is_err());
    assert!(s.cancel(&f.auth, &c, "", f.now).is_err());
    assert!(s.cancel(&f.auth, &c, "bad key", f.now).is_err());
    assert!(
        s.cancel(&f.auth, &c, "x", f.now - Duration::seconds(1))
            .is_err()
    );
    assert_eq!(s.downstream_cancel_count(), Some(0));
}
#[test]
fn x04_uncertain_missing_or_uncorrelated_cancel_is_audited_without_retry() {
    for fault in [1, 2, 4] {
        let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let c = command(0, now);
        let mut g = ExecutionGateway::new(
            limits(),
            Controlled {
                fault,
                ..Default::default()
            },
        );
        g.submit(&c, now).unwrap();
        g.try_collect_events().unwrap();
        for key in ["first", "first", "new-key"] {
            assert!(g.cancel(&c.command_id.to_string(), key, now).is_err());
        }
        assert_eq!(g.downstream_cancel_count(), 1);
        assert_eq!(
            g.cancel_audits().values().next().unwrap().outcome,
            CancelOutcome::Uncertain
        );
        assert!(matches!(
            g.facts().last().unwrap().content,
            FactKind::CancelUncertain { .. }
        ));
        let rebuilt =
            ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts(g.facts(), &g.fact_anchor())
                .unwrap();
        assert_eq!(rebuilt.cancel_audits(), g.cancel_audits());
    }
}
#[test]
fn x04_atomic_event_batch_keeps_fact_prefix_and_projection_on_illegal_terminal_fill() {
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let c = command(0, now);
    let mut g = ExecutionGateway::new(limits(), Controlled::default());
    let r = g.submit(&c, now).unwrap();
    g.try_collect_events().unwrap();
    let facts = g.facts().to_vec();
    let order = g.order(&r.order_id).unwrap().clone();
    g.kernel_mut()
        .pending
        .extend([fill(&c, "full", "10", now), fill(&c, "illegal", "1", now)]);
    assert!(g.try_collect_events().is_err());
    assert_eq!(g.facts(), facts);
    assert_eq!(g.order(&r.order_id), Some(&order));
    assert!(g.fills().is_empty());
}
#[test]
fn x04_fact_replay_rejects_tampering_gap_reorder_and_duplicate_facts() {
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let c = command(0, now);
    let mut g = ExecutionGateway::new(limits(), PaperKernel::new("100"));
    g.submit(&c, now).unwrap();
    g.try_collect_events().unwrap();
    for n in 0..8 {
        let mut facts = g.facts().to_vec();
        match n {
            0 => facts[1].sequence += 1,
            1 => facts[1].command_id = "foreign".into(),
            2 => facts.swap(1, 2),
            3 => {
                facts.remove(1);
            }
            4 => {
                facts.push(facts[2].clone());
            }
            5 => facts[0].hash = ContentHash::sha256_bytes(b"bad"),
            6 => {
                if let FactKind::Kernel {
                    event: KernelEvent::OrderFilled { quantity, .. },
                } = &mut facts[2].content
                {
                    *quantity = "20".into();
                }
            }
            _ => {
                facts.pop();
            }
        }
        assert!(
            ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts(&facts, &g.fact_anchor())
                .is_err()
        );
    }
    let before = g.facts().to_vec();
    g.submit(&c, now).unwrap();
    g.try_collect_events().unwrap();
    assert_eq!(g.facts(), before);
    assert_eq!(g.downstream_submission_count(), 1);
}
#[test]
fn x04_nautilus_owned_wire_maps_ack_partial_fill_cancel_reject_and_expiry() {
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let c = command(0, now);
    let mut g = ExecutionGateway::new(limits(), NautilusBoundaryAdapter::new());
    g.submit(&c, now).unwrap();
    let wire = g.kernel().outbox()[0].clone();
    let payload = |kind: &str| serde_json::json!({"event_type":kind,"client_order_id":wire.client_order_id,"venue_order_id":"v","trade_id":"f","last_qty":"1","last_px":"100","currency":"USD","commission":"0","cancel_id":"cancel","reason":"owned rejection","ts_event":now.to_rfc3339()});
    for kind in [
        "OrderAccepted",
        "OrderFilled",
        "OrderRejected",
        "OrderCanceled",
        "OrderCancelRejected",
        "OrderExpired",
    ] {
        let e = g.kernel().map_event_for(&payload(kind)).unwrap();
        assert_eq!(e.binding().0, c.command_id.to_string());
    }
    assert!(g.kernel().map_event_for(&payload("unsupported")).is_err());
    let mut p = payload("OrderAccepted");
    p["client_order_id"] = "unknown".into();
    assert!(g.kernel().map_event_for(&p).is_err());
    let r = BoundaryCancel {
        command_id: c.command_id.to_string(),
        venue_order_id: "v".into(),
        cancel_id: "opaque-cancel".into(),
        requested_at: now,
    };
    g.kernel_mut().cancel(&r).unwrap();
    assert_eq!(
        g.kernel().cancel_outbox()[0].client_order_id,
        wire.client_order_id
    );
    let mut unknown = r;
    unknown.command_id = "unknown".into();
    assert!(g.kernel_mut().cancel(&unknown).is_err());
}
#[test]
fn x04_legacy_state_rejects_illegal_fill_without_partial_mutation() {
    use quantos_execution::paper::{OrderEvent, OrderEventKind, OrderState};
    let mut state = OrderState::new("v", CommandId::new());
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let event = |kind| OrderEvent {
        sequence: 1,
        venue_order_id: "v".into(),
        occurred_at: now,
        kind,
    };
    let original = state.clone();
    assert!(
        state
            .apply(&event(OrderEventKind::Filled {
                quantity: 1.,
                price: 100.,
                fee: 0.
            }))
            .is_err()
    );
    assert_eq!(state, original);
    state.apply(&event(OrderEventKind::Accepted)).unwrap();
    state
        .apply(&event(OrderEventKind::Filled {
            quantity: 1.,
            price: 100.,
            fee: 0.,
        }))
        .unwrap();
    let original = state.clone();
    assert!(
        state
            .apply(&event(OrderEventKind::Filled {
                quantity: 1.,
                price: 100.,
                fee: 0.
            }))
            .is_err()
    );
    assert_eq!(state, original);
    let mut open = OrderState::new("v", CommandId::new());
    open.apply(&event(OrderEventKind::Accepted)).unwrap();
    let original = open.clone();
    for kind in [
        OrderEventKind::PartialFill {
            quantity: f64::NAN,
            price: 100.,
            fee: 0.,
        },
        OrderEventKind::PartialFill {
            quantity: 1.,
            price: 100.,
            fee: -1.,
        },
    ] {
        assert!(open.apply(&event(kind)).is_err());
        assert_eq!(open, original);
    }
    let mut foreign = event(OrderEventKind::PartialFill {
        quantity: 1.,
        price: 100.,
        fee: 0.,
    });
    foreign.venue_order_id = "foreign".into();
    assert!(open.apply(&foreign).is_err());
    assert_eq!(open, original);
    open.apply(&event(OrderEventKind::PartialFill {
        quantity: 1.,
        price: 100.,
        fee: 0.,
    }))
    .unwrap();
    assert_eq!(open.average_fill_price(), Some(100.));
    open.apply(&event(OrderEventKind::Expired)).unwrap();
    assert!(open.status.is_terminal());
}

#[test]
fn x04_replay_rejects_rehashed_illegal_order_and_cancel_facts() {
    let now = DateTime::parse_from_rfc3339("2026-10-17T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let c = command(0, now);
    let mut g = ExecutionGateway::new(limits(), Controlled::default());
    g.submit(&c, now).unwrap();
    g.try_collect_events().unwrap();
    g.cancel(&c.command_id.to_string(), "cancel", now).unwrap();
    for variant in 0..6 {
        let mut facts = g.facts().to_vec();
        match variant {
            0 => {
                if let FactKind::Submitted { order, .. } = &mut facts[0].content {
                    order.status = "filled".into();
                }
            }
            1 => {
                if let FactKind::CancelRequested { request } = &mut facts[2].content {
                    request.venue_order_id = "foreign".into();
                }
            }
            2 => {
                if let FactKind::Kernel {
                    event: KernelEvent::OrderCancelled { at, .. },
                } = &mut facts[3].content
                {
                    *at = now - Duration::seconds(1);
                }
            }
            3 => {
                if let FactKind::Kernel {
                    event: KernelEvent::OrderCancelled { at, .. },
                } = &mut facts[3].content
                {
                    *at = now + Duration::seconds(2);
                }
            }
            4 => {
                if let FactKind::Kernel {
                    event: KernelEvent::OrderCancelled { cancel_id, .. },
                } = &mut facts[3].content
                {
                    *cancel_id = "foreign".into();
                }
            }
            _ => {
                facts[3].content = FactKind::CancelUncertain {
                    cancel_id: "unknown".into(),
                }
            }
        }
        let mut previous = None;
        for fact in &mut facts {
            fact.previous_hash = previous.clone();
            let bytes=quantos_core::canonical_json_bytes(&serde_json::json!({"domain":"quantos-x04-order-fact/v1","sequence":fact.sequence,"order_id":fact.order_id,"command_id":fact.command_id,"previous_hash":fact.previous_hash,"content":fact.content})).unwrap();
            fact.hash = ContentHash::sha256_bytes(&bytes);
            previous = Some(fact.hash.clone());
        }
        let anchor = FactAnchor {
            count: facts.len() as u64,
            head: previous,
        };
        assert!(
            ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts(&facts, &anchor).is_err(),
            "variant {variant}"
        );
    }
}
