#![allow(dead_code)]
#[path = "../../../quantos-execution/tests/support/tp07_fixture.rs"]
pub mod fixture;
use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, ContentHash, TenantId, WorkspaceId};
use quantos_policy::{Capability, Role, RunMode};
use quantos_reconcile::{model::*, reconciliation::Input};
use quantos_risk::guard::Side;
use rust_decimal::Decimal;
use std::collections::{BTreeMap, BTreeSet};
pub fn d(n: i64) -> Decimal {
    Decimal::new(n, 0)
}
pub fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-19T08:00:00Z")
        .unwrap()
        .with_timezone(&Utc)
}
pub fn auth_scope() -> (AuthContext, Scope) {
    let scope = Scope {
        tenant_id: TenantId::new(),
        workspace_id: WorkspaceId::new(),
        account_id: AccountId::new(),
        quote_unit: "USDT".into(),
    };
    let a = AuthContext {
        tenant_id: scope.tenant_id,
        actor_id: ActorId::new(),
        user_id: uuid::Uuid::new_v4(),
        workspace_id: scope.workspace_id,
        workspace_slug: "owned".into(),
        workspace_name: "Owned".into(),
        role: Role::Operator,
        mode: RunMode::Shadow,
        account_id: Some(scope.account_id),
        capabilities: BTreeSet::from([Capability::parse(Capability::EXECUTION_OPERATE).unwrap()]),
    };
    (a, scope)
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
pub fn refresh(input: &mut Input, at: DateTime<Utc>) {
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
pub fn corrupt(input: &mut Input, kind: quantos_reconcile::BreakKind) {
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
pub fn fact_chain(
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
pub fn x04_id(prefix: &str, seed: &str) -> String {
    let h = ContentHash::sha256_bytes(
        &quantos_core::canonical_json_bytes(&serde_json::json!({"prefix":prefix,"seed":seed}))
            .unwrap(),
    );
    format!("{prefix}:{}", h.as_str().trim_start_matches("sha256:"))
}
pub fn position_map(p: Position) -> BTreeMap<String, Position> {
    BTreeMap::from([(p.symbol.clone(), p)])
}
