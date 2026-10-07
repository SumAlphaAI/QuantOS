import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parse, stringify} from 'yaml';
import {validateManifest, validateWiring, contracts, dependencies, checks, directory, policy} from './provider-a2-development.mjs';
import {successStatuses} from './bff-fe-001-development.mjs';
import {root, digest, nodesFromPlans, planInput} from './provider-a1-receipts.mjs';

function fixture() {
  const nodes = nodesFromPlans(), files = new Map(), visited = [], currentInputs = [{path: 'fixture', sha256: digest('source')}];
  const put = (path, value) => { const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)); files.set(path, bytes); return digest(bytes); };
  const statuses = successStatuses();
  for (const nodeId of dependencies) {
    const path = directory + '/unit/' + nodeId.replace(':', '-') + '.json';
    let manifest = {nodeId};
    if (nodeId !== 'PROVIDER:A1') {
      const ops = Object.entries(contracts).filter(([contract]) => (contract === 'C10') === (nodeId === 'FE:BFF-FE-007')).flatMap(([, ops]) => ops);
      const livePath = path + '.live';
      const liveDigest = put(livePath, {sourceCommit: 'a'.repeat(40), records: ops.map(operationId => ({operationId, status: statuses.get(operationId)?.[0] ?? (['createExport', 'cancelExport'].includes(operationId) ? 202 : 200), issues: []}))});
      manifest = {nodeId, checks: [{id: 'live', path: livePath, sha256: liveDigest}]};
    }
    nodes.get(nodeId).stage_gate = {stage: 'DEVELOPMENT', status: 'READY', input_digest: put(path, manifest), evidence: [path.slice(5)]};
  }
  const assessmentDirectory = directory + '/unit', readBytes = path => files.get(path) ?? readFileSync(resolve(root, path));
  const catalog = parse(readBytes('bff/page-operation-catalog.yaml').toString()), api = parse(readBytes('bff/openapi/quantos-bff.v1.yaml').toString());
  const spec = new Map();
  for (const [path, item] of Object.entries(api.paths)) for (const [method, op] of Object.entries(item)) if (op?.operationId) spec.set(op.operationId, {method: method.toUpperCase(), path});
  const apiCoverage = Object.entries(contracts).flatMap(([contract, ops]) => {
    const nodeId = contract === 'C10' ? 'FE:BFF-FE-007' : 'FE:BFF-FE-001', manifest = JSON.parse(readBytes('docs/' + nodes.get(nodeId).stage_gate.evidence[0])), liveCheck = manifest.checks[0], live = JSON.parse(readBytes(liveCheck.path));
    return ops.map(operationId => ({contract, nodeId, operationId, ...spec.get(operationId), successfulStatuses: [live.records.find(r => r.operationId === operationId).status], targetReceipt: liveCheck.path, targetReceiptSha256: liveCheck.sha256, executionCommit: live.sourceCommit, targetExecution: 'REUSED_CONTENT_BOUND_RECEIPT'}));
  });
  const m = {schema: 'quantos-provider-a2-development/v1', nodeId: 'PROVIDER:A2', stage: 'DEVELOPMENT', status: 'PASS', formalAccepted: false, observedSourceCommit: 'c'.repeat(40), assessmentDirectory, environment: {node: '24', pnpm: '10', platform: 'unit', databaseExecuted: false}, planInput: planInput(nodes.get('PROVIDER:A2')), inputs: currentInputs,
    dependencies: dependencies.map(nodeId => ({nodeId, inputDigest: nodes.get(nodeId).stage_gate.input_digest, manifest: 'docs/' + nodes.get(nodeId).stage_gate.evidence[0]})), apiCoverage,
    checks: Object.entries(checks).map(([id, command]) => { const log = assessmentDirectory + '/logs/' + id + '.log'; return {id, command, executedAt: '2026-01-01T00:00:00Z', status: 'PASS', exitCode: 0, log, logSha256: put(log, id === 'negative' ? '# pass 25\n# fail 0\n' : 'PASS passed')}; }), residuals: [], excluded: policy().excluded};
  return {m, files, put, nodes, visited, options: {nodes, currentInputs, readBytes, validateDependency: id => {visited.push(id); return {nodeId: id, status: 'READY', formalAccepted: false};}},
    changeLive(nodeId, mutate) {const d = m.dependencies.find(d => d.nodeId === nodeId), manifest = JSON.parse(readBytes(d.manifest)), check = manifest.checks[0], live = JSON.parse(readBytes(check.path)); mutate(live); check.sha256 = put(check.path, live); d.inputDigest = put(d.manifest, manifest); nodes.get(nodeId).stage_gate.input_digest = d.inputDigest;},
    changeCatalog(mutate) {mutate(catalog); put('bff/page-operation-catalog.yaml', stringify(catalog));},
    changeWorkflow(mutate) {const p = '.github/workflows/frontend-baseline.yml', workflow = parse(readBytes(p).toString()); mutate(workflow); put(p, stringify(workflow));}};
}
test('A2 admits all 26 APIs only after three strict dependency validations', () => {const f = fixture(); assert.equal(validateManifest(f.m, f.options).operations, 26); assert.deepEqual(f.visited, dependencies);});
for (const [name, mutate] of [
  ['A1 manifest impersonates A2', f => f.m.schema = 'quantos-stage-functional-manifest/v1'],
  ['child manifest impersonates A2', f => f.m.nodeId = 'FE:BFF-FE-001'],
  ['formal acceptance is falsely inherited', f => f.m.formalAccepted = true],
  ['own failure', f => f.m.status = 'FAIL'],
  ['residual issue', f => f.m.residuals.push('H-01')],
  ['unsafe evidence directory', f => f.m.assessmentDirectory = directory + '/../other'],
  ['missing dependency', f => f.m.dependencies.pop()],
  ['dependency not READY', f => f.nodes.get(dependencies[0]).stage_gate.status = 'NOT_ASSESSED'],
  ['dependency digest changed', f => f.nodes.get(dependencies[0]).stage_gate.input_digest = digest('different')],
  ['dependency bytes substituted', f => f.files.set(f.m.dependencies[0].manifest, Buffer.from('{}'))],
  ['recursive semantic failure', f => f.options.validateDependency = () => {throw Error('child gate failed');}],
  ['normative input changed', f => f.options.currentInputs = []],
  ['normative plan changed', f => f.m.planInput.required_scope = 'comments only'],
  ['missing API coverage', f => f.m.apiCoverage.pop()],
  ['duplicated API coverage', f => f.m.apiCoverage[0] = f.m.apiCoverage[1]],
  ['target receipt substituted', f => f.m.apiCoverage[0].targetReceipt = 'historical.md'],
  ['failed target API', f => f.changeLive(dependencies[0], r => r.records[0].status = 500)],
  ['all target operations denied', f => f.changeLive(dependencies[0], r => r.records.forEach(c => c.status = 401))],
  ['planned API counted as implementation', f => f.changeCatalog(c => {c.contracts.C01.plannedOperations.push(c.contracts.C01.publishedOperations.pop());})],
  ['catalog scope omitted', f => f.changeCatalog(c => c.contracts.C10.publishedOperations.pop())],
  ['wrong API owner', f => f.changeCatalog(c => c.contracts.C10.ownerTask = 'BFF-FE-003')],
  ['executed check absent', f => f.m.checks.pop()],
  ['failed execution', f => f.m.checks[0].exitCode = 1],
  ['log substituted', f => f.files.set(f.m.checks[0].log, Buffer.from('fake'))],
  ['negative tests not executed', f => f.m.checks[1].logSha256 = f.put(f.m.checks[1].log, '# pass 0\n# fail 0\n')],
  ['negative tests failed', f => f.m.checks[1].logSha256 = f.put(f.m.checks[1].log, '# pass 25\n# fail 1\n')],
  ['mandatory CI removed', f => f.changeWorkflow(w => {w.jobs['frontend-baseline'].steps = w.jobs['frontend-baseline'].steps.filter(s => s.run !== 'pnpm check:provider-a2:ci && pnpm test:provider-a2');})],
  ['mandatory CI disabled', f => f.changeWorkflow(w => {w.jobs['frontend-baseline'].steps.find(s => s.run === 'pnpm check:provider-a2:ci && pnpm test:provider-a2')['continue-on-error'] = true;})],
  ['mandatory CI conditional', f => f.changeWorkflow(w => {w.jobs['frontend-baseline'].steps.find(s => s.run === 'pnpm check:provider-a2:ci && pnpm test:provider-a2').if = 'false';})],
]) test(name + ' is rejected', () => {const f = fixture(); mutate(f); assert.throws(() => validateManifest(f.m, f.options));});
test('current Makefile/package retain strict admission and CI validates its disposition', () => validateWiring());
