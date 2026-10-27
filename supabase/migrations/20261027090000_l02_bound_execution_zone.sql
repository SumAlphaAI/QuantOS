begin;

-- Operator provisions sessions and version rows; application roles cannot.
-- No Vault values, login passwords, dynamic leases or target changes in this file.
-- Managed Supabase operators need not be PostgreSQL superusers. Check unsafe
-- attributes rather than attempting to ALTER SUPERUSER/BYPASSRLS properties.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'quantos_execution_gateway'
    and not (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'L02 unsafe or missing execution role';
  end if;
end;
$$;
alter role quantos_execution_gateway nologin noinherit;
alter table quantos.execution_service_sessions
  add column execution_peer_fingerprint text
    check (execution_peer_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  add column execution_credential_version bigint
    check (execution_credential_version > 0);

create table quantos.execution_credential_versions (
  secret_reference_id uuid not null references quantos.secret_references(id),
  version bigint not null check (version > 0),
  peer_fingerprint text not null check (peer_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  vault_path text not null check (vault_path ~ '^vault://[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  state text not null check (state in ('active','draining','revoked')),
  valid_from timestamptz not null,
  valid_until timestamptz not null check (valid_until > valid_from),
  rotated_at timestamptz,
  retire_at timestamptz,
  primary key (secret_reference_id,version),
  check (state <> 'draining' or (rotated_at is not null and retire_at is not null
    and retire_at > rotated_at and retire_at <= rotated_at + interval '5 minutes'))
);
create unique index execution_credential_one_active
  on quantos.execution_credential_versions(secret_reference_id) where state = 'active';
alter table quantos.execution_credential_versions enable row level security;
alter table quantos.execution_credential_versions force row level security;
revoke all on quantos.execution_credential_versions from public,anon,authenticated,service_role,
  quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;

do $$
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    revoke select on vault.decrypted_secrets from anon,authenticated,
      quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;
  end if;
end;
$$;

-- Old name-only / unbound decrypt APIs remain historical objects, lose all app grants.
revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz,uuid)
  from public,anon,authenticated,service_role,quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;
revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz)
  from public,anon,authenticated,service_role,quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;
revoke all on function quantos.resolve_execution_secret_ref(text)
  from public,anon,authenticated,service_role,quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;
revoke all on function quantos.resolve_execution_secret_reference(text,text,text)
  from public,anon,authenticated,service_role,quantos_bff,quantos_engine,quantos_runtime,quantos_execution_gateway;

create function quantos.resolve_execution_zone_secret(
  input_session_token_hash text,input_secret_name text,input_command_expires_at timestamptz,
  input_command_account_id uuid,input_peer_fingerprint text,input_credential_version bigint
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  observed_at timestamptz := clock_timestamp();
  target_path text;
  decrypted text;
begin
  if input_session_token_hash is null or input_session_token_hash !~ '^sha256:[0-9a-f]{64}$'
    or input_secret_name is distinct from 'binance-testnet-key'
    or input_command_expires_at is null or input_command_expires_at <= observed_at
    or input_command_expires_at > observed_at + interval '5 minutes'
    or input_command_account_id is null or input_peer_fingerprint is null
    or input_peer_fingerprint !~ '^sha256:[0-9a-f]{64}$'
    or input_credential_version is null or input_credential_version <= 0 then
    return null;
  end if;
  select credential.vault_path into target_path
  from quantos.execution_service_sessions as session
  join quantos.actors as actor on actor.id = session.actor_id
    and actor.tenant_id = session.tenant_id and actor.actor_kind = 'service' and actor.is_active
  join quantos.accounts as account on account.id = session.account_id
    and account.tenant_id = session.tenant_id and account.is_active
  join quantos.secret_references as secret on secret.tenant_id = session.tenant_id
    and secret.account_id = account.id and secret.workspace_id = account.workspace_id
    and secret.secret_name = input_secret_name and secret.rotation_state = 'active'
  join quantos.execution_credential_versions as credential on credential.secret_reference_id = secret.id
    and credential.version = input_credential_version and credential.peer_fingerprint = input_peer_fingerprint
    and credential.valid_from <= observed_at and credential.valid_until > observed_at
    and ((credential.state = 'active' and not exists (select 1 from quantos.execution_credential_versions as newer
      where newer.secret_reference_id = secret.id and newer.version > credential.version)) or (credential.state = 'draining'
      and credential.rotated_at <= observed_at and credential.retire_at > observed_at))
  where session.session_token_hash = input_session_token_hash
    and session.account_id = input_command_account_id
    and session.execution_peer_fingerprint = input_peer_fingerprint
    and session.execution_credential_version = input_credential_version
    and session.revoked_at is null and session.created_at <= observed_at
    and session.expires_at > observed_at
    and session.expires_at <= session.created_at + interval '15 minutes'
    and input_command_expires_at <= session.expires_at
    and session.allowed_capability = 'execution.operate'
    and secret.required_capability = session.allowed_capability
    and exists (select 1 from quantos.actor_capabilities as capability
      where capability.tenant_id = session.tenant_id and capability.actor_id = actor.id
        and capability.account_id = account.id and capability.workspace_id = account.workspace_id
        and capability.mode_scope = account.mode and capability.capability = secret.required_capability);
  if target_path is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where id = $1'
    into decrypted using substring(target_path from 9)::uuid;
  return decrypted;
end;
$$;
revoke all on function quantos.resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)
  from public,anon,authenticated,service_role,quantos_bff,quantos_engine,quantos_runtime;
grant execute on function quantos.resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)
  to quantos_execution_gateway;
comment on function quantos.resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)
  is 'L02: caller supplies only the peer fingerprint derived from verified TLS; session, account, capability, version and half-open TTL/drain window must all agree. No plaintext is logged.';
commit;
