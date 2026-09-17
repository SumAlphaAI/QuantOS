// Canonical schema definition, independent of data and database OIDs.
async function schemaState(client) {
  const queries = {
    tables: `select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='quantos' and c.relkind in ('r','p','v','m','S') order by c.relname`,
    columns: `select table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_schema,udt_name from information_schema.columns where table_schema='quantos' order by table_name,ordinal_position`,
    constraints: `select c.relname,t.conname,pg_get_constraintdef(t.oid,true) as definition from pg_constraint t join pg_class c on c.oid=t.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='quantos' order by c.relname,t.conname`,
    indexes: `select tablename,indexname,indexdef from pg_indexes where schemaname='quantos' order by tablename,indexname`,
    policies: `select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='quantos' order by tablename,policyname`,
    routines: `select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='quantos' and p.prokind in ('f','p') order by p.proname,arguments`,
    triggers: `select c.relname,t.tgname,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='quantos' and not t.tgisinternal order by c.relname,t.tgname`
  };
  const state={};
  for(const [name,sql] of Object.entries(queries))state[name]=(await client.query(sql)).rows;
  return state;
}
module.exports={schemaState};
