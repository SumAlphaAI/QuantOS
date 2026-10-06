import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {digest,inventory} from './provider-a1-receipts.mjs';
import {selectors} from './bff-fe-007-development.mjs';
const root=resolve(import.meta.dirname,'..');const out=process.argv[2]??'docs/audit/evidence/bff-fe-007-remediation-20261006/final';mkdirSync(resolve(root,out),{recursive:true});
const original=readFileSync(resolve(root,'services/bff-gateway/src/lib.rs'),'utf8');const scratch=mkdtempSync(join(tmpdir(),'quantos-audit-mutants-'));const records=[];
const mutations=[
 ['scope-intent',s=>s.replace('let intent = serde_json::to_value(&input).expect("export input");','let mut intent = serde_json::to_value(&input).expect("export input"); intent["scope"].as_object_mut().unwrap().remove("eventKinds");'),'complete_scope_intent_conflicts_without_side_effects_and_rejects_invalid_scope'],
 ['redaction',s=>s.replace('let redacted_payload = audit_core::redacted(&redacted_payload);','let redacted_payload = redacted_payload;'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
 ['payload-hash',s=>s.replace('"payloadHash":audit_core::payload_hash(&redacted_payload)','"payloadHash":format!("sha256:{:064x}",42)'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
 ['cursor-binding',s=>s.replace('owner == binding && *until > state.now()','*until > state.now()'),'opaque_snapshot_cursors_reject_tampering_and_query_reuse'],
 ['retention',s=>s.replace('if retention <= state.now() {','if false && retention <= state.now() {'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
];
try{
 for(const folder of ['crates','services/bff-gateway'])cpSync(resolve(root,folder),resolve(scratch,folder),{recursive:true});
 const manifest=readFileSync(resolve(root,'Cargo.toml'),'utf8').replace(/members = \[[\s\S]*?\]/,'members = ["services/bff-gateway"]');writeFileSync(join(scratch,'Cargo.toml'),manifest);cpSync(resolve(root,'Cargo.lock'),join(scratch,'Cargo.lock'));
 for(const [name,change,expectedTest]of mutations){const changed=change(original);assert.notEqual(changed,original,name+' mutation did not match');writeFileSync(resolve(scratch,'services/bff-gateway/src/lib.rs'),changed);
 const r=spawnSync('cargo',['test','--offline','--manifest-path',join(scratch,'Cargo.toml'),'--target-dir',resolve(root,'target/bff-fe-007-mutants'),'-p','bff-gateway','--test','audit_export_provider',expectedTest],{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});const raw=Buffer.from((r.stdout??'')+(r.stderr??''));const log=out+'/mutation-'+name+'.log';writeFileSync(resolve(root,log),raw);const rejected=r.status!==0 && raw.includes(expectedTest+' ... FAILED') && raw.includes('test result: FAILED.');records.push({name,expectedTest,rejected,exitCode:r.status,log,logSha256:digest(raw)});assert(rejected,name+' must fail business assertions');console.log('PASS rejected semantic mutation '+name);}
}finally{writeFileSync(resolve(root,out,'mutations.json'),JSON.stringify({status:records.length===5&&records.every(r=>r.rejected)?'PASS':'FAIL',sourceHash:digest(original),inputs:inventory(selectors),records},null,2)+'\n');rmSync(scratch,{recursive:true,force:true});}
