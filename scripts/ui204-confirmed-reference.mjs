// User confirmation overlays the immutable original UI-204 evidence; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,inputs,reuse} from './ui204-review.mjs';
import {hash} from './ui507-review.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui204-confirmation-20261023',original='docs/audit/evidence/ui204-local-20261023';
export const source='54ab042b14b973cbe4e37dfcefdfafa351cc893d',packet='f7ebc51f9ddfb25d767ceeb471c548fee8f071ab';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText="确认 UI-204 本轮完整确认稿，范围绑定工程 SHA 54ab042b，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞及全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。";
export const confirmationLine="- 确认执行：项目用户已确认原完整稿，仅绑定工程`54ab042b`及原文稿证据包`f7ebc51f`；COMPLETED仅表示原稿当前功能范围确认。见[原始确认与范围](./audit/evidence/ui204-confirmation-20261023/README.md)和[确认门禁](../scripts/ui204-confirmed-reference.mjs)。reference身份/CORS替代、Firefox/WebKit阻塞及全部NOT_RUN保留；用途核对不授予策略/交易许可，G1/FEP-1、INTEGRATION/发布状态不提升，下一原任务UI-P05可继续开发，无G1辅助项前置。";
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'UI204_LOCAL_REFERENCE_FUNCTION_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',businessWrites:'NOT_RUN_READ_ONLY_UI204',axe:'NOT_RUN',highFidelityVisualAcceptance:'NOT_RUN_UI_P05_SCOPE'};
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-204');assert.equal(r.request.sourceCommit,source);assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');
 const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');
 const start=after.indexOf('<a id="task-ui-204"></a>'),end=after.indexOf('<a id="task-ui-p05"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);
 assert.equal(normalized,before,'only UI-204 development completion and bounded confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json');
 validateRecord(approval,scope.request);assert.equal(scope.request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(hash(read(original+'/receipt.json')),scope.technicalReceipt.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');
 for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.sourceInputs,524);assert.equal(manifest.files.length,149);
 for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original current bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,524);assert.deepEqual(reuse(),r.reusedEvidence);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,12);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.equal(r.artifacts.length,33);
 assert.match(read(r.attempt+'/rust-c04.log').toString(),/test result: ok\. 23 passed; 0 failed;/);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 50|ℹ tests 50)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,110);assert.equal(unit.numPassedTests,110);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));
 const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,source);assert.equal(binary.rebuilt,true);assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui204.json'));assert.equal(probes.length,6);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,binary.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert(p.rows.every(row=>row.method==='GET'));}
 const visual=json(original+'/visual-review.json');assert.equal(visual.sourceCommit,source);assert.equal(visual.status,'PASS_LAYOUT_SANITY_ONLY');assert.equal(visual.images.length,2);assert.equal(visual.pixelBaselineComparison,'NOT_RUN_UI_P05_SCOPE');assert.equal(visual.axe,'NOT_RUN');assert.equal(visual.manualScreenReader,'NOT_RUN');assert.equal(visual.nativeZoom200,'NOT_RUN');assert.equal(visual.crossOsVisual,'NOT_RUN');assert.equal(visual.formalAccepted,false);
 validatePlanText(committed(plan).toString(),read(plan).toString());
 const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-P05').allowed,true);const integration=executionDecision('FE:UI-204',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui204-confirmed-reference/v1',nodeId:'FE:UI-204',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:524,originalPacketHashes:149,originalArtifacts:33,originalCommands:12,originalTests:{rust:23,unit:110,chromium:6,gateAndRoutes:50,reexecuted:false},historicalBoundaries:record.historicalBoundaries,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
