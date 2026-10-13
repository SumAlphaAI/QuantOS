begin;
-- Candidate only: no migration execution was performed during DEVELOPMENT.
create table quantos.bff_market_watchlists (
 scope_key text not null,
 tenant_id uuid not null references quantos.tenants(id),
 actor_id uuid not null references quantos.actors(id),
 workspace_id uuid not null references quantos.workspaces(id),
 account_id uuid references quantos.accounts(id),
 mode text not null check(mode in ('paper','shadow','assisted_live')),
 response jsonb not null,
 primary key(scope_key)
);
alter table quantos.bff_market_watchlists enable row level security;
alter table quantos.bff_market_watchlists force row level security;
revoke all on quantos.bff_market_watchlists from public,anon,authenticated;
grant select,insert,update on quantos.bff_market_watchlists to quantos_bff;
create policy bff_market_watchlists_scope on quantos.bff_market_watchlists to quantos_bff using (
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
create table quantos.bff_market_watchlist_commands (
 scope_key text not null,
 tenant_id uuid not null references quantos.tenants(id),
 actor_id uuid not null references quantos.actors(id),
 workspace_id uuid not null references quantos.workspaces(id),
 account_id uuid references quantos.accounts(id),
 mode text not null check(mode in ('paper','shadow','assisted_live')),
 idempotency_key uuid not null, intent jsonb not null, response jsonb not null,
 primary key(scope_key,idempotency_key)
);
alter table quantos.bff_market_watchlist_commands enable row level security;
alter table quantos.bff_market_watchlist_commands force row level security;
revoke all on quantos.bff_market_watchlist_commands from public,anon,authenticated;
grant select,insert,update on quantos.bff_market_watchlist_commands to quantos_bff;
create policy bff_market_watchlist_commands_scope on quantos.bff_market_watchlist_commands to quantos_bff using (
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
commit;
