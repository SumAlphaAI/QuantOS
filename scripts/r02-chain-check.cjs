#!/usr/bin/env node
// Reuse retained approved immutable facts. No provider ingestion or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {retainedSourcePolicy}=require('./r02-retained-source-policy.cjs');
const {targetUrl}=require('./lib/r01-db.cjs');
const {openConnection}=require('./lib/r02-chain-connection.cjs');
const run=crypto.randomUUID(),out=path.resolve(process.env.QUANTOS_R02_EVIDENCE_DIR||`artifacts/r02-chain/${run}`);
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('R02_EVIDENCE_DIRECTORY_NOT_EMPTY');fs.mkdirSync(out,{recursive:true});
const receipt={schema:'quantos-r02-persisted-chain/v1',run,result:'RUNNING',ingestionStarted:false,deployment:'NOT_RUN_RELEASE_STAGE',formalAcceptance:'NOT_ACCEPTED'};
const save=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const redact=s=>{for(const[k,v]of Object.entries(process.env))if(/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(k)&&v.length>=10)s=s.split(v).join('[REDACTED]');return s;};
const phase={value:'CONFIGURATION'};
const setPhase=value=>{phase.value=value;receipt.phase=value;save();};
const errorCode=e=>e.code||(/^R02_[A-Z_]+$/.test(e.message?.split(':')[0])?e.message.split(':')[0]:'R02_TARGET_CHECK_FAILED');
async function main(){let db,actor,context,ownsRules=false;save();
 try {for(const k of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET'])if(!process.env[k])throw Error('R02_TARGET_CONFIG_MISSING');
  const policy=retainedSourcePolicy();const approval=policy.approvals[0];receipt.tenant=approval.tenant_id;receipt.approval=policy.evidence;
  fs.writeFileSync(path.join(out,'source-policy.json'),JSON.stringify(policy,null,2)+'\n');
  setPhase('INITIAL_CONNECTION');receipt.bootstrapConnection={};
  db=await openConnection(targetUrl(),'quantos-r02-retained-chain',{record:receipt.bootstrapConnection,phase,save});
  setPhase('RETAINED_SOURCE_SQL');
  const rows=[];for(const symbol of approval.symbols){const aggregate=approval.provider+':'+symbol;
    const r=(await db.query("select aggregate_id,sequence,payload from quantos.event_log where tenant_id=$1 and aggregate_type='market' and aggregate_id=$2 and sequence between 1 and 16 order by sequence",[approval.tenant_id,aggregate])).rows;
    if(r.length!==16||r.some((r,i)=>Number(r.sequence)!==i+1))throw Error('R02_RETAINED_LINEAGE_GAP');rows.push(...r);}
  ownsRules=Number((await db.query('select count(*) as n from quantos.data_snapshot_quality_rules where tenant_id=$1',[approval.tenant_id])).rows[0].n)===0;
  setPhase('ACTOR_PROVISIONING');
  actor=crypto.randomUUID();context={tenant_id:approval.tenant_id,actor_id:actor,correlation_id:crypto.randomUUID(),causation_id:crypto.randomUUID(),reason:'R02 retained internal research chain '+run};receipt.actor=actor;receipt.ownsRules=ownsRules;save();
  await db.query("insert into quantos.actors(id,tenant_id,actor_kind,service_name,display_name) values($1,$2,'service',$3,$4)",[actor,approval.tenant_id,'r02-chain-'+run,'R02 owned retained-facts research '+run]);
  for(const cap of ['snapshot.write','snapshot.rule.write','artifact.write','snapshot.read','research.hypothesis.v1','research.experiment.v1'])await db.query('insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3)',[approval.tenant_id,actor,cap]);
  fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({run,context,ownsRules,rows},null,2)+'\n');
  const roots=['crates/quantos-storage/src','crates/quantos-runtime/src','crates/quantos-runtime/tests','crates/quantos-strategy/src','scripts/r02-chain-check.cjs','scripts/r02-retained-source-policy.cjs','scripts/lib/r02-chain-connection.cjs','scripts/lib/postgres-bootstrap.cjs','scripts/lib/r01-db.cjs','Cargo.lock'];
  const walk=p=>fs.statSync(p).isDirectory()?fs.readdirSync(p).sort().flatMap(n=>walk(path.join(p,n))):[p];
  receipt.sourceFiles=roots.flatMap(walk).map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));save();
  setPhase('PREPARATION_CLOSE');const prepared=db;db=null;await prepared.end();
  setPhase('RUST_CHAIN');
  const child=spawn('cargo',[...(process.env.QUANTOS_R02_COVERAGE==='1'?['llvm-cov','test','--no-report']:['test']),'-p','quantos-runtime','--locked','--test','research_orchestration','r02_retained_market_persistent_research_chain','--','--nocapture'],{detached:true,env:{...process.env,DATABASE_URL:targetUrl(),QUANTOS_RUN_R02_CHAIN_TESTS:'1',QUANTOS_R02_CHAIN_DIR:out},stdio:['ignore','pipe','pipe']});
  let log='',timedOut=false;const stop=signal=>{try{process.kill(-child.pid,signal);}catch{}};
  const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');},600000),kill=setTimeout(()=>stop('SIGKILL'),610000),progress=setInterval(()=>fs.writeFileSync(path.join(out,'target-chain.log'),redact(log)),10000);
  child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timer);clearTimeout(kill);clearInterval(progress);
  // Kill any owned descendant left by an early test panic, even after Cargo exited.
  stop('SIGTERM');fs.writeFileSync(path.join(out,'target-chain.log'),redact(log));receipt.test={...exit,timedOut};
  if(exit.code!==0||timedOut)throw Error('R02_TARGET_CHAIN_FAILED');
  if(receipt.sourceFiles.some(f=>crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex')!==f.sha256))throw Error('R02_EXECUTION_SOURCE_CHANGED');
  receipt.chain=JSON.parse(fs.readFileSync(path.join(out,'chain-result.json')));if(receipt.chain.result!=='PASS')throw Error('R02_CHAIN_RECEIPT_MISSING');receipt.result='PASS_SCOPED_TARGET';
 }catch(e){receipt.result='FAIL';receipt.failure={name:e.name,code:errorCode(e),phase:e.chainPhase||phase.value};process.exitCode=1;}
 finally {try{
   if(db){setPhase('FAILED_PREPARATION_CLOSE');const closing=db;db=null;try{await closing.end();}catch(e){receipt.result='FAIL';receipt.preparationCloseFailure={code:errorCode(e),phase:e.chainPhase||phase.value};process.exitCode=1;}}
   if(actor){
    setPhase('CLEANUP_CONNECTION');receipt.cleanupBootstrapConnection={};
    db=await openConnection(targetUrl(),'quantos-r02-owned-cleanup',{record:receipt.cleanupBootstrapConnection,phase,save});
    setPhase('OWNED_ACTOR_CLEANUP');
    // Restore only the rule created by this run, retaining its revision/audit facts.
    let ruleFailure;try {if(ownsRules){const r=(await db.query("select * from quantos.data_snapshot_quality_rules where tenant_id=$1 and usage_scope='research'",[receipt.tenant])).rows[0];
      if(r&&!r.allow_degraded)await db.query('select quantos.persist_snapshot_quality_rule($1,$2)',[{tenant_id:receipt.tenant,usage:'research',allow_pending:true,allow_degraded:true,allow_failed:false,require_license:true,require_freshness:false,updated_at:new Date().toISOString()},context]);}}catch(e){ruleFailure=e;}
    await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2 and service_name=$3',[actor,receipt.tenant,'r02-chain-'+run]);
    const a=(await db.query('select id,is_active,service_name from quantos.actors where id=$1 and tenant_id=$2',[actor,receipt.tenant])).rows[0];if(a?.is_active)throw Error('R02_ACTOR_RETIREMENT_FAILED');if(!a&&receipt.result==='PASS_SCOPED_TARGET')throw Error('R02_ACTOR_RETIREMENT_FAILED');
    receipt.cleanup={result:ruleFailure?'FAIL':'PASS',actor:a,actorAbsent:!a,immutableFacts:'RETAINED',objects:'RETAINED_OWNED_EVIDENCE',providerProcessesStarted:0};if(ruleFailure)throw ruleFailure;
   }}catch(e){receipt.result='FAIL';receipt.cleanup={result:'FAIL',code:errorCode(e),phase:e.chainPhase||phase.value};process.exitCode=1;}finally{if(db)await db.end();save();console.log(JSON.stringify({result:receipt.result,cleanup:receipt.cleanup?.result,run}));}}
}
main().catch(e=>{receipt.result='FAIL';receipt.failure={name:e.name,code:errorCode(e),phase:e.chainPhase||phase.value};save();process.exitCode=1;console.error(receipt.failure.code);});
