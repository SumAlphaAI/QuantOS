// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
import {coverage as tp06Coverage} from './tp06-local-gate.mjs';
export const profile='S02_LOCAL',nodeId='CORE:S02';
export const manifest='docs/audit/evidence/s02-local-20261015/manifest.json';
export const deferredTargets=[
 {id:'durable-target',target:'actual Supabase Snapshot/Artifact audit, RLS, transactions, cross-process replay recovery and all inherited S01/TP06/TP08/R1 target obligations',status:'NOT_RUN'},
 {id:'provider-target',target:'separately authorized live provider and immutable adopted candidate, trusted identity, OS egress and credential isolation',status:'NOT_RUN'},
 {id:'target-performance',target:'representative deployed composition, load, performance, security and sustained canary/rollback obligations inherited from SERVICE:TP01',status:'NOT_RUN'},
 {id:'same-sha-ci',target:'hosted CI at frozen release candidate and ProjectUser formal confirmation',status:'NOT_RUN'},
];
export const handoff="S02_LOCAL 发布移交：继承S01、TP06、TP08及R1-SERVICE全部Supabase、外部来源/模型授权、部署、真实canary/回滚和性能义务；实际持久Snapshot/Artifact字节、RLS/事务/跨进程恢复、真实模块消费与成本校准、代表性负载/性能/长稳、安全和候选同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。保留同候选10次一致重放、100个look-ahead/泄漏全拒绝及成本/环境/输入hash要求。本地DEVELOPMENT READY仅属于S02，不授予上游、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F02", "CORE:F06", "CORE:F07", "CORE:F08", "CORE:F09", "CORE:TP01-A", "CORE:TP01-B", "CORE-GATE:F0", "CORE:R01", "CORE:R02", "CORE:TP02", "CORE:R03", "CORE:TP01-C", "CORE:TP01-D", "CORE:TP03", "CORE:TP04", "CORE:TP05", "CORE:TP08", "CORE:TP09", "CORE:TP10", "CORE:TP11", "CORE:R04", "CORE-GATE:R1-SERVICE", "CORE:S01", "CORE:TP01-E", "CORE:TP01-F", "CORE:TP01-G", "SERVICE:TP01", "CORE:TP06", "CORE:S02"];
export const selectedNodes=nodes=>[...new Set(["CORE:S02"].flatMap(id=>closure(nodes,id)))];
export const testNames=["ten_replays_produce_identical_metrics_and_hashes", "validation_report_contains_costs_environment_and_input_hash", "hundred_lookahead_and_leakage_fixtures_all_fail", "series_not_bound_to_snapshot_is_rejected", "s02_analytic_roundtrip_costs_and_terminal_mark_reconcile", "s02_candidate_parameters_clock_and_report_bytes_are_bound", "s02_hundred_malformed_inputs_fail_and_valid_retry_recovers", "s02_owned_process_s01_artifact_to_ten_replays_reject_and_recover", "s02_generated_universe_and_notional_are_effective_constraints"];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const dependencyCoverage=tp06Coverage(local,{read,readLog});
 const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 for(const id of ['s01-rust','s01-migration','tp08-development','s02-rust'])assert(checks.get(id)?.log,'missing dependency or S02 log '+id);
 const s01=readLog(checks.get('s01-rust').log);
 for(const name of ['s01_fifty_parallel_edit_groups_use_atomic_compare_and_save','s01_workspace_and_tenant_isolation_cover_read_save_and_validation','s01_validation_rechecks_artifacts_and_expiry_and_rejected_saves_are_atomic'])assert(s01.includes('test tests::'+name+' ... ok'),'missing S01 functional proof');
 assert(/fail 0/.test(readLog(checks.get('s01-migration').log)),'S01 migration static proof failed');
 const log=readLog(checks.get('s02-rust').log);
 for(const name of testNames)assert(log.includes('test backtest::tests::'+name+' ... ok'),'missing S02 case '+name);
 assert(/test result: ok\. 9 passed; 0 failed; 0 ignored/.test(log),'S02 cases failed or skipped');
 const reports=[...log.matchAll(/^S02_VALIDATION_REPORT=(.+)$/gm)];assert.equal(reports.length,1,'actual report bytes missing or duplicated');
 const report=JSON.parse(reports[0][1]);assert.equal(report.candidate.source_commit,local.observedSourceCommit,'backtest candidate differs');assert.equal(report.leak_check.violations,0);assert.equal(report.draft.version,1);assert(report.fills.length>0);assert.equal(report.metrics.trade_count,report.fills.length);assert(report.costs.fees_total>0&&report.costs.slippage_total>0);assert.equal(report.generated_at,report.candidate.clock);
 for(const key of ['input_hash','environment_hash','parameter_hash','report_hash'])assert.match(report[key],/^sha256:[a-f0-9]{64}$/);
 return {validationReportHash:report.report_hash,dependencyCoverage,deterministicReplays:10,lookaheadLeakageRejected:100,malformedInputsRejected:100,nextOpenFills:true,analyticCosts:true,pinnedDraftAndCandidate:true,realProcessS01Consumer:true,localOnly:true};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-four-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:S01','CORE:TP06','CORE:TP08','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-s02-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'S02 normative scope changed');
 assert(nodes.get(nodeId).requirements.join('\n').includes(profile),'S02 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete thirty-four-node closure required');assert.equal(local.nodes.length,34);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:34,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','S02 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published S02 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-s02-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
  coverage:coverage(local,{read:readFunctional,readLog}),planInput:planInput(nodes.get(nodeId)),localPrerequisites:{manifest:index,inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,
  dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile),functionalTargets:deferredTargets}};
 validate(r,{nodes,readFunctional,readLog});const bytes=JSON.stringify(r,null,2)+'\n';
 nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);
 for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(path=>[path,read(path)]));
 try{for(const [path,value]of updates)write(path,value);return verifyAfter();}catch(error){for(const [path,value]of before)write(path,value);throw error;}
}
export function releaseCheck({nodes=nodesFromPlans(),validate=validateReceipt,read=p=>readFileSync(resolve(root,p))}={}){
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','release target evidence NOT_RUN');assert.equal(beta.review_status,'ACCEPTED','formal release confirmation missing');assert.match(beta.source_commit??'',/^[a-f0-9]{40}$/);
 const selected=selectedNodes(nodes);for(const id of selected){validate(id,{nodes});const raw=JSON.parse(read('docs/'+nodes.get(id).stage_gate.evidence[0]));assert.equal(raw.schema,'quantos-stage-functional-manifest/v1','local manifests cannot grant release');assert.equal(raw.observedSourceCommit,beta.source_commit,'release candidate differs');}
 return {releaseGate:'READY',formalAccepted:true,productionAuthorization:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
