import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root=process.cwd(),out='docs/audit/evidence/r03-prerequisites-20261011/final';
const {verify,hash,dependencies}=await import(root+'/scripts/r03-stage-check.mjs');
const {captureInputs,assertInputSnapshot,nodesFromPlans,closure}=await import(root+'/scripts/provider-a1-receipts.mjs');
const env={...process.env,QUANTOS_SKIP_ENV:'1'};for(const k of Object.keys(env))if(/DATABASE_URL|SUPABASE|PASSWORD|TOKEN|KEY|SECRET|QUANTOS_RUN_.*TESTS|QUANTOS_ENGINE/.test(k))delete env[k];
const commands=[['r02-admission',['make','r02-admission-check'],2],['r03-admission',['make','r03-admission-check'],2],['r03-verify',['node','scripts/r03-stage-check.mjs','--verify'],0],['r03-unit-negatives',['node','--test','scripts/r03-stage-check.test.mjs'],0],['plans',['node','scripts/check-development-plans.mjs'],0],['diff-check',['git','diff','--check'],0]];
const results=[];for(const[id,command,expectedExitCode]of commands){const observedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024}),bytes=(r.stdout??'')+(r.stderr??''),log=out+'/'+id+'.log';writeFileSync(log,bytes);results.push({id,command,observedAt,exitCode:r.status,expectedExitCode,verdict:r.status===expectedExitCode?(expectedExitCode?'PASS_EXPECTED_REJECTION':'PASS'):'FAIL',log,sha256:hash(bytes)});writeFileSync(out+'/commands.json',JSON.stringify(results,null,2)+'\n');console.log(id,r.status);assert.equal(r.status,expectedExitCode,bytes);}
const m=JSON.parse(readFileSync('docs/audit/evidence/r03-20261011/manifest.json')),deps=dependencies();assert.equal(verify(m,{deps}).stageGate,'BLOCKED');
const probes=[],reject=(name,f)=>{assert.throws(f);probes.push({name,result:'REJECTED'});};
for(const[name,mutate]of [['formal acceptance claim',r=>{r.formalAccepted=true;}],['source changed',r=>{r.inputs[0].sha256='sha256:'+'0'.repeat(64);}],['dependency changed',r=>{r.dependencies[0].reason+='tampered';}],['target changed',r=>{r.targetFiles[0].sha256='sha256:'+'0'.repeat(64);}],['READY despite blocked prerequisites',r=>{r.status='READY';}],['failed regression command',r=>{r.checks[0].exitCode=1;}]]){const r=structuredClone(m);mutate(r);reject(name,()=>verify(r,{deps}));}
reject('actual bound log changed',()=>verify(m,{deps,read:p=>p.endsWith(m.checks[0].log)?Buffer.concat([readFileSync(p),Buffer.from('tampered')]):readFileSync(p)}));
reject('historical manifest cannot claim current source',()=>verify(JSON.parse(readFileSync(out+'/../initial/r03-before-readmission-manifest.json')),{deps}));
const {retainedSourcePolicy}=createRequire(root+'/package.json')(root+'/scripts/r02-retained-source-policy.cjs');
reject('retained data use expires exactly at deadline',()=>retainedSourcePolicy({now:Date.parse('2026-10-14T00:00:00Z')}));
const nodes=nodesFromPlans(),selected=[...new Set(['CORE:R02','CORE:TP02'].flatMap(id=>closure(nodes,id)))];assertInputSnapshot(new Map(JSON.parse(readFileSync(out+'/postfix-functional-inputs.json'))),captureInputs(nodes,selected));
writeFileSync(out+'/current-manifest-probes.json',JSON.stringify({status:'PASS',manifestSha256:hash(readFileSync('docs/audit/evidence/r03-20261011/manifest.json')),probes,formalAccepted:false},null,2)+'\n');
writeFileSync(out+'/strict-gates.json',JSON.stringify({status:'BLOCKED',dependencies:deps,r03:verify(m,{deps}),functionalInputs:'UNCHANGED_SINCE_TP02_POSTFIX',inputSnapshot:'postfix-functional-inputs.json',fullPrerequisiteRerunRequired:true,formalAccepted:false},null,2)+'\n');
cpSync(new URL(import.meta.url),out+'/blocked-admission-checks.mjs');
