begin;

create table if not exists quantos.runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  actor_id uuid not null references quantos.actors(id) on delete cascade,
  workspace_id uuid not null references quantos.workspaces(id) on delete cascade,
  account_id uuid references quantos.accounts(id) on delete set null,
  mode text not null check (mode in ('paper', 'shadow', 'assisted_live')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_runtime_sessions_actor_active
  on quantos.runtime_sessions (actor_id, expires_at);

create table if not exists quantos.tool_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  tool_name text not null,
  capability text not null,
  description text not null,
  max_cost_units bigint not null check (max_cost_units >= 0),
  rate_limit_per_minute integer not null check (rate_limit_per_minute > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tool_name)
);

create table if not exists quantos.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  runtime_session_id uuid not null references quantos.runtime_sessions(id) on delete cascade,
  actor_id uuid not null references quantos.actors(id) on delete cascade,
  workspace_id uuid not null references quantos.workspaces(id) on delete cascade,
  account_id uuid references quantos.accounts(id) on delete set null,
  tool_name text not null,
  capability text not null,
  workflow_kind text not null,
  idempotency_key text not null,
  correlation_id uuid not null,
  input_hash text not null check (input_hash like 'sha256:%'),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled', 'timed_out')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 1 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  cost_budget_units bigint not null check (cost_budget_units >= 0),
  rate_limit_per_minute integer not null check (rate_limit_per_minute > 0),
  lease_owner text,
  lease_expires_at timestamptz,
  cancel_requested_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists idx_workflow_runs_claimable
  on quantos.workflow_runs (status, next_attempt_at, lease_expires_at, deadline_at);

create table if not exists quantos.workflow_run_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null unique references quantos.workflow_runs(id) on delete cascade,
  checkpoint_key text not null,
  step_index integer not null check (step_index >= 0),
  payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists quantos.workflow_run_artifacts (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references quantos.workflow_runs(id) on delete cascade,
  artifact_id uuid not null references quantos.object_artifacts(artifact_id) on delete cascade,
  linked_at timestamptz not null default now(),
  unique (workflow_run_id, artifact_id)
);

comment on table quantos.runtime_sessions is 'Authenticated runtime sessions bound to tenant, actor, workspace, account, and mode context.';
comment on table quantos.tool_registry is 'Tenant-scoped runtime tool registry with cost and rate limits.';
comment on table quantos.workflow_runs is 'Persistent workflow task ledger with leases, retries, deadlines, and idempotency.';
comment on table quantos.workflow_run_checkpoints is 'Latest durable workflow checkpoint per run for restart recovery.';
comment on table quantos.workflow_run_artifacts is 'Artifact bindings emitted by workflow runs; deduplicated by artifact manifest identity.';

alter table quantos.runtime_sessions enable row level security;
alter table quantos.runtime_sessions force row level security;
alter table quantos.tool_registry enable row level security;
alter table quantos.tool_registry force row level security;
alter table quantos.workflow_runs enable row level security;
alter table quantos.workflow_runs force row level security;
alter table quantos.workflow_run_checkpoints enable row level security;
alter table quantos.workflow_run_checkpoints force row level security;
alter table quantos.workflow_run_artifacts enable row level security;
alter table quantos.workflow_run_artifacts force row level security;

create policy "runtime_sessions_select_member"
  on quantos.runtime_sessions
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "runtime_sessions_service_role_all"
  on quantos.runtime_sessions
  for all
  to service_role
  using (true)
  with check (true);

create policy "tool_registry_select_member"
  on quantos.tool_registry
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "tool_registry_service_role_all"
  on quantos.tool_registry
  for all
  to service_role
  using (true)
  with check (true);

create policy "workflow_runs_select_member"
  on quantos.workflow_runs
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "workflow_runs_service_role_all"
  on quantos.workflow_runs
  for all
  to service_role
  using (true)
  with check (true);

create policy "workflow_run_checkpoints_select_member"
  on quantos.workflow_run_checkpoints
  for select
  to authenticated
  using (
    exists (
      select 1
      from quantos.workflow_runs as run
      where run.id = workflow_run_checkpoints.workflow_run_id
        and quantos.is_tenant_member(run.tenant_id)
    )
  );

create policy "workflow_run_checkpoints_service_role_all"
  on quantos.workflow_run_checkpoints
  for all
  to service_role
  using (true)
  with check (true);

create policy "workflow_run_artifacts_select_member"
  on quantos.workflow_run_artifacts
  for select
  to authenticated
  using (
    exists (
      select 1
      from quantos.workflow_runs as run
      where run.id = workflow_run_artifacts.workflow_run_id
        and quantos.is_tenant_member(run.tenant_id)
    )
  );

create policy "workflow_run_artifacts_service_role_all"
  on quantos.workflow_run_artifacts
  for all
  to service_role
  using (true)
  with check (true);

commit;
