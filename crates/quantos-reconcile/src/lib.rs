use std::collections::BTreeMap;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_execution::paper::{FillFact, OrderState};
use quantos_portfolio::PortfolioSnapshot;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const RECONCILER_VERSION: &str = "quantos-reconcile.v1";
pub const BREAK_DETECTION_SLA: ChronoDuration = ChronoDuration::minutes(15);

// ---------------------------------------------------------------------------
// Shadow runner: produces comparison advice against live market data without
// any venue submission path. The struct intentionally holds no venue adapter,
// so a shadow session cannot call submit at the type level.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShadowAdvice {
    pub advice_id: String,
    pub symbol: String,
    pub side: String,
    pub quantity: f64,
    pub limit_price: f64,
    pub generated_at: DateTime<Utc>,
    /// Always `false`; shadow advice never reaches a venue.
    pub submitted_to_venue: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShadowPositionSnapshot {
    pub symbol: String,
    pub quantity: f64,
    pub average_entry_price: f64,
    pub realized_pnl: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShadowDaySnapshot {
    pub day: u32,
    pub positions: Vec<ShadowPositionSnapshot>,
    pub realized_pnl: f64,
    pub balance: f64,
    pub exposure_gross: f64,
    pub advice_count: u32,
    pub last_sequence: u64,
    pub as_of: DateTime<Utc>,
}

#[derive(Debug, Clone, Default)]
pub struct ShadowRunner {
    advice_log: Vec<ShadowAdvice>,
    positions: BTreeMap<String, ShadowPositionSnapshot>,
    realized_pnl: f64,
    balance: f64,
    exposure_gross: f64,
    last_sequence: u64,
}

impl ShadowRunner {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a comparison advice. `submitted_to_venue` is forced to `false`;
    /// there is no API path that can flip it.
    pub fn record_advice(&mut self, mut advice: ShadowAdvice) {
        advice.submitted_to_venue = false;
        self.advice_log.push(advice);
    }

    /// Simulate a fill against the shadow ledger only (virtual accounting).
    pub fn simulate_fill(&mut self, symbol: &str, side: &str, quantity: f64, price: f64, fee: f64) {
        let signed = if side == "buy" { quantity } else { -quantity };
        let position = self
            .positions
            .entry(symbol.to_owned())
            .or_insert(ShadowPositionSnapshot {
                symbol: symbol.to_owned(),
                quantity: 0.0,
                average_entry_price: 0.0,
                realized_pnl: 0.0,
            });
        let current = position.quantity;
        if current == 0.0 || current.signum() == signed.signum() {
            let next = current + signed;
            position.average_entry_price = if next.abs() > 0.0 {
                (current * position.average_entry_price + signed * price) / next
            } else {
                0.0
            };
            position.quantity = next;
        } else {
            let closing = signed.abs().min(current.abs());
            position.realized_pnl +=
                closing * (price - position.average_entry_price) * current.signum();
            let next = current + signed;
            position.average_entry_price = if next == 0.0 {
                0.0
            } else if next.signum() != current.signum() {
                price
            } else {
                position.average_entry_price
            };
            position.quantity = next;
        }
        position.realized_pnl -= fee;
        self.realized_pnl = self.positions.values().map(|p| p.realized_pnl).sum();
        self.balance += signed * -price - fee;
        self.exposure_gross = self
            .positions
            .values()
            .map(|p| (p.quantity * p.average_entry_price).abs())
            .sum();
        self.last_sequence += 1;
    }

    #[must_use]
    pub fn advice_log(&self) -> &[ShadowAdvice] {
        &self.advice_log
    }

    #[must_use]
    pub fn day_snapshot(&self, day: u32, as_of: DateTime<Utc>) -> ShadowDaySnapshot {
        let mut positions: Vec<_> = self
            .positions
            .values()
            .filter(|position| position.quantity != 0.0 || position.realized_pnl != 0.0)
            .cloned()
            .collect();
        positions.sort_by(|left, right| left.symbol.cmp(&right.symbol));
        ShadowDaySnapshot {
            day,
            positions,
            realized_pnl: self.realized_pnl,
            balance: self.balance,
            exposure_gross: self.exposure_gross,
            advice_count: self.advice_log.len() as u32,
            last_sequence: self.last_sequence,
            as_of,
        }
    }
}

// ---------------------------------------------------------------------------
// Reconciler: end-of-day comparison across orders, fills, positions, and the
// shadow ledger. Twenty break kinds, each detectable and locatable.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BreakKind {
    OrderCountMismatch,
    OrderStatusMismatch,
    OrderQuantityMismatch,
    OrderPriceMismatch,
    OrderMissing,
    FillCountMismatch,
    FillQuantityMismatch,
    FillPriceMismatch,
    FillFeeMismatch,
    FillMissing,
    PositionQuantityMismatch,
    PositionPriceMismatch,
    PositionMissing,
    PositionUnrealizedMismatch,
    PositionRealizedMismatch,
    LedgerPnlMismatch,
    LedgerExposureMismatch,
    LedgerBalanceMismatch,
    LedgerSequenceGap,
    LedgerStaleMark,
}

