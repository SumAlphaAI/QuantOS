import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesDigest, confirmationMode, reviewDimensions, validateUserConfirmation } from './user-acceptance-confirmation.mjs';
function fixture(){
 const request={nodeId:'FRONTEND-GATE:G0',stage:'DEVELOPMENT',inputsDigest:bytesDigest('unit scope'),reviewDimensions};
 const document='docs/gate-records/unit-draft.md',record='docs/gate-records/unit-record.json';const draft={schema:'quantos-acceptance-draft/v1',mode:confirmationMode,draftedBy:'Codex',request,reviewDimensions};
 const text='```json\n'+JSON.stringify(draft)+'\n```';
 const r={schema:'quantos-user-acceptance-confirmation/v1',mode:confirmationMode,decision:'CONFIRMED',approver:'ProjectUser',identity:'unit fixture; not human approval',request,confirmedAt:new Date().toISOString(),confirmationSource:{kind:'USER_MESSAGE',text:'Unit test: confirm this exact document'},document,documentSha256:bytesDigest(text)};
 const files=new Map([[document,text]]);const approval={record};const store=()=>{const raw=JSON.stringify(r);files.set(record,raw);approval.recordSha256=bytesDigest(raw);};store();return {request,draft,r,text,files,approval,store,validate:()=>validateUserConfirmation(approval,request,path=>files.get(path))};
}
test('one current user confirmation validates all documented review dimensions',()=>assert.equal(fixture().validate().status,'CONFIRMED'));
for(const [name,change,pattern] of [
 ['assistant self-approval',f=>f.r.approver='Codex',/ProjectUser/],
 ['unconfirmed draft',f=>f.r.decision='PENDING',/CONFIRMED/],
 ['workflow instruction alone',f=>f.r.confirmationSource.kind='WORKFLOW_CHANGE',/USER_MESSAGE/],
 ['missing user message',f=>f.r.confirmationSource.text='',/actual user/],
 ['missing identity',f=>f.r.identity='',/identity/],
 ['old historical confirmation',f=>f.r.confirmedAt='2026-08-14T00:00:00Z',/timestamp/],
 ['future confirmation',f=>f.r.confirmedAt='2099-01-01T00:00:00Z',/timestamp/],
 ['wrong node',f=>f.r.request={...f.request,nodeId:'OTHER'},/scope changed/],
 ['wrong stage',f=>f.r.request={...f.request,stage:'RELEASE'},/scope changed/],
 ['wrong input digest',f=>f.r.request={...f.request,inputsDigest:bytesDigest('changed')},/scope changed/],
 ['wrong draft path',f=>f.r.document='/tmp/draft.md',/repository document/],
 ['parent traversal',f=>f.r.document='docs/../draft.md',/repository document/],
 ['wrong document hash',f=>f.r.documentSha256=bytesDigest('changed'),/document changed/],
])test(`user confirmation rejects ${name}`,()=>{const f=fixture();change(f);f.store();assert.throws(f.validate,pattern);});
test('changed original user record is rejected even with unchanged scope',()=>{const f=fixture();f.files.set(f.approval.record,'tampered');assert.throws(f.validate,/record changed/);});
test('rehashing a draft cannot authorize a different scope',()=>{const f=fixture();f.draft.request={...f.request,stage:'RELEASE'};const text='```json\n'+JSON.stringify(f.draft)+'\n```';f.files.set(f.r.document,text);f.r.documentSha256=bytesDigest(text);f.store();assert.throws(f.validate,/draft scope changed/);});
test('draft must retain every review dimension even with updated document hash',()=>{const f=fixture();f.draft.reviewDimensions=reviewDimensions.slice(1);const text='```json\n'+JSON.stringify(f.draft)+'\n```';f.files.set(f.r.document,text);f.r.documentSha256=bytesDigest(text);f.store();assert.throws(f.validate,/review dimensions missing/);});
