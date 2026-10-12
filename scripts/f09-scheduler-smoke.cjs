#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { inspectTargetWritability, requireWritableTarget } = require('./lib/target-database-writability.cjs');
const { stopOwnedChild } = require('./lib/owned-child-stop.cjs');
const { operatorUrl } = require('./lib/r02-chain-connection.cjs');
const { client: databaseClient } = require('./lib/r01-db.cjs');
const root = path.resolve(__dirname, '..');

async function runSchedulerSmoke({ client, spawnMonitor, sourceCommit, scope,
  output = path.join(root, 'artifacts/f09/scheduler-sentinel.json'),
  receiptPath = path.join(root, 'artifacts/f09/scheduler.json'),
  io = fs, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  stop = stopOwnedChild, deadlineMs = 195000, pollMs = 5000 } = {}) {
  const receipt = { schema: 'quantos-f09-scheduler-smoke/v1', sourceCommit, scope,
    targetClass: 'test-supabase-postgresql', status: 'RUNNING', formalAccepted: false,
    observedMissingCoverageTicks: 0, startedAt: new Date().toISOString(), phase: 'database-connect',
    cleanup: { failures: [], childStopped: false, connectionClosed: false } };
  const save = () => io.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  let child, connected = false, primary;
  let logs = '', transportFailure;
  const onError = () => { transportFailure = Object.assign(Error('scheduler database transport failed'), { code: 'DATABASE_TRANSPORT_FAILED' }); };
  client.on('error', onError);
  io.mkdirSync(path.dirname(output), { recursive: true });
  io.mkdirSync(path.dirname(receiptPath), { recursive: true });
  io.rmSync(output, { force: true });
  save();
  try {
    await client.connect(); connected = true;
    receipt.phase = 'database-writability';
    receipt.databaseWritability = await inspectTargetWritability(client); save();
    requireWritableTarget(receipt.databaseWritability);
    receipt.phase = 'scheduler-ticks';
    child = spawnMonitor();
    child.on('error', () => { primary ||= Object.assign(Error('scheduler failed to spawn'), { code: 'SCHEDULER_SPAWN_FAILED' }); });
    const collect = chunk => { logs = (logs + chunk.toString()).slice(-6000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const deadline = now() + deadlineMs;
    while (now() < deadline) {
      if (primary) throw primary;
      if (transportFailure) throw transportFailure;
      if (child.exitCode != null || child.signalCode != null) throw Object.assign(Error('scheduler stopped before two ticks'), { code: 'SCHEDULER_EXITED' });
      const rows = await client.query(`select count(*)::int as count from quantos.capacity_alerts
        where scope = $1 and rule_id = 'metric_coverage_missing'`, [scope]);
      receipt.observedMissingCoverageTicks = rows.rows[0].count;
      if (receipt.observedMissingCoverageTicks >= 2) break;
      await pause(pollMs);
    }
    if (receipt.observedMissingCoverageTicks < 2) throw Object.assign(Error('scheduler did not produce two missing-coverage ticks'), { code: 'SCHEDULER_TICKS_TIMEOUT' });
    const tickRows = (await client.query(`select triggered_at from quantos.capacity_alerts
      where scope = $1 and rule_id = 'metric_coverage_missing' order by triggered_at asc limit 2`, [scope])).rows;
    receipt.intervalSeconds = (tickRows[1].triggered_at - tickRows[0].triggered_at) / 1000;
    if (receipt.intervalSeconds < 45 || receipt.intervalSeconds > 90 || !Number.isFinite(receipt.intervalSeconds)) throw Object.assign(Error('scheduled ticks must be 45-90s apart'), { code: 'SCHEDULER_INTERVAL_INVALID' });
    if (io.existsSync(output)) throw Object.assign(Error('stale ADR evidence survived missing metrics'), { code: 'STALE_ADR_EVIDENCE' });
    if (!logs.includes('metric coverage is stale or missing')) throw Object.assign(Error('scheduler did not report the missing producer'), { code: 'MISSING_COVERAGE_DIAGNOSTIC' });
    receipt.staleAdrEvidence = false;
  } catch (error) { primary = error; receipt.failure = { phase: receipt.phase, code: error.code || 'SCHEDULER_FAILED' }; }
  finally {
    receipt.phase = 'owned-cleanup';
    try { await stop(child); receipt.cleanup.childStopped = true; }
    catch (error) { receipt.cleanup.failures.push({ phase: 'stop-child', code: error.code || 'CHILD_STOP_FAILED' }); }
    try {
      // No write or child was started on read-only preflight failure.
      if (connected && child) {
        const count = (await client.query('select count(*)::int as count from quantos.capacity_alerts where scope = $1', [scope])).rows[0].count;
        if (count > 0) await client.query('delete from quantos.capacity_alerts where scope = $1', [scope]);
        receipt.cleanup.alerts = count > 0 ? 'OWNED_ROWS_DELETED' : 'NO_OWNED_ROWS';
      } else receipt.cleanup.alerts = 'NOT_NEEDED_NO_MONITOR';
    } catch (error) { receipt.cleanup.failures.push({ phase: 'owned-alerts', code: error.code || 'ALERT_CLEANUP_FAILED' }); }
    finally {
      try { await client.end(); receipt.cleanup.connectionClosed = true; }
      catch (error) { receipt.cleanup.failures.push({ phase: 'close-connection', code: error.code || 'CONNECTION_CLOSE_FAILED' }); }
      client.off('error', onError);
    }
    if (transportFailure && !primary) { primary = transportFailure; receipt.failure = { phase: 'database-transport', code: primary.code }; }
    receipt.status = !primary && receipt.cleanup.failures.length === 0 ? 'PASS' : 'FAIL';
    receipt.phase = 'COMPLETE'; receipt.completedAt = new Date().toISOString(); save();
  }
  if (receipt.status !== 'PASS') throw Object.assign(Error(receipt.failure?.code || 'SCHEDULER_CLEANUP_FAILED'), { code: receipt.failure?.code || 'SCHEDULER_CLEANUP_FAILED', receipt });
  return receipt;
}
async function main() {
  const scope = `f09-scheduler-${crypto.randomUUID()}`, tenantId = crypto.randomUUID();
  const output = path.join(root, 'artifacts/f09/scheduler-sentinel.json');
  const receipt = await runSchedulerSmoke({ client: databaseClient(operatorUrl(process.env.DATABASE_URL), 'f09-scheduler-smoke', 15000),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), scope, output,
    spawnMonitor: () => spawn(path.join(root, 'target/debug/capacity-monitor'), ['--watch', '--scope', scope, '--tenant-id', tenantId, '--output', output],
      { cwd: root, env: { ...process.env, QUANTOS_OBSERVABILITY_ADDR: '' } }) });
  console.log(`F09 scheduler smoke PASS: ${receipt.observedMissingCoverageTicks} real Supabase missing-coverage ticks`);
}
if (require.main === module) main().catch(error => { console.error(error.code || 'F09_SCHEDULER_FAILED'); process.exitCode = 1; });
module.exports = { runSchedulerSmoke };
