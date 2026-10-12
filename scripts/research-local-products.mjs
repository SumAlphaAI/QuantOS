// Local modules and owned fixtures only. No database or external service is started.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {digest,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
import {validateProducts} from './r04-stage-check.mjs';
import YAML from 'yaml';
import {executionCommands,executionSources} from './bff-fe-001-execution.mjs';
export function normalizeDigest(value){assert.match(value,/^(?:sha256:)?[a-f0-9]{64}$/);return value.startsWith('sha256:')?value:'sha256:'+value;}
export const r04Commands=[
 ['cargo','test','-p','quantos-runtime','--locked','--offline','--test','signal_proposal_contracts'],
 ['cargo','test','-p','quantos-runtime','--locked','--offline','--test','signal_proposal_orchestration'],
 ['engines/.venv/bin/python','-m','pytest','engines/tests/test_r04_research_context.py','-q'],
 ['node','--test','scripts/r04-stage-check.test.mjs','scripts/execution-outcome.test.mjs','scripts/r04-orchestration-receipt.test.mjs'],
];
export async function verifyArtifact(kind,path,source){
 const bytes=readFileSync(path),r=JSON.parse(bytes),dir=dirname(path);
 if(kind==='research-local-products'){
  assert.equal(r.schema,'quantos-research-local-products/v1');assert.equal(r.sourceCommit,source);assert.equal(r.status,'PASS');assert.equal(r.databaseExecution,false);assert.equal(r.formalAccepted,false);
  assert.deepEqual(r.checks.map(c=>c.command),r04Commands);assert.deepEqual(r.files.map(x=>x.file),['proposal-matrix.json','research-consumption.json','order-denial.json']);
  for(const c of r.checks){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.executionErrorCode,null);assert.equal(c.signal,null);assert(/^(?:contracts|orchestration|context|negatives)\.log$/.test(c.log.file));assert.equal(digest(readFileSync(resolve(dir,c.log.file))),c.log.sha256);const output=readFileSync(resolve(dir,c.log.file),'utf8');assert.match(output,c.command[0]==='node'?/^(?:#|ℹ) pass [1-9]\d*$/m:/[1-9]\d* passed/);assert(!/test result: FAILED|(?:^|[,\s])[1-9]\d* (?:failed|errors?|skipped|deselected)|^(?:#|ℹ) (?:fail|skipped) [1-9]/m.test(output),'incomplete child suite');}
  for(const f of r.files)assert.equal(digest(readFileSync(resolve(dir,f.file))),f.sha256);
  validateProducts({matrix:JSON.parse(readFileSync(resolve(dir,r.files[0].file))),consumption:JSON.parse(readFileSync(resolve(dir,r.files[1].file))),orderDenial:JSON.parse(readFileSync(resolve(dir,r.files[2].file)))});
 }else if(kind==='a2-local-semantics'){
  assert.equal(r.schema,'quantos-bff-a2-executed-semantics/v1');assert.equal(r.status,'PASS');assert.equal(r.sourceCommit,source);assert.deepEqual(r.results.map(x=>[x.command,x.args]),executionCommands);
  for(const [key,file]of Object.entries(executionSources))assert.equal(r.sourceHashes[key],digest(readFileSync(file)).slice(7),'semantic source changed');
  for(const [i,x]of r.results.entries()){assert.equal(x.exitCode,0);const bytes=readFileSync(resolve(dir,'semantics-'+i+'.log'));assert.equal(digest(bytes),normalizeDigest(x.outputSha256));assert.match(bytes.toString(),/passed/);}
 }else if(kind==='a2-local-mutations'){
  assert.equal(r.schema,'quantos-a2-local-mutations/v1');assert.equal(r.sourceCommit,source);assert.equal(r.status,'PASS');assert(['identity','audit'].includes(r.component));assert.equal(r.records.length,r.component==='identity'?8:5);assert.equal(new Set(r.records.map(x=>x.name)).size,r.records.length);
  for(const x of r.records){assert.equal(x.rejected,true);assert(Number.isInteger(x.exitCode)&&x.exitCode>0);assert(/^mutation-[a-z0-9-]+\.log$/.test(x.log.file));const bytes=readFileSync(resolve(dir,x.log.file));assert.equal(normalizeDigest(x.outputSha256??x.logSha256),x.log.sha256);assert.equal(digest(bytes),x.log.sha256);assert(bytes.includes(x.expectedTest+' ... FAILED'));assert(bytes.includes('test result: FAILED.'));}
 }else if(kind==='a2-local-http'){
  assert.equal(r.schema,'quantos-bff-provider-contract/v1');assert.equal(r.status,'PASS');assert.equal(r.failure,null);assert.equal(r.scope,'loopback-reference-only; no DB/IdP/storage/staging');
  const catalog=YAML.parse(readFileSync('bff/page-operation-catalog.yaml','utf8')),ops=['C01','C17','C10'].flatMap(c=>catalog.contracts[c].publishedOperations);assert.equal(ops.length,26);
  for(const op of ops)assert(r.records.some(x=>x.operationId===op&&x.status>=200&&x.status<300&&x.requestValidation==='PASS'&&x.responseValidation==='PASS'&&x.issues.length===0),'HTTP success coverage missing: '+op);
  assert(r.records.some(x=>x.status===422));assert(r.records.some(x=>x.status===409));assert(r.records.every(x=>x.responseValidation==='PASS'&&x.issues.length===0));
 }else if(kind==='bff003-local-probes'){
  execFileSync(process.execPath,['scripts/check-bff-fe-003-probes.mjs',path],{stdio:'pipe'});
 }else throw Error('unknown local artifact kind');
 return {status:'PASS',kind,sourceCommit:source,databaseExecution:false,formalAccepted:false};
}
export async function run(mode,path){
 assert(['r04','a2','bff003','identity-mutations','audit-mutations'].includes(mode));assert(path&&!existsSync(path),'new artifact path required');const dir=dirname(path);mkdirSync(dir,{recursive:true});
 const env=staticEnvironment(process.env),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();env.CARGO_NET_OFFLINE='true';env.UV_OFFLINE='1';
 if(mode==='r04')env.QUANTOS_R04_EVIDENCE_DIR=resolve(dir);
 if(mode==='bff003')env.QUANTOS_BFF003_PROBE_OUTPUT=resolve(path);
 const mutation=mode.endsWith('-mutations');
 const commands=mutation?[['node','scripts/test-bff-fe-'+(mode==='identity-mutations'?'001':'007')+'-mutations.mjs',resolve(dir)]]:mode==='r04'?r04Commands:mode==='a2'?[['node','scripts/test-bff-provider-contract.mjs',path]]:[['cargo','test','-p','bff-gateway','-p','quantos-runtime','--lib','--locked','--offline','--','--skip','real_logout_db_write_matches_persistent_trace']];
 const checks=[];for(const [i,command]of commands.entries()){
  const executedAt=new Date().toISOString(),r=spawnSync(command[0]==='node'?process.execPath:command[0],command.slice(1),{env,encoding:'utf8',timeout:840000,maxBuffer:32*1024*1024});const output=(r.stdout??'')+(r.stderr??'');const file=mode==='r04'?['contracts','orchestration','context','negatives'][i]+'.log':mode+'.log';writeFileSync(resolve(dir,file),output);const check={command,executedAt,...executionOutcome(r,840000),log:{file,sha256:digest(output)}};checks.push(check);console.log(file,check.status);assert.equal(check.status,'PASS','local execution failed; see '+file);
 }
 if(mode==='r04')writeFileSync(path,JSON.stringify({schema:'quantos-research-local-products/v1',sourceCommit:source,status:'PASS',databaseExecution:false,formalAccepted:false,checks,files:['proposal-matrix.json','research-consumption.json','order-denial.json'].map(file=>({file,sha256:digest(readFileSync(resolve(dir,file)))}))},null,2)+'\n');
 if(mutation){const raw=JSON.parse(readFileSync(resolve(dir,'mutations.json')));writeFileSync(path,JSON.stringify({schema:'quantos-a2-local-mutations/v1',sourceCommit:source,status:'PASS',component:mode.split('-')[0],records:raw.records.map(x=>({...x,log:{file:'mutation-'+x.name+'.log',sha256:normalizeDigest(x.outputSha256??x.logSha256)}}))},null,2)+'\n');}
 const kind=mutation?'a2-local-mutations':{r04:'research-local-products',a2:'a2-local-http',bff003:'bff003-local-probes'}[mode];await verifyArtifact(kind,path,source);console.log('LOCAL_PRODUCTS_PASS '+kind);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--verify')console.log(JSON.stringify(await verifyArtifact(...process.argv.slice(3))));else await run(...process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
