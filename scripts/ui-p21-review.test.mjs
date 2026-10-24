import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateBrowser,validateGeometry,checks} from './ui-p21-review.mjs';
const sha='a'.repeat(40);
test('P21 page proof remains distinct from full integration and release',()=>validateBoundary(boundary(sha)));
for(const [key,value]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',stageGate:'PASS',productionCredentialsUsed:true,pushed:true,richChart:'PROVIDER_PASS',recursiveDependencyRevalidation:true,data:'PRODUCTION',nextTask:'FE:FEP-4',historicalEvidence:'REBOUND'}))test('reject false promotion '+key,()=>assert.throws(()=>validateBoundary({...boundary(sha),[key]:value})));
test('profile preserves existing integration refusal, route/source policy checks and local-only scope',()=>{assert.equal(checks.find(c=>c.id==='integration-refusal').exit,1);assert(checks.some(c=>c.id==='ui403-impact'));assert(!checks.some(c=>c.command.includes('--workspace')||c.command.includes('push')||c.command.includes('deploy')));});
const browser=()=>({errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{tests:[{projectName:'chromium',results:[{status:'passed'}]}]}]}]});
test('browser proof cannot substitute retries, skips or incomplete outcomes',()=>{validateBrowser(browser(),1);for(const key of ['unexpected','skipped','flaky']){const b=browser();b.stats[key]=1;assert.throws(()=>validateBrowser(b,1));}const b=browser();b.suites[0].specs[0].tests[0].results.push({status:'passed'});assert.throws(()=>validateBrowser(b,1));});

const geometry=()=>['dark','light'].flatMap(theme=>[1672,1440,1024,390].map(width=>({theme,width,pageOverflow:false,analysis:{x:0,y:0,width:500,height:500},reports:{x:width>=1440?510:0,y:width>=1440?0:510,width:300,height:500},chart:{width:520,height:200},metrics:{width:width-20,height:100}})));
test('geometry proof refuses page overflow and lost wide-screen hierarchy',()=>{validateGeometry(geometry());const rows=geometry();rows[0].pageOverflow=true;assert.throws(()=>validateGeometry(rows));const stacked=geometry();stacked[0].reports.x=0;assert.throws(()=>validateGeometry(stacked));});
test('geometry proof refuses a missing theme/width and clipped mobile chart',()=>{assert.throws(()=>validateGeometry(geometry().slice(1)));const rows=geometry();rows[3].chart.width=100;assert.throws(()=>validateGeometry(rows));});
