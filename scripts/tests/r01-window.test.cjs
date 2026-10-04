const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateScope, loadScope, nextSampleDeadline, effectiveHealth } = require('../r01-window-check.cjs');
const file = 'docs/provider-approvals/20261004-binance-window-scope.json';
const scope = JSON.parse(fs.readFileSync(file));
const provider = JSON.parse(fs.readFileSync(scope.approval_file))[0];
const beforeExpiry = Date.parse('2026-10-04T00:00:00Z');
test('30 minute owner-approved evaluation is bounded and preserves original expiry', () => {
  assert.equal(validateScope(scope, provider, beforeExpiry).runtime_seconds, 1800);
  assert.equal(scope.expires_at, JSON.parse(fs.readFileSync('docs/provider-approvals/20261003-binance-public-evaluation.json'))[0].expires_at);
});
test('scope cannot grow permissions, duration, endpoint, tenant lifecycle or resource envelope', () => {
  for (const change of [{ runtime_seconds: 0 }, { runtime_seconds: 3600 }, { symbols: ['BTCUSDT'] },
    { symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] }, { permissions: [...scope.permissions, 'trading'] },
    { forbidden_uses: [] }, { max_source_ticks: 300000 }, { sample_seconds: 60 }, { poll_ms: 500 },
    { environment: 'production' }, { endpoint: 'https://api.binance.com/' }, { actor_lifecycle: 'permanent' },
    { approval_version: 'v1' }, { enabled: false }]) {
    assert.throws(() => validateScope({ ...scope, ...change }, provider, beforeExpiry), /R01_WINDOW_SCOPE/);
  }
});
test('scope and provider expiry, revocation and version identity fail closed', () => {
  assert.throws(() => validateScope(scope, provider, Date.parse(scope.expires_at)), /R01_WINDOW_SCOPE/);
  for (const change of [{ enabled: false }, { approval_version: 'other' }, { expires_at: '2099-01-01' }, { instruments: {} }]) {
    assert.throws(() => validateScope(scope, { ...provider, ...change }, beforeExpiry), /R01_WINDOW_SCOPE/);
  }
});
test('sampling deadlines do not drift with queries and missed periods are explicit', () => {
  assert.deepEqual(nextSampleDeadline(0, 900, 15000), { next: 15000, missed: 0 });
  assert.deepEqual(nextSampleDeadline(15000, 16000, 15000), { next: 30000, missed: 0 });
  assert.deepEqual(nextSampleDeadline(0, 30001, 15000), { next: 45000, missed: 2 });
  assert.equal(effectiveHealth({ ready: true, checked_at: new Date(0).toISOString() }, 2001, 2000).ready, false);
  assert.equal(effectiveHealth({ ready: true, checked_at: new Date(0).toISOString() }, 500, 2000).ready, true);
  assert.equal(effectiveHealth(null, 500, 2000).ready, false);
});
