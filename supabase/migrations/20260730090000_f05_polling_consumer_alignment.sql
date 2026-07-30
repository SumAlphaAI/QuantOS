begin;

alter table if exists quantos.event_outbox rename to outbox_event;
alter table if exists quantos.event_inbox rename to inbox_receipt;
alter table if exists quantos.event_dead_letters rename to dead_letter_event;
alter table if exists quantos.projection_checkpoints rename to projection_checkpoint;

alter index if exists quantos.idx_event_outbox_pending rename to idx_outbox_event_pending;
alter index if exists quantos.idx_event_inbox_consumer_status rename to idx_inbox_receipt_consumer_status;
alter index if exists quantos.idx_event_dead_letters_created_at rename to idx_dead_letter_event_created_at;

alter table quantos.outbox_event
  drop constraint if exists event_outbox_status_check;
alter table quantos.outbox_event
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table quantos.outbox_event
  add constraint outbox_event_status_check
  check (status in ('pending', 'leased', 'dispatched', 'dead_letter'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'outbox_event_event_log_id_key'
      and conrelid = 'quantos.outbox_event'::regclass
  ) then
    alter table quantos.outbox_event
      add constraint outbox_event_event_log_id_key unique (event_log_id);
  end if;
end
$$;

create index if not exists idx_outbox_event_claimable
  on quantos.outbox_event (status, available_at, lease_expires_at);

alter table quantos.inbox_receipt
  drop constraint if exists event_inbox_status_check;
alter table quantos.inbox_receipt
  add column if not exists first_received_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

update quantos.inbox_receipt
set first_received_at = coalesce(first_received_at, received_at),
    last_attempt_at = coalesce(last_attempt_at, processed_at, received_at),
    next_attempt_at = coalesce(next_attempt_at, processed_at, received_at, now());

alter table quantos.inbox_receipt
  alter column first_received_at set not null;
alter table quantos.inbox_receipt
  alter column next_attempt_at set not null;
alter table quantos.inbox_receipt
  add constraint inbox_receipt_status_check
  check (status in ('pending', 'processing', 'applied', 'dead_letter'));

create index if not exists idx_inbox_receipt_claimable
  on quantos.inbox_receipt (tenant_id, consumer_name, status, next_attempt_at, lease_expires_at);

comment on table quantos.outbox_event is 'Transactional outbox truth-source claimed by PostgreSQL polling workers with row leases.';
comment on table quantos.inbox_receipt is 'Consumer receipt, dedupe, retry backoff, and processing lease table.';
comment on table quantos.dead_letter_event is 'Terminal dead-letter records for poisoned outbox or inbox processing.';
comment on table quantos.projection_checkpoint is 'Durable consumer checkpoints for replay and restart recovery.';

commit;
