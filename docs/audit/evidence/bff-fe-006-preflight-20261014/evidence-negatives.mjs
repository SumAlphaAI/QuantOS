import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {base} from './scope.mjs';
import {digest,staticEnvironment} from '../../../../scripts/provider-a1-receipts.mjs';
const out=base+'/evidence-negatives-01';assert(!existsSync(out),'preserve negative evidence');mkdirSync(out);
const attempt=base+'/attempt-01',cases=[
 ['mixed candidate',attempt+'/receipt.json',r=>r.sourceCommit='b'.repeat(40)],
 ['formal acceptance',attempt+'/receipt.json',r=>r.formalAccepted=true],
 ['false admission pass',attempt+'/receipt.json',r=>r.status='PASS'],
 ['missing recursive closure',attempt+'/inventory.json',r=>r.closure.pop()],
 ['repeated route identity',attempt+'/http/receipt.json',r=>r.operations[1].operationId=r.operations[0].operationId],
 ['false handler success',attempt+'/http/receipt.json',r=>r.operations[0].status=200],
 ['altered frozen input hash',attempt+'/inputs.json',r=>r.inputs[0].sha256='sha256:'+'0'.repeat(64)],
 ['altered test log',attempt+'/fixtures-negatives.log',null],
];const rows=[];
for(const[name,path,mutate]of cases){const original=readFileSync(path);let result;try{if(mutate){const r=JSON.parse(original);mutate(r);writeFileSync(path,JSON.stringify(r));}else writeFileSync(path,Buffer.concat([original,Buffer.from('\nTAMPER_PROBE\n')]));result=spawnSync('node',[base+'/verify.mjs','attempt-01'],{env:staticEnvironment(process.env),encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});const bytes=(result.stdout??'')+(result.stderr??'');const log=out+'/'+String(rows.length+1).padStart(2,'0')+'.log';writeFileSync(log,bytes);assert.equal(result.status,1,name+' should be rejected');assert(!result.error&&!result.signal);rows.push({name,path,status:'REJECTED',exitCode:result.status,log,logSha256:digest(bytes)});}finally{writeFileSync(path,original);}assert.deepEqual(readFileSync(path),original);}
const final=spawnSync('node',[base+'/verify.mjs','attempt-01'],{env:staticEnvironment(process.env),encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});writeFileSync(out+'/restored.log',(final.stdout??'')+(final.stderr??''));assert.equal(final.status,0);const result={status:'PASS',probes:rows,restored:true,formalAccepted:false};writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',probes:rows.length,restored:true}));
