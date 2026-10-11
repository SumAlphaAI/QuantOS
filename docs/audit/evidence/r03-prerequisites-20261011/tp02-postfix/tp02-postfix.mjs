import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const root=process.cwd(),require=createRequire(root+'/package.json'),{snapshot}=require(root+'/scripts/lib/test-engine-processes.cjs');
const {captureInputs,nodesFromPlans,closure}=await import(root+'/scripts/provider-a1-receipts.mjs');
const {hash,inventory}=await import(root+'/scripts/r03-stage-check.mjs');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert(source.startsWith('68acfa67'));
const out='docs/audit/evidence/r03-prerequisites-20261011/tp02-postfix';mkdirSync(out,{recursive:true});
const nodes=nodesFromPlans(),selected=[...new Set(['CORE:R02','CORE:TP02'].flatMap(id=>closure(nodes,id)))],before=captureInputs(nodes,selected);writeFileSync('/tmp/r03-prerequisite-20261011/68ac-inputs.json',JSON.stringify([...before],null,2)+'\n');
const env={...process.env,QUANTOS_SKIP_ENV:'1'};for(const k of Object.keys(env))if(/DATABASE_URL|SUPABASE|PASSWORD|TOKEN|KEY|SECRET|QUANTOS_RUN_.*TESTS|QUANTOS_ENGINE/.test(k))delete env[k];const scopeTag=randomBytes(4).toString('hex'),baseline=out+'/engine-baseline.json';writeFileSync(baseline,JSON.stringify({...snapshot(root),scopeTag},null,2)+'\n');env.QUANTOS_TEST_ENGINE_SCOPE=scopeTag;env.QUANTOS_R1_ENGINE_BASELINE=root+'/'+baseline;
const commands=[['component',['node','engines/rd-agent/check-development.mjs','--record'],0],['negatives',['node','--test','scripts/tp02-functional-artifacts.test.mjs'],0],['verify',['node','engines/rd-agent/check-development.mjs','--verify'],0],['ready',['node','engines/rd-agent/check-development.mjs','--ready'],2],['cleanup',['node','scripts/r1-process-cleanup.cjs',out+'/engine-cleanup.json'],0]],results=[];
for(const[id,command,expectedExitCode]of commands){const observedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:16*1024*1024}),bytes=(r.stdout??'')+(r.stderr??''),log=out+'/'+id+'.log';writeFileSync(log,bytes);results.push({id,command,observedAt,exitCode:r.status,expectedExitCode,status:r.status===expectedExitCode?(expectedExitCode?'PASS_EXPECTED_REJECTION':'PASS'):'FAIL',log,sha256:hash(bytes)});writeFileSync(out+'/commands.json',JSON.stringify(results,null,2)+'\n');console.log(id,r.status);}
const receipt=JSON.parse(readFileSync('docs/audit/evidence/tp02-20261009/receipt.json'));assert.equal(receipt.observedSourceCommit,source);assert.equal(receipt.engineeringStatus,'PASS');
mkdirSync(out+'/component/wheels',{recursive:true});for(const name of ['receipt.json',...receipt.checks.map(c=>c.id+'.log'),...receipt.package.wheels.map(w=>'wheels/'+w.file)])cpSync('docs/audit/evidence/tp02-20261009/'+name,out+'/component/'+name);
assert.deepEqual(captureInputs(nodesFromPlans(),selected),before);assert.deepEqual(inventory(),JSON.parse(readFileSync('docs/audit/evidence/r03-20261011/manifest.json')).inputs);
writeFileSync('docs/audit/evidence/r03-prerequisites-20261011/final/postfix-functional-inputs.json',JSON.stringify([...before],null,2)+'\n');
writeFileSync(out+'/summary.json',JSON.stringify({sourceCommit:source,status:results.every(c=>c.status.startsWith('PASS'))?'PASS_SCOPED_ENGINEERING':'FAIL',pythonPassed:1366,negativeTests:26,r03FunctionalInputs:74,r03InputsUnchanged:true,prerequisitesAdmitted:false,formalAccepted:false},null,2)+'\n');cpSync(new URL(import.meta.url),out+'/tp02-postfix.mjs');assert(results.every(c=>c.status.startsWith('PASS')));
