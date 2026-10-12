// Local functional assessment only. No database environment file is loaded.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {assess,policy,nodesFromPlans,planInput,publishStages,developmentEnvironment,staticEnvironment,validateLocalPrerequisites} from './provider-a1-receipts.mjs';
import {inventory,checks,hash,prerequisites,releaseHandoff,verifyLocal} from './r03-stage-check.mjs';
const require=createRequire(import.meta.url),{snapshot}=require('./lib/test-engine-processes.cjs');
const root=process.cwd(),directory=process.argv[2]||'docs/audit/evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01';
const existingIndex=process.argv[3];if(!existingIndex)assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','commit source before R03 local assessment');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),inputs=inventory(),initialPlan=planInput(nodesFromPlans().get('CORE:R03'));
assert(!existsSync(resolve(directory,'r03-execution-results.json')),'choose a fresh assessment directory');
if(!existingIndex)assess(directory,['CORE:R02','CORE:TP02'],{profile:'R03_LOCAL'});
const prerequisiteProfile=existingIndex?'R04_LOCAL':'R03_LOCAL';
const local=validateLocalPrerequisites(existingIndex??directory+'/local-prerequisites.json',{profile:prerequisiteProfile});assert.equal(local.observedSourceCommit,source);
const scope=randomBytes(4).toString('hex'),scratch=mkdtempSync(resolve(tmpdir(),'quantos-r03-local-')),baseline=resolve(scratch,'baseline.json');
writeFileSync(baseline,JSON.stringify({...snapshot(root),scopeTag:scope}));
const p=policy(),env=staticEnvironment(developmentEnvironment(readFileSync(p.developmentProfile.file,'utf8'),p.developmentProfile.overrides));
for(const key of Object.keys(env))if(/DATABASE_URL|SUPABASE|PASSWORD|TOKEN|SECRET|(?:^|_)KEY$|QUANTOS_RUN_.*TESTS/.test(key))delete env[key];
env.QUANTOS_TEST_ENGINE_SCOPE=scope;env.QUANTOS_R1_ENGINE_BASELINE=baseline;
const results=[];mkdirSync(directory+'/r03-logs',{recursive:true});
let cleanup;
try {
 for(const spec of checks){const executedAt=new Date().toISOString(),run=spawnSync(spec.command[0],spec.command.slice(1),{cwd:root,env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});const output=(run.stdout??'')+(run.stderr??'');const log=directory+'/r03-logs/'+spec.id+'.log';writeFileSync(log,output);results.push({id:spec.id,command:spec.command,executedAt,exitCode:run.status,status:run.status===0?'PASS':'FAIL',log,logSha256:hash(output)});console.log('R03_LOCAL',spec.id,run.status);}
} finally {
 const run=spawnSync(process.execPath,['scripts/r1-process-cleanup.cjs',directory+'/r03-process-cleanup.json'],{cwd:root,env,encoding:'utf8',timeout:30000});writeFileSync(directory+'/r03-logs/process-cleanup.log',(run.stdout??'')+(run.stderr??''));cleanup=run.status;rmSync(scratch,{recursive:true,force:true});
 writeFileSync(directory+'/r03-execution-results.json',JSON.stringify(results,null,2)+'\n');
}
assert.equal(cleanup,0,'owned Engine process cleanup failed');assert(results.every(r=>r.exitCode===0),'R03 local checks failed; no READY published');assert.deepEqual(inventory(),inputs,'R03 inputs changed during assessment');assert.deepEqual(planInput(nodesFromPlans().get('CORE:R03')),initialPlan);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
const receipt={schema:'quantos-r03-development/v2',nodeId:'CORE:R03',stage:'DEVELOPMENT',profile:'R03_LOCAL',status:'READY',engineeringStatus:'PASS',formalAccepted:false,databaseExecution:false,production:false,observedSourceCommit:source,planInput:initialPlan,inputs,checks:results,localPrerequisites:{profile:prerequisiteProfile,manifest:local.manifest,inputDigest:local.inputDigest},dependencies:prerequisites.map(nodeId=>({nodeId,status:'LOCAL_READY',owner:'CORE:R03',inputDigest:local.nodes.find(n=>n.nodeId===nodeId).inputDigest})),cleanup:{manifest:directory+'/r03-process-cleanup.json',inputDigest:hash(readFileSync(directory+'/r03-process-cleanup.json'))},release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff:releaseHandoff,prerequisiteChecks:JSON.parse(readFileSync(local.manifest)).deferred}};
verifyLocal(receipt);const bytes=JSON.stringify(receipt,null,2)+'\n';writeFileSync(directory+'/r03-manifest.json',bytes);writeFileSync('docs/audit/evidence/r03-20261011/manifest.json',bytes);
const node=nodesFromPlans().get('CORE:R03');node.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:hash(bytes),evidence:['audit/evidence/r03-20261011/manifest.json']};
const plan='docs/SumAlpha-QuantOS-Development-Plan.md';writeFileSync(plan,publishStages(readFileSync(plan,'utf8'),new Map([['CORE:R03',node]]),'CORE:'));
console.log(JSON.stringify(verifyLocal(receipt)));
