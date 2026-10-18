// Scoped function recorder. Does not execute graph dependencies or mutate canonical evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {root,digest} from './provider-a1-receipts.mjs';
import {snapshot,commands,environment} from './bff-fe-008-functional-scope.mjs';
import {buildReceipt,publish,verifySource} from './bff-fe-008-functional-gate.mjs';
assert(process.argv.length<=3);
const attempt=process.argv[2]??'docs/audit/evidence/bff-fe-008-local-20261018/function-attempt-01';
assert(/^docs\/audit\/evidence\/bff-fe-008-local-[0-9]{8}\/function-attempt-[0-9]{2}$/.test(attempt));assert(!existsSync(attempt),'use a fresh attempt');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),before=snapshot(),rows=[];
verifySource(before,source);
mkdirSync(attempt+'/logs',{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify(before,null,2)+'\n');
let active,interrupted=null;
function stop(signal){interrupted=signal;try{if(active)process.kill(-active.pid,'SIGTERM');}catch{/* already exited */}}
const onTerm=()=>stop('SIGTERM'),onInt=()=>stop('SIGINT');
process.on('SIGTERM',onTerm);process.on('SIGINT',onInt);
try{
 for(const check of commands(attempt)){
  if(interrupted)throw Error('execution interrupted '+interrupted);
  const startedAt=new Date().toISOString(),start=Date.now(),log=attempt+'/logs/'+check.id+'.log',output=createWriteStream(log);let timedOut=false,errorCode=null;
  active=spawn(check.command[0],check.command.slice(1),{cwd:root,env:environment(),detached:true,stdio:['ignore','pipe','pipe']});active.stdout.pipe(output,{end:false});active.stderr.pipe(output,{end:false});
  const timer=setTimeout(()=>{timedOut=true;try{process.kill(-active.pid,'SIGKILL');}catch{}},check.timeoutMs);
  const {code,signal}=await new Promise(resolve=>{active.once('error',e=>{errorCode=e.code??'SPAWN_ERROR';resolve({code:null,signal:null});});active.once('close',(code,signal)=>resolve({code,signal}));});
  clearTimeout(timer);await new Promise(resolve=>output.end(resolve));active=null;
  const row={...check,startedAt,completedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:code,signal,errorCode,timedOut,status:interrupted?'INTERRUPTED':code===0&&!signal&&!errorCode&&!timedOut?'PASS':'FAIL',log,logSha256:digest(readFileSync(log))};rows.push(row);
  writeFileSync(attempt+'/execution-results.json',JSON.stringify(rows,null,2)+'\n');console.log(check.id,row.status,row.elapsedMs+'ms');assert.equal(row.status,'PASS');
 }
 if(interrupted)throw Error('execution interrupted '+interrupted);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,'HEAD changed during scoped execution');
 assert.deepEqual(snapshot(),before,'affected inputs changed during execution');
 const receipt=buildReceipt(attempt,source,before,rows);writeFileSync(attempt+'/function-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(publish(receipt),null,2));
}catch(error){writeFileSync(attempt+'/failure.json',JSON.stringify({schema:'quantos-bff008-function-attempt-failure/v1',sourceCommit:source,status:interrupted?'INTERRUPTED':'FAIL',reason:interrupted??error.message,completedChecks:rows.length,formalAccepted:false},null,2)+'\n');console.error(error.message);process.exitCode=interrupted?130:1;}
process.removeListener('SIGTERM',onTerm);process.removeListener('SIGINT',onInt);
