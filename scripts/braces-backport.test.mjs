import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installedBraces,verifyBracesBackport,isBracesBackportFinding} from './braces-backport.mjs';
const root=path.resolve(import.meta.dirname,'..');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quantos-braces-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));for(const f of ['package.json','pnpm-lock.yaml','security/braces-backport.json','patches/braces@3.0.3.patch']){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(dir,f));}return dir;}
test('installed backport rejects nested strings and supplied/cyclic AST while preserving regular globs',()=>assert.equal(verifyBracesBackport(root).status,'BACKPORT_VERIFIED'));
test('missing resolver selection fails closed',t=>{const dir=fixture(t);const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));delete pkg.pnpm.patchedDependencies;fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify(pkg));assert.throws(()=>verifyBracesBackport(dir,{directory:installedBraces(root)}),/resolver patch missing/);});
test('changed patch bytes fail closed',t=>{const dir=fixture(t);fs.appendFileSync(path.join(dir,'patches/braces@3.0.3.patch'),'\n');assert.throws(()=>verifyBracesBackport(dir,{directory:installedBraces(root)}),/patch changed/);});
test('unpatched lock consumer fails closed',t=>{const dir=fixture(t);const lock=fs.readFileSync(path.join(dir,'pnpm-lock.yaml'),'utf8').replaceAll(/3\.0\.3\(patch_hash=[^)]+\)/g,'3.0.3');fs.writeFileSync(path.join(dir,'pnpm-lock.yaml'),lock);assert.throws(()=>verifyBracesBackport(dir,{directory:installedBraces(root)}),/consumer must select/);});
test('changed installed implementation fails closed',t=>{const dir=fixture(t);const copy=path.join(dir,'braces');fs.cpSync(installedBraces(root),copy,{recursive:true,filter:f=>!f.includes('/node_modules/braces/node_modules/')});fs.appendFileSync(path.join(copy,'lib/compile.js'),'\n');assert.throws(()=>verifyBracesBackport(dir,{directory:copy}),/braces source changed/);});

test('backport decision applies to one exact advisory/package/version and never other vulnerabilities',()=>{const f={ecosystem:'npm',id:'GHSA-vfj7-8cjw-p6xm',package:'braces',version:'3.0.3'};const proof=verifyBracesBackport(root);assert(isBracesBackportFinding(f,proof));for(const key of ['ecosystem','id','package','version'])assert.equal(isBracesBackportFinding({...f,[key]:'other'},proof),false);assert.equal(isBracesBackportFinding(f,null),false);assert.equal(isBracesBackportFinding(f,{...proof,status:'UNVERIFIED'}),false);});
