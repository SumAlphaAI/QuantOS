begin;

-- Retire the name-only lookup: it had no service session, command TTL or
-- account scope. Keep the table for migration compatibility, but make it
-- inaccessible through application roles.
revoke all on function quantos.resolve_execution_secret_ref(text)
  from public, anon, authenticated, service_role, quantos_execution_gateway;
revoke all on function quantos.resolve_execution_secret_reference(text, text, text)
  from public, anon, authenticated, service_role, quantos_execution_gateway;

create or replace function quantos.resolve_execution_vault_secret(
  input_session_token_hash text,
  input_secret_name text,
  input_command_expires_at timestamptz
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  secret_ref text;
  decrypted text;
begin
  if input_session_token_hash is null
     or input_secret_name is null
     or input_command_expires_at is null
     or input_command_expires_at <= clock_timestamp() then
    return null;
  end if;

  select secret.vault_path into secret_ref
  from quantos.execution_service_sessions as session
  join quantos.actors as actor
    on actor.id = session.actor_id
   and actor.tenant_id = session.tenant_id
   and actor.actor_kind = 'service'
   and actor.is_active
  join quantos.accounts as account
    on account.id = session.account_id
   and account.tenant_id = session.tenant_id
   and account.is_active
  join quantos.secret_references as secret
    on secret.tenant_id = session.tenant_id
   and secret.account_id = account.id
   and secret.workspace_id = account.workspace_id
   and secret.secret_name = input_secret_name
   and secret.rotation_state = 'active'
  where session.session_token_hash = input_session_token_hash
    and session.revoked_at is null
    and session.expires_at > clock_timestamp()
    and input_command_expires_at <= session.expires_at
    and session.allowed_capability = secret.required_capability
    and exists (
      select 1 from quantos.actor_capabilities as capability
      where capability.tenant_id = session.tenant_id
        and capability.actor_id = actor.id
        and capability.account_id = account.id
        and capability.workspace_id = account.workspace_id
        and capability.mode_scope = account.mode
        and capability.capability = secret.required_capability
    );

  if secret_ref is null or secret_ref !~
    '^vault://[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  -- Dynamic SQL keeps migration replay possible without the hosted Vault
  -- extension. A target without Vault fails closed when invoked.
  execute 'select secret from vault.decrypted_secrets where id = $1'
    into decrypted using substring(secret_ref from 9)::uuid;
  return decrypted;
end;
$$;

revoke all on function quantos.resolve_execution_vault_secret(text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant usage on schema quantos to quantos_execution_gateway;
grant execute on function quantos.resolve_execution_vault_secret(text, text, timestamptz)
  to quantos_execution_gateway;

comment on function quantos.resolve_execution_vault_secret(text, text, timestamptz)
  is 'Only the controlled execution role may decrypt an allowlisted static Vault secret for an active scoped service session and unexpired command.';

commit;
