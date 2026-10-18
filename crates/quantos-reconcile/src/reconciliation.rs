use crate::{legacy::BreakKind, model::*};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use quantos_core::ContentHash;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub scope: Scope,
    pub day: NaiveDate,
    pub available_at: DateTime<Utc>,
    pub expected: Book,
    pub actual: Book,
    pub max_age_seconds: i64,
    pub tolerance: Decimal,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Difference {
    pub kind: BreakKind,
    pub entity: String,
    pub expected: Value,
    pub actual: Value,
    pub expected_source: String,
    pub actual_source: String,
    pub observable_at: DateTime<Utc>,
    pub detected_at: DateTime<Utc>,
    pub latency_millis: i64,
    pub within_sla: bool,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Report {
    pub(crate) report_id: ContentHash,
    pub(crate) input: Input,
    pub(crate) checked_at: DateTime<Utc>,
    pub(crate) differences: Vec<Difference>,
    pub(crate) covered: BTreeSet<String>,
}
impl Report {
    pub fn id(&self) -> &ContentHash {
        &self.report_id
    }
    pub fn differences(&self) -> &[Difference] {
        &self.differences
    }
    pub fn input(&self) -> &Input {
        &self.input
    }
    pub fn checked_at(&self) -> DateTime<Utc> {
        self.checked_at
    }
    pub fn is_clean(&self) -> bool {
        self.differences.is_empty()
    }
    pub fn all_within_sla(&self) -> bool {
        self.differences.iter().all(|d| d.within_sla)
    }
}
/// Pure offline worker entry. It processes only supplied bytes; it is not an
/// authenticated source/closure proof and cannot mutate the exception service.
pub fn offline_check(input: &Input, now: DateTime<Utc>) -> Result<Report, Error> {
    compute(input, now)
}
pub(crate) fn compute(input: &Input, now: DateTime<Utc>) -> Result<Report, Error> {
    input.scope.validate()?;
    input.expected.validate(now)?;
    input.actual.validate(now)?;
    if input.expected.seed != input.actual.seed
        || input.expected.source_ref == input.actual.source_ref
        || input.day != input.available_at.date_naive()
        || input.available_at > now
        || input.expected.captured_at.date_naive() != input.day
        || input.actual.captured_at.date_naive() != input.day
        || input.expected.captured_at > input.available_at
        || input.actual.captured_at > input.available_at
        || !(1..=900).contains(&input.max_age_seconds)
        || input.tolerance < Decimal::ZERO
        || input.tolerance > Decimal::new(1, 6)
    {
        return Err(Error::Invalid(
            "reconciliation window, basis, source separation or tolerance",
        ));
    }
    let mut differences = vec![];
    let mut covered = BTreeSet::from([
        "orders/*".into(),
        "fills/*".into(),
        "ledger/pnl".into(),
        "ledger/cash".into(),
        "ledger/exposure_gross".into(),
        "ledger/sequence".into(),
        "ledger/freshness".into(),
    ]);
    let latency = (now - input.available_at).num_milliseconds();
    let mut push = |kind: BreakKind, entity: String, expected: Value, actual: Value| {
        if differences
            .iter()
            .any(|d: &Difference| d.kind == kind && d.entity == entity)
        {
            return;
        }
        differences.push(Difference {
            kind,
            entity,
            expected,
            actual,
            expected_source: input.expected.source_ref.clone(),
            actual_source: input.actual.source_ref.clone(),
            observable_at: input.available_at,
            detected_at: now,
            latency_millis: latency,
            within_sla: now - input.available_at <= Duration::minutes(15),
        });
    };
    let near = |a: Decimal, b: Decimal| sub(a, b).is_ok_and(|n| n.abs() <= input.tolerance);
    let eo: BTreeMap<_, _> = input
        .expected
        .orders
        .iter()
        .map(|o| (&o.order_id, o))
        .collect();
    let ao: BTreeMap<_, _> = input
        .actual
        .orders
        .iter()
        .map(|o| (&o.order_id, o))
        .collect();
    if eo.len() != ao.len() {
        push(
            BreakKind::OrderCountMismatch,
            "orders/*".into(),
            json!(eo.len()),
            json!(ao.len()),
        );
    }
    for id in eo.keys().chain(ao.keys()).collect::<BTreeSet<_>>() {
        let entity = format!("orders/{id}");
        covered.insert(entity.clone());
        match (eo.get(*id), ao.get(*id)) {
            (Some(e), Some(a)) => {
                if e.command_id != a.command_id
                    || e.symbol != a.symbol
                    || e.side != a.side
                    || e.status != a.status
                {
                    push(
                        BreakKind::OrderStatusMismatch,
                        entity.clone(),
                        json!(e),
                        json!(a),
                    );
                }
                if !near(e.quantity, a.quantity) || !near(e.filled_quantity, a.filled_quantity) {
                    push(
                        BreakKind::OrderQuantityMismatch,
                        entity.clone(),
                        json!([e.quantity, e.filled_quantity]),
                        json!([a.quantity, a.filled_quantity]),
                    );
                }
                if match (e.average_fill_price, a.average_fill_price) {
                    (Some(e), Some(a)) => !near(e, a),
                    (None, None) => false,
                    _ => true,
                } {
                    push(
                        BreakKind::OrderPriceMismatch,
                        entity.clone(),
                        json!(e.average_fill_price),
                        json!(a.average_fill_price),
                    );
                }
            }
            (e, a) => push(BreakKind::OrderMissing, entity, json!(e), json!(a)),
        }
    }
    let ef: BTreeMap<_, _> = input
        .expected
        .fills
        .iter()
        .map(|f| (&f.fill_id, f))
        .collect();
    let af: BTreeMap<_, _> = input.actual.fills.iter().map(|f| (&f.fill_id, f)).collect();
    if ef.len() != af.len() {
        push(
            BreakKind::FillCountMismatch,
            "fills/*".into(),
            json!(ef.len()),
            json!(af.len()),
        );
    }
    for id in ef.keys().chain(af.keys()).collect::<BTreeSet<_>>() {
        let entity = format!("fills/{id}");
        covered.insert(entity.clone());
        match (ef.get(*id), af.get(*id)) {
            (Some(e), Some(a)) => {
                if e.order_id != a.order_id
                    || e.command_id != a.command_id
                    || e.symbol != a.symbol
                    || e.side != a.side
                {
                    push(BreakKind::FillMissing, entity.clone(), json!(e), json!(a));
                }
                if !near(e.quantity, a.quantity) {
                    push(
                        BreakKind::FillQuantityMismatch,
                        entity.clone(),
                        json!(e.quantity),
                        json!(a.quantity),
                    );
                }
                if !near(e.price, a.price) {
                    push(
                        BreakKind::FillPriceMismatch,
                        entity.clone(),
                        json!(e.price),
                        json!(a.price),
                    );
                }
                if !near(e.fee, a.fee) {
                    push(
                        BreakKind::FillFeeMismatch,
                        entity.clone(),
                        json!(e.fee),
                        json!(a.fee),
                    );
                }
            }
            (e, a) => push(BreakKind::FillMissing, entity, json!(e), json!(a)),
        }
    }
    let ep: BTreeMap<_, _> = input
        .expected
        .positions
        .iter()
        .map(|p| (&p.symbol, p))
        .collect();
    let ap: BTreeMap<_, _> = input
        .actual
        .positions
        .iter()
        .map(|p| (&p.symbol, p))
        .collect();
    for id in ep.keys().chain(ap.keys()).collect::<BTreeSet<_>>() {
        let entity = format!("positions/{id}");
        covered.insert(entity.clone());
        match (ep.get(*id), ap.get(*id)) {
            (Some(e), Some(a)) => {
                for (kind, e, a) in [
                    (BreakKind::PositionQuantityMismatch, e.quantity, a.quantity),
                    (
                        BreakKind::PositionPriceMismatch,
                        e.average_entry_price,
                        a.average_entry_price,
                    ),
                    (
                        BreakKind::PositionRealizedMismatch,
                        e.realized_pnl,
                        a.realized_pnl,
                    ),
                    (
                        BreakKind::PositionUnrealizedMismatch,
                        e.unrealized_pnl,
                        a.unrealized_pnl,
                    ),
                ] {
                    if !near(e, a) {
                        push(kind, entity.clone(), json!(e), json!(a));
                    }
                }
                let expected = mul(a.quantity, sub(a.mark.price, a.average_entry_price)?)?;
                if !near(expected, a.unrealized_pnl) {
                    push(
                        BreakKind::PositionUnrealizedMismatch,
                        entity.clone(),
                        json!(expected),
                        json!(a.unrealized_pnl),
                    );
                }
                if !near(e.mark.price, a.mark.price) {
                    push(
                        BreakKind::PositionUnrealizedMismatch,
                        entity.clone(),
                        json!(e.mark),
                        json!(a.mark),
                    );
                }
            }
            (e, a) => push(BreakKind::PositionMissing, entity, json!(e), json!(a)),
        }
    }
    let e = &input.expected.ledger;
    let a = &input.actual.ledger;
    for (kind, e, a) in [
        (BreakKind::LedgerPnlMismatch, e.realized_pnl, a.realized_pnl),
        (
            BreakKind::LedgerPnlMismatch,
            e.unrealized_pnl,
            a.unrealized_pnl,
        ),
        (
            BreakKind::LedgerExposureMismatch,
            e.exposure_gross,
            a.exposure_gross,
        ),
        (BreakKind::LedgerBalanceMismatch, e.cash, a.cash),
    ] {
        if !near(e, a) {
            push(kind, ledger_entity(kind), json!(e), json!(a));
        }
    }
    if e.sequence != a.sequence {
        push(
            BreakKind::LedgerSequenceGap,
            ledger_entity(BreakKind::LedgerSequenceGap),
            json!(e.sequence),
            json!(a.sequence),
        );
    }
    // Independent within-book checks prevent two identically corrupt projections
    // from passing by merely agreeing with each other.
    for book in [&input.expected, &input.actual] {
        let mut positions = book.seed.positions.clone();
        let mut cash = book.seed.cash;
        let mut sequence = book.seed.sequence;
        for f in &book.fills {
            sequence = sequence.checked_add(1).ok_or(Error::Arithmetic)?;
            if f.sequence != sequence {
                push(
                    BreakKind::LedgerSequenceGap,
                    ledger_entity(BreakKind::LedgerSequenceGap),
                    json!(sequence),
                    json!(f.sequence),
                );
            }
            let fallback = Mark {
                symbol: f.symbol.clone(),
                price: f.price,
                source_ref: f.fill_id.clone(),
                sequence: f.sequence,
                source_at: f.at,
            };
            let mark = book
                .positions
                .iter()
                .find(|p| p.symbol == f.symbol)
                .map(|p| &p.mark)
                .unwrap_or(&fallback);
            apply_fill(&mut positions, &mut cash, f, mark)?;
        }
        for (symbol, derived) in &mut positions {
            let entity = format!("positions/{symbol}");
            covered.insert(entity.clone());
            if let Some(actual) = book.positions.iter().find(|p| &p.symbol == symbol) {
                derived.mark = actual.mark.clone();
                derived.unrealized_pnl = mul(
                    derived.quantity,
                    sub(derived.mark.price, derived.average_entry_price)?,
                )?;
                for (kind, expected, actual) in [
                    (
                        BreakKind::PositionQuantityMismatch,
                        derived.quantity,
                        actual.quantity,
                    ),
                    (
                        BreakKind::PositionPriceMismatch,
                        derived.average_entry_price,
                        actual.average_entry_price,
                    ),
                    (
                        BreakKind::PositionRealizedMismatch,
                        derived.realized_pnl,
                        actual.realized_pnl,
                    ),
                ] {
                    if !near(expected, actual) {
                        push(kind, entity.clone(), json!(expected), json!(actual));
                    }
                }
            } else {
                push(
                    BreakKind::PositionMissing,
                    entity,
                    json!(derived),
                    Value::Null,
                );
            }
        }
        for actual in &book.positions {
            if !positions.contains_key(&actual.symbol) {
                push(
                    BreakKind::PositionMissing,
                    format!("positions/{}", actual.symbol),
                    Value::Null,
                    json!(actual),
                );
            }
        }
        let derived = totals(&positions, cash, sequence)?;
        for (kind, expected, actual) in [
            (
                BreakKind::LedgerPnlMismatch,
                derived.realized_pnl,
                book.ledger.realized_pnl,
            ),
            (
                BreakKind::LedgerPnlMismatch,
                derived.unrealized_pnl,
                book.ledger.unrealized_pnl,
            ),
            (
                BreakKind::LedgerExposureMismatch,
                derived.exposure_gross,
                book.ledger.exposure_gross,
            ),
            (
                BreakKind::LedgerBalanceMismatch,
                derived.cash,
                book.ledger.cash,
            ),
        ] {
            if !near(expected, actual) {
                push(kind, ledger_entity(kind), json!(expected), json!(actual));
            }
        }
        if book.ledger.sequence != sequence {
            push(
                BreakKind::LedgerSequenceGap,
                ledger_entity(BreakKind::LedgerSequenceGap),
                json!(sequence),
                json!(book.ledger.sequence),
            );
        }
        for order in &book.orders {
            let valid_status = match order.status {
                OrderStatus::Filled => order.filled_quantity == order.quantity,
                OrderStatus::PartiallyFilled => {
                    order.filled_quantity > Decimal::ZERO && order.filled_quantity < order.quantity
                }
                OrderStatus::Submitted | OrderStatus::Accepted | OrderStatus::Rejected => {
                    order.filled_quantity == Decimal::ZERO
                }
                OrderStatus::Cancelled | OrderStatus::Expired => {
                    order.filled_quantity < order.quantity
                }
            };
            if !valid_status {
                push(
                    BreakKind::OrderStatusMismatch,
                    format!("orders/{}", order.order_id),
                    json!("status consistent with accumulated fills"),
                    json!(order),
                );
            }

            let fs: Vec<_> = book
                .fills
                .iter()
                .filter(|f| f.order_id == order.order_id)
                .collect();
            let quantity = fs
                .iter()
                .try_fold(Decimal::ZERO, |n, f| add(n, f.quantity))?;
            if !near(quantity, order.filled_quantity)
                || order.status == OrderStatus::Filled && !near(quantity, order.quantity)
            {
                push(
                    BreakKind::OrderQuantityMismatch,
                    format!("orders/{}", order.order_id),
                    json!(quantity),
                    json!(order.filled_quantity),
                );
            }
            let average = if quantity == Decimal::ZERO {
                None
            } else {
                let cost = fs
                    .iter()
                    .try_fold(Decimal::ZERO, |n, f| add(n, mul(f.quantity, f.price)?))?;
                Some(
                    cost.checked_div(quantity)
                        .ok_or(Error::Arithmetic)?
                        .round_dp(18),
                )
            };
            if match (average, order.average_fill_price) {
                (Some(e), Some(a)) => !near(e, a),
                (None, None) => false,
                _ => true,
            } {
                push(
                    BreakKind::OrderPriceMismatch,
                    format!("orders/{}", order.order_id),
                    json!(average),
                    json!(order.average_fill_price),
                );
            }
        }
        if now - book.captured_at > Duration::seconds(input.max_age_seconds)
            || book
                .positions
                .iter()
                .any(|p| now - p.mark.source_at > Duration::seconds(input.max_age_seconds))
        {
            push(
                BreakKind::LedgerStaleMark,
                ledger_entity(BreakKind::LedgerStaleMark),
                json!("fresh captured book and per-symbol marks"),
                json!({"source":book.source_ref,"captured_at":book.captured_at,"marks":book.positions.iter().map(|p|&p.mark).collect::<Vec<_>>()}),
            );
        }
    }
    differences.sort_by(|a, b| (&a.kind, &a.entity).cmp(&(&b.kind, &b.entity)));
    let report_id = hash(
        "quantos-x05-reconciliation-report/v1",
        &(input, now, &differences),
    );
    Ok(Report {
        report_id,
        input: input.clone(),
        checked_at: now,
        differences,
        covered,
    })
}
/// Read-only X04 + validated X01 adaptation. Scope/source provenance must be
/// supplied by the trusted backend; X04 facts alone do not encode tenant identity.
#[allow(clippy::too_many_arguments)]
pub fn from_x04_portfolio(
    scope: &Scope,
    facts: &[quantos_execution::oms::OrderFact],
    anchor: &quantos_execution::oms::FactAnchor,
    portfolio: &quantos_portfolio::PortfolioSnapshot,
    seed: Seed,
    cash: Decimal,
    revision: u64,
    captured_at: DateTime<Utc>,
) -> Result<Book, Error> {
    use quantos_execution::{
        gateway::{ExecutionGateway, NautilusBoundaryAdapter},
        oms::FactKind,
    };
    portfolio
        .validate()
        .map_err(|_| Error::Invalid("X01 snapshot integrity"))?;
    if portfolio.tenant_id != scope.tenant_id || portfolio.account_id != scope.account_id {
        return Err(Error::Unauthorized);
    }
    let replay = ExecutionGateway::<NautilusBoundaryAdapter>::replay_facts(facts, anchor)
        .map_err(|_| Error::Invalid("X04 fact anchor or transition"))?;
    let ids: BTreeSet<_> = facts
        .iter()
        .filter_map(|f| {
            if matches!(f.content, FactKind::Submitted { .. }) {
                Some(&f.order_id)
            } else {
                None
            }
        })
        .collect();
    let mut orders = vec![];
    for id in ids {
        let o = replay
            .order(id)
            .ok_or(Error::Invalid("missing replayed order"))?;
        if o.account_id != scope.account_id.to_string() {
            return Err(Error::Unauthorized);
        }
        orders.push(Order {
            order_id: o.order_id.clone(),
            command_id: o.command_id.clone(),
            symbol: o.symbol.clone(),
            side: match o.side.as_str() {
                "buy" => quantos_risk::guard::Side::Buy,
                "sell" => quantos_risk::guard::Side::Sell,
                _ => return Err(Error::Invalid("X04 side")),
            },
            quantity: o
                .quantity
                .parse()
                .map_err(|_| Error::Invalid("X04 quantity"))?,
            filled_quantity: o
                .filled_quantity
                .parse()
                .map_err(|_| Error::Invalid("X04 filled quantity"))?,
            average_fill_price: o
                .average_fill_price
                .as_deref()
                .map(str::parse)
                .transpose()
                .map_err(|_| Error::Invalid("X04 price"))?,
            status: serde_json::from_value(json!(o.status))
                .map_err(|_| Error::Invalid("X04 status"))?,
        });
    }
    let fills = replay
        .fills()
        .iter()
        .enumerate()
        .map(|(i, f)| {
            let o = orders
                .iter()
                .find(|o| o.order_id == f.order_id)
                .ok_or(Error::Invalid("X04 fill order"))?;
            // A zero amount carries no currency conversion. Real nonzero fees
            // must use the declared quote unit; this adapter never performs FX.
            let fee = f
                .fee_amount
                .parse::<Decimal>()
                .map_err(|_| Error::Invalid("fill fee"))?;
            if f.command_id != o.command_id
                || (fee != Decimal::ZERO && f.fee_currency != scope.quote_unit)
            {
                return Err(Error::Invalid("X04 fill quote or command binding"));
            }
            Ok(Fill {
                fill_id: f.fill_id.clone(),
                order_id: f.order_id.clone(),
                command_id: f.command_id.clone(),
                symbol: f.symbol.clone(),
                side: o.side,
                quantity: f
                    .quantity
                    .parse()
                    .map_err(|_| Error::Invalid("fill quantity"))?,
                price: f.price.parse().map_err(|_| Error::Invalid("fill price"))?,
                fee,
                sequence: seed
                    .sequence
                    .checked_add(i as u64 + 1)
                    .ok_or(Error::Arithmetic)?,
                at: f.filled_at,
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let positions = portfolio_positions(portfolio)?;
    let sequence = seed
        .sequence
        .checked_add(fills.len() as u64)
        .ok_or(Error::Arithmetic)?;
    let book = Book {
        source_hash: hash(
            "quantos-x05-source-pair/v1",
            &(anchor, &portfolio.snapshot_hash, cash),
        ),
        source_ref: "x04-oms-x01-portfolio".into(),
        revision,
        captured_at,
        seed,
        orders,
        fills,
        positions,
        ledger: Ledger {
            cash,
            realized_pnl: float(portfolio.realized_pnl)?,
            unrealized_pnl: float(portfolio.unrealized_pnl)?,
            exposure_gross: float(portfolio.exposure_gross)?,
            sequence,
        },
    };
    book.validate(captured_at)?;
    Ok(book)
}

fn ledger_entity(kind: BreakKind) -> String {
    match kind {
        BreakKind::LedgerPnlMismatch => "ledger/pnl",
        BreakKind::LedgerExposureMismatch => "ledger/exposure_gross",
        BreakKind::LedgerBalanceMismatch => "ledger/cash",
        BreakKind::LedgerSequenceGap => "ledger/sequence",
        BreakKind::LedgerStaleMark => "ledger/freshness",
        _ => "ledger/*",
    }
    .into()
}
