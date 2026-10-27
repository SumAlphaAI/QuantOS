// Independent owned golden books; no live source or execution-account composition claim.
use chrono::{DateTime, Utc};
use quantos_core::ContentHash;
use quantos_reconcile::{model::*, reconciliation::Input};
use quantos_risk::guard::Side;
use rust_decimal::Decimal;
pub fn d(n: i64) -> Decimal {
    Decimal::new(n, 0)
}
pub fn mark(at: DateTime<Utc>) -> Mark {
    Mark {
        symbol: "BTCUSDT".into(),
        price: d(110),
        source_ref: "owned-market-event".into(),
        sequence: 1,
        source_at: at,
    }
}
pub fn clean(scope: &Scope, at: DateTime<Utc>) -> Input {
    let order = Order {
        order_id: "o1".into(),
        command_id: "c1".into(),
        symbol: "BTCUSDT".into(),
        side: Side::Buy,
        quantity: d(2),
        filled_quantity: d(2),
        average_fill_price: Some(d(100)),
        status: OrderStatus::Filled,
    };
    let fill = Fill {
        fill_id: "f1".into(),
        order_id: "o1".into(),
        command_id: "c1".into(),
        symbol: "BTCUSDT".into(),
        side: Side::Buy,
        quantity: d(2),
        price: d(100),
        fee: d(1),
        sequence: 1,
        at,
    };
    let position = Position {
        symbol: "BTCUSDT".into(),
        quantity: d(2),
        average_entry_price: d(100),
        mark: mark(at),
        realized_pnl: d(-1),
        unrealized_pnl: d(20),
    };
    let expected = Book {
        source_hash: ContentHash::sha256_bytes(b"independent-owned-shadow"),
        source_ref: "owned-shadow".into(),
        revision: 1,
        captured_at: at,
        seed: Seed::flat(d(1000)).unwrap(),
        orders: vec![order],
        fills: vec![fill],
        positions: vec![position],
        ledger: Ledger {
            cash: d(799),
            realized_pnl: d(-1),
            unrealized_pnl: d(20),
            exposure_gross: d(220),
            sequence: 1,
        },
    };
    let mut actual = expected.clone();
    actual.source_ref = "owned-observed".into();
    actual.source_hash = ContentHash::sha256_bytes(b"independent-owned-observed");
    Input {
        scope: scope.clone(),
        day: at.date_naive(),
        available_at: at,
        expected,
        actual,
        max_age_seconds: 900,
        tolerance: Decimal::new(1, 8),
    }
}
