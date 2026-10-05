import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {digest,root} from './provider-a1-receipts.mjs';
const require=createRequire(import.meta.url);
const {Client}=require('pg');
const {schemaState,assertSchemaMatches}=require('./db-schema-state.cjs');
const {validateF09MigrationLedger}=require('./lib/f09-migration-ledger.cjs');
function run(command,args){const r=spawnSync(command,args,{cwd:root,env:process.env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});process.stdout.write((r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,`${command} failed`);}
async function database(){
 const url=new URL(process.env.DATABASE_URL);const api=new URL(process.env.SUPABASE_URL);const ref=url.hostname.startsWith('db.')?url.hostname.split('.')[1]:decodeURIComponent(url.username).split('.').at(-1);
 assert(api.protocol==='https:'&&api.hostname.endsWith('.supabase.co')&&ref===api.hostname.split('.')[0]&&url.port!=='6543','configured same-project Supabase session endpoint required');
 const ca=readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT);const client=new Client({host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:10000});
 const results=[];await client.connect();
 try{
  const local=new Map(readdirSync(resolve(root,'supabase/migrations')).filter(p=>p.endsWith('.sql')).sort().map(p=>[p,readFileSync(resolve(root,'supabase/migrations',p))]));
  const ledger=(await client.query('select filename,sha256 from quantos.schema_migrations order by filename')).rows;validateF09MigrationLedger(ledger,local);results.push('actual migration ledger matches repository');
  const before=await schemaState(client);assert(before.tables.length>0);assertSchemaMatches(before,before);
  const policies=before.policies.filter(p=>p.tablename==='tenants');assert(policies.length,'tenant policies required');
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  const mutations=[['disable RLS','alter table quantos.tenants disable row level security'],['disable FORCE RLS','alter table quantos.tenants no force row level security'],['drop tenant policies',policies.map(p=>'drop policy '+quote(p.policyname)+' on quantos.tenants').join(';')],['column drift','alter table quantos.tenants add column fep0_drift_probe text'],['index drift','create index fep0_drift_probe on quantos.tenants(slug)']];
  for(const [name,sql]of mutations){
   await client.query('begin');
   try {await client.query("set local lock_timeout='2s'; set local statement_timeout='10s'");await client.query(sql);const changed=await schemaState(client);assert.throws(()=>assertSchemaMatches(changed,before),/SCHEMA_DRIFT/);results.push('reject '+name);}
   finally {await client.query('rollback');}
   assertSchemaMatches(await schemaState(client),before);
  }
  for(const mutate of [rows=>rows.slice(1),rows=>rows.map((r,i)=>i? r:{...r,sha256:'0'.repeat(64)})])assert.throws(()=>validateF09MigrationLedger(mutate(ledger),local));
  results.push('reject missing/changed applied SQL; unchanged catalog after every rollback');
  const receipt={schema:'quantos-f02-development-database/v1',status:'PASS',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),targetClass:'configured-supabase',formalAccepted:false,fullReferenceRebuild:false,checks:results,catalogDigest:digest(JSON.stringify(before)),completedAt:new Date().toISOString()};
  mkdirSync(resolve(root,'artifacts/f02'),{recursive:true});writeFileSync(resolve(root,'artifacts/f02/development-database.json'),JSON.stringify(receipt,null,2)+'\n');console.log('F02 configured Supabase transactional negatives PASS',results.length);
 }finally{await client.query('rollback').catch(()=>{});await client.end();}
}
function capability(){
 const text=readFileSync(resolve(root,'docs/operations/tp01_vibe_inventory_and_threats.md'),'utf8');const rows=text.split('\n').filter(l=>l.startsWith('| ')&&!l.startsWith('| ---')&&!l.startsWith('| Capability')&&!l.startsWith('| Threat')).slice(0,11);
 assert.equal(rows.length,11);for(const row of rows){const cells=row.split('|').slice(1,-1).map(s=>s.trim());assert.equal(cells.length,8);assert(cells.every(Boolean),'capability input/output/side effect/permission/replacement missing');}
 for(const label of ['Trading connectors','Persistent memory','Channels / IM surfaces']){const row=rows.find(r=>r.includes(label));assert(row&&/forbidden|reject|deny/.test(row),'sensitive capability must be denied');}
 const boundary=readFileSync(resolve(root,'docs/adr/20260730-tp01-vibe-boundaries.md'),'utf8');for(const term of ['Trading connectors','Secret persistence','Filesystem','Shell','Network'])assert(text.toLowerCase().includes(term.split(' ')[0].toLowerCase())||boundary.toLowerCase().includes(term.toLowerCase()));
 console.log('TP01-B 11 complete capabilities and forbidden trading/secret/storage coupling PASS');
}
function engine(){
 rmSync(resolve(root,'artifacts/f08-target/wheels'),{recursive:true,force:true});
 run('uv',['build','engines/mock-engine','--wheel','--out-dir','artifacts/f08-target/wheels']);
 run('uv',['sync','--locked','--project','engines','--all-packages','--no-editable']);
 try{run(process.execPath,['scripts/f08-target-service-acceptance.mjs']);}
 finally{run('uv',['sync','--locked','--project','engines','--all-packages']);}
}
function repository(){
 const lock=JSON.parse(readFileSync(resolve(root,'forks/vibe-trading/repository.lock.json')));const owner=new URL(lock.fork.url).pathname.split('/')[1];
 // Read the existing authenticated owner account without changing gh's active account.
 const token=execFileSync('gh',['auth','token','--hostname','github.com','--user',owner],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();assert(token,'authenticated fork owner required');process.env.TP01_FORK_ADMIN_TOKEN=token;
 run('make',['-e','tp01-vibe-repository-check']);
}
try{const mode=process.argv[2];assert.equal(process.argv.length,3);if(mode==='--database')await database();else if(mode==='--capability')capability();else if(mode==='--engine')engine();else if(mode==='--repository')repository();else assert.fail('unknown F0 check mode');}catch(error){console.error(error.message);process.exitCode=1;}
