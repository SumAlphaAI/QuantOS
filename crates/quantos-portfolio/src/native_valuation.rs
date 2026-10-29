//! X01 exact current-ledger valuation. Inputs are trusted-owner port data, never
//! browser authority. Public hashes establish content binding, not authenticity.
use crate::native_ledger::{Anchor, NativeLedger, Scope, add, decimal, digest, mul, sub, text};
use chrono::{DateTime, Duration, Utc};
use quantos_core::ContentHash;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

pub const SOURCE: &str = "owned-reference-valuation:v1";
pub const BASIS: &str = "EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS";
pub const TRUST: &str = "OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET";
#[derive(Debug, thiserror::Error)]
#[error("NATIVE_VALUATION_INVALID_OR_CONFLICTING_SOURCE")]
pub struct Error;
type Result<T> = std::result::Result<T, Error>;
fn hash(v: &impl Serialize) -> Result<ContentHash> {
    digest(v).map_err(|_| Error)
}
fn dec(v: &str) -> Result<Decimal> {
    decimal(v).map_err(|_| Error)
}
fn plus(a: Decimal, b: Decimal) -> Result<Decimal> {
    add(a, b).map_err(|_| Error)
}
fn minus(a: Decimal, b: Decimal) -> Result<Decimal> {
    sub(a, b).map_err(|_| Error)
}
fn times(a: Decimal, b: Decimal) -> Result<Decimal> {
    mul(a, b).map_err(|_| Error)
}
fn reference(v: &str) -> bool {
    !v.trim().is_empty() && v.len() <= 256 && !v.chars().any(char::is_control)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Mark {
    pub symbol: String,
    pub price: String,
    pub source_ref: String,
    pub observed_at: DateTime<Utc>,
    pub quality: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Inputs {
    pub schema_version: String,
    pub source_id: String,
    pub version: u64,
    pub scope: Scope,
    pub basis: String,
    pub origin_ledger_hash: ContentHash,
    pub opening_at: DateTime<Utc>,
    pub cash_source_ref: String,
    pub quote_cash_at_opening: String,
    pub realized_pnl_before_origin_today: String,
    pub quote_currency: String,
    pub ledger_hash: ContentHash,
    pub ledger_anchor: Anchor,
    pub as_of: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub cash_coverage_through: DateTime<Utc>,
    pub account_status: String,
    pub account_status_at: DateTime<Utc>,
    pub status_source_ref: String,
    pub marks: Vec<Mark>,
}
impl Inputs {
    pub fn content_hash(&self) -> Result<ContentHash> {
        hash(&json!(["quantos-native-valuation-input/v1", self]))
    }
    fn origin(&self) -> Result<ContentHash> {
        hash(&json!([
            self.scope,
            self.source_id,
            self.basis,
            self.origin_ledger_hash,
            self.opening_at,
            self.cash_source_ref,
            self.quote_cash_at_opening,
            self.realized_pnl_before_origin_today,
            self.quote_currency
        ]))
    }
    fn validate(&self, scope: &Scope) -> Result<()> {
        let empty = NativeLedger::new(scope.clone())
            .map_err(|_| Error)?
            .view()
            .map_err(|_| Error)?;
        if self.schema_version != "quantos-native-valuation-input.v1"
            || self.source_id != SOURCE
            || self.version == 0
            || &self.scope != scope
            || self.basis != BASIS
            || self.quote_currency != "USDT"
            || self.origin_ledger_hash.to_string() != empty["ledgerHash"].as_str().ok_or(Error)?
            || self.opening_at > self.as_of
            || self.valid_until <= self.as_of
            || self.valid_until
                > self
                    .as_of
                    .checked_add_signed(Duration::seconds(30))
                    .ok_or(Error)?
            || !reference(&self.cash_source_ref)
            || !reference(&self.status_source_ref)
            || !matches!(
                self.account_status.as_str(),
                "active" | "suspended" | "closed"
            )
            || self.cash_coverage_through > self.as_of
            || self.account_status_at > self.as_of
            || self.cash_coverage_through < self.opening_at
            || self.account_status_at < self.opening_at
            || dec(&self.quote_cash_at_opening)? < Decimal::ZERO
            || self.marks.len() > 256
        {
            return Err(Error);
        }
        dec(&self.realized_pnl_before_origin_today)?;
        let mut seen = BTreeSet::new();
        for m in &self.marks {
            if m.symbol.is_empty()
                || m.symbol.len() > 32
                || !m
                    .symbol
                    .bytes()
                    .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
                || !seen.insert(m.symbol.clone())
                || !reference(&m.source_ref)
                || dec(&m.price)? <= Decimal::ZERO
                || m.observed_at > self.as_of
                || !matches!(m.quality.as_str(), "normal" | "stale" | "suspect")
            {
                return Err(Error);
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Position {
    pub symbol: String,
    pub quantity: String,
    pub average_entry_price: String,
    pub mark_price: String,
    pub market_value: String,
    pub unrealized_pnl: String,
    pub realized_pnl: String,
    pub mark_source_ref: String,
    pub mark_observed_at: DateTime<Utc>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub schema_version: String,
    pub scope: Scope,
    pub ledger_hash: ContentHash,
    pub ledger_anchor: Anchor,
    pub source_hash: ContentHash,
    pub source_version: u64,
    pub source_trust: String,
    pub basis: String,
    pub kill_generation: String,
    pub quote_currency: String,
    pub positions: Vec<Position>,
    pub quote_cash: String,
    pub equity: String,
    pub realized_pnl_today: String,
    pub unrealized_pnl: String,
    pub total_pnl_today: String,
    pub exposure_gross: String,
    pub exposure_net: String,
    pub generated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub snapshot_hash: ContentHash,
    pub execution_authority: bool,
}
impl Snapshot {
    fn hash(&self) -> Result<ContentHash> {
        let mut v = serde_json::to_value(self).map_err(|_| Error)?;
        v.as_object_mut().ok_or(Error)?.remove("snapshotHash");
        hash(&json!(["quantos-native-risk-input-snapshot/v1", v]))
    }
    pub fn validate_for(
        &self,
        ledger: &NativeLedger,
        input: &Inputs,
        generation: u64,
        now: DateTime<Utc>,
    ) -> Result<()> {
        if evaluate(ledger, input, generation, now)?.snapshot.as_ref() != Some(self) {
            return Err(Error);
        }
        Ok(())
    }
}
#[derive(Clone, Debug)]
pub struct Evaluation {
    pub reason: &'static str,
    pub snapshot: Option<Snapshot>,
}
fn blocked(reason: &'static str) -> Evaluation {
    Evaluation {
        reason,
        snapshot: None,
    }
}
pub fn evaluate(
    ledger: &NativeLedger,
    input: &Inputs,
    generation: u64,
    at: DateTime<Utc>,
) -> Result<Evaluation> {
    input.validate(ledger.scope())?;
    let v = ledger.view().map_err(|_| Error)?;
    if v["consumerReady"] != true {
        return Ok(blocked("UNKNOWN_OR_QUARANTINED_OBLIGATIONS"));
    }
    if ledger.has_open_orders() {
        return Ok(blocked("OPEN_ORDER_RESERVATIONS_UNMODELED"));
    }
    if v["ledgerHash"].as_str() != Some(input.ledger_hash.to_string().as_str())
        || ledger.anchor() != input.ledger_anchor
    {
        return Ok(blocked("LEDGER_MISMATCH"));
    }
    if let Some((first, last)) = ledger.source_window()
        && (input.opening_at > first || last > input.as_of || last > input.cash_coverage_through)
    {
        return Ok(blocked("LEDGER_TIME_MISMATCH"));
    }
    if input.opening_at.date_naive() != input.as_of.date_naive()
        || at.date_naive() != input.as_of.date_naive()
    {
        return Ok(blocked("DAY_ROLLOVER"));
    }
    let end_of_day = input
        .as_of
        .date_naive()
        .succ_opt()
        .ok_or(Error)?
        .and_hms_opt(0, 0, 0)
        .ok_or(Error)?
        .and_utc();
    let mut expires = input
        .valid_until
        .min(
            input
                .account_status_at
                .checked_add_signed(Duration::seconds(30))
                .ok_or(Error)?,
        )
        .min(
            input
                .cash_coverage_through
                .checked_add_signed(Duration::seconds(30))
                .ok_or(Error)?,
        )
        .min(end_of_day);
    if at < input.as_of || at >= expires {
        return Ok(blocked("STALE_SOURCE"));
    }
    if input.account_status != "active" {
        return Ok(blocked("INACTIVE_ACCOUNT"));
    }
    let positions = v["positions"].as_array().ok_or(Error)?;
    let needed = positions
        .iter()
        .filter(|p| {
            p["quantity"]
                .as_str()
                .and_then(|s| dec(s).ok())
                .is_some_and(|d| d != Decimal::ZERO)
        })
        .collect::<Vec<_>>();
    let symbols = needed
        .iter()
        .map(|p| p["symbol"].as_str().ok_or(Error))
        .collect::<Result<BTreeSet<_>>>()?;
    if input
        .marks
        .iter()
        .any(|m| !symbols.contains(m.symbol.as_str()))
    {
        return Err(Error);
    }
    if input.marks.len() != needed.len() {
        return Ok(blocked("MISSING_MARK"));
    }
    let mut result = vec![];
    let mut gross = Decimal::ZERO;
    let mut net = Decimal::ZERO;
    let mut unrealized = Decimal::ZERO;
    let mut realized = dec(&input.realized_pnl_before_origin_today)?;
    for p in positions {
        realized = plus(realized, dec(p["realizedPnl"].as_str().ok_or(Error)?)?)?;
    }
    for p in needed {
        let symbol = p["symbol"].as_str().ok_or(Error)?;
        let m = input
            .marks
            .iter()
            .find(|m| m.symbol == symbol)
            .ok_or(Error)?;
        expires = expires.min(
            m.observed_at
                .checked_add_signed(Duration::seconds(30))
                .ok_or(Error)?,
        );
        if m.quality != "normal" || at >= expires {
            return Ok(blocked("STALE_OR_UNTRUSTED_MARK"));
        }
        let q = dec(p["quantity"].as_str().ok_or(Error)?)?;
        let average = dec(p["averageEntryPrice"].as_str().ok_or(Error)?)?;
        let price = dec(&m.price)?;
        let value = times(q, price)?;
        let pnl = times(q, minus(price, average)?)?;
        net = plus(net, value)?;
        gross = plus(gross, value.abs())?;
        unrealized = plus(unrealized, pnl)?;
        result.push(Position {
            symbol: symbol.into(),
            quantity: text(q),
            average_entry_price: text(average),
            mark_price: text(price),
            market_value: text(value),
            unrealized_pnl: text(pnl),
            realized_pnl: p["realizedPnl"].as_str().ok_or(Error)?.into(),
            mark_source_ref: m.source_ref.clone(),
            mark_observed_at: m.observed_at,
        });
    }
    let cash = plus(
        dec(&input.quote_cash_at_opening)?,
        dec(v["quoteCashDelta"].as_str().ok_or(Error)?)?,
    )?;
    let equity = plus(cash, net)?;
    if cash < Decimal::ZERO || equity <= Decimal::ZERO {
        return Ok(blocked("INVALID_ACCOUNT_CASH_OR_EQUITY"));
    }
    let mut s = Snapshot {
        schema_version: "quantos-native-risk-input-snapshot.v1".into(),
        scope: ledger.scope().clone(),
        ledger_hash: input.ledger_hash.clone(),
        ledger_anchor: input.ledger_anchor.clone(),
        source_hash: input.content_hash()?,
        source_version: input.version,
        source_trust: TRUST.into(),
        basis: BASIS.into(),
        kill_generation: generation.to_string(),
        quote_currency: "USDT".into(),
        positions: result,
        quote_cash: text(cash),
        equity: text(equity),
        realized_pnl_today: text(realized),
        unrealized_pnl: text(unrealized),
        total_pnl_today: text(plus(realized, unrealized)?),
        exposure_gross: text(gross),
        exposure_net: text(net),
        generated_at: input.as_of,
        expires_at: expires,
        snapshot_hash: hash(&"pending")?,
        execution_authority: false,
    };
    s.snapshot_hash = s.hash()?;
    Ok(Evaluation {
        reason: "READY_OWNED_REFERENCE_INPUT",
        snapshot: Some(s),
    })
}

/// Append-only owner checkpoint. A missing current port never falls back to the
/// cached source. Historical snapshots are rebuilt against the same ledger prefix.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct State {
    sources: Vec<Inputs>,
    snapshots: BTreeMap<ContentHash, Snapshot>,
}
impl State {
    pub fn validate(&self, ledger: &NativeLedger) -> Result<()> {
        let mut check = State::default();
        for s in &self.sources {
            check.register(s, ledger.scope())?;
        }
        if check.sources.len() != self.sources.len() {
            return Err(Error);
        }
        for (h, s) in &self.snapshots {
            if h != &s.snapshot_hash || s.hash()? != *h {
                return Err(Error);
            }
            let input = self
                .sources
                .iter()
                .find(|i| i.content_hash().ok().as_ref() == Some(&s.source_hash))
                .ok_or(Error)?;
            let mut checkpoint = ledger.checkpoint().map_err(|_| Error)?;
            let entries = checkpoint["entries"].as_array_mut().ok_or(Error)?;
            if s.ledger_anchor.sequence > entries.len() as u64 {
                return Err(Error);
            }
            entries.truncate(s.ledger_anchor.sequence as usize);
            checkpoint["anchor"] = json!(s.ledger_anchor);
            let prefix =
                NativeLedger::restore(ledger.scope().clone(), &checkpoint).map_err(|_| Error)?;
            s.validate_for(
                &prefix,
                input,
                s.kill_generation.parse().map_err(|_| Error)?,
                s.generated_at,
            )?;
        }
        Ok(())
    }
    fn register(&mut self, input: &Inputs, scope: &Scope) -> Result<()> {
        input.validate(scope)?;
        if let Some(old) = self.sources.last() {
            if input.version == old.version {
                if input != old {
                    return Err(Error);
                }
                return Ok(());
            }
            if input.version != old.version.checked_add(1).ok_or(Error)?
                || input.origin()? != old.origin()?
                || input.as_of < old.as_of
                || input.cash_coverage_through < old.cash_coverage_through
                || input.account_status_at < old.account_status_at
            {
                return Err(Error);
            }
            for m in &input.marks {
                if self.sources.iter().flat_map(|s| s.marks.iter()).any(|p| {
                    p.symbol == m.symbol
                        && (m.observed_at < p.observed_at
                            || m.observed_at == p.observed_at && m.price != p.price)
                }) {
                    return Err(Error);
                }
            }
        } else if input.version != 1 {
            return Err(Error);
        }
        if self.sources.len() >= 512 {
            return Err(Error);
        }
        self.sources.push(input.clone());
        Ok(())
    }
    pub fn observe(
        &mut self,
        ledger: &NativeLedger,
        input: &Inputs,
        generation: u64,
        at: DateTime<Utc>,
    ) -> Result<Evaluation> {
        let mut next = self.clone();
        next.register(input, ledger.scope())?;
        let evaluated = evaluate(ledger, input, generation, at)?;
        if let Some(s) = &evaluated.snapshot {
            if let Some(old) = next.snapshots.get(&s.snapshot_hash) {
                if old != s {
                    return Err(Error);
                }
            } else {
                if next.snapshots.len() >= 512 {
                    return Err(Error);
                }
                next.snapshots.insert(s.snapshot_hash.clone(), s.clone());
            }
        }
        *self = next;
        Ok(evaluated)
    }
    pub fn verify_extension(&self, previous: &State) -> Result<()> {
        if self.sources.len() < previous.sources.len()
            || self.sources[..previous.sources.len()] != previous.sources
            || previous
                .snapshots
                .iter()
                .any(|(h, s)| self.snapshots.get(h) != Some(s))
        {
            return Err(Error);
        }
        Ok(())
    }
    pub fn counts(&self) -> (usize, usize) {
        (self.sources.len(), self.snapshots.len())
    }
    pub fn checkpoint(&self) -> Result<Value> {
        serde_json::to_value(self).map_err(|_| Error)
    }
    pub fn restore(v: &Value, ledger: &NativeLedger) -> Result<Self> {
        let s: Self = serde_json::from_value(v.clone()).map_err(|_| Error)?;
        if s.sources.len() > 512 || s.snapshots.len() > 512 {
            return Err(Error);
        }
        s.validate(ledger)?;
        Ok(s)
    }
}
