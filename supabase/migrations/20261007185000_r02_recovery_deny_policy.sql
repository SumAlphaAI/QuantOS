begin;
-- Explicit deny documents the private recovery ledger's existing default-deny
-- boundary and satisfies the repository's FORCE-RLS/policy baseline.
create policy artifact_upload_attempts_deny_direct on quantos.artifact_upload_attempts
 for all to public using (false) with check (false);
commit;
