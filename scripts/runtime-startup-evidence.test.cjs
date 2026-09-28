const { test } = require('node:test');
const assert = require('node:assert/strict');
const extract = require('./lib/runtime-startup-evidence.cjs');
test('startup receipt strips raw errors, unknown phases and credentials', () => {
  const event = { service: 'runtime-gateway', event: 'startup_phase', phase: 'worker_store',
    status: 'retry_transport', attempt: 1, elapsed_ms: 200, secret: 'must-not-export' };
  const input = ['not json: must-not-export', JSON.stringify(event),
    JSON.stringify({ ...event, phase: 'must-not-export' }), JSON.stringify({ ...event, attempt: 9 })].join('\n');
  assert.deepEqual(extract(input), [{phase:'worker_store',status:'retry_transport',attempt:1,elapsedMs:200}]);
});
const { EventEmitter } = require('node:events');
const observeClientErrors = require('./lib/target-client-errors.cjs');
test('idle pg failure is latched and cannot be reported as success', () => {
  const client=new EventEmitter(); let status='RUNNING';
  const healthy=observeClientErrors(client,()=>{status='FAIL';});
  healthy(); client.emit('error',Error('private connection details'));
  assert.equal(status,'FAIL');
  assert.throws(healthy,/Target database connection failed outside a query/);
});
