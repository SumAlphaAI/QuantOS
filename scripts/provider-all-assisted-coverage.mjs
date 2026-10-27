import assert from 'node:assert/strict';
import {contract} from './provider-all-contract.mjs';

export const assistedOperations = [
  'getAssistedNativeCapabilities', 'listAssistedSubjects', 'listAssistedRequests',
  'openAssistedRequest', 'getAssistedRequest', 'approveAssistedRequest',
  'submitAssistedRequest', 'getAssistedApprovalAudit',
].sort();
export const assistedScope = 'ACTUAL_OWNED_LOOPBACK_ASSISTED_NOT_EXCHANGE_HTTP';
export function assistedCoverage(child) {
  assert.equal(child.schema, 'quantos-provider-all-assisted-http/v1');
  assert.equal(child.status, 'PASS'); assert.equal(child.failure, null);
  assert.equal(child.scope, assistedScope);
  assert.match(child.sourceCommit, /^[a-f0-9]{40}$/);
  for (const key of ['databaseExecution', 'externalExecution', 'productionCredentialsUsed', 'formalAccepted']) assert.equal(child[key], false);
  assert.deepEqual(child.operations, assistedOperations);
  const rows = contract().filter(r => r.path.startsWith('/v1/assisted-testnet/'));
  assert.deepEqual(rows.map(r => r.operationId).sort(), assistedOperations);
  assert(child.records.length > 0);
  for (const r of child.records) {
    assert.equal(r.responseValidation, 'PASS'); assert.deepEqual(r.issues, []);
    if (r.status >= 200 && r.status < 300) assert.equal(r.requestValidation, 'PASS');
  }
  for (const id of assistedOperations) {
    assert(child.records.some(r => r.operationId === id && r.profile === 'assisted-on' && r.control === 'success' && r.status === 200), 'missing Assisted success ' + id);
    assert(child.records.some(r => r.operationId === id && r.profile === 'assisted-on' && r.control === 'missing-session' && r.status === 401), 'missing Assisted authentication refusal ' + id);
    for (const profile of ['paper-off', 'assisted-off']) {
      const expected = id === 'getAssistedNativeCapabilities' ? 200 : 403;
      assert(child.records.some(r => r.operationId === id && r.profile === profile && r.control === 'default-off' && r.status === expected), 'missing default-off probe ' + id);
    }
    if (id !== 'getAssistedNativeCapabilities') assert(child.records.some(r => r.operationId === id && r.control === 'viewer' && r.status === 403), 'missing Assisted permission refusal ' + id);
  }
  for (const profile of ['paper-off', 'assisted-off']) {
    const c = child.defaultOff[profile];
    for (const k of ['serverFlagEnabled', 'targetEnabled', 'canRequest', 'canApprove', 'executionAuthority']) assert.equal(c[k], false);
  }
  assert(child.records.some(r => r.control === 'self-approval' && r.operationId === 'approveAssistedRequest' && r.status === 403));
  assert(child.records.some(r => r.control === 'csrf' && r.operationId === 'openAssistedRequest' && r.status === 403));
  for (const id of ['openAssistedRequest', 'approveAssistedRequest', 'submitAssistedRequest']) {
    const pair = child.records.filter(r => r.recovery === id);
    assert.equal(pair.length, 2, 'missing original replay pair ' + id);
    assert(pair.every(r => r.operationId === id && r.status === 200 && r.profile === 'assisted-on' && r.control === 'success'));
    for (const k of ['path', 'method', 'bodyDigest', 'idempotencyDigest', 'csrfDigest', 'responseDigest']) {
      assert(pair[0][k]); assert.equal(pair[0][k], pair[1][k], 'original replay changed ' + k);
    }
  }
  const {subject, command, audit, requestId} = child.workflow;
  assert.equal(command.requestId, requestId); assert.equal(command.subjectHash, subject.subjectHash);
  assert.equal(command.state, 'accepted'); assert.equal(command.order.commandId, command.commandId);
  for (const k of ['accountId', 'symbol', 'side', 'quantity']) assert.equal(command.order[k], subject[k]);
  assert.equal(command.order.filledQuantity, '0');
  assert.equal(audit.verified, true); assert.equal(audit.nativeSubmissions, 1); assert.equal(audit.items.length, 2);
  assert.equal(new Set(audit.items.map(a => a.actorId)).size, 2);
  assert.equal(new Set(audit.items.map(a => a.userId)).size, 2);
  for (const a of audit.items) {
    assert.equal(a.requestId, requestId); assert.equal(a.subjectHash, subject.subjectHash);
    assert.notEqual(a.actorId, subject.originator);
  }
  return rows;
}
