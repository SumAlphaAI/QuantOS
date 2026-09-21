pub mod pg;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use chrono::{DateTime, Utc};
use quantos_core::{
    ActorId, AuditEntryId, ContentHash, CorrelationId, DeadLetterId, EventId, InboxEntryId,
    OutboxEntryId, SchemaVersion, TenantId, canonical_json_bytes,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EventErrorCode {
    DuplicateEvent,
    SequenceGap,
    HandlerFailure,
}

impl EventErrorCode {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DuplicateEvent => "EVENT_DUPLICATE_EVENT",
            Self::SequenceGap => "EVENT_SEQUENCE_GAP",
            Self::HandlerFailure => "EVENT_HANDLER_FAILURE",
        }
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{code}: {message}")]
pub struct EventError {
    code: &'static str,
    message: String,
}

impl EventError {
    #[must_use]
    pub fn new(code: EventErrorCode, message: impl Into<String>) -> Self {
        Self {
            code: code.as_str(),
            message: message.into(),
        }
    }

    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        self.code
    }

    #[must_use]
    pub fn duplicate_event(event_id: EventId) -> Self {
        Self::new(
            EventErrorCode::DuplicateEvent,
            format!("event `{event_id}` already exists in the ledger"),
        )
    }

    #[must_use]
    pub fn sequence_gap(expected: u64, actual: u64) -> Self {
        Self::new(
            EventErrorCode::SequenceGap,
            format!("expected sequence {expected}, got {actual}"),
        )
    }

    #[must_use]
    pub fn handler_failure(event_id: EventId, detail: &str) -> Self {
        Self::new(
            EventErrorCode::HandlerFailure,
            format!("handler failed for event `{event_id}`: {detail}"),
        )
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecordedEvent {
    pub event_id: EventId,
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub correlation_id: CorrelationId,
    pub causation_id: EventId,
    pub aggregate_type: String,
    pub aggregate_id: String,
    pub sequence: u64,
    pub event_kind: String,
    pub schema_version: SchemaVersion,
    pub occurred_at: DateTime<Utc>,
    pub payload: Value,
    pub payload_hash: ContentHash,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NewRecordedEvent {
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub correlation_id: CorrelationId,
    /// The direct parent event. Root events use their own generated event ID.
    pub causation_id: Option<EventId>,
    pub aggregate_type: String,
    pub aggregate_id: String,
    pub sequence: u64,
    pub event_kind: String,
    pub schema_version: SchemaVersion,
    pub occurred_at: DateTime<Utc>,
    pub payload: Value,
}

impl RecordedEvent {
    pub fn new(input: NewRecordedEvent) -> Result<Self, EventError> {
        let event_id = EventId::new();
        let payload_hash = ContentHash::sha256_bytes(
            &canonical_json_bytes(&input.payload)
                .map_err(|error| EventError::handler_failure(EventId::new(), error.message()))?,
        );

        Ok(Self {
            event_id,
            tenant_id: input.tenant_id,
            actor_id: input.actor_id,
            correlation_id: input.correlation_id,
            causation_id: input.causation_id.unwrap_or(event_id),
            aggregate_type: input.aggregate_type,
            aggregate_id: input.aggregate_id,
            sequence: input.sequence,
            event_kind: input.event_kind,
            schema_version: input.schema_version,
            occurred_at: input.occurred_at,
            payload: input.payload,
            payload_hash,
        })
    }

    #[must_use]
    pub fn stream_key(&self) -> String {
        format!("{}:{}", self.aggregate_type, self.aggregate_id)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditEntry {
    pub audit_entry_id: AuditEntryId,
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub correlation_id: CorrelationId,
    pub causation_id: EventId,
    pub event_id: Option<EventId>,
    pub action: String,
    pub details: Value,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OutboxEntry {
    pub outbox_entry_id: OutboxEntryId,
    pub tenant_id: TenantId,
    pub event_id: EventId,
    pub topic: String,
    pub available_at: DateTime<Utc>,
    pub attempts: u32,
    pub delivered_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InboxEntry {
    pub inbox_entry_id: InboxEntryId,
    pub tenant_id: TenantId,
    pub consumer_name: String,
    pub event_id: EventId,
    pub sequence: u64,
    pub processed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeadLetterEntry {
    pub dead_letter_id: DeadLetterId,
    pub tenant_id: TenantId,
    pub consumer_name: String,
    pub event_id: EventId,
    pub correlation_id: CorrelationId,
    pub sequence: u64,
    pub reason: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProjectionCheckpoint {
    pub consumer_name: String,
    pub tenant_id: TenantId,
    pub stream_key: String,
    pub next_sequence: u64,
}

#[derive(Debug, Default, Clone)]
pub struct AppendOnlyLedger {
    events: Vec<RecordedEvent>,
    audit_entries: Vec<AuditEntry>,
    outbox_entries: Vec<OutboxEntry>,
    event_ids: HashSet<EventId>,
    stream_heads: HashMap<(TenantId, String), u64>,
}

impl AppendOnlyLedger {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn append(&mut self, event: RecordedEvent) -> Result<(), EventError> {
        if self.event_ids.contains(&event.event_id) {
            return Err(EventError::duplicate_event(event.event_id));
        }

        let stream_key = (event.tenant_id, event.stream_key());
        let expected = self
            .stream_heads
            .get(&stream_key)
            .copied()
            .map_or(1, |current| current + 1);
        if event.sequence != expected {
            return Err(EventError::sequence_gap(expected, event.sequence));
        }

        self.event_ids.insert(event.event_id);
        self.stream_heads.insert(stream_key, event.sequence);
        self.audit_entries.push(AuditEntry {
            audit_entry_id: AuditEntryId::new(),
            tenant_id: event.tenant_id,
            actor_id: event.actor_id,
            correlation_id: event.correlation_id,
            causation_id: event.causation_id,
            event_id: Some(event.event_id),
            action: "event.appended".to_owned(),
            details: json!({
                "event_kind": event.event_kind,
                "payload_hash": event.payload_hash.as_str(),
                "sequence": event.sequence,
            }),
            recorded_at: event.occurred_at,
        });
        self.outbox_entries.push(OutboxEntry {
            outbox_entry_id: OutboxEntryId::new(),
            tenant_id: event.tenant_id,
            event_id: event.event_id,
            topic: format!("{}.{}", event.aggregate_type, event.event_kind),
            available_at: event.occurred_at,
            attempts: 0,
            delivered_at: None,
        });
        self.events.push(event);
        Ok(())
    }

    #[must_use]
    pub fn events_by_correlation_id(
        &self,
        tenant_id: TenantId,
        correlation_id: CorrelationId,
    ) -> Vec<&RecordedEvent> {
        let mut events = self
            .events
            .iter()
            .filter(|event| event.tenant_id == tenant_id && event.correlation_id == correlation_id)
            .collect::<Vec<_>>();
        events.sort_by_key(|event| (event.occurred_at, event.sequence));
        events
    }

    #[must_use]
    pub fn audit_entries(&self) -> &[AuditEntry] {
        &self.audit_entries
    }

    #[must_use]
    pub fn outbox_entries(&self) -> &[OutboxEntry] {
        &self.outbox_entries
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryStatus {
    Applied,
    BufferedOutOfOrder,
    DuplicateIgnored,
    DeadLettered,
}

#[derive(Debug, Clone)]
pub struct ProjectionEngine {
    checkpoint: ProjectionCheckpoint,
    pending: BTreeMap<u64, RecordedEvent>,
    processed_ids: BTreeSet<EventId>,
    attempt_counts: HashMap<EventId, u32>,
    applied: Vec<EventId>,
    inbox_entries: Vec<InboxEntry>,
    dead_letters: Vec<DeadLetterEntry>,
    max_attempts: u32,
}

impl ProjectionEngine {
    #[must_use]
    pub fn new(
        consumer_name: impl Into<String>,
        tenant_id: TenantId,
        stream_key: impl Into<String>,
        max_attempts: u32,
    ) -> Self {
        Self {
            checkpoint: ProjectionCheckpoint {
                consumer_name: consumer_name.into(),
                tenant_id,
                stream_key: stream_key.into(),
                next_sequence: 1,
            },
            pending: BTreeMap::new(),
            processed_ids: BTreeSet::new(),
            attempt_counts: HashMap::new(),
            applied: Vec::new(),
            inbox_entries: Vec::new(),
            dead_letters: Vec::new(),
            max_attempts,
        }
    }

    #[must_use]
    pub fn from_checkpoint(checkpoint: ProjectionCheckpoint, max_attempts: u32) -> Self {
        Self {
            checkpoint,
            pending: BTreeMap::new(),
            processed_ids: BTreeSet::new(),
            attempt_counts: HashMap::new(),
            applied: Vec::new(),
            inbox_entries: Vec::new(),
            dead_letters: Vec::new(),
            max_attempts,
        }
    }

    #[must_use]
    pub fn checkpoint(&self) -> ProjectionCheckpoint {
        self.checkpoint.clone()
    }

    #[must_use]
    pub fn applied_event_ids(&self) -> &[EventId] {
        &self.applied
    }

    #[must_use]
    pub fn dead_letters(&self) -> &[DeadLetterEntry] {
        &self.dead_letters
    }

    pub fn deliver<F>(
        &mut self,
        event: RecordedEvent,
        handler: &mut F,
    ) -> Result<DeliveryStatus, EventError>
    where
        F: FnMut(&RecordedEvent) -> Result<(), String>,
    {
        if self.processed_ids.contains(&event.event_id)
            || event.sequence < self.checkpoint.next_sequence
        {
            return Ok(DeliveryStatus::DuplicateIgnored);
        }

        if event.sequence > self.checkpoint.next_sequence {
            self.pending.entry(event.sequence).or_insert(event);
            return Ok(DeliveryStatus::BufferedOutOfOrder);
        }

        self.process_ready(event, handler)
    }

    fn process_ready<F>(
        &mut self,
        first: RecordedEvent,
        handler: &mut F,
    ) -> Result<DeliveryStatus, EventError>
    where
        F: FnMut(&RecordedEvent) -> Result<(), String>,
    {
        let mut current = Some(first);
        let mut final_status = DeliveryStatus::Applied;

        while let Some(event) = current.take() {
            match self.apply_one(&event, handler) {
                Ok(DeliveryStatus::Applied) => {
                    final_status = DeliveryStatus::Applied;
                    if let Some(next) = self.pending.remove(&self.checkpoint.next_sequence) {
                        current = Some(next);
                    }
                }
                Ok(DeliveryStatus::DeadLettered) => {
                    final_status = DeliveryStatus::DeadLettered;
                    if let Some(next) = self.pending.remove(&self.checkpoint.next_sequence) {
                        current = Some(next);
                    }
                }
                Ok(other) => return Ok(other),
                Err(error) => return Err(error),
            }
        }

        Ok(final_status)
    }

    fn apply_one<F>(
        &mut self,
        event: &RecordedEvent,
        handler: &mut F,
    ) -> Result<DeliveryStatus, EventError>
    where
        F: FnMut(&RecordedEvent) -> Result<(), String>,
    {
        match handler(event) {
            Ok(()) => {
                self.processed_ids.insert(event.event_id);
                self.attempt_counts.remove(&event.event_id);
                self.applied.push(event.event_id);
                self.inbox_entries.push(InboxEntry {
                    inbox_entry_id: InboxEntryId::new(),
                    tenant_id: event.tenant_id,
                    consumer_name: self.checkpoint.consumer_name.clone(),
                    event_id: event.event_id,
                    sequence: event.sequence,
                    processed_at: event.occurred_at,
                });
                self.checkpoint.next_sequence = event.sequence + 1;
                Ok(DeliveryStatus::Applied)
            }
            Err(detail) => {
                let attempts = self.attempt_counts.entry(event.event_id).or_insert(0);
                *attempts += 1;

                if *attempts >= self.max_attempts {
                    self.dead_letters.push(DeadLetterEntry {
                        dead_letter_id: DeadLetterId::new(),
                        tenant_id: event.tenant_id,
                        consumer_name: self.checkpoint.consumer_name.clone(),
                        event_id: event.event_id,
                        correlation_id: event.correlation_id,
                        sequence: event.sequence,
                        reason: detail,
                        created_at: event.occurred_at,
                    });
                    self.processed_ids.insert(event.event_id);
                    self.checkpoint.next_sequence = event.sequence + 1;
                    Ok(DeliveryStatus::DeadLettered)
                } else {
                    Err(EventError::handler_failure(event.event_id, &detail))
                }
            }
        }
    }
}

pub fn replay_by_correlation<'a>(
    events: impl IntoIterator<Item = &'a RecordedEvent>,
    tenant_id: TenantId,
    correlation_id: CorrelationId,
) -> Vec<&'a RecordedEvent> {
    let mut filtered = events
        .into_iter()
        .filter(|event| event.tenant_id == tenant_id && event.correlation_id == correlation_id)
        .collect::<Vec<_>>();
    filtered.sort_by_key(|event| (event.occurred_at, event.sequence));
    filtered
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};
    use quantos_core::{ActorId, CorrelationId, SchemaVersion, TenantId};
    use serde_json::json;
    use std::time::{Duration, Instant};

    use super::{
        AppendOnlyLedger, DeliveryStatus, EventError, NewRecordedEvent, ProjectionEngine,
        RecordedEvent, replay_by_correlation,
    };

    fn event_fixture(sequence: u64) -> RecordedEvent {
        let tenant_id =
            TenantId::parse_str("018f52f9-34bf-7da6-a81b-b0a6b5ab4f01").expect("tenant id parses");
        let correlation_id = CorrelationId::parse_str("018f52f9-34bf-7da6-a81b-b0a6b5ab4f02")
            .expect("correlation id parses");
        RecordedEvent::new(NewRecordedEvent {
            tenant_id,
            actor_id: ActorId::parse_str("018f52f9-34bf-7da6-a81b-b0a6b5ab4f03")
                .expect("actor id parses"),
            correlation_id,
            causation_id: None,
            aggregate_type: "trade".to_owned(),
            aggregate_id: "btc-usdt".to_owned(),
            sequence,
            event_kind: "TradeCommandAccepted".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            occurred_at: Utc
                .with_ymd_and_hms(2026, 7, 28, 12, 0, 0)
                .single()
                .expect("valid timestamp"),
            payload: json!({ "sequence": sequence, "symbol": "BTCUSDT" }),
        })
        .expect("event builds")
    }

    #[test]
    fn duplicate_events_are_rejected_at_append_time() {
        let mut ledger = AppendOnlyLedger::new();
        let event = event_fixture(1);
        let duplicate = event.clone();

        ledger.append(event).expect("event appends");
        let error = ledger
            .append(duplicate)
            .expect_err("duplicate append should fail");

        assert_eq!(error.machine_code(), "EVENT_DUPLICATE_EVENT");
    }

    #[test]
    fn provenance_is_required_and_replay_filters_the_tenant_boundary() {
        let root = event_fixture(1);
        assert_eq!(root.causation_id, root.event_id);
        let child = RecordedEvent::new(NewRecordedEvent {
            tenant_id: root.tenant_id,
            actor_id: root.actor_id,
            correlation_id: root.correlation_id,
            causation_id: Some(root.event_id),
            aggregate_type: root.aggregate_type.clone(),
            aggregate_id: root.aggregate_id.clone(),
            sequence: 2,
            event_kind: "TradeCommandApplied".to_owned(),
            schema_version: root.schema_version.clone(),
            occurred_at: root.occurred_at,
            payload: json!({ "sequence": 2 }),
        })
        .expect("child event builds");
        assert_eq!(child.causation_id, root.event_id);

        let mut other_tenant = child.clone();
        other_tenant.tenant_id = TenantId::new();
        let events = [other_tenant, child.clone(), root.clone()];
        let replayed = replay_by_correlation(events.iter(), root.tenant_id, root.correlation_id);
        assert_eq!(replayed, vec![&root, &child]);

        let mut ledger = AppendOnlyLedger::new();
        ledger.append(root.clone()).expect("root appends");
        assert!(
            ledger
                .events_by_correlation_id(TenantId::new(), root.correlation_id)
                .is_empty()
        );
        assert!(
            ledger
                .events_by_correlation_id(root.tenant_id, CorrelationId::new())
                .is_empty()
        );
        assert_eq!(
            ledger.events_by_correlation_id(root.tenant_id, root.correlation_id),
            vec![&root]
        );
        let audit = &ledger.audit_entries()[0];
        assert_eq!(audit.actor_id, root.actor_id);
        assert_eq!(audit.causation_id, root.event_id);
    }

    #[test]
    fn projection_buffers_out_of_order_events_and_replays_in_sequence() {
        let stream_key = "trade:btc-usdt";
        let mut engine =
            ProjectionEngine::new("risk-projection", event_fixture(1).tenant_id, stream_key, 3);
        let mut applied = Vec::new();

        let status = engine
            .deliver(event_fixture(2), &mut |event| {
                applied.push(event.sequence);
                Ok(())
            })
            .expect("out-of-order event should buffer");
        assert_eq!(status, DeliveryStatus::BufferedOutOfOrder);

        engine
            .deliver(event_fixture(1), &mut |event| {
                applied.push(event.sequence);
                Ok(())
            })
            .expect("in-order event should apply");

        assert_eq!(applied, vec![1, 2]);
    }

    #[test]
    fn projection_ignores_duplicate_deliveries() {
        let tenant_id = event_fixture(1).tenant_id;
        let mut engine = ProjectionEngine::new("inbox", tenant_id, "trade:btc-usdt", 3);
        let mut applied = 0_u32;
        let event = event_fixture(1);

        let first = engine
            .deliver(event.clone(), &mut |_| {
                applied += 1;
                Ok(())
            })
            .expect("first delivery succeeds");
        let second = engine
            .deliver(event, &mut |_| {
                applied += 1;
                Ok(())
            })
            .expect("duplicate delivery should be ignored");

        assert_eq!(first, DeliveryStatus::Applied);
        assert_eq!(second, DeliveryStatus::DuplicateIgnored);
        assert_eq!(applied, 1);
    }

    #[test]
    fn projection_ignores_old_sequences_and_keeps_first_buffered_delivery() {
        let tenant_id = event_fixture(1).tenant_id;
        let mut engine = ProjectionEngine::new("inbox", tenant_id, "trade:btc-usdt", 3);
        let first = event_fixture(1);

        engine
            .deliver(first, &mut |_| Ok(()))
            .expect("first event applies");

        let old_sequence = event_fixture(1);
        assert_eq!(
            engine
                .deliver(old_sequence, &mut |_| {
                    panic!("old sequence must not be applied")
                })
                .expect("old sequence is ignored"),
            DeliveryStatus::DuplicateIgnored
        );

        let first_buffered = event_fixture(3);
        let first_buffered_id = first_buffered.event_id;
        let replacement = event_fixture(3);
        engine
            .deliver(first_buffered, &mut |_| Ok(()))
            .expect("future event buffers");
        engine
            .deliver(replacement, &mut |_| Ok(()))
            .expect("duplicate future sequence remains buffered");

        let mut applied = Vec::new();
        engine
            .deliver(event_fixture(2), &mut |event| {
                applied.push(event.event_id);
                Ok(())
            })
            .expect("sequence gap closes");

        assert_eq!(applied.len(), 2);
        assert_eq!(applied[1], first_buffered_id);
    }

    #[test]
    fn projection_can_resume_after_restart_from_checkpoint() {
        let tenant_id = event_fixture(1).tenant_id;
        let mut first_engine = ProjectionEngine::new("replay", tenant_id, "trade:btc-usdt", 3);

        first_engine
            .deliver(event_fixture(1), &mut |_| Ok(()))
            .expect("first event applies");

        let checkpoint = first_engine.checkpoint();
        let mut second_engine = ProjectionEngine::from_checkpoint(checkpoint, 3);
        let mut applied = Vec::new();
        second_engine
            .deliver(event_fixture(2), &mut |event| {
                applied.push(event.sequence);
                Ok(())
            })
            .expect("second event applies after restart");

        assert_eq!(applied, vec![2]);
        assert_eq!(second_engine.checkpoint().next_sequence, 3);
    }

    #[test]
    fn projection_sends_poison_messages_to_dead_letter_after_max_attempts() {
        let tenant_id = event_fixture(1).tenant_id;
        let mut engine = ProjectionEngine::new("audit", tenant_id, "trade:btc-usdt", 3);

        engine
            .deliver(event_fixture(1), &mut |_| Ok(()))
            .expect("sequence 1 applies");

        let failing_event = event_fixture(2);
        for attempt in 1..=2 {
            let error = engine
                .deliver(failing_event.clone(), &mut |_| {
                    Err("broker unavailable".to_owned())
                })
                .expect_err("delivery should fail before dead-lettering");
            assert_eq!(error.machine_code(), "EVENT_HANDLER_FAILURE");
            assert_eq!(
                engine.dead_letters().len(),
                0,
                "attempt {attempt} should not dead-letter yet"
            );
        }

        let status = engine
            .deliver(failing_event, &mut |_| Err("broker unavailable".to_owned()))
            .expect("third failure should dead-letter");
        assert_eq!(status, DeliveryStatus::DeadLettered);
        assert_eq!(engine.dead_letters().len(), 1);
        assert_eq!(engine.checkpoint().next_sequence, 3);
    }

    #[test]
    fn projection_continues_with_buffered_event_after_dead_letter() {
        let tenant_id = event_fixture(1).tenant_id;
        let mut engine = ProjectionEngine::new("audit", tenant_id, "trade:btc-usdt", 1);

        engine
            .deliver(event_fixture(2), &mut |_| Ok(()))
            .expect("future event buffers");

        let mut applied = Vec::new();
        let status = engine
            .deliver(event_fixture(1), &mut |event| {
                if event.sequence == 1 {
                    Err("invalid payload".to_owned())
                } else {
                    applied.push(event.sequence);
                    Ok(())
                }
            })
            .expect("dead-lettering advances to buffered event");

        assert_eq!(status, DeliveryStatus::Applied);
        assert_eq!(engine.dead_letters().len(), 1);
        assert_eq!(applied, vec![2]);
        assert_eq!(engine.checkpoint().next_sequence, 3);
    }

    #[test]
    fn ledger_replays_ten_thousand_events_without_loss() {
        let mut ledger = AppendOnlyLedger::new();
        let tenant_id = event_fixture(1).tenant_id;
        let correlation_id = event_fixture(1).correlation_id;
        let mut engine = ProjectionEngine::new("batch", tenant_id, "trade:btc-usdt", 3);
        let mut applied = 0_u64;

        for sequence in 1..=10_000 {
            let event = event_fixture(sequence);
            ledger.append(event.clone()).expect("event appends");
            engine
                .deliver(event, &mut |_| {
                    applied += 1;
                    Ok(())
                })
                .expect("event delivers");
        }

        let started_at = Instant::now();
        let replayed = ledger.events_by_correlation_id(tenant_id, correlation_id);

        assert_eq!(ledger.audit_entries().len(), 10_000);
        assert_eq!(ledger.outbox_entries().len(), 10_000);
        assert_eq!(replayed.len(), 10_000);
        assert_eq!(applied, 10_000);
        assert!(started_at.elapsed() < Duration::from_secs(5));
        assert_eq!(engine.applied_event_ids().len(), 10_000);
    }

    #[test]
    fn append_rejects_sequence_gaps() {
        let mut ledger = AppendOnlyLedger::new();
        ledger
            .append(event_fixture(1))
            .expect("first event appends");

        let error = ledger
            .append(event_fixture(3))
            .expect_err("gap should fail");

        assert_eq!(error, EventError::sequence_gap(2, 3));
    }
}
