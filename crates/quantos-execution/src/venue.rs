use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use quantos_core::CoreError;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

use crate::{
    OrderSide, TradeCommand,
    paper::{OrderEvent, OrderEventKind, VenueAdapter},
};

pub const APPROVED_TESTNET_VENUE: &str = "binance-spot-testnet";
pub const APPROVED_TESTNET_ENDPOINT: &str = "https://testnet.binance.vision";
pub const COMPAT_REPORT_VERSION: &str = "venue-compat.v1";

// ---------------------------------------------------------------------------
// Configuration: approved venue only, no production endpoints or keys
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq)]
pub struct VenueConfig {
    pub venue_id: String,
    pub endpoint: String,
    pub price_precision: u32,
    pub quantity_precision: u32,
    pub rate_limit_per_second: u32,
    /// Secret *reference* (e.g. `secret://quantos/venues/testnet-key`), never
    /// the key material itself.
    pub api_key_ref: String,
}

impl VenueConfig {
    #[must_use]
    pub fn approved_testnet() -> Self {
        Self {
            venue_id: APPROVED_TESTNET_VENUE.to_owned(),
            endpoint: APPROVED_TESTNET_ENDPOINT.to_owned(),
            price_precision: 2,
            quantity_precision: 4,
            rate_limit_per_second: 5,
            api_key_ref: "secret://quantos/venues/binance-testnet-key".to_owned(),
        }
    }

    pub fn validate(&self) -> Result<(), VenueConfigError> {
        if self.venue_id != APPROVED_TESTNET_VENUE {
            return Err(VenueConfigError::VenueNotApproved {
                venue_id: "[unapproved venue]".into(),
            });
        }
        if self.endpoint != APPROVED_TESTNET_ENDPOINT {
            return Err(VenueConfigError::ProductionEndpointForbidden {
                endpoint: "[unapproved origin]".into(),
            });
        }
        if self.api_key_ref != "secret://quantos/venues/binance-testnet-key" {
            return Err(VenueConfigError::ProductionKeyForbidden);
        }
        if self.price_precision > 18
            || self.quantity_precision > 18
            || !(1..=1000).contains(&self.rate_limit_per_second)
        {
            return Err(VenueConfigError::InvalidLimits);
        }
        Ok(())
    }
}

impl fmt::Debug for VenueConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("VenueConfig")
            .field("approved", &self.validate().is_ok())
            .field("price_precision", &self.price_precision)
            .field("quantity_precision", &self.quantity_precision)
            .field("key_ref", &"[redacted]")
            .finish()
    }
}
#[derive(Debug, Error)]
pub enum VenueConfigError {
    #[error("VENUE_NOT_APPROVED: venue `{venue_id}` is not the approved L01 venue")]
    VenueNotApproved { venue_id: String },
    #[error("VENUE_PRODUCTION_ENDPOINT_FORBIDDEN: `{endpoint}` is a production endpoint")]
    ProductionEndpointForbidden { endpoint: String },
    #[error("VENUE_PRODUCTION_KEY_FORBIDDEN: production key references are never allowed")]
    ProductionKeyForbidden,
    #[error("VENUE_INVALID_LIMITS")]
    InvalidLimits,
}

// ---------------------------------------------------------------------------
// Order intent mapping (precision + rate limits)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VenueOrderIntent {
    pub client_order_id: String,
    pub symbol: String,
    pub side: String,
    pub order_type: String,
    pub quantity: String,
    pub limit_price: Option<String>,
    pub stop_price: Option<String>,
}

