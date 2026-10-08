const test=require('node:test'),assert=require('node:assert/strict');
const {executeTarget}=require('./lib/development-target-command.cjs');
test('completed command records diagnostic and redacts configured secret split across chunks',async()=>{
 const secret='private-test-value-123';const r=await executeTarget(process.execPath,['-e',"process.stdout.write('private-test-');setTimeout(()=>process.stdout.write('value-123'),10)"],{env:{...process.env,TEST_PASSWORD:secret},timeoutMs:2000});
 assert.equal(r.exitCode,1);assert.equal(r.errorCode,'SECRET_LEAK_DETECTED');assert.equal(r.processGroupClosed,true);assert.equal(r.timedOut,false);assert.equal(r.output,'[REDACTED]');
});
test('deadline kills an actual owned grandchild, preserves FAIL and logs',async()=>{
 const script=`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});console.log('OWNED_GRANDCHILD='+c.pid);setInterval(()=>{},1000);`;
 const r=await executeTarget(process.execPath,['-e',script],{timeoutMs:500});assert.equal(r.timedOut,true);assert.equal(r.errorCode,'ETIMEDOUT');assert.notEqual(r.exitCode,0);assert.equal(r.processGroupClosed,true);
 const pid=Number(r.output.match(/OWNED_GRANDCHILD=(\d+)/)[1]);assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
test('successful leader with detached lifetime descendant is FAIL even after cleanup',async()=>{
 const script=`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log('OWNED_GRANDCHILD='+c.pid);c.unref();`;
 const r=await executeTarget(process.execPath,['-e',script],{timeoutMs:2000});assert.equal(r.orphanDetected,true);assert.equal(r.exitCode,1);assert.equal(r.processGroupClosed,true);
 const pid=Number(r.output.match(/OWNED_GRANDCHILD=(\d+)/)[1]);assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});
test('spawn failure and evidence-write failure cannot become success',async()=>{
 const missing=await executeTarget('/path/not-present',[],{timeoutMs:2000});assert.notEqual(missing.exitCode,0);assert.equal(missing.errorCode,'ENOENT');assert.equal(missing.processGroupClosed,true);
 const bad=await executeTarget(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:2000,onStart(){throw Error('private');}});assert.notEqual(bad.exitCode,0);assert.equal(bad.errorCode,'EVIDENCE_WRITE_FAILED');assert.equal(bad.processGroupClosed,true);
});

test('explicit cancellation cleans its group and never passes',async()=>{
 const controller=new AbortController();setTimeout(()=>controller.abort(),100);
 const r=await executeTarget(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:2000,abortSignal:controller.signal});assert.equal(r.errorCode,'CANCELLED');assert.notEqual(r.exitCode,0);assert.equal(r.processGroupClosed,true);
});
test('interleaved stderr cannot break secret redaction',async()=>{
 const secret='private-test-value-123';const r=await executeTarget(process.execPath,['-e',"process.stdout.write('private-test-');process.stderr.write('noise');setTimeout(()=>process.stdout.write('value-123'),10)"],{env:{...process.env,TEST_PASSWORD:secret},timeoutMs:2000});assert.equal(r.exitCode,1);assert.equal(r.errorCode,'SECRET_LEAK_DETECTED');assert.equal(r.output,'[REDACTED]noise');
});
test('output limit is bounded failure without partial secret chunks',async()=>{
 const r=await executeTarget(process.execPath,['-e',"console.log('private'.repeat(1000));setInterval(()=>{},1000)"],{timeoutMs:2000,maxBytes:10});assert.equal(r.errorCode,'OUTPUT_LIMIT_EXCEEDED');assert.notEqual(r.exitCode,0);assert.equal(r.processGroupClosed,true);assert(!r.output.includes('private'));
});

test('normal completion without sensitive output remains PASS with closed process group',async()=>{
 const r=await executeTarget(process.execPath,['-e',"console.log('FUNCTIONAL_PASS')"],{timeoutMs:2000});assert.equal(r.exitCode,0);assert.equal(r.errorCode,null);assert.equal(r.secretLeakDetected,false);assert.equal(r.processGroupClosed,true);assert.match(r.output,/FUNCTIONAL_PASS/);
});
