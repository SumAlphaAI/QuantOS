// Existing bounded evaluation facts only. This never starts provider ingestion.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {createHash} = require('node:crypto');
const paths = {
  scope: 'docs/provider-approvals/20261004-binance-window-scope.json',
  providers: 'docs/provider-approvals/20261004-binance-window-evaluation.json',
  document: 'docs/provider-approvals/20261004-binance-window-evaluation.md',
  receipt: 'docs/audit/evidence/r01-freshness-remediation-20261004/live-recovered/attempt-01/receipt.json',
};
const hash = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
function retainedSourcePolicy({read = p => readFileSync(p), now = Date.now()} = {}) {
  const bytes = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, read(p)]));
  const scope = JSON.parse(bytes.scope), providers = JSON.parse(bytes.providers), receipt = JSON.parse(bytes.receipt);
  assert.equal(scope.schema, 'quantos-binance-evaluation-scope/v1');
  assert.equal(scope.provider, 'binance.spot.aggtrades');
  assert.equal(scope.enabled, true); assert(Date.parse(scope.expires_at) > now, 'source approval expired');
  assert.equal(scope.runtime_seconds, 1800); assert.deepEqual(scope.symbols, ['BTCUSDT','ETHUSDT']);
  assert.equal(scope.purpose, 'internal-engineering-evaluation');
  assert.equal(scope.retention, 'retain-immutable-evaluation-facts-in-existing-supabase');
  assert.equal(scope.approval_reference, paths.document); assert.equal(scope.approval_file, paths.providers);
  assert.deepEqual(scope.forbidden_uses, ['trading','withdrawals','customer-display','redistribution','commercial-use','permanent-production']);
  assert(String(bytes.document).includes('30 分钟（建议，完成后提交）'), 'original user authorization absent');
  assert.equal(receipt.status, 'PASS_BOUNDED_INTEGRITY'); assert.equal(receipt.fixture, false);
  assert.equal(receipt.runtime_seconds, 1800); assert.equal(receipt.authorization.scope_id, scope.scope_id);
  assert.equal(receipt.actorActive, false); assert.equal(receipt.provider, scope.provider);
  assert.equal(providers.length, 1); const p = providers[0];
  assert.equal(p.enabled, true); assert.equal(p.expires_at, scope.expires_at);
  assert.equal(p.approval_reference, scope.approval_reference); assert.equal(p.approval_version, scope.approval_version);
  assert.equal(p.provider, scope.provider); assert.deepEqual(p.instruments, {BTCUSDT:'BTC/USDT',ETHUSDT:'ETH/USDT'});
  assert.equal(p.license_label, 'public-market-data-owner-authorized-internal-evaluation-only');
  return {
    schema: 'quantos-r02-source-policy/v1', purpose: scope.purpose, ingestionStarted: false,
    approvals: [{provider:p.provider,dataset:p.dataset,license_label:p.license_label,approval_reference:p.approval_reference,
      approval_version:p.approval_version,approval_document_hash:hash(bytes.document),scope_hash:hash(bytes.scope),
      tenant_id:receipt.tenant,symbols:Object.values(p.instruments),allowed_usages:['research'],expires_at:p.expires_at,enabled:true}],
    evidence: Object.entries(paths).map(([k,path]) => ({path,sha256:hash(bytes[k])})),
  };
}
module.exports = {retainedSourcePolicy, paths};
if (require.main === module) {try {console.log(JSON.stringify(retainedSourcePolicy(),null,2));} catch(e) {console.error(e.message);process.exitCode=1;}}
