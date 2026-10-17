// Builds an aggregate only from the current attempt's completed dependency executions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {root,digest,policy,nodesFromPlans,localChecks} from './provider-a1-receipts.mjs';
import {profile,nodeId,dependencyNodes,dependencyChecks,componentCoverage,resultsDigest} from './s2-service-coverage.mjs';
function confined(path,base){assert.equal(typeof path,'string');const full=resolve(root,path);assert(full.startsWith(resolve(root,base)+'/'),'cross-attempt evidence forbidden');return full;}
export function buildEvidence(executionResults,source,{nodes=nodesFromPlans(),p=policy(),readBytes=path=>readFileSync(resolve(root,path)),components=componentCoverage}={}){
 assert.match(source,/^[a-f0-9]{40}$/);assert(/^docs\/audit\/evidence\/provider-a1-remediation-20261004\/(?:s2-service|x01|x02|x03)-local-[0-9]{8}\/attempt-[0-9]{2}\/execution-results\.json$/.test(executionResults),'fresh confined S2 attempt required');
 const ids=dependencyChecks(nodes,p),selected=dependencyNodes(nodes);assert.equal(ids.length,124);assert.equal(selected.length,38);
 const all=JSON.parse(readBytes(executionResults)),rows=all.slice(0,ids.length),base=dirname(executionResults);
 assert.deepEqual(rows.map(c=>c.id),ids,'complete fresh dependency order required');
 const own=p.nodes[nodeId].checks.concat(/\/x0[123]-local-/.test(executionResults)?localChecks('CORE:X01',p,'X01_LOCAL'):[],/\/x0[23]-local-/.test(executionResults)?localChecks('CORE:X02',p,'X02_LOCAL'):[],executionResults.includes('/x03-local-')?localChecks('CORE:X03',p,'X03_LOCAL'):[]);assert.deepEqual(all.slice(ids.length).map(c=>c.id),own.slice(0,all.length-ids.length),'unexpected or reordered own execution');assert(all.length<=ids.length+own.length);
 for(const c of rows){
  assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.executionErrorCode,null);assert.equal(c.signal,null);assert.deepEqual(c.command,p.checks[c.id].command,'command substitution');assert(Number.isFinite(Date.parse(c.executedAt)),'missing execution clock');
  confined(c.log,base);assert.equal(digest(readBytes(c.log)),c.logSha256,'dependency log changed');
  if(p.checks[c.id].artifact||p.checks[c.id].reproducibility){assert(c.artifact,'artifact missing');confined(c.artifact,base);assert.equal(digest(readBytes(c.artifact)),c.artifactSha256,'artifact changed');}
  for(const a of c.supportingArtifacts??[]){confined(a.path,base);assert.equal(digest(readBytes(a.path)),a.sha256,'supporting bytes changed');}
 }
 const byId=new Map(rows.map(c=>[c.id,c])),projections=new Map(selected.map(id=>[id,{checks:localChecks(id,p,profile).map(c=>byId.get(c))}]));
 const read=path=>projections.get(path)??JSON.parse(readBytes(path));
 const local={observedSourceCommit:source,nodes:selected.map(nodeId=>({nodeId,manifest:nodeId}))};
 return{schema:'quantos-s2-service-functional/v1',nodeId,profile,status:'PASS',engineeringStatus:'PASS',observedSourceCommit:source,executionResults,dependencyNodes:selected,dependencyChecks:ids,dependencyResultsDigest:resultsDigest(rows),coverage:components(local,{read,readLog:p=>readBytes(p).toString()}),runtimeAdmission:'DENIED',databaseExecution:false,externalExecution:false,externalPublished:false,production:false,formalAccepted:false,fullTp12Review:'X3_AFTER_CORE_TP07_AND_S2'};
}
export function verifyEvidence(r,source,options={}){
 assert.deepEqual(r,buildEvidence(r.executionResults,source,options),'aggregate evidence changed or spliced');return{status:'PASS',nodeId,observedSourceCommit:source,dependencies:124,runtimeAdmission:'DENIED',formalAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 if(process.argv[2]==='--verify'){assert.equal(process.argv.length,5);console.log(JSON.stringify(verifyEvidence(JSON.parse(readFileSync(process.argv[3])),process.argv[4])));}
 else{assert.equal(process.argv.length,3,'one assessment output required');const output=resolve(process.argv[2]),base=resolve(dirname(output),'../..'),path=relative(root,base)+'/execution-results.json',source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),r=buildEvidence(path,source);assert.equal(output,resolve(base,'supporting/s2-service/receipt.json'));mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}
}catch(error){console.error(error.message);process.exitCode=2;}}
