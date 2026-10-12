import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {validateHandoffs} from './check-development-gate-handoff.mjs';
const text=readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8'),policy=JSON.parse(readFileSync('scripts/development-gate-handoff-policy.json'));
test('all 22 later tasks retain explicit development testing release obligations',()=>assert.equal(validateHandoffs(text,policy).tasks,22));
for(const [name,mutate]of [
 ['missing task',p=>p.tasks.pop()],['duplicate task',p=>p.tasks.push(p.tasks[0])],['external early gate',p=>p.tasks[0].externalDevelopmentGate=true],['performance early gate',p=>p.tasks[0].performanceDevelopmentGate=true],['fake target PASS',p=>p.tasks[0].targetStatus='PASS'],['missing release owner',p=>p.tasks[0].releaseCheckpoint='CORE:R04'],['missing testing',p=>p.tasks[0].testing=''],['weakened current scope',p=>p.tasks[0].development+=' waived'],['missing authorization',p=>p.earlyRequired=p.earlyRequired.filter(x=>x!=='authorization')],['missing idempotency',p=>p.earlyRequired=p.earlyRequired.filter(x=>x!=='idempotency-recovery')],['deleted performance obligation',p=>p.tasks.find(x=>x.nodeId==='CORE:X01').release='optional'],
])test('rejects '+name,()=>{const p=structuredClone(policy);mutate(p);assert.throws(()=>validateHandoffs(text,p));});
test('new future task cannot escape coverage',()=>assert.throws(()=>validateHandoffs(text+'\n- task_id: `NEW`',policy)));
test('removing normative task boundary fails',()=>assert.throws(()=>validateHandoffs(text.replace('- 验收边界：外部环境与性能指标不阻塞本地开发；原量化目标保留，目标回执 NOT_RUN。',''),policy)));
test('checkpoint handoff cannot be removed',()=>{const p=structuredClone(policy);p.checkpoints.pop();assert.throws(()=>validateHandoffs(text,p));});
test('checkpoint cannot move targets back into development',()=>{const p=structuredClone(policy);p.checkpoints[0].handoff='development requires actual Supabase target execution';assert.throws(()=>validateHandoffs(text,p));});
