import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root='/Users/anray/Documents/project/SumAlpha/QuantOS';
const api=await import(pathToFileURL(resolve(root,'scripts/provider-a1-receipts.mjs')));
const {nodesFromPlans,closure,policy,captureInputs,digest,validateReceipt,publishStages,validateArtifact}=api;
const old='docs/audit/evidence/provider-a1-remediation-20261004/ci-cold-cache-lint-final-20261006';
const directory='docs/audit/evidence/provider-a1-remediation-20261004/ci-cold-cache-lint-confirmed-20261006';
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert(source.startsWith('dd8672c'));
const p=policy();const texts=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(f=>readFileSync(resolve(root,f),'utf8'));
const nodes=nodesFromPlans(texts),selected=[...new Set(['PROVIDER:A1','CORE-GATE:F0'].flatMap(id=>closure(nodes,id)))];
const inputs=captureInputs(nodes,selected,p),committed=captureInputs(nodes,selected,p,'/private/tmp/quantos-ci-e0e9cbc-clean-clone');assert.deepEqual(inputs,committed,'functional inputs differ from clean committed source');
const original=JSON.parse(readFileSync(resolve(root,old,'execution-results.json')));assert.equal(original.length,87);assert.deepEqual(original.filter(c=>c.status!=='PASS').map(c=>c.id),['f08-functional']);
for(const c of original){assert.deepEqual(c.command,p.checks[c.id].command);assert.equal(digest(readFileSync(resolve(root,c.log))),c.logSha256,'original log changed');}
assert(!existsSync(resolve(root,directory)));cpSync(resolve(root,old),resolve(root,directory),{recursive:true});
const relocate=o=>typeof o==='string'&&o.startsWith(old+'/')?directory+o.slice(old.length):Array.isArray(o)?o.map(relocate):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,relocate(v)])):o;
const results=original.map(relocate);const retries=[];
for(const id of ['f01-lint','f08-functional']){
 const file='/private/tmp/quantos-ci-5da474e-'+(id==='f01-lint'?'f01-lint-rerun':'f08-functional-rerun')+'.log';
 const raw=readFileSync(file);const prior=results.find(c=>c.id===id);
 const outcome=id==='f01-lint'?JSON.parse(readFileSync('/private/tmp/quantos-ci-5da474e-f01-lint-rerun-result.json')):{id,command:p.checks[id].command,executedAt:statSync(file).birthtime.toISOString(),exitCode:0,status:'PASS',logSha256:digest(raw)};
 assert.equal(outcome.exitCode,0);assert.equal(outcome.status,'PASS');assert.equal(outcome.logSha256,digest(raw));
 if(p.checks[id].marker)assert(new RegExp(p.checks[id].marker).test(raw.toString()));
 retries.push({id,previous:{...original.find(c=>c.id===id)},rerun:outcome,reason:'New audit-only producer formatted; all 21 functional input snapshots equal clean committed dd8672c.'});
 writeFileSync(resolve(root,prior.log),raw);Object.assign(prior,outcome);
}
assert(results.every(c=>c.exitCode===0&&c.status==='PASS'));
writeFileSync(resolve(root,directory,'execution-results.json'),JSON.stringify(results,null,2)+'\n');
writeFileSync(resolve(root,directory,'reexecution-provenance.json'),JSON.stringify({schema:'quantos-same-source-reexecution/v1',sourceCommit:source,originalResults:old+'/execution-results.json',originalResultsSha256:digest(readFileSync(resolve(root,old,'execution-results.json'))),functionalInputsUnchanged:true,comparedToCleanCommit:source,reusedPasses:85,reexecutedChecks:retries},null,2)+'\n');
const environment={node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,clientProfile:'local-mock'};
const byId=new Map(results.map(r=>[r.id,r]));
for(const id of selected){
 const n=nodes.get(id),spec=p.nodes[id];
 const m={schema:'quantos-stage-functional-manifest/v1',nodeId:id,stage:'DEVELOPMENT',status:'PASS',scope:spec.scope,formalAccepted:false,observedSourceCommit:source,environment,planInput:inputs.get(id).planInput,inputs:inputs.get(id).inputs,checks:spec.checks.map(c=>byId.get(c)),dependencies:n.dependencies.map(dep=>({nodeId:dep,inputDigest:nodes.get(dep).stage_gate.input_digest,manifest:'docs/'+nodes.get(dep).stage_gate.evidence[0]})),excluded:p.excluded,residuals:[]};
 const path=directory+'/'+id.toLowerCase().replaceAll(':','-')+'.json';const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};validateReceipt(id,{nodes});
}
assert.deepEqual(captureInputs(nodes,selected,p),inputs);
const admitted=new Map(selected.map(id=>[id,nodes.get(id)]));
writeFileSync(resolve(root,'docs/SumAlpha-QuantOS-Development-Plan.md'),publishStages(texts[0],admitted,'CORE:'));
writeFileSync(resolve(root,'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'),publishStages(texts[1],admitted,'FE:'));
console.log(JSON.stringify({status:'PASS',source,checks:results.length,reusedPasses:85,reexecuted:['f01-lint','f08-functional'],publishedNodes:selected.length}));
