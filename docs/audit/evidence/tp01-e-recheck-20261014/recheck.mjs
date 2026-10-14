// Local revalidation of an existing sealed candidate; never publishes a Gate.
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve, relative} from 'node:path';
import {staticEnvironment, digest} from '../../../../scripts/provider-a1-receipts.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../..');
assert.equal(process.cwd(), root, 'run from the QuantOS root');
assert.deepEqual(process.argv.slice(2), ['--record']);
const output = resolve(directory, 'results.json');
assert(!existsSync(output), 'preserve earlier runs in a fresh directory');
const reviewedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const frozenCandidate = JSON.parse(readFileSync('docs/audit/evidence/tp01-e-local-20261014/manifest.json')).observedSourceCommit;
const checks = [
  ['sync-regressions', ['node', '--test', '--test-reporter=tap', 'scripts/tests/sync-vibe.test.mjs', 'scripts/tests/sync-vibe-cli.test.mjs'], 0, 23],
  ['functional-negatives', ['node', '--test', '--test-reporter=tap', 'scripts/tp01-e-functional.test.mjs', 'scripts/tp-reference-local.test.mjs'], 0, 55],
  ['admission-negatives', ['node', '--test', '--test-reporter=tap', 'scripts/tp01-e-local-gate.test.mjs', 'scripts/tp01-e-plan-contract.test.mjs'], 0, 49],
  ['closure-negatives', ['node', '--test', '--test-reporter=tap', 'docs/audit/evidence/tp01-e-local-20261014/closure-negatives.mjs'], 0, 16],
  ['plan-negatives', ['node', '--test', '--test-reporter=tap', 'scripts/development-plan-order-negative.mjs'], 0, 44],
  ['sealed-candidate', ['node', 'docs/audit/evidence/tp01-e-local-20261014/verify.mjs'], 0],
  ['evidence-seal', ['python3', 'docs/audit/evidence/tp01-e-local-20261014/seal.py', '--verify'], 0],
  ['local-ready', ['node', 'scripts/tp01-e-local-gate.mjs', '--ready'], 0],
  ['release-refusal', ['node', 'scripts/tp01-e-local-gate.mjs', '--release'], 2],
  ['plans', ['node', 'scripts/check-development-plans.mjs'], 0],
  ['development-handoff', ['make', 'development-handoff-check'], 0],
  ['frontend-handoff', ['node', 'scripts/check-frontend-gate-handoff.mjs'], 0],
];
const env = {...staticEnvironment(process.env), CARGO_NET_OFFLINE: 'true', UV_OFFLINE: '1', npm_config_offline: 'true', QUANTOS_RELEASE_PERFORMANCE: '0'};
const executions = [];
for (const [id, command, expectedExitCode, expectedTests] of checks) {
  const executedAt = new Date().toISOString();
  const run = spawnSync(command[0], command.slice(1), {env, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024});
  const bytes = (run.stdout ?? '') + (run.stderr ?? '');
  const log = resolve(directory, id + '.log');
  writeFileSync(log, bytes);
  const testCounts = expectedTests === undefined ? null : Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, Number(bytes.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN)]));
  const testsMet = testCounts === null || (testCounts.tests === expectedTests && testCounts.pass === expectedTests && ['fail', 'cancelled', 'skipped', 'todo'].every(key => testCounts[key] === 0));
  const expectationMet = run.status === expectedExitCode && !run.error && !run.signal && testsMet;
  executions.push({id, command, executedAt, expectedExitCode, exitCode: run.status, signal: run.signal, executionErrorCode: run.error?.code ?? null, timeoutMs: 300000, expectationMet, testCounts, log: relative(root, log), logSha256: digest(bytes)});
  console.log(id + ': ' + (expectationMet ? 'PASS' : 'FAIL') + ' (exit ' + run.status + ')');
}
const result = {
  schema: 'quantos-tp01-e-local-recheck/v1', reviewedCommit, frozenCandidate,
  scope: 'LOCAL_REGRESSIONS_AND_EXISTING_FROZEN_EVIDENCE_REVALIDATION',
  status: executions.every(check => check.expectationMet) ? 'PASS' : 'FAIL',
  fullClosureReexecuted: false, originalClosureNodes: 28, originalClosureChecks: 88,
  currentTests: executions.reduce((sum, check) => sum + (check.testCounts?.pass ?? 0), 0),
  formalAccepted: false, syncApproved: false, databaseExecution: false,
  externalExecution: false, performanceAccepted: false, gatePublished: false,
  runnerSha256: digest(readFileSync(fileURLToPath(import.meta.url))), executions,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
assert.equal(result.status, 'PASS', 'inspect preserved failure logs');
console.log(JSON.stringify({status: result.status, checks: executions.length, tests: result.currentTests, frozenCandidate, fullClosureReexecuted: false}));
