import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {validateFrontendHandoffs,baseline,boundary,planPath} from './check-frontend-gate-handoff.mjs';
const text=readFileSync(planPath,'utf8'),policy=JSON.parse(readFileSync('scripts/frontend-gate-handoff-policy.json')),original=baseline(),core=readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8');
const check=(t=text,p=policy,c=core)=>validateFrontendHandoffs(t,p,{original,core:c});
test('64 later tasks and 16 checkpoints preserve functional and release obligations',()=>assert.deepEqual([check().tasks,check().checkpoints],[64,16]));
for(const [name,mutate]of [
 ['missing task',p=>p.tasks.pop()],['duplicate task',p=>p.tasks.push(p.tasks[0])],['external early gate',p=>p.tasks[0].externalEarlyGate=true],['performance early gate',p=>p.tasks[0].performanceEarlyGate=true],['fake target PASS',p=>p.tasks[0].targetStatus='PASS'],['missing owner',p=>p.tasks[0].owner=''],['wrong release phase',p=>p.tasks[0].releaseCheckpoint='DEVELOPMENT'],['testnet moved into Beta',p=>p.tasks.at(-1).releaseCheckpoint='RELEASE-GATE:BETA'],['authorization deferred',p=>p.earlyRequired.splice(2,1)],['missing checkpoint',p=>p.checkpoints.pop()],['checkpoint fake PASS',p=>p.checkpoints[0].targetStatus='PASS'],['release obligation dropped',p=>p.releaseRequirements=p.releaseRequirements.replace('真实IdP/Auth/私有Storage','')],['changed baseline',p=>p.baselineSourceCommit='a'.repeat(40)],
])test('rejects '+name,()=>{const p=structuredClone(policy);mutate(p);assert.throws(()=>check(text,p));});
test('removing explicit phase boundary fails',()=>assert.throws(()=>check(text.replace('- 验收边界：'+boundary,''))));
test('new future task cannot escape coverage',()=>assert.throws(()=>check(text+'\n<a id="task-new"></a>\n- task_id: `NEW`')));
test('numerical performance target cannot disappear',()=>assert.throws(()=>check(text.replace('大表滚动保持 ≥55 FPS','大表滚动可用'))));
test('coordinated document and policy weakening cannot erase original task criteria',()=>{const p=structuredClone(policy),old=p.tasks[0].requirements.at(-1),next=old.replace('断流可回补且不拼接','按需回补');p.tasks[0].requirements[p.tasks[0].requirements.length-1]=next;assert.throws(()=>check(text.replace(old,next),p));});
test('core Live release owner cannot be removed',()=>assert.throws(()=>check(text,policy,core.replaceAll(policy.releaseHandoff,''))));
test('actual testnet early gate cannot return',()=>assert.throws(()=>check(text.replace('G8 在 I10 以本机真实 UI/BFF/服务组合','G8 在 I10 完成获准 testnet 范围内的真实功能联调'))));
test('new external normative gate cannot be injected',()=>assert.throws(()=>check(text.replace('- 需求描述：instrument catalog/watchlist','- 验收标准：必须先通过真实staging环境\n- 需求描述：instrument catalog/watchlist'))));
