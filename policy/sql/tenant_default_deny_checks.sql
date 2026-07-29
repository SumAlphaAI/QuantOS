-- QuantOS F05 policy assertions
-- Run against a remote DATABASE_URL target to validate default-deny posture.

-- 1. Every tenant table should enforce RLS instead of only enabling it.
select n.nspname || '.' || c.relname as table_name
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'quantos'
  and c.relkind = 'r'
  and c.relname <> 'schema_migrations'
  and c.relforcerowsecurity is false
order by 1;

-- 2. Authenticated or anon roles should not receive write policies on tenant tables.
select schemaname || '.' || tablename as table_name,
       policyname,
       cmd,
       roles
from pg_policies
where schemaname = 'quantos'
  and tablename <> 'schema_migrations'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles && array['authenticated'::name, 'anon'::name]
order by 1, 2;
