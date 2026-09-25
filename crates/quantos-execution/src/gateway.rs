//! TP07 execution gateway: pre-boundary interception, idempotent downstream
//! submission, kernel isolation, and Order/Fill event mapping back to the
//! QuantOS-owned schema.
//!
//! The gateway is the only path from an issued [`TradeCommand`] to an
//! execution kernel. Kernels (paper, Nautilus boundary adapter) receive only
//! sanitized [`BoundaryCommand`] values — never tenant, actor, session,
//! decision, or approval context.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use quantos_core::{ContentHash, Quantity, canonical_json_bytes};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

use crate::{OrderIntent, TradeCommand};

/// Limits enforced before any command crosses the kernel boundary.
#[derive(Debug, Clone, PartialEq)]
pub struct GatewayLimits {
    pub max_quantity: Decimal,
    pub max_notional: Decimal,
    pub allowed_venues: Vec<String>,
}

/// Sanitized wire command handed to execution kernels.
///
/// Deliberately excludes tenant, actor, session, decision, approval, and
/// signature material so kernels can never touch Agent or user session state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BoundaryCommand {
    pub command_id: String,
    pub account_id: String,
    pub venue: String,
    pub venue_kind: String,
    pub symbol: String,
    pub intent: String,
    pub side: String,
    pub quantity: String,
    pub limit_price: Option<String>,
    pub stop_price: Option<String>,
    pub idempotency_key: String,
    pub expires_at: DateTime<Utc>,
}

impl BoundaryCommand {
    fn from_command(command: &TradeCommand) -> Self {
        Self {
            command_id: command.command_id.to_string(),
            account_id: command.account_id.clone(),
            venue: command.venue.clone(),
            venue_kind: command.venue_kind.as_str().to_owned(),
            symbol: command.symbol.clone(),
            intent: command.intent.as_str().to_owned(),
            side: command.side.as_str().to_owned(),
            quantity: command.quantity.clone(),
            limit_price: command.limit_price.clone(),
            stop_price: command.stop_price.clone(),
            idempotency_key: command.idempotency_key.clone(),
            expires_at: command.expires_at,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BoundaryRejection {
    InvalidPrecision,
    QuantityLimitExceeded,
    NotionalLimitExceeded,
    VenueNotAllowed,
    CommandExpired,
    KillSwitchEngaged,
}

impl BoundaryRejection {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidPrecision => "invalid_precision",
            Self::QuantityLimitExceeded => "quantity_limit_exceeded",
            Self::NotionalLimitExceeded => "notional_limit_exceeded",
            Self::VenueNotAllowed => "venue_not_allowed",
            Self::CommandExpired => "command_expired",
            Self::KillSwitchEngaged => "kill_switch_engaged",
        }
    }
}

impl std::fmt::Display for BoundaryRejection {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Error)]
pub enum GatewayError {
    #[error("BOUNDARY_REJECTED: {rejection}")]
    BoundaryRejected { rejection: BoundaryRejection },
    #[error("KERNEL_ERROR: {detail}")]
    Kernel { detail: String },
}

/// Kernel-side event in QuantOS-owned vocabulary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum KernelEvent {
    OrderAccepted {
        command_id: String,
        venue_order_id: String,
        at: DateTime<Utc>,
    },
    OrderRejected {
        command_id: String,
        reason: String,
        at: DateTime<Utc>,
    },
    OrderFilled {
        command_id: String,
        venue_order_id: String,
        venue_fill_id: String,
        quantity: String,
        price: String,
        fee_currency: String,
        fee_amount: String,
        at: DateTime<Utc>,
    },
}

/// Execution kernel boundary. Implementations must be independent processes or
/// pure in-memory simulators; they never receive session or identity context.
pub trait ExecutionKernel {
    fn submit(&mut self, command: &BoundaryCommand) -> Result<(), String>;
    fn drain_events(&mut self) -> Vec<KernelEvent>;
}

