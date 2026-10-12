import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const planPath='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
export const baselineCommit='a099f39b773c072a3cdf38174b462766c7a5af3c';
export const boundary='外部环境及性能指标全部移交RELEASE；DEVELOPMENT与INTEGRATION只验证本机真实模块的功能、契约、权限、数据完整性、幂等/恢复和deadline语义；目标回执NOT_RUN，不代替正式ACCEPTED。';
const requirements=card=>card.split('\n').filter(x=>/^- (需求描述|量化验收标准|集成验收标准|验收标准|完成标准|目标阶段与验收|验收重点|页面级完成标准|交付节点与放行条件|技术要求|交付物)：/.test(x));
export function cards(text){
 const start=text.indexOf('<a id="task-bff-fe-005"></a>');assert(start>=0,'handoff start missing');
 return text.slice(start).split(/(?=<a id="(?:task|acceptance)-)/).map(card=>({card,id:/^- task_id: `([^`]+)`/m.exec(card)?.[1]})).filter(x=>x.id);
}
export const baseline=()=>execFileSync('git',['show',baselineCommit+':'+planPath],{encoding:'utf8',maxBuffer:4*1024*1024});
export function validateFrontendHandoffs(text,policy,{original=baseline(),core=readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8')}={}){
 assert.equal(policy.schema,'quantos-frontend-development-handoffs/v1');assert.equal(policy.after,'FE:BFF-FE-003');assert.equal(policy.baselineSourceCommit,baselineCommit);
 assert.deepEqual(policy.earlyRequired,['contracts','data-integrity','authorization','idempotency-recovery','deadline-semantics']);
 const current=cards(text),before=cards(original);
 assert.deepEqual(current.map(x=>x.id),before.map(x=>x.id),'later task inventory changed; review handoff coverage');
 assert.deepEqual(policy.tasks.map(x=>x.nodeId),current.map(x=>'FE:'+x.id),'missing/duplicate task handoff');
 for(const [i,row]of policy.tasks.entries()){
  const {card,id}=current[i];assert.equal(row.owner,row.nodeId);assert.equal(row.releaseCheckpoint,id==='FEP-8'?'RELEASE-GATE:LIVE-READINESS':'RELEASE-GATE:BETA');
  assert.equal(row.externalEarlyGate,false);assert.equal(row.performanceEarlyGate,false);assert.equal(row.targetStatus,'NOT_RUN');assert.equal(row.boundary,boundary);
  assert.deepEqual(requirements(card),row.requirements,'task requirement drift: '+id);
  // Every historical obligation survives. FEP-8 changes only its stage of actual testnet execution.
  if(id!=='FEP-8')assert.deepEqual(row.requirements,requirements(before[i].card),'original obligation removed: '+id);
  else {assert.deepEqual(row.requirements.slice(0,-1),requirements(before[i].card).slice(0,-1));assert(row.requirements.at(-1).includes('实际 testnet 连接、运行与全部环境/性能验收归 RELEASE-GATE:LIVE-READINESS'));}
  assert.equal(row.phaseLine,`- 阶段执行：本机功能实现与真实模块组合验证；受影响成功/拒绝/恢复及基本浏览器用例必须通过；合成数据及受控边界的结果注明范围。发布阶段：${row.releaseCheckpoint}；${policy.releaseRequirements}`);
  assert(card.includes(row.phaseLine+'\n- 验收边界：'+boundary),'phase boundary removed: '+id);
 }
 const checkpoints=t=>[...t.slice(t.indexOf('<a id="task-bff-fe-005">')).matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1])).filter(x=>x.checkpoint_id);
 const cps=checkpoints(text),oldcps=checkpoints(original);
 assert.deepEqual(cps.map(x=>x.checkpoint_id),oldcps.map(x=>x.checkpoint_id));assert.deepEqual(policy.checkpoints.map(x=>x.checkpointId),cps.map(x=>x.checkpoint_id));
 for(const [i,row]of policy.checkpoints.entries()){
  const cp=cps[i];assert.equal(row.releaseCheckpoint,cp.checkpoint_id==='FRONTEND-GATE:G8'?'RELEASE-GATE:LIVE-READINESS':'RELEASE-GATE:BETA');assert.equal(row.targetStatus,'NOT_RUN');assert.equal(row.stage,cp.stage_gate.stage);assert.equal(cp.required_scope,row.requiredScope);assert(text.includes(cp.required_scope+'\n\n```json'),'checkpoint prose differs');
  assert.deepEqual(cp.depends_on,oldcps[i].depends_on,'functional dependencies removed');
  if(cp.stage_gate.stage!=='RELEASE')assert(cp.required_scope.includes(boundary));
  if(row.checkpointId!=='FRONTEND-GATE:G8')assert(cp.required_scope.startsWith(oldcps[i].required_scope),'original checkpoint obligation removed');
  else {assert(cp.required_scope.startsWith('G8 在 I10 以本机真实 UI/BFF/服务组合'));assert(cp.required_scope.includes('实际运行仍须有效范围授权，不启用生产实盘')); assert.equal(row.releaseCheckpoint,'RELEASE-GATE:LIVE-READINESS');assert(cp.required_scope.includes('实际 testnet 连接和运行、外部环境、性能/长稳/部署与正式签署全部归 RELEASE-GATE:LIVE-READINESS'));}
 }
 const perf=t=>t.slice(t.indexOf('### 7.4 '),t.indexOf('### 7.5 ')).split('\n').filter(x=>x.startsWith('|'));
 assert.deepEqual(perf(text),perf(original),'original numerical performance targets removed');
 for(const term of ['Supabase/PostgreSQL迁移/RLS/事务','真实IdP/Auth/私有Storage','外部数据源/venue/testnet','staging/部署','远程同SHA CI','全部性能/容量/长稳/恢复时限','原阈值不降低，未执行NOT_RUN'])assert(policy.releaseRequirements.includes(term),'release obligation missing: '+term);
 assert(cps.find(x=>x.checkpoint_id==='RELEASE-GATE:BETA').required_scope.includes(policy.releaseHandoff));assert(policy.releaseHandoff.length>80);
 assert(core.includes(policy.releaseHandoff),'core Live release owner missing');assert(text.includes('### 2.3 BFF-FE-003 后续任务的发布移交契约'));
 assert(!text.includes('G8 在 I10 完成获准 testnet 范围内的真实功能联调'),'testnet early gate restored');
 return {status:'PASS',after:policy.after,tasks:current.length,checkpoints:cps.length,externalEarlyGates:0,performanceEarlyGates:0,targetAcceptance:'NOT_RUN',formalAccepted:false};
}
export function checkFrontendHandoffs(){return validateFrontendHandoffs(readFileSync(planPath,'utf8'),JSON.parse(readFileSync('scripts/frontend-gate-handoff-policy.json')));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(checkFrontendHandoffs()));}catch(e){console.error(e.message);process.exitCode=1;}}
