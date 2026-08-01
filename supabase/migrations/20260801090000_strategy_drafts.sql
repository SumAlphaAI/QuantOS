begin;

create table if not exists quantos.strategy_drafts (
  draft_id uuid primary key,
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  workspace_id uuid not null references quantos.workspaces(id) on delete cascade,
  owner_actor_id uuid not null references quantos.actors(id) on delete restrict,
  name text not null,
  head_version bigint not null default 0 check (head_version >= 0),
  created_by_actor uuid not null references quantos.actors(id) on delete restrict,
  created_by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quantos.strategy_draft_versions (
  version_id uuid primary key,
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  draft_id uuid not null references quantos.strategy_drafts(draft_id) on delete cascade,
  version bigint not null check (version > 0),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  data_snapshot_id uuid references quantos.data_snapshots(id) on delete restrict,
  artifact_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(artifact_refs) = 'array'),
  content_hash text not null check (content_hash like 'sha256:%'),
  save_kind text not null check (save_kind in ('manual', 'autosave')),
  created_by_actor uuid not null references quantos.actors(id) on delete restrict,
  created_by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (draft_id, version)
);

create index if not exists idx_strategy_drafts_tenant_updated
  on quantos.strategy_drafts (tenant_id, updated_at desc);

create index if not exists idx_strategy_draft_versions_draft
  on quantos.strategy_draft_versions (tenant_id, draft_id, version desc);

comment on table quantos.strategy_drafts is 'Versioned strategy draft heads anchored to tenant, workspace, and auth.users-audited actors.';
comment on table quantos.strategy_draft_versions is 'Immutable strategy draft parameter versions with approved DataSnapshot and Artifact references.';

alter table quantos.strategy_drafts enable row level security;
alter table quantos.strategy_drafts force row level security;
alter table quantos.strategy_draft_versions enable row level security;
alter table quantos.strategy_draft_versions force row level security;

create policy "strategy_drafts_select_member"
  on quantos.strategy_drafts
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "strategy_drafts_service_role_all"
  on quantos.strategy_drafts
  for all
  to service_role
  using (true)
  with check (true);

create policy "strategy_draft_versions_select_member"
  on quantos.strategy_draft_versions
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "strategy_draft_versions_service_role_all"
  on quantos.strategy_draft_versions
  for all
  to service_role
  using (true)
  with check (true);

commit;
