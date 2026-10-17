import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export function verifyCoverage(r,{read=p=>readFileSync(p),base='.'}={}){
 assert.equal(r.schema,'quantos-tp07-code-coverage/v1');assert.equal(r.status,'PASS');assert.equal(r.raw,'coverage.raw.json');
 const bytes=read(resolve(base,r.raw));assert.equal(hash(bytes),r.rawSha256);const raw=JSON.parse(bytes);
 const names=['/crates/quantos-execution/src/authority.rs','/crates/quantos-execution/src/gateway.rs','/crates/quantos-execution/src/dispatch.rs','/crates/quantos-execution/src/process_kernel.rs'];
 const files=names.map(name=>{const matches=raw.data.flatMap(d=>d.files).filter(f=>f.filename.endsWith(name));assert.equal(matches.length,1);return {path:name.slice(1),lines:matches[0].summary.lines,regions:matches[0].summary.regions};});
 assert.deepEqual(r.files,files);
 for(const f of files){assert(f.lines.count>0&&f.regions.count>0);assert(f.lines.percent>=90,f.path+' line coverage <90%');assert(f.regions.percent>=85,f.path+' region coverage <85%');}
 assert.equal(r.databaseExecution,false);assert.equal(r.performanceAccepted,false);return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 assert.equal(process.argv.length,3);const output=resolve(process.argv[2]),base=dirname(output);mkdirSync(base,{recursive:true});
 const command=['llvm-cov','--json','--output-path',resolve(base,'coverage.raw.json'),'--offline','--locked','-p','quantos-execution','-p','execution-gateway','--tests'];
 const run=spawnSync('cargo',command,{encoding:'utf8',timeout:1200000,maxBuffer:32*1024*1024});writeFileSync(resolve(base,'coverage.log'),(run.stdout??'')+(run.stderr??''));assert.equal(run.status,0,run.error?.message??'instrumented tests failed');
 const bytes=readFileSync(resolve(base,'coverage.raw.json')),raw=JSON.parse(bytes);
 const names=['/crates/quantos-execution/src/authority.rs','/crates/quantos-execution/src/gateway.rs','/crates/quantos-execution/src/dispatch.rs','/crates/quantos-execution/src/process_kernel.rs'];
 const receipt={schema:'quantos-tp07-code-coverage/v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'PASS',command:['cargo',...command],raw:'coverage.raw.json',rawSha256:hash(bytes),files:names.map(name=>{const f=raw.data.flatMap(d=>d.files).find(f=>f.filename.endsWith(name));assert(f,'missing instrumented file '+name);return {path:name.slice(1),lines:f.summary.lines,regions:f.summary.regions};}),databaseExecution:false,performanceAccepted:false};
 writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(verifyCoverage(receipt,{base})));
}catch(error){console.error(error.message);process.exitCode=2;}}
