//! C12 projections from authorized R01 trade and book events. Quotes remain non-executable.
use crate::research::{Fault, Output, Result, digest};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::Response,
    routing::get,
};
use chrono::{DateTime, Duration, Utc};
use quantos_market::{MarketDataQuality, MarketEvent, MarketEventKind};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Instrument {
    pub canonical_symbol: String,
    pub venue: String,
    pub product_type: String,
    pub provider: String,
    pub snapshot_id: Uuid,
    pub lot_size: String,
    pub min_notional: String,
}
impl Instrument {
    pub fn id(&self) -> String {
        format!(
            "{}:{}:{}",
            self.venue, self.product_type, self.canonical_symbol
        )
    }
    pub fn validate(&self) -> Result<()> {
        if quantos_market::normalize_symbol(&self.canonical_symbol).map_err(|_| Fault::invalid())?
            != self.canonical_symbol
            || !matches!(self.venue.as_str(), "binance" | "coinbase")
            || self.product_type != "spot"
            || !self.provider.ends_with(&format!(".{}.spot", self.venue))
            || self.snapshot_id.is_nil()
            || [&self.lot_size, &self.min_notional]
                .iter()
                .any(|v| Decimal::from_str_exact(v).map_or(true, |n| n <= Decimal::ZERO))
        {
            return Err(Fault::invalid());
        }
        Ok(())
    }
    pub fn view(&self) -> Value {
        json!({"instrumentId":self.id(),"canonicalSymbol":self.canonical_symbol,"venue":self.venue,"productType":self.product_type,"intervals":["1m","5m","15m","1h","4h","1D","1W"],"timezones":["UTC","Asia/Shanghai"],"priceKind":"top_of_book","topOfBook":true,"lotSize":self.lot_size,"minNotional":self.min_notional})
    }
}
#[derive(Clone, Default, Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct MarketQuery {
    pub symbol: Option<String>,
    pub venue: Option<String>,
    pub product: Option<String>,
    pub interval: Option<String>,
    pub timezone: Option<String>,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub after_sequence: Option<u64>,
    pub stream_id: Option<String>,
}
impl MarketQuery {
    pub fn selected(&self, i: &Instrument) -> bool {
        self.symbol
            .as_ref()
            .is_none_or(|s| s == &i.canonical_symbol)
            && self.venue.as_ref().is_none_or(|s| s == &i.venue)
            && self.product.as_ref().is_none_or(|s| s == &i.product_type)
    }
    pub fn validate(&self) -> Result<()> {
        if self
            .symbol
            .as_ref()
            .is_some_and(|s| quantos_market::normalize_symbol(s).ok().as_ref() != Some(s))
            || self
                .venue
                .as_ref()
                .is_some_and(|s| !matches!(s.as_str(), "binance" | "coinbase"))
            || self.product.as_ref().is_some_and(|s| s != "spot")
            || self
                .timezone
                .as_ref()
                .is_some_and(|s| !matches!(s.as_str(), "UTC" | "Asia/Shanghai"))
            || self.interval.as_ref().is_some_and(|s| {
                !matches!(s.as_str(), "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W")
            })
            || self
                .start
                .zip(self.end)
                .is_some_and(|(a, b)| a >= b || b - a > Duration::days(31))
        {
            return Err(Fault::invalid());
        }
        Ok(())
    }
    pub fn seconds(&self) -> i64 {
        match self.interval.as_deref().unwrap_or("1m") {
            "5m" => 300,
            "15m" => 900,
            "1h" => 3600,
            "4h" => 14400,
            "1D" => 86400,
            "1W" => 604800,
            _ => 60,
        }
    }
    pub fn binding(&self, scope: &str, kind: &str, i: &Instrument) -> String {
        let hash = digest(&json!([
            scope,
            kind,
            i.id(),
            i.provider,
            self.interval.as_deref().unwrap_or("1m"),
            self.timezone.as_deref().unwrap_or("UTC"),
            self.start,
            self.end
        ]));
        let mut bytes = [0u8; 16];
        for (n, b) in bytes.iter_mut().enumerate() {
            *b = u8::from_str_radix(&hash[7 + n * 2..9 + n * 2], 16).unwrap();
        }
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        Uuid::from_bytes(bytes).to_string()
    }
}
#[derive(Default, Debug)]
pub(crate) struct Watchlists {
    pub records: BTreeMap<String, Value>,
    pub intents: BTreeMap<String, (Value, Value)>,
}
pub(crate) fn empty_watchlist() -> Value {
    json!({"instrumentIds":[],"objectVersion":"watchlist-0"})
}
pub(crate) fn save_watchlist(
    store: &mut Watchlists,
    scope: &str,
    key: Uuid,
    version: &str,
    input: Value,
    catalog: &[Instrument],
) -> Result<Value> {
    let ids = input["instrumentIds"]
        .as_array()
        .ok_or_else(Fault::invalid)?;
    if input.as_object().is_none_or(|o| o.len() != 1)
        || ids.len() > 100
        || ids.iter().any(|id| !catalog.iter().any(|i| id == &i.id()))
        || ids
            .iter()
            .map(Value::to_string)
            .collect::<BTreeSet<_>>()
            .len()
            != ids.len()
    {
        return Err(Fault::invalid());
    }
    let binding = format!("{scope}:{key}");
    let intent = json!([version, input]);
    if let Some((old, response)) = store.intents.get(&binding) {
        return if old == &intent {
            Ok(response.clone())
        } else {
            Err(Fault(StatusCode::CONFLICT, "IDEMPOTENCY_CONFLICT"))
        };
    }
    let current = store
        .records
        .get(scope)
        .cloned()
        .unwrap_or_else(empty_watchlist);
    if current["objectVersion"] != version {
        return Err(Fault(StatusCode::CONFLICT, "VERSION_CONFLICT"));
    }
    let result = json!({"instrumentIds":ids,"objectVersion":format!("watchlist-{}",Uuid::new_v4()),"auditRef":Uuid::new_v4(),"correlationId":Uuid::new_v4()});
    store.records.insert(scope.into(), result.clone());
    store.intents.insert(binding, (intent, result.clone()));
    Ok(result)
}
pub(crate) fn watch_output(result: Result<Value>, current: &Value) -> Result<Output> {
    match result {
        Ok(v) => Ok(Output::Json(StatusCode::OK, v)),
        Err(e) if e.1 == "VERSION_CONFLICT" => Ok(Output::Json(
            StatusCode::CONFLICT,
            json!({"code":"VERSION_CONFLICT","message":"Refresh the watchlist version before saving.","correlationId":Uuid::new_v4(),"currentVersion":current["objectVersion"]}),
        )),
        Err(e) => Err(e),
    }
}
// Integrity is rechecked after each adapter load, including reconnect. Missing/failed source facts never become prices.
pub(crate) fn validate_events(
    i: &Instrument,
    events: &[MarketEvent],
    now: DateTime<Utc>,
) -> Result<Vec<MarketEvent>> {
    i.validate()?;
    if events.is_empty() || events.len() > 10000 {
        return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
    }
    let mut ids = BTreeMap::new();
    let mut out = vec![];
    for e in events {
        if e.normalized_symbol != i.canonical_symbol
            || e.provider != i.provider
            || e.dataset.trim().is_empty()
            || e.license_label.trim().is_empty()
            || e.approval_reference.trim().is_empty()
            || e.approval_version.trim().is_empty()
            || e.event_time > now
            || e.received_at > now
            || e.received_at < e.event_time
            || e.source_tick_id.trim().is_empty()
            || e.source_tick_id.len() > 256
            || e.quality == MarketDataQuality::Failed
            || e.sequence == 0
            || e.sequence > 9_007_199_254_740_991
        {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
        }
        if e.event_kind != MarketEventKind::TickRecorded {
            continue;
        }
        if e.price.is_none_or(|p| p.value() <= Decimal::ZERO)
            || e.volume.is_none_or(|v| v.value() <= Decimal::ZERO)
            || quantos_core::Quantity::parse_str(&e.raw_price).ok() != e.price
            || quantos_core::Quantity::parse_str(&e.raw_volume).ok() != e.volume
        {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
        }
        if let Some(old) = ids.insert(e.source_tick_id.clone(), e.clone()) {
            if old != *e {
                return Err(Fault(StatusCode::CONFLICT, "SOURCE_CONFLICT"));
            }
            continue;
        }
        out.push(e.clone());
    }
    out.sort_by_key(|e| (e.event_time, e.sequence));
    let seq = out.iter().map(|e| e.sequence).collect::<BTreeSet<_>>();
    if out.is_empty() || seq.len() != out.len() {
        return Err(Fault(StatusCode::CONFLICT, "SOURCE_CONFLICT"));
    }
    Ok(out)
}
fn provenance(i: &Instrument, e: &MarketEvent, now: DateTime<Utc>) -> Value {
    json!({"source":e.provider,"venue":i.venue,"asOf":e.event_time,"quality":if now-e.event_time>Duration::seconds(2){"degraded"}else{e.quality.as_str()},"license":e.license_label,"approvalRef":e.approval_reference,"approvalVersion":e.approval_version,"dataSnapshotId":i.snapshot_id,"latencyMs":(now-e.event_time).num_milliseconds().max(0)})
}
pub(crate) fn quote(i: &Instrument, events: &[MarketEvent], now: DateTime<Utc>) -> Result<Value> {
    let events = validate_events(i, events, now)?;
    let e = events.last().unwrap();
    Ok(
        json!({"instrumentId":i.id(),"canonicalSymbol":i.canonical_symbol,"productType":i.product_type,"bid":null,"ask":null,"mid":null,"lastPrice":e.price.unwrap().value().to_string(),"priceKind":"last_trade","executable":false,"feeEstimate":null,"slippageEstimate":null,"estimates":true,"lotSize":i.lot_size,"minNotional":i.min_notional,"provenance":provenance(i,e,now),"sequence":events.iter().map(|e|e.sequence).max().unwrap()}),
    )
}
pub(crate) fn book_quote(
    i: &Instrument,
    book: &quantos_market::book::MarketBookEvent,
    trades: &[MarketEvent],
    now: DateTime<Utc>,
) -> Result<Value> {
    i.validate()?;
    book.validate().map_err(|_| Fault::invalid())?;
    if book.received_at > now
        || book.received_at < book.event_time
        || book.provider != i.provider
        || book.normalized_symbol != i.canonical_symbol
        || book.event_time > now
        || book.quality == MarketDataQuality::Failed
        || book.license_label.trim().is_empty()
        || book.approval_reference.trim().is_empty()
        || book.approval_version.trim().is_empty()
        || book.dataset.trim().is_empty()
        || book.source_tick_id.trim().is_empty()
        || book.source_tick_id.len() > 256
        || book.sequence > 9_007_199_254_740_991
    {
        return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
    }
    let mid = book
        .bid
        .value()
        .checked_add(book.ask.value())
        .and_then(|v| v.checked_div(Decimal::from(2)))
        .ok_or_else(Fault::invalid)?;
    let trade = if trades.is_empty() {
        Value::Null
    } else {
        quote(i, trades, now)?
    };
    let sequence = book.sequence.max(trade["sequence"].as_u64().unwrap_or(0));
    let quality = if now - book.event_time > Duration::seconds(2)
        || trade["provenance"]["quality"] == "degraded"
    {
        "degraded"
    } else {
        book.quality.as_str()
    };
    Ok(
        json!({"instrumentId":i.id(),"canonicalSymbol":i.canonical_symbol,"productType":i.product_type,"bid":book.bid.value().to_string(),"ask":book.ask.value().to_string(),"mid":mid.to_string(),"lastPrice":trade["lastPrice"],"priceKind":"top_of_book","executable":false,"feeEstimate":null,"slippageEstimate":null,"estimates":true,"lotSize":i.lot_size,"minNotional":i.min_notional,"provenance":{"source":book.provider,"venue":i.venue,"asOf":book.event_time,"quality":quality,"license":book.license_label,"approvalRef":book.approval_reference,"approvalVersion":book.approval_version,"dataSnapshotId":i.snapshot_id,"latencyMs":(now-book.event_time).num_milliseconds().max(0)},"sequence":sequence}),
    )
}
pub(crate) fn validate_books(
    i: &Instrument,
    books: &[quantos_market::book::MarketBookEvent],
    now: DateTime<Utc>,
) -> Result<Vec<quantos_market::book::MarketBookEvent>> {
    i.validate()?;
    if books.len() > 10000 {
        return Err(Fault::invalid());
    }
    let mut ids = BTreeMap::new();
    for book in books {
        book_quote(i, book, &[], now)?;
        if let Some(old) = ids.insert(book.source_tick_id.clone(), book.clone())
            && old != *book
        {
            return Err(Fault(StatusCode::CONFLICT, "SOURCE_CONFLICT"));
        }
    }
    let mut books = ids.into_values().collect::<Vec<_>>();
    if books
        .iter()
        .map(|b| b.sequence)
        .collect::<BTreeSet<_>>()
        .len()
        != books.len()
    {
        return Err(Fault(StatusCode::CONFLICT, "SOURCE_CONFLICT"));
    }
    books.sort_by_key(|b| (b.event_time, b.sequence));
    Ok(books)
}
pub(crate) fn book_replay(
    scope: &str,
    i: &Instrument,
    book: &quantos_market::book::MarketBookEvent,
    trades: &[MarketEvent],
    q: &MarketQuery,
    now: DateTime<Utc>,
) -> Result<Vec<Value>> {
    let binding = q.binding(scope, "book", i);
    let after = q.after_sequence.unwrap_or(0);
    let payload = book_quote(i, book, trades, now)?;
    let sequence = payload["sequence"].as_u64().ok_or_else(Fault::invalid)?;
    if after > 0 && (q.stream_id.as_deref() != Some(&binding) || after > sequence) {
        return Err(Fault(StatusCode::CONFLICT, "STREAM_RESET_REQUIRED"));
    }
    if after == sequence {
        return Ok(vec![]);
    }
    Ok(vec![
        json!({"streamId":binding,"sequence":sequence,"eventId":Uuid::new_v4(),"occurredAt":now,"correlationId":Uuid::new_v4(),"payloadVersion":"v1","payload":payload}),
    ])
}
pub(crate) fn candles(
    i: &Instrument,
    events: &[MarketEvent],
    q: &MarketQuery,
    now: DateTime<Utc>,
) -> Result<Value> {
    q.validate()?;
    let events = validate_events(i, events, now)?;
    let mut bars: BTreeMap<i64, Value> = BTreeMap::new();
    let seconds = q.seconds();
    let offset = if q.timezone.as_deref() == Some("Asia/Shanghai") {
        28800
    } else {
        0
    };
    for e in &events {
        if q.start.is_some_and(|s| e.event_time < s) || q.end.is_some_and(|end| e.event_time >= end)
        {
            continue;
        }
        // Weekly boundaries are Monday in the selected zone; no price interpolation across empty buckets.
        let anchor = if seconds == 604800 { 345600 } else { 0 };
        let bucket = (e.event_time.timestamp() + offset - anchor).div_euclid(seconds) * seconds
            + anchor
            - offset;
        let p = e.price.unwrap().value();
        let v = e.volume.unwrap().value();
        if let Some(bar) = bars.get_mut(&bucket) {
            let high = Decimal::from_str_exact(bar["h"].as_str().unwrap()).unwrap();
            let low = Decimal::from_str_exact(bar["l"].as_str().unwrap()).unwrap();
            let volume = Decimal::from_str_exact(bar["v"].as_str().unwrap())
                .unwrap()
                .checked_add(v)
                .ok_or_else(Fault::invalid)?;
            bar["h"] = json!(high.max(p).to_string());
            bar["l"] = json!(low.min(p).to_string());
            bar["c"] = json!(p.to_string());
            bar["v"] = json!(volume.to_string());
        } else {
            bars.insert(bucket,json!({"t":DateTime::from_timestamp(bucket,0).ok_or_else(Fault::invalid)?,"o":p.to_string(),"h":p.to_string(),"l":p.to_string(),"c":p.to_string(),"v":v.to_string()}));
        }
    }
    if bars.len() > 500 {
        return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "NARROW_QUERY"));
    }
    let keys = bars.keys().copied().collect::<Vec<_>>();
    let mut gaps=keys.windows(2).filter(|w|w[1]-w[0]>seconds).map(|w|json!({"start":DateTime::from_timestamp(w[0]+seconds,0).unwrap(),"end":DateTime::from_timestamp(w[1],0).unwrap()})).collect::<Vec<_>>();
    if let (Some(start), Some(end)) = (q.start, q.end) {
        if keys.is_empty() {
            gaps.push(json!({"start":start,"end":end}));
        } else {
            let first = DateTime::from_timestamp(keys[0], 0).unwrap();
            let last_end = DateTime::from_timestamp(keys[keys.len() - 1] + seconds, 0).unwrap();
            if start < first {
                gaps.insert(0, json!({"start":start,"end":first}));
            }
            if last_end < end {
                gaps.push(json!({"start":last_end,"end":end}));
            }
        }
    }
    let last = events.last().unwrap();
    let mut provenance = provenance(i, last, now);
    if events
        .iter()
        .any(|e| e.quality == MarketDataQuality::Degraded)
    {
        provenance["quality"] = json!("degraded");
    }
    Ok(
        json!({"instrumentId":i.id(),"canonicalSymbol":i.canonical_symbol,"venue":i.venue,"productType":i.product_type,"interval":q.interval.as_deref().unwrap_or("1m"),"timezone":q.timezone.as_deref().unwrap_or("UTC"),"ohlcv":bars.values().collect::<Vec<_>>(),"gaps":gaps,"eventMarkers":gaps.iter().map(|g|json!({"kind":"data_gap","at":g["start"]})).collect::<Vec<_>>(),"provenance":provenance,"sequence":events.iter().map(|e|e.sequence).max().unwrap(),"replaceSeries":true,"aggregation":"trade_events"}),
    )
}
pub(crate) fn replay(
    scope: &str,
    kind: &str,
    i: &Instrument,
    events: &[MarketEvent],
    q: &MarketQuery,
    now: DateTime<Utc>,
) -> Result<Vec<Value>> {
    let events = validate_events(i, events, now)?;
    let first = events.iter().map(|e| e.sequence).min().unwrap();
    let latest = events.iter().map(|e| e.sequence).max().unwrap();
    let after = q.after_sequence.unwrap_or(0);
    let binding = q.binding(scope, kind, i);
    if (after > 0 && q.stream_id.as_deref() != Some(&binding))
        || after > latest
        || after > 0 && after < first - 1
    {
        return Err(Fault(StatusCode::CONFLICT, "STREAM_RESET_REQUIRED"));
    }
    if after == latest {
        return Ok(vec![]);
    }
    let payload = if kind == "quote" {
        quote(i, &events, now)?
    } else {
        candles(i, &events, q, now)?
    };
    Ok(vec![
        json!({"streamId":binding,"sequence":latest,"eventId":Uuid::new_v4(),"occurredAt":now,"correlationId":Uuid::new_v4(),"payloadVersion":"v1","eventType":format!("market.{kind}.replace"),"payload":payload}),
    ])
}
#[derive(Debug)]
pub(crate) struct Fixture {
    pub catalog: Vec<Instrument>,
    pub events: BTreeMap<String, Vec<MarketEvent>>,
    pub books: BTreeMap<String, quantos_market::book::MarketBookEvent>,
    pub watches: Watchlists,
    pub quota: crate::research::Quota,
}
impl Default for Fixture {
    fn default() -> Self {
        use quantos_core::{CorrelationId, TenantId};
        use quantos_market::{MarketIngestor, RawMarketTick};
        let mut ingestor = MarketIngestor::new(quantos_market::default_approved_providers());
        let now = Utc::now();
        let tenant = TenantId::new();
        let mut catalog = vec![];
        let mut events = BTreeMap::new();
        let mut books = BTreeMap::new();
        for venue in ["binance", "coinbase"] {
            for symbol in ["BTC/USDT", "ETH/USDT"] {
                let i = Instrument {
                    canonical_symbol: symbol.into(),
                    venue: venue.into(),
                    product_type: "spot".into(),
                    provider: format!("approved.{venue}.spot"),
                    snapshot_id: Uuid::new_v4(),
                    lot_size: "0.0001".into(),
                    min_notional: "10".into(),
                };
                let mut rows = vec![];
                for n in 0..5 {
                    let at = now - Duration::seconds([300, 240, 180, 60, 0][n as usize]);
                    let tick = RawMarketTick {
                        provider: i.provider.clone(),
                        source_tick_id: format!("{symbol}:{n}"),
                        provider_symbol: symbol.into(),
                        event_time: at,
                        received_at: at,
                        price: format!("{}", 100 + n + if venue == "coinbase" { 20 } else { 0 }),
                        volume: "0.1".into(),
                    };
                    rows.extend(
                        ingestor
                            .ingest_tick_at(tenant, CorrelationId::new(), tick, at)
                            .unwrap()
                            .market_events,
                    );
                }
                let raw = quantos_market::book::RawMarketBook {
                    provider: i.provider.clone(),
                    provider_symbol: symbol.into(),
                    source_tick_id: format!("{symbol}:book"),
                    event_time: now,
                    received_at: now,
                    bid: if venue == "coinbase" {
                        "123.90"
                    } else {
                        "103.90"
                    }
                    .into(),
                    ask: if venue == "coinbase" {
                        "124.10"
                    } else {
                        "104.10"
                    }
                    .into(),
                };
                books.insert(
                    i.id(),
                    quantos_market::book::normalize_book(
                        &quantos_market::default_approved_providers(),
                        raw,
                        6,
                        now,
                    )
                    .unwrap(),
                );
                events.insert(i.id(), rows);
                catalog.push(i);
            }
        }
        Self {
            catalog,
            events,
            books,
            watches: Watchlists::default(),
            quota: crate::research::Quota::default(),
        }
    }
}
pub(crate) fn reference_routes() -> Router<Arc<Mutex<crate::ProviderData>>> {
    Router::new()
        .route("/v1/markets/catalog", get(reference))
        .route("/v1/markets/watchlist", get(reference).put(reference))
        .route("/v1/markets/quotes", get(reference))
        .route("/v1/markets/candles", get(reference))
        .route("/v1/markets/quotes/stream", get(reference))
        .route("/v1/markets/candles/stream", get(reference))
}
async fn reference(
    State(state): State<Arc<Mutex<crate::ProviderData>>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    query: std::result::Result<Query<MarketQuery>, axum::extract::rejection::QueryRejection>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(e) = crate::authenticate(&headers, &state).await {
        return e;
    }
    if crate::cookies(&headers).get("quantos_session") != Some(&crate::CURRENT_SESSION) {
        return Fault(StatusCode::FORBIDDEN, "FORBIDDEN").response();
    }
    let q = match query {
        Ok(Query(q)) => q,
        Err(_) => return Fault::invalid().response(),
    };
    let mut state = state.lock().await;
    let now = state.now();
    let m = &mut state.market;
    let result = (|| {
        q.validate()?;
        if let Some(last) = headers.get("last-event-id")
            && last.to_str().ok().and_then(|s| s.parse::<u64>().ok()) != q.after_sequence
        {
            return Err(Fault::invalid());
        }
        m.quota.take("reference-current", uri.path(), now)?;
        let selected = m
            .catalog
            .iter()
            .filter(|i| q.selected(i))
            .cloned()
            .collect::<Vec<_>>();
        if uri.path().ends_with("catalog") {
            return Ok(Output::Json(
                StatusCode::OK,
                json!({"items":selected.iter().map(Instrument::view).collect::<Vec<_>>(),"asOf":now}),
            ));
        }
        if uri.path().ends_with("watchlist") {
            let current = m
                .watches
                .records
                .get("reference-current")
                .cloned()
                .unwrap_or_else(empty_watchlist);
            if method == Method::PUT {
                let result = save_watchlist(
                    &mut m.watches,
                    "reference-current",
                    crate::research::uuid(
                        headers
                            .get("idempotency-key")
                            .and_then(|v| v.to_str().ok())
                            .ok_or_else(Fault::invalid)?,
                    )?,
                    headers
                        .get("if-match")
                        .and_then(|v| v.to_str().ok())
                        .ok_or_else(Fault::invalid)?,
                    serde_json::from_slice(&body).map_err(|_| Fault::invalid())?,
                    &m.catalog,
                );
                return watch_output(result, &current);
            }
            return Ok(Output::Json(StatusCode::OK, current));
        }

        if selected.is_empty() {
            return Err(Fault::hidden());
        }
        if uri.path().ends_with("/stream") || uri.path().ends_with("candles") {
            if selected.len() != 1 {
                return Err(Fault::invalid());
            }
            let i = &selected[0];
            let rows = &m.events[&i.id()];
            if uri.path().ends_with("/stream") {
                if uri.path().contains("quotes")
                    && let Some(book) = m.books.get(&i.id())
                {
                    return Ok(Output::Events(book_replay(
                        "reference-current",
                        i,
                        book,
                        rows,
                        &q,
                        now,
                    )?));
                }

                return Ok(Output::Events(replay(
                    "reference-current",
                    if uri.path().contains("quotes") {
                        "quote"
                    } else {
                        "candle"
                    },
                    i,
                    rows,
                    &q,
                    now,
                )?));
            }
            return Ok(Output::Json(StatusCode::OK, candles(i, rows, &q, now)?));
        }
        Ok(Output::Json(
            StatusCode::OK,
            json!({"items":selected.iter().map(|i|if let Some(book)=m.books.get(&i.id()){book_quote(i,book,&m.events[&i.id()],now)}else{quote(i,&m.events[&i.id()],now)}).collect::<Result<Vec<_>>>()?}),
        ))
    })();
    match result {
        Ok(Output::Json(status, payload)) if method == Method::PUT && status == StatusCode::OK => {
            // The provider lock binds the successful command and its single audit fact.
            let id = &payload["auditRef"];
            if !state.audits.iter().any(|e| &e["eventId"] == id) {
                let redacted =
                    crate::audit_core::redacted(&json!({"status":"saved","outcome":"succeeded"}));
                let fact = json!({"auditRef":id,"eventId":id,"correlationId":payload["correlationId"],"causationId":id,
                    "sequence":state.audits.iter().filter(|e|e.get("eventId").is_some()).count()+1,
                    "kind":"market.watchlist.save","actor":"reference-current","objectRef":"market:watchlist:reference-current",
                    "occurredAt":now,"redactionApplied":true,"redactedPayload":redacted,
                    "payloadHash":crate::audit_core::payload_hash(&redacted),"route":"/markets",
                    "retentionUntil":now+Duration::days(365)});
                state.audits.push(fact);
            }
            Output::Json(status, payload).response()
        }
        Ok(v) => v.response(),
        Err(e) => e.response(),
    }
}
#[cfg(test)]
#[path = "market_tests.rs"]
mod tests;
