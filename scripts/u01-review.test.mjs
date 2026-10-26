import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateReport} from './u01-review.mjs';
test('U01 exact local boundary is valid',()=>validateBoundary(boundary()));
for(const key of Object.keys(boundary()))test('reject U01 scope promotion or boundary drift '+key,()=>{const r=boundary();r[key]=typeof r[key]==='boolean'?!r[key]:'READY';assert.throws(()=>validateBoundary(r));});
const report={errors:[],stats:{expected:5,unexpected:0,skipped:0,flaky:0}};
test('five clean browser cases are required',()=>validateReport(report));
for(const key of ['expected','unexpected','skipped','flaky'])test('reject missing failing skipped or flaky browsers '+key,()=>{const r=JSON.parse(JSON.stringify(report));r.stats[key]++;assert.throws(()=>validateReport(r));});
