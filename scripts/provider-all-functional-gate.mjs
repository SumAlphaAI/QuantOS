import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripVTControlCharacters} from 'node:util';
import YAML from 'yaml';
import {root,digest,nodesFromPlans,planInput,publishStages,confined} from './provider-a1-receipts.mjs';
import {verifySource} from './provider-a6-functional-gate.mjs';
import {verifyBoundedOriginalSource} from './bff-fe-006-confirmation.mjs';
import {verifyConfirmation} from './provider-a6-confirmation-20261020.mjs';
import {freezeBaseline} from './a1-functional-gate.mjs';
import {scopeRequest} from './g0-development.mjs';
import {coverage as research} from './bff-fe-003-functional-gate.mjs';
import {coverage as market} from './bff-fe-005-functional-gate.mjs';
import {coverage as execution} from './bff-fe-006-functional-gate.mjs';
import {coverage as strategy} from './bff-fe-004-functional-gate.mjs';
import {coverage as reconciliation} from './bff-fe-009-functional-gate.mjs';
import {coverage as performance} from './bff-fe-008-functional-gate.mjs';
import {coverage as operationsCoverage} from './bff-fe-010-functional-gate.mjs';
import {coverage as command} from './bff-fe-002-functional-gate.mjs';
import {coverage as platform} from './bff-fe-011-functional-gate.mjs';
import {nodeId,profile,prerequisites,commands,snapshot,environment} from './provider-all-functional-scope.mjs';
import {operations,domains,contract} from './provider-all-contract.mjs';
export {nodeId,profile,verifySource};
export const directory='docs/audit/evidence/provider-all-local-20261020',manifest=directory+'/manifest.json',schema='quantos-provider-all-functional-development/v1';
const read=p=>readFileSync(confined(p));
export const scope={phase:'FUNCTION_DEVELOPMENT',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const phases={functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'};
export const flags=['databaseExecution','formalAccepted','production','externalExecution','externalPublished','upstreamAccepted','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted'];
export const blocker='G0_CURRENT_SCOPE_CONFIRMATION_PENDING';
export const dependencies=()=>prerequisites.map(nodeId=>({nodeId,status:'NOT_REVALIDATED',referenceOnly:true,owner:'PROVIDER:ALL'}));
export const release=()=>({checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff:'All134 published operations validated locally with owned Paper/Shadow reference hosts. No production credentials or venue submission. Full UI/business integration, Supabase/Auth/RLS/Storage/persistent recovery, real external sources/licenses/venues, target security/performance/soak/deployment and same-SHA hosted CI NOT_RUN. Current G0/ALL confirmation pending; no new-page or runtime admission.',prerequisiteChecks:[{id:'all-target',command:['MANUAL_AUTHORIZED_NONPRODUCTION_TARGET','ALL_CURRENT_REAL_SOURCES_AUTH_STORAGE_RECOVERY_AND_FULL_UI'],automation:'NOT_IMPLEMENTED',status:'NOT_RUN'}]});
export function freeze(inputs=snapshot()){
 const f=freezeBaseline(inputs),request=scopeRequest(),ledgerPath='docs/gate-records/G0-current-scope-confirmations.json',ledger=JSON.parse(read(ledgerPath));
 assert.equal(ledger.status,'PENDING');assert.equal(ledger.approval,null);assert.equal(ledger.scopeDigest,null);
 return{...f,schema:'quantos-provider-all-functional-freeze/v1',providerScope:'ALL_134_CURRENT_PUBLISHED_OPERATIONS',g0:{...f.g0,request,ledger:{path:ledgerPath,sha256:digest(read(ledgerPath))},blocker},pageAdmission:'DENIED'};
}
export function references(){
 const registry=JSON.parse(read(directory+'/preflight/original-receipts.json'));assert.equal(registry.length,18);assert.deepEqual(registry.map(r=>r.nodeId),prerequisites.slice(0,18));
 const rows=registry.map(entry=>{const raw=execFileSync('git',['show',entry.receiptCommit+':'+entry.path],{maxBuffer:64*1024*1024}),r=JSON.parse(raw);assert.equal(digest(read(entry.path)),digest(raw));assert.equal(r.nodeId,entry.nodeId);assert.equal(r.observedSourceCommit,entry.sourceCommit);assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);verifyBoundedOriginalSource(r.inputs,r.observedSourceCommit);
  for(const c of r.checks){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(digest(read(c.log)),c.logSha256);}
  for(const a of r.artifacts??[r.httpArtifact])if(a)assert.equal(digest(read(a.path)),a.sha256);
  return{...entry,sha256:digest(raw),checksVerified:r.checks.length,referenceOnly:true,currentReady:'NOT_CLAIMED'};});
 return{receipts:rows,a6Confirmation:verifyConfirmation(),g0:{nodeId:'FRONTEND-GATE:G0',status:'NOT_GRANTED',confirmation:'PENDING',historicalReuse:false},upstreamAdmission:'NOT_CLAIMED'};
}
const validators=[null,research,market,execution,strategy,reconciliation,performance,operationsCoverage,command,platform];
export function coverage(http,{readBytes=read}={}){
 for(const[k,v]of Object.entries({schema:'quantos-provider-all-http/v1',status:'PASS',failure:null,databaseExecution:false,externalExecution:false,formalAccepted:false}))assert.equal(http[k],v);
 assert.deepEqual(http.operations,operations);assert.match(http.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(http.artifacts.length,10);assert.equal(http.executions.length,10);
 const owned=[],records=[],catalogRows=contract();
 for(const[i,[id,script,args]]of domains.entries()){
  const a=http.artifacts[i],e=http.executions[i];assert.equal(a.id,id);assert.equal(e.id,id);assert.match(a.path,new RegExp('^'+directory+'/function-attempt-[0-9]{2}/'+id+'-http.json$'));assert.deepEqual(e.command,['node',script,a.path,...args]);
  assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert(Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0&&e.elapsedMs<=600000);assert(Date.parse(e.startedAt)<=Date.parse(e.completedAt)&&Date.parse(e.completedAt)<=Date.now());
  const b=readBytes(a.path);assert.equal(digest(b),a.sha256);const child=JSON.parse(b);assert.equal(child.status,'PASS');if(id==='market')assert.equal(child.failure,undefined);else assert.equal(child.failure,null);if(i)assert.equal(child.sourceCommit,http.sourceCommit);else{assert.equal(child.schema,'quantos-bff-provider-contract/v1');assert.equal(child.sourceCommit,undefined);assert(child.records.every(r=>r.responseValidation==='PASS'&&r.issues.length===0));}
  if(i)owned.push(...validators[i](child,{readBytes}));else{const ids=catalogRows.filter(r=>['BFF-FE-001','BFF-FE-007','BFF-FE-011'].includes(r.owner));for(const r of ids){assert(child.records.some(c=>c.operationId===r.operationId&&c.status>=200&&c.status<300),'A1 current success absent '+r.operationId);owned.push(r);}for(const r of ids.filter(r=>r.owner==='BFF-FE-007'))for(const status of [401,403])assert(child.records.some(c=>c.operationId===r.operationId&&c.status===status));}
  records.push(...child.records.map(r=>({...r,domain:id})));
 }
 assert.deepEqual(http.records,records);const unique=[...new Set(owned.map(r=>r.operationId))].sort();assert.deepEqual(unique,[...operations].sort());assert.equal(owned.length,136,'Only the two platform operations may repeat');assert(owned.filter(r=>catalogRows.find(c=>c.operationId===r.operationId)?.owner!=='BFF-FE-011').length===132);
 return catalogRows.map(r=>({...r,successfulStatuses:[...new Set(records.filter(c=>c.operationId===r.operationId&&c.status>=200&&c.status<300).map(c=>c.status))].sort(),execution:'CURRENT_FROZEN_SOURCE_LOOPBACK_ONLY'}));
}
export function validateWiring(){const p=JSON.parse(read('package.json'));assert.equal(p.scripts['check:provider-all'],'node scripts/provider-all-development.mjs --ready');assert.equal(p.scripts['check:provider-all:engineering'],'node scripts/provider-all-development.mjs --engineering');assert.equal(p.scripts['check:provider-all:ci'],'node scripts/ci-stage-disposition.mjs PROVIDER:ALL');const w=YAML.parse(read('.github/workflows/frontend-baseline.yml').toString());assert(Object.values(w.jobs).some(j=>j.if===undefined&&j['continue-on-error']===undefined&&j.steps.some(s=>s.if===undefined&&s['continue-on-error']===undefined&&s.run==='pnpm check:provider-all:ci && pnpm test:provider-all')));}
export function verify(r,{current=snapshot(),nodes=nodesFromPlans(),readBytes=read,sourceVerifier=verifySource,referenceProof=references(),currentFreeze=freeze(current),wiring=validateWiring}={}){
 for(const[k,v]of Object.entries({schema,nodeId,profile,stage:'DEVELOPMENT',status:'BLOCKED',engineeringStatus:'PASS',admission:'DENIED',runtimeAdmission:'DENIED',confirmation:'PENDING',blocker}))assert.equal(r[k],v);
 for(const k of flags)assert.equal(r[k],false);assert.deepEqual(r.scope,scope);assert.deepEqual(r.phases,phases);assert.deepEqual(r.inputs,current);sourceVerifier(r.inputs,r.observedSourceCommit);assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));assert.deepEqual(nodes.get(nodeId).dependencies,prerequisites);assert.deepEqual(r.dependencies,dependencies());assert.deepEqual(r.references,referenceProof);assert.deepEqual(r.freeze,currentFreeze);wiring();
 assert.match(r.attempt,new RegExp('^'+directory+'/function-attempt-[0-9]{2}$'));const expected=commands(r.attempt),logs=new Map();assert.equal(r.checks.length,expected.length);
 for(const[i,c]of r.checks.entries()){
  for(const k of ['id','command','reason','timeoutMs'])assert.deepEqual(c[k],expected[i][k]);for(const[k,v]of Object.entries({status:'PASS',exitCode:0,signal:null,errorCode:null,timedOut:false}))assert.equal(c[k],v);
  assert(Number.isFinite(c.elapsedMs)&&c.elapsedMs>=0&&c.elapsedMs<=c.timeoutMs);assert(Date.parse(c.startedAt)<=Date.parse(c.completedAt)&&Date.parse(c.completedAt)<=Date.now());assert.equal(c.log,r.attempt+'/logs/'+c.id+'.log');const b=readBytes(c.log);assert(b.length);assert.equal(digest(b),c.logSha256);logs.set(c.id,stripVTControlCharacters(b.toString()));
 }
 for(const id of ['native','identity-audit']){const m=[...logs.get(id).matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert.equal(m.length,id==='native'?1:2);assert(m.every(m=>Number(m[1])>0&&Number(m[2])===0));}
 for(const name of ['all_domains_share_one_provider_without_read_execution_authority','missing_identity_is_denied_across_every_domain','quarantined_identity_is_denied_across_every_domain','expired_identity_is_denied_across_every_domain','shadow_aggregate_reads_never_seed_paper_orders','current_member_revocation_denies_all_previously_read_domains'])assert(logs.get('native').includes(name+' ... ok'));
 for(const id of ['confirmation','gate-tests','plan-policy']){const s=logs.get(id),n=/(?:^|\n)(?:# |ℹ )?tests (\d+)(?:\r?\n|$)/.exec(s)?.[1],p=/(?:^|\n)(?:# |ℹ )?pass (\d+)(?:\r?\n|$)/.exec(s)?.[1];assert(Number(n)>0&&n===p);assert(/(?:^|\n)(?:# |ℹ )?fail 0(?:\r?\n|$)/.test(s));}
 assert(logs.get('generated').includes('BFF generated artifacts match'));assert(logs.get('contract').includes('134 unique operations'));assert(/Tests\s+\d+ passed/.test(logs.get('consumers')));assert(logs.get('consumers').includes('provider-all-aggregate-consumer.test.ts'));
 const web=JSON.parse(logs.get('web-poc').split('A1_WEB_POC=')[1].trim());assert.equal(web.status,'PASS');assert.equal(web.sourceCommit,r.observedSourceCommit);assert.equal(web.oidc,'MOCK_ROUTE_INTERCEPTED');assert.equal(web.cases,11);assert.equal(web.staticBudget,'PASS');assert.equal(web.performanceAcceptance,'NOT_RUN');
 const paths=[r.attempt+'/aggregate-http.json',...domains.map(([id])=>r.attempt+'/'+id+'-http.json')];assert.deepEqual(r.artifacts.map(a=>a.path),paths);for(const a of r.artifacts)assert.equal(digest(readBytes(a.path)),a.sha256);
 const http=JSON.parse(readBytes(paths[0]));assert.equal(http.sourceCommit,r.observedSourceCommit);assert.deepEqual(http.artifacts.map(a=>({path:a.path,sha256:a.sha256})),r.artifacts.slice(1));assert.deepEqual(r.apiCoverage,coverage(http,{readBytes}));assert.deepEqual(r.release,release());
 return{nodeId,profile,status:'BLOCKED',engineeringStatus:'PASS',blocker,admission:'DENIED',runtimeAdmission:'DENIED',observedSourceCommit:r.observedSourceCommit,checks:r.checks.length,operations:r.apiCoverage.length,confirmation:'PENDING',phases,formalAccepted:false,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function buildReceipt(attempt,source,inputs,checks,{readBytes=read,referenceProof=references(),currentFreeze=freeze(inputs)}={}){
 const paths=[attempt+'/aggregate-http.json',...domains.map(([id])=>attempt+'/'+id+'-http.json')];return{schema,nodeId,profile,stage:'DEVELOPMENT',status:'BLOCKED',engineeringStatus:'PASS',admission:'DENIED',runtimeAdmission:'DENIED',confirmation:'PENDING',blocker,scope,phases,observedSourceCommit:source,inputs,planInput:planInput(nodesFromPlans().get(nodeId)),dependencies:dependencies(),references:referenceProof,freeze:currentFreeze,attempt,checks,artifacts:paths.map(path=>({path,sha256:digest(readBytes(path))})),apiCoverage:coverage(JSON.parse(readBytes(paths[0])),{readBytes}),...Object.fromEntries(flags.map(f=>[f,false])),release:release()};
}
export function verifyPublished({requireReady=false}={}){const nodes=nodesFromPlans(),g=nodes.get(nodeId).stage_gate;assert.equal(g.status,'BLOCKED');assert.deepEqual(g.evidence,[manifest.slice(5)]);const b=read(manifest);assert.equal(digest(b),g.input_digest);const result=verify(JSON.parse(b),{nodes});assert(!requireReady,blocker+': new-page admission denied');return result;}
export function verifyEntrypoints(r){verifyPublished();const rows=[];mkdirSync(r.attempt+'/entrypoints',{recursive:true});for(const[id,args,expectedExit]of [['engineering',['scripts/provider-all-development.mjs','--engineering'],0],['ci',['scripts/ci-stage-disposition.mjs',nodeId],0],['strict-refusal',['scripts/provider-all-development.mjs','--ready'],2],['a6-confirmation',['scripts/provider-a6-confirmation-20261020.mjs'],0],['plans',['scripts/check-development-plans.mjs'],0]]){const start=Date.now(),result=spawnSync(process.execPath,args,{cwd:root,env:environment(),encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024}),bytes=(result.stdout??'')+(result.stderr??''),log=r.attempt+'/entrypoints/'+id+'.log';writeFileSync(log,bytes);rows.push({id,command:['node',...args],expectedExit,exitCode:result.status,signal:result.signal,errorCode:result.error?.code??null,elapsedMs:Date.now()-start,log,logSha256:digest(bytes),status:expectedExit===0?'PASS':'EXPECTED_REFUSAL'});writeFileSync(r.attempt+'/entrypoints/results.json',JSON.stringify(rows,null,2)+'\n');assert.equal(result.status,expectedExit,'activated entrypoint failed '+id);assert.equal(result.signal,null);assert.equal(result.error,undefined);if(id==='strict-refusal')assert(bytes.includes(blocker));if(id==='ci')assert.equal(JSON.parse(bytes).admitted,false);}
 return{...verifyPublished(),activatedEntrypoints:'PASS_WITH_EXPECTED_STRICT_REFUSAL',entrypointChecks:rows.length};}
export function publish(r,{validate=verify,readBytes=p=>existsSync(p)?readFileSync(p,'utf8'):null,write=(p,b)=>{if(b===null)rmSync(p,{force:true});else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);}},after=()=>verifyEntrypoints(r)}={}){validate(r);const nodes=nodesFromPlans(),bytes=JSON.stringify(r,null,2)+'\n';nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'BLOCKED',input_digest:digest(bytes),evidence:[manifest.slice(5)]};const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md',updates=new Map([[manifest,bytes],[plan,publishStages(readBytes(plan),new Map([[nodeId,nodes.get(nodeId)]]),'FE:')]]),before=new Map([...updates.keys()].map(p=>[p,readBytes(p)]));try{for(const[p,b]of updates)write(p,b);return after();}catch(e){for(const[p,b]of before)write(p,b);throw e;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--engineering']);console.log(JSON.stringify(verifyPublished(),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
