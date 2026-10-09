// TP01-C local mock evidence. Stage admission separately validates current dependencies.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {digest, inventory, nodesFromPlans, planInput, validateReceipt, root} from '../../scripts/provider-a1-receipts.mjs';

const directory = 'docs/audit/evidence/tp01-c-20261009';
const receiptPath = directory + '/receipt.json';
export const selectors = ['engines/vibe-adapter/', 'engines/engine-sdk/', 'engines/tests/',
  'engines/pyproject.toml', 'engines/uv.lock', 'crates/quantos-engine-manager/',
  'Cargo.toml', 'Cargo.lock', 'proto/', 'scripts/provider-a1-receipts.mjs',
  'scripts/provider-a1-policy.json', 'docs/operations/tp01_vibe_inventory_and_threats.md'];
const checks = [
  {id: 'python', command: ['engines/.venv/bin/python', '-m', 'pytest', 'engines/tests', '-q'], marker: /263 passed/},
  {id: 'manager', command: ['cargo', 'test', '--locked', '--offline', '-p', 'quantos-engine-manager'], marker: /test python_vibe_adapter_contracts_round_trip_over_uds \.\.\. ok/},
  {id: 'ruff', command: ['engines/.venv/bin/ruff', 'check', 'engines/vibe-adapter', 'engines/tests/test_vibe_adapter_skeleton.py'], marker: /All checks passed/},
  {id: 'format', command: ['engines/.venv/bin/ruff', 'format', '--check', 'engines/vibe-adapter/src/vibe_adapter/service.py', 'engines/vibe-adapter/src/vibe_adapter/context.py', 'engines/vibe-adapter/src/vibe_adapter/allowlist.py', 'engines/vibe-adapter/src/vibe_adapter/artifact_api.py', 'engines/vibe-adapter/src/vibe_adapter/server.py', 'engines/tests/test_vibe_adapter_skeleton.py'], marker: /6 files already formatted/},
  {id: 'pyright', command: ['engines/.venv/bin/pyright', '--project', 'engines', '--pythonpath', 'engines/.venv/bin/python', 'engines/vibe-adapter/src', 'engines/tests/test_vibe_adapter_skeleton.py'], marker: /0 errors, 0 warnings/},
  {id: 'lock', command: ['uv', 'lock', '--check', '--offline', '--project', 'engines'], marker: /Resolved 52 packages/},
  {id: 'plans', command: ['node', 'scripts/check-development-plans.mjs'], marker: /PASS/},
];
const excluded = ['Supabase PostgreSQL/Storage execution', 'deployed BFF/Runtime integration',
  'production credentials', 'external publication', 'hosted same-SHA CI', 'OS egress sandbox',
  'persistent Artifact/cancellation recovery', 'canary/rollout and formal ACCEPTED'];
