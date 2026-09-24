begin;

-- The caller must supply an actual runtime mode. A NULL target previously
-- matched global grants and let callers omit an authorization dimension.
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
  select target_tenant_id is not null
     and required_capability is not null
     and target_mode in ('paper', 'shadow', 'assisted_live')
     and exists (
       select 1
       from quantos.actor_capabilities as capability
       join quantos.actors as actor
         on actor.id = capability.actor_id
        and actor.tenant_id = capability.tenant_id
       where capability.tenant_id = target_tenant_id
         and actor.user_id = auth.uid()
         and actor.actor_kind = 'user'
         and actor.is_active
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
             and account.is_active
             and account.mode = target_mode
             and quantos.has_account_access(account.id)
         ))
     );
$$;

commit;
