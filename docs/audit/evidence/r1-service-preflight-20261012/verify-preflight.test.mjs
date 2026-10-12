import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {verify} from './verify-preflight.mjs';
const original=resolve('docs/audit/evidence/r1-service-preflight-20261012/attempt-01');
function fixture(fn){const dir=mkdtempSync(resolve(tmpdir(),'quantos-r1-preflight-'));try{cpSync(original,dir,{recursive:true});fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
const mutate=(dir,name,fn)=>{const path=resolve(dir,name),r=JSON.parse(readFileSync(path));fn(r);writeFileSync(path,JSON.stringify(r,null,2)+'\n');};
test('local preflight verifies evidence without granting admission',()=>assert.equal(verify(original).r1Service,'NOT_ASSESSED'));
for(const [name,file,change,expected]of[
 ['fake READY','receipt.json',r=>r.gate.tp01C='READY',/NOT_ASSESSED/],
 ['target PASS','receipt.json',r=>r.target.database='PASS',/NOT_RUN/],
 ['missing check','execution-results.json',r=>r.pop(),/missing or duplicate/],
 ['timeout','execution-results.json',r=>r[3].timedOut=true,/true !== false/],
 ['foreign candidate','f08-service.json',r=>r.sourceCommit='0'.repeat(40),/Expected values/],
 ['changed source','inputs.json',r=>r[0].sha256='sha256:'+'0'.repeat(64),/Expected values/],
 ['formal approval','receipt.json',r=>r.gate.formalAccepted=true,/formalAccepted/],
 ['missing direct dependency','inventory.json',r=>r.dependencies.pop(),/Expected values/],
])test('preflight refuses '+name,()=>fixture(dir=>{mutate(dir,file,change);assert.throws(()=>verify(dir),expected);}));
test('preflight refuses substituted execution logs',()=>fixture(dir=>{writeFileSync(resolve(dir,'logs/python.log'),'1382 passed');assert.throws(()=>verify(dir),/execution log changed/);}));
test('preflight refuses substituted supporting artifacts',()=>fixture(dir=>{writeFileSync(resolve(dir,'supporting/f08-service/installed-module.log'),'fake');assert.throws(()=>verify(dir),/supporting artifact inventory changed/);}));
