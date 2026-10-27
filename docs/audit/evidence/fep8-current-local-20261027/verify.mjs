import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {directory,base,reviewPath,verify} from '../../../../scripts/fep8-current-review.mjs';
import {files} from '../../../../scripts/frontend-g8-current-review.mjs';
import {hash,verifyInputs} from '../../../../scripts/g1-download-review.mjs';
const json=p=>JSON.parse(readFileSync(p)),r=json(directory+'/receipt.json'),m=json(directory+'/manifest.json');
assert.equal(m.schema,'quantos-current-fep8-seal/v1');assert.equal(m.sourceCommit,r.sourceCommit);assert.equal(m.base,base);execFileSync('git',['merge-base','--is-ancestor',r.sourceCommit,'HEAD']);
assert.deepEqual(m.artifacts.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of m.artifacts)assert.equal(hash(readFileSync(f.path)),f.sha256,f.path);
const failed=json(directory+'/failed-attempts.json');for(const f of failed.attempts){const i=json(f.attempt+'/inputs.json');assert.equal(i.sourceCommit,f.sourceCommit);verifyInputs(i.sourceCommit,i.inputs);assert.equal(json(f.failure).sourceCommit,f.sourceCommit);assert.equal(json(f.failure).status,'FAIL');}
assert.deepEqual(json(directory+'/changed-files.json').sourceFiles,execFileSync('git',['diff','--name-only',base,r.sourceCommit],{encoding:'utf8'}).trim().split('\n'));
assert.deepEqual(json(directory+'/handoff.json').gaps,json(reviewPath).gaps);assert.deepEqual(json(directory+'/handoff.json').next,json(reviewPath).next);assert.deepEqual(json(directory+'/result.json'),verify(r));
const scan=json(directory+'/seal-scan/review.json');assert.equal(scan.sourceCommit,r.sourceCommit);assert.equal(scan.findings,0);assert.deepEqual(json(directory+'/seal-scan/raw-report.json'),[]);
console.log(JSON.stringify({status:'PASS_CURRENT_FEP8_DEVELOPMENT_PACKET_ONLY',sourceCommit:r.sourceCommit,sealedFiles:m.artifacts.length,failedAttemptsPreserved:failed.attempts.length,gate:r.boundary.gate,m5:r.boundary.m5,developmentStatus:'PARTIAL',formalAccepted:false,runtimeAdmission:'DENIED',nextTask:'CORE:L03'},null,2));