impl BreakKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OrderCountMismatch => "order_count_mismatch",
            Self::OrderStatusMismatch => "order_status_mismatch",
            Self::OrderQuantityMismatch => "order_quantity_mismatch",
            Self::OrderPriceMismatch => "order_price_mismatch",
            Self::OrderMissing => "order_missing",
            Self::FillCountMismatch => "fill_count_mismatch",
            Self::FillQuantityMismatch => "fill_quantity_mismatch",
            Self::FillPriceMismatch => "fill_price_mismatch",
            Self::FillFeeMismatch => "fill_fee_mismatch",
            Self::FillMissing => "fill_missing",
            Self::PositionQuantityMismatch => "position_quantity_mismatch",
            Self::PositionPriceMismatch => "position_price_mismatch",
            Self::PositionMissing => "position_missing",
            Self::PositionUnrealizedMismatch => "position_unrealized_mismatch",
            Self::PositionRealizedMismatch => "position_realized_mismatch",
            Self::LedgerPnlMismatch => "ledger_pnl_mismatch",
            Self::LedgerExposureMismatch => "ledger_exposure_mismatch",
            Self::LedgerBalanceMismatch => "ledger_balance_mismatch",
            Self::LedgerSequenceGap => "ledger_sequence_gap",
            Self::LedgerStaleMark => "ledger_stale_mark",
        }
    }

    #[must_use]
    pub const fn all() -> &'static [Self] {
        &[
            Self::OrderCountMismatch,
            Self::OrderStatusMismatch,
            Self::OrderQuantityMismatch,
            Self::OrderPriceMismatch,
            Self::OrderMissing,
            Self::FillCountMismatch,
            Self::FillQuantityMismatch,
            Self::FillPriceMismatch,
            Self::FillFeeMismatch,
            Self::FillMissing,
            Self::PositionQuantityMismatch,
            Self::PositionPriceMismatch,
            Self::PositionMissing,
            Self::PositionUnrealizedMismatch,
            Self::PositionRealizedMismatch,
            Self::LedgerPnlMismatch,
            Self::LedgerExposureMismatch,
            Self::LedgerBalanceMismatch,
            Self::LedgerSequenceGap,
            Self::LedgerStaleMark,
        ]
    }
}

