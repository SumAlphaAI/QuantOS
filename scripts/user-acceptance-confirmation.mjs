import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
export const confirmationMode='AGENT_DRAFT_USER_CONFIRMATION';
export const reviewDimensions=['Product','Frontend','BFF','QA','Security','Risk'];
export const bytesDigest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
export function confirmationPolicy(){
 const p=JSON.parse(readFileSync(new URL('../docs/gate-records/acceptance-confirmation-policy.json',import.meta.url)));
 assert.equal(p.schema,'quantos-acceptance-confirmation-policy/v1');assert.equal(p.mode,confirmationMode);assert.equal(p.approver,'ProjectUser');assert.equal(p.draftedBy,'Codex');assert.equal(p.appliesTo,'ALL_PROJECT_ACCEPTANCE');assert.deepEqual(p.reviewDimensions,reviewDimensions);return p;
}
export function safeConfirmationPath(path){
 assert(typeof path==='string' && !path.includes('..') && !path.includes(':') && path.startsWith('docs/'),'confirmation file must be a repository document');
}
export function readConfirmationFile(path){
 safeConfirmationPath(path);
 const base=realpathSync(process.cwd());const file=realpathSync(resolve(base,path));assert(file.startsWith(base+sep),'confirmation file escapes repository');return readFileSync(file);
}
export function validateUserConfirmation(approval,request,readBytes=readConfirmationFile){
 confirmationPolicy();assert(approval?.record && approval?.recordSha256,'project user confirmation record required');
 safeConfirmationPath(approval.record);const raw=readBytes(approval.record);assert.equal(bytesDigest(raw),approval.recordSha256,'user confirmation record changed');const r=JSON.parse(raw);
 assert.equal(r.schema,'quantos-user-acceptance-confirmation/v1');assert.equal(r.mode,confirmationMode);assert.equal(r.decision,'CONFIRMED');assert.equal(r.approver,'ProjectUser');assert(r.identity?.trim(),'user identity required');
 assert.deepEqual(r.request,request,'user confirmation scope changed');assert(Number.isFinite(Date.parse(r.confirmedAt)) && Date.parse(r.confirmedAt)>Date.parse('2026-10-05T00:00:00+08:00') && Date.parse(r.confirmedAt)<=Date.now(),'current user confirmation timestamp required');
 assert.equal(r.confirmationSource?.kind,'USER_MESSAGE');assert(r.confirmationSource.text?.trim(),'actual user confirmation message required');
 assert(r.document && r.documentSha256,'agent drafted confirmation document required');safeConfirmationPath(r.document);const doc=readBytes(r.document);assert.equal(bytesDigest(doc),r.documentSha256,'confirmation document changed');
 const match=doc.toString().match(/```json\s*([\s\S]*?)\s*```/);assert(match,'confirmation document request missing');const draft=JSON.parse(match[1]);assert.equal(draft.schema,'quantos-acceptance-draft/v1');assert.equal(draft.draftedBy,'Codex');assert.equal(draft.mode,confirmationMode);assert.deepEqual(draft.request,request,'draft scope changed');
 assert.deepEqual(draft.reviewDimensions,request.reviewDimensions,'confirmation review dimensions missing');
 return {status:'CONFIRMED',approver:'ProjectUser'};
}
