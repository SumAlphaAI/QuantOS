// Execute the production chain launcher against a mock database and a real owned
// subprocess. This proves stop/cleanup behavior, not Supabase or source approval.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawn}=require('node:child_process');
for(const mode of ['revoked','changed'])test('running chain stops and retires its actor when authorization is '+mode,async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'r02-auth-watch-'));let child,active=false,serviceName,transition=false,timer;
 const policy={approvals:[{provider:'fixture',tenant_id:'fixture-tenant',symbols:['BTC/USDT','ETH/USDT'],approval_version:'v1'}],evidence:[]};
 const fakeProcess={env:{DATABASE_URL:'unused',SUPABASE_URL:'unused',SUPABASE_SERVICE_ROLE_KEY:'unused',SUPABASE_STORAGE_BUCKET:'unused',QUANTOS_R02_EVIDENCE_DIR:out},kill:process.kill.bind(process),exitCode:0};
 const db={async query(sql,args){
  if(sql.startsWith('select event_id'))return {rows:Array.from({length:16},(_,i)=>({aggregate_id:args[1],sequence:i+1,payload:{fixture:i}}))};
  if(sql.startsWith('select count'))return {rows:[{n:1}]};
  if(sql.startsWith('insert into quantos.actors')){active=true;serviceName=args[2];}
  if(sql.startsWith('update quantos.actors'))active=false;
  if(sql.startsWith('select id,is_active'))return {rows:[{id:args[0],is_active:active,service_name:serviceName}]};
  return {rows:[]};
 },async end(){}};
 const ownSpawn=()=>{child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:['ignore','pipe','pipe']});transition=true;return child;};
 const load=name=>{
  if(name==='./r02-retained-source-policy.cjs')return {retainedSourcePolicy:()=>{if(transition&&mode==='revoked')throw Error('authorization revoked');return transition?{...policy,purpose:'changed'}:policy;},validateRetainedRows:()=>true};
  if(name==='./lib/r01-db.cjs')return {targetUrl:()=> 'unused'};
  if(name==='./lib/r02-chain-connection.cjs')return {openConnection:async()=>db};
  if(name==='node:child_process')return {spawn:ownSpawn};return require(name);
 };
 try{
  const source=fs.readFileSync(path.resolve('scripts/r02-chain-check.cjs'),'utf8');
  const running=vm.runInNewContext(source,{require:load,process:fakeProcess,console:{log(){},error(){}},setTimeout,clearTimeout,setInterval,clearInterval,Buffer});
  await Promise.race([running,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('launcher did not stop')),5000);})]);
  const r=JSON.parse(fs.readFileSync(path.join(out,'receipt.json')));
  assert.equal(r.result,'FAIL');assert.equal(r.failure.code,'R02_SOURCE_AUTHORIZATION_CHANGED');assert.equal(fakeProcess.exitCode,1);
  assert.equal(r.cleanup.result,'PASS');assert.equal(r.cleanup.actor.is_active,false);assert.equal(r.cleanup.providerProcessesStarted,0);
  assert.equal(child.signalCode,'SIGTERM');assert.equal(active,false);
 }finally{clearTimeout(timer);if(child&&child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,'SIGKILL');}catch{}fs.rmSync(out,{recursive:true,force:true});}
});