export function dependencies() {
  return nodesFromPlans().get('CORE:TP01-C').dependencies.map(nodeId => {
    try { return {nodeId, ...validateReceipt(nodeId)}; }
    catch (error) { return {nodeId, status: 'BLOCKED', reason: error.message.split('\n')[0]}; }
  });
}
export function verify(record, {checkDependencies = true, logDirectory} = {}) {
  assert.equal(record.schema, 'quantos-tp01-c-skeleton-evidence/v1');
  assert.equal(record.nodeId, 'CORE:TP01-C');
  assert.equal(record.stage, 'DEVELOPMENT');
  assert.equal(record.formalAccepted, false);
  assert.deepEqual(record.excluded, excluded);
  assert.deepEqual(record.planInput, planInput(nodesFromPlans().get(record.nodeId)));
  assert.deepEqual(record.inputs, inventory(selectors), 'current functional inputs changed');
  assert(['READY', 'BLOCKED'].includes(record.status));
  if (checkDependencies) {
    assert.deepEqual(record.dependencies, dependencies(), 'dependency content verification changed');
    assert.equal(record.status, record.dependencies.every(d => d.status === 'READY') ? 'READY' : 'BLOCKED');
    if (record.status === 'READY') validateReceipt('CORE:TP01-C');
  }
  assert.equal(record.engineeringStatus, 'PASS');
  assert.match(record.observedSourceCommit, /^[a-f0-9]{40}$/);
  assert(record.environment.node && record.environment.python && record.environment.rust);
  assert.deepEqual(record.checks.map(c => c.id), checks.map(c => c.id));
  for (const [index, result] of record.checks.entries()) {
    const spec = checks[index];
    assert.deepEqual(result.command, spec.command);
    assert.equal(result.exitCode, 0);
    assert.equal(result.status, 'PASS');
    assert(Number.isFinite(Date.parse(result.executedAt)) && Date.parse(result.executedAt) <= Date.now());
    assert.equal(result.log, directory + '/' + spec.id + '.log');
    const log = readFileSync(logDirectory ? resolve(logDirectory, spec.id + '.log') : resolve(root, result.log));
    assert.equal(digest(log), result.logSha256, 'execution log changed');
    assert.match(log.toString(), spec.marker);
    if (spec.id === 'manager') {
      assert.match(log.toString(), /missing_vibe_adapter_does_not_block_mock_workflow_routing \.\.\. ok/);
      assert(!/test result: FAILED/.test(log.toString()));
    }
  }
  // Engineering evidence is consumed before the assessor publishes dependency gates.
  // Skipping dependency validation can never itself return READY.
  return {engineeringStatus: 'PASS', stageGate: checkDependencies ? record.status : 'NOT_ASSESSED', formalAccepted: false};
}
function admit() {
  const evidence = JSON.parse(readFileSync(resolve(root, receiptPath)));
  verify(evidence, {checkDependencies: false});
  validateReceipt('CORE:TP01-C');
  evidence.dependencies = dependencies();
  assert(evidence.dependencies.every(d => d.status === 'READY'));
  evidence.status = 'READY';
  writeFileSync(resolve(root, receiptPath), JSON.stringify(evidence, null, 2) + '\n');
  return verify(evidence);
}
function record() {
  const inputs = inventory(selectors);
  const node = nodesFromPlans().get('CORE:TP01-C');
  mkdirSync(resolve(root, directory), {recursive: true});
  const results = checks.map(spec => {
    const executedAt = new Date().toISOString();
    const run = spawnSync(spec.command[0], spec.command.slice(1), {
      cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
      // No database opt-in or production credentials are needed by these mock suites.
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        !/DATABASE_URL|SUPABASE|PASSWORD|TOKEN|KEY|SECRET|QUANTOS_RUN_.*TESTS|QUANTOS_TRACE_EXPORT_PATH|QUANTOS_ENGINE/.test(key))),
    });
    const log = directory + '/' + spec.id + '.log';
    const output = (run.stdout ?? '') + (run.stderr ?? '');
    writeFileSync(resolve(root, log), output);
    console.log(spec.id + ': exit ' + run.status);
    return {id: spec.id, command: spec.command, executedAt, exitCode: run.status,
      status: run.status === 0 ? 'PASS' : 'FAIL', log, logSha256: digest(output)};
  });
  assert.deepEqual(inputs, inventory(selectors), 'source changed during checks');
  const deps = dependencies();
  const evidence = {schema: 'quantos-tp01-c-skeleton-evidence/v1', nodeId: node.id,
    stage: 'DEVELOPMENT', status: deps.every(d => d.status === 'READY') ? 'READY' : 'BLOCKED',
    engineeringStatus: results.every(c => c.exitCode === 0) ? 'PASS' : 'FAIL', formalAccepted: false,
    observedSourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    environment: {node: process.version, platform: process.platform,
      python: execFileSync('engines/.venv/bin/python', ['--version'], {cwd: root, encoding: 'utf8'}).trim(),
      rust: execFileSync('rustc', ['--version'], {encoding: 'utf8'}).trim()},
    planInput: planInput(node), inputs, checks: results, dependencies: deps, excluded};
  writeFileSync(resolve(root, receiptPath), JSON.stringify(evidence, null, 2) + '\n');
  return verify(evidence);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert(['--record', '--verify', '--ready', '--admit'].includes(process.argv[2]) && process.argv.length === 3);
    const result = process.argv[2] === '--record' ? record() : process.argv[2] === '--admit' ? admit() : verify(JSON.parse(readFileSync(resolve(root, receiptPath))));
    console.log(JSON.stringify(result));
    if (process.argv[2] === '--ready' && result.stageGate !== 'READY') process.exitCode = 2;
  } catch (error) { console.error(error.message.split('\n')[0]); process.exitCode = 1; }
}
