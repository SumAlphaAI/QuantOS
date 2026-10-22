import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync, writeFileSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {nodesFromPlans, planInput} from '../../../../scripts/provider-a1-receipts.mjs';
import {validateUserConfirmation, validateCommittedProseConfirmation} from '../../../../scripts/user-acceptance-confirmation.mjs';
export const directory='docs/audit/evidence/frontend-g1-gap-20261022';
export const sourceCommit='2ccceeffe290611ddd75ee22fe5ce56e06909f21';
export const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(path), json=path=>JSON.parse(read(path));
const plans=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
export const preservedNotRun=['realIdpMfa','targetBffDatabase','realCookieCors','manualScreenReader','nativeZoom200','crossOSVisual','remoteCI','performanceAndSoak','releaseAcceptance','nativeNotificationDelivery','persistentTargetRevocation','idpEnrollmentRecovery','targetHeadersPrivacy','actualReferenceDownloadDelivery','realDeviceMatrix','webKitInterceptedAttachmentReceipt','completeG1BusinessJourney','completeFep1Composition','targetDatabaseWritabilityRecheck'];
const committed=(ref,path)=>execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:64e6});
export function validateBoundary(r){
 assert.equal(r.schema,'quantos-frontend-g1-gap-assessment/v1');assert.equal(r.sourceCommit,sourceCommit);assert.equal(r.auditStatus,'PASS_GAP_ACCOUNTING_ONLY');assert.equal(r.g1Gate,'NOT_READY_GAPS_OPEN');assert.equal(r.fep1Gate,'NOT_READY_GAPS_OPEN');assert.equal(r.stageGate,'NOT_ASSESSED');assert.equal(r.formalAccepted,false);assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.currentHeadAcceptance,'NOT_CLAIMED');assert.equal(r.recursiveDependencyRevalidation,false);assert.equal(r.g1UserAcceptance,'NOT_REQUESTED_GAP_AUDIT_ONLY');assert.equal(r.firefoxBrowser,'BLOCKED_ENVIRONMENT');assert.equal(r.webKitAttachmentBrowser,'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION');for(const key of preservedNotRun)assert.equal(r[key],'NOT_RUN');
}
export function verifySource(ref,inputs){
 const result=spawnSync('git',['cat-file','--batch'],{input:inputs.map(e=>`${ref}:${e.path}\n`).join(''),maxBuffer:64e6});assert.equal(result.status,0);const bytes=result.stdout;let cursor=0;
 for(const e of inputs){const end=bytes.indexOf(10,cursor);assert(end>=0);const header=bytes.subarray(cursor,end).toString();const parts=header.split(' ');assert.equal(parts[1],'blob','missing source '+ref+':'+e.path);const size=Number(parts[2]);assert(Number.isSafeInteger(size)&&size>=0);const start=end+1;assert.equal(hash(bytes.subarray(start,start+size)),e.sha256,'source drift '+ref+':'+e.path);assert.equal(bytes[start+size],10);cursor=start+size+1;}assert.equal(cursor,bytes.length);
}
export function inventory(){
 const before=nodesFromPlans(plans.map(path=>committed(sourceCommit,path).toString())),now=nodesFromPlans();assert.equal(now.size,before.size);
 for(const [id,n]of now){assert.deepEqual(n.stage_gate,before.get(id).stage_gate,'stage changed '+id);assert.deepEqual(planInput(n),planInput(before.get(id)),'requirements changed '+id);assert.equal(n.development_status,before.get(id).development_status,'development state changed '+id);}
 const g=now.get('FRONTEND-GATE:G1'),f=now.get('FE:FEP-1');assert.equal(g.dependencies.length,13);assert.equal(f.dependencies.length,26);
 const union=[...new Set([...g.dependencies,...f.dependencies])];assert.equal(union.length,27);
 const confirmations=new Map();
 for(const entry of readdirSync('docs/audit/evidence',{withFileTypes:true})){if(!entry.isDirectory())continue;const path=`docs/audit/evidence/${entry.name}/user-confirmation.json`;if(!existsSync(path))continue;const r=json(path),id=r.request?.nodeId;if(!union.includes(id)&&id!=='FRONTEND-GATE:G0')continue;const old=confirmations.get(id);if(!old||Date.parse(r.confirmedAt)>Date.parse(old.record.confirmedAt))confirmations.set(id,{path,record:r});}
 const confirmationRows=[];
 for(const [id,{path,record:r}]of confirmations){
  const approvalPath=path.replace('user-confirmation.json','approval.json'),approval=json(approvalPath);assert.equal(approval.record,path);
  const result=r.documentFormat==='IMMUTABLE_COMMITTED_PROSE'?validateCommittedProseConfirmation(approval,r.request,{committedBytes:committed}):validateUserConfirmation(approval,r.request);
  if(r.documentCommit)assert.deepEqual(read(r.document),committed(r.documentCommit,r.document));
  if(r.approvedTechnicalManifest){const m=r.approvedTechnicalManifest;assert.equal(hash(read(m.path)),m.sha256);assert.deepEqual(read(m.path),committed(m.commit,m.path));}
  confirmationRows.push({nodeId:id,record:path,recordSha256:hash(read(path)),document:r.document,documentSha256:r.documentSha256,sourceCommit:r.request.sourceCommit??r.approvedSourceCommit??null,documentCommit:r.documentCommit??null,status:result.status,admission:'ORIGINAL_SCOPE_ONLY',currentReady:'NOT_CLAIMED'});
 }
 assert.equal(confirmationRows.filter(r=>g.dependencies.includes(r.nodeId)&&r.nodeId.startsWith('FE:')).length,9);assert.equal(confirmations.has('FE:UI-P15'),false);assert.equal(confirmationRows.length,22);
 const pageReceipts=[];
 for(const name of ['ui-103','ui-vis-000','ui-102','ui-101','ui-104','web-101','ui-p01','ui-p02','ui-p15','ui-p17']){
  const base=`docs/audit/evidence/${name}-local-${name.startsWith('ui-p')?'20261022':'20261021'}`,path=base+'/receipt.json',r=json(path);assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');assert.equal(r.confirmation,'PENDING');assert.equal(hash(JSON.stringify(r.snapshot)),r.inputDigest);
  const packet=execFileSync('git',['log','-1','--format=%H','--',path],{encoding:'utf8'}).trim();assert.match(packet,/^[a-f0-9]{40}$/);assert.deepEqual(read(path),committed(packet,path));assert.deepEqual(read(base+'/confirmation-draft.md'),committed(packet,base+'/confirmation-draft.md'));
  verifySource(r.sourceCommit,r.snapshot.inputs);
  assert.equal(r.executions.length,r.snapshot.checks.length);
  for(const [i,e]of r.executions.entries()){const [id,cmd]=r.snapshot.checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,cmd.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);}
  for(const a of r.artifacts)assert.equal(hash(read(a.path)),a.sha256,'artifact changed '+a.path);
  const changed=r.snapshot.inputs.filter(e=>!existsSync(e.path)||hash(read(e.path))!==e.sha256).map(e=>e.path);
  const indexPath=base+'/evidence-index.json';let indexed=0;if(existsSync(indexPath)){const idx=json(indexPath);assert.deepEqual(read(indexPath),committed(packet,indexPath));for(const a of idx.files){assert(a.path.startsWith(base+'/')&&!a.path.includes('..'));assert.equal(hash(read(a.path)),a.sha256,'history changed '+a.path);indexed++;}}
  pageReceipts.push({nodeId:r.nodeId,path,packetCommit:packet,sourceCommit:r.sourceCommit,inputDigest:r.inputDigest,sourceInputsVerified:r.snapshot.inputs.length,historicalExecutions:r.executions.length,historicalArtifacts:r.artifacts.length,fullHistoryIndexFilesVerified:indexed,historicalEngineering:'PASS_ORIGINAL_SCOPE',firefoxBrowser:r.firefoxBrowser??'NOT_RECORDED_IN_THIS_PACKET',webKitAttachmentBrowser:r.webKitAttachmentBrowser??'NOT_RECORDED_IN_THIS_PACKET',liveStream:r.liveSettingsStream??r.liveCommandStream??'NOT_RECORDED_IN_THIS_PACKET',toolRepair:r.toolRepair??null,humanConfirmation:confirmations.has(r.nodeId)?'CONFIRMED_ORIGINAL_SCOPE':'PENDING',changedExistingInputs:changed,currentApplicability:changed.length?'INPUT_DRIFT_NOT_CURRENT_ACCEPTANCE':'INPUT_IDENTICAL_REFERENCE_ONLY',additionalNewInputsAssessment:'NOT_A_CURRENT_GATE_REVALIDATION',notRun:Object.fromEntries(Object.entries(r).filter(([,v])=>v==='NOT_RUN')),stageGate:'NOT_ASSESSED'});
 }
 const rows=union.map(id=>{const n=now.get(id);return{nodeId:id,g1Direct:g.dependencies.includes(id),fep1Direct:f.dependencies.includes(id),developmentStatus:n.development_status??null,stageGate:n.stage_gate,confirmation:confirmations.has(id)?'CONFIRMED_ORIGINAL_SCOPE':id==='FE:UI-P15'?'PENDING':'NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT',humanRecord:confirmations.get(id)?.path??null,currentReady:'NOT_CLAIMED'};});
 return{schema:'quantos-frontend-g1-dependency-audit/v1',sourceCommit,g1DirectCount:13,fep1DirectCount:26,uniqueDirectReferences:27,planNodes:now.size,stageGatesUnchanged:true,dependencyRows:rows,confirmationRows:confirmationRows.sort((a,b)=>a.nodeId.localeCompare(b.nodeId)),pageReceipts,allHistoricalResultsRemainSourceBound:true,recursiveDependencyRevalidation:false};
}
export function validateProbe(r){
 assert.equal(r.mode,'LOOPBACK_REFERENCE_IN_MEMORY');assert.equal(r.responseForwarding,'BYTE_FOR_BYTE_NO_URL_REWRITE');assert.equal(r.sensitiveResponses,'HASH_ONLY');assert.equal(r.targetDatabase,'NOT_RUN');assert.equal(r.realIdp,'NOT_RUN');assert.equal(r.endToEndAttachment,'NOT_RUN');assert.deepEqual(r.outcomes.map(v=>v.id),['reference-lease','viewer-history','invalid-session','same-origin-template','split-origin-template']);for(const o of r.outcomes)assert.equal(o.assertion,'PASS');assert.equal(r.outcomes[0].delivery,'GAP_REFERENCE_URL_REJECTED');assert.equal(r.outcomes[4].outcome,'REFUSED_ORIGIN_MISMATCH');for(const row of r.rows){assert.match(row.responseSha256,/^sha256:[a-f0-9]{64}$/);assert.equal(row.body,undefined);}assert(r.rows.some(row=>row.path==='/v1/settings/downloads'&&row.status===403));assert.deepEqual(r.rows.filter(row=>row.identityFixture==='invalid-session').map(row=>row.path),['/v1/session']);
}
export function validateActions(actions){
 assert.equal(actions.length,8);for(const a of actions){assert(a.id&&a.owner&&a.acceptance&&a.boundary);assert.notEqual(a.status,'CLOSED');assert.notEqual(a.status,'PASS');}assert(actions.some(a=>a.id==='G1-DL-01'));assert(actions.some(a=>a.id==='G1-DL-02'));assert(actions.some(a=>a.id==='G1-REC-01'));assert.equal(actions.find(a=>a.id==='G1-CONF-01').status,'AWAITING_PROJECT_USER');
}
export function checkCommands(attempt){return [
 ['historical-audit',['node',directory+'/audit.mjs','--inventory',attempt+'/dependency-audit.json']],
 ['bounded-probes',['pnpm','exec','vitest','run',directory+'/probes.test.ts','apps/terminal/tests/ui-p17-runtime.test.ts','apps/terminal/tests/ui-p15-runtime.test.ts','apps/terminal/tests/browser-platform-provider-consumer.test.ts','apps/terminal/tests/ui101-source.test.ts','apps/terminal/tests/ui101-runtime.test.ts','--reporter=verbose','--reporter=json','--outputFile='+attempt+'/vitest.json']],
 ['audit-negative',['node','--test',directory+'/audit.test.mjs']],
 ['confirmation-policy',['node','--test','scripts/user-acceptance-confirmation.test.mjs']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['lint',['pnpm','exec','eslint',directory+'/audit.mjs',directory+'/audit.test.mjs',directory+'/probes.test.ts']],
].map(([id,command])=>({id,command}));}
export function verify(r){
 validateBoundary(r);assert.deepEqual(inventory(),json(directory+'/dependency-audit.json'));validateActions(json(directory+'/actions.json'));const saved=json(r.attempt+'/reference-probes.json');validateProbe(saved);
 for(const row of r.inputs){assert.equal(hash(read(row.path)),row.sha256);assert.deepEqual(read(row.path),committed(sourceCommit,row.path));}
 for(const row of r.auditTools)assert.equal(hash(read(row.path)),row.sha256);
 for(const a of r.artifacts)assert.equal(hash(read(a.path)),a.sha256);
 const expected=checkCommands(r.attempt);
 for(const [i,e]of r.executions.entries()){assert.equal(e.id,expected[i].id);assert.deepEqual(e.command,expected[i].command);assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);}
 assert.equal(r.executions.length,6);assert.deepEqual(r.executions.map(e=>e.id),['historical-audit','bounded-probes','audit-negative','confirmation-policy','plans','lint']);
 const report=json(r.attempt+'/vitest.json');assert.equal(report.success,true);assert.equal(report.numPassedTests,report.numTotalTests);assert.equal(report.testResults.length,6);for(const suite of report.testResults){assert.equal(suite.status,'passed');assert(suite.assertionResults.length>0);for(const test of suite.assertionResults)assert.equal(test.status,'passed');}assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);
 const old=nodesFromPlans(plans.map(p=>committed(sourceCommit,p).toString()));for(const [id,node]of nodesFromPlans())assert.deepEqual(node.stage_gate,old.get(id).stage_gate);
 return{auditStatus:r.auditStatus,sourceCommit,g1Gate:r.g1Gate,fep1Gate:r.fep1Gate,stageGate:r.stageGate,firefoxBrowser:r.firefoxBrowser,webKitAttachmentBrowser:r.webKitAttachmentBrowser,openActions:8,formalAccepted:false,runtimeAdmission:'DENIED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--inventory'){writeFileSync(process.argv[3]??directory+'/dependency-audit.json',JSON.stringify(inventory(),null,2)+'\n');console.log('Historical sources, approvals, artifacts and current dependency metadata verified; no historical PASS rebound.');}else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
