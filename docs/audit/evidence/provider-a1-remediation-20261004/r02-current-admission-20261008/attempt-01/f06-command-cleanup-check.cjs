const root='/Users/anray/Documents/project/SumAlpha/QuantOS';
const {Client}=require(root+'/node_modules/pg');
const fs=require('node:fs');
const {connectBeforeStatements}=require(root+'/scripts/lib/postgres-bootstrap.cjs');
process.loadEnvFile(root+'/.env.local');
const u=new URL(process.env.DATABASE_URL),record={};
const options={host:u.hostname,port:5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)||'postgres',ssl:{ca:fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:20000,statement_timeout:20000};
(async()=>{let client;try{client=await connectBeforeStatements(()=>new Client(options),{record});await client.query('begin read only');const r=await client.query(`select t.id,
(select count(*) from quantos.actors a where a.tenant_id=t.id) as actors,
(select count(*) from quantos.actors a where a.tenant_id=t.id and a.is_active) as active_actors,
(select count(*) from quantos.execution_service_sessions s where s.tenant_id=t.id) as sessions,
(select count(*) from quantos.secret_references s where s.tenant_id=t.id) as secret_refs,
(select count(*) from quantos.event_log e where e.tenant_id=t.id) as events,
(select count(*) from quantos.audit_entries a where a.tenant_id=t.id) as audits
from quantos.tenants t where t.slug ~ '^f06-command-[0-9a-f]{16}$' and t.name='F06 command smoke'`);await client.query('rollback');console.log(JSON.stringify({schema:'quantos-f06-command-readonly-cleanup-check/v1',sourceCommit:'e3fbdeca2d38299981e88ace277a74a01fca1baa',checkedAt:new Date().toISOString(),target:'configured-supabase',readOnly:true,bootstrap:record,tenants:r.rows,status:r.rows.length<=1&&r.rows.every(x=>['actors','active_actors','sessions','secret_refs','events','audits'].every(k=>x[k]==='0'))?'PASS':'FAIL',historicalFailurePhase:'UNKNOWN'},null,2));}catch(e){console.error(JSON.stringify({status:'FAIL',bootstrap:record,errorCode:e.code||'DATABASE_CHECK_FAILED'}));process.exitCode=1;}finally{await client?.end();}})();
