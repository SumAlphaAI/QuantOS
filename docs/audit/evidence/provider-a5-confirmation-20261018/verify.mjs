// Current user confirmation binds the original immutable A5 draft/source/receipt only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bytesDigest,validateUserConfirmation,reviewDimensions} from '../../../../scripts/user-acceptance-confirmation.mjs';
import {verifyBoundedOriginalSource} from '../../../../scripts/bff-fe-006-confirmation.mjs';
const base='docs/audit/evidence/provider-a5-confirmation-20261018/';
export const originalCommit='e41e65fda773c85d4e9734e0111eff9eb6188d8e';
export function verifyConfirmation({read=p=>readFileSync(p),committed=(p)=>execFileSync('git',['show',originalCommit+':'+p],{maxBuffer:64*1024*1024}),sourceVerifier=verifyBoundedOriginalSource}={}){
 const approval=JSON.parse(read(base+'approval.json')),record=JSON.parse(read(approval.record)),path='docs/audit/evidence/provider-a5-local-20261018/manifest.json',raw=committed(path),r=JSON.parse(raw);
 assert.deepEqual(read(path),raw,'approved receipt changed');assert.equal(r.nodeId,'PROVIDER:A5');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.equal(record.documentCommit,originalCommit);assert.deepEqual(read(record.document),committed(record.document),'original approved draft changed');assert.deepEqual(record.approvedTechnicalManifest,{path,sha256:bytesDigest(raw),commit:originalCommit});
 assert.equal(record.preflight.path,'docs/audit/evidence/provider-a5-confirmation-20261018/preflight-gate.json');const pre=read(record.preflight.path);assert.equal(bytesDigest(pre),record.preflight.sha256);const g=JSON.parse(pre);assert.equal(g.stageGate,'READY');assert.equal(g.observedSourceCommit,r.observedSourceCommit);
 for(const key of ['formalAccepted','releaseAccepted'])assert.equal(record[key],false);assert.equal(record.runtimeAdmission,'DENIED');assert.equal(record.scopeAdmission,'FUNCTION_ONLY');
 assert.equal(record.document,'docs/audit/evidence/provider-a5-local-20261018/confirmation-draft.md');
 assert.equal(record.confirmationSource.text,'确认 PROVIDER:A5 完整确认稿');
 assert.notEqual(record.upstreamAccepted,true);assert.notEqual(record.currentHeadAcceptance,'ACCEPTED');
 // Preserve the original immutable technical package and eight activated entries.
 const indexPath='docs/audit/evidence/provider-a5-local-20261018/evidence-index.json',indexRaw=committed(indexPath);
 assert.deepEqual(read(indexPath),indexRaw);const index=JSON.parse(indexRaw);assert.equal(index.sourceCommit,r.observedSourceCommit);
 for(const e of index.entries){const bytes=read(e.path);assert.equal(bytes.length,e.bytes);assert.equal(bytesDigest(bytes),e.sha256,e.path);}
 const entries=JSON.parse(read(r.attempt+'/entrypoints/results.json'));assert.equal(entries.length,8);
 for(const e of entries){assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(bytesDigest(read(e.log)),e.logSha256);}
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',sourceCommit:r.observedSourceCommit,inputsDigest:r.inputs.inputDigest,reviewDimensions};
 return {...validateUserConfirmation(approval,request,read),nodeId:r.nodeId,approvedSourceCommit:r.observedSourceCommit,approvedReceiptCommit:originalCommit,scopeAdmission:'FUNCTION_ONLY',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',upstreamAdmission:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(verifyConfirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
