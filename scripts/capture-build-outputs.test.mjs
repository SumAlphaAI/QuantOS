import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { captureBuildOutputs } from './capture-build-outputs.mjs';
import { validateOutputs, requireMatching } from './f01-lib.mjs';

function fixture(fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f01-capture-'));
    const workspace = path.join(root, 'workspace');
    const write = (name, bytes) => {
        const target = path.join(workspace, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
    };
    const inventory = { rustBinaries: ['server'], python: [{ name: 'engine', version: '0.1.0' }], js: [{ directory: 'apps/terminal', output: 'apps/terminal/out' }] };
    write('target/release/server', 'binary');
    fs.chmodSync(path.join(workspace, 'target/release/server'), 0o755);
    write('artifacts/python/engine-0.1.0-py3-none-any.whl', 'wheel');
    write('apps/terminal/out/chunk.js', 'export const value=1;');
    try { fn({ root, workspace, inventory, write }); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('a real byte mismatch still fails the Gate, and both versions survive workspace cleanup', () => fixture(({ root, workspace, inventory, write }) => {
    const first = validateOutputs(workspace, inventory);
    captureBuildOutputs(workspace, inventory, first, path.join(root, 'run-1'));
    write('apps/terminal/out/chunk.js', 'export const value=2;');
    const second = validateOutputs(workspace, inventory);
    captureBuildOutputs(workspace, inventory, second, path.join(root, 'run-2'));
    fs.rmSync(workspace, { recursive: true });
    assert.throws(() => requireMatching([first, second, second]), /Build digests differ/);
    assert.equal(fs.readFileSync(path.join(root, 'run-1/apps/terminal/chunk.js'), 'utf8'), 'export const value=1;');
    assert.equal(fs.readFileSync(path.join(root, 'run-2/apps/terminal/chunk.js'), 'utf8'), 'export const value=2;');
}));

test('changed output cannot be attached to an earlier receipt', () => fixture(({ root, workspace, inventory, write }) => {
    const result = validateOutputs(workspace, inventory);
    write('apps/terminal/out/chunk.js', 'tampered');
    assert.throws(() => captureBuildOutputs(workspace, inventory, result, path.join(root, 'snapshot')), /differs from receipt/);
}));

test('capture rejects stale destinations instead of mixing evidence', () => fixture(({ root, workspace, inventory }) => {
    const destination = path.join(root, 'snapshot');
    const result = validateOutputs(workspace, inventory);
    captureBuildOutputs(workspace, inventory, result, destination);
    assert.throws(() => captureBuildOutputs(workspace, inventory, result, destination), /EEXIST/);
}));

test('an invalid run revokes stale raw outputs as well as the success receipt', () => fixture(({ root }) => {
    const output = path.join(root, 'receipt.json');
    const snapshots = `${output}.web-outputs`;
    fs.mkdirSync(snapshots);
    fs.writeFileSync(path.join(snapshots, 'old-success.js'), 'stale');
    const result = spawnSync(process.execPath, ['scripts/verify-reproducible-builds.mjs', '--runs', '1', '--capture-web-outputs', '--output', output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(fs.readFileSync(output)).status, 'FAIL');
    assert.deepEqual(fs.readdirSync(snapshots), []);
}));
