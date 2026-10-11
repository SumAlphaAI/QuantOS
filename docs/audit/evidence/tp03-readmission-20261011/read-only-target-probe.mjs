// Auxiliary diagnosis only; not substituted for any required acceptance check.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
process.loadEnvFile('.env.local');
const u=new URL(process.env.DATABASE_URL);assert(u.hostname.endsWith('.supabase.com'));
const c=new pg.Client({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)||'postgres',ssl:{ca:fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:10000,statement_timeout:10000,application_name:'quantos-tp03-readonly-diagnostic'});
const start=Date.now();let result;
try{await c.connect();const r=await c.query('select 1 as ok');result={schema:'quantos-readonly-target-probe/v1',status:r.rows[0].ok===1?'PASS':'FAIL',databaseModified:false,elapsedMs:Date.now()-start};}catch(e){result={schema:'quantos-readonly-target-probe/v1',status:'FAIL',code:e.code??'QUERY_TIMEOUT',databaseModified:false,elapsedMs:Date.now()-start};}finally{const end=c.end();await Promise.race([end,new Promise(r=>setTimeout(r,1000))]);}
fs.writeFileSync(resolve(import.meta.dirname,'read-only-target-probe.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
