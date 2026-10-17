// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {coverage as s2Coverage} from './s2-service-local-gate.mjs';
import {componentCoverage} from './s2-service-coverage.mjs';
import {verifyEvidence} from './s2-service-evidence.mjs';
import {behavioralProofs as inheritedProofs} from './x02-local-gate.mjs';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,policy,localChecks,validateLocalPrerequisites,publishStages,validateReceipt,orderedLocalChecks} from './provider-a1-receipts.mjs';
export const profile='X03_LOCAL',nodeId='CORE:X03';
export const manifest='docs/audit/evidence/x03-local-20261017/manifest.json';
export const deferredTargets=[
 {id:'x03-durable-authority',target:'actual R04 repository/F06 sessions/current risk sources, key custody/rotation, Supabase/RLS durable distributed atomic approval consumption/idempotency/audit, crash recovery, TP07 downstream and strategy revocation, original P95 <200ms, load/security/soak and same-SHA hosted CI',status:'NOT_RUN'},
];
export const handoff="X03_LOCAL 发布移交：继承R04、X02及S2全部目标义务；真实R04仓库/F06会话/当前风险来源、密钥托管和轮换、Supabase/RLS与持久分布式原子审批消费/幂等/审计及崩溃恢复、TP07下游消费和当前策略撤销、部署安全/负载/长稳、签发P95<200ms及同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。本地DEVELOPMENT READY仅属于X03，不授予上游运行时、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01","CORE:F03","CORE:F04","CORE:F05","CORE:F06","CORE:F07","CORE:F08","CORE:F02","CORE:F09","CORE:TP01-A","CORE:TP01-B","CORE-GATE:F0","CORE:R01","CORE:R02","CORE:TP02","CORE:R03","CORE:TP03","CORE:TP04","CORE:R04","CORE:TP01-C","CORE:TP01-D","CORE:TP05","CORE:TP08","CORE:TP09","CORE:TP10","CORE:TP11","CORE-GATE:R1-SERVICE","CORE:TP01-E","CORE:TP01-F","CORE:TP01-G","SERVICE:TP01","CORE:S01","CORE:TP06","CORE:S02","CORE:S03","SERVICE:S04","EVALUATION:TP07","EVALUATION:TP12","CORE-GATE:S2-SERVICE","CORE:X01","CORE:X02","CORE:X03"];
export const directPrerequisites=["CORE:R04","CORE:X02","CORE-GATE:S2-SERVICE"];
export const selectedNodes=nodes=>[...new Set([nodeId].flatMap(id=>closure(nodes,id)))];
export const behavioralProofs={...inheritedProofs, 'x03-rust': [
'x03_real_modules_issue_replay_signatures_and_audit',
'x03_seven_rejections_and_recovery_do_not_consume_approval',
'x03_approval_cas_rejection_cancellation_expiry_and_originator_separation',
'x03_one_thousand_concurrent_requests_one_signed_command_one_consumption',
'x03_conflicting_requester_proposal_decision_and_source_changes_fail_closed',
'x03_risk_lock_kill_linearization_and_other_issuer_cannot_double_consume',
'x03_proposal_bytes_quantity_scope_and_configuration_are_not_client_authority',
'x03_failed_transaction_does_not_reserve_consumer_and_kill_waits_for_commit',
]};
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8'),components=componentCoverage,validateEvidence=verifyEvidence}={}){
 const s2=s2Coverage(local,{read,readLog,components,validateEvidence}),checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 for(const [id,names]of Object.entries(behavioralProofs)){
  const log=readLog(checks.get(id)?.log);
  for(const name of names)assert(log.includes('test '+name+' ... ok'),'missing X03 actual behavior '+name);
  assert(/test result: ok\. [1-9][0-9]* passed; 0 failed/.test(log),'X03 suite failed or skipped');
 }
 const branch=read(checks.get('x02-coverage')?.artifact);
 assert.equal(branch.schema,'quantos-x02-rule-branches/v1');assert(branch.percent>=95);assert(branch.branches.count>0);assert.equal(branch.branches.covered/branch.branches.count*100,branch.percent);
 const parent=read(checks.get('s2-service-functional').artifact),rows=read(parent.executionResults),p=policy();
 const required=orderedLocalChecks(nodesFromPlans(),p,profile);
 assert.equal(rows.length,138,'complete final-candidate execution required');
 assert.deepEqual(rows.map(c=>c.id),required,'135 fresh dependencies must precede X03 own groups');
 for(const row of rows)assert.deepEqual(row,checks.get(row.id),'X03 index/execution splice');

 return {s2,ruleBranches:branch.branches,ruleBranchPercent:branch.percent,perVerdictFixtures:50,allRuleOutcomes:true,signedRequestApproval:true,sharedKillSwitch:true,staleAllowRejected:true,inheritedPortfolioProof:true,atomicCurrentRiskApprovalAndIssue:true,concurrentRequests:1000,singleCommandAndConsumption:true,approvalCasAndAudit:true,keyedCommandSignature:true,actualTargetExecution:'NOT_RUN',runtimeAdmission:'DENIED',localOnly:true};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog,components,validateEvidence}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized forty-two-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,directPrerequisites,'direct consumer scope changed');
 assert.equal(r.schema,'quantos-x03-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'X03 normative scope changed');
 assert(nodes.get(nodeId).requirements.join('\n').includes(profile),'X03 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete forty-two-node closure required');assert.equal(local.nodes.length,42);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog,components,validateEvidence}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:42,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','X03 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published X03 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,components,validateEvidence,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-x03-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
  coverage:coverage(local,{read:readFunctional,readLog,components,validateEvidence}),planInput:planInput(nodes.get(nodeId)),localPrerequisites:{manifest:index,inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,
  dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile),functionalTargets:deferredTargets}};
 validate(r,{nodes,readFunctional,readLog,components,validateEvidence});const bytes=JSON.stringify(r,null,2)+'\n';
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
