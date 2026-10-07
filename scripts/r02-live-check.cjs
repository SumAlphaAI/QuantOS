#!/usr/bin/env node
// Configured Supabase only. Fresh evidence directory and a unique named fixture scope.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {targetUrl,client,connectionMode}=require('./lib/r01-db.cjs');
const run=crypto.randomUUID(),out=path.resolve(process.env.QUANTOS_R02_EVIDENCE_DIR||`artifacts/r02/${run}`);
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('R02_EVIDENCE_DIRECTORY_NOT_EMPTY');fs.mkdirSync(out,{recursive:true});
const sourcePaths=['crates/quantos-storage/src','crates/quantos-storage/tests','crates/quantos-strategy/src','crates/quantos-runtime/src','crates/quantos-runtime/tests','supabase/migrations','scripts/r02-live-check.cjs','scripts/check-r02.mjs','scripts/r02-behavior-negative.cjs','scripts/check-r02-coverage.mjs','scripts/r02-coverage-negative.mjs','scripts/r02-forward-migration.cjs','Makefile','Cargo.lock'];
const walk=p=>fs.statSync(p).isDirectory()?fs.readdirSync(p).sort().flatMap(n=>walk(path.join(p,n))):[p];
const sourceFiles=sourcePaths.flatMap(p=>fs.existsSync(p)?walk(p):[]).map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
const receipt={schema:'quantos-r02-live/v2',run,connectionMode:connectionMode(targetUrl()),target:'configured Supabase only',sourceFiles,result:'RUNNING',tests:[],cleanup:null,formalAcceptance:'NOT_ACCEPTED',releasePerformance:'BASELINE_ONLY'};
const save=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
function redact(text){for(const [k,v]of Object.entries(process.env))if(/(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)$/.test(k)&&v.length>=10)text=text.split(v).join('[REDACTED]');return text;}
async function cargo(args,name){
 const env={...process.env,DATABASE_URL:(()=>{const u=new URL(targetUrl());u.searchParams.set('connect_timeout','10');return u.toString();})(),QUANTOS_R02_RUN_ID:run,QUANTOS_RUN_R02_POSTGRES_TESTS:'1',QUANTOS_RUN_SUPABASE_STORAGE_TESTS:'1'};
 const child=spawn('cargo',args,{env,detached:true,stdio:['ignore','pipe','pipe']});let log='',timedOut=false;
 const stop=signal=>{try{process.kill(-child.pid,signal);}catch{}};
 const timeout=setTimeout(()=>{timedOut=true;stop('SIGTERM');},600000);const kill=setTimeout(()=>stop('SIGKILL'),610000);
 const progress=setInterval(()=>fs.writeFileSync(path.join(out,name+'.log'),redact(log)),10000);
 child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timeout);clearTimeout(kill);clearInterval(progress);
 fs.writeFileSync(path.join(out,name+'.log'),redact(log));receipt.tests.push({name,args,...exit,timedOut,result:exit.code===0&&!timedOut?'PASS':'FAIL'});save();console.log(`${name}: ${receipt.tests.at(-1).result}`);
 if(timedOut||exit.code!==0)throw Error('R02_TARGET_TEST_FAILED:'+name);
}
async function cleanup(){const db=client(targetUrl(),'quantos-r02-cleanup',15000);try{await db.connect();
 const rows=(await db.query("select a.id,a.tenant_id,a.is_active from quantos.actors a join quantos.tenants t on t.id=a.tenant_id where left(t.slug,$1)=$2 and a.service_name in ('r02-target','r02-fixture','r02-http')",[('r02-'+run+'-').length,'r02-'+run+'-'])).rows;
 for(const a of rows)await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2',[a.id,a.tenant_id]);
 const after=(await db.query("select a.id,a.tenant_id,a.is_active from quantos.actors a join quantos.tenants t on t.id=a.tenant_id where left(t.slug,$1)=$2",[('r02-'+run+'-').length,'r02-'+run+'-'])).rows;
 const manifests=(await db.query("select o.tenant_id,o.storage_bucket,o.object_key,o.content_hash from quantos.object_artifacts o join quantos.tenants t on t.id=o.tenant_id where left(t.slug,$1)=$2",[('r02-'+run+'-').length,'r02-'+run+'-'])).rows;
 const objects=[];
 for(const m of manifests){if(m.storage_bucket!==process.env.SUPABASE_STORAGE_BUCKET)continue;
 const u=process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/'+m.storage_bucket+'/'+m.object_key;
 const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+(process.env.SUPABASE_STORAGE_AUTH_TOKEN||process.env.SUPABASE_SERVICE_ROLE_KEY)};
 let read=await fetch(u,{headers,signal:AbortSignal.timeout(15000)});let body=await read.arrayBuffer();
 // Only exact run-owned canonical keys; never deletes any historical or other tenant object.
 if(read.ok){const actual='sha256:'+crypto.createHash('sha256').update(Buffer.from(body)).digest('hex');if(actual!==m.content_hash)throw Error('R02_OWNED_CLEANUP_HASH_MISMATCH');
  const deleted=await fetch(u,{method:'DELETE',headers,signal:AbortSignal.timeout(15000)});if(!deleted.ok)throw Error('R02_OWNED_CLEANUP_DELETE_FAILED');read=await fetch(u,{headers,signal:AbortSignal.timeout(15000)});body=await read.arrayBuffer();}
 let error;try{error=JSON.parse(Buffer.from(body).toString())}catch{};
 const absent=read.status===404||(read.status===400&&String(error?.statusCode)==='404'&&error?.message==='Object not found');
 objects.push({...m,httpStatus:read.status,absent});if(!absent)throw Error('R02_OWNED_OBJECT_CLEANUP_UNCONFIRMED');
 }
 const faults=(await db.query("select tgname from pg_trigger where tgrelid='quantos.object_artifacts'::regclass and tgname like 'r02_fault_%' and not tgisinternal")).rows;
 receipt.cleanup={result:after.length===rows.length&&after.every(a=>!a.is_active)&&faults.length===0?'PASS':'FAIL',actors:after,objects,temporaryFaultTriggers:faults,metadata:'RETAINED',tenants:(await db.query("select id from quantos.tenants where left(slug,$1)=$2",[('r02-'+run+'-').length,'r02-'+run+'-'])).rows};
 if(receipt.cleanup.result!=='PASS')throw Error('R02_SCOPE_CLEANUP_FAILED');
 }finally{await db.end();}}
