import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=process.cwd(),require=createRequire(root+'/package.json');
const {Client}=require('pg');
const {policy,developmentEnvironment}=await import(root+'/scripts/provider-a1-receipts.mjs');
const p=policy(),env=developmentEnvironment(readFileSync(p.developmentProfile.file,'utf8'),p.developmentProfile.overrides);
process.loadEnvFile(root+'/.env.local');Object.assign(env,Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('NEXT_PUBLIC_'))));
const u=new URL(env.DATABASE_URL),api=new URL(env.SUPABASE_URL);
if(!u.hostname.endsWith('.supabase.com'))throw new Error('development Supabase required');
const ref=u.hostname.startsWith('db.')?u.hostname.split('.')[1]:decodeURIComponent(u.username).split('.').at(-1);
if(ref!==api.hostname.split('.')[0])throw new Error('target mismatch');
const r={schema:'quantos-development-readonly-probe/v1',observedAt:new Date().toISOString(),sourceCommit:'b358581d24e51d1e7dd4200176467c833d12a0f0',targetProjectRefHash:createHash('sha256').update(ref).digest('hex').slice(0,16),tls:'verify-full with configured CA',readOnly:true,mutationsExecuted:false,formalAccepted:false};
const client=new Client({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)||'postgres',ssl:{ca:readFileSync(env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:10000});
client.on('error',e=>{r.connectionError=e.code??'CONNECTION_ERROR';});
try{
 await client.connect();r.connected=true;
 r.server=(await client.query("select pg_is_in_recovery() as in_recovery, current_setting('transaction_read_only') as transaction_read_only, current_setting('default_transaction_read_only') as default_transaction_read_only, current_setting('server_version_num') as server_version_num, pg_database_size(current_database())::text as database_bytes")).rows[0];
 await client.query('begin read only');
 r.roundFixtures=(await client.query("select t.id, t.slug, t.created_at, count(w.id)::int as runs, count(w.id) filter(where w.status in ('queued','running','cancel_requested'))::int as pending from quantos.tenants t left join quantos.workflow_runs w on w.tenant_id=t.id where t.slug ~ '^f07-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and t.created_at >= $1 and t.created_at <= $2 group by t.id order by t.created_at",['2026-10-11T10:57:39.680Z','2026-10-11T11:54:00Z'])).rows;
 await client.query('rollback');r.transaction='ROLLED_BACK';r.status='OBSERVED';
}catch(e){r.status='FAIL';r.errorCode=e.code??'PROBE_FAILED';}finally{await client.end().catch(()=>{});r.connectionClosed=true;writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}
