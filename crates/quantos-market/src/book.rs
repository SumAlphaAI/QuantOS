//! Explicit licensed top-of-book facts. A trade is never converted into bid/ask.
use crate::{ApprovedProviderRegistry, MarketDataQuality, MarketError};
use chrono::{DateTime, Utc};
use quantos_core::{
    ActorId, CorrelationId, Quantity, SchemaVersion, TenantId, canonical_json_bytes,
};
use quantos_event::{NewRecordedEvent, RecordedEvent};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawMarketBook {
    pub provider: String,
    pub source_tick_id: String,
    pub provider_symbol: String,
    pub event_time: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub bid: String,
    pub ask: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MarketBookEvent {
    pub normalized_symbol: String,
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
    pub source_tick_id: String,
    pub event_time: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub bid: Quantity,
    pub ask: Quantity,
    pub quality: MarketDataQuality,
    pub approval_reference: String,
    pub approval_version: String,
    pub sequence: u64,
    pub event_kind: String,
}
impl MarketBookEvent {
    pub fn validate(&self) -> Result<(), MarketError> {
        if self.event_kind != "book_recorded"
            || self.sequence == 0
            || self.bid.value().is_zero()
            || self.ask.value().is_zero()
            || self.bid.value() > self.ask.value()
            || self.source_tick_id.is_empty()
        {
            return Err(MarketError::Configuration);
        }
        Ok(())
    }
    pub fn to_recorded_event(
        &self,
        tenant: TenantId,
        actor: ActorId,
        correlation: CorrelationId,
    ) -> Result<RecordedEvent, MarketError> {
        self.validate()?;
        let mut payload = serde_json::to_value(self)?;
        payload.as_object_mut().unwrap().remove("sequence");
        Ok(RecordedEvent::new(NewRecordedEvent {
            tenant_id: tenant,
            actor_id: actor,
            correlation_id: correlation,
            causation_id: None,
            aggregate_type: "market".into(),
            aggregate_id: format!("{}:{}", self.provider, self.normalized_symbol),
            sequence: self.sequence,
            event_kind: "market.book.recorded".into(),
            schema_version: SchemaVersion::parse("v2")?,
            occurred_at: self.received_at,
            payload,
        })?)
    }
    pub fn source_hash(&self) -> Result<quantos_core::ContentHash, MarketError> {
        Ok(quantos_core::ContentHash::sha256_bytes(
            &canonical_json_bytes(&serde_json::json!([
                self.provider,
                self.source_tick_id,
                self.event_time,
                self.bid,
                self.ask
            ]))?,
        ))
    }
}
pub fn normalize_book(
    registry: &ApprovedProviderRegistry,
    input: RawMarketBook,
    sequence: u64,
    now: DateTime<Utc>,
) -> Result<MarketBookEvent, MarketError> {
    let p = registry.approved_provider(&input.provider)?;
    let symbol = p
        .instruments
        .get(&input.provider_symbol)
        .ok_or(MarketError::Configuration)?
        .clone();
    if input.source_tick_id.is_empty()
        || input.source_tick_id.len() > 256
        || input.event_time > now
        || input.received_at > now
        || input.received_at < input.event_time
    {
        return Err(MarketError::Configuration);
    }
    let event = MarketBookEvent {
        normalized_symbol: symbol,
        provider: p.provider.clone(),
        dataset: p.dataset.clone(),
        license_label: p.license_label.clone(),
        source_tick_id: input.source_tick_id,
        event_time: input.event_time,
        received_at: input.received_at,
        bid: Quantity::parse_str(&input.bid)?,
        ask: Quantity::parse_str(&input.ask)?,
        quality: if (now - input.event_time).num_seconds() > p.freshness_sla_secs {
            MarketDataQuality::Degraded
        } else {
            MarketDataQuality::Passed
        },
        approval_reference: p.approval_reference.clone(),
        approval_version: p.approval_version.clone(),
        sequence,
        event_kind: "book_recorded".into(),
    };
    event.validate()?;
    Ok(event)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn raw() -> RawMarketBook {
        let now = Utc::now();
        RawMarketBook {
            provider: "approved.binance.spot".into(),
            source_tick_id: "book:1".into(),
            provider_symbol: "BTCUSDT".into(),
            event_time: now,
            received_at: now,
            bid: "100.01".into(),
            ask: "100.03".into(),
        }
    }
    #[test]
    fn licensed_book_values_are_preserved_and_recorded() {
        let r = raw();
        let b = normalize_book(&crate::default_approved_providers(), r, 6, Utc::now()).unwrap();
        assert_eq!(b.bid.value().to_string(), "100.01");
        assert_eq!(b.ask.value().to_string(), "100.03");
        let event = b
            .to_recorded_event(TenantId::new(), ActorId::new(), CorrelationId::new())
            .unwrap();
        assert_eq!(event.event_kind, "market.book.recorded");
        assert!(event.payload.get("sequence").is_none());
        assert_ne!(
            b.source_hash().unwrap(),
            quantos_core::ContentHash::sha256_bytes(b"trade")
        );
    }
    #[test]
    fn crossed_zero_unknown_symbol_provider_and_future_books_are_denied() {
        for what in [
            "crossed",
            "zero",
            "symbol",
            "provider",
            "future",
            "negative",
            "precision",
        ] {
            let mut r = raw();
            match what {
                "crossed" => r.bid = "200".into(),
                "zero" => r.bid = "0".into(),
                "symbol" => r.provider_symbol = "UNKNOWN".into(),
                "provider" => r.provider = "unknown".into(),
                "future" => r.event_time = Utc::now() + chrono::Duration::days(1),
                "negative" => r.bid = "-1".into(),
                _ => r.bid = "0.123456789123456789".into(),
            };
            assert!(
                normalize_book(&crate::default_approved_providers(), r, 1, Utc::now()).is_err(),
                "{what}"
            );
        }
    }
}
