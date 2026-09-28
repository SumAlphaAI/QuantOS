import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';

test('manual protocol baseline rejects missing, symbolic, HEAD and unrelated commits', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'f03-baseline-'));
  const git = (...args) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
  try {
    git('init'); git('config','user.name','Gate Test'); git('config','user.email','gate@example.invalid');
    git('commit','--allow-empty','-m','base'); const base=git('rev-parse','HEAD');
    git('commit','--allow-empty','-m','head'); const head=git('rev-parse','HEAD');
    const unrelated=git('commit-tree', `${head}^{tree}`, '-m', 'unrelated');
    const run = value => spawnSync(process.execPath, [resolve('scripts/check-proto-breaking.mjs')], {
      env:{...process.env, CI:'true', GITHUB_EVENT_NAME:'workflow_dispatch', QUANTOS_GATE_ROOT:cwd,
        QUANTOS_PROTO_BASE:value, BUF_BIN:'/usr/bin/true'}, encoding:'utf8',
    });
    for (const value of ['', 'HEAD^', head, unrelated]) assert.notEqual(run(value).status, 0, value);
    assert.equal(run(base).status, 0);
  } finally { rmSync(cwd, {recursive:true, force:true}); }
});
