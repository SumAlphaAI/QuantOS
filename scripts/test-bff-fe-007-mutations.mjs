import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';
import {digest,inventory} from './provider-a1-receipts.mjs';
import {selectors} from './bff-fe-007-development.mjs';
const root=resolve(import.meta.dirname,'..');const out=process.argv[2]??'docs/audit/evidence/bff-fe-007-remediation-20261006/final';mkdirSync(resolve(root,out),{recursive:true});
const original=readFileSync(resolve(root,'services/bff-gateway/src/lib.rs'),'utf8');const scratch=mkdtempSync(join(tmpdir(),'quantos-audit-mutants-'));const records=[];let lockProof;
const mutations=[
 ['causal-root',s=>s.replace('let correlation = Uuid::now_v7().to_string();\n    let audit_ref = record_audit_action(', 'let correlation = input.scope.correlation_ids[0].clone();\n    let audit_ref = record_audit_action('),'export_evidence_uses_an_independent_causal_root_and_stable_response_correlation'],
 ['causal-anchor',s=>s.replace('"causationId":cause','"causationId":null'),'export_evidence_uses_an_independent_causal_root_and_stable_response_correlation'],
 ['expiry-state',s=>s.replace('if retention <= state.now() && !matches!', 'if false && retention <= state.now() && !matches!'),'expired_export_status_transitions_once_and_denies_fresh_cancel_and_download'],
 ['scope-intent',s=>s.replace('let intent = serde_json::to_value(&input).expect("export input");','let mut intent = serde_json::to_value(&input).expect("export input"); intent["scope"].as_object_mut().unwrap().remove("eventKinds");'),'complete_scope_intent_conflicts_without_side_effects_and_rejects_invalid_scope'],
 ['redaction',s=>s.replace('let redacted_payload = audit_core::redacted(&redacted_payload);','let redacted_payload = redacted_payload;'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
 ['payload-hash',s=>s.replace('"payloadHash":audit_core::payload_hash(&redacted_payload)','"payloadHash":format!("sha256:{:064x}",42)'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
 ['cursor-binding',s=>s.replace('owner == binding && *until > state.now()','*until > state.now()'),'opaque_snapshot_cursors_reject_tampering_and_query_reuse'],
 ['retention',s=>s.replace('if retention <= state.now() {','if false && retention <= state.now() {').replace('if retention <= state.now() && !matches!','if false && retention <= state.now() && !matches!'),'redaction_hashes_and_retention_are_enforced_by_business_calls'],
];
try{
 for(const folder of ['crates','services/bff-gateway'])cpSync(resolve(root,folder),resolve(scratch,folder),{recursive:true});
 const manifest=readFileSync(resolve(root,'Cargo.toml'),'utf8').replace(/members = \[[\s\S]*?\]/,'members = ["services/bff-gateway"]');writeFileSync(join(scratch,'Cargo.toml'),manifest);cpSync(resolve(root,'Cargo.lock'),join(scratch,'Cargo.lock'));
  // A reduced workspace prunes unused members from the copied lock. Retain every
  // resolved package identity/checksum from the pinned root; never update the root.
  const sourceLock = readFileSync(resolve(root, "Cargo.lock"), "utf8");
  const host = /^host: (.+)$/m.exec(execFileSync("rustc", ["-vV"], { encoding: "utf8" }))[1];
  const lock = spawnSync("cargo", ["metadata", "--offline", "--filter-platform", host, "--format-version", "1", "--manifest-path", join(scratch, "Cargo.toml")], { cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(join(out, "lock-pruning.log"), lock.stderr ?? "");
  assert.equal(lock.status, 0, "scratch lock pruning must succeed offline");
  assert.equal(lock.signal, null);
  assert.equal(lock.error, undefined);
  const scratchLock = readFileSync(join(scratch, "Cargo.lock"), "utf8");
  const identities = text => text.split("[[package]]").slice(1).map(block => ["name", "version", "source", "checksum"].map(key => new RegExp('^' + key + ' = "([^"\\n]+)"', 'm').exec(block)?.[1] ?? "").join("|"));
  const sourcePackages = new Set(identities(sourceLock)), scratchPackages = identities(scratchLock);
  assert(scratchPackages.length > 0 && scratchPackages.every(key => sourcePackages.has(key)), "scratch lock introduced unpinned package identity/checksum");
  assert.equal(readFileSync(resolve(root, "Cargo.lock"), "utf8"), sourceLock);
  lockProof = { sourceSha256: digest(sourceLock), scratchSha256: digest(scratchLock), sourcePackages: sourcePackages.size, scratchPackages: scratchPackages.length, host, packageIdentityChecksumSubset: true, offline: true, rootUnchanged: true };

 for(const [name,change,expectedTest]of mutations){const changed=change(original);assert.notEqual(changed,original,name+' mutation did not match');writeFileSync(resolve(scratch,'services/bff-gateway/src/lib.rs'),changed);
 const r=spawnSync('cargo',['test','--offline','--locked','--manifest-path',join(scratch,'Cargo.toml'),'--target-dir',resolve(root,'target/bff-fe-007-mutants'),'-p','bff-gateway','--test','audit_export_provider',expectedTest],{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});const raw=Buffer.from((r.stdout??'')+(r.stderr??''));const log=out+'/mutation-'+name+'.log';writeFileSync(resolve(root,log),raw);const rejected=r.status===101 && !r.signal && !r.error && raw.includes(expectedTest+' ... FAILED') && raw.includes('test result: FAILED.');records.push({name,expectedTest,rejected,exitCode:r.status,signal:r.signal,errorCode:r.error?.code??null,log,logSha256:digest(raw)});assert(rejected,name+' must fail business assertions');console.log('PASS rejected semantic mutation '+name);}
}finally{writeFileSync(resolve(root,out,'mutations.json'),JSON.stringify({status:records.length===8&&records.every(r=>r.rejected)?'PASS':'FAIL',sourceHash:digest(original),lockProof,inputs:inventory(selectors),records},null,2)+'\n');rmSync(scratch,{recursive:true,force:true});}
