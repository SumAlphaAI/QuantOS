import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {nodesFromPlans} from '../../../../scripts/provider-a1-receipts.mjs';

// Run from repository root. Read-only Git/source/receipt inspection.
const output = 'docs/audit/evidence/provider-a2-review-20261007';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path));
const nodes = nodesFromPlans();
const catalog = YAML.parse(readFileSync('bff/page-operation-catalog.yaml', 'utf8'));
const openapi = YAML.parse(readFileSync('bff/openapi/quantos-bff.v1.yaml', 'utf8'));
const operations = new Map();
for (const [path, item] of Object.entries(openapi.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (operation?.operationId) operations.set(operation.operationId, {method: method.toUpperCase(), path, operation});
  }
}
const targetSources = [], apiRows = [], children = [];
for (const task of ['BFF-FE-001', 'BFF-FE-007']) {
  const node = nodes.get('FE:' + task), manifestPath = 'docs/' + node.stage_gate.evidence[0];
  const manifest = json(manifestPath), receiptPath = manifest.checks.find(c => c.id === 'live').path;
  const receipt = json(receiptPath);
  for (const [path, expected] of Object.entries(receipt.sourceHashes)) {
    const current = hash(readFileSync(path));
    const committed = hash(execFileSync('git', ['show', receipt.sourceCommit + ':' + path]));
    assert.equal(current, expected, 'current source differs: ' + path);
    assert.equal(committed, expected, 'executed commit differs: ' + path);
    targetSources.push({task, path, executionCommit: receipt.sourceCommit, expectedSha256: expected, currentSha256: current, committedSha256: committed, result: 'PASS'});
  }
  children.push({nodeId: node.id, stageGate: node.stage_gate, manifest: manifestPath, manifestSha256: hash(readFileSync(manifestPath)), liveReceipt: receiptPath, liveReceiptSha256: hash(readFileSync(receiptPath)), executionCommit: receipt.sourceCommit, calls: receipt.records.length, assertions: receipt.assertions.length, cleanupVerified: receipt.cleanupVerified, formalAccepted: false});
  for (const [contract, c] of Object.entries(catalog.contracts).filter(([, c]) => c.ownerTask === task)) {
    assert.equal(c.plannedOperations.length, 0);
    for (const operationId of c.publishedOperations) {
      const spec = operations.get(operationId);
      assert(spec, operationId + ' is absent from OpenAPI');
      const records = receipt.records.filter(r => r.operationId === operationId);
      const successfulStatuses = [...new Set(records.filter(r => r.status >= 200 && r.status < 300).map(r => r.status))].sort();
      assert(successfulStatuses.length > 0, operationId + ' lacks actual successful target evidence');
      assert(records.every(r => !r.issues?.length));
      for (const status of successfulStatuses) assert(spec.operation.responses[String(status)], operationId + ' target status outside contract');
      apiRows.push({contract, task, operationId, method: spec.method, path: spec.path, sse: operationId === 'subscribeSessionRevocations', successfulStatuses, observedStatuses: [...new Set(records.map(r => r.status))].sort(), calls: records.length, liveReceipt: receiptPath, result: 'PASS'});
    }
  }
}
assert.equal(apiRows.length, 26);
assert.equal(new Set(apiRows.map(r => r.operationId)).size, 26);
const write = (name, value) => writeFileSync(output + '/' + name, JSON.stringify(value, null, 2) + '\n');
write('api-matrix.json', {scope: 'A2 C01/C17/C10; actual prior target successes, independently rechecked; not newly executed target tests', published: 26, planned: 0, successful: 26, rows: apiRows});
write('source-inventory.json', {baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), children, targetSources, targetSourceChecks: targetSources.length, uniqueTargetFiles: new Set(targetSources.map(r => r.path)).size, directDependencies: ['FE:BFF-FE-001', 'FE:BFF-FE-007', 'PROVIDER:A1'].map(id => ({nodeId: id, stageGate: nodes.get(id).stage_gate})), checkpoint: nodes.get('PROVIDER:A2').stage_gate});
console.log(JSON.stringify({apis: apiRows.length, matchedTargetSourceChecks: targetSources.length, uniqueFiles: new Set(targetSources.map(r => r.path)).size}));
