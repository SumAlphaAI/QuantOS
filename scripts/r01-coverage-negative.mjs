import assert from'node:assert/strict';import test from'node:test';import{validateCoverage}from'./check-r01-coverage.mjs';
const metric={count:100,covered:90,percent:90};const valid={data:[{files:['crates/quantos-market/src/lib.rs','crates/quantos-market/src/durable.rs','services/market-ingestor/src/main.rs','services/market-ingestor/src/binance.rs'].map(filename=>({filename,summary:{lines:metric,regions:metric,branches:metric}}))}]};
test('complete coverage passes',()=>assert.equal(validateCoverage(valid,true).status,'PASS'));
for(const kind of['lines','regions','branches'])test(`${kind} below threshold fails`,()=>{const bad=structuredClone(valid);bad.data[0].files[0].summary[kind]={count:100,covered:84,percent:84};assert.throws(()=>validateCoverage(bad,true));});
test('missing branch measurement fails',()=>{const bad=structuredClone(valid);bad.data[0].files[1].summary.branches={count:0,covered:0,percent:0};assert.throws(()=>validateCoverage(bad,true));});
test('missing CLI source fails',()=>{const bad=structuredClone(valid);bad.data[0].files.pop();assert.throws(()=>validateCoverage(bad));});