/// QuantOS-owned Order record (mirrors `quantos.trading.v1.Order`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GatewayOrder {
    pub order_id: String,
    pub command_id: String,
    pub venue_order_id: Option<String>,
    pub account_id: String,
    pub symbol: String,
    pub side: String,
    pub intent: String,
    pub quantity: String,
    pub filled_quantity: String,
    pub average_fill_price: Option<String>,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// QuantOS-owned Fill record (mirrors `quantos.trading.v1.Fill`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GatewayFill {
    pub fill_id: String,
    pub order_id: String,
    pub venue_fill_id: Option<String>,
    pub symbol: String,
    pub quantity: String,
    pub price: String,
    pub fee_currency: String,
    pub fee_amount: String,
    pub filled_at: DateTime<Utc>,
}

/// Receipt for a submitted (or replayed) command.
#[derive(Debug, Clone, PartialEq)]
pub struct SubmissionReceipt {
    pub order_id: String,
    pub command_id: String,
    pub replayed: bool,
}

#[derive(Debug, Clone)]
struct SubmissionRecord {
    order_id: String,
    command_id: String,
}

/// The execution gateway: pre-boundary interception, idempotent submission,
/// and event mapping. Generic over the kernel so the paper kernel and the
/// Nautilus boundary adapter are interchangeable.
pub struct ExecutionGateway<K: ExecutionKernel> {
    limits: GatewayLimits,
    kernel: K,
    kill_switch_engaged: bool,
    submissions_by_key: BTreeMap<String, SubmissionRecord>,
    orders: BTreeMap<String, GatewayOrder>,
    fills: Vec<GatewayFill>,
    downstream_submissions: usize,
}

impl<K: ExecutionKernel> ExecutionGateway<K> {
    #[must_use]
    pub fn new(limits: GatewayLimits, kernel: K) -> Self {
        Self {
            limits,
            kernel,
            kill_switch_engaged: false,
            submissions_by_key: BTreeMap::new(),
            orders: BTreeMap::new(),
            fills: Vec::new(),
            downstream_submissions: 0,
        }
    }

    pub fn engage_kill_switch(&mut self) {
        self.kill_switch_engaged = true;
    }

    #[must_use]
    pub fn downstream_submission_count(&self) -> usize {
        self.downstream_submissions
    }

    #[must_use]
    pub fn kernel(&self) -> &K {
        &self.kernel
    }

    #[must_use]
    pub fn kernel_mut(&mut self) -> &mut K {
        &mut self.kernel
    }

    /// Check an incoming command before a service resolves any credential.
    /// The check is repeated by `submit` immediately before the kernel call.
    pub fn validate_command(
        &self,
        command: &TradeCommand,
        now: DateTime<Utc>,
    ) -> Result<(), GatewayError> {
        self.intercept_at_boundary(command, now)
    }

    /// Submit an issued `TradeCommand`. Replays with the same idempotency key
    /// return the existing receipt without touching the kernel.
    pub fn submit(
        &mut self,
        command: &TradeCommand,
        now: DateTime<Utc>,
    ) -> Result<SubmissionReceipt, GatewayError> {
        let key = command.idempotency_key.clone();
        if let Some(record) = self.submissions_by_key.get(&key) {
            return Ok(SubmissionReceipt {
                order_id: record.order_id.clone(),
                command_id: record.command_id.clone(),
                replayed: true,
            });
        }

        self.intercept_at_boundary(command, now)?;

        let boundary = BoundaryCommand::from_command(command);
        let order_id = deterministic_id("order", &boundary.command_id);
        self.kernel
            .submit(&boundary)
            .map_err(|detail| GatewayError::Kernel { detail })?;
        self.downstream_submissions += 1;

        self.orders.insert(
            order_id.clone(),
            GatewayOrder {
                order_id: order_id.clone(),
                command_id: boundary.command_id.clone(),
                venue_order_id: None,
                account_id: boundary.account_id.clone(),
                symbol: boundary.symbol.clone(),
                side: boundary.side.clone(),
                intent: boundary.intent.clone(),
                quantity: boundary.quantity.clone(),
                filled_quantity: "0".to_owned(),
                average_fill_price: None,
                status: "submitted".to_owned(),
                submitted_at: now,
                updated_at: now,
            },
        );
        self.submissions_by_key.insert(
            key,
            SubmissionRecord {
                order_id: order_id.clone(),
                command_id: boundary.command_id,
            },
        );
        Ok(SubmissionReceipt {
            order_id,
            command_id: command.command_id.to_string(),
            replayed: false,
        })
    }

