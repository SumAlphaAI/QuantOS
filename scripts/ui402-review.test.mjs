import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateBrowser,checks} from './ui402-review.mjs';
const sha='a'.repeat(40);
test('UI402 function boundary is scoped and keeps target/P19/real positive join unrun',()=>{validateBoundary(boundary(sha));assert.equal(boundary(sha).realC09C12PositiveJoin,'NOT_RUN');});
for(const [key,value]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',stageGate:'PASS',productionCredentialsUsed:true,pushed:true,realC09C12PositiveJoin:'PASS',p19HighFidelity:'PASS',recursiveDependencyRevalidation:true,markerPositive:'ACTUAL_VENUE_EXECUTION',nextTask:'FE:UI-403'}))test('reject false promotion '+key,()=>assert.throws(()=>validateBoundary({...boundary(sha),[key]:value})));
test('no credential or external write command; integration refusal is expected failure',()=>{assert.equal(checks.find(c=>c.id==='integration-refusal').exit,1);assert(checks.every(c=>!c.command.some(s=>['push','deploy','--workspace'].includes(s))));assert(checks.some(c=>c.id==='p18-link'));});
const browser=()=>({errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{tests:[{projectName:'chromium',results:[{status:'passed'}]}]}]}]});
test('browser proof requires actual one-shot Chromium outcomes',()=>{validateBrowser(browser(),1);for(const key of ['unexpected','skipped','flaky']){const b=browser();b.stats[key]=1;assert.throws(()=>validateBrowser(b,1));}const b=browser();b.suites[0].specs[0].tests[0].results[0].status='interrupted';assert.throws(()=>validateBrowser(b,1));});
