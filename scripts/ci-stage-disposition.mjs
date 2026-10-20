import {check as checkProviderAll} from './provider-all-development.mjs';
import {check as checkBff011} from './bff-fe-011-development.mjs';
import {check as checkProviderA6} from './provider-a6-development.mjs';
import assert from 'node:assert/strict';
import {check as checkBff002} from './bff-fe-002-development.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parse} from 'yaml';
import {nodesFromPlans, validateReceipt} from './provider-a1-receipts.mjs';
import {check as checkFep0} from './fep0-development.mjs';
import {check as checkG0} from './g0-development.mjs';
import {validateA2} from './bff-fe-001-development.mjs';
import {validateAudit} from './bff-fe-007-development.mjs';
import {check as checkProviderA2} from './provider-a2-development.mjs';
import {check as checkBff010} from './bff-fe-010-development.mjs';
import {check as checkBff008} from './bff-fe-008-development.mjs';
import {check as checkBff009} from './bff-fe-009-development.mjs';
import {check as checkProviderA5} from './provider-a5-development.mjs';
import {check as checkProviderA4} from './provider-a4-development.mjs';
import {check as checkBff004} from './bff-fe-004-development.mjs';
import {check as checkBff006} from './bff-fe-006-development.mjs';
import {check as checkProviderA3} from './provider-a3-development.mjs';
import {check as checkBff005} from './bff-fe-005-development.mjs';
import {check as checkBff003} from './bff-fe-003-development.mjs';

const validators = {
  'PROVIDER:ALL': requireReady => checkProviderAll({requireReady}),
  'PROVIDER:A6': () => checkProviderA6(),
  'FE:BFF-FE-011': () => checkBff011(),
  'FE:BFF-FE-002': () => checkBff002(),
  'PROVIDER:A1': () => {if(nodesFromPlans().get('PROVIDER:A1').stage_gate.evidence[0]?.startsWith('audit/evidence/a1-local-')){const r=JSON.parse(execFileSync(process.execPath,[resolve(import.meta.dirname,'a1-functional-gate.mjs'),'--provider-ready'],{encoding:'utf8'}));assert.equal(r.stageGate,'READY');return {status:'READY',engineeringStatus:'PASS'};}validateReceipt('PROVIDER:A1'); return {status: 'READY'};},
  'CORE-GATE:F0': () => {validateReceipt('CORE-GATE:F0'); return {status: 'READY'};},
  'FE:FEP-0': requireReady => checkFep0({requireReady}),
  'FRONTEND-GATE:G0': requireReady => checkG0({requireReady}),
  'FE:BFF-FE-001': () => validateA2(),
  'FE:BFF-FE-007': () => validateAudit(),
  'PROVIDER:A2': () => checkProviderA2(),
  'PROVIDER:A3': () => checkProviderA3(),
  'PROVIDER:A4': () => checkProviderA4(),
  'PROVIDER:A5': () => checkProviderA5(),
  'FE:BFF-FE-010': () => checkBff010(),
  'FE:BFF-FE-008': () => checkBff008(),
  'FE:BFF-FE-009': () => checkBff009(),
  'FE:BFF-FE-006': () => checkBff006(),
  'FE:BFF-FE-004': () => checkBff004(),
  'FE:BFF-FE-003': () => checkBff003(),
  'FE:BFF-FE-005': () => checkBff005(),
};

