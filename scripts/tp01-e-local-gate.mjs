// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
export const profile='TP01-E_LOCAL',nodeId='CORE:TP01-E';
export const manifest='docs/audit/evidence/tp01-e-local-20261014/manifest.json';
export const handoff='TP01-E_LOCAL 发布移交：全部Supabase前置与平台可写性、PostgreSQL迁移/RLS/事务/Auth/Storage及持久Artifact/audit/取消恢复、实际BFF/Runtime部署授权、GitHub远程分支保护及fork治理、上游实际候选发现/在线CVE刷新/自然schedule与候选同SHA CI、TP09/TP10/TP11固定公共字节与provider条款线上复验、实际diff及range-diff/依赖许可证审查和候选采用、R02真实来源与用途许可、OS egress隔离、代表性性能/容量/长稳；由RELEASE-GATE:BETA首次发布前实际验收。目标NOT_RUN，本地合成同步fixture与S0–S3阻断不授予上游READY、R1-SERVICE、SERVICE:TP01、生产或正式ACCEPTED，不授权sync adoption或外部发布。';
export const expectedNodes=["CORE:F01","CORE:F02","CORE:TP01-A","CORE:F03","CORE:F04","CORE:F05","CORE:F06","CORE:F07","CORE:TP01-B","CORE:F08","CORE:F09","CORE-GATE:F0","CORE:TP01-C","CORE:R01","CORE:R02","CORE:TP01-D","CORE:TP02","CORE:TP03","CORE:TP04","CORE:TP05","CORE:TP08","CORE:TP09","CORE:TP10","CORE:TP11","CORE:R03","CORE:R04","CORE-GATE:R1-SERVICE","CORE:TP01-E"];
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites}={}){
 assert.deepEqual(closure(nodes,nodeId),expectedNodes,'authorized twenty-eight-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:TP01-D','CORE:F02','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-tp01-e-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'TP01-E normative scope changed');
 assert(nodes.get(nodeId).requirements.some(x=>x.includes(profile)),'TP01-E local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'TP01-E release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),closure(nodes,nodeId),'complete twenty-eight-node closure required');assert.equal(local.nodes.length,28);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:28,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','TP01-E local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published TP01-E digest changed');return verify(JSON.parse(bytes),{nodes});
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-tp01-e-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,observedSourceCommit:local.observedSourceCommit,
  planInput:planInput(nodes.get(nodeId)),localPrerequisites:{manifest:index,inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,
  dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile)}};
 validate(r,{nodes});const bytes=JSON.stringify(r,null,2)+'\n';
 nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);
 for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(path=>[path,read(path)]));
 try{for(const [path,value]of updates)write(path,value);return verifyAfter();}catch(error){for(const [path,value]of before)write(path,value);throw error;}
}
export function releaseCheck({nodes=nodesFromPlans(),validate=validateReceipt,read=p=>readFileSync(resolve(root,p))}={}){
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','release target evidence NOT_RUN');assert.equal(beta.review_status,'ACCEPTED','formal release confirmation missing');assert.match(beta.source_commit??'',/^[a-f0-9]{40}$/);
 const selected=closure(nodes,nodeId);for(const id of selected){validate(id,{nodes});const raw=JSON.parse(read('docs/'+nodes.get(id).stage_gate.evidence[0]));assert.equal(raw.schema,'quantos-stage-functional-manifest/v1','local manifests cannot grant release');assert.equal(raw.observedSourceCommit,beta.source_commit,'release candidate differs');}
 return {releaseGate:'READY',formalAccepted:true,productionAuthorization:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
