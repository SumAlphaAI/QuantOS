# Supabase Tests

Keep database-level policy, function, and migration regression assets here.

Current command coverage uses repository shell checks to validate:

- migration filename format,
- RLS enablement and policy presence,
- `FORCE ROW LEVEL SECURITY` on tenant tables,
- `auth.users` references,
- `gen_random_uuid()` defaults,
- `timestamptz` usage.

Future iterations can add pgTAP or SQL fixtures in this directory once remote PostgreSQL checks against `DATABASE_URL` are part of routine CI.

`live-rls` also validates UUID primary-key defaults. Six exact BFF identity/command columns are supplied explicitly by the application and intentionally have no random default: `bff_access_requests.request_id`, `bff_auth_challenges.challenge_ref`, `bff_devices.device_id`, `bff_reauth_grants.grant_ref`, `bff_security_commands.idempotency_key`, `bff_settings_audits.audit_ref`. The versioned checker permits only those column pairs; new tables or other columns still fail. In particular, a missing caller idempotency token must never be replaced by a database-generated key. RLS, FORCE RLS, tenant policies and unsafe role privileges are checked without exceptions.