    /// Pre-boundary interception: precision, limits, expiry, kill switch.
    /// 100% of violations must be rejected here, before the kernel is called.
    fn intercept_at_boundary(
        &self,
        command: &TradeCommand,
        now: DateTime<Utc>,
    ) -> Result<(), GatewayError> {
        if self.kill_switch_engaged {
            return Err(reject(BoundaryRejection::KillSwitchEngaged));
        }
        if command.expires_at <= now {
            return Err(reject(BoundaryRejection::CommandExpired));
        }
        if !self.limits.allowed_venues.contains(&command.venue) {
            return Err(reject(BoundaryRejection::VenueNotAllowed));
        }

        let quantity = Quantity::parse_str(&command.quantity)
            .map_err(|_| reject(BoundaryRejection::InvalidPrecision))?;
        for price in [&command.limit_price, &command.stop_price]
            .into_iter()
            .flatten()
        {
            Quantity::parse_str(price).map_err(|_| reject(BoundaryRejection::InvalidPrecision))?;
        }
        match command.intent {
            OrderIntent::Limit | OrderIntent::StopLimit if command.limit_price.is_none() => {
                return Err(reject(BoundaryRejection::InvalidPrecision));
            }
            OrderIntent::Stop | OrderIntent::StopLimit if command.stop_price.is_none() => {
                return Err(reject(BoundaryRejection::InvalidPrecision));
            }
            _ => {}
        }

        if quantity.value() > self.limits.max_quantity {
            return Err(reject(BoundaryRejection::QuantityLimitExceeded));
        }
        if let Some(limit_price) = &command.limit_price {
            let price = Quantity::parse_str(limit_price)
                .map_err(|_| reject(BoundaryRejection::InvalidPrecision))?;
            if quantity.value() * price.value() > self.limits.max_notional {
                return Err(reject(BoundaryRejection::NotionalLimitExceeded));
            }
        }
        Ok(())
    }

    /// Drain kernel events and map them back to QuantOS-owned Order/Fill
    /// records. Returns the fills produced by this drain.
    pub fn collect_events(&mut self) -> Vec<GatewayFill> {
        let events = self.kernel.drain_events();
        let mut new_fills = Vec::new();
        for event in events {
            match event {
                KernelEvent::OrderAccepted {
                    command_id,
                    venue_order_id,
                    at,
                } => {
                    if let Some(order) = self.order_for_command_mut(&command_id) {
                        order.venue_order_id = Some(venue_order_id);
                        order.status = "accepted".to_owned();
                        order.updated_at = at;
                    }
                }
                KernelEvent::OrderRejected {
                    command_id,
                    reason: _,
                    at,
                } => {
                    if let Some(order) = self.order_for_command_mut(&command_id) {
                        order.status = "rejected".to_owned();
                        order.updated_at = at;
                    }
                }
                KernelEvent::OrderFilled {
                    command_id,
                    venue_order_id: _,
                    venue_fill_id,
                    quantity,
                    price,
                    fee_currency,
                    fee_amount,
                    at,
                } => {
                    let Some(order_index) = self
                        .orders
                        .values()
                        .find(|order| order.command_id == command_id)
                        .map(|order| order.order_id.clone())
                    else {
                        continue;
                    };
                    let order = self
                        .orders
                        .get_mut(&order_index)
                        .expect("order index resolved");
                    order.filled_quantity = quantity.clone();
                    order.average_fill_price = Some(price.clone());
                    order.status = if quantity == order.quantity {
                        "filled".to_owned()
                    } else {
                        "partially_filled".to_owned()
                    };
                    order.updated_at = at;
                    let fill = GatewayFill {
                        fill_id: deterministic_id("fill", &venue_fill_id),
                        order_id: order_index,
                        venue_fill_id: Some(venue_fill_id),
                        symbol: order.symbol.clone(),
                        quantity,
                        price,
                        fee_currency,
                        fee_amount,
                        filled_at: at,
                    };
                    self.fills.push(fill.clone());
                    new_fills.push(fill);
                }
            }
        }
        new_fills
    }

