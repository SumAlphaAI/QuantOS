# policy/sql

SQL policy audit assets for QuantOS live alongside the Supabase migrations so operators can run catalog-level checks against a remote `DATABASE_URL` target.

Current assets focus on F05 default-deny guarantees:

- every tenant table keeps `FORCE ROW LEVEL SECURITY`,
- authenticated roles only receive membership-scoped `SELECT`,
- write capabilities stay restricted to `service_role`.
