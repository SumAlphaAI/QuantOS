#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { root, digest, inventory, confined, nodesFromPlans, planInput, validateReceipt, publishStages, developmentEnvironment, staticEnvironment } from './provider-a1-receipts.mjs';
import { confirmationPolicy, confirmationMode, reviewDimensions, validateUserConfirmation } from './user-acceptance-confirmation.mjs';
import { sourceDigest } from './pre03-build-receipt.mjs';
export const evidenceDirectory='docs/audit/evidence/frontend-g0-fep0-remediation-20261005';
const read=p=>readFileSync(confined(p),'utf8');
const json=p=>JSON.parse(read(p));
export const requiredReviewDimensions=reviewDimensions;
export const requiredChecks=['records','pre01','pre01-negative','boundary-negative','g0-negative','baseline','generated','proto','frontend-lint','frontend-types','auth-client-contract','sse','web-build','web-oidc-poc','js-budget','linux-baselines'];
export function policy(){
 const p=json('scripts/g0-policy.json');assert.equal(p.schema,'quantos-g0-development-policy/v2');assert.deepEqual(p.reviewDimensions,requiredReviewDimensions,'G0 review dimensions must remain');assert.equal(p.confirmationMode,confirmationMode);confirmationPolicy();assert.deepEqual(Object.keys(p.checks),requiredChecks,'G0 check obligations must remain');return p;
}
export function scopeRequest(p=policy()) {
 const openapi=parse(read('bff/openapi/quantos-bff.v1.yaml'));
 const catalog=parse(read('bff/page-operation-catalog.yaml'));
 const snapshot={schema:'quantos-g0-scope-request/v1',stage:'DEVELOPMENT',scope:p.scope,openapiVersion:openapi.info.version,platform:'phase-one Web',
  publishedOperations:Object.values(catalog.contracts).flatMap(c=>c.publishedOperations).sort(),plannedExcluded:Object.values(catalog.contracts).flatMap(c=>c.plannedOperations).sort(),
  excluded:p.excluded,planInput:planInput(nodesFromPlans().get('FRONTEND-GATE:G0')),reviewDimensions:p.reviewDimensions,confirmationMode:p.confirmationMode,inputs:inventory(p.inputSelectors)};
 return {...snapshot,scopeDigest:digest(JSON.stringify(snapshot))};
}
export function confirmationRequest(request){return {nodeId:'FRONTEND-GATE:G0',stage:'DEVELOPMENT',inputsDigest:request.scopeDigest,reviewDimensions:request.reviewDimensions};}
export function draftConfirmation(){
 const scope=scopeRequest();const request=confirmationRequest(scope);const draft={schema:'quantos-acceptance-draft/v1',mode:confirmationMode,draftedBy:'Codex',request,reviewDimensions:scope.reviewDimensions};
 const stamp=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});const suffix=scope.scopeDigest.slice(7,19);const document=`docs/gate-records/G0-user-confirmation-draft-${stamp}-${suffix}.md`;const scopeDocument=`docs/gate-records/G0-user-scope-request-${stamp}-${suffix}.json`;
 const body=`# G0 DEVELOPMENT 用户确认文稿（${stamp}）

状态：待用户确认。拟稿：Codex。唯一确认人：项目用户。本文件不生成批准记录。

## 确认对象

确认当前 API ${scope.openapiVersion}、一期 Web 的 G0 最低冻结面、工程/追踪要求、Web/OIDC/SSE 开发 PoC 与遗留安排。共 ${scope.publishedOperations.length} 个 published 操作；${scope.plannedExcluded.length} 个 planned 操作不视为已实现。完整清单与输入摘要见 [范围请求](./${scopeDocument.split("/").at(-1)})。

## 审阅要点

- 产品：确认一期 Web 与开发阶段范围、planned 与二期排除项。
- 前端：确认页面追踪、生成客户端、生产导入边界及基本浏览器/a11y/视觉范围。
- BFF：确认 API ${scope.openapiVersion} 最低冻结面、同源 schema/mock、错误与安全输入。
- QA：当前功能输入的工程执行和依赖核验见独立 G0 工程回执；FEP-0 整改新增 F0 当前功能回执与里程碑校验。你确认范围后仍须内容门禁通过，旧回执不可替代变更后工程准入复评。
- 安全：确认 cookie/CSRF/OIDC/SSE 等开发安全范围；mock IdP、loopback 服务不代表真实 staging。
- 风控：确认开发回执不会开启 testnet/实盘权限；未完成 provider、业务联调和发布验收仍按原计划。

## 遗留与准入条件

19 个遗留子项的负责人、阶段、消费期限和兼容策略按 [当前台账](./G0-current-disposition.md) 保留。你的确认关闭当前范围确认待办；阶段 READY 还需当前工程及依赖门禁通过，新页面还需 PROVIDER:ALL。真实部署/IdP、发布性能/长稳、同 SHA hosted CI、用途许可与发布确认分别在 RELEASE 完成。

## 待确认内容

建议回复：“确认 G0 DEVELOPMENT 文稿”。这仅确认本稿的当前功能范围和遗留安排；不确认所有后续任务或发布通过。如需修改，可直接指出修改项。确认后由 Codex 记录你的原始答复、时间、本文摘要与范围摘要，按门禁推进，无需你填写六份角色文件。

范围摘要：\`${scope.scopeDigest}\`。功能输入变化须更新文稿；仅补充确认记录不更改已确认范围。

\`\`\`json
${JSON.stringify(draft,null,2)}
\`\`\`
`;
 for(const [path,bytes]of [[document,body],[scopeDocument,JSON.stringify(scope,null,2)+'\n']]){const absolute=resolve(root,path);if(existsSync(absolute))assert.equal(readFileSync(absolute,'utf8'),bytes,'existing confirmation draft must remain immutable');else writeFileSync(absolute,bytes);}
 writeFileSync(resolve(root,'docs/gate-records/G0-user-confirmation-draft-2026-10-05.md'),`# 当前 G0 用户确认文稿\n\n[打开待确认文稿](./${document.split('/').at(-1)})。文稿按日期/范围摘要独立保存，批准记录引用该版本原件。\n`);return {status:'DRAFT',document,scopeDigest:scope.scopeDigest};
}
export function validateConfirmations(c,request,p=policy(),readRecord=path=>readFileSync(confined(path))) {
 assert.equal(c.schema,'quantos-g0-scope-confirmations/v2');
 if(c.status==='PENDING'){assert.equal(c.scopeDigest,null);assert.equal(c.approval,null);assert(c.reason?.trim());return {status:'PENDING',missingApproval:'ProjectUser'};}
 assert.equal(c.status,'CONFIRMED');assert.equal(c.scopeDigest,request.scopeDigest,'scope confirmation input digest changed');
 return validateUserConfirmation(c.approval,confirmationRequest(request),readRecord);
}
export function validateManifest(m,{p=policy(),request=scopeRequest(p),confirmations=json('docs/gate-records/G0-current-scope-confirmations.json'),nodes=nodesFromPlans(),readBytes=path=>readFileSync(confined(path)),validateDependency=id=>validateReceipt(id,{nodes}),requireReady=false}={}) {
 const n=nodes.get('FRONTEND-GATE:G0');assert(n,'G0 checkpoint missing');
 assert.equal(m.schema,'quantos-g0-development-manifest/v1');assert.equal(m.nodeId,n.id);assert.equal(m.stage,'DEVELOPMENT');assert.equal(m.formalAccepted,false);assert.equal(m.engineeringStatus,'PASS');
 assert.deepEqual(m.planInput,planInput(n),'G0 functional plan changed');assert.deepEqual(m.scopeRequest,request,'G0 functional input inventory changed');
 assert.deepEqual(m.excluded,p.excluded);assert(/^[a-f0-9]{40}$/.test(m.observedSourceCommit),'G0 execution source required');
 assert(m.environment?.node && m.environment?.pnpm && m.environment?.platform && m.environment?.profile==='local-mock','G0 execution environment missing');
 assert(/^[a-f0-9]{40}$/.test(m.environment.protoBaseline) && m.environment.protoBaseline!==m.observedSourceCommit,'G0 explicit proto baseline required');
 const scope=validateConfirmations(confirmations,request,p,readBytes);assert.deepEqual(m.confirmations,scope,'scope confirmation state changed');
 assert.equal(digest(m.confirmationLedgerSnapshot),m.confirmationsSha256,'recorded confirmation snapshot changed');assert.deepEqual(JSON.parse(m.confirmationLedgerSnapshot),confirmations,'confirmation snapshot differs');
 assert.equal(m.confirmationsSha256,digest(readBytes('docs/gate-records/G0-current-scope-confirmations.json')),'confirmation file changed');
 const status=scope.status==='CONFIRMED'?'READY':'BLOCKED';assert.equal(m.status,status,'G0 READY requires current scope confirmation');
 assert.deepEqual(m.residuals,status==='READY'?[]:['M-01: project user development scope confirmation missing'],'G0 residual inventory differs');
 assert.deepEqual(m.checks.map(c=>c.id).sort(),Object.keys(p.checks).sort(),'G0 required functional execution missing or extra');
 for(const c of m.checks){const spec=p.checks[c.id];assert.deepEqual(c.command,spec.command,'G0 command differs from required check');assert.equal(c.exitCode,0,'G0 failed or unexecuted check');assert.equal(c.status,'PASS');assert(Number.isFinite(Date.parse(c.executedAt)) && Date.parse(c.executedAt)<=Date.now(),'G0 execution timestamp missing');
  assert(c.log.startsWith(evidenceDirectory+'/logs/'),'G0 log path outside evidence directory');const bytes=readBytes(c.log);assert.equal(digest(bytes),c.logSha256,'G0 log content changed');assert(new RegExp(spec.marker).test(bytes.toString()),`G0 execution marker missing ${c.id}`);
 }
 assert.equal(m.webBuild.schema,'quantos-pre03-build/v1');assert.equal(m.webBuild.app,'terminal');assert.equal(m.webBuild.output,'export');assert(m.webBuild.buildId);assert.equal(m.webBuild.sourceDigest,sourceDigest(root,developmentEnvironment(read(p.developmentProfile.file),p.developmentProfile.overrides)),'G0 Web PoC build source changed');
 assert.equal(m.webBuildSha256,digest(readBytes(evidenceDirectory+'/terminal-build.json')),'G0 build artifact changed');assert.deepEqual(JSON.parse(readBytes(evidenceDirectory+'/terminal-build.json')),m.webBuild);
 assert.deepEqual(m.dependencies.map(d=>d.nodeId).sort(),[...n.dependencies].sort(),'G0 dependency receipt missing');
 for(const d of m.dependencies){const dep=nodes.get(d.nodeId);assert.equal(dep.stage_gate.status,'READY','G0 dependency not READY');assert.equal(d.inputDigest,dep.stage_gate.input_digest,'G0 dependency digest changed');assert.equal(d.manifest,'docs/'+dep.stage_gate.evidence[0]);validateDependency(d.nodeId);}
 if(requireReady)assert.equal(status,'READY','G0 BLOCKED: project user scope confirmation missing');
 return {nodeId:n.id,engineeringStatus:'PASS',status,formalAccepted:false,missingApproval:scope.missingApproval,checks:m.checks.length};
}
export function check({requireReady=false}={}) {
 const nodes=nodesFromPlans();const gate=nodes.get('FRONTEND-GATE:G0').stage_gate;
 assert(['READY','BLOCKED'].includes(gate.status),'G0 functional assessment absent');assert.equal(gate.stage,'DEVELOPMENT');assert(gate.input_digest && gate.evidence.length===1,'G0 BLOCKED: current engineering replay and project user confirmation required');
 assert.equal('docs/'+gate.evidence[0],evidenceDirectory+'/g0.json','G0 cannot accept arbitrary/historical receipt');const bytes=readFileSync(confined('docs/'+gate.evidence[0]));assert.equal(digest(bytes),gate.input_digest,'G0 manifest digest mismatch');const m=JSON.parse(bytes);assert.equal(m.status,gate.status,'G0 plan/receipt status mismatch');return validateManifest(m,{nodes,requireReady});
}
export function assertG0ExecutionSnapshot(before,after,originalNode,currentNode) {
 assert.deepEqual(after,before,'G0 inputs changed during execution');
 assert.deepEqual(planInput(currentNode),planInput(originalNode),'G0 normative plan changed during execution');
}
export function assertG0Worktree(status) {
 const dirty=status.split('\n').filter(line=>line.trim());
 assert(dirty.every(line=>!line.includes(' -> ') && /^.. (?:docs\/audit\/|docs\/SumAlpha-QuantOS-(?:Frontend-Development-Execution|Development)-Plan\.md$)/.test(line)),'commit functional source before G0 execution');
}
export function assess() {
 const p=policy();const nodes=nodesFromPlans();const n=nodes.get('FRONTEND-GATE:G0');for(const dep of n.dependencies)validateReceipt(dep,{nodes});
 const before=scopeRequest(p);const confirmations=json('docs/gate-records/G0-current-scope-confirmations.json');const confirmed=validateConfirmations(confirmations,before,p);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assertG0Worktree(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}));
 const env=staticEnvironment(developmentEnvironment(read(p.developmentProfile.file),p.developmentProfile.overrides));env.CI='true';const protoBaseline=execFileSync('git',['rev-parse','--verify',`${source}^`],{encoding:'utf8'}).trim();env.QUANTOS_PROTO_BASE=protoBaseline;
 mkdirSync(resolve(root,evidenceDirectory,'logs'),{recursive:true});const checks=[];
 for(const [id,spec]of Object.entries(p.checks)){
  const executedAt=new Date().toISOString();const result=spawnSync(spec.command[0]==='node'?process.execPath:spec.command[0],spec.command.slice(1),{cwd:root,env,encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024});
  const output=(result.stdout??'')+(result.stderr??'');const log=evidenceDirectory+'/logs/'+id+'.log';writeFileSync(resolve(root,log),output);checks.push({id,command:spec.command,executedAt,status:result.status===0?'PASS':'FAIL',exitCode:result.status,log,logSha256:digest(output)});console.log(id,result.status);
  writeFileSync(resolve(root,evidenceDirectory,'execution-results.json'),JSON.stringify(checks,null,2)+'\n');assert.equal(result.status,0,`G0 check failed ${id}; see ${log}`);assert(new RegExp(spec.marker).test(output),`G0 execution marker missing ${id}`);
 }
 const after=scopeRequest(p);const currentNodes=nodesFromPlans();assertG0ExecutionSnapshot(before,after,n,currentNodes.get(n.id));assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,'G0 source commit changed during execution');
 const buildBytes=readFileSync(resolve(root,'apps/terminal/out/pre03-build.json'));writeFileSync(resolve(root,evidenceDirectory,'terminal-build.json'),buildBytes);
 const m={schema:'quantos-g0-development-manifest/v1',nodeId:n.id,stage:'DEVELOPMENT',status:confirmed.status==='CONFIRMED'?'READY':'BLOCKED',engineeringStatus:'PASS',formalAccepted:false,observedSourceCommit:source,
  environment:{node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,profile:'local-mock',databaseExecuted:false,protoBaseline},planInput:planInput(n),scopeRequest:before,confirmations:confirmed,confirmationLedgerSnapshot:read('docs/gate-records/G0-current-scope-confirmations.json'),confirmationsSha256:digest(readFileSync(confined('docs/gate-records/G0-current-scope-confirmations.json'))),checks,
  webBuild:JSON.parse(buildBytes),webBuildSha256:digest(buildBytes),dependencies:n.dependencies.map(id=>({nodeId:id,inputDigest:nodes.get(id).stage_gate.input_digest,manifest:'docs/'+nodes.get(id).stage_gate.evidence[0]})),excluded:p.excluded,residuals:confirmed.status==='CONFIRMED'?[]:['M-01: project user development scope confirmation missing']};
 validateManifest(m,{nodes:currentNodes});const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,evidenceDirectory,'g0.json'),bytes);
 n.stage_gate={stage:'DEVELOPMENT',status:m.status,input_digest:digest(bytes),evidence:[evidenceDirectory.slice(5)+'/g0.json']};
 const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';writeFileSync(resolve(root,plan),publishStages(read(plan),new Map([[n.id,n]]),'FE:'));
 writeFileSync(resolve(root,evidenceDirectory,'scope-request.json'),JSON.stringify(before,null,2)+'\n');console.log(JSON.stringify(check(),null,2));
}
export function applyConfirmation(m,{nodes=nodesFromPlans(),confirmations=json('docs/gate-records/G0-current-scope-confirmations.json'),ledgerBytes=read('docs/gate-records/G0-current-scope-confirmations.json'),readBytes=p=>readFileSync(confined(p)),...options}={}){
 assert.equal(m.status,'BLOCKED','only a completed pending engineering assessment can be finalized');
 const original=JSON.parse(m.confirmationLedgerSnapshot);assert.equal(original.status,'PENDING');
 validateManifest(m,{nodes,confirmations:original,readBytes:p=>p==='docs/gate-records/G0-current-scope-confirmations.json'?Buffer.from(m.confirmationLedgerSnapshot):readBytes(p),...options});
 const approved=validateConfirmations(confirmations,options.request??scopeRequest(),options.p??policy(),readBytes);assert.equal(approved.status,'CONFIRMED','current project user confirmation required');
 const updated={...m,status:'READY',residuals:[],confirmations:approved,confirmationLedgerSnapshot:ledgerBytes,confirmationsSha256:digest(ledgerBytes),confirmationAppliedAt:new Date().toISOString()};validateManifest(updated,{nodes,confirmations,readBytes,...options,requireReady:true});return updated;
}
export function finalize(){
 const nodes=nodesFromPlans();const n=nodes.get('FRONTEND-GATE:G0');if(n.stage_gate.status==='READY')return check({requireReady:true});
 const path=evidenceDirectory+'/g0.json';assert.deepEqual(n.stage_gate.evidence,[path.slice(5)]);const bytes=readFileSync(confined(path));assert.equal(digest(bytes),n.stage_gate.input_digest);const m=applyConfirmation(JSON.parse(bytes),{nodes});
 const archived=evidenceDirectory+'/pending-g0-'+digest(bytes).slice(7,19)+'.json';if(existsSync(resolve(root,archived)))assert.equal(readFileSync(resolve(root,archived),'utf8'),bytes.toString());else writeFileSync(resolve(root,archived),bytes);
 const updated=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),updated);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(updated),evidence:[path.slice(5)]};const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';writeFileSync(resolve(root,plan),publishStages(read(plan),new Map([[n.id,n]]),'FE:'));return check({requireReady:true});
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const mode=process.argv[2];assert(['--engineering','--ready','--assess','--finalize','--scope','--draft',undefined].includes(mode),'unknown G0 mode');if(mode==='--assess')assess();else if(mode==='--finalize')console.log(JSON.stringify(finalize(),null,2));else if(mode==='--draft')console.log(JSON.stringify(draftConfirmation(),null,2));else if(mode==='--scope')console.log(JSON.stringify(scopeRequest(),null,2));else console.log(JSON.stringify(check({requireReady:mode!=='--engineering'}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
