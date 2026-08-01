begin;

create table if not exists quantos.strategy_releases (
  release_id uuid primary key,
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  draft_id uuid not null references quantos.strategy_drafts(draft_id) on delete restrict,
  draft_version bigint not null check (draft_version > 0),
  name text not null,
  source_digest text not null,
  image_digest text not null,
  parameter_hash text not null check (parameter_hash like 'sha256:%'),
  backtest_report_hash text check (backtest_report_hash like 'sha256:%'),
  data_snapshot_id uuid not null references quantos.data_snapshots(id) on delete restrict,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  allowed_targets text[] not null check (allowed_targets <@ array['paper', 'shadow']::text[]),
  approved_at timestamptz,
  approved_by_actor uuid references quantos.actors(id) on delete restrict,
  content_hash text not null check (content_hash like 'sha256:%'),
  created_by_actor uuid not null references quantos.actors(id) on delete restrict,
  created_by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, content_hash),
  unique (tenant_id, draft_id, draft_version)
);

create table if not exists quantos.strategy_release_deployments (
  deployment_id uuid primary key,
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  release_id uuid not null references quantos.strategy_releases(release_id) on delete cascade,
  target text not null check (target in ('paper', 'shadow')),
  status text not null default 'ticketed' check (status in ('ticketed', 'revoked')),
  requested_by_actor uuid not null references quantos.actors(id) on delete restrict,
  requested_by_user uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  unique (tenant_id, release_id, target)
);

create index if not exists idx_strategy_releases_tenant_draft
  on quantos.strategy_releases (tenant_id, draft_id, draft_version desc);

create index if not exists idx_strategy_release_deployments_release
  on quantos.strategy_release_deployments (tenant_id, release_id);

comment on table quantos.strategy_releases is 'Immutable strategy release candidates with content-hash dedupe; M3/M4 targets limited to paper/shadow.';
comment on table quantos.strategy_release_deployments is 'Deployment tickets for approved, verified strategy releases; targets are limited to paper/shadow before M5.';

alter table quantos.strategy_releases enable row level security;
alter table quantos.strategy_releases force row level security;
alter table quantos.strategy_release_deployments enable row level security;
alter table quantos.strategy_release_deployments force row level security;

create policy "strategy_releases_select_member"
  on quantos.strategy_releases
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "strategy_releases_service_role_all"
  on quantos.strategy_releases
  for all
  to service_role
  using (true)
  with check (true);

create policy "strategy_release_deployments_select_member"
  on quantos.strategy_release_deployments
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "strategy_release_deployments_service_role_all"
  on quantos.strategy_release_deployments
  for all
  to service_role
  using (true)
  with check (true);

commit;
