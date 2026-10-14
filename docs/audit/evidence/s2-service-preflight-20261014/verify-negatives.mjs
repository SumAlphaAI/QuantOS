import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {base} from './scope.mjs';
import {validateReceipt,validateResults} from './verify.mjs';
const attempt=process.argv.find(s=>/^attempt-[0-9]{2}$/.test(s))??'attempt-01',out=base+'/'+attempt;
const json=p=>JSON.parse(readFileSync(p));
for(const[label,mutate]of[
 ['grant stage',r=>r.gate='READY'],['formal approval',r=>r.formalAccepted=true],['database proof',r=>r.databaseExecution=true],['external proof',r=>r.externalExecution=true],['performance proof',r=>r.performanceAccepted=true],['drop TP01 closure',r=>r.tp01ClosureNodes=30],['drop S2 closure',r=>r.closureNodes=38],['hide policy gap',r=>r.unmappedNodes=0],['hide missing provider',r=>r.publicConsumerHandlersMissing=0],['rename aggregate PASS',r=>r.status='PASS'],['mark deferred target passed',r=>r.deferred.supabase='PASS'],['publish old prerequisite',r=>r.stageCounts.READY=1],
])test(`receipt rejects ${label}`,()=>{const r=json(out+'/receipt.json');mutate(r);assert.throws(()=>validateReceipt(r));});
for(const[label,mutate]of[
 ['omit command',r=>r.pop()],['duplicate command',r=>r[0]=r[1]],['erase expected refusal',r=>r.find(x=>x.exitCode===2).exitCode=0],['pretend timeout passed',r=>r[0].timedOut=true],['hide signal',r=>r[0].signal='SIGTERM'],['change command',r=>r[0].command=['true']],['tamper log hash',r=>r[0].logSha256='0'.repeat(64)],['inflate counts',r=>r.find(x=>x.testCounts).testCounts.passed+=1000],['tamper artifact',r=>r.find(x=>x.artifact).artifactSha256='0'.repeat(64)],
])test(`execution evidence rejects ${label}`,()=>{const r=json(out+'/results.json');mutate(r);assert.throws(()=>validateResults(r,out));});
