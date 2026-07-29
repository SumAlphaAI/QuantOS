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
