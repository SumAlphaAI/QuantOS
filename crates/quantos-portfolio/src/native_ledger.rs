//! X01 ledger of current observed native fills. This is not a mark/equity source,
//! venue reconciliation, execution authority or a distributed transaction.
use crate::native_source::{NativeExecutionFacts, NativeFill};
use quantos_core::{
    AccountId, CommandId, ContentHash, ProposalId, TenantId, WorkspaceId, canonical_json_bytes,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("NATIVE_LEDGER_INVALID_SOURCE")]
    Invalid,
    #[error("NATIVE_LEDGER_IMMUTABLE_CONFLICT")]
    Conflict,
}
type Result<T> = std::result::Result<T, Error>;
pub(crate) fn digest(v: &impl Serialize) -> Result<ContentHash> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error::Invalid)?)
            .map_err(|_| Error::Invalid)?,
    ))
}
pub(crate) fn decimal(s: &str) -> Result<Decimal> {
    if s.is_empty() || s.len() > 80 || s.contains(['e', 'E', '+']) {
        return Err(Error::Invalid);
    }
    Decimal::from_str_exact(s).map_err(|_| Error::Invalid)
}
fn positive(s: &str) -> Result<Decimal> {
    let d = decimal(s)?;
    if d <= Decimal::ZERO {
        return Err(Error::Invalid);
    }
    Ok(d)
}
pub(crate) fn add(a: Decimal, b: Decimal) -> Result<Decimal> {
    let scale = a.scale().max(b.scale());
    let a = a
        .mantissa()
        .checked_mul(
            10_i128
                .checked_pow(scale - a.scale())
                .ok_or(Error::Invalid)?,
        )
        .ok_or(Error::Invalid)?;
    let b = b
        .mantissa()
        .checked_mul(
            10_i128
                .checked_pow(scale - b.scale())
                .ok_or(Error::Invalid)?,
        )
        .ok_or(Error::Invalid)?;
    exact(a.checked_add(b).ok_or(Error::Invalid)?, scale)
}
pub(crate) fn sub(a: Decimal, b: Decimal) -> Result<Decimal> {
    add(a, -b)
}
pub(crate) fn mul(a: Decimal, b: Decimal) -> Result<Decimal> {
    let a = a.normalize();
    let b = b.normalize();
    exact(
        a.mantissa()
            .checked_mul(b.mantissa())
            .ok_or(Error::Invalid)?,
        a.scale() + b.scale(),
    )
}
fn exact(mut value: i128, mut scale: u32) -> Result<Decimal> {
    while scale > 0 && value % 10 == 0 {
        value /= 10;
        scale -= 1;
    }
    Decimal::try_from_i128_with_scale(value, scale).map_err(|_| Error::Invalid)
}
pub(crate) fn text(d: Decimal) -> String {
    d.normalize().to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scope {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub account_id: AccountId,
}
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Anchor {
    pub sequence: u64,
    pub head: Option<ContentHash>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LegacyBinding {
    pub request_id: ProposalId,
    pub command_id: CommandId,
    pub subject_hash: ContentHash,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    content = "body",
    rename_all = "snake_case",
    deny_unknown_fields
)]
enum Observation {
    Facts(Box<NativeExecutionFacts>),
    Legacy(LegacyBinding),
}
impl Observation {
    fn binding(&self) -> LegacyBinding {
        match self {
            Self::Facts(s) => LegacyBinding {
                request_id: s.request_id,
                command_id: s.command_id,
                subject_hash: s.subject_hash.clone(),
            },
            Self::Legacy(b) => b.clone(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Entry {
    sequence: u64,
    observation: Observation,
    previous: Option<ContentHash>,
    hash: ContentHash,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Checkpoint {
    schema_version: String,
    scope: Scope,
    entries: Vec<Entry>,
    anchor: Anchor,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Receipt {
    pub request_id: ProposalId,
    pub command_id: CommandId,
    pub subject_hash: ContentHash,
    pub source_hash: Option<ContentHash>,
    pub entry_hash: ContentHash,
    pub sequence: u64,
    pub state: String,
    pub reason: String,
    pub observed_fill_ids: Vec<String>,
    pub applied_fill_ids: Vec<String>,
}
#[derive(Clone, Debug, Default)]
struct Position {
    quantity: Decimal,
    average: Decimal,
    realized: Decimal,
}
#[derive(Clone, Debug)]
pub struct NativeLedger {
    scope: Scope,
    entries: Vec<Entry>,
    receipts: BTreeMap<CommandId, Receipt>,
    fills: BTreeMap<String, NativeFill>,
    positions: BTreeMap<String, Position>,
    cash: Decimal,
    fees: Decimal,
}
impl NativeExecutionFacts {
    /// Checks a trusted owner's observation shape/binding and checksum. A hash
    /// alone is not authenticity: callers must obtain this from the native owner.
    pub fn validate_ledger_source(&self, scope: &Scope) -> Result<()> {
        let mut body = serde_json::to_value(self).map_err(|_| Error::Invalid)?;
        body.as_object_mut()
            .ok_or(Error::Invalid)?
            .remove("sourceHash");
        if self.schema_version != "quantos-native-execution-facts.v1"
            || self.execution_authority
            || self.tenant_id != scope.tenant_id
            || self.workspace_id != scope.workspace_id
            || self.account_id != scope.account_id
            || self.command_id.as_uuid().is_nil()
            || self.request_id.as_uuid().is_nil()
            || self.decision_id.as_uuid().is_nil()
            || self.quote_currency != "USDT"
            || !matches!(self.outcome.as_str(), "accepted" | "unknown")
            || digest(&json!(["quantos-native-execution-source/v1", body]))? != self.source_hash
            || self.fills.len() > 10000
            || self.fact_hashes.len() > 20002
            || self.fact_hashes.len() != self.native_source_hashes.len()
            || self.fact_hashes.iter().collect::<BTreeSet<_>>().len() != self.fact_hashes.len()
        {
            return Err(Error::Invalid);
        }
        let quote_fees = self
            .fills
            .iter()
            .all(|f| f.fee_currency == self.quote_currency);
        let reason = if self.outcome == "unknown" {
            "OUTCOME_UNRESOLVED"
        } else if !self.journal_available {
            "JOURNAL_UNAVAILABLE"
        } else if !quote_fees {
            "FEE_CONVERSION_REQUIRED"
        } else {
            "OBSERVED_NATIVE_FACTS"
        };
        if self.consumer_ready
            != (self.outcome == "accepted" && self.journal_available && quote_fees)
            || self.reason != reason
        {
            return Err(Error::Invalid);
        }
        if !self.journal_available {
            if self.order.is_some() || !self.fills.is_empty() || !self.fact_hashes.is_empty() {
                return Err(Error::Invalid);
            }
            return Ok(());
        }
        let o = self.order.as_ref().ok_or(Error::Invalid)?;
        if o.order_id.is_empty()
            || o.order_id.len() > 128
            || o.command_id != self.command_id
            || o.account_id != self.account_id
            || o.symbol.is_empty()
            || o.symbol.len() > 20
            || !o
                .symbol
                .bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            || !matches!(o.side.as_str(), "buy" | "sell")
            || self.fact_hashes.is_empty()
            || o.updated_at < o.submitted_at
            || o.updated_at > self.recorded_at
            || !matches!(
                o.status.as_str(),
                "submitted"
                    | "accepted"
                    | "partially_filled"
                    | "filled"
                    | "cancel_pending"
                    | "cancelled"
                    | "rejected"
                    | "expired"
            )
        {
            return Err(Error::Invalid);
        }
        let quantity = positive(&o.quantity)?;
        let filled = decimal(&o.filled_quantity)?;
        if filled < Decimal::ZERO
            || filled > quantity
            || o.average_fill_price
                .as_ref()
                .is_some_and(|p| positive(p).is_err())
        {
            return Err(Error::Invalid);
        }
        let mut total = Decimal::ZERO;
        let mut ids = BTreeSet::new();
        for f in &self.fills {
            if f.fill_id.is_empty()
                || f.fill_id.len() > 128
                || !ids.insert(&f.fill_id)
                || f.order_id != o.order_id
                || f.command_id != self.command_id
                || f.account_id != self.account_id
                || f.symbol != o.symbol
                || f.side != o.side
                || !self.fact_hashes.contains(&f.fact_hash)
                || f.fee_currency.is_empty()
                || f.fee_currency.len() > 12
                || !f
                    .fee_currency
                    .bytes()
                    .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
                || f.filled_at < o.submitted_at
                || f.filled_at > o.updated_at
                || decimal(&f.fee_amount)? < Decimal::ZERO
            {
                return Err(Error::Invalid);
            }
            total = add(total, positive(&f.quantity)?)?;
            positive(&f.price)?;
        }
        if total != filled || (filled > Decimal::ZERO && o.average_fill_price.is_none()) {
            return Err(Error::Invalid);
        }
        Ok(())
    }
}
impl NativeLedger {
    pub fn new(scope: Scope) -> Result<Self> {
        if scope.tenant_id.as_uuid().is_nil()
            || scope.workspace_id.as_uuid().is_nil()
            || scope.account_id.as_uuid().is_nil()
        {
            return Err(Error::Invalid);
        }
        Ok(Self {
            scope,
            entries: vec![],
            receipts: BTreeMap::new(),
            fills: BTreeMap::new(),
            positions: BTreeMap::new(),
            cash: Decimal::ZERO,
            fees: Decimal::ZERO,
        })
    }
    pub fn scope(&self) -> &Scope {
        &self.scope
    }
    pub(crate) fn has_open_orders(&self) -> bool {
        self.entries.iter().any(|e| match &e.observation {
            Observation::Facts(f) => f.order.as_ref().is_some_and(|o| {
                !matches!(
                    o.status.as_str(),
                    "filled" | "cancelled" | "rejected" | "expired"
                )
            }),
            Observation::Legacy(_) => true,
        })
    }
    pub(crate) fn source_window(
        &self,
    ) -> Option<(chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)> {
        let times = self
            .entries
            .iter()
            .filter_map(|e| match &e.observation {
                Observation::Facts(f) => Some((
                    f.fills
                        .iter()
                        .map(|v| v.filled_at)
                        .min()
                        .unwrap_or(f.recorded_at),
                    f.recorded_at,
                )),
                Observation::Legacy(_) => None,
            })
            .collect::<Vec<_>>();
        Some((
            times.iter().map(|t| t.0).min()?,
            times.iter().map(|t| t.1).max()?,
        ))
    }
    pub fn anchor(&self) -> Anchor {
        Anchor {
            sequence: self.entries.len() as u64,
            head: self.entries.last().map(|e| e.hash.clone()),
        }
    }
    pub fn verify_anchor(&self, a: &Anchor) -> Result<()> {
        if a.sequence > self.entries.len() as u64
            || a.head
                != a.sequence
                    .checked_sub(1)
                    .and_then(|i| self.entries.get(i as usize))
                    .map(|e| e.hash.clone())
        {
            return Err(Error::Conflict);
        }
        Ok(())
    }
    pub fn checkpoint(&self) -> Result<Value> {
        serde_json::to_value(Checkpoint {
            schema_version: "quantos-native-ledger-checkpoint.v1".into(),
            scope: self.scope.clone(),
            entries: self.entries.clone(),
            anchor: self.anchor(),
        })
        .map_err(|_| Error::Invalid)
    }
    pub fn restore(scope: Scope, v: &Value) -> Result<Self> {
        let c: Checkpoint = serde_json::from_value(v.clone()).map_err(|_| Error::Invalid)?;
        if c.schema_version != "quantos-native-ledger-checkpoint.v1"
            || c.scope != scope
            || c.entries.len() > 10000
        {
            return Err(Error::Invalid);
        }
        let mut ledger = Self::new(scope)?;
        for e in c.entries {
            let previous = ledger.anchor().head;
            if e.sequence != ledger.entries.len() as u64 + 1
                || e.previous != previous
                || e.hash
                    != digest(&json!([
                        "quantos-native-ledger-entry/v1",
                        e.sequence,
                        e.observation,
                        previous
                    ]))?
            {
                return Err(Error::Invalid);
            }
            if !ledger.append(e.observation)? {
                return Err(Error::Invalid);
            }
        }
        if ledger.anchor() != c.anchor {
            return Err(Error::Invalid);
        }
        Ok(ledger)
    }
    pub fn observe(&mut self, s: &NativeExecutionFacts) -> Result<bool> {
        self.append(Observation::Facts(Box::new(s.clone())))
    }
    pub fn observe_legacy(&mut self, b: LegacyBinding) -> Result<bool> {
        self.append(Observation::Legacy(b))
    }
    fn append(&mut self, observation: Observation) -> Result<bool> {
        let binding = observation.binding();
        if binding.request_id.as_uuid().is_nil() || binding.command_id.as_uuid().is_nil() {
            return Err(Error::Invalid);
        }
        if let Some(old) = self
            .entries
            .iter()
            .find(|e| e.observation.binding().command_id == binding.command_id)
        {
            return if old.observation == observation {
                Ok(false)
            } else {
                Err(Error::Conflict)
            };
        }
        if self.entries.len() >= 10000
            || self
                .receipts
                .values()
                .any(|r| r.request_id == binding.request_id)
        {
            return Err(Error::Conflict);
        }
        let mut next = self.clone(); // a bad batch can never partly post financial facts
        let mut receipt = Receipt {
            request_id: binding.request_id,
            command_id: binding.command_id,
            subject_hash: binding.subject_hash,
            source_hash: None,
            entry_hash: ContentHash::sha256_bytes(b"pending"),
            sequence: next.entries.len() as u64 + 1,
            state: "quarantined".into(),
            reason: "JOURNAL_UNAVAILABLE".into(),
            observed_fill_ids: vec![],
            applied_fill_ids: vec![],
        };
        if let Observation::Facts(s) = &observation {
            s.validate_ledger_source(&next.scope)?;
            receipt.source_hash = Some(s.source_hash.clone());
            receipt.observed_fill_ids = s.fills.iter().map(|f| f.fill_id.clone()).collect();
            receipt.reason = s.reason.clone();
            // Check every observed identity, even when not posted. Unknown is an
            // obligation, never an invitation to recycle the same fill elsewhere.
            for f in &s.fills {
                if next.entries.iter().any(|e|matches!(&e.observation,Observation::Facts(old) if old.fills.iter().any(|x|x.fill_id==f.fill_id))){return Err(Error::Conflict);}
            }
            if s.consumer_ready {
                receipt.state = if s.fills.is_empty() {
                    "no_fill_observed"
                } else {
                    "applied"
                }
                .into();
                for f in &s.fills {
                    next.apply_fill(f)?;
                    receipt.applied_fill_ids.push(f.fill_id.clone());
                }
            }
        }
        let previous = next.anchor().head;
        receipt.entry_hash = digest(&json!([
            "quantos-native-ledger-entry/v1",
            receipt.sequence,
            observation,
            previous
        ]))?;
        next.entries.push(Entry {
            sequence: receipt.sequence,
            observation,
            previous,
            hash: receipt.entry_hash.clone(),
        });
        next.receipts.insert(receipt.command_id, receipt);
        *self = next;
        Ok(true)
    }
    fn apply_fill(&mut self, f: &NativeFill) -> Result<()> {
        let quantity = positive(&f.quantity)?;
        let price = positive(&f.price)?;
        let fee = decimal(&f.fee_amount)?;
        let signed = if f.side == "buy" { quantity } else { -quantity };
        let mut p = self.positions.get(&f.symbol).cloned().unwrap_or_default();
        let after = add(p.quantity, signed)?;
        if p.quantity == Decimal::ZERO || p.quantity.is_sign_negative() == signed.is_sign_negative()
        {
            p.average = add(mul(p.quantity.abs(), p.average)?, mul(quantity, price)?)?
                .checked_div(after.abs())
                .ok_or(Error::Invalid)?;
        } else {
            let closed = p.quantity.abs().min(quantity);
            let difference = if p.quantity > Decimal::ZERO {
                sub(price, p.average)?
            } else {
                sub(p.average, price)?
            };
            p.realized = add(p.realized, mul(difference, closed)?)?;
            if after == Decimal::ZERO {
                p.average = Decimal::ZERO;
            } else if p.quantity.is_sign_negative() != after.is_sign_negative() {
                p.average = price;
            }
        }
        p.quantity = after;
        p.realized = sub(p.realized, fee)?;
        let notional = mul(quantity, price)?;
        self.cash = add(
            self.cash,
            sub(if f.side == "buy" { -notional } else { notional }, fee)?,
        )?;
        self.fees = add(self.fees, fee)?;
        self.positions.insert(f.symbol.clone(), p);
        self.fills.insert(f.fill_id.clone(), f.clone());
        Ok(())
    }
    pub fn receipt(&self, c: CommandId) -> Option<&Receipt> {
        self.receipts.get(&c)
    }
    pub fn command_ids(&self) -> impl Iterator<Item = CommandId> + '_ {
        self.receipts.keys().copied()
    }
    pub fn view(&self) -> Result<Value> {
        let quarantines = self
            .receipts
            .values()
            .filter(|r| r.state == "quarantined")
            .count();
        Ok(
            json!({"schemaVersion":"quantos-native-ledger.v1","tenantId":self.scope.tenant_id,"workspaceId":self.scope.workspace_id,"accountId":self.scope.account_id,"quoteCurrency":"USDT","ledgerHash":digest(&self.checkpoint()?)?,"anchor":self.anchor(),"consumerReady":quarantines==0,"valuationReady":false,"executionAuthority":false,"scope":"OBSERVED_NATIVE_FILLS_ONLY","appliedFillCount":self.fills.len(),"quarantinedCommandCount":quarantines,"quoteCashDelta":text(self.cash),"quoteFeesTotal":text(self.fees),"positions":self.positions.iter().map(|(symbol,p)|json!({"symbol":symbol,"quantity":text(p.quantity),"averageEntryPrice":text(p.average),"realizedPnl":text(p.realized)})).collect::<Vec<_>>(),"entries":self.entries.iter().map(|e|self.receipts.get(&e.observation.binding().command_id).expect("validated receipt")).collect::<Vec<_>>()}),
        )
    }
}
