// Audit probes assert the observed defective behavior, not acceptance.
use chrono::{TimeZone, Utc};
use quantos_core::{CorrelationId, TenantId};
use quantos_event::AppendOnlyLedger;
use quantos_market::*;

fn tick(id: &str) -> RawMarketTick {
    let time = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
    RawMarketTick { provider: "approved.binance.spot".into(), source_tick_id: id.into(),
        provider_symbol: "BTC/USDT".into(), event_time: time, received_at: time,
        price: "100".into(), volume: "1".into() }
}

#[test]
fn tenant_b_is_silently_deduplicated_after_tenant_a() {
    let mut i = MarketIngestor::new(default_approved_providers());
    i.ingest_tick(TenantId::new(), CorrelationId::new(), tick("same")).unwrap();
    assert!(i.ingest_tick(TenantId::new(), CorrelationId::new(), tick("same")).unwrap().duplicate);
}

#[test]
fn same_id_changed_payload_is_silently_dropped() {
    let mut i = MarketIngestor::new(default_approved_providers());
    let t = TenantId::new(); let c = CorrelationId::new();
    i.ingest_tick(t, c, tick("same")).unwrap();
    let mut changed = tick("same"); changed.price = "999".into();
    assert!(i.ingest_tick(t, c, changed).unwrap().duplicate);
}

#[test]
fn restart_reaccepts_duplicate_and_resets_sequence() {
    let t = TenantId::new(); let c = CorrelationId::new();
    let mut a = MarketIngestor::new(default_approved_providers());
    let mut b = MarketIngestor::new(default_approved_providers());
    assert_eq!(a.ingest_tick(t, c, tick("same")).unwrap().market_events[0].sequence, 1);
    let result = b.ingest_tick(t, c, tick("same")).unwrap();
    assert!(!result.duplicate); assert_eq!(result.market_events[0].sequence, 1);
}

#[test]
fn failed_append_commits_dedup_key_and_retry_drops_tick() {
    let t = TenantId::new(); let c = CorrelationId::new();
    let mut ledger = AppendOnlyLedger::new();
    let mut a = MarketIngestor::new(default_approved_providers());
    a.ingest_batch(t, c, [tick("first")], &mut ledger).unwrap();
    let mut b = MarketIngestor::new(default_approved_providers());
    assert!(b.ingest_batch(t, c, [tick("second")], &mut ledger).is_err());
    let retry = b.ingest_batch(t, c, [tick("second")], &mut ledger).unwrap();
    assert_eq!(retry.duplicate_ticks, 1); assert_eq!(retry.recorded_events, 0);
    assert_eq!(ledger.events_by_correlation_id(t, c).len(), 1);
}

#[test]
fn historic_received_timestamp_can_report_passed() {
    let mut i = MarketIngestor::new(default_approved_providers());
    let result = i.ingest_tick(TenantId::new(), CorrelationId::new(), tick("old")).unwrap();
    assert_eq!(result.market_events.len(), 1);
    assert_eq!(result.market_events[0].quality, MarketDataQuality::Passed);
}

#[test]
fn negative_price_aborts_without_quality_event() {
    let mut i = MarketIngestor::new(default_approved_providers());
    let mut raw = tick("negative"); raw.price = "-1".into();
    assert_eq!(i.ingest_tick(TenantId::new(), CorrelationId::new(), raw).unwrap_err().machine_code(), "MARKET_INVALID_PRICE");
}

#[test]
fn empty_source_id_is_accepted() {
    let mut i = MarketIngestor::new(default_approved_providers());
    assert!(!i.ingest_tick(TenantId::new(), CorrelationId::new(), tick("")).unwrap().duplicate);
}

#[test]
fn empty_license_and_negative_sla_are_accepted() {
    let approvals = ApprovedProviderRegistry::new([ApprovedProvider {
        provider: "approved.binance.spot".into(), dataset: "".into(), license_label: "".into(),
        freshness_sla_secs: -1, max_future_skew_secs: -1,
    }]);
    let mut i = MarketIngestor::new(approvals);
    let result = i.ingest_tick(TenantId::new(), CorrelationId::new(), tick("unchecked")).unwrap();
    assert!(result.market_events[0].license_label.is_empty());
}

#[test]
fn distinct_symbol_partitions_collapse() {
    assert_eq!(normalize_symbol("AB/C").unwrap(), normalize_symbol("A/BC").unwrap());
    assert_eq!(normalize_symbol("BTC/USDT/EXTRA").unwrap(), "BTCUSDTEXTRA");
}

#[test]
fn empty_replay_symbols_panics_in_public_generator() {
    let mut spec = default_replay_spec().unwrap();
    spec.symbols.clear(); spec.count = 1;
    assert!(std::panic::catch_unwind(|| generate_replay_dataset(&spec)).is_err());
}
