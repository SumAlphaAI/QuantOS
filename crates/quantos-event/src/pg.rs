use chrono::{DateTime, Utc};
use native_tls::TlsConnector;
use postgres::{
    Client, NoTls, Row, Transaction,
    types::{Json, Type},
};
use postgres_native_tls::MakeTlsConnector;
use thiserror::Error;
use url::Url;
use uuid::Uuid;

use crate::{
    AuditEntry, DeadLetterEntry, EventError, OutboxEntry, ProjectionCheckpoint, RecordedEvent,
};
use quantos_core::{
    AuditEntryId, ContentHash, CoreError, CorrelationId, DeadLetterId, EventId, OutboxEntryId,
    SchemaVersion, TenantId,
};

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedOutboxEntry {
    pub outbox: OutboxEntry,
    pub event: RecordedEvent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InboxFailureOutcome {
    pub attempts: u32,
    pub dead_lettered: bool,
}

#[derive(Debug, Error)]
pub enum PgEventStoreError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
    #[error(transparent)]
    Event(#[from] EventError),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("missing event log row for event `{0}`")]
    MissingEvent(EventId),
}

pub struct PgEventStore {
    client: Client,
}

impl PgEventStore {
    pub fn connect(database_url: &str) -> Result<Self, PgEventStoreError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
    }

    pub fn append_event(&mut self, event: &RecordedEvent) -> Result<(), PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        if find_event_log_uuid(&mut tx, event.event_id)?.is_some() {
            return Err(EventError::duplicate_event(event.event_id).into());
        }
        let stream_id = ensure_stream(&mut tx, event)?;
        tx.execute_typed(
            "select 1 from quantos.event_streams where id = $1 for update",
            &[(&stream_id, Type::UUID)],
        )?;
        let expected = expected_sequence(&mut tx, stream_id)?;
        if event.sequence != expected {
            return Err(EventError::sequence_gap(expected, event.sequence).into());
        }

        let payload = Json(&event.payload);
        tx.execute_typed(
            "insert into quantos.event_log (
                tenant_id, stream_id, event_id, correlation_id, aggregate_type, aggregate_id,
                sequence, event_kind, schema_version, payload, payload_hash, occurred_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&stream_id, Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (event.correlation_id.as_uuid(), Type::UUID),
                (&event.aggregate_type, Type::TEXT),
                (&event.aggregate_id, Type::TEXT),
                (&(event.sequence as i64), Type::INT8),
                (&event.event_kind, Type::TEXT),
                (&event.schema_version.as_str(), Type::TEXT),
                (&payload, Type::JSONB),
                (&event.payload_hash.as_str(), Type::TEXT),
                (&event.occurred_at, Type::TIMESTAMPTZ),
            ],
        )?;

        let audit_details = Json(&serde_json::json!({
            "event_kind": event.event_kind,
            "payload_hash": event.payload_hash.as_str(),
            "sequence": event.sequence,
        }));
        tx.execute_typed(
            "insert into quantos.audit_entries (
                tenant_id, correlation_id, event_id, action, details, recorded_at
            ) values ($1,$2,$3,$4,$5,$6)",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (event.correlation_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (&"event.appended", Type::TEXT),
                (&audit_details, Type::JSONB),
                (&event.occurred_at, Type::TIMESTAMPTZ),
            ],
        )?;

        let event_log_id = find_event_log_uuid(&mut tx, event.event_id)?
            .ok_or(PgEventStoreError::MissingEvent(event.event_id))?;

        tx.execute_typed(
            "insert into quantos.event_outbox (
                tenant_id, event_log_id, topic, status, attempts, available_at
            ) values ($1,$2,$3,'pending',0,$4)",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&event_log_id, Type::UUID),
                (
                    &format!("{}.{}", event.aggregate_type, event.event_kind),
                    Type::TEXT,
                ),
                (&event.occurred_at, Type::TIMESTAMPTZ),
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn events_by_correlation_id(
        &mut self,
        correlation_id: CorrelationId,
    ) -> Result<Vec<RecordedEvent>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select event_id, tenant_id, correlation_id, aggregate_type, aggregate_id,
                    sequence, event_kind, schema_version, occurred_at, payload, payload_hash
             from quantos.event_log
             where correlation_id = $1
             order by occurred_at asc, sequence asc",
            &[(correlation_id.as_uuid(), Type::UUID)],
        )?;

        rows.iter().map(row_to_recorded_event).collect()
    }

    pub fn pending_outbox(
        &mut self,
        limit: i64,
    ) -> Result<Vec<PersistedOutboxEntry>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select o.id as outbox_id, o.tenant_id as outbox_tenant_id, o.topic, o.available_at,
                    o.attempts, o.dispatched_at,
                    e.event_id, e.tenant_id, e.correlation_id, e.aggregate_type, e.aggregate_id,
                    e.sequence, e.event_kind, e.schema_version, e.occurred_at, e.payload, e.payload_hash
             from quantos.event_outbox as o
             join quantos.event_log as e on e.id = o.event_log_id
             where o.status = 'pending'
             order by o.available_at asc
             limit $1",
            &[(&limit, Type::INT8)],
        )?;

        rows.iter()
            .map(|row| {
                Ok(PersistedOutboxEntry {
                    outbox: OutboxEntry {
                        outbox_entry_id: OutboxEntryId::from_uuid(row.get("outbox_id")),
                        tenant_id: TenantId::from_uuid(row.get("outbox_tenant_id")),
                        event_id: EventId::from_uuid(row.get("event_id")),
                        topic: row.get("topic"),
                        available_at: row.get("available_at"),
                        attempts: row.get::<_, i32>("attempts") as u32,
                        delivered_at: row.get("dispatched_at"),
                    },
                    event: row_to_recorded_event(row)?,
                })
            })
            .collect()
    }

    pub fn mark_outbox_dispatched(
        &mut self,
        outbox_entry_id: OutboxEntryId,
        dispatched_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        self.client.execute_typed(
            "update quantos.event_outbox
             set status = 'dispatched', dispatched_at = $2
             where id = $1",
            &[
                (outbox_entry_id.as_uuid(), Type::UUID),
                (&dispatched_at, Type::TIMESTAMPTZ),
            ],
        )?;
        Ok(())
    }

    pub fn record_outbox_failure(
        &mut self,
        outbox_entry_id: OutboxEntryId,
        reason: &str,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
    ) -> Result<bool, PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let row = tx.query_typed_one(
            "update quantos.event_outbox as o
             set attempts = o.attempts + 1,
                 status = case when o.attempts + 1 >= $2 then 'dead_letter' else 'pending' end
             from quantos.event_log as e
             where o.id = $1 and e.id = o.event_log_id
             returning o.tenant_id, e.event_id, e.correlation_id, e.sequence, o.attempts, e.payload",
            &[
                (outbox_entry_id.as_uuid(), Type::UUID),
                (&(max_attempts as i32), Type::INT4),
            ],
        )?;

        let attempts = row.get::<_, i32>("attempts") as u32;
        let dead_lettered = attempts >= max_attempts;
        if dead_lettered {
            let dead_payload = Json(&row.get::<_, serde_json::Value>("payload"));
            tx.execute_typed(
                "insert into quantos.event_dead_letters (
                    tenant_id, source, event_id, correlation_id, sequence, reason, payload, created_at
                ) values ($1, 'outbox', $2, $3, $4, $5, $6, $7)",
                &[
                    (&row.get::<_, Uuid>("tenant_id"), Type::UUID),
                    (&row.get::<_, Uuid>("event_id"), Type::UUID),
                    (&row.get::<_, Uuid>("correlation_id"), Type::UUID),
                    (&row.get::<_, i64>("sequence"), Type::INT8),
                    (&reason, Type::TEXT),
                    (&dead_payload, Type::JSONB),
                    (&observed_at, Type::TIMESTAMPTZ),
                ],
            )?;
        }

        tx.commit()?;
        Ok(dead_lettered)
    }

    pub fn record_inbox_success(
        &mut self,
        consumer_name: &str,
        event: &RecordedEvent,
        processed_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let event_log_id = find_event_log_uuid(&mut tx, event.event_id)?
            .ok_or(PgEventStoreError::MissingEvent(event.event_id))?;

        tx.execute_typed(
            "insert into quantos.event_inbox (
                tenant_id, consumer_name, event_log_id, event_id, status, attempts, received_at, processed_at
            ) values ($1,$2,$3,$4,'applied',1,$5,$5)
            on conflict (tenant_id, consumer_name, event_id)
            do update set
                status = 'applied',
                attempts = quantos.event_inbox.attempts + 1,
                processed_at = excluded.processed_at",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
                (&event_log_id, Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (&processed_at, Type::TIMESTAMPTZ),
            ],
        )?;

        save_checkpoint_tx(
            &mut tx,
            &ProjectionCheckpoint {
                consumer_name: consumer_name.to_owned(),
                tenant_id: event.tenant_id,
                stream_key: event.stream_key(),
                next_sequence: event.sequence + 1,
            },
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn record_inbox_failure(
        &mut self,
        consumer_name: &str,
        event: &RecordedEvent,
        reason: &str,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
    ) -> Result<InboxFailureOutcome, PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let event_log_id = find_event_log_uuid(&mut tx, event.event_id)?
            .ok_or(PgEventStoreError::MissingEvent(event.event_id))?;

        let row = tx.query_typed_one(
            "insert into quantos.event_inbox (
                tenant_id, consumer_name, event_log_id, event_id, status, attempts, received_at
            ) values ($1,$2,$3,$4,'pending',1,$5)
            on conflict (tenant_id, consumer_name, event_id)
            do update set
                attempts = quantos.event_inbox.attempts + 1,
                status = case
                    when quantos.event_inbox.attempts + 1 >= $6 then 'dead_letter'
                    else 'pending'
                end
            returning id, attempts, status",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
                (&event_log_id, Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
                (&(max_attempts as i32), Type::INT4),
            ],
        )?;

        let attempts = row.get::<_, i32>("attempts") as u32;
        let status: String = row.get("status");
        let dead_lettered = status == "dead_letter";

        if dead_lettered {
            tx.execute_typed(
                "update quantos.event_inbox
                 set processed_at = $2
                 where id = $1",
                &[
                    (&row.get::<_, Uuid>("id"), Type::UUID),
                    (&observed_at, Type::TIMESTAMPTZ),
                ],
            )?;
            let dead_payload = Json(&event.payload);
            tx.execute_typed(
                "insert into quantos.event_dead_letters (
                    tenant_id, source, consumer_name, event_id, correlation_id, sequence, reason, payload, created_at
                ) values ($1, 'inbox', $2, $3, $4, $5, $6, $7, $8)",
                &[
                    (event.tenant_id.as_uuid(), Type::UUID),
                    (&consumer_name, Type::TEXT),
                    (event.event_id.as_uuid(), Type::UUID),
                    (event.correlation_id.as_uuid(), Type::UUID),
                    (&(event.sequence as i64), Type::INT8),
                    (&reason, Type::TEXT),
                    (&dead_payload, Type::JSONB),
                    (&observed_at, Type::TIMESTAMPTZ),
                ],
            )?;
            save_checkpoint_tx(
                &mut tx,
                &ProjectionCheckpoint {
                    consumer_name: consumer_name.to_owned(),
                    tenant_id: event.tenant_id,
                    stream_key: event.stream_key(),
                    next_sequence: event.sequence + 1,
                },
            )?;
        }

        tx.commit()?;
        Ok(InboxFailureOutcome {
            attempts,
            dead_lettered,
        })
    }

    pub fn load_checkpoint(
        &mut self,
        tenant_id: TenantId,
        consumer_name: &str,
        stream_key: &str,
    ) -> Result<Option<ProjectionCheckpoint>, PgEventStoreError> {
        let row = self.client.query_typed_opt(
            "select last_sequence
             from quantos.projection_checkpoints
             where tenant_id = $1 and consumer_name = $2 and stream_key = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
                (&stream_key, Type::TEXT),
            ],
        )?;

        Ok(row.map(|row| ProjectionCheckpoint {
            consumer_name: consumer_name.to_owned(),
            tenant_id,
            stream_key: stream_key.to_owned(),
            next_sequence: row.get::<_, i64>("last_sequence") as u64 + 1,
        }))
    }

    pub fn save_checkpoint(
        &mut self,
        checkpoint: &ProjectionCheckpoint,
    ) -> Result<(), PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        save_checkpoint_tx(&mut tx, checkpoint)?;
        tx.commit()?;
        Ok(())
    }

    pub fn audit_entries_by_correlation_id(
        &mut self,
        correlation_id: CorrelationId,
    ) -> Result<Vec<AuditEntry>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select id, tenant_id, correlation_id, event_id, action, details, recorded_at
             from quantos.audit_entries
             where correlation_id = $1
             order by recorded_at asc",
            &[(correlation_id.as_uuid(), Type::UUID)],
        )?;

        Ok(rows.iter().map(row_to_audit_entry).collect())
    }

    pub fn dead_letters(
        &mut self,
        tenant_id: TenantId,
        consumer_name: &str,
    ) -> Result<Vec<DeadLetterEntry>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select id, tenant_id, consumer_name, event_id, correlation_id, sequence, reason, created_at
             from quantos.event_dead_letters
             where tenant_id = $1 and coalesce(consumer_name, '') = $2
             order by created_at asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
            ],
        )?;

        Ok(rows.iter().map(row_to_dead_letter_entry).collect())
    }
}