pub fn map_order_intent(
    command: &TradeCommand,
    config: &VenueConfig,
) -> Result<VenueOrderIntent, VenueError> {
    config.validate()?;
    if command.venue != config.venue_id
        || command.venue_kind != crate::VenueKind::Cex
        || command.symbol.is_empty()
        || command.symbol.len() > 20
        || !command
            .symbol
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
    {
        return Err(invalid_decimal());
    }
    let quantity = round_decimal(&command.quantity, config.quantity_precision)?;
    if Decimal::from_str_exact(&quantity).map_err(|_| invalid_decimal())? == Decimal::ZERO {
        return Err(VenueError::Rejected {
            class: VenueErrorClass::Rejected,
            detail: "quantity rounds to zero at venue precision".to_owned(),
        });
    }
    let limit_price = command
        .limit_price
        .as_deref()
        .map(|price| round_decimal(price, config.price_precision))
        .transpose()?;
    let stop_price = command
        .stop_price
        .as_deref()
        .map(|price| round_decimal(price, config.price_precision))
        .transpose()?;
    let kind = match command.intent {
        crate::OrderIntent::Market if limit_price.is_none() && stop_price.is_none() => "MARKET",
        crate::OrderIntent::Limit if limit_price.is_some() && stop_price.is_none() => "LIMIT",
        crate::OrderIntent::Stop if limit_price.is_none() && stop_price.is_some() => "STOP_LOSS",
        crate::OrderIntent::StopLimit if limit_price.is_some() && stop_price.is_some() => {
            "STOP_LOSS_LIMIT"
        }
        _ => return Err(invalid_decimal()),
    };
    Ok(VenueOrderIntent {
        client_order_id: command.command_id.to_string(),
        symbol: command.symbol.clone(),
        side: match command.side {
            OrderSide::Buy => "BUY".to_owned(),
            OrderSide::Sell => "SELL".to_owned(),
        },
        order_type: kind.to_owned(),
        quantity,
        limit_price,
        stop_price,
    })
}

fn invalid_decimal() -> VenueError {
    VenueError::Rejected {
        class: VenueErrorClass::Rejected,
        detail: "invalid owned order or precision".into(),
    }
}
fn round_decimal(value: &str, precision: u32) -> Result<String, VenueError> {
    if precision > 18
        || value.is_empty()
        || value.len() > 96
        || !value.bytes().all(|b| b.is_ascii_digit() || b == b'.')
        || value.bytes().filter(|b| *b == b'.').count() > 1
    {
        return Err(invalid_decimal());
    }
    let parsed = Decimal::from_str_exact(value).map_err(|_| invalid_decimal())?;
    let rounded = parsed.round_dp_with_strategy(precision, RoundingStrategy::ToZero);
    if parsed <= Decimal::ZERO || rounded <= Decimal::ZERO {
        return Err(invalid_decimal());
    }
    Ok(format!("{rounded:.width$}", width = precision as usize))
}

// ---------------------------------------------------------------------------
// Transport boundary + failure classification
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VenueErrorClass {
    Network,
    Authentication,
    RateLimited,
    Rejected,
}

impl VenueErrorClass {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Authentication => "authentication",
            Self::RateLimited => "rate_limited",
            Self::Rejected => "rejected",
        }
    }
}

