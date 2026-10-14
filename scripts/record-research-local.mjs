import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,mkdtempSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {assess,policy,digest} from './provider-a1-receipts.mjs';
import {deriveIndex,publish,registrations,evidenceBase,manifest} from './research-local-gate.mjs';
import {publish as publishTp02,manifest as tp02Manifest} from './tp02-local-gate.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze source before assessment');
assert(process.argv.length<=3,'one fresh attempt allowed');
const attempt=process.argv[2]??'docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-readmission-20261014/attempt-01';
assert(/^docs\/audit\/evidence\/provider-a1-remediation-20261004\/provider-a3-[a-z0-9-]+\/attempt-[0-9]{2}$/.test(attempt),'confined aggregate attempt required');assert(!existsSync(attempt),'fresh attempt required');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),auditBase=dirname(attempt).replace('provider-a1-remediation-20261004/',''),history=auditBase+'/history/'+source.slice(0,8);assert(!existsSync(history),'preserve prior history');
const scratch=mkdtempSync(resolve(tmpdir(),'quantos-research-history-'));
const paths=[...new Set(Object.values(policy().checks).filter(c=>c.artifact?.startsWith('docs/')&&!c.output).map(c=>dirname(c.artifact)))],historical=paths.map(path=>({path,exists:existsSync(path)}));
const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(resolve(p,n))):[p];
const componentFiles=[];for(const {path,exists}of historical)if(exists){mkdirSync(dirname(resolve(scratch,path)),{recursive:true});cpSync(path,resolve(scratch,path),{recursive:true});for(const f of walk(path))componentFiles.push({path:relative(process.cwd(),resolve(f)),sha256:digest(readFileSync(f))});}
const publicationPaths=[...Object.keys(registrations).map(manifest),tp02Manifest,evidenceBase+'/publication.json','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'],before=new Map(publicationPaths.map(p=>[p,existsSync(p)?readFileSync(p):null]));
let failure;
try{assess(attempt,['PROVIDER:A3'],{profile:'A3_EXECUTION'});}catch(e){failure=e;}
finally{
 mkdirSync(attempt,{recursive:true});
 try{for(const {path}of historical)if(existsSync(path))for(const f of walk(path)){const original=resolve(scratch,relative(process.cwd(),f));if(!existsSync(original)||digest(readFileSync(original))!==digest(readFileSync(f))){const dest=resolve(attempt,'generated',relative(process.cwd(),f));mkdirSync(dirname(dest),{recursive:true});cpSync(f,dest);}}}
 finally{for(const {path,exists}of historical){rmSync(path,{recursive:true,force:true});if(exists){mkdirSync(dirname(path),{recursive:true});cpSync(resolve(scratch,path),path,{recursive:true});}}rmSync(scratch,{recursive:true,force:true});}
 for(const f of componentFiles)assert.equal(digest(readFileSync(f.path)),f.sha256,'canonical component restore failed');
 writeFileSync(attempt+'/canonical-preservation.json',JSON.stringify({status:'PASS',sourceCommit:source,restored:true,formalAccepted:false,files:componentFiles},null,2)+'\n');
 mkdirSync(history,{recursive:true});const saved=[];for(const[path,bytes]of before)if(bytes!==null){const dest=history+'/'+path;mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);saved.push({path,archive:dest,sha256:digest(bytes)});}writeFileSync(history+'/index.json',JSON.stringify({sourceCommit:source,status:'PASS',formalAccepted:false,files:saved},null,2)+'\n');
}
if(failure){writeFileSync(attempt+'/failure.json',JSON.stringify({sourceCommit:source,status:'FAIL',phase:'execution',reason:failure.message,formalAccepted:false},null,2)+'\n');throw failure;}
try{
 const indexes=Object.fromEntries(Object.keys(registrations).map(profile=>[profile,deriveIndex(attempt+'/local-prerequisites.json',profile)]));
 const tp02Index=deriveIndex(attempt+'/local-prerequisites.json','TP02_LOCAL'),tp02=publishTp02(tp02Index),report=publish(indexes);
 const receipt={schema:'quantos-research-local-publication/v1',status:'PASS',sourceCommit:source,formalAccepted:false,databaseExecution:false,report,tp02,indexes:Object.entries({...indexes,TP02_LOCAL:tp02Index}).map(([profile,path])=>({profile,path,sha256:digest(readFileSync(path))}))};
 writeFileSync(evidenceBase+'/publication.json',JSON.stringify(receipt,null,2)+'\n');writeFileSync(auditBase+'/publication.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',sourceCommit:source,profiles:report.map(r=>r.profile),tp02},null,2));
}catch(e){for(const[path,bytes]of before){if(bytes===null)rmSync(path,{force:true});else writeFileSync(path,bytes);}writeFileSync(attempt+'/publication-failure.json',JSON.stringify({sourceCommit:source,status:'FAIL',phase:'publication',rolledBack:true,reason:e.message,formalAccepted:false},null,2)+'\n');throw e;}
