import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
const root=process.cwd();
const {policy,nodesFromPlans,closure,staticEnvironment,developmentEnvironment,validateArtifact,supportingArtifactPaths,digest,captureInputs,assertInputSnapshot}=await import(root+'/scripts/provider-a1-receipts.mjs');
const source='b358581d24e51d1e7dd4200176467c833d12a0f0';assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
const p=policy(),nodes=nodesFromPlans(),selected=[...new Set(['CORE:R02','CORE:TP02'].flatMap(id=>closure(nodes,id)))];
assertInputSnapshot(new Map(JSON.parse(readFileSync('/tmp/r03-prerequisite-20261011/b358-inputs.json'))),captureInputs(nodes,selected));
const previous=JSON.parse(readFileSync('docs/audit/evidence/provider-a1-remediation-20261004/r03-prerequisites-20261011/attempt-04/execution-results.json'));
const out='docs/audit/evidence/r03-prerequisites-20261011/static-continuation';
const results=existsSync(out+'/execution-results.json')?JSON.parse(readFileSync(out+'/execution-results.json')):[];
const all=[...new Set(selected.flatMap(id=>p.nodes[id].checks))].filter(id=>!previous.some(c=>c.id===id)&&!results.some(c=>c.id===id));
mkdirSync(out+'/logs',{recursive:true});
for(const id of all){const spec=p.checks[id];if(spec.database){results.push({id,status:'NOT_RUN',reason:'configured development Supabase read-only; write target deferred',command:spec.command});writeFileSync(out+'/execution-results.json',JSON.stringify(results,null,2)+'\n');continue;}
 const env=staticEnvironment(developmentEnvironment(readFileSync(p.developmentProfile.file,'utf8'),p.developmentProfile.overrides));for(const k of Object.keys(env))if(/PASSWORD|TOKEN|SECRET|SUPABASE|DATABASE_URL/.test(k))delete env[k];Object.assign(env,spec.env??{});env.QUANTOS_TEST_ENGINE_SCOPE='a444c4b1';env.QUANTOS_R1_ENGINE_BASELINE='/var/folders/k8/_4hymb6j59s0c8xntb11ktmc0000gn/T/quantos-r1-engine-scope-OoUm8r/baseline.json';
 const command=[...spec.command];if(spec.output)command.push(resolve(out,'resume',spec.output));
 const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:spec.timeoutMs??900000,maxBuffer:32*1024*1024});let bytes=(r.stdout??'')+(r.stderr??'');
 const c={id,command:spec.command,executedAt,exitCode:r.status,status:r.status===0?'PASS':'FAIL',signal:r.signal,error:r.error?.code??null,scope:'database-independent continuation; no READY publication'};
 if(spec.artifact&&r.status===0){const artifact=spec.output?resolve(out,'resume',spec.output):resolve(spec.artifact);try{validateArtifact(spec.artifactKind,artifact,source);}catch(e){c.exitCode=1;c.status='FAIL';bytes+='\nArtifact validation failed: '+e.message+'\n';}
 c.artifact=out+'/supporting/'+id+'/'+artifact.split('/').at(-1);mkdirSync(dirname(c.artifact),{recursive:true});cpSync(artifact,c.artifact);c.artifactSha256=digest(readFileSync(c.artifact));c.supportingArtifacts=supportingArtifactPaths(spec.artifactKind,JSON.parse(readFileSync(artifact))).map(name=>{const path=dirname(c.artifact)+'/'+name;mkdirSync(dirname(path),{recursive:true});cpSync(dirname(artifact)+'/'+name,path);return{path,sha256:digest(readFileSync(path))};});}
 c.log=out+'/logs/'+id+'.log';writeFileSync(c.log,bytes);c.logSha256=digest(bytes);results.push(c);writeFileSync(out+'/execution-results.json',JSON.stringify(results,null,2)+'\n');console.log(id,c.status);
}
assertInputSnapshot(new Map(JSON.parse(readFileSync('/tmp/r03-prerequisite-20261011/b358-inputs.json'))),captureInputs(nodes,selected));
writeFileSync(out+'/summary.json',JSON.stringify({sourceCommit:source,status:results.some(c=>c.status==='FAIL')?'FAIL':'PASS_SCOPED_STATIC',passed:results.filter(c=>c.status==='PASS').length,notRun:results.filter(c=>c.status==='NOT_RUN').map(c=>c.id),functionalInputs:'UNCHANGED',formalAccepted:false,readyPublished:false},null,2)+'\n');
