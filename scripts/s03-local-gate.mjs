// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
import {coverage as s02Coverage} from './s02-local-gate.mjs';
export const profile='S03_LOCAL',nodeId='CORE:S03';
export const manifest='docs/audit/evidence/s03-local-20261015/manifest.json';
export const deferredTargets=[
 {id:'durable-target',target:'actual Supabase release migration, immutable-row trigger, workspace RLS, authenticated provenance, approval CAS, ticket dedupe and cross-process recovery; all inherited S02/F06/R1 obligations',status:'NOT_RUN'},
 {id:'deployment-target',target:'authorized deployed Paper/Shadow consumer, trusted host identity/clock, immutable image/source and approval control, credential isolation and rollback',status:'NOT_RUN'},
 {id:'target-performance',target:'representative deployment security, load, performance and sustained canary/rollback obligations',status:'NOT_RUN'},
 {id:'same-sha-ci',target:'hosted CI at frozen release candidate and ProjectUser formal confirmation',status:'NOT_RUN'},
];
export const handoff="S03_LOCAL 发布移交：继承S02、F06及R1-SERVICE全部目标义务；实际Supabase迁移、不可变行与工作区RLS、审批CAS/幂等票据/跨进程恢复、可信身份与时钟、源码/镜像/回测/审批绑定和实际Paper/Shadow消费、部署安全/回滚/负载/性能/长稳及同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。未验证或未审批部署100%拒绝，M5前目标不含Assisted Live，同内容同hash或确定性冲突仍须满足。本地DEVELOPMENT READY仅属于S03，不授予上游、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F02", "CORE:F06", "CORE:F07", "CORE:F08", "CORE:F09", "CORE:TP01-A", "CORE:TP01-B", "CORE-GATE:F0", "CORE:R01", "CORE:R02", "CORE:TP02", "CORE:R03", "CORE:TP01-C", "CORE:TP01-D", "CORE:TP03", "CORE:TP04", "CORE:TP05", "CORE:TP08", "CORE:TP09", "CORE:TP10", "CORE:TP11", "CORE:R04", "CORE-GATE:R1-SERVICE", "CORE:S01", "CORE:TP01-E", "CORE:TP01-F", "CORE:TP01-G", "SERVICE:TP01", "CORE:TP06", "CORE:S02", "CORE:S03"];
export const selectedNodes=nodes=>[...new Set(["CORE:S03"].flatMap(id=>closure(nodes,id)))];
export const testNames=['s03_targets_exclude_assisted_live_and_unknown_json','s03_hundred_unverified_or_unapproved_deployments_are_rejected','s03_dedupe_and_content_conflict_are_deterministic','s03_scope_capability_hash_expiry_and_tampering_fail_closed','s03_concurrent_approval_and_deployment_are_atomic_and_idempotent','s03_owned_process_backtest_release_reject_recover_and_consume'];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const dependencyCoverage=s02Coverage(local,{read,readLog});const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 for(const id of ['s03-rust','s03-migration'])assert(checks.get(id)?.log,'missing S03 log '+id);
 assert(/fail 0/.test(readLog(checks.get('s03-migration').log)),'S03 static migration failed');
 const log=readLog(checks.get('s03-rust').log);for(const name of testNames)assert(log.includes('test release::tests::'+name+' ... ok'),'missing S03 case '+name);
 assert(/test result: ok\. 6 passed; 0 failed; 0 ignored/.test(log),'S03 cases failed or skipped');
 const rows=[...log.matchAll(/^S03_RELEASE_EVIDENCE=(.+)$/gm)];assert.equal(rows.length,1,'actual release bytes missing or duplicated');
 const evidence=JSON.parse(rows[0][1]),r=evidence.release,v=r.validation.report;
 assert.equal(v.candidate.source_commit,local.observedSourceCommit);assert.equal(r.source_digest,local.observedSourceCommit);
 assert.equal(r.image_digest,v.candidate.image_digest);assert.equal(r.parameter_hash,v.parameter_hash);assert.equal(r.backtest_report_hash,v.report_hash);
 assert.equal(r.tenant_id,v.draft.tenant_id);assert.equal(r.workspace_id,v.draft.workspace_id);assert.equal(r.draft_id,v.draft.draft_id);assert.equal(r.draft_version,v.draft.version);assert.equal(r.data_snapshot_id,v.snapshot_id);
 assert.equal(r.approval.content_hash,r.content_hash);assert(r.approved_at&&r.approved_by);assert.equal(r.approval.actor_id,r.approved_by);assert.equal(r.approval.approved_at,r.approved_at);assert(Date.parse(r.approved_at)<Date.parse(r.approval.expires_at));
 assert.deepEqual(r.allowed_targets,['paper','shadow']);assert.deepEqual(evidence.consumed_targets,['paper','shadow']);assert.deepEqual(evidence.consumer_replay_hashes,[v.report_hash,v.report_hash]);assert.equal(evidence.externalPublished,false);assert.equal(evidence.unapproved_rejected,true);
 for(const h of [r.content_hash,r.image_digest,r.parameter_hash,r.backtest_report_hash])assert.match(h,/^sha256:[a-f0-9]{64}$/);
 return {dependencyCoverage,releaseHash:r.content_hash,unverifiedUnapprovedRejected:100,concurrentApprovers:20,oneApproval:true,idempotentDeployment:true,scopeAndExpiry:true,opaqueValidation:true,realProcessConsumer:true,localOnly:true};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-five-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:S02','CORE:F06','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-s03-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'S03 normative scope changed');
 assert(nodes.get(nodeId).requirements.join('\n').includes(profile),'S03 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete thirty-five-node closure required');assert.equal(local.nodes.length,35);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:35,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','S03 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published S03 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-s03-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
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
