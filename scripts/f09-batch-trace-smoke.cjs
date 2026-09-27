#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f09-batch-'));
const idPattern = /correlation_id=([0-9a-f-]{36})/;

function command(service, args, tracePath) {
  const result = spawnSync(path.join(root, 'target/debug', service), args, {
    cwd: root,
    env: { ...process.env, QUANTOS_TRACE_EXPORT_PATH: tracePath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${service} ${args[0]} failed with ${result.status}`);
  const id = result.stdout.match(idPattern)?.[1];
  assert.ok(id, `${service} ${args[0]} omitted its business output correlation ID`);
  const records = fs.readFileSync(tracePath, 'utf8').trim().split('\n').map(JSON.parse)
    .filter((record) => record.correlation_id === id);
  assert.deepEqual(records.map((record) => record.status), ['started', 'succeeded']);
  assert.ok(records.every((record) => record.service === service));
  return id;
}

try {
  for (const service of ['market-ingestor', 'portfolio-rebuild']) {
    const output = path.join(scratch, `${service}-rejected.jsonl`);
    const rejected = spawnSync(path.join(root, 'target/debug', service), [
      'generate-replay', '--output', output, '--count', '2',
    ], {
      cwd: root,
      env: { ...process.env, QUANTOS_TRACE_EXPORT_PATH: '' },
      encoding: 'utf8',
    });
    assert.notEqual(rejected.status, 0, `${service} wrote without a trace sink`);
    assert.equal(fs.existsSync(output), false, `${service} wrote before checking its trace sink`);
  }

  const marketTrace = path.join(scratch, 'market-trace.jsonl');
  const marketReplay = path.join(scratch, 'market-replay.jsonl');
  command('market-ingestor', [
    'generate-replay', '--output', marketReplay, '--count', '2',
  ], marketTrace);
  command('market-ingestor', ['ingest-replay', '--input', marketReplay], marketTrace);

  const portfolioTrace = path.join(scratch, 'portfolio-trace.jsonl');
  const portfolioReplay = path.join(scratch, 'portfolio-replay.jsonl');
  command('portfolio-rebuild', [
    'generate-replay', '--output', portfolioReplay, '--count', '2',
  ], portfolioTrace);
  command('portfolio-rebuild', ['rebuild', '--input', portfolioReplay], portfolioTrace);

  console.log('F09 batch write outputs and persistent traces share correlation IDs.');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
