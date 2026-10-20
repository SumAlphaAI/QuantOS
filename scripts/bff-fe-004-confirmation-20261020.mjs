// Human approval of the immutable 2026-10-19 FE004 draft, not the current tree.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bytesDigest, validateUserConfirmation, reviewDimensions} from './user-acceptance-confirmation.mjs';
import {verifyBoundedOriginalSource} from './bff-fe-006-confirmation.mjs';
export const originalCommit='787f8230615b2741d796c84928f42a5894afe3b4';
export const base='docs/audit/evidence/bff-fe-004-confirmation-20261020/';
export function verifyConfirmation({read=p=>readFileSync(p),committed=p=>execFileSync('git',['show',originalCommit+':'+p],{maxBuffer:64*1024*1024}),sourceVerifier=verifyBoundedOriginalSource}={}) {
 const approval=JSON.parse(read(base+'approval.json')),record=JSON.parse(read(approval.record));
 const path='docs/audit/evidence/bff-fe-004-local-20261019/manifest.json',raw=committed(path),r=JSON.parse(raw);
 assert.equal(bytesDigest(read(path)),bytesDigest(raw),'original approved receipt changed');
 assert.equal(r.nodeId,'FE:BFF-FE-004');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);assert.equal(r.runtimeAdmission,'DENIED');
 assert.equal(record.documentCommit,originalCommit);assert.equal(record.document,'docs/audit/evidence/bff-fe-004-local-20261019/confirmation-draft.md');
 assert.equal(bytesDigest(read(record.document)),bytesDigest(committed(record.document)),'original approved draft changed');
 assert.deepEqual(record.approvedTechnicalManifest,{path,sha256:bytesDigest(raw),commit:originalCommit});
 assert.equal(record.scopeAdmission,'FUNCTION_ONLY');assert.equal(record.formalAccepted,false);assert.equal(record.releaseAccepted,false);assert.equal(record.runtimeAdmission,'DENIED');
 sourceVerifier(r.inputs,r.observedSourceCommit);
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',sourceCommit:r.observedSourceCommit,inputsDigest:r.inputs.inputDigest,reviewDimensions};
 return {...validateUserConfirmation(approval,request,read),nodeId:r.nodeId,approvedSourceCommit:r.observedSourceCommit,approvedReceiptCommit:originalCommit,scopeAdmission:'FUNCTION_ONLY',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',upstreamAdmission:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(verifyConfirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
