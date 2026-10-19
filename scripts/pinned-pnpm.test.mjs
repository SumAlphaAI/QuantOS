import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pinnedPnpmDirectory, pinnedPnpmVersion } from './pinned-pnpm.mjs';
import { environment } from './p0-functional-scope.mjs';

function fixture(t, version) {
  const root = mkdtempSync(join(tmpdir(), 'quantos-pnpm-path-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const executable = join(bin, 'pnpm');
  writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
  chmodSync(executable, 0o755);
  return { HOME: join(root, 'linux-home'), PATH: bin };
}

test('Linux CI PATH provides the actual pinned pnpm without a macOS cache', t => {
  const base = fixture(t, pinnedPnpmVersion);
  assert.equal(pinnedPnpmDirectory(base), base.PATH);
  const env = environment({ ...base, DATABASE_URL: 'synthetic', AWS_SECRET_ACCESS_KEY: 'synthetic' });
  assert.equal(env.PATH.split(':')[0], base.PATH);
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.NEXT_PUBLIC_QUANTOS_ENV, 'local-mock');
});

test('wrong or unavailable pnpm versions fail closed', t => {
  for (const version of ['11.21.0', '10.19.0', 'not-a-version']) {
    assert.throws(() => pinnedPnpmDirectory(fixture(t, version)), /pinned pnpm 10\.20\.0 required/);
  }
  assert.throws(() => pinnedPnpmDirectory({ PATH: '', HOME: '/nonexistent-pnpm-home' }), /required/);
});
