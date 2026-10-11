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
const r={schema:'quantos-development-normal-writability/v1',observedAt:new Date().toISOString(),sourceCommit:'2749c3c819bd591a1d8066598a3bbf092ba48e10',targetProjectRefHash:createHash('sha256').update(ref).digest('hex').slice(0,16),tls:'verify-full with configured CA',formalAccepted:false,fixtureTenant:'01a12acb-6530-7432-88b5-a71f4ee28668'};
const client=new Client({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)||'postgres',ssl:{ca:readFileSync(env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:15000});
try {
 await client.connect();
 r.before=(await client.query("select pg_is_in_recovery() as in_recovery,current_setting('default_transaction_read_only') as default_transaction_read_only,current_setting('transaction_read_only') as transaction_read_only")).rows[0];
 await client.query('BEGIN');
 try {
   await client.query('UPDATE quantos.tool_registry SET enabled=enabled WHERE tenant_id=$1',[r.fixtureTenant]);
   r.normalWriteProbe={status:'PASS',rolledBack:true};
 } catch(e) {r.normalWriteProbe={status:'FAIL',errorCode:e.code};}
 await client.query('ROLLBACK');r.transaction='ROLLED_BACK';
 r.status=r.normalWriteProbe.status==='PASS' && r.before.default_transaction_read_only==='off' && r.before.transaction_read_only==='off'?'PASS':'BLOCKED';
}catch(e){await client.query('ROLLBACK').catch(()=>{});r.status='FAIL';r.errorCode=e.code??'PROBE_FAILED';}finally{await client.end().catch(()=>{});r.connectionClosed=true;writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}
