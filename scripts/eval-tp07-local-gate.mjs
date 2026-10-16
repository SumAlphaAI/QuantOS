// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
export const profile='EVAL-TP07_LOCAL',nodeId='EVALUATION:TP07';
export const manifest='docs/audit/evidence/eval-tp07-local-20261016/manifest.json';
export const deferredTargets=[
 {id:'inherited-targets',target:'F03/F06/F08 inherited Supabase, deployment and real identity/engine obligations',status:'NOT_RUN'},
 {id:'runtime-legal-supply-chain',target:'CORE:TP07/X3 actual process transport/kernel integration, legal/distribution approval, deployed SBOM and refreshed advisory/reachability/remediation review',status:'NOT_RUN'},
 {id:'target-performance-ci',target:'authorized target security/performance/soak and frozen candidate same-SHA hosted CI',status:'NOT_RUN'},
];
export const handoff="EVAL-TP07_LOCAL 发布移交：本检查点仅评估固定TP07版本、许可证、lock级SBOM/CVE快照、capability与执行边界；不放行CORE:TP07、任何上游运行时、真实内核或部署。继承F03/F06/F08全部9组目标义务；Supabase/部署身份、真实进程隔离与transport、源码/许可证/制品/运行时SBOM及最新CVE/可达性/修复审查、真实Paper/Shadow/订单事件与持久幂等恢复、安全/性能/长稳和同SHA hosted CI归CORE:TP07/X3及RELEASE-GATE:BETA首次发布前实际验收。目标及法律/发布审批NOT_RUN，正式用户确认PENDING。";
export const expectedNodes=["CORE:F01", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F06", "CORE:F07", "CORE:F08", "EVALUATION:TP07"];
export const selectedNodes=nodes=>[...new Set([nodeId].flatMap(id=>closure(nodes,id)))];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 for(const id of ['tp07-evaluation','tp07-evaluation-tests'])assert(checks.get(id)?.log,'missing evaluation log '+id);
 const log=readLog(checks.get('tp07-evaluation').log),r=JSON.parse(log.trim());
 assert.equal(r.schema,'quantos-tp07-evaluation/v1');assert.equal(r.sourceFiles,17);assert.equal(r.status,'PASS');assert.equal(r.observedSourceCommit,local.observedSourceCommit);assert.equal(r.upstreamCommit,'fa86c6e39e8f064d5922c0ee4da5e2a9a2716408');assert.equal(r.license,'LGPL-3.0-or-later');assert.equal(r.packages,1051);assert.equal(r.capabilities,7);assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.upstreamExecuted,false);assert.equal(r.productionApproved,false);assert.equal(r.formalAccepted,false);
 for(const name of ['baseline.lock.json','sbom.spdx.json','cve-audit.json'])assert.equal(r[name],digest(readFileSync(resolve(root,'third_party/nautilus-trader/'+name))).slice(7),'evaluation input hash changed');
 const advisory=JSON.parse(readFileSync(resolve(root,'third_party/nautilus-trader/cve-audit.json')));assert.equal(r.cveStatus,advisory.status);assert.equal(r.advisoryIds,(advisory.advisoryIds??[]).length);assert(['RECORDED','UNKNOWN_NETWORK'].includes(r.cveStatus));assert(/Ran 12 tests/.test(readLog(checks.get('tp07-evaluation-tests').log)));assert(/\nOK\s*$/.test(readLog(checks.get('tp07-evaluation-tests').log)));
 return{evaluation:r,ownTests:12,localOnly:true,runtimeAdmission:'DENIED'};
}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized eight-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:F03','CORE:F06','CORE:F08'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-eval-tp07-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'EVALUATION:TP07 normative scope changed');
 assert(nodes.get(nodeId).required_scope.includes(profile),'EVALUATION:TP07 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete eight-node closure required');assert.equal(local.nodes.length,8);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:8,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','EVALUATION:TP07 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published EVALUATION:TP07 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-eval-tp07-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
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
