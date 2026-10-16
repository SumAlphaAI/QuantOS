// Pure projection over actual fresh check records; never reads published READY receipts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,digest,nodesFromPlans,closure,policy,localChecks} from './provider-a1-receipts.mjs';
import {coverage as serviceCoverage} from './service-s04-local-gate.mjs';
import {coverage as tp01Coverage} from './service-tp01-local-gate.mjs';
import {coverage as evaluationCoverage} from './eval-tp12-local-gate.mjs';
export const profile='S2-SERVICE_LOCAL',nodeId='CORE-GATE:S2-SERVICE';
export function dependencyNodes(nodes=nodesFromPlans()){return closure(nodes,nodeId).filter(id=>id!==nodeId);}
export function dependencyChecks(nodes=nodesFromPlans(),p=policy()){
 const priority=id=>p.checks[id].reproducibility?3:(p.checks[id].target||p.checks[id].cleanSource)?2:0;
 return [...new Set(dependencyNodes(nodes).flatMap(id=>localChecks(id,p,profile)))].sort((a,b)=>priority(b)-priority(a));
}
export function componentCoverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks){if(checks.has(c.id))assert.deepEqual(checks.get(c.id),c,'inconsistent shared check');checks.set(c.id,c);}
 const artifact=id=>{const c=checks.get(id);assert(c?.artifact,'missing component artifact '+id);return read(c.artifact);};
 const research=artifact('r04-local-products');assert.equal(research.schema,'quantos-research-local-products/v1');assert.equal(research.sourceCommit,local.observedSourceCommit);assert.equal(research.status,'PASS');assert.equal(research.databaseExecution,false);assert.equal(research.formalAccepted,false);assert.equal(research.checks.length,4);assert(research.checks.every(c=>c.status==='PASS'&&c.exitCode===0&&!c.timedOut));assert.deepEqual(research.files.map(f=>f.file),['proposal-matrix.json','research-consumption.json','order-denial.json']);
 const references=[['TP08','tp08-development'],['TP09','tp09-local-development'],['TP10','tp10-local-development'],['TP11','tp11-local-development']].map(([id,check])=>{
  const r=artifact(check);assert.equal(r.nodeId,'CORE:'+id);assert.equal(r.observedSourceCommit,local.observedSourceCommit,'mixed reference candidates');assert.equal(r.stage,'DEVELOPMENT');assert(['READY','BLOCKED'].includes(r.status),'reference receipt status changed');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.formalAccepted,false);assert(r.checks.length>0&&r.checks.every(c=>c.status==='PASS'&&c.exitCode===0));
  if(id!=='TP08'){assert.equal(r.validationMode,'LOCAL');assert.deepEqual(r.upstreamVerification,{status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA',externalExecution:false,currentPublicBytesVerified:false});}
  return{nodeId:r.nodeId,artifact:checks.get(check).artifact,sha256:checks.get(check).artifactSha256,mode:'LOCAL_REFERENCE_ONLY',recordedAdmission:r.status,upstreamRuntime:'DENIED',formalAccepted:false};
 });
 const service=serviceCoverage(local,{read,readLog}),tp01=tp01Coverage(local,{read}),evaluation=evaluationCoverage(local,{read,readLog});
 return{research:{suites:4,products:3,sourceCommit:research.sourceCommit,artifact:checks.get('r04-local-products').artifact,sha256:checks.get('r04-local-products').artifactSha256},tp01,service,references,evaluation,runtimeAdmission:'DENIED',formalAccepted:false,uiAcceptance:'NOT_RUN',fullTp12Review:'X3_AFTER_CORE_TP07_AND_S2'};
}
export const resultsDigest=rows=>digest(JSON.stringify(rows));
