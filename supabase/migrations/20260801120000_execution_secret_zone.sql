begin;

-- Dedicated controlled role for the Execution Gateway restricted zone. The
-- role is login-less; it is assumed only by the gateway's managed connection.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'quantos_execution_gateway') then
    create role quantos_execution_gateway nologin;
  end if;
end
$$;

-- Static Vault secret *references* for the restricted execution zone. Secret
-- material itself lives only in Supabase Vault; this table stores pointers,
-- purposes, and rotation/revocation metadata. Dynamic leases are not used.
create table if not exists quantos.execution_secret_refs (
  name text primary key,
  vault_ref text not null check (vault_ref like 'vault://%'),
  purpose text not null,
  rotation_sla_seconds integer not null default 300 check (rotation_sla_seconds > 0),
  rotated_at timestamptz,
  revoked_at timestamptz
);

comment on table quantos.execution_secret_refs is 'Static Vault secret references for the restricted execution zone; only the execution gateway role may resolve them.';

alter table quantos.execution_secret_refs enable row level security;
alter table quantos.execution_secret_refs force row level security;

create policy "execution_secret_refs_service_role_all"
  on quantos.execution_secret_refs
  for all
  to service_role
  using (true)
  with check (true);

-- Allowlist resolution function: the ONLY path that maps a secret name to its
-- Vault reference. It is executable exclusively by the execution gateway
-- role; research engines, UI sessions, and ordinary BFF roles cannot call it.
create or replace function quantos.resolve_execution_secret_ref(secret_name text)
returns table (vault_ref text, purpose text, revoked_at timestamptz)
language sql
stable
security definer
set search_path = quantos
as $$
  select r.vault_ref, r.purpose, r.revoked_at
  from quantos.execution_secret_refs r
  where r.name = secret_name;
$$;

revoke all on function quantos.resolve_execution_secret_ref(text) from public;
revoke all on function quantos.resolve_execution_secret_ref(text) from authenticated;
revoke all on function quantos.resolve_execution_secret_ref(text) from service_role;
revoke all on function quantos.resolve_execution_secret_ref(text) from anon;
grant execute on function quantos.resolve_execution_secret_ref(text) to quantos_execution_gateway;

commit;
