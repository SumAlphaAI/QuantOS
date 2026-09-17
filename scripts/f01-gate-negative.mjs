import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOutputs, requireThree, requireMatching, cleanSource, exact } from './f01-lib.mjs';
import { checkReadmes } from './check-f01.mjs';
import { checkToolchains } from './check-toolchains.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(callback) { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'f01-negative-')); try {
    return callback(p);
}
finally {
    fs.rmSync(p, { recursive: true, force: true });
} }
const write = (p, text = 'fixture') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
function outputs(p) {
    const inv = { rustBinaries: ['bff-gateway', 'capacity-monitor'], python: [{ name: 'quantos-test', version: '0.1.0' }], js: [{ directory: 'apps/terminal', output: 'apps/terminal/out' }] };
    for (const n of inv.rustBinaries) {
        write(path.join(p, 'target/release', n));
        fs.chmodSync(path.join(p, 'target/release', n), 0o755);
    }
    write(path.join(p, 'artifacts/python/quantos_test-0.1.0-py3-none-any.whl'));
    write(path.join(p, 'apps/terminal/out/index.html'));
    return inv;
}
test('formal gate rejects zero, one, two and noninteger runs', () => { for (const n of [0, 1, 2, NaN, 3.5])
    assert.throws(() => requireThree(n)); requireThree(3); });
