//! The production path has no in-memory identity or sequence cache. PostgreSQL is authoritative.
use crate::{
    ApprovedProviderRegistry, MarketError, MarketIngestionOutcome, MarketIngestor, RawMarketTick,
};
use chrono::{DateTime, Utc};
use quantos_core::{
    ActorId, ContentHash, CorrelationId, SchemaVersion, TenantId, canonical_json_bytes,
};
use quantos_event::{
    NewRecordedEvent, RecordedEvent,
    pg::{PgEventStore, PgEventStoreError},
};
use serde_json::{Value, json};
use std::{collections::HashMap, time::Instant};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DurableMarketError {
    #[error(transparent)]
    Market(#[from] MarketError),
    #[error(transparent)]
    Store(#[from] PgEventStoreError),
}
pub struct DurableMarketIngestor {
    approvals: ApprovedProviderRegistry,
    actor: ActorId,
    store: PgEventStore,
    watchdog_checkpoints: HashMap<String, String>,
}
impl DurableMarketIngestor {
    pub fn connect(
        database_url: &str,
        approvals: ApprovedProviderRegistry,
        actor: ActorId,
    ) -> Result<Self, DurableMarketError> {
        let mut store = PgEventStore::connect(database_url)?;
        store.configure_market_deadline()?;
        Ok(Self {
            approvals,
            actor,
            store,
            watchdog_checkpoints: HashMap::new(),
        })
    }
    pub fn ingest(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        tick: RawMarketTick,
        processing_time: DateTime<Utc>,
    ) -> Result<MarketIngestionOutcome, DurableMarketError> {
        let provider = tick.provider.clone();
        let id = tick.source_tick_id.clone();
        let hash = tick.source_hash()?;
        let mut outcome = MarketIngestor::with_actor(self.approvals.clone(), self.actor)
            .ingest_tick_at(tenant, correlation, tick, processing_time)?;
        if !self.store.append_market_events(
            tenant,
            self.actor,
            &provider,
            &id,
            &hash,
            &mut outcome.recorded_events,
        )? {
            outcome.duplicate = true;
            outcome.market_events.clear();
            outcome.recorded_events.clear();
        } else {
            for (domain, recorded) in outcome
                .market_events
                .iter_mut()
                .zip(&outcome.recorded_events)
            {
                domain.sequence = recorded.sequence;
            }
        }
        Ok(outcome)
    }
    pub fn refresh_approvals(&mut self, approvals: ApprovedProviderRegistry) {
        self.approvals = approvals;
    }
    pub fn binance_cursor(
        &mut self,
        tenant: TenantId,
        provider: &str,
        symbol: &str,
    ) -> Result<Option<i64>, DurableMarketError> {
        self.approvals.approved_provider(provider)?;
        Ok(self.store.binance_cursor(tenant, provider, symbol)?)
    }
    /// Compatibility entry point; callers needing ACK evidence use the receipt variant.
    pub fn ingest_binance_page(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        symbol: &str,
        expected: i64,
        ticks: Vec<RawMarketTick>,
    ) -> Result<i64, DurableMarketError> {
        Ok(self.ingest_binance_page_receipt(
            tenant,
            correlation,
            provider,
            symbol,
            expected,
            ticks,
        )?["next_id"]
            .as_str()
            .expect("committed cursor")
            .parse()
            .expect("valid cursor"))
    }
    /// Build all domain events before the single atomic database page call.
    pub fn ingest_binance_page_receipt(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        symbol: &str,
        expected: i64,
        ticks: Vec<RawMarketTick>,
    ) -> Result<Value, DurableMarketError> {
        self.approvals.approved_provider(provider)?;
        if expected < 0 || ticks.len() > 1000 {
            return Err(MarketError::ResourceLimit.into());
        }
        let build_clock = Instant::now();
        let mut event_timings = Vec::new();
        let mut page = Vec::with_capacity(ticks.len());
        for (offset, tick) in ticks.into_iter().enumerate() {
            let id = expected
                .checked_add(offset as i64)
                .ok_or(MarketError::ResourceLimit)?;
            if tick.provider != provider
                || tick.provider_symbol != symbol
                || tick.source_tick_id != format!("{symbol}:agg:{id}")
            {
                return Err(MarketError::InvalidIdentity.into());
            }
            let hash = tick.source_hash()?;
            let outcome = MarketIngestor::with_actor(self.approvals.clone(), self.actor)
                .ingest_tick_at(tenant, correlation, tick, Utc::now())?;
            for event in &outcome.recorded_events {
                event_timings.push(json!({"event_id":event.event_id,"event_kind":event.event_kind,
                    "source_tick_id":event.payload.get("source_tick_id"),"event_time":event.payload.get("event_time"),
                    "received_at":event.payload.get("received_at"),"detected_at":event.payload.get("detected_at")}));
            }
            page.push(json!({"id":id,"source_id":format!("{symbol}:agg:{id}"),"hash":hash,"canonical_symbol":outcome.market_events[0].normalized_symbol,"events":outcome.recorded_events}));
        }
        let build_ms = build_clock.elapsed().as_secs_f64() * 1000.0;
        let next = self.store.append_binance_page(
            tenant,
            self.actor,
            provider,
            symbol,
            expected,
            &json!(page),
        )?;
        Ok(
            json!({"kind":"binance_page_committed","symbol":symbol,"next_id":next.to_string(),
            "build_ms":build_ms,"write":self.store.last_market_write(),"events":event_timings}),
        )
    }
    pub fn binance_watchdog(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        symbol: &str,
        observed: DateTime<Utc>,
    ) -> Result<bool, DurableMarketError> {
        Ok(self
            .binance_watchdog_receipt(tenant, correlation, provider, symbol, observed)?
            .is_some_and(|r| r["inserted"].as_bool() == Some(true)))
    }
    /// Transport health uses successful committed polls, including empty polls, not trade activity.
    pub fn binance_watchdog_receipt(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        symbol: &str,
        observed: DateTime<Utc>,
    ) -> Result<Option<Value>, DurableMarketError> {
        let approval = self.approvals.approved_provider(provider)?;
        let Some(last) = self.store.binance_last_response(tenant, provider, symbol)? else {
            return Ok(None);
        };
        if observed - last <= chrono::Duration::seconds(approval.freshness_sla_secs) {
            return Ok(None);
        }
        let checkpoint = last.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let identity = format!("watchdog:freshness:v2:{symbol}:{checkpoint}");
        let key = format!("{tenant}:{provider}:{symbol}");
        if self.watchdog_checkpoints.get(&key) == Some(&identity) {
            return Ok(None);
        }
        let payload = json!({"provider":provider,"symbol":symbol,"last_response_at":checkpoint,"reason":"binance_poll_unavailable","quality":"degraded"});
        let hash =
            ContentHash::sha256_bytes(&canonical_json_bytes(&payload).map_err(MarketError::from)?);
        let mut events = [RecordedEvent::new(NewRecordedEvent {
            tenant_id: tenant,
            actor_id: self.actor,
            correlation_id: correlation,
            causation_id: None,
            aggregate_type: "market".into(),
            aggregate_id: format!("{provider}:source"),
            sequence: 1,
            event_kind: "market.source.freshness_degraded".into(),
            schema_version: SchemaVersion::parse("v2").map_err(MarketError::from)?,
            occurred_at: observed,
            payload,
        })
        .map_err(MarketError::from)?];
        let inserted = self.store.append_market_events(
            tenant,
            self.actor,
            provider,
            &identity,
            &hash,
            &mut events,
        )?;
        self.watchdog_checkpoints.insert(key, identity.clone());
        Ok(Some(
            json!({"kind":"binance_watchdog_committed","producer":"native","symbol":symbol,
            "source_identity":identity,"event_kind":"market.source.freshness_degraded","inserted":inserted,
            "event_id":if inserted { Some(events[0].event_id) } else { None },
            "origin_at":last + chrono::Duration::seconds(approval.freshness_sla_secs),"detected_at":observed,
            "write":self.store.last_market_write()}),
        ))
    }
    /// Quarantine invalid source frames without copying an untrusted payload to logs.
    /// Repeated identical frames are idempotent; they do not prevent subsequent good ticks.
    pub fn reject_frame(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        frame: &[u8],
        observed: DateTime<Utc>,
        reason: &str,
    ) -> Result<bool, DurableMarketError> {
        let approval = self.approvals.approved_provider(provider)?;
        let hash = ContentHash::sha256_bytes(frame);
        let id = format!("rejected:{}", hash.as_str());
        let payload = json!({"provider":provider,"reason":reason,"frame_hash":hash,"quality":"failed","license_label":approval.license_label,"detected_at":observed});
        let mut events = [RecordedEvent::new(NewRecordedEvent {
            tenant_id: tenant,
            actor_id: self.actor,
            correlation_id: correlation,
            causation_id: None,
            aggregate_type: "market".into(),
            aggregate_id: format!("{provider}:source"),
            sequence: 1,
            event_kind: "market.source.quality_failed".into(),
            schema_version: SchemaVersion::parse("v2").map_err(MarketError::from)?,
            occurred_at: observed,
            payload,
        })
        .map_err(MarketError::from)?];
        Ok(self.store.append_market_events(
            tenant,
            self.actor,
            provider,
            &id,
            &hash,
            &mut events,
        )?)
    }
    /// The durable source receipt acts as the heartbeat checkpoint across restarts.
    pub fn watchdog(
        &mut self,
        tenant: TenantId,
        correlation: CorrelationId,
        provider: &str,
        observed: DateTime<Utc>,
    ) -> Result<bool, DurableMarketError> {
        let approval = self.approvals.approved_provider(provider)?;
        let last = self.store.last_market_receipt(tenant, provider)?;
        let stale = last.is_none_or(|time| {
            observed - time > chrono::Duration::seconds(approval.freshness_sla_secs)
        });
        if !stale {
            return Ok(false);
        }
        let marker = last.map_or_else(|| "never".into(), |t| t.to_rfc3339());
        let payload = json!({"provider":provider,"last_tick_committed_at":last,"reason":"source_silent","quality":"degraded"});
        let hash =
            ContentHash::sha256_bytes(&canonical_json_bytes(&payload).map_err(MarketError::from)?);
        let id = format!("watchdog:{marker}");
        let mut events = [RecordedEvent::new(NewRecordedEvent {
            tenant_id: tenant,
            actor_id: self.actor,
            correlation_id: correlation,
            causation_id: None,
            aggregate_type: "market".into(),
            aggregate_id: format!("{provider}:source"),
            sequence: 1,
            event_kind: "market.source.freshness_degraded".into(),
            schema_version: SchemaVersion::parse("v2").map_err(MarketError::from)?,
            occurred_at: observed,
            payload,
        })
        .map_err(MarketError::from)?];
        Ok(self.store.append_market_events(
            tenant,
            self.actor,
            provider,
            &id,
            &hash,
            &mut events,
        )?)
    }
}
