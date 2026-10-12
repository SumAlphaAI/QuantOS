import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,mkdtempSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {assess,localPolicy,digest} from './provider-a1-receipts.mjs';
import {profile,publish} from './tp01-d-local-gate.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze all inputs before assessment');
const attempt=process.argv[2]??'docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-local-20261012/attempt-01';
assert(!existsSync(attempt),'choose a fresh attempt');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),base='docs/audit/evidence/tp01-d-local-20261012',history=base+'/history/'+source.slice(0,8);
assert(!existsSync(history),'never overwrite history');const scratch=mkdtempSync(resolve(tmpdir(),'quantos-tp01-d-history-'));
const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(resolve(p,n))):[p];
const preserved=[];
for(const path of ['docs/audit/evidence/tp01-c-20261009','docs/audit/evidence/tp01-d-20261009','docs/audit/evidence/tp01-c-local-20261012/manifest.json','docs/audit/evidence/local-development-20261012/core-gate-f0.json','docs/audit/evidence/local-development-20261012/core-tp03.json','docs/audit/evidence/local-development-20261012/core-tp04.json','docs/audit/evidence/r03-20261011/manifest.json','docs/audit/evidence/r04-completion-20261012/manifest.json']){
 const dest=resolve(scratch,path);mkdirSync(resolve(dest,'..'),{recursive:true});cpSync(path,dest,{recursive:true});
 for(const file of walk(dest))preserved.push({path:history+'/'+relative(scratch,file),sha256:digest(readFileSync(file))});
}
writeFileSync(scratch+'/index.json',JSON.stringify({sourceCommit:source,formalAccepted:false,files:preserved},null,2)+'\n');
try{assess(attempt,localPolicy(profile).roots,{profile});}
catch(error){mkdirSync(base,{recursive:true});writeFileSync(base+'/failure-'+source.slice(0,8)+'.json',JSON.stringify({sourceCommit:source,attempt,status:'FAIL',message:error.message,formalAccepted:false},null,2)+'\n');throw error;}
finally{mkdirSync(history,{recursive:true});cpSync(scratch,history,{recursive:true});rmSync(scratch,{recursive:true,force:true});}
console.log(JSON.stringify(publish(attempt+'/local-prerequisites.json')));