async function main(){for(const k of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET'])if(!process.env[k])throw Error('R02_TARGET_CONFIG_MISSING:'+k);save();
 try{const instrument=process.env.QUANTOS_R02_COVERAGE==='1';if(instrument)await cargo(['llvm-cov','clean','--workspace'],'coverage-clean');const args=instrument?['llvm-cov','-p','quantos-storage','--lib','--test','postgres_persistence','--test','storage_http','--test','supabase_storage_integration','--test','r02_boundaries','--locked','--json','--output-path',path.join(out,'coverage.json'),'--ignore-filename-regex','/tests/','--','--test-threads=1','--nocapture']:['test','-p','quantos-storage','--locked','--test','postgres_persistence','--test','storage_http','--test','supabase_storage_integration','--test','r02_boundaries','--','--test-threads=1','--nocapture'];
 await cargo(args,instrument?'target-coverage':'target-boundaries');if(instrument){const {validateCoverage}=await import('./check-r02-coverage.mjs');receipt.coverage=validateCoverage(JSON.parse(fs.readFileSync(path.join(out,'coverage.json'),'utf8')));fs.writeFileSync(path.join(out,'coverage-summary.json'),JSON.stringify(receipt.coverage,null,2)+'\n');}receipt.result='PASS_SCOPED_TARGET';
 }catch(e){receipt.result='FAIL';receipt.failure={name:e.name,code:e.message.split(':')[0]};process.exitCode=1;}
 finally{try{await cleanup();}catch(e){receipt.cleanupFailure={name:e.name,code:e.message.split(':')[0]};receipt.result='FAIL';process.exitCode=1;}save();console.log(JSON.stringify({result:receipt.result,cleanup:receipt.cleanup?.result,run}));}}
main().catch(e=>{receipt.result='FAIL';receipt.failure={name:e.name,code:e.message.split(':')[0]};save();process.exitCode=1;console.error(receipt.failure.code);});
