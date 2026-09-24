begin;

alter table quantos.workflow_runs
  add column attempt_id uuid,
  add column request_fingerprint text not null default 'legacy',
  add column cost_used_units bigint not null default 0 check (cost_used_units >= 0),
  add constraint workflow_runs_tenant_id_id_unique unique (tenant_id, id),
  add constraint workflow_runs_cost_within_budget check (cost_used_units <= cost_budget_units);

alter table quantos.object_artifacts
  add constraint object_artifacts_tenant_id_artifact_id_unique unique (tenant_id, artifact_id);

alter table quantos.workflow_run_artifacts
  add column tenant_id uuid;
update quantos.workflow_run_artifacts as binding
set tenant_id = run.tenant_id
from quantos.workflow_runs as run
where binding.workflow_run_id = run.id;
alter table quantos.workflow_run_artifacts
  alter column tenant_id set not null,
  add constraint workflow_run_artifacts_tenant_run_fk
    foreign key (tenant_id, workflow_run_id) references quantos.workflow_runs (tenant_id, id),
  add constraint workflow_run_artifacts_tenant_artifact_fk
    foreign key (tenant_id, artifact_id) references quantos.object_artifacts (tenant_id, artifact_id);

create table quantos.workflow_tool_rate_windows (
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  tool_name text not null,
  window_start timestamptz not null,
  accepted_count integer not null check (accepted_count >= 0),
  primary key (tenant_id, tool_name, window_start)
);
alter table quantos.workflow_tool_rate_windows enable row level security;
alter table quantos.workflow_tool_rate_windows force row level security;
create policy "workflow_tool_rate_windows_service_role_all"
  on quantos.workflow_tool_rate_windows for all to service_role
  using (true) with check (true);

create index workflow_runs_expired_attempts
  on quantos.workflow_runs (tenant_id, lease_expires_at)
  where status = 'running';

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'quantos_runtime') then
    create role quantos_runtime nologin;
  end if;
end $$;
grant usage on schema quantos to quantos_runtime;
grant select on quantos.actors, quantos.workspace_memberships, quantos.accounts,
  quantos.actor_capabilities to quantos_runtime;
grant select, insert, update on quantos.runtime_sessions, quantos.tool_registry,
  quantos.workflow_runs, quantos.workflow_run_checkpoints,
  quantos.workflow_run_artifacts, quantos.object_artifacts,
  quantos.workflow_tool_rate_windows to quantos_runtime;
grant insert, select on quantos.audit_entries to quantos_runtime;

create policy "actors_runtime_select" on quantos.actors
  for select to quantos_runtime using (true);
create policy "workspace_memberships_runtime_select" on quantos.workspace_memberships
  for select to quantos_runtime using (true);
create policy "accounts_runtime_select" on quantos.accounts
  for select to quantos_runtime using (true);
create policy "actor_capabilities_runtime_select" on quantos.actor_capabilities
  for select to quantos_runtime using (true);
create policy "runtime_sessions_runtime_all" on quantos.runtime_sessions
  for all to quantos_runtime using (true) with check (true);
create policy "tool_registry_runtime_all" on quantos.tool_registry
  for all to quantos_runtime using (true) with check (true);
create policy "workflow_runs_runtime_all" on quantos.workflow_runs
  for all to quantos_runtime using (true) with check (true);
create policy "workflow_run_checkpoints_runtime_all" on quantos.workflow_run_checkpoints
  for all to quantos_runtime using (true) with check (true);
create policy "workflow_run_artifacts_runtime_all" on quantos.workflow_run_artifacts
  for all to quantos_runtime using (true) with check (true);
create policy "object_artifacts_runtime_all" on quantos.object_artifacts
  for all to quantos_runtime using (true) with check (true);
create policy "workflow_tool_rate_windows_runtime_all" on quantos.workflow_tool_rate_windows
  for all to quantos_runtime using (true) with check (true);
create policy "audit_entries_runtime_insert" on quantos.audit_entries
  for insert to quantos_runtime with check (true);
create policy "audit_entries_runtime_select" on quantos.audit_entries
  for select to quantos_runtime using (true);
revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz)
  from quantos_runtime;

commit;
