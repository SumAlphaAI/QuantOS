begin;

-- Keep the L02 credential-version registry operator-only. Its original migration
-- enabled/forced RLS and revoked application grants; make default denial explicit
-- without rewriting that migration or granting access to any application role.
create policy execution_credential_versions_deny_all
  on quantos.execution_credential_versions
  as restrictive
  for all
  to public
  using (false)
  with check (false);

commit;
