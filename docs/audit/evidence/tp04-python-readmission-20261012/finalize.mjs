// Aggregate a completed failed strict assessment; never manufacture READY.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,digest,inventory,nodesFromPlans,planInput,policy,closure,publishStages,validateArtifact} from '../../../../scripts/provider-a1-receipts.mjs';
const base=relative(root,import.meta.dirname), attempt='docs/audit/evidence/provider-a1-remediation-20261004/tp04-python-readmission-20261012/attempt-01';
const read=path=>JSON.parse(readFileSync(resolve(root,path)));
const source='d644b8c21384ed626bde029aea8f8e2aca4a528b';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source);
const nodes=nodesFromPlans(),p=policy(),roots=['CORE-GATE:F0','CORE:TP03','CORE:TP04'];
const selected=[...new Set(roots.flatMap(id=>closure(nodes,id)))];
const expected=[...new Set(selected.flatMap(id=>p.nodes[id].checks))];
const results=read(attempt+'/execution-results.json');
assert.deepEqual(results.map(c=>c.id).sort(),[...expected].sort());assert.equal(results.length,56);
assert(results.some(c=>c.exitCode!==0),'this producer only records failed assessments');
const selectors=[...new Set([...p.commonInputs,...selected.flatMap(id=>p.nodes[id].inputs)])];
const inputs=inventory(selectors),paths=new Set(inputs.map(i=>i.path));
const changed=execFileSync('git',['diff','HEAD','--name-only'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert(!changed.some(path=>paths.has(path)),'product inputs changed since frozen execution');
const snapshot={observedSourceCommit:source,inputs,planInputs:selected.map(nodeId=>({nodeId,planInput:planInput(nodes.get(nodeId))}))};
writeFileSync(resolve(root,base,'source-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
const sourceSnapshot={path:base+'/source-snapshot.json',sha256:digest(readFileSync(resolve(root,base,'source-snapshot.json')))};
const files=[];
const bind=path=>{files.push({path,sha256:digest(readFileSync(resolve(root,path)))});};
for(const c of results){
 assert.deepEqual(c.command,p.checks[c.id].command);
 assert.equal(digest(readFileSync(resolve(root,c.log))),c.logSha256);bind(c.log);
 for(const [path,sha]of [[c.artifact,c.artifactSha256],[c.failedArtifact,c.failedArtifactSha256],[c.targetEvidence,c.targetEvidenceSha256]])if(path){assert.equal(digest(readFileSync(resolve(root,path))),sha);bind(path);}
 for(const a of c.supportingArtifacts??[]){assert.equal(digest(readFileSync(resolve(root,a.path))),a.sha256);bind(a.path);}
 if(c.status==='PASS'){
  assert.equal(c.exitCode,0);if(p.checks[c.id].marker)assert.match(readFileSync(resolve(root,c.log),'utf8'),new RegExp(p.checks[c.id].marker),c.id+' marker');
  if(c.artifact)validateArtifact(p.checks[c.id].reproducibility?'f01-reproducibility':p.checks[c.id].measurement?'f05-volume':p.checks[c.id].artifactKind,resolve(root,c.artifact),source);
 }
}
cpSync('/tmp/quantos-tp04-readonly-20261012.json',resolve(root,base,'supabase-readonly.json'));bind(base+'/supabase-readonly.json');
cpSync('/tmp/quantos-tp04-assessment-20261012.log',resolve(root,base,'collector.log'));bind(base+'/collector.log');bind(attempt+'/execution-results.json');
const f09=results.find(c=>c.id==='f09-target');
if(f09.failedArtifact){const failed=read(f09.failedArtifact);for(const [name,sha]of Object.entries(failed.logs??{})){
 assert.equal(digest(readFileSync(resolve(root,'artifacts/f09',name))),'sha256:'+sha);
 const dest=base+'/f09-failure/'+name;mkdirSync(dirname(resolve(root,dest)),{recursive:true});cpSync(resolve(root,'artifacts/f09',name),resolve(root,dest));bind(dest);
}}
const classified=results.filter(c=>c.status==='FAIL').map(c=>{const text=readFileSync(resolve(root,c.log),'utf8');return {id:c.id,exitCode:c.exitCode,
 classification:c.id==='f09-target'?'SCHEDULER_ETIMEDOUT':c.id==='f06-target'?'AUTH_BFF_HTTP_500':/25006|read-only transaction/.test(text)?'POSTGRES_READ_ONLY':/HTTP 500/.test(text)?'TARGET_HTTP_500':'OTHER_FAILURE',readOnlyAlsoObserved:/25006|read-only transaction/.test(text),log:c.log,logSha256:c.logSha256};});
const status={schema:'quantos-tp04-python-readmission/v1',observedSourceCommit:source,completedAt:new Date().toISOString(),status:'BLOCKED',formalAccepted:false,
 roots,closure:selected,sourceSnapshot,total:results.length,passed:results.filter(c=>c.status==='PASS').length,failed:classified,
 local:{total:results.filter(c=>!p.checks[c.id].database&&!p.checks[c.id].target).length,passed:results.filter(c=>c.status==='PASS'&&!p.checks[c.id].database&&!p.checks[c.id].target).length},
 target:{total:results.filter(c=>p.checks[c.id].database||p.checks[c.id].target).length,passed:results.filter(c=>c.status==='PASS'&&(p.checks[c.id].database||p.checks[c.id].target)).length},
 files,notes:['All checks actually rerun on frozen product source; no failed/historical result substituted.','R03_LOCAL is not a waiver for TP03/TP04/F0.','No production credentials, publication, subscription change or local database.']};
mkdirSync(resolve(root,base,'gates'),{recursive:true});
const blocked=new Map();
for(const nodeId of roots){const required=new Set(closure(nodes,nodeId).flatMap(id=>p.nodes[id].checks));const checks=results.filter(c=>required.has(c.id));
 const record={schema:'quantos-stage-readmission-failure/v1',nodeId,stage:'DEVELOPMENT',status:'BLOCKED',formalAccepted:false,observedSourceCommit:source,sourceSnapshot,
  planInput:planInput(nodes.get(nodeId)),checks,dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,stageGate:nodes.get(id).stage_gate})),reason:'Strict necessary closure has current target failures; local component PASS is insufficient'};
 const path=base+'/gates/'+nodeId.toLowerCase().replaceAll(':','-')+'.json',bytes=JSON.stringify(record,null,2)+'\n';writeFileSync(resolve(root,path),bytes);
 const n={...nodes.get(nodeId),stage_gate:{stage:'DEVELOPMENT',status:'BLOCKED',input_digest:digest(bytes),evidence:[path.slice(5)]}};
 blocked.set(nodeId,n);nodes.set(nodeId,n);bind(path);
}
for(const name of ['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'])writeFileSync(resolve(root,name),publishStages(readFileSync(resolve(root,name),'utf8'),blocked,name.includes('Frontend')?'FE:':'CORE:'));
assert.deepEqual(nodesFromPlans().get('CORE:R03').stage_gate,{stage:'DEVELOPMENT',status:'NOT_ASSESSED',input_digest:null,evidence:[]});
writeFileSync(resolve(root,base,'summary.json'),JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify({source,total:status.total,passed:status.passed,failed:classified,local:status.local,target:status.target,gates:roots.map(nodeId=>({nodeId,status:'BLOCKED'}))},null,2));
