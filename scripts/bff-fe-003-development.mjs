import assert from 'node:assert/strict';
import {verifyPublished as verifyLocal} from './research-local-gate.mjs';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,inventory as collect,nodesFromPlans,planInput,validateReceipt,staticEnvironment} from './provider-a1-receipts.mjs';
import {validateA2} from './bff-fe-001-development.mjs';
import {validateAudit} from './bff-fe-007-development.mjs';
import {check as validateProviderA2} from './provider-a2-development.mjs';
import {verify as verifyR03} from './r03-stage-check.mjs';
import {verifyPublished as verifyR04} from './r04-stage-check.mjs';
export const directory='docs/audit/evidence/bff-fe-003-20261012';
export const manifest=directory+'/manifest.json';
export const operations=['listResearchRuns','createResearchRun','getResearchRun','cancelResearchRun','subscribeResearchRun','listDataSnapshots','getDataSnapshot','getArtifact','getArtifactAttachment'];
export const selectors=['Cargo.lock','services/bff-gateway/','crates/quantos-runtime/src/pg.rs','crates/quantos-runtime/src/research_pg.rs','bff/','packages/api-client/','tests/contract/','scripts/bff-fe-003-development.mjs','scripts/bff-fe-003-development.test.mjs','scripts/test-bff-fe-003-live.mjs','scripts/check-bff-fe-003-probes.mjs','supabase/migrations/20261012150000_bff_research_pages.sql','package.json','.github/workflows/frontend-baseline.yml'];
export const inventory=()=>collect(selectors);
export const checks=[
 {id:'rust',command:['cargo','test','-p','bff-gateway','-p','quantos-runtime','--lib','--locked','--offline','--','--skip','real_logout_db_write_matches_persistent_trace'],marker:/test result: ok/},
 {id:'reference',command:['cargo','test','-p','bff-gateway','--test','auth_settings_provider','--test','audit_export_provider','--locked','--offline'],marker:/test result: ok/},
 {id:'clippy',command:['cargo','clippy','-p','bff-gateway','-p','quantos-runtime','--all-targets','--locked','--offline','--','-D','warnings'],marker:/Finished `dev` profile/},
 {id:'web',command:['node','node_modules/vitest/vitest.mjs','run','tests/contract','packages/api-client/tests'],marker:/Tests\s+\d+ passed/},
 {id:'typecheck',command:['node','node_modules/typescript/bin/tsc','--project','packages/api-client/tsconfig.json','--noEmit'],marker:null},
 {id:'openapi',command:['node','scripts/check-bff-openapi.mjs'],marker:/结构校验通过/},
 {id:'generated',command:['node','scripts/check-bff-generated.mjs'],marker:/match the frozen OpenAPI/},
 {id:'coverage',command:['node','scripts/check-bff-contract-coverage.mjs'],marker:/63 operations, 54 schemas/},
 {id:'compatibility',command:['node','scripts/check-bff-compatibility.mjs'],marker:/"status": "PASS"/},
 {id:'plans',command:['node','scripts/check-development-plans.mjs'],marker:/"stage_contract": "PASS"/},
 {id:'negative',command:['node','--test','scripts/bff-fe-003-development.test.mjs'],marker:/(?:#|ℹ) fail 0/},
 {id:'probes',command:['node','scripts/check-bff-fe-003-probes.mjs',directory+'/provider-responses.json'],marker:/9 operations/},
];
export function dependencies({nodes=nodesFromPlans()}={}) {
 return nodes.get('FE:BFF-FE-003').dependencies.map(nodeId=>{
  const gate=nodes.get(nodeId).stage_gate;
  try {
   assert.equal(gate.status,'READY',`${nodeId}: published stage is ${gate.status}`);
   if(nodeId==='FE:BFF-FE-001')validateA2({nodes});
   else if(nodeId==='FE:BFF-FE-007')validateAudit({nodes});
   else if(nodeId==='PROVIDER:A2')validateProviderA2();
   else if(nodeId==='CORE:R03')verifyR03(JSON.parse(readFileSync(resolve(root,'docs/'+gate.evidence[0]))));
   else if(nodeId==='CORE:R04')verifyR04();
   else validateReceipt(nodeId,{nodes});
   return {nodeId,status:'READY',published:gate};
  }catch(e){return {nodeId,status:'BLOCKED',published:gate,reason:e.message.split('\n')[0]};}
 });
}
function confined(path,base=root){assert(path.startsWith(directory+'/')&&!path.includes('..')&&!path.includes('\\'),'unsafe evidence path');const p=realpathSync(resolve(base,path));assert(p.startsWith(realpathSync(resolve(base,directory))+sep),'evidence escapes directory');return p;}
export function verify(r,{inputs=inventory(),plan=planInput(nodesFromPlans().get('FE:BFF-FE-003')),read=p=>readFileSync(confined(p)),source=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root}),checkSource=true}={}){
 assert.equal(r.schema,'quantos-bff-fe-003-development/v1');assert.equal(r.nodeId,'FE:BFF-FE-003');assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.status,'BLOCKED');
 assert.equal(r.databaseExecution,false);assert.equal(r.production,false);assert.equal(r.formalAccepted,false);assert.equal(r.target.status,'NOT_RUN');assert.equal(r.hostedCI,'NOT_RUN');assert.equal(r.consumerUI,'NOT_RUN');
 assert.deepEqual(r.inputs,inputs,'BFF003 source drift');assert.deepEqual(r.planInput,plan,'BFF003 scope changed');assert.deepEqual(r.operations,operations);assert(/^[a-f0-9]{40}$/.test(r.sourceCommit),'immutable source commit absent');
 if(checkSource)for(const input of inputs)assert.equal(digest(source(r.sourceCommit,input.path)),input.sha256,`committed source differs: ${input.path}`);
 assert.deepEqual(r.checks.map(c=>c.id),checks.map(c=>c.id));
 for(const [index,c]of r.checks.entries()){
  assert.deepEqual(c.command,checks[index].command,'test command changed');assert.equal(c.exitCode,0);assert.equal(c.status,'PASS');assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());
  const bytes=read(c.log);assert.equal(digest(bytes),c.logSha256,'test log changed');assert(c.log===directory+'/logs/'+c.id+'.log','wrong test log path');
  if(checks[index].marker)assert.match(bytes.toString(),checks[index].marker,'test completion marker absent');
  assert(!/test result: FAILED|Tests\s+\d+ failed|# fail [1-9]|Unhandled Errors/.test(bytes.toString()),'failed tests cannot pass');
 }
 const probes=read(directory+'/provider-responses.json');assert.equal(digest(probes),r.probesSha256,'provider response evidence changed');
 assert.deepEqual(r.dependencies.map(d=>d.nodeId),nodesFromPlans().get('FE:BFF-FE-003').dependencies,'dependency scope changed');
 assert(r.dependencies.some(d=>d.status!=='READY'),'blocked prerequisite disposition absent');
 return {engineeringStatus:'PASS',stageGate:'BLOCKED',databaseAcceptance:'NOT_RUN',formalAccepted:false,operations:9,sourceCommit:r.sourceCommit};
}
export function runChecks(sourceCommit,{only}={}){
 const env=staticEnvironment(process.env);env.QUANTOS_BFF003_PROBE_OUTPUT=resolve(root,directory+'/provider-responses.json');mkdirSync(resolve(root,directory+'/logs'),{recursive:true});
 for(const spec of checks.filter(s=>!only||s.id===only)){
  const executedAt=new Date().toISOString();const result=spawnSync(spec.command[0],spec.command.slice(1),{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
  const log=directory+'/logs/'+spec.id+'.log';const bytes=Buffer.from((result.stdout??'')+(result.stderr??''));writeFileSync(resolve(root,log),bytes);
  const check={id:spec.id,command:spec.command,executedAt,exitCode:result.status,status:result.status===0&&!result.error?'PASS':'FAIL',log,logSha256:digest(bytes)};
  writeFileSync(resolve(root,directory+'/logs/'+spec.id+'.json'),JSON.stringify(check,null,2)+'\n');console.log(spec.id+': '+check.status);assert.equal(check.status,'PASS',spec.id+' failed; see '+log);
 }
}
export function record(sourceCommit){
 const nodes=nodesFromPlans();const r={schema:'quantos-bff-fe-003-development/v1',nodeId:'FE:BFF-FE-003',stage:'DEVELOPMENT',status:'BLOCKED',engineeringStatus:'PASS',sourceCommit,inputs:inventory(),planInput:planInput(nodes.get('FE:BFF-FE-003')),operations,checks:checks.map(c=>JSON.parse(readFileSync(resolve(root,directory+'/logs/'+c.id+'.json')))),probesSha256:digest(readFileSync(resolve(root,directory+'/provider-responses.json'))),dependencies:dependencies({nodes}),databaseExecution:false,production:false,formalAccepted:false,target:{status:'NOT_RUN',migration:'NOT_APPLIED',reason:'Nonproduction Supabase/Auth/Storage/R03 worker target execution is not established by local tests.'},hostedCI:'NOT_RUN',consumerUI:'NOT_RUN',release:'NOT_ASSESSED'};
 verify(r);writeFileSync(resolve(root,manifest),JSON.stringify(r,null,2)+'\n');return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const arg=process.argv[2];if(arg==='--run')runChecks(process.argv[3],{only:process.argv[4]});else if(arg==='--record')console.log(JSON.stringify(record(process.argv[3]),null,2));else if(arg===undefined||arg==='--ready'){console.log(JSON.stringify(verifyLocal('BFF003_LOCAL'),null,2));}else{assert.equal(arg,'--historical');const r=JSON.parse(readFileSync(resolve(root,manifest)));const report=verify(r);if(arg==='--ready'){assert(dependencies().every(d=>d.status==='READY'),'BFF003 prerequisites not READY');throw Error('BFF003 configured target evidence NOT_RUN');}console.log(JSON.stringify(report,null,2));}}catch(e){console.error(e.message);process.exitCode=2;}}
