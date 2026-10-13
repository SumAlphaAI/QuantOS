import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {assess,policy,digest} from './provider-a1-receipts.mjs';
import {deriveIndex,publish,registrations} from './research-local-gate.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze source before assessment');
const attempt=process.argv[2]??'docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-01';assert(!existsSync(attempt),'fresh attempt required');
const scratch=mkdtempSync(resolve(tmpdir(),'quantos-research-history-'));
const paths=[...new Set(Object.values(policy().checks).filter(c=>c.artifact?.startsWith('docs/')&&!c.output).map(c=>dirname(c.artifact)))];
const historical=paths.map(path=>({path,exists:existsSync(path)}));
for(const {path,exists}of historical)if(exists){mkdirSync(dirname(resolve(scratch,path)),{recursive:true});cpSync(path,resolve(scratch,path),{recursive:true});}
try{assess(attempt,['PROVIDER:A3'],{profile:'A3_EXECUTION'});}
finally{
 for(const {path,exists}of historical){rmSync(path,{recursive:true,force:true});if(exists){mkdirSync(dirname(path),{recursive:true});cpSync(resolve(scratch,path),path,{recursive:true});}}
 rmSync(scratch,{recursive:true,force:true});
}
const indexes=Object.fromEntries(Object.keys(registrations).map(profile=>[profile,deriveIndex(attempt+'/local-prerequisites.json',profile)]));
const report=publish(indexes);mkdirSync('docs/audit/evidence/research-local-20261013',{recursive:true});writeFileSync('docs/audit/evidence/research-local-20261013/publication.json',JSON.stringify({schema:'quantos-research-local-publication/v1',status:'PASS',formalAccepted:false,databaseExecution:false,report,indexes:Object.entries(indexes).map(([profile,path])=>({profile,path,sha256:digest(readFileSync(path))}))},null,2)+'\n');console.log(JSON.stringify(report,null,2));
