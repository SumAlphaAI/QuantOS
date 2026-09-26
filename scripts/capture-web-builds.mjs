#!/usr/bin/env node
// Diagnostic only: preserves actual Web files. Does not replace the full F01 Gate.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'artifacts/web-build-diagnostic');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const epoch = execFileSync('git', ['show', '-s', '--format=%ct', sha], { cwd: root, encoding: 'utf8' }).trim();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-web-diagnostic-'));
const receipt = { source: sha, kind: 'DIAGNOSTIC_NOT_ACCEPTANCE', status: 'RUNNING', runs: [] };
fs.mkdirSync(output, { recursive: true });
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
const env = { ...process.env, GITHUB_SHA: sha, SOURCE_DATE_EPOCH: epoch, TZ: 'UTC', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_QUANTOS_ENV: 'local-mock', NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
  NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: 'http://localhost:3100', NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: 'http://localhost:4010',
  NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: 'https://mock.idp.local', NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: 'quantos-f01',
  NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: 'http://localhost:3100/auth/callback', NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: 'paper',
  NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'true', NEXT_PUBLIC_QUANTOS_OBS_ENABLED: 'false', NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET: 'off' };
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name), prefix + e.name + '/') : [{ path: prefix + e.name, sha256: createHash('sha256').update(fs.readFileSync(path.join(dir, e.name))).digest('hex') }]).sort((a, b) => a.path.localeCompare(b.path));
}
save();
try {
  const archive = path.join(scratch, 'source.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, sha], { cwd: root });
  for (let i = 1; i <= 6; i++) {
    const workspace = path.join(scratch, 'workspace');
    fs.mkdirSync(workspace);
    execFileSync('tar', ['-xf', archive, '-C', workspace]);
    for (const args of [['pnpm', 'install', '--frozen-lockfile'], ['pnpm', 'build']])
      execFileSync('corepack', args, { cwd: workspace, env, stdio: 'inherit' });
    const destination = path.join(output, `run-${i}`);
    for (const name of ['terminal', 'website']) fs.cpSync(path.join(workspace, 'apps', name, 'out'), path.join(destination, name), { recursive: true });
    receipt.runs.push({ run: i, files: files(destination) });
    save();
    fs.rmSync(workspace, { recursive: true, force: true });
    if (i > 1 && JSON.stringify(receipt.runs[0].files) !== JSON.stringify(receipt.runs[i - 1].files)) {
      receipt.status = 'DIFFERENCE_CAPTURED';
      break;
    }
  }
  if (receipt.status === 'RUNNING') receipt.status = 'NO_DIFFERENCE_OBSERVED';
} catch (error) {
  receipt.status = 'ERROR'; receipt.error = String(error.message); process.exitCode = 1;
} finally {
  save(); fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify({ source: sha, status: receipt.status, runs: receipt.runs.length }));
