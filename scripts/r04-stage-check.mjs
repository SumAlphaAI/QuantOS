// R04 local product completion. Target and performance evidence remain independent.
import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,inventory as sourceInventory,policy,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
import {admission} from './local-development-gate.mjs';
export const manifest='docs/audit/evidence/r04-completion-20261012/manifest.json';
export const selectors=()=>[...policy().commonInputs,'crates/quantos-runtime/','crates/quantos-storage/','crates/quantos-engine-manager/','engines/llmquant/src/','engines/trading-agents/src/','engines/rd-agent/src/','engines/engine-sdk/sdk_src/','engines/tests/','proto/','docs/audit/evidence/r04-preflight-20261012/attempt-02/signal-matrix.json','docs/audit/evidence/r04-preflight-20261012/attempt-02/proposal-matrix.json'];
export const inventory=()=>sourceInventory(selectors());
export const checks=[
 {id:'contracts',command:['cargo','test','-p','quantos-runtime','--locked','--test','signal_proposal_contracts'],marker:/11 passed; 0 failed/},
 {id:'orchestration',command:['cargo','test','-p','quantos-runtime','--locked','--test','signal_proposal_orchestration'],marker:/4 passed; 0 failed/},
 {id:'research-boundary',command:['engines/.venv/bin/python','-m','pytest','engines/tests/test_r04_research_context.py','-q'],marker:/16 passed/},
 {id:'receipt-negatives',command:['node','--test','scripts/r04-stage-check.test.mjs','scripts/execution-outcome.test.mjs','scripts/r04-orchestration-receipt.test.mjs'],marker:/(?:#|ℹ) fail 0/},
];
export const targetHandoff='R04 发布验收：Supabase持久Signal/Proposal与R03私有Artifact读回、RLS/事务/独立进程恢复、实际BFF及页面研究消费闭环、外部上游集成、代表性性能/容量/长稳与同SHA CI；本地合成Engine/内存服务READY仅供后续开发，目标和性能NOT_RUN，由RELEASE-GATE:BETA首次上线前实际验收。';
export function validateProducts(products) {
 const {matrix,consumption,orderDenial}=products;
 assert.equal(matrix.schema,'quantos-r04-proposal-matrix/v1');assert.equal(matrix.fixture,true);assert.equal(matrix.formalAccepted,false);assert.equal(matrix.databaseExecution,false);
 assert.equal(matrix.proposals.length,100);assert.equal(new Set(matrix.proposals.map(p=>p.proposal_id)).size,100);
 for(const p of matrix.proposals){assert.equal(p.executable,false);assert.equal(p.output.executable,false);assert(p.evidence_refs.length>0&&p.counter_views.length>0);assert(Date.parse(p.expires_at)>Date.parse(p.output.signal.generated_at));assert(Date.parse(p.expires_at)<=Date.parse(p.output.signal.valid_until));assert.equal(p.output.signal.signal_id,p.signal_id);}
 assert.equal(consumption.schema,'quantos-r04-research-consumption/v1');assert.equal(consumption.fixture,true);assert.equal(consumption.formalAccepted,false);assert.equal(consumption.databaseExecution,false);assert.equal(consumption.rejectedReferences,22);assert.equal(consumption.ordersExecuted,0);
 const {source,signal,proposal}=consumption,context=signal.output.diagnostics.value.research_context;
 assert.equal(context.schema_version,'v1');assert.equal(context.source.schema_version,'v1');assert.equal(context.source.workflow_run_id,source.workflow_run_id);assert.equal(context.source.artifact_id,source.artifact_manifest.artifact_id);assert.equal(context.source.content_hash,source.artifact_manifest.content_hash);
 // R03 canonical JSON uses sorted object keys, matching quantos-core.
 const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
 assert.equal(digest(JSON.stringify(canonical(source.output))),source.artifact_manifest.content_hash);
 for(const evidence of source.evidence_refs){for(const record of [signal,proposal])assert(record.evidence_refs.some(e=>e.evidence_id===evidence.evidence_id&&e.artifact_id===evidence.artifact_id&&e.summary===evidence.summary),'source evidence missing from output');}
 assert.deepEqual(context.evidence_refs,source.evidence_refs);assert(source.evidence_refs.length>0);assert.equal(context.summary,source.output.summary);assert.deepEqual(context.findings,source.output.findings);assert.equal(source.output.trade_executable,false);
 assert.deepEqual(proposal.output.signal,signal.output);assert.equal(proposal.executable,false);assert(proposal.counter_views.length>0);assert.equal(proposal.signal_artifact_id,signal.artifact_manifest.artifact_id);
 assert.equal(orderDenial.status,'REJECTED');assert.equal(orderDenial.tool,'order.execute');assert.equal(orderDenial.workflowStatus,'failed');assert.equal(orderDenial.proposalCreated,false);assert.match(orderDenial.lastError,/forbidden/);
 return true;
}
export function verify(r,{nodes=nodesFromPlans(),currentInputs=inventory(),prerequisites=admission(),read=p=>{const file=realpathSync(resolve(root,p));assert(file.startsWith(realpathSync(resolve(root,r.attempt))+sep),'evidence escaped attempt');return readFileSync(file);},productsValidator=validateProducts}={}) {
 assert.equal(r.schema,'quantos-r04-development/v1');assert.equal(r.nodeId,'CORE:R04');assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,'R04_LOCAL');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);assert.equal(r.production,false);assert.equal(r.databaseExecution,false);
 assert(/^[a-f0-9]{40}$/.test(r.observedSourceCommit));assert.deepEqual(r.inputs,currentInputs,'R04 source drift');assert.deepEqual(r.planInput,planInput(nodes.get('CORE:R04')),'R04 normative scope changed');
 assert.equal(prerequisites.admission,'READY');assert.equal(prerequisites.observedSourceCommit,r.observedSourceCommit,'R04 prerequisite candidate differs');
 assert(/^[a-f0-9]{8}$/.test(r.engineProcessScope),'invalid Engine process scope');
 assert(/^docs\/audit\/evidence\/r04-completion-20261012\/attempt-[a-z0-9-]+$/.test(r.attempt),'invalid R04 attempt');
 const safe=p=>{assert(p.startsWith(r.attempt+'/')&&!p.includes('..')&&!p.includes('\\')&&!p.startsWith('/'),'unsafe R04 evidence');return p;};
 const readBound=bound=>{const bytes=read(safe(bound.path));assert.equal(digest(bytes),bound.sha256,'R04 evidence changed');return bytes;};
 assert.deepEqual(r.prerequisites.map(x=>x.nodeId),['CORE:R03','CORE:TP03','CORE:TP04','CORE-GATE:F0']);
 const expected=nodes.get('CORE:R04').dependencies.map(nodeId=>({nodeId,inputDigest:nodes.get(nodeId).stage_gate.input_digest}));assert.deepEqual(r.prerequisites,expected,'R04 prerequisite manifest changed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,targetHandoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(targetHandoff),'R04 release obligation removed');
 assert.deepEqual(r.checks.map(x=>x.id),checks.map(x=>x.id));
 for(const [i,c]of r.checks.entries()){assert.deepEqual(c.command,checks[i].command);assert.equal(c.exitCode,0);assert.equal(c.status,'PASS');assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());const log=readBound(c.log).toString();assert.match(log,checks[i].marker);assert(!log.includes('test result: FAILED'));}
 assert.deepEqual(Object.keys(r.products).sort(),['consumption','matrix','orderDenial']);const products=Object.fromEntries(Object.entries(r.products).map(([k,b])=>[k,JSON.parse(readBound(b))]));productsValidator(products);
 const cleanup=JSON.parse(readBound(r.cleanup));assert.equal(cleanup.schema,'quantos-r1-process-cleanup/v1');assert.equal(cleanup.sourceCommit,r.observedSourceCommit);assert.equal(cleanup.scopeTag,r.engineProcessScope);assert.equal(cleanup.status,'PASS');assert.equal(cleanup.processCheckingExecuted,true);assert.equal(cleanup.formalAccepted,false);assert.deepEqual(cleanup.discovered,[]);assert.deepEqual(cleanup.remaining,[]);
 return {nodeId:'CORE:R04',stageGate:'READY',profile:'R04_LOCAL',observedSourceCommit:r.observedSourceCommit,proposals:100,researchConsumption:'PASS',publicValidatorRegressions:11,databaseAcceptance:'NOT_RUN',externalAcceptance:'NOT_RUN',performanceAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false};
}
export function verifyPublished(){const nodes=nodesFromPlans(),gate=nodes.get('CORE:R04').stage_gate;assert.equal(gate.status,'READY','R04 completion not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'R04 published receipt changed');return verify(JSON.parse(bytes),{nodes});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--release')throw Error('R04 Supabase/external/performance release evidence NOT_RUN; local completion cannot authorize release');console.log(JSON.stringify(verifyPublished(),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