    #[must_use]
    pub fn order(&self, order_id: &str) -> Option<&GatewayOrder> {
        self.orders.get(order_id)
    }

    #[must_use]
    pub fn fills(&self) -> &[GatewayFill] {
        &self.fills
    }

    fn order_for_command_mut(&mut self, command_id: &str) -> Option<&mut GatewayOrder> {
        self.orders
            .values_mut()
            .find(|order| order.command_id == command_id)
    }
}

fn deterministic_id(prefix: &str, seed: &str) -> String {
    let hash = ContentHash::sha256_bytes(
        &canonical_json_bytes(&json!({"prefix": prefix, "seed": seed}))
            .expect("id payload canonicalizes"),
    );
    let short: String = hash
        .as_str()
        .trim_start_matches("sha256:")
        .chars()
        .take(16)
        .collect();
    format!("{prefix}:{short}")
}

fn reject(rejection: BoundaryRejection) -> GatewayError {
    GatewayError::BoundaryRejected { rejection }
}

/// Paper execution kernel: accepts every sanitized command and fills it
/// immediately at the limit price (or the declared reference price for market
/// orders). This is the default kernel and the documented replacement path for
/// any external kernel.
#[derive(Debug, Default)]
pub struct PaperKernel {
    reference_price: String,
    accepted: usize,
    pending: Vec<KernelEvent>,
}

impl PaperKernel {
    #[must_use]
    pub fn new(reference_price: impl Into<String>) -> Self {
        Self {
            reference_price: reference_price.into(),
            accepted: 0,
            pending: Vec::new(),
        }
    }

    #[must_use]
    pub fn accepted_count(&self) -> usize {
        self.accepted
    }
}

