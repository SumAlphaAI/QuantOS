import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { ESLint } from 'eslint';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sourceDigest } from './pre03-build-receipt.mjs';
import { chromium } from '@playwright/test';
import { loadRuntimeInputs, loadEffectiveConfig, validateRuntimeContract, validateBuildReceipts, checkPage } from './pre03-smoke.mjs';

const root = resolve('.');
const current = await loadRuntimeInputs(root);
const validate = (patch = {}) => validateRuntimeContract({ ...current, ...patch });
const rejected = (patch) => assert.equal(validate(patch).status, 'FAIL');
test('current Web contract passes and never loads Desktop inputs', () => {
  assert.equal(validate().status, 'PASS', validate().failures.join('\n'));
  assert.equal(validate().locked_dependencies,29);
  assert.equal(validate().scope,'web-only');
  assert.equal(current.tauriConfig,undefined);
});
for (const importer of ['apps/terminal','apps/website']) for (const version of ['15.5.23','16.0.0']) {
  test(`${importer} rejects Next ${version}`, () => {
    const pnpmLock=structuredClone(current.pnpmLock);pnpmLock.importers[importer].dependencies.next.version=version;rejected({pnpmLock});
  });
}
for (const [name,change] of [
  ['missing package resolutions',lock=>lock.packages={}],
  ['missing snapshots',lock=>lock.snapshots={}],
  ['specifier drift',lock=>lock.importers['apps/terminal'].dependencies.next.specifier='16.0.0'],
  ['dependency removed',lock=>delete lock.importers['apps/terminal'].dependencies.next],
  ['dependency inserted',lock=>lock.importers['apps/terminal'].dependencies.fake={specifier:'1.0.0',version:'1.0.0'}],
]) test(name,()=>{const pnpmLock=structuredClone(current.pnpmLock);change(pnpmLock);rejected({pnpmLock});});
test('manifest drift fails without changing lock',()=>{const manifests=structuredClone(current.manifests);manifests['apps/terminal'].dependencies.next='16.0.0';rejected({manifests});});
test('ADR drift fails',()=>rejected({runtimeAdr:current.runtimeAdr.replace('| next | 15.5.24 |','| next | 15.5.23 |')}));
test('duplicate ADR version row fails',()=>rejected({runtimeAdr:current.runtimeAdr+'\n| next | 15.5.23 |\n'}));
test('missing transitive snapshot fails',()=>{const pnpmLock=structuredClone(current.pnpmLock);delete pnpmLock.snapshots['is-potential-custom-element-name@1.0.1'];rejected({pnpmLock});});
test('Node pin drift fails',()=>rejected({nodeVersion:'25.0.0'}));
for (const [name,source,output] of [
  ['valid export','export default { output: "export" };','export'],
  ['comment marker','// output: "export"\nexport default {output:"standalone"};','standalone'],
  ['dead branch','let output="standalone"; if(false) output="export"; export default {output};','standalone'],
  ['subsequent override','const config={output:"export"};config.output="standalone";export default config;','standalone'],
  ['function config','export default () => ({output:"standalone"});','standalone'],
]) test(`effective Next configuration: ${name}`,async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-config-'));
  try {
    const app=join(tmp,'apps/terminal');mkdirSync(app,{recursive:true});
    symlinkSync(join(root,'node_modules'),join(tmp,'node_modules'),'dir');
    writeFileSync(join(app,'package.json'),'{}');writeFileSync(join(app,'tsconfig.json'),'{}');
    symlinkSync(join(root,'apps/terminal/node_modules'),join(app,'node_modules'),'dir');
    writeFileSync(join(app,'next.config.ts'),source);
    const config=await loadEffectiveConfig(tmp,'terminal');
    assert.equal(config.output,output);
    assert.equal(validate({terminalNextConfig:config}).status, output==='export'?'PASS':'FAIL');
  } finally {rmSync(tmp,{recursive:true,force:true});}
});

test('bad route resources, fake HTML and script failures fail closed',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-route-'));
  const browser=await chromium.launch({headless:true});
  const options={name:'website',directory:'out',path:'/',marker:'data-smoke="website-home"',selector:'[data-smoke="website-home"]',browser};
  try {
    mkdirSync(join(tmp,'out'));
    writeFileSync(join(tmp,'out/style.css'),'body {color: black}');
    const html=(content)=>`<html><head><link rel="stylesheet" href="/style.css"></head><body>${content}<script src="/app.js"></script></body></html>`;
    writeFileSync(join(tmp,'out/index.html'),html('<div data-smoke="website-home">Ready</div>'));
    assert.equal((await checkPage(tmp,options)).ok,false,'missing JS must fail');
    writeFileSync(join(tmp,'out/app.js'),'document.body.dataset.ready="true";');
    assert.equal((await checkPage(tmp,options)).ok,true,'valid page must pass');
    writeFileSync(join(tmp,'out/index.html'),html('<!-- data-smoke="website-home" -->'));
    assert.equal((await checkPage(tmp,options)).ok,false,'fake marker must fail');
    writeFileSync(join(tmp,'out/index.html'),html('<div data-smoke="website-home">Ready</div>'));
    writeFileSync(join(tmp,'out/app.js'),'throw new Error("broken hydration");');
    assert.equal((await checkPage(tmp,options)).ok,false,'script error must fail');
    rmSync(join(tmp,'out/index.html'));
    assert.equal((await checkPage(tmp,options)).ok,false,'missing route must fail');
  } finally {await browser.close();rmSync(tmp,{recursive:true,force:true});}
});

test('Next-specific async client violation is an ESLint error',async()=>{
  const eslint = new ESLint({cwd:root});
  const [report]=await eslint.lintText('"use client"; export default async function Bad() { return <div />; }',{filePath:'apps/terminal/app/pre03-probe.tsx'});
  assert(report.messages.some((message)=>message.ruleId==='@next/next/no-async-client-component' && message.severity===2));
});

