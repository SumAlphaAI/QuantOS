import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {base} from './scope.mjs';
import {verify} from './verify-preflight.mjs';
const original=process.env.TP02_PREFLIGHT_ATTEMPT??base+'/attempt-01';
test('complete actual preflight remains NOT_ASSESSED for TP02 and R1',()=>{const r=verify(original);assert.equal(r.preflight,'PASS');assert.equal(r.gate.tp02,'NOT_ASSESSED');});
for(const [name,file,mutate]of[
 ['formal claim','receipt.json',r=>r.gate.formalAccepted=true],
 ['production claim','receipt.json',r=>r.gate.production=true],
 ['database claim','receipt.json',r=>r.gate.databaseExecution=true],
 ['R1 leaked READY','receipt.json',r=>r.gate.r1Service='READY'],
 ['TP02 leaked READY','receipt.json',r=>r.gate.tp02='READY'],
 ['premature registration','receipt.json',r=>r.registration='REGISTERED'],
 ['missing prerequisite','receipt.json',r=>r.necessaryClosure.splice(6,1)],
 ['wrong candidate','receipt.json',r=>r.sourceCommit='a'.repeat(40)],
 ['failed overall result','receipt.json',r=>r.status='FAIL'],
 ['target waiver','receipt.json',r=>r.target.database='PASS'],
 ['missing execution','execution-results.json',r=>r.pop()],
 ['unexpected exit','execution-results.json',r=>r[0].exitCode=1],
 ['hidden timeout','execution-results.json',r=>r[0].timedOut=true],
 ['hidden signal','execution-results.json',r=>r[0].signal='SIGTERM'],
 ['different command','execution-results.json',r=>r[0].command=['echo','PASS']],
 ['fixture omitted','fixture-matrix.json',r=>r.fixtureNames.pop()],
 ['unary-only fixture','fixture-matrix.json',r=>r.rpcs=['Execute']],
 ['fake snapshot bytes','fixture-matrix.json',r=>r.snapshotBytesResolved=true],
 ['real tools','fixture-matrix.json',r=>r.toolsExecuted=true],
 ['editable wheel','wheel-inspection.json',r=>r.editable=true],
 ['missing wheel','wheel-inspection.json',r=>r.wheels.pop()],
 ['unreaped child','component/receipt.json',r=>r.package.ownedChildReaped=false],
 ['fake package source','component/receipt.json',r=>r.observedSourceCommit='b'.repeat(40)],
 ['unapproved upstream','component/receipt.json',r=>r.package.realUpstreamRuntime=true],
])test('evidence rejects '+name,()=>{const scratch=mkdtempSync(join(tmpdir(),'tp02-preflight-negative-'));try{cpSync(original,scratch,{recursive:true});const path=join(scratch,file),r=JSON.parse(readFileSync(path));mutate(r);writeFileSync(path,JSON.stringify(r));assert.throws(()=>verify(scratch));}finally{rmSync(scratch,{recursive:true,force:true});}});
test('modified raw replay log is rejected',()=>{const scratch=mkdtempSync(join(tmpdir(),'tp02-preflight-negative-'));try{cpSync(original,scratch,{recursive:true});writeFileSync(join(scratch,'logs/tp02-contract.log'),'131 passed\n');assert.throws(()=>verify(scratch));}finally{rmSync(scratch,{recursive:true,force:true});}});

test('wheel byte substitution is rejected',()=>{const scratch=mkdtempSync(join(tmpdir(),'tp02-wheel-negative-'));try{cpSync(original,scratch,{recursive:true});writeFileSync(join(scratch,'component/wheels/quantos_rd_agent-0.1.0-py3-none-any.whl'),'fake');assert.throws(()=>verify(scratch));}finally{rmSync(scratch,{recursive:true,force:true});}});