impl std::fmt::Display for BreakKind {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReconciliationBreak {
    pub kind: BreakKind,
    pub day: u32,
    pub detail: String,
    pub detected_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReconciliationReport {
    pub day: u32,
    pub checked_at: DateTime<Utc>,
    pub breaks: Vec<ReconciliationBreak>,
}

impl ReconciliationReport {
    #[must_use]
    pub fn unexplained_count(&self) -> usize {
        self.breaks.len()
    }
}

#[derive(Debug, Clone)]
pub struct DayEndBundle {
    pub orders: Vec<OrderState>,
    pub expected_orders: Vec<OrderState>,
    pub fills: Vec<FillFact>,
    pub expected_fills: Vec<FillFact>,
    pub positions: PortfolioSnapshot,
    pub shadow: ShadowDaySnapshot,
    pub expected_balance: f64,
    pub expected_sequence: u64,
    pub mark_staleness_limit: ChronoDuration,
}

#[derive(Debug, Error)]
pub enum ReconcileError {
    #[error("RECONCILE_INPUT_INVALID: {detail}")]
    InvalidInput { detail: String },
}

pub fn reconcile_day(
    bundle: &DayEndBundle,
    day: u32,
    checked_at: DateTime<Utc>,
) -> Result<ReconciliationReport, ReconcileError> {
    let mut breaks = Vec::new();
    let mut push = |kind: BreakKind, detail: String| {
        breaks.push(ReconciliationBreak {
            kind,
            day,
            detail,
            detected_at: checked_at,
        });
    };

    // -- orders -----------------------------------------------------------
    let actual_ids: std::collections::BTreeSet<&str> = bundle
        .orders
        .iter()
        .map(|order| order.venue_order_id.as_str())
        .collect();
    for expected in &bundle.expected_orders {
        if !actual_ids.contains(expected.venue_order_id.as_str()) {
            push(
                BreakKind::OrderMissing,
                format!("expected order `{}` is missing", expected.venue_order_id),
            );
        }
    }
    if bundle.orders.len() != bundle.expected_orders.len() {
        push(
            BreakKind::OrderCountMismatch,
            format!(
                "order count {} != expected {}",
                bundle.orders.len(),
                bundle.expected_orders.len()
            ),
        );
    }
    for expected in &bundle.expected_orders {
        let Some(actual) = bundle
            .orders
            .iter()
            .find(|order| order.venue_order_id == expected.venue_order_id)
        else {
            continue;
        };
        if actual.status != expected.status {
            push(
                BreakKind::OrderStatusMismatch,
                format!(
                    "order `{}` status {:?} != expected {:?}",
                    actual.venue_order_id, actual.status, expected.status
                ),
            );
        }
        if !approx(actual.filled_quantity, expected.filled_quantity) {
            push(
                BreakKind::OrderQuantityMismatch,
                format!(
                    "order `{}` filled {} != expected {}",
                    actual.venue_order_id, actual.filled_quantity, expected.filled_quantity
                ),
            );
        }
        if !approx(actual.gross_value, expected.gross_value) {
            push(
                BreakKind::OrderPriceMismatch,
                format!(
                    "order `{}` gross value {:.4} != expected {:.4}",
                    actual.venue_order_id, actual.gross_value, expected.gross_value
                ),
            );
        }
    }

    // -- fills ------------------------------------------------------------
    let actual_fill_ids: std::collections::BTreeSet<&str> = bundle
        .fills
        .iter()
        .map(|fill| fill.venue_fill_id.as_str())
        .collect();
    for expected in &bundle.expected_fills {
        if !actual_fill_ids.contains(expected.venue_fill_id.as_str()) {
            push(
                BreakKind::FillMissing,
                format!("expected fill `{}` is missing", expected.venue_fill_id),
            );
        }
    }
    if bundle.fills.len() != bundle.expected_fills.len() {
        push(
            BreakKind::FillCountMismatch,
            format!(
                "fill count {} != expected {}",
                bundle.fills.len(),
                bundle.expected_fills.len()
            ),
        );
    }
    for expected in &bundle.expected_fills {
        let Some(actual) = bundle
            .fills
            .iter()
            .find(|fill| fill.venue_fill_id == expected.venue_fill_id)
        else {
            continue;
        };
        if !approx(actual.quantity, expected.quantity) {
            push(
                BreakKind::FillQuantityMismatch,
                format!(
                    "fill `{}` quantity {} != expected {}",
                    actual.venue_fill_id, actual.quantity, expected.quantity
                ),
            );
        }
        if !approx(actual.price, expected.price) {
            push(
                BreakKind::FillPriceMismatch,
                format!(
                    "fill `{}` price {:.4} != expected {:.4}",
                    actual.venue_fill_id, actual.price, expected.price
                ),
            );
        }
        if !approx(actual.fee, expected.fee) {
            push(
                BreakKind::FillFeeMismatch,
                format!(
                    "fill `{}` fee {:.4} != expected {:.4}",
                    actual.venue_fill_id, actual.fee, expected.fee
                ),
            );
        }
    }

    // -- positions vs shadow ledger ---------------------------------------
    for shadow_position in &bundle.shadow.positions {
        let Some(actual) = bundle
            .positions
            .positions
            .iter()
            .find(|position| position.symbol == shadow_position.symbol)
        else {
            push(
                BreakKind::PositionMissing,
                format!(
                    "shadow position `{}` missing from portfolio",
                    shadow_position.symbol
                ),
            );
            continue;
        };
        if !approx(actual.quantity, shadow_position.quantity) {
            push(
                BreakKind::PositionQuantityMismatch,
                format!(
                    "position `{}` quantity {} != shadow {}",
                    actual.symbol, actual.quantity, shadow_position.quantity
                ),
            );
        }
        if !approx(
            actual.average_entry_price,
            shadow_position.average_entry_price,
        ) {
            push(
                BreakKind::PositionPriceMismatch,
                format!(
                    "position `{}` entry {:.4} != shadow {:.4}",
                    actual.symbol, actual.average_entry_price, shadow_position.average_entry_price
                ),
            );
        }
        if !approx(actual.realized_pnl, shadow_position.realized_pnl) {
            push(
                BreakKind::PositionRealizedMismatch,
                format!(
                    "position `{}` realized {:.4} != shadow {:.4}",
                    actual.symbol, actual.realized_pnl, shadow_position.realized_pnl
                ),
            );
        }
        let expected_unrealized =
            actual.quantity * (actual.mark_price - actual.average_entry_price);
        if !approx(actual.unrealized_pnl, expected_unrealized) {
            push(
                BreakKind::PositionUnrealizedMismatch,
                format!(
                    "position `{}` unrealized {:.4} != expected {:.4}",
                    actual.symbol, actual.unrealized_pnl, expected_unrealized
                ),
            );
        }
    }

    // -- ledger -----------------------------------------------------------
    if !approx(bundle.positions.realized_pnl, bundle.shadow.realized_pnl) {
        push(
            BreakKind::LedgerPnlMismatch,
            format!(
                "portfolio realized {:.4} != shadow realized {:.4}",
                bundle.positions.realized_pnl, bundle.shadow.realized_pnl
            ),
        );
    }
    if !approx(
        bundle.positions.exposure_gross,
        bundle.shadow.exposure_gross,
    ) {
        push(
            BreakKind::LedgerExposureMismatch,
            format!(
                "portfolio exposure {:.4} != shadow exposure {:.4}",
                bundle.positions.exposure_gross, bundle.shadow.exposure_gross
            ),
        );
    }
    if !approx(bundle.shadow.balance, bundle.expected_balance) {
        push(
            BreakKind::LedgerBalanceMismatch,
            format!(
                "shadow balance {:.4} != expected {:.4}",
                bundle.shadow.balance, bundle.expected_balance
            ),
        );
    }
    if bundle.shadow.last_sequence != bundle.expected_sequence {
        push(
            BreakKind::LedgerSequenceGap,
            format!(
                "shadow sequence {} != expected {}",
                bundle.shadow.last_sequence, bundle.expected_sequence
            ),
        );
    }
    if checked_at - bundle.shadow.as_of > bundle.mark_staleness_limit
        || checked_at - bundle.positions.as_of > bundle.mark_staleness_limit
    {
        push(
            BreakKind::LedgerStaleMark,
            "portfolio or shadow marks are stale at end of day".to_owned(),
        );
    }

    Ok(ReconciliationReport {
        day,
        checked_at,
        breaks,
    })
}

fn approx(left: f64, right: f64) -> bool {
    (left - right).abs() <= 1e-6 * left.abs().max(right.abs()).max(1.0)
}

// ---------------------------------------------------------------------------
// Exception queue: open -> acknowledged -> closed lifecycle.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExceptionStatus {
    Open,
    Acknowledged,
    Closed,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExceptionRecord {
    pub exception_id: u64,
    pub day: u32,
    pub kind: BreakKind,
    pub detail: String,
    pub detected_at: DateTime<Utc>,
    pub status: ExceptionStatus,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub resolution: Option<String>,
}

#[derive(Debug, Error)]
pub enum ExceptionError {
    #[error("EXCEPTION_NOT_FOUND: exception `{exception_id}` is unknown")]
    NotFound { exception_id: u64 },
    #[error("EXCEPTION_INVALID_TRANSITION: cannot {action} exception in status `{status:?}`")]
    InvalidTransition {
        action: &'static str,
        status: ExceptionStatus,
    },
}

#[derive(Debug, Default)]
pub struct ExceptionQueue {
    records: Vec<ExceptionRecord>,
    next_id: u64,
}

impl ExceptionQueue {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn enqueue(&mut self, record_break: &ReconciliationBreak) -> u64 {
        self.next_id += 1;
        self.records.push(ExceptionRecord {
            exception_id: self.next_id,
            day: record_break.day,
            kind: record_break.kind,
            detail: record_break.detail.clone(),
            detected_at: record_break.detected_at,
            status: ExceptionStatus::Open,
            acknowledged_at: None,
            closed_at: None,
            resolution: None,
        });
        self.next_id
    }

