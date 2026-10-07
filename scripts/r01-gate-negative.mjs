import assert from 'node:assert/strict';import test from 'node:test';import {loadR01Inputs,validateR01} from './check-r01.mjs';
const current=loadR01Inputs();test('current assembly passes',()=>assert.equal(validateR01(current).status,'PASS'));
for(const [name,mutate]of[
 ['replay count',i=>({...i,fixture:{...i.fixture,count:99999}})],
 ['provider registry',i=>({...i,source:i.source.replaceAll('ApprovedProviderRegistry','Removed')} )],
 ['source conflict',i=>({...i,source:i.source.replaceAll('MARKET_SOURCE_CONFLICT','Removed')})],
 ['persistent writer',i=>({...i,durable:i.durable.replaceAll('append_market_events','removed')})],
 ['atomic transaction',i=>({...i,migration:i.migration.replaceAll('for update','removed')})],
 ['F0 receipt',i=>({...i,foundation:{...i.foundation,f0Gate:'BLOCKED'}})],
 ['accepted dependency',i=>({...i,plan:i.plan.replace(/(历史正式复审：`)ACCEPTED(`；原 11\/11 问题)/,'$1FIX_VALIDATION$2')})],
 ['CLI tests',i=>({...i,makefile:i.makefile.replace('cargo test -p market-ingestor --locked','removed')})],
 ['CI assembly',i=>({...i,workflow:i.workflow.replace('make r01-check','removed')})],
])test(`${name} regression fails closed`,()=>assert.equal(validateR01(mutate(current)).status,'FAIL'));
