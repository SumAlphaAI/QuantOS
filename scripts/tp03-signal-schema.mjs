import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(import.meta.dirname, '..');
export function validateSignalMatrix(records) {
  const ajv = new Ajv2020({allErrors: true, strict: false});
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(resolve(root, 'proto/jsonschema/v1Signal.schema.json'))));
  assert.equal(records.length, 100);
  assert.deepEqual(records.map(x => x.caseId), Array.from({length: 100}, (_, i) => 'case-' + String(i).padStart(3, '0')));
  for (const row of records) {
    assert(validate(row.output), JSON.stringify(validate.errors));
    const s = row.output;
    assert.equal(s.metadata.mode, 'RUNTIME_MODE_RESEARCH');
    assert(+s.confidence.value >= 0 && +s.confidence.value <= 1);
    assert(Date.parse(s.valid_until) > Date.parse(s.generated_at));
    const d = s.diagnostics.value;
    for (const field of ['strategy_version', 'model_version', 'data_version']) {
      assert.equal(typeof d[field], 'string');
      assert(d[field].trim().length > 0);
    }
    assert.match(d.model_digest, /^sha256:[0-9a-f]{64}$/);
    for (const field of ['trade_executable', 'release_resolved', 'snapshot_bytes_resolved', 'upstream_runtime_loaded', 'tools_executed']) assert.equal(d[field], false);
    assert.equal(d.time_basis, 'command_issued_at_replay');
    assert.equal(d.model_digest_scope, 'fixture_definition_not_weights');
    assert.equal(d.model_provenance.strategy_release_id, s.strategy_release_id);
    assert.equal(d.model_provenance.feature_snapshot_id, d.model_provenance.data_snapshot_ref);
    assert.equal(row.replays.execute, 2);
    assert.equal(row.replays.stream, 2);
  }
  for (const mutate of [s => delete s.confidence, s => s.confidence.value = 1, s => s.generated_at = 'invalid', s => s.direction = 'BUY']) {
    const bad = structuredClone(records[0].output);
    mutate(bad);
    assert(!validate(bad), 'schema accepted corrupted Signal');
  }
  return {status: 'PASS', samples: 100};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const r = spawnSync('engines/.venv/bin/python', ['scripts/tp03-signal-probe.py'], {cwd: root, encoding: 'utf8', timeout: 60000});
  process.stdout.write((r.stdout ?? '') + (r.stderr ?? ''));
  assert.equal(r.status, 0, 'actual Signal UDS probe failed');
  validateSignalMatrix(JSON.parse(readFileSync(resolve(root, 'artifacts/tp03-development/signal-matrix.json'))));
  console.log('TP03_SIGNAL_SCHEMA_PASS 100 actual Signals, four schema corruption probes rejected');
}
