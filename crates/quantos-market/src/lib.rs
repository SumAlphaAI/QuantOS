use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{
    ActorId, ContentHash, CoreError, CorrelationId, Quantity, SchemaVersion, TenantId,
    canonical_json_bytes,
};
use quantos_event::{AppendOnlyLedger, EventError, NewRecordedEvent, RecordedEvent};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::BTreeMap,
    io::{BufRead, Read, Write},
};
use thiserror::Error;

pub mod durable;
pub const MAX_REPLAY_TICKS: usize = 100_000;
pub const MAX_LINE_BYTES: usize = 16_384;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApprovedProvider {
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
    pub approval_reference: String,
    pub approval_version: String,
    pub expires_at: DateTime<Utc>,
    pub enabled: bool,
    pub instruments: BTreeMap<String, String>,
    pub freshness_sla_secs: i64,
    pub max_future_skew_secs: i64,
}
#[derive(Debug, Clone)]
pub struct ApprovedProviderRegistry {
    providers: BTreeMap<String, ApprovedProvider>,
}
impl ApprovedProviderRegistry {
    pub fn new(providers: impl IntoIterator<Item = ApprovedProvider>) -> Result<Self, MarketError> {
        let mut entries = BTreeMap::new();
        for p in providers {
            if [
                &p.provider,
                &p.dataset,
                &p.license_label,
                &p.approval_reference,
                &p.approval_version,
            ]
            .iter()
            .any(|s| s.trim().is_empty() || s.len() > 256)
                || !(1..=3600).contains(&p.freshness_sla_secs)
                || !(0..=60).contains(&p.max_future_skew_secs)
                || p.instruments.is_empty()
            {
                return Err(MarketError::Configuration);
            }
            for (alias, canonical) in &p.instruments {
                let parts = alias.split(['/', '-', '_']).collect::<Vec<_>>();
                if alias.is_empty()
                    || alias.len() > 49
                    || parts.len() > 2
                    || parts.iter().any(|part| {
                        part.is_empty() || !part.chars().all(|c| c.is_ascii_alphanumeric())
                    })
                    || alias != &alias.to_ascii_uppercase()
                    || normalize_symbol(canonical)? != *canonical
                {
                    return Err(MarketError::Configuration);
                }
            }
            if entries.insert(p.provider.clone(), p).is_some() {
                return Err(MarketError::Configuration);
            }
        }
        if entries.is_empty() {
            return Err(MarketError::Configuration);
        }
        Ok(Self { providers: entries })
    }
    pub fn approved_provider(&self, provider: &str) -> Result<&ApprovedProvider, MarketError> {
        self.providers
            .get(provider)
            .filter(|p| p.enabled && p.expires_at > Utc::now())
            .ok_or_else(|| MarketError::provider_not_approved(provider))
    }
    pub fn require_live(&self) -> Result<(), MarketError> {
        if self
            .providers
            .values()
            .any(|p| p.approval_reference.starts_with("fixture:"))
        {
            return Err(MarketError::Configuration);
        }
        Ok(())
    }
}
#[must_use]
pub fn default_approved_providers() -> ApprovedProviderRegistry {
    ApprovedProviderRegistry::new(
        ["approved.binance.spot", "approved.coinbase.spot"].map(|name| ApprovedProvider {
            provider: name.into(),
            dataset: "crypto.top_of_book.v2".into(),
            license_label: "fixture-only".into(),
            approval_reference: "fixture:r01-replay-only".into(),
            approval_version: "v2".into(),
            expires_at: DateTime::parse_from_rfc3339("2099-01-01T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            enabled: true,
            instruments: ["BTC", "ETH", "SOL", "BNB"]
                .into_iter()
                .flat_map(|base| {
                    ["", "/", "-", "_"].into_iter().map(move |separator| {
                        (format!("{base}{separator}USDT"), format!("{base}/USDT"))
                    })
                })
                .collect(),
            freshness_sla_secs: 2,
            max_future_skew_secs: 2,
        }),
    )
    .expect("validated static replay approvals")
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawMarketTick {
    pub provider: String,
    pub source_tick_id: String,
    pub provider_symbol: String,
    pub event_time: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub price: String,
    pub volume: String,
}
impl RawMarketTick {
    pub fn source_hash(&self) -> Result<ContentHash, MarketError> {
        // Delivery timestamps are deliberately excluded: retransmission is the same source fact.
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(
            &json!({"provider":self.provider,"id":self.source_tick_id,"symbol":self.provider_symbol,"event_time":self.event_time,"price":self.price,"volume":self.volume}),
        )?))
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarketReplaySpec {
    pub dataset_name: String,
    pub provider: String,
    pub symbols: Vec<String>,
    pub base_time: DateTime<Utc>,
    pub count: usize,
    pub duplicate_every: usize,
    pub out_of_order_every: usize,
    pub stale_every: usize,
    pub quality_fail_every: usize,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketDataQuality {
    Passed,
    Degraded,
    Failed,
}
impl MarketDataQuality {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Passed => "passed",
            Self::Degraded => "degraded",
            Self::Failed => "failed",
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketEventKind {
    TickRecorded,
    FreshnessDegraded,
    QualityFailed,
}
impl MarketEventKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::TickRecorded => "market.tick.recorded",
            Self::FreshnessDegraded => "market.tick.freshness_degraded",
            Self::QualityFailed => "market.tick.quality_failed",
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarketEvent {
    pub normalized_symbol: String,
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
    pub source_tick_id: String,
    pub provider_symbol: String,
    pub event_time: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub price: Option<Quantity>,
    pub volume: Option<Quantity>,
    pub raw_price: String,
    pub raw_volume: String,
    pub quality: MarketDataQuality,
    pub event_kind: MarketEventKind,
    pub anomaly_reason: Option<String>,
    pub sequence: u64,
    pub detected_at: DateTime<Utc>,
    pub approval_reference: String,
    pub approval_version: String,
}
impl MarketEvent {
    pub fn to_recorded_event(
        &self,
        tenant_id: TenantId,
        actor_id: ActorId,
        correlation_id: CorrelationId,
        occurred_at: DateTime<Utc>,
    ) -> Result<RecordedEvent, MarketError> {
        Ok(RecordedEvent::new(NewRecordedEvent {
            tenant_id,
            actor_id,
            correlation_id,
            causation_id: None,
            aggregate_type: "market".into(),
            aggregate_id: format!("{}:{}", self.provider, self.normalized_symbol),
            sequence: self.sequence,
            event_kind: self.event_kind.as_str().into(),
            schema_version: SchemaVersion::parse("v2")?,
            occurred_at,
            payload: {
                let mut value = serde_json::to_value(self)?;
                value.as_object_mut().unwrap().remove("sequence");
                value
            },
        })?)
    }
}
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct ReplayIngestionSummary {
    pub input_ticks: usize,
    pub unique_ticks: usize,
    pub duplicate_ticks: usize,
    pub market_events: usize,
    pub anomaly_events: usize,
    pub recorded_events: usize,
}
#[derive(Debug, Clone, PartialEq)]
pub struct MarketIngestionOutcome {
    pub duplicate: bool,
    pub market_events: Vec<MarketEvent>,
    pub recorded_events: Vec<RecordedEvent>,
}
#[derive(Debug, Clone)]
pub struct MarketIngestor {
    approvals: ApprovedProviderRegistry,
    actor_id: ActorId,
    seen_tick_ids: BTreeMap<(TenantId, String, String), ContentHash>,
    next_sequence: BTreeMap<(TenantId, String), u64>,
}
impl MarketIngestor {
    #[must_use]
    pub fn new(approvals: ApprovedProviderRegistry) -> Self {
        Self::with_actor(approvals, ActorId::new())
    }
    #[must_use]
    pub fn with_actor(approvals: ApprovedProviderRegistry, actor_id: ActorId) -> Self {
        Self {
            approvals,
            actor_id,
            seen_tick_ids: BTreeMap::new(),
            next_sequence: BTreeMap::new(),
        }
    }
    // Replay uses supplied receive time; live callers must call ingest_tick_at with a processing clock.
    pub fn ingest_tick(
        &mut self,
        tenant_id: TenantId,
        correlation_id: CorrelationId,
        tick: RawMarketTick,
    ) -> Result<MarketIngestionOutcome, MarketError> {
        let observed_at = tick.received_at;
        self.ingest_tick_at(tenant_id, correlation_id, tick, observed_at)
    }
    pub fn ingest_tick_at(
        &mut self,
        tenant_id: TenantId,
        correlation_id: CorrelationId,
        tick: RawMarketTick,
        observed_at: DateTime<Utc>,
    ) -> Result<MarketIngestionOutcome, MarketError> {
        if tick.source_tick_id.trim().is_empty()
            || tick.source_tick_id.len() > 256
            || tick.source_tick_id.starts_with("watchdog:")
            || tick.source_tick_id.starts_with("rejected:")
            || tick.price.len() > 128
            || tick.volume.len() > 128
        {
            return Err(MarketError::InvalidIdentity);
        }
        let provider = self.approvals.approved_provider(&tick.provider)?.clone();
        let normalized_symbol = provider
            .instruments
            .get(&tick.provider_symbol.trim().to_ascii_uppercase())
            .cloned()
            .ok_or_else(|| MarketError::InvalidSymbol {
                symbol: tick.provider_symbol.clone(),
            })?;
        let key = (
            tenant_id,
            tick.provider.clone(),
            tick.source_tick_id.clone(),
        );
        let hash = tick.source_hash()?;
        if let Some(prior) = self.seen_tick_ids.get(&key) {
            if prior != &hash {
                return Err(MarketError::SourceConflict);
            }
            return Ok(MarketIngestionOutcome {
                duplicate: true,
                market_events: vec![],
                recorded_events: vec![],
            });
        }
        if self.seen_tick_ids.len() >= MAX_REPLAY_TICKS {
            return Err(MarketError::ResourceLimit);
        }
        let price = Quantity::parse_str(&tick.price).ok();
        let volume = Quantity::parse_str(&tick.volume).ok();
        let invalid = price.is_none_or(|p| p.value() <= rust_decimal::Decimal::ZERO)
            || volume.is_none_or(|v| v.value() <= rust_decimal::Decimal::ZERO);
        let future = tick.event_time - observed_at
            > ChronoDuration::seconds(provider.max_future_skew_secs)
            || tick.received_at - observed_at
                > ChronoDuration::seconds(provider.max_future_skew_secs)
            || tick.event_time - tick.received_at
                > ChronoDuration::seconds(provider.max_future_skew_secs);
        let stale =
            observed_at - tick.event_time > ChronoDuration::seconds(provider.freshness_sla_secs);
        let quality = if invalid || future {
            MarketDataQuality::Failed
        } else if stale {
            MarketDataQuality::Degraded
        } else {
            MarketDataQuality::Passed
        };
        let mut events = vec![MarketEvent {
            normalized_symbol: normalized_symbol.clone(),
            provider: provider.provider.clone(),
            dataset: provider.dataset.clone(),
            license_label: provider.license_label.clone(),
            source_tick_id: tick.source_tick_id.clone(),
            provider_symbol: tick.provider_symbol,
            event_time: tick.event_time,
            received_at: tick.received_at,
            price,
            volume,
            raw_price: tick.price,
            raw_volume: tick.volume,
            quality,
            event_kind: MarketEventKind::TickRecorded,
            anomaly_reason: None,
            sequence: 0,
            detected_at: observed_at,
            approval_reference: provider.approval_reference,
            approval_version: provider.approval_version,
        }];
        if stale {
            let mut e = events[0].clone();
            e.event_kind = MarketEventKind::FreshnessDegraded;
            e.anomaly_reason = Some("freshness_sla_breached".into());
            events.push(e);
        }
        if invalid || future {
            let mut e = events[0].clone();
            e.event_kind = MarketEventKind::QualityFailed;
            e.anomaly_reason = Some(
                if future {
                    "future_skew_breached"
                } else {
                    "invalid_or_non_positive_price_or_volume"
                }
                .into(),
            );
            events.push(e);
        }
        let stream = (
            tenant_id,
            format!("{}:{}", tick.provider, normalized_symbol),
        );
        let mut seq = self.next_sequence.get(&stream).copied().unwrap_or(0);
        for e in &mut events {
            seq += 1;
            e.sequence = seq;
        }
        let root =
            events[0].to_recorded_event(tenant_id, self.actor_id, correlation_id, observed_at)?;
        let root_id = root.event_id;
        let mut recorded_events = vec![root];
        for e in events.iter().skip(1) {
            let mut recorded =
                e.to_recorded_event(tenant_id, self.actor_id, correlation_id, observed_at)?;
            recorded.causation_id = root_id;
            recorded_events.push(recorded);
        }
        self.seen_tick_ids.insert(key, hash);
        self.next_sequence.insert(stream, seq);
        Ok(MarketIngestionOutcome {
            duplicate: false,
            market_events: events,
            recorded_events,
        })
    }
    pub fn ingest_batch(
        &mut self,
        tenant_id: TenantId,
        correlation_id: CorrelationId,
        ticks: impl IntoIterator<Item = RawMarketTick>,
        ledger: &mut AppendOnlyLedger,
    ) -> Result<ReplayIngestionSummary, MarketError> {
        // A replay batch stages both ledger and in-memory identities; publish neither on failure.
        let mut staged = self.clone();
        let mut staged_ledger = ledger.clone();
        let mut summary = ReplayIngestionSummary::default();
        for tick in ticks {
            if summary.input_ticks >= MAX_REPLAY_TICKS {
                return Err(MarketError::ResourceLimit);
            }
            summary.input_ticks += 1;
            let outcome = staged.ingest_tick(tenant_id, correlation_id, tick)?;
            if outcome.duplicate {
                summary.duplicate_ticks += 1;
                continue;
            }
            summary.unique_ticks += 1;
            summary.market_events += outcome.market_events.len();
            summary.anomaly_events += outcome
                .market_events
                .iter()
                .filter(|e| e.event_kind != MarketEventKind::TickRecorded)
                .count();
            summary.recorded_events += outcome.recorded_events.len();
            for e in outcome.recorded_events {
                staged_ledger.append(e)?;
            }
        }
        *self = staged;
        *ledger = staged_ledger;
        Ok(summary)
    }
}
#[derive(Debug, Error)]
pub enum MarketError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Event(#[from] EventError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("MARKET_PROVIDER_NOT_APPROVED")]
    ProviderNotApproved { provider: String },
    #[error("MARKET_INVALID_SYMBOL")]
    InvalidSymbol { symbol: String },
    #[error("MARKET_INVALID_PRICE")]
    InvalidPrice {
        source_tick_id: String,
        price: String,
    },
    #[error("MARKET_INVALID_VOLUME")]
    InvalidVolume {
        source_tick_id: String,
        volume: String,
    },
    #[error("MARKET_INVALID_IDENTITY")]
    InvalidIdentity,
    #[error("MARKET_SOURCE_CONFLICT")]
    SourceConflict,
    #[error("MARKET_CONFIGURATION")]
    Configuration,
    #[error("MARKET_RESOURCE_LIMIT")]
    ResourceLimit,
}
impl MarketError {
    pub fn machine_code(&self) -> &'static str {
        match self {
            Self::Core(e) => e.machine_code(),
            Self::Event(e) => e.machine_code(),
            Self::Io(_) => "MARKET_IO",
            Self::Json(_) => "MARKET_JSON",
            Self::ProviderNotApproved { .. } => "MARKET_PROVIDER_NOT_APPROVED",
            Self::InvalidSymbol { .. } => "MARKET_INVALID_SYMBOL",
            Self::InvalidPrice { .. } => "MARKET_INVALID_PRICE",
            Self::InvalidVolume { .. } => "MARKET_INVALID_VOLUME",
            Self::InvalidIdentity => "MARKET_INVALID_IDENTITY",
            Self::SourceConflict => "MARKET_SOURCE_CONFLICT",
            Self::Configuration => "MARKET_CONFIGURATION",
            Self::ResourceLimit => "MARKET_RESOURCE_LIMIT",
        }
    }
    pub fn provider_not_approved(provider: &str) -> Self {
        Self::ProviderNotApproved {
            provider: provider.into(),
        }
    }
}
pub fn normalize_symbol(raw: &str) -> Result<String, MarketError> {
    let upper = raw.trim().to_ascii_uppercase();
    let parts = upper.split(['/', '-', '_']).collect::<Vec<_>>();
    if parts.len() != 2
        || parts
            .iter()
            .any(|p| p.is_empty() || p.len() > 24 || !p.chars().all(|c| c.is_ascii_alphanumeric()))
    {
        return Err(MarketError::InvalidSymbol { symbol: raw.into() });
    }
    Ok(format!("{}/{}", parts[0], parts[1]))
}
pub fn default_replay_spec() -> Result<MarketReplaySpec, MarketError> {
    Ok(serde_json::from_str(include_str!(
        "../fixtures/market_replay_catalog.json"
    ))?)
}

pub fn generate_replay_dataset(spec: &MarketReplaySpec) -> Result<Vec<RawMarketTick>, MarketError> {
    if spec.count == 0
        || spec.count > MAX_REPLAY_TICKS
        || spec.symbols.is_empty()
        || spec.symbols.len() > 1024
        || spec
            .symbols
            .iter()
            .any(|s| !matches!(s.as_str(), "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "BNBUSDT"))
        || spec
            .base_time
            .checked_add_signed(ChronoDuration::milliseconds(spec.count as i64 * 100))
            .is_none()
    {
        return Err(MarketError::Configuration);
    }
    let mut ticks = (0..spec.count)
        .map(|index| {
            let symbol = &spec.symbols[index % spec.symbols.len()];
            let provider_symbol = match index % 3 {
                0 => symbol.replace("USDT", "/USDT"),
                1 => symbol.replace("USDT", "-USDT"),
                _ => symbol.replace("USDT", "_USDT"),
            };
            let event_time = spec.base_time + ChronoDuration::milliseconds(index as i64 * 100);
            let stale = spec.stale_every > 0 && index > 0 && index % spec.stale_every == 0;
            let quality_fail =
                spec.quality_fail_every > 0 && index > 0 && index % spec.quality_fail_every == 0;

            RawMarketTick {
                provider: spec.provider.clone(),
                source_tick_id: format!("{}-{index:06}", symbol),
                provider_symbol,
                event_time,
                received_at: if stale {
                    event_time + ChronoDuration::seconds(6)
                } else {
                    event_time + ChronoDuration::milliseconds(500)
                },
                price: if quality_fail {
                    "0".to_owned()
                } else {
                    format!("{}.{:04}", 100 + (index % 10), index % 10_000)
                },
                volume: if quality_fail {
                    "0".to_owned()
                } else {
                    format!("{}.{:03}", 1 + (index % 5), index % 1_000)
                },
            }
        })
        .collect::<Vec<_>>();

    if spec.duplicate_every > 0 {
        for index in (spec.duplicate_every..spec.count).step_by(spec.duplicate_every) {
            ticks[index] = ticks[index - 1].clone();
        }
    }

    if spec.out_of_order_every > 1 {
        for index in (spec.out_of_order_every..spec.count).step_by(spec.out_of_order_every) {
            ticks.swap(index - 1, index);
        }
    }

    Ok(ticks)
}

pub fn write_ticks_jsonl(
    writer: &mut impl Write,
    ticks: impl IntoIterator<Item = RawMarketTick>,
) -> Result<(), MarketError> {
    for tick in ticks {
        serde_json::to_writer(&mut *writer, &tick)?;
        writer.write_all(b"\n")?;
    }
    Ok(())
}

pub fn read_ticks_jsonl(reader: impl BufRead) -> Result<Vec<RawMarketTick>, MarketError> {
    TickReader::new(reader).collect()
}
/// A bounded, streaming JSONL parser. No read_line allocation may exceed the limit.
pub struct TickReader<R> {
    reader: R,
    line: Vec<u8>,
    count: usize,
    done: bool,
}
impl<R: BufRead> TickReader<R> {
    pub fn new(reader: R) -> Self {
        Self {
            reader,
            line: Vec::new(),
            count: 0,
            done: false,
        }
    }
}
impl<R: BufRead> Iterator for TickReader<R> {
    type Item = Result<RawMarketTick, MarketError>;
    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }
        loop {
            self.line.clear();
            match (&mut self.reader)
                .take((MAX_LINE_BYTES + 1) as u64)
                .read_until(b'\n', &mut self.line)
            {
                Err(e) => {
                    self.done = true;
                    return Some(Err(e.into()));
                }
                Ok(0) => {
                    self.done = true;
                    return None;
                }
                Ok(n) if n > MAX_LINE_BYTES => {
                    self.done = true;
                    return Some(Err(MarketError::ResourceLimit));
                }
                Ok(_) => {}
            }
            self.count += 1;
            if self.count > MAX_REPLAY_TICKS {
                self.done = true;
                return Some(Err(MarketError::ResourceLimit));
            }
            if self.line.iter().all(u8::is_ascii_whitespace) {
                continue;
            }
            return Some(serde_json::from_slice(&self.line).map_err(MarketError::from));
        }
    }
}

#[cfg(test)]
mod tests;
