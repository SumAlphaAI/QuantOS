// Read-only product preflight. This deliberately does not publish any Gate.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync, cpSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {root, digest, inventory, nodesFromPlans, planInput, policy, closure, validateReceipt, staticEnvironment} from '../../../../scripts/provider-a1-receipts.mjs';
import {selectors as signalInputs} from '../../../../engines/llmquant/check-development.mjs';
import {selectors as proposalInputs, checks as proposalChecks} from '../../../../engines/trading-agents/check-development.mjs';
import {validateSignalMatrix} from '../../../../scripts/tp03-signal-schema.mjs';
import {validateProposalMatrix} from '../../../../scripts/tp04-proposal-schema.mjs';
const require = createRequire(import.meta.url);
const {snapshot} = require('../../../../scripts/lib/test-engine-processes.cjs');
const base = relative(root, import.meta.dirname);
const nodes = nodesFromPlans(), p = policy();
const selected = closure(nodes, 'CORE:R04');
const selectors = [...new Set([...p.commonInputs, ...signalInputs, ...proposalInputs, ...selected.flatMap(id => p.nodes[id]?.inputs ?? []), base + '/preflight.mjs'])];
const read = path => JSON.parse(readFileSync(resolve(root, path)));
const capture = () => ({inputs: inventory(selectors), plans: selected.map(id => ({nodeId: id, planInput: planInput(nodesFromPlans().get(id))}))});
const firstLine = error => error.message.split('\n')[0];
function admission() {
  const current = nodesFromPlans();
  return ['CORE:R03', 'CORE:TP03', 'CORE:TP04', 'CORE-GATE:F0', 'CORE:R04'].map(nodeId => {
    const n = current.get(nodeId);
    // R03 has its dedicated content validator; A1 receipts cannot validate it.
    let receiptValidation;
    if (nodeId === 'CORE:R03') receiptValidation = {status: 'DEDICATED_VALIDATOR_REQUIRED', command: 'make r03-admission-check'};
    else try {receiptValidation = validateReceipt(nodeId);} catch (error) {receiptValidation = {status: 'REJECTED', reason: firstLine(error)};}
    return {nodeId, stageGate: n.stage_gate, dependencies: n.dependencies, receiptValidation};
  });
}
function historical(path, selectors) {
  const old = read(path), now = inventory(selectors), previous = new Map(old.inputs.map(i => [i.path, i.sha256]));
  const current = new Map(now.map(i => [i.path, i.sha256]));
  return {path, sha256: digest(readFileSync(resolve(root, path))), observedSourceCommit: old.observedSourceCommit, historicalStatus: old.status,
    changed: now.filter(i => previous.has(i.path) && previous.get(i.path) !== i.sha256).map(i => i.path),
    added: now.filter(i => !previous.has(i.path)).map(i => i.path), removed: old.inputs.filter(i => !current.has(i.path)).map(i => i.path),
    normativePlanMatches: JSON.stringify(old.planInput) === JSON.stringify(planInput(nodes.get(old.nodeId)))};
}
function matrixChecks(out) {
  const signals = read('artifacts/tp03-development/signal-matrix.json');
  const proposals = read('artifacts/tp04-development/proposal-matrix.json');
  validateSignalMatrix(signals); validateProposalMatrix(proposals);
  let denied = 0;
  for (const [validate, rows, mutations] of [
    [validateSignalMatrix, signals, [s => s.confidence.value = '2', s => s.valid_until = s.generated_at, s => s.diagnostics.value.model_version = '', s => s.diagnostics.value.tools_executed = true]],
    [validateProposalMatrix, proposals, [s => s.executable = true, s => s.evidence_refs = [], s => s.counter_views = [], s => s.expires_at = s.signal.generated_at, s => s.expires_at = '2099-01-01T00:00:00Z', s => s.signal.generated_at = 'invalid']]
  ]) for (const mutate of mutations) {
    const bad = structuredClone(rows); mutate(bad[0].output); assert.throws(() => validate(bad)); denied++;
  }
  for (const [src, dest] of [['tp03-development/signal-matrix.json', 'signal-matrix.json'], ['tp04-development/proposal-matrix.json', 'proposal-matrix.json'], ['tp03-development/ui-cancel.json', 'signal-cancel.json'], ['tp04-development/ui-cancel.json', 'proposal-cancel.json']]) cpSync(resolve(root, 'artifacts', src), resolve(out, dest));
  return {status: 'PASS', freshSignalSamples: signals.length, freshProposalSamples: proposals.length, additionalNegativeProbesRejected: denied,
    scope: 'Existing Ajv/schema and matrix invariants only; Runtime expiry is checked separately; no database or Gate acceptance'};
}
if (process.argv[2] === '--verify') {
  const out = resolve(root, process.argv[3]); assert(out.startsWith(resolve(root, base) + '/'));
  const m = JSON.parse(readFileSync(resolve(out, 'manifest.json')));
  assert.equal(m.schema, 'quantos-r04-preflight/v1'); assert.equal(m.formalAccepted, false); assert.equal(m.databaseExecution, false);
  assert.deepEqual(m.sourceSnapshot, capture()); assert.deepEqual(m.admission, admission());
  for (const file of m.files) assert.equal(digest(readFileSync(resolve(out, file.path))), file.sha256, file.path);
  assert(m.checks.every(c => c.verdict === 'PASS' || c.verdict === 'EXPECTED_REJECTION'));
  for (const c of m.checks) assert.equal(c.exitCode, c.expectedExitCode);
  assert.equal(m.fixturePreflight.status, 'PASS'); assert.equal(m.processCleanup.status, 'PASS');
  validateSignalMatrix(JSON.parse(readFileSync(resolve(out, 'signal-matrix.json'))));
  validateProposalMatrix(JSON.parse(readFileSync(resolve(out, 'proposal-matrix.json'))));
  console.log('R04_PREFLIGHT_EVIDENCE_PASS; feature Gate NOT_ASSESSED; database NOT_RUN');
} else {
  assert.equal(process.argv[2], '--run');
  const out = resolve(root, process.argv[3]); assert(out.startsWith(resolve(root, base) + '/')); assert(!existsSync(out), 'use a new attempt directory');
  mkdirSync(resolve(out, 'logs'), {recursive: true});
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const productGitDiffAtStart = execFileSync('git', ['diff', 'HEAD', '--name-only'], {cwd: root, encoding: 'utf8'}).trim();
  const before = capture(), scope = randomBytes(4).toString('hex');
  const baseline = resolve(out, 'engine-baseline.json');
  writeFileSync(baseline, JSON.stringify({...snapshot(root), scopeTag: scope}, null, 2) + '\n');
  const env = {...staticEnvironment(process.env), QUANTOS_TEST_ENGINE_SCOPE: scope, QUANTOS_R1_ENGINE_BASELINE: baseline};
  for (const key of Object.keys(env)) if (/PASSWORD|TOKEN|SECRET|API_KEY|QUANTOS_TRACE_EXPORT_PATH/.test(key)) delete env[key];
  const specs = [
    ['r03-admission', ['make', 'r03-admission-check'], 0],
    ['tp03-receipt', ['node', 'engines/llmquant/check-development.mjs', '--verify'], 1],
    ['tp04-receipt', ['node', 'engines/trading-agents/check-development.mjs', '--verify'], 1],
    ['f0-receipt', ['node', 'scripts/provider-a1-receipts.mjs', '--f0'], 1],
    ['python', ['engines/.venv/bin/python', '-m', 'pytest', 'engines/tests', '-q'], 0],
    ['runtime', ['cargo', 'test', '--locked', '--offline', '-p', 'quantos-runtime', '--test', 'signal_proposal_orchestration', '--', '--nocapture'], 0],
    ['signal-schema', ['node', 'scripts/tp03-signal-schema.mjs'], 0],
    ['proposal-schema', ['node', 'scripts/tp04-proposal-schema.mjs'], 0],
    ['adapter-negatives', ['node', '--test', 'scripts/tp03-functional-artifacts.test.mjs', 'scripts/tp04-functional-artifacts.test.mjs'], 0],
    ['locks', ['bash', 'scripts/check-lockfiles.sh'], 0],
    ['plans', ['node', 'scripts/check-development-plans.mjs'], 0],
    ['process-cleanup', ['node', 'scripts/r1-process-cleanup.cjs', relative(root, resolve(out, 'process-cleanup.json'))], 0]
  ];
  const checks = [];
  for (const [id, command, expectedExitCode] of specs) {
    const executedAt = new Date().toISOString();
    const r = spawnSync(command[0], command.slice(1), {cwd: root, env, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024});
    const output = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? '\n' + r.error.message : '');
    writeFileSync(resolve(out, 'logs', id + '.log'), output);
    const expectedReason = {'tp03-receipt': 'TP03 functional inputs changed', 'tp04-receipt': 'TP04 functional inputs changed', 'f0-receipt': 'CORE-GATE:F0: dependency is not READY'}[id];
    const verdict = r.status === expectedExitCode && (!expectedReason || output.includes(expectedReason)) ? (expectedExitCode ? 'EXPECTED_REJECTION' : 'PASS') : 'FAIL';
    checks.push({id, command, executedAt, exitCode: r.status, expectedExitCode, verdict});
    writeFileSync(resolve(out, 'execution-results.json'), JSON.stringify(checks, null, 2) + '\n');
    console.log(id + ': ' + verdict + ' (exit ' + r.status + ')');
  }
  const fixturePreflight = matrixChecks(out);
  const pythonLog = readFileSync(resolve(out, 'logs/python.log'), 'utf8');
  const marker = proposalChecks.find(c => c.id === 'python').marker;
  assert.deepEqual(capture(), before, 'product/normative inputs changed during preflight');
  const m = {schema: 'quantos-r04-preflight/v1', observedSourceCommit: source, executedAt: new Date().toISOString(),
    scope: 'R04 interface/fixture preflight and current admission audit only', formalAccepted: false, databaseExecution: false,
    productGitDiffAtStart,
    sourceSnapshot: before, admission: admission(), closure: selected, r04FunctionalPolicyExists: Boolean(p.nodes['CORE:R04']),
    historicalComparisons: [historical('docs/audit/evidence/tp03-20261010/receipt.json', signalInputs), historical('docs/audit/evidence/tp04-20261010/receipt.json', proposalInputs),
      historical('docs/audit/evidence/provider-a1-remediation-20261004/tp09-admission-20261011/attempt-01/core-tp03.json', [...p.commonInputs, ...p.nodes['CORE:TP03'].inputs]),
      historical('docs/audit/evidence/provider-a1-remediation-20261004/tp10-admission-20261011/attempt-01/core-gate-f0.json', [...p.commonInputs, ...p.nodes['CORE-GATE:F0'].inputs])],
    checks, fixturePreflight, processCleanup: read(relative(root, resolve(out, 'process-cleanup.json'))),
    tp04PythonReceiptCompatibility: {actualSummary: pythonLog.match(/\d+ passed[^\n]*/)?.[0], configuredMarker: marker.source, matches: marker.test(pythonLog), status: marker.test(pythonLog) ? 'COMPATIBLE' : 'GAP'},
    files: ['execution-results.json', 'engine-baseline.json', 'process-cleanup.json', 'signal-matrix.json', 'proposal-matrix.json', 'signal-cancel.json', 'proposal-cancel.json', ...checks.map(c => 'logs/' + c.id + '.log')].map(path => ({path, sha256: digest(readFileSync(resolve(out, path)))}))};
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  assert(checks.every(c => c.verdict !== 'FAIL'), 'preflight execution failed; retain this attempt');
  console.log('R04_FIXTURE_PREFLIGHT_PASS; admission gaps remain; no Gate published');
}
