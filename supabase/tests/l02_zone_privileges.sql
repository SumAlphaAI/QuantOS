-- Read-only target assertions, not run by local checks. Requires separately
-- approved target and the L02 migration; never provisions or reads a secret.
begin;
do $$
declare
  resolver regprocedure := to_regprocedure('quantos.resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)');
  role_name text;
begin
  if resolver is null then raise exception 'L02 migration NOT_APPLIED'; end if;
  foreach role_name in array array['anon','authenticated','service_role','quantos_bff','quantos_engine','quantos_runtime'] loop
    if has_function_privilege(role_name,resolver,'EXECUTE') then
      raise exception 'unexpected zone resolver privilege';
    end if;
    if has_table_privilege(role_name,'quantos.execution_credential_versions','SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'unexpected credential registry privilege';
    end if;
  end loop;
  if not has_function_privilege('quantos_execution_gateway',resolver,'EXECUTE') then
    raise exception 'execution allowlist grant missing';
  end if;
  if has_function_privilege('quantos_execution_gateway',
      'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone,uuid)','EXECUTE') then
    raise exception 'legacy unbound resolver still allowed';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then raise exception 'target Vault NOT_AVAILABLE'; end if;
  foreach role_name in array array['quantos_bff','quantos_engine','quantos_runtime','quantos_execution_gateway'] loop
    if has_table_privilege(role_name,'vault.decrypted_secrets','SELECT') then
      raise exception 'application direct Vault access';
    end if;
  end loop;
end;
$$;
rollback;
-- Positive decrypt/tenant/account/mTLS/rotation matrices require owned target
-- fixtures and separate authorization. This read-only test does not prove them.
