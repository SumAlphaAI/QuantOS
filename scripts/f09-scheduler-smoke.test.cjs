const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { spawn } = require('node:child_process');
const { runSchedulerSmoke } = require('./f09-scheduler-smoke.cjs');
const { stopOwnedChild } = require('./lib/owned-child-stop.cjs');
function fixture({ readOnly = false, connectError, queryError, cleanupError, stopError, transport = false, ticks = 2, interval = 60, signalCode = null } = {}) {
  let spawned = 0, ended = 0, clock = 0;
  const writes = [], queries = [];
  const client = new EventEmitter();
  client.connect = async () => { if (connectError) throw connectError; };
  client.end = async () => { ended++; };
  client.query = async (sql, args) => {
    queries.push({ sql, args });
    if (sql.includes('current_setting')) return { rows: [{ transaction_read_only: readOnly ? 'on' : 'off', default_transaction_read_only: 'off', in_recovery: false }] };
    if (sql.includes('delete')) { if (cleanupError) throw cleanupError; return {}; }
    if (sql.includes('rule_id') && sql.includes('count')) {
      if (queryError) throw queryError;
      if (transport) client.emit('error', Error('idle transport'));
      return { rows: [{ count: ticks }] };
    }
    if (sql.includes('triggered_at')) return { rows: [{ triggered_at: new Date(0) }, { triggered_at: new Date(interval * 1000) }] };
    return { rows: [{ count: ticks }] };
  };
  const io = { mkdirSync() {}, rmSync() {}, existsSync: () => false,
    writeFileSync: (path, bytes) => writes.push(JSON.parse(bytes)) };
  const run = () => runSchedulerSmoke({ client, io, sourceCommit: 'a'.repeat(40), scope: 'owned-scheduler-scope',
    now: () => clock, pause: async () => { clock += 5; }, deadlineMs: 10, pollMs: 5,
    spawnMonitor: () => { spawned++; const child = new EventEmitter(); child.exitCode = null; child.signalCode = signalCode;
      child.stdout = new EventEmitter(); child.stderr = { on: (event, callback) => callback(Buffer.from('metric coverage is stale or missing')) }; return child; },
    stop: async () => { if (stopError) throw stopError; } });
  return { run, writes, queries, spawned: () => spawned, ended: () => ended };
}
test('read-only preflight never starts a monitor or cleanup write and closes connection', async () => {
  const f = fixture({ readOnly: true });
  await assert.rejects(f.run(), { code: 'TARGET_DATABASE_READ_ONLY' });
  assert.equal(f.spawned(), 0); assert.equal(f.ended(), 1);
  assert(!f.queries.some(q => /delete/i.test(q.sql)));
  assert.equal(f.writes.at(-1).status, 'FAIL'); assert.equal(f.writes.at(-1).cleanup.alerts, 'NOT_NEEDED_NO_MONITOR');
});
test('cleanup DELETE failure cannot publish PASS or leak the client', async () => {
  const f = fixture({ cleanupError: Object.assign(Error('read only'), { code: '25006' }) });
  await assert.rejects(f.run(), { code: 'SCHEDULER_CLEANUP_FAILED' });
  assert.equal(f.ended(), 1); assert(f.writes.every(r => r.status !== 'PASS'));
  assert.deepEqual(f.writes.at(-1).cleanup.failures, [{ phase: 'owned-alerts', code: '25006' }]);
});
test('primary query failure and cleanup failure are both retained before connection close', async () => {
  const f = fixture({ queryError: Object.assign(Error('query'), { code: 'QUERY_FAILED' }), cleanupError: Object.assign(Error('delete'), { code: '25006' }) });
  await assert.rejects(f.run(), { code: 'QUERY_FAILED' });
  assert.equal(f.ended(), 1); assert.equal(f.writes.at(-1).failure.code, 'QUERY_FAILED');
  assert.equal(f.writes.at(-1).cleanup.failures[0].code, '25006');
});
test('initial connection failure still attempts connection shutdown', async () => {
  const f = fixture({ connectError: Object.assign(Error('connect'), { code: 'ECONNRESET' }) });
  await assert.rejects(f.run(), { code: 'ECONNRESET' }); assert.equal(f.ended(), 1); assert.equal(f.spawned(), 0);
});
test('bounded tick deadline fails and closes without needless DELETE when no rows exist', async () => {
  const f = fixture({ ticks: 0 }); await assert.rejects(f.run(), { code: 'SCHEDULER_TICKS_TIMEOUT' });
  assert.equal(f.ended(), 1); assert(!f.queries.some(q => q.sql.startsWith('delete')));
});
test('signal-terminated monitor is detected before any poll', async () => {
  const f = fixture({ signalCode: 'SIGTERM' }); await assert.rejects(f.run(), { code: 'SCHEDULER_EXITED' });
  assert(!f.queries.some(q => q.sql.includes('rule_id'))); assert.equal(f.ended(), 1);
});
test('owned child cleanup failure is retained and cannot skip connection close', async () => {
  const f = fixture({ stopError: Object.assign(Error('stop'), { code: 'CHILD_STOP_TIMEOUT' }) });
  await assert.rejects(f.run(), { code: 'SCHEDULER_CLEANUP_FAILED' }); assert.equal(f.ended(), 1);
  assert.equal(f.writes.at(-1).cleanup.failures[0].code, 'CHILD_STOP_TIMEOUT');
});
test('out-of-query database error is latched and never becomes PASS', async () => {
  const f = fixture({ transport: true }); await assert.rejects(f.run(), { code: 'DATABASE_TRANSPORT_FAILED' }); assert.equal(f.ended(), 1);
});
test('bad tick interval remains an assertion failure after clean shutdown', async () => {
  const f = fixture({ interval: 1 }); await assert.rejects(f.run(), { code: 'SCHEDULER_INTERVAL_INVALID' }); assert.equal(f.ended(), 1);
});
test('successful probe publishes PASS only after owned cleanup and connection close', async () => {
  const f = fixture(); const receipt = await f.run(); assert.equal(receipt.status, 'PASS'); assert.equal(f.ended(), 1);
  assert(f.writes.slice(0, -1).every(r => r.status === 'RUNNING'));
  assert.equal(receipt.cleanup.connectionClosed, true); assert.equal(receipt.cleanup.childStopped, true);
  for (const q of f.queries.filter(q => q.args)) assert.deepEqual(q.args, ['owned-scheduler-scope']);
});
test('already signal-exited owned child does not wait for an event that already happened', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)']);
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
  assert.equal(child.exitCode, null); assert.equal(child.signalCode, 'SIGTERM');
  await stopOwnedChild(child, { graceMs: 10, killMs: 100 });
});
test('owned child ignoring SIGTERM is reaped with bounded SIGKILL', async () => {
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000)"]);
  try { await once(child.stdout, 'data'); await stopOwnedChild(child, { graceMs: 20, killMs: 1000 }); assert.equal(child.signalCode, 'SIGKILL'); }
  finally { if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL'); }
});
test('owned child that never exits fails within its termination deadline', async () => {
  const child = new EventEmitter(); child.exitCode = null; child.signalCode = null; const signals = []; child.kill = s => signals.push(s);
  await assert.rejects(stopOwnedChild(child, { graceMs: 5, killMs: 5 }), { code: 'CHILD_STOP_TIMEOUT' });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']); assert.equal(child.listenerCount('exit'), 0);
});
