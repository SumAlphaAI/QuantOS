import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verify, selectors} from '../engines/vibe-adapter/check-development.mjs';
import {inventory, nodesFromPlans, planInput, validateArtifact, supportingArtifactPaths} from './provider-a1-receipts.mjs';

function fixture(fn) {
  const archive = resolve('docs/audit/evidence/tp01-c-20261009/initial-blocked');
  const directory = mkdtempSync(resolve(tmpdir(), 'tp01-c-artifact-'));
  try {
    cpSync(archive, directory, {recursive: true});
    const record = JSON.parse(readFileSync(resolve(directory, 'receipt.json')));
    record.inputs = inventory(selectors);
    record.planInput = planInput(nodesFromPlans().get('CORE:TP01-C'));
    fn(record, directory);
  } finally { rmSync(directory, {recursive: true, force: true}); }
}

test('engineering snapshot never grants admission when dependencies are not assessed', () => fixture((r, logDirectory) => {
  assert.deepEqual(verify(r, {checkDependencies: false, logDirectory}), {
    engineeringStatus: 'PASS', stageGate: 'NOT_ASSESSED', formalAccepted: false,
  });
  assert.deepEqual(supportingArtifactPaths('tp01-c-skeleton', r),
    ['format.log', 'lock.log', 'manager.log', 'plans.log', 'pyright.log', 'python.log', 'ruff.log']);
}));

for (const [name, mutate] of [
  ['omitted check', r => r.checks.pop()],
  ['failed execution', r => r.checks[0].exitCode = 1],
  ['fake command', r => r.checks[0].command = ['true']],
  ['changed source', r => r.inputs[0].sha256 = 'sha256:' + '0'.repeat(64)],
  ['changed log', r => r.checks[0].logSha256 = 'sha256:' + '0'.repeat(64)],
  ['formal acceptance claim', r => r.formalAccepted = true],
  ['future execution', r => r.checks[0].executedAt = '9999-01-01T00:00:00Z'],
]) test('skeleton artifact rejects ' + name, () => fixture((r, logDirectory) => {
  mutate(r); assert.throws(() => verify(r, {checkDependencies: false, logDirectory}));
}));

test('unified artifact rejects a receipt executed on another source SHA', () => fixture((r, directory) => {
  const path = resolve(directory, 'receipt.json'); writeFileSync(path, JSON.stringify(r));
  assert.throws(() => validateArtifact('tp01-c-skeleton', path, '0'.repeat(40)), /source differs/);
}));

test('copied artifact verifies its bound supporting logs instead of mutable original logs', () => fixture((r, directory) => {
  const path = resolve(directory, 'receipt.json'); writeFileSync(path, JSON.stringify(r));
  validateArtifact('tp01-c-skeleton', path, r.observedSourceCommit);
  writeFileSync(resolve(directory, 'python.log'), 'fake PASS');
  assert.throws(() => validateArtifact('tp01-c-skeleton', path, r.observedSourceCommit), /execution log changed/);
}));