impl ExecutionKernel for PaperKernel {
    fn submit(&mut self, command: &BoundaryCommand) -> Result<(), String> {
        self.accepted += 1;
        let venue_order_id = deterministic_id("venue-order", &command.command_id);
        let venue_fill_id = deterministic_id("venue-fill", &command.command_id);
        let price = command
            .limit_price
            .clone()
            .unwrap_or_else(|| self.reference_price.clone());
        self.pending.push(KernelEvent::OrderAccepted {
            command_id: command.command_id.clone(),
            venue_order_id: venue_order_id.clone(),
            at: command.expires_at,
        });
        self.pending.push(KernelEvent::OrderFilled {
            command_id: command.command_id.clone(),
            venue_order_id,
            venue_fill_id,
            quantity: command.quantity.clone(),
            price,
            fee_currency: "USD".to_owned(),
            fee_amount: "0".to_owned(),
            at: command.expires_at,
        });
        Ok(())
    }

    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.pending)
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{CommandId, ContentHash, DecisionId};
    use rust_decimal::Decimal;
    use serde_json::json;

    use super::*;
    use crate::{OrderSide, VenueKind};

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn command_fixture(key: &str) -> TradeCommand {
        TradeCommand {
            command_id: CommandId::new(),
            decision_id: DecisionId::new(),
            account_id: "paper-account-0".to_owned(),
            venue: "paper-venue".to_owned(),
            venue_kind: VenueKind::Cex,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: "1.5".to_owned(),
            limit_price: Some("100.25".to_owned()),
            stop_price: None,
            idempotency_key: key.to_owned(),
            approval_signature: None,
            expires_at: now() + ChronoDuration::minutes(2),
            signature: ContentHash::sha256_bytes(br#"{"command":"fixture"}"#),
            issued_at: now(),
        }
    }

    fn limits() -> GatewayLimits {
        GatewayLimits {
            max_quantity: Decimal::new(10, 0),
            max_notional: Decimal::new(1_000, 0),
            allowed_venues: vec!["paper-venue".to_owned()],
        }
    }

    #[test]
    fn thousand_replays_with_same_key_produce_exactly_one_downstream_submission() {
        let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
        let command = command_fixture("shared-key");

        let mut receipts = Vec::new();
        for _ in 0..1_000 {
            receipts.push(gateway.submit(&command, now()).expect("submit succeeds"));
        }

        assert_eq!(gateway.downstream_submission_count(), 1);
        assert_eq!(gateway.kernel().accepted_count(), 1);
        assert!(!receipts[0].replayed);
        assert!(receipts[1..].iter().all(|receipt| receipt.replayed));
        assert!(
            receipts
                .iter()
                .all(|receipt| receipt.order_id == receipts[0].order_id)
        );
    }

    #[test]
    fn order_and_fill_events_map_back_to_owned_schema() {
        let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
        let command = command_fixture("event-key");
        let receipt = gateway.submit(&command, now()).expect("submit succeeds");

        let fills = gateway.collect_events();
        assert_eq!(fills.len(), 1);

        let order = gateway.order(&receipt.order_id).expect("order exists");
        assert_eq!(order.command_id, command.command_id.to_string());
        assert_eq!(order.status, "filled");
        assert_eq!(order.filled_quantity, "1.5");
        assert_eq!(order.average_fill_price.as_deref(), Some("100.25"));
        assert!(order.venue_order_id.is_some());
        assert_eq!(order.account_id, "paper-account-0");
        assert_eq!(order.symbol, "BTCUSDT");
        assert_eq!(order.side, "buy");
        assert_eq!(order.intent, "limit");

        let fill = &fills[0];
        assert_eq!(fill.order_id, receipt.order_id);
        assert!(fill.venue_fill_id.is_some());
        assert_eq!(fill.symbol, "BTCUSDT");
        assert_eq!(fill.quantity, "1.5");
        assert_eq!(fill.price, "100.25");
        assert_eq!(fill.fee_currency, "USD");
    }

    type RejectionCase = (BoundaryRejection, Box<dyn Fn(&mut TradeCommand)>);

    #[test]
    fn all_six_boundary_rejection_classes_are_enforced_before_the_kernel() {
        let cases: Vec<RejectionCase> = vec![
            (
                BoundaryRejection::InvalidPrecision,
                Box::new(|command: &mut TradeCommand| {
                    command.quantity = "1.1234567890123".to_owned();
                }),
            ),
            (
                BoundaryRejection::QuantityLimitExceeded,
                Box::new(|command: &mut TradeCommand| {
                    command.quantity = "11".to_owned();
                }),
            ),
            (
                BoundaryRejection::NotionalLimitExceeded,
                Box::new(|command: &mut TradeCommand| {
                    command.quantity = "9".to_owned();
                    command.limit_price = Some("200".to_owned());
                }),
            ),
            (
                BoundaryRejection::VenueNotAllowed,
                Box::new(|command: &mut TradeCommand| {
                    command.venue = "unknown-venue".to_owned();
                }),
            ),
            (
                BoundaryRejection::CommandExpired,
                Box::new(|command: &mut TradeCommand| {
                    command.expires_at = now() - ChronoDuration::seconds(1);
                }),
            ),
        ];

        let mut observed = std::collections::BTreeSet::new();
        for (expected, mutate) in &cases {
            let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
            let mut command = command_fixture("rejection-case");
            mutate(&mut command);
            let error = gateway
                .submit(&command, now())
                .expect_err("boundary violation rejected");
            assert!(matches!(
                error,
                GatewayError::BoundaryRejected { rejection } if rejection == *expected
            ));
            assert_eq!(gateway.downstream_submission_count(), 0);
            assert_eq!(gateway.kernel().accepted_count(), 0);
            observed.insert(expected.as_str());
        }

        let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
        gateway.engage_kill_switch();
        let error = gateway
            .submit(&command_fixture("kill-switch"), now())
            .expect_err("kill switch rejected");
        assert!(matches!(
            error,
            GatewayError::BoundaryRejected {
                rejection: BoundaryRejection::KillSwitchEngaged
            }
        ));
        assert_eq!(gateway.downstream_submission_count(), 0);
        assert_eq!(gateway.kernel().accepted_count(), 0);
        observed.insert(BoundaryRejection::KillSwitchEngaged.as_str());

        assert_eq!(observed.len(), 6);
    }

    #[test]
    fn hundred_precision_and_limit_variants_are_fully_intercepted() {
        let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
        for index in 0..100 {
            let mut command = command_fixture(&format!("variant-{index}"));
            if index % 2 == 0 {
                command.quantity = format!("0.{}", "1".repeat(13));
            } else {
                command.quantity = "10.5".to_owned();
            }
            assert!(gateway.submit(&command, now()).is_err());
        }
        assert_eq!(gateway.downstream_submission_count(), 0);
        assert_eq!(gateway.kernel().accepted_count(), 0);
    }

    #[test]
    fn limit_intent_without_price_is_rejected_before_the_kernel() {
        let mut gateway = ExecutionGateway::new(limits(), PaperKernel::new("100.00"));
        let mut command = command_fixture("missing-limit-price");
        command.limit_price = None;
        let error = gateway
            .submit(&command, now())
            .expect_err("limit intent without price rejected");
        assert!(matches!(
            error,
            GatewayError::BoundaryRejected {
                rejection: BoundaryRejection::InvalidPrecision
            }
        ));
        assert_eq!(gateway.kernel().accepted_count(), 0);
    }

    #[test]
    fn boundary_command_carries_no_session_or_identity_material() {
        let command = command_fixture("isolation-key");
        let boundary = BoundaryCommand::from_command(&command);
        let serialized = serde_json::to_value(&boundary).expect("serializes");
        let object = serialized.as_object().expect("object shape");

        let allowed: std::collections::BTreeSet<&str> = [
            "command_id",
            "account_id",
            "venue",
            "venue_kind",
            "symbol",
            "intent",
            "side",
            "quantity",
            "limit_price",
            "stop_price",
            "idempotency_key",
            "expires_at",
        ]
        .into_iter()
        .collect();
        for key in object.keys() {
            assert!(
                allowed.contains(key.as_str()),
                "unexpected boundary key {key}"
            );
        }

        let wire = serialized.to_string();
        for forbidden in [
            "tenant",
            "actor",
            "session",
            "decision",
            "approval",
            "signature",
            "workspace",
        ] {
            assert!(
                !wire.contains(forbidden),
                "boundary wire leaked `{forbidden}`"
            );
        }
    }

    #[test]
    fn nautilus_adapter_maps_wire_shape_and_client_order_id_is_stable() {
        let command = command_fixture("nautilus-key");
        let boundary = BoundaryCommand::from_command(&command);

        let wire = NautilusBoundaryAdapter::wire_command(&boundary);
        assert_eq!(wire.instrument_id, "BTCUSDT.paper-venue");
        assert_eq!(wire.order_side, "BUY");
        assert_eq!(wire.order_type, "LIMIT");
        assert_eq!(wire.time_in_force, "GTD");
        assert_eq!(wire.expire_time, Some(command.expires_at));
        assert_eq!(wire.price.as_deref(), Some("100.25"));
        assert_eq!(wire.trigger_price, None);

        let wire_again = NautilusBoundaryAdapter::wire_command(&boundary);
        assert_eq!(wire.client_order_id, wire_again.client_order_id);

        let mut stop_command = command_fixture("nautilus-stop");
        stop_command.intent = OrderIntent::Stop;
        stop_command.limit_price = None;
        stop_command.stop_price = Some("99.50".to_owned());
        let stop_wire =
            NautilusBoundaryAdapter::wire_command(&BoundaryCommand::from_command(&stop_command));
        assert_eq!(stop_wire.order_type, "STOP_MARKET");
        assert_eq!(stop_wire.trigger_price.as_deref(), Some("99.50"));
    }

    #[test]
    fn nautilus_events_map_back_to_owned_schema_through_the_gateway() {
        let mut gateway = ExecutionGateway::new(limits(), NautilusBoundaryAdapter::new());
        let command = command_fixture("nautilus-events");
        let receipt = gateway.submit(&command, now()).expect("submit succeeds");
        assert_eq!(gateway.kernel().outbox().len(), 1);

        let client_order_id = gateway.kernel().outbox()[0].client_order_id.clone();
        let accepted = gateway
            .kernel()
            .map_event_for(&json!({
                "event_type": "OrderAccepted",
                "client_order_id": client_order_id,
                "venue_order_id": "venue-order-1",
                "ts_event": "2026-08-01T00:00:01Z",
            }))
            .expect("accepted maps");
        let filled = gateway
            .kernel()
            .map_event_for(&json!({
                "event_type": "OrderFilled",
                "client_order_id": client_order_id,
                "venue_order_id": "venue-order-1",
                "trade_id": "trade-1",
                "last_qty": "1.5",
                "last_px": "100.25",
                "currency": "USD",
                "commission": "0.10",
                "ts_event": "2026-08-01T00:00:02Z",
            }))
            .expect("filled maps");

        gateway.kernel_mut().push_event(accepted);
        gateway.kernel_mut().push_event(filled);

        let fills = gateway.collect_events();
        assert_eq!(fills.len(), 1);
        let order = gateway.order(&receipt.order_id).expect("order exists");
        assert_eq!(order.status, "filled");
        assert_eq!(order.venue_order_id.as_deref(), Some("venue-order-1"));
        assert_eq!(fills[0].venue_fill_id.as_deref(), Some("trade-1"));
        assert_eq!(fills[0].fee_amount, "0.10");

        let unknown = NautilusBoundaryAdapter::new().map_event_for(&json!({
            "event_type": "OrderAccepted",
            "client_order_id": "client-order:unknown",
            "venue_order_id": "venue-order-x",
            "ts_event": "2026-08-01T00:00:01Z",
        }));
        assert!(unknown.is_err());
    }

    #[test]
    fn nautilus_adapter_replay_also_produces_one_outbox_entry() {
        let mut gateway = ExecutionGateway::new(limits(), NautilusBoundaryAdapter::new());
        let command = command_fixture("nautilus-replay");
        for _ in 0..100 {
            gateway.submit(&command, now()).expect("submit succeeds");
        }
        assert_eq!(gateway.kernel().outbox().len(), 1);
        assert_eq!(gateway.downstream_submission_count(), 1);
    }
}

