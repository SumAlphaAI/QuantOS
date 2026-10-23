// Confirmation overlays the immutable UI-201 packet; no functional or full-chain rerun.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,readConfirmationFile} from './user-acceptance-confirmation.mjs';
import {boundary,validateBoundary,validateExecutions,validateBrowser,inputs,reuse} from './ui201-review.mjs';
import {axeEvidence as originalIconAxe} from './ui-p05-confirmed-reference.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {executionDecision} from './development-execution.mjs';
export const directory='docs/audit/evidence/ui201-confirmation-20261023',original='docs/audit/evidence/ui201-local-20261023';
export const source='e3776999ad2aee625ec38faee5547a3b6ff9e68a',packet='89da61eec288f090fce70cb4ce5528a5cdf42012';
export const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const confirmationText='确认 UI-201 本轮完整确认稿，范围绑定工程 SHA e3776999，保留 reference 身份/CORS 替代边界、Firefox/WebKit 阻塞、原 6 项图标及本轮 2 项表头对比度 incomplete 和全部 NOT_RUN，不提升 G1/FEP-1 联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
export const confirmationLine='- 确认执行：项目用户已确认原完整稿，仅绑定工程 `e3776999` 及原文稿证据包 `89da61ee`；COMPLETED 仅表示原稿 UI-201 当前功能范围确认。见[原始确认与范围](./audit/evidence/ui201-confirmation-20261023/README.md)及[确认门禁](../scripts/ui201-confirmed-reference.mjs)。reference 身份/CORS 替代、Firefox/WebKit 阻塞、原6项图标及本轮2项表头对比度 incomplete、全部 NOT_RUN 与原失败记录保留；G1/FEP-1、INTEGRATION/发布不提升，runtimeAdmission=DENIED。下一原任务 UI-P03 开发允许，无 G1 辅助项前置。';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:64e6});
export function originalRequest(reader=readConfirmationFile){const draft=reader(original+'/confirmation-draft.md').toString().match(/```json\s*([\s\S]*?)\s*```/);assert(draft);return JSON.parse(draft[1]).request;}
const originalBoundary=Object.fromEntries(Object.entries(boundary(source)).filter(([key])=>!['schema','nodeId','sourceCommit','confirmation','identity','cors'].includes(key)));
export const requiredBoundary={...originalBoundary,scopeAdmission:'UI201_CURRENT_FUNCTION_REFERENCE_ONLY',identityBoundary:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',corsBoundary:'LOOPBACK_PROXY_SUBSTITUTION',functionRerun:false,businessPurposeAuthorization:'NOT_CLAIMED',actualExternalEngineExecution:'NOT_RUN',visualBaselineComparison:'NOT_RUN_UI_P03_SEPARATE_TASK',axeViolations:0,priorIconAxeIncomplete:6,currentHeaderAxeIncomplete:2,axeIncompleteRuleIds:['color-contrast']};
export function axeEvidence(reader=readConfirmationFile){
 const r=JSON.parse(reader(original+'/receipt.json')),axes=r.artifacts.filter(f=>f.path.endsWith('/axe.json'));assert.equal(axes.length,1);
 const icons=originalIconAxe(reader);assert.equal(icons.reduce((n,a)=>n+a.scans.reduce((sum,s)=>sum+s.incomplete,0),0),6);
 const headers=axes.map(f=>{const bytes=reader(f.path);assert.equal(hash(bytes),f.sha256);const a=JSON.parse(bytes);assert.equal(a.sourceCommit,source);assert.equal(a.previousP05Incomplete,6);assert.equal(a.manualScreenReader,'NOT_RUN');assert.equal(a.nativeZoom200,'NOT_RUN');assert.equal(a.scans.length,8);
  assert.deepEqual(a.scans.map(s=>[s.theme,s.path,s.width]),['dark','light'].flatMap(theme=>['/research','/research/new'].flatMap(path=>[1440,390].map(width=>[theme,path,width]))));
  const scans=a.scans.map(s=>{assert.equal(s.violations.length,0);const count=s.path==='/research'&&s.width===390?1:0;assert.equal(s.incomplete.length,count);if(count){assert.equal(s.incomplete[0].id,'color-contrast');assert.equal(s.incomplete[0].nodes.length,4);}return{theme:s.theme,path:s.path,width:s.width,violations:s.violations.length,incomplete:s.incomplete.length,incompleteRuleIds:s.incomplete.map(i=>i.id),incompleteNodeCount:s.incomplete.reduce((n,i)=>n+i.nodes.length,0)};});
  return{path:f.path,sha256:f.sha256,sourceCommit:a.sourceCommit,scans};});
 return{originalIcons:icons,currentHeaders:headers};
}
export function validateRecord(approval,request,reader=readConfirmationFile){
 const confirmed=validateUserConfirmation(approval,request,reader),r=JSON.parse(reader(approval.record));
 assert.equal(r.request.nodeId,'FE:UI-201');assert.equal(r.request.sourceCommit,source);assert.deepEqual(request,originalRequest(reader));assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.documentCommit,packet);
 assert.equal(r.confirmationSource.rawRecord,directory+'/raw-user-message.txt');assert.equal(r.confirmationSource.text,confirmationText);assert.equal(reader(r.confirmationSource.rawRecord).toString(),confirmationText+'\n');
 assert.equal(r.approvedTechnicalManifest.path,original+'/manifest.json');assert.equal(r.approvedTechnicalManifest.commit,packet);assert.equal(hash(reader(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);
 for(const[k,v]of Object.entries(requiredBoundary))assert.deepEqual(r[k],v,'confirmation boundary '+k);
 assert.equal(r.historicalBoundaries.path,'docs/audit/evidence/g1-journey-local-20261022/retained-boundaries.json');const retained=reader(r.historicalBoundaries.path);assert.equal(hash(retained),r.historicalBoundaries.sha256);assert.deepEqual(JSON.parse(retained),r.historicalBoundaries.value);
 assert.deepEqual(r.retainedAxe,axeEvidence(reader),'retain all six original icon and two current header incomplete entries');return confirmed;
}
export function validatePlanText(before,after){
 assert.equal(after.split(confirmationLine).length,2,'exactly one bounded confirmation marker');const start=after.indexOf('<a id="task-ui-201"></a>'),end=after.indexOf('<a id="task-ui-p03"></a>',start);assert(start>=0&&end>start);
 const block=after.slice(start,end);assert.equal(block.split('- development_status: `COMPLETED`').length,2);assert(block.includes(confirmationLine));
 const normalized=after.slice(0,start)+block.replace('- development_status: `COMPLETED`','- development_status: `IMPLEMENTED_PENDING_ACCEPTANCE`').replace(confirmationLine+'\n','')+after.slice(end);assert.equal(normalized,before,'only UI-201 current-function completion and confirmation metadata may change');
}
export function verify(){
 const approval=json(directory+'/approval.json'),record=json(approval.record),scope=json(original+'/scope.json'),r=json(original+'/receipt.json'),manifest=json(original+'/manifest.json'),request=originalRequest();validateRecord(approval,request);
 assert.equal(request.inputsDigest,hash(JSON.stringify(r.inputs)));assert.equal(scope.inputsDigest,request.inputsDigest);assert.equal(hash(read(original+'/receipt.json')),manifest.technicalReceipt.sha256);assert.equal(hash(read(original+'/scope.json')),manifest.scope.sha256);assert.equal(hash(read(original+'/confirmation-draft.md')),manifest.confirmationDraft.sha256);
 const originalPaths=execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n');for(const path of originalPaths)assert.deepEqual(read(path),committed(path),'original packet changed '+path);
 assert.equal(manifest.engineeringSourceCommit,source);assert.equal(manifest.sourceInputs,541);assert.equal(manifest.files.length,217);for(const f of manifest.files){assert.equal(hash(committed(f.path)),f.sha256,'original snapshot '+f.path);if(f.path!==plan)assert.equal(hash(read(f.path)),f.sha256,'original bytes '+f.path);}
 validateBoundary(r);assert.equal(r.sourceCommit,source);assert.deepEqual(inputs(),r.inputs);verifyInputs(source,r.inputs);assert.equal(r.inputs.length,541);assert.deepEqual(reuse(),r.reusedEvidence);assert.equal(r.reusedEvidence.rustInputs,245);assert.deepEqual(r.reusedEvidence.changedRustInputs,['services/bff-gateway/src/lib.rs','services/bff-gateway/src/research_tests.rs']);
 validateExecutions(r.executions,r.attempt);assert.equal(r.executions.length,12);assert.equal(r.artifacts.length,44);for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256);assert.match(read(r.attempt+'/rust-c04.log').toString(),/24 passed; 0 failed/);assert.match(read(r.attempt+'/gate-routes.log').toString(),/(?:# tests 52|ℹ tests 52)/);
 const unit=json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,122);assert.equal(unit.numPassedTests,122);assert.equal(unit.numPendingTests,0);validateBrowser(json(r.attempt+'/browser/report.json'));assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+source);const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,source);
 const probes=r.artifacts.filter(f=>f.path.endsWith('/ui201.json'));assert.equal(probes.length,8);for(const f of probes){const p=json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,source);assert.equal('sha256:'+p.binarySha256,binary.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert.equal(p.businessWrites,'LOCAL_REFERENCE_C03_CREATE_ONLY');assert(p.rows.every(row=>row.method==='GET'||row.method==='POST'&&row.path==='/v1/research-runs'));}
 assert.equal(r.artifacts.filter(f=>f.path.endsWith('.png')).length,8);assert.equal(scope.priorP05IconIncomplete,6);assert.equal(scope.newAxeIncomplete.length,2);for(const a of scope.newAxeIncomplete){assert.equal(a.rule,'color-contrast');assert.equal(a.nodeCount,4);assert.equal(a.width,390);}
 validatePlanText(committed(plan).toString(),read(plan).toString());const core='docs/SumAlpha-QuantOS-Development-Plan.md';assert.deepEqual(read(core),committed(core));const old=nodesFromPlans([core,plan].map(p=>committed(p).toString())),now=nodesFromPlans();assert.equal(now.size,159);for(const[id,n]of now)assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);
 assert.equal(executionDecision('FE:UI-P03').allowed,true);const integration=executionDecision('FE:UI-201',{phase:'INTEGRATION'});assert.equal(integration.allowed,false);assert.equal(integration.reason,'STAGE_NOT_READY');
 return{schema:'quantos-ui201-confirmed-reference/v1',nodeId:'FE:UI-201',sourceCommit:source,sourcePacket:packet,confirmation:'CONFIRMED',confirmationRecord:approval,documentSha256:record.documentSha256,technicalReceiptSha256:hash(read(original+'/receipt.json')),originalManifestSha256:hash(read(original+'/manifest.json')),originalInputs:541,originalPacketHashes:217,originalArtifacts:44,originalCommands:12,originalTests:{unit:122,rust:24,chromium:8,gateAndRoutes:52,screenshots:8,axeScans:8,reexecuted:false},historicalBoundaries:record.historicalBoundaries,retainedAxe:record.retainedAxe,originalFailuresPreserved:true,developmentStatus:'COMPLETED_ORIGINAL_FUNCTION_ONLY',preservedStageGates:159,...requiredBoundary};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const proof=verify();if(process.argv[2]==='--write')writeFileSync(directory+'/closure-proof.json',JSON.stringify(proof,null,2)+'\n');else assert.deepEqual(json(directory+'/closure-proof.json'),proof);console.log(JSON.stringify(proof));}catch(error){console.error(error.stack);process.exitCode=1;}}
