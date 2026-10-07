import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

test('both Python lint targets reject active code errors and preserve archived evidence', () => {
  const root = resolve(import.meta.dirname, '..');
  const commands = readFileSync(resolve(root, 'Makefile'), 'utf8').split('\n').filter(line => line.includes('ruff check .'));
  assert.equal(commands.length, 2, 'verify both lint-python and f08-check');
  const fixture = mkdtempSync(resolve(tmpdir(), 'quantos-python-lint-scope-'));
  try {
    for (const path of ['engines/active.py', 'scripts/active.py', 'docs/audit/evidence/historical/snapshot.py', 'third_party/vibe-trading/upstream-src/vendor.py']) {
      mkdirSync(dirname(resolve(fixture, path)), {recursive: true});
      writeFileSync(resolve(fixture, path), 'import os, sys\n');
    }
    for (const command of commands) {
      const exclude = command.match(/--extend-exclude (\S+)$/)?.[1]; assert(exclude);
      const result = spawnSync(resolve(root, 'engines/.venv/bin/ruff'), ['check', '.', '--extend-exclude', exclude], {cwd: fixture, encoding: 'utf8'});
      assert.equal(result.status, 1, 'active lint violations must fail');
      assert.match(result.stdout, /engines\/active\.py/); assert.match(result.stdout, /scripts\/active\.py/);
      assert.doesNotMatch(result.stdout, /snapshot\.py|vendor\.py/);
      assert.match(result.stdout, /E401/);
    }
  } finally {rmSync(fixture, {recursive: true, force: true});}
});
