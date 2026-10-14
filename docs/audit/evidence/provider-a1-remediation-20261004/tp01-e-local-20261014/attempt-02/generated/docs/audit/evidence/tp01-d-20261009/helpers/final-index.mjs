import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,nodesFromPlans,validateReceipt,closure,digest} from '/Users/anray/Documents/project/SumAlpha/QuantOS/scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/tp01-d-20261009';const nodes=nodesFromPlans();const selected=closure(nodes,'CORE:TP01-D');for(const id of selected)validateReceipt(id);const mpath='docs/'+nodes.get('CORE:TP01-D').stage_gate.evidence[0],dir=dirname(mpath);const json=p=>JSON.parse(readFileSync(resolve(root,p)));const m=json(mpath),checks=json(dir+'/execution-results.json');assert.equal(checks.length,62);assert(checks.every(c=>c.exitCode===0));const d=checks.find(c=>c.id==='tp01-d-absorption');const logs=d.supportingArtifacts.map(a=>a.path);const c=checks.find(c=>c.id==='tp01-c-skeleton');const rows=[
 ['D01','15 prerequisite receipts currently strict READY',selected.filter(id=>id!=='CORE:TP01-D').map(id=>'docs/'+nodes.get(id).stage_gate.evidence[0])],
 ['D02','Exactly two design entries match the current controlled baseline, clean Git link, source digests and QuantOS replacements',[logs.find(p=>p.endsWith('queue.log'))]],
 ['D03','20 fixtures repeat Execute twice and StreamExecute twice with stable outputs, streams and readable Artifact refs',[logs.find(p=>p.endsWith('replay.log'))]],
 ['D04','QuantOS tenant/workspace/actor/run/request/trace/snapshot/policy audit references and unchanged research tool boundary',[logs.find(p=>p.endsWith('replay.log'))]],
 ['D05','18 malformed provider contracts rejected through both RPCs before owner/input/Artifact registration; both projections validate independently',[logs.find(p=>p.endsWith('replay.log'))]],
 ['D06','Three trace identity changes on the same execution key rejected before an additional Artifact',[logs.find(p=>p.endsWith('replay.log'))]],
 ['D07','Source import boundary excludes upstream/runtime reuse and dynamic eval/import execution',[logs.find(p=>p.endsWith('replay.log'))]],
 ['D08','Real Runtime-to-Manager-to-RD-Agent performs ten research runs and cancellation within two seconds with vibe imports prohibited',[logs.find(p=>p.endsWith('runtime.log'))]],
 ['D09','All 307 Python Engine and 55 Rust Manager regressions, formatting, lint, type and lock checks pass',[c.artifact,...c.supportingArtifacts.map(a=>a.path)]],
 ['D10','16 source/log/dependency-bound gates, nine final negative probes and post-adapter scoped process closure',[mpath,base+'/final-gate-probes.json',checks.find(c=>c.id==='tp01-d-process-cleanup').artifact]],
];
writeFileSync(resolve(root,base+'/control-matrix.json'),JSON.stringify({schema:'quantos-tp01-d-development-control-matrix/v1',sourceCommit:m.observedSourceCommit,status:'DEVELOPMENT_READY',formalAccepted:false,controls:rows.map(([id,description,evidence])=>({id,description,status:'PASS',evidence:evidence.map(path=>({path,sha256:digest(readFileSync(resolve(root,path)))}))})),development:{pass:10,total:10},executedUniqueCheckGroups:62,excluded:m.excluded},null,2)+'\n');
const files=[...new Set([...execFileSync('git',['diff','--name-only','cd4e81900d1805d380c2bee0dd9abc14fe282dca'],{cwd:root,encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n'),base+'/changed-files.txt'])].filter(Boolean).sort();writeFileSync(resolve(root,base+'/changed-files.txt'),files.join('\n')+'\n');console.log(JSON.stringify({controls:10,checks:62,changedFiles:files.length,source:m.observedSourceCommit}));
