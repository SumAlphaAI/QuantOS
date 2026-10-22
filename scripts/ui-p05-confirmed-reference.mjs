// User confirmation overlays the immutable original UI-P05 evidence; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,inputs,reuse} from './ui-p05-review.mjs';
import {hash} from './ui507-review.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui-p05-confirmation-20261023',original='docs/audit/evidence/ui-p05-local-20261023';
export const source='a76cca2194fa341bba3fb2e0883e8b137cb94bbd',packet='35e07003f4aa75359e425a6d2750676609664beb';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText="确认 UI-P05 本轮完整确认稿，范围绑定工程 SHA a76cca21，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞、6 项图标对比度 incomplete 及全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。";
export const confirmationLine="- 确认执行：项目用户已确认原完整稿，仅绑定工程`a76cca21`及原文稿证据包`35e07003`；COMPLETED仅表示原稿当前页面功能范围确认。见[原始确认与范围](./audit/evidence/ui-p05-confirmation-20261023/README.md)和[确认门禁](../scripts/ui-p05-confirmed-reference.mjs)。reference身份/CORS替代、Firefox/WebKit阻塞、6项图标对比度incomplete及全部NOT_RUN保留；G1/FEP-1、INTEGRATION/发布状态不提升，元数据下载不授予业务用途，下一原任务UI-201可继续开发，无G1辅助项前置。";
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'P05_CURRENT_PAGE_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',metadataDownload:'PASS_AUTHORIZED_LOCAL_C04_JSON_ONLY',independentSignatureVerification:'NOT_RUN',axeViolations:0,axeIncomplete:6,axeIncompleteRuleIds:['color-contrast']};
export function axeEvidence(reader=readConfirmationFile){
 const r=JSON.parse(reader(original+'/receipt.json')),axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,2);
 return axes.map(f=>{const bytes=reader(f.path);assert.equal(hash(bytes),f.sha256);const a=JSON.parse(bytes);assert.equal(a.sourceCommit,source);assert.equal(a.scans.length,3);assert.deepEqual(a.scans.map(s=>s.width),[1672,1024,390]);assert.equal(a.manualScreenReader,'NOT_RUN');assert.equal(a.nativeZoom200,'NOT_RUN');assert.equal(a.crossOsVisual,'NOT_RUN');
  const scans=a.scans.map(s=>{assert.equal(s.violations.length,0);assert.equal(s.incomplete.length,1);assert.deepEqual(s.incomplete.map(i=>i.id),['color-contrast']);return{width:s.width,violations:s.violations.length,incomplete:s.incomplete.length,incompleteRuleIds:s.incomplete.map(i=>i.id),incompleteNodeCount:s.incomplete.reduce((n,i)=>n+i.nodes.length,0)};});
  return{path:f.path,sha256:f.sha256,sourceCommit:a.sourceCommit,theme:a.theme,scans};});
}
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-P05');assert.equal(r.request.sourceCommit,source);assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');
 const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 assert.deepEqual(r.retainedAxe,axeEvidence(reader),'all six original icon contrast incomplete entries must remain');
 return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');
 const start=after.indexOf('<a id="task-ui-p05"></a>'),end=after.indexOf('<a id="task-ui-201"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);
 assert.equal(normalized,before,'only UI-P05 development completion and bounded confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json');
 validateRecord(approval,scope.request);assert.equal(scope.request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(hash(read(original+'/receipt.json')),scope.technicalReceipt.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.sourceInputs,539);assert.equal(manifest.files.length,182);for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original current bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,539);assert.deepEqual(reuse(),r.reusedEvidence);assert.equal(r.reusedEvidence.binaryReuse.sourceCommit,'54ab042b14b973cbe4e37dfcefdfafa351cc893d');assert.equal(r.reusedEvidence.binaryReuse.unchangedRustInputs,245);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,10);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.equal(r.artifacts.length,56);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 50|ℹ tests 50)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,74);assert.equal(unit.numPassedTests,74);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui-p05.json')||f.path.endsWith('/ui204.json'));assert.equal(probes.length,13);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,r.reusedEvidence.binaryReuse.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert(p.rows.every(row=>row.method==='GET'));}
 const visual=json(original+'/visual-review.json');assert.equal(visual.sourceCommit,source);assert.equal(visual.status,'PASS_CURRENT_PAGE_LAYOUT_ONLY');assert.equal(visual.visualBaselines,6);assert.equal(visual.baselineComparison,'PASS_CURRENT_SOURCE');assert.equal(visual.manualScreenReader,'NOT_RUN');assert.equal(visual.nativeZoom200,'NOT_RUN');assert.equal(visual.crossOsVisual,'NOT_RUN');assert.equal(visual.formalAccepted,false);assert.equal(visual.axe.length,6);for(const a of visual.axe){assert.equal(a.violations,0);assert.equal(a.incomplete,1);assert.deepEqual(a.incompleteRuleIds,['color-contrast']);}
 assert.equal(r.inputs.filter(f=>f.path.startsWith('tests/e2e/ui-p05.spec.ts-snapshots/')&&f.path.endsWith('.png')).length,6);
 const metadata=r.artifacts.filter(f=>f.path.endsWith('/metadata.json')),downloadProof=r.artifacts.filter(f=>f.path.endsWith('/metadata-receipt.json'));assert.equal(metadata.length,1);assert.equal(downloadProof.length,1);const proof=json(downloadProof[0].path);assert.equal(proof.sourceCommit,source);assert.equal(proof.scope,'C04_METADATA_ONLY_NOT_DATASET');assert.equal(proof.size,482);assert.equal(proof.size,read(metadata[0].path).length);assert.equal('sha256:'+proof.sha256,hash(read(metadata[0].path)));
 validatePlanText(committed(plan).toString(),read(plan).toString());const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-201').allowed,true);const integration=executionDecision('FE:UI-P05',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui-p05-confirmed-reference/v1',nodeId:'FE:UI-P05',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:539,originalPacketHashes:182,originalArtifacts:56,originalCommands:10,originalTests:{unit:74,chromium:13,gateAndRoutes:50,visualBaselines:6,axeScans:6,reexecuted:false},historicalBoundaries:record.historicalBoundaries,retainedAxe:record.retainedAxe,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