/// NautilusTrader boundary adapter.
///
/// Translates sanitized [`BoundaryCommand`] values into Nautilus-style wire
/// payloads (order API vocabulary: instrument id, order type, time in force,
/// client order id) for an out-of-process Nautilus service. No Nautilus type
/// is imported into QuantOS core; the wire structs here are QuantOS-owned.
#[derive(Debug, Default)]
pub struct NautilusBoundaryAdapter {
    outbox: Vec<NautilusOrderWire>,
    client_order_index: BTreeMap<String, String>,
    pending: Vec<KernelEvent>,
}

/// QuantOS-owned mirror of the Nautilus order-submit wire shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NautilusOrderWire {
    pub trader_id: String,
    pub strategy_id: String,
    pub instrument_id: String,
    pub client_order_id: String,
    pub order_side: String,
    pub order_type: String,
    pub quantity: String,
    pub price: Option<String>,
    pub trigger_price: Option<String>,
    pub time_in_force: String,
    pub expire_time: Option<DateTime<Utc>>,
}

impl NautilusBoundaryAdapter {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn outbox(&self) -> &[NautilusOrderWire] {
        &self.outbox
    }

    /// Map a sanitized boundary command to the Nautilus wire shape.
    #[must_use]
    pub fn wire_command(command: &BoundaryCommand) -> NautilusOrderWire {
        NautilusOrderWire {
            trader_id: "QUANTOS-PAPER-001".to_owned(),
            strategy_id: "QUANTOS-EXECUTION-GATEWAY".to_owned(),
            instrument_id: format!("{}.{}", command.symbol, command.venue),
            client_order_id: deterministic_id("client-order", &command.idempotency_key),
            order_side: match command.side.as_str() {
                "buy" => "BUY".to_owned(),
                _ => "SELL".to_owned(),
            },
            order_type: match command.intent.as_str() {
                "market" => "MARKET",
                "limit" => "LIMIT",
                "stop" => "STOP_MARKET",
                _ => "STOP_LIMIT",
            }
            .to_owned(),
            quantity: command.quantity.clone(),
            price: command.limit_price.clone(),
            trigger_price: command.stop_price.clone(),
            time_in_force: "GTD".to_owned(),
            expire_time: Some(command.expires_at),
        }
    }

