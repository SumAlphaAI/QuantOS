import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),scratch=mkdtempSync(resolve(tmpdir(),'quantos-provider-a1-mutation-'));
const output=resolve(root,'artifacts/provider-a1-mutations');mkdirSync(output,{recursive:true});const records=[];
const changes=[
 {name:'changed-export-intent',path:'services/bff-gateway/src/lib.rs',mutate:s=>s.replace('.is_some_and(|intent| intent != &self.intent)','.is_some_and(|_| false)'),args:['--test','audit_export_provider'],expected:'export_commands_reject_changed_intents_before_audit_or_cancellation'},
 {name:'missing-recent-auth-cors',path:'services/bff-gateway/src/live.rs',mutate:s=>s.replace('HeaderName::from_static("x-reauth-token-ref"),',''),args:['--lib'],expected:'live::cors_tests::trusted_recent_auth_preflight_allows_contract_headers'},
];
try {
 for(const folder of ['crates','services/bff-gateway'])cpSync(resolve(root,folder),resolve(scratch,folder),{recursive:true});
 writeFileSync(resolve(scratch,'Cargo.toml'),readFileSync(resolve(root,'Cargo.toml'),'utf8').replace(/members = \[[\s\S]*?\]/,'members = ["services/bff-gateway"]'));cpSync(resolve(root,'Cargo.lock'),resolve(scratch,'Cargo.lock'));
 for(const m of changes){const original=readFileSync(resolve(root,m.path),'utf8'),changed=m.mutate(original);assert.notEqual(original,changed,'mutation must change executable source');writeFileSync(resolve(scratch,m.path),changed);
  const run=spawnSync('cargo',['test','--offline','--manifest-path',resolve(scratch,'Cargo.toml'),'--target-dir',resolve(root,'target/bff-fe-001-mutants'),'-p','bff-gateway',...m.args],{cwd:root,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024,env:{...process.env,QUANTOS_RUN_F09_POSTGRES_TESTS:'0'}});const log=(run.stdout??'')+(run.stderr??'');writeFileSync(resolve(output,m.name+'.log'),log);
  const rejected=run.status!==0&&log.includes('test result: FAILED')&&log.includes(m.expected+' ... FAILED');records.push({name:m.name,rejected,exitCode:run.status,mutatedSha256:createHash('sha256').update(changed).digest('hex')});assert(rejected,`business mutation ${m.name} must fail its regression, not compilation`);console.log('PASS semantic mutation rejected:',m.name);writeFileSync(resolve(scratch,m.path),original);
 }
}finally{writeFileSync(resolve(output,'results.json'),JSON.stringify(records,null,2)+'\n');rmSync(scratch,{recursive:true,force:true});}
