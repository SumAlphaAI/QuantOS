import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {root,policy,nodesFromPlans,closure,captureInputs,planInput,digest,validateReceipt,publishStages} from '../../../../../scripts/provider-a1-receipts.mjs';
const runtime='9d67f880fb2b6532114f3f7b7e46ecf952176e1f';
const original='docs/audit/evidence/provider-a1-remediation-20261004/a2-final-20261005';
const out='docs/audit/evidence/provider-a1-remediation-20261004/a2-metadata-revalidated-20261005';
const metadata='docs/PRE-04-inventory-baseline.json';
const oldMeta=JSON.parse(execFileSync('git',['show',runtime+':'+metadata],{cwd:root}));const newMeta=JSON.parse(readFileSync(resolve(root,metadata)));
const before=structuredClone(oldMeta),after=structuredClone(newMeta);delete before.openapiDigest;delete after.openapiDigest;assert.deepEqual(before,after,'only the derived identity may change');
const oldApi=YAML.parse(execFileSync('git',['show','de74b112dab8e4ec5141142cdced75f59b58626c:bff/openapi/quantos-bff.v1.yaml'],{cwd:root,encoding:'utf8'}));
const currentApi=YAML.parse(readFileSync(resolve(root,'bff/openapi/quantos-bff.v1.yaml'),'utf8'));const noDescription=structuredClone(currentApi);delete noDescription.components.schemas.SecuritySettings.properties.lastVerifiedAt.description;assert.deepEqual(noDescription,oldApi,'unexpected wire or contract change');assert.equal(newMeta.openapiDigest,digest(JSON.stringify(currentApi)).slice(7));assert.equal(oldMeta.openapiDigest,digest(JSON.stringify(oldApi)).slice(7));
const nodes=nodesFromPlans(),p=policy(),selected=closure(nodes),inputs=captureInputs(nodes,selected,p),changed=new Set(),snapshots=new Map();
for(const snapshot of inputs.values())for(const input of snapshot.inputs){
 if(snapshots.has(input.path))continue;
 if(input.gitCommit){assert.equal(execFileSync('git',['rev-parse',runtime+':'+input.path],{cwd:root,encoding:'utf8'}).trim(),input.gitCommit);snapshots.set(input.path,input);continue;}
 const prior=digest(execFileSync('git',['show',runtime+':'+input.path],{cwd:root,maxBuffer:32*1024*1024}));
 if(prior!==input.sha256){assert.equal(input.path,metadata,'runtime/config/test/build inputs changed: '+input.path);changed.add(input.path);}
 snapshots.set(input.path,{...input,executedSourceSha256:prior});
}
assert.deepEqual([...changed],[metadata]);
const texts=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
const previousNodes=nodesFromPlans(texts.map(path=>execFileSync('git',['show',runtime+':'+path],{cwd:root,encoding:'utf8'})));
for(const id of selected)assert.deepEqual(planInput(nodes.get(id)),planInput(previousNodes.get(id)),'functional requirements changed');
const results=JSON.parse(readFileSync(resolve(root,original,'execution-results.json')));assert.equal(results.length,65);assert.deepEqual(results.filter(c=>c.status!=='PASS').map(c=>c.id).sort(),['pre04','pre04-negative']);
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
for(const c of results){
 assert.deepEqual(c.command,p.checks[c.id].command);const path=out+'/logs/'+c.id+'.log';
 if(['pre04','pre04-negative'].includes(c.id)){
  const executedAt=new Date().toISOString();const r=spawnSync(c.command[0],c.command.slice(1),{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});const bytes=(r.stdout??'')+(r.stderr??'');writeFileSync(resolve(root,path),bytes);assert.equal(r.status,0,bytes);
  Object.assign(c,{exitCode:0,status:'PASS',executedAt,log:path,logSha256:digest(bytes),executedSourceCommit:source,revalidation:'re-executed after derived metadata correction'});
 }else{const bytes=readFileSync(resolve(root,c.log));assert.equal(digest(bytes),c.logSha256);assert.equal(c.exitCode,0);cpSync(resolve(root,c.log),resolve(root,path));Object.assign(c,{log:path,executedSourceCommit:runtime,revalidation:'retained execution; all runtime/config/test/build input bytes unchanged'});}
}
const revalidation={schema:'quantos-metadata-only-revalidation/v1',runtimeExecutedCommit:runtime,metadataCommit:source,changedInput:metadata,changedField:'/openapiDigest',originalDigest:oldMeta.openapiDigest,currentDigest:newMeta.openapiDigest,wireStructureUnchanged:true,retainedExecutedChecks:63,reexecutedChecks:['pre04','pre04-negative'],status:'PASS',inputSnapshot:[...snapshots.values()],replay:out+'/replay.mjs',replaySha256:digest(readFileSync(new URL(import.meta.url)))};
writeFileSync(resolve(root,out,'revalidation.json'),JSON.stringify(revalidation,null,2)+'\n');writeFileSync(resolve(root,out,'execution-results.json'),JSON.stringify(results,null,2)+'\n');
const environment={node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,clientProfile:'local-mock'};
for(const id of selected){const n=nodes.get(id),spec=p.nodes[id];const m={schema:'quantos-stage-functional-manifest/v1',nodeId:id,stage:'DEVELOPMENT',status:'PASS',scope:spec.scope,formalAccepted:false,observedSourceCommit:runtime,environment,...inputs.get(id),checks:spec.checks.map(check=>results.find(c=>c.id===check)),dependencies:n.dependencies.map(dep=>({nodeId:dep,inputDigest:nodes.get(dep).stage_gate.input_digest,manifest:'docs/'+nodes.get(dep).stage_gate.evidence[0]})),excluded:p.excluded,residuals:[],metadataRevalidation:{evidence:out+'/revalidation.json',sha256:digest(readFileSync(resolve(root,out,'revalidation.json')))}};
 const path=out+'/'+id.toLowerCase().replaceAll(':','-')+'.json',bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};validateReceipt(id,{nodes});
}
for(const [index,path]of texts.entries())writeFileSync(resolve(root,path),publishStages(readFileSync(resolve(root,path),'utf8'),new Map(selected.map(id=>[id,nodes.get(id)])),index===0?'CORE:':'FE:'));
console.log(JSON.stringify({status:'PASS',checks:65,retained:63,reexecuted:2,nodes:selected.length,validation:validateReceipt('PROVIDER:A1')}));
