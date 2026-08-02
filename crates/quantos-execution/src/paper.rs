use std::collections::BTreeMap;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{CommandId, CoreError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::TradeCommand;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Submitted,
    Accepted,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected,
    Expired,
}

impl OrderStatus {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Submitted => "submitted",
            Self::Accepted => "accepted",
            Self::PartiallyFilled => "partially_filled",
            Self::Filled => "filled",
            Self::Cancelled => "cancelled",
            Self::Rejected => "rejected",
            Self::Expired => "expired",
        }
    }

    #[must_use]
    pub const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Filled | Self::Cancelled | Self::Rejected | Self::Expired
        )
    }

    #[must_use]
    pub const fn can_transition_to(self, next: Self) -> bool {
        match self {
            Self::Submitted => matches!(next, Self::Accepted | Self::Rejected | Self::Expired),
            Self::Accepted => matches!(
                next,
                Self::PartiallyFilled | Self::Filled | Self::Cancelled | Self::Expired
            ),
            Self::PartiallyFilled => {
                matches!(next, Self::PartiallyFilled | Self::Filled | Self::Cancelled)
            }
            _ => false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OrderEventKind {
    Submitted,
    Accepted,
    Rejected { reason: String },
    PartialFill { quantity: f64, price: f64, fee: f64 },
    Filled { quantity: f64, price: f64, fee: f64 },
    Cancelled,
    CancelRejected { reason: String },
    Expired,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderEvent {
    pub sequence: u64,
    pub venue_order_id: String,
    pub occurred_at: DateTime<Utc>,
    #[serde(flatten)]
    pub kind: OrderEventKind,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrderState {
    pub venue_order_id: String,
    pub command_id: CommandId,
    pub status: OrderStatus,
    pub filled_quantity: f64,
    pub gross_value: f64,
    pub fees: f64,
}

impl OrderState {
    #[must_use]
    pub fn new(venue_order_id: impl Into<String>, command_id: CommandId) -> Self {
        Self {
            venue_order_id: venue_order_id.into(),
            command_id,
            status: OrderStatus::Submitted,
            filled_quantity: 0.0,
            gross_value: 0.0,
            fees: 0.0,
        }
    }

    #[must_use]
    pub fn average_fill_price(&self) -> Option<f64> {
        (self.filled_quantity > 0.0).then_some(self.gross_value / self.filled_quantity)
    }

    pub fn apply(&mut self, event: &OrderEvent) -> Result<(), OrderStateError> {
        let next = match &event.kind {
            OrderEventKind::Submitted => self.status,
            OrderEventKind::Accepted => OrderStatus::Accepted,
            OrderEventKind::Rejected { .. } => OrderStatus::Rejected,
            OrderEventKind::PartialFill {
                quantity,
                price,
                fee,
            } => {
                self.record_fill(*quantity, *price, *fee);
                OrderStatus::PartiallyFilled
            }
            OrderEventKind::Filled {
                quantity,
                price,
                fee,
            } => {
                self.record_fill(*quantity, *price, *fee);
                OrderStatus::Filled
            }
            OrderEventKind::Cancelled => OrderStatus::Cancelled,
            OrderEventKind::CancelRejected { .. } => self.status,
            OrderEventKind::Expired => OrderStatus::Expired,
        };
        if next != self.status && !self.status.can_transition_to(next) {
            return Err(OrderStateError::IllegalTransition {
                from: self.status.as_str().to_owned(),
                to: next.as_str().to_owned(),
            });
        }
        self.status = next;
        Ok(())
    }

    fn record_fill(&mut self, quantity: f64, price: f64, fee: f64) {
        self.filled_quantity += quantity;
        self.gross_value += quantity * price;
        self.fees += fee;
    }
}

#[derive(Debug, Error)]
pub enum OrderStateError {
    #[error("ORDER_ILLEGAL_TRANSITION: {from} -> {to}")]
    IllegalTransition { from: String, to: String },
}

#[derive(Debug, Clone, PartialEq)]
pub struct FillFact {
    pub venue_fill_id: String,
    pub venue_order_id: String,
    pub command_id: CommandId,
    pub symbol: String,
    pub side: String,
    pub quantity: f64,
    pub price: f64,
    pub fee: f64,
    pub filled_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CancelOutcome {
    Cancelled,
    Rejected { reason: String },
}

#[derive(Debug, Clone, PartialEq)]
pub struct CancelAudit {
    pub venue_order_id: String,
    pub command_id: CommandId,
    pub requested_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub outcome: CancelOutcome,
    pub latency: ChronoDuration,
}

/// TP07 boundary: the venue adapter the gateway talks to. Nautilus (TP07) will
/// implement this trait; the Paper kernel is the deterministic stand-in.
pub trait VenueAdapter {
    fn submit(&mut self, command: &TradeCommand, submitted_at: DateTime<Utc>) -> Vec<OrderEvent>;
    fn cancel(&mut self, venue_order_id: &str, requested_at: DateTime<Utc>) -> Vec<OrderEvent>;
}

/// Deterministic paper venue: acks every order, fills limit orders fully at the
/// limit price, rejects cancels for filled orders, and supports a configured
/// cancel latency so gateway audits are observable.
#[derive(Debug, Clone)]
pub struct PaperKernel {
    sequence: u64,
    cancel_latency: ChronoDuration,
    filled_orders: BTreeMap<String, bool>,
    submit_calls: u32,
    cancel_calls: u32,
}

impl Default for PaperKernel {
    fn default() -> Self {
        Self::new()
    }
}

impl PaperKernel {
    #[must_use]
    pub fn new() -> Self {
        Self {
            sequence: 0,
            cancel_latency: ChronoDuration::zero(),
            filled_orders: BTreeMap::new(),
            submit_calls: 0,
            cancel_calls: 0,
        }
    }

    #[must_use]
    pub fn with_cancel_latency(mut self, latency: ChronoDuration) -> Self {
        self.cancel_latency = latency;
        self
    }

    #[must_use]
    pub const fn submit_calls(&self) -> u32 {
        self.submit_calls
    }

    #[must_use]
    pub const fn cancel_calls(&self) -> u32 {
        self.cancel_calls
    }

    fn next_event(
        &mut self,
        venue_order_id: &str,
        occurred_at: DateTime<Utc>,
        kind: OrderEventKind,
    ) -> OrderEvent {
        self.sequence += 1;
        OrderEvent {
            sequence: self.sequence,
            venue_order_id: venue_order_id.to_owned(),
            occurred_at,
            kind,
        }
    }
}

impl VenueAdapter for PaperKernel {
    fn submit(&mut self, command: &TradeCommand, submitted_at: DateTime<Utc>) -> Vec<OrderEvent> {
        self.submit_calls += 1;
        let venue_order_id = format!("paper-order:{}", command.command_id);
        let accepted = self.next_event(&venue_order_id, submitted_at, OrderEventKind::Accepted);
        let quantity = command.quantity.parse::<f64>().unwrap_or(0.0);
        let price = command
            .limit_price
            .as_deref()
            .unwrap_or("0")
            .parse::<f64>()
            .unwrap_or(0.0);
        let filled = self.next_event(
            &venue_order_id,
            submitted_at,
            OrderEventKind::Filled {
                quantity,
                price,
                fee: 0.5,
            },
        );
        self.filled_orders.insert(venue_order_id, true);
        vec![accepted, filled]
    }

    fn cancel(&mut self, venue_order_id: &str, requested_at: DateTime<Utc>) -> Vec<OrderEvent> {
        self.cancel_calls += 1;
        let completed_at = requested_at + self.cancel_latency;
        if self
            .filled_orders
            .get(venue_order_id)
            .copied()
            .unwrap_or(false)
        {
            return vec![self.next_event(
                venue_order_id,
                completed_at,
                OrderEventKind::CancelRejected {
                    reason: "order already filled".to_owned(),
                },
            )];
        }
        vec![self.next_event(venue_order_id, completed_at, OrderEventKind::Cancelled)]
    }
}

#[derive(Debug, Error)]
pub enum GatewayError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    OrderState(#[from] OrderStateError),
    #[error("GATEWAY_ORDER_NOT_FOUND: order `{venue_order_id}` is unknown to this gateway")]
    OrderNotFound { venue_order_id: String },
}

pub struct ExecutionGateway<A: VenueAdapter> {
    adapter: A,
    orders: BTreeMap<String, OrderState>,
    order_by_command: BTreeMap<CommandId, String>,
    facts: Vec<OrderEvent>,
    fills: Vec<FillFact>,
    cancel_audits: Vec<CancelAudit>,
}

impl<A: VenueAdapter> ExecutionGateway<A> {
    #[must_use]
    pub fn new(adapter: A) -> Self {
        Self {
            adapter,
            orders: BTreeMap::new(),
            order_by_command: BTreeMap::new(),
            facts: Vec::new(),
            fills: Vec::new(),
            cancel_audits: Vec::new(),
        }
    }

    #[must_use]
    pub fn adapter(&self) -> &A {
        &self.adapter
    }

    /// Submit a signed TradeCommand. Re-submitting the same command returns the
    /// existing order without a second downstream call.
    pub fn submit(
        &mut self,
        command: &TradeCommand,
        submitted_at: DateTime<Utc>,
    ) -> Result<Vec<OrderEvent>, GatewayError> {
        if let Some(venue_order_id) = self.order_by_command.get(&command.command_id) {
            let _ = venue_order_id;
            return Ok(Vec::new());
        }
        let events = self.adapter.submit(command, submitted_at);
        let venue_order_id = events
            .first()
            .map(|event| event.venue_order_id.clone())
            .expect("paper submit emits events");
        let mut state = OrderState::new(&venue_order_id, command.command_id);
        let mut recorded = Vec::with_capacity(events.len());
        for event in events {
            state.apply(&event)?;
            self.record_fact(command, &event);
            recorded.push(event);
        }
        self.orders.insert(venue_order_id.clone(), state);
        self.order_by_command
            .insert(command.command_id, venue_order_id);
        Ok(recorded)
    }

    pub fn cancel(
        &mut self,
        command_id: CommandId,
        requested_at: DateTime<Utc>,
    ) -> Result<CancelAudit, GatewayError> {
        let venue_order_id =
            self.order_by_command
                .get(&command_id)
                .cloned()
                .ok_or(GatewayError::OrderNotFound {
                    venue_order_id: command_id.to_string(),
                })?;
        let events = self.adapter.cancel(&venue_order_id, requested_at);
        let state = self
            .orders
            .get_mut(&venue_order_id)
            .expect("order index is consistent");
        let mut outcome = CancelOutcome::Cancelled;
        let mut completed_at = requested_at;
        for event in events {
            completed_at = event.occurred_at;
            if let OrderEventKind::CancelRejected { reason } = &event.kind {
                outcome = CancelOutcome::Rejected {
                    reason: reason.clone(),
                };
            }
            state.apply(&event)?;
            self.facts.push(event);
        }
        let audit = CancelAudit {
            venue_order_id,
            command_id,
            requested_at,
            completed_at,
            latency: completed_at - requested_at,
            outcome,
        };
        self.cancel_audits.push(audit.clone());
        Ok(audit)
    }

    fn record_fact(&mut self, command: &TradeCommand, event: &OrderEvent) {
        if let OrderEventKind::Filled {
            quantity,
            price,
            fee,
        }
        | OrderEventKind::PartialFill {
            quantity,
            price,
            fee,
        } = &event.kind
        {
            self.fills.push(FillFact {
                venue_fill_id: format!("paper-fill:{}", event.sequence),
                venue_order_id: event.venue_order_id.clone(),
                command_id: command.command_id,
                symbol: command.symbol.clone(),
                side: command.side.as_str().to_owned(),
                quantity: *quantity,
                price: *price,
                fee: *fee,
                filled_at: event.occurred_at,
            });
        }
        self.facts.push(event.clone());
    }

    #[must_use]
    pub fn facts(&self) -> &[OrderEvent] {
        &self.facts
    }

    #[must_use]
    pub fn fills(&self) -> &[FillFact] {
        &self.fills
    }

    #[must_use]
    pub fn cancel_audits(&self) -> &[CancelAudit] {
        &self.cancel_audits
    }

    #[must_use]
    pub fn order(&self, venue_order_id: &str) -> Option<&OrderState> {
        self.orders.get(venue_order_id)
    }
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use quantos_core::{CommandId, ContentHash};

    use super::*;
    use crate::{OrderIntent, OrderSide, VenueKind};

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn command_fixture(command_id: CommandId, seed: u64) -> TradeCommand {
        TradeCommand {
            command_id,
            decision_id: quantos_core::DecisionId::new(),
            account_id: "paper-account-0".to_owned(),
            venue: "paper-venue".to_owned(),
            venue_kind: VenueKind::Cex,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: format!("{}.0", 1 + seed % 4),
            limit_price: Some(format!("{}.25", 100 + seed % 20)),
            stop_price: None,
            idempotency_key: format!("cmd-{seed:06}"),
            approval_signature: None,
            expires_at: now() + ChronoDuration::minutes(2),
            signature: ContentHash::sha256_bytes(format!("signature-{seed}").as_bytes()),
            issued_at: now(),
        }
    }

    #[test]
    fn one_hundred_thousand_order_events_all_transition_legally() {
        let mut gateway = ExecutionGateway::new(PaperKernel::new());
        let mut applied = 0_u64;
        for seed in 0..25_000_u64 {
            let command = command_fixture(CommandId::new(), seed);
            let events = gateway.submit(&command, now()).expect("submit succeeds");
            assert_eq!(events.len(), 2);
            applied += events.len() as u64;
        }
        for seed in 25_000_u64..50_000_u64 {
            let command = command_fixture(CommandId::new(), seed);
            let events = gateway.submit(&command, now()).expect("submit succeeds");
            applied += events.len() as u64;
        }
        assert_eq!(applied, 100_000);
        assert_eq!(gateway.facts().len(), 100_000);
        assert!(gateway.fills().iter().all(|fill| {
            fill.command_id
                == gateway
                    .order(&fill.venue_order_id)
                    .expect("order exists")
                    .command_id
        }));
    }

    #[test]
    fn duplicate_submit_only_calls_downstream_once() {
        let mut gateway = ExecutionGateway::new(PaperKernel::new());
        let command = command_fixture(CommandId::new(), 1);

        let first = gateway.submit(&command, now()).expect("first submit");
        let second = gateway
            .submit(&command, now())
            .expect("duplicate submit dedupes");
        let third = gateway
            .submit(&command, now())
            .expect("duplicate submit dedupes");

        assert_eq!(first.len(), 2);
        assert!(second.is_empty());
        assert!(third.is_empty());
        assert_eq!(gateway.adapter().submit_calls(), 1);
        assert_eq!(gateway.fills().len(), 1);
    }

    #[test]
    fn cancel_latency_and_rejections_are_auditable() {
        let mut gateway = ExecutionGateway::new(
            PaperKernel::new().with_cancel_latency(ChronoDuration::milliseconds(120)),
        );
        let command = command_fixture(CommandId::new(), 7);
        gateway.submit(&command, now()).expect("submit succeeds");

        let audit = gateway
            .cancel(command.command_id, now())
            .expect("cancel responds");
        assert!(matches!(audit.outcome, CancelOutcome::Rejected { .. }));
        assert_eq!(audit.latency, ChronoDuration::milliseconds(120));
        assert_eq!(gateway.cancel_audits().len(), 1);
        assert_eq!(gateway.adapter().cancel_calls(), 1);

        let order = gateway.order(&audit.venue_order_id).expect("order exists");
        assert_eq!(order.status, OrderStatus::Filled);
    }

    #[test]
    fn every_fill_is_traceable_to_a_command() {
        let mut gateway = ExecutionGateway::new(PaperKernel::new());
        let mut commands = Vec::new();
        for seed in 0..25_u64 {
            let command = command_fixture(CommandId::new(), seed);
            gateway.submit(&command, now()).expect("submit succeeds");
            commands.push(command);
        }

        assert_eq!(gateway.fills().len(), 25);
        let command_ids: std::collections::BTreeSet<CommandId> =
            commands.iter().map(|command| command.command_id).collect();
        for fill in gateway.fills() {
            assert!(command_ids.contains(&fill.command_id));
            assert_eq!(fill.side, "buy");
            assert!(fill.fee > 0.0);
        }
    }

    #[test]
    fn illegal_transitions_are_rejected_by_the_state_machine() {
        let mut state = OrderState::new("paper-order:x", CommandId::new());
        let terminal = OrderEvent {
            sequence: 1,
            venue_order_id: "paper-order:x".to_owned(),
            occurred_at: now(),
            kind: OrderEventKind::Rejected {
                reason: "venue reject".to_owned(),
            },
        };
        state.apply(&terminal).expect("rejection applies");
        let fill_after_reject = OrderEvent {
            sequence: 2,
            venue_order_id: "paper-order:x".to_owned(),
            occurred_at: now(),
            kind: OrderEventKind::Filled {
                quantity: 1.0,
                price: 100.0,
                fee: 0.5,
            },
        };
        let error = state
            .apply(&fill_after_reject)
            .expect_err("terminal orders cannot fill");
        assert!(matches!(error, OrderStateError::IllegalTransition { .. }));
    }
}
