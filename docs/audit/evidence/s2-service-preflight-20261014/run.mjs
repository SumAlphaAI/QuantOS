import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {base,inspect} from './scope.mjs';
import {checks,resolveCommand,testCounts} from './checks.mjs';
import {staticEnvironment,digest,executionOutcome,inventory,policy} from '../../../../scripts/provider-a1-receipts.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze harness before execution');
const attempt=process.argv[2]??'attempt-01';assert(/^attempt-[0-9]{2}$/.test(attempt));const out=base+'/'+attempt;assert(!existsSync(out),'fresh attempt required');mkdirSync(out,{recursive:true});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),initial=inspect();
const save=(name,x)=>writeFileSync(out+'/'+name,JSON.stringify(x,null,2)+'\n');save('inventory.json',initial);
const selectors=[...policy().commonInputs,...['scope.mjs','checks.mjs','boundary-probe.mjs','preflight.test.mjs','route-probe.mjs','run.mjs','verify.mjs','verify-negatives.mjs','fixtures.json','mapping.json','proposed-scope.md'].map(p=>base+'/'+p),'crates/','engines/','services/','proto/','bff/','tests/contract/','third_party/','forks/','docs/adr/','docs/operations/'];
const inputs=inventory(selectors);save('inputs.json',{sourceCommit:source,selectors,inputs});
const env=staticEnvironment(process.env);for(const k of Object.keys(env))if(k.startsWith('QUANTOS_'))delete env[k];Object.assign(env,{PATH:'/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH,QUANTOS_SKIP_ENV:'1',QUANTOS_RELEASE_PERFORMANCE:'0',CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true'});
const rows=[];
for(const check of checks){
 const command=resolveCommand(check,out),executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});
 const bytes=(r.stdout??'')+(r.stderr??''),log=out+'/'+check.id+'.log';writeFileSync(log,bytes);const outcome=executionOutcome(r,900000),counts=testCounts(bytes);
 const satisfied=r.status===check.expected&&!r.error&&!r.signal&&(!check.pattern||bytes.includes(check.pattern))&&(!check.minTests||(counts?.passed>=check.minTests&&counts.failed===0));
 const artifact=check.artifact?out+'/'+check.artifact:null;
 rows.push({id:check.id,command,executedAt,...outcome,expectedExitCode:check.expected,status:satisfied?'PASS':'FAIL',boundary:check.expected===2?'EXPECTED_LOCAL_GAP_NOT_ADMISSION':'LOCAL_CHECK_ONLY',testCounts:counts,log,logSha256:digest(bytes),...(artifact&&existsSync(artifact)?{artifact,artifactSha256:digest(readFileSync(artifact))}:{})});
 save('results.json',rows);console.log(check.id,rows.at(-1).status,r.status,counts??'');
}
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);assert.deepEqual(inventory(selectors),inputs,'input drift');assert.deepEqual(inspect().stageCounts,initial.stageCounts);
const routes=JSON.parse(readFileSync(out+'/http/receipt.json'));assert.equal(routes.observedOperations,11);assert.equal(routes.missingHandlers,11);assert.equal(routes.processTerminated,true);
const receipt={schema:'quantos-s2-service-preflight-results/v1',status:rows.every(r=>r.status==='PASS')?'PASS_WITH_LOCAL_GAPS':'FAIL',sourceCommit:source,checks:rows.length,closureNodes:39,tp01ClosureNodes:31,prerequisiteProof:{profile:'R1_LOCAL',nodes:27,checks:85,executionCommit:initial.prerequisiteExecutionCommit,mode:'REVALIDATED_INPUT_IDENTICAL_PRIOR_EXECUTION',published:false},unmappedNodes:12,publicConsumerHandlersMissing:11,plannedConsumerOperations:1,gate:'NOT_ASSESSED',localAdmission:'PROPOSED_NOT_REGISTERED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,deferred:initial.deferred,stageCounts:initial.stageCounts};save('receipt.json',receipt);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);save('artifact-index.json',{files:walk(out).sort().map(path=>({path,sha256:digest(readFileSync(path))}))});
console.log(JSON.stringify(receipt));if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
