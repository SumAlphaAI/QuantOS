// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
export const profile='S01_LOCAL',nodeId='CORE:S01';
export const manifest='docs/audit/evidence/s01-local-20261015/manifest.json';
export const deferredTargets=[
 {id:'s01-database',target:'actual Supabase migration, forced RLS, auth.users audit, reference integrity, transaction and cross-process recovery',status:'NOT_RUN'},
 {id:'s01-target-concurrency',target:'50 target concurrent edit groups without silent overwrite and authorization/snapshot/Artifact validation denials',status:'NOT_RUN'},
 {id:'s01-save-performance',target:'representative target draft save P95 <300ms and sustained load',status:'NOT_RUN'},
 {id:'continuous-canary',target:'7 consecutive days with no unexplained P1',status:'NOT_RUN'},
 {id:'target-rollback',target:'actual authorized target rollback <=300 seconds',status:'NOT_RUN'},
 {id:'formal-signatures',target:'trusted release artifact and drill signatures',status:'NOT_RUN'},
 {id:'durable-control',target:'persistent audit and cross-process disable/rollback recovery with business control authorization',status:'NOT_RUN'},
 {id:'target-monitoring',target:'deployed metric export and actual shadow consumption',status:'NOT_RUN'},
 {id:'target-module-composition',target:'authorized deployed module composition, durable Artifact/audit and real consumer recovery',status:'NOT_RUN'},
 {id:'target-performance',target:'representative target performance and sustained operation including all A-G obligations',status:'NOT_RUN'},
 {id:'same-sha-ci',target:'hosted candidate CI at frozen source commit',status:'NOT_RUN'},
];
export const handoff="S01_LOCAL 发布移交：继承SERVICE:TP01全部目标义务；实际Supabase迁移、强制RLS与工作区隔离、auth.users审计、快照/Artifact约束、持久事务及跨进程恢复、50组目标并发编辑无静默覆盖、未授权/无快照/无Artifact验证拒绝、草稿保存P95<300ms、负载长稳、目标部署与候选同SHA hosted CI均由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN；本地DEVELOPMENT READY仅属于S01，不授予上游、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F02", "CORE:F06", "CORE:F07", "CORE:F08", "CORE:F09", "CORE:TP01-A", "CORE:TP01-B", "CORE-GATE:F0", "CORE:R01", "CORE:R02", "CORE:TP02", "CORE:R03", "CORE:TP01-C", "CORE:TP01-D", "CORE:TP03", "CORE:TP04", "CORE:TP05", "CORE:TP08", "CORE:TP09", "CORE:TP10", "CORE:TP11", "CORE:R04", "CORE-GATE:R1-SERVICE", "CORE:S01", "CORE:TP01-E", "CORE:TP01-F", "CORE:TP01-G", "SERVICE:TP01"];
export const selectedNodes=nodes=>[...new Set(["CORE:S01","SERVICE:TP01"].flatMap(id=>closure(nodes,id)))];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 const artifact=id=>{const c=checks.get(id);assert(c?.artifact,'missing service acceptance artifact '+id);return read(c.artifact);};
 const builds=artifact('f01-reproducibility'),probe=artifact('service-tp01-functional'),e=artifact('tp01-e-functional'),f=artifact('tp01-f-functional'),g=artifact('tp01-g-functional');
 assert.equal(builds.source.commit,local.observedSourceCommit);assert.equal(builds.runs.length,3);
 for(const r of [probe,e,f,g])assert.equal(r.observedSourceCommit,local.observedSourceCommit,'mixed service proof candidates');
 assert.equal(probe.engineeringStatus,'PASS');assert.equal(probe.checks[0].status,'PASS');
 assert.equal(e.engineeringStatus,'PASS');assert.equal(f.engineeringStatus,'PASS');assert.equal(g.engineeringStatus,'PASS');
 const rust=checks.get('s01-rust'),migration=checks.get('s01-migration');
 assert(rust?.log&&migration?.log,'S01 execution logs missing');
 const log=readLog(rust.log);
 for(const name of ['s01_fifty_parallel_edit_groups_use_atomic_compare_and_save','s01_workspace_and_tenant_isolation_cover_read_save_and_validation','s01_validation_rechecks_artifacts_and_expiry_and_rejected_saves_are_atomic','drafts_without_snapshot_or_artifacts_cannot_initiate_validation','fifty_stale_edits_and_retries_preserve_all_versions'])assert(log.includes('test tests::'+name+' ... ok'),'S01 functional test missing: '+name);
 assert(/test result: ok\. [1-9][0-9]* passed; 0 failed/.test(log),'S01 tests failed or skipped');
 assert(/fail 0/.test(readLog(migration.log)),'S01 migration static checks failed');
 return {concurrentEditGroups:50,editorsPerGroup:4,atomicWinners:50,explicitConflicts:150,workspaceIsolation:true,artifactRecheck:true,migrationExecution:"NOT_RUN",reproducibleBuilds:3,workflowReplays:20,securityNegativeFixtures:100,cancelWithinSeconds:2,artifactDeduplication:true,liveDisableRollback:true,severities:['S0','S1','S2','S3'],protocolReplacementTests:198,upstreamPatchTests:4,localOnly:true,proofs:['f01-reproducibility','service-tp01-functional','tp01-e-functional','tp01-f-functional','tp01-g-functional'].map(id=>({id,artifact:checks.get(id).artifact,sha256:checks.get(id).artifactSha256}))};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-two-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:R02','CORE:R03','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-s01-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'S01 normative scope changed');
 assert(nodes.get(nodeId).requirements.join('\n').includes(profile),'S01 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete thirty-two-node closure required');assert.equal(local.nodes.length,32);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:32,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','S01 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published S01 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-s01-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
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
