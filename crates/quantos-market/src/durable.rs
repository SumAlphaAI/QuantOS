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
use serde_json::json;
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
