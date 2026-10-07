begin;
-- PostgreSQL created a postgres-grantor row with default INHERIT=true when the
-- SET grant was added, alongside the original supabase_admin grantor row.
-- Narrow only this verified identity's existing grant; retain SET for tests.
grant quantos_snapshot_writer to postgres with inherit false;
commit;
