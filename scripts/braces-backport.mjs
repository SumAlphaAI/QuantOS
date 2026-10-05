import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function installedBraces(root) {
  const next = createRequire(fs.realpathSync(path.join(root, 'node_modules/@next/eslint-plugin-next/package.json')));
  const glob = createRequire(next.resolve('fast-glob'));
  const match = createRequire(glob.resolve('micromatch'));
  return path.dirname(match.resolve('braces/package.json'));
}
export function checkBracesBehavior(directory) {
  const braces = createRequire(path.join(directory, 'package.json'))('./');
  const rejected = error => error instanceof SyntaxError && /safe depth/.test(error.message);
  for (const pattern of ['{'.repeat(4000)+'a,b'+'}'.repeat(4000), '('.repeat(4000)+'x'+')'.repeat(4000), '{'.repeat(4000)+'x']) {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) assert.throws(() => braces[method](pattern, {maxDepth: Infinity}), rejected, `${method} must reject nested input before stack exhaustion`);
    assert.throws(() => braces(pattern), rejected);
    assert.throws(() => braces(pattern, {expand:true}), rejected);
  }
  let ast={type:'text',value:'x'};
  for(let i=0;i<1000;i++)ast={type:'root',nodes:[ast]};
  for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](ast),rejected,`${method} must guard caller-supplied AST`);
  const cycle={type:'root',nodes:[]};cycle.nodes.push(cycle);
  for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](cycle),rejected);
  assert.equal(braces.compile('src/{app,lib}/file.{js,ts}'),'src/(app|lib)/file.(js|ts)');
  assert.deepEqual(braces.expand('v{01..03}/{a,b}'),['v01/a','v01/b','v02/a','v02/b','v03/a','v03/b']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')),'a/{b,c}/d');
  assert.deepEqual(braces.expand('\\{a,b\\}'),['{a,b}']);
  const boundary='{'.repeat(62)+'x'+'}'.repeat(62);
  assert.equal(braces.stringify(braces.parse(boundary)),boundary);
  return {stringCases:18,astCases:6,compatibilityCases:5};
}
export function verifyBracesBackport(root, {directory=installedBraces(root)}={}) {
  const document=JSON.parse(fs.readFileSync(path.join(root,'security/braces-backport.json'),'utf8'));
  assert.equal(document.schema,'quantos-braces-backport/v1');
  assert.deepEqual(document.limits,{parserAndAstDepth:64,expansionArrayDepth:128});
  assert.equal(document.upstreamPatchedVersion,null);
  assert.equal(document.package,'braces');assert.equal(document.version,'3.0.3');assert.equal(document.advisory,'GHSA-vfj7-8cjw-p6xm');
  assert.equal(document.patch,'patches/braces@3.0.3.patch');
  assert.equal(hash(fs.readFileSync(path.join(root,document.patch))),document.patchSha256,'braces patch changed');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.pnpm?.patchedDependencies?.['braces@3.0.3'],document.patch,'braces resolver patch missing');
  const lock=fs.readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8');
  assert(lock.includes('path: '+document.patch),'lock does not select braces patch');
  assert(lock.includes('hash: '+document.patchSha256),'lock patch digest differs');
  assert(lock.includes('braces: 3.0.3(patch_hash='+document.patchSha256+')'),'consumer must select the patched braces');
  const files=fs.readdirSync(directory,{recursive:true}).filter(file=>!file.split(path.sep).includes('node_modules')&&fs.statSync(path.join(directory,file)).isFile()).sort();
  assert.deepEqual(files,Object.keys(document.files).sort(),'braces installed inventory differs');
  for(const file of files)assert.equal(hash(fs.readFileSync(path.join(directory,file))),document.files[file],`braces source changed: ${file}`);
  const tests=checkBracesBehavior(directory);
  return {advisory:document.advisory,package:document.package,version:document.version,status:'BACKPORT_VERIFIED',upstreamPatchedVersion:null,patchSha256:document.patchSha256,files:files.length,tests};
}

export function isBracesBackportFinding(finding, proof) {
  return finding.ecosystem === 'npm' && finding.id === 'GHSA-vfj7-8cjw-p6xm' && finding.package === 'braces' && finding.version === '3.0.3' && proof?.status === 'BACKPORT_VERIFIED' && proof.advisory === finding.id && proof.package === finding.package && proof.version === finding.version && /^[a-f0-9]{64}$/.test(proof.patchSha256);
}
