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
const r={schema:'quantos-development-fixture-retirement/v1',observedAt:new Date().toISOString(),sourceCommit:'2749c3c819bd591a1d8066598a3bbf092ba48e10',targetProjectRefHash:createHash('sha256').update(ref).digest('hex').slice(0,16),tls:'verify-full with configured CA',formalAccepted:false,fixtureTenant:'01a12acb-6530-7432-88b5-a71f4ee28668'};
const client=new Client({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)||'postgres',ssl:{ca:readFileSync(env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:15000});
try{
 await client.connect();
 r.before=(await client.query("select pg_is_in_recovery() as in_recovery,current_setting('default_transaction_read_only') as default_transaction_read_only,current_setting('transaction_read_only') as transaction_read_only")).rows[0];
 if(r.before.in_recovery)throw new Error('REPLICA_REJECTED');
 await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE');
 r.sessionOverride='maintenance session only';
 const sql=readFileSync(root+'/docs/audit/evidence/r03-prerequisites-20261011/final/pending-fixture-retirement.sql','utf8');
 const result=await client.query(sql);
 r.retiredRuns=result.filter(x=>x.command==='UPDATE')[0]?.rowCount;
 r.disabledTools=result.filter(x=>x.command==='UPDATE')[1]?.rowCount;
 r.after=(await client.query("select count(*)::int as runs,count(*) filter(where status in ('queued','running','cancel_requested'))::int as pending from quantos.workflow_runs where tenant_id=$1",[r.fixtureTenant])).rows[0];
 r.tools=(await client.query('select count(*) filter(where enabled)::int as enabled from quantos.tool_registry where tenant_id=$1',[r.fixtureTenant])).rows[0];
 if(r.after.pending!==0 || r.tools.enabled!==0)throw new Error('CLEANUP_INCOMPLETE');
 r.status='PASS';r.transaction='COMMITTED';
}catch(e){await client.query('rollback').catch(()=>{});r.status='FAIL';r.errorCode=e.code??e.message;}finally{await client.end().catch(()=>{});r.connectionClosed=true;writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}
