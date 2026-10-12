// Fresh frozen-source assessment. No target credentials or external publication.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,readdirSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {assess,localPolicy,digest,staticEnvironment} from './provider-a1-receipts.mjs';
import {profile,directory,publishLocal,admission} from './local-development-gate.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze and commit all inputs before assessment');
const attempt=process.argv[2]??'docs/audit/evidence/provider-a1-remediation-20261004/r04-local-20261012/attempt-01';
assert(!existsSync(attempt+'/execution-results.json'),'choose fresh attempt');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),history=directory+'/history/'+source.slice(0,8);
assert(!existsSync(history),'history already exists');const scratch=mkdtempSync(resolve(tmpdir(),'quantos-r04-history-'));
const archived=[];const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(p+'/'+n)):[p];
for(const p of ['docs/audit/evidence/tp02-20261009','docs/audit/evidence/tp03-20261010','docs/audit/evidence/tp04-20261010','docs/audit/evidence/r03-20261011']){const destination=scratch+'/'+p.split('/').at(-1);cpSync(p,destination,{recursive:true});for(const f of walk(destination))archived.push({path:history+'/'+relative(scratch,f),sha256:digest(readFileSync(f))});}
for(const name of ['core-gate-f0.json','core-tp03.json','core-tp04.json','r04-admission.json']){const p=directory+'/'+name;if(existsSync(p)){cpSync(p,scratch+'/'+name);archived.push({path:history+'/'+name,sha256:digest(readFileSync(p))});}}
for(const p of ['docs/audit/evidence/f0-target-diagnostics-20261012/summary.json','docs/audit/evidence/f0-target-diagnostics-20261012/integrity.json','docs/audit/evidence/f0-target-diagnostics-20261012/history.json','docs/audit/evidence/tp04-python-readmission-20261012/summary.json']){assert(existsSync(p));archived.push({path:p,sha256:digest(readFileSync(p))});}
writeFileSync(scratch+'/index.json',JSON.stringify({schema:'quantos-local-gate-history/v1',sourceCommit:source,files:archived},null,2)+'\n');
try{assess(attempt,localPolicy(profile).roots,{profile});}finally{mkdirSync(history,{recursive:true});cpSync(scratch,history,{recursive:true});rmSync(scratch,{recursive:true,force:true});}
publishLocal(attempt+'/local-prerequisites.json');
execFileSync(process.execPath,['scripts/r03-record-development.mjs',attempt,attempt+'/local-prerequisites.json'],{stdio:'inherit',env:staticEnvironment(process.env),timeout:1800000});
const result=admission();writeFileSync(directory+'/r04-admission.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
