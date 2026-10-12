import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,validateLocalPrerequisites,localDeferred,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
import {verify as verifyR03} from './r03-stage-check.mjs';
export const profile='R04_LOCAL';
export const directory='docs/audit/evidence/local-development-20261012';
export const gateIds=['CORE-GATE:F0','CORE:TP03','CORE:TP04'];
export const handoff='F0/TP03/TP04/R04 本地开发移交：全部Supabase目标命令、平台可写性、PostgreSQL迁移/RLS/事务、Auth/BFF/Runtime/Storage持久闭环和恢复、代表性负载/性能/长稳/目标部署及同SHA CI，由RELEASE-GATE:BETA在首次上线前对候选完整源码实际验收；本地READY不构成数据库、生产或正式ACCEPTED。';
export const manifestPath=id=>directory+'/'+id.toLowerCase().replaceAll(':','-')+'.json';
export function verifyGate(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites}={}) {
 assert(gateIds.includes(r.nodeId),'node outside authorized local gate');
 assert.equal(r.schema,'quantos-local-development/v1');assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.status,'READY');assert.equal(r.profile,profile);
 assert.equal(r.databaseExecution,false);assert.equal(r.formalAccepted,false);assert.equal(r.production,false);
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'release handoff removed');
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile));
 assert.deepEqual(r.planInput,planInput(nodes.get(r.nodeId)),'local gate normative scope changed');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'prerequisite index changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'prerequisite source differs');
 const own=local.nodes.find(n=>n.nodeId===r.nodeId);assert(own,'own functional evidence missing');assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(r.nodeId).dependencies.map(nodeId=>({nodeId,status:'LOCAL_READY',owner:r.nodeId,inputDigest:local.nodes.find(n=>n.nodeId===nodeId)?.inputDigest})),'dependency closure changed');
 return {nodeId:r.nodeId,stageGate:'READY',profile,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished(id,{nodes=nodesFromPlans()}={}) {
 assert(gateIds.includes(id));const gate=nodes.get(id).stage_gate;assert.equal(gate.status,'READY','local gate not READY');assert.deepEqual(gate.evidence,[manifestPath(id).slice(5)]);
 const bytes=readFileSync(resolve(root,manifestPath(id)));assert.equal(digest(bytes),gate.input_digest,'local manifest digest changed');return verifyGate(JSON.parse(bytes),{nodes});
}
export function publishLocal(index) {
 const nodes=nodesFromPlans(),local=validateLocalPrerequisites(index,{nodes,profile});
 for(const nodeId of gateIds){const own=local.nodes.find(n=>n.nodeId===nodeId);const r={schema:'quantos-local-development/v1',nodeId,stage:'DEVELOPMENT',status:'READY',profile,databaseExecution:false,production:false,formalAccepted:false,observedSourceCommit:local.observedSourceCommit,planInput:planInput(nodes.get(nodeId)),functionalManifest:own.manifest,functionalDigest:own.inputDigest,localPrerequisites:{manifest:index,inputDigest:local.inputDigest},dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile)}};verifyGate(r,{nodes});const bytes=JSON.stringify(r,null,2)+'\n';writeFileSync(resolve(root,manifestPath(nodeId)),bytes);nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifestPath(nodeId).slice(5)]};}
 for(const [p,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])writeFileSync(resolve(root,p),publishStages(readFileSync(resolve(root,p),'utf8'),new Map(gateIds.map(id=>[id,nodes.get(id)])),namespace));
 return gateIds.map(id=>verifyPublished(id));
}
export function admission({nodes=nodesFromPlans(),validate=verifyPublished,r03=()=>{const bytes=readFileSync(resolve(root,'docs/audit/evidence/r03-20261011/manifest.json')),gate=nodes.get('CORE:R03').stage_gate;assert.equal(gate.status,'READY','R03 local gate not READY');assert.deepEqual(gate.evidence,['audit/evidence/r03-20261011/manifest.json']);assert.equal(gate.input_digest,digest(bytes),'R03 published manifest changed');return verifyR03(JSON.parse(bytes));},readR03=()=>JSON.parse(readFileSync(resolve(root,'docs/audit/evidence/r03-20261011/manifest.json')))}={}) {
 assert.deepEqual(nodes.get('CORE:R04').dependencies,['CORE:R03','CORE:TP03','CORE:TP04','CORE-GATE:F0'],'R04 prerequisite scope changed');
 const prerequisites=gateIds.map(id=>validate(id,{nodes}));const research=r03();assert.equal(research.stageGate,'READY');const source=readR03().observedSourceCommit;assert(prerequisites.every(r=>r.observedSourceCommit===source),'R04 prerequisite candidates differ');
 return {nodeId:'CORE:R04',admission:'READY',scope:'local implementation only',profile,prerequisites,observedSourceCommit:source,implementationGate:nodes.get('CORE:R04').stage_gate.status,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false};
}
export function releaseCheck({nodes=nodesFromPlans(),validate=validateReceipt,read=p=>readFileSync(resolve(root,p))}={}) {
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','release target evidence NOT_RUN');assert.equal(beta.review_status,'ACCEPTED','formal release acceptance missing');assert(/^[a-f0-9]{40}$/.test(beta.source_commit),'release candidate missing');
 for(const id of gateIds){validate(id,{nodes});const m=JSON.parse(read('docs/'+nodes.get(id).stage_gate.evidence[0]));assert.equal(m.schema,'quantos-stage-functional-manifest/v1','local profile cannot satisfy release');assert.equal(m.observedSourceCommit,beta.source_commit,'release candidates differ');}
 return {releaseGate:'READY',sourceCommit:beta.source_commit,formalAccepted:true,productionAuthorization:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const arg=process.argv[2];const r=arg==='--admission'?admission():arg==='--release'?releaseCheck():verifyPublished(arg);console.log(JSON.stringify(r,null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
