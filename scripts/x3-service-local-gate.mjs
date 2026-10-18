// X3 scoped local service-composition admission. Does not grant runtime, integration or release approval.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,publishStages,confined} from './provider-a1-receipts.mjs';
import {snapshot,commands,validateScope} from './x3-service-test-scope.mjs';
import {verifyCoverage} from './x3-service-coverage.mjs';
export const profile='X3-SERVICE_LOCAL',nodeId='CORE-GATE:X3-SERVICE';
export const manifest='docs/audit/evidence/x3-service-local-20261018/manifest.json';
export const directPrerequisites=['CORE-GATE:S2-SERVICE','CORE:X01','CORE:X02','CORE:X03','CORE:TP07','CORE:TP12','CORE:X04','CORE:X05','SERVICE:X06'];
export const scope={phase:'FUNCTION_DEVELOPMENT',testingPolicy:'quantos-phased-testing/v1',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const phases={functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'};
export const flags=['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted','upstreamInstalled','upstreamExecuted'];
export const handoff='X3-SERVICE_LOCAL 发布移交：本轮只验证固定输入的X3本地服务组合，真实X03/Paper/OMS事实/X01与独立Shadow虚拟账本对账、20类差异定位及证明/ack/修复/复发、当前风险与kill恢复、陈旧数据/撤权拒绝、幂等与同租约实例/本地journal恢复，以及Shadow无venue submit。九个直接依赖NOT_REVALIDATED/referenceOnly，不重授S2或单任务READY。CORE:X06/G4/G5/G6真实页面/BFF完整业务联调、TP07集成后的TP12完整复审、Supabase身份/MFA/RLS及持久事务/outbox/跨进程恢复、真实观察/凭据及OS出网隔离、10个实际交易日Shadow/真实日终差异为0、负载P95/部署演练/安全/长稳与同SHA hosted CI全部NOT_RUN，分别由INTEGRATION及RELEASE-GATE:BETA验收。虚拟账本保留X01 f64/固定quote边界，零异币费用无FX转换，非零异币费用仍拒绝；正式确认PENDING，runtimeAdmission=DENIED，不授权生产或外部发布。';
export const deferredTargets=[
 {id:'inherited',target:'All S2 and X01-X05/TP07/TP12/SERVICE:X06 target obligations remain independent NOT_RUN; no historical READY admission',status:'NOT_RUN'},
 {id:'integration',target:'CORE:X06/G4/G5/G6 pages/BFF full business-chain and workspace integration; TP12 full review after actual TP07 integration',status:'NOT_RUN'},
 {id:'identity-durability',target:'Actual Supabase identity/MFA/capabilities/RLS, durable ledger/outbox/audit/approval/kill atomicity and cross-process/cross-instance crash recovery',status:'NOT_RUN'},
 {id:'observations-isolation',target:'Real market/financial/reconciliation observers, credentials/OS egress isolation and restricted checkpoint/trace governance',status:'NOT_RUN'},
 {id:'continuous-targets',target:'Ten actual trading days Shadow, actual unexplained end-of-day breaks=0, load P95, deployment/canary/rollback and sustained measurements',status:'NOT_RUN'},
 {id:'release',target:'Frozen same-SHA actual target security/performance/soak/deployment/hosted CI plus ProjectUser formal acceptance',status:'NOT_RUN'}
];
export const dependencies=()=>directPrerequisites.map(node=>({nodeId:node,status:'NOT_REVALIDATED',owner:nodeId,referenceOnly:true}));
export const proofs={
  "aggregate": [
    "x3_service_paper_shadow_reconcile_concurrent_recovery_clean",
    "x3_service_twenty_breaks_require_proof_ack_repair_and_reopen",
    "x3_service_stale_sources_and_revocation_refuse_paper_and_shadow",
    "x3_service_kill_resume_requires_separate_user_fresh_health_then_both_paths_recover",
    "x3_service_adapter_refuses_foreign_nonzero_fee_and_forged_source"
  ],
  "flow": [
    "service_x06_actual_signed_execution_fill_position_and_safe_evidence_chain",
    "service_x06_scope_roles_capabilities_and_fresh_stepup_are_current",
    "service_x06_forgery_conflicting_keys_and_current_risk_refuse_without_fills",
    "service_x06_concurrent_prepare_and_current_replays_are_unique",
    "service_x06_kill_resume_requires_independent_user_new_health_cas_and_one_consumption",
    "service_x06_incident_ack_repair_independent_close_and_recurrence",
    "service_x06_observer_authority_staleness_empty_health_and_redaction",
    "service_x06_completed_checkpoint_rebuilds_ledger_and_dedupe_without_new_io",
    "service_x06_prepared_restore_is_quarantined_not_automatically_resubmitted",
    "service_x06_checkpoint_tamper_truncation_scope_and_backwards_clock_refuse",
    "service_x06_no_arbitrary_runbook_ledger_write_and_copy_queries_are_safe",
    "service_x06_capacity_refusal_has_no_partial_action",
    "service_x06_post_io_crash_recovers_authoritative_facts_without_resubmit",
    "service_x06_uncertain_transport_cannot_be_retried_or_greenwashed",
    "service_x06_constructor_rejects_miswired_authority_scope_and_foreign_seed",
    "service_x06_real_f09_alerts_keep_ack_until_repaired",
    "service_x06_cancel_reduces_risk_after_expiry_kill_and_rechecks_ownership",
    "service_x06_resume_revision_expiry_and_operator_restrictions_preserve_kill",
    "service_x06_stale_anchor_and_fresh_execution_lease_cannot_rebind_checkpoint",
    "service_x06_consumed_x03_approval_is_visible_without_signature_material",
    "service_x06_shadow_service_cannot_submit_even_with_valid_paper_authority",
    "service_x06_uncertain_cancel_requires_late_terminal_receipt_without_retry",
    "service_x06_late_fill_recovers_uncertain_submit_without_second_submission"
  ],
  "native": [
    "service_x06_native_paper_execution_cancel_evidence_and_recovery"
  ],
  "adapter": [
    "x05_actual_x03_x04_x01_read_models_adapt_without_any_kernel_invocation",
    "x05_long_short_reversal_and_marked_exposure_match_hand_calculated_ledger"
  ],
  "dispatch": [
    "tp07_x03_paper_consumption_replay_and_owned_events",
    "tp07_one_thousand_concurrent_x03_consumers_submit_once",
    "tp07_replays_recheck_current_risk_identity_expiry_release_and_kill",
    "tp07_consumed_approval_is_bound_to_the_same_command_and_never_reconsumed",
    "tp07_uncertain_submission_and_invalid_events_are_quarantined_without_retry",
    "tp07_kill_cas_cannot_interleave_current_validation_and_kernel_submission",
    "tp07_boundary_rejection_has_no_side_effect_and_allows_corrected_retry",
    "tp07_independent_gateway_cannot_reconsume_a_claimed_or_uncertain_x03_command"
  ],
  "sanitized": [
    "tp12_signed_dispatch_sanitizes_current_authority_and_agent_trace_cannot_submit"
  ]
};
export const behaviorIds=['chain','twenty-breaks','refusals','kill-recovery','source-binding'];
export function verifyComposition(log,inputs){
 const lines=log.split('\n').filter(l=>l.startsWith('X3_SERVICE_EVIDENCE='));assert.equal(lines.length,5);const rows=lines.map(l=>JSON.parse(l.slice('X3_SERVICE_EVIDENCE='.length)));assert.deepEqual(rows.map(r=>r.id).sort(),[...behaviorIds].sort());assert(rows.every(r=>r.schema==='quantos-x3-service-behavior/v1'));
 const data=Object.fromEntries(rows.map(r=>[r.id,r.data]));const c=data.chain;
 for(const [k,v]of Object.entries({paperSubmits:1,shadowSubmitCalls:0,venueSubmitPath:'ABSENT',duplicates:0,fills:1,btcQuantity:'1010',cash:'999000',recoveryIo:0}))assert.equal(c[k],v);
 for(const k of ['report','expectedSource','actualSource','auditHead','goldenSha256'])assert.match(c[k],/^sha256:[a-f0-9]{64}$/);assert.notEqual(c.expectedSource,c.actualSource);assert(c.command.length>10);assert.equal(c.goldenSha256,inputs.inputs.find(i=>i.path==='services/execution-gateway/tests/fixtures/x3-service-golden.json').sha256);
 const t=data['twenty-breaks'];assert.equal(t.classes,20);assert.equal(t.located,20);assert(t.casesClosed>=20);assert.equal(t.unprovenClose,'REFUSED');assert.equal(t.recurrence,'REOPENED');assert.equal(t.latencyScope,'CONTROLLED_CLOCK_NOT_TARGET_SLA');
 assert.deepEqual(data.refusals,{sourceOrAuthorityClasses:5,paperSubmits:0,shadowFills:0,sideEffects:0});
 assert.deepEqual(data['kill-recovery'],{killRefusedBoth:true,sameUserApproval:'REFUSED',freshHealthRequired:true,resumeConsumptions:1,paperSubmitsAfterResume:1,shadowFillsAfterResume:1,venueSubmitPath:'ABSENT'});
 const b=data['source-binding'];for(const [k,v]of Object.entries({zeroForeignFee:'ACCEPTED_WITHOUT_FX',nonzeroForeignFee:'REFUSED',wrongAnchor:'REFUSED',tamperedPortfolio:'REFUSED',venueSubmitPath:'ABSENT'}))assert.equal(b[k],v);assert(b.sourceFacts>=3);return data;
}
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
 assert.equal(r.schema,'quantos-x3-service-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');
 assert.equal(r.localServiceComposition,'PASS');assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.checkpointDurability,'PROCESS_LOCAL_ONLY');assert.equal(r.venueAuthority,'NOT_GRANTED');
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.scope,scope);assert.deepEqual(r.inputs,current,'affected inputs changed; rerun scoped checks');sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.deepEqual(r.phases,phases);for(const key of flags)assert.equal(r[key],false);
 assert.deepEqual(r.dependencies,dependencies(),'upstream references cannot grant READY');assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));
 assert.match(r.attempt,/^docs\/audit\/evidence\/x3-service-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 const expected=commands(r.attempt);assert.equal(r.checks.length,expected.length);assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 const logs=new Map(r.checks.map((c,i)=>[c.id,verifyExecution(c,expected[i],{read,attempt:r.attempt})]));
 for(const [id,names]of Object.entries(proofs)){for(const name of names)assert(logs.get(id).includes('test '+name+' ... ok'),'missing actual scoped behavior '+name);assert(logs.get(id).includes('test result: ok. '+names.length+' passed; 0 failed'));}
 assert(/test result: ok\. 1 passed; 0 failed/.test(logs.get('api-prohibitions')));verifyComposition(logs.get('aggregate'),current);assert(logs.get('no-submit').includes('X05_NO_VENUE_SUBMIT_PATH=ABSENT'));
 for(const variant of ['false','true'])assert(logs.get('native').includes('SERVICE_X06_NATIVE_PAPER resting='+variant+' SUBMITS=1 CANCELS=1 RECOVERY_IO=0'));
 for(const [id,count]of [['gate-tests',45],['plan-policy',44]])assert(new RegExp('tests '+count+'\\b').test(logs.get(id))&&new RegExp('pass '+count+'\\b').test(logs.get(id)),'missing Node cases '+id);
 const coverage=JSON.parse(read(r.attempt+'/coverage/receipt.json'));assert.equal(coverage.sourceCommit,r.observedSourceCommit);verifyCoverage(coverage,{base:root+'/'+r.attempt+'/coverage',read:p=>read(p.slice(root.length+1))});
 const exclusion=JSON.parse(logs.get('runtime-exclusion').trim());assert.equal(exclusion.status,'PASS');assert.equal(exclusion.observedSourceCommit,r.observedSourceCommit);assert.equal(exclusion.runtimeDependency,'ABSENT_STATIC_CHECK');assert.equal(exclusion.runtimeAdmission,'DENIED');assert.deepEqual(exclusion.runtimeInputs.map(i=>i.path),current.runtimeInputs);const hashes=new Map(current.inputs.map(i=>[i.path,i.sha256]));for(const i of exclusion.runtimeInputs)assert.equal(i.sha256,hashes.get(i.path));
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff));assert.deepEqual(r.release.functionalTargets,deferredTargets);assert.deepEqual(r.release.prerequisiteChecks,[{id:'x3-service-target',command:['node','scripts/x3-service-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}]);
 return {nodeId,profile,stageGate:'READY',engineeringStatus:'PASS',checks:r.checks.length,phases:r.phases,localServiceComposition:'PASS',checkpointDurability:'PROCESS_LOCAL_ONLY',runtimeAdmission:'DENIED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function buildReceipt(attempt,source,inputs,checks){return {schema:'quantos-x3-service-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',localServiceComposition:'PASS',runtimeAdmission:'DENIED',checkpointDurability:'PROCESS_LOCAL_ONLY',venueAuthority:'NOT_GRANTED',scope,phases,observedSourceCommit:source,inputs,planInput:planInput(nodesFromPlans().get(nodeId)),attempt,checks,...Object.fromEntries(flags.map(f=>[f,false])),dependencies:dependencies(),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,functionalTargets:deferredTargets,prerequisiteChecks:[{id:'x3-service-target',command:['node','scripts/x3-service-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}]}};}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function publish(r,{getNodes=nodesFromPlans,validate=verify,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,b)=>{if(b===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),b);}},verifyAfter=verifyPublished}={}){
 validate(r);const nodes=getNodes(),bytes=JSON.stringify(r,null,2)+'\n';nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(p=>[p,read(p)]));try{for(const [path,b]of updates)write(path,b);return verifyAfter();}catch(error){for(const [path,b]of before)write(path,b);throw error;}
}
export function releaseCheck(){throw Error('CORE-GATE:X3-SERVICE actual integration and release targets NOT_RUN; local receipt cannot grant release');}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