    pub fn acknowledge(
        &mut self,
        exception_id: u64,
        acknowledged_at: DateTime<Utc>,
    ) -> Result<(), ExceptionError> {
        let record = self
            .records
            .iter_mut()
            .find(|record| record.exception_id == exception_id)
            .ok_or(ExceptionError::NotFound { exception_id })?;
        if record.status != ExceptionStatus::Open {
            return Err(ExceptionError::InvalidTransition {
                action: "acknowledge",
                status: record.status,
            });
        }
        record.status = ExceptionStatus::Acknowledged;
        record.acknowledged_at = Some(acknowledged_at);
        Ok(())
    }

    pub fn close(
        &mut self,
        exception_id: u64,
        resolution: impl Into<String>,
        closed_at: DateTime<Utc>,
    ) -> Result<(), ExceptionError> {
        let record = self
            .records
            .iter_mut()
            .find(|record| record.exception_id == exception_id)
            .ok_or(ExceptionError::NotFound { exception_id })?;
        if record.status != ExceptionStatus::Acknowledged {
            return Err(ExceptionError::InvalidTransition {
                action: "close",
                status: record.status,
            });
        }
        record.status = ExceptionStatus::Closed;
        record.closed_at = Some(closed_at);
        record.resolution = Some(resolution.into());
        Ok(())
    }

