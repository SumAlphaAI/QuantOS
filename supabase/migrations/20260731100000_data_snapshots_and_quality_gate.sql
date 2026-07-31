begin;

create table if not exists quantos.data_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  schema_entry_id uuid references quantos.schema_registry(id) on delete set null,
  schema_name text not null,
  schema_version text not null check (schema_version like 'v%'),
  window_start_at timestamptz not null,
  window_end_at timestamptz not null check (window_end_at >= window_start_at),
  captured_at timestamptz not null,
  max_age_secs bigint not null check (max_age_secs >= 0),
  expires_at timestamptz not null,
  quality text not null check (quality in ('pending', 'passed', 'degraded', 'failed')),
  license_label text not null,
  content_hash text not null check (content_hash like 'sha256:%'),
  symbols jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  artifact_refs jsonb not null default '[]'::jsonb,
  lineage jsonb not null default '[]'::jsonb,
  quality_findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, content_hash)
);

create index if not exists idx_data_snapshots_tenant_captured
  on quantos.data_snapshots (tenant_id, captured_at desc);

create index if not exists idx_data_snapshots_tenant_quality_expires
  on quantos.data_snapshots (tenant_id, quality, expires_at desc);

create index if not exists idx_data_snapshots_symbols_gin
  on quantos.data_snapshots
  using gin (symbols jsonb_path_ops);

create table if not exists quantos.data_snapshot_quality_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  usage_scope text not null check (usage_scope in ('research', 'strategy', 'trading')),
  allow_pending boolean not null default false,
  allow_degraded boolean not null default false,
  allow_failed boolean not null default false,
  require_license boolean not null default true,
  require_freshness boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (tenant_id, usage_scope)
);

comment on table quantos.data_snapshots is 'Immutable DataSnapshot metadata, lineage, quality state, and object-storage references for research and trading workflows.';
comment on table quantos.data_snapshot_quality_rules is 'Tenant-scoped quality gate rules for research, strategy, and trading snapshot usage.';

alter table quantos.data_snapshots enable row level security;
alter table quantos.data_snapshots force row level security;
alter table quantos.data_snapshot_quality_rules enable row level security;
alter table quantos.data_snapshot_quality_rules force row level security;

create policy "data_snapshots_select_member"
  on quantos.data_snapshots
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "data_snapshots_service_role_all"
  on quantos.data_snapshots
  for all
  to service_role
  using (true)
  with check (true);

create policy "data_snapshot_quality_rules_select_member"
  on quantos.data_snapshot_quality_rules
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "data_snapshot_quality_rules_service_role_all"
  on quantos.data_snapshot_quality_rules
  for all
  to service_role
  using (true)
  with check (true);

commit;
