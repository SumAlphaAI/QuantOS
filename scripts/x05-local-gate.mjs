// X05 function admission. Integration and frozen release obligations remain independent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,publishStages,validateReceipt,confined} from './provider-a1-receipts.mjs';
import {snapshot,commands,validateScope} from './x05-test-scope.mjs';
import {deferredChecks as inheritedChecks,deferredTargets as inheritedTargets} from './x04-local-gate.mjs';
import {verifyCoverage} from './x05-coverage.mjs';
export const profile='X05_LOCAL',nodeId='CORE:X05';
export const manifest='docs/audit/evidence/x05-local-20261017/manifest.json';
export const directPrerequisites=['CORE:X01','CORE:X02','CORE:X03','CORE:X04','CORE-GATE:S2-SERVICE'];
export const deferredTargets=[...inheritedTargets,{id:'x05-target',target:"Actual authorized-market 10-trading-day Shadow, day-end zero unexplained differences, 20 difference classes detected and located within 15 minutes without venue submit; durable Supabase exception/CAS/audit and virtual ledger, trusted anchors/cross-instance recovery and complete integration/release matrix",status:'NOT_RUN'}];
export const deferredChecks=(nodes=nodesFromPlans())=>[...inheritedChecks(nodes),{id:'x05-target',command:['node','scripts/x05-target-check.mjs'],status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'}];
export const handoff="X05_LOCAL 发布移交：继承X01–X04及S2全部目标义务；真实获准行情与部署身份/时钟、连续10个实际交易日Shadow、日终未解释差异=0、20类差异实际在15分钟内检测定位且无venue submit、实际Supabase/RLS的虚拟账本/对账异常/CAS/追加审计与可信anchor持久事务及跨实例恢复、完整业务联调、行情用途许可/供应链/OS隔离、安全/负载/性能/长稳及同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。受控时钟/合成来源/本机只读worker仅证明X05功能DEVELOPMENT READY，不授予生产、实际交易或外部发布及正式ACCEPTED。";
export const behavioralProofs={
  "x05-flow": [
    "x05_twenty_differences_are_located_with_source_proof_within_fifteen_minutes",
    "x05_ten_controlled_weekdays_close_clean_days_without_claiming_live_soak",
    "x05_shadow_current_risk_virtual_fills_and_exact_cash_pnl_never_create_commands",
    "x05_shadow_denials_expiry_scope_overfill_and_conflict_have_no_ledger_side_effect",
    "x05_exception_cas_requires_ack_latest_repaired_source_and_audits_reopen",
    "x05_concurrent_runs_and_cas_acknowledgements_are_unique",
    "x05_journal_recovery_preserves_idempotency_and_rejects_tamper_truncation_scope",
    "x05_authorization_time_sources_and_invalid_inputs_fail_without_partial_alerts",
    "x05_delayed_detection_is_recorded_as_breach_and_equal_corruption_is_not_green",
    "x05_equal_illegal_status_and_phantom_positions_cannot_pass_by_agreement",
    "x05_new_quotes_revalue_positions_and_invalidate_unfilled_old_advice",
    "x05_erasing_entities_switching_sources_or_stale_reports_cannot_close_cases",
    "x05_rehashed_journal_still_cannot_forge_close_without_acknowledgement",
    "x05_concurrent_virtual_fill_replays_append_exactly_one_fact",
    "x05_decimal_scope_and_market_boundaries_reject_invalid_state",
    "x05_close_rechecks_mark_freshness_at_action_time"
  ],
  "x05-sources": [
    "x05_actual_x03_x04_x01_read_models_adapt_without_any_kernel_invocation",
    "x05_long_short_reversal_and_marked_exposure_match_hand_calculated_ledger"
  ],
  "x05-process": [
    "x05_native_worker_detects_all_twenty_classes_with_no_executor_protocol",
    "x05_native_worker_refuses_unknown_fields_submit_operations_and_unbounded_frames"
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
 assert.equal(r.schema,'quantos-x05-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.upstreamRuntimeAdmission,'DENIED');assert.equal(r.venueSubmitPath,'ABSENT');assert.equal(r.upstreamInstalled,false);assert.equal(r.upstreamExecuted,false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.scope,scope);assert.deepEqual(r.inputs,current,'affected inputs changed; rerun scoped checks');sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.deepEqual(r.phases,{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'});
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.deepEqual(r.dependencies,dependencies(),'upstream reference cannot be promoted to READY');assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));
 assert.match(r.attempt,/^docs\/audit\/evidence\/x05-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 const expected=commands(r.attempt);assert.equal(r.checks.length,expected.length);assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 const logs=new Map(r.checks.map((c,i)=>[c.id,verifyExecution(c,expected[i],{read,attempt:r.attempt})]));
 for(const [id,names]of Object.entries(behavioralProofs)){
  for(const name of names)assert(logs.get(id).includes('test '+name+' ... ok'),'missing actual X05 behavior '+name);
  assert(logs.get(id).includes('test result: ok. '+names.length+' passed; 0 failed'));
 }
 assert(logs.get('x05-flow').includes('X05_DIFFERENCE_CLASSES=20 LOCATED=20 WITHIN_900_SECONDS=20 VENUE_SUBMIT_PATH=ABSENT'),'missing 20-class measured proof');
 assert(logs.get('x05-process').includes('X05_NATIVE_CLASSES=20 LOCATED=20 VENUE_SUBMIT_PATH=ABSENT'),'missing native 20-class proof');
 assert(logs.get('no-submit').includes('X05_NO_VENUE_SUBMIT_PATH=ABSENT'),'missing no-submit source proof');
 assert(logs.get('interface').includes('compile fail') && logs.get('interface').includes('test result: ok. 1 passed; 0 failed'),'missing submit compile-fail proof');
 const coveragePath=r.attempt+'/coverage/receipt.json';assert.equal(r.coverage.path,coveragePath);const covBytes=read(coveragePath);assert.equal(digest(covBytes),r.coverage.sha256);
 const cov=JSON.parse(covBytes);assert.equal(cov.sourceCommit,r.observedSourceCommit);assert.deepEqual(r.coverage.files,coverageVerifier(cov,{base:dirname(coveragePath),read:path=>read(relative(root,resolve(path)))}));
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff));
 assert.deepEqual(r.release.prerequisiteChecks,deferredChecks(nodes));assert.deepEqual(r.release.functionalTargets,deferredTargets);
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,scope:r.scope,checks:r.checks.length,phases:r.phases,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function buildReceipt(attempt,source,inputs,checks,{read=p=>readFileSync(confined(p))}={}){
 const nodes=nodesFromPlans(),path=attempt+'/coverage/receipt.json',bytes=read(path),cov=JSON.parse(bytes);
 return {schema:'quantos-x05-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',venueSubmitPath:'ABSENT',upstreamRuntimeAdmission:'DENIED',upstreamInstalled:false,upstreamExecuted:false,scope,phases:{functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'},observedSourceCommit:source,inputs,planInput:planInput(nodes.get(nodeId)),attempt,checks,
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
