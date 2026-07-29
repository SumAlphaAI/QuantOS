begin;

create or replace function quantos.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select exists (
    select 1
    from quantos.tenant_memberships as membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = auth.uid()
  );
$$;

revoke all on function quantos.is_tenant_member(uuid) from public;
grant execute on function quantos.is_tenant_member(uuid) to authenticated, service_role;

create table if not exists quantos.event_streams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, aggregate_type, aggregate_id)
);

create table if not exists quantos.event_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  stream_id uuid not null references quantos.event_streams(id) on delete cascade,
  event_id uuid not null unique,
  correlation_id uuid not null,
  aggregate_type text not null,
  aggregate_id text not null,
  sequence bigint not null check (sequence > 0),
  event_kind text not null,
  schema_version text not null,
  payload jsonb not null,
  payload_hash text not null check (payload_hash like 'sha256:%'),
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  unique (tenant_id, stream_id, sequence)
);

create table if not exists quantos.event_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  event_log_id uuid not null references quantos.event_log(id) on delete cascade,
  topic text not null,
  status text not null default 'pending' check (status in ('pending', 'dispatched', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create table if not exists quantos.event_inbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  consumer_name text not null,
  event_log_id uuid not null references quantos.event_log(id) on delete cascade,
  event_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (tenant_id, consumer_name, event_id)
);

create table if not exists quantos.event_dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  source text not null check (source in ('outbox', 'inbox')),
  consumer_name text,
  event_id uuid not null,
  correlation_id uuid not null,
  sequence bigint not null check (sequence > 0),
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quantos.audit_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  correlation_id uuid not null,
  event_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists quantos.object_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  artifact_id uuid not null unique,
  content_hash text not null check (content_hash like 'sha256:%'),
  storage_bucket text not null,
  object_key text not null,
  media_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, content_hash)
);

create table if not exists quantos.schema_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  domain text not null,
  schema_name text not null,
  schema_version text not null,
  content_hash text not null check (content_hash like 'sha256:%'),
  schema_document jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, domain, schema_name, schema_version)
);

create table if not exists quantos.projection_checkpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  consumer_name text not null,
  stream_key text not null,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  updated_at timestamptz not null default now(),
  unique (tenant_id, consumer_name, stream_key)
);

create index if not exists idx_event_log_correlation_id
  on quantos.event_log (tenant_id, correlation_id, occurred_at, sequence);

create index if not exists idx_event_log_stream_sequence
  on quantos.event_log (stream_id, sequence);

create index if not exists idx_event_outbox_pending
  on quantos.event_outbox (status, available_at);

create index if not exists idx_event_inbox_consumer_status
  on quantos.event_inbox (tenant_id, consumer_name, status, received_at);

create index if not exists idx_event_dead_letters_created_at
  on quantos.event_dead_letters (tenant_id, created_at desc);

create index if not exists idx_audit_entries_correlation_id
  on quantos.audit_entries (tenant_id, correlation_id, recorded_at);

create index if not exists idx_object_artifacts_hash
  on quantos.object_artifacts (tenant_id, content_hash);

comment on function quantos.is_tenant_member(uuid) is 'Returns true when auth.uid() belongs to the target QuantOS tenant.';
comment on table quantos.event_streams is 'Canonical aggregate streams for append-only event ordering.';
comment on table quantos.event_log is 'Append-only event ledger with per-stream sequence guarantees.';
comment on table quantos.event_outbox is 'Transactional outbox for reliable downstream event delivery.';
comment on table quantos.event_inbox is 'Consumer inbox dedupe and delivery tracking table.';
comment on table quantos.event_dead_letters is 'Terminal dead-letter queue for poisoned outbox or inbox deliveries.';
comment on table quantos.audit_entries is 'Append-only audit ledger linked by correlation ID.';
comment on table quantos.object_artifacts is 'Object storage manifest and immutable content-addressed metadata.';
comment on table quantos.schema_registry is 'Tenant-scoped schema registry for payload and artifact contracts.';
comment on table quantos.projection_checkpoints is 'Durable consumer checkpoints for replay and restart recovery.';

alter table quantos.tenants enable row level security;
alter table quantos.tenants force row level security;
alter table quantos.tenant_memberships enable row level security;
alter table quantos.tenant_memberships force row level security;
alter table quantos.event_streams enable row level security;
alter table quantos.event_streams force row level security;
alter table quantos.event_log enable row level security;
alter table quantos.event_log force row level security;
alter table quantos.event_outbox enable row level security;
alter table quantos.event_outbox force row level security;
alter table quantos.event_inbox enable row level security;
alter table quantos.event_inbox force row level security;
alter table quantos.event_dead_letters enable row level security;
alter table quantos.event_dead_letters force row level security;
alter table quantos.audit_entries enable row level security;
alter table quantos.audit_entries force row level security;
alter table quantos.object_artifacts enable row level security;
alter table quantos.object_artifacts force row level security;
alter table quantos.schema_registry enable row level security;
alter table quantos.schema_registry force row level security;
alter table quantos.projection_checkpoints enable row level security;
alter table quantos.projection_checkpoints force row level security;

create policy "event_streams_select_member"
  on quantos.event_streams
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "event_streams_service_role_all"
  on quantos.event_streams
  for all
  to service_role
  using (true)
  with check (true);

create policy "event_log_select_member"
  on quantos.event_log
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "event_log_service_role_all"
  on quantos.event_log
  for all
  to service_role
  using (true)
  with check (true);

create policy "event_outbox_select_member"
  on quantos.event_outbox
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "event_outbox_service_role_all"
  on quantos.event_outbox
  for all
  to service_role
  using (true)
  with check (true);

create policy "event_inbox_select_member"
  on quantos.event_inbox
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "event_inbox_service_role_all"
  on quantos.event_inbox
  for all
  to service_role
  using (true)
  with check (true);

create policy "event_dead_letters_select_member"
  on quantos.event_dead_letters
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "event_dead_letters_service_role_all"
  on quantos.event_dead_letters
  for all
  to service_role
  using (true)
  with check (true);

create policy "audit_entries_select_member"
  on quantos.audit_entries
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "audit_entries_service_role_all"
  on quantos.audit_entries
  for all
  to service_role
  using (true)
  with check (true);

create policy "object_artifacts_select_member"
  on quantos.object_artifacts
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "object_artifacts_service_role_all"
  on quantos.object_artifacts
  for all
  to service_role
  using (true)
  with check (true);

create policy "schema_registry_select_member"
  on quantos.schema_registry
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "schema_registry_service_role_all"
  on quantos.schema_registry
  for all
  to service_role
  using (true)
  with check (true);

create policy "projection_checkpoints_select_member"
  on quantos.projection_checkpoints
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "projection_checkpoints_service_role_all"
  on quantos.projection_checkpoints
  for all
  to service_role
  using (true)
  with check (true);

commit;
