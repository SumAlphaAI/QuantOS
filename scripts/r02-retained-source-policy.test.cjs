const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const {retainedSourcePolicy, validateRetainedRows, paths, retainedPaths} = require('./r02-retained-source-policy.cjs');
const {createHash} = require('node:crypto');
const now = Date.parse('2026-10-08T00:00:00Z');
test('retained facts grant internal research only, without a new ingestion window', () => {
  const p = retainedSourcePolicy({now}); assert.deepEqual(p.approvals[0].allowed_usages,['research']);
  assert.equal(p.ingestionStarted,false); assert.equal(p.evidence.length,4);
});

const digest = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
const retainedNow = Date.parse(JSON.parse(fs.readFileSync(retainedPaths.inventory)).capturedAt) + 1000;
function changedRetained(key, mutate, reseal=false) {
  const bytes=Object.fromEntries(Object.entries(retainedPaths).map(([k,p])=>[k,fs.readFileSync(p)]));
  const value=key==='document'?bytes[key].toString():JSON.parse(bytes[key]);const changed=mutate(value)??value;
  bytes[key]=Buffer.from(typeof changed==='string'?changed:JSON.stringify(changed));
  if(reseal){const s=JSON.parse(bytes.scope),c=JSON.parse(bytes.confirmation);s.inventory_sha256=digest(bytes.inventory);bytes.scope=Buffer.from(JSON.stringify(s));c.scopeSha256=digest(bytes.scope);c.documentSha256=digest(bytes.document);bytes.confirmation=Buffer.from(JSON.stringify(c));}
  return p=>{const k=Object.keys(retainedPaths).find(k=>retainedPaths[k]===p);return k?bytes[k]:fs.readFileSync(p);};
}
test('confirmed retained-only purpose is separate from expired ingestion authorization',()=>{
  const p=retainedSourcePolicy({now:retainedNow});assert.equal(p.ingestionStarted,false);assert.equal(p.retained_events.length,32);
  assert.deepEqual(p.approvals[0].allowed_usages,['research']);assert.equal(p.approvals[0].expires_at,'2026-10-14T00:00:00Z');
  assert.equal(JSON.parse(fs.readFileSync(paths.scope)).expires_at,'2026-10-10T00:00:00Z');assert.equal(p.evidence.length,8);
});
test('retained-use grant preserves immutable ingestion provenance and binds its own authority separately',()=>{
  const original=retainedSourcePolicy({now}),current=retainedSourcePolicy({now:retainedNow});
  for(const key of ['approval_reference','approval_version','approval_document_hash','scope_hash'])
    assert.equal(current.approvals[0][key],original.approvals[0][key],`immutable ingestion ${key} changed`);
  assert.equal(current.retained_authorization.approval_reference,retainedPaths.document);
  assert.equal(current.retained_authorization.scope_id,'r02-retained-32-revalidation-20261011');
  assert.equal(current.retained_authorization.approval_version,'v3-retained32-only-20261011');
  assert.equal(current.retained_authorization.original_ingestion_expires_at,'2026-10-10T00:00:00Z');
  assert.equal(current.retained_authorization.expires_at,'2026-10-14T00:00:00Z');
  assert.equal(current.retained_authorization.approval_document_hash,digest(fs.readFileSync(retainedPaths.document)));
  assert.equal(current.retained_authorization.scope_hash,digest(fs.readFileSync(retainedPaths.scope)));
  assert.equal(original.approvals[0].expires_at,'2026-10-10T00:00:00Z');
});
for(const [name,key,mutate,reseal] of [
  ['scope revoked','scope',s=>{s.enabled=false;},true],
  ['scope pending','scope',s=>{s.status='PENDING';},true],
  ['new expiry','scope',s=>{s.expires_at='2026-10-15T00:00:00Z';},true],
  ['new source ingestion','scope',s=>{s.ingestion_started=true;},true],
  ['expanded permission','scope',s=>{s.permissions.push('append-market-facts');},true],
  ['foreign tenant','scope',s=>{s.tenant_id='00000000-0000-0000-0000-000000000000';},true],
  ['third symbol','scope',s=>{s.symbols.push('SOL/USDT');},true],
  ['commercial purpose','scope',s=>{s.purpose='commercial-use';},true],
  ['unconfirmed record','confirmation',c=>{c.decision='PENDING';},false],
  ['agent approval','confirmation',c=>{c.approver='Codex';},false],
  ['ambiguous continue message','confirmation',c=>{c.confirmationSource.text='继续';},false],
  ['different question','confirmation',c=>{c.confirmationSource.question='approve commercial use';},false],
  ['engineering approval claim','confirmation',c=>{c.engineeringAcceptance=true;},false],
  ['third party license claim','confirmation',c=>{c.thirdPartyLicense=true;},false],
  ['altered draft','document',s=>s+'changed scope',false],
  ['altered inventory bytes','inventory',i=>{i.events[0].event_id='00000000-0000-0000-0000-000000000000';},false],
  ['duplicate event ID even if resealed','inventory',i=>{i.events[0].event_id=i.events[1].event_id;},true],
  ['wrong sequence even if resealed','inventory',i=>{i.events[0].sequence=17;},true],
  ['extra event even if resealed','inventory',i=>{i.events.push(i.events[0]);},true],
  ['unclosed inventory connection','inventory',i=>{i.connection.connectionClosed=false;},true],
])test('retained-only authorization rejects '+name,()=>assert.throws(()=>retainedSourcePolicy({now:retainedNow,read:changedRetained(key,mutate,reseal)})));
test('new retained authorization expires independently and cannot start before confirmation',()=>{
  const c=JSON.parse(fs.readFileSync(retainedPaths.confirmation));
  assert.throws(()=>retainedSourcePolicy({now:Date.parse(c.confirmedAt)-1}),/not yet effective/);
  assert.throws(()=>retainedSourcePolicy({now:Date.parse('2026-10-14T00:00:00Z')}),/expired/);
});
test('expired ingestion authorization has no fallback when retained confirmation is missing',()=>{
  assert.throws(()=>retainedSourcePolicy({now:retainedNow,read:p=>{if(p===retainedPaths.confirmation){const e=Error('missing');e.code='ENOENT';throw e;}return fs.readFileSync(p);}}),/source approval expired/);
});
function retainedRows(){const p=retainedSourcePolicy({now:retainedNow});const rows=p.retained_events.map((e,i)=>({...e,payload:{item:i}}));p.retained_events=p.retained_events.map((e,i)=>({...e,payload_sha256:digest(JSON.stringify(rows[i].payload))}));return {p,rows};}
test('all 32 locked event IDs and actual payload digests must match',()=>{const {p,rows}=retainedRows();assert(validateRetainedRows(p,rows,retainedNow));});
for(const [name,mutate] of [
  ['event substituted',r=>{r[0].event_id=r[1].event_id;}],['lineage hash substituted',r=>{r[0].payload_hash=r[1].payload_hash;}],
  ['payload changed',r=>{r[0].payload.item=99;}],['range expanded',r=>{r.push(r[0]);}],['range incomplete',r=>{r.pop();}],
  ['sequence changed',r=>{r[0].sequence=2;}],['symbol changed',r=>{r[0].aggregate_id='binance.spot.aggtrades:SOL/USDT';}],
])test('retained rows reject '+name,()=>{const {p,rows}=retainedRows();mutate(rows);assert.throws(()=>validateRetainedRows(p,rows,retainedNow));});
test('retained rows cannot outlive their authorization',()=>{const {p,rows}=retainedRows();assert.throws(()=>validateRetainedRows(p,rows,Date.parse('2026-10-14T00:00:00Z')),/expired/);});
for(const [name,key,mutate] of [
  ['revoked scope','scope',s=>{s.enabled=false;}],
  ['expired scope','scope',s=>{s.expires_at='2026-10-07T00:00:00Z';}],
  ['extended window','scope',s=>{s.runtime_seconds=86400;}],
  ['expanded symbol','scope',s=>{s.symbols.push('SOLUSDT');}],
  ['commercial purpose','scope',s=>{s.purpose='commercial-use';}],
  ['removed trading exclusion','scope',s=>{s.forbidden_uses=s.forbidden_uses.filter(v=>v!=='trading');}],
  ['license label substituted','providers',p=>{p[0].license_label='approved';}],
  ['different approval version','providers',p=>{p[0].approval_version='invented';}],
  ['fixture receipt','receipt',r=>{r.fixture=true;}],
  ['early exit receipt','receipt',r=>{r.status='FAIL';}],
  ['active historical actor','receipt',r=>{r.actorActive=true;}],
]) test(`${name} cannot authorize retained source consumption`, () => {
  const changed=JSON.parse(fs.readFileSync(paths[key]));mutate(changed);
  assert.throws(()=>retainedSourcePolicy({now,read:p=>p===paths[key]?Buffer.from(JSON.stringify(changed)):fs.readFileSync(p)}));
});

for(const mode of ['extend expiry under same scope ID','expand permissions under same scope ID'])test(mode+' rejects without replacing historical authorization',()=>{
 const scope=JSON.parse(fs.readFileSync(paths.scope)),providers=JSON.parse(fs.readFileSync(paths.providers));
 if(mode.startsWith('extend')){scope.expires_at='2030-10-10T00:00:00Z';providers[0].expires_at=scope.expires_at;}else scope.permissions.push('append-snapshot');
 assert.throws(()=>retainedSourcePolicy({now,read:p=>p===paths.scope?Buffer.from(JSON.stringify(scope)):p===paths.providers?Buffer.from(JSON.stringify(providers)):fs.readFileSync(p)}),/original authorization scope changed/);
});
