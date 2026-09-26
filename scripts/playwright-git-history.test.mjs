import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

test('Playwright PR reporting preserves complete history for downstream security scans', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-pw-history-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const origin = path.join(scratch, 'origin');
    fs.mkdirSync(origin);
    git(origin, 'init', '-q');
    fs.writeFileSync(path.join(origin, 'tracked.txt'), 'base\n');
    git(origin, 'add', '.');
    const commit = () => git(origin, '-c', 'user.name=History fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
    commit();
    const base = git(origin, 'rev-parse', 'HEAD');
    fs.appendFileSync(path.join(origin, 'tracked.txt'), 'head\n');
    git(origin, 'add', '.'); commit();
    const event = path.join(scratch, 'event.json');
    fs.writeFileSync(event, JSON.stringify({ pull_request: { title: 'History fixture', number: 1, base: { sha: base } } }));
    for (const [name, config, broken] of [
      ['negative-control', 'playwright.config.ts', true],
      ['terminal', 'playwright.config.ts', false],
      ['website', 'playwright.website.config.ts', false],
    ]) {
      const checkout = path.join(scratch, name);
      git(scratch, 'clone', '-q', pathToFileURL(origin).href, checkout);
      fs.symlinkSync(path.join(root, 'node_modules'), path.join(checkout, 'node_modules'), 'dir');
      fs.mkdirSync(path.join(checkout, 'tests'));
      fs.writeFileSync(path.join(checkout, 'tests/history.spec.ts'), "import { test } from '@playwright/test'; test('report metadata without browser', () => {});\n");
      fs.writeFileSync(path.join(checkout, 'playwright.config.ts'), `import base from ${JSON.stringify(path.join(root, config))};\nexport default { ...base, ${broken ? 'captureGitInfo: { commit: true, diff: true },' : ''} testDir: './tests', testMatch: '**/history.spec.ts', testIgnore: [], webServer: undefined, reporter: 'list', projects: [{ name: 'history' }] };\n`);
      const env = { ...process.env, CI: '1', GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: event,
        NEXT_PUBLIC_QUANTOS_ENV: 'local-mock', NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
        NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: 'http://localhost:3100', NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: 'http://localhost:4010',
        NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: 'https://mock.idp.local', NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: 'history-fixture',
        NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: 'http://localhost:3100/auth/callback', NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: 'paper',
        NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'true', NEXT_PUBLIC_QUANTOS_OBS_ENABLED: 'false', NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET: 'off' };
      execFileSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', path.join(checkout, 'playwright.config.ts')], { cwd: checkout, env, stdio: 'pipe', timeout: 30000 });
      assert.equal(git(checkout, 'rev-parse', '--is-shallow-repository'), String(broken), name);
      if (!broken) assert.equal(git(checkout, 'rev-list', '--count', 'HEAD'), '2', name);
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
