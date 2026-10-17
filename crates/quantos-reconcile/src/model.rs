use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{AccountId, ActorId, ContentHash, TenantId, WorkspaceId, canonical_json_bytes};
pub use quantos_execution::paper::OrderStatus;
use quantos_policy::{Capability, Role, RunMode};
use quantos_risk::guard::{GuardError, Side};
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;
#[derive(Debug, Error)]
pub enum Error {
    #[error("X05 authorization denied")]
    Unauthorized,
    #[error("X05 invalid input: {0}")]
    Invalid(&'static str),
    #[error("X05 idempotency or revision conflict")]
    Conflict,
    #[error("X05 invalid transition or unresolved evidence")]
    Transition,
    #[error("X05 arithmetic overflow")]
    Arithmetic,
    #[error("X05 state unavailable")]
    Unavailable,
    #[error(transparent)]
    Risk(#[from] GuardError),
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub account_id: AccountId,
    pub quote_unit: String,
}
impl Scope {
    pub fn validate(&self) -> Result<(), Error> {
        if self.tenant_id.as_uuid().is_nil()
            || self.workspace_id.as_uuid().is_nil()
            || self.account_id.as_uuid().is_nil()
            || !symbol(&self.quote_unit)
        {
            return Err(Error::Invalid("scope"));
        }
        Ok(())
    }
    pub fn authorize(&self, a: &AuthContext) -> Result<(), Error> {
        self.validate()?;
        if a.tenant_id != self.tenant_id
            || a.workspace_id != self.workspace_id
            || a.actor_id.as_uuid().is_nil()
            || a.mode != RunMode::Shadow
            || !matches!(a.role, Role::Owner | Role::Operator | Role::Service)
            || !a
                .capabilities
                .iter()
                .any(|c| c.as_str() == Capability::EXECUTION_OPERATE)
            || match a.account_id {
                Some(id) => id != self.account_id,
                None => a.role != Role::Owner,
            }
        {
            return Err(Error::Unauthorized);
        }
        Ok(())
    }
}
pub(crate) fn symbol(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 40
        && s.bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b"/_-".contains(&b))
}
pub(crate) fn identifier(s: &str) -> bool {
    !s.trim().is_empty() && s.len() <= 256 && !s.chars().any(char::is_control)
}
pub(crate) fn hash<T: Serialize>(domain: &str, value: &T) -> ContentHash {
    ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::json!({"domain":domain,"value":value}))
            .expect("owned Decimal data serializes"),
    )
}
pub(crate) fn number(n: Decimal) -> Result<Decimal, Error> {
    if n.scale() > 18 {
        Err(Error::Invalid("decimal scale >18"))
    } else {
        Ok(n)
    }
}
pub(crate) fn positive(n: Decimal) -> Result<Decimal, Error> {
    number(n)?;
    if n <= Decimal::ZERO {
        Err(Error::Invalid("nonpositive amount"))
    } else {
        Ok(n)
    }
}
pub(crate) fn add(a: Decimal, b: Decimal) -> Result<Decimal, Error> {
    a.checked_add(b).ok_or(Error::Arithmetic)
}
pub(crate) fn sub(a: Decimal, b: Decimal) -> Result<Decimal, Error> {
    a.checked_sub(b).ok_or(Error::Arithmetic)
}
pub(crate) fn mul(a: Decimal, b: Decimal) -> Result<Decimal, Error> {
    a.checked_mul(b)
        .map(|v| v.round_dp_with_strategy(18, RoundingStrategy::MidpointNearestEven))
        .ok_or(Error::Arithmetic)
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Mark {
    pub symbol: String,
    pub price: Decimal,
    pub source_ref: String,
    pub sequence: u64,
    pub source_at: DateTime<Utc>,
}
impl Mark {
    pub fn validate(&self, now: DateTime<Utc>, max_age: i64) -> Result<(), Error> {
        positive(self.price)?;
        if !symbol(&self.symbol)
            || !identifier(&self.source_ref)
            || self.sequence == 0
            || !(1..=900).contains(&max_age)
            || self.source_at > now
            || now - self.source_at > chrono::Duration::seconds(max_age)
        {
            return Err(Error::Invalid("mark provenance, clock or freshness"));
        }
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Position {
    pub symbol: String,
    pub quantity: Decimal,
    pub average_entry_price: Decimal,
    pub mark: Mark,
    pub realized_pnl: Decimal,
    pub unrealized_pnl: Decimal,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Seed {
    pub cash: Decimal,
    pub positions: BTreeMap<String, Position>,
    pub sequence: u64,
}
impl Seed {
    pub fn flat(cash: Decimal) -> Result<Self, Error> {
        number(cash)?;
        Ok(Self {
            cash,
            positions: BTreeMap::new(),
            sequence: 0,
        })
    }
    pub fn from_portfolio(
        scope: &Scope,
        p: &quantos_portfolio::PortfolioSnapshot,
        cash: Decimal,
    ) -> Result<Self, Error> {
        p.validate()
            .map_err(|_| Error::Invalid("X01 snapshot integrity"))?;
        if p.tenant_id != scope.tenant_id || p.account_id != scope.account_id {
            return Err(Error::Unauthorized);
        }
        let positions = portfolio_positions(p)?;
        let seed = Self {
            cash,
            positions: positions
                .into_iter()
                .map(|p| (p.symbol.clone(), p))
                .collect(),
            sequence: 0,
        };
        seed.validate()?;
        Ok(seed)
    }
    pub(crate) fn validate(&self) -> Result<(), Error> {
        number(self.cash)?;
        if self.sequence > i64::MAX as u64 {
            return Err(Error::Invalid("seed sequence"));
        }
        for (s, p) in &self.positions {
            validate_position(p)?;
            if s != &p.symbol
                || p.unrealized_pnl != mul(p.quantity, sub(p.mark.price, p.average_entry_price)?)?
            {
                return Err(Error::Invalid("seed position binding"));
            }
        }
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fill {
    pub fill_id: String,
    pub order_id: String,
    pub command_id: String,
    pub symbol: String,
    pub side: Side,
    pub quantity: Decimal,
    pub price: Decimal,
    pub fee: Decimal,
    pub sequence: u64,
    pub at: DateTime<Utc>,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Order {
    pub order_id: String,
    pub command_id: String,
    pub symbol: String,
    pub side: Side,
    pub quantity: Decimal,
    pub filled_quantity: Decimal,
    pub average_fill_price: Option<Decimal>,
    pub status: OrderStatus,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ledger {
    pub cash: Decimal,
    pub realized_pnl: Decimal,
    pub unrealized_pnl: Decimal,
    pub exposure_gross: Decimal,
    pub sequence: u64,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Book {
    pub source_hash: ContentHash,
    pub source_ref: String,
    pub revision: u64,
    pub captured_at: DateTime<Utc>,
    pub seed: Seed,
    pub orders: Vec<Order>,
    pub fills: Vec<Fill>,
    pub positions: Vec<Position>,
    pub ledger: Ledger,
}
impl Book {
    pub fn content_hash(&self) -> ContentHash {
        hash(
            "quantos-x05-book/v1",
            &(
                &self.source_hash,
                &self.seed,
                &self.orders,
                &self.fills,
                &self.positions,
                &self.ledger,
            ),
        )
    }
    pub fn validate(&self, now: DateTime<Utc>) -> Result<(), Error> {
        self.seed.validate()?;
        if !identifier(&self.source_ref) || self.revision == 0 || self.captured_at > now {
            return Err(Error::Invalid("book identity or future capture"));
        }
        let mut orders = BTreeMap::new();
        let mut commands = std::collections::BTreeSet::new();
        for o in &self.orders {
            positive(o.quantity)?;
            number(o.filled_quantity)?;
            if !identifier(&o.order_id)
                || !identifier(&o.command_id)
                || !symbol(&o.symbol)
                || o.filled_quantity < Decimal::ZERO
                || o.filled_quantity > o.quantity
                || o.average_fill_price.is_some_and(|p| positive(p).is_err())
                || orders.insert(&o.order_id, o).is_some()
                || !commands.insert(&o.command_id)
            {
                return Err(Error::Invalid("duplicate or invalid order"));
            }
        }
        let mut ids = std::collections::BTreeSet::new();
        for f in &self.fills {
            positive(f.quantity)?;
            positive(f.price)?;
            number(f.fee)?;
            let o = orders
                .get(&f.order_id)
                .ok_or(Error::Invalid("orphan fill"))?;
            if !identifier(&f.fill_id)
                || !ids.insert(&f.fill_id)
                || f.command_id != o.command_id
                || f.symbol != o.symbol
                || f.side != o.side
                || f.fee < Decimal::ZERO
                || f.at > self.captured_at
            {
                return Err(Error::Invalid("fill identity, fee or provenance"));
            }
        }
        let mut symbols = std::collections::BTreeSet::new();
        for p in &self.positions {
            validate_position(p)?;
            if !symbols.insert(&p.symbol) || p.mark.source_at > self.captured_at {
                return Err(Error::Invalid("duplicate position or future mark"));
            }
        }
        for n in [
            self.ledger.cash,
            self.ledger.realized_pnl,
            self.ledger.unrealized_pnl,
            self.ledger.exposure_gross,
        ] {
            number(n)?;
        }
        if self.ledger.exposure_gross < Decimal::ZERO {
            return Err(Error::Invalid("negative gross exposure"));
        }
        Ok(())
    }
}
pub(crate) fn validate_position(p: &Position) -> Result<(), Error> {
    for n in [
        p.quantity,
        p.average_entry_price,
        p.realized_pnl,
        p.unrealized_pnl,
    ] {
        number(n)?;
    }
    positive(p.mark.price)?;
    if !symbol(&p.symbol)
        || p.symbol != p.mark.symbol
        || !identifier(&p.mark.source_ref)
        || p.mark.sequence == 0
        || p.average_entry_price < Decimal::ZERO
        || p.quantity != Decimal::ZERO && p.average_entry_price == Decimal::ZERO
    {
        return Err(Error::Invalid("position or mark identity"));
    }
    Ok(())
}
pub(crate) fn apply_fill(
    positions: &mut BTreeMap<String, Position>,
    cash: &mut Decimal,
    f: &Fill,
    mark: &Mark,
) -> Result<(), Error> {
    positive(f.quantity)?;
    positive(f.price)?;
    number(f.fee)?;
    if f.fee < Decimal::ZERO || mark.symbol != f.symbol {
        return Err(Error::Invalid("virtual fill"));
    }
    let signed = if f.side == Side::Buy {
        f.quantity
    } else {
        -f.quantity
    };
    let p = positions.entry(f.symbol.clone()).or_insert(Position {
        symbol: f.symbol.clone(),
        quantity: Decimal::ZERO,
        average_entry_price: Decimal::ZERO,
        mark: mark.clone(),
        realized_pnl: Decimal::ZERO,
        unrealized_pnl: Decimal::ZERO,
    });
    let current = p.quantity;
    let next = add(current, signed)?;
    if current == Decimal::ZERO || current.is_sign_negative() == signed.is_sign_negative() {
        let cost = add(mul(current, p.average_entry_price)?, mul(signed, f.price)?)?;
        p.average_entry_price = cost
            .checked_div(next)
            .ok_or(Error::Arithmetic)?
            .round_dp_with_strategy(18, RoundingStrategy::MidpointNearestEven);
    } else {
        let closing = current.abs().min(signed.abs());
        let sign = if current.is_sign_negative() {
            -Decimal::ONE
        } else {
            Decimal::ONE
        };
        p.realized_pnl = add(
            p.realized_pnl,
            mul(mul(closing, sub(f.price, p.average_entry_price)?)?, sign)?,
        )?;
        if next == Decimal::ZERO {
            p.average_entry_price = Decimal::ZERO;
        } else if current.is_sign_negative() != next.is_sign_negative() {
            p.average_entry_price = f.price;
        }
    }
    p.quantity = next;
    p.realized_pnl = sub(p.realized_pnl, f.fee)?;
    p.mark = mark.clone();
    p.unrealized_pnl = mul(next, sub(mark.price, p.average_entry_price)?)?;
    *cash = sub(sub(*cash, mul(signed, f.price)?)?, f.fee)?;
    Ok(())
}
pub(crate) fn totals(
    positions: &BTreeMap<String, Position>,
    cash: Decimal,
    sequence: u64,
) -> Result<Ledger, Error> {
    let mut l = Ledger {
        cash,
        realized_pnl: Decimal::ZERO,
        unrealized_pnl: Decimal::ZERO,
        exposure_gross: Decimal::ZERO,
        sequence,
    };
    for p in positions.values() {
        l.realized_pnl = add(l.realized_pnl, p.realized_pnl)?;
        l.unrealized_pnl = add(l.unrealized_pnl, p.unrealized_pnl)?;
        l.exposure_gross = add(l.exposure_gross, mul(p.quantity, p.mark.price)?.abs())?;
    }
    Ok(l)
}
pub(crate) fn float(n: f64) -> Result<Decimal, Error> {
    if !n.is_finite() {
        return Err(Error::Invalid("nonfinite X01 amount"));
    }
    Decimal::from_f64_retain(n)
        .map(|n| n.round_dp_with_strategy(18, RoundingStrategy::MidpointNearestEven))
        .ok_or(Error::Arithmetic)
}
pub(crate) fn portfolio_positions(
    p: &quantos_portfolio::PortfolioSnapshot,
) -> Result<Vec<Position>, Error> {
    p.positions
        .iter()
        .map(|x| {
            let m = p
                .valuation_marks
                .iter()
                .find(|m| m.symbol == x.symbol)
                .ok_or(Error::Invalid("X01 missing mark provenance"))?;
            Ok(Position {
                symbol: x.symbol.clone(),
                quantity: float(x.quantity)?,
                average_entry_price: float(x.average_entry_price)?,
                mark: Mark {
                    symbol: x.symbol.clone(),
                    price: float(x.mark_price)?,
                    source_ref: m.source_event_id.clone(),
                    sequence: p.last_event_sequence,
                    source_at: m.source_at,
                },
                realized_pnl: float(x.realized_pnl)?,
                unrealized_pnl: float(x.unrealized_pnl)?,
            })
        })
        .collect()
}
pub(crate) fn clock(previous: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Result<(), Error> {
    if previous.is_some_and(|p| now < p) {
        Err(Error::Invalid("backward clock"))
    } else {
        Ok(())
    }
}
pub(crate) fn actor_valid(actor: ActorId) -> Result<(), Error> {
    if actor.as_uuid().is_nil() {
        Err(Error::Unauthorized)
    } else {
        Ok(())
    }
}
