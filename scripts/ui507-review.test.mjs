import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundary,validateBoundary,checks,validateExecutions,validateBrowser,hash,planCheck} from './ui507-review.mjs';
const source='a'.repeat(40);
test('UI-507 function and formal stages remain separate',()=>{const r=boundary(source);validateBoundary(r);assert.equal(r.nextTask,'FE:UI-P12');assert.equal(r.auxiliaryPrerequisites,false);});
for(const[k,v]of Object.entries({engineeringGate:'READY',functionImplementation:'NOT_RUN',confirmation:'CONFIRMED',formalAccepted:true,stageGate:'READY',g1Gate:'READY',businessIntegration:'PASS',releaseAcceptance:'PASS',runtimeAdmission:'ALLOWED',developmentContinuation:'BLOCKED_BY_G1_DEP_01',recursiveDependencyRevalidation:true,fullChainRerun:true,auxiliaryPrerequisites:true,productionCredentialsUsed:true,pushed:true,deployed:true,firefoxBrowser:'PASS',webKitAttachmentBrowser:'PASS',identity:'REAL_IDP',cors:'VERIFIED',nextTask:'G1-DEP-01'}))test('refuse false stage promotion or scope '+k,()=>assert.throws(()=>validateBoundary({...boundary(source),[k]:v})));
test('only current function commands; no campaign, remote or recursive upstream checks',()=>{assert.equal(checks.length,11);assert(!checks.some(c=>c.command.some(v=>/--workspace|--all|workflow_dispatch|deploy|push|g1-.*--run/.test(v))));assert.equal(checks.find(c=>c.id==='integration-refusal').exit,1);assert.equal(checks.find(c=>c.id==='next-development').command.at(-1),'FE:UI-P12');});
function fixture(){const attempt=mkdtempSync(join(tmpdir(),'quantos-ui507-gate-'));const rows=checks.map(c=>{const log=join(attempt,c.id+'.log');writeFileSync(log,'unit fixture only');return{id:c.id,command:c.command.map(s=>s.replaceAll('{attempt}',attempt)),expectedExitCode:c.exit,exitCode:c.exit,signal:null,errorCode:null,log,logSha256:hash('unit fixture only')};});return{attempt,rows,close:()=>rmSync(attempt,{recursive:true,force:true})};}
test('execution hashes and expected refusal validate',()=>{const f=fixture();try{validateExecutions(f.rows,f.attempt);}finally{f.close();}});
for(const[name,mutate]of [['missing',r=>r.pop()],['command substituted',r=>r[0].command=['true']],['not run',r=>r[0].exitCode=null],['interrupted',r=>r[0].signal='SIGTERM'],['timeout',r=>r[0].errorCode='TIMEOUT'],['refusal relabeled pass',r=>r.find(e=>e.id==='integration-refusal').exitCode=0],['log tamper',r=>writeFileSync(r[0].log,'tampered')]])test('reject execution '+name,()=>{const f=fixture();try{mutate(f.rows);assert.throws(()=>validateExecutions(f.rows,f.attempt));}finally{f.close();}});
function browser(){return{errors:[],stats:{expected:6,unexpected:0,skipped:0,flaky:0},suites:[{specs:Array.from({length:6},()=>({tests:[{projectName:'chromium',results:[{status:'passed'}]}]}))}]};}
test('all six browser cases pass once',()=>validateBrowser(browser()));
for(const[name,mutate]of [['skip',r=>r.stats.skipped++],['failure',r=>r.suites[0].specs[0].tests[0].results[0].status='failed'],['retry',r=>r.suites[0].specs[0].tests[0].results.push({status:'passed'})],['missing',r=>r.suites[0].specs.pop()],['wrong browser',r=>r.suites[0].specs[0].tests[0].projectName='firefox'],['global error',r=>r.errors.push({message:'fixture'})]])test('reject browser '+name,()=>{const b=browser();mutate(b);assert.throws(()=>validateBrowser(b));});

test('all 159 original stage gates and task requirements remain unchanged',()=>assert.equal(planCheck(),159));
