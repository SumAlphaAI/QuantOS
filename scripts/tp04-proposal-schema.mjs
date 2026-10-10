import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root=resolve(import.meta.dirname,'..');
export function validateProposalMatrix(records){
 const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);
 const validate=ajv.compile(JSON.parse(readFileSync(resolve(root,'proto/jsonschema/v1TradeProposal.schema.json'))));
 assert.equal(records.length,100);assert.deepEqual(records.map(x=>x.caseId),Array.from({length:100},(_,i)=>'case-'+String(i).padStart(3,'0')));
 for(const row of records){
  const p=row.output;assert(validate(p),JSON.stringify(validate.errors));assert.equal(p.executable,false);assert.equal(p.metadata.mode,'RUNTIME_MODE_RESEARCH');
  assert(p.counter_views.length>0&&p.counter_views.every(x=>typeof x==='string'&&x.trim()));assert(p.evidence_refs.length>0);
  assert(+p.confidence.value>=0&&+p.confidence.value<=1);assert(+p.quantity.value>=0&&+p.notional.value>=0);
  assert(Date.parse(p.expires_at)>Date.parse(p.signal.generated_at)&&Date.parse(p.expires_at)<=Date.parse(p.signal.valid_until));
  assert.equal(row.replays.execute,2);assert.equal(row.replays.stream,2);assert.equal(row.artifacts.length,2);assert.equal(new Set(row.artifacts.map(a=>a.uri)).size,2);
  assert.deepEqual([...new Set(p.evidence_refs.map(e=>e.artifact_id))].sort(),row.artifacts.map(a=>a.artifactId).sort());
  for(const a of row.artifacts){
   const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
   assert.equal(a.sha256,'sha256:'+createHash('sha256').update(JSON.stringify(canonical(a.payload))).digest('hex'));
   assert.equal(a.uri,'mock-artifact://trading-agents/'+a.artifactId.replace(':','/')+'.json');assert.equal(a.payload.artifact_id,a.artifactId);assert.equal(a.payload.audit.input_hash,row.inputHash);
   assert.equal(a.payload.time_basis,'input_signal_generation_replay');
   assert.match(a.payload.fixture_digest,/^sha256:[a-f0-9]{64}$/);
   for(const f of ['executable','upstream_runtime_loaded','tools_executed','snapshots_resolved','risk_evaluation_performed'])assert.equal(a.payload[f],false);
   if(a.payload.artifact_type==='CommitteeDebateArtifact')assert.deepEqual(a.payload.counter_views,p.counter_views);
  }
 }
 for(const mutate of [p=>delete p.confidence,p=>p.quantity.value=1,p=>p.expires_at='invalid',p=>p.action='EXECUTE']){
  const bad=structuredClone(records[0].output);mutate(bad);assert(!validate(bad),'schema accepted corrupted Proposal');
 }
 return {status:'PASS',samples:100};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const r=spawnSync('engines/.venv/bin/python',['scripts/tp04-proposal-probe.py'],{cwd:root,encoding:'utf8',timeout:60000});process.stdout.write((r.stdout??'')+(r.stderr??''));assert.equal(r.status,0);
 validateProposalMatrix(JSON.parse(readFileSync(resolve(root,'artifacts/tp04-development/proposal-matrix.json'))));
 console.log('TP04_PROPOSAL_SCHEMA_PASS 100 actual Proposals, four schema corruption probes rejected');
}
