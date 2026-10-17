// X03 function admission. Integration and frozen release obligations remain independent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,publishStages,validateReceipt,confined} from './provider-a1-receipts.mjs';
import {snapshot,commands,validateScope,testingPolicy} from './x03-test-scope.mjs';
import {verifyCoverage} from './x03-coverage.mjs';
export const profile='X03_LOCAL',nodeId='CORE:X03';
export const manifest='docs/audit/evidence/x03-local-20261017/manifest.json';
export const directPrerequisites=['CORE:R04','CORE:X02','CORE-GATE:S2-SERVICE'];
export const deferredTargets=[
 {id:'x03-durable-authority',target:'actual R04 repository/F06 sessions/current risk sources, key custody/rotation, Supabase/RLS durable distributed atomic approval consumption/idempotency/audit, crash recovery, TP07 downstream and strategy revocation, original P95 <200ms, load/security/soak and same-SHA hosted CI',status:'NOT_RUN'},
];
export const handoff="X03_LOCAL 发布移交：继承R04、X02及S2全部目标义务；真实R04仓库/F06会话/当前风险来源、密钥托管和轮换、Supabase/RLS与持久分布式原子审批消费/幂等/审计及崩溃恢复、TP07下游消费和当前策略撤销、部署安全/负载/长稳、签发P95<200ms及同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。本地DEVELOPMENT READY仅属于X03，不授予上游运行时、正式ACCEPTED、生产或外部发布授权。";
export const behavioralProofs={ 'x03-rust': [
'x03_real_modules_issue_replay_signatures_and_audit',
'x03_seven_rejections_and_recovery_do_not_consume_approval',
'x03_approval_cas_rejection_cancellation_expiry_and_originator_separation',
'x03_one_thousand_concurrent_requests_one_signed_command_one_consumption',
'x03_conflicting_requester_proposal_decision_and_source_changes_fail_closed',
'x03_risk_lock_kill_linearization_and_other_issuer_cannot_double_consume',
'x03_proposal_bytes_quantity_scope_and_configuration_are_not_client_authority',
'x03_failed_transaction_does_not_reserve_consumer_and_kill_waits_for_commit',
]};
export const scope={phase:'FUNCTION_DEVELOPMENT',testingPolicy:'quantos-phased-testing/v1',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const dependencies=()=>directPrerequisites.map(id=>({nodeId:id,status:'NOT_REVALIDATED',owner:nodeId,referenceOnly:true}));
export function verifyExecution(row,expected,{read=p=>readFileSync(confined(p)),attempt}={}){
 assert.equal(row.id,expected.id);assert.deepEqual(row.command,expected.command);assert.equal(row.reason,expected.reason);assert.equal(row.timeoutMs,expected.timeoutMs);
 assert.equal(row.status,'PASS');assert.equal(row.exitCode,0);assert.equal(row.signal,null);assert.equal(row.errorCode,null);assert.equal(row.timedOut,false);
 assert(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0&&row.elapsedMs<=row.timeoutMs);assert(Number.isFinite(Date.parse(row.startedAt)));assert(Number.isFinite(Date.parse(row.completedAt)));
 assert.equal(row.log,attempt+'/logs/'+row.id+'.log');const bytes=read(row.log);assert.equal(digest(bytes),row.logSha256);return bytes.toString();
}
export function verify(r,{nodes=nodesFromPlans(),current=snapshot(),read=p=>readFileSync(confined(p)),coverageVerifier=verifyCoverage}={}){
 validateScope();assert.deepEqual(nodes.get(nodeId).dependencies,directPrerequisites);
 assert.equal(r.schema,'quantos-x03-local-development/v2');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.scope,scope);assert.deepEqual(r.inputs,current,'affected inputs changed; rerun scoped checks');
 assert.deepEqual(r.phases,{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'});
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.deepEqual(r.dependencies,dependencies(),'upstream reference cannot be promoted to READY');assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));
 assert.match(r.attempt,/^docs\/audit\/evidence\/x03-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 const expected=commands(r.attempt);assert.equal(r.checks.length,expected.length);assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 const logs=new Map(r.checks.map((c,i)=>[c.id,verifyExecution(c,expected[i],{read,attempt:r.attempt})]));
 for(const name of behavioralProofs['x03-rust'])assert(logs.get('x03-rust').includes('test '+name+' ... ok'),'missing actual X03 behavior '+name);
 assert(/test result: ok\. 8 passed; 0 failed/.test(logs.get('x03-rust')));
 const coveragePath=r.attempt+'/coverage/receipt.json';assert.equal(r.coverage.path,coveragePath);const covBytes=read(coveragePath);assert.equal(digest(covBytes),r.coverage.sha256);
 const cov=JSON.parse(covBytes);assert.equal(cov.sourceCommit,r.observedSourceCommit);assert.deepEqual(r.coverage.files,coverageVerifier(cov,{base:dirname(coveragePath),read:path=>read(relative(root,resolve(path)))}));
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff));
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile));assert.deepEqual(r.release.functionalTargets,deferredTargets);
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,scope:r.scope,checks:r.checks.length,phases:r.phases,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function buildReceipt(attempt,source,inputs,checks,{read=p=>readFileSync(confined(p))}={}){
 const nodes=nodesFromPlans(),path=attempt+'/coverage/receipt.json',bytes=read(path),cov=JSON.parse(bytes);
 return {schema:'quantos-x03-local-development/v2',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',scope,phases:{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'},observedSourceCommit:source,inputs,planInput:planInput(nodes.get(nodeId)),attempt,checks,
 databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,
 dependencies:dependencies(),coverage:{path,sha256:digest(bytes),files:cov.files},release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile),functionalTargets:deferredTargets}};
}
export function publish(r,{getNodes=nodesFromPlans,validate=verify,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,b)=>{if(b===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),b);}},verifyAfter=verifyPublished}={}){
 validate(r);const nodes=getNodes(),bytes=JSON.stringify(r,null,2)+'\n';nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(p=>[p,read(p)]));try{for(const [path,b]of updates)write(path,b);return verifyAfter();}catch(error){for(const [path,b]of before)write(path,b);throw error;}
}
export function releaseCheck({nodes=nodesFromPlans(),validate=validateReceipt,read=p=>readFileSync(resolve(root,p))}={}){
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','release target evidence NOT_RUN');assert.equal(beta.review_status,'ACCEPTED','formal release confirmation missing');assert.match(beta.source_commit??'',/^[a-f0-9]{40}$/);
 const selected=closure(nodes,nodeId);for(const id of selected){validate(id,{nodes});const raw=JSON.parse(read('docs/'+nodes.get(id).stage_gate.evidence[0]));assert.equal(raw.schema,'quantos-stage-functional-manifest/v1','local manifests cannot grant release');assert.equal(raw.observedSourceCommit,beta.source_commit,'release candidate differs');}
 return {releaseGate:'READY',formalAccepted:true,productionAuthorization:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
