import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync,cpSync,rmSync,readdirSync,statSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,dirname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {assess,policy,digest,staticEnvironment,executionOutcome,nodesFromPlans,closure,localChecks,planInput,validateLocalPrerequisites,inventory} from '../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/x03-replay-fix-20261014';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze source first');
const name=process.argv[2]??'attempt-01';assert(/^attempt-[0-9]{2}$/.test(name));
const attempt='docs/audit/evidence/provider-a1-remediation-20261004/x03-replay-fix-20261014/'+name,post=base+'/'+name;assert(!existsSync(attempt)&&!existsSync(post),'preserve attempts');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),nodes=nodesFromPlans(),p=policy(),all=closure(nodes,'CORE:X03'),mapped=closure(nodes,'CORE-GATE:R1-SERVICE');assert.equal(all.length,42);assert.equal(mapped.length,27);assert.equal(new Set(mapped.flatMap(id=>localChecks(id,p,'R1_LOCAL'))).size,85);
const scratch=mkdtempSync(resolve(tmpdir(),'quantos-x03-canonical-'));
const paths=[...new Set(Object.values(p.checks).filter(c=>c.artifact?.startsWith('docs/')&&!c.output).map(c=>dirname(c.artifact)))],history=paths.map(path=>({path,exists:existsSync(path)}));const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(n=>walk(resolve(path,n))):[path],originals=[];
for(const {path,exists}of history)if(exists){mkdirSync(dirname(resolve(scratch,path)),{recursive:true});cpSync(path,resolve(scratch,path),{recursive:true});for(const f of walk(path))originals.push({path:relative(process.cwd(),resolve(f)),sha256:digest(readFileSync(f))});}
let error;
try{assess(attempt,['CORE-GATE:R1-SERVICE'],{profile:'R1_LOCAL'});}catch(e){error=e;}
finally{mkdirSync(attempt,{recursive:true});try{for(const {path}of history)if(existsSync(path))for(const f of walk(path)){const old=resolve(scratch,relative(process.cwd(),f));if(!existsSync(old)||digest(readFileSync(old))!==digest(readFileSync(f))){const dest=resolve(attempt,'generated',relative(process.cwd(),f));mkdirSync(dirname(dest),{recursive:true});cpSync(f,dest);}}}finally{for(const {path,exists}of history){rmSync(path,{recursive:true,force:true});if(exists)cpSync(resolve(scratch,path),path,{recursive:true});}rmSync(scratch,{recursive:true,force:true});}for(const f of originals)assert.equal(digest(readFileSync(f.path)),f.sha256);writeFileSync(attempt+'/canonical-preservation.json',JSON.stringify({status:'PASS',restored:true,sourceCommit:source,files:originals},null,2)+'\n');}
if(error){writeFileSync(attempt+'/failure.json',JSON.stringify({status:'FAIL',phase:'r1-local-execution',sourceCommit:source,reason:error.message},null,2)+'\n');throw error;}
validateLocalPrerequisites(attempt+'/local-prerequisites.json',{profile:'R1_LOCAL'});
mkdirSync(post,{recursive:true});const inputs=inventory([...p.commonInputs,'crates/','services/','proto/','packages/','engines/','third_party/nautilus-agents/',base+'/run-local.mjs']);writeFileSync(post+'/inputs.json',JSON.stringify({sourceCommit:source,inputs},null,2)+'\n');
const env=staticEnvironment(process.env);for(const k of Object.keys(env))if(k.startsWith('QUANTOS_'))delete env[k];Object.assign(env,{PATH:'/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH,QUANTOS_SKIP_ENV:'1',QUANTOS_RELEASE_PERFORMANCE:'0',CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true'});
const checks=[];for(const[id,command,expected]of[
 ['format',['cargo','fmt','--all','--','--check'],0],
 ['clippy',['cargo','clippy','--locked','--offline','-p','quantos-execution','-p','quantos-evidence','--all-targets','--','-D','warnings'],0],
 ['owning-and-caller',['cargo','test','--locked','--offline','-p','quantos-execution','-p','quantos-evidence','--lib'],0],
 ['x-and-s2-domain',['cargo','test','--locked','--offline','-p','quantos-portfolio','-p','quantos-risk','-p','quantos-strategy','-p','quantos-reconcile','-p','execution-gateway','--lib'],0],
 ['gate-negatives',['node','--test','scripts/research-local-gate.test.mjs','scripts/tp02-local-gate.test.mjs','scripts/provider-a1-receipts.test.mjs'],0],
 ['withdrawn-r1',['node','scripts/research-local-gate.mjs','R1_LOCAL'],2],
 ['withdrawn-a3',['make','provider-a3-local-check'],2],
 ['withdrawn-tp02',['make','tp02-local-check'],2],
 ['plans',['pnpm','check:development-plans'],0],
 ['plans-negative',['pnpm','test:development-plans'],0],
 ['handoff',['make','development-handoff-check'],0],
 ['frontend-handoff',['node','scripts/check-frontend-gate-handoff.mjs'],0],
]){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),bytes=(r.stdout??'')+(r.stderr??''),log=post+'/'+id+'.log';writeFileSync(log,bytes);checks.push({id,command,executedAt,...executionOutcome(r,900000),expectedExitCode:expected,status:r.status===expected&&!r.error&&!r.signal?'PASS':'FAIL',log,logSha256:digest(bytes)});writeFileSync(post+'/results.json',JSON.stringify(checks,null,2)+'\n');console.log(id,checks.at(-1).status,r.status);}
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);assert.deepEqual(inventory([...p.commonInputs,'crates/','services/','proto/','packages/','engines/','third_party/nautilus-agents/',base+'/run-local.mjs']),inputs);
const counts=Object.fromEntries(['READY','NOT_ASSESSED','BLOCKED'].map(s=>[s,[...nodesFromPlans().values()].filter(n=>n.stage_gate.status===s).length]));assert.deepEqual(counts,{READY:0,NOT_ASSESSED:159,BLOCKED:0});
const receipt={schema:'quantos-x03-replay-fix-local/v1',status:checks.every(c=>c.status==='PASS')?'PASS_SCOPED_X03_FIX':'FAIL',sourceCommit:source,checks:checks.length,necessaryMappedProof:{profile:'R1_LOCAL',nodes:27,checks:85,index:attempt+'/local-prerequisites.json'},x03Closure:all.map(id=>({nodeId:id,normativeInput:planInput(nodes.get(id)),policyMapped:!!p.nodes[id]})),missingPolicyNodes:all.filter(id=>!p.nodes[id]),fullX03Admission:false,stageCounts:counts,formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false};writeFileSync(post+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,sourceCommit:source,mappedNodes:27,mappedChecks:85,fullClosure:42,unmapped:receipt.missingPolicyNodes.length,stageCounts:counts}));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