fn connect_client(database_url: &str) -> Result<Client, PgEventStoreError> {
    let url = Url::parse(database_url)?;
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Ok(Client::connect(database_url, NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build()?;
        Ok(Client::connect(
            database_url,
            MakeTlsConnector::new(connector),
        )?)
    }
}

fn ensure_stream(
    tx: &mut Transaction<'_>,
    event: &RecordedEvent,
) -> Result<Uuid, PgEventStoreError> {
    let row = tx.query_typed_one(
        "insert into quantos.event_streams (tenant_id, aggregate_type, aggregate_id)
         values ($1,$2,$3)
         on conflict (tenant_id, aggregate_type, aggregate_id)
         do update set updated_at = now()
         returning id",
        &[
            (event.tenant_id.as_uuid(), Type::UUID),
            (&event.aggregate_type, Type::TEXT),
            (&event.aggregate_id, Type::TEXT),
        ],
    )?;
    Ok(row.get("id"))
}

fn expected_sequence(tx: &mut Transaction<'_>, stream_id: Uuid) -> Result<u64, PgEventStoreError> {
    let row = tx.query_typed_one(
        "select coalesce(max(sequence), 0) as max_sequence
         from quantos.event_log
         where stream_id = $1",
        &[(&stream_id, Type::UUID)],
    )?;
    Ok(row.get::<_, i64>("max_sequence") as u64 + 1)
}

fn find_event_log_uuid(
    tx: &mut Transaction<'_>,
    event_id: EventId,
) -> Result<Option<Uuid>, PgEventStoreError> {
    Ok(tx
        .query_typed_opt(
            "select id from quantos.event_log where event_id = $1",
            &[(event_id.as_uuid(), Type::UUID)],
        )?
        .map(|row| row.get("id")))
}

fn save_checkpoint_tx(
    tx: &mut Transaction<'_>,
    checkpoint: &ProjectionCheckpoint,
) -> Result<(), PgEventStoreError> {
    let last_sequence = checkpoint.next_sequence.saturating_sub(1) as i64;
    tx.execute_typed(
        "insert into quantos.projection_checkpoints (
            tenant_id, consumer_name, stream_key, last_sequence, updated_at
        ) values ($1,$2,$3,$4,now())
        on conflict (tenant_id, consumer_name, stream_key)
        do update set
            last_sequence = greatest(quantos.projection_checkpoints.last_sequence, excluded.last_sequence),
            updated_at = now()",
        &[
            (checkpoint.tenant_id.as_uuid(), Type::UUID),
            (&checkpoint.consumer_name, Type::TEXT),
            (&checkpoint.stream_key, Type::TEXT),
            (&last_sequence, Type::INT8),
        ],
    )?;
    Ok(())
}

