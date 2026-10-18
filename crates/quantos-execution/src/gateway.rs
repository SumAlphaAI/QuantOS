//! TP07 execution gateway: pre-boundary interception, idempotent downstream
//! submission, kernel isolation, and Order/Fill event mapping back to the
//! QuantOS-owned schema.
//!
//! The gateway is the only path from an issued [`TradeCommand`] to an
//! execution kernel. Kernels (paper, Nautilus boundary adapter) receive only
//! sanitized [`BoundaryCommand`] values — never tenant, actor, session,
//! decision, or approval context.

use crate::oms::{BoundaryCancel, CancelAudit, CancelOutcome, FactAnchor, FactKind, OrderFact};
use std::collections::{BTreeMap, BTreeSet};

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
    #[error("IDEMPOTENCY_CONFLICT")]
    IdempotencyConflict,
    #[error("SUBMISSION_UNCERTAIN: reconcile before any retry")]
    SubmissionUncertain,
    #[error("INVALID_KERNEL_EVENTS: dispatch quarantined")]
    InvalidEvents,
    #[error("CANCEL_REJECTED: unknown order, invalid request, clock or correlation")]
    InvalidCancel,
    #[error("CANCEL_UNCERTAIN: reconcile before retry")]
    CancelUncertain,
}

/// Kernel-side event in QuantOS-owned vocabulary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
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
    OrderCancelled {
        command_id: String,
        venue_order_id: String,
        cancel_id: String,
        at: DateTime<Utc>,
    },
    CancelRejected {
        command_id: String,
        venue_order_id: String,
        cancel_id: String,
        reason: String,
        at: DateTime<Utc>,
    },
    OrderExpired {
        command_id: String,
        at: DateTime<Utc>,
    },
}

impl KernelEvent {
    pub fn binding(&self) -> (&str, DateTime<Utc>) {
        match self {
            Self::OrderAccepted { command_id, at, .. }
            | Self::OrderRejected { command_id, at, .. }
            | Self::OrderFilled { command_id, at, .. }
            | Self::OrderCancelled { command_id, at, .. }
            | Self::CancelRejected { command_id, at, .. }
            | Self::OrderExpired { command_id, at } => (command_id, *at),
        }
    }
}

/// Execution kernel boundary. Implementations must be independent processes or
/// pure in-memory simulators; they never receive session or identity context.
pub trait ExecutionKernel {
    fn cancel(&mut self, _request: &BoundaryCancel) -> Result<(), String> {
        Err("cancel unsupported".into())
    }
    fn submit(&mut self, command: &BoundaryCommand) -> Result<(), String>;
    fn drain_events(&mut self) -> Vec<KernelEvent>;
    fn submit_at(&mut self, command: &BoundaryCommand, _now: DateTime<Utc>) -> Result<(), String> {
        self.submit(command)
    }
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
    pub expires_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub rejection_reason: Option<String>,
}

