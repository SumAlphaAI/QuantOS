//! Credential-free L01 Spot Testnet protocol. The port has no supplied network
//! implementation. Only a trusted execution host may implement authenticated IO.
//! LIMIT/GTC is the current profile; signed quantities/prices are never rounded.
use crate::{
    gateway::{BoundaryCommand, ExecutionKernel, KernelEvent},
    oms::BoundaryCancel,
    venue::{APPROVED_TESTNET_ENDPOINT, VenueConfig},
};
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

pub const EXECUTION_VENUE: &str = "BINANCE_SPOT_TESTNET";
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Failure {
    InvalidRequest,
    Authentication,
    AccessDenied,
    RateLimited,
    VenueRejected,
    NetworkUnknown,
    ProtocolUnknown,
    Conflict,
}
impl std::fmt::Display for Failure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "l01_{self:?}")
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Request {
    pub method: String,
    pub path: String,
    pub params: BTreeMap<String, String>,
}
impl Request {
    pub fn origin(&self) -> &'static str {
        APPROVED_TESTNET_ENDPOINT
    }
}
pub struct Response {
    pub status: u16,
    pub retry_after_seconds: Option<u64>,
    pub body: Vec<u8>,
}
impl std::fmt::Debug for Response {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Response")
            .field("status", &self.status)
            .field("bytes", &self.body.len())
            .finish()
    }
}
#[derive(Debug, Clone, Copy)]
pub enum TransportFault {
    Disconnected,
    Timeout,
}
pub trait ProtocolPort {
    fn exchange(&mut self, request: &Request) -> Result<Response, TransportFault>;
}
#[derive(Debug, Clone)]
pub struct SymbolRules {
    pub symbol: String,
    pub price_tick: Decimal,
    pub quantity_step: Decimal,
    pub min_quantity: Decimal,
    pub max_quantity: Decimal,
    pub min_price: Decimal,
    pub max_price: Decimal,
    pub min_notional: Decimal,
    pub observed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub source_hash: ContentHash,
}
fn decimal(s: &str) -> Result<Decimal, Failure> {
    if s.is_empty()
        || s.len() > 96
        || !s.bytes().all(|b| b.is_ascii_digit() || b == b'.')
        || s.bytes().filter(|b| *b == b'.').count() > 1
    {
        return Err(Failure::InvalidRequest);
    }
    let n = Decimal::from_str_exact(s).map_err(|_| Failure::InvalidRequest)?;
    if n.scale() > 18 {
        return Err(Failure::InvalidRequest);
    }
    Ok(n)
}
impl SymbolRules {
    pub fn validate(&self) -> Result<(), Failure> {
        if self.symbol.is_empty()
            || self.symbol.len() > 20
            || !self
                .symbol
                .bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            || self.expires_at <= self.observed_at
            || self.expires_at - self.observed_at > Duration::hours(24)
        {
            return Err(Failure::InvalidRequest);
        }
        for n in [
            self.price_tick,
            self.quantity_step,
            self.min_quantity,
            self.max_quantity,
            self.min_price,
            self.max_price,
            self.min_notional,
        ] {
            if n <= Decimal::ZERO || n.scale() > 18 {
                return Err(Failure::InvalidRequest);
            }
        }
        if self.min_quantity > self.max_quantity || self.min_price > self.max_price {
            return Err(Failure::InvalidRequest);
        }
        Ok(())
    }
    fn check(&self, c: &BoundaryCommand, at: DateTime<Utc>) -> Result<(), Failure> {
        self.validate()?;
        if at < self.observed_at
            || at >= self.expires_at
            || c.venue != EXECUTION_VENUE
            || c.venue_kind != "cex"
            || c.symbol != self.symbol
            || c.intent != "limit"
            || !matches!(c.side.as_str(), "buy" | "sell")
            || c.stop_price.is_some()
            || c.command_id.len() > 128
            || c.command_id.is_empty()
            || c.idempotency_key.is_empty()
            || c.idempotency_key.len() > 256
            || (c.expires_at - at).num_milliseconds() < 1
        {
            return Err(Failure::InvalidRequest);
        }
        let q = decimal(&c.quantity)?;
        let p = decimal(c.limit_price.as_deref().ok_or(Failure::InvalidRequest)?)?;
        if q < self.min_quantity
            || q > self.max_quantity
            || p < self.min_price
            || p > self.max_price
            || q % self.quantity_step != Decimal::ZERO
            || p % self.price_tick != Decimal::ZERO
            || q.checked_mul(p).ok_or(Failure::InvalidRequest)? < self.min_notional
        {
            return Err(Failure::InvalidRequest);
        }
        Ok(())
    }
}
#[derive(Clone)]
struct Order {
    command: BoundaryCommand,
    submitted_at: DateTime<Utc>,
    client: String,
    venue: Option<String>,
    accepted: bool,
    terminal: bool,
    unknown: bool,
    filled: Decimal,
    fills: BTreeMap<String, ContentHash>,
    cancel: Option<BoundaryCancel>,
}
pub struct ProtocolKernel<P: ProtocolPort> {
    config: VenueConfig,
    rules: SymbolRules,
    port: P,
    orders: BTreeMap<String, Order>,
    keys: BTreeMap<String, String>,
    cancels: BTreeMap<String, BoundaryCancel>,
    events: Vec<KernelEvent>,
    clock: Option<DateTime<Utc>>,
    window: i64,
    used: u32,
    cooldown: Option<DateTime<Utc>>,
}
fn digest<T: Serialize>(v: &T) -> ContentHash {
    ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).expect("owned value"))
            .expect("owned protocol data serializes"),
    )
}
fn client(c: &BoundaryCommand) -> String {
    format!(
        "q{}",
        &digest(&json!(["l01-client/v1", c.command_id, c.idempotency_key])).as_str()[7..38]
    )
}
impl<P: ProtocolPort> ProtocolKernel<P> {
    pub fn new(config: VenueConfig, rules: SymbolRules, port: P) -> Result<Self, Failure> {
        config.validate().map_err(|_| Failure::InvalidRequest)?;
        rules.validate()?;
        Ok(Self {
            config,
            rules,
            port,
            orders: BTreeMap::new(),
            keys: BTreeMap::new(),
            cancels: BTreeMap::new(),
            events: vec![],
            clock: None,
            window: -1,
            used: 0,
            cooldown: None,
        })
    }
    pub fn pending_unknown(&self, id: &str) -> bool {
        self.orders.get(id).is_some_and(|o| o.unknown)
    }
    pub fn queued_events(&self) -> usize {
        self.events.len()
    }
    fn io(&mut self, mut request: Request, now: DateTime<Utc>) -> Result<Value, Failure> {
        if now.timestamp_millis() < 0 || self.clock.is_some_and(|last| now < last) {
            return Err(Failure::InvalidRequest);
        }
        if self.cooldown.is_some_and(|until| now < until) {
            return Err(Failure::RateLimited);
        }
        let window = now.timestamp();
        if window != self.window {
            self.used = 0;
            self.window = window;
        }
        if self.used >= self.config.rate_limit_per_second {
            return Err(Failure::RateLimited);
        }
        self.used += 1;
        self.clock = Some(now);
        request
            .params
            .insert("timestamp".into(), now.timestamp_millis().to_string());
        request
            .params
            .entry("recvWindow".into())
            .or_insert_with(|| "5000".into());
        let response = self
            .port
            .exchange(&request)
            .map_err(|_| Failure::NetworkUnknown)?;
        if response.status == 429 || response.status == 418 {
            let seconds = response.retry_after_seconds.unwrap_or(60).max(1);
            self.cooldown = Some(if seconds > 604800 {
                DateTime::<Utc>::MAX_UTC
            } else {
                now.checked_add_signed(Duration::seconds(seconds as i64))
                    .unwrap_or(DateTime::<Utc>::MAX_UTC)
            });
            return Err(Failure::RateLimited);
        }
        if response.status >= 500 {
            return Err(Failure::NetworkUnknown);
        }
        if response.status == 401 {
            return Err(Failure::Authentication);
        }
        if response.status == 403 {
            return Err(Failure::AccessDenied);
        }
        if response.body.len() > 262144 {
            return Err(Failure::ProtocolUnknown);
        }
        let value: Value =
            serde_json::from_slice(&response.body).map_err(|_| Failure::ProtocolUnknown)?;
        if let Some(code) = value.get("code").and_then(Value::as_i64) {
            if !matches!(code, -1006 | -1007) && !(400..500).contains(&response.status) {
                return Err(Failure::ProtocolUnknown);
            }
            return Err(match code {
                -1006 | -1007 => Failure::NetworkUnknown,
                -1002 | -1022 | -2014 | -2015 => Failure::Authentication,
                -1003 | -1015 => {
                    self.cooldown = Some(
                        now.checked_add_signed(Duration::seconds(60))
                            .unwrap_or(DateTime::<Utc>::MAX_UTC),
                    );
                    Failure::RateLimited
                }
                -1013 | -2010 | -2011 | -1130..=-1100 => Failure::VenueRejected,
                _ => Failure::ProtocolUnknown,
            });
        }
        if response.status != 200 {
            return Err(Failure::ProtocolUnknown);
        }
        Ok(value)
    }
    fn request(
        method: &str,
        path: &str,
        params: impl IntoIterator<Item = (String, String)>,
    ) -> Request {
        Request {
            method: method.into(),
            path: path.into(),
            params: params.into_iter().collect(),
        }
    }
    fn apply(
        &mut self,
        id: &str,
        raw: Value,
        at: DateTime<Utc>,
        cancel_response: bool,
    ) -> Result<(), Failure> {
        let original = self.orders.get(id).ok_or(Failure::Conflict)?;
        let mut order = original.clone();
        let text = |key: &str| {
            raw.get(key)
                .and_then(Value::as_str)
                .ok_or(Failure::ProtocolUnknown)
        };
        let venue = raw
            .get("orderId")
            .and_then(Value::as_u64)
            .filter(|n| *n > 0)
            .ok_or(Failure::ProtocolUnknown)?
            .to_string();
        let time = raw
            .get("transactTime")
            .or_else(|| raw.get("updateTime"))
            .and_then(Value::as_i64)
            .and_then(DateTime::from_timestamp_millis)
            .ok_or(Failure::ProtocolUnknown)?;
        let q = decimal(text("origQty")?).map_err(|_| Failure::ProtocolUnknown)?;
        let executed = decimal(text("executedQty")?).map_err(|_| Failure::ProtocolUnknown)?;
        if text("symbol")? != order.command.symbol
            || text("side")? != order.command.side.to_ascii_uppercase()
            || text("type")? != "LIMIT"
            || q != decimal(&order.command.quantity)?
            || decimal(text("price")?)?
                != decimal(
                    order
                        .command
                        .limit_price
                        .as_deref()
                        .ok_or(Failure::ProtocolUnknown)?,
                )?
            || executed < order.filled
            || executed > q
            || time < order.submitted_at
            || time > at
            || time.timestamp_millis() < 0
            || order.venue.as_ref().is_some_and(|v| v != &venue)
        {
            return Err(Failure::ProtocolUnknown);
        }
        if cancel_response {
            let c = order.cancel.as_ref().ok_or(Failure::Conflict)?;
            if text("origClientOrderId")? != order.client
                || text("clientOrderId")? != cancel_client(c)
            {
                return Err(Failure::ProtocolUnknown);
            }
        } else if text("clientOrderId")?
            != order
                .cancel
                .as_ref()
                .filter(|_| raw["status"] == "CANCELED")
                .map(cancel_client)
                .unwrap_or_else(|| order.client.clone())
        {
            return Err(Failure::ProtocolUnknown);
        }
        let status = text("status")?;
        if !matches!(
            status,
            "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED"
        ) || status == "NEW" && executed != Decimal::ZERO
            || status == "PARTIALLY_FILLED" && (executed <= Decimal::ZERO || executed >= q)
            || status == "FILLED" && executed != q
            || status == "CANCELED" && executed >= q
            || status == "REJECTED" && executed != Decimal::ZERO
            || order.terminal
        {
            return Err(Failure::ProtocolUnknown);
        }
        let mut events = vec![];
        if !order.accepted && status != "REJECTED" {
            events.push(KernelEvent::OrderAccepted {
                command_id: id.into(),
                venue_order_id: venue.clone(),
                at: raw
                    .get("time")
                    .and_then(Value::as_i64)
                    .and_then(DateTime::from_timestamp_millis)
                    .filter(|t| *t >= order.submitted_at && *t <= time)
                    .unwrap_or(time),
            });
            order.accepted = true;
        }
        let fills = raw.get("fills").and_then(Value::as_array);
        if fills.is_some_and(|rows| rows.len() > 1000) {
            return Err(Failure::ProtocolUnknown);
        }
        if executed > Decimal::ZERO && fills.is_none() {
            return Err(Failure::ProtocolUnknown);
        }
        let mut total = Decimal::ZERO;
        let mut seen = BTreeSet::new();
        for f in fills.into_iter().flatten() {
            let trade = f
                .get("tradeId")
                .and_then(Value::as_u64)
                .ok_or(Failure::ProtocolUnknown)?
                .to_string();
            let t = |k: &str| {
                f.get(k)
                    .and_then(Value::as_str)
                    .ok_or(Failure::ProtocolUnknown)
            };
            let quantity = decimal(t("qty")?).map_err(|_| Failure::ProtocolUnknown)?;
            let price = decimal(t("price")?).map_err(|_| Failure::ProtocolUnknown)?;
            let fee = decimal(t("commission")?).map_err(|_| Failure::ProtocolUnknown)?;
            let currency = t("commissionAsset")?;
            let fill_time = f
                .get("time")
                .map(|v| {
                    v.as_i64()
                        .and_then(DateTime::from_timestamp_millis)
                        .ok_or(Failure::ProtocolUnknown)
                })
                .transpose()?
                .unwrap_or(time);
            if fill_time < order.submitted_at || fill_time > time {
                return Err(Failure::ProtocolUnknown);
            }
            if quantity <= Decimal::ZERO
                || price <= Decimal::ZERO
                || currency.is_empty()
                || currency.len() > 20
                || !currency
                    .bytes()
                    .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
                || !seen.insert(trade.clone())
            {
                return Err(Failure::ProtocolUnknown);
            }
            let limit = decimal(
                order
                    .command
                    .limit_price
                    .as_deref()
                    .ok_or(Failure::ProtocolUnknown)?,
            )?;
            if order.command.side == "buy" && price > limit
                || order.command.side == "sell" && price < limit
            {
                return Err(Failure::ProtocolUnknown);
            }
            total = total
                .checked_add(quantity)
                .ok_or(Failure::ProtocolUnknown)?;
            let hash = digest(&json!([
                quantity.normalize(),
                price.normalize(),
                fee.normalize(),
                currency
            ]));
            if let Some(old) = order.fills.get(&trade) {
                if old != &hash {
                    return Err(Failure::ProtocolUnknown);
                }
            } else {
                order.fills.insert(trade.clone(), hash);
                events.push(KernelEvent::OrderFilled {
                    command_id: id.into(),
                    venue_order_id: venue.clone(),
                    venue_fill_id: format!("{}:{trade}", order.command.symbol),
                    quantity: quantity.to_string(),
                    price: price.to_string(),
                    fee_currency: currency.into(),
                    fee_amount: fee.to_string(),
                    at: fill_time,
                });
            }
        }
        if total != executed {
            return Err(Failure::ProtocolUnknown);
        }
        order.filled = executed;
        order.venue = Some(venue.clone());
        order.unknown = false;
        match status {
            "REJECTED" => {
                if order.accepted {
                    return Err(Failure::ProtocolUnknown);
                }
                events.push(KernelEvent::OrderRejected {
                    command_id: id.into(),
                    reason: "l01_venue_rejected".into(),
                    at: time,
                });
                order.terminal = true;
            }
            "CANCELED" => {
                let c = order.cancel.as_ref().ok_or(Failure::ProtocolUnknown)?;
                events.push(KernelEvent::OrderCancelled {
                    command_id: id.into(),
                    venue_order_id: venue,
                    cancel_id: c.cancel_id.clone(),
                    at: time,
                });
                order.terminal = true;
            }
            "EXPIRED" => {
                events.push(KernelEvent::OrderExpired {
                    command_id: id.into(),
                    at: time,
                });
                order.terminal = true;
            }
            "FILLED" => order.terminal = true,
            _ => {}
        }
        self.orders.insert(id.into(), order);
        self.events.extend(events);
        Ok(())
    }
    pub fn reconcile(&mut self, id: &str, now: DateTime<Utc>) -> Result<(), Failure> {
        let order = self.orders.get(id).ok_or(Failure::Conflict)?.clone();
        if order.terminal {
            return Ok(());
        }
        let mut params = BTreeMap::from([("symbol".into(), order.command.symbol.clone())]);
        if let Some(venue) = &order.venue {
            params.insert("orderId".into(), venue.clone());
        } else {
            params.insert("origClientOrderId".into(), order.client.clone());
        }
        let mut raw = self.io(Self::request("GET", "/api/v3/order", params), now)?;
        let executed = raw
            .get("executedQty")
            .and_then(Value::as_str)
            .ok_or(Failure::ProtocolUnknown)?;
        if decimal(executed)? > Decimal::ZERO {
            let venue = raw
                .get("orderId")
                .and_then(Value::as_u64)
                .ok_or(Failure::ProtocolUnknown)?;
            let trades = self.io(
                Self::request(
                    "GET",
                    "/api/v3/myTrades",
                    [
                        ("symbol".into(), order.command.symbol.clone()),
                        ("orderId".into(), venue.to_string()),
                        ("limit".into(), "1000".into()),
                    ],
                ),
                now,
            )?;
            let rows = trades
                .as_array()
                .filter(|r| r.len() <= 1000)
                .ok_or(Failure::ProtocolUnknown)?;
            let mut fills = vec![];
            for t in rows {
                if t["orderId"].as_u64() != Some(venue)
                    || t["symbol"].as_str() != Some(&order.command.symbol)
                    || t["isBuyer"].as_bool() != Some(order.command.side == "buy")
                    || t["time"]
                        .as_i64()
                        .and_then(DateTime::from_timestamp_millis)
                        .is_none_or(|time| time < order.submitted_at || time > now)
                {
                    return Err(Failure::ProtocolUnknown);
                }
                fills.push(json!({"tradeId":t["id"],"qty":t["qty"],"price":t["price"],"commission":t["commission"],"commissionAsset":t["commissionAsset"],"time":t["time"]}));
            }
            raw["fills"] = json!(fills);
        } else {
            raw["fills"] = json!([]);
        }
        self.apply(id, raw, now, false)
    }
}
fn cancel_client(c: &BoundaryCancel) -> String {
    format!(
        "c{}",
        &digest(&json!(["l01-cancel/v1", c.command_id, c.cancel_id])).as_str()[7..38]
    )
}
impl<P: ProtocolPort> ExecutionKernel for ProtocolKernel<P> {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        Err("l01_controlled_clock_required".into())
    }
    fn submit_at(&mut self, c: &BoundaryCommand, at: DateTime<Utc>) -> Result<(), String> {
        self.rules.check(c, at).map_err(|e| e.to_string())?;
        if let Some(old) = self.orders.get(&c.command_id) {
            if old.command != *c {
                return Err(Failure::Conflict.to_string());
            }
            return if old.unknown {
                Err(Failure::NetworkUnknown.to_string())
            } else {
                Ok(())
            };
        }
        let key = digest(&c.idempotency_key).to_string();
        if self.keys.contains_key(&key) || self.orders.len() >= 4096 {
            return Err(Failure::Conflict.to_string());
        }
        let cid = client(c);
        let order = Order {
            command: c.clone(),
            submitted_at: at,
            client: cid.clone(),
            venue: None,
            accepted: false,
            terminal: false,
            unknown: true,
            filled: Decimal::ZERO,
            fills: BTreeMap::new(),
            cancel: None,
        };
        let request = Self::request(
            "POST",
            "/api/v3/order",
            [
                ("symbol".into(), c.symbol.clone()),
                ("side".into(), c.side.to_ascii_uppercase()),
                ("type".into(), "LIMIT".into()),
                ("timeInForce".into(), "GTC".into()),
                ("quantity".into(), c.quantity.clone()),
                ("price".into(), c.limit_price.clone().unwrap()),
                ("newClientOrderId".into(), cid),
                ("newOrderRespType".into(), "FULL".into()),
                (
                    "recvWindow".into(),
                    (c.expires_at - at)
                        .num_milliseconds()
                        .clamp(1, 5000)
                        .to_string(),
                ),
            ],
        );
        self.keys.insert(key, c.command_id.clone());
        self.orders.insert(c.command_id.clone(), order);
        match self.io(request, at) {
            Ok(raw) => self
                .apply(&c.command_id, raw, at, false)
                .map_err(|e| e.to_string()),
            Err(
                e @ (Failure::Authentication
                | Failure::AccessDenied
                | Failure::RateLimited
                | Failure::VenueRejected),
            ) => {
                let o = self.orders.get_mut(&c.command_id).unwrap();
                o.unknown = false;
                o.terminal = true;
                self.events.push(KernelEvent::OrderRejected {
                    command_id: c.command_id.clone(),
                    reason: e.to_string(),
                    at,
                });
                Ok(())
            }
            Err(e) => Err(e.to_string()),
        }
    }
    fn cancel(&mut self, c: &BoundaryCancel) -> Result<(), String> {
        if let Some(prior) = self.cancels.get(&c.cancel_id) {
            if prior != c {
                return Err(Failure::Conflict.to_string());
            }
            return if self.orders.get(&c.command_id).is_some_and(|o| o.unknown) {
                Err(Failure::NetworkUnknown.to_string())
            } else {
                Ok(())
            };
        }
        let old = self
            .orders
            .get(&c.command_id)
            .ok_or(Failure::Conflict.to_string())?
            .clone();
        if old.unknown
            || old.terminal
            || old.venue.as_deref() != Some(&c.venue_order_id)
            || old.cancel.as_ref().is_some_and(|r| r != c)
        {
            return Err(Failure::Conflict.to_string());
        }
        if old.cancel.is_some() {
            return Ok(());
        }
        self.cancels.insert(c.cancel_id.clone(), c.clone());
        self.orders.get_mut(&c.command_id).unwrap().cancel = Some(c.clone());
        self.orders.get_mut(&c.command_id).unwrap().unknown = true;
        let req = Self::request(
            "DELETE",
            "/api/v3/order",
            [
                ("symbol".into(), old.command.symbol.clone()),
                ("orderId".into(), c.venue_order_id.clone()),
                ("newClientOrderId".into(), cancel_client(c)),
            ],
        );
        match self.io(req, c.requested_at) {
            Ok(raw) => self
                .apply(&c.command_id, raw, c.requested_at, true)
                .map_err(|e| e.to_string()),
            Err(
                e @ (Failure::Authentication
                | Failure::AccessDenied
                | Failure::RateLimited
                | Failure::VenueRejected),
            ) => {
                let o = self.orders.get_mut(&c.command_id).unwrap();
                o.unknown = false;
                o.cancel = None;
                self.events.push(KernelEvent::CancelRejected {
                    command_id: c.command_id.clone(),
                    venue_order_id: c.venue_order_id.clone(),
                    cancel_id: c.cancel_id.clone(),
                    reason: e.to_string(),
                    at: c.requested_at,
                });
                Ok(())
            }
            Err(e) => Err(e.to_string()),
        }
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.events)
    }
}
