import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root, digest} from './provider-a1-receipts.mjs';

// Content binding permits reuse across documentation commits, while retaining
// the immutable commit that actually supplied each executed target source file.
export function validateTargetSource(receipt, {
  commitType = commit => execFileSync('git', ['cat-file', '-t', commit], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(),
  committedSource = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']}),
} = {}) {
  assert(/^[a-f0-9]{40}$/.test(receipt.sourceCommit ?? ''), 'target execution sourceCommit missing or malformed');
  assert.equal(commitType(receipt.sourceCommit), 'commit', 'target execution sourceCommit must resolve to a commit');
  for (const [path, expected] of Object.entries(receipt.sourceHashes)) {
    assert(!path.startsWith('/') && !path.split('/').includes('..') && !path.includes('\\'), 'unsafe target source path');
    assert.equal(digest(committedSource(receipt.sourceCommit, path)), 'sha256:' + expected, `target source differs from execution commit: ${path}`);
  }
}
