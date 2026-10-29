//! Read-only Assisted observation reconciliation. Independent protocol journals
//! are verified by the owner adapter, never synthesized from an X01 projection.
//! No marks/equity, Shadow impersonation, day closure or execution authority.
use crate::model::Error;
use chrono::{DateTime, Duration, Utc};
use quantos_core::{AccountId, CommandId, ContentHash, canonical_json_bytes};
use quantos_portfolio::{
    native_ledger::{Anchor, NativeLedger, Scope},
    native_source::NativeExecutionFacts,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
type Result<T> = std::result::Result<T, Error>;
fn invalid() -> Error {
    Error::Invalid("current observation source or binding")
}
pub fn digest(v: &impl Serialize) -> Result<ContentHash> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| invalid())?)
            .map_err(|_| invalid())?,
    ))
}
fn number(v: &Value) -> Result<Decimal> {
    Decimal::from_str_exact(v.as_str().ok_or_else(invalid)?).map_err(|_| invalid())
}
fn field<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v[k].as_str().ok_or_else(invalid)
}
fn identity(prefix: &str, seed: &str) -> Result<String> {
    Ok(format!(
        "{prefix}:{}",
        digest(&json!({"prefix":prefix,"seed":seed}))?
            .as_str()
            .trim_start_matches("sha256:")
    ))
}
fn text(v: Decimal) -> String {
    v.normalize().to_string()
}
fn exact(mut m: i128, mut scale: u32) -> Result<Decimal> {
    while scale > 0 && m % 10 == 0 {
        m /= 10;
        scale -= 1;
    }
    Decimal::try_from_i128_with_scale(m, scale).map_err(|_| Error::Arithmetic)
}
fn add(a: Decimal, b: Decimal) -> Result<Decimal> {
    let scale = a.scale().max(b.scale());
    let x = a
        .mantissa()
        .checked_mul(
            10_i128
                .checked_pow(scale - a.scale())
                .ok_or(Error::Arithmetic)?,
        )
        .ok_or(Error::Arithmetic)?;
    let y = b
        .mantissa()
        .checked_mul(
            10_i128
                .checked_pow(scale - b.scale())
                .ok_or(Error::Arithmetic)?,
        )
        .ok_or(Error::Arithmetic)?;
    exact(x.checked_add(y).ok_or(Error::Arithmetic)?, scale)
}
fn mul(a: Decimal, b: Decimal) -> Result<Decimal> {
    let a = a.normalize();
    let b = b.normalize();
    exact(
        a.mantissa()
            .checked_mul(b.mantissa())
            .ok_or(Error::Arithmetic)?,
        a.scale() + b.scale(),
    )
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtocolRecord {
    pub http_status: u16,
    pub command_id: CommandId,
    pub account_id: AccountId,
    pub observed_at: DateTime<Utc>,
    pub request_hash: ContentHash,
    pub response: Value,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtocolJournal {
    pub schema_version: String,
    pub source_id: String,
    pub account_id: AccountId,
    pub revision: u64,
    pub captured_at: DateTime<Utc>,
    pub records: Vec<ProtocolRecord>,
}
impl ProtocolJournal {
    pub fn content_hash(&self) -> Result<ContentHash> {
        digest(&json!([
            "quantos-x05-independent-protocol-journal/v1",
            self
        ]))
    }
    fn validate(&self, scope: &Scope, origin: &str, now: DateTime<Utc>) -> Result<()> {
        if self.schema_version != "quantos-independent-protocol-journal.v1"
            || self.source_id != origin
            || origin.is_empty()
            || self.account_id != scope.account_id
            || self.revision != self.records.len() as u64
            || self.records.len() > 10000
            || self.captured_at > now
        {
            return Err(invalid());
        }
        let mut commands = BTreeSet::new();
        for r in &self.records {
            if r.http_status != 200
                || r.account_id != scope.account_id
                || r.command_id.as_uuid().is_nil()
                || !commands.insert(r.command_id)
                || r.observed_at > self.captured_at
            {
                return Err(invalid());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub scope: Scope,
    pub origin_id: String,
    pub sources: Vec<NativeExecutionFacts>,
    pub ledger_checkpoint: Value,
    pub books: Option<ProtocolJournal>,
    pub checked_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_books: Option<crate::account_books::Books>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_basis: Option<crate::account_books::Basis>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub account_books_checked: bool,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Finding {
    pub kind: String,
    pub entity: String,
    pub command_id: Option<CommandId>,
    pub expected: Value,
    pub observed: Value,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Binding {
    pub request_id: quantos_core::ProposalId,
    pub command_id: CommandId,
    pub source_hash: Option<ContentHash>,
    pub ledger_entry_hash: ContentHash,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AlertEvidence {
    pub evidence_id: ContentHash,
    pub report_id: ContentHash,
    pub scope: Scope,
    pub finding: Finding,
    pub binding: Option<Binding>,
    pub ledger_hash: ContentHash,
    pub books_hash: Option<ContentHash>,
    pub observed_at: DateTime<Utc>,
    pub status: String,
    pub execution_authority: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Report {
    report_id: ContentHash,
    ledger_hash: ContentHash,
    books_hash: Option<ContentHash>,
    books_state: String,
    comparison_status: String,
    checked_at: DateTime<Utc>,
    bindings: Vec<Binding>,
    findings: Vec<Finding>,
    unknown_obligations_open: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    account_books: Option<crate::account_books::Report>,
}
fn compare(input: &Input) -> Result<Report> {
    let ledger = NativeLedger::restore(input.scope.clone(), &input.ledger_checkpoint)
        .map_err(|_| invalid())?;
    let view = ledger.view().map_err(|_| invalid())?;
    let ledger_hash: ContentHash =
        serde_json::from_value(view["ledgerHash"].clone()).map_err(|_| invalid())?;
    let receipts = view["entries"].as_array().ok_or_else(invalid)?;
    let mut bindings = vec![];
    let mut findings = vec![];
    let mut native = BTreeMap::new();
    let mut unknown = 0;
    for s in &input.sources {
        s.validate_ledger_source(&input.scope)
            .map_err(|_| invalid())?;
        if native.insert(s.command_id, s).is_some() {
            return Err(invalid());
        }
    }
    for receipt in receipts {
        let r: quantos_portfolio::native_ledger::Receipt =
            serde_json::from_value(receipt.clone()).map_err(|_| invalid())?;
        if let Some(hash) = &r.source_hash {
            let s = native.get(&r.command_id).ok_or_else(invalid)?;
            if s.source_hash != *hash
                || s.request_id != r.request_id
                || s.subject_hash != r.subject_hash
            {
                return Err(invalid());
            }
        }
        bindings.push(Binding {
            request_id: r.request_id,
            command_id: r.command_id,
            source_hash: r.source_hash.clone(),
            ledger_entry_hash: r.entry_hash,
        });
        if r.state == "quarantined" {
            if matches!(
                r.reason.as_str(),
                "OUTCOME_UNRESOLVED" | "JOURNAL_UNAVAILABLE"
            ) {
                unknown += 1;
            }
            findings.push(Finding {
                kind: r.reason,
                entity: format!("command:{}", r.command_id),
                command_id: Some(r.command_id),
                expected: Value::Null,
                observed: Value::Null,
            });
        }
    }
    if input
        .sources
        .iter()
        .any(|s| !bindings.iter().any(|b| b.command_id == s.command_id))
    {
        return Err(invalid());
    }
    bindings.sort_by_key(|b| b.command_id);
    let mut state = "UNAVAILABLE";
    let books_hash = input
        .books
        .as_ref()
        .map(ProtocolJournal::content_hash)
        .transpose()?;
    if let Some(book) = &input.books {
        book.validate(&input.scope, &input.origin_id, input.checked_at)?;
        if input.checked_at - book.captured_at > Duration::seconds(90) {
            state = "STALE";
            findings.push(Finding {
                kind: "BOOKS_STALE".into(),
                entity: "books".into(),
                command_id: None,
                expected: json!("fresh independent observation"),
                observed: json!(book.captured_at),
            });
        } else {
            state = "AVAILABLE_OBSERVATIONS";
            let mut record_map = BTreeMap::new();
            let mut fill_ids = BTreeSet::new();
            let mut positions: BTreeMap<String, Decimal> = BTreeMap::new();
            let mut cash = Decimal::ZERO;
            let mut fees = Decimal::ZERO;
            let mut push = |kind: &str,
                            entity: String,
                            c: Option<CommandId>,
                            expected: Value,
                            observed: Value| {
                if expected != observed {
                    findings.push(Finding {
                        kind: kind.into(),
                        entity,
                        command_id: c,
                        expected,
                        observed,
                    });
                }
            };
            for record in &book.records {
                let c = record.command_id;
                let raw = &record.response;
                let expected_client = format!(
                    "q{}",
                    &digest(&json!(["l01-client/v1", c, c]))?.as_str()[7..38]
                );
                if field(raw, "clientOrderId")? != expected_client {
                    return Err(invalid());
                }
                record_map.insert(c, record);
                let symbol = field(raw, "symbol")?;
                let side = field(raw, "side")?;
                if symbol.is_empty()
                    || symbol.len() > 20
                    || !symbol
                        .bytes()
                        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
                    || !matches!(side, "BUY" | "SELL")
                {
                    return Err(invalid());
                }
                let qty = number(&raw["origQty"])?;
                let filled = number(&raw["executedQty"])?;
                if qty <= Decimal::ZERO
                    || filled < Decimal::ZERO
                    || filled > qty
                    || raw["orderId"].as_u64().is_none()
                {
                    return Err(invalid());
                }
                let status = match field(raw, "status")? {
                    "NEW" => "accepted",
                    "FILLED" => "filled",
                    "PARTIALLY_FILLED" => "partially_filled",
                    "CANCELED" => "cancelled",
                    "REJECTED" => "rejected",
                    "EXPIRED" => "expired",
                    _ => return Err(invalid()),
                };
                let mut actual_fills = BTreeMap::new();
                let mut sum = Decimal::ZERO;
                let raw_fills = raw["fills"].as_array().ok_or_else(invalid)?;
                if raw_fills.len() > 10000 {
                    return Err(invalid());
                }
                for f in raw_fills {
                    let trade = f["tradeId"].as_u64().ok_or_else(invalid)?;
                    let venue_id = format!("{symbol}:{trade}");
                    if !fill_ids.insert(venue_id.clone()) {
                        return Err(invalid());
                    }
                    let id = identity("fill", &format!("{c}:{venue_id}"))?;
                    let q = number(&f["qty"])?;
                    let p = number(&f["price"])?;
                    let fee = number(&f["commission"])?;
                    let currency = field(f, "commissionAsset")?;
                    if q <= Decimal::ZERO
                        || p <= Decimal::ZERO
                        || fee < Decimal::ZERO
                        || currency.is_empty()
                    {
                        return Err(invalid());
                    }
                    sum = add(sum, q)?;
                    actual_fills.insert(id.clone(),json!({"quantity":text(q),"price":text(p),"feeAmount":text(fee),"feeCurrency":currency}));
                    // Quarantined/unknown fills stay observed but cannot be silently
                    // treated as X01 postings, even when this journal has a fill.
                    if native.get(&c).is_some_and(|s| s.consumer_ready) && currency == "USDT" {
                        let signed = if side == "BUY" { q } else { -q };
                        let old = positions.get(symbol).copied().unwrap_or_default();
                        positions.insert(symbol.into(), add(old, signed)?);
                        cash = add(cash, add(-mul(signed, p)?, -fee)?)?;
                        fees = add(fees, fee)?;
                    }
                }
                if sum != filled {
                    return Err(invalid());
                }
                if let Some(s) = native.get(&c) {
                    if !s.consumer_ready {
                        push(
                            "QUARANTINED_BOOK_OBSERVATION",
                            format!("command:{c}/independent_observation"),
                            Some(c),
                            Value::Null,
                            json!({"status":status,"executedQuantity":text(filled),"fillObservations":actual_fills}),
                        );
                    } else {
                        let o = s.order.as_ref().ok_or_else(invalid)?;
                        push(
                            "ORDER_ID",
                            format!("order:{c}"),
                            Some(c),
                            json!(o.order_id),
                            json!(identity("order", &c.to_string())?),
                        );
                        for (k, expected, actual) in [
                            ("symbol", json!(o.symbol), json!(symbol)),
                            ("side", json!(o.side), json!(side.to_lowercase())),
                            (
                                "quantity",
                                json!(text(number(&json!(o.quantity))?)),
                                json!(text(qty)),
                            ),
                            (
                                "filledQuantity",
                                json!(text(number(&json!(o.filled_quantity))?)),
                                json!(text(filled)),
                            ),
                            ("status", json!(o.status), json!(status)),
                        ] {
                            push(
                                "ORDER_DIFFERENCE",
                                format!("order:{c}/{k}"),
                                Some(c),
                                expected,
                                actual,
                            );
                        }
                        let expected=s.fills.iter().map(|f|Ok((f.fill_id.clone(),json!({"quantity":text(number(&json!(f.quantity))?),"price":text(number(&json!(f.price))?),"feeAmount":text(number(&json!(f.fee_amount))?),"feeCurrency":f.fee_currency})))).collect::<Result<BTreeMap<_,_>>>()?;
                        for id in expected
                            .keys()
                            .chain(actual_fills.keys())
                            .collect::<BTreeSet<_>>()
                        {
                            push(
                                "FILL_DIFFERENCE",
                                format!("fill:{id}"),
                                Some(c),
                                expected.get(id).cloned().unwrap_or(Value::Null),
                                actual_fills.get(id).cloned().unwrap_or(Value::Null),
                            );
                        }
                    }
                } else {
                    push(
                        "UNREGISTERED_BOOK_COMMAND",
                        format!("command:{c}"),
                        Some(c),
                        Value::Null,
                        json!("independent observation"),
                    );
                }
            }
            for s in native.values().filter(|s| s.consumer_ready) {
                if !record_map.contains_key(&s.command_id) {
                    push(
                        "BOOK_ORDER_MISSING",
                        format!("command:{}", s.command_id),
                        Some(s.command_id),
                        json!(s.source_hash),
                        Value::Null,
                    );
                }
            }
            let actual_positions = view["positions"]
                .as_array()
                .ok_or_else(invalid)?
                .iter()
                .map(|p| Ok((field(p, "symbol")?.to_owned(), number(&p["quantity"])?)))
                .collect::<Result<BTreeMap<_, _>>>()?;
            for symbol in actual_positions
                .keys()
                .chain(positions.keys())
                .collect::<BTreeSet<_>>()
            {
                push(
                    "POSITION_DELTA_DIFFERENCE",
                    format!("position:{symbol}"),
                    None,
                    json!(text(
                        actual_positions.get(symbol).copied().unwrap_or_default()
                    )),
                    json!(text(positions.get(symbol).copied().unwrap_or_default())),
                );
            }
            push(
                "CASH_DELTA_DIFFERENCE",
                "ledger/cash_delta".into(),
                None,
                json!(text(number(&view["quoteCashDelta"])?)),
                json!(text(cash)),
            );
            push(
                "FEE_DIFFERENCE",
                "ledger/quote_fees".into(),
                None,
                json!(text(number(&view["quoteFeesTotal"])?)),
                json!(text(fees)),
            );
        }
    } else {
        findings.push(Finding {
            kind: "BOOKS_UNAVAILABLE".into(),
            entity: "books".into(),
            command_id: None,
            expected: json!("verified independent observation"),
            observed: Value::Null,
        });
    }
    findings.sort_by(|a, b| (&a.kind, &a.entity).cmp(&(&b.kind, &b.entity)));
    let status = if state != "AVAILABLE_OBSERVATIONS" {
        "UNAVAILABLE"
    } else if findings.is_empty() {
        "MATCHED_OBSERVATIONS"
    } else {
        "DIFFERENCES"
    };
    let report_id = digest(&json!([
        "quantos-x05-current-report/v1",
        input.scope,
        ledger_hash,
        books_hash,
        state,
        bindings,
        findings
    ]))?;
    Ok(Report {
        report_id,
        ledger_hash,
        books_hash,
        books_state: state.into(),
        comparison_status: status.into(),
        checked_at: input.checked_at,
        bindings,
        findings,
        unknown_obligations_open: unknown,
        account_books: None,
    })
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Frame {
    input: Input,
    sequence: u64,
    previous: Option<ContentHash>,
    hash: ContentHash,
}
#[derive(Clone, Debug)]
pub struct CurrentReconciliation {
    scope: Scope,
    origin_id: String,
    frames: Vec<Frame>,
    last: Option<Report>,
    observer: Option<ProtocolJournal>,
    outbox: BTreeMap<ContentHash, AlertEvidence>,
    account_history: crate::account_books::History,
}
impl CurrentReconciliation {
    pub fn new(scope: Scope, origin_id: String) -> Result<Self> {
        NativeLedger::new(scope.clone()).map_err(|_| invalid())?;
        Ok(Self {
            scope,
            origin_id,
            frames: vec![],
            last: None,
            observer: None,
            outbox: BTreeMap::new(),
            account_history: crate::account_books::History::default(),
        })
    }
    pub fn anchor(&self) -> Anchor {
        Anchor {
            sequence: self.frames.len() as u64,
            head: self.frames.last().map(|f| f.hash.clone()),
        }
    }
    pub fn verify_anchor(&self, a: &Anchor) -> Result<()> {
        if a.sequence > self.frames.len() as u64
            || a.head
                != a.sequence
                    .checked_sub(1)
                    .and_then(|n| self.frames.get(n as usize))
                    .map(|f| f.hash.clone())
        {
            return Err(Error::Conflict);
        }
        Ok(())
    }
    pub fn observe(&mut self, input: Input) -> Result<bool> {
        if input.scope != self.scope
            || input.origin_id != self.origin_id
            || self
                .last
                .as_ref()
                .is_some_and(|r| input.checked_at < r.checked_at)
            || self.frames.len() >= 10000
        {
            return Err(invalid());
        }
        if let (Some(old), Some(new)) = (&self.observer, &input.books)
            && (new.revision < old.revision
                || new.captured_at < old.captured_at
                || new.records.get(..old.records.len()) != Some(old.records.as_slice())
                || new.revision == old.revision && new != old)
        {
            return Err(Error::Conflict);
        }
        let mut report = compare(&input)?;
        let mut account_history = self.account_history.clone();
        if input.account_books_checked {
            account_history.observe(
                input.account_books.as_ref(),
                input.account_basis.as_ref(),
                &self.scope,
                &self.origin_id,
                input.checked_at,
            )?;
            let ledger = NativeLedger::restore(self.scope.clone(), &input.ledger_checkpoint)
                .map_err(|_| invalid())?;
            let account = crate::account_books::compare(&input, &ledger)?;
            report.report_id = digest(&json!([
                "quantos-x05-combined-report/v1",
                report.report_id,
                account.report_id
            ]))?;
            report.account_books = Some(account);
        } else if input.account_books.is_some()
            || input.account_basis.is_some()
            || account_history.established()
        {
            return Err(invalid());
        }
        if self
            .last
            .as_ref()
            .is_some_and(|r| r.report_id == report.report_id)
        {
            return Ok(false);
        }
        let mut outbox = self.outbox.clone();
        for finding in &report.findings {
            let binding = finding
                .command_id
                .and_then(|c| report.bindings.iter().find(|b| b.command_id == c))
                .cloned();
            let id = digest(&json!([
                "quantos-x05-alert-evidence/v1",
                self.scope,
                finding,
                binding,
                report.ledger_hash,
                report.books_hash
            ]))?;
            outbox.entry(id.clone()).or_insert(AlertEvidence {
                evidence_id: id,
                report_id: report.report_id.clone(),
                scope: self.scope.clone(),
                finding: finding.clone(),
                binding,
                ledger_hash: report.ledger_hash.clone(),
                books_hash: report.books_hash.clone(),
                observed_at: input.checked_at,
                status: "OPEN".into(),
                execution_authority: false,
            });
        }
        // Account-level evidence uses the independent statement hash, never the
        // protocol journal hash. Establishing this optional source cannot close
        // old protocol or account evidence; subsequent absence remains OPEN.
        if account_history.established()
            && let Some(account) = &report.account_books
        {
            for finding in &account.findings {
                let binding: Option<Binding> = None;
                let id = digest(&json!([
                    "quantos-x05-alert-evidence/v1",
                    self.scope,
                    finding,
                    binding,
                    report.ledger_hash,
                    account.source_hash
                ]))?;
                outbox.entry(id.clone()).or_insert(AlertEvidence {
                    evidence_id: id,
                    report_id: account.report_id.clone(),
                    scope: self.scope.clone(),
                    finding: finding.clone(),
                    binding,
                    ledger_hash: report.ledger_hash.clone(),
                    books_hash: account.source_hash.clone(),
                    observed_at: input.checked_at,
                    status: "OPEN".into(),
                    execution_authority: false,
                });
            }
        }
        let previous = self.anchor().head;
        if outbox.len() > 20000 {
            return Err(Error::Unavailable);
        }
        let sequence = self.frames.len() as u64 + 1;
        let hash = digest(&json!([
            "quantos-x05-current-frame/v1",
            sequence,
            input,
            previous
        ]))?;
        if let Some(book) = &input.books {
            self.observer = Some(book.clone());
        }
        self.frames.push(Frame {
            input,
            sequence,
            previous,
            hash,
        });
        self.outbox = outbox;
        self.account_history = account_history;
        self.last = Some(report);
        Ok(true)
    }
    pub fn checkpoint(&self) -> Result<Value> {
        Ok(
            json!({"schemaVersion":"quantos-x05-current-checkpoint.v1","scope":self.scope,"originId":self.origin_id,"frames":self.frames,"anchor":self.anchor()}),
        )
    }
    pub fn restore(scope: Scope, origin_id: String, v: &Value) -> Result<Self> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct C {
            schema_version: String,
            scope: Scope,
            origin_id: String,
            frames: Vec<Frame>,
            anchor: Anchor,
        }
        let c: C = serde_json::from_value(v.clone()).map_err(|_| invalid())?;
        if c.schema_version != "quantos-x05-current-checkpoint.v1"
            || c.scope != scope
            || c.origin_id != origin_id
            || c.frames.len() > 10000
        {
            return Err(invalid());
        }
        let mut s = Self::new(scope, origin_id)?;
        for frame in c.frames {
            if frame.sequence != s.frames.len() as u64 + 1
                || frame.previous != s.anchor().head
                || frame.hash
                    != digest(&json!([
                        "quantos-x05-current-frame/v1",
                        frame.sequence,
                        frame.input,
                        frame.previous
                    ]))?
                || !s.observe(frame.input)?
            {
                return Err(invalid());
            }
        }
        if s.anchor() != c.anchor {
            return Err(invalid());
        }
        Ok(s)
    }
    pub fn view(&self) -> Result<Value> {
        let r = self.last.as_ref().ok_or(Error::Unavailable)?;
        let mut view = json!({"schemaVersion":"quantos-current-reconciliation.v1","tenantId":self.scope.tenant_id,"workspaceId":self.scope.workspace_id,"accountId":self.scope.account_id,"mode":"assisted_live","reportId":r.report_id,"ledgerHash":r.ledger_hash,"booksHash":r.books_hash,"booksSourceId":self.origin_id,"booksState":r.books_state,"comparisonStatus":r.comparison_status,"coverage":"OBSERVED_EXECUTION_DELTAS_ONLY","fullBooksReady":false,"dayCloseAllowed":false,"executionAuthority":false,"checkedAt":r.checked_at,"sourceBindings":r.bindings,"findings":r.findings,"unknownObligationsOpen":r.unknown_obligations_open,"openAlertEvidenceCount":self.outbox.len(),"alertEvidence":self.outbox.values().collect::<Vec<_>>(),"anchor":self.anchor()});
        if let Some(account) = &r.account_books {
            view["accountBooks"] = json!(account);
        }
        Ok(view)
    }
}
