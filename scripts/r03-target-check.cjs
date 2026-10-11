// Own synthetic fixtures only; no migration/reset, provider ingestion or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {targetUrl,client}=require('./lib/r01-db.cjs');
const {operatorUrl}=require('./lib/r02-chain-connection.cjs');
const {connectBeforeStatements}=require('./lib/postgres-bootstrap.cjs');
const out=path.resolve(process.env.QUANTOS_R03_EVIDENCE_DIR||'artifacts/r03-target/'+crypto.randomUUID());
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('R03_EVIDENCE_DIRECTORY_NOT_EMPTY');fs.mkdirSync(out,{recursive:true});
const receipt={schema:'quantos-r03-target/v1',status:'RUNNING',fixture:true,target:'configured-supabase',formalAccepted:false,providerIngestion:false,production:false};
const save=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const redact=s=>{for(const [k,v]of Object.entries(process.env))if(/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(k)&&v.length>=10)s=s.split(v).join('[REDACTED]');return s;};
(async()=>{let db,tenant,actor,session;save();try {
 if(process.env.QUANTOS_RUN_R03_TARGET_TESTS!=='1')throw Error('R03_TARGET_OPT_IN_REQUIRED');
 for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET'])if(!process.env[key])throw Error('R03_TARGET_CONFIG_MISSING');
 const url=operatorUrl(targetUrl()),api=new URL(process.env.SUPABASE_URL),u=new URL(url);
 const project=u.hostname.startsWith('db.')?u.hostname.split('.')[1]:decodeURIComponent(u.username).split('.').at(-1);
 if(!api.hostname.endsWith('.supabase.co')||api.hostname.split('.')[0]!==project)throw Error('R03_TARGET_PROJECT_MISMATCH');
 receipt.bootstrap={};db=await connectBeforeStatements(()=>client(url,'quantos-r03-fixture',30000),{record:receipt.bootstrap,onAttempt:save});
 tenant=crypto.randomUUID();actor=crypto.randomUUID();session=crypto.randomUUID();const workspace=crypto.randomUUID(),correlation=crypto.randomUUID();
 const at=new Date().toISOString(),provider='r03.synthetic',symbol='FIXTURE',aggregate=provider+':'+symbol;
 receipt.tenant=tenant;receipt.actor=actor;receipt.session=session;save();
 await db.query('begin');try {
  await db.query('insert into quantos.tenants(id,slug,name) values($1,$2,$2)',[tenant,'r03-'+tenant]);
  await db.query('insert into quantos.workspaces(id,tenant_id,slug,name) values($1,$2,$3,$3)',[workspace,tenant,'r03-fixture']);
  await db.query("insert into quantos.actors(id,tenant_id,actor_kind,service_name,display_name) values($1,$2,'service',$3,$3)",[actor,tenant,'r03-'+tenant]);
  await db.query("insert into quantos.workspace_memberships(tenant_id,workspace_id,actor_id,role) values($1,$2,$3,'service')",[tenant,workspace,actor]);
  for(const cap of ['snapshot.read','snapshot.write','snapshot.rule.write','artifact.write','research.hypothesis.v1','research.experiment.v1'])await db.query('insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3)',[tenant,actor,cap]);
  await db.query("insert into quantos.runtime_sessions(id,tenant_id,actor_id,workspace_id,mode,expires_at) values($1,$2,$3,$4,'paper',now()+interval '1 hour')",[session,tenant,actor,workspace]);
  const stream=crypto.randomUUID();await db.query("insert into quantos.event_streams(id,tenant_id,aggregate_type,aggregate_id) values($1,$2,'market',$3)",[stream,tenant,aggregate]);
  const payload={provider,dataset:'synthetic.v1',license_label:'owned-synthetic-fixture-only',approval_reference:'scripts/r03-target-check.cjs',approval_version:'r03-fixture-v1',normalized_symbol:symbol,source_tick_id:'r03-'+tenant,event_time:at,quality:'passed',fixture:true};
  const digest='sha256:'+crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await db.query("insert into quantos.event_log(tenant_id,stream_id,event_id,correlation_id,aggregate_type,aggregate_id,sequence,event_kind,schema_version,payload,payload_hash,occurred_at,actor_id,causation_id) values($1,$2,$3,$4,'market',$5,1,'market.tick.recorded','v1',$6,$7,$8,$9,$3)",[tenant,stream,crypto.randomUUID(),correlation,aggregate,payload,digest,at,actor]);
  await db.query('commit');
 }catch(e){await db.query('rollback');throw e;}
 const context={tenant_id:tenant,actor_id:actor,correlation_id:correlation,causation_id:crypto.randomUUID(),reason:'R03 owned synthetic lifecycle fixture'};
 fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({tenant,actor,workspace,session,at,context,provider,symbol,aggregate},null,2)+'\n');
 await db.end();db=null;
 const args=['test','-p','quantos-runtime','--locked','--test','research_orchestration','r03_persisted::r03_configured_supabase_lifecycle','--','--exact','--nocapture'];
 receipt.sourceInputs=(await import('./r03-stage-check.mjs')).inventory();receipt.command=['cargo',...args];receipt.startedAt=new Date().toISOString();save();
 const run=spawnSync('cargo',args,{env:{...process.env,DATABASE_URL:url,QUANTOS_R03_TARGET_DIR:out},encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(out,'target.log'),redact((run.stdout||'')+(run.stderr||'')));receipt.exitCode=run.status;receipt.timedOut=run.error?.code==='ETIMEDOUT';
 if(run.status!==0||run.error)throw Error('R03_TARGET_EXECUTION_FAILED');
 if(JSON.stringify(receipt.sourceInputs)!==JSON.stringify((await import('./r03-stage-check.mjs')).inventory()))throw Error('R03_SOURCE_CHANGED_DURING_EXECUTION');
 receipt.result=JSON.parse(fs.readFileSync(path.join(out,'lifecycle-result.json')));if(receipt.result.status!=='PASS')throw Error('R03_TARGET_RESULT_MISSING');receipt.status='PASS';
 }catch(e){receipt.status='FAIL';receipt.failure={code:e.code||'R03_TARGET_FAILED',message:redact(e.message)};process.exitCode=1;}
 finally {try {if(db)await db.end();if(tenant){receipt.cleanupBootstrap={};db=await connectBeforeStatements(()=>client(operatorUrl(targetUrl()),'quantos-r03-cleanup',30000),{record:receipt.cleanupBootstrap,onAttempt:save});
  await db.query('begin');try {
   await db.query("update quantos.workflow_runs set status='failed',completed_at=now(),lease_owner=null,lease_expires_at=null,attempt_id=null,last_error='R03 fixture retired',updated_at=now() where tenant_id=$1 and status in ('queued','running','cancel_requested')",[tenant]);
   await db.query('update quantos.tool_registry set enabled=false where tenant_id=$1',[tenant]);
   await db.query('update quantos.runtime_sessions set revoked_at=now() where tenant_id=$1 and id=$2',[tenant,session]);
   await db.query('update quantos.actors set is_active=false where tenant_id=$1 and id=$2',[tenant,actor]);
   await db.query('commit');
  }catch(e){await db.query('rollback');throw e;}
  if(receipt.status==='PASS'){
   const rows=(await db.query('select run.status,run.cost_used_units::int as cost,(select count(*)::int from quantos.workflow_run_artifacts b where b.workflow_run_id=run.id) as artifacts from quantos.workflow_runs run where run.tenant_id=$1',[tenant])).rows;
   if(rows.length!==13||rows.filter(r=>r.status==='succeeded').length!==11||rows.filter(r=>r.status==='cancelled').length!==2||rows.some(r=>r.status==='succeeded'?(r.cost!==1||r.artifacts!==1):(r.cost!==0||r.artifacts!==0)))throw Error('R03_PERSISTENT_COUNTS_OR_COST');
   receipt.persistence={succeeded:11,cancelled:2,artifactBindings:11,costUnits:11,recoveryDuplicateCost:0};
  }
  const r=(await db.query("select (select count(*) from quantos.workflow_runs where tenant_id=$1 and status in ('queued','running','cancel_requested'))::int pending,(select count(*) from quantos.actors where tenant_id=$1 and is_active)::int active",[tenant])).rows[0];
  if(r.pending||r.active)throw Error('R03_CLEANUP_INCOMPLETE');receipt.cleanup={status:'PASS',...r,immutableFacts:'RETAINED',objects:'RETAINED_OWNED_EVIDENCE'};
 }}catch(e){receipt.status='FAIL';receipt.cleanup={status:'FAIL',code:e.code||e.message};process.exitCode=1;}finally{if(db)await db.end();receipt.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:receipt.status,cleanup:receipt.cleanup?.status,evidence:out}));}}
})();
