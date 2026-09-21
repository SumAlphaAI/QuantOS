begin;

-- Every persisted event and audit entry carries an actor and direct cause. A
-- deterministic service principal backfills the pre-F05 rows for each tenant.
insert into quantos.actors (tenant_id, actor_kind, display_name, service_name)
select distinct source.tenant_id, 'service', 'QuantOS event ledger', 'quantos-event-ledger'
from (
  select tenant_id from quantos.event_log
  union
  select tenant_id from quantos.audit_entries
) as source
on conflict (tenant_id, service_name)
do update set display_name = excluded.display_name;

alter table quantos.event_log
  add column if not exists actor_id uuid,
  add column if not exists causation_id uuid;

update quantos.event_log as event
set actor_id = actor.id,
    causation_id = event.event_id
from quantos.actors as actor
where actor.tenant_id = event.tenant_id
  and actor.service_name = 'quantos-event-ledger'
  and (event.actor_id is null or event.causation_id is null);

alter table quantos.event_log
  alter column actor_id set not null,
  alter column causation_id set not null;

alter table quantos.event_log
  add constraint event_log_tenant_event_key unique (tenant_id, event_id);

alter table quantos.actors
  add constraint actors_tenant_id_id_key unique (tenant_id, id);

alter table quantos.event_log
  add constraint event_log_tenant_actor_fkey
    foreign key (tenant_id, actor_id) references quantos.actors(tenant_id, id) on delete restrict,
  add constraint event_log_tenant_causation_fkey
    foreign key (tenant_id, causation_id) references quantos.event_log(tenant_id, event_id)
    deferrable initially deferred;

alter table quantos.audit_entries
  add column if not exists actor_id uuid,
  add column if not exists causation_id uuid;

update quantos.audit_entries as audit
set actor_id = event.actor_id,
    causation_id = event.causation_id
from quantos.event_log as event
where event.event_id = audit.event_id
  and event.tenant_id = audit.tenant_id
  and (audit.actor_id is null or audit.causation_id is null);

update quantos.audit_entries as audit
set actor_id = mapped_actor.id,
    causation_id = coalesce(audit.event_id, audit.correlation_id)
from quantos.actors as mapped_actor
where mapped_actor.user_id = audit.actor_user_id
  and mapped_actor.tenant_id = audit.tenant_id
  and (audit.actor_id is null or audit.causation_id is null);

update quantos.audit_entries as audit
set actor_id = service_actor.id,
    causation_id = coalesce(audit.event_id, audit.correlation_id)
from quantos.actors as service_actor
where service_actor.tenant_id = audit.tenant_id
  and service_actor.service_name = 'quantos-event-ledger'
  and (audit.actor_id is null or audit.causation_id is null);

alter table quantos.audit_entries
  alter column actor_id set not null,
  alter column causation_id set not null;

alter table quantos.audit_entries
  add constraint audit_entries_tenant_actor_fkey
    foreign key (tenant_id, actor_id) references quantos.actors(tenant_id, id) on delete restrict;

-- A UUID claim token is the fencing credential. Reusing a worker name does not
-- authorize a stale process to acknowledge a newer lease.
alter table quantos.outbox_event
  add column if not exists lease_token uuid;

alter table quantos.inbox_receipt
  add column if not exists lease_token uuid;

alter table quantos.dead_letter_event
  add column if not exists actor_id uuid,
  add column if not exists causation_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists replay_attempts integer not null default 0,
  add column if not exists replayed_at timestamptz,
  add column if not exists replayed_by uuid,
  add column if not exists last_replay_error text;

update quantos.dead_letter_event as dead
set actor_id = event.actor_id,
    causation_id = event.causation_id
from quantos.event_log as event
where event.event_id = dead.event_id
  and event.tenant_id = dead.tenant_id
  and (dead.actor_id is null or dead.causation_id is null);

alter table quantos.dead_letter_event
  alter column actor_id set not null,
  alter column causation_id set not null,
  add constraint dead_letter_event_status_check
    check (status in ('pending', 'replayed', 'failed')),
  add constraint dead_letter_event_replay_attempts_check
    check (replay_attempts >= 0),
  add constraint dead_letter_event_tenant_actor_fkey
    foreign key (tenant_id, actor_id) references quantos.actors(tenant_id, id) on delete restrict,
  add constraint dead_letter_event_tenant_causation_fkey
    foreign key (tenant_id, causation_id) references quantos.event_log(tenant_id, event_id)
    deferrable initially deferred,
  add constraint dead_letter_event_tenant_replayed_by_fkey
    foreign key (tenant_id, replayed_by) references quantos.actors(tenant_id, id) on delete restrict;

create index if not exists idx_dead_letter_event_replay
  on quantos.dead_letter_event (tenant_id, status, created_at);

-- Parent stream removal must never erase the event truth source.
alter table quantos.event_log
  drop constraint if exists event_log_stream_id_fkey;
alter table quantos.event_log
  add constraint event_log_stream_id_fkey
    foreign key (stream_id) references quantos.event_streams(id) on delete restrict;

create or replace function quantos.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = quantos, pg_temp
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I.%I is append-only; %s is forbidden', tg_table_schema, tg_table_name, tg_op);
end;
$$;

revoke all on function quantos.reject_append_only_mutation() from public;

drop trigger if exists event_log_append_only on quantos.event_log;
create trigger event_log_append_only
before update or delete or truncate on quantos.event_log
for each statement execute function quantos.reject_append_only_mutation();

drop trigger if exists audit_entries_append_only on quantos.audit_entries;
create trigger audit_entries_append_only
before update or delete or truncate on quantos.audit_entries
for each statement execute function quantos.reject_append_only_mutation();

comment on column quantos.event_log.actor_id is 'Actor responsible for the write; required for every event.';
comment on column quantos.event_log.causation_id is 'Direct parent event; root events point to their own event_id.';
comment on column quantos.outbox_event.lease_token is 'Unforgeable fencing token for the current lease generation.';
comment on column quantos.inbox_receipt.lease_token is 'Unforgeable fencing token for the current processing generation.';
comment on table quantos.dead_letter_event is 'Auditable dead-letter lifecycle; replay preserves the original event and inbox evidence.';

commit;