#[derive(Debug, Error)]
pub enum VenueError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Config(#[from] VenueConfigError),
    #[error("VENUE_{class:?}: {detail}")]
    Rejected {
        class: VenueErrorClass,
        detail: String,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum VenueOrderResponse {
    Accepted {
        venue_order_id: String,
    },
    AcceptedThenFilled {
        venue_order_id: String,
        quantity: f64,
        price: f64,
        fee: f64,
    },
    AcceptedPartialFill {
        venue_order_id: String,
        quantity: f64,
        price: f64,
        fee: f64,
    },
    Rejected {
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum VenueCancelResponse {
    Cancelled,
    Rejected { reason: String },
}

#[derive(Error)]
pub enum VenueTransportError {
    #[error("network failure")]
    Network { detail: String },
    #[error("authentication failure")]
    Authentication { detail: String },
    #[error("rate limited: retry after {retry_after_ms}ms")]
    RateLimited { retry_after_ms: u64 },
}

impl fmt::Debug for VenueTransportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, f)
    }
}

/// Legacy fixture-only transport. No HTTP or credential implementation is provided.
/// Use venue_protocol::ProtocolKernel for the sanitized X04 protocol boundary.
pub trait TestnetTransport {
    fn place_order(
        &mut self,
        intent: &VenueOrderIntent,
    ) -> Result<VenueOrderResponse, VenueTransportError>;
    fn cancel_order(
        &mut self,
        venue_order_id: &str,
    ) -> Result<VenueCancelResponse, VenueTransportError>;
}

// ---------------------------------------------------------------------------
// Venue plugin: adapts the approved testnet venue to the X04 VenueAdapter
// ---------------------------------------------------------------------------

pub struct TestnetVenueAdapter<T: TestnetTransport> {
    config: VenueConfig,
    transport: T,
    sequence: u64,
    submit_window_ms: u64,
    submits_in_window: u32,
    last_venue_order_id: Option<String>,
    last_clock_ms: Option<u64>,
    order_status: BTreeMap<String, bool>, // venue_order_id -> filled
}

impl<T: TestnetTransport> TestnetVenueAdapter<T> {
    pub fn new(config: VenueConfig, transport: T) -> Result<Self, VenueError> {
        config.validate()?;
        Ok(Self {
            config,
            transport,
            sequence: 0,
            submit_window_ms: 0,
            submits_in_window: 0,
            last_venue_order_id: None,
            last_clock_ms: None,
            order_status: BTreeMap::new(),
        })
    }

    #[must_use]
    pub const fn config(&self) -> &VenueConfig {
        &self.config
    }

    fn check_rate_limit(&mut self, now_ms: u64) -> Result<(), VenueError> {
        if self.last_clock_ms.is_some_and(|last| now_ms < last) {
            return Err(invalid_decimal());
        }
        self.last_clock_ms = Some(now_ms);
        let window = now_ms / 1_000;
        if window != self.submit_window_ms {
            self.submit_window_ms = window;
            self.submits_in_window = 0;
        }
        if self.submits_in_window >= self.config.rate_limit_per_second {
            return Err(VenueError::Rejected {
                class: VenueErrorClass::RateLimited,
                detail: format!(
                    "venue rate limit {} rps exceeded",
                    self.config.rate_limit_per_second
                ),
            });
        }
        self.submits_in_window += 1;
        Ok(())
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

    fn classify_transport_error(error: VenueTransportError) -> VenueError {
        match error {
            VenueTransportError::Network { .. } => VenueError::Rejected {
                class: VenueErrorClass::Network,
                detail: "transport outcome unavailable; fixture-only classification".into(),
            },
            VenueTransportError::Authentication { .. } => VenueError::Rejected {
                class: VenueErrorClass::Authentication,
                detail: "authentication refused".into(),
            },
            VenueTransportError::RateLimited { retry_after_ms } => VenueError::Rejected {
                class: VenueErrorClass::RateLimited,
                detail: format!("retry after {retry_after_ms}ms"),
            },
        }
    }
}

impl<T: TestnetTransport> VenueAdapter for TestnetVenueAdapter<T> {
    fn submit(&mut self, command: &TradeCommand, submitted_at: DateTime<Utc>) -> Vec<OrderEvent> {
        let Ok(now_ms) = u64::try_from(submitted_at.timestamp_millis()) else {
            return vec![self.next_event(
                "invalid-clock",
                submitted_at,
                OrderEventKind::Rejected {
                    reason: "invalid clock".into(),
                },
            )];
        };
        if let Err(error) = self.check_rate_limit(now_ms) {
            let venue_order_id = format!("rejected:{}", command.command_id);
            return vec![self.next_event(
                &venue_order_id,
                submitted_at,
                OrderEventKind::Rejected {
                    reason: error.to_string(),
                },
            )];
        }
        let intent = match map_order_intent(command, &self.config) {
            Ok(intent) => intent,
            Err(error) => {
                let venue_order_id = format!("rejected:{}", command.command_id);
                return vec![self.next_event(
                    &venue_order_id,
                    submitted_at,
                    OrderEventKind::Rejected {
                        reason: error.to_string(),
                    },
                )];
            }
        };
        let venue_order_id_fallback = format!("testnet-order:{}", command.command_id);
        let response = self.transport.place_order(&intent);
        if let Ok(ref reply) = response {
            let valid_id = |id: &str| {
                !id.is_empty()
                    && id.len() <= 128
                    && id
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b":_-".contains(&b))
            };
            let amount = intent.quantity.parse::<f64>().unwrap_or_default();
            let valid = match reply {
                VenueOrderResponse::Accepted { venue_order_id } => valid_id(venue_order_id),
                VenueOrderResponse::AcceptedThenFilled {
                    venue_order_id,
                    quantity,
                    price,
                    fee,
                } => {
                    valid_id(venue_order_id)
                        && quantity.is_finite()
                        && *quantity == amount
                        && price.is_finite()
                        && *price > 0.0
                        && fee.is_finite()
                        && *fee >= 0.0
                }
                VenueOrderResponse::AcceptedPartialFill {
                    venue_order_id,
                    quantity,
                    price,
                    fee,
                } => {
                    valid_id(venue_order_id)
                        && quantity.is_finite()
                        && *quantity > 0.0
                        && *quantity < amount
                        && price.is_finite()
                        && *price > 0.0
                        && fee.is_finite()
                        && *fee >= 0.0
                }
                VenueOrderResponse::Rejected { .. } => true,
            };
            if !valid {
                return vec![self.next_event(
                    &venue_order_id_fallback,
                    submitted_at,
                    OrderEventKind::Rejected {
                        reason: "invalid fixture response".into(),
                    },
                )];
            }
        }
        match response {
            Ok(VenueOrderResponse::Accepted { venue_order_id }) => {
                self.order_status.insert(venue_order_id.clone(), false);
                self.last_venue_order_id = Some(venue_order_id.clone());
                vec![self.next_event(&venue_order_id, submitted_at, OrderEventKind::Accepted)]
            }
            Ok(VenueOrderResponse::AcceptedThenFilled {
                venue_order_id,
                quantity,
                price,
                fee,
            }) => {
                self.order_status.insert(venue_order_id.clone(), true);
                self.last_venue_order_id = Some(venue_order_id.clone());
                vec![
                    self.next_event(&venue_order_id, submitted_at, OrderEventKind::Accepted),
                    self.next_event(
                        &venue_order_id,
                        submitted_at,
                        OrderEventKind::Filled {
                            quantity,
                            price,
                            fee,
                        },
                    ),
                ]
            }
            Ok(VenueOrderResponse::AcceptedPartialFill {
                venue_order_id,
                quantity,
                price,
                fee,
            }) => {
                self.order_status.insert(venue_order_id.clone(), false);
                self.last_venue_order_id = Some(venue_order_id.clone());
                vec![
                    self.next_event(&venue_order_id, submitted_at, OrderEventKind::Accepted),
                    self.next_event(
                        &venue_order_id,
                        submitted_at,
                        OrderEventKind::PartialFill {
                            quantity,
                            price,
                            fee,
                        },
                    ),
                ]
            }
            Ok(VenueOrderResponse::Rejected { .. }) => {
                vec![self.next_event(
                    &venue_order_id_fallback,
                    submitted_at,
                    OrderEventKind::Rejected {
                        reason: "venue rejected order".into(),
                    },
                )]
            }
            Err(error) => {
                let classified = Self::classify_transport_error(error);
                vec![self.next_event(
                    &venue_order_id_fallback,
                    submitted_at,
                    OrderEventKind::Rejected {
                        reason: classified.to_string(),
                    },
                )]
            }
        }
    }

    fn cancel(&mut self, venue_order_id: &str, requested_at: DateTime<Utc>) -> Vec<OrderEvent> {
        if self.order_status.get(venue_order_id) != Some(&false) {
            return vec![self.next_event(
                venue_order_id,
                requested_at,
                OrderEventKind::CancelRejected {
                    reason: "unknown or terminal fixture order".into(),
                },
            )];
        }
        if let Err(error) = u64::try_from(requested_at.timestamp_millis())
            .map_err(|_| invalid_decimal())
            .and_then(|n| self.check_rate_limit(n))
        {
            return vec![self.next_event(
                venue_order_id,
                requested_at,
                OrderEventKind::CancelRejected {
                    reason: error.to_string(),
                },
            )];
        }
        match self.transport.cancel_order(venue_order_id) {
            Ok(VenueCancelResponse::Cancelled) => {
                self.order_status.insert(venue_order_id.to_owned(), true);
                vec![self.next_event(venue_order_id, requested_at, OrderEventKind::Cancelled)]
            }
            Ok(VenueCancelResponse::Rejected { .. }) => {
                vec![self.next_event(
                    venue_order_id,
                    requested_at,
                    OrderEventKind::CancelRejected {
                        reason: "venue rejected cancel".into(),
                    },
                )]
            }
            Err(error) => {
                let classified = Self::classify_transport_error(error);
                vec![self.next_event(
                    venue_order_id,
                    requested_at,
                    OrderEventKind::CancelRejected {
                        reason: classified.to_string(),
                    },
                )]
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Scenario-driven testnet fixtures + compatibility report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TestnetScenarioKind {
    NormalFill,
    PartialFill,
    VenueReject,
    CancelOk,
    CancelRejected,
}

impl TestnetScenarioKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NormalFill => "normal_fill",
            Self::PartialFill => "partial_fill",
            Self::VenueReject => "venue_reject",
            Self::CancelOk => "cancel_ok",
            Self::CancelRejected => "cancel_rejected",
        }
    }
}

/// Deterministic scenario transport: replays scripted responses per intent.
#[derive(Debug, Default)]
pub struct ScenarioDrivenTransport {
    pub scenario: Option<TestnetScenarioKind>,
    pub injected_error: Option<VenueTransportError>,
    pub place_calls: u32,
    pub cancel_calls: u32,
}

impl TestnetTransport for ScenarioDrivenTransport {
    fn place_order(
        &mut self,
        intent: &VenueOrderIntent,
    ) -> Result<VenueOrderResponse, VenueTransportError> {
        self.place_calls += 1;
        if let Some(error) = &self.injected_error {
            return Err(match error {
                VenueTransportError::Network { detail } => VenueTransportError::Network {
                    detail: detail.clone(),
                },
                VenueTransportError::Authentication { detail } => {
                    VenueTransportError::Authentication {
                        detail: detail.clone(),
                    }
                }
                VenueTransportError::RateLimited { retry_after_ms } => {
                    VenueTransportError::RateLimited {
                        retry_after_ms: *retry_after_ms,
                    }
                }
            });
        }
        let venue_order_id = format!("testnet-order:{}", intent.client_order_id);
        Ok(match self.scenario {
            Some(TestnetScenarioKind::VenueReject) => VenueOrderResponse::Rejected {
                reason: "MIN_NOTIONAL".to_owned(),
            },
            Some(TestnetScenarioKind::PartialFill) => VenueOrderResponse::AcceptedPartialFill {
                venue_order_id,
                quantity: intent.quantity.parse::<f64>().unwrap_or_default() / 2.0,
                price: 100.25,
                fee: 0.25,
            },
            Some(TestnetScenarioKind::CancelOk | TestnetScenarioKind::CancelRejected) => {
                VenueOrderResponse::Accepted { venue_order_id }
            }
            _ => VenueOrderResponse::AcceptedThenFilled {
                venue_order_id,
                quantity: intent.quantity.parse::<f64>().unwrap_or_default(),
                price: 100.25,
                fee: 0.5,
            },
        })
    }

    fn cancel_order(
        &mut self,
        venue_order_id: &str,
    ) -> Result<VenueCancelResponse, VenueTransportError> {
        self.cancel_calls += 1;
        if let Some(error) = &self.injected_error {
            return Err(match error {
                VenueTransportError::Network { detail } => VenueTransportError::Network {
                    detail: detail.clone(),
                },
                VenueTransportError::Authentication { detail } => {
                    VenueTransportError::Authentication {
                        detail: detail.clone(),
                    }
                }
                VenueTransportError::RateLimited { retry_after_ms } => {
                    VenueTransportError::RateLimited {
                        retry_after_ms: *retry_after_ms,
                    }
                }
            });
        }
        Ok(match self.scenario {
            Some(TestnetScenarioKind::CancelRejected) => VenueCancelResponse::Rejected {
                reason: format!("order {venue_order_id} already filled"),
            },
            _ => VenueCancelResponse::Cancelled,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatScenarioResult {
    pub scenario_id: String,
    pub kind: TestnetScenarioKind,
    pub mapped_event_kinds: Vec<String>,
    pub mapped: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatReport {
    pub version: String,
    pub venue_id: String,
    pub endpoint: String,
    pub scenarios: Vec<CompatScenarioResult>,
    pub generated_at: DateTime<Utc>,
}

impl CompatReport {
    #[must_use]
    pub fn fully_mapped(&self) -> bool {
        self.scenarios.len() == 200
            && self.scenarios.iter().all(|scenario| scenario.mapped)
            && self
                .scenarios
                .iter()
                .map(|s| &s.scenario_id)
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                == 200
    }

    /// The report must never embed production endpoints or secret material.
    #[must_use]
    pub fn contains_forbidden_artifacts(&self) -> bool {
        let serialized = serde_json::to_string(self)
            .unwrap_or_default()
            .to_lowercase();
        serialized.contains("api.binance.com")
            || serialized.contains("prod-")
            || serialized.contains("production")
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{CommandId, ContentHash, DecisionId};

    use super::*;
    use crate::{OrderIntent, VenueKind};

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn command_fixture(seed: u64) -> TradeCommand {
        TradeCommand {
            command_id: CommandId::new(),
            decision_id: DecisionId::new(),
            account_id: "paper-account-0".to_owned(),
            venue: APPROVED_TESTNET_VENUE.to_owned(),
            venue_kind: VenueKind::Cex,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: format!("{}.123456", 1 + seed % 4),
            limit_price: Some(format!("{}.999", 100 + seed % 10)),
            stop_price: None,
            idempotency_key: format!("l01-{seed:04}"),
            approval_signature: None,
            expires_at: now() + ChronoDuration::minutes(2),
            signature: ContentHash::sha256_bytes(format!("sig-{seed}").as_bytes()),
            issued_at: now(),
        }
    }

    fn scenario_kinds() -> Vec<TestnetScenarioKind> {
        let mut kinds = Vec::new();
        for _ in 0..50 {
            kinds.push(TestnetScenarioKind::NormalFill);
        }
        for _ in 0..50 {
            kinds.push(TestnetScenarioKind::PartialFill);
        }
        for _ in 0..50 {
            kinds.push(TestnetScenarioKind::VenueReject);
        }
        for _ in 0..25 {
            kinds.push(TestnetScenarioKind::CancelOk);
            kinds.push(TestnetScenarioKind::CancelRejected);
        }
        kinds
    }

    #[test]
    fn two_hundred_testnet_scenarios_map_fully_to_internal_schema() {
        let mut results = Vec::new();
        for (index, kind) in scenario_kinds().into_iter().enumerate() {
            let transport = ScenarioDrivenTransport {
                scenario: Some(kind),
                ..ScenarioDrivenTransport::default()
            };
            let mut adapter = TestnetVenueAdapter::new(VenueConfig::approved_testnet(), transport)
                .expect("approved config validates");
            let command = command_fixture(index as u64);
            let submit_events = adapter.submit(&command, now());
            let mut all_events = submit_events.clone();

            if matches!(
                kind,
                TestnetScenarioKind::CancelOk | TestnetScenarioKind::CancelRejected
            ) {
                let venue_order_id = submit_events[0].venue_order_id.clone();
                all_events.extend(adapter.cancel(&venue_order_id, now()));
            }

            let expected: Vec<&str> = match kind {
                TestnetScenarioKind::NormalFill => vec!["accepted", "filled"],
                TestnetScenarioKind::PartialFill => vec!["accepted", "partial_fill"],
                TestnetScenarioKind::VenueReject => vec!["rejected"],
                TestnetScenarioKind::CancelOk => vec!["accepted", "cancelled"],
                TestnetScenarioKind::CancelRejected => vec!["accepted", "cancel_rejected"],
            };
            let actual: Vec<String> = all_events
                .iter()
                .map(|event| match &event.kind {
                    OrderEventKind::Submitted => "submitted",
                    OrderEventKind::Accepted => "accepted",
                    OrderEventKind::Rejected { .. } => "rejected",
                    OrderEventKind::PartialFill { .. } => "partial_fill",
                    OrderEventKind::Filled { .. } => "filled",
                    OrderEventKind::Cancelled => "cancelled",
                    OrderEventKind::CancelRejected { .. } => "cancel_rejected",
                    OrderEventKind::Expired => "expired",
                })
                .map(str::to_owned)
                .collect();
            let mapped = actual == expected;
            assert!(
                mapped,
                "scenario {index} ({}) mapped to {actual:?}, expected {expected:?}",
                kind.as_str()
            );
            results.push(CompatScenarioResult {
                scenario_id: format!("l01-scenario-{index:03}"),
                kind,
                mapped_event_kinds: actual,
                mapped,
            });
        }

        assert_eq!(results.len(), 200);
        let report = CompatReport {
            version: COMPAT_REPORT_VERSION.to_owned(),
            venue_id: APPROVED_TESTNET_VENUE.to_owned(),
            endpoint: APPROVED_TESTNET_ENDPOINT.to_owned(),
            scenarios: results,
            generated_at: now(),
        };
        assert!(report.fully_mapped());
        assert!(!report.contains_forbidden_artifacts());
    }

    #[test]
    fn venue_config_rejects_production_endpoints_and_keys() {
        let mut production = VenueConfig::approved_testnet();
        production.endpoint = "https://api.binance.com".to_owned();
        assert!(matches!(
            production.validate(),
            Err(VenueConfigError::ProductionEndpointForbidden { .. })
        ));

        let mut unknown_venue = VenueConfig::approved_testnet();
        unknown_venue.venue_id = "coinbase-advanced".to_owned();
        assert!(matches!(
            unknown_venue.validate(),
            Err(VenueConfigError::VenueNotApproved { .. })
        ));

        let mut prod_key = VenueConfig::approved_testnet();
        prod_key.api_key_ref = "secret://quantos/venues/prod-binance-key".to_owned();
        assert!(matches!(
            prod_key.validate(),
            Err(VenueConfigError::ProductionKeyForbidden)
        ));

        let raw_key = VenueConfig {
            api_key_ref: "AKIA-raw-key-material".to_owned(),
            ..VenueConfig::approved_testnet()
        };
        assert!(matches!(
            raw_key.validate(),
            Err(VenueConfigError::ProductionKeyForbidden)
        ));
    }

    #[test]
    fn network_and_authentication_failures_are_classified() {
        for (error, expected) in [
            (
                VenueTransportError::Network {
                    detail: "connection reset".to_owned(),
                },
                VenueErrorClass::Network,
            ),
            (
                VenueTransportError::Authentication {
                    detail: "invalid signature".to_owned(),
                },
                VenueErrorClass::Authentication,
            ),
            (
                VenueTransportError::RateLimited {
                    retry_after_ms: 500,
                },
                VenueErrorClass::RateLimited,
            ),
        ] {
            let transport = ScenarioDrivenTransport {
                scenario: None,
                injected_error: Some(error),
                ..ScenarioDrivenTransport::default()
            };
            let mut adapter = TestnetVenueAdapter::new(VenueConfig::approved_testnet(), transport)
                .expect("approved config validates");
            let events = adapter.submit(&command_fixture(1), now());
            assert_eq!(events.len(), 1);
            let OrderEventKind::Rejected { reason } = &events[0].kind else {
                panic!("expected rejection event, got {:?}", events[0].kind);
            };
            assert!(
                reason.contains(&format!("VENUE_{expected:?}")),
                "failure class {expected:?} must be classified in `{reason}`"
            );
        }
    }

    #[test]
    fn precision_and_rate_limits_are_mapped() {
        let transport = ScenarioDrivenTransport::default();
        let mut adapter = TestnetVenueAdapter::new(VenueConfig::approved_testnet(), transport)
            .expect("approved config validates");

        let command = command_fixture(0);
        let intent = map_order_intent(&command, adapter.config()).expect("intent maps");
        assert_eq!(intent.quantity, "1.1234");
        assert_eq!(intent.limit_price.as_deref(), Some("100.99"));

        for index in 0..5_u64 {
            adapter.submit(&command_fixture(100 + index), now());
        }
        let limited = adapter.submit(&command_fixture(200), now());
        assert_eq!(limited.len(), 1);
        let OrderEventKind::Rejected { reason } = &limited[0].kind else {
            panic!("expected rate limit rejection, got {:?}", limited[0].kind);
        };
        assert!(reason.contains("RateLimited") || reason.contains("rate limit"));
    }
}
