import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,readFileSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateFixtureInventory} from '../tests/contract/fixture-inventory.mjs';
const root=resolve(import.meta.dirname,'..');
function fixture(run){const dir=mkdtempSync(join(tmpdir(),'pre06-negative-'));try{return run(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
test('unknown and corrupted fixtures are rejected, explicit sabotage fixtures remain expected failures',()=>fixture(dir=>{
  cpSync(join(root,'tests/contract/fixtures'),join(dir,'fixtures'),{recursive:true});cpSync(join(root,'tests/contract/fixture-manifest.json'),join(dir,'fixture-manifest.json'));
  assert.equal(validateFixtureInventory(dir).status,'PASS');
  writeFileSync(join(dir,'fixtures/unknown.json'),'{}');assert.equal(validateFixtureInventory(dir).status,'FAIL');rmSync(join(dir,'fixtures/unknown.json'));
  const path=join(dir,'fixtures/session/default.json');const value=JSON.parse(readFileSync(path));value.venueApiKey='synthetic';writeFileSync(path,JSON.stringify(value));assert.equal(validateFixtureInventory(dir).status,'FAIL');
}));
test('empty assets and empty route manifest are never a zero-sized performance PASS',()=>fixture(dir=>{
  mkdirSync(join(dir,'out/_next'),{recursive:true});mkdirSync(join(dir,'.next'));writeFileSync(join(dir,'.next/app-build-manifest.json'),' {"pages":{}} ');
  assert.notEqual(spawnSync(process.execPath,[join(root,'scripts/check-perf-budget.mjs'),join(dir,'out')],{env:{}}).status,0);
}));
test('actual CI configs return nonzero for first-fail-then-pass policy probe',()=>fixture(dir=>{
  symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
  writeFileSync(join(dir,'flaky.spec.ts'),'import {test,expect} from "@playwright/test"; test("synthetic policy probe",async ({},info)=>expect(info.retry).toBe(1));');
  for(const name of ['playwright.config.ts','playwright.website.config.ts']) {
    const output=join(dir,'result.json');
    writeFileSync(join(dir,'config.ts'),`import base from ${JSON.stringify(join(root,name))};export default {...base,testDir:${JSON.stringify(dir)},testMatch:'flaky.spec.ts',testIgnore:[],webServer:undefined,projects:[{name:'policy'}],reporter:[['json',{outputFile:${JSON.stringify(output)}}]]};`);
    const result=spawnSync(process.execPath,[join(root,'node_modules/@playwright/test/cli.js'),'test','--config',join(dir,'config.ts'),'--workers=1'],{cwd:root,env:{...process.env,CI:'true'},encoding:'utf8',timeout:30000});
    assert.equal(result.status,1,result.stderr);assert.equal(JSON.parse(readFileSync(output)).stats.flaky,1);
  }
}));
