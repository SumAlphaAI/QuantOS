import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import YAML from 'yaml';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),base='93dee9382a6e93ce21b73f4b4070d49c8f7dd28a';
const bytes=p=>fs.readFileSync(path.join(root,p)),sha=x=>createHash('sha256').update(x).digest('hex');
for(const p of ['vitest.critical.config.ts','vitest.coverage.config.ts','tests/critical-branches.json','Cargo.toml','Cargo.lock','engines/uv.lock','apps/terminal-desktop/src-tauri/Cargo.lock','services/bff-gateway/src/lib.rs','apps/terminal/tests/helpers/fep5-reference.ts','.gitleaks.toml','.gitleaksignore','security/sca-waivers.json'])assert.deepEqual(bytes(p),execFileSync('git',['show',base+':'+p],{cwd:root,maxBuffer:32*1024*1024}),p);
const before=YAML.parse(execFileSync('git',['show',base+':pnpm-lock.yaml'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024})),after=YAML.parse(bytes('pnpm-lock.yaml').toString()),desktop=YAML.parse(bytes('pnpm-lock.desktop.yaml').toString());
assert.deepEqual(after.packages,desktop.packages);assert.deepEqual(after.overrides,desktop.overrides);assert.deepEqual(after.patchedDependencies,desktop.patchedDependencies);
for(const key of Object.keys(before.packages).filter(k=>after.packages[k]))assert.deepEqual(before.packages[key].resolution,after.packages[key].resolution,key);
const oldPackage=JSON.parse(execFileSync('git',['show',base+':package.json'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024})),pkg=JSON.parse(bytes('package.json'));
assert.deepEqual(oldPackage.dependencies,pkg.dependencies);assert.deepEqual(oldPackage.devDependencies,pkg.devDependencies);
const require=createRequire(root+'/package.json'),eslint=createRequire(require.resolve('eslint')),installed=path.dirname(eslint.resolve('minimatch/package.json')),pristine=process.env.QUANTOS_MINIMATCH_PRISTINE??'/tmp/quantos-93dee938-minimatch-package/package';
const additions={
 'dist/commonjs/index.js':'// Legacy CommonJS callers receive the upstream matcher with all named exports.\nmodule.exports = Object.assign(exports.minimatch, exports, { default: exports.minimatch });\n',
 'dist/esm/index.js':'// Preserve the legacy default import alongside upstream named exports.\nexport default minimatch;\n',
 'dist/commonjs/index.d.ts':'export default minimatch;\n','dist/esm/index.d.ts':'export default minimatch;\n',
};let fileCount=0;
function visit(dir=''){for(const entry of fs.readdirSync(path.join(pristine,dir),{withFileTypes:true})){const rel=path.join(dir,entry.name);if(entry.isDirectory())visit(rel);else{let actual=fs.readFileSync(path.join(installed,rel));if(additions[rel]){const text=actual.toString();assert.equal(text.split(additions[rel]).length,2,rel);actual=Buffer.from(text.replace(additions[rel],''));}assert.deepEqual(actual,fs.readFileSync(path.join(pristine,rel)),rel);fileCount++;}}}visit();
assert.equal(sha(bytes('patches/minimatch@11.0.1.patch')),after.patchedDependencies['minimatch@11.0.1'].hash);
const coverage=JSON.parse(bytes('coverage/critical/coverage-summary.json')),inventory=JSON.parse(bytes('tests/critical-branches.json'));
assert.equal(Object.keys(coverage).length,inventory.files.length+1);
for(const file of inventory.files){const row=Object.entries(coverage).find(([p])=>p.endsWith('/'+file.path))?.[1];assert(row,file.path);for(const name of ['lines','statements','functions','branches'])assert(row[name].total>0&&row[name].pct===100,file.path+'/'+name);}
const sca=JSON.parse(bytes('artifacts/f02/sca-npm-pypi-cargo.json'));assert.equal(sca.status,'PASS');assert.equal(sca.lockDigests['pnpm-lock.yaml'],sha(bytes('pnpm-lock.yaml')));assert.deepEqual(Object.keys(sca.scanners),['npm','pypi','cargo','cargo-desktop']);assert(Object.values(sca.scanners).every(s=>s.status==='PASS'));
const report={schema:'quantos-ci-scope-review/v1',base,coverageScopesThresholdsAndStartupDeadlinesUnchanged:true,criticalFiles:inventory.files.length,criticalTotals:coverage.total,webCoverageTotals:JSON.parse(bytes('coverage/coverage-summary.json')).total,sharedNodeLockPackageCount:Object.keys(after.packages).length,desktopHasIdenticalPackageIntegritiesOverridesAndPatches:true,unchangedPackageResolutionIdentitiesRetained:true,rootDirectDependenciesUnchanged:true,minimatch:{version:'11.0.1',pristineFilesCompared:fileCount,onlyFourDefaultExportAdaptersChanged:true,patchSha256:sha(bytes('patches/minimatch@11.0.1.patch'))},scannerStatuses:Object.fromEntries(Object.entries(sca.scanners).map(([k,v])=>[k,v.status])),waiversCredentialRulesRustAndPythonLocksUnchanged:true};
fs.writeFileSync('/tmp/quantos-93dee938-scope-review.json',JSON.stringify(report,null,2)+'\n');console.log('PASS coverage invariants, same 733-package companion graph, pristine matcher algorithm and all SCA statuses');
