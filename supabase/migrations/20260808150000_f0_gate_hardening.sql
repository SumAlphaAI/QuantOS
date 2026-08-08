begin;

-- F0 Gate hardening: the legacy service-role function predates the dedicated
-- execution-zone role. Keep the compatibility signature for the Rust store,
-- but make the execution gateway the only role that can invoke it.
revoke all on function quantos.resolve_execution_secret_reference(text, text, text) from public;
revoke all on function quantos.resolve_execution_secret_reference(text, text, text) from authenticated;
revoke all on function quantos.resolve_execution_secret_reference(text, text, text) from anon;
revoke all on function quantos.resolve_execution_secret_reference(text, text, text) from service_role;
grant execute on function quantos.resolve_execution_secret_reference(text, text, text)
  to quantos_execution_gateway;

drop policy if exists "execution_secret_refs_service_role_all"
  on quantos.execution_secret_refs;

create policy "execution_secret_refs_gateway_select"
  on quantos.execution_secret_refs
  for select
  to quantos_execution_gateway
  using (true);

revoke all on table quantos.execution_secret_refs from public;
revoke all on table quantos.execution_secret_refs from authenticated;
revoke all on table quantos.execution_secret_refs from anon;
revoke all on table quantos.execution_secret_refs from service_role;

-- UUID business keys created by the application remain accepted, while
-- database-side inserts now follow the platform-wide gen_random_uuid rule.
alter table quantos.strategy_drafts
  alter column draft_id set default gen_random_uuid();
alter table quantos.strategy_draft_versions
  alter column version_id set default gen_random_uuid();
alter table quantos.strategy_releases
  alter column release_id set default gen_random_uuid();
alter table quantos.strategy_release_deployments
  alter column deployment_id set default gen_random_uuid();

commit;
