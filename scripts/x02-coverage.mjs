import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export function verifyCoverage(receipt,source,{read=p=>readFileSync(p),base='.'}={}){
 assert.equal(receipt.schema,'quantos-x02-rule-branches/v1');assert.equal(receipt.sourceCommit,source);assert.equal(receipt.status,'PASS');
 assert.equal(receipt.metric,'LLVM_INSTRUMENTED_BRANCHES_RULES_RS');assert.equal(receipt.raw,'coverage.raw.json');
 const bytes=read(resolve(base,receipt.raw));assert.equal(hash(bytes),receipt.rawSha256);
 const raw=JSON.parse(bytes),files=raw.data.flatMap(d=>d.files).filter(f=>f.filename.endsWith('/crates/quantos-risk/src/rules.rs'));
 assert.equal(files.length,1);const b=files[0].summary.branches;assert(Number.isInteger(b.count)&&b.count>0);assert(Number.isInteger(b.covered)&&b.covered>=0&&b.covered<=b.count);assert.equal(b.notcovered,b.count-b.covered);assert.deepEqual(receipt.branches,b);assert.equal(receipt.percent,b.covered/b.count*100);assert(receipt.percent>=95,'X02 rule branch coverage <95%');
 assert.equal(receipt.databaseExecution,false);assert.equal(receipt.performanceAccepted,false);return {status:'PASS',branches:b,percent:receipt.percent};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
 assert.equal(process.argv.length,3,'one isolated output path required');const output=resolve(process.argv[2]),base=dirname(output);mkdirSync(base,{recursive:true});
 const command=['+nightly','llvm-cov','--branch','--json','--output-path',resolve(base,'coverage.raw.json'),'--offline','--locked','-p','quantos-risk','--test','x02_guard'];
 const run=spawnSync('cargo',command,{encoding:'utf8',timeout:1200000,maxBuffer:32*1024*1024});writeFileSync(resolve(base,'coverage.log'),(run.stdout??'')+(run.stderr??''));assert.equal(run.status,0,run.error?.message??'instrumented tests failed');
 const bytes=readFileSync(resolve(base,'coverage.raw.json')),raw=JSON.parse(bytes),files=raw.data.flatMap(d=>d.files).filter(f=>f.filename.endsWith('/crates/quantos-risk/src/rules.rs'));assert.equal(files.length,1);const branches=files[0].summary.branches;
 const receipt={schema:'quantos-x02-rule-branches/v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'PASS',metric:'LLVM_INSTRUMENTED_BRANCHES_RULES_RS',command:['cargo',...command],toolchain:execFileSync('rustup',['run','nightly','rustc','-V'],{encoding:'utf8'}).trim(),raw:'coverage.raw.json',rawSha256:hash(bytes),branches,percent:branches.covered/branches.count*100,databaseExecution:false,performanceAccepted:false};
 writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');verifyCoverage(receipt,receipt.sourceCommit,{base});console.log('X02_RULE_BRANCH_COVERAGE_PASS '+receipt.percent.toFixed(2)+'%');
 }catch(error){console.error(error.message);process.exitCode=2;}
}
