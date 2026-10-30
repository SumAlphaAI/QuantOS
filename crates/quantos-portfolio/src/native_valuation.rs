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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_provenance: Option<crate::account_provenance::Binding>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub market_provenance: Option<crate::market_provenance::Binding>,
}
impl Inputs {
    pub fn content_hash(&self) -> Result<ContentHash> {
        hash(&json!(["quantos-native-valuation-input/v1", self]))
    }
    pub fn raw_market_hash(&self) -> Result<ContentHash> {
        let mut raw = self.clone();
        raw.marks.clear();
        raw.market_provenance = None;
        raw.account_provenance = None;
        raw.content_hash()
    }
    /// Only exact current, usable ledger facts can make marks unnecessary. This
    /// never derives cash authority, clears quarantine, or changes R01 heads.
    pub fn authenticated_cash_only(&self, ledger: &NativeLedger) -> Result<bool> {
        let v = ledger.view().map_err(|_| Error)?;
        Ok(self.account_provenance.is_some()
            && self.marks.is_empty()
            && self.market_provenance.is_none()
            && self.scope == *ledger.scope()
            && v["consumerReady"] == true
            && !ledger.has_open_orders()
            && v["ledgerHash"].as_str() == Some(self.ledger_hash.to_string().as_str())
            && self.ledger_anchor == ledger.anchor()
            && v["positions"]
                .as_array()
                .ok_or(Error)?
                .iter()
                .all(|p| p["quantity"].as_str().and_then(|s| dec(s).ok()) == Some(Decimal::ZERO)))
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
        if let Some(b) = &self.market_provenance {
            let (marks, _) = b
                .marks(scope, &self.raw_market_hash()?, self.as_of)
                .map_err(|_| Error)?;
            if marks != self.marks {
                return Err(Error);
            }
        }
        if let Some(b) = &self.account_provenance {
            b.summary(self, self.as_of).map_err(|_| Error)?;
        }
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_provenance: Option<crate::account_provenance::Summary>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub market_provenance: Option<crate::market_provenance::Summary>,
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
    if input.account_provenance.is_some()
        && input.market_provenance.is_none()
        && !input.authenticated_cash_only(ledger)?
    {
        return Err(Error);
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
    let market_provenance = if let Some(b) = &input.market_provenance {
        let (_, summary) = b
            .marks(ledger.scope(), &input.raw_market_hash()?, at)
            .map_err(|_| Error)?;
        expires = expires.min(summary.valid_until);
        Some(summary)
    } else {
        None
    };
    let account_provenance = if let Some(b) = &input.account_provenance {
        let summary = b.summary(input, at).map_err(|_| Error)?;
        expires = expires.min(summary.valid_until);
        Some(summary)
    } else {
        None
    };
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
        market_provenance,
        account_provenance,
    };
    s.snapshot_hash = s.hash()?;
    Ok(Evaluation {
        reason: if input.account_provenance.is_some() && input.market_provenance.is_none() {
            "READY_OWNED_AUTHENTICATED_ACCOUNT_CASH_ONLY"
        } else if input.account_provenance.is_some() {
            "READY_OWNED_AUTHENTICATED_ACCOUNT_AND_R01"
        } else if input.market_provenance.is_some() {
            "READY_OWNED_ACCOUNT_AUTHENTICATED_R01_MARKS"
        } else {
            "READY_OWNED_REFERENCE_INPUT"
        },
        snapshot: Some(s),
    })
}

/// Append-only owner checkpoint. A missing current port never falls back to the
/// cached source. Historical snapshots are rebuilt against the same ledger prefix.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct State {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    account_history: Option<crate::account_provenance::History>,
    sources: Vec<Inputs>,
    snapshots: BTreeMap<ContentHash, Snapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    market_history: Option<crate::market_provenance::History>,
}
impl State {
    pub fn account_required(&self) -> bool {
        self.account_history.is_some()
    }
    pub fn observe_account_policy(
        &mut self,
        p: &crate::account_provenance::Policy,
        scope: &Scope,
    ) -> Result<()> {
        self.account_history
            .get_or_insert_with(Default::default)
            .policy(p, scope)
            .map_err(|_| Error)
    }
    pub fn observe_account_artifact(
        &mut self,
        a: &crate::account_provenance::SignedArtifact,
        p: &crate::account_provenance::Policy,
    ) -> Result<()> {
        self.account_history
            .as_mut()
            .ok_or(Error)?
            .artifact(a, p)
            .map_err(|_| Error)
    }
    pub fn market_required(&self) -> bool {
        self.market_history.is_some()
    }
    pub fn observe_market_policy(
        &mut self,
        p: &crate::market_provenance::Policy,
        scope: &Scope,
    ) -> Result<()> {
        self.market_history
            .get_or_insert_with(Default::default)
            .policy(p, scope)
            .map_err(|_| Error)
    }
    pub fn observe_market_artifact(
        &mut self,
        a: &crate::market_provenance::SignedArtifact,
        p: &crate::market_provenance::Policy,
        pem: &str,
    ) -> Result<()> {
        self.market_history
            .as_mut()
            .ok_or(Error)?
            .artifact(a, p, pem)
            .map_err(|_| Error)
    }
    pub fn validate(&self, ledger: &NativeLedger) -> Result<()> {
        if let Some(h) = &self.market_history {
            h.verify(ledger.scope()).map_err(|_| Error)?;
        }
        if let Some(h) = &self.account_history {
            h.verify(ledger.scope()).map_err(|_| Error)?;
        }
        let mut check = State::default();
        for s in &self.sources {
            if let Some(b) = &s.account_provenance {
                let h = self.account_history.as_ref().ok_or(Error)?;
                if !h.policies.contains(&b.policy) || !h.artifacts.contains(&b.artifact) {
                    return Err(Error);
                }
            }
            if let Some(b) = &s.market_provenance {
                let h = self.market_history.as_ref().ok_or(Error)?;
                if !h
                    .policies
                    .iter()
                    .any(|p| p.content_hash().ok() == b.policy.content_hash().ok())
                    || !h.artifacts.iter().any(|a| {
                        a.payload.content_hash().ok() == b.artifact.payload.content_hash().ok()
                    })
                    || h.certificate != b.certificate
                {
                    return Err(Error);
                }
            }
            if s.account_provenance.is_some() && s.market_provenance.is_none() {
                let prefix = ledger_prefix(ledger, &s.ledger_anchor)?;
                if !s.authenticated_cash_only(&prefix)? {
                    return Err(Error);
                }
            }
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
        if self.sources.iter().any(|i| i.account_provenance.is_some())
            && input.account_provenance.is_none()
        {
            return Err(Error);
        }
        if self.sources.iter().any(|i| i.market_provenance.is_some())
            && input.market_provenance.is_none()
            && !(input.account_provenance.is_some() && input.marks.is_empty())
        {
            return Err(Error);
        }
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
        if input.account_provenance.is_some()
            && input.market_provenance.is_none()
            && !input.authenticated_cash_only(ledger)?
        {
            return Err(Error);
        }
        let mut next = self.clone();
        if let Some(b) = &input.account_provenance {
            let h = next.account_history.as_ref().ok_or(Error)?;
            if h.policies.last() != Some(&b.policy) || h.artifacts.last() != Some(&b.artifact) {
                return Err(Error);
            }
        }
        if let Some(b) = &input.market_provenance {
            let h = next.market_history.as_ref().ok_or(Error)?;
            if h.policies
                .last()
                .ok_or(Error)?
                .content_hash()
                .map_err(|_| Error)?
                != b.policy.content_hash().map_err(|_| Error)?
                || h.artifacts
                    .last()
                    .ok_or(Error)?
                    .payload
                    .content_hash()
                    .map_err(|_| Error)?
                    != b.artifact.payload.content_hash().map_err(|_| Error)?
            {
                return Err(Error);
            }
        }
        let evaluated = evaluate(ledger, input, generation, at)?;
        next.register(input, ledger.scope())?;
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
        if let Some(old) = &previous.account_history {
            self.account_history
                .as_ref()
                .ok_or(Error)?
                .extension(old)
                .map_err(|_| Error)?;
        }
        if let Some(old) = &previous.market_history {
            self.market_history
                .as_ref()
                .ok_or(Error)?
                .extension(old)
                .map_err(|_| Error)?;
        }
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
    /// Resolve only a previously validated snapshot's immutable authenticated input.
    pub fn input_for(&self, snapshot: &Snapshot) -> Result<Inputs> {
        self.sources
            .iter()
            .find(|i| i.content_hash().ok().as_ref() == Some(&snapshot.source_hash))
            .cloned()
            .ok_or(Error)
    }
    pub fn counts(&self) -> (usize, usize) {
        (self.sources.len(), self.snapshots.len())
    }
    /// Immutable opening authority for read-only account reconciliation. This is
    /// not a current mark or permission to create a new risk decision.
    pub fn verified_opening(&self, ledger: &NativeLedger) -> Result<Option<Inputs>> {
        self.validate(ledger)?;
        Ok(self.sources.first().cloned())
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

fn ledger_prefix(ledger: &NativeLedger, anchor: &Anchor) -> Result<NativeLedger> {
    let mut checkpoint = ledger.checkpoint().map_err(|_| Error)?;
    let entries = checkpoint["entries"].as_array_mut().ok_or(Error)?;
    if anchor.sequence > entries.len() as u64 {
        return Err(Error);
    }
    entries.truncate(anchor.sequence as usize);
    checkpoint["anchor"] = json!(anchor);
    NativeLedger::restore(ledger.scope().clone(), &checkpoint).map_err(|_| Error)
}
