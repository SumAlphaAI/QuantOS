import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verify, selectors, executionBudget, executeCheck, verifyExecution} from '../engines/vibe-adapter/check-development.mjs';
import {digest, inventory, nodesFromPlans, planInput, validateArtifact, supportingArtifactPaths} from './provider-a1-receipts.mjs';

function fixture(fn) {
  const archive = resolve('docs/audit/evidence/tp01-c-20261009/initial-blocked');
  const directory = mkdtempSync(resolve(tmpdir(), 'tp01-c-artifact-'));
  try {
    cpSync(archive, directory, {recursive: true});
    const record = JSON.parse(readFileSync(resolve(directory, 'receipt.json')));
    // Unit-only migration of an ephemeral historical copy; archive bytes never change.
    record.schema = 'quantos-tp01-c-skeleton-evidence/v2';
    record.testFixture = 'UNIT_ONLY_HISTORICAL_COPY_NOT_EXECUTION_EVIDENCE';
    for (const c of record.checks) Object.assign(c, {timeoutMs: executionBudget(c.id),
      elapsedMs: 0, timedOut: false, executionErrorCode: null, signal: null});
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

test('Python regression count cannot fall below the established baseline', () => fixture((r, directory) => {
  const path=resolve(directory, 'python.log');const output=readFileSync(path,'utf8').replace('263 passed','262 passed');
  writeFileSync(path,output);r.checks.find(c=>c.id==='python').logSha256=digest(output);
  assert.throws(()=>verify(r,{checkDependencies:false,logDirectory:directory}),/below the established/);
}));

for (const [name, mutate] of [
  ['missing timeout budget', c => delete c.timeoutMs],
  ['missing elapsed clock', c => delete c.elapsedMs],
  ['missing timeout flag', c => delete c.timedOut],
  ['missing spawn error', c => delete c.executionErrorCode],
  ['missing signal', c => delete c.signal],
  ['timeout despite zero exit', c => c.timedOut = true],
  ['error despite zero exit', c => c.executionErrorCode = 'ETIMEDOUT'],
  ['signal despite zero exit', c => c.signal = 'SIGTERM'],
  ['null exit', c => c.exitCode = null],
  ['altered manager budget', c => c.timeoutMs = 180000],
  ['non-finite elapsed clock', c => c.elapsedMs = NaN],
  ['negative elapsed clock', c => c.elapsedMs = -1],
]) test('v2 rejects ' + name, () => fixture((r, logDirectory) => {
  mutate(r.checks.find(c => c.id === 'manager'));
  assert.throws(() => verify(r, {checkDependencies: false, logDirectory}));
}));

test('v1 remains historical and cannot impersonate current execution', () => fixture((r, logDirectory) => {
  r.schema = 'quantos-tp01-c-skeleton-evidence/v1';
  assert.throws(() => verify(r, {checkDependencies: false, logDirectory}));
  assert.equal(JSON.parse(readFileSync('docs/audit/evidence/tp01-c-20261009/initial-blocked/receipt.json')).schema,
    'quantos-tp01-c-skeleton-evidence/v1');
}));

test('manager receives bounded ten-minute harness budget, other checks retain three minutes', () => {
  let captured;
  const {result} = executeCheck('manager', {execute: (binary, args, options) => {
    captured = {binary, args, options};return {status: 0, signal: null, stdout: 'UNIT_ONLY'};
  }, now: () => 1000});
  assert.equal(captured.options.timeout, 600000);
  assert.equal(captured.binary, 'cargo');
  assert.deepEqual(captured.args, ['test', '--locked', '--offline', '-p', 'quantos-engine-manager']);
  assert.equal(executionBudget('python'), 180000);
  assert.throws(() => executionBudget('unknown'));
  verifyExecution(result, 'manager');
});
for (const [name, run] of [
  ['ETIMEDOUT', {status: null, signal: 'SIGTERM', error: {code: 'ETIMEDOUT'}}],
  ['timeout with zero exit', {status: 0, error: {code: 'ETIMEDOUT'}}],
  ['signal with zero exit', {status: 0, signal: 'SIGTERM'}],
  ['spawn error with zero exit', {status: 0, error: {code: 'ENOENT'}}],
  ['unknown spawn error', {status: 0, error: {code: 'invalid code'}}],
]) test('actual outcome derivation fails closed for ' + name, () => {
  const {result} = executeCheck('manager', {execute: () => ({stdout: 'test suite passed', ...run}), now: () => 1000});
  assert.equal(result.status, 'FAIL');
  assert.throws(() => verifyExecution(result, 'manager'));
  if (name === 'ETIMEDOUT') assert.equal(result.timedOut, true);
});
