begin;

-- Supabase Vault exposes plaintext as decrypted_secret, not secret. Preserve
-- the already-applied 09:10 migration checksum and correct its function body
-- in this forward-only migration.
do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone)'::regprocedure
  ) into definition;
  if position('select secret from vault.decrypted_secrets' in definition) = 0 then
    raise exception 'unexpected F06 Vault function definition';
  end if;
  execute replace(definition,
    'select secret from vault.decrypted_secrets',
    'select decrypted_secret from vault.decrypted_secrets');
end;
$$;

-- The security-definer function is the sole application-facing decryption
-- path. Vault itself remains inaccessible to ordinary application roles.
do $$
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    revoke select on vault.decrypted_secrets
      from public, anon, authenticated, service_role, quantos_execution_gateway;
  end if;
end;
$$;

commit;
