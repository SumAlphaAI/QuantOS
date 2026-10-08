const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const {retainedSourcePolicy, paths} = require('./r02-retained-source-policy.cjs');
const now = Date.parse('2026-10-08T00:00:00Z');
test('retained facts grant internal research only, without a new ingestion window', () => {
  const p = retainedSourcePolicy({now}); assert.deepEqual(p.approvals[0].allowed_usages,['research']);
  assert.equal(p.ingestionStarted,false); assert.equal(p.evidence.length,4);
});
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
