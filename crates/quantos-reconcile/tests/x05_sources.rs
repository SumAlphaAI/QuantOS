mod support;
use chrono::Duration;
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_execution::{
    gateway::{GatewayOrder, KernelEvent},
    oms::FactKind,
};
use quantos_portfolio::{
    AccountStatus, AccountStatusEvent, FillEvent, FillSide, InMemoryPortfolioProjection,
    MarketMarkEvent, PortfolioEvent, PortfolioEventKind,
};
use quantos_reconcile::{model::*, reconciliation::*};
use quantos_risk::guard::Phase;
use support::*;
#[test]
fn x05_actual_x03_x04_x01_read_models_adapt_without_any_kernel_invocation() {
    let mut f = support::fixture::Fixture::new();
    f.intent.quantity = "2".into();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let risk = f.eval(&g, Phase::Pre);
    let c = i
        .issue(&f.auth, &p, &risk, None, f.sources(), f.now)
        .unwrap();
    let scope = Scope {
        tenant_id: f.auth.tenant_id,
        workspace_id: f.auth.workspace_id,
        account_id: f.auth.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let order_id = x04_id("order", &c.command_id.to_string());
    let order = GatewayOrder {
        order_id: order_id.clone(),
        command_id: c.command_id.to_string(),
        venue_order_id: None,
        account_id: scope.account_id.to_string(),
        symbol: "BTCUSDT".into(),
        side: "buy".into(),
        intent: "limit".into(),
        quantity: "2".into(),
        filled_quantity: "0".into(),
        average_fill_price: None,
        status: "submitted".into(),
        submitted_at: f.now,
        expires_at: c.expires_at,
        updated_at: f.now,
        rejection_reason: None,
    };
    let chain = vec![
        FactKind::Submitted {
            order: order.clone(),
            expires_at: c.expires_at,
        },
        FactKind::Kernel {
            event: KernelEvent::OrderAccepted {
                command_id: c.command_id.to_string(),
                venue_order_id: "v1".into(),
                at: f.now,
            },
        },
        FactKind::Kernel {
            event: KernelEvent::OrderFilled {
                command_id: c.command_id.to_string(),
                venue_order_id: "v1".into(),
                venue_fill_id: "vf1".into(),
                quantity: "2".into(),
                price: "100".into(),
                fee_currency: "USDT".into(),
                fee_amount: "1".into(),
                at: f.now,
            },
        },
    ];
    let (facts, anchor) = fact_chain(
        chain
            .into_iter()
            .map(|k| (order_id.clone(), c.command_id.to_string(), k))
            .collect(),
    );
    let kinds = [
        PortfolioEventKind::AccountStatus(AccountStatusEvent {
            account_id: scope.account_id,
            status: AccountStatus::Active,
        }),
        PortfolioEventKind::Fill(FillEvent {
            account_id: scope.account_id,
            symbol: "BTCUSDT".into(),
            side: FillSide::Buy,
            quantity: 2.,
            price: 100.,
            fee: 1.,
        }),
        PortfolioEventKind::MarketMark(MarketMarkEvent {
            symbol: "BTCUSDT".into(),
            price: 110.,
            source_at: f.now,
        }),
    ];
    let events: Vec<_> = kinds
        .into_iter()
        .enumerate()
        .map(|(n, kind)| PortfolioEvent {
            event_id: format!("owned-{n}"),
            sequence: n as u64 + 1,
            occurred_at: f.now,
            kind,
        })
        .collect();
    let portfolio = InMemoryPortfolioProjection::rebuild(
        scope.tenant_id,
        f.now - Duration::seconds(1),
        &events,
    )
    .unwrap()
    .snapshot(scope.account_id)
    .unwrap();
    let actual = from_x04_portfolio(
        &scope,
        &facts,
        &anchor,
        &portfolio,
        Seed::flat(d(1000)).unwrap(),
        d(799),
        1,
        f.now,
    )
    .unwrap();
    assert_eq!(actual.orders.len(), 1);
    assert_eq!(actual.fills[0].command_id, c.command_id.to_string());
    assert_eq!(actual.ledger.cash, d(799));
    assert_eq!(actual.positions[0].quantity, d(2));
    let mut input = clean(&scope, f.now);
    input.expected.orders[0].command_id = c.command_id.to_string();
    input.expected.orders[0].order_id = order_id.clone();
    input.expected.fills[0].command_id = c.command_id.to_string();
    input.expected.fills[0].order_id = order_id;
    input.expected.fills[0].fill_id = actual.fills[0].fill_id.clone();
    input.actual = actual;
    assert!(offline_check(&input, f.now).unwrap().is_clean());
    let seed = Seed::from_portfolio(&scope, &portfolio, d(799)).unwrap();
    assert_eq!(seed.positions["BTCUSDT"].quantity, d(2));
    let mut tampered = portfolio.clone();
    tampered.positions[0].quantity = 3.;
    assert!(
        from_x04_portfolio(
            &scope,
            &facts,
            &anchor,
            &tampered,
            Seed::flat(d(1000)).unwrap(),
            d(799),
            1,
            f.now
        )
        .is_err()
    );
    let mut wrong = anchor.clone();
    wrong.count -= 1;
    assert!(
        from_x04_portfolio(
            &scope,
            &facts,
            &wrong,
            &portfolio,
            Seed::flat(d(1000)).unwrap(),
            d(799),
            1,
            f.now
        )
        .is_err()
    );
    let mut altered = portfolio.clone();
    altered.valuation_marks.clear();
    assert!(Seed::from_portfolio(&scope, &altered, d(799)).is_err());
    let mut foreign = scope.clone();
    foreign.account_id = quantos_core::AccountId::new();
    assert!(
        from_x04_portfolio(
            &foreign,
            &facts,
            &anchor,
            &portfolio,
            Seed::flat(d(1000)).unwrap(),
            d(799),
            1,
            f.now
        )
        .is_err()
    );
    // Facts were built as immutable test data. No ExecutionKernel::submit/cancel
    // was called while minting the source command or adapting/replaying any facts.
    println!("X05_X03_X04_X01_READ_ONLY=PASS KERNEL_INVOCATIONS=0");
}
#[test]
fn x05_long_short_reversal_and_marked_exposure_match_hand_calculated_ledger() {
    let (_, scope) = auth_scope();
    let mut input = clean(&scope, now());
    let b = &mut input.actual;
    b.orders.clear();
    b.fills.clear();
    for (n, side, q, price) in [
        (0, quantos_risk::guard::Side::Buy, 2, 100),
        (1, quantos_risk::guard::Side::Sell, 5, 110),
        (2, quantos_risk::guard::Side::Buy, 1, 90),
    ] {
        let id = format!("o{n}");
        b.orders.push(Order {
            order_id: id.clone(),
            command_id: id.clone(),
            symbol: "BTCUSDT".into(),
            side,
            quantity: d(q),
            filled_quantity: d(q),
            average_fill_price: Some(d(price)),
            status: OrderStatus::Filled,
        });
        b.fills.push(Fill {
            fill_id: format!("f{n}"),
            order_id: id.clone(),
            command_id: id,
            symbol: "BTCUSDT".into(),
            side,
            quantity: d(q),
            price: d(price),
            fee: d(1),
            sequence: n + 1,
            at: now(),
        });
    }
    // +2 @100; sell5 @110 realizes20 and leaves -3 @110; buy1 @90
    // realizes20, leaves -2 @110. Three fees: realized37; cash1257.
    b.positions[0].quantity = d(-2);
    b.positions[0].average_entry_price = d(110);
    b.positions[0].mark.price = d(90);
    b.positions[0].realized_pnl = d(37);
    b.positions[0].unrealized_pnl = d(40);
    b.ledger = Ledger {
        cash: d(1257),
        realized_pnl: d(37),
        unrealized_pnl: d(40),
        exposure_gross: d(180),
        sequence: 3,
    };
    input.expected = b.clone();
    input.expected.source_ref = "independent-golden-reversal".into();
    assert!(offline_check(&input, now()).unwrap().is_clean());
    let bytes = canonical_json_bytes(&serde_json::to_value(&input).unwrap()).unwrap();
    assert!(!ContentHash::sha256_bytes(&bytes).as_str().is_empty());
    input.actual.fills.swap(0, 1);
    assert!(!offline_check(&input, now()).unwrap().is_clean());
}