/// QuantOS-owned Fill record (mirrors `quantos.trading.v1.Fill`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GatewayFill {
    pub command_id: String,
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SubmissionReceipt {
    pub order_id: String,
    pub command_id: String,
    pub replayed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubmissionState {
    Submitted,
    Uncertain,
}

#[derive(Debug, Clone)]
struct SubmissionRecord {
    binding: ContentHash,
    state: SubmissionState,
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
    event_quarantined: bool,
    fill_index: BTreeMap<String, GatewayFill>,
    seen_events: BTreeSet<String>,
    cancels: BTreeMap<String, CancelAudit>,
    facts: Vec<OrderFact>,
    downstream_cancels: usize,
    blocked_cancel_orders: BTreeSet<String>,
}

impl<K: ExecutionKernel> ExecutionGateway<K> {
    pub(crate) fn boundary_limits(&self) -> GatewayLimits {
        self.limits.clone()
    }
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
            event_quarantined: false,
            fill_index: BTreeMap::new(),
            seen_events: BTreeSet::new(),
            cancels: BTreeMap::new(),
            facts: Vec::new(),
            downstream_cancels: 0,
            blocked_cancel_orders: BTreeSet::new(),
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
        // Current safety is checked even for a cached replay.
        self.intercept_at_boundary(command, now)?;
        if self.event_quarantined {
            return Err(GatewayError::InvalidEvents);
        }
        let key = command.idempotency_key.clone();
        let binding = ContentHash::sha256_bytes(
            &canonical_json_bytes(&json!({
                "command_id":command.command_id,"decision_id":command.decision_id,
                "account_id":command.account_id,"venue":command.venue,"venue_kind":command.venue_kind.as_str(),
                "symbol":command.symbol,"intent":command.intent.as_str(),"side":command.side.as_str(),
                "quantity":command.quantity,"limit_price":command.limit_price,"stop_price":command.stop_price,
                "idempotency_key":command.idempotency_key,"approval_signature":command.approval_signature,
                "issued_at":command.issued_at,"expires_at":command.expires_at,"signature":command.signature,
            }))
                .map_err(|_| GatewayError::IdempotencyConflict)?,
        );
        if let Some(record) = self.submissions_by_key.get(&key) {
            if record.binding != binding {
                return Err(GatewayError::IdempotencyConflict);
            }
            if record.state == SubmissionState::Uncertain {
                return Err(GatewayError::SubmissionUncertain);
            }
            return Ok(SubmissionReceipt {
                order_id: record.order_id.clone(),
                command_id: record.command_id.clone(),
                replayed: true,
            });
        }
        let boundary = BoundaryCommand::from_command(command);
        let order_id = deterministic_id("order", &boundary.command_id);
        // Reserve before any possible downstream side effect. An error may mean the
        // kernel accepted but the reply was lost; never turn it into an automatic retry.
        self.submissions_by_key.insert(
            key.clone(),
            SubmissionRecord {
                binding: binding.clone(),
                state: SubmissionState::Uncertain,
                order_id: order_id.clone(),
                command_id: boundary.command_id.clone(),
            },
        );
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
                expires_at: command.expires_at,
                updated_at: now,
                rejection_reason: None,
            },
        );
        self.append_fact(
            &order_id,
            &boundary.command_id,
            FactKind::Submitted {
                order: self.orders[&order_id].clone(),
                expires_at: command.expires_at,
            },
        );
        self.downstream_submissions += 1;
        self.kernel
            .submit_at(&boundary, now)
            .map_err(|_| GatewayError::SubmissionUncertain)?;

        self.submissions_by_key.insert(
            key,
            SubmissionRecord {
                binding,
                state: SubmissionState::Submitted,
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
        if command.expires_at <= now
            || command.issued_at > now
            || command.expires_at <= command.issued_at
        {
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

        if quantity.value() <= Decimal::ZERO
            || self.limits.max_quantity <= Decimal::ZERO
            || self.limits.max_notional <= Decimal::ZERO
        {
            return Err(reject(BoundaryRejection::InvalidPrecision));
        }
        if quantity.value() > self.limits.max_quantity {
            return Err(reject(BoundaryRejection::QuantityLimitExceeded));
        }
        let price = command
            .limit_price
            .as_ref()
            .or(command.stop_price.as_ref())
            .ok_or_else(|| reject(BoundaryRejection::InvalidPrecision))?;
        let price = Quantity::parse_str(price)
            .map_err(|_| reject(BoundaryRejection::InvalidPrecision))?
            .value();
        if price <= Decimal::ZERO {
            return Err(reject(BoundaryRejection::InvalidPrecision));
        }
        let notional = quantity
            .value()
            .checked_mul(price)
            .ok_or_else(|| reject(BoundaryRejection::NotionalLimitExceeded))?;
        if notional > self.limits.max_notional {
            return Err(reject(BoundaryRejection::NotionalLimitExceeded));
        }
        Ok(())
    }

    /// Drain kernel events and map them back to QuantOS-owned Order/Fill
    /// records. Returns the fills produced by this drain.
    /// Compatibility fixture API. Authority consumers use try_collect_events so
    /// invalid events are visible as errors. A failure also blocks later submits.
    pub fn collect_events(&mut self) -> Vec<GatewayFill> {
        self.try_collect_events().unwrap_or_default()
    }
    pub fn try_collect_events(&mut self) -> Result<Vec<GatewayFill>, GatewayError> {
        if self.event_quarantined {
            return Err(GatewayError::InvalidEvents);
        }
        // Copy only touched orders; no O(total history) clone for each drain.
        let mut orders = BTreeMap::new();
        let mut fills = BTreeMap::new();
        let mut cancels = BTreeMap::new();
        let mut seen = BTreeSet::new();
        let mut accepted = Vec::new();
        let result: Result<(), GatewayError> = (|| {
            for event in self.kernel.drain_events() {
                let bytes = canonical_json_bytes(
                    &serde_json::to_value(&event).map_err(|_| GatewayError::InvalidEvents)?,
                )
                .map_err(|_| GatewayError::InvalidEvents)?;
                let hash = ContentHash::sha256_bytes(&bytes).as_str().to_owned();
                if self.seen_events.contains(&hash) || !seen.insert(hash) {
                    continue;
                }
                let (id, _) = event.binding();
                let order_id = deterministic_id("order", id);
                if !orders.contains_key(&order_id) {
                    orders.insert(
                        order_id.clone(),
                        self.orders
                            .get(&order_id)
                            .cloned()
                            .ok_or(GatewayError::InvalidEvents)?,
                    );
                }
                let order = orders
                    .get_mut(&order_id)
                    .ok_or(GatewayError::InvalidEvents)?;
                let deadline = order.expires_at;
                match &event {
                    KernelEvent::OrderCancelled { cancel_id, .. }
                    | KernelEvent::CancelRejected { cancel_id, .. } => {
                        if !cancels.contains_key(cancel_id) {
                            cancels.insert(
                                cancel_id.clone(),
                                self.cancels
                                    .get(cancel_id)
                                    .cloned()
                                    .ok_or(GatewayError::InvalidEvents)?,
                            );
                        }
                        let audit = cancels
                            .get_mut(cancel_id)
                            .ok_or(GatewayError::InvalidEvents)?;
                        apply_cancel(order, audit, &event)?;
                    }
                    _ => apply_event(order, &self.fill_index, &mut fills, event.clone(), deadline)?,
                }
                accepted.push((order_id, id.to_owned(), event));
            }
            Ok(())
        })();
        if result.is_err() {
            self.event_quarantined = true;
            return Err(GatewayError::InvalidEvents);
        }
        self.orders.extend(orders);
        for audit in cancels.values() {
            if matches!(
                audit.outcome,
                CancelOutcome::Cancelled | CancelOutcome::Rejected
            ) {
                self.blocked_cancel_orders.remove(&audit.order_id);
            }
        }
        self.cancels.extend(cancels);
        self.seen_events.extend(seen);
        // Projection order follows append-only event order, independent of drain
        // batch boundaries or hashed fill IDs. Replay must reproduce the same list.
        let new_fills: Vec<_> = accepted
            .iter()
            .filter_map(|(_, _, event)| match event {
                KernelEvent::OrderFilled {
                    command_id,
                    venue_fill_id,
                    ..
                } => fills
                    .get(&deterministic_id(
                        "fill",
                        &format!("{command_id}:{venue_fill_id}"),
                    ))
                    .cloned(),
                _ => None,
            })
            .collect();
        self.fills.extend(new_fills.clone());
        self.fill_index.extend(fills);
        for (order_id, id, event) in accepted {
            self.append_fact(&order_id, &id, FactKind::Kernel { event });
        }
        Ok(new_fills)
    }
    fn append_fact(&mut self, order_id: &str, command_id: &str, kind: FactKind) {
        self.facts
            .push(OrderFact::next(&self.facts, order_id, command_id, kind));
    }
    pub fn fact_anchor(&self) -> FactAnchor {
        FactAnchor {
            count: self.facts.len() as u64,
            head: self.facts.last().map(|f| f.hash.clone()),
        }
    }
    pub fn facts(&self) -> &[OrderFact] {
        &self.facts
    }
    pub fn cancel_audits(&self) -> &BTreeMap<String, CancelAudit> {
        &self.cancels
    }
    pub fn downstream_cancel_count(&self) -> usize {
        self.downstream_cancels
    }
    pub fn cancel(
        &mut self,
        command_id: &str,
        key: &str,
        now: DateTime<Utc>,
    ) -> Result<CancelAudit, GatewayError> {
        if self.event_quarantined {
            return Err(GatewayError::InvalidEvents);
        }
        if key.is_empty()
            || key.len() > 128
            || !key
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_:".contains(&b))
        {
            return Err(GatewayError::InvalidCancel);
        }
        let order_id = deterministic_id("order", command_id);
        let order = self
            .orders
            .get(&order_id)
            .ok_or(GatewayError::InvalidCancel)?;
        let cancel_id = deterministic_id("cancel", &format!("{command_id}:{key}"));
        if let Some(prior) = self.cancels.get(&cancel_id) {
            return if matches!(
                prior.outcome,
                CancelOutcome::Pending | CancelOutcome::Uncertain
            ) {
                Err(GatewayError::CancelUncertain)
            } else {
                Ok(prior.clone())
            };
        }
        if self.blocked_cancel_orders.contains(&order_id) {
            return Err(GatewayError::CancelUncertain);
        }
        if now < order.updated_at {
            return Err(GatewayError::InvalidCancel);
        }
        let request = BoundaryCancel {
            command_id: command_id.into(),
            venue_order_id: order
                .venue_order_id
                .clone()
                .ok_or(GatewayError::InvalidCancel)?,
            cancel_id: cancel_id.clone(),
            requested_at: now,
        };
        let audit = CancelAudit {
            request: request.clone(),
            order_id: order_id.clone(),
            completed_at: None,
            latency_micros: None,
            outcome: CancelOutcome::Pending,
            reason: None,
        };
        self.cancels.insert(cancel_id.clone(), audit);
        self.append_fact(
            &order_id,
            command_id,
            FactKind::CancelRequested {
                request: request.clone(),
            },
        );
        self.blocked_cancel_orders.insert(order_id.clone());
        self.downstream_cancels += 1;
        let result = self.kernel.cancel(&request);
        if result.is_ok()
            && let Err(error) = self.try_collect_events()
        {
            self.cancels
                .get_mut(&cancel_id)
                .expect("reserved cancel")
                .outcome = CancelOutcome::Uncertain;
            self.append_fact(
                &order_id,
                command_id,
                FactKind::CancelUncertain { cancel_id },
            );
            return Err(error);
        }
        if result.is_err() || self.cancels[&cancel_id].outcome == CancelOutcome::Pending {
            self.cancels
                .get_mut(&cancel_id)
                .expect("reserved cancel")
                .outcome = CancelOutcome::Uncertain;
            self.append_fact(
                &order_id,
                command_id,
                FactKind::CancelUncertain { cancel_id },
            );
            return Err(GatewayError::CancelUncertain);
        }
        self.blocked_cancel_orders.remove(&order_id);
        Ok(self.cancels[&cancel_id].clone())
    }
    /// Verify hash, sequence and business transitions by rebuilding from facts.
    /// Rebuilt state carries no issuance or submission authority.
    pub fn replay_facts(
        facts: &[OrderFact],
        anchor: &FactAnchor,
    ) -> Result<ExecutionGateway<NautilusBoundaryAdapter>, GatewayError> {
        if anchor.count != facts.len() as u64 || anchor.head != facts.last().map(|f| f.hash.clone())
        {
            return Err(GatewayError::InvalidEvents);
        }
        let mut book = ExecutionGateway::new(
            GatewayLimits {
                max_quantity: Decimal::MAX,
                max_notional: Decimal::MAX,
                allowed_venues: vec![],
            },
            NautilusBoundaryAdapter::new(),
        );
        for fact in facts {
            let expected = OrderFact::next(
                &book.facts,
                &fact.order_id,
                &fact.command_id,
                fact.content.clone(),
            );
            if fact != &expected {
                return Err(GatewayError::InvalidEvents);
            }
            let order_id = deterministic_id("order", &fact.command_id);
            if fact.order_id != order_id {
                return Err(GatewayError::InvalidEvents);
            }
            match &fact.content {
                FactKind::Submitted { order, expires_at } => {
                    if book.orders.contains_key(&order_id)
                        || order.order_id != order_id
                        || order.command_id != fact.command_id
                        || order.status != "submitted"
                        || order.filled_quantity != "0"
                        || order.average_fill_price.is_some()
                        || order.venue_order_id.is_some()
                        || order.rejection_reason.is_some()
                        || order.updated_at != order.submitted_at
                        || order.expires_at != *expires_at
                        || *expires_at <= order.submitted_at
                        || !Quantity::parse_str(&order.quantity)
                            .is_ok_and(|q| q.value() > Decimal::ZERO)
                    {
                        return Err(GatewayError::InvalidEvents);
                    }
                    book.orders.insert(order_id.clone(), order.clone());
                    book.append_fact(&order_id, &fact.command_id, fact.content.clone());
                }
                FactKind::Kernel { event } => {
                    if event.binding().0 != fact.command_id {
                        return Err(GatewayError::InvalidEvents);
                    }
                    book.kernel.push_event(event.clone());
                    book.try_collect_events()?;
                }
                FactKind::CancelRequested { request } => {
                    let order = book
                        .orders
                        .get(&order_id)
                        .ok_or(GatewayError::InvalidEvents)?;
                    if request.command_id != fact.command_id
                        || request.cancel_id.is_empty()
                        || book.cancels.contains_key(&request.cancel_id)
                        || order.venue_order_id.as_ref() != Some(&request.venue_order_id)
                        || request.requested_at < order.updated_at
                    {
                        return Err(GatewayError::InvalidEvents);
                    }
                    book.cancels.insert(
                        request.cancel_id.clone(),
                        CancelAudit {
                            request: request.clone(),
                            order_id: order_id.clone(),
                            completed_at: None,
                            latency_micros: None,
                            outcome: CancelOutcome::Pending,
                            reason: None,
                        },
                    );
                    book.append_fact(&order_id, &fact.command_id, fact.content.clone());
                }
                FactKind::CancelUncertain { cancel_id } => {
                    let audit = book
                        .cancels
                        .get_mut(cancel_id)
                        .ok_or(GatewayError::InvalidEvents)?;
                    if audit.outcome != CancelOutcome::Pending || audit.order_id != order_id {
                        return Err(GatewayError::InvalidEvents);
                    }
                    audit.outcome = CancelOutcome::Uncertain;
                    book.append_fact(&order_id, &fact.command_id, fact.content.clone());
                }
            }
            if book.facts.last() != Some(fact) {
                return Err(GatewayError::InvalidEvents);
            }
        }
        Ok(book)
    }
    #[must_use]
    pub fn submission_state(&self, key: &str) -> Option<SubmissionState> {
        self.submissions_by_key.get(key).map(|record| record.state)
    }

    #[must_use]
    pub fn order(&self, order_id: &str) -> Option<&GatewayOrder> {
        self.orders.get(order_id)
    }

    #[must_use]
    pub fn fills(&self) -> &[GatewayFill] {
        &self.fills
    }
}

fn deterministic_id(prefix: &str, seed: &str) -> String {
    let hash = ContentHash::sha256_bytes(
        &canonical_json_bytes(&json!({"prefix": prefix, "seed": seed}))
            .expect("id payload canonicalizes"),
    );
    format!("{prefix}:{}", hash.as_str().trim_start_matches("sha256:"))
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
    resting: bool,
    orders: BTreeMap<String, (String, bool, DateTime<Utc>)>,
}

impl PaperKernel {
    #[must_use]
    pub fn new(reference_price: impl Into<String>) -> Self {
        Self {
            reference_price: reference_price.into(),
            accepted: 0,
            pending: Vec::new(),
            resting: false,
            orders: BTreeMap::new(),
        }
    }
    pub fn resting(reference_price: impl Into<String>) -> Self {
        Self {
            resting: true,
            ..Self::new(reference_price)
        }
    }

    #[must_use]
    pub fn accepted_count(&self) -> usize {
        self.accepted
    }
}

impl ExecutionKernel for PaperKernel {
    fn cancel(&mut self, r: &BoundaryCancel) -> Result<(), String> {
        let at = r.requested_at + chrono::Duration::milliseconds(10);
        if let Some((id, open, expiry)) = self.orders.get_mut(&r.command_id)
            && id == &r.venue_order_id
            && *open
            && r.requested_at >= *expiry
        {
            *open = false;
            self.pending.push(KernelEvent::OrderExpired {
                command_id: r.command_id.clone(),
                at: *expiry,
            });
        }
        let event = match self.orders.get_mut(&r.command_id) {
            Some((id, open, _)) if id == &r.venue_order_id && *open => {
                *open = false;
                KernelEvent::OrderCancelled {
                    command_id: r.command_id.clone(),
                    venue_order_id: r.venue_order_id.clone(),
                    cancel_id: r.cancel_id.clone(),
                    at,
                }
            }
            _ => KernelEvent::CancelRejected {
                command_id: r.command_id.clone(),
                venue_order_id: r.venue_order_id.clone(),
                cancel_id: r.cancel_id.clone(),
                reason: "order is terminal or unknown".into(),
                at,
            },
        };
        self.pending.push(event);
        Ok(())
    }
    fn submit(&mut self, command: &BoundaryCommand) -> Result<(), String> {
        self.submit_at(
            command,
            command.expires_at - chrono::Duration::nanoseconds(1),
        )
    }
    fn submit_at(&mut self, command: &BoundaryCommand, now: DateTime<Utc>) -> Result<(), String> {
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
            at: now,
        });
        self.orders.insert(
            command.command_id.clone(),
            (venue_order_id.clone(), self.resting, command.expires_at),
        );
        if self.resting {
            return Ok(());
        }
        self.pending.push(KernelEvent::OrderFilled {
            command_id: command.command_id.clone(),
            venue_order_id,
            venue_fill_id,
            quantity: command.quantity.clone(),
            price,
            fee_currency: "USD".to_owned(),
            fee_amount: "0".to_owned(),
            at: now,
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
    #[test]
    fn tp07_cached_submission_checks_binding_expiry_and_kill_before_replay() {
        let mut g = ExecutionGateway::new(limits(), PaperKernel::new("100"));
        let c = command_fixture("tp07-binding");
        g.submit(&c, now()).unwrap();
        let mut changed = c.clone();
        changed.account_id = "other".into();
        assert!(matches!(
            g.submit(&changed, now()),
            Err(GatewayError::IdempotencyConflict)
        ));
        assert!(g.submit(&c, c.expires_at).is_err());
        g.engage_kill_switch();
        assert!(g.submit(&c, now()).is_err());
        assert_eq!(g.downstream_submission_count(), 1);
    }
    #[test]
    fn tp07_zero_future_and_arithmetic_overflow_are_rejected_without_kernel_call() {
        for n in 0..4 {
            let mut c = command_fixture("invalid");
            let mut l = limits();
            match n {
                0 => c.quantity = "0".into(),
                1 => c.limit_price = Some("0".into()),
                2 => c.issued_at = now() + ChronoDuration::seconds(1),
                _ => {
                    c.quantity = Decimal::MAX.to_string();
                    c.limit_price = Some(Decimal::MAX.to_string());
                    l.max_quantity = Decimal::MAX;
                    l.max_notional = Decimal::MAX;
                }
            }
            let mut g = ExecutionGateway::new(l, PaperKernel::new("100"));
            assert!(g.submit(&c, now()).is_err());
            assert_eq!(g.downstream_submission_count(), 0);
        }
    }
    fn projected_events() -> (
        ExecutionGateway<NautilusBoundaryAdapter>,
        TradeCommand,
        SubmissionReceipt,
    ) {
        let mut g = ExecutionGateway::new(limits(), NautilusBoundaryAdapter::new());
        let c = command_fixture("projection");
        let r = g.submit(&c, now()).unwrap();
        g.kernel_mut().push_event(KernelEvent::OrderAccepted {
            command_id: c.command_id.to_string(),
            venue_order_id: "v1".into(),
            at: now(),
        });
        g.try_collect_events().unwrap();
        (g, c, r)
    }
    fn partial(c: &TradeCommand, id: &str, qty: &str, price: &str) -> KernelEvent {
        KernelEvent::OrderFilled {
            command_id: c.command_id.to_string(),
            venue_order_id: "v1".into(),
            venue_fill_id: id.into(),
            quantity: qty.into(),
            price: price.into(),
            fee_currency: "USD".into(),
            fee_amount: "0.1".into(),
            at: now() + ChronoDuration::seconds(1),
        }
    }
    #[test]
    fn tp07_partial_fills_accumulate_decimal_quantity_and_weighted_price_once() {
        let (mut g, c, r) = projected_events();
        let first = partial(&c, "f1", "0.5", "100");
        g.kernel_mut().push_event(first.clone());
        g.kernel_mut().push_event(first.clone());
        assert_eq!(g.try_collect_events().unwrap().len(), 1);
        assert_eq!(g.order(&r.order_id).unwrap().filled_quantity, "0.5");
        g.kernel_mut().push_event(partial(&c, "f2", "1.0", "101.5"));
        assert_eq!(g.try_collect_events().unwrap().len(), 1);
        let order = g.order(&r.order_id).unwrap();
        assert_eq!(order.status, "filled");
        assert_eq!(order.filled_quantity, "1.5");
        assert_eq!(order.average_fill_price.as_deref(), Some("101"));
        g.kernel_mut().push_event(first);
        assert!(g.try_collect_events().unwrap().is_empty());
        assert_eq!(g.fills().len(), 2);
    }
    #[test]
    fn tp07_invalid_event_batches_rollback_and_quarantine_instead_of_corrupting_orders() {
        for variant in 0..8 {
            let (mut g, c, r) = projected_events();
            let before = g.order(&r.order_id).unwrap().clone();
            g.kernel_mut()
                .push_event(partial(&c, "valid", "0.5", "100"));
            let mut bad = partial(&c, "bad", "1", "100");
            if let KernelEvent::OrderFilled {
                command_id,
                venue_order_id,
                venue_fill_id,
                quantity,
                price,
                fee_amount,
                at,
                ..
            } = &mut bad
            {
                match variant {
                    0 => *command_id = "unknown".into(),
                    1 => *venue_order_id = "foreign".into(),
                    2 => *quantity = "2".into(),
                    3 => *price = "0".into(),
                    4 => *fee_amount = "-1".into(),
                    5 => *at = now() - ChronoDuration::seconds(1),
                    6 => *venue_fill_id = "".into(),
                    _ => *quantity = "NaN".into(),
                }
            }
            g.kernel_mut().push_event(bad);
            assert!(g.try_collect_events().is_err());
            assert_eq!(g.order(&r.order_id).unwrap(), &before);
            assert!(g.fills().is_empty());
            assert!(g.submit(&c, now()).is_err());
        }
    }
    #[test]
    fn tp07_conflicting_duplicate_fill_and_illegal_transition_are_rejected() {
        let (mut g, c, _) = projected_events();
        g.kernel_mut().push_event(partial(&c, "f1", "0.5", "100"));
        g.try_collect_events().unwrap();
        g.kernel_mut().push_event(partial(&c, "f1", "0.5", "102"));
        assert!(g.try_collect_events().is_err());
        assert_eq!(g.fills().len(), 1);
        let (mut g, c, _) = projected_events();
        g.kernel_mut().push_event(KernelEvent::OrderRejected {
            command_id: c.command_id.to_string(),
            reason: "rejection after acceptance".into(),
            at: now(),
        });
        assert!(g.try_collect_events().is_err());
    }
    #[test]
    fn tp07_rejection_reason_and_event_expiry_are_checked_projection_facts() {
        let mut g = ExecutionGateway::new(limits(), NautilusBoundaryAdapter::new());
        let c = command_fixture("rejected");
        let r = g.submit(&c, now()).unwrap();
        g.kernel_mut().push_event(KernelEvent::OrderRejected {
            command_id: c.command_id.to_string(),
            reason: "instrument unavailable".into(),
            at: now(),
        });
        g.try_collect_events().unwrap();
        let order = g.order(&r.order_id).unwrap();
        assert_eq!(order.status, "rejected");
        assert_eq!(
            order.rejection_reason.as_deref(),
            Some("instrument unavailable")
        );
        assert!(g.fills().is_empty());
        let (mut g, c, r) = projected_events();
        let before = g.order(&r.order_id).unwrap().clone();
        let mut event = partial(&c, "late", "0.5", "100");
        if let KernelEvent::OrderFilled { at, .. } = &mut event {
            *at = c.expires_at;
        }
        g.kernel_mut().push_event(event);
        assert!(g.try_collect_events().is_err());
        assert_eq!(g.order(&r.order_id).unwrap(), &before);
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
    cancel_outbox: Vec<NautilusCancelWire>,
    client_order_index: BTreeMap<String, String>,
    pending: Vec<KernelEvent>,
}

/// QuantOS-owned mirror of the Nautilus order-submit wire shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
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

/// Owned cancel wire vocabulary; no credentials or user request keys.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NautilusCancelWire {
    pub client_order_id: String,
    pub venue_order_id: String,
    pub cancel_id: String,
    pub requested_at: DateTime<Utc>,
}
impl NautilusBoundaryAdapter {
    pub fn wire_cancel(r: &BoundaryCancel) -> NautilusCancelWire {
        NautilusCancelWire {
            client_order_id: deterministic_id("client-order", &r.command_id),
            venue_order_id: r.venue_order_id.clone(),
            cancel_id: r.cancel_id.clone(),
            requested_at: r.requested_at,
        }
    }
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn cancel_outbox(&self) -> &[NautilusCancelWire] {
        &self.cancel_outbox
    }

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
            client_order_id: deterministic_id("client-order", &command.command_id),
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
            "OrderCanceled" => Ok(KernelEvent::OrderCancelled {
                command_id: text("client_order_id")?,
                venue_order_id: text("venue_order_id")?,
                cancel_id: text("cancel_id")?,
                at,
            }),
            "OrderCancelRejected" => Ok(KernelEvent::CancelRejected {
                command_id: text("client_order_id")?,
                venue_order_id: text("venue_order_id")?,
                cancel_id: text("cancel_id")?,
                reason: text("reason")?,
                at,
            }),
            "OrderExpired" => Ok(KernelEvent::OrderExpired {
                command_id: text("client_order_id")?,
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
        let client_order_id = event.binding().0.to_owned();
        let command_id = self
            .client_order_index
            .get(&client_order_id)
            .cloned()
            .ok_or_else(|| format!("unknown client_order_id {client_order_id}"))?;
        Ok(match event {
            KernelEvent::OrderCancelled {
                venue_order_id,
                cancel_id,
                at,
                ..
            } => KernelEvent::OrderCancelled {
                command_id,
                venue_order_id,
                cancel_id,
                at,
            },
            KernelEvent::CancelRejected {
                venue_order_id,
                cancel_id,
                reason,
                at,
                ..
            } => KernelEvent::CancelRejected {
                command_id,
                venue_order_id,
                cancel_id,
                reason,
                at,
            },
            KernelEvent::OrderExpired { at, .. } => KernelEvent::OrderExpired { command_id, at },
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
    fn cancel(&mut self, r: &BoundaryCancel) -> Result<(), String> {
        if !self
            .client_order_index
            .values()
            .any(|id| id == &r.command_id)
        {
            return Err("unknown command".into());
        }
        self.cancel_outbox.push(Self::wire_cancel(r));
        Ok(())
    }
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

fn apply_event(
    order: &mut GatewayOrder,
    fills: &BTreeMap<String, GatewayFill>,
    new_fills: &mut BTreeMap<String, GatewayFill>,
    event: KernelEvent,
    expires_at: DateTime<Utc>,
) -> Result<(), GatewayError> {
    let bad = || GatewayError::InvalidEvents;
    let (command_id, at) = event.binding();
    if order.command_id != command_id
        || at < order.submitted_at
        || (!matches!(event, KernelEvent::OrderExpired { .. }) && at >= expires_at)
    {
        return Err(bad());
    }
    match event {
        KernelEvent::OrderAccepted { venue_order_id, .. } => {
            if venue_order_id.is_empty()
                || order.status != "submitted"
                || at < order.updated_at
                || order
                    .venue_order_id
                    .as_ref()
                    .is_some_and(|id| id != &venue_order_id)
            {
                return Err(bad());
            }
            order.venue_order_id = Some(venue_order_id);
            if order.status == "submitted" {
                order.status = "accepted".into();
                order.updated_at = at;
            }
        }
        KernelEvent::OrderRejected { reason, .. } => {
            if order.status != "submitted" || at < order.updated_at {
                return Err(bad());
            }
            if reason.trim().is_empty()
                || reason.len() > 1024
                || order
                    .rejection_reason
                    .as_ref()
                    .is_some_and(|r| r != &reason)
            {
                return Err(bad());
            }
            order.rejection_reason = Some(reason);
            order.status = "rejected".into();
            order.updated_at = at;
        }
        KernelEvent::OrderFilled {
            venue_order_id,
            venue_fill_id,
            quantity,
            price,
            fee_currency,
            fee_amount,
            ..
        } => {
            let fill = GatewayFill {
                command_id: order.command_id.clone(),
                fill_id: deterministic_id("fill", &format!("{}:{venue_fill_id}", order.command_id)),
                order_id: order.order_id.clone(),
                venue_fill_id: Some(venue_fill_id.clone()),
                symbol: order.symbol.clone(),
                quantity: quantity.clone(),
                price: price.clone(),
                fee_currency: fee_currency.clone(),
                fee_amount: fee_amount.clone(),
                filled_at: at,
            };
            if let Some(prior) = fills
                .get(&fill.fill_id)
                .or_else(|| new_fills.get(&fill.fill_id))
            {
                if prior != &fill {
                    return Err(bad());
                }
                return Ok(());
            }
            if venue_fill_id.is_empty()
                || venue_order_id.is_empty()
                || at < order.updated_at
                || !matches!(order.status.as_str(), "accepted" | "partially_filled")
                || order.venue_order_id.as_ref() != Some(&venue_order_id)
                || fee_currency.is_empty()
                || fee_currency.len() > 12
                || !fee_currency.bytes().all(|b| b.is_ascii_uppercase())
            {
                return Err(bad());
            }
            let parse = |s: &str| Quantity::parse_str(s).map(|q| q.value()).map_err(|_| bad());
            let q = parse(&quantity)?;
            let p = parse(&price)?;
            parse(&fee_amount)?;
            let before = parse(&order.filled_quantity)?;
            let total = before.checked_add(q).ok_or_else(bad)?;
            let expected = parse(&order.quantity)?;
            if q <= Decimal::ZERO || p <= Decimal::ZERO || total > expected {
                return Err(bad());
            }
            let prior_price = order
                .average_fill_price
                .as_deref()
                .map(parse)
                .transpose()?
                .unwrap_or_default();
            let cost = prior_price
                .checked_mul(before)
                .and_then(|v| p.checked_mul(q).and_then(|n| v.checked_add(n)))
                .ok_or_else(bad)?;
            order.filled_quantity = total.normalize().to_string();
            order.average_fill_price = Some(
                cost.checked_div(total)
                    .ok_or_else(bad)?
                    .normalize()
                    .to_string(),
            );
            order.status = if total == expected {
                "filled"
            } else {
                "partially_filled"
            }
            .into();
            order.updated_at = at;
            new_fills.insert(fill.fill_id.clone(), fill);
        }
        KernelEvent::OrderExpired { .. } => {
            if at < expires_at
                || at < order.updated_at
                || !matches!(
                    order.status.as_str(),
                    "submitted" | "accepted" | "partially_filled"
                )
            {
                return Err(bad());
            }
            order.status = "expired".into();
            order.updated_at = at;
        }
        KernelEvent::OrderCancelled { .. } | KernelEvent::CancelRejected { .. } => {
            return Err(bad());
        }
    }
    Ok(())
}

fn apply_cancel(
    order: &mut GatewayOrder,
    audit: &mut CancelAudit,
    event: &KernelEvent,
) -> Result<(), GatewayError> {
    let (_, at) = event.binding();
    let (command_id, venue_order_id, cancel_id, reason) = match event {
        KernelEvent::OrderCancelled {
            command_id,
            venue_order_id,
            cancel_id,
            ..
        } => (command_id, venue_order_id, cancel_id, None),
        KernelEvent::CancelRejected {
            command_id,
            venue_order_id,
            cancel_id,
            reason,
            ..
        } => (command_id, venue_order_id, cancel_id, Some(reason)),
        _ => return Err(GatewayError::InvalidEvents),
    };
    let latency = (at - audit.request.requested_at)
        .num_microseconds()
        .ok_or(GatewayError::InvalidEvents)?;
    if command_id != &order.command_id
        || command_id != &audit.request.command_id
        || venue_order_id != &audit.request.venue_order_id
        || order.venue_order_id.as_ref() != Some(venue_order_id)
        || cancel_id != &audit.request.cancel_id
        || !matches!(
            audit.outcome,
            CancelOutcome::Pending | CancelOutcome::Uncertain
        )
        || !(0..=1_000_000).contains(&latency)
        || at < order.updated_at
        || reason.is_some_and(|r| r.trim().is_empty() || r.len() > 1024)
    {
        return Err(GatewayError::InvalidEvents);
    }
    if let Some(reason) = reason {
        audit.outcome = CancelOutcome::Rejected;
        audit.reason = Some(reason.clone());
    } else {
        if !matches!(order.status.as_str(), "accepted" | "partially_filled") {
            return Err(GatewayError::InvalidEvents);
        }
        order.status = "cancelled".into();
        order.updated_at = at;
        audit.outcome = CancelOutcome::Cancelled;
    }
    order.updated_at = at;
    audit.completed_at = Some(at);
    audit.latency_micros = Some(latency);
    Ok(())
}
