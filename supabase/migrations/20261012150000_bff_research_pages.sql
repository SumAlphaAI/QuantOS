begin;
-- Durable page intent precedes R03 enqueue. Retries reuse the same runtime
-- session/correlation/checkpoint, including a crash before the 202 is persisted.
create table quantos.bff_research_commands (
 command_id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references quantos.tenants(id),
 actor_id uuid not null references quantos.actors(id),
 workspace_id uuid not null references quantos.workspaces(id),
 account_id uuid references quantos.accounts(id),
 mode text not null check(mode in ('paper','shadow','assisted_live')),
 operation text not null check(operation in ('create','cancel')),
 idempotency_key uuid not null,
 intent jsonb not null,
 plan jsonb not null,
 response jsonb not null default '{}'::jsonb,
 run_id uuid references quantos.workflow_runs(id),
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 unique nulls not distinct(tenant_id,actor_id,workspace_id,account_id,mode,operation,idempotency_key),
 check (not completed or run_id is not null)
);
create index bff_research_owner_runs on quantos.bff_research_commands(tenant_id,actor_id,workspace_id,account_id,mode,created_at,run_id);
alter table quantos.bff_research_commands enable row level security;
alter table quantos.bff_research_commands force row level security;
revoke all on quantos.bff_research_commands from public,anon,authenticated;
grant select,insert,update on quantos.bff_research_commands to quantos_bff;
create policy bff_research_scope on quantos.bff_research_commands to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.page_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.page_actor',true),'')::uuid
 and workspace_id=nullif(current_setting('quantos.page_workspace',true),'')::uuid
 and account_id is not distinct from nullif(current_setting('quantos.page_account',true),'')::uuid
 and mode=current_setting('quantos.page_mode',true)
) with check (
 tenant_id=nullif(current_setting('quantos.page_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.page_actor',true),'')::uuid
 and workspace_id=nullif(current_setting('quantos.page_workspace',true),'')::uuid
 and account_id is not distinct from nullif(current_setting('quantos.page_account',true),'')::uuid
 and mode=current_setting('quantos.page_mode',true)
);
-- Only list identifiers/diagnostic fields here. Canonical metadata is cold-loaded
-- and validated by R02 through its configured snapshot reader connection.
grant select(id,tenant_id,quality,captured_at,license_label) on quantos.data_snapshots to quantos_bff;
create policy bff_page_snapshot_select on quantos.data_snapshots for select to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.page_tenant',true),'')::uuid
);
grant select(id,tenant_id,actor_id,workspace_id,account_id,mode) on quantos.runtime_sessions to quantos_bff;
create policy bff_page_session_select on quantos.runtime_sessions for select to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.page_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.page_actor',true),'')::uuid
 and workspace_id=nullif(current_setting('quantos.page_workspace',true),'')::uuid
 and account_id is not distinct from nullif(current_setting('quantos.page_account',true),'')::uuid
 and mode=current_setting('quantos.page_mode',true)
);
grant select(id,tenant_id,actor_id,workspace_id,account_id,runtime_session_id,status,cost_used_units,correlation_id) on quantos.workflow_runs to quantos_bff;
create policy bff_page_run_select on quantos.workflow_runs for select to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.page_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.page_actor',true),'')::uuid
 and workspace_id=nullif(current_setting('quantos.page_workspace',true),'')::uuid
 and account_id is not distinct from nullif(current_setting('quantos.page_account',true),'')::uuid
 and exists(select 1 from quantos.runtime_sessions s where s.id=runtime_session_id and s.mode=current_setting('quantos.page_mode',true))
);
grant select(workflow_run_id,artifact_id) on quantos.workflow_run_artifacts to quantos_bff;
create policy bff_page_artifact_select on quantos.workflow_run_artifacts for select to quantos_bff using (
 exists(select 1 from quantos.bff_research_commands c where c.run_id=workflow_run_id and c.operation='create' and c.completed)
);
create table quantos.bff_research_events (
 run_id uuid not null references quantos.workflow_runs(id),
 sequence bigint not null check(sequence>0),
 source_id uuid not null,
 event jsonb not null,
 primary key(run_id,sequence),
 unique(run_id,source_id)
);
alter table quantos.bff_research_events enable row level security;
alter table quantos.bff_research_events force row level security;
revoke all on quantos.bff_research_events from public,anon,authenticated;
grant select,insert on quantos.bff_research_events to quantos_bff;
create policy bff_page_replay_scope on quantos.bff_research_events to quantos_bff using (
 exists(select 1 from quantos.bff_research_commands c where c.run_id=bff_research_events.run_id and c.operation='create' and c.completed)
) with check (
 exists(select 1 from quantos.bff_research_commands c where c.run_id=bff_research_events.run_id and c.operation='create' and c.completed)
);
commit;
