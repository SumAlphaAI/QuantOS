import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parse} from 'yaml';
import {root, digest, inventory, confined, nodesFromPlans, planInput, validateReceipt, publishStages} from './provider-a1-receipts.mjs';
import {validateA2, expectedOperations} from './bff-fe-001-development.mjs';
import {validateAudit, operations as auditOperations} from './bff-fe-007-development.mjs';

export const directory = 'docs/audit/evidence/provider-a2-remediation-20261007';
export const dependencies = ['FE:BFF-FE-001', 'FE:BFF-FE-007', 'PROVIDER:A1'];
export const contracts = {C01: expectedOperations.slice(0, 6), C17: expectedOperations.slice(6), C10: auditOperations};
export const checks = {
  coverage: ['node', 'scripts/check-bff-contract-coverage.mjs'],
  negative: ['node', '--test', 'scripts/provider-a2-development.test.mjs'],
  plans: ['node', 'scripts/check-development-plans.mjs'],
};
const read = path => readFileSync(confined(path));
export function policy() { const p = JSON.parse(read('scripts/provider-a2-policy.json')); assert.equal(p.schema, 'quantos-provider-a2-policy/v1'); assert(Array.isArray(p.inputs) && p.inputs.length > 0); return p; }
export function inputs() { return inventory(policy().inputs); }
function approved(path) {
  assert(path.startsWith(directory + '/') && /^[a-z0-9/-]+$/.test(path) && !path.includes('..'), 'A2 assessment outside approved directory');
  return path;
}
export function validateWiring(readBytes = read) {
  const pkg = JSON.parse(readBytes('package.json'));
  assert.equal(pkg.scripts['check:provider-a2'], 'node scripts/provider-a2-development.mjs');
  assert.equal(pkg.scripts['test:provider-a2'], 'node --test scripts/provider-a2-development.test.mjs');
  const makefile = readBytes('Makefile').toString();
  assert(/^provider-a2-check:\s*\n\tpnpm check:provider-a2\s*\n\tpnpm test:provider-a2\s*$/m.test(makefile), 'A2 executable Makefile target missing');
  const workflow = parse(readBytes('.github/workflows/frontend-baseline.yml').toString());
  const unconditional = value => value === undefined || value === true || value === 'true' || value === '${{ true }}';
  assert(Object.values(workflow.jobs).some(job => unconditional(job.if) && job['continue-on-error'] !== true && job.steps.some(step =>
    unconditional(step.if) && step['continue-on-error'] !== true && String(step.run).trim() === 'pnpm check:provider-a2 && pnpm test:provider-a2'
  )), 'A2 mandatory CI command missing or conditional');
}
export function coverage(nodes, readBytes = read) {
  const catalog = parse(readBytes('bff/page-operation-catalog.yaml').toString());
  const api = parse(readBytes('bff/openapi/quantos-bff.v1.yaml').toString());
  const specs = new Map();
  for (const [path, item] of Object.entries(api.paths)) for (const [method, op] of Object.entries(item)) {
    if (op?.operationId) { assert(!specs.has(op.operationId), 'duplicate operationId'); specs.set(op.operationId, {path, method: method.toUpperCase(), op}); }
  }
  const rows = [];
  for (const [contract, expected] of Object.entries(contracts)) {
    const c = catalog.contracts[contract], nodeId = contract === 'C10' ? 'FE:BFF-FE-007' : 'FE:BFF-FE-001';
    assert.equal(c.ownerTask, nodeId.slice(3), 'A2 API owner differs');
    assert.deepEqual(c.publishedOperations, expected, 'A2 published API scope differs');
    assert.deepEqual(c.plannedOperations, [], 'planned API cannot substitute for implementation');
    const manifestPath = 'docs/' + nodes.get(nodeId).stage_gate.evidence[0];
    const manifest = JSON.parse(readBytes(manifestPath));
    const liveCheck = manifest.checks.find(check => check.id === 'live');
    assert(liveCheck, 'A2 child live proof missing');
    const bytes = readBytes(liveCheck.path); assert.equal(digest(bytes), liveCheck.sha256, 'A2 child live proof digest differs');
    const live = JSON.parse(bytes);
    for (const operationId of expected) {
      const spec = specs.get(operationId); assert(spec, 'A2 API absent from OpenAPI: ' + operationId);
      const successes = [...new Set(live.records.filter(record => record.operationId === operationId && /^2[0-9]{2}$/.test(String(record.status)) && spec.op.responses[String(record.status)] && Array.isArray(record.issues) && record.issues.length === 0).map(record => record.status))].sort();
      assert(successes.length, 'A2 successful target coverage missing: ' + operationId);
      rows.push({contract, nodeId, operationId, method: spec.method, path: spec.path, successfulStatuses: successes, targetReceipt: liveCheck.path, targetReceiptSha256: digest(bytes), executionCommit: live.sourceCommit, targetExecution: 'REUSED_CONTENT_BOUND_RECEIPT'});
    }
  }
  assert.equal(rows.length, 26); assert.equal(new Set(rows.map(row => row.operationId)).size, 26);
  return rows;
}
function dependency(id, nodes) {
  return id === 'FE:BFF-FE-001' ? validateA2({nodes}) : id === 'FE:BFF-FE-007' ? validateAudit({nodes}) : validateReceipt(id, {nodes});
}
export function validateManifest(m, {
  nodes = nodesFromPlans(), currentInputs = inputs(), readBytes = read,
  validateDependency = id => dependency(id, nodes), validateIntegration = () => validateWiring(readBytes),
} = {}) {
  const n = nodes.get('PROVIDER:A2');
  assert.equal(m.schema, 'quantos-provider-a2-development/v1'); assert.equal(m.nodeId, n.id);
  assert.equal(m.stage, 'DEVELOPMENT'); assert.equal(m.status, 'PASS'); assert.equal(m.formalAccepted, false);
  assert.deepEqual(m.residuals, []); assert.deepEqual(m.excluded, policy().excluded);
  approved(m.assessmentDirectory);
  assert(/^[a-f0-9]{40}$/.test(m.observedSourceCommit));
  assert(m.environment?.node && m.environment?.pnpm && m.environment?.platform && m.environment.databaseExecuted === false, 'A2 local aggregate environment missing');
  assert.deepEqual(n.dependencies, dependencies, 'A2 dependency obligations differ');
  assert.deepEqual(m.planInput, planInput(n), 'A2 normative plan changed');
  assert.deepEqual(m.inputs, currentInputs, 'A2 functional inputs changed');
  assert.deepEqual(m.dependencies.map(d => d.nodeId), dependencies, 'A2 dependency inventory differs');
  for (const d of m.dependencies) {
    const gate = nodes.get(d.nodeId).stage_gate;
    assert.equal(gate.status, 'READY', 'A2 dependency not READY'); assert.equal(gate.evidence.length, 1);
    assert.equal(d.inputDigest, gate.input_digest, 'A2 dependency digest changed');
    assert.equal(d.manifest, 'docs/' + gate.evidence[0], 'A2 dependency manifest changed');
    assert.equal(digest(readBytes(d.manifest)), d.inputDigest, 'A2 dependency actual bytes changed');
    const result = validateDependency(d.nodeId); assert.equal(result.status, 'READY'); assert.equal(result.formalAccepted, false);
  }
  validateIntegration();
  assert.deepEqual(m.apiCoverage, coverage(nodes, readBytes), 'A2 exact operation coverage differs');
  assert.deepEqual(m.checks.map(c => c.id), Object.keys(checks), 'A2 executed checks missing or extra');
  for (const c of m.checks) {
    assert.deepEqual(c.command, checks[c.id]); assert.equal(c.exitCode, 0); assert.equal(c.status, 'PASS');
    assert(Number.isFinite(Date.parse(c.executedAt)) && Date.parse(c.executedAt) <= Date.now(), 'A2 actual execution timestamp missing');
    assert.equal(c.log, m.assessmentDirectory + '/logs/' + c.id + '.log', 'A2 log outside assessment');
    const bytes = readBytes(c.log); assert.equal(digest(bytes), c.logSha256, 'A2 check log changed');
    const output = bytes.toString();
    assert(c.id === 'negative' ? /^(?:#|ℹ) pass [1-9]\d*\s*$/m.test(output) && /^(?:#|ℹ) fail 0\s*$/m.test(output) : /passed|PASS/.test(output), 'A2 executed assertions missing');
  }
  return {nodeId: n.id, status: 'READY', operations: 26, dependencies: 3, formalAccepted: false};
}
export function check() {
  const nodes = nodesFromPlans(), gate = nodes.get('PROVIDER:A2').stage_gate;
  assert.equal(gate.stage, 'DEVELOPMENT'); assert.equal(gate.status, 'READY', 'A2 current assessment is not READY');
  assert.equal(gate.evidence.length, 1); const path = 'docs/' + gate.evidence[0];
  assert(path.endsWith('/provider-a2.json')); approved(path.slice(0, -'/provider-a2.json'.length));
  const bytes = read(path); assert.equal(digest(bytes), gate.input_digest, 'A2 manifest digest differs');
  const m = JSON.parse(bytes); assert.equal(path, m.assessmentDirectory + '/provider-a2.json');
  return validateManifest(m, {nodes});
}
export function assess(outputDirectory) {
  approved(outputDirectory); assert(!existsSync(resolve(root, outputDirectory)), 'A2 evidence directory already exists');
  const nodes = nodesFromPlans(), n = nodes.get('PROVIDER:A2');
  for (const id of dependencies) dependency(id, nodes);
  validateWiring();
  const before = inputs(), normalizedPlan = planInput(n), executed = [];
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const dependencySnapshot = dependencies.map(nodeId => ({nodeId, inputDigest: nodes.get(nodeId).stage_gate.input_digest, manifest: 'docs/' + nodes.get(nodeId).stage_gate.evidence[0]}));
  mkdirSync(resolve(root, outputDirectory, 'logs'), {recursive: true});
  for (const [id, command] of Object.entries(checks)) {
    const executedAt = new Date().toISOString();
    const run = spawnSync(command[0] === 'node' ? process.execPath : command[0], command.slice(1), {cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024});
    const bytes = Buffer.from((run.stdout ?? '') + (run.stderr ?? '')), log = outputDirectory + '/logs/' + id + '.log';
    writeFileSync(resolve(root, log), bytes);
    executed.push({id, command, executedAt, status: run.status === 0 ? 'PASS' : 'FAIL', exitCode: run.status, log, logSha256: digest(bytes)});
    writeFileSync(resolve(root, outputDirectory, 'execution-results.json'), JSON.stringify(executed, null, 2) + '\n');
    assert.equal(run.status, 0, 'A2 check failed: ' + id); console.log(id, 'PASS');
  }
  assert.deepEqual(inputs(), before, 'A2 inputs changed during evaluation');
  const current = nodesFromPlans(); assert.deepEqual(planInput(current.get(n.id)), normalizedPlan);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), source, 'A2 source commit changed during evaluation');
  const m = {schema: 'quantos-provider-a2-development/v1', nodeId: n.id, stage: 'DEVELOPMENT', status: 'PASS', formalAccepted: false, assessmentDirectory: outputDirectory,
    observedSourceCommit: source,
    environment: {node: process.version, pnpm: execFileSync('pnpm', ['--version'], {encoding: 'utf8'}).trim(), platform: process.platform, databaseExecuted: false},
    planInput: normalizedPlan, inputs: before, dependencies: dependencySnapshot,
    apiCoverage: coverage(current), checks: executed, residuals: [], excluded: policy().excluded};
  validateManifest(m, {nodes: current});
  const path = outputDirectory + '/provider-a2.json', bytes = JSON.stringify(m, null, 2) + '\n';
  writeFileSync(resolve(root, path), bytes);
  n.stage_gate = {stage: 'DEVELOPMENT', status: 'READY', input_digest: digest(bytes), evidence: [path.slice(5)]};
  const plan = 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';
  writeFileSync(resolve(root, plan), publishStages(read(plan).toString(), new Map([[n.id, n]]), 'FE:'));
  return check();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { assert([undefined, '--assess'].includes(process.argv[2])); assert(process.argv.length === (process.argv[2] ? 4 : 2)); console.log(JSON.stringify(process.argv[2] ? assess(process.argv[3]) : check(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
