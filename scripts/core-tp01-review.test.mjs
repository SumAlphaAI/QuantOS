import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,browserReport} from './core-tp01-review.mjs';
test('CORE:TP01 bounded local composition is valid',()=>validateBoundary(boundary()));
for(const key of Object.keys(boundary()))test('reject TP01 scope promotion or drift '+key,()=>{const r=boundary();r[key]=typeof r[key]==='boolean'?!r[key]:'READY';assert.throws(()=>validateBoundary(r));});
const report={errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{specs:[{tests:[{projectName:'chromium',results:[{status:'passed'}]}]}]}]};
test('actual browser result is checked',()=>browserReport(report,1));
for(const status of ['failed','skipped','timedOut'])test('reject masked browser result '+status,()=>{const r=JSON.parse(JSON.stringify(report));r.suites[0].specs[0].tests[0].results[0].status=status;assert.throws(()=>browserReport(r,1));});
for(const field of ['unexpected','skipped','flaky'])test('reject browser statistics '+field,()=>{const r=JSON.parse(JSON.stringify(report));r.stats[field]++;assert.throws(()=>browserReport(r,1));});
