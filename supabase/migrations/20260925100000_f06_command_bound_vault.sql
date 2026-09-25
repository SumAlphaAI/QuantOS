begin;

-- A TradeCommand must name the same account as the short-lived Execution
-- service session. The three-argument resolver did not receive that account;
-- retire its application grant before enabling the command-bound form.
revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz)
  from public, anon, authenticated, service_role, quantos_bff,
       quantos_engine, quantos_runtime, quantos_execution_gateway;

create function quantos.resolve_execution_vault_secret(
  input_session_token_hash text,
  input_secret_name text,
  input_command_expires_at timestamptz,
  input_command_account_id uuid
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
     or input_command_account_id is null
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
    and session.account_id = input_command_account_id
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

  execute 'select decrypted_secret from vault.decrypted_secrets where id = $1'
    into decrypted using substring(secret_ref from 9)::uuid;
  return decrypted;
end;
$$;

revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz,uuid)
  from public, anon, authenticated, service_role, quantos_bff,
       quantos_engine, quantos_runtime;
grant execute on function quantos.resolve_execution_vault_secret(text,text,timestamptz,uuid)
  to quantos_execution_gateway;

comment on function quantos.resolve_execution_vault_secret(text,text,timestamptz,uuid)
  is 'Only the controlled Execution role may decrypt an active allowlisted Vault secret when service session, TradeCommand account and TTL agree.';

commit;
