// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {componentCoverage} from './s2-service-coverage.mjs';
import {verifyEvidence} from './s2-service-evidence.mjs';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
export const profile='S2-SERVICE_LOCAL',nodeId='CORE-GATE:S2-SERVICE';
export const manifest='docs/audit/evidence/s2-service-local-20261016/manifest.json';
export const deferredTargets=[
 {id:'durable-target',target:'all component Supabase/RLS/transactions, actual identity and durable cross-process audit, Artifact, approval and recovery obligations',status:'NOT_RUN'},
 {id:'deployment-supply-chain',target:'trusted deployed identities/clocks/images/OS isolation, live data/model rights, legal/distribution and refreshed supply-chain/advisory/reachability review; complete TP07/TP12 X3 review',status:'NOT_RUN'},
 {id:'performance-canary-ci',target:'representative security/load/cost calibration/performance/soak, 7-day canary, target rollback <=300s and same-SHA hosted CI; formal ProjectUser confirmation',status:'NOT_RUN'},
 {id:'ui-integration',target:'CORE:S04 P06/P07 and 20 UI fixtures / FRONTEND-GATE:G3 and BFF-FE-004 public mappings',status:'NOT_RUN'},
];
export const handoff="S2-SERVICE_LOCAL 发布移交：本聚合仅放行新冻结候选的S2本地服务功能；继承R1-SERVICE、SERVICE:TP01、S01/TP06/S02/S03/S04、TP08–TP11及EVALUATION:TP07/TP12全部22组目标义务和组件移交。Supabase/RLS/持久事务与跨进程恢复、真实部署身份/时钟/进程及凭据隔离、数据/模型/法律授权和最新供应链漏洞复审、目标成本校准/安全/负载/性能/持续canary与回滚、同SHA hosted CI和正式用户确认由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。S04页面与S2业务联调归CORE:S04/FRONTEND-GATE:G3及BFF-FE-004；CORE:TP07/TP12完整复审保留X3，TP12在TP07和S2之后。聚合READY不授予上游运行时、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=["CORE:F01", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F02", "CORE:F06", "CORE:F07", "CORE:F08", "CORE:F09", "CORE:TP01-A", "CORE:TP01-B", "CORE-GATE:F0", "CORE:R01", "CORE:R02", "CORE:TP01-C", "CORE:TP01-D", "CORE:TP02", "CORE:TP03", "CORE:TP04", "CORE:TP05", "CORE:TP08", "CORE:TP09", "CORE:TP10", "CORE:TP11", "CORE:R03", "CORE:R04", "CORE-GATE:R1-SERVICE", "CORE:TP01-E", "CORE:TP01-F", "CORE:TP01-G", "SERVICE:TP01", "CORE:S01", "CORE:TP06", "CORE:S02", "CORE:S03", "SERVICE:S04", "EVALUATION:TP07", "EVALUATION:TP12", "CORE-GATE:S2-SERVICE"];
export const directPrerequisites=["CORE-GATE:R1-SERVICE", "SERVICE:TP01", "CORE:S01", "CORE:TP06", "CORE:S02", "CORE:S03", "SERVICE:S04", "CORE:TP08", "CORE:TP09", "CORE:TP10", "CORE:TP11", "EVALUATION:TP07", "EVALUATION:TP12"];
export const selectedNodes=nodes=>[...new Set([nodeId].flatMap(id=>closure(nodes,id)))];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8'),components=componentCoverage,validateEvidence=verifyEvidence}={}){
 const aggregate=components(local,{read,readLog}),checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 const c=checks.get('s2-service-functional');assert(c?.artifact,'missing actual S2 aggregate artifact');const evidence=read(c.artifact);validateEvidence(evidence,local.observedSourceCommit);
 assert.deepEqual(evidence.coverage,aggregate,'component aggregate changed');
 return{aggregate,dependencyResultsDigest:evidence.dependencyResultsDigest,localOnly:true,runtimeAdmission:'DENIED'};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog,components,validateEvidence}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-nine-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,directPrerequisites,'direct consumer scope changed');
 assert.equal(r.schema,'quantos-s2-service-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'CORE-GATE:S2-SERVICE normative scope changed');
 assert(nodes.get(nodeId).required_scope.includes(profile),'CORE-GATE:S2-SERVICE local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete thirty-nine-node closure required');assert.equal(local.nodes.length,39);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog,components,validateEvidence}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:39,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','CORE-GATE:S2-SERVICE local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published CORE-GATE:S2-SERVICE digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,components,validateEvidence,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-s2-service-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
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
