import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {directory,base,files,verify,reviewDigestFinding} from '../../../../scripts/frontend-g8-current-review.mjs';
import {hash,verifyInputs} from '../../../../scripts/g1-download-review.mjs';
const json=p=>JSON.parse(readFileSync(p)),manifest=json(directory+'/manifest.json'),receipt=json(directory+'/receipt.json');
assert.equal(manifest.schema,'quantos-g8-current-seal/v1');assert.equal(manifest.sourceCommit,receipt.sourceCommit);assert.equal(manifest.base,base);
execFileSync('git',['merge-base','--is-ancestor',receipt.sourceCommit,'HEAD']);
assert.deepEqual(manifest.artifacts.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));
for(const f of manifest.artifacts)assert.equal(hash(readFileSync(f.path)),f.sha256,f.path);
const failed=json(directory+'/failed-attempts.json');for(const f of failed.attempts){const input=json(f.attempt+'/inputs.json');assert.equal(f.sourceCommit,input.sourceCommit);verifyInputs(input.sourceCommit,input.inputs);assert.equal(json(f.failure).sourceCommit,f.sourceCommit);assert.equal(f.status,'FAIL');assert.equal(f.scope,'ORIGINAL_ATTEMPT_ONLY_NOT_CURRENT_PASS');}
assert.deepEqual(json(directory+'/changed-files.json').sourceFiles,execFileSync('git',['diff','--name-only',base,receipt.sourceCommit],{encoding:'utf8'}).trim().split('\n'));
const scan=json(directory+'/seal-scan/review.json'),raw=json(directory+'/seal-scan/raw-report.json');assert.equal(scan.sourceCommit,receipt.sourceCommit);assert.equal(scan.unreviewedFindings,0);assert.equal(scan.rawFindings,raw.length);assert.equal(scan.reviewedDigestFindings,raw.length);assert.equal(json(scan.canaryEvidence).length,2);const reviewed=raw.map(f=>{const path=f.File.split('/positive/')[1],attempt=path.slice(0,path.indexOf('/browser/'));return reviewDigestFinding(f,attempt,json(attempt+'/inputs.json').sourceCommit);});assert(reviewed.every(Boolean));assert.deepEqual(scan.reviewed,reviewed);
assert.deepEqual(json(directory+'/result.json'),verify(receipt));
console.log(JSON.stringify({status:'PASS_CURRENT_DEVELOPMENT_PACKET_ONLY',sourceCommit:receipt.sourceCommit,sealedFiles:manifest.artifacts.length,failedAttemptsPreserved:failed.attempts.length,gate:receipt.boundary.gate,stageGate:receipt.boundary.stageGate,formalAccepted:false,runtimeAdmission:'DENIED',nextTask:'FE:FEP-8'},null,2));
