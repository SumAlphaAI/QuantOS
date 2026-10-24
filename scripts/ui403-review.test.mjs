import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateBrowser,checks} from './ui403-review.mjs';
const sha='a'.repeat(40);
test('UI403 bounded financial function is distinct from P21/full integration/release',()=>validateBoundary(boundary(sha)));
for(const [key,value]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',stageGate:'PASS',productionCredentialsUsed:true,pushed:true,p21HighFidelity:'PASS',recursiveDependencyRevalidation:true,data:'PRODUCTION',nextTask:'FE:FEP-4',historicalEvidence:'REBOUND'}))test('reject false promotion '+key,()=>assert.throws(()=>validateBoundary({...boundary(sha),[key]:value})));
test('profile preserves existing integration refusal, route/source policy checks and local-only scope',()=>{assert.equal(checks.find(c=>c.id==='integration-refusal').exit,1);assert(checks.some(c=>c.id==='c14'));assert(!checks.some(c=>c.command.includes('--workspace')||c.command.includes('push')||c.command.includes('deploy')));});
const browser=()=>({errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{tests:[{projectName:'chromium',results:[{status:'passed'}]}]}]}]});
test('browser proof cannot substitute retries, skips or incomplete outcomes',()=>{validateBrowser(browser(),1);for(const key of ['unexpected','skipped','flaky']){const b=browser();b.stats[key]=1;assert.throws(()=>validateBrowser(b,1));}const b=browser();b.suites[0].specs[0].tests[0].results.push({status:'passed'});assert.throws(()=>validateBrowser(b,1));});