fn row_to_recorded_event(row: &Row) -> Result<RecordedEvent, PgEventStoreError> {
    Ok(RecordedEvent {
        event_id: EventId::from_uuid(row.get("event_id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        aggregate_type: row.get("aggregate_type"),
        aggregate_id: row.get("aggregate_id"),
        sequence: row.get::<_, i64>("sequence") as u64,
        event_kind: row.get("event_kind"),
        schema_version: SchemaVersion::parse(row.get::<_, String>("schema_version").as_str())?,
        occurred_at: row.get("occurred_at"),
        payload: row.get("payload"),
        payload_hash: ContentHash::parse(row.get::<_, String>("payload_hash").as_str())?,
    })
}

fn row_to_audit_entry(row: &Row) -> AuditEntry {
    AuditEntry {
        audit_entry_id: AuditEntryId::from_uuid(row.get("id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        event_id: row
            .get::<_, Option<Uuid>>("event_id")
            .map(EventId::from_uuid),
        action: row.get("action"),
        details: row.get("details"),
        recorded_at: row.get("recorded_at"),
    }
}

fn row_to_dead_letter_entry(row: &Row) -> DeadLetterEntry {
    DeadLetterEntry {
        dead_letter_id: DeadLetterId::from_uuid(row.get("id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        consumer_name: row
            .get::<_, Option<String>>("consumer_name")
            .unwrap_or_default(),
        event_id: EventId::from_uuid(row.get("event_id")),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        sequence: row.get::<_, i64>("sequence") as u64,
        reason: row.get("reason"),
        created_at: row.get("created_at"),
    }
}
