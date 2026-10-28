import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checks,directory,validateExecutions,validateBrowser,validateOff,reviewedDigest} from './core-l4-review.mjs';
import {hash,base} from './core-l4-assessment.mjs';
const source='1'.repeat(40),attempt=directory+'/attempt-01';
function browser(){const first={source:'REFERENCE_COMMITTED_RESPONSE_DROPPED',bodyHash:'body',idempotencyDigest:'key'},second={source:'REFERENCE_BYTES',bodyHash:'body',idempotencyDigest:'key'};return{schema:'quantos-core-l4-browser/v1',sourceCommit:source,venueIO:'ACTUAL_L02_MTLS_PROCESS_WITH_OWNED_L01_PORT',nativeSubmissions:1,zone:{backend:'OWNED_L02_MTLS',protocolCalls:1,pid:123,actualTestnetConnected:false},approvalAudits:2,c10Nodes:5,c10ReadOnly:true,orderRouteCanonical:true,actualTestnetConnected:false,originalPairs:2,pairs:[[first,second,second],[first,second]]};}
const off=()=>({sourceCommit:source,serverFlag:false,publicStatus:403,uiHighRiskActions:0,nativeProtocolCalls:0,zone:{protocolCalls:0},actualTestnetConnected:false});
test('current UI mTLS common audit and closed server stay bounded',()=>{validateBrowser(browser(),source);validateOff(off(),source);assert.equal(checks.length,24);assert(!checks.some(c=>c[1].includes('--workspace')));});
for(const k of Object.keys(browser()))test('browser refuses altered '+k,()=>{const v=browser();v[k]=null;assert.throws(()=>validateBrowser(v,source));});
for(const k of Object.keys(off()))test('default off refuses altered '+k,()=>{const v=off();v[k]=null;assert.throws(()=>validateOff(v,source));});
test('original request recovery body/key must match',()=>{const v=browser();v.pairs[1][1]={...v.pairs[1][1],idempotencyDigest:'new'};assert.throws(()=>validateBrowser(v,source));});
function executions(){return checks.map(([id,args,expected=0])=>({id,command:args.map(a=>a.replaceAll('{attempt}',attempt)),exitCode:expected,signal:null,errorCode:null,log:attempt+'/'+id+'.log',logSha256:hash(Buffer.from('log')),startedAt:'2026-10-28T00:00:00Z',finishedAt:'2026-10-28T00:00:01Z'}));}
test('expected refusals are verified alongside successful commands',()=>validateExecutions(executions(),attempt,()=>Buffer.from('log')));
for(const [name,edit]of [['missing',v=>v.pop()],['zero refusal',v=>{v.find(e=>e.id==='integration-refusal').exitCode=0;}],['failed',v=>{v[0].exitCode=1;}],['signal',v=>{v[0].signal='SIGTERM';}],['timeout',v=>{v[0].errorCode='ETIMEDOUT';}],['command',v=>{v[0].command=['echo','PASS'];}],['log',v=>{v[0].logSha256='a'.repeat(64);}],['reverse time',v=>{v[0].finishedAt='2026-10-27T00:00:00Z';}]])test('execution packet refuses '+name,()=>{const v=executions();edit(v);assert.throws(()=>validateExecutions(v,attempt,()=>Buffer.from('log')));});
const digestPath=attempt+'/browser/cases/owned-case-chromium/frontend-g8.json';
const text=JSON.stringify({sourceCommit:source,rows:[{keyHash:'a'.repeat(64)}]},null,2);
const line=text.split('\n').findIndex(l=>l.includes('keyHash'))+1;
const finding=()=>({File:'/tmp/scan/positive/'+digestPath,RuleID:'generic-api-key',StartLine:line,EndLine:line});
test('only exact owned synthetic idempotency digest is classified',()=>{assert.equal(reviewedDigest(finding(),attempt,source,()=>text).classification,'OWNED_IDEMPOTENCY_SHA256_NOT_CREDENTIAL');});
for(const [name,edit]of [['path',f=>{f.File='/tmp/scan/positive/private.json';}],['rule',f=>{f.RuleID='private-key';}],['range',f=>{f.EndLine++;}],['field',f=>{f.StartLine=1;f.EndLine=1;}]])test('secret classification refuses '+name,()=>{const f=finding();edit(f);assert.equal(reviewedDigest(f,attempt,source,()=>text),null);});
test('secret-looking access token and unbound source cannot use digest classification',()=>{assert.equal(reviewedDigest(finding(),attempt,source,()=>text.replace('keyHash','accessToken')),null);assert.equal(reviewedDigest(finding(),attempt,'2'.repeat(40),()=>text),null);});
test('only named preflight scope can use its original SHA',()=>{const f=finding();f.File='/tmp/scan/positive/'+directory+'/preflight/browser-02/cases/owned-case-chromium/frontend-g8.json';assert(reviewedDigest(f,attempt,source,()=>text.replace(source,base)));f.File=f.File.replace('browser-02','browser-09');assert.equal(reviewedDigest(f,attempt,source,()=>text.replace(source,base)),null);});