test('all binaries participate in digest and omitted binary fails', () => fixture(p => {
    const inv = outputs(p);
    const a = validateOutputs(p, inv);
    write(path.join(p, 'target/release/bff-gateway'), 'changed');
    const b = validateOutputs(p, inv);
    assert.throws(() => requireMatching([a, a, b]), /differ/);
    fs.rmSync(path.join(p, 'target/release/capacity-monitor'));
    assert.throws(() => validateOutputs(p, inv), /mismatch/);
}));
test('extra binary, missing wheel and stale/empty Web cannot pass output inventory', () => fixture(p => {
    const inv = outputs(p);
    write(path.join(p, 'target/release/extra'));
    fs.chmodSync(path.join(p, 'target/release/extra'), 0o755);
    assert.throws(() => validateOutputs(p, inv), /mismatch/);
    fs.rmSync(path.join(p, 'target/release/extra'));
    fs.rmSync(path.join(p, 'artifacts/python/quantos_test-0.1.0-py3-none-any.whl'));
    assert.throws(() => validateOutputs(p, inv));
    outputs(p);
    fs.rmSync(path.join(p, 'apps/terminal/out'), { recursive: true });
    assert.throws(() => validateOutputs(p, inv), /Missing output/);
    fs.mkdirSync(path.join(p, 'apps/terminal/out'));
    assert.throws(() => validateOutputs(p, inv), /Empty output/);
}));
test('manifest inventory cannot omit or add members', () => { assert.throws(() => exact(['a'], ['a', 'b'], 'members')); assert.throws(() => exact(['a', 'b'], ['a'], 'members')); });
test('dirty and untracked source rejected', () => fixture(p => {
    const git = args => execFileSync('git', args, { cwd: p, stdio: 'ignore' });
    git(['init']);
    write(path.join(p, 'source'), 'clean');
    git(['add', '.']);
    git(['-c', 'user.name=F01 Fixture', '-c', 'user.email=f01@example.invalid', 'commit', '-m', 'fixture']);
    assert.equal(cleanSource(p).dirty, false);
    write(path.join(p, 'source'), 'dirty');
    assert.throws(() => cleanSource(p), /clean committed/);
    git(['checkout', '--', 'source']);
    write(path.join(p, 'untracked'), 'x');
    assert.throws(() => cleanSource(p), /clean committed/);
}));
test('deleted module README is rejected', () => fixture(p => {
    const inv = { rustDirectories: ['services/new'], python: [], js: [], rustBinaries: ['new'] };
    for (const d of ['proto', 'crates', 'services', 'engines', 'apps', 'packages', 'supabase', 'services/new'])
        write(path.join(p, d, 'README.md'), '# Module boundary with documented `new` interface.');
    assert.equal(checkReadmes(p, inv), 8);
    fs.rmSync(path.join(p, 'services/new/README.md'));
    assert.throws(() => checkReadmes(p, inv), /README/);
}));
test('wrong uv version fails toolchain preflight', () => fixture(p => {
    for (const f of ['.nvmrc', '.uv-version', 'package.json', 'rust-toolchain.toml'])
        fs.copyFileSync(path.join(root, f), path.join(p, f));
    write(path.join(p, '.uv-version'), '0.0.0');
    assert.throws(() => checkToolchains(p), /uv: expected/);
}));
test('invalid locks fail real lock entrypoint', () => fixture(p => {
    for (const f of ['Cargo.lock', 'buf.lock', 'pnpm-lock.yaml', 'engines/uv.lock'])
        write(path.join(p, f), 'not a lock');
    const result = spawnSync('bash', [path.join(root, 'scripts/check-lockfiles.sh')], { env: { ...process.env, QUANTOS_GATE_ROOT: p }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
}));
test('Terminal default lint rejects a page TSX violation', () => {
    const dir = fs.mkdtempSync(path.join(root, 'apps/terminal/app/f01-probe-'));
    try {
        write(path.join(dir, 'page.tsx'), 'export const invalid: any = 1;\n');
        const r = spawnSync('pnpm', ['--filter', '@sumalpha/terminal', 'lint'], { cwd: root, encoding: 'utf8' });
        assert.notEqual(r.status, 0);
        assert.match(r.stdout + r.stderr, /no-explicit-any/);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
test('invalid run revokes old successful receipt', () => fixture(p => {
    const output = path.join(p, 'receipt.json');
    write(output, JSON.stringify({ passed: true, reproducible: true }));
    const r = spawnSync('node', [path.join(root, 'scripts/verify-reproducible-builds.mjs'), '--runs', '1', '--output', output], { cwd: root, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    const receipt = JSON.parse(fs.readFileSync(output));
    assert.equal(receipt.status, 'FAIL');
    assert.equal(receipt.passed, false);
    assert.equal(receipt.reproducible, false);
}));
function lockFixture(p) {
    for (const f of ['Cargo.toml', 'Cargo.lock', 'buf.lock', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', '.python-version'])
        fs.copyFileSync(path.join(root, f), path.join(p, f));
    for (const directory of ['crates', 'services'])
        fs.cpSync(path.join(root, directory), path.join(p, directory), { recursive: true });
    for (const directory of ['engines', 'apps', 'packages']) {
        fs.mkdirSync(path.join(p, directory), { recursive: true });
        for (const name of fs.readdirSync(path.join(root, directory))) {
            for (const file of ['pyproject.toml', 'package.json']) {
                const from = path.join(root, directory, name, file);
                if (fs.existsSync(from)) {
                    fs.mkdirSync(path.join(p, directory, name), { recursive: true });
                    fs.copyFileSync(from, path.join(p, directory, name, file));
                }
            }
        }
    }
    for (const f of ['pyproject.toml', 'uv.lock'])
        fs.copyFileSync(path.join(root, 'engines', f), path.join(p, 'engines', f));
    fs.mkdirSync(path.join(p, 'scripts'));
    fs.copyFileSync(path.join(root, 'scripts/check-node-lock.mjs'), path.join(p, 'scripts/check-node-lock.mjs'));
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(p, 'node_modules'), 'dir');
}
for (const [name, mutate, pattern] of [
    ['Cargo manifest drift', p => { const f = path.join(p, 'Cargo.toml'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('anyhow = "1.0.100"', 'anyhow = "=0.0.0"')); }, /anyhow|lock/i],
    ['uv manifest drift', p => { const f = path.join(p, 'engines/pyproject.toml'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('ruff==0.12.7', 'ruff==0.12.6')); }, /lock|ruff|No solution found/i],
    ['pnpm manifest drift', p => { const f = path.join(p, 'package.json'); const j = JSON.parse(fs.readFileSync(f)); j.devDependencies.typescript = '0.0.0'; fs.writeFileSync(f, JSON.stringify(j)); }, /OUTDATED_LOCKFILE|doesn.t match|typescript/i],
    ['malformed Buf lock', p => write(path.join(p, 'buf.lock'), 'not a lock'), /Invalid Buf lock/],
])
    test(`${name} is rejected by actual lock gate`, () => fixture(p => {
        lockFixture(p);
        const env = { ...process.env, QUANTOS_GATE_ROOT: p, CARGO_NET_OFFLINE: 'true', UV_OFFLINE: 'true' };
        // A frozen install may populate wheels without the resolver index.
        // Prove the unchanged fixture passes even with a fresh uv cache.
        if (name === 'uv manifest drift') env.UV_CACHE_DIR = path.join(p, 'empty-uv-cache');
        const baseline = spawnSync('bash', [path.join(root, 'scripts/check-lockfiles.sh')], { env, encoding: 'utf8' });
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        mutate(p);
        const r = spawnSync('bash', [path.join(root, 'scripts/check-lockfiles.sh')], { env, encoding: 'utf8' });
        assert.notEqual(r.status, 0);
        assert.match(r.stdout + r.stderr, pattern);
    }));
test('broken Desktop is outside phase-one pnpm frozen check', () => fixture(p => {
    lockFixture(p);
    write(path.join(p, 'apps/terminal-desktop/package.json'), '{ broken desktop');
    const r = spawnSync('node', ['scripts/check-node-lock.mjs'], { cwd: p, env: process.env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
}));

test('uv output marker is metadata, other unexpected files still fail', () => fixture(p => {
    const inv = outputs(p);
    write(path.join(p, 'artifacts/python/.gitignore'), '*\n');
    assert.equal(validateOutputs(p, inv).python.files.length, 1);
    write(path.join(p, 'artifacts/python/extra.txt'));
    assert.throws(() => validateOutputs(p, inv), /mismatch/);
}));
