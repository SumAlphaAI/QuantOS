use chrono::{DateTime, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_event::RecordedEvent;
use quantos_market::{MarketDataQuality, MarketEvent, MarketEventKind, normalize_symbol};

use crate::{
    InMemoryPortfolioProjection, MarketMarkEvent, PortfolioError, PortfolioEvent,
    PortfolioEventKind,
};

impl InMemoryPortfolioProjection {
    fn validate_record(&self, record: &RecordedEvent, schema: &str) -> Result<(), PortfolioError> {
        if record.sequence == 0
            || record.event_id.as_uuid().is_nil()
            || record.tenant_id != self.tenant_id
            || record.schema_version.as_str() != schema
            || record.payload_hash
                != ContentHash::sha256_bytes(&canonical_json_bytes(&record.payload)?)
        {
            return Err(PortfolioError::InvalidInput(
                "ledger tenant, schema or payload hash",
            ));
        }
        Ok(())
    }

    /// Validate a source portfolio stream and explicitly assign its merged replay-tape sequence.
    pub fn apply_recorded(
        &mut self,
        record: &RecordedEvent,
        portfolio_sequence: u64,
    ) -> Result<(), PortfolioError> {
        self.validate_record(record, "v1")?;
        if record.aggregate_type != "portfolio" || record.aggregate_id != self.tenant_id.to_string()
        {
            return Err(PortfolioError::InvalidInput("portfolio ledger stream"));
        }
        let kind: PortfolioEventKind = serde_json::from_value(record.payload.clone())?;
        let expected_kind = match &kind {
            PortfolioEventKind::Fill(_) => "portfolio.fill",
            PortfolioEventKind::MarkPrice(_) => "portfolio.mark_price",
            PortfolioEventKind::MarketMark(_) => "portfolio.market_mark",
            PortfolioEventKind::AccountStatus(_) => "portfolio.account_status",
        };
        let encoded = serde_json::to_value(&kind)?;
        if record.event_kind != expected_kind
            || record
                .payload
                .as_object()
                .is_none_or(|payload| payload.keys().any(|key| encoded.get(key).is_none()))
        {
            return Err(PortfolioError::InvalidInput(
                "portfolio ledger kind or payload fields",
            ));
        }
        self.apply(&PortfolioEvent {
            event_id: record.event_id.to_string(),
            sequence: portfolio_sequence,
            occurred_at: record.occurred_at,
            kind,
        })
    }

    /// Explicitly assign a sequence in the portfolio tape; never reuse a per-provider sequence.
    /// The admitted R01 ledger is the source authority; this adapter grants no provider rights.
    pub fn apply_market_recorded(
        &mut self,
        record: &RecordedEvent,
        portfolio_sequence: u64,
    ) -> Result<(), PortfolioError> {
        self.validate_record(record, "v2")?;
        let mut payload = record.payload.clone();
        let object = payload
            .as_object_mut()
            .ok_or(PortfolioError::InvalidInput("market payload"))?;
        if object.contains_key("sequence") {
            return Err(PortfolioError::InvalidInput("embedded market sequence"));
        }
        object.insert("sequence".into(), record.sequence.into());
        let market: MarketEvent = serde_json::from_value(payload)?;
        let source_at: DateTime<Utc> = market.event_time;
        if record.aggregate_type != "market"
            || record.aggregate_id != format!("{}:{}", market.provider, market.normalized_symbol)
            || record.event_kind != "market.tick.recorded"
            || market.event_kind != MarketEventKind::TickRecorded
            || market.quality != MarketDataQuality::Passed
            || market.anomaly_reason.is_some()
            || market.approval_reference.is_empty()
            || market.approval_version.is_empty()
            || market.license_label.is_empty()
            || market.source_tick_id.is_empty()
            || normalize_symbol(&market.normalized_symbol)
                .map_err(|_| PortfolioError::InvalidInput("market symbol"))?
                != market.normalized_symbol
            || source_at > market.received_at
            || market.received_at > record.occurred_at
        {
            return Err(PortfolioError::InvalidInput(
                "market source quality, binding or time",
            ));
        }
        let price = market
            .price
            .ok_or(PortfolioError::InvalidInput("missing market price"))?
            .value()
            .to_string()
            .parse::<f64>()
            .map_err(|_| PortfolioError::InvalidInput("market price representation"))?;
        self.apply(&PortfolioEvent {
            event_id: record.event_id.to_string(),
            sequence: portfolio_sequence,
            occurred_at: record.occurred_at,
            kind: PortfolioEventKind::MarketMark(MarketMarkEvent {
                symbol: market.normalized_symbol,
                price,
                source_at,
            }),
        })
    }
}
