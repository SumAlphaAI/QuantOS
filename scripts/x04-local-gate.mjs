// X04 function admission. Integration and frozen release obligations remain independent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,publishStages,validateReceipt,confined} from './provider-a1-receipts.mjs';
import {snapshot,commands,validateScope} from './x04-test-scope.mjs';
import {deferredChecks as inheritedChecks,deferredTargets as inheritedTargets} from './tp07-local-gate.mjs';
import {verifyCoverage} from './x04-coverage.mjs';
export const profile='X04_LOCAL',nodeId='CORE:X04';
export const manifest='docs/audit/evidence/x04-local-20261017/manifest.json';
export const directPrerequisites=['CORE:X03','CORE:TP07','CORE-GATE:S2-SERVICE'];
export const deferredTargets=[...inheritedTargets,{id:'x04-target',target:'Actual target 100000 order events and Fill/Command provenance, durable append-only OMS/cancel transactions and independent crash recovery/reconciliation; complete business integration, latency/load/security/soak and same-SHA CI',status:'NOT_RUN'}];
export const deferredChecks=(nodes=nodesFromPlans())=>[...inheritedChecks(nodes),{id:'x04-target',command:['node','scripts/x04-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}];
export const handoff="X04_LOCAL 发布移交：继承X03、TP07及S2全部目标义务；实际Nautilus bridge/API与运行时法律和供应链准入、实际Supabase/RLS的append-only订单事实/Fill与取消持久事务、跨进程幂等及不确定结果对账恢复、真实部署身份/时钟/OS隔离、完整Paper/Shadow业务链、目标10万订单事件合法转换与Fill溯源及重复submit单调用、cancel延迟/拒绝审计、安全/负载/性能/长稳及同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。本地合成10万事件与自有Paper进程只授予X04功能DEVELOPMENT READY，不授予上游运行时、正式ACCEPTED、生产或外部发布授权。";
export const behavioralProofs={
  "tp07-dispatch": [
    "tp07_x03_paper_consumption_replay_and_owned_events",
    "tp07_one_thousand_concurrent_x03_consumers_submit_once",
    "tp07_replays_recheck_current_risk_identity_expiry_release_and_kill",
    "tp07_consumed_approval_is_bound_to_the_same_command_and_never_reconsumed",
    "tp07_uncertain_submission_and_invalid_events_are_quarantined_without_retry",
    "tp07_kill_cas_cannot_interleave_current_validation_and_kernel_submission",
    "tp07_boundary_rejection_has_no_side_effect_and_allows_corrected_retry",
    "tp07_independent_gateway_cannot_reconsume_a_claimed_or_uncertain_x03_command"
  ],
  "tp07-process": [
    "tp07_real_paper_child_consumes_x03_once_and_maps_owned_order_fill",
    "tp07_process_protocol_timeout_crash_malformed_and_unbound_reply_fail_closed",
    "tp07_process_configuration_and_handshake_are_validated",
    "tp07_reference_process_protocol_replays_exact_wire_without_identity_fields"
  ],
  "x04-oms": [
    "x04_one_hundred_thousand_mixed_kernel_events_replay_with_command_provenance",
    "x04_signed_cancel_remains_available_after_expiry_and_kill_and_replays_once",
    "x04_cancel_control_rejects_forgery_scope_revocation_unknown_and_other_consumer",
    "x04_uncertain_missing_or_uncorrelated_cancel_is_audited_without_retry",
    "x04_atomic_event_batch_keeps_fact_prefix_and_projection_on_illegal_terminal_fill",
    "x04_fact_replay_rejects_tampering_gap_reorder_and_duplicate_facts",
    "x04_nautilus_owned_wire_maps_ack_partial_fill_cancel_reject_and_expiry",
    "x04_legacy_state_rejects_illegal_fill_without_partial_mutation",
    "x04_replay_rejects_rehashed_illegal_order_and_cancel_facts"
  ],
  "x04-process": [
    "x04_real_process_submits_cancels_and_audits_terminal_rejection",
    "x04_native_wire_cancel_replay_is_strict_and_credential_free",
    "x04_cancel_transport_timeout_crash_and_binding_faults_are_uncertain"
  ]
};
export const scope={phase:'FUNCTION_DEVELOPMENT',testingPolicy:'quantos-phased-testing/v1',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const dependencies=()=>directPrerequisites.map(id=>({nodeId:id,status:'NOT_REVALIDATED',owner:nodeId,referenceOnly:true}));
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
 }assert.equal(offset,bytes.length);return true;
}
export function verify(r,{nodes=nodesFromPlans(),current=snapshot(),read=p=>readFileSync(confined(p)),coverageVerifier=verifyCoverage,sourceVerifier=verifySourceInputs}={}){
 validateScope();assert.deepEqual(nodes.get(nodeId).dependencies,directPrerequisites);
 assert.equal(r.schema,'quantos-x04-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.upstreamRuntimeAdmission,'DENIED');assert.equal(r.upstreamInstalled,false);assert.equal(r.upstreamExecuted,false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.scope,scope);assert.deepEqual(r.inputs,current,'affected inputs changed; rerun scoped checks');sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.deepEqual(r.phases,{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'});
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.deepEqual(r.dependencies,dependencies(),'upstream reference cannot be promoted to READY');assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));
 assert.match(r.attempt,/^docs\/audit\/evidence\/x04-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 const expected=commands(r.attempt);assert.equal(r.checks.length,expected.length);assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 const logs=new Map(r.checks.map((c,i)=>[c.id,verifyExecution(c,expected[i],{read,attempt:r.attempt})]));
 for(const [id,names]of Object.entries(behavioralProofs)){
  for(const name of names)assert(logs.get(id).includes('test '+name+' ... ok'),'missing actual X04 behavior '+name);
  assert(logs.get(id).includes('test result: ok. '+names.length+' passed; 0 failed'));
 }
 assert(logs.get('x04-oms').includes('X04_EVENTS=100000 LEGAL=100000 ILLEGAL=0 REPLAY=PASS FILL_COMMAND=100%'),'missing measured event proof');
 const coveragePath=r.attempt+'/coverage/receipt.json';assert.equal(r.coverage.path,coveragePath);const covBytes=read(coveragePath);assert.equal(digest(covBytes),r.coverage.sha256);
 const cov=JSON.parse(covBytes);assert.equal(cov.sourceCommit,r.observedSourceCommit);assert.deepEqual(r.coverage.files,coverageVerifier(cov,{base:dirname(coveragePath),read:path=>read(relative(root,resolve(path)))}));
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff));
 assert.deepEqual(r.release.prerequisiteChecks,deferredChecks(nodes));assert.deepEqual(r.release.functionalTargets,deferredTargets);
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,scope:r.scope,checks:r.checks.length,phases:r.phases,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function buildReceipt(attempt,source,inputs,checks,{read=p=>readFileSync(confined(p))}={}){
 const nodes=nodesFromPlans(),path=attempt+'/coverage/receipt.json',bytes=read(path),cov=JSON.parse(bytes);
 return {schema:'quantos-x04-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',upstreamRuntimeAdmission:'DENIED',upstreamInstalled:false,upstreamExecuted:false,scope,phases:{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'},observedSourceCommit:source,inputs,planInput:planInput(nodes.get(nodeId)),attempt,checks,
 databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,
 dependencies:dependencies(),coverage:{path,sha256:digest(bytes),files:cov.files},release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:deferredChecks(nodes),functionalTargets:deferredTargets}};
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
