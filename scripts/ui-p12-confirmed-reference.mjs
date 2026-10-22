// User confirmation overlays the immutable original UI-P12 evidence; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {validateBoundary,validateExecutions,validateBrowser,validateCurrentBindings,reuse} from './ui-p12-review.mjs';
import {hash} from './ui507-review.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui-p12-confirmation-20261023',original='docs/audit/evidence/ui-p12-local-20261022';
export const source='8f1f376372a2b5b12a5e2477b746f5940e78a06d',packet='db5faf89464cdab768c3fee731b2bc1427e8f240';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText="确认 UI-P12 本轮完整确认稿，范围绑定工程 SHA 8f1f3763，校验工具修复绑定 6bb2d19a，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞及全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。";
export const confirmationLine="- 确认执行：项目用户已确认原完整稿，仅绑定工程`8f1f3763`、校验工具修复`6bb2d19a`及原文稿证据包`db5faf89`；COMPLETED仅表示原稿当前页面功能范围确认。见[原始确认与范围](./audit/evidence/ui-p12-confirmation-20261023/README.md)和[确认门禁](../scripts/ui-p12-confirmed-reference.mjs)。reference身份/CORS替代、Firefox/WebKit阻塞及全部NOT_RUN保留；G1/FEP-1、INTEGRATION/发布状态不提升，下一原任务UI-204可继续开发，无G1辅助项前置。";
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export const requiredBoundary={scopeAdmission:'P12_CURRENT_PAGE_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',engineeringGate:'PASS_UI_P12_CURRENT_PAGE',stageGate:'NOT_ASSESSED',g1Gate:'NOT_READY_GAPS_OPEN',fep1Gate:'NOT_READY_GAPS_OPEN',businessIntegration:'NOT_RUN_FULL_ACCEPTANCE',releaseAcceptance:'NOT_RUN',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',firefoxBrowser:'BLOCKED_ENVIRONMENT',webKitAttachmentBrowser:'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION',functionRerun:false,fullChainRerun:false,productionCredentialsUsed:false,pushed:false,deployed:false,nextTask:'FE:UI-204',verificationToolCommit:'6bb2d19a924692f0a48c39e3c903a59b6596c452',verificationCorrection:'VERIFIER_BUFFER_AND_SAME_SOURCE_REPLAY_ONLY'};
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-P12');assert.equal(r.request.sourceCommit,source);assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');
 const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');
 const start=after.indexOf('<a id="task-ui-p12"></a>'),end=after.indexOf('<a id="task-ui-204"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);
 assert.equal(normalized,before,'only UI-P12 development completion and bounded confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json');
 validateRecord(approval,scope.request);assert.equal(scope.request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(hash(read(original+'/receipt.json')),scope.technicalReceipt.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');
 for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.verificationToolCommit,requiredBoundary.verificationToolCommit);assert.equal(scope.verificationToolCommit,requiredBoundary.verificationToolCommit);assert.equal(manifest.sourceInputs,540);assert.equal(manifest.files.length,182);
 for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original current bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.equal(r.correctedVerifier.sourceCommit,requiredBoundary.verificationToolCommit);validateCurrentBindings(r);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,540);assert.deepEqual(reuse(),r.reusedEvidence);
 validateExecutions(r.executions,r.attempt);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.equal(r.artifacts.length,52);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,46);assert.equal(unit.numPassedTests,46);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));
 assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui-p12.json')||f.path.endsWith('/ui507.json'));assert.equal(probes.length,14);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,r.reusedEvidence.binaryReuse.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);}
 const axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,2);let incomplete=0;for(const f of axes){const a=json(f.path);assert.equal(a.sourceCommit,source);assert.equal(a.scans.length,3);assert.equal(a.manualScreenReader,'NOT_RUN');assert.equal(a.nativeZoom200,'NOT_RUN');for(const scan of a.scans){assert.equal(scan.violations.length,0);incomplete+=scan.incomplete.length;}}assert.equal(incomplete,6);
 assert.equal(r.inputs.filter(f=>f.path.startsWith('tests/e2e/ui-p12.spec.ts-snapshots/')&&f.path.endsWith('.png')).length,6);
 validatePlanText(committed(plan).toString(),read(plan).toString());
 const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-204').allowed,true);const integration=executionDecision('FE:UI-P12',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui-p12-confirmed-reference/v1',nodeId:'FE:UI-P12',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:540,originalPacketHashes:182,originalArtifacts:52,originalCommands:10,originalTests:{unit:46,chromium:14,gateAndRoutes:49,visualBaselines:6,axeScans:6,axeIncomplete:6,reexecuted:false},historicalBoundaries:record.historicalBoundaries,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
