// Verify the immutable G0 confirmation, never approval of a later input inventory.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{validateUserConfirmation,bytesDigest}from'./user-acceptance-confirmation.mjs';
import{verify as verifyG0,wiring}from'./g0-current-functional-gate.mjs';
import{verifyBoundedOriginalSource}from'./bff-fe-006-confirmation.mjs';
export const originalPacket='6ade11bf';export const closureCommit='f7141e4b';export const directory='docs/audit/evidence/g0-confirmation-20261020';
export function verifyG0Confirmation(){
 const committed=(commit,p)=>execFileSync('git',['show',commit+':'+p],{maxBuffer:64*1024*1024}),read=p=>readFileSync(p),original='docs/audit/evidence/g0-local-20261020',raw=read(directory+'/confirmed-g0.json'),r=JSON.parse(raw),record=JSON.parse(read(directory+'/user-confirmation.json')),approval=JSON.parse(read(directory+'/approval.json'));
 assert.deepEqual(raw,committed(closureCommit,directory+'/confirmed-g0.json'));assert.equal(r.status,'READY');assert.equal(r.confirmationState.status,'CONFIRMED');assert.equal(record.documentCommit,execFileSync('git',['rev-parse',originalPacket],{encoding:'utf8'}).trim());
 for(const p of [record.document,record.approvedTechnicalManifest.path])assert.deepEqual(read(p),committed(originalPacket,p),'approved G0 artifact changed '+p);
 assert.equal(record.approvedTechnicalManifest.sha256,bytesDigest(read(record.approvedTechnicalManifest.path)));assert.equal(record.formalAccepted,false);assert.equal(record.runtimeAdmission,'DENIED');
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',inputsDigest:r.inputs.g0Request.scopeDigest,reviewDimensions:r.inputs.g0Request.reviewDimensions};const confirmation=validateUserConfirmation(approval,request);
 const ledger=committed(closureCommit,'docs/gate-records/G0-current-scope-confirmations.json');
 const result=verifyG0(r,{current:r.inputs,nodes:new Map([[r.nodeId,{...r.planInput}]]),sourceVerifier:verifyBoundedOriginalSource,ledger:r.ledgerReview,impactProof:r.impact,confirmationState:confirmation,readBytes:p=>p==='docs/gate-records/G0-current-scope-confirmations.json'?ledger:read(p),checkWiring:()=>wiring({readBytes:p=>committed(closureCommit,p)}),webVerifier:web=>assert.deepEqual(web.build,JSON.parse(read(r.artifacts[0].path)))});
 return{schema:'quantos-original-g0-confirmation-proof/v1',status:'CONFIRMED',originalEngineering:result,receiptCommit:execFileSync('git',['rev-parse',closureCommit],{encoding:'utf8'}).trim(),packetCommit:record.documentCommit,record:approval.record,recordSha256:approval.recordSha256,approvedSourceCommit:r.observedSourceCommit,scopeDigest:request.inputsDigest,legacyRemovalInOriginalScope:'PENDING',currentHeadAcceptance:'NOT_CLAIMED',formalAccepted:false,runtimeAdmission:'DENIED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(verifyG0Confirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
