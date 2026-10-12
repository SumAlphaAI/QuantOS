import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {base} from './scope.mjs';
import {verify} from './verify-preflight.mjs';
const original=process.env.TP01_D_PREFLIGHT_ATTEMPT??base+'/attempt-01';
test('complete actual preflight remains NOT_ASSESSED for TP01-D and R1',()=>{const r=verify(original);assert.equal(r.preflight,'PASS');assert.equal(r.gate.tp01D,'NOT_ASSESSED');});
for(const [name,file,mutate]of[
 ['formal claim','receipt.json',r=>r.gate.formalAccepted=true],
 ['production claim','receipt.json',r=>r.gate.production=true],
 ['database claim','receipt.json',r=>r.gate.databaseExecution=true],
 ['R1 leaked READY','receipt.json',r=>r.gate.r1Service='READY'],
 ['TP01-D leaked READY','receipt.json',r=>r.gate.tp01D='READY'],
 ['premature registration','receipt.json',r=>r.registration='REGISTERED'],
 ['missing prerequisite','receipt.json',r=>r.necessaryClosure.splice(14,1)],
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
 ['retired data consumed','synthetic-inputs.json',r=>r.retiredHistoricalFactsConsumed=32],
 ['source license inferred','synthetic-inputs.json',r=>r.realSourceLicenseGranted=true],
 ['new ingestion','synthetic-inputs.json',r=>r.newCollection=true],
])test('evidence rejects '+name,()=>{const scratch=mkdtempSync(join(tmpdir(),'tp01-d-preflight-negative-'));try{cpSync(original,scratch,{recursive:true});const path=join(scratch,file),r=JSON.parse(readFileSync(path));mutate(r);writeFileSync(path,JSON.stringify(r));assert.throws(()=>verify(scratch));}finally{rmSync(scratch,{recursive:true,force:true});}});
test('modified raw replay log is rejected',()=>{const scratch=mkdtempSync(join(tmpdir(),'tp01-d-preflight-negative-'));try{cpSync(original,scratch,{recursive:true});writeFileSync(join(scratch,'logs/tp01-d-replay.log'),'44 passed\n');assert.throws(()=>verify(scratch));}finally{rmSync(scratch,{recursive:true,force:true});}});
