use chrono::{DateTime, Duration as ChronoDuration, Utc};
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
    ActorId, AuditEntryId, ContentHash, CoreError, CorrelationId, DeadLetterId, EventId,
    InboxEntryId, OutboxEntryId, SchemaVersion, TenantId,
};

#[derive(Debug, Clone, PartialEq)]
pub struct LeasedOutboxEntry {
    pub outbox: OutboxEntry,
    pub event: RecordedEvent,
    pub lease_owner: String,
    pub lease_token: Uuid,
    pub lease_expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InboxProcessingClaim {
    pub inbox_entry_id: InboxEntryId,
    pub consumer_name: String,
    pub attempts: u32,
    pub lease_owner: String,
    pub lease_token: Uuid,
    pub lease_expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InboxClaimDecision {
    Claimed(InboxProcessingClaim),
    AlreadyApplied,
    Busy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InboxFailureOutcome {
    pub attempts: u32,
    pub dead_lettered: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PollingDispatchReport {
    pub claimed: usize,
    pub processed: usize,
    pub duplicate_skipped: usize,
    pub retried: usize,
    pub dead_lettered: usize,
    pub notify_failures: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventStoreHealth {
    pub pending_outbox: i64,
    pub expired_outbox_leases: i64,
    pub pending_inbox: i64,
    pub expired_inbox_leases: i64,
    pub pending_dead_letters: i64,
    pub oldest_outbox_age_seconds: i64,
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
    #[error("EVENT_STALE_LEASE: {kind} `{id}` is no longer owned by this claim")]
    StaleLease { kind: &'static str, id: Uuid },
    #[error("EVENT_DEAD_LETTER_NOT_REPLAYABLE: dead letter `{0}` is missing or already replayed")]
    DeadLetterNotReplayable(DeadLetterId),
    #[error("EVENT_ACTOR_NOT_AUTHORIZED: actor `{actor_id}` is not active in tenant `{tenant_id}`")]
    ActorNotAuthorized {
        tenant_id: TenantId,
        actor_id: ActorId,
    },
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
                tenant_id, stream_id, event_id, actor_id, correlation_id, causation_id,
                aggregate_type, aggregate_id, sequence, event_kind, schema_version, payload,
                payload_hash, occurred_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&stream_id, Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (event.actor_id.as_uuid(), Type::UUID),
                (event.correlation_id.as_uuid(), Type::UUID),
                (event.causation_id.as_uuid(), Type::UUID),
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
                tenant_id, actor_id, correlation_id, causation_id, event_id, action, details, recorded_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8)",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (event.actor_id.as_uuid(), Type::UUID),
                (event.correlation_id.as_uuid(), Type::UUID),
                (event.causation_id.as_uuid(), Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (&"event.appended", Type::TEXT),
                (&audit_details, Type::JSONB),
                (&event.occurred_at, Type::TIMESTAMPTZ),
            ],
        )?;

        let event_log_id = find_event_log_uuid(&mut tx, event.event_id)?
            .ok_or(PgEventStoreError::MissingEvent(event.event_id))?;

        tx.execute_typed(
            "insert into quantos.outbox_event (
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
        tenant_id: TenantId,
        correlation_id: CorrelationId,
    ) -> Result<Vec<RecordedEvent>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select event_id, tenant_id, actor_id, correlation_id, causation_id, aggregate_type, aggregate_id,
                    sequence, event_kind, schema_version, occurred_at, payload, payload_hash
             from quantos.event_log
             where tenant_id = $1 and correlation_id = $2
             order by occurred_at asc, sequence asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
        )?;

        rows.iter().map(row_to_recorded_event).collect()
    }

    pub fn claim_outbox_events(
        &mut self,
        worker_name: &str,
        limit: i64,
        observed_at: DateTime<Utc>,
        lease_duration: ChronoDuration,
    ) -> Result<Vec<LeasedOutboxEntry>, PgEventStoreError> {
        let lease_expires_at = observed_at + lease_duration;
        let rows = self.client.query_typed(
            "with candidate as (
                select o.id
                from quantos.outbox_event as o
                where o.available_at <= $3
                  and (
                    o.status = 'pending'
                    or (
                      o.status = 'leased'
                      and coalesce(o.lease_expires_at, '-infinity'::timestamptz) <= $3
                    )
                  )
                order by o.available_at asc, o.id asc
                for update skip locked
                limit $4
            ),
            claimed as (
                update quantos.outbox_event as o
                set status = 'leased',
                    attempts = o.attempts + 1,
                    lease_owner = $1,
                    lease_token = gen_random_uuid(),
                    lease_expires_at = $2,
                    updated_at = $3
                from candidate
                where o.id = candidate.id
                returning o.id as outbox_id,
                          o.tenant_id as outbox_tenant_id,
                          o.event_log_id,
                          o.topic,
                          o.available_at,
                          o.attempts,
                          o.dispatched_at,
                          o.lease_owner,
                          o.lease_token,
                          o.lease_expires_at
            )
            select c.outbox_id, c.outbox_tenant_id, c.topic, c.available_at, c.attempts,
                   c.dispatched_at, c.lease_owner, c.lease_token, c.lease_expires_at,
                   e.event_id, e.tenant_id, e.actor_id, e.correlation_id, e.causation_id,
                   e.aggregate_type, e.aggregate_id,
                   e.sequence, e.event_kind, e.schema_version, e.occurred_at, e.payload, e.payload_hash
            from claimed as c
            join quantos.event_log as e on e.id = c.event_log_id
            order by c.available_at asc, c.outbox_id asc",
            &[
                (&worker_name, Type::TEXT),
                (&lease_expires_at, Type::TIMESTAMPTZ),
                (&observed_at, Type::TIMESTAMPTZ),
                (&limit, Type::INT8),
            ],
        )?;

        rows.iter()
            .map(|row| {
                Ok(LeasedOutboxEntry {
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
                    lease_owner: row.get("lease_owner"),
                    lease_token: row.get("lease_token"),
                    lease_expires_at: row.get("lease_expires_at"),
                })
            })
            .collect()
    }

    pub fn mark_outbox_dispatched(
        &mut self,
        claim: &LeasedOutboxEntry,
        dispatched_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        let updated = self.client.execute_typed(
            "update quantos.outbox_event
             set status = 'dispatched',
                 dispatched_at = $2,
                 lease_owner = null,
                 lease_expires_at = null,
                 lease_token = null,
                 last_error = null,
                 updated_at = $2
             where id = $1
               and status = 'leased'
               and lease_owner = $3
               and lease_token = $4
               and lease_expires_at >= $2",
            &[
                (claim.outbox.outbox_entry_id.as_uuid(), Type::UUID),
                (&dispatched_at, Type::TIMESTAMPTZ),
                (&claim.lease_owner, Type::TEXT),
                (&claim.lease_token, Type::UUID),
            ],
        )?;
        if updated != 1 {
            return Err(PgEventStoreError::StaleLease {
                kind: "outbox",
                id: *claim.outbox.outbox_entry_id.as_uuid(),
            });
        }
        Ok(())
    }

    pub fn record_outbox_failure(
        &mut self,
        claim: &LeasedOutboxEntry,
        consumer_name: &str,
        reason: &str,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
    ) -> Result<bool, PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let row = tx.query_typed_opt(
            "update quantos.outbox_event as o
             set status = case
                    when o.attempts >= $2 then 'dead_letter'
                    else 'pending'
                 end,
                 available_at = case
                    when o.attempts >= $2 then o.available_at
                    else $3 + make_interval(
                        secs => cast(power(2, greatest(least(o.attempts - 1, 6), 0)) as integer)
                    )
                 end,
                 lease_owner = null,
                 lease_expires_at = null,
                 lease_token = null,
                 last_error = $4,
                 updated_at = $5
             from quantos.event_log as e
             where o.id = $1
               and e.id = o.event_log_id
               and o.status = 'leased'
               and o.lease_owner = $6
               and o.lease_token = $7
               and o.lease_expires_at >= $5
             returning o.tenant_id, e.event_id, e.correlation_id, e.sequence, o.attempts, o.status, e.payload",
            &[
                (claim.outbox.outbox_entry_id.as_uuid(), Type::UUID),
                (&(max_attempts as i32), Type::INT4),
                (&observed_at, Type::TIMESTAMPTZ),
                (&reason, Type::TEXT),
                (&observed_at, Type::TIMESTAMPTZ),
                (&claim.lease_owner, Type::TEXT),
                (&claim.lease_token, Type::UUID),
            ],
        )?
        .ok_or(PgEventStoreError::StaleLease {
            kind: "outbox",
            id: *claim.outbox.outbox_entry_id.as_uuid(),
        })?;

        let dead_lettered = row.get::<_, String>("status") == "dead_letter";
        if dead_lettered {
            let dead_payload = Json(&row.get::<_, serde_json::Value>("payload"));
            tx.execute_typed(
                "insert into quantos.dead_letter_event (
                    tenant_id, source, consumer_name, event_id, actor_id, correlation_id,
                    causation_id, sequence, reason, payload, created_at
                ) values ($1, 'outbox', $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                &[
                    (&row.get::<_, Uuid>("tenant_id"), Type::UUID),
                    (&consumer_name, Type::TEXT),
                    (&row.get::<_, Uuid>("event_id"), Type::UUID),
                    (claim.event.actor_id.as_uuid(), Type::UUID),
                    (&row.get::<_, Uuid>("correlation_id"), Type::UUID),
                    (claim.event.causation_id.as_uuid(), Type::UUID),
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

    pub fn claim_inbox_processing(
        &mut self,
        consumer_name: &str,
        worker_name: &str,
        event: &RecordedEvent,
        observed_at: DateTime<Utc>,
        lease_duration: ChronoDuration,
    ) -> Result<InboxClaimDecision, PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let event_log_id = find_event_log_uuid(&mut tx, event.event_id)?
            .ok_or(PgEventStoreError::MissingEvent(event.event_id))?;
        let lease_expires_at = observed_at + lease_duration;

        tx.execute_typed(
            "insert into quantos.inbox_receipt (
                tenant_id, consumer_name, event_log_id, event_id, status, attempts,
                first_received_at, last_attempt_at, next_attempt_at
            ) values ($1,$2,$3,$4,'pending',0,$5,$5,$5)
            on conflict (tenant_id, consumer_name, event_id)
            do nothing",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
                (&event_log_id, Type::UUID),
                (event.event_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;

        let claimed = tx.query_typed_opt(
            "with candidate as (
                select i.id
                from quantos.inbox_receipt as i
                where i.tenant_id = $1
                  and i.consumer_name = $2
                  and i.event_id = $3
                  and i.status in ('pending', 'processing')
                  and i.next_attempt_at <= $4
                  and coalesce(i.lease_expires_at, '-infinity'::timestamptz) <= $4
                for update skip locked
            )
            update quantos.inbox_receipt as i
            set status = 'processing',
                attempts = i.attempts + 1,
                lease_owner = $5,
                lease_token = gen_random_uuid(),
                lease_expires_at = $6,
                last_attempt_at = $4,
                last_error = null
            from candidate
            where i.id = candidate.id
            returning i.id, i.attempts, i.lease_owner, i.lease_token, i.lease_expires_at",
            &[
                (event.tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
                (event.event_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
                (&worker_name, Type::TEXT),
                (&lease_expires_at, Type::TIMESTAMPTZ),
            ],
        )?;

        let decision = if let Some(row) = claimed {
            InboxClaimDecision::Claimed(InboxProcessingClaim {
                inbox_entry_id: InboxEntryId::from_uuid(row.get("id")),
                consumer_name: consumer_name.to_owned(),
                attempts: row.get::<_, i32>("attempts") as u32,
                lease_owner: row.get("lease_owner"),
                lease_token: row.get("lease_token"),
                lease_expires_at: row.get("lease_expires_at"),
            })
        } else {
            let row = tx.query_typed_one(
                "select status
                 from quantos.inbox_receipt
                 where tenant_id = $1 and consumer_name = $2 and event_id = $3",
                &[
                    (event.tenant_id.as_uuid(), Type::UUID),
                    (&consumer_name, Type::TEXT),
                    (event.event_id.as_uuid(), Type::UUID),
                ],
            )?;
            let status: String = row.get("status");
            if status == "applied" {
                InboxClaimDecision::AlreadyApplied
            } else {
                InboxClaimDecision::Busy
            }
        };

        tx.commit()?;
        Ok(decision)
    }

    fn claim_inbox_processing_batch(
        &mut self,
        consumer_name: &str,
        worker_name: &str,
        entries: &[LeasedOutboxEntry],
        observed_at: DateTime<Utc>,
        lease_duration: ChronoDuration,
    ) -> Result<Vec<InboxClaimDecision>, PgEventStoreError> {
        let input = Json(
            &entries
                .iter()
                .enumerate()
                .map(|(ordinal, entry)| {
                    serde_json::json!({
                        "ordinal": ordinal,
                        "tenant_id": entry.event.tenant_id,
                        "event_id": entry.event.event_id,
                        "outbox_id": entry.outbox.outbox_entry_id,
                        "outbox_owner": entry.lease_owner,
                        "outbox_token": entry.lease_token,
                    })
                })
                .collect::<Vec<_>>(),
        );
        let lease_seconds = lease_duration.num_seconds();
        let mut tx = self.client.transaction()?;
        tx.execute_typed(
            "with input as (
                select * from jsonb_to_recordset($1::jsonb)
                    as x(ordinal bigint, tenant_id uuid, event_id uuid,
                         outbox_id uuid, outbox_owner text, outbox_token uuid)
             )
             insert into quantos.inbox_receipt (
                tenant_id, consumer_name, event_log_id, event_id, status, attempts,
                first_received_at, last_attempt_at, next_attempt_at
             )
             select input.tenant_id, $2, e.id, input.event_id, 'pending', 0, $3, $3, $3
             from input
             join quantos.event_log e
               on e.tenant_id = input.tenant_id and e.event_id = input.event_id
             on conflict (tenant_id, consumer_name, event_id) do nothing",
            &[
                (&input, Type::JSONB),
                (&consumer_name, Type::TEXT),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;
        let rows = tx.query_typed(
            "with input as (
                select * from jsonb_to_recordset($1::jsonb)
                    as x(ordinal bigint, tenant_id uuid, event_id uuid,
                         outbox_id uuid, outbox_owner text, outbox_token uuid)
             ), outbox_renewed as (
                update quantos.outbox_event o
                set lease_expires_at = clock_timestamp() + make_interval(secs => $5::integer),
                    updated_at = clock_timestamp()
                from input
                where o.id = input.outbox_id and o.status = 'leased'
                  and o.lease_owner = input.outbox_owner
                  and o.lease_token = input.outbox_token
                returning o.id
             ), candidate as (
                select i.id, input.ordinal
                from input
                join quantos.inbox_receipt i
                  on i.tenant_id = input.tenant_id
                 and i.consumer_name = $2
                 and i.event_id = input.event_id
                where i.status in ('pending', 'processing')
                  and i.next_attempt_at <= $3
                  and coalesce(i.lease_expires_at, '-infinity'::timestamptz) <= $3
                for update of i skip locked
             ), claimed as (
                update quantos.inbox_receipt i
                set status = 'processing', attempts = i.attempts + 1,
                    lease_owner = $4, lease_token = gen_random_uuid(),
                    lease_expires_at = clock_timestamp() + make_interval(secs => $5::integer),
                    last_attempt_at = clock_timestamp(), last_error = null
                from candidate c where i.id = c.id
                returning c.ordinal, i.id, i.attempts, i.lease_owner,
                          i.lease_token, i.lease_expires_at
             )
             select input.ordinal, receipt.status, claimed.id, claimed.attempts,
                    claimed.lease_owner, claimed.lease_token, claimed.lease_expires_at
             from input
             join quantos.inbox_receipt receipt
               on receipt.tenant_id = input.tenant_id
              and receipt.consumer_name = $2
              and receipt.event_id = input.event_id
             left join claimed on claimed.ordinal = input.ordinal
             order by input.ordinal",
            &[
                (&input, Type::JSONB),
                (&consumer_name, Type::TEXT),
                (&observed_at, Type::TIMESTAMPTZ),
                (&worker_name, Type::TEXT),
                (&lease_seconds, Type::INT8),
            ],
        )?;
        if rows.len() != entries.len() {
            let missing = entries
                .iter()
                .find(|entry| {
                    !rows.iter().any(|row| {
                        row.get::<_, i64>("ordinal") as usize
                            == entries
                                .iter()
                                .position(|candidate| {
                                    candidate.event.event_id == entry.event.event_id
                                })
                                .unwrap_or(usize::MAX)
                    })
                })
                .unwrap_or(&entries[0]);
            return Err(PgEventStoreError::MissingEvent(missing.event.event_id));
        }
        let decisions = rows
            .into_iter()
            .map(|row| {
                if let Some(id) = row.get::<_, Option<Uuid>>("id") {
                    InboxClaimDecision::Claimed(InboxProcessingClaim {
                        inbox_entry_id: InboxEntryId::from_uuid(id),
                        consumer_name: consumer_name.to_owned(),
                        attempts: row.get::<_, i32>("attempts") as u32,
                        lease_owner: row.get("lease_owner"),
                        lease_token: row.get("lease_token"),
                        lease_expires_at: row.get("lease_expires_at"),
                    })
                } else if row.get::<_, String>("status") == "applied" {
                    InboxClaimDecision::AlreadyApplied
                } else {
                    InboxClaimDecision::Busy
                }
            })
            .collect();
        tx.commit()?;
        Ok(decisions)
    }

    pub fn record_inbox_success(
        &mut self,
        claim: &InboxProcessingClaim,
        event: &RecordedEvent,
        processed_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        let updated = tx.execute_typed(
            "update quantos.inbox_receipt
             set status = 'applied',
                 processed_at = $2,
                 next_attempt_at = $2,
                 lease_owner = null,
                 lease_expires_at = null,
                 lease_token = null,
                 last_error = null
             where id = $1
               and status = 'processing'
               and lease_owner = $3
               and lease_token = $4
               and lease_expires_at >= $2",
            &[
                (claim.inbox_entry_id.as_uuid(), Type::UUID),
                (&processed_at, Type::TIMESTAMPTZ),
                (&claim.lease_owner, Type::TEXT),
                (&claim.lease_token, Type::UUID),
            ],
        )?;
        if updated != 1 {
            return Err(PgEventStoreError::StaleLease {
                kind: "inbox",
                id: *claim.inbox_entry_id.as_uuid(),
            });
        }

        save_checkpoint_tx(
            &mut tx,
            &ProjectionCheckpoint {
                consumer_name: claim.consumer_name.clone(),
                tenant_id: event.tenant_id,
                stream_key: event.stream_key(),
                next_sequence: event.sequence + 1,
            },
        )?;

        tx.commit()?;
        Ok(())
    }

    fn record_inbox_success_and_dispatch_batch(
        &mut self,
        successes: &[(LeasedOutboxEntry, InboxProcessingClaim, DateTime<Utc>)],
    ) -> Result<(), PgEventStoreError> {
        if successes.is_empty() {
            return Ok(());
        }
        let input = Json(
            &successes
                .iter()
                .map(|(outbox, inbox, completed_at)| {
                    serde_json::json!({
                            "inbox_id": inbox.inbox_entry_id,
                            "inbox_owner": inbox.lease_owner,
                            "inbox_token": inbox.lease_token,
                            "outbox_id": outbox.outbox.outbox_entry_id,
                            "outbox_owner": outbox.lease_owner,
                            "outbox_token": outbox.lease_token,
                            "tenant_id": outbox.event.tenant_id,
                            "consumer_name": inbox.consumer_name,
                            "stream_key": outbox.event.stream_key(),
                    "last_sequence": outbox.event.sequence,
                            "completed_at": completed_at,
                        })
                })
                .collect::<Vec<_>>(),
        );
        let mut tx = self.client.transaction()?;
        let counts = tx.query_typed_one(
            "with input as (
                select * from jsonb_to_recordset($1::jsonb) as x(
                    inbox_id uuid, inbox_owner text, inbox_token uuid,
                    outbox_id uuid, outbox_owner text, outbox_token uuid,
                    tenant_id uuid, consumer_name text, stream_key text,
                    last_sequence bigint, completed_at timestamptz)
             ), inbox_updated as (
                update quantos.inbox_receipt i
                set status = 'applied', processed_at = input.completed_at,
                    next_attempt_at = input.completed_at,
                 lease_owner = null, lease_expires_at = null, lease_token = null,
                 last_error = null
                from input where i.id = input.inbox_id and i.status = 'processing'
                  and i.lease_owner = input.inbox_owner and i.lease_token = input.inbox_token
                  and i.lease_expires_at >= input.completed_at
                returning i.id
             ), outbox_updated as (
                update quantos.outbox_event o
                set status = 'dispatched', dispatched_at = input.completed_at,
                    lease_owner = null, lease_expires_at = null, lease_token = null,
                    last_error = null, updated_at = input.completed_at
                from input where o.id = input.outbox_id and o.status = 'leased'
                  and o.lease_owner = input.outbox_owner and o.lease_token = input.outbox_token
                  and o.lease_expires_at >= input.completed_at
                returning o.id
             ), checkpoints as (
                insert into quantos.projection_checkpoint (
                    tenant_id, consumer_name, stream_key, last_sequence, updated_at)
                select tenant_id, consumer_name, stream_key, max(last_sequence), max(completed_at)
                from input group by tenant_id, consumer_name, stream_key
                on conflict (tenant_id, consumer_name, stream_key) do update
                set last_sequence = greatest(quantos.projection_checkpoint.last_sequence, excluded.last_sequence),
                    updated_at = greatest(quantos.projection_checkpoint.updated_at, excluded.updated_at)
                returning id
             )
             select (select count(*) from inbox_updated)::bigint as inbox_count,
                    (select count(*) from outbox_updated)::bigint as outbox_count",
            &[(&input, Type::JSONB)],
        )?;
        if counts.get::<_, i64>("inbox_count") != successes.len() as i64 {
            return Err(PgEventStoreError::StaleLease {
                kind: "inbox",
                id: *successes[0].1.inbox_entry_id.as_uuid(),
            });
        }
        if counts.get::<_, i64>("outbox_count") != successes.len() as i64 {
            return Err(PgEventStoreError::StaleLease {
                kind: "outbox",
                id: *successes[0].0.outbox.outbox_entry_id.as_uuid(),
            });
        }
        tx.commit()?;
        Ok(())
    }

    pub fn record_inbox_failure(
        &mut self,
        claim: &InboxProcessingClaim,
        event: &RecordedEvent,
        reason: &str,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
    ) -> Result<InboxFailureOutcome, PgEventStoreError> {
        let retry_at = observed_at + retry_backoff(claim.attempts);
        let mut tx = self.client.transaction()?;
        let row = tx
            .query_typed_opt(
                "update quantos.inbox_receipt as i
             set status = case
                    when i.attempts >= $2 then 'dead_letter'
                    else 'pending'
                 end,
                 next_attempt_at = case
                    when i.attempts >= $2 then $3
                    else $4
                 end,
                 processed_at = case
                    when i.attempts >= $2 then $3
                    else i.processed_at
                 end,
                 lease_owner = null,
                 lease_expires_at = null,
                 lease_token = null,
                 last_error = $5
             where i.id = $1
               and i.status = 'processing'
               and i.lease_owner = $6
               and i.lease_token = $7
               and i.lease_expires_at >= $3
             returning i.attempts, i.status",
                &[
                    (claim.inbox_entry_id.as_uuid(), Type::UUID),
                    (&(max_attempts as i32), Type::INT4),
                    (&observed_at, Type::TIMESTAMPTZ),
                    (&retry_at, Type::TIMESTAMPTZ),
                    (&reason, Type::TEXT),
                    (&claim.lease_owner, Type::TEXT),
                    (&claim.lease_token, Type::UUID),
                ],
            )?
            .ok_or(PgEventStoreError::StaleLease {
                kind: "inbox",
                id: *claim.inbox_entry_id.as_uuid(),
            })?;

        let attempts = row.get::<_, i32>("attempts") as u32;
        let dead_lettered = row.get::<_, String>("status") == "dead_letter";

        if dead_lettered {
            let dead_payload = Json(&event.payload);
            tx.execute_typed(
                "insert into quantos.dead_letter_event (
                    tenant_id, source, consumer_name, event_id, actor_id, correlation_id,
                    causation_id, sequence, reason, payload, created_at
                ) values ($1, 'inbox', $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                &[
                    (event.tenant_id.as_uuid(), Type::UUID),
                    (&claim.consumer_name, Type::TEXT),
                    (event.event_id.as_uuid(), Type::UUID),
                    (event.actor_id.as_uuid(), Type::UUID),
                    (event.correlation_id.as_uuid(), Type::UUID),
                    (event.causation_id.as_uuid(), Type::UUID),
                    (&(event.sequence as i64), Type::INT8),
                    (&reason, Type::TEXT),
                    (&dead_payload, Type::JSONB),
                    (&observed_at, Type::TIMESTAMPTZ),
                ],
            )?;
            save_checkpoint_tx(
                &mut tx,
                &ProjectionCheckpoint {
                    consumer_name: claim.consumer_name.clone(),
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

    #[allow(clippy::too_many_arguments)]
    pub fn poll_outbox_once<F, N>(
        &mut self,
        worker_name: &str,
        consumer_name: &str,
        limit: i64,
        observed_at: DateTime<Utc>,
        lease_duration: ChronoDuration,
        max_attempts: u32,
        mut handler: F,
        mut notifier: N,
    ) -> Result<PollingDispatchReport, PgEventStoreError>
    where
        F: FnMut(&RecordedEvent, &InboxProcessingClaim) -> Result<(), String>,
        N: FnMut(&RecordedEvent) -> Result<(), String>,
    {
        let claimed = self.claim_outbox_events(worker_name, limit, observed_at, lease_duration)?;
        let mut report = PollingDispatchReport {
            claimed: claimed.len(),
            ..PollingDispatchReport::default()
        };
        let decisions = self.claim_inbox_processing_batch(
            consumer_name,
            worker_name,
            &claimed,
            observed_at,
            lease_duration,
        )?;
        let mut successes = Vec::new();

        for (entry, decision) in claimed.into_iter().zip(decisions) {
            match decision {
                InboxClaimDecision::AlreadyApplied => {
                    let completed_at = std::cmp::max(Utc::now(), observed_at);
                    self.mark_outbox_dispatched(&entry, completed_at)?;
                    report.duplicate_skipped += 1;
                }
                InboxClaimDecision::Busy => {
                    let completed_at = std::cmp::max(Utc::now(), observed_at);
                    self.release_outbox_claim(
                        &entry,
                        completed_at + ChronoDuration::seconds(1),
                        completed_at,
                    )?;
                    report.retried += 1;
                }
                InboxClaimDecision::Claimed(claim) => {
                    let handler_started_at = std::cmp::max(Utc::now(), observed_at);
                    if claim.lease_expires_at < handler_started_at {
                        return Err(PgEventStoreError::StaleLease {
                            kind: "inbox",
                            id: *claim.inbox_entry_id.as_uuid(),
                        });
                    }
                    match handler(&entry.event, &claim) {
                        Ok(()) => {
                            let completed_at = std::cmp::max(Utc::now(), observed_at);
                            successes.push((entry, claim, completed_at));
                        }
                        Err(detail) => {
                            let completed_at = std::cmp::max(Utc::now(), observed_at);
                            let inbox_outcome = self.record_inbox_failure(
                                &claim,
                                &entry.event,
                                &detail,
                                max_attempts,
                                completed_at,
                            )?;
                            let outbox_dead_lettered = self.record_outbox_failure(
                                &entry,
                                consumer_name,
                                &detail,
                                max_attempts,
                                completed_at,
                            )?;
                            if inbox_outcome.dead_lettered || outbox_dead_lettered {
                                report.dead_lettered += 1;
                            } else {
                                report.retried += 1;
                            }
                        }
                    }
                }
            }
        }

        self.record_inbox_success_and_dispatch_batch(&successes)?;
        for (entry, _, _) in &successes {
            if notifier(&entry.event).is_err() {
                report.notify_failures += 1;
            }
        }
        report.processed += successes.len();

        Ok(report)
    }

    pub fn load_checkpoint(
        &mut self,
        tenant_id: TenantId,
        consumer_name: &str,
        stream_key: &str,
    ) -> Result<Option<ProjectionCheckpoint>, PgEventStoreError> {
        let row = self.client.query_typed_opt(
            "select last_sequence
             from quantos.projection_checkpoint
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
        tenant_id: TenantId,
        correlation_id: CorrelationId,
    ) -> Result<Vec<AuditEntry>, PgEventStoreError> {
        let rows = self.client.query_typed(
            "select id, tenant_id, actor_id, correlation_id, causation_id, event_id, action, details, recorded_at
             from quantos.audit_entries
             where tenant_id = $1 and correlation_id = $2
             order by recorded_at asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (correlation_id.as_uuid(), Type::UUID),
            ],
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
             from quantos.dead_letter_event
             where tenant_id = $1
               and coalesce(consumer_name, '') = $2
               and status = 'pending'
             order by created_at asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&consumer_name, Type::TEXT),
            ],
        )?;

        Ok(rows.iter().map(row_to_dead_letter_entry).collect())
    }

    pub fn requeue_dead_letter(
        &mut self,
        tenant_id: TenantId,
        dead_letter_id: DeadLetterId,
        operator_actor_id: ActorId,
        observed_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        let mut tx = self.client.transaction()?;
        if tx
            .query_typed_opt(
                "select 1 from quantos.actors
                 where id = $1 and tenant_id = $2 and is_active = true",
                &[
                    (operator_actor_id.as_uuid(), Type::UUID),
                    (tenant_id.as_uuid(), Type::UUID),
                ],
            )?
            .is_none()
        {
            return Err(PgEventStoreError::ActorNotAuthorized {
                tenant_id,
                actor_id: operator_actor_id,
            });
        }

        let dead = tx
            .query_typed_opt(
                "select source, consumer_name, event_id, correlation_id, causation_id
                 from quantos.dead_letter_event
                 where id = $1 and tenant_id = $2 and status = 'pending'
                 for update",
                &[
                    (dead_letter_id.as_uuid(), Type::UUID),
                    (tenant_id.as_uuid(), Type::UUID),
                ],
            )?
            .ok_or(PgEventStoreError::DeadLetterNotReplayable(dead_letter_id))?;
        let source: String = dead.get("source");
        let event_id: Uuid = dead.get("event_id");
        let consumer_name: Option<String> = dead.get("consumer_name");

        tx.execute_typed(
            "update quantos.inbox_receipt
             set status = 'pending', attempts = 0, processed_at = null,
                 last_attempt_at = null, next_attempt_at = $4,
                 lease_owner = null, lease_token = null, lease_expires_at = null,
                 last_error = null
             where tenant_id = $1 and event_id = $2 and consumer_name = $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&event_id, Type::UUID),
                (&consumer_name.as_deref().unwrap_or_default(), Type::TEXT),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;

        tx.execute_typed(
            "update quantos.outbox_event as outbox
             set status = 'pending', attempts = 0, available_at = $3,
                 dispatched_at = null, lease_owner = null, lease_token = null,
                 lease_expires_at = null, last_error = null, updated_at = $3
             from quantos.event_log as event
             where outbox.event_log_id = event.id
               and event.tenant_id = $1 and event.event_id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&event_id, Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;

        tx.execute_typed(
            "update quantos.dead_letter_event
             set status = 'replayed', replay_attempts = replay_attempts + 1,
                 replayed_at = $1, replayed_by = $2, last_replay_error = null
             where tenant_id = $3
               and event_id = $4
               and coalesce(consumer_name, '') = $5
               and status = 'pending'",
            &[
                (&observed_at, Type::TIMESTAMPTZ),
                (operator_actor_id.as_uuid(), Type::UUID),
                (tenant_id.as_uuid(), Type::UUID),
                (&event_id, Type::UUID),
                (&consumer_name.as_deref().unwrap_or_default(), Type::TEXT),
            ],
        )?;

        let correlation_id: Uuid = dead.get("correlation_id");
        let causation_id: Uuid = dead.get("causation_id");
        let details = Json(&serde_json::json!({
            "dead_letter_id": dead_letter_id,
            "source": source,
            "consumer_name": consumer_name,
        }));
        tx.execute_typed(
            "insert into quantos.audit_entries (
                tenant_id, actor_id, correlation_id, causation_id, event_id,
                action, details, recorded_at
             ) values ($1,$2,$3,$4,$5,'event.dead_letter.requeued',$6,$7)",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (operator_actor_id.as_uuid(), Type::UUID),
                (&correlation_id, Type::UUID),
                (&causation_id, Type::UUID),
                (&event_id, Type::UUID),
                (&details, Type::JSONB),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn health_snapshot(
        &mut self,
        tenant_id: TenantId,
        observed_at: DateTime<Utc>,
    ) -> Result<EventStoreHealth, PgEventStoreError> {
        let row = self.client.query_typed_one(
            "select
               (select count(*) from quantos.outbox_event where tenant_id = $1 and status = 'pending') as pending_outbox,
               (select count(*) from quantos.outbox_event where tenant_id = $1 and status = 'leased' and lease_expires_at < $2) as expired_outbox_leases,
               (select count(*) from quantos.inbox_receipt where tenant_id = $1 and status = 'pending') as pending_inbox,
               (select count(*) from quantos.inbox_receipt where tenant_id = $1 and status = 'processing' and lease_expires_at < $2) as expired_inbox_leases,
               (select count(*) from quantos.dead_letter_event where tenant_id = $1 and status = 'pending') as pending_dead_letters,
               coalesce((select extract(epoch from ($2 - min(available_at)))::bigint from quantos.outbox_event where tenant_id = $1 and status = 'pending'), 0) as oldest_outbox_age_seconds",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&observed_at, Type::TIMESTAMPTZ),
            ],
        )?;
        Ok(EventStoreHealth {
            pending_outbox: row.get("pending_outbox"),
            expired_outbox_leases: row.get("expired_outbox_leases"),
            pending_inbox: row.get("pending_inbox"),
            expired_inbox_leases: row.get("expired_inbox_leases"),
            pending_dead_letters: row.get("pending_dead_letters"),
            oldest_outbox_age_seconds: row.get("oldest_outbox_age_seconds"),
        })
    }

    fn release_outbox_claim(
        &mut self,
        claim: &LeasedOutboxEntry,
        available_at: DateTime<Utc>,
        observed_at: DateTime<Utc>,
    ) -> Result<(), PgEventStoreError> {
        let updated = self.client.execute_typed(
            "update quantos.outbox_event
             set status = 'pending',
                 available_at = $2,
                 lease_owner = null,
                 lease_expires_at = null,
                 lease_token = null,
                 updated_at = $3
             where id = $1
               and status = 'leased'
               and lease_owner = $4
               and lease_token = $5
               and lease_expires_at >= $3",
            &[
                (claim.outbox.outbox_entry_id.as_uuid(), Type::UUID),
                (&available_at, Type::TIMESTAMPTZ),
                (&observed_at, Type::TIMESTAMPTZ),
                (&claim.lease_owner, Type::TEXT),
                (&claim.lease_token, Type::UUID),
            ],
        )?;
        if updated != 1 {
            return Err(PgEventStoreError::StaleLease {
                kind: "outbox",
                id: *claim.outbox.outbox_entry_id.as_uuid(),
            });
        }
        Ok(())
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

fn retry_backoff(attempts: u32) -> ChronoDuration {
    let exponent = attempts.saturating_sub(1).min(6);
    ChronoDuration::seconds(1_i64 << exponent)
}

fn save_checkpoint_tx(
    tx: &mut Transaction<'_>,
    checkpoint: &ProjectionCheckpoint,
) -> Result<(), PgEventStoreError> {
    let last_sequence = checkpoint.next_sequence.saturating_sub(1) as i64;
    tx.execute_typed(
        "insert into quantos.projection_checkpoint (
            tenant_id, consumer_name, stream_key, last_sequence, updated_at
        ) values ($1,$2,$3,$4,now())
        on conflict (tenant_id, consumer_name, stream_key)
        do update set
            last_sequence = greatest(quantos.projection_checkpoint.last_sequence, excluded.last_sequence),
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
        actor_id: ActorId::from_uuid(row.get("actor_id")),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        causation_id: EventId::from_uuid(row.get("causation_id")),
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
        actor_id: ActorId::from_uuid(row.get("actor_id")),
        correlation_id: CorrelationId::from_uuid(row.get("correlation_id")),
        causation_id: EventId::from_uuid(row.get("causation_id")),
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
