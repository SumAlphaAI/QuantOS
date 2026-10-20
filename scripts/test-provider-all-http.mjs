// Current child probes, not child Gates or historical READY receipts.
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {environment} from './a1-functional-scope.mjs';
import {digest} from './provider-a1-receipts.mjs';
import {operations,domains} from './provider-all-contract.mjs';
const output=process.argv[2];assert(output&&process.argv.length===3);
const dir=dirname(output),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();mkdirSync(dir,{recursive:true});
const artifacts=[],executions=[],records=[];let failure=null;
try{for(const[id,script,args]of domains){const path=dir+'/'+id+'-http.json',start=Date.now(),startedAt=new Date().toISOString(),command=['node',script,path,...args];
 const r=spawnSync(process.execPath,command.slice(1),{env:environment(),stdio:'inherit',timeout:600000});executions.push({id,command,startedAt,completedAt:new Date().toISOString(),elapsedMs:Date.now()-start,exitCode:r.status,signal:r.signal,errorCode:r.error?.code??null});
 assert.equal(r.status,0,id+' HTTP failed');assert.equal(r.signal,null);assert(!r.error);
 const bytes=readFileSync(path),child=JSON.parse(bytes);assert.equal(child.status,'PASS');if(id!=='identity')assert.equal(child.sourceCommit,sourceCommit);else assert.equal(child.sourceCommit,undefined); // Legacy A1 probe has no embedded SHA; current parent execution binds it explicitly.
 artifacts.push({id,path,sha256:digest(bytes)});records.push(...child.records.map(r=>({...r,domain:id})));
 }for(const id of operations)assert(records.some(r=>r.operationId===id&&r.status>=200&&r.status<300),'missing success '+id);
}catch(e){failure=e.message;}
writeFileSync(output,JSON.stringify({schema:'quantos-provider-all-http/v1',status:failure?'FAIL':'PASS',failure,sourceCommit,operations,artifacts,executions,records,databaseExecution:false,externalExecution:false,formalAccepted:false,scope:'134 unique operations. Platform duplicates counted once; A1 legacy artifact source bound by current parent invocation. Native and generated-consumer mixed-domain probes are separate same-provider tests. No upstream Gate execution.'},null,2)+'\n');
console.log(JSON.stringify({status:failure?'FAIL':'PASS',operations:operations.length,records:records.length,failure}));if(failure)process.exitCode=1;
