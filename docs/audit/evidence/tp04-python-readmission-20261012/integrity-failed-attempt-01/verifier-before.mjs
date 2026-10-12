// Verify the frozen source and documentary failure records without rerunning targets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,digest,inventory,nodesFromPlans,planInput,policy} from '../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/tp04-python-readmission-20261012';
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const summary=read(base+'/summary.json'), snapshot=read(summary.sourceSnapshot.path), historical=read(base+'/historical-files.json');
assert.equal(digest(readFileSync(resolve(root,summary.sourceSnapshot.path))),summary.sourceSnapshot.sha256);
const nodes=nodesFromPlans(),p=policy();
const selectors=[...new Set([...p.commonInputs,...summary.closure.flatMap(id=>p.nodes[id].inputs)])];
assert.deepEqual(inventory(selectors),snapshot.inputs);
for(const n of snapshot.planInputs)assert.deepEqual(planInput(nodes.get(n.nodeId)),n.planInput);
for(const f of [...summary.files,...historical.files,...read(base+'/red/receipt.json').files])assert.equal(digest(readFileSync(resolve(root,f.path))),f.sha256,f.path);
for(const id of summary.roots){const n=nodes.get(id);assert.equal(n.stage_gate.status,'BLOCKED');assert.equal(n.stage_gate.evidence.length,1);const f='docs/'+n.stage_gate.evidence[0];assert.equal(digest(readFileSync(resolve(root,f))),n.stage_gate.input_digest);const m=read(f);assert.equal(m.nodeId,id);assert.equal(m.formalAccepted,false);assert.equal(m.observedSourceCommit,summary.observedSourceCommit);assert.deepEqual(m.planInput,planInput(n));}
for(const id of ['CORE:R03','CORE:R04'])assert.equal(nodes.get(id).stage_gate.status,'NOT_ASSESSED');
const counts={};for(const n of nodes.values()){const status=n.stage_gate.status;counts[status]=(counts[status]??0)+1;}
assert.deepEqual(counts,{NOT_ASSESSED:156,BLOCKED:3});
const checks=read(base+'/final-checks.json');assert(checks.every(c=>c.expectationMet));
for(const c of checks)assert(existsSync(resolve(root,c.log)));
const report='docs/audit/TP04-python-receipt-readmission-2026-10-12.md';
for(const m of readFileSync(resolve(root,report),'utf8').matchAll(/\]\((\.[^\s)]+)\)/g))assert(existsSync(resolve(root,dirname(report),m[1].split('#')[0])),'missing report link '+m[1]);
const productChanges=execFileSync('git',['diff',summary.observedSourceCommit,'--name-only'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert(productChanges.every(path=>path.startsWith('docs/')),'evidence follow-up changed product source');
const result={schema:'quantos-tp04-readmission-integrity/v1',status:'PASS',formalAccepted:false,observedSourceCommit:summary.observedSourceCommit,sourceInputCount:snapshot.inputs.length,planInputCount:snapshot.planInputs.length,hashedEvidenceChecks:summary.files.length+historical.files.length+read(base+'/red/receipt.json').files.length,stageStatusCounts:{READY:0,...counts},finalCommandExpectations:checks.length,productSourceUnchanged:true,reportLinks:'PASS'};
if(!process.argv.includes('--verify-only'))writeFileSync(resolve(root,base,'integrity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
