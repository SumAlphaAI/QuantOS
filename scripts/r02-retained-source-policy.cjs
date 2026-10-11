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
const retainedPaths = {
  scope: 'docs/provider-approvals/20261011-r02-retained-revalidation-scope.json',
  inventory: 'docs/provider-approvals/20261011-r02-retained-events.json',
  confirmation: 'docs/provider-approvals/20261011-r02-retained-revalidation-confirmation.json',
  document: 'docs/gate-records/R02-retained-data-disposition-draft-2026-10-11.md',
};
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
function revalidationPolicy(base, {read, now}) {
  let bytes;
  try { bytes = Object.fromEntries(Object.entries(retainedPaths).map(([k,p]) => [k, read(p)])); }
  catch(e) { if(e.code === 'ENOENT') assert.fail('source approval expired; no retained-use authorization'); throw e; }
  const s = JSON.parse(bytes.scope), c = JSON.parse(bytes.confirmation), inv = JSON.parse(bytes.inventory);
  const expected = {
    schema:'quantos-retained-revalidation-scope/v1', scope_id:'r02-retained-32-revalidation-20261011', enabled:true, status:'CONFIRMED',
    provider:'binance.spot.aggtrades', tenant_id:'d8e6ea57-5499-4465-9cbb-595f32e2770c', symbols:['BTC/USDT','ETH/USDT'],
    sequence_range:{start:1,end:16}, event_count:32, purpose:'internal-development-retained-revalidation', environment:'foreground-existing-development-supabase',
    valid_from:c.confirmedAt, expires_at:'2026-10-14T00:00:00Z', permissions:['read-retained-market-facts','write-owned-development-evidence'],
    forbidden_uses:['trading','withdrawals','customer-display','redistribution','commercial-use','permanent-production','new-ingestion','provider-network','external-models','external-tools','new-instruments','new-source-records'],
    ingestion_started:false, original_scope:paths.scope, original_receipt:paths.receipt, inventory:retainedPaths.inventory,
    inventory_sha256:hash(bytes.inventory), confirmation:retainedPaths.confirmation, approval_reference:retainedPaths.document,
    approval_version:'v3-retained32-only-20261011',
  };
  assert.deepEqual(s, expected, 'retained-use scope differs from confirmed bounded purpose');
  assert.equal(c.schema, 'quantos-data-use-confirmation/v1'); assert.equal(c.mode, 'AGENT_DRAFT_USER_CONFIRMATION');
  assert.equal(c.decision, 'CONFIRMED'); assert.equal(c.approver, 'ProjectUser'); assert(c.identity);
  assert.equal(c.document, retainedPaths.document); assert.equal(c.documentSha256, hash(bytes.document));
  assert.equal(c.scope, retainedPaths.scope); assert.equal(c.scopeSha256, hash(bytes.scope));
  assert.equal(c.confirmationSource.kind, 'USER_MESSAGE'); assert.equal(c.confirmationSource.text, '确认上述限时复验范围');
  assert.equal(c.confirmationSource.question, '是否确认已打开的 R02 授权处置文稿：仅允许现有 BTC/USDT、ETH/USDT 共 32 条历史事实用于内部开发复验，有效至北京时间 10 月 14 日 08:00；不允许新采集、交易、展示、再分发或商用？');
  assert.equal(c.engineeringAcceptance, false); assert.equal(c.thirdPartyLicense, false); assert.equal(c.originalScopeUnchanged, true);
  assert(Number.isFinite(Date.parse(c.confirmedAt)) && Date.parse(c.confirmedAt) <= now, 'retained-use authorization not yet effective');
  assert(now < Date.parse(s.expires_at), 'retained-use authorization expired');
  assert.equal(inv.schema, 'quantos-retained-event-inventory/v1'); assert.equal(inv.target, 'configured-supabase');
  assert.equal(inv.tenant_id, s.tenant_id); assert.equal(inv.provider, s.provider); assert.deepEqual(inv.symbols, s.symbols);
  assert.equal(inv.readOnly, true); assert.equal(inv.ingestionStarted, false); assert.equal(inv.connection.status, 'PASS'); assert.equal(inv.connection.connectionClosed, true);
  assert(Date.parse(inv.capturedAt) >= Date.parse(c.confirmedAt) && Date.parse(inv.capturedAt) <= now);
  assert.equal(inv.eventCount, 32); assert.equal(inv.events.length, 32); assert.equal(new Set(inv.events.map(e => e.event_id)).size, 32);
  for(const [i,e] of inv.events.entries()) {
    assert.equal(e.aggregate_id, s.provider + ':' + s.symbols[Math.floor(i/16)]); assert.equal(e.sequence, i%16+1);
    assert.match(e.event_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); assert.match(e.payload_hash, /^sha256:[0-9a-f]{64}$/); assert.match(e.payload_sha256, /^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(base.approvals[0].tenant_id, s.tenant_id);
  return {...base, purpose:s.purpose, retained_events:inv.events,
    approvals:[{...base.approvals[0], approval_reference:s.approval_reference, approval_version:s.approval_version,
      approval_document_hash:hash(bytes.document), scope_hash:hash(bytes.scope), expires_at:s.expires_at}],
    evidence:[...base.evidence, ...Object.entries(retainedPaths).map(([k,path]) => ({path,sha256:hash(bytes[k])}))]};
}
function validateRetainedRows(policy, rows, now=Date.now()) {
  assert(now < Date.parse(policy.approvals[0].expires_at), 'retained-use authorization expired');
  if(!policy.retained_events) return true; // Original, time-bounded historical policy.
  assert.equal(rows.length, 32, 'retained source range expanded or incomplete');
  for(const [i,row] of rows.entries()) {
    const event = policy.retained_events[i];
    assert.equal(row.aggregate_id, event.aggregate_id); assert.equal(Number(row.sequence), event.sequence);
    assert.equal(row.event_id, event.event_id); assert.equal(row.payload_hash, event.payload_hash);
    assert.equal(hash(JSON.stringify(canonical(row.payload))), event.payload_sha256, 'retained payload changed');
  }
  return true;
}
function retainedSourcePolicy({read = p => readFileSync(p), now = Date.now()} = {}) {
  const bytes = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, read(p)]));
  const scope = JSON.parse(bytes.scope), providers = JSON.parse(bytes.providers), receipt = JSON.parse(bytes.receipt);
  assert.equal(scope.schema, 'quantos-binance-evaluation-scope/v1');
  assert.equal(scope.provider, 'binance.spot.aggtrades');
  assert.equal(scope.enabled, true);
  assert.equal(scope.runtime_seconds, 1800); assert.deepEqual(scope.symbols, ['BTCUSDT','ETHUSDT']);
  assert.equal(scope.purpose, 'internal-engineering-evaluation');
  assert.equal(scope.retention, 'retain-immutable-evaluation-facts-in-existing-supabase');
  assert.equal(scope.approval_reference, paths.document); assert.equal(scope.approval_file, paths.providers);
  assert.deepEqual(scope.forbidden_uses, ['trading','withdrawals','customer-display','redistribution','commercial-use','permanent-production']);
  assert(String(bytes.document).includes('30 分钟（建议，完成后提交）'), 'original user authorization absent');
  assert.equal(receipt.status, 'PASS_BOUNDED_INTEGRITY'); assert.equal(receipt.fixture, false);
  assert.equal(receipt.runtime_seconds, 1800);
  assert.deepEqual(receipt.authorization, scope, 'retained facts original authorization scope changed');
  assert.equal(receipt.actorActive, false); assert.equal(receipt.provider, scope.provider);
  assert.equal(providers.length, 1); const p = providers[0];
  assert.equal(p.enabled, true); assert.equal(p.expires_at, scope.expires_at);
  assert.equal(p.approval_reference, scope.approval_reference); assert.equal(p.approval_version, scope.approval_version);
  assert.equal(p.provider, scope.provider); assert.deepEqual(p.instruments, {BTCUSDT:'BTC/USDT',ETHUSDT:'ETH/USDT'});
  assert.equal(p.license_label, 'public-market-data-owner-authorized-internal-evaluation-only');
  const base = {
    schema: 'quantos-r02-source-policy/v1', purpose: scope.purpose, ingestionStarted: false,
    approvals: [{provider:p.provider,dataset:p.dataset,license_label:p.license_label,approval_reference:p.approval_reference,
      approval_version:p.approval_version,approval_document_hash:hash(bytes.document),scope_hash:hash(bytes.scope),
      tenant_id:receipt.tenant,symbols:Object.values(p.instruments),allowed_usages:['research'],expires_at:p.expires_at,enabled:true}],
    evidence: Object.entries(paths).map(([k,path]) => ({path,sha256:hash(bytes[k])})),
  };
  return Date.parse(scope.expires_at) > now ? base : revalidationPolicy(base, {read, now});
}
module.exports = {retainedSourcePolicy, validateRetainedRows, paths, retainedPaths};
if (require.main === module) {try {console.log(JSON.stringify(retainedSourcePolicy(),null,2));} catch(e) {console.error(e.message);process.exitCode=1;}}
