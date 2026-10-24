import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateBrowser,validateGeometry,checks} from './ui-p23-review.mjs';
const sha='a'.repeat(40);
test('UI_P23 bounded high fidelity stays separate from full integration and release',()=>validateBoundary(boundary(sha)));
for(const [key,value]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',stageGate:'PASS',productionCredentialsUsed:true,pushed:true,designAdaptation:'PASS',recursiveDependencyRevalidation:true,data:'PRODUCTION',g4Gate:'READY',fep4Gate:'READY',nextTask:'FE:FEP-4',historicalEvidence:'REBOUND'}))test('reject false promotion '+key,()=>assert.throws(()=>validateBoundary({...boundary(sha),[key]:value})));
test('profile preserves existing integration refusal, route/source policy checks and local-only scope',()=>{assert.equal(checks.find(c=>c.id==='integration-refusal').exit,1);assert(checks.some(c=>c.id==='c16'));assert(!checks.some(c=>c.command.includes('--workspace')||c.command.includes('push')||c.command.includes('deploy')));});
const browser=()=>({errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{tests:[{projectName:'chromium',results:[{status:'passed'}]}]}]}]});
test('browser proof cannot substitute retries, skips or incomplete outcomes',()=>{validateBrowser(browser(),1);for(const key of ['unexpected','skipped','flaky']){const b=browser();b.stats[key]=1;assert.throws(()=>validateBrowser(b,1));}const b=browser();b.suites[0].specs[0].tests[0].results.push({status:'passed'});assert.throws(()=>validateBrowser(b,1));});

test('geometry rejects missing, overflowing or overlapping panels',()=>{const rows=['dark','light'].flatMap(theme=>[1672,1440,1024,390].map(width=>({theme,width,filter:{x:0,width:100,right:100},feed:{x:width===390?0:110,width:100,right:width===390?100:210},detail:{x:width===390?0:220,width:100,right:width===390?100:320}})));validateGeometry(rows);assert.throws(()=>validateGeometry(rows.slice(1)));for(const patch of [{right:9999},{x:-1},{width:0}]){const v=globalThis.structuredClone(rows);Object.assign(v[0].feed,patch);assert.throws(()=>validateGeometry(v));}});
