import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),base='docs/audit/evidence/r03-prerequisites-20261011';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const current=JSON.parse(readFileSync('docs/audit/evidence/r03-20261011/manifest.json'));
const walk=p=>statSync(p).isDirectory()?readdirSync(p).flatMap(n=>walk(p+'/'+n)):[p];
const paths=new Set([...walk(base),...walk('docs/audit/evidence/provider-a1-remediation-20261004/r03-prerequisites-20261011'),...walk('docs/audit/evidence/tp02-20261009'),'docs/audit/evidence/r03-20261011/manifest.json',...current.checks.map(c=>c.log),...current.targetFiles.map(f=>f.path)]);
for(const path of execFileSync('git',['diff','--name-only','bb4b5b1c55a0a2353c0ee0ab7981a0cf14aef1fe'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))paths.add(path);
for(const m of JSON.parse(readFileSync(base+'/final/frozen-functional-inputs.json')).map(([,v])=>v))for(const file of m.inputs)if(!file.gitCommit)paths.add(file.path);
for(const p of ['docs/provider-approvals/20261011-r02-retained-revalidation-confirmation.json','docs/provider-approvals/20261011-r02-retained-revalidation-scope.json','docs/provider-approvals/20261011-r02-retained-events.json','docs/gate-records/R02-retained-data-disposition-draft-2026-10-11.md'])paths.add(p);
const self=base+'/final/git-evidence-tracking.json';paths.delete(self);
const files=[];for(const path of [...paths].sort()){const actual=readFileSync(path),staged=execFileSync('git',['show',':'+path],{maxBuffer:32*1024*1024});assert.equal(hash(actual),hash(staged),path+' not fully staged');files.push({path,sha256:hash(actual)});}
writeFileSync(self,JSON.stringify({status:'PASS',scope:'staged Git bytes equal actual checked source/evidence; this receipt is staged after generation',researchSourceCommit:current.observedSourceCommit,candidateSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),functionalSnapshots:['frozen-functional-inputs.json','postfix-functional-inputs.json'],fullPrerequisitesAdmitted:false,files:files.length,evidence:files,formalAccepted:false},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',files:files.length}));