    #[must_use]
    pub fn open_count(&self) -> usize {
        self.records
            .iter()
            .filter(|record| record.status != ExceptionStatus::Closed)
            .count()
    }

    #[must_use]
    pub fn records(&self) -> &[ExceptionRecord] {
        &self.records
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{AccountId, CommandId, ContentHash, TenantId};
    use quantos_execution::paper::{FillFact, OrderStatus};
    use quantos_portfolio::{PortfolioSnapshot, PositionSnapshot};

    use super::*;

    fn day_start(day: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
            + ChronoDuration::days(i64::from(day))
    }

    fn clean_bundle(day: u32) -> DayEndBundle {
        let as_of = day_start(day) + ChronoDuration::hours(16);
        let command_id = CommandId::new();
        let order = OrderState {
            venue_order_id: "paper-order:1".to_owned(),
            command_id,
            status: OrderStatus::Filled,
            filled_quantity: 2.0,
            gross_value: 200.0,
            fees: 0.5,
        };
        let fill = FillFact {
            venue_fill_id: "paper-fill:1".to_owned(),
            venue_order_id: "paper-order:1".to_owned(),
            command_id,
            symbol: "BTCUSDT".to_owned(),
            side: "buy".to_owned(),
            quantity: 2.0,
            price: 100.0,
            fee: 0.5,
            filled_at: as_of,
        };
        let positions = PortfolioSnapshot {
            tenant_id: TenantId::new(),
            account_id: AccountId::new(),
            positions: vec![PositionSnapshot {
                symbol: "BTCUSDT".to_owned(),
                quantity: 2.0,
                average_entry_price: 100.0,
                mark_price: 110.0,
                market_value: 220.0,
                unrealized_pnl: 20.0,
                realized_pnl: -0.5,
            }],
            realized_pnl: -0.5,
            unrealized_pnl: 20.0,
            exposure_gross: 200.0,
            exposure_net: 220.0,
            last_event_sequence: 1,
            as_of,
            snapshot_hash: ContentHash::sha256_bytes(b"clean-bundle"),
        };
        let shadow = ShadowDaySnapshot {
            day,
            positions: vec![ShadowPositionSnapshot {
                symbol: "BTCUSDT".to_owned(),
                quantity: 2.0,
                average_entry_price: 100.0,
                realized_pnl: -0.5,
            }],
            realized_pnl: -0.5,
            balance: -200.5,
            exposure_gross: 200.0,
            advice_count: 1,
            last_sequence: 1,
            as_of,
        };
        DayEndBundle {
            orders: vec![order.clone()],
            expected_orders: vec![order],
            fills: vec![fill.clone()],
            expected_fills: vec![fill],
            positions,
            shadow,
            expected_balance: -200.5,
            expected_sequence: 1,
            mark_staleness_limit: ChronoDuration::hours(12),
        }
    }

    #[test]
    fn ten_consecutive_shadow_days_reconcile_with_zero_unexplained_breaks() {
        let mut all_advice = Vec::new();
        for day in 0..10_u32 {
            let day_at = day_start(day);
            let mut runner = ShadowRunner::new();
            runner.record_advice(ShadowAdvice {
                advice_id: format!("shadow-advice-{day}"),
                symbol: "BTCUSDT".to_owned(),
                side: "buy".to_owned(),
                quantity: 2.0,
                limit_price: 100.0,
                generated_at: day_at + ChronoDuration::hours(9),
                submitted_to_venue: true, // must be forced back to false by the runner
            });
            runner.simulate_fill("BTCUSDT", "buy", 2.0, 100.0, 0.5);
            all_advice.extend_from_slice(runner.advice_log());

            let mut bundle = clean_bundle(day);
            bundle.shadow = runner.day_snapshot(day, day_at + ChronoDuration::hours(16));
            bundle.expected_balance = bundle.shadow.balance;
            bundle.expected_sequence = bundle.shadow.last_sequence;

            let report = reconcile_day(&bundle, day, day_at + ChronoDuration::hours(17))
                .expect("reconcile succeeds");
            assert_eq!(
                report.unexplained_count(),
                0,
                "day {day} must reconcile with zero unexplained breaks: {:?}",
                report.breaks
            );
        }

        assert_eq!(all_advice.len(), 10);
        assert!(
            all_advice.iter().all(|advice| !advice.submitted_to_venue),
            "shadow advice must never reach a venue"
        );
    }

    #[test]
    fn twenty_injected_breaks_are_detected_and_located_within_sla() {
        let day = 3_u32;
        let injected_at = day_start(day) + ChronoDuration::hours(15);
        let checked_at = injected_at + ChronoDuration::minutes(10);

        let mut detected: std::collections::BTreeSet<BreakKind> = std::collections::BTreeSet::new();
        for kind in BreakKind::all() {
            let mut bundle = clean_bundle(day);
            match kind {
                BreakKind::OrderCountMismatch => {
                    bundle
                        .expected_orders
                        .push(bundle.expected_orders[0].clone());
                    bundle.expected_orders[1].venue_order_id = "paper-order:2".to_owned();
                }
                BreakKind::OrderStatusMismatch => {
                    bundle.expected_orders[0].status = OrderStatus::Cancelled;
                }
                BreakKind::OrderQuantityMismatch => {
                    bundle.expected_orders[0].filled_quantity = 1.0;
                }
                BreakKind::OrderPriceMismatch => {
                    bundle.expected_orders[0].gross_value = 190.0;
                }
                BreakKind::OrderMissing => {
                    bundle.orders.clear();
                }
                BreakKind::FillCountMismatch => {
                    bundle.expected_fills.push(bundle.expected_fills[0].clone());
                    bundle.expected_fills[1].venue_fill_id = "paper-fill:2".to_owned();
                }
                BreakKind::FillQuantityMismatch => {
                    bundle.expected_fills[0].quantity = 1.0;
                }
                BreakKind::FillPriceMismatch => {
                    bundle.expected_fills[0].price = 99.0;
                }
                BreakKind::FillFeeMismatch => {
                    bundle.expected_fills[0].fee = 1.5;
                }
                BreakKind::FillMissing => {
                    bundle.fills.clear();
                }
                BreakKind::PositionQuantityMismatch => {
                    bundle.positions.positions[0].quantity = 1.0;
                }
                BreakKind::PositionPriceMismatch => {
                    bundle.positions.positions[0].average_entry_price = 101.0;
                }
                BreakKind::PositionMissing => {
                    bundle.positions.positions.clear();
                }
                BreakKind::PositionUnrealizedMismatch => {
                    bundle.positions.positions[0].unrealized_pnl = 25.0;
                }
                BreakKind::PositionRealizedMismatch => {
                    bundle.positions.positions[0].realized_pnl = -1.5;
                }
                BreakKind::LedgerPnlMismatch => {
                    bundle.positions.realized_pnl = 5.0;
                }
                BreakKind::LedgerExposureMismatch => {
                    bundle.positions.exposure_gross = 250.0;
                }
                BreakKind::LedgerBalanceMismatch => {
                    bundle.expected_balance = -199.5;
                }
                BreakKind::LedgerSequenceGap => {
                    bundle.expected_sequence = 2;
                }
                BreakKind::LedgerStaleMark => {
                    bundle.shadow.as_of = checked_at - ChronoDuration::hours(24);
                }
            }

            let report = reconcile_day(&bundle, day, checked_at).expect("reconcile succeeds");
            let located = report
                .breaks
                .iter()
                .find(|record_break| record_break.kind == *kind)
                .unwrap_or_else(|| panic!("break kind {kind} was not detected"));
            assert!(
                located.detected_at - injected_at <= BREAK_DETECTION_SLA,
                "break {kind} detected outside the 15 minute SLA"
            );
            assert!(!located.detail.is_empty());
            assert_eq!(located.day, day);
            detected.insert(*kind);
        }
        assert_eq!(detected.len(), 20);
    }

    #[test]
    fn exception_queue_enforces_acknowledge_then_close_lifecycle() {
        let day = 1_u32;
        let mut bundle = clean_bundle(day);
        bundle.expected_balance = 0.0;
        let report = reconcile_day(&bundle, day, day_start(day) + ChronoDuration::hours(17))
            .expect("reconcile succeeds");
        assert_eq!(report.breaks.len(), 1);

        let mut queue = ExceptionQueue::new();
        let exception_id = queue.enqueue(&report.breaks[0]);
        assert_eq!(queue.open_count(), 1);

        let premature = queue
            .close(
                exception_id,
                "fixed",
                day_start(day) + ChronoDuration::hours(18),
            )
            .expect_err("cannot close before acknowledge");
        assert!(matches!(
            premature,
            ExceptionError::InvalidTransition { .. }
        ));

        queue
            .acknowledge(exception_id, day_start(day) + ChronoDuration::hours(18))
            .expect("acknowledge succeeds");
        queue
            .close(
                exception_id,
                "ledger balance corrected after replay fix",
                day_start(day) + ChronoDuration::hours(19),
            )
            .expect("close succeeds");
        assert_eq!(queue.open_count(), 0);

        let record = &queue.records()[0];
        assert_eq!(record.status, ExceptionStatus::Closed);
        assert!(record.resolution.is_some());
        assert!(record.closed_at > record.acknowledged_at);
    }
}
