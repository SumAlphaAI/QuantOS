begin;
create table quantos.market_source_receipt (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 256),
  source_tick_id text not null check (length(btrim(source_tick_id)) between 1 and 256),
  source_hash text not null check (source_hash ~ '^sha256:[0-9a-f]{64}$'),
  actor_id uuid not null,
  event_count integer not null check (event_count between 1 and 3),
  event_time timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, source_tick_id),
  foreign key (tenant_id, actor_id) references quantos.actors(tenant_id, id)
);
create index market_source_receipt_latest on quantos.market_source_receipt (tenant_id, provider, created_at desc);
alter table quantos.market_source_receipt enable row level security;
alter table quantos.market_source_receipt force row level security;
revoke all on quantos.market_source_receipt from public, anon, authenticated;
grant select, insert on quantos.market_source_receipt to service_role;
create policy market_source_receipt_service on quantos.market_source_receipt for all to service_role using (true) with check (true);
comment on table quantos.market_source_receipt is 'R01 durable source identity; committed atomically with event_log/audit/outbox. Never delete receipts while the provider can retransmit.';
commit;
