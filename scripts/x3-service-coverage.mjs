import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest} from './provider-a1-receipts.mjs';
export const repairPath='crates/quantos-reconcile/src/reconciliation.rs';
export const markers=['let fee = f','if f.command_id != o.command_id','return Err(Error::Invalid("X04 fill quote or command binding"));'];
export function coverageRows(raw,source=readFileSync(resolve(root,repairPath),'utf8')){
 const files=raw.data.flatMap(d=>d.files).filter(f=>f.filename.endsWith('/'+repairPath));assert.equal(files.length,1);const f=files[0],lines=source.split('\n');
 return markers.map(marker=>{const indexes=lines.flatMap((s,i)=>s.includes(marker)?[i]:[]);assert.equal(indexes.length,1,'repair marker must be unique');const line=indexes[0]+1;const count=Math.max(0,...f.segments.filter(s=>s[0]===line&&s[3]&&!s[5]).map(s=>s[2]));
  assert(Number.isSafeInteger(count)&&count>0,'unexecuted repair '+marker);return {marker,line,count};
 });
}
export function verifyCoverage(r,{read=p=>readFileSync(p),base='.'}={}){
 assert.equal(r.schema,'quantos-x3-service-repair-coverage/v1');assert.equal(r.status,'PASS');assert.equal(r.criterion,'REPAIR_LINES_EXECUTED_WITH_POSITIVE_NEGATIVE_BEHAVIORS');assert.equal(r.branchCoverage,'NOT_MEASURED');assert.equal(r.performanceAccepted,false);assert.equal(r.databaseExecution,false);
 assert.equal(r.raw,'coverage.raw.json');const bytes=read(resolve(base,r.raw));assert.equal(digest(bytes),r.rawSha256);const log=read(resolve(base,'coverage.log'));assert.equal(digest(log),r.logSha256);assert(log.toString().includes('test result: ok. 5 passed; 0 failed'));
 assert.deepEqual(r.commands,[['cargo','llvm-cov','clean','--profraw-only','--offline','--locked'],['cargo','llvm-cov','--no-report','--offline','--locked','-p','execution-gateway','--test','x3_service','--','--nocapture'],['cargo','llvm-cov','report','--json','--output-path',resolve(base,r.raw)]]);assert.deepEqual(r.repairedLines,coverageRows(JSON.parse(bytes)));return r.repairedLines;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 assert.equal(process.argv.length,3);const output=resolve(process.argv[2]),base=dirname(output);mkdirSync(base,{recursive:true});const commands=[['cargo','llvm-cov','clean','--profraw-only','--offline','--locked'],['cargo','llvm-cov','--no-report','--offline','--locked','-p','execution-gateway','--test','x3_service','--','--nocapture'],['cargo','llvm-cov','report','--json','--output-path',resolve(base,'coverage.raw.json')]];let outputLog='';
 for(const command of commands){const run=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:1200000,maxBuffer:32*1024*1024});outputLog+=(run.stdout??'')+(run.stderr??'');writeFileSync(resolve(base,'coverage.log'),outputLog);assert.equal(run.status,0,run.error?.message??'instrumentation/report failed');}
 const bytes=readFileSync(resolve(base,'coverage.raw.json')),raw=JSON.parse(bytes),file=raw.data.flatMap(d=>d.files).find(f=>f.filename.endsWith('/'+repairPath));
 const r={schema:'quantos-x3-service-repair-coverage/v1',status:'PASS',criterion:'REPAIR_LINES_EXECUTED_WITH_POSITIVE_NEGATIVE_BEHAVIORS',branchCoverage:'NOT_MEASURED',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commands,raw:'coverage.raw.json',rawSha256:digest(bytes),logSha256:digest(readFileSync(resolve(base,'coverage.log'))),repairedLines:coverageRows(raw),fileSummaryInformational:file.summary,databaseExecution:false,performanceAccepted:false};verifyCoverage(r,{base});writeFileSync(output,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r.repairedLines));
}catch(error){console.error(error.message);process.exitCode=2;}}
