import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {adjudicate,validateWaivers} from './sca-policy.mjs';
import {allowed,licenseAllowed} from './license-policy.mjs';
import {verifyRelease} from './verify-release.mjs';
import {sha} from './f01-lib.mjs';
const repo=process.cwd();
function fixture(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'f02-test-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function run(binary,args,root=repo,env={}){return spawnSync(binary,args,{cwd:root,env:{...process.env,...env},encoding:'utf8'});}
function pass(p){assert.equal(p.status,0,p.stdout+p.stderr);}
function reject(p,pattern){assert.equal(p.status,1,p.stdout+p.stderr);assert.match(p.stdout+p.stderr,pattern);}
test('real Gitleaks positive control and GitHub/Slack leaks',t=>{
 for(const token of [`github_token=ghp_${'aBcDeF1234567890'.repeat(3).slice(0,36)}`,`slack_token=${['xoxb','123456789012','123456789012','abcdefghijklmnopqrstuvwx'].join('-')}`]) {
 const d=fixture(t);pass(run('git',['init','-q'],d));
 const commit=()=>{pass(run('git',['add','.'],d));pass(run('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture'],d));};
 fs.writeFileSync(path.join(d,'clean.txt'),'ordinary public content');commit();
 const scan=()=>run('bash',[path.join(repo,'scripts/check-secrets.sh')],repo,{QUANTOS_GATE_ROOT:d});
 pass(scan());
 fs.writeFileSync(path.join(d,'leak.txt'),token+'\n');commit();
 reject(scan(),/leaks found/i);
 const bad=run('bash',[path.join(repo,'scripts/check-secrets.sh')],repo,{QUANTOS_GATE_ROOT:d,GITLEAKS_BIN:'/nonexistent/gitleaks'});
 assert.notEqual(bad.status,0);assert.doesNotMatch(bad.stdout+bad.stderr,/leaks found/i);
 }
});
test('RLS baseline rejects policy deletion and late disabling with recovery',t=>{
 const d=fixture(t),dir=path.join(d,'supabase/migrations');fs.mkdirSync(dir,{recursive:true});
 const f=path.join(dir,'20260101000000_baseline.sql');
 const good='create table quantos.example(id int); alter table quantos.example enable row level security; alter table quantos.example force row level security; create policy tenant on quantos.example using (true);';
 const scan=()=>run('node',[path.join(repo,'scripts/check-rls-baseline.mjs')],repo,{QUANTOS_GATE_ROOT:d});
 fs.writeFileSync(f,good);pass(scan());
 for(const mutation of ['alter table quantos.example disable row level security;', 'alter table quantos.example no force row level security;', 'drop policy tenant on quantos.example;']){
  fs.writeFileSync(f,good+mutation);reject(scan(),/RLS_BASELINE/);fs.writeFileSync(f,good);pass(scan());
 }
 fs.writeFileSync(f,good.replace('create policy tenant on quantos.example using (true)','create index tenant on quantos.example(id)'));reject(scan(),/RLS_BASELINE/);
});
test('migration filename control, rejection and recovery',t=>{
 const d=fixture(t),dir=path.join(d,'supabase/migrations');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'20260101000000_valid.sql'),'select 1;');
 const scan=()=>run('bash',[path.join(repo,'scripts/check-migration-filenames.sh')],repo,{QUANTOS_GATE_ROOT:d});pass(scan());
 fs.writeFileSync(path.join(dir,'invalid.sql'),'select 1;');reject(scan(),/Invalid migration filename/);fs.unlinkSync(path.join(dir,'invalid.sql'));pass(scan());
});
test('waivers only authorize exact advisory/ecosystem/package/version before expiry',()=>{
 const now=new Date('2026-09-17T00:00:00Z'), w={id:'GHSA-test',ecosystem:'npm',package:'fixture',version:'1.0.0',owner:'test',reason:'test',expiresOn:'2026-09-18'};
 const finding={id:w.id,ecosystem:w.ecosystem,package:w.package,version:w.version};
 assert.equal(adjudicate([finding],[w],now)[0].waived,true);
 for(const key of ['id','ecosystem','package','version'])assert.equal(adjudicate([{...finding,[key]:'different'}],[w],now)[0].waived,false);
 assert.throws(()=>validateWaivers({waivers:[{...w,expiresOn:'2026-09-16'}]},now),/Expired/);
 assert.throws(()=>validateWaivers({waivers:[{...w,expiresOn:'2026-02-30'}]},now),/Invalid/);
});
test('license expression policy does not globally allow LGPL or unknown licenses',()=>{
 assert.equal(licenseAllowed('MIT OR GPL-3.0-only',allowed),true);
 for(const x of ['MIT AND GPL-3.0-only','LGPL-3.0-or-later','UNKNOWN',undefined])assert.equal(licenseAllowed(x,allowed),false);
});
test('release binds complete payload and SBOM to source; rejects corruption and build-only native files',t=>{
 const d=fixture(t),commit='a'.repeat(40);fs.mkdirSync(path.join(d,'sbom'));fs.mkdirSync(path.join(d,'web'));
 fs.writeFileSync(path.join(d,'sbom/quantos.spdx.json'),JSON.stringify({packages:[{SPDXID:'SPDXRef-Package-QuantOS',versionInfo:commit}]}));fs.writeFileSync(path.join(d,'web/index.html'),'hello');
 const manifest=()=>{const files=['sbom/quantos.spdx.json',...fs.readdirSync(path.join(d,'web')).map(x=>'web/'+x)].map(p=>{const b=fs.readFileSync(path.join(d,p));return {path:p,sizeBytes:b.length,sha256:sha(b)};});fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify({kind:'release',git:{commit,dirty:false},files}));};
 manifest();verifyRelease(d,commit);assert.throws(()=>verifyRelease(d,'b'.repeat(40)),/RELEASE_SOURCE/);
 fs.writeFileSync(path.join(d,'web/index.html'),'tamper');assert.throws(()=>verifyRelease(d,commit),/RELEASE_DIGEST/);fs.writeFileSync(path.join(d,'web/index.html'),'hello');verifyRelease(d,commit);
 fs.writeFileSync(path.join(d,'extra'),'extra');assert.throws(()=>verifyRelease(d,commit),/RELEASE_INVENTORY/);fs.unlinkSync(path.join(d,'extra'));
 fs.writeFileSync(path.join(d,'web/vips.node'),'native');manifest();assert.throws(()=>verifyRelease(d,commit),/RELEASE_LICENSE/);
 fs.unlinkSync(path.join(d,'web/vips.node'));manifest();fs.unlinkSync(path.join(d,'web/index.html'));assert.throws(()=>verifyRelease(d,commit),/RELEASE_INVENTORY/);
});
test('Buf compares against distinct historical source and detects removed fields',t=>{
 const d=fixture(t);pass(run('git',['init','-q'],d));fs.writeFileSync(path.join(d,'buf.yaml'),'version: v2\nbreaking:\n  use:\n    - FILE\n');
 const f=path.join(d,'fixture.proto'), good='syntax = "proto3"; package fixture; message Example { string value = 1; }\n';fs.writeFileSync(f,good);
 const commit=()=>{pass(run('git',['add','.'],d));pass(run('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture','--allow-empty'],d));};commit();const base=run('git',['rev-parse','HEAD'],d).stdout.trim();commit();
 const scan=(extra={})=>run('node',[path.join(repo,'scripts/check-proto-breaking.mjs')],repo,{QUANTOS_GATE_ROOT:d,QUANTOS_PROTO_BASE:base,BUF_BIN:path.join(repo,'node_modules/.bin/buf'),...extra});
 pass(scan());fs.writeFileSync(f,good.replace('string value = 1;',''));reject(scan(),/FIELD|field|Previously/);fs.writeFileSync(f,good);pass(scan());
 reject(scan({QUANTOS_PROTO_BASE:run('git',['rev-parse','HEAD'],d).stdout.trim()}),/must differ/);
});
test('SCA scanner adapter consumes exact waivers and never waives scanner failures',t=>{
 const d=fixture(t);for(const name of ['scripts','security','engines','bin'])fs.mkdirSync(path.join(d,name));
 for(const name of ['check-sca.mjs','sca-policy.mjs'])fs.copyFileSync(path.join(repo,'scripts',name),path.join(d,'scripts',name));
 for(const name of ['Cargo.lock','pnpm-lock.yaml','engines/uv.lock'])fs.writeFileSync(path.join(d,name),'fixture');
 pass(run('git',['init','-q'],d));pass(run('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','fixture'],d));
 const tool=path.join(d,'bin/pnpm');fs.writeFileSync(tool,`#!${process.execPath}\nconst fs=require('fs'),p=JSON.parse(fs.readFileSync('response.json'));console.log(JSON.stringify(p.body));process.exit(p.status);\n`);fs.chmodSync(tool,0o755);
 const scan=()=>run(process.execPath,['scripts/check-sca.mjs','npm'],d,{PATH:path.join(d,'bin')+':'+process.env.PATH});
 const response=(body,status)=>fs.writeFileSync(path.join(d,'response.json'),JSON.stringify({body,status}));
 const waive=rows=>fs.writeFileSync(path.join(d,'security/sca-waivers.json'),JSON.stringify({waivers:rows}));
 waive([]);response({metadata:{vulnerabilities:{high:0}},advisories:{}},0);pass(scan());
 const body={metadata:{vulnerabilities:{high:1}},advisories:{1:{github_advisory_id:'GHSA-fixture',module_name:'fixture',severity:'high',findings:[{version:'1.0.0'}]}}};
 response(body,1);reject(scan(),/Unwaived dependency vulnerabilities/);
 const waiver={id:'GHSA-fixture',ecosystem:'npm',package:'fixture',version:'1.0.0',owner:'test',reason:'test fixture',expiresOn:'2099-01-01'};
 waive([waiver]);pass(scan());waive([{...waiver,version:'2.0.0'}]);reject(scan(),/Unwaived/);
 waive([waiver]);response(body,2);reject(scan(),/npm audit unavailable/);
 waive([{...waiver,expiresOn:'2020-01-01'}]);reject(scan(),/Expired waiver/);
});
