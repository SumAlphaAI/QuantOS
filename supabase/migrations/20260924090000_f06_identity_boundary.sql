begin;

-- Every authorization edge must stay inside the tenant of both endpoints.
alter table quantos.actors add constraint actors_tenant_id_id_unique unique (tenant_id, id);
alter table quantos.workspaces add constraint workspaces_tenant_id_id_unique unique (tenant_id, id);
alter table quantos.accounts add constraint accounts_tenant_id_id_unique unique (tenant_id, id);

alter table quantos.workspace_memberships
  add constraint workspace_memberships_tenant_actor_fk
  foreign key (tenant_id, actor_id) references quantos.actors (tenant_id, id),
  add constraint workspace_memberships_tenant_workspace_fk
  foreign key (tenant_id, workspace_id) references quantos.workspaces (tenant_id, id);
alter table quantos.accounts
  add constraint accounts_tenant_workspace_fk
  foreign key (tenant_id, workspace_id) references quantos.workspaces (tenant_id, id);
alter table quantos.actor_capabilities
  add constraint actor_capabilities_tenant_actor_fk
  foreign key (tenant_id, actor_id) references quantos.actors (tenant_id, id),
  add constraint actor_capabilities_tenant_workspace_fk
  foreign key (tenant_id, workspace_id) references quantos.workspaces (tenant_id, id),
  add constraint actor_capabilities_tenant_account_fk
  foreign key (tenant_id, account_id) references quantos.accounts (tenant_id, id);
alter table quantos.secret_references
  add constraint secret_references_tenant_workspace_fk
  foreign key (tenant_id, workspace_id) references quantos.workspaces (tenant_id, id),
  add constraint secret_references_tenant_account_fk
  foreign key (tenant_id, account_id) references quantos.accounts (tenant_id, id);
alter table quantos.execution_service_sessions
  add constraint execution_service_sessions_tenant_actor_fk
  foreign key (tenant_id, actor_id) references quantos.actors (tenant_id, id);

alter table quantos.execution_service_sessions
  add column account_id uuid,
  add constraint execution_service_sessions_tenant_account_fk
  foreign key (tenant_id, account_id) references quantos.accounts (tenant_id, id);

create or replace function quantos.current_user_has_capability(
  target_tenant_id uuid,
  required_capability text,
  target_mode text default null,
  target_account_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from quantos.actor_capabilities as capability
    join quantos.actors as actor
      on actor.id = capability.actor_id
     and actor.tenant_id = capability.tenant_id
    where capability.tenant_id = target_tenant_id
      and actor.user_id = auth.uid()
      and actor.actor_kind = 'user'
      and actor.is_active = true
      and capability.capability = required_capability
      and (capability.mode_scope is null or capability.mode_scope = target_mode)
      and (capability.account_id is null or capability.account_id = target_account_id)
      and (capability.workspace_id is null or exists (
        select 1 from quantos.workspace_memberships as membership
        where membership.tenant_id = target_tenant_id
          and membership.actor_id = actor.id
          and membership.workspace_id = capability.workspace_id
      ))
      and (target_account_id is null or exists (
        select 1 from quantos.accounts as account
        where account.tenant_id = target_tenant_id
          and account.id = target_account_id
          and account.is_active = true
          and account.mode = target_mode
          and quantos.has_account_access(account.id)
      ))
  );
$$;

commit;
