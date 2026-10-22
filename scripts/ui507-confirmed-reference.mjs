// User confirmation overlays the immutable original UI-507 evidence; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {validateBoundary,validateExecutions,validateBrowser,inputs,hash} from './ui507-review.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui507-confirmation-20261022',original='docs/audit/evidence/ui507-local-20261022';
export const source='9f7552a8305b1fb1b661676d1d67becf1ebb229b',packet='b1ebfe7b3b464094a6e91fcb14a32b6e8ab5f146';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText='确认 UI-507 本轮完整确认稿，范围绑定工程 SHA 9f7552a8，保留本机 reference 身份与 CORS 替代边界、Firefox、WebKit 阻塞及全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
export const confirmationLine='- 确认执行：项目用户已确认原完整稿，仅绑定工程`9f7552a8`及原文稿证据包`b1ebfe7b`；COMPLETED仅表示原稿当前功能范围确认。见[原始确认与范围](./audit/evidence/ui507-confirmation-20261022/README.md)和[确认门禁](../scripts/ui507-confirmed-reference.mjs)。reference身份/CORS替代、Firefox/WebKit阻塞及全部NOT_RUN保留；G1/FEP-1、INTEGRATION/发布状态不提升，下一原任务UI-P12可继续开发。';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export const requiredBoundary={scopeAdmission:'UI507_LOCAL_REFERENCE_FUNCTION_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',engineeringGate:'PASS_UI507_LOCAL_FUNCTION',stageGate:'NOT_ASSESSED',g1Gate:'NOT_READY_GAPS_OPEN',fep1Gate:'NOT_READY_GAPS_OPEN',businessIntegration:'NOT_RUN_FULL_ACCEPTANCE',releaseAcceptance:'NOT_RUN',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',firefoxBrowser:'BLOCKED_ENVIRONMENT',webKitAttachmentBrowser:'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION',functionRerun:false,fullChainRerun:false,productionCredentialsUsed:false,pushed:false,deployed:false,nextTask:'FE:UI-P12'};
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-507');assert.equal(r.request.sourceCommit,source);assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');
 const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');
 const start=after.indexOf('<a id="task-ui-507"></a>'),end=after.indexOf('<a id="task-ui-p12"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);
 assert.equal(normalized,before,'only UI-507 development completion and bounded confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json');
 validateRecord(approval,scope.request);assert.equal(scope.request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(hash(read(original+'/receipt.json')),scope.technicalReceipt.sha256);
 for(const path of [record.document,original+'/scope.json',original+'/receipt.json',original+'/manifest.json'])assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.sourceInputs,520);assert.equal(manifest.files.length,96);
 for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original current bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,520);
 validateExecutions(r.executions,r.attempt);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.equal(r.artifacts.length,32);
 for(const f of r.reusedEvidence){assert.equal(hash(read(f.path)),f.sha256);assert.equal(f.reexecuted,false);assert.equal(f.scope,'ORIGINAL_ONLY_NOT_REBOUND');}
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,55);assert.equal(unit.numPassedTests,55);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));
 const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,source);assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui507.json'));assert.equal(probes.length,6);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,binary.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);}
 validatePlanText(committed(plan).toString(),read(plan).toString());
 const old=nodesFromPlans(['docs/SumAlpha-QuantOS-Development-Plan.md',plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-P12').allowed,true);const integration=executionDecision('FE:UI-507',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui507-confirmed-reference/v1',nodeId:'FE:UI-507',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:520,originalPacketHashes:96,originalArtifacts:32,originalCommands:11,originalTests:{unit:55,chromium:6,gate:39,reexecuted:false},historicalBoundaries:record.historicalBoundaries,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
