// User approval binds the original immutable A3 draft and receipt, never later HEAD.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bytesDigest,validateUserConfirmation,reviewDimensions} from './user-acceptance-confirmation.mjs';
import {verifyOriginalSource} from './bff-fe-001-confirmation.mjs';
const base='docs/audit/evidence/bff-fe-006-confirmation-20261018/';
export const originalCommit='aeaef3f52210970af4efdf967b7092842f49efb2';
// Bound git batch memory without relaxing any original input or normative checks.
export function verifyBoundedOriginalSource(inputs,source){
 const sizes=execFileSync('git',['cat-file','--batch-check=%(objectsize)'],{input:inputs.inputs.map(i=>source+':'+i.path+'\n').join(''),encoding:'utf8',maxBuffer:1024*1024}).trim().split('\n').map(Number);
 let batch=[],bytes=0;
 for(let i=0;i<inputs.inputs.length;i++){assert(Number.isSafeInteger(sizes[i])&&sizes[i]>=0);if(bytes+sizes[i]>16*1024*1024&&batch.length){verifyOriginalSource({...inputs,inputs:batch,normative:[]},source);batch=[];bytes=0;}batch.push(inputs.inputs[i]);bytes+=sizes[i];}
 verifyOriginalSource({...inputs,inputs:batch},source);
}
export function verifyConfirmation({read=p=>readFileSync(p),committed=(p)=>execFileSync('git',['show',originalCommit+':'+p],{maxBuffer:64*1024*1024}),sourceVerifier=verifyBoundedOriginalSource}={}){
 const approval=JSON.parse(read(base+'approval.json')),record=JSON.parse(read(approval.record)),path='docs/audit/evidence/bff-fe-006-local-20261018/manifest.json',raw=committed(path),r=JSON.parse(raw);
 assert.deepEqual(read(path),raw,'approved receipt changed');assert.equal(r.nodeId,'FE:BFF-FE-006');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.equal(record.documentCommit,originalCommit);assert.deepEqual(read(record.document),committed(record.document),'original approved draft changed');assert.deepEqual(record.approvedTechnicalManifest,{path,sha256:bytesDigest(raw),commit:originalCommit});
 assert.equal(record.preflight.path,'docs/audit/evidence/bff-fe-004-local-20261018/preflight/bff006-before-change.json');const pre=read(record.preflight.path);assert.equal(bytesDigest(pre),record.preflight.sha256);const g=JSON.parse(pre);assert.equal(g.stageGate,'READY');assert.equal(g.observedSourceCommit,r.observedSourceCommit);
 for(const key of ['formalAccepted','releaseAccepted'])assert.equal(record[key],false);assert.equal(record.runtimeAdmission,'DENIED');assert.equal(record.scopeAdmission,'FUNCTION_ONLY');
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',sourceCommit:r.observedSourceCommit,inputsDigest:r.inputs.inputDigest,reviewDimensions};
 // Original FE006 draft has a bare request JSON block. Preserve its exact
 // committed bytes and adapt only in memory to the common draft validator.
 assert.equal(bytesDigest(read(approval.record)),approval.recordSha256);
 assert.equal(bytesDigest(read(record.document)),record.documentSha256);
 assert.equal(record.documentFormat,'IMMUTABLE_BARE_REQUEST_JSON');
 const doc=read(record.document).toString(),match=doc.match(/```json\s*([\s\S]*?)\s*```/);assert(match);assert.deepEqual(JSON.parse(match[1]),request);
 for(const dimension of reviewDimensions)assert(doc.includes(dimension+':')||doc.includes(dimension+'：'));
 const normalized=Buffer.from('```json\n'+JSON.stringify({schema:'quantos-acceptance-draft/v1',draftedBy:'Codex',mode:'AGENT_DRAFT_USER_CONFIRMATION',request,reviewDimensions})+'\n```');
 const normalizedRecord=Buffer.from(JSON.stringify({...record,documentSha256:bytesDigest(normalized)}));
 const result=validateUserConfirmation({...approval,recordSha256:bytesDigest(normalizedRecord)},request,p=>p===approval.record?normalizedRecord:p===record.document?normalized:read(p));
 return {...result,nodeId:r.nodeId,approvedSourceCommit:r.observedSourceCommit,approvedReceiptCommit:originalCommit,scopeAdmission:'FUNCTION_ONLY',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',upstreamAdmission:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(verifyConfirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
