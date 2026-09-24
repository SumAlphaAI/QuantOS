begin;

create index workspace_memberships_actor_context_idx
  on quantos.workspace_memberships(tenant_id, actor_id, workspace_id);
create index actor_capabilities_context_idx
  on quantos.actor_capabilities(tenant_id, actor_id, mode_scope, workspace_id, account_id)
  include (capability);
create index accounts_primary_context_idx
  on quantos.accounts(tenant_id, workspace_id, mode, id)
  where is_active;
create index service_sessions_account_idx
  on quantos.execution_service_sessions(tenant_id, account_id, actor_id)
  where revoked_at is null;

commit;
