import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {digest} from '../../../../scripts/provider-a1-receipts.mjs';
export const base='docs/audit/evidence/frontend-gate-handoff-20261012';
export function verifyEvidence({read=p=>readFileSync(p)}={}){
 const json=p=>JSON.parse(read(p)),m=json(base+'/manifest.json'),runs=json(base+'/execution-results.json');
 assert.equal(m.schema,'quantos-frontend-handoff-evidence/v1');assert.equal(m.sourceCommit,'cf48f8522b015e218f4d9e15245de06b4bea69a7');
 for(const key of ['databaseExecution','externalExecution','formalAccepted'])assert.equal(m[key],false);assert.equal(m.targetAcceptance,'NOT_RUN');
 assert.deepEqual(runs.map(x=>x.id),['plans','frontend-handoff','core-handoff','plan-negatives','receipt-negatives','coverage','a2-strict-rejected','tp01-d-stale-rejected','release-rejected','prerequisites','diff']);assert.equal(m.executedChecks,runs.length);
 for(const r of runs){assert.equal(r.status,'PASS');assert.equal(r.sourceCommit,m.sourceCommit);assert.equal(r.exitCode,r.expectedExit);assert.equal(r.signal,null);assert.equal(r.errorCode,null);assert.equal(digest(read(r.log)),r.sha256,'execution log changed');}
 for(const r of [...m.sources,...m.historicalIntegrity])assert.equal(digest(read(r.path)),r.sha256,'source or historical evidence changed');
 let count=0;for(const id of ['plan-negatives','receipt-negatives']){const log=read(runs.find(x=>x.id===id).log).toString();assert.match(log,/ℹ fail 0\s*$/m);assert.match(log,/ℹ skipped 0\s*$/m);count+=Number(/ℹ pass (\d+)/.exec(log)[1]);}assert.equal(count,m.negativeTests);assert.equal(count,247);
 const a=json(base+'/prerequisites-after-withdrawal.json'),b=json(base+'/prerequisites-before-withdrawal.json');assert.equal(a.observedSourceCommit,m.sourceCommit);
 for(const key of ['databaseExecution','externalExecution','formalAccepted'])assert.equal(a[key],false);
 assert.equal(a.roots.length,2);for(const [i,n]of a.roots.entries()){assert.equal(n.stageGate.status,'NOT_ASSESSED');assert.equal(n.admission,'NOT_READY');assert.equal(n.aggregateReceipt.valid,false);assert.equal(n.directDependencies.length,i===0?3:14);assert.equal(n.closure.length,i===0?17:27);assert(n.closure.every(d=>d.stageGate.status==='NOT_ASSESSED'&&!d.receiptValidation.valid));}
 const d=b.roots[1].directDependencies.find(x=>x.nodeId==='CORE:TP01-D');assert.equal(d.stageGate.status,'READY');assert.equal(d.receiptValidation.valid,false);assert.equal(d.receiptValidation.reason,'source/contract/config/test inventory or content changed');assert(a.historicalA2.changedInputs.length>0);assert.equal(a.historicalA2.validation.valid,false);assert.equal(a.release.status,'NOT_RUN');
 const h=json(runs.find(x=>x.id==='frontend-handoff').log);assert.equal(h.tasks,64);assert.equal(h.checkpoints,16);assert.equal(h.externalEarlyGates,0);assert.equal(h.performanceEarlyGates,0);
 assert.match(read(runs.find(x=>x.id==='a2-strict-rejected').log).toString(),/A2 current assessment is not READY/);assert.match(read(runs.find(x=>x.id==='release-rejected').log).toString(),/release target evidence NOT_RUN/);
 return {status:'PASS',sourceCommit:m.sourceCommit,checks:runs.length,tests:count,tasks:h.tasks,checkpoints:h.checkpoints,historicalBindings:m.historicalIntegrity.length,targetAcceptance:'NOT_RUN',formalAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(verifyEvidence()));}catch(e){console.error(e.message);process.exitCode=1;}}
