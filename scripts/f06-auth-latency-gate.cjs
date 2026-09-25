const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const fail = message => { throw Error(message); };

function targetRegion(databaseUrl) {
  const host = new URL(databaseUrl).hostname;
  return /^aws-\d+-(.+)\.pooler\.supabase\.com$/.exec(host)?.[1] || null;
}

function main() {
  const topology = process.env.QUANTOS_F06_TOPOLOGY;
  if (!['developer_remote', 'same_region'].includes(topology)) {
    fail('QUANTOS_F06_TOPOLOGY must be developer_remote or same_region');
  }
  if (!process.env.QUANTOS_BFF_DATABASE_URL) fail('dedicated BFF database URL is required');
  const databaseRegion = targetRegion(process.env.QUANTOS_BFF_DATABASE_URL);
  if (!databaseRegion) fail('cannot establish target region from dedicated BFF pooler host');
  const runnerRegion = process.env.QUANTOS_F06_RUNNER_REGION || null;
  const runnerEvidence = process.env.QUANTOS_F06_RUNNER_EVIDENCE || null;
  if (topology === 'same_region' &&
      (runnerRegion !== databaseRegion || !runnerEvidence)) {
    fail('same_region requires matching runner region and a runner deployment evidence reference');
  }
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const run = spawnSync('cargo', [
    'test', '-p', 'quantos-auth', '--test', 'postgres_auth_context',
    'f06_dedicated_bff_auth_read_p95', '--locked', '--', '--exact', '--nocapture',
  ], { encoding: 'utf8', timeout: 180000,
    env: { ...process.env, QUANTOS_RUN_F06_P95: '1' } });
  const output = `${run.stdout || ''}\n${run.stderr || ''}`;
  const match = /F06_P95_RESULT (\{[^\r\n]+\})/.exec(output);
  if (!match) fail(`F06 latency test produced no measurement (exit ${run.status})`);
  const measurement = JSON.parse(match[1]);
  const p95Millis = measurement.p95Micros / 1000;
  const passed = run.status === 0 && measurement.samples === 100 &&
    measurement.topology === topology && p95Millis < measurement.limitMillis;
  const receipt = {
    schema: 'quantos-f06-auth-latency/v1', sourceCommit, topology,
    databaseRegion, runnerRegion, runnerEvidence,
    role: 'quantos_bff', verifiedTls: true,
    samples: measurement.samples,
    p50Millis: measurement.p50Micros / 1000,
    p95Millis, limitMillis: measurement.limitMillis,
    status: passed ? 'PASS' : 'FAIL',
  };
  const receiptPath = process.env.QUANTOS_F06_RECEIPT_PATH;
  if (receiptPath) {
    if (!path.isAbsolute(receiptPath)) fail('receipt path must be absolute');
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  }
  console.log(JSON.stringify(receipt));
  if (!passed) process.exitCode = 1;
}

try { main(); } catch (error) {
  console.error(`F06 auth latency Gate failed: ${error.message}`);
  process.exitCode = 1;
}
