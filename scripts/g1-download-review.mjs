// Current G1-DL-01/02 engineering scope only. Never admits the complete G1 gate.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export const directory='docs/audit/evidence/g1-download-local-20261022';
export const gapCommit='adec155931a9e0bc86a25e6c6fc12093943405be';
const json=p=>JSON.parse(readFileSync(p)),bytes=p=>readFileSync(p);
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64e6});
export const notRun=['targetDatabaseStorage','realIdpMfa','realCookieCors','persistentTargetRevocation','liveSignerDelivery','fullG1BusinessJourney','fullP17BrowserJourney','manualScreenReader','nativeZoom200','nativeNotificationDelivery','crossOSVisual','remoteCI','performanceAndSoak','releaseAcceptance','trustedProductionTls','webKitInterceptedAttachmentReceipt'];
export function boundary(sourceCommit){return{schema:'quantos-g1-download-engineering/v1',sourceCommit,engineeringGate:'PASS_REFERENCE_DOWNLOAD_SCOPE',g1Gate:'NOT_READY_GAPS_OPEN',fep1Gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',confirmation:'PENDING',recursiveDependencyRevalidation:false,referenceContentDelivery:'PASS_CURRENT_BOUNDED',chromiumAttachment:'PASS_CONTENT_TRANSPORT_ONLY',firefoxBrowser:'BLOCKED_ENVIRONMENT',webKitAttachmentBrowser:'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION',...Object.fromEntries(notRun.map(k=>[k,'NOT_RUN']))};}
export function validateBoundary(r){assert.match(r.sourceCommit,/^[a-f0-9]{40}$/);for(const [k,v]of Object.entries(boundary(r.sourceCommit)))assert.deepEqual(r[k],v,k);}
const check=(id,command)=>({id,command});
export const checks=[
 check('rust-reference',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','reference_download','--','--nocapture']),
 check('rust-origin',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','download_contract','--','--nocapture']),
 check('rust-platform',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','platform::tests','--','--nocapture']),
 check('rust-audit',['cargo','test','--locked','--offline','-p','bff-gateway','--test','audit_export_provider','--','--nocapture']),
 check('build',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway']),
 check('reference-delivery',['pnpm','exec','vitest','run','tests/integration/g1-download-reference.test.ts','--reporter=verbose','--reporter=json','--outputFile={attempt}/integration-vitest.json']),
 check('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/g1-download-contract.test.ts','apps/terminal/tests/browser-platform-provider-consumer.test.ts','apps/terminal/tests/ui-p17-runtime.test.ts','apps/terminal/tests/ui104-runtime.test.ts','apps/terminal/tests/audit-provider-consumer.test.ts','apps/terminal/tests/audit-gateway.test.ts','--reporter=verbose','--reporter=json','--outputFile={attempt}/consumer-vitest.json']),
 check('contract',['pnpm','exec','vitest','run','tests/contract','--reporter=verbose','--reporter=json','--outputFile={attempt}/contract-vitest.json']),
 check('generated',['node','scripts/check-bff-generated.mjs']),
 check('bff007-contract',['node','scripts/check-bff-fe-007.mjs']),
 check('bff007-negative',['node','--test','scripts/bff-fe-007-gate-negative.mjs']),
 check('typecheck',['pnpm','--filter','@sumalpha/terminal','typecheck']),
 check('lint',['pnpm','exec','eslint','apps/terminal/src/settings/platform.ts','apps/terminal/src/downloads/lease.ts','apps/terminal/src/audit/gateway.ts','apps/terminal/tests/audit-gateway.test.ts','apps/terminal/tests/audit-provider-consumer.test.ts','apps/terminal/tests/g1-download-contract.test.ts','tests/integration/g1-download-reference.test.ts','scripts/g1-download-review.mjs','scripts/g1-download-review.test.mjs','scripts/check-bff-fe-007.mjs']),
 check('format',['rustfmt','--check','--edition','2024','services/bff-gateway/src/download_contract.rs','services/bff-gateway/src/reference_download.rs','services/bff-gateway/src/lib.rs','services/bff-gateway/src/main.rs','services/bff-gateway/src/live.rs','services/bff-gateway/src/live/audit.rs','services/bff-gateway/src/live/f09_live_tests.rs']),
 check('gate-negative',['node','--test','scripts/g1-download-review.test.mjs']),
 check('plans',['node','scripts/check-development-plans.mjs']),
];
export function sourceInputs(){
 const selectors=['docs/operations/g1-reference-downloads.md','AGENTS.md','Cargo.toml','Cargo.lock','rust-toolchain.toml','.cargo/','crates/','services/bff-gateway/','apps/terminal/src/downloads/','apps/terminal/src/audit/','apps/terminal/src/settings/','apps/terminal/src/auth/','apps/terminal/tests/g1-download-contract.test.ts','apps/terminal/tests/browser-platform-provider-consumer.test.ts','apps/terminal/tests/ui-p17-runtime.test.ts','apps/terminal/tests/ui104-runtime.test.ts','apps/terminal/tests/audit-provider-consumer.test.ts','apps/terminal/tests/audit-gateway.test.ts','apps/terminal/tests/helpers/reference-bff.ts','tests/integration/g1-download-reference.test.ts','tests/contract/','packages/api-client/','bff/','package.json','pnpm-lock.yaml','tsconfig.base.json','eslint.config.mjs','.env.example','env/local-integrated.env.example','env/staging.env.example','scripts/g1-download-review.mjs','scripts/g1-download-review.test.mjs','scripts/p0-functional-scope.mjs','scripts/pinned-pnpm.mjs','scripts/provider-a1-receipts.mjs','scripts/check-bff-fe-007.mjs','scripts/bff-fe-007-gate-negative.mjs','scripts/generate-bff-contracts.mjs','scripts/check-bff-generated.mjs','scripts/check-development-plans.mjs','scripts/check-development-plan-order.mjs','scripts/development-plan-order-policy.json'];
 return git('ls-files','--',...selectors).trim().split('\n').filter(Boolean).sort().map(path=>({path,sha256:hash(bytes(path))}));
}
export function verifyInputs(ref,inputs){
 const p=spawnSync('git',['cat-file','--batch'],{input:inputs.map(e=>`${ref}:${e.path}\n`).join(''),maxBuffer:64e6});assert.equal(p.status,0);let at=0;
 for(const e of inputs){const end=p.stdout.indexOf(10,at);assert(end>=0);const [,type,size]=p.stdout.subarray(at,end).toString().split(' ');assert.equal(type,'blob',e.path);const start=end+1;assert.equal(hash(p.stdout.subarray(start,start+Number(size))),e.sha256,'source binding '+e.path);at=start+Number(size)+1;}assert.equal(at,p.stdout.length);
}
export function validateDelivery(r,binarySha256,sourceCommit){
 assert.equal(r.sourceCommit,sourceCommit);assert.equal(r.binarySha256,binarySha256);assert.equal(r.topology,'LOOPBACK_HTTPS_PROXY_ORIGINAL_BYTES_NO_URL_REWRITE');assert.equal(r.tls,'EPHEMERAL_TEST_CERTIFICATE_ONLY');assert.equal(r.sensitiveResponses,'HASH_ONLY');
 for(const k of ['realIdp','targetDatabaseStorage','realCookieCors','fullP17BusinessJourney'])assert.equal(r[k],'NOT_RUN');assert.equal(r.firefox,'BLOCKED_ENVIRONMENT');assert.equal(r.webKitAttachment,'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION');
 assert.deepEqual(r.outcomes.map(o=>o.id),['closed-issuer-origin','generated-runtime-delivery','concurrent-one-shot-and-explicit-retry','scope-session-signature-refusals','chromium-real-attachment','metadata-audit-cancellation']);for(const o of r.outcomes)assert.equal(o.status,'PASS');
 const chromium=r.outcomes.find(o=>o.id==='chromium-real-attachment'),runtime=r.outcomes.find(o=>o.id==='generated-runtime-delivery');assert.equal(chromium.responseInterception,false);assert.equal(chromium.scope,'CONTENT_TRANSPORT_ONLY_NOT_FULL_P17_UI');assert.match(chromium.contentSha256,/^sha256:[a-f0-9]{64}$/);assert.equal(chromium.contentSha256,runtime.contentSha256);assert(chromium.bytes>0);
 for(const row of r.rows){assert.match(row.responseSha256,/^sha256:[a-f0-9]{64}$/);assert(!JSON.stringify(row).includes('downloadUrl'));if(row.path.startsWith('/_bff/'))assert.equal(row.path,'/_bff/export-content/{ticket}/{signature}');}
 for(const status of [200,401,403,410])assert(r.rows.some(row=>row.path.startsWith('/_bff/')&&row.status===status));
}
const plans=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
export function verifyPlans(){const before=nodesFromPlans(plans.map(p=>git('show',gapCommit+':'+p)));const now=nodesFromPlans();assert.equal(now.size,before.size);for(const [id,n]of now){assert.deepEqual(n.stage_gate,before.get(id).stage_gate);assert.deepEqual(planInput(n),planInput(before.get(id)));assert.equal(n.development_status,before.get(id).development_status);}return{nodes:now.size,stageGatesUnchanged:true};}
function verifyHistory(){const root='docs/audit/evidence/frontend-g1-gap-20261022';assert.deepEqual(bytes(root+'/manifest.json'),execFileSync('git',['show',gapCommit+':'+root+'/manifest.json']));const m=json(root+'/manifest.json');for(const f of m.files){const frozen=execFileSync('git',['show',gapCommit+':'+f.path],{maxBuffer:64e6});assert.equal(hash(frozen),f.sha256);if(!plans.includes(f.path))assert.equal(hash(bytes(f.path)),f.sha256);}return{packetCommit:gapCommit,files:m.files.length,integrity:'PASS_ORIGINAL_SCOPE_ONLY',originalNotRunUnchanged:true};}
export function verify(r){
 validateBoundary(r);assert.deepEqual(sourceInputs(),r.inputs);verifyInputs(r.sourceCommit,r.inputs);verifyPlans();assert.deepEqual(r.historicalGapPacket,verifyHistory());
 assert.equal(r.executions.length,checks.length);for(const [i,e]of r.executions.entries()){assert.equal(e.id,checks[i].id);assert.deepEqual(e.command,checks[i].command.map(x=>x.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(bytes(e.log)),e.logSha256);}
 for(const a of r.artifacts){assert(a.path.startsWith(r.attempt+'/'));assert(!a.path.includes('..'));assert.equal(hash(bytes(a.path)),a.sha256);}
 for(const [name,count]of [['integration-vitest.json',6],['consumer-vitest.json',null],['contract-vitest.json',null]]){const t=json(r.attempt+'/'+name);assert.equal(t.success,true);assert.equal(t.numFailedTests,0);assert.equal(t.numPendingTests,0);assert.equal(t.numPassedTests,t.numTotalTests);if(count)assert.equal(t.numTotalTests,count);for(const s of t.testResults)for(const t of s.assertionResults)assert.equal(t.status,'passed');}
 const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,r.sourceCommit);assert.deepEqual(binary.inputs,r.inputs);validateDelivery(json(r.attempt+'/reference-delivery.json'),binary.sha256,r.sourceCommit);
 return{engineeringGate:r.engineeringGate,sourceCommit:r.sourceCommit,g1Gate:r.g1Gate,stageGate:r.stageGate,formalAccepted:false,runtimeAdmission:'DENIED',historicalNotRun:'RETAINED'};
}
export function run(attempt){
 assert(attempt.startsWith(directory+'/')&&!attempt.includes('..'));assert(!existsSync(attempt),'never overwrite an attempt');mkdirSync(attempt,{recursive:true});
 const sourceCommit=git('rev-parse','HEAD').trim(),inputs=sourceInputs();verifyInputs(sourceCommit,inputs);verifyPlans();const executions=[];
 const env={...webEnvironment(),CARGO_NET_OFFLINE:'true',G1_DL_ATTEMPT:attempt,G1_DL_EXPECT_SOURCE:sourceCommit};
 writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs},null,2)+'\n');
 for(const c of checks){const command=c.command.map(x=>x.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),start=Date.now();const out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:64e6,timeout:300000});const log=attempt+'/'+c.id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id:c.id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,elapsedMs:Date.now()-start,log,logSha256:hash(bytes(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(c.id,out.status);
  if(out.status!==0)throw Error(c.id+' failed; preserve '+attempt);
  if(c.id==='build')writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,path:'target/debug/bff-gateway',sha256:hash(bytes('target/debug/bff-gateway')),inputs},null,2)+'\n');
 }
 const artifacts=readdirSync(attempt).map(name=>({path:attempt+'/'+name,sha256:hash(bytes(attempt+'/'+name))}));
 const r={...boundary(sourceCommit),attempt,inputs,historicalGapPacket:verifyHistory(),executions,artifacts};verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(verify(r)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
