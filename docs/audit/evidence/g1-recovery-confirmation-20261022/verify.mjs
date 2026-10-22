// Record the user's bounded confirmation; do not rerun functionality or admit G1.
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {verify, validateBoundary, notRun} from '../../../../scripts/g1-recovery-review.mjs';
import {verifyInputs} from '../../../../scripts/g1-download-review.mjs';
import {validateUserConfirmation, bytesDigest} from '../../../../scripts/user-acceptance-confirmation.mjs';
import {nodesFromPlans, planInput} from '../../../../scripts/provider-a1-receipts.mjs';
const directory='docs/audit/evidence/g1-recovery-confirmation-20261022';
const original='docs/audit/evidence/g1-recovery-local-20261022';
const sourceCommit='75451b08bf97f3b85d49d6f9eca9da23975e974a';
const sourcePacket='2369d204cce05948dc71420a26a56311348f851e';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const committed=path=>execFileSync('git',['show',sourcePacket+':'+path],{maxBuffer:32e6});
const approval=json(directory+'/approval.json'),record=json(approval.record),receipt=json(original+'/receipt.json');
const request=json(original+'/confirmation-request.json');
const expectedText="确认 G1-REC-01 本轮完整确认稿，范围绑定工程 SHA 75451b08，保留 Firefox、WebKit 阻塞及全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。";
const omitted=Object.fromEntries(notRun.map(k=>[k,receipt[k]]));
function scopedRecord(r){
 assert.equal(r.request.sourceCommit,sourceCommit);assert.deepEqual(r.request,request);assert.deepEqual(r.confirmedTaskIds,['G1-REC-01']);assert.equal(r.scopeAdmission,'G1_ROUTE_RECOVERY_ORIGINAL_REFERENCE_ONLY');assert.equal(r.integrationAdmission,'NOT_GRANTED');assert.equal(r.releaseAdmission,'NOT_GRANTED');assert.equal(r.g1Gate,'NOT_READY_GAPS_OPEN');assert.equal(r.fep1Gate,'NOT_READY_GAPS_OPEN');assert.equal(r.stageGate,'NOT_ASSESSED');assert.equal(r.formalAccepted,false);assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.currentHeadAcceptance,'NOT_CLAIMED');assert.equal(r.firefoxBrowser,'BLOCKED_ENVIRONMENT');assert.equal(r.webKitAttachmentBrowser,'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION');assert.deepEqual(r.notRun,omitted);assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,sourcePacket);assert.deepEqual(r.approvedTechnicalManifest,{path:original+'/manifest.json',sha256:bytesDigest(committed(original+'/manifest.json')),commit:sourcePacket});assert.deepEqual(r.historicalBoundaries,{path:original+'/retained-boundaries.json',sha256:bytesDigest(committed(original+'/retained-boundaries.json'))});
 assert.equal(r.confirmationSource.text,expectedText);assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(read(r.confirmationSource.rawRecord).toString(),expectedText);
}
function currentPacketPaths(path=original){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?currentPacketPaths(path+'/'+e.name):[path+'/'+e.name]).sort();}
scopedRecord(record);
const confirmation=validateUserConfirmation(approval,request);
const index=json(original+'/manifest.json');assert.deepEqual(read(original+'/manifest.json'),committed(original+'/manifest.json'));verifyInputs(sourcePacket,index.files);
const mutablePlan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
for(const a of index.files){assert(!a.path.includes('..'));if(a.path!==mutablePlan)assert.equal(bytesDigest(read(a.path)),a.sha256,'original evidence drift '+a.path);}
assert.deepEqual(read(record.document),committed(record.document));assert.deepEqual(read(original+'/receipt.json'),committed(original+'/receipt.json'));assert.equal(receipt.confirmation,'PENDING');
const scope=json(original+'/scope.json');assert.equal(scope.inputsDigest,request.inputsDigest);assert.equal(scope.payload.sourceCommit,sourceCommit);assert.deepEqual(scope.payload.taskIds,record.confirmedTaskIds);
const originalEngineering=verify(receipt);
assert.equal(index.files.length,195);assert.equal(receipt.inputs.length,591);
assert.equal(scope.inputsDigest,bytesDigest(JSON.stringify(scope.payload)));
const scopeSummary=json(directory+'/scope-summary.json');assert.equal(scopeSummary.sourceCommit,sourceCommit);assert.equal(scopeSummary.sourcePacket,sourcePacket);assert.deepEqual(scopeSummary.request,request);assert.equal(scopeSummary.scope,record.scopeAdmission);assert.equal(scopeSummary.scopeSummary,record.scopeSummary);assert.deepEqual(scopeSummary.notRun,omitted);assert.equal(scopeSummary.confirmation,'CONFIRMED');
assert.deepEqual(currentPacketPaths(),index.files.filter(a=>a.path.startsWith(original+'/')).map(a=>a.path).concat(original+'/manifest.json').sort());
const plans=['docs/SumAlpha-QuantOS-Development-Plan.md',mutablePlan];
const before=nodesFromPlans(plans.map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,before.size);
for(const [id,node]of now){const prior=before.get(id);assert.deepEqual(node.stage_gate,prior.stage_gate,id+' stage changed');assert.deepEqual(planInput(node),planInput(prior),id+' requirements changed');assert.equal(node.development_status,prior.development_status,id+' implementation state changed');}
assert.equal(now.get('FRONTEND-GATE:G1').review_status,'CHANGES_REQUESTED');assert.equal(now.get('FE:UI-P15').development_status,'IMPLEMENTED_PENDING_ACCEPTANCE');
const previous=json(original+'/remediation-status.json'),current=json(directory+'/remediation-status.json');
assert.equal(current.confirmation,'CONFIRMED_ORIGINAL_REFERENCE_SCOPE_ONLY');assert.equal(current.confirmationRecord,approval.record);assert.equal(current.localReferenceTasksVerified,3);assert.equal(current.otherObligationsRetained,5);assert.equal(current.g1Gate,'NOT_READY_GAPS_OPEN');assert.equal(current.stageGate,'NOT_ASSESSED');assert.equal(current.actions.length,previous.actions.length);assert.deepEqual(current.priorStatus,{path:original+'/remediation-status.json',sha256:bytesDigest(read(original+'/remediation-status.json')),commit:sourcePacket});assert.deepEqual(current.nextExecutable,previous.nextExecutable);
for(const [i,a]of current.actions.entries()){const old=previous.actions[i];if(record.confirmedTaskIds.includes(a.id)){assert.deepEqual(a,{...old,confirmation:'CONFIRMED',confirmationRecord:approval.record});}else assert.deepEqual(a,old,'unrelated obligation changed');}
const negatives=[];
function refuse(name,fn){assert.throws(fn,name);negatives.push(name);}
refuse('missing user approval',()=>validateUserConfirmation({},request));
refuse('wrong record hash',()=>validateUserConfirmation({...approval,recordSha256:bytesDigest('wrong')},request));
for(const [k,v]of Object.entries({sourceCommit:sourcePacket,inputsDigest:bytesDigest('wrong'),nodeId:'FE:FEP-1'}))refuse('substituted confirmation request '+k,()=>validateUserConfirmation(approval,{...request,[k]:v}));
for(const [k,v]of Object.entries({approver:'Codex',documentSha256:bytesDigest('wrong'),confirmationSource:{kind:'AGENT',text:expectedText}})){
 const changed=Buffer.from(JSON.stringify({...record,[k]:v}));refuse('substituted record '+k,()=>validateUserConfirmation({...approval,recordSha256:bytesDigest(changed)},request,p=>p===approval.record?changed:read(p)));
}
for(const [k,v]of Object.entries({confirmedTaskIds:['FRONTEND-GATE:G1'],scopeAdmission:'FULL_G1',integrationAdmission:'GRANTED',releaseAdmission:'GRANTED',g1Gate:'READY',fep1Gate:'READY',stageGate:'READY',formalAccepted:true,runtimeAdmission:'ALLOWED',currentHeadAcceptance:'ACCEPTED',firefoxBrowser:'PASS',webKitAttachmentBrowser:'PASS',documentCommit:sourceCommit,historicalBoundaries:{path:'wrong',sha256:bytesDigest('wrong')}}))refuse('scope promotion '+k,()=>scopedRecord({...record,[k]:v}));
for(const key of notRun)refuse('omitted check promotion '+key,()=>scopedRecord({...record,notRun:{...omitted,[key]:'PASS'}}));
refuse('rewrite original pending receipt',()=>validateBoundary({...receipt,confirmation:'CONFIRMED'}));
const proof={schema:'quantos-g1-recovery-confirmation-closure/v1',sourceCommit,sourcePacket,confirmedTaskIds:record.confirmedTaskIds,confirmation,approval,originalEngineering,originalDraftSha256:bytesDigest(read(record.document)),originalReceiptSha256:bytesDigest(read(original+'/receipt.json')),originalManifestSha256:bytesDigest(read(original+'/manifest.json')),preservedManifestEntries:index.files.length,preservedSourceInputs:receipt.inputs.length,preservedPlanStageGates:now.size,gateSha256:bytesDigest(read(fileURLToPath(import.meta.url))),negativeProbes:negatives,originalPacketPending:'PENDING',scopeAdmission:record.scopeAdmission,g1Gate:record.g1Gate,fep1Gate:record.fep1Gate,stageGate:record.stageGate,firefoxBrowser:record.firefoxBrowser,webKitAttachmentBrowser:record.webKitAttachmentBrowser,notRun:omitted,historicalBoundaries:record.historicalBoundaries,otherObligationsRetained:5,p15Confirmation:'PENDING',integrationAdmission:'NOT_GRANTED',releaseAdmission:'NOT_GRANTED',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',functionalTestsRerun:false,recursiveDependencyRevalidation:false};
if(process.argv[2]==='--record')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else{assert.equal(process.argv[2],'--verify');assert.deepEqual(json(directory+'/closure-proof.json'),proof);}
console.log(JSON.stringify({confirmation:confirmation.status,sourceCommit,sourcePacket,engineering:originalEngineering.engineeringGate,preservedManifestEntries:index.files.length,preservedSourceInputs:receipt.inputs.length,preservedPlanStageGates:now.size,negativeProbes:negatives.length,g1Gate:proof.g1Gate,fep1Gate:proof.fep1Gate,stageGate:proof.stageGate,firefoxBrowser:proof.firefoxBrowser,webKitAttachmentBrowser:proof.webKitAttachmentBrowser,formalAccepted:false,runtimeAdmission:'DENIED',functionalTestsRerun:false}));
