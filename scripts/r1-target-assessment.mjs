// Scoped fixtures / retained facts only. No real provider ingestion or deployment.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {evidenceInventory,validateR1Artifact} from './r1-functional-artifacts.mjs';
const [nodeId,path]=process.argv.slice(2);assert(['CORE:R01','CORE:R02'].includes(nodeId)&&path,'usage: CORE:R01|CORE:R02 fresh-receipt-path');
const output=resolve(path),base=dirname(output);assert(!existsSync(output)&&!existsSync(resolve(base,'target')),'R1 evidence directory already used');mkdirSync(base,{recursive:true});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const r={schema:'quantos-r1-development-target/v1',nodeId,sourceCommit,status:'RUNNING',target:'configured-supabase',formalAccepted:false,ingestionStarted:false,release:'NOT_RUN_RELEASE_STAGE'};
const save=()=>writeFileSync(output,JSON.stringify(r,null,2)+'\n');save();
try {
 const r01=nodeId==='CORE:R01';
 const child=spawnSync(process.execPath,[r01?'scripts/r01-live-check.cjs':'scripts/r02-combined-coverage.cjs'],{stdio:'inherit',env:{...process.env,...(r01?{QUANTOS_R01_EVIDENCE_DIR:resolve(base,'target'),QUANTOS_R01_COVERAGE:'1'}:{QUANTOS_R02_EVIDENCE_DIR:resolve(base,'target'),QUANTOS_R02_RELEASE_PERFORMANCE:'0'})}});
 r.exitCode=child.status;r.evidence=evidenceInventory(base);assert.equal(child.status,0,'R1 target execution failed');r.status='PASS';save();validateR1Artifact(r01?'r01-target':'r02-target',output,sourceCommit);console.log('R1_DEVELOPMENT_TARGET_PASS '+nodeId);
}catch(e){r.status='FAIL';r.failure=e.message;save();process.exitCode=1;console.error(e.message);}
