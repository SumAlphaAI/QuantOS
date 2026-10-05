import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {ESLint} from 'eslint';
import {check,scopeRequest,validateConfirmations,validateManifest,evidenceDirectory} from '../../../../scripts/g0-development.mjs';
import {confined,nodesFromPlans,digest} from '../../../../scripts/provider-a1-receipts.mjs';
import {loadG0Inputs,validateG0Records} from '../../../../scripts/check-g0-records.mjs';
import {loadPre01Inputs,validatePre01} from '../../../../scripts/check-pre01.mjs';
const manifest=JSON.parse(readFileSync(evidenceDirectory+'/g0.json'));
const confirmations=JSON.parse(readFileSync('docs/gate-records/G0-current-scope-confirmations.json'));
const results=[];
function reject(id,action,pattern){let failure;try{action();}catch(e){failure=e;}assert(failure,id+' unexpectedly accepted');assert.match(failure.message,pattern);results.push({id,expected:'REJECTED',observed:'REJECTED',reason:failure.message});}
assert.equal(check({requireReady:true}).status,'READY');
reject('B-01-required-execution-removed',()=>{const m=structuredClone(manifest);m.checks=m.checks.slice(1);validateManifest(m,{requireReady:true});},/required functional execution/);
reject('B-01-log-bytes-replaced',()=>validateManifest(manifest,{requireReady:true,readBytes:path=>path===manifest.checks[0].log?Buffer.from('replaced'):readFileSync(confined(path))}),/log content changed/);
reject('B-01-unready-dependency',()=>{const nodes=nodesFromPlans();nodes.get(manifest.dependencies[0].nodeId).stage_gate.status='BLOCKED';validateManifest(manifest,{nodes,requireReady:true});},/dependency not READY/);
reject('M-01-old-scope-confirmation',()=>validateConfirmations({...confirmations,scopeDigest:digest('old-scope')},scopeRequest()),/input digest changed/);
reject('M-01-user-record-bytes-changed',()=>validateConfirmations(confirmations,scopeRequest(),undefined,path=>path===confirmations.approval.record?Buffer.from('replaced'):readFileSync(confined(path))),/record changed/);
reject('M-02-empty-current-strategy',()=>{const inputs=loadG0Inputs();inputs.disposition.items[0].compatibilityStrategy=' ';validateG0Records(inputs);},/compatibility strategy/);
reject('M-02-unknown-checkpoint-deadline',()=>{const inputs=loadG0Inputs();inputs.disposition.items[0].deadline.before='NONEXISTENT';validateG0Records(inputs);},/scope\/stage\/deadline/);
reject('M-03-nonexistent-api-version',()=>{const inputs=loadPre01Inputs();assert(inputs.coverage.includes('1.5.0'));inputs.coverage=inputs.coverage.replaceAll('1.5.0','99.99.0');validatePre01(inputs);},/version differs/);
const lint=new ESLint({cwd:process.cwd()});
for(const [id,filePath,code,expected] of [
 ['M-04-production-legacy-construction','apps/terminal/app/g0-independent-probe.tsx',"import { InMemoryTerminalBackend } from '@sumalpha/api-client'; export const backend = new InMemoryTerminalBackend();",'REJECTED'],
 ['M-04-shared-reexport-bypass','packages/domain-ui/src/g0-independent-probe.ts',"export { InMemoryOpsBackend as Provider } from '@sumalpha/api-client';",'REJECTED'],
 ['M-04-generated-public-client','apps/terminal/app/g0-independent-probe.tsx',"import { createBffClient } from '@sumalpha/api-client'; export const client = createBffClient;",'ACCEPTED']
]){
 const messages=(await lint.lintText(code,{filePath}))[0].messages;
 const rejected=messages.some(m=>m.ruleId==='quantos-boundary/public-bff'&&m.severity===2);
 assert.equal(rejected,expected==='REJECTED',id);
 assert(messages.every(m=>m.ruleId==='quantos-boundary/public-bff'),JSON.stringify(messages));
 results.push({id,expected,observed:rejected?'REJECTED':'ACCEPTED',messages});
}
const summary={schema:'quantos-g0-closure-probes/v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),executedAt:new Date().toISOString(),scope:'In-memory mutations and ESLint lintText only; no source or database mutation',passed:results.length,total:results.length,results};
writeFileSync(resolve(import.meta.dirname,'independent-probes.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({passed:summary.passed,total:summary.total},null,2));
