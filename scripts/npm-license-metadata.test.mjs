import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLicenseMetadata } from './lib/npm-license-metadata.mjs';
import { allowed, licenseAllowed } from './license-policy.mjs';

const name='@bufbuild/buf-win32-x64',version='1.72.0',integrity='sha512-fixture';
const manifest={name,version,dist:{integrity},license:'MIT'};
const ok = (value=manifest) => ({ok:true,status:200,json:async()=>value});
const http = status => ({ok:false,status});
function harness(outcomes) {
  const attempts=[],pauses=[],urls=[];let calls=0;
  return {attempts,pauses,urls,get calls(){return calls},options:{
    fetchImpl:async(url,options)=>{urls.push(url);assert(options.signal instanceof AbortSignal);
      const result=outcomes[Math.min(calls++,outcomes.length-1)];if(result instanceof Error)throw result;return result;},
    pause:async ms=>pauses.push(ms),onAttempt:attempt=>attempts.push(attempt),
  }};
}
const run=h=>fetchLicenseMetadata(name,version,integrity,h.options);

test('502 registry outage retries the identical GET and records failure before success',async()=>{
  let cancelled=0;const h=harness([{...http(502),body:{cancel:async()=>cancelled++}},ok()]);
  assert.deepEqual(await run(h),manifest);assert.equal(h.calls,2);assert.equal(cancelled,1);
  assert.deepEqual(h.pauses,[250]);assert.deepEqual(h.attempts.map(a=>a.status),['FAIL','PASS']);
  assert.equal(h.attempts[0].httpStatus,502);assert.equal(h.attempts[0].transient,true);
  assert.equal(new Set(h.urls).size,1);assert.equal(h.urls[0],'https://registry.npmjs.org/%40bufbuild%2Fbuf-win32-x64/1.72.0');
});
for(const status of [408,429,500,502,503,504])test(`persistent HTTP ${status} exhausts exactly three requests and remains failure`,async()=>{
  const h=harness([http(status)]);await assert.rejects(run(h),new RegExp(String(status)));
  assert.equal(h.calls,3);assert.deepEqual(h.pauses,[250,500]);assert(h.attempts.every(a=>a.status==='FAIL'));
});
for(const status of [400,401,403,404])test(`permanent HTTP ${status} fails without retry`,async()=>{
  const h=harness([http(status)]);await assert.rejects(run(h));assert.equal(h.calls,1);assert.deepEqual(h.pauses,[]);
});
test('connection reset and request timeout retry without losing their failed attempts',async()=>{
  const h=harness([new TypeError('fetch failed',{cause:Object.assign(new Error('reset'),{code:'ECONNRESET'})}),new DOMException('timeout','TimeoutError'),ok()]);
  await run(h);assert.equal(h.calls,3);assert.deepEqual(h.attempts.map(a=>a.status),['FAIL','FAIL','PASS']);
});
for(const [label,error] of [['invalid TLS',new TypeError('fetch failed',{cause:Object.assign(new Error('bad certificate'),{code:'CERT_HAS_EXPIRED'})})],['caller cancellation',new DOMException('cancelled','AbortError')],['invalid JSON',new SyntaxError('invalid JSON')]])test(`${label} is not retried`,async()=>{
  const h=harness([error]);await assert.rejects(run(h));assert.equal(h.calls,1);
});
for(const [label,value] of [['missing integrity',{...manifest,dist:{}}],['wrong integrity',{...manifest,dist:{integrity:'sha512-other'}}],['wrong package',{...manifest,name:'other'}],['wrong version',{...manifest,version:'0.0.0'}]])test(`${label} cannot retry into accepted metadata`,async()=>{
  const h=harness([ok(value),ok()]);await assert.rejects(run(h),/identity\/integrity/);assert.equal(h.calls,1);assert.equal(h.attempts[0].transient,false);
});
test('missing locked integrity fails before network access',async()=>{
  const h=harness([ok()]);await assert.rejects(fetchLicenseMetadata(name,version,undefined,h.options),/Locked integrity/);assert.equal(h.calls,0);
});
test('retrieval success cannot waive a disallowed license',async()=>{
  const h=harness([http(502),ok({...manifest,license:'UNLICENSED'})]);
  const value=await run(h);assert.equal(licenseAllowed(value.license,allowed),false);assert.equal(h.calls,2);
});

// Exercise the real inventory CLI with a one-package lock and synthetic registry.
// This verifies that exhausted fetches and denied licenses cannot leave PASS.
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
for(const [label,plan,expectedExit,expectedCalls] of [
  ['502 recovery',[{status:502},{status:200,data:manifest}],0,2],
  ['persistent 502',[{status:502}],1,3],
  ['bad integrity',[{status:200,data:{...manifest,dist:{integrity:'sha512-other'}}}],1,1],
  ['denied license after recovery',[{status:502},{status:200,data:{...manifest,license:'UNLICENSED'}}],1,2],
])test(`inventory CLI ${label} records the real outcome`,()=>{
  const directory=mkdtempSync(join(tmpdir(),'quantos-license-'));
  try {
    for(const path of ['scripts/lib','security','bin'])mkdirSync(join(directory,path),{recursive:true});
    for(const path of ['scripts/check-node-licenses.mjs','scripts/license-policy.mjs','scripts/lib/npm-license-metadata.mjs'])copyFileSync(resolve(path),join(directory,path));
    symlinkSync(resolve('node_modules'),join(directory,'node_modules'),'dir');
    writeFileSync(join(directory,'pnpm-lock.yaml'),JSON.stringify({packages:{[`${name}@${version}`]:{resolution:{integrity}}}}));
    writeFileSync(join(directory,'security/node-license-allowlist.json'),JSON.stringify({allowedLicenses:['MIT']}));
    writeFileSync(join(directory,'security/license-evidence.json'),'{}');
    writeFileSync(join(directory,'THIRD_PARTY_NOTICES.md'),'Synthetic fixture');
    writeFileSync(join(directory,'bin/pnpm'),"#!/bin/sh\nprintf '[{}]\\n'\n",{mode:0o755});
    writeFileSync(join(directory,'registry.mjs'),`import fs from 'node:fs';
      const plan=JSON.parse(process.env.QUANTOS_REGISTRY_FIXTURE);let call=0;
      globalThis.fetch=async()=>{fs.appendFileSync(new URL('./calls.log',import.meta.url),'GET\\n');
        const next=plan[Math.min(call++,plan.length-1)];return new Response(JSON.stringify(next.data??{}),{status:next.status});};`);
    const result=spawnSync(process.execPath,['--import',pathToFileURL(join(directory,'registry.mjs')).href,'scripts/check-node-licenses.mjs'],{
      cwd:directory,env:{...process.env,PATH:join(directory,'bin')+':'+process.env.PATH,QUANTOS_REGISTRY_FIXTURE:JSON.stringify(plan)},encoding:'utf8',timeout:15000,
    });
    assert.equal(result.status,expectedExit,result.stderr);
    assert.equal(readFileSync(join(directory,'calls.log'),'utf8').trim().split('\n').length,expectedCalls);
    const receipt=JSON.parse(readFileSync(join(directory,'artifacts/f02/node-licenses.json'),'utf8'));
    assert.equal(receipt.status,expectedExit===0?'PASS':'FAIL');
    assert.equal(receipt.metadataRequests.length,expectedCalls);
    if(expectedCalls>1)assert.equal(receipt.metadataRequests[0].status,'FAIL');
  } finally {rmSync(directory,{recursive:true,force:true});}
});
