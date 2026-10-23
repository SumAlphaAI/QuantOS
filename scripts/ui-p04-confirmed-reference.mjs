// Bounded human confirmation of the immutable UI-P04 packet; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,validateAxeReport,inputs,reuse,design} from './ui-p04-review.mjs';
import {axeEvidence as priorAxe} from './ui203-confirmed-reference.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui-p04-confirmation-20261023',original='docs/audit/evidence/ui-p04-local-20261023';
export const source='1fb76f8667bb5e17b50ab8f4573f7eb7ef9d9403',packet='7171d0318282d1f62e9d6e8000e8953ac082272c';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText='确认 UI-P04 本轮完整确认稿，范围绑定工程 SHA 1fb76f86，保留 reference 身份/CORS 替代、Firefox/WebKit 阻塞、原6+2项、UI-P03的12条及本轮12条 incomplete 扫描记录和全部 NOT_RUN，不提升联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
export const confirmationLine='- 确认执行：项目用户已确认原完整稿，仅绑定工程 `1fb76f86` 及原文稿证据包 `7171d031`；COMPLETED 仅表示 UI-P04 原稿当前页面范围确认。见[原始确认与范围](./audit/evidence/ui-p04-confirmation-20261023/README.md)及[确认门禁](../scripts/ui-p04-confirmed-reference.mjs)。reference身份/CORS替代、Firefox/WebKit阻塞、原6+2项、UI-P03十二条及本轮十二条incomplete扫描记录、全部NOT_RUN与原失败保留；159阶段Gate、G1/FEP-1、G2/FEP-2及联调/发布不提升，runtimeAdmission=DENIED。下一原任务FRONTEND-GATE:G2可执行范围核对，无辅助开发前置。';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export function originalRequest(reader=readConfirmationFile){const draft=reader(original+'/confirmation-draft.md').toString().match(/```json\s*([\s\S]*?)\s*```/);assert(draft);return JSON.parse(draft[1]).request;}
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'UI_P04_CURRENT_PAGE_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',visualBaselineComparison:'CURRENT_SOURCE_REGRESSION_NOT_DESIGN_PNG_PIXEL_EQUALITY',baselineMaxDiffPixelRatio:.005,axeViolations:0,currentContrastIncompleteScanRecords:12,currentContrastIncompleteNodesAcrossScans:76,currentContrastUniqueDefects:'NOT_DEDUPLICATED',independentHumanReview:'NOT_RUN',axeIncompleteRuleIds:['color-contrast'],currentAxeIncomplete:12,g2Fep2:'NOT_ASSESSED',syntheticRelationshipBoundary:'REFERENCE_ARTIFACT_AND_C03_SEED_PLUS_LABELED_MEMBERSHIP_EVIDENCE_OVERLAYS_NO_ENGINE_COMPLETION',syntheticStatusBoundary:'LABELED_DETAIL_STATUS_AND_STREAM_NOTICES_NOT_WORKER_COMPLETION',unsupportedFields:'NO_INVENTED_TITLE_MODEL_PROGRESS_HEALTH_CLASSIFICATION_LOG_TEXT',offlineCache:'NOT_IMPLEMENTED_FAIL_CLOSED_CLEARING_REUSED',strategyDraftAndNewExport:'NO_UNBOUND_WRITES_OR_DOWNLOADS_ADDED'};
export function axeEvidence(reader=readConfirmationFile){
 const prior=priorAxe(reader),r=JSON.parse(reader(original+'/receipt.json')),axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,2);
 const current=axes.map(f=>{const bytes=reader(f.path);assert.equal(hash(bytes),f.sha256);const a=JSON.parse(bytes);validateAxeReport(a,source);
  const scans=a.scans.map(s=>({kind:s.kind,width:s.width,violations:s.violations.length,incomplete:s.incomplete.length,incompleteRuleIds:s.incomplete.map(i=>i.id),incompleteNodeCount:s.incomplete.reduce((n,i)=>n+i.nodes.length,0)}));return{path:f.path,sha256:f.sha256,sourceCommit:a.sourceCommit,theme:a.theme,scans};});
 assert.deepEqual(current.map(a=>a.theme),['dark','light']);assert.equal(current.reduce((n,a)=>n+a.scans.reduce((n,s)=>n+s.incomplete,0),0),12);assert.equal(current.reduce((n,a)=>n+a.scans.reduce((n,s)=>n+s.incompleteNodeCount,0),0),76);return{...prior,currentP04:current};
}
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-P04');assert.equal(r.request.sourceCommit,source);assert.deepEqual(request,originalRequest(reader));assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 assert.deepEqual(r.retainedAxe,axeEvidence(reader),'retain original 6+2+P03 twelve records and current P04 twelve contrast scan findings with raw source/hash/node binding');return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');const start=after.indexOf('<a id="task-ui-p04"></a>'),end=after.indexOf('<a id="acceptance-frontend-gate-g2"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);assert.equal(normalized,before,'only UI-P04 current-page completion and confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json'),request=originalRequest();validateRecord(approval,request);
 assert.equal(request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.deepEqual(scope.request,request);assert.equal(scope.inputsDigest,request.inputsDigest);assert.equal(manifest.inputsDigest,request.inputsDigest);
 for(const ref of [scope.technicalReceipt,scope.visualReview])assert.equal(hash(read(ref.path)),ref.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');assert.equal(originalPaths.length,144);
 const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]);assert.deepEqual(files(original).sort(),originalPaths.sort());
 for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.sourceCommit,source);assert.equal(manifest.sourceInputs,617);assert.equal(manifest.files.length,169);assert.equal(manifest.changedFiles.length,171);
 assert.deepEqual(manifest.commitProtectedOnly,[original+'/manifest.json',original+'/packet-check.log']);
 for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original bytes '+f.path);}
 const changed=execFileSync('git',['diff','--name-only','-z',manifest.baselineCommit,packet],{encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.deepEqual(changed,manifest.changedFiles);
 validateBoundary(r);assert.equal(r.designSha256,hash(read(design)));assert.equal(r.sourceCommit,source);assert.equal(r.inputs.filter(f=>f.path.startsWith('tests/e2e/ui-p04.spec.ts-snapshots/')&&f.path.endsWith('.png')).length,12);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,617);assert.deepEqual(reuse(),r.reusedEvidence);assert.equal(r.reusedEvidence.binaryReuse.unchangedRustInputs,245);assert.equal(r.reusedEvidence.binaryReuse.rebuilt,false);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,10);assert.equal(r.artifacts.length,58);assert.deepEqual(files(r.attempt).sort(),r.artifacts.map(f=>f.path).sort());for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 77|ℹ tests 77)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,119);assert.equal(unit.numPassedTests,119);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui-p04.json'));assert.equal(probes.length,14);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,r.reusedEvidence.binaryReuse.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert.equal(p.businessWrites,'REFERENCE_C03_SEED_AND_EXPLICIT_CANCEL_WITH_LABELED_OVERLAYS');assert(p.rows.every(row=>row.method==='GET'||row.method==='POST'&&(row.path==='/v1/research-runs'&&row.port==='NODE_CONTROL'||/^\/v1\/research-runs\/[a-f0-9-]+\/cancel$/.test(row.path))));}
 assert.equal(r.artifacts.filter(f=>f.path.endsWith('.png')).length,12);assert.equal(scope.currentContrastIncompleteScanRecords,12);assert.deepEqual(scope.currentAxe,record.retainedAxe.currentP04);assert.deepEqual(json(original+'/visual-review.json').axe.map(a=>a.sha256),record.retainedAxe.currentP04.map(a=>a.sha256));
 for(const key of ['syntheticRelationshipBoundary','syntheticStatusBoundary','unsupportedFields','offlineCache','strategyDraftAndNewExport','currentContrastIncompleteNodesAcrossScans'])assert.equal(scope[key],requiredBoundary[key]);
 validatePlanText(committed(plan).toString(),read(plan).toString());const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FRONTEND-GATE:G2').allowed,true);const integration=executionDecision('FE:UI-P04',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui-p04-confirmed-reference/v1',nodeId:'FE:UI-P04',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:617,originalPacketFiles:144,originalPacketHashes:169,originalArtifacts:58,originalCommands:10,originalTests:{unit:119,chromium:14,gateAndRoutes:77,screenshots:12,axeScans:12,visualBaselines:12,reexecuted:false},historicalBoundaries:record.historicalBoundaries,retainedAxe:record.retainedAxe,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
