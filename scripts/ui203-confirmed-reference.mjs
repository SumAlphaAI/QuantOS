// Bounded human confirmation of the immutable UI-203 packet; no functional rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,inputs,reuse} from './ui203-review.mjs';
import {axeEvidence as priorAxe} from './ui202-confirmed-reference.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui203-confirmation-20261023',original='docs/audit/evidence/ui203-local-20261023';
export const source='03ecbdfa31d075a821cabe6e278c65131e25cde9',packet='764057acb29a313f71851f02795e34a397fdc307';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText='确认 UI-203 本轮完整确认稿，范围绑定工程 SHA 03ecbdfa，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞、原6+2项及UI-P03的12条 incomplete 和全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
export const confirmationLine='- 确认执行：项目用户已确认原完整稿，仅绑定工程 `03ecbdfa` 及原文稿证据包 `764057ac`；COMPLETED 仅表示原稿 UI-203 当前功能范围确认。见[原始确认与范围](./audit/evidence/ui203-confirmation-20261023/README.md)及[确认门禁](../scripts/ui203-confirmed-reference.mjs)。reference 身份/CORS 替代、Firefox/WebKit 阻塞、原6+2项及UI-P03的12条 incomplete、全部 NOT_RUN 和原失败记录保留；G1/FEP-1、INTEGRATION/发布不提升，runtimeAdmission=DENIED。下一原任务 UI-P04 开发允许，无 G1 辅助项前置。';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export function originalRequest(reader=readConfirmationFile){const draft=reader(original+'/confirmation-draft.md').toString().match(/```json\s*([\s\S]*?)\s*```/);assert(draft);return JSON.parse(draft[1]).request;}
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'UI203_CURRENT_FUNCTION_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',actualExternalEngineExecution:'NOT_RUN',visualBaselineComparison:'NOT_RUN_UI_P04_SEPARATE_TASK',axeViolations:0,currentContrastIncompleteScanRecords:0,currentContrastUniqueDefects:'NOT_DEDUPLICATED',independentHumanReview:'NOT_RUN',axeIncompleteRuleIds:['color-contrast'],currentAxeIncomplete:0,syntheticRelationshipBoundary:'REFERENCE_ARTIFACT_AND_C03_SEED_PLUS_LABELED_MEMBERSHIP_EVIDENCE_OVERLAYS_NO_ENGINE_COMPLETION',syntheticPagingBoundary:'BROWSER_SYNTHETIC_CURSOR_RECORDED; UPSTREAM_REFERENCE_REQUERIED_WITHOUT_SYNTHETIC_CURSOR; NOT_REAL_CURSOR_ACCEPTANCE'};
export function axeEvidence(reader=readConfirmationFile){
 const prior=priorAxe(reader),r=JSON.parse(reader(original+'/receipt.json')),axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,2);
 const current=axes.map(f=>{const bytes=reader(f.path);assert.equal(hash(bytes),f.sha256);const a=JSON.parse(bytes);assert.equal(a.sourceCommit,source);assert.deepEqual(a.priorIncomplete,{icons:6,headers:2,p03:12});assert.equal(a.scans.length,2);assert.deepEqual(a.scans.map(s=>s.width),[1440,390]);
  for(const k of ['manualScreenReader','nativeZoom200'])assert.equal(a[k],'NOT_RUN');
  const scans=a.scans.map(s=>{assert.equal(s.violations.length,0);assert.equal(s.incomplete.length,0);return{width:s.width,violations:0,incomplete:0,incompleteRuleIds:[],incompleteNodeCount:0};});return{path:f.path,sha256:f.sha256,sourceCommit:a.sourceCommit,theme:a.theme,scans};});
 assert.deepEqual(current.map(a=>a.theme),['dark','light']);return{...prior,currentUI203:current};
}
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-203');assert.equal(r.request.sourceCommit,source);assert.deepEqual(request,originalRequest(reader));assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 assert.deepEqual(r.retainedAxe,axeEvidence(reader),'retain original six icon/two header and twelve P03 scan findings; current four scans do not close them');return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');const start=after.indexOf('<a id="task-ui-203"></a>'),end=after.indexOf('<a id="task-ui-p04"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);assert.equal(normalized,before,'only UI-203 current-page completion and confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json'),request=originalRequest();validateRecord(approval,request);
 assert.equal(request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.deepEqual(scope.request,request);assert.equal(scope.inputsDigest,request.inputsDigest);assert.equal(manifest.inputsDigest,request.inputsDigest);
 for(const ref of [scope.technicalReceipt,scope.visualReview])assert.equal(hash(read(ref.path)),ref.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');assert.equal(originalPaths.length,119);
 const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]);assert.deepEqual(files(original).sort(),originalPaths.sort());
 for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.sourceCommit,source);assert.equal(manifest.sourceInputs,593);assert.equal(manifest.files.length,139);assert.equal(manifest.changedFiles.length,141);
 assert.deepEqual(manifest.commitProtectedOnly,[original+'/manifest.json',original+'/packet-check.log']);
 for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original bytes '+f.path);}
 const changed=execFileSync('git',['diff','--name-only','-z',manifest.baselineCommit,packet],{encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.deepEqual(changed,manifest.changedFiles);
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,593);assert.deepEqual(reuse(),r.reusedEvidence);assert.equal(r.reusedEvidence.binaryReuse.unchangedRustInputs,245);assert.equal(r.reusedEvidence.binaryReuse.rebuilt,false);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,10);assert.equal(r.artifacts.length,46);assert.deepEqual(files(r.attempt).sort(),r.artifacts.map(f=>f.path).sort());for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 67|ℹ tests 67)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,76);assert.equal(unit.numPassedTests,76);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui203.json'));assert.equal(probes.length,12);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,r.reusedEvidence.binaryReuse.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert.equal(p.businessWrites,'REFERENCE_READS_WITH_CONTROL_SEED_ONLY');assert(p.rows.every(row=>row.method==='GET'||row.method==='POST'&&row.path==='/v1/research-runs'&&row.port==='NODE_CONTROL'));}
 assert.equal(r.artifacts.filter(f=>f.path.endsWith('.png')).length,4);assert.equal(scope.currentAxeIncomplete,0);assert.deepEqual(json(original+'/visual-review.json').axe.map(a=>a.sha256),record.retainedAxe.currentUI203.map(a=>a.sha256));
 for(const key of ['syntheticRelationshipBoundary','syntheticPagingBoundary'])assert.equal(scope[key],requiredBoundary[key]);
 validatePlanText(committed(plan).toString(),read(plan).toString());const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-P04').allowed,true);const integration=executionDecision('FE:UI-203',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui203-confirmed-reference/v1',nodeId:'FE:UI-203',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:593,originalPacketFiles:119,originalPacketHashes:139,originalArtifacts:46,originalCommands:10,originalTests:{unit:76,chromium:12,gateAndRoutes:67,screenshots:4,axeScans:4,reexecuted:false},historicalBoundaries:record.historicalBoundaries,retainedAxe:record.retainedAxe,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
