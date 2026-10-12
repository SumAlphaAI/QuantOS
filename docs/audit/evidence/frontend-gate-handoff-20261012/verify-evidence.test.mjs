import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {verifyEvidence,base} from './verify-evidence.mjs';
test('frozen source and actual evidence verify',()=>assert.equal(verifyEvidence().tests,247));
for(const [name,file,mutate]of [
 ['fake target PASS','manifest.json',x=>x.targetAcceptance='PASS'],['fake formal approval','manifest.json',x=>x.formalAccepted=true],['missing check','execution-results.json',x=>x.pop()],['ignored execution failure','execution-results.json',x=>x[0].exitCode=1],['root promoted','prerequisites-after-withdrawal.json',x=>x.roots[1].stageGate.status='READY'],['lost stale READY record','prerequisites-before-withdrawal.json',x=>x.roots[1].directDependencies.find(d=>d.nodeId==='CORE:TP01-D').receiptValidation.valid=true],
])test('rejects '+name,()=>{const path=base+'/'+file;assert.throws(()=>verifyEvidence({read:p=>{const bytes=readFileSync(p);if(p!==path)return bytes;const x=JSON.parse(bytes);mutate(x);return Buffer.from(JSON.stringify(x));}}));});
test('changed log fails',()=>assert.throws(()=>verifyEvidence({read:p=>p.endsWith('/logs/plans.log')?Buffer.from('fake PASS'):readFileSync(p)})));