    /// Map a Nautilus-style execution event payload back to the QuantOS-owned
    /// kernel event vocabulary.
    pub fn map_event(payload: &serde_json::Value) -> Result<KernelEvent, String> {
        let event_type = payload
            .get("event_type")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| "missing event_type".to_owned())?;
        let text = |key: &str| -> Result<String, String> {
            payload
                .get(key)
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
                .ok_or_else(|| format!("missing {key}"))
        };
        let at = DateTime::parse_from_rfc3339(&text("ts_event")?)
            .map_err(|error| format!("invalid ts_event: {error}"))?
            .with_timezone(&Utc);
        match event_type {
            "OrderAccepted" => Ok(KernelEvent::OrderAccepted {
                command_id: text("client_order_id")?,
                venue_order_id: text("venue_order_id")?,
                at,
            }),
            "OrderRejected" => Ok(KernelEvent::OrderRejected {
                command_id: text("client_order_id")?,
                reason: text("reason")?,
                at,
            }),
            "OrderFilled" => Ok(KernelEvent::OrderFilled {
                command_id: text("client_order_id")?,
                venue_order_id: text("venue_order_id")?,
                venue_fill_id: text("trade_id")?,
                quantity: text("last_qty")?,
                price: text("last_px")?,
                fee_currency: text("currency")?,
                fee_amount: text("commission")?,
                at,
            }),
            other => Err(format!("unsupported event_type {other}")),
        }
    }

    /// Feed a mapped event back into the gateway drain path (used by the wire
    /// bridge once the external service responds).
    pub fn push_event(&mut self, event: KernelEvent) {
        self.pending.push(event);
    }

    /// Map a Nautilus-style event payload and resolve the client order id back
    /// to the QuantOS command id tracked by this adapter.
    pub fn map_event_for(&self, payload: &serde_json::Value) -> Result<KernelEvent, String> {
        let event = Self::map_event(payload)?;
        let client_order_id = match &event {
            KernelEvent::OrderAccepted { command_id, .. }
            | KernelEvent::OrderRejected { command_id, .. }
            | KernelEvent::OrderFilled { command_id, .. } => command_id.clone(),
        };
        let command_id = self
            .client_order_index
            .get(&client_order_id)
            .cloned()
            .ok_or_else(|| format!("unknown client_order_id {client_order_id}"))?;
        Ok(match event {
            KernelEvent::OrderAccepted {
                venue_order_id, at, ..
            } => KernelEvent::OrderAccepted {
                command_id,
                venue_order_id,
                at,
            },
            KernelEvent::OrderRejected { reason, at, .. } => KernelEvent::OrderRejected {
                command_id,
                reason,
                at,
            },
            KernelEvent::OrderFilled {
                venue_order_id,
                venue_fill_id,
                quantity,
                price,
                fee_currency,
                fee_amount,
                at,
                ..
            } => KernelEvent::OrderFilled {
                command_id,
                venue_order_id,
                venue_fill_id,
                quantity,
                price,
                fee_currency,
                fee_amount,
                at,
            },
        })
    }
}

impl ExecutionKernel for NautilusBoundaryAdapter {
    fn submit(&mut self, command: &BoundaryCommand) -> Result<(), String> {
        let wire = Self::wire_command(command);
        self.client_order_index
            .insert(wire.client_order_id.clone(), command.command_id.clone());
        self.outbox.push(wire);
        Ok(())
    }

    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.pending)
    }
}
