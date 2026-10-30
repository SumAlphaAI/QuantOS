// Supplemental evidence verifier. No runtime code or acceptance history is changed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url)),read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),hash=v=>createHash('sha256').update(v).digest('hex');
const r=json(dir+'/consumer-fixture-inputs.json'),source=json(dir+'/inputs.json').sourceCommit;
assert.equal(r.schema,'quantos-current-consumer-fixture-binding/v1');assert.equal(r.sourceCommit,source);assert.equal(r.historyAcceptance,'NOT_INFERRED_ONLY_MODEL_INPUTS');assert.equal(r.capturedBeforeConsumer,true);assert(r.files.length>0);assert.equal(new Set(r.files.map(f=>f.path)).size,r.files.length);
for(const f of r.files){assert(/^docs\/audit\/evidence\/[a-zA-Z0-9/._-]+\.json$/.test(f.path)&&!f.path.includes('..'));assert.equal(hash(execFileSync('git',['show',source+':'+f.path],{maxBuffer:64e6})),f.sha256);assert.equal(hash(read(f.path)),f.sha256);}
const consumer=json(dir+'/executions.json').find(r=>r.id==='consumer');assert(consumer&&consumer.exitCode===0);assert(Date.parse(r.capturedAt)<=Date.parse(consumer.startedAt));
console.log(JSON.stringify({status:'PASS_CURRENT_CONSUMER_FIXTURE_INPUTS_BOUND_BEFORE_EXECUTION',sourceCommit:source,files:r.files.length,historyAcceptance:r.historyAcceptance}));
