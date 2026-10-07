import assert from 'node:assert/strict';
import test from 'node:test';
import {checkDisposition, validateCiWiring} from './ci-stage-disposition.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parse, stringify} from 'yaml';

function fixture(id = 'PROVIDER:A1', status = 'NOT_ASSESSED') {
  const node = {dependencies: [], stage_gate: {stage: 'DEVELOPMENT', status,
    input_digest: status === 'NOT_ASSESSED' ? null : 'sha256:' + 'a'.repeat(64),
    evidence: status === 'NOT_ASSESSED' ? [] : ['audit/current.json']}};
  return {id, node, options: {nodes: new Map([[id, node]]), validate: () => {throw new Error('strict receipt invalid');}}};
}

test('pending metadata never admits or executes a stage assessment', () => {
  const f = fixture();
  const result = checkDisposition(f.id, f.options);
  assert.equal(result.status, 'NOT_ASSESSED');
  assert.equal(result.admitted, false);
  assert.equal(result.assessmentExecuted, false);
  assert.equal(result.formalAccepted, false);
});
for (const [name, mutate] of [
  ['pending digest', f => {f.node.stage_gate.input_digest = 'sha256:' + 'a'.repeat(64);}],
  ['pending evidence', f => {f.node.stage_gate.evidence = ['audit/old.json'];}],
  ['wrong stage', f => {f.node.stage_gate.stage = 'RELEASE';}],
  ['missing evidence array', f => {delete f.node.stage_gate.evidence;}],
  ['unknown status', f => {f.node.stage_gate.status = 'PASS';}],
  ['unknown dependency', f => {f.node.dependencies = ['unknown'];}],
  ['unsupported blocked node', f => {f.node.stage_gate.status = 'BLOCKED';}],
]) test(`reject ${name}`, () => {const f = fixture(); mutate(f); assert.throws(() => checkDisposition(f.id, f.options));});
test('READY propagates receipt failures without falling back to pending', () => {
  const f = fixture('PROVIDER:A1', 'READY');
  assert.throws(() => checkDisposition(f.id, f.options), /strict receipt invalid/);
});
test('READY requires exact validated receipt status and invokes strict admission', () => {
  const f = fixture('FE:BFF-FE-007', 'READY'); let invoked = false;
  f.options.validate = requireReady => {assert.equal(requireReady, true); invoked = true; return {status: 'READY'};};
  assert.equal(checkDisposition(f.id, f.options).admitted, true); assert(invoked);
  f.options.validate = () => ({status: 'BLOCKED'});
  assert.throws(() => checkDisposition(f.id, f.options), /disposition differs/);
});
test('BLOCKED requires a valid engineering receipt and grants no admission', () => {
  const f = fixture('FRONTEND-GATE:G0', 'BLOCKED');
  assert.throws(() => checkDisposition(f.id, f.options), /strict receipt invalid/);
  f.options.validate = requireReady => {assert.equal(requireReady, false); return {status: 'BLOCKED', engineeringStatus: 'PASS'};};
  assert.equal(checkDisposition(f.id, f.options).admitted, false);
  f.options.validate = () => ({status: 'BLOCKED', engineeringStatus: 'FAIL'});
  assert.throws(() => checkDisposition(f.id, f.options));
});
test('READY requires current receipt metadata before invoking its strict validator', () => {
  const f = fixture('PROVIDER:A2', 'READY');
  f.options.validate = () => ({status: 'READY'});
  f.node.stage_gate.input_digest = null; assert.throws(() => checkDisposition(f.id, f.options));
  f.node.stage_gate.input_digest = 'sha256:' + 'a'.repeat(64); f.node.stage_gate.evidence = [];
  assert.throws(() => checkDisposition(f.id, f.options));
});
test('unsupported nodes cannot become CI stage gates', () => {
  assert.throws(() => checkDisposition('CORE:UNKNOWN', {nodes: new Map()}), /unsupported CI stage/);
});
test('reading current plan dispositions does not alter lifecycle or evidence', () => {
  const original = nodesFromPlans(), before = JSON.stringify([...original]);
  const nodes = structuredClone(original);
  for (const id of ['PROVIDER:A1', 'CORE-GATE:F0', 'FE:FEP-0', 'FRONTEND-GATE:G0', 'FE:BFF-FE-001', 'FE:BFF-FE-007', 'PROVIDER:A2']) {
    nodes.get(id).stage_gate = {stage: 'DEVELOPMENT', status: 'NOT_ASSESSED', input_digest: null, evidence: []};
    const result = checkDisposition(id, {nodes});
    assert.equal(result.status, 'NOT_ASSESSED'); assert.equal(result.admitted, false);
  }
  assert.equal(JSON.stringify([...original]), before);
});
test('current component CI wiring preserves strict admission commands', () => validateCiWiring());
for (const [name, mutate] of [
  ['conditional job', w => {w.jobs['frontend-baseline'].if = 'false';}],
  ['ignored job', w => {w.jobs['frontend-baseline']['continue-on-error'] = true;}],
  ['missing disposition', w => {w.jobs['frontend-baseline'].steps = w.jobs['frontend-baseline'].steps.filter(s => !String(s.run).includes('check:fep0:ci'));}],
  ['conditional disposition', w => {w.jobs['frontend-baseline'].steps.find(s => String(s.run).includes('check:g0:ci')).if = 'false';}],
  ['ignored disposition', w => {w.jobs['frontend-baseline'].steps.find(s => String(s.run).includes('check:provider-a1:ci'))['continue-on-error'] = true;}],
  ['missing negative tests', w => {for (const s of w.jobs['frontend-baseline'].steps) if (s.run) s.run = s.run.replace(' && pnpm test:ci-stage-disposition', '');}],
]) test(`CI wiring rejects ${name}`, () => {
  const read = path => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
  const workflow = parse(read('.github/workflows/frontend-baseline.yml')); mutate(workflow);
  assert.throws(() => validateCiWiring(path => path.endsWith('.yml') ? stringify(workflow) : read(path)));
});
test('CI wiring rejects replacement of strict admission by the CI disposition command', () => {
  const read = path => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
  const pkg = JSON.parse(read('package.json')); pkg.scripts['check:provider-a1'] = pkg.scripts['check:provider-a1:ci'];
  assert.throws(() => validateCiWiring(path => path === 'package.json' ? JSON.stringify(pkg) : read(path)));
});
