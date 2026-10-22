import assert from 'node:assert/strict';
import test from 'node:test';
import {Buffer} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateRecord,validatePlanText,requiredBoundary,directory,original,plan,packet,confirmationLine,verify} from './ui-p05-confirmed-reference.mjs';
import {hash} from './ui507-review.mjs';
const read=p=>readFileSync(p),record=JSON.parse(read(directory+'/user-confirmation.json')),request=JSON.parse(read(original+'/scope.json')).request;
function fixture(change=()=>{},overrides=new Map()) {const r=JSON.parse(JSON.stringify(record));change(r);const raw=Buffer.from(JSON.stringify(r)),approval={record:directory+'/user-confirmation.json',recordSha256:hash(raw)};return{approval,reader:path=>path===approval.record?raw:overrides.get(path)??read(path)};}
test('actual human confirmation is exact and scope-bound',()=>{const f=fixture();assert.deepEqual(validateRecord(f.approval,request,f.reader),{status:'CONFIRMED',approver:'ProjectUser'});});
for(const[k,value]of Object.entries(requiredBoundary)){const bad=typeof value==='boolean'?!value:'INVALID_PROMOTION';test('refuse changed boundary '+k,()=>{const f=fixture(r=>{r[k]=bad;});assert.throws(()=>validateRecord(f.approval,request,f.reader));});}
for(const[name,change]of [['other candidate',r=>r.request.sourceCommit='a'.repeat(40)],['request digest',r=>r.request.inputsDigest='sha256:'+'0'.repeat(64)],['wrong identity',r=>r.approver='Codex'],['not confirmed',r=>r.decision='PENDING'],['future timestamp',r=>r.confirmedAt='2099-01-01T00:00:00Z'],['different draft hash',r=>r.documentSha256='sha256:'+'0'.repeat(64)],['other packet',r=>r.documentCommit='b'.repeat(40)],['different manifest',r=>r.approvedTechnicalManifest.sha256='sha256:'+'0'.repeat(64)],['raw answer changed',r=>r.confirmationSource.text+=' approve release'],['NOT_RUN rewritten',r=>r.historicalBoundaries.value.additionalNotRun.fullUnsubstitutedIdentityJourney='PASS']])test('refuse '+name,()=>{const f=fixture(change);assert.throws(()=>validateRecord(f.approval,request,f.reader));});
test('refuse record hash tamper',()=>{const f=fixture();f.approval.recordSha256='sha256:'+'0'.repeat(64);assert.throws(()=>validateRecord(f.approval,request,f.reader));});
test('refuse raw message file tamper',()=>{const f=fixture(()=>{},new Map([[directory+'/raw-user-message.txt',Buffer.from('confirmed')]]));assert.throws(()=>validateRecord(f.approval,request,f.reader));});
const before=execFileSync('git',['show',packet+':'+plan],{encoding:'utf8',maxBuffer:16e6}),after=read(plan).toString();
test('only UI-P05 completion and bounded confirmation metadata change',()=>validatePlanText(before,after));
for(const[name,mutate]of [['stage promotion',s=>s.replace('"status":"NOT_ASSESSED"','"status":"READY"')],['confirmation marker removed',s=>s.replace(confirmationLine+'\n','')],['other task altered',s=>s+'\nUnrelated task change\n'],['completion removed',s=>{const start=s.indexOf('<a id="task-ui-p05"></a>');return s.slice(0,start)+s.slice(start).replace('- development_status: `COMPLETED`','- development_status: `UNSPECIFIED`');}]])test('reject plan '+name,()=>assert.throws(()=>validatePlanText(before,mutate(after))));
test('original evidence preserved with all 159 stages unpromoted and next task allowed',()=>{const p=verify();assert.equal(p.originalInputs,539);assert.equal(p.preservedStageGates,159);assert.equal(p.originalTests.reexecuted,false);assert.equal(p.nextTask,'FE:UI-201');assert.equal(p.formalAccepted,false);});

for(const[name,change]of [
 ['remove retained axe report',r=>r.retainedAxe.pop()],
 ['drop incomplete entry',r=>r.retainedAxe[0].scans[0].incomplete=0],
 ['rename incomplete rule',r=>r.retainedAxe[0].scans[0].incompleteRuleIds=['accepted']],
 ['lose original icon nodes',r=>r.retainedAxe[0].scans[0].incompleteNodeCount=0],
 ['rebind original axe candidate',r=>r.retainedAxe[0].sourceCommit='b'.repeat(40)],
 ['replace original axe hash',r=>r.retainedAxe[0].sha256='sha256:'+'0'.repeat(64)]
])test('refuse '+name,()=>{const f=fixture(change);assert.throws(()=>validateRecord(f.approval,request,f.reader));});
