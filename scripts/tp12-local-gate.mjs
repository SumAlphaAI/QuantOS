// TP12 scoped boundary admission. Does not grant runtime, integration or release approval.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,publishStages,confined} from './provider-a1-receipts.mjs';
import {snapshot,commands,validateScope} from './tp12-test-scope.mjs';
export const profile='TP12_LOCAL',nodeId='CORE:TP12';
export const manifest='docs/audit/evidence/tp12-local-20261017/manifest.json';
export const directPrerequisites=['CORE:F07','CORE:TP07','CORE-GATE:S2-SERVICE'];
export const scope={phase:'FUNCTION_DEVELOPMENT',testingPolicy:'quantos-phased-testing/v1',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const phases={functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'};
export const flags=['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted','upstreamInstalled','upstreamExecuted'];
export const handoff="TP12_LOCAL 发布移交：本轮仅核对当前X03原子签发/独立审批、SignedExecutionGateway与自有Paper/Shadow/事实及异常关闭边界，验证7条禁止耦合规则、6面接口差异、8项威胁假设和无上游运行时依赖。F07、TP07及S2未重新准入；继承EVAL-TP12全部9组目标义务与既有移交。TP07完整业务联调后的TP12完整复审、真实Agent/内核transport与OS隔离/凭据接收方、Supabase身份/RLS与持久幂等/CAS/崩溃恢复、受限trace留存/逐字段治理、协议演进、法律分发与最新完整供应链/CVE/可达性/签名复审、安全/性能/长稳和同SHA hosted CI由INTEGRATION及RELEASE-GATE:BETA独立实际验收；当前均NOT_RUN。正式确认PENDING，runtimeAdmission=DENIED，不授予生产交易或外部发布。";
export const deferredTargets=[
 {id:'inherited',target:'All nine F07/EVALUATION:TP07 target groups and EVAL-TP12 handoff obligations remain NOT_RUN; no historical READY admission',status:'NOT_RUN'},
 {id:'post-tp07-review',target:'Full TP12 review after actual TP07 X3 business integration, including protocol evolution and complete real module chain',status:'NOT_RUN'},
 {id:'isolation',target:'Actual Agent/kernel transport, host isolation, credential locations/recipients and venue egress authorization',status:'NOT_RUN'},
 {id:'persistence',target:'Authorized Supabase identity/RLS and durable atomic issuance/approval/dedupe/CAS/audit, cross-instance crash recovery',status:'NOT_RUN'},
 {id:'trace-governance',target:'Restricted trace retention classes and field ownership/stability/digest governance require separate design and actual enforcement',status:'NOT_RUN'},
 {id:'supply-chain',target:'Legal/distribution, full refreshed SBOM/advisory/reachability and authenticated signature review before any adoption',status:'NOT_RUN'},
 {id:'release',target:'Actual target deployment/security/performance/soak and frozen same-SHA hosted CI; ProjectUser formal acceptance',status:'NOT_RUN'}
];
export const dependencies=()=>directPrerequisites.map(node=>({nodeId:node,status:'NOT_REVALIDATED',owner:nodeId,referenceOnly:true}));
export const proofs={
 'issuer-refusal':'x03_seven_rejections_and_recovery_do_not_consume_approval',
 'approval':'x03_approval_cas_rejection_cancellation_expiry_and_originator_separation',
 'dispatch':['tp07_x03_paper_consumption_replay_and_owned_events','tp07_one_thousand_concurrent_x03_consumers_submit_once','tp07_replays_recheck_current_risk_identity_expiry_release_and_kill','tp07_consumed_approval_is_bound_to_the_same_command_and_never_reconsumed','tp07_uncertain_submission_and_invalid_events_are_quarantined_without_retry','tp07_kill_cas_cannot_interleave_current_validation_and_kernel_submission','tp07_boundary_rejection_has_no_side_effect_and_allows_corrected_retry','tp07_independent_gateway_cannot_reconsume_a_claimed_or_uncertain_x03_command'],
 'cancel':'x04_signed_cancel_remains_available_after_expiry_and_kill_and_replays_once',
 'cancel-control':'x04_cancel_control_rejects_forgery_scope_revocation_unknown_and_other_consumer',
 'paper':'x04_real_process_submits_cancels_and_audits_terminal_rejection',
 'sanitized':'tp12_signed_dispatch_sanitizes_current_authority_and_agent_trace_cannot_submit',
 'trace-closure':'x05_rehashed_journal_still_cannot_forge_close_without_acknowledgement',
 'artifact':'r04_consumes_r03_artifact_with_bound_provenance_and_rejects_invalid_references'
};
export function verifyExecution(row,expected,{read=p=>readFileSync(confined(p)),attempt}={}){
 assert.equal(row.id,expected.id);assert.deepEqual(row.command,expected.command);assert.equal(row.reason,expected.reason);assert.equal(row.timeoutMs,expected.timeoutMs);
 assert.equal(row.status,'PASS');assert.equal(row.exitCode,0);assert.equal(row.signal,null);assert.equal(row.errorCode,null);assert.equal(row.timedOut,false);
 assert(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0&&row.elapsedMs<=row.timeoutMs);assert(Number.isFinite(Date.parse(row.startedAt)));assert(Number.isFinite(Date.parse(row.completedAt)));
 assert.equal(row.log,attempt+'/logs/'+row.id+'.log');const bytes=read(row.log);assert.equal(digest(bytes),row.logSha256);return bytes.toString();
}
// Bind every hashed functional input to the actual immutable source commit.
export function verifySourceInputs(inputs,source){
 assert.equal(execFileSync('git',['cat-file','-t',source],{cwd:root,encoding:'utf8'}).trim(),'commit');
 const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:inputs.inputs.map(i=>source+':'+i.path+'\n').join(''),maxBuffer:32*1024*1024});let offset=0;
 for(const input of inputs.inputs){const end=bytes.indexOf(10,offset);assert(end>=offset);const parts=bytes.subarray(offset,end).toString().split(' ');assert.equal(parts.length,3,'source input missing: '+input.path);const size=Number(parts[2]);assert(Number.isSafeInteger(size)&&size>=0);offset=end+1;const body=bytes.subarray(offset,offset+size);assert.equal(body.length,size);offset+=size;assert.equal(bytes[offset++],10);
  if(input.gitCommit){assert.equal(parts[0],input.gitCommit);assert.equal(parts[1],'commit');assert.equal(input.sha256,digest('gitlink:'+input.gitCommit));}
  else {assert.equal(parts[1],'blob');assert.equal(digest(body),input.sha256,'input differs from source commit: '+input.path);}
 }assert.equal(offset,bytes.length);
 const texts=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(path=>execFileSync('git',['show',source+':'+path],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.deepEqual(inputs.planInput,planInput(nodesFromPlans(texts).get(nodeId)),'normative task differs from frozen source');return true;
}
export function verify(r,{nodes=nodesFromPlans(),current=snapshot(),read=p=>readFileSync(confined(p)),sourceVerifier=verifySourceInputs}={}){
 validateScope();assert.deepEqual(nodes.get(nodeId).dependencies,directPrerequisites);
 assert.equal(r.schema,'quantos-tp12-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');
 assert.equal(r.upstreamRuntimeAdmission,'DENIED');assert.equal(r.postTp07IntegrationFullReview,'NOT_RUN');assert.equal(r.agentVenueAuthority,'NOT_GRANTED');assert.equal(r.runtimeDependency,'ABSENT_STATIC_CHECK');
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.scope,scope);assert.deepEqual(r.inputs,current,'affected inputs changed; rerun scoped checks');sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.deepEqual(r.phases,phases);for(const key of flags)assert.equal(r[key],false);
 assert.deepEqual(r.dependencies,dependencies(),'upstream references cannot grant READY');assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));
 assert.match(r.attempt,/^docs\/audit\/evidence\/tp12-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 const expected=commands();assert.equal(r.checks.length,expected.length);assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 const logs=new Map(r.checks.map((c,i)=>[c.id,verifyExecution(c,expected[i],{read,attempt:r.attempt})]));
 const review=JSON.parse(logs.get('review').trim());assert.equal(review.schema,'quantos-tp12-current-review/v1');assert.equal(review.status,'PASS');assert.equal(review.observedSourceCommit,r.observedSourceCommit);
 assert.equal(review.rules,7);assert.equal(review.interfaces,6);assert.equal(review.threats,8);assert.equal(review.runtimeDependency,r.runtimeDependency);assert.equal(review.runtimeAdmission,'DENIED');assert.equal(review.agentVenueAuthority,'NOT_GRANTED');assert.equal(review.postTp07IntegrationFullReview,'NOT_RUN');assert.equal(review.formalAccepted,false);
 assert.equal(review.reference.upstreamCommit,'8d79877380f8617b45dff2b8c8b3790c2f9d963a');assert.equal(review.reference.sourceFiles,12);assert.equal(review.reference.status,'PASS');assert.equal(review.reference.upstreamExecuted,false);assert.equal(review.reference.formalAccepted,false);assert.equal(review.reference.runtimeAdmission,'DENIED');assert.equal(review.reference.cveAudit,'NOT_RUN');assert.equal(review.reference.securityAudit,'NOT_RUN');
 const byPath=new Map(current.inputs.map(i=>[i.path,i.sha256]));assert.equal(review.reviewSha256,byPath.get('third_party/nautilus-agents/x3-boundary-review.json'));
 assert.deepEqual(review.runtimeInputs.map(i=>i.path),current.runtimeInputs,'runtime inventory incomplete');const unique=new Set();for(const input of review.runtimeInputs){assert(!unique.has(input.path));unique.add(input.path);assert.equal(input.sha256,byPath.get(input.path));}
 for(const name of ['baseline.lock.json','no-coupling-rules.json','boundary-assessment.json'])assert.equal('sha256:'+review.reference[name],byPath.get('third_party/nautilus-agents/'+name),'reference digest changed');
 assert.equal('sha256:'+review.reference.tp07BaselineSha256,byPath.get('third_party/nautilus-trader/baseline.lock.json'));
 assert.equal(logs.get('agent').includes('TP12_NATIVE_AGENT=PASS EXECUTABLE=false REPLAY=STABLE AUTHORITY_SMUGGLING=REFUSED'),true);assert(/\b69 passed\b/.test(logs.get('agent')),'missing 69 adapter/native probes');
 assert(/Ran 19 tests/.test(logs.get('review-tests'))&&/\nOK\s*$/.test(logs.get('review-tests')));
 for(const [id,count]of [['gate-tests',39],['plan-policy',44]])assert(new RegExp('tests '+count+'\\b').test(logs.get(id))&&new RegExp('pass '+count+'\\b').test(logs.get(id)),'missing Node test coverage '+id);
 for(const [id,proof]of Object.entries(proofs)){const names=Array.isArray(proof)?proof:[proof];for(const name of names)assert(logs.get(id).includes('test '+name+' ... ok'),'missing actual scoped behavior '+name);assert(logs.get(id).includes('test result: ok. '+names.length+' passed; 0 failed'));}
 assert(logs.get('sanitized').includes('TP12_SIGNED_KERNEL_FIELDS=12 AUTHORITY_MATERIAL=ABSENT AGENT_TRACE=REFUSED DOWNSTREAM_CALLS=2 DISTINCT_KEYS=2 REPLAY_DUPLICATES=0'));
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff));assert.deepEqual(r.release.functionalTargets,deferredTargets);assert.deepEqual(r.release.prerequisiteChecks,[{id:'tp12-target',command:['node','scripts/tp12-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}]);
 return {nodeId,profile,stageGate:'READY',engineeringStatus:'PASS',checks:r.checks.length,phases:r.phases,postTp07IntegrationFullReview:'NOT_RUN',upstreamRuntimeAdmission:'DENIED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function buildReceipt(attempt,source,inputs,checks){return {schema:'quantos-tp12-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',upstreamRuntimeAdmission:'DENIED',postTp07IntegrationFullReview:'NOT_RUN',agentVenueAuthority:'NOT_GRANTED',runtimeDependency:'ABSENT_STATIC_CHECK',scope,phases,observedSourceCommit:source,inputs,planInput:planInput(nodesFromPlans().get(nodeId)),attempt,checks,...Object.fromEntries(flags.map(f=>[f,false])),dependencies:dependencies(),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,functionalTargets:deferredTargets,prerequisiteChecks:[{id:'tp12-target',command:['node','scripts/tp12-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}]}};}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function publish(r,{getNodes=nodesFromPlans,validate=verify,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,b)=>{if(b===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),b);}},verifyAfter=verifyPublished}={}){
 validate(r);const nodes=getNodes(),bytes=JSON.stringify(r,null,2)+'\n';nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(p=>[p,read(p)]));try{for(const [path,b]of updates)write(path,b);return verifyAfter();}catch(error){for(const [path,b]of before)write(path,b);throw error;}
}
export function releaseCheck(){throw Error('TP12 full review after TP07 integration and actual release targets NOT_RUN; local receipt cannot grant release');}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
