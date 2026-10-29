import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import console from 'node:console';
import {verify,files,hash,safe,directory,validateScope,preflight,failedHistory} from '../../../../scripts/core-x05-current-review.mjs';
const json=p=>JSON.parse(readFileSync(p));
const receipt=json(directory+'/receipt.json'),result=verify(receipt),manifest=json(directory+'/manifest.json');
assert.equal(manifest.schema,'quantos-core-x05-current-manifest/v1');
assert.equal(manifest.sourceCommit,receipt.sourceCommit);
assert.equal(manifest.scope,'CURRENT_OWNED_FUNCTION_ONLY_WITH_ORIGINAL_FAILURES');
assert.deepEqual(manifest.files.map(v=>v.path),files(directory).filter(p=>p!==directory+'/manifest.json'));
for(const f of manifest.files){safe(f.path);assert(f.path.startsWith(directory+'/'));assert.equal(hash(readFileSync(f.path)),f.sha256,f.path);}
assert.equal(preflight().files,52);assert.equal(preflight().failedLogs,5);
assert.equal(failedHistory().status,'FAIL_FINAL_VERIFICATION_BINARY_PROFILE_CHANGED');
assert.deepEqual(json(directory+'/result.json'),result);
assert.equal(json(directory+'/scope-summary.json').approval,null);
const handoff=json(directory+'/handoff.json');assert.equal(handoff.runtimeAdmission,'DENIED');assert.equal(handoff.next.nodeId,'CORE:X06');
validateScope(json('docs/execution/core-x05-current-scope.json'),{remainingGaps:handoff.remainingGaps,obligations:handoff.obligations});
assert.equal(json(directory+'/release-checklist.json').status,'NOT_RUN');
const scan=json(directory+'/seal-secret-scan.json');assert.equal(scan.unreviewedFindings,0);
for(const f of scan.inputs){safe(f.path);assert.equal(hash(readFileSync(f.path)),f.sha256);}
execFileSync('git',['merge-base','--is-ancestor',receipt.sourceCommit,'HEAD']);
console.log(JSON.stringify({status:'PASS_CURRENT_X05_OBSERVATION_RECONCILIATION_PACKET_ONLY',sourceCommit:receipt.sourceCommit,sealedFiles:manifest.files.length,checks:result.checks,rust:result.rustTotal,consumers:result.consumers,contracts:result.contracts,gates:result.nodeCases,chromium:result.chromiumCases,axeIncomplete:result.axeIncomplete,fullBooksReady:false,gate:result.gate,stageGate:result.stageGate,formalAccepted:false,runtimeAdmission:'DENIED',openGaps:19,openObligations:8,nextTask:'CORE:X06 DEVELOPMENT'}));
