import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function validateHandoffs(text,policy){
 assert.equal(policy.schema,'quantos-development-handoffs/v1');assert.equal(policy.after,'CORE:R04');
 const suffix=text.slice(text.indexOf('<a id="task-r04"></a>'));
 const ids=[...suffix.matchAll(/^- task_id: `([^`]+)`/gm)].map(x=>'CORE:'+x[1]).slice(1);
 assert.deepEqual(policy.tasks.map(r=>r.nodeId),ids,'all tasks after R04 must have exactly one handoff row');
 for(const row of policy.tasks){
  const id=row.nodeId.slice(5).toLowerCase(),start=text.indexOf('<a id="task-'+id+'"></a>'),end=text.indexOf('<a id=',start+10),card=text.slice(start,end<0?undefined:end);
  assert(row.development.length>20&&row.testing.length>20&&row.release.length>20,'explicit phase requirements required');
  assert.equal(row.externalDevelopmentGate,false,'external environment cannot block development');assert.equal(row.performanceDevelopmentGate,false,'performance cannot block development');
  assert.equal(row.targetStatus,'NOT_RUN');assert(['RELEASE-GATE:BETA','RELEASE-GATE:LIVE-READINESS'].includes(row.releaseCheckpoint));
  assert(card.includes('- 阶段执行：'+row.development+' 测试阶段：'+row.testing+' 发布阶段：'+row.releaseCheckpoint+'；'+row.release),'task handoff differs from required policy: '+row.nodeId);
  assert(card.includes('- 验收边界：外部环境与性能指标不阻塞本地开发；原量化目标保留，目标回执 NOT_RUN。'),'external/performance boundary missing: '+row.nodeId);
 }
 const checkpoints=[...suffix.matchAll(/```json\n([\s\S]*?)\n```/g)].map(x=>JSON.parse(x[1])).filter(x=>x.checkpoint_id);
 assert.deepEqual(policy.checkpoints.map(r=>r.checkpointId),checkpoints.map(x=>x.checkpoint_id),'all later checkpoints require phase disposition');
 for(const [i,row]of policy.checkpoints.entries()){assert.equal(row.stage,checkpoints[i].stage_gate.stage);assert(row.handoff.length>30);assert(checkpoints[i].required_scope.includes(row.handoff),'checkpoint handoff changed: '+row.checkpointId);}
 for(const obligation of ['contracts','data-integrity','authorization','idempotency-recovery','deadline-semantics'])assert(policy.earlyRequired.includes(obligation),'functional safety requirement deferred: '+obligation);
 assert(text.includes('Supabase 目标验收统一归最终发布阶段'),'Supabase final release boundary missing');
 assert(text.includes('INTEGRATION 是测试阶段'),'test phase definition missing');
 return {status:'PASS',tasks:ids.length,checkpoints:checkpoints.length,externalDevelopmentGates:0,performanceDevelopmentGates:0,targetAcceptance:'NOT_RUN'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(validateHandoffs(readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8'),JSON.parse(readFileSync('scripts/development-gate-handoff-policy.json')))));}catch(e){console.error(e.message);process.exitCode=1;}}
