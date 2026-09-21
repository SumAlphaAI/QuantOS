use std::{
    collections::{BTreeMap, BTreeSet},
    io::{BufRead, Write},
};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{ActorId, CoreError, CorrelationId, Quantity, SchemaVersion, TenantId};
use quantos_event::{AppendOnlyLedger, EventError, NewRecordedEvent, RecordedEvent};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApprovedProvider {
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
    pub freshness_sla_secs: i64,
    pub max_future_skew_secs: i64,
}

#[derive(Debug, Clone, Default)]
pub struct ApprovedProviderRegistry {
    providers: BTreeMap<String, ApprovedProvider>,
}

impl ApprovedProviderRegistry {
    #[must_use]
    pub fn new(providers: impl IntoIterator<Item = ApprovedProvider>) -> Self {
        let providers = providers
            .into_iter()
            .map(|provider| (provider.provider.clone(), provider))
            .collect();
        Self { providers }
    }

    pub fn approved_provider(&self, provider: &str) -> Result<&ApprovedProvider, MarketError> {
        self.providers
            .get(provider)
            .ok_or_else(|| MarketError::provider_not_approved(provider))
    }
}

#[must_use]
pub fn default_approved_providers() -> ApprovedProviderRegistry {
    ApprovedProviderRegistry::new([
        ApprovedProvider {
            provider: "approved.binance.spot".to_owned(),
            dataset: "crypto.top_of_book.v1".to_owned(),
            license_label: "internal-approved".to_owned(),
            freshness_sla_secs: 2,
            max_future_skew_secs: 2,
        },
        ApprovedProvider {
            provider: "approved.coinbase.spot".to_owned(),
            dataset: "crypto.top_of_book.v1".to_owned(),
            license_label: "internal-approved".to_owned(),
            freshness_sla_secs: 2,
            max_future_skew_secs: 2,
        },
    ])
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RawMarketTick {
    pub provider: String,
    pub source_tick_id: String,
    pub provider_symbol: String,
    pub event_time: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub price: String,
    pub volume: String,
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
    #[must_use]
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
    #[must_use]
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
    pub price: Quantity,
    pub volume: Quantity,
    pub quality: MarketDataQuality,
    pub event_kind: MarketEventKind,
    pub anomaly_reason: Option<String>,
    pub sequence: u64,
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
            aggregate_type: "market".to_owned(),
            aggregate_id: self.normalized_symbol.clone(),
            sequence: self.sequence,
            event_kind: self.event_kind.as_str().to_owned(),
            schema_version: SchemaVersion::parse("v1")
                .expect("static market event schema version should parse"),
            occurred_at,
            payload: json!({
                "symbol": self.normalized_symbol,
                "provider": self.provider,
                "dataset": self.dataset,
                "license_label": self.license_label,
                "source_tick_id": self.source_tick_id,
                "provider_symbol": self.provider_symbol,
                "event_time": self.event_time.to_rfc3339(),
                "received_at": self.received_at.to_rfc3339(),
                "price": self.price.value().to_string(),
                "volume": self.volume.value().to_string(),
                "quality": self.quality.as_str(),
                "anomaly_reason": self.anomaly_reason,
            }),
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
    seen_tick_ids: BTreeSet<(String, String)>,
    next_sequence: BTreeMap<(TenantId, String), u64>,
}

impl MarketIngestor {
    #[must_use]
    pub fn new(approvals: ApprovedProviderRegistry) -> Self {
        Self {
            approvals,
            actor_id: ActorId::new(),
            seen_tick_ids: BTreeSet::new(),
            next_sequence: BTreeMap::new(),
        }
    }

    pub fn ingest_tick(
        &mut self,
        tenant_id: TenantId,
        correlation_id: CorrelationId,
        tick: RawMarketTick,
    ) -> Result<MarketIngestionOutcome, MarketError> {
        let provider = self.approvals.approved_provider(&tick.provider)?.clone();
        let normalized_symbol = normalize_symbol(&tick.provider_symbol)?;
        let deduplication_key = (tick.provider.clone(), tick.source_tick_id.clone());
        if self.seen_tick_ids.contains(&deduplication_key) {
            return Ok(MarketIngestionOutcome {
                duplicate: true,
                market_events: Vec::new(),
                recorded_events: Vec::new(),
            });
        }

        let price = Quantity::parse_str(&tick.price)
            .map_err(|_| MarketError::invalid_price(&tick.source_tick_id, &tick.price))?;
        let volume = Quantity::parse_str(&tick.volume)
            .map_err(|_| MarketError::invalid_volume(&tick.source_tick_id, &tick.volume))?;

        let freshness_breached = tick.received_at - tick.event_time
            > ChronoDuration::seconds(provider.freshness_sla_secs);
        let future_skew_breached = tick.event_time - tick.received_at
            > ChronoDuration::seconds(provider.max_future_skew_secs);
        let quality_failed = price.value() <= Decimal::ZERO
            || volume.value() <= Decimal::ZERO
            || future_skew_breached;
        let tick_quality = if quality_failed {
            MarketDataQuality::Failed
        } else if freshness_breached {
            MarketDataQuality::Degraded
        } else {
            MarketDataQuality::Passed
        };

        // A malformed tick must not poison the deduplication key. Only validated ticks become
        // durable members of the provider/source-id set.
        self.seen_tick_ids.insert(deduplication_key);

        let mut market_events = Vec::new();
        market_events.push(MarketEvent {
            normalized_symbol: normalized_symbol.clone(),
            provider: provider.provider.clone(),
            dataset: provider.dataset.clone(),
            license_label: provider.license_label.clone(),
            source_tick_id: tick.source_tick_id.clone(),
            provider_symbol: tick.provider_symbol.clone(),
            event_time: tick.event_time,
            received_at: tick.received_at,
            price,
            volume,
            quality: tick_quality,
            event_kind: MarketEventKind::TickRecorded,
            anomaly_reason: None,
            sequence: self.next_sequence(tenant_id, &normalized_symbol),
        });

        if freshness_breached {
            market_events.push(MarketEvent {
                normalized_symbol: normalized_symbol.clone(),
                provider: provider.provider.clone(),
                dataset: provider.dataset.clone(),
                license_label: provider.license_label.clone(),
                source_tick_id: tick.source_tick_id.clone(),
                provider_symbol: tick.provider_symbol.clone(),
                event_time: tick.event_time,
                received_at: tick.received_at,
                price,
                volume,
                quality: MarketDataQuality::Degraded,
                event_kind: MarketEventKind::FreshnessDegraded,
                anomaly_reason: Some("freshness_sla_breached".to_owned()),
                sequence: self.next_sequence(tenant_id, &normalized_symbol),
            });
        }

        if quality_failed {
            let anomaly_reason = if future_skew_breached {
                "future_skew_breached"
            } else {
                "non_positive_price_or_volume"
            };
            market_events.push(MarketEvent {
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
                quality: MarketDataQuality::Failed,
                event_kind: MarketEventKind::QualityFailed,
                anomaly_reason: Some(anomaly_reason.to_owned()),
                sequence: self.next_sequence(tenant_id, &normalized_symbol),
            });
        }

        let recorded_events = market_events
            .iter()
            .map(|event| {
                event.to_recorded_event(tenant_id, self.actor_id, correlation_id, event.received_at)
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(MarketIngestionOutcome {
            duplicate: false,
            market_events,
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
        let mut summary = ReplayIngestionSummary::default();
        for tick in ticks {
            summary.input_ticks += 1;
            let outcome = self.ingest_tick(tenant_id, correlation_id, tick)?;
            if outcome.duplicate {
                summary.duplicate_ticks += 1;
                continue;
            }
            summary.unique_ticks += 1;
            summary.market_events += outcome.market_events.len();
            summary.anomaly_events += outcome
                .market_events
                .iter()
                .filter(|event| event.event_kind != MarketEventKind::TickRecorded)
                .count();
            summary.recorded_events += outcome.recorded_events.len();
            for event in outcome.recorded_events {
                ledger.append(event)?;
            }
        }
        Ok(summary)
    }

    fn next_sequence(&mut self, tenant_id: TenantId, symbol: &str) -> u64 {
        let key = (tenant_id, symbol.to_owned());
        let entry = self.next_sequence.entry(key).or_insert(0);
        *entry += 1;
        *entry
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
    #[error("MARKET_PROVIDER_NOT_APPROVED: provider `{provider}` is not approved")]
    ProviderNotApproved { provider: String },
    #[error("MARKET_INVALID_SYMBOL: provider symbol `{symbol}` cannot be normalized")]
    InvalidSymbol { symbol: String },
    #[error("MARKET_INVALID_PRICE: tick `{source_tick_id}` has invalid price `{price}`")]
    InvalidPrice {
        source_tick_id: String,
        price: String,
    },
    #[error("MARKET_INVALID_VOLUME: tick `{source_tick_id}` has invalid volume `{volume}`")]
    InvalidVolume {
        source_tick_id: String,
        volume: String,
    },
}

impl MarketError {
    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        match self {
            Self::Core(error) => error.machine_code(),
            Self::Event(error) => error.machine_code(),
            Self::Io(_) => "MARKET_IO",
            Self::Json(_) => "MARKET_JSON",
            Self::ProviderNotApproved { .. } => "MARKET_PROVIDER_NOT_APPROVED",
            Self::InvalidSymbol { .. } => "MARKET_INVALID_SYMBOL",
            Self::InvalidPrice { .. } => "MARKET_INVALID_PRICE",
            Self::InvalidVolume { .. } => "MARKET_INVALID_VOLUME",
        }
    }

    #[must_use]
    pub fn provider_not_approved(provider: &str) -> Self {
        Self::ProviderNotApproved {
            provider: provider.to_owned(),
        }
    }

    #[must_use]
    pub fn invalid_price(source_tick_id: &str, price: &str) -> Self {
        Self::InvalidPrice {
            source_tick_id: source_tick_id.to_owned(),
            price: price.to_owned(),
        }
    }

    #[must_use]
    pub fn invalid_volume(source_tick_id: &str, volume: &str) -> Self {
        Self::InvalidVolume {
            source_tick_id: source_tick_id.to_owned(),
            volume: volume.to_owned(),
        }
    }
}

pub fn normalize_symbol(provider_symbol: &str) -> Result<String, MarketError> {
    let raw = provider_symbol.trim();
    let valid = !raw.is_empty()
        && raw.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '/' | '-' | '_')
        });
    let parts = raw.split(['/', '-', '_']).collect::<Vec<_>>();
    if !valid
        || parts.iter().any(|part| part.is_empty())
        || parts.iter().any(|part| {
            !part
                .chars()
                .all(|character| character.is_ascii_alphanumeric())
        })
    {
        Err(MarketError::InvalidSymbol {
            symbol: provider_symbol.to_owned(),
        })
    } else {
        Ok(parts.concat().to_ascii_uppercase())
    }
}

pub fn default_replay_spec() -> Result<MarketReplaySpec, MarketError> {
    Ok(serde_json::from_str(include_str!(
        "../fixtures/market_replay_catalog.json"
    ))?)
}

#[must_use]
pub fn generate_replay_dataset(spec: &MarketReplaySpec) -> Vec<RawMarketTick> {
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

    ticks
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
    let mut ticks = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        ticks.push(serde_json::from_str::<RawMarketTick>(&line)?);
    }
    Ok(ticks)
}

#[cfg(test)]
mod tests {
    use std::{
        io::Cursor,
        time::{Duration, Instant},
    };

    use anyhow::Result;

    use super::*;

    #[test]
    fn replay_dataset_ingests_one_hundred_thousand_ticks_without_parse_failures() -> Result<()> {
        let spec = default_replay_spec()?;
        let ticks = generate_replay_dataset(&spec);
        let mut encoded = Vec::new();
        write_ticks_jsonl(&mut encoded, ticks.clone())?;
        let decoded = read_ticks_jsonl(Cursor::new(encoded))?;

        assert_eq!(decoded.len(), 100_000);

        let tenant_id = TenantId::new();
        let correlation_id = CorrelationId::new();
        let mut ledger = AppendOnlyLedger::new();
        let mut ingestor = MarketIngestor::new(default_approved_providers());
        let summary = ingestor.ingest_batch(tenant_id, correlation_id, decoded, &mut ledger)?;

        assert_eq!(summary.input_ticks, 100_000);
        assert_eq!(summary.unique_ticks + summary.duplicate_ticks, 100_000);
        assert!(summary.unique_ticks > 90_000);
        assert!(summary.anomaly_events > 0);
        assert_eq!(
            ledger
                .events_by_correlation_id(tenant_id, correlation_id)
                .len(),
            summary.recorded_events
        );
        Ok(())
    }

    #[test]
    fn out_of_order_and_duplicate_ticks_are_deduplicated() -> Result<()> {
        let spec = MarketReplaySpec {
            dataset_name: "small".to_owned(),
            provider: "approved.binance.spot".to_owned(),
            symbols: vec!["BTCUSDT".to_owned(), "ETHUSDT".to_owned()],
            base_time: Utc::now(),
            count: 24,
            duplicate_every: 4,
            out_of_order_every: 3,
            stale_every: 0,
            quality_fail_every: 0,
        };
        let tenant_id = TenantId::new();
        let correlation_id = CorrelationId::new();
        let mut ledger = AppendOnlyLedger::new();
        let mut ingestor = MarketIngestor::new(default_approved_providers());
        let summary = ingestor.ingest_batch(
            tenant_id,
            correlation_id,
            generate_replay_dataset(&spec),
            &mut ledger,
        )?;

        assert_eq!(summary.input_ticks, 24);
        assert_eq!(summary.duplicate_ticks, 5);
        assert_eq!(summary.unique_ticks, 19);
        assert_eq!(
            ledger
                .events_by_correlation_id(tenant_id, correlation_id)
                .len(),
            summary.recorded_events
        );
        Ok(())
    }

    #[test]
    fn freshness_and_quality_anomalies_emit_events_within_five_seconds() -> Result<()> {
        let provider = "approved.binance.spot".to_owned();
        let base_time = Utc::now();
        let stale_tick = RawMarketTick {
            provider: provider.clone(),
            source_tick_id: "stale-1".to_owned(),
            provider_symbol: "BTC/USDT".to_owned(),
            event_time: base_time,
            received_at: base_time + ChronoDuration::seconds(6),
            price: "101.5".to_owned(),
            volume: "2.5".to_owned(),
        };
        let quality_tick = RawMarketTick {
            provider,
            source_tick_id: "quality-1".to_owned(),
            provider_symbol: "ETH-USDT".to_owned(),
            event_time: base_time + ChronoDuration::seconds(1),
            received_at: base_time + ChronoDuration::seconds(1),
            price: "0".to_owned(),
            volume: "0".to_owned(),
        };

        let mut ingestor = MarketIngestor::new(default_approved_providers());
        let started_at = Instant::now();
        let stale = ingestor.ingest_tick(TenantId::new(), CorrelationId::new(), stale_tick)?;
        let quality = ingestor.ingest_tick(TenantId::new(), CorrelationId::new(), quality_tick)?;

        let stale_anomaly = stale
            .market_events
            .iter()
            .find(|event| event.event_kind == MarketEventKind::FreshnessDegraded)
            .expect("freshness anomaly emitted");
        let quality_anomaly = quality
            .market_events
            .iter()
            .find(|event| event.event_kind == MarketEventKind::QualityFailed)
            .expect("quality anomaly emitted");

        assert!(started_at.elapsed() <= Duration::from_secs(5));
        assert_eq!(
            quality_anomaly.anomaly_reason.as_deref(),
            Some("non_positive_price_or_volume")
        );
        assert_eq!(
            stale.recorded_events[1].occurred_at,
            stale_anomaly.received_at
        );
        assert_eq!(
            quality.recorded_events[1].occurred_at,
            quality_anomaly.received_at
        );
        Ok(())
    }

    #[test]
    fn rejects_unapproved_providers_and_normalizes_symbols() {
        let error = MarketIngestor::new(default_approved_providers())
            .ingest_tick(
                TenantId::new(),
                CorrelationId::new(),
                RawMarketTick {
                    provider: "shadow.provider".to_owned(),
                    source_tick_id: "1".to_owned(),
                    provider_symbol: "btc/usdt".to_owned(),
                    event_time: Utc::now(),
                    received_at: Utc::now(),
                    price: "1".to_owned(),
                    volume: "1".to_owned(),
                },
            )
            .expect_err("provider should be rejected");

        assert_eq!(error.machine_code(), "MARKET_PROVIDER_NOT_APPROVED");
        assert_eq!(
            normalize_symbol("btc/usdt").expect("symbol normalizes"),
            "BTCUSDT"
        );
        assert_eq!(
            normalize_symbol("btc-usdt").expect("hyphenated symbol normalizes"),
            "BTCUSDT"
        );
        assert_eq!(
            normalize_symbol("btc_usdt").expect("underscored symbol normalizes"),
            "BTCUSDT"
        );
        assert_eq!(
            normalize_symbol("btc@@usdt")
                .expect_err("unexpected punctuation must fail closed")
                .machine_code(),
            "MARKET_INVALID_SYMBOL"
        );
    }

    #[test]
    fn invalid_ticks_do_not_poison_deduplication_and_negative_values_fail_quality() -> Result<()> {
        let tenant_id = TenantId::new();
        let correlation_id = CorrelationId::new();
        let base_time = Utc::now();
        let mut ingestor = MarketIngestor::new(default_approved_providers());
        let mut tick = RawMarketTick {
            provider: "approved.binance.spot".to_owned(),
            source_tick_id: "correctable-1".to_owned(),
            provider_symbol: "BTC/USDT".to_owned(),
            event_time: base_time,
            received_at: base_time,
            price: "invalid".to_owned(),
            volume: "1".to_owned(),
        };

        assert_eq!(
            ingestor
                .ingest_tick(tenant_id, correlation_id, tick.clone())
                .expect_err("invalid price is rejected")
                .machine_code(),
            "MARKET_INVALID_PRICE"
        );
        tick.price = "100.1250".to_owned();
        let corrected = ingestor.ingest_tick(tenant_id, correlation_id, tick)?;
        assert!(!corrected.duplicate);
        assert_eq!(
            corrected.market_events[0].price.value().to_string(),
            "100.1250"
        );

        let zero = ingestor.ingest_tick(
            tenant_id,
            correlation_id,
            RawMarketTick {
                provider: "approved.binance.spot".to_owned(),
                source_tick_id: "zero-1".to_owned(),
                provider_symbol: "ETH-USDT".to_owned(),
                event_time: base_time,
                received_at: base_time,
                price: "0".to_owned(),
                volume: "2".to_owned(),
            },
        )?;
        assert!(zero.market_events.iter().any(|event| {
            event.event_kind == MarketEventKind::QualityFailed
                && event.anomaly_reason.as_deref() == Some("non_positive_price_or_volume")
        }));

        let negative_error = ingestor
            .ingest_tick(
                tenant_id,
                correlation_id,
                RawMarketTick {
                    provider: "approved.binance.spot".to_owned(),
                    source_tick_id: "negative-1".to_owned(),
                    provider_symbol: "SOL_USDT".to_owned(),
                    event_time: base_time,
                    received_at: base_time,
                    price: "-1".to_owned(),
                    volume: "2".to_owned(),
                },
            )
            .expect_err("negative price is rejected");
        assert_eq!(negative_error.machine_code(), "MARKET_INVALID_PRICE");
        Ok(())
    }
}
