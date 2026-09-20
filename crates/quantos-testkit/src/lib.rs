use std::time::Instant;

use chrono::{DateTime, Utc};
use quantos_core::{
    ContentHash, CorrelationId, FixedUtcClock, FixtureBuilder, FixtureId, Money, Quantity,
    SchemaVersion, TenantId, parse_utc_rfc3339,
};
use serde_json::json;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct FixedIdSource {
    next: u128,
}

impl FixedIdSource {
    #[must_use]
    pub const fn new(seed: u128) -> Self {
        Self { next: seed }
    }

    #[must_use]
    pub fn next_uuid(&mut self) -> Uuid {
        let value = Uuid::from_u128(self.next);
        self.next = self.next.checked_add(1).expect("fixed ID seed exhausted");
        value
    }

    #[must_use]
    pub fn tenant_id(&mut self) -> TenantId {
        TenantId::from_uuid(self.next_uuid())
    }

    #[must_use]
    pub fn correlation_id(&mut self) -> CorrelationId {
        CorrelationId::from_uuid(self.next_uuid())
    }

    #[must_use]
    pub fn fixture_id(&mut self) -> FixtureId {
        FixtureId::from_uuid(self.next_uuid())
    }
}

#[must_use]
pub const fn fixed_clock(now: DateTime<Utc>) -> FixedUtcClock {
    FixedUtcClock::new(now)
}

pub fn fixture_corpus_digest(count: usize) -> ContentHash {
    let version = SchemaVersion::parse("v1").expect("static schema version is valid");
    let mut corpus = String::new();
    for index in 0..count {
        let fixture = FixtureBuilder::new("f04-corpus", version.clone())
            .with_field(
                "payload",
                json!({
                    "index": index,
                    "label": format!("fixture-{index:04}-量化"),
                    "escaped": "line\nquote\"slash\\",
                    "nested": {"z": index + 1, "a": [true, false, null]},
                    "numeric_edges": [i64::MIN, i64::MAX, 0, -1],
                    "decimal_edges": ["0.000000000001", "79228162514264337593543950335"],
                }),
            )
            .expect("corpus field serializes")
            .build()
            .expect("corpus fixture builds");
        corpus.push_str(fixture.hash().as_str());
        corpus.push('\n');
    }
    ContentHash::sha256_bytes(corpus.as_bytes())
}

#[must_use]
pub fn domain_operation_p95(samples: usize) -> std::time::Duration {
    assert!(samples > 0, "at least one sample is required");
    let version = SchemaVersion::parse("v1").expect("static schema version is valid");
    let mut durations = Vec::with_capacity(samples);
    for index in 0..samples {
        let started = Instant::now();
        std::hint::black_box(TenantId::new());
        std::hint::black_box(parse_utc_rfc3339("2026-09-20T08:00:00+08:00").unwrap());
        std::hint::black_box(Money::parse_str("USD", "123.123456789").unwrap());
        std::hint::black_box(Quantity::parse_str("123.123456789012").unwrap());
        let fixture = FixtureBuilder::new("f04-performance", version.clone())
            .with_field("index", index)
            .expect("sample serializes")
            .build()
            .expect("sample builds");
        fixture.verify().expect("sample verifies");
        durations.push(started.elapsed());
    }
    durations.sort_unstable();
    durations[((samples * 95).div_ceil(100)).saturating_sub(1)]
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use chrono::{TimeZone, Utc};
    use quantos_core::UtcClock;

    use super::{FixedIdSource, domain_operation_p95, fixed_clock, fixture_corpus_digest};

    #[test]
    fn fixed_ids_and_clock_are_replayable() {
        let mut first = FixedIdSource::new(1);
        let mut second = FixedIdSource::new(1);
        assert_eq!(first.tenant_id(), second.tenant_id());
        assert_eq!(first.correlation_id(), second.correlation_id());
        assert_eq!(first.fixture_id(), second.fixture_id());

        let now = Utc
            .with_ymd_and_hms(2026, 9, 20, 0, 0, 0)
            .single()
            .expect("timestamp is valid");
        assert_eq!(fixed_clock(now).now(), now);
    }

    #[test]
    fn thousand_fixture_corpus_is_deterministic() {
        assert_eq!(fixture_corpus_digest(1_000), fixture_corpus_digest(1_000));
    }

    #[test]
    fn domain_operations_stay_below_fifty_milliseconds_p95() {
        let p95 = domain_operation_p95(1_000);
        assert!(p95 < Duration::from_millis(50), "P95 was {p95:?}");
    }
}
