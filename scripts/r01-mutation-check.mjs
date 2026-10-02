// Actual compiled mutants in a temporary workspace. The user's checkout is never edited.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync}from'node:child_process';
const root=process.cwd(),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'r01-mutants-'));
try{
 const manifest=fs.readFileSync('Cargo.toml','utf8').replace(/members = \[[\s\S]*?\]/,'members = ["crates/quantos-market","crates/quantos-core","crates/quantos-event"]');
 fs.writeFileSync(path.join(scratch,'Cargo.toml'),manifest);fs.copyFileSync('Cargo.lock',path.join(scratch,'Cargo.lock'));
 for(const name of['quantos-market','quantos-core','quantos-event'])fs.cpSync(`crates/${name}`,path.join(scratch,'crates',name),{recursive:true});
 const file=path.join(scratch,'crates/quantos-market/src/lib.rs'),original=fs.readFileSync(file,'utf8');
 const mutants=[['source-content-conflict','if prior != &hash {','if false {','identity_is_tenant_scoped_and_conflicting_content_is_rejected'],['failed-append-identity','staged.ingest_tick(tenant_id, correlation_id, tick)?','self.ingest_tick(tenant_id, correlation_id, tick)?','failed_batch_does_not_publish_partial_ledger_or_identity']];
 for(const[name,from,to,test]of mutants){if(!original.includes(from))throw Error(`MUTATION_TARGET_MISSING:${name}`);fs.writeFileSync(file,original.replace(from,to));const result=spawnSync('cargo',['test','--offline','--manifest-path',path.join(scratch,'Cargo.toml'),'-p','quantos-market','--lib',test],{env:{...process.env,CARGO_TARGET_DIR:path.join(root,'target/r01-mutants')},encoding:'utf8'});if(result.status===0||!(result.stdout||'').includes('test result: FAILED')){console.error(result.stderr);throw Error(`MUTATION_NOT_REJECTED:${name}`);}console.log(`R01 compiled mutation rejected: ${name}`);fs.writeFileSync(file,original);}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
