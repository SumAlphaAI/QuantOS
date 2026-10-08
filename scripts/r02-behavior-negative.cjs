#!/usr/bin/env node
// Mutate a disposable SOURCE copy, not a database. Never changes the working tree.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),copy=fs.mkdtempSync(path.join(os.tmpdir(),'quantos-r02-behavior-'));
// Mutants must never share Cargo fingerprints or binaries with the real workspace.
// Cargo can reuse a newer mutant binary after returning to the older source tree.
const env={...process.env,CARGO_TARGET_DIR:path.join(copy,'target'),DATABASE_URL:'',QUANTOS_RUN_R02_POSTGRES_TESTS:'0',QUANTOS_RUN_SUPABASE_STORAGE_TESTS:'0'};
const summary=[];
try {
 for(const name of ['crates','services','tools'])fs.cpSync(path.join(root,name),path.join(copy,name),{recursive:true});
 for(const name of ['Cargo.lock','rust-toolchain.toml'])fs.copyFileSync(path.join(root,name),path.join(copy,name));
 fs.copyFileSync(path.join(root,'Cargo.toml'),path.join(copy,'Cargo.toml'));
 const p=path.join(copy,'crates/quantos-storage/src/snapshot.rs'),original=fs.readFileSync(p,'utf8');
 const tests=[
  ['wire-integrity',/record\s*\.validate_integrity\(\)\s*\.map_err\(serde::de::Error::custom\)\?;/,'let _ = record.validate_integrity();','regression_forged_wire_hash_quality_and_expiry_are_rejected'],
  ['strict-rule-floor','if self.usage != SnapshotUsage::Research','if false && self.usage != SnapshotUsage::Research','regression_strict_floor_duplicate_and_mixed_tenant_rules_reject'],
  ['duplicate-rules','indexed.contains_key(&rule.usage)','false','regression_strict_floor_duplicate_and_mixed_tenant_rules_reject'],
  ['trusted-clock','snapshot.captured_at > observed_at','false','regression_future_capture_window_and_overflow_are_errors'],
 ];
 const run=filter=>spawnSync('cargo',['test','-p','quantos-storage','--lib','--locked','--offline',filter],{cwd:copy,env,encoding:'utf8',timeout:120000});
 const base=run('regression_');if(base.status!==0){console.error(base.stdout+base.stderr);throw Error('R02_BEHAVIOR_BASELINE_FAILED');}
 for(const [name,from,to,filter] of tests) {
  if(!(from instanceof RegExp ? from.test(original) : original.includes(from)))throw Error('R02_MUTATION_NOT_APPLIED:'+name);
  fs.writeFileSync(p,original.replace(from,to));const result=run(filter);
  // Compilation errors or timeouts are not accepted as detection.
  if(result.status===null || !result.stdout.includes('test result: FAILED.') || !result.stdout.includes(filter))throw Error('R02_MUTATION_NOT_DETECTED:'+name);
  summary.push({name,result:'MUTATION_DETECTED',test:filter});console.log(`MUTATION_DETECTED ${name}`);
 }
 const policyPath=path.join(copy,'crates/quantos-storage/src/provenance.rs'),policyOriginal=fs.readFileSync(policyPath,'utf8');
 fs.writeFileSync(p,original);
 const policyBaseline=run('actual_identity_time_quality_and_purpose_are_required');if(policyBaseline.status!==0)throw Error('R02_POLICY_BEHAVIOR_BASELINE_FAILED');
 for(const [name,from,to] of [
  ['source-purpose','!approval.allowed_usages.contains(&usage)','false'],
  ['approval-reference','event["approval_reference"] != approval.approval_reference','false'],
 ]) {if(!policyOriginal.includes(from))throw Error('R02_MUTATION_NOT_APPLIED:'+name);fs.writeFileSync(policyPath,policyOriginal.replace(from,to));const filter='actual_identity_time_quality_and_purpose_are_required',result=run(filter);
  if(result.status===null||!result.stdout.includes('test result: FAILED.')||!result.stdout.includes(filter))throw Error('R02_MUTATION_NOT_DETECTED:'+name);
  summary.push({name,result:'MUTATION_DETECTED',test:filter});console.log(`MUTATION_DETECTED ${name}`);
 }
 // Exercise the same unmodified package after the probes, as F05 does in CI.
 const workspace=spawnSync('cargo',['test','-p','quantos-storage','--lib','--locked','--offline'],{cwd:root,env:{...process.env,DATABASE_URL:'',QUANTOS_RUN_R02_POSTGRES_TESTS:'0',QUANTOS_RUN_SUPABASE_STORAGE_TESTS:'0'},encoding:'utf8',timeout:120000});
 if(workspace.status!==0){console.error(workspace.stdout+workspace.stderr);throw Error('R02_WORKSPACE_AFTER_MUTATIONS_FAILED');}
 console.log(JSON.stringify({schema:'quantos-r02-behavior/v1',baseline:'PASS',mutations:summary,sourceCopyOnly:true,isolatedCargoTarget:true,workspaceAfterMutations:'PASS',liveDatabase:false}));
}finally{fs.rmSync(copy,{recursive:true,force:true});}
