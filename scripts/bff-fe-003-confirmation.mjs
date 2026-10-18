// User approval binds the original immutable BFF003 draft and receipt, never later HEAD.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bytesDigest,validateUserConfirmation,reviewDimensions} from './user-acceptance-confirmation.mjs';
import {verifyOriginalSource} from './bff-fe-001-confirmation.mjs';
const base='docs/audit/evidence/bff-fe-003-confirmation-20261018/';
export const originalCommit='963fd053adde41ad1568c98430a96b988a24e28c';
export function verifyConfirmation({read=p=>readFileSync(p),committed=(p)=>execFileSync('git',['show',originalCommit+':'+p],{maxBuffer:64*1024*1024}),sourceVerifier=verifyOriginalSource}={}){
 const approval=JSON.parse(read(base+'approval.json')),record=JSON.parse(read(approval.record)),path='docs/audit/evidence/bff-fe-003-local-20261018/manifest.json',raw=committed(path),r=JSON.parse(raw);
 assert.deepEqual(read(path),raw,'approved receipt changed');assert.equal(r.nodeId,'FE:BFF-FE-003');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.equal(record.documentCommit,originalCommit);assert.deepEqual(read(record.document),committed(record.document),'original approved draft changed');assert.deepEqual(record.approvedTechnicalManifest,{path,sha256:bytesDigest(raw),commit:originalCommit});
 assert.equal(record.preflight.path,'docs/audit/evidence/bff-fe-005-local-20261018/preflight/bff003-before-change.json');const pre=read(record.preflight.path);assert.equal(bytesDigest(pre),record.preflight.sha256);const g=JSON.parse(pre);assert.equal(g.stageGate,'READY');assert.equal(g.observedSourceCommit,r.observedSourceCommit);
 for(const key of ['formalAccepted','releaseAccepted'])assert.equal(record[key],false);assert.equal(record.runtimeAdmission,'DENIED');assert.equal(record.scopeAdmission,'FUNCTION_ONLY');
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',sourceCommit:r.observedSourceCommit,inputsDigest:r.inputs.inputDigest,reviewDimensions};
 return {...validateUserConfirmation(approval,request,read),nodeId:r.nodeId,approvedSourceCommit:r.observedSourceCommit,approvedReceiptCommit:originalCommit,scopeAdmission:'FUNCTION_ONLY',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',upstreamAdmission:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(verifyConfirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