const ciAliases = {
  'provider-all':'PROVIDER:ALL',
  'provider-a6':'PROVIDER:A6',
  'bff-fe-011':'FE:BFF-FE-011',
  'bff-fe-002':'FE:BFF-FE-002',
  'provider-a5':'PROVIDER:A5', 'bff-fe-010':'FE:BFF-FE-010', 'bff-fe-008':'FE:BFF-FE-008', 'bff-fe-009':'FE:BFF-FE-009', 'provider-a1': 'PROVIDER:A1', 'f0-development': 'CORE-GATE:F0',
  fep0: 'FE:FEP-0', g0: 'FRONTEND-GATE:G0',
  'bff-fe-001': 'FE:BFF-FE-001', 'bff-fe-007': 'FE:BFF-FE-007', 'provider-a2': 'PROVIDER:A2', 'provider-a4':'PROVIDER:A4', 'provider-a3': 'PROVIDER:A3', 'bff-fe-004':'FE:BFF-FE-004', 'bff-fe-006':'FE:BFF-FE-006', 'bff-fe-003': 'FE:BFF-FE-003', 'bff-fe-005': 'FE:BFF-FE-005',
};
export function validateCiWiring(read = path => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8')) {
  const pkg = JSON.parse(read('package.json'));
  const workflow = parse(read('.github/workflows/frontend-baseline.yml'));
  const job = workflow.jobs['frontend-baseline'];
  const unconditional = item => item.if === undefined && item['continue-on-error'] === undefined;
  assert(unconditional(job), 'component CI job must be mandatory');
  for (const [alias, id] of Object.entries(ciAliases)) {
    const command = `check:${alias}:ci`;
    assert.equal(pkg.scripts[command], `node scripts/ci-stage-disposition.mjs ${id}`);
    assert(job.steps.some(step => unconditional(step) && String(step.run).split(/\s*&&\s*/).includes(`pnpm ${command}`)), `${command}: mandatory CI step missing`);
  }
  assert.equal(pkg.scripts['test:ci-stage-disposition'], 'node --test scripts/ci-stage-disposition.test.mjs');
  assert(job.steps.some(step => unconditional(step) && String(step.run).split(/\s*&&\s*/).includes('pnpm test:ci-stage-disposition')), 'CI disposition rejection probes missing');
  const strict = {
    'check:provider-all':'node scripts/provider-all-development.mjs --ready',
    'check:provider-a6':'node scripts/provider-a6-development.mjs --ready',
    'check:bff-fe-011':'node scripts/bff-fe-011-development.mjs --ready',
    'check:bff-fe-002':'node scripts/bff-fe-002-development.mjs --ready',
    'check:provider-a1': 'node scripts/provider-a1-receipts.mjs',
    'check:f0-development': 'node scripts/provider-a1-receipts.mjs --f0',
    'check:fep0': 'node scripts/fep0-development.mjs --ready',
    'check:g0-development': 'node scripts/g0-development.mjs --ready',
    'check:bff-fe-001:development': 'node scripts/bff-fe-001-development.mjs',
    'check:bff-fe-007:development': 'node scripts/bff-fe-007-development.mjs',
    'check:provider-a2': 'node scripts/provider-a2-development.mjs',
    'check:bff-fe-010':'node scripts/bff-fe-010-development.mjs --ready',
    'check:bff-fe-008':'node scripts/bff-fe-008-development.mjs --ready',
    'check:bff-fe-009':'node scripts/bff-fe-009-development.mjs --ready',
    'check:provider-a4':'node scripts/provider-a4-development.mjs --ready',
    'check:provider-a5':'node scripts/provider-a5-development.mjs --ready',
    'check:provider-a3': 'node scripts/provider-a3-development.mjs',
    'check:bff-fe-004': 'node scripts/bff-fe-004-development.mjs --ready',
    'check:bff-fe-006': 'node scripts/bff-fe-006-development.mjs --ready',
    'check:bff-fe-003': 'node scripts/bff-fe-003-development.mjs',
  };
  for (const [key, value] of Object.entries(strict)) assert.equal(pkg.scripts[key], value, `${key}: strict admission command changed`);
  const target = read('Makefile').match(/^bff-contract-check:\n((?:\t.*\n)+)/m)?.[1];
  assert(target?.includes('\tpnpm check:bff-fe-007:ci\n'), 'main CI disposition missing');
  assert(target.includes('\tpnpm test:ci-stage-disposition\n'), 'main CI disposition rejection probes missing');
}

// Component CI validates the declared disposition. Stage admission remains a
// separate strict command, with its current receipts and dependency checks.
export function checkDisposition(id, {nodes = nodesFromPlans(), validate = validators[id]} = {}) {
  assert(Object.hasOwn(validators, id), `unsupported CI stage ${id}`);
  assert.equal(typeof validate, 'function', 'strict stage validator missing');
  const node = nodes.get(id);
  assert(node, `missing plan node ${id}`);
  const gate = node.stage_gate;
  assert.equal(gate?.stage, 'DEVELOPMENT', `${id}: unexpected stage`);
  assert(Array.isArray(gate.evidence), `${id}: evidence must be an array`);
  for (const dependency of node.dependencies) assert(nodes.has(dependency), `unknown dependency ${dependency}`);
  let assessmentExecuted = false;
  if (gate.status === 'NOT_ASSESSED') {
    assert.equal(gate.input_digest, null, `${id}: unassessed digest must be null`);
    assert.deepEqual(gate.evidence, [], `${id}: unassessed evidence must be empty`);
  } else {
    assert(['READY', 'BLOCKED'].includes(gate.status), `${id}: unsupported disposition`);
    if (gate.status === 'BLOCKED') {
      assert(['FE:FEP-0', 'FRONTEND-GATE:G0', 'PROVIDER:ALL'].includes(id), `${id}: BLOCKED engineering mode unsupported`);
    }
    assert(/^sha256:[a-f0-9]{64}$/.test(gate.input_digest), `${id}: current receipt digest required`);
    assert.equal(gate.evidence.length, 1, `${id}: one current receipt required`);
    const result = validate(gate.status === 'READY');
    assert.equal(result.status, gate.status, `${id}: strict receipt disposition differs`);
    if (gate.status === 'BLOCKED') assert.equal(result.engineeringStatus, 'PASS');
    assessmentExecuted = true;
  }
  return {
    schema: 'quantos-ci-stage-disposition/v1', nodeId: id,
    scope: 'component-ci-stage-record-validation', recordValidation: 'PASS',
    stage: gate.stage, status: gate.status, assessmentExecuted,
    admitted: gate.status === 'READY', formalAccepted: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 3, 'one explicit stage node required');
    validateCiWiring();
    console.log(JSON.stringify(checkDisposition(process.argv[2]), null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
