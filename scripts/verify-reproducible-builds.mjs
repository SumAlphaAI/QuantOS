#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { run, validateOutputs, requireThree, requireMatching, cleanSource } from './f01-lib.mjs';
import { checkToolchains } from './check-toolchains.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const mode = option('--mode', 'reproducibility');
const runs = Number(option('--runs', '3'));
const output = path.resolve(root, option('--output', `artifacts/reproducibility/f01-${mode}.json`));
const evidence = { schemaVersion: 2, mode, status: 'RUNNING', passed: false, reproducible: false, startedAt: new Date().toISOString(), environment: { os: os.platform(), release: os.release(), arch: os.arch(), ciRunId: process.env.GITHUB_RUN_ID ?? null, ciRunUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null }, runs: [] };
function save() { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n'); }
// Revoke stale success before validating inputs or starting any build.
save();
let scratch;
try {
    if (!['clean-room', 'reproducibility'].includes(mode))
        throw new Error('Unknown mode');
    if (mode === 'reproducibility')
        requireThree(runs);
    evidence.source = cleanSource(root);
    evidence.toolchains = checkToolchains(root);
    evidence.sourceDateEpoch = Number(run(root, 'git', ['show', '-s', '--format=%ct', evidence.source.commit], process.env, true).trim());
    scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f01-')));
    if (process.argv.includes('--keep-workdirs')) evidence.retainedWorkdir = scratch;
    const archive = path.join(scratch, 'source.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, evidence.source.commit], { cwd: root });
    evidence.directoryPolicy = 'fixed physical build prefix; source/install/output directory removed and recreated for every run';
    evidence.cachePolicy = mode === 'clean-room' ? 'empty package download caches; empty install and build directories; preinstalled pinned toolchains' : 'shared package downloads only; fresh source/install/build directories for every run';
    for (let i = 1; i <= (mode === 'clean-room' ? 1 : runs); i++) {
        const workspace = path.join(scratch, 'workspace');
        if (fs.existsSync(workspace)) throw new Error('Previous build directory was not removed');
        fs.mkdirSync(workspace);
        execFileSync('tar', ['-xf', archive, '-C', workspace]);
        // The archive contains tracked source only: no ignored env, dist, target, node_modules, or .venv.
        for (const name of ['target', 'node_modules', 'engines/.venv', 'artifacts/python', 'apps/terminal/out', 'apps/website/out'])
            if (fs.existsSync(path.join(workspace, name)))
                throw new Error(`Tracked build residue: ${name}`);
        const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'RUSTUP_HOME', 'CARGO_HOME', 'SSL_CERT_FILE'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
        Object.assign(env, { QUANTOS_SKIP_ENV: '1', GITHUB_SHA: evidence.source.commit, SOURCE_DATE_EPOCH: String(evidence.sourceDateEpoch), TZ: 'UTC', NEXT_TELEMETRY_DISABLED: '1', CARGO_TARGET_DIR: path.join(workspace, 'target'), CARGO_HTTP_MULTIPLEXING: 'false', CARGO_HTTP_TIMEOUT: '60', RUSTFLAGS: `--remap-path-prefix=${workspace}=/quantos`, UV_BUILD_CONSTRAINT: path.join(workspace, 'engines/build-constraints.txt'), NEXT_PUBLIC_QUANTOS_ENV: 'local-mock', NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000', NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: 'http://localhost:3100', NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: 'http://localhost:4010', NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: 'https://mock.idp.local', NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: 'quantos-f01', NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: 'http://localhost:3100/auth/callback', NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: 'paper', NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'true', NEXT_PUBLIC_QUANTOS_OBS_ENABLED: 'false', NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET: 'off' });
        if (mode === 'clean-room')
            Object.assign(env, { CARGO_HOME: path.join(scratch, 'cargo-cache'), RUSTUP_HOME: process.env.RUSTUP_HOME ?? path.join(os.homedir(), '.rustup'), UV_CACHE_DIR: path.join(scratch, 'uv-cache'), npm_config_store_dir: path.join(scratch, 'pnpm-cache') });
        const result = { run: i, startedAt: new Date().toISOString(), commands: [] };
        evidence.runs.push(result);
        save();
        function command(binary, args) { const start = Date.now(); try {
            run(workspace, binary, args, env);
            result.commands.push({ binary, args, exitCode: 0, seconds: (Date.now() - start) / 1000 });
        }
        catch (error) {
            result.commands.push({ binary, args, exitCode: error.status ?? -1, seconds: (Date.now() - start) / 1000 });
            throw error;
        }
        finally {
            save();
        } }
        const start = Date.now();
        command('make', ['bootstrap']);
        if (mode === 'clean-room') {
            command('make', ['lockfile-check', 'f01-check', 'lint', 'test']);
            result.elapsedSeconds = (Date.now() - start) / 1000;
            if (result.elapsedSeconds > 1800)
                throw new Error('Clean-room exceeded 1800 seconds');
        }
        else {
            command('cargo', ['build', '--workspace', '--release', '--locked']);
            command('pnpm', ['build']);
            command('make', ['build-python']);
            // Resolve manifests in this isolated environment, never from the operator checkout.
            const inv = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `import {inventory} from './scripts/f01-lib.mjs'; console.log(JSON.stringify(inventory(process.cwd())));`], { cwd: workspace, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
            Object.assign(result, validateOutputs(workspace, inv));
            result.inventory = inv;
        }
        result.completedAt = new Date().toISOString();
        save();
        if (process.argv.includes('--keep-workdirs')) fs.renameSync(workspace, path.join(scratch, `run-${i}`));
        else fs.rmSync(workspace, { recursive: true, force: true });
    }
    if (mode === 'reproducibility') {
        requireMatching(evidence.runs);
        evidence.reproducible = true;
    }
    const after = cleanSource(root);
    if (after.commit !== evidence.source.commit)
        throw new Error('Source changed during verification');
    evidence.status = 'PASS';
    evidence.passed = true;
}
catch (error) {
    evidence.status = 'FAIL';
    evidence.error = String(error.message);
    process.exitCode = 1;
    console.error(error.message);
}
finally {
    evidence.completedAt = new Date().toISOString();
    save();
    if (scratch && !process.argv.includes('--keep-workdirs'))
        fs.rmSync(scratch, { recursive: true, force: true });
}
