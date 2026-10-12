// Verify frozen inputs and byte-bound evidence without re-executing functional tests.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../../..');process.chdir(root);
const {digest,nodesFromPlans,planInput}=await import(root+'/scripts/provider-a1-receipts.mjs');
const base='docs/audit/evidence/local-development-20261012',json=p=>JSON.parse(readFileSync(p)),summary=json(base+'/summary.json'),nodes=nodesFromPlans();
assert.equal(summary.status,'PASS');assert.equal(summary.formalAccepted,false);assert.equal(summary.databaseExecution,false);
for(const f of summary.files)assert.equal(digest(readFileSync(f.path)),f.sha256,'evidence bytes changed: '+f.path);
const snapshot=json(base+'/source-snapshot.json'),inputs=new Map();
for(const n of snapshot.nodes){assert.deepEqual(n.planInput,planInput(nodes.get(n.nodeId)));const manifest=json(n.manifest);assert.equal(manifest.observedSourceCommit,summary.observedSourceCommit);for(const f of manifest.inputs)inputs.set(f.path,f);}
for(const f of inputs.values()){if(f.role==='third-party'){assert.equal(execFileSync('git',['-C',f.path,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),f.gitCommit);assert.equal(execFileSync('git',['-C',f.path,'status','--porcelain'],{encoding:'utf8'}).trim(),'');}else assert.equal(digest(readFileSync(f.path)),f.sha256,'frozen source changed: '+f.path);}
assert.deepEqual(snapshot.r04PlanInput,planInput(nodes.get('CORE:R04')));
const research=json('docs/audit/evidence/r03-20261011/manifest.json');assert.equal(research.observedSourceCommit,summary.observedSourceCommit);assert.deepEqual(research.planInput,planInput(nodes.get('CORE:R03')));for(const f of research.inputs)assert.equal(digest(readFileSync(f.path)),f.sha256);
const counts={};for(const n of nodes.values())counts[n.stage_gate.status]=(counts[n.stage_gate.status]??0)+1;assert.deepEqual(counts,{READY:4,NOT_ASSESSED:155});assert.equal(nodes.get('CORE:R04').stage_gate.status,'NOT_ASSESSED');
let history=0;for(const dir of readdirSync(base+'/history'))for(const f of json(base+'/history/'+dir+'/index.json').files){assert.equal(digest(readFileSync(f.path)),f.sha256);history++;}for(const f of json('docs/audit/evidence/f0-target-diagnostics-20261012/summary.json').files){assert.equal(digest(readFileSync(f.path)),f.sha256);history++;}
const final=json(base+'/final-checks.json');assert(final.every(c=>c.status==='PASS'&&c.allowedExitCodes.includes(c.exitCode)));assert.equal(final.find(c=>c.id==='r04-public-runtime-probe').requirementStatus,'GAPS_FOUND');
const changed=new Set(execFileSync('git',['diff','--name-only','f59000b4'],{encoding:'utf8'}).trim().split('\n').filter(Boolean));for(const p of execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))changed.add(p);assert.deepEqual(readFileSync(base+'/changed-files.txt','utf8').trim().split('\n'),[...changed].sort(),'changed-file list differs');assert(execFileSync('git',['diff','--name-only',summary.observedSourceCommit],{encoding:'utf8'}).trim().split('\n').filter(Boolean).every(p=>p.startsWith('docs/')),'code changed after frozen run');
console.log(JSON.stringify({status:'PASS',observedSourceCommit:summary.observedSourceCommit,sourceInputs:inputs.size,historicalBindings:history,currentBindings:summary.files.length,localChecks:56,researchChecks:7,finalChecks:final.length,stageCounts:counts,changedFiles:changed.size,formalAccepted:false}));
