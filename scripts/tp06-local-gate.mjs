// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
export const profile='TP06_LOCAL',nodeId='CORE:TP06';
export const manifest='docs/audit/evidence/tp06-local-20261015/manifest.json';
export const deferredTargets=[
 {id:'durable-target',target:'actual Supabase Storage/Artifact audit, RLS, transactions and cross-process recovery',status:'NOT_RUN'},
 {id:'provider-target',target:'separately authorized live provider and immutable adopted candidate, trusted identity, OS egress and credential isolation',status:'NOT_RUN'},
 {id:'target-performance',target:'representative deployed composition, load, performance, security and sustained canary/rollback obligations inherited from SERVICE:TP01',status:'NOT_RUN'},
 {id:'same-sha-ci',target:'hosted CI at frozen release candidate and ProjectUser formal confirmation',status:'NOT_RUN'},
];
export const handoff="TP06_LOCAL 发布移交：继承SERVICE:TP01及R1-SERVICE全部Supabase、部署、真实canary/回滚、外部治理及性能义务；实际Storage/Artifact持久审计、RLS/事务/跨进程恢复、获准live模型与受信任身份、OS出网及凭据隔离、真实目标组合/安全/负载/性能/长稳和候选同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。原100恶意提示无订单/secret/network越权、静态失败100%阻断Release、仅Artifact输出和上游完全可替换要求保留；本地READY仅属于TP06，不授予上游、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01","CORE:F03","CORE:F04","CORE:F05","CORE:F06","CORE:F07","CORE:F08","CORE:F02","CORE:TP01-A","CORE:TP01-B","CORE:F09","CORE-GATE:F0","CORE:TP01-C","CORE:R01","CORE:R02","CORE:TP01-D","CORE:TP02","CORE:TP03","CORE:TP04","CORE:TP05","CORE:TP08","CORE:TP09","CORE:TP10","CORE:TP11","CORE:R03","CORE:R04","CORE-GATE:R1-SERVICE","CORE:TP01-E","CORE:TP01-F","CORE:TP01-G","SERVICE:TP01","CORE:TP06"];
export const selectedNodes=nodes=>[...new Set(["CORE:TP06"].flatMap(id=>closure(nodes,id)))];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 const artifact=id=>{const c=checks.get(id);assert(c?.artifact,'missing service acceptance artifact '+id);return read(c.artifact);};
 const builds=artifact('f01-reproducibility'),probe=artifact('service-tp01-functional'),e=artifact('tp01-e-functional'),f=artifact('tp01-f-functional'),g=artifact('tp01-g-functional');
 assert.equal(builds.source.commit,local.observedSourceCommit);assert.equal(builds.runs.length,3);
 for(const r of [probe,e,f,g])assert.equal(r.observedSourceCommit,local.observedSourceCommit,'mixed service proof candidates');
 assert.equal(probe.engineeringStatus,'PASS');assert.equal(probe.checks[0].status,'PASS');
 assert.equal(e.engineeringStatus,'PASS');assert.equal(f.engineeringStatus,'PASS');assert.equal(g.engineeringStatus,'PASS');
 const functional=artifact('tp06-functional');assert.equal(functional.observedSourceCommit,local.observedSourceCommit);assert.equal(functional.engineeringStatus,'PASS');
 const rust=checks.get('tp06-rust');assert(rust?.log,'TP06 consumer log missing');
 const log=readLog(rust.log);
 for(const name of ['hundred_static_check_failures_all_block_release_path','clean_generated_draft_replays_through_backtest_pipeline','forged_static_flags_and_source_never_adapt_and_integer_min_does_not_panic','tp06_owned_python_process_artifacts_feed_actual_backtest_and_block_release','unsupported_rules_are_rejected'])assert(log.includes('test generated::tests::'+name+' ... ok'),'TP06 consumer test missing: '+name);
 assert(/test result: ok\. 5 passed; 0 failed/.test(log),'TP06 consumer tests failed or skipped');
 return {maliciousPrompts:100,providerStaticFailures:100,consumerStaticFailures:100,forgedConsumerCases:100,artifactOnly:true,replaceableProvider:true,realProcessBacktest:true,reproducibleBuilds:3,localOnly:true,proofs:['f01-reproducibility','service-tp01-functional','tp01-e-functional','tp01-f-functional','tp01-g-functional','tp06-functional'].map(id=>({id,artifact:checks.get(id).artifact,sha256:checks.get(id).artifactSha256}))};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-two-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:F08','SERVICE:TP01','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-tp06-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'TP06 normative scope changed');
 assert(nodes.get(nodeId).requirements.join('\n').includes(profile),'TP06 local scope missing');
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
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','TP06 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published TP06 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-tp06-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
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
