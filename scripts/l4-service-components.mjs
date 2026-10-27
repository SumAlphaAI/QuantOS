// Historical integrity is not current-source stage admission.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {hash,verifyInputs} from './g1-download-review.mjs';
export const baseline='8c9a4ba55c6a1961d891d24c7891eb8396734404';
export const components=[
 ['CORE-GATE:X3','core-x3-local-20261026','quantos-core-x3-current/v1','services/bff-gateway/src/reconciliation.rs'],
 ['FE:FEP-7','fep7-function-local-20261024','quantos-fep7-frontend-closure/v1','apps/terminal/tests/fep7-hardening.test.ts'],
 ['CORE:L01','core-l01-local-20261026','quantos-core-l01-current/v1','crates/quantos-execution/src/venue_protocol.rs'],
 ['CORE:L02','core-l02-local-20261027','quantos-core-l02-current/v1','services/execution-gateway/src/restricted_zone.rs'],
 ['SERVICE:L03','service-l03-local-20261027','quantos-service-l03-current/v1','crates/quantos-execution/src/assisted.rs'],
 ['SERVICE:L04','service-l04-local-20261027','quantos-service-l04-current/v1','crates/quantos-evidence/src/local.rs']
];
const safe=p=>{assert(typeof p==='string'&&!p.startsWith('/')&&!p.split('/').includes('..')&&!p.includes('\\')&&!p.includes('\0'));};
export function validateHistorical(bytes,pinned,[id,folder,schema,required],read=p=>readFileSync(p),checkSource=verifyInputs){
 assert.equal(hash(bytes),hash(pinned),'original receipt changed');const r=JSON.parse(bytes);assert.equal(r.schema,schema);assert.match(r.sourceCommit,/^[a-f0-9]{40}$/);
 assert(r.inputs.length>0);assert.equal(new Set(r.inputs.map(i=>i.path)).size,r.inputs.length);for(const i of r.inputs){safe(i.path);assert.match(i.sha256,/^sha256:[a-f0-9]{64}$/);}assert(r.inputs.some(i=>i.path===required));checkSource(r.sourceCommit,r.inputs);
 const b=r.boundary??r;assert.equal(b.nodeId,id);assert.equal(b.gate??b.fep7Gate,'NOT_READY_GAPS_OPEN');assert.equal(b.stageGate,'NOT_ASSESSED');assert.equal(b.formalAccepted,false);assert.equal(b.runtimeAdmission,'DENIED');
 assert(r.attempt.startsWith('docs/audit/evidence/'+folder+'/'));safe(r.attempt);assert(r.artifacts.length>0);assert.equal(new Set(r.artifacts.map(f=>f.path)).size,r.artifacts.length);
 for(const f of r.artifacts){safe(f.path);assert(f.path.startsWith(r.attempt+'/'));assert.equal(hash(read(f.path)),f.sha256,f.path);}
 assert(r.executions.length>0);assert.equal(new Set(r.executions.map(e=>e.id)).size,r.executions.length);
 for(const e of r.executions){const expected=['integration-refusal','fep7-refusal','g7-refusal'].includes(e.id)?1:0;assert.equal(e.exitCode,expected);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert(Array.isArray(e.command)&&e.command.length>0);safe(e.log);assert(r.artifacts.some(f=>f.path===e.log&&f.sha256===e.logSha256));assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 return{nodeId:id,receipt:'docs/audit/evidence/'+folder+'/receipt.json',receiptSha256:hash(bytes),sourceCommit:r.sourceCommit,sourceInputs:r.inputs.length,artifacts:r.artifacts.length,checks:r.executions.length,evidenceScope:'ORIGINAL_SCOPE_ONLY',integrity:'ORIGINAL_CONTENT_INTEGRITY_VERIFIED',stageGate:b.stageGate,gate:b.gate??b.fep7Gate,runtimeAdmission:b.runtimeAdmission};
}
export function snapshot(){
 return components.map(c=>{const path='docs/audit/evidence/'+c[1]+'/receipt.json',bytes=readFileSync(path),pinned=execFileSync('git',['show',baseline+':'+path],{maxBuffer:32e6});const r=validateHistorical(bytes,pinned,c);execFileSync('git',['merge-base','--is-ancestor',r.sourceCommit,baseline]);const original=JSON.parse(bytes);const selected=original.inputs.filter(i=>i.path===c[3]);return{...r,selectedCurrentDrift:selected.filter(i=>hash(readFileSync(i.path))!==i.sha256).map(i=>i.path),currentSourceAdmission:'NOT_INFERRED_FROM_HISTORY'};});
}
