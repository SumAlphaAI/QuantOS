import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/terminal/package.json'));
const bundled = require('next/dist/compiled/webpack/webpack');
bundled.init();
const webpack = bundled.webpack;
const { default: loadConfig } = require('next/dist/server/config');
// Real pinned Webpack collisions, not a mocked hash or a scanner exemption.
const shortCollision = ['collision-11599.js', 'collision-18619.js']; // both 9311 in 10^4
const fixedCollision = ['closed-776.js', 'closed-61401.js']; // both 28548812 in 10^8

async function compile(directory, names, reverse, configure) {
    fs.mkdirSync(directory, { recursive: true });
    names.forEach((name, i) => fs.writeFileSync(path.join(directory, name), `module.exports = ${JSON.stringify(i ? 'right' : 'left')};\n`));
    fs.writeFileSync(path.join(directory, 'entry.js'), `module.exports = [require('./${names[0]}'), require('./${names[1]}')];\n`);
    const ids = {};
    const ordering = {
        apply(compiler) {
            compiler.hooks.compilation.tap('TraversalOrderProbe', compilation => {
                compilation.hooks.moduleIds.tap({ name: 'TraversalOrderProbe', stage: -10000 }, () => {
                    for (const module of compilation.modules) {
                        const index = names.indexOf(path.basename(module.resource || ''));
                        if (index >= 0) compilation.moduleGraph.setPreOrderIndex(module, reverse ? 1 - index : index);
                    }
                });
                compilation.hooks.afterOptimizeModuleIds.tap('TraversalOrderProbe', () => {
                    for (const module of compilation.modules) {
                        const name = path.basename(module.resource || '');
                        if (names.includes(name)) ids[name] = compilation.chunkGraph.getModuleId(module);
                    }
                });
            });
        },
    };
    const config = configure({
        mode: 'production', context: directory, target: 'node', cache: false,
        entry: './entry.js', output: { path: path.join(directory, 'out'), filename: 'bundle.js', library: { type: 'commonjs2' } },
        optimization: { moduleIds: false, minimize: false }, plugins: [ordering],
    });
    const compiler = webpack(config);
    const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => {
        compiler.close(closeError => error || closeError ? reject(error || closeError) : resolve(stats));
    }));
    if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
    const bytes = fs.readFileSync(path.join(directory, 'out/bundle.js'));
    const module = { exports: {} };
    vm.runInNewContext(bytes.toString(), { module, exports: module.exports });
    assert.equal(JSON.stringify(module.exports), '["left","right"]');
    return { bytes, ids };
}

async function withFixture(callback) {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'f02-module-ids-')));
    try { await callback(directory); }
    finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

async function applicationConfig(app) {
    const env = {
        NEXT_PUBLIC_QUANTOS_ENV: 'local-mock', NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
        NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: 'http://localhost:3100', NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: 'http://localhost:4010',
        NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: 'https://mock.idp.local', NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: 'quantos-f01',
        NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: 'http://localhost:3100/auth/callback', NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: 'paper',
        NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'true', NEXT_PUBLIC_QUANTOS_OBS_ENABLED: 'false', NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET: 'off',
    };
    const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    try {
        Object.assign(process.env, env);
        const config = await loadConfig('phase-production-build', path.join(root, 'apps', app));
        return base => config.webpack(base, { webpack, isServer: false, dev: false });
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
}

if (process.env.QUANTOS_ID_COLLISION_PROBE) {
    process.on('uncaughtException', error => { console.error(error.message); process.exit(1); });
    await compile(process.argv[2], fixedCollision, false, await applicationConfig(process.env.QUANTOS_ID_COLLISION_PROBE));
} else {
test('old short-ID collision swaps 9311/1692 with traversal order and changes real bundle bytes', () => withFixture(async directory => {
    const old = config => {
        config.plugins.push(new webpack.ids.DeterministicModuleIdsPlugin({ maxLength: 4, fixedLength: true }));
        return config;
    };
    const first = await compile(directory, shortCollision, false, old);
    const second = await compile(directory, shortCollision, true, old);
    assert.deepEqual(Object.values(first.ids).sort(), [1692, 9311]);
    assert.equal(first.ids[shortCollision[0]], second.ids[shortCollision[1]]);
    assert.notDeepEqual(first.bytes, second.bytes);
}));

for (const app of ['terminal', 'website']) {
    test(`${app} actual Next config produces identical executable bytes under both traversal orders`, () => withFixture(async directory => {
        const configure = await applicationConfig(app);
        const first = await compile(directory, shortCollision, false, configure);
        const second = await compile(directory, shortCollision, true, configure);
        assert.deepEqual(first.ids, second.ids);
        assert.deepEqual(first.bytes, second.bytes);
    }));
    test(`${app} actual Next config rejects a collision in the new namespace`, () => withFixture(async directory => {
        // Webpack throws from its async compilation hook; assert the real process exits nonzero.
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), directory], {
            env: { ...process.env, QUANTOS_ID_COLLISION_PROBE: app }, encoding: 'utf8',
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /deterministic module ids.*1 conflict/si);
    }));
}
}
