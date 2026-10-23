// Bounded human confirmation of the immutable UI-P03 packet; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,inputs,reuse} from './ui-p03-review.mjs';
import {axeEvidence as priorAxe} from './ui201-confirmed-reference.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui-p03-confirmation-20261023',original='docs/audit/evidence/ui-p03-local-20261023';
export const source='9d8de103a61531588ebc4888af87b0d2ec6be89d',packet='6fd794bd76c35efbf8a6c67a58124a191a3ddfb0';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText='确认 UI-P03 本轮完整确认稿，范围绑定工程 SHA 9d8de103，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞、原6项图标及2项表头 incomplete、本轮12条对比度 incomplete 扫描记录和全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
export const confirmationLine='- 确认执行：项目用户已确认原完整稿，仅绑定工程 `9d8de103` 及原文稿证据包 `6fd794bd`；COMPLETED 仅表示原稿 UI-P03 当前页面范围确认。见[原始确认与范围](./audit/evidence/ui-p03-confirmation-20261023/README.md)及[确认门禁](../scripts/ui-p03-confirmed-reference.mjs)。reference 身份/CORS 替代、Firefox/WebKit 阻塞、原6项图标及2项表头 incomplete、本轮12条对比度 incomplete 扫描记录、全部 NOT_RUN 和原失败记录保留；G1/FEP-1、INTEGRATION/发布不提升，runtimeAdmission=DENIED。下一原任务 UI-202 开发允许，无 G1 辅助项前置。';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export function originalRequest(reader=readConfirmationFile){const draft=reader(original+'/confirmation-draft.md').toString().match(/```json\s*([\s\S]*?)\s*```/);assert(draft);return JSON.parse(draft[1]).request;}
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'UI_P03_CURRENT_PAGE_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',actualExternalEngineExecution:'NOT_RUN',visualBaselineComparison:'PASS_ORIGINAL_CURRENT_PAGE_ONLY',axeViolations:0,currentContrastIncompleteScanRecords:12,currentContrastUniqueDefects:'NOT_DEDUPLICATED',independentHumanReview:'NOT_RUN',axeIncompleteRuleIds:['color-contrast']};
export function axeEvidence(reader=readConfirmationFile){
 const prior=priorAxe(reader),r=JSON.parse(reader(original+'/receipt.json')),axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,2);
 const current=axes.map(f=>{const bytes=reader(f.path);assert.equal(hash(bytes),f.sha256);const a=JSON.parse(bytes);assert.equal(a.sourceCommit,source);assert.equal(a.priorIconIncomplete,6);assert.equal(a.priorHeaderIncomplete,2);assert.equal(a.scans.length,6);
  assert.deepEqual(a.scans.map(s=>[s.path,s.width]),['/research','/research/new'].flatMap(path=>[1672,1024,390].map(width=>[path,width])));
  for(const k of ['manualScreenReader','nativeZoom200','crossOsVisual'])assert.equal(a[k],'NOT_RUN');
  const scans=a.scans.map(s=>{assert.equal(s.violations.length,0);assert.equal(s.incomplete.length,1);assert.equal(s.incomplete[0].id,'color-contrast');assert.equal(s.incomplete[0].nodes.length,s.path==='/research/new'&&s.width===390?12:s.width===390?5:10);return{path:s.path,width:s.width,violations:0,incomplete:1,incompleteRuleIds:s.incomplete.map(i=>i.id),incompleteNodeCount:s.incomplete.reduce((n,i)=>n+i.nodes.length,0)};});
  return{path:f.path,sha256:f.sha256,sourceCommit:a.sourceCommit,theme:a.theme,scans};});
 assert.deepEqual(current.map(a=>a.theme),['dark','light']);return{...prior,currentPage:current};
}
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-P03');assert.equal(r.request.sourceCommit,source);assert.deepEqual(request,originalRequest(reader));assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 assert.deepEqual(r.retainedAxe,axeEvidence(reader),'retain original six icon/two header and twelve current scan findings');return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');const start=after.indexOf('<a id="task-ui-p03"></a>'),end=after.indexOf('<a id="task-ui-202"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);assert.equal(normalized,before,'only UI-P03 current-page completion and confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json'),request=originalRequest();validateRecord(approval,request);
 assert.equal(request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(scope.inputsDigest,request.inputsDigest);assert.equal(hash(read(original+'/receipt.json')),manifest.technicalReceipt.sha256);assert.equal(hash(read(original+'/scope.json')),manifest.scope.sha256);assert.equal(hash(read(original+'/confirmation-draft.md')),manifest.confirmationDraft.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');assert.equal(originalPaths.length,535);for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.sourceInputs,562);assert.equal(manifest.files.length,559);for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,562);assert.deepEqual(reuse(),r.reusedEvidence);assert.equal(r.reusedEvidence.binaryReuse.unchangedRustInputs,245);assert.equal(r.reusedEvidence.binaryReuse.rebuilt,false);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,10);assert.equal(r.artifacts.length,54);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 52|ℹ tests 52)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,78);assert.equal(unit.numPassedTests,78);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui-p03.json'));assert.equal(probes.length,11);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,r.reusedEvidence.binaryReuse.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert.equal(p.businessWrites,'LOCAL_REFERENCE_C03_CREATE_ONLY');assert(p.rows.every(row=>row.method==='GET'||row.method==='POST'&&row.path==='/v1/research-runs'));}
 assert.equal(r.artifacts.filter(f=>f.path.endsWith('.png')).length,14);assert.equal(r.inputs.filter(f=>f.path.startsWith('tests/e2e/ui-p03.spec.ts-snapshots/')&&f.path.endsWith('.png')).length,12);assert.equal(scope.currentAxeIncomplete,12);assert.deepEqual(json(original+'/visual-review.json').axe.map(a=>a.sha256),record.retainedAxe.currentPage.map(a=>a.sha256));
 validatePlanText(committed(plan).toString(),read(plan).toString());const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-202').allowed,true);const integration=executionDecision('FE:UI-P03',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui-p03-confirmed-reference/v1',nodeId:'FE:UI-P03',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:562,originalPacketFiles:535,originalPacketHashes:559,originalArtifacts:54,originalCommands:10,originalTests:{unit:78,chromium:11,gateAndRoutes:52,visualBaselines:12,screenshots:14,axeScans:12,reexecuted:false},historicalBoundaries:record.historicalBoundaries,retainedAxe:record.retainedAxe,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_PAGE_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
