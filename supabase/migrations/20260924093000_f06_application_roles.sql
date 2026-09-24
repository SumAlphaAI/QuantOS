begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'quantos_bff') then
    create role quantos_bff nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'quantos_engine') then
    create role quantos_engine nologin;
  end if;
end;
$$;

-- The BFF verifies the Supabase access token before querying this role. Its
-- role can read identity metadata only; it cannot resolve Vault references.
grant usage on schema quantos to quantos_bff;
grant select on quantos.actors, quantos.workspace_memberships,
  quantos.workspaces, quantos.accounts, quantos.actor_capabilities
  to quantos_bff;

create policy "actors_bff_select" on quantos.actors
  for select to quantos_bff using (true);
create policy "workspace_memberships_bff_select" on quantos.workspace_memberships
  for select to quantos_bff using (true);
create policy "workspaces_bff_select" on quantos.workspaces
  for select to quantos_bff using (true);
create policy "accounts_bff_select" on quantos.accounts
  for select to quantos_bff using (true);
create policy "actor_capabilities_bff_select" on quantos.actor_capabilities
  for select to quantos_bff using (true);

-- No quantos schema USAGE or Vault grants are made to quantos_engine.
revoke all on function quantos.resolve_execution_vault_secret(text,text,timestamptz)
  from quantos_bff, quantos_engine;

commit;