test('build receipts reject stale source, config, identity and missing receipts',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-receipt-'));
  try {
    for(const app of ['terminal','website']) {
      mkdirSync(join(tmp,`apps/${app}/out`),{recursive:true});mkdirSync(join(tmp,`apps/${app}/.next`));
      writeFileSync(join(tmp,`apps/${app}/.next/BUILD_ID`),'build-1');
      writeFileSync(join(tmp,`apps/${app}/out/pre03-build.json`),JSON.stringify({schema:'quantos-pre03-build/v1',app,sourceDigest:'current',output:'export',buildId:'build-1'}));
    }
    assert.equal(validateBuildReceipts(tmp,'current').failures.length,0);
    assert.equal(validateBuildReceipts(tmp,'stale').failures.length,2);
    writeFileSync(join(tmp,'apps/terminal/.next/BUILD_ID'),'other-build');
    assert.equal(validateBuildReceipts(tmp,'current').failures.length,1);
    writeFileSync(join(tmp,'apps/website/out/pre03-build.json'),JSON.stringify({schema:'quantos-pre03-build/v1',app:'website',sourceDigest:'current',output:'standalone',buildId:'build-1'}));
    assert.equal(validateBuildReceipts(tmp,'current').failures.length,2);
    rmSync(join(tmp,'apps/terminal/out/pre03-build.json'));
    assert.equal(validateBuildReceipts(tmp,'current').failures.length,2);
  } finally {rmSync(tmp,{recursive:true,force:true});}
});

test('source binding ignores caches but detects actual source changes',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-digest-'));
  try {
    for(const dir of ['apps/terminal','apps/website','packages','scripts','docs/adr'])mkdirSync(join(tmp,dir),{recursive:true});
    for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.nvmrc','tsconfig.base.json','eslint.config.mjs','docs/adr/20260814-pre03-runtime-stack.md'])writeFileSync(join(tmp,file),'fixture');
    writeFileSync(join(tmp,'apps/terminal/source.ts'),'export const value=1;');
    const before=sourceDigest(tmp);
    mkdirSync(join(tmp,'scripts/__pycache__'));writeFileSync(join(tmp,'scripts/__pycache__/probe.pyc'),'cache');
    writeFileSync(join(tmp,'apps/terminal/.DS_Store'),'cache');
    assert.equal(sourceDigest(tmp),before);
    writeFileSync(join(tmp,'apps/terminal/source.ts'),'export const value=2;');
    assert.notEqual(sourceDigest(tmp),before);
  } finally {rmSync(tmp,{recursive:true,force:true});}
});


test('all workspace importers and exact link targets are required',()=>{
  const missing=structuredClone(current.pnpmLock);delete missing.importers['packages/api-client'];rejected({pnpmLock:missing});
  const extra=structuredClone(current.pnpmLock);extra.importers['apps/terminal-desktop']={};rejected({pnpmLock:extra});
  const wrong=structuredClone(current.pnpmLock);wrong.importers['apps/terminal'].dependencies['@sumalpha/api-client'].version='link:../../packages/ui';rejected({pnpmLock:wrong});
  const overrides=structuredClone(current.pnpmLock);overrides.overrides.playwright='0.0.0';rejected({pnpmLock:overrides});
});

test('runtime loader discovers omitted manifests independently of lockfile',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-importers-'));
  try {
    for(const dir of ['apps','packages','docs','node_modules'])symlinkSync(join(root,dir),join(tmp,dir),'dir');
    for(const file of ['package.json','.nvmrc','rust-toolchain.toml','pnpm-workspace.yaml'])copyFileSync(join(root,file),join(tmp,file));
    const lock=structuredClone(current.pnpmLock);delete lock.importers['packages/api-client'];
    // JSON is valid YAML; this mutates the actual loader input on disk.
    writeFileSync(join(tmp,'pnpm-lock.yaml'),JSON.stringify(lock));
    const loaded=await loadRuntimeInputs(tmp);
    assert(loaded.manifests['packages/api-client']);
    assert.equal(validateRuntimeContract(loaded).status,'FAIL');
  } finally {rmSync(tmp,{recursive:true,force:true});}
});

test('per-app env files are isolated and reloaded without polluting caller',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'pre03-env-'));
  const key='NEXT_PUBLIC_PRE03_CONFIG_PROBE';
  const original=process.env[key];
  assert.equal(original,undefined,'reserved fixture variable must not be injected');
  try {
    symlinkSync(join(root,'node_modules'),join(tmp,'node_modules'),'dir');
    for(const app of ['terminal','website']) {
      const dir=join(tmp,`apps/${app}`);mkdirSync(dir,{recursive:true});
      writeFileSync(join(dir,'package.json'),'{}');writeFileSync(join(dir,'tsconfig.json'),'{}');
      symlinkSync(join(root,`apps/${app}/node_modules`),join(dir,'node_modules'),'dir');
      writeFileSync(join(dir,'next.config.ts'),'export default { output: "export" };');
      writeFileSync(join(dir,'.env.local'),`${key}=${app}\n`);
    }
    assert.equal((await loadEffectiveConfig(tmp,'terminal')).publicEnv[key],'terminal');
    assert.equal((await loadEffectiveConfig(tmp,'website')).publicEnv[key],'website');
    writeFileSync(join(tmp,'apps/terminal/.env.local'),`${key}=changed\n`);
    assert.equal((await loadEffectiveConfig(tmp,'terminal')).publicEnv[key],'changed');
    assert.equal(process.env[key],original);
    assert.notEqual(sourceDigest(root,{[key]:'terminal'}),sourceDigest(root,{[key]:'website'}));
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
