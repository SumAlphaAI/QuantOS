//! Independent signed account statements. Pure, bounded spot-account comparison;
//! no inferred missing balances, FX, external flows, day close or command authority.
use crate::current::{Finding, digest};
use crate::model::Error;
use chrono::{DateTime, Duration, Utc};
use quantos_core::ContentHash;
use quantos_portfolio::{
    native_ledger::{NativeLedger, Scope},
    native_valuation::Inputs,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
type Result<T> = std::result::Result<T, Error>;
pub const COVERAGE: &str = "SPOT_EMPTY_ORIGIN_NO_EXTERNAL_FLOWS_QUOTE_FEES";
pub const TRUST: &str = "PINNED_INDEPENDENT_OWNER_REFERENCE_NOT_VENUE_ACCOUNT";
fn invalid() -> Error {
    Error::Invalid("independent account books scope, coverage or source")
}
fn reference(s: &str) -> bool {
    !s.trim().is_empty() && s.len() <= 256 && !s.chars().any(char::is_control)
}
fn dec(s: &str) -> Result<Decimal> {
    if s.is_empty() || s.len() > 80 || s.contains(['e', 'E', '+']) {
        return Err(invalid());
    }
    Decimal::from_str_exact(s).map_err(|_| invalid())
}
// checked_add may round at the Decimal limit. Align mantissas and reject instead.
fn add(a: Decimal, b: Decimal) -> Result<Decimal> {
    let scale = a.scale().max(b.scale());
    let align = |v: Decimal| {
        v.mantissa()
            .checked_mul(
                10_i128
                    .checked_pow(scale - v.scale())
                    .ok_or(Error::Arithmetic)?,
            )
            .ok_or(Error::Arithmetic)
    };
    let mut m = align(a)?.checked_add(align(b)?).ok_or(Error::Arithmetic)?;
    let mut s = scale;
    while s > 0 && m % 10 == 0 {
        m /= 10;
        s -= 1;
    }
    Decimal::try_from_i128_with_scale(m, s).map_err(|_| Error::Arithmetic)
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Basis {
    pub scope: Scope,
    pub source_hash: ContentHash,
    pub source_ref: String,
    pub origin_ledger_hash: ContentHash,
    pub opening_at: DateTime<Utc>,
    pub quote_currency: String,
    pub opening_cash: String,
}
impl Basis {
    pub fn from_valuation(i: &Inputs) -> Result<Self> {
        if i.basis != quantos_portfolio::native_valuation::BASIS
            || i.source_id != quantos_portfolio::native_valuation::SOURCE
        {
            return Err(invalid());
        }
        Ok(Self {
            scope: i.scope.clone(),
            source_hash: i.content_hash().map_err(|_| invalid())?,
            source_ref: i.cash_source_ref.clone(),
            origin_ledger_hash: i.origin_ledger_hash.clone(),
            opening_at: i.opening_at,
            quote_currency: i.quote_currency.clone(),
            opening_cash: i.quote_cash_at_opening.clone(),
        })
    }
    fn validate(&self, scope: &Scope) -> Result<()> {
        let empty = NativeLedger::new(scope.clone())
            .map_err(|_| invalid())?
            .view()
            .map_err(|_| invalid())?;
        if &self.scope != scope
            || self.quote_currency != "USDT"
            || !reference(&self.source_ref)
            || dec(&self.opening_cash)? < Decimal::ZERO
            || json!(self.origin_ledger_hash) != empty["ledgerHash"]
        {
            return Err(invalid());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Balance {
    pub asset: String,
    pub amount: String,
    pub source_ref: String,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Books {
    pub schema_version: String,
    pub scope: Scope,
    pub source_id: String,
    pub version: u64,
    pub previous_hash: Option<ContentHash>,
    pub source_ref: String,
    pub coverage: String,
    pub position_universe: Vec<String>,
    pub cash_universe: Vec<String>,
    pub fee_universe: Vec<String>,
    pub positions_complete: bool,
    pub cash_complete: bool,
    pub fees_complete: bool,
    pub external_flows_absent: bool,
    pub liabilities_absent: bool,
    pub open_orders_absent: bool,
    pub period_start: DateTime<Utc>,
    pub coverage_through: DateTime<Utc>,
    pub captured_at: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub positions: Vec<Balance>,
    pub cash: Vec<Balance>,
    pub fees: Vec<Balance>,
}
impl Books {
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!(["quantos-x05-independent-account-books/v1", self]))
    }
    fn validate(&self, scope: &Scope, origin: &str, at: DateTime<Utc>) -> Result<()> {
        if self.schema_version != "quantos-independent-account-books.v1"
            || &self.scope != scope
            || self.source_id != origin
            || !reference(origin)
            || !reference(&self.source_ref)
            || self.version == 0
            || self.period_start > self.coverage_through
            || self.coverage_through > self.captured_at
            || self.captured_at > at
            || self.valid_until <= self.captured_at
            || self.valid_until
                > self
                    .captured_at
                    .checked_add_signed(Duration::seconds(30))
                    .ok_or_else(invalid)?
            || self.positions.len() > 256
            || self.cash.len() > 256
            || self.fees.len() > 256
        {
            return Err(invalid());
        }
        for (universe, rows) in [
            (&self.position_universe, &self.positions),
            (&self.cash_universe, &self.cash),
            (&self.fee_universe, &self.fees),
        ] {
            if universe.is_empty()
                || universe.len() > 256
                || universe.windows(2).any(|p| p[0] >= p[1])
                || universe.iter().any(|s| {
                    s.is_empty()
                        || s.len() > 32
                        || !s
                            .bytes()
                            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
                })
            {
                return Err(invalid());
            }
            let mut seen = BTreeSet::new();
            for b in rows {
                if !universe.contains(&b.asset)
                    || !seen.insert(&b.asset)
                    || !reference(&b.source_ref)
                {
                    return Err(invalid());
                }
                dec(&b.amount)?;
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Default)]
pub struct History {
    last: Option<Books>,
    basis: Option<Basis>,
}
impl History {
    pub fn observe(
        &mut self,
        books: Option<&Books>,
        basis: Option<&Basis>,
        scope: &Scope,
        origin: &str,
        at: DateTime<Utc>,
    ) -> Result<()> {
        if let Some(b) = basis {
            b.validate(scope)?;
            if self.basis.as_ref().is_some_and(|old| old != b) {
                return Err(Error::Conflict);
            }
        }
        if let Some(b) = books {
            b.validate(scope, origin, at)?;
            if let Some(old) = &self.last {
                if b.version == old.version {
                    if b != old {
                        return Err(Error::Conflict);
                    }
                } else if b.version != old.version.checked_add(1).ok_or(Error::Conflict)?
                    || b.previous_hash != Some(old.content_hash()?)
                    || b.captured_at < old.captured_at
                    || b.coverage_through < old.coverage_through
                    || b.period_start != old.period_start
                    || b.coverage != old.coverage
                    || b.position_universe != old.position_universe
                    || b.cash_universe != old.cash_universe
                    || b.fee_universe != old.fee_universe
                {
                    return Err(Error::Conflict);
                }
            } else if b.version != 1 || b.previous_hash.is_some() {
                return Err(Error::Conflict);
            }
        }
        if let Some(b) = basis {
            self.basis = Some(b.clone());
        }
        if let Some(b) = books {
            self.last = Some(b.clone());
        }
        Ok(())
    }
    pub fn established(&self) -> bool {
        self.last.is_some()
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Report {
    pub report_id: ContentHash,
    pub source_hash: Option<ContentHash>,
    pub source_id: String,
    pub source_version: Option<String>,
    pub source_ref: Option<String>,
    pub basis_hash: Option<ContentHash>,
    pub ledger_hash: ContentHash,
    pub coverage: String,
    pub source_trust: String,
    pub period_start: Option<DateTime<Utc>>,
    pub coverage_through: Option<DateTime<Utc>>,
    pub captured_at: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub comparison_ready: bool,
    pub status: String,
    pub findings: Vec<Finding>,
    pub full_books_ready: bool,
    pub day_close_allowed: bool,
    pub execution_authority: bool,
}
pub fn compare(input: &crate::current::Input, ledger: &NativeLedger) -> Result<Report> {
    if ledger.scope() != &input.scope {
        return Err(invalid());
    }
    let scope = &input.scope;
    let origin = input.origin_id.as_str();
    let books = input.account_books.as_ref();
    let basis = input.account_basis.as_ref();
    let sources = &input.sources;
    let at = input.checked_at;
    let v = ledger.view().map_err(|_| invalid())?;
    let mut r = Report {
        report_id: digest(&json!(null))?,
        source_hash: books.map(Books::content_hash).transpose()?,
        source_id: origin.into(),
        source_version: books.map(|b| b.version.to_string()),
        source_ref: books.map(|b| b.source_ref.clone()),
        basis_hash: basis.map(digest).transpose()?,
        ledger_hash: serde_json::from_value(v["ledgerHash"].clone()).map_err(|_| invalid())?,
        coverage: COVERAGE.into(),
        source_trust: TRUST.into(),
        period_start: books.map(|b| b.period_start),
        coverage_through: books.map(|b| b.coverage_through),
        captured_at: books.map(|b| b.captured_at),
        valid_until: books.map(|b| b.valid_until),
        comparison_ready: false,
        status: "SOURCE_UNAVAILABLE".into(),
        findings: vec![],
        full_books_ready: false,
        day_close_allowed: false,
        execution_authority: false,
    };
    let mut finding = |kind: &str, entity: &str, expected: Value, observed: Value| {
        r.findings.push(Finding {
            kind: format!("ACCOUNT_BOOKS_{kind}"),
            entity: entity.into(),
            command_id: None,
            expected,
            observed,
        })
    };
    if v["consumerReady"] != true
        || sources
            .iter()
            .any(|s| !s.consumer_ready || !s.journal_available || s.outcome == "unknown")
    {
        r.status = "UNKNOWN_OR_QUARANTINED_OBLIGATIONS".into();
        finding(
            "UNKNOWN",
            "account",
            json!("resolved native facts"),
            v["quarantinedCommandCount"].clone(),
        );
    } else if let Some(b) = books {
        b.validate(scope, origin, at)?;
        if at >= b.valid_until
            || at.signed_duration_since(b.coverage_through) > Duration::seconds(30)
        {
            r.status = "STALE_SOURCE".into();
            finding(
                "STALE",
                "account",
                json!("current half-open lease and coverage"),
                json!(b.valid_until),
            );
        } else if let Some(base) = basis {
            base.validate(scope)?;
            if b.coverage != COVERAGE
                || b.position_universe != ["BTCUSDT", "ETHUSDT"]
                || b.cash_universe != ["USDT"]
                || b.fee_universe != ["USDT"]
                || !b.positions_complete
                || !b.cash_complete
                || !b.fees_complete
                || !b.external_flows_absent
                || !b.liabilities_absent
                || !b.open_orders_absent
                || b.period_start != base.opening_at
                || b.positions.len() != b.position_universe.len()
                || b.cash.len() != 1
                || b.fees.len() != 1
            {
                r.status = "INCOMPLETE_OR_UNSUPPORTED_COVERAGE".into();
                finding("COVERAGE", "account", json!(COVERAGE), json!(b));
            } else if sources.iter().any(|s| {
                s.recorded_at > b.coverage_through
                    || s.order.as_ref().is_some_and(|o| {
                        o.submitted_at < b.period_start
                            || o.updated_at > b.coverage_through
                            || !["filled", "rejected", "canceled", "expired"]
                                .contains(&o.status.as_str())
                    })
                    || s.fills
                        .iter()
                        .any(|f| f.filled_at < b.period_start || f.filled_at > b.coverage_through)
            }) {
                r.status = "NATIVE_PERIOD_OR_OPEN_ORDERS_NOT_COVERED".into();
                finding(
                    "NATIVE_COVERAGE",
                    "account",
                    json!("all current native facts inside closed period"),
                    json!(b.coverage_through),
                );
            } else {
                let positions = v["positions"].as_array().ok_or_else(invalid)?;
                let expected = positions
                    .iter()
                    .map(|p| {
                        Ok((
                            p["symbol"].as_str().ok_or_else(invalid)?.to_string(),
                            dec(p["quantity"].as_str().ok_or_else(invalid)?)?,
                        ))
                    })
                    .collect::<Result<BTreeMap<_, _>>>()?;
                if expected.keys().any(|s| !b.position_universe.contains(s)) {
                    r.status = "INCOMPLETE_OR_UNSUPPORTED_COVERAGE".into();
                    finding(
                        "COVERAGE",
                        "positions",
                        json!(expected.keys().collect::<Vec<_>>()),
                        json!(b.position_universe),
                    );
                } else {
                    for row in &b.positions {
                        let e = expected.get(&row.asset).copied().unwrap_or(Decimal::ZERO);
                        if e != dec(&row.amount)? {
                            finding(
                                "POSITION_DIFFERENCE",
                                &row.asset,
                                json!(e.normalize().to_string()),
                                json!(row.amount),
                            );
                        }
                    }
                    for (kind, rows, e) in [
                        (
                            "CASH_DIFFERENCE",
                            &b.cash,
                            add(
                                dec(&base.opening_cash)?,
                                dec(v["quoteCashDelta"].as_str().ok_or_else(invalid)?)?,
                            )?,
                        ),
                        (
                            "FEE_DIFFERENCE",
                            &b.fees,
                            dec(v["quoteFeesTotal"].as_str().ok_or_else(invalid)?)?,
                        ),
                    ] {
                        if e != dec(&rows[0].amount)? {
                            finding(
                                kind,
                                "USDT",
                                json!(e.normalize().to_string()),
                                json!(rows[0].amount),
                            );
                        }
                    }
                    r.comparison_ready = true;
                    r.status = if r.findings.is_empty() {
                        "MATCHED_DECLARED_ACCOUNT_BOOKS"
                    } else {
                        "DIFFERENCES"
                    }
                    .into();
                }
            }
        } else {
            r.status = "LOCAL_OPENING_BASIS_UNAVAILABLE".into();
            finding(
                "BASIS_UNAVAILABLE",
                "account",
                json!("accepted X01 immutable opening authority"),
                Value::Null,
            );
        }
    } else {
        finding(
            "UNAVAILABLE",
            "account",
            json!("pinned independent signed account statement"),
            Value::Null,
        );
    }
    r.report_id = digest(&json!([
        "quantos-x05-account-books-report/v1",
        scope,
        r.source_hash,
        r.basis_hash,
        r.ledger_hash,
        r.status,
        r.findings
    ]))?;
    Ok(r)
}
