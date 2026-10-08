import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nodesFromPlans,validateReceipt} from './provider-a1-receipts.mjs';
export const handoff='R02 C25：代表性发布环境/数据规模/并发下，ID/hash/标的列表无缓存查询 P95<300ms；R02 C26：已部署 BFF/Runtime、真实登录 JWT/成员权限、跨租户拒绝与快照投影篡改拒绝的完整 HTTP 消费链。owner=CORE:R02，归 RELEASE-GATE:BETA，绑定候选完整源码 SHA 和远程同 SHA CI；发布环境/规模/并发/新范围授权未配置时不得记 PASS。';
export function checkStages({nodes=nodesFromPlans(), read=p=>readFileSync(p,'utf8')}={}) {
 const r02=nodes.get('CORE:R02'),beta=nodes.get('RELEASE-GATE:BETA');
 assert.deepEqual(r02.dependencies,['CORE:R01','CORE:F06','CORE-GATE:F0']);
 assert(r02.requirements.some(s=>s.includes('C26 开发范围')&&s.includes('RELEASE-GATE:BETA')),'R02 functional/release split missing');
 assert.equal(beta.stage_gate.stage,'RELEASE');assert(beta.required_scope.includes(handoff),'R02 release handoff missing');
 const frontend=read('docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md');assert(frontend.split(handoff).length>=3,'release prose/JSON handoff must agree');
 const test=read('crates/quantos-storage/tests/postgres_persistence.rs');
 assert(test.includes('R02_RELEASE_PERFORMANCE_NOT_RUN')&&test.includes('p95.as_millis() < 300'),'release threshold lost');
 assert(test.indexOf('R02_RELEASE_PERFORMANCE_NOT_RUN')<test.indexOf('for _ in 0..25'),'development executes release timing loop');
 const make=read('Makefile');assert(make.includes('r02-performance-diagnostic:')&&make.includes('r02-stage-check.mjs --release'),'diagnostic/release admission wiring missing');
 const dependencies=r02.dependencies.map(id=>({id,status:nodes.get(id)?.stage_gate.status}));
 return {schema:'quantos-r02-stage-disposition/v1',componentPolicy:'PASS',dependencies,admitted:false,
  release:{owner:'CORE:R02',checkpoint:'RELEASE-GATE:BETA',controls:['C25','C26_DEPLOYED'],status:beta.stage_gate.status},formalAccepted:false};
}
// This only validates existing strict dependency receipts. No command grants READY.
export function requireAdmission({nodes=nodesFromPlans(),validate=validateReceipt}={}) {
 for(const id of ['CORE:R01','CORE:F06','CORE-GATE:F0']) {assert.equal(nodes.get(id)?.stage_gate.status,'READY',`${id}: current dependency admission missing`);validate(id,{nodes});}
 return {scope:'dependency-receipt-validation',admitted:true,formalAccepted:false};
}
export function requireRelease(nodes=nodesFromPlans()) {
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','RELEASE-GATE:BETA not READY: provide representative performance and deployed service evidence at release');
 assert.equal(beta.review_status,'ACCEPTED','formal Beta acceptance missing');
 // Status inspection does not validate or grant whole-Beta admission.
 return {checkpoint:beta.checkpoint_id,status:beta.stage_gate.status,admitted:false,formalAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {const result=checkStages();if(process.argv.includes('--admission'))result.admission=requireAdmission();if(process.argv.includes('--release'))result.releaseRecord=requireRelease();console.log(JSON.stringify(result,null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
