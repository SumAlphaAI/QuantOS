import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {assertProductionArtifactsAllowed} from './tp05-release-gate.mjs';
test('production inventory without OpenBB passes only TP05 exclusion',()=>assert.equal(assertProductionArtifactsAllowed(['runtime-gateway','quantos_engine_sdk-0.1.0.whl']).status,'PASS'));
for(const name of ['openbb-4.4.5.whl','OpenBB/platform.py','quantos_openbb_adapter-0.1.0-py3-none-any.whl','engines/openbb-adapter'])test('production rejects '+name,()=>assert.throws(()=>assertProductionArtifactsAllowed([name]),/PRODUCTION_DENIED/));
test('production rejects missing/invalid inventory',()=>{for(const v of [null,{},[null],['']])assert.throws(()=>assertProductionArtifactsAllowed(v));});
test('actual production build stops before any sync/build invocation',()=>{
 const r=spawnSync('make',['build-python-production'],{encoding:'utf8',env:{...process.env,QUANTOS_SKIP_ENV:'1'}});
 assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/TP05_LICENSE_PRODUCTION_DENIED/);
 assert.doesNotMatch(r.stdout+r.stderr,/uv sync|uv build/);
});
test('production release manifest uses the same exclusion gate',()=>assert.match(readFileSync('scripts/generate-build-manifest.mjs','utf8'),/assertProductionArtifactsAllowed\(manifest.files.map/));
console.log('TP05_RELEASE_GATE_CHECKS');
