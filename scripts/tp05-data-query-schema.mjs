import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root=resolve(import.meta.dirname,'..');
const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
const hash=v=>'sha256:'+createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export function validateDataQueryMatrix(records){
 const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);
 const validate=ajv.compile(JSON.parse(readFileSync(resolve(root,'engines/openbb-adapter/src/openbb_adapter/contracts/data-query-response.v1.schema.json'))));
 const catalog=JSON.parse(readFileSync(resolve(root,'engines/openbb-adapter/src/openbb_adapter/fixtures/catalog.json'))).fixtures;
 const recordSchemas=JSON.parse(readFileSync(resolve(root,'engines/openbb-adapter/src/openbb_adapter/contracts/record-schemas.v1.json')));
 const recordValidators=Object.fromEntries(Object.entries(recordSchemas).map(([k,v])=>[k,ajv.compile(v)]));
 const baseline=JSON.parse(readFileSync(resolve(root,'third_party/tp05-openbb/baseline.lock.json')));
 assert.equal(records.length,100);assert.deepEqual(records.map(x=>x.caseId),Array.from({length:100},(_,i)=>'case-'+String(i).padStart(3,'0')));
 for(const row of records){
  const p=row.output,fixture=catalog.find(f=>f.fixture_name===row.fixture);assert(fixture);assert(validate(p),JSON.stringify(validate.errors));
  const {response_hash,...body}=p;assert.equal(response_hash,hash(body));
  assert.equal(p.dataset,fixture.dataset);assert.equal(p.schema_ref,fixture.schema_ref);assert.deepEqual(p.symbols,fixture.symbols);assert.deepEqual(p.records,fixture.records);assert.deepEqual(p.window,fixture.window);
  assert.equal(p.lineage.schema_hash,hash(recordSchemas[p.schema_ref]));assert(p.records.every(r=>recordValidators[p.schema_ref](r)));
  assert.equal(p.lineage.fixture_digest,fixture.fixture_digest);assert.equal(p.cache.ttl_secs,fixture.cache_ttl_secs);
  assert.equal(p.license.label,p.provider==='mock'?'internal-test-only':'AGPL-3.0-only');
  if(p.provider==='openbb'){assert.equal(p.upstream.ref,baseline.upstream.commit);assert.equal(p.license.status,'evaluation_only');}
  assert.equal(row.replays.execute,2);assert.equal(row.replays.stream,2);assert.equal(row.artifacts.length,2);assert.equal(new Set(row.artifacts.map(a=>a.uri)).size,2);
  for(const a of row.artifacts){
   assert.equal(a.sha256,hash(a.payload));assert.equal(a.payload.artifact_id,a.artifactId);
   assert.equal(a.uri,'mock-artifact://openbb-adapter/'+a.artifactId.replace(':','/')+'.json');
   assert.equal(a.payload.input_hash,row.inputHash);assert.deepEqual(a.payload.scope,p.scope);
   assert.equal(a.payload.fixture_digest,fixture.fixture_digest);
   for(const f of ['trading_approved','approved_for_production','tools_executed','upstream_runtime_loaded'])assert.equal(a.payload[f],false);
   if(a.payload.artifact_type==='NormalizedDataQueryArtifact'){assert.equal(a.sha256,p.lineage.content_hash);assert.deepEqual(a.payload.records,p.records);}
   else {assert.equal(a.payload.artifact_type,'DataLineageArtifact');assert.equal(a.sha256,p.lineage.artifact_hash);assert.equal(a.payload.content_hash,p.lineage.content_hash);assert.equal(a.payload.schema_hash,p.lineage.schema_hash);assert.deepEqual(a.payload.sources,p.sources);}
  }
 }
 for(const mutate of [p=>delete p.sources,p=>p.license.approved_for_production=true,p=>p.cache.ttl_secs=0,p=>p.records[0].volume=1]){
  const bad=structuredClone(records[0].output);mutate(bad);assert(!validate(bad),'schema accepted corrupted data response');
 }
 return {status:'PASS',samples:100};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const r=spawnSync('engines/.venv/bin/python',['scripts/tp05-data-query-probe.py'],{cwd:root,encoding:'utf8',timeout:60000});process.stdout.write((r.stdout??'')+(r.stderr??''));assert.equal(r.status,0);
 validateDataQueryMatrix(JSON.parse(readFileSync(resolve(root,'artifacts/tp05-development/data-query-matrix.json'))));
 console.log('TP05_DATA_QUERY_SCHEMA_PASS 100 actual responses, four schema corruption probes rejected');
}
