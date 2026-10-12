import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const {staticEnvironment}=await import(process.cwd()+'/scripts/provider-a1-receipts.mjs');
const attempt=process.argv[2],dir=mkdtempSync(resolve(tmpdir(),'quantos-r1-coverage-'));
try{for(const name of ['python','rust','rust-nightly']){
 const file=resolve(dir,name+'.json');writeFileSync(file,gunzipSync(readFileSync(attempt+'/supporting/f08-'+name+'-coverage.json.gz')));
 const r=spawnSync('node',['scripts/check-f08-'+(name==='python'?'python':'rust')+'-coverage.mjs',file,...(name==='rust-nightly'?['--require-branches']:[])],{encoding:'utf8',env:staticEnvironment(process.env),timeout:60000});
 process.stdout.write((r.stdout??'')+(r.stderr??''));assert.equal(r.status,0);assert.equal(r.error,undefined);
}console.log('retained coverage validation PASS');}finally{rmSync(dir,{recursive:true,force:true});}
