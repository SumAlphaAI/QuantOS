// UI-103 current component scope; no recursive upstream execution or READY publication.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,confined} from './provider-a1-receipts.mjs';
import {webEnvironment} from './a1-functional-scope.mjs';
export const directory='docs/audit/evidence/ui-103-local-20261021';
export const checks=[
 ['unit',['pnpm','exec','vitest','run','packages/ui/tests','packages/domain-ui/tests']],
 ['danger-policy-coverage',['pnpm','exec','vitest','run','packages/ui/tests/ui103.test.tsx','packages/ui/tests/ui103-interactions.test.tsx','--coverage','--coverage.include=packages/ui/src/components/DangerConfirmDialog/confirmation-policy.ts','--coverage.reporter=json-summary','--coverage.reportsDirectory={attempt}/coverage','--coverage.thresholds.branches=100','--coverage.thresholds.lines=100','--coverage.thresholds.functions=100','--coverage.thresholds.statements=100']],
 ['types',['pnpm','--filter','@sumalpha/ui','--filter','@sumalpha/domain-ui','--filter','@sumalpha/terminal','typecheck']],
 ['lint',['pnpm','--filter','@sumalpha/ui','--filter','@sumalpha/domain-ui','--filter','@sumalpha/terminal','lint']],
 ['design',['node','packages/ui/scripts/pre02-checks.mjs']],
 ['design-negative',['node','--test','packages/ui/scripts/pre02-gate-negative.mjs']],
 ['pre06',['node','scripts/check-pre06.mjs']],
 ['boundary',['node','--test','scripts/frontend-import-boundary.test.mjs','scripts/ui-103-functional-review.test.mjs']],
 ['storybook-build',['pnpm','--filter','@sumalpha/ui','build-storybook']],
 ['terminal-build',['pnpm','--filter','@sumalpha/terminal','build']],
 ['terminal-consumer',['pnpm','exec','playwright','test','tests/e2e/command.spec.ts','--grep','复用 UI-103|路由可打开|axe 无','--project=chromium','--workers=1','--retries=0','--update-snapshots=none','--reporter=list']],
 ['browser',['node','scripts/ui-103-browser-probe.mjs','{attempt}/browser']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['g0-disposition',['node','scripts/ci-stage-disposition.mjs','FRONTEND-GATE:G0']],
 ['all-disposition',['node','scripts/ci-stage-disposition.mjs','PROVIDER:ALL']],
];
export function commands(attempt){return checks.map(([id,command])=>({id,command:command.map(s=>s.replaceAll('{attempt}',attempt))}));}
const read=p=>readFileSync(confined(p));
export function snapshot(){return{inputs:inventory(['AGENTS.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','patches/','.nvmrc','tsconfig.base.json','eslint.config.mjs','packages/','apps/terminal/','scripts/ui-103-*','scripts/pinned-pnpm.mjs','scripts/a1-functional-scope.mjs','scripts/p0-functional-scope.mjs','scripts/serve-static.mjs','scripts/pre03-build-receipt.mjs','scripts/provider-a1-receipts.mjs','scripts/check-development-plans.mjs','scripts/check-development-plan-order.mjs','scripts/development-plan-order-policy.json','scripts/check-pre06.mjs','scripts/frontend-import-boundary.mjs','scripts/frontend-import-boundary.test.mjs','tests/e2e/command.spec.ts','playwright.config.ts','env/local-mock.env.example','.github/workflows/frontend-baseline.yml','docs/operations/ui-103-current-function.md']),requirements:planInput(nodesFromPlans().get('FE:UI-103')),checks};}
function verifySource(s,source){assert(/^[a-f0-9]{40}$/.test(source));for(const entry of s.inputs)assert.equal(digest(execFileSync('git',['show',`${source}:${entry.path}`],{maxBuffer:16e6})),entry.sha256,'source binding '+entry.path);}
export function prerequisites(){
 const baseline='10de6fc8a827d92777cb041b4c4cab45951b49c6';
 const g0=JSON.parse(read('docs/audit/evidence/g0-legacy-local-20261020/g0.json'));
 const original=JSON.parse(read(g0.originalApiProof.path));
 const pre=g0.originalApiProof.prerequisites.find(r=>r.nodeId==='PREPARATION:P0');
 const refs=nodesFromPlans().get('FE:UI-103').dependencies.map(nodeId=>{
  let ref=original.references.receipts.find(r=>r.nodeId===nodeId);
  if(nodeId.startsWith('FE:PRE-'))ref=pre;
  if(['PROVIDER:ALL','FRONTEND-GATE:G0'].includes(nodeId)){const path='docs/audit/evidence/g0-legacy-local-20261020/'+(nodeId==='PROVIDER:ALL'?'provider-all':'g0')+'.json';ref={path,sha256:digest(execFileSync('git',['show',`${baseline}:${path}`])),receiptCommit:baseline,sourceCommit:g0.observedSourceCommit};}
  assert(ref,'direct prerequisite reference missing '+nodeId);
  const bytes=read(ref.path);assert.equal(digest(bytes),ref.sha256);assert.equal(digest(execFileSync('git',['show',`${ref.receiptCommit}:${ref.path}`],{maxBuffer:16e6})),ref.sha256);
  const receipt=JSON.parse(bytes);assert.equal(receipt.observedSourceCommit,ref.sourceCommit);execFileSync('git',['merge-base','--is-ancestor',ref.sourceCommit,'HEAD']);
  return {nodeId,path:ref.path,sha256:ref.sha256,sourceCommit:ref.sourceCommit,receiptCommit:ref.receiptCommit,referenceOnly:true,revalidated:false,currentReady:'NOT_CLAIMED',coveredBy:receipt.nodeId};
 });assert.equal(refs.length,17);return refs;
}
export function validateExecution(actual,expected,readBytes=read){assert.equal(actual.length,expected.length,'missing/extra execution');for(const [i,row] of actual.entries()){assert.equal(row.id,expected[i].id);assert.deepEqual(row.command,expected[i].command,'command substitution');assert.equal(row.exitCode,0,'failed execution');assert.equal(row.signal,null,'interrupted execution');assert.equal(row.errorCode,null,'spawn/timeout failure');assert.equal(row.logSha256,digest(readBytes(row.log)),'log drift');assert(readBytes(row.log).length>0,'empty log');}}
export function validateDisposition(r){
 assert.equal(r.engineeringStatus,'PASS');assert.equal(r.componentIntegration,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const key of ['formalAccepted','databaseExecution','production','externalPublished'])assert.equal(r[key],false);
 assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.manualScreenReader,'NOT_RUN');assert.equal(r.confirmation,'PENDING');assert.equal(r.businessIntegration,'NOT_RUN');assert.equal(r.releaseAcceptance,'NOT_RUN');assert.equal(r.recursiveDependencyRevalidation,false);
}
export function verify(r,{current=snapshot(),readBytes=read,sourceVerifier=verifySource}={}){
 validateDisposition(r);assert.deepEqual(nodesFromPlans().get('FE:UI-103').stage_gate,{stage:'INTEGRATION',status:'NOT_ASSESSED',input_digest:null,evidence:[]});
 assert.equal(r.schema,'quantos-ui103-current-function/v1');assert.equal(r.nodeId,'FE:UI-103');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');assert.equal(r.formalAccepted,false);assert.equal(r.runtimeAdmission,'DENIED');assert.equal(r.manualScreenReader,'NOT_RUN');assert.equal(r.confirmation,'PENDING');assert.equal(r.businessIntegration,'NOT_RUN');assert.equal(r.releaseAcceptance,'NOT_RUN');assert.equal(r.recursiveDependencyRevalidation,false);assert.deepEqual(r.snapshot,current,'current input drift');assert.equal(r.inputDigest,digest(JSON.stringify(current)));sourceVerifier(current,r.sourceCommit);assert.deepEqual(r.dependencies,prerequisites());validateExecution(r.executions,commands(r.attempt),readBytes);
 const artifactPaths=r.artifacts.map(a=>a.path);assert.equal(new Set(artifactPaths).size,artifactPaths.length,'duplicate artifact');
 for(const path of ['inputs.json','executions.json','storybook-build.json','terminal-build.json','terminal-runtime-build.json','storybook-index.json','coverage/coverage-summary.json','browser/browser.json','browser/axe.json','browser/accessibility-tree.yml','browser/dialog-accessibility-tree.yml',...['dark-en-1440','light-zh-1440','dark-en-768','light-zh-390','dark-en-200pct'].flatMap(n=>['browser/'+n+'.png','browser/'+n+'-dialog.png'])])assert(artifactPaths.includes(r.attempt+'/'+path),'missing artifact '+path);
 for(const artifact of r.artifacts)assert.equal(digest(readBytes(artifact.path)),artifact.sha256,'artifact drift');
 const browser=JSON.parse(readBytes(r.attempt+'/browser/browser.json'));assert.equal(browser.status,'PASS');assert.equal(browser.completeStoryMatrix,true);assert(browser.stories.length>=50);assert.equal(browser.manualScreenReader,'NOT_RUN');assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.blocked,[]);
 const coverage=JSON.parse(readBytes(r.attempt+'/coverage/coverage-summary.json'));const policy=Object.keys(coverage).find(k=>k.endsWith('/DangerConfirmDialog/confirmation-policy.ts'));assert(policy,'danger policy coverage missing');for(const key of ['branches','lines','functions','statements'])assert.equal(coverage[policy][key].pct,100);assert(coverage[policy].branches.total>=4);
 const runtimeBuild=JSON.parse(readBytes(r.attempt+'/terminal-runtime-build.json'));assert.equal(runtimeBuild.schema,'quantos-pre03-build/v1');assert.equal(runtimeBuild.app,'terminal');assert.equal(runtimeBuild.output,'export');
 const axe=JSON.parse(readBytes(r.attempt+'/browser/axe.json'));assert(axe.length>=browser.stories.length*2);assert(axe.every(row=>row.status==='PASS'&&!row.violations.some(v=>['critical','serious'].includes(v.impact))));
 for(const id of ['g0-disposition','all-disposition']){const disposition=JSON.parse(readBytes(r.executions.find(r=>r.id===id).log));assert.equal(disposition.status,'NOT_ASSESSED');assert.equal(disposition.admitted,false);assert.equal(disposition.assessmentExecuted,false);}
 return {nodeId:r.nodeId,engineeringStatus:'PASS',componentIntegration:'PASS',stageGate:r.stageGate,sourceCommit:r.sourceCommit,inputDigest:r.inputDigest,confirmation:'PENDING',manualScreenReader:'NOT_RUN',formalAccepted:false};
}
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path+'/'+f.name):[path+'/'+f.name]);}
export function run(attempt){
 assert(attempt.startsWith(directory+'/function-attempt-')&&!attempt.includes('..'));assert(!existsSync(attempt),'use a fresh attempt');mkdirSync(attempt,{recursive:true});const captured=snapshot(),sourceCommit=execFileSync('git',['rev-parse','HEAD']).toString().trim();verifySource(captured,sourceCommit);
 writeFileSync(attempt+'/inputs.json',JSON.stringify(captured,null,2)+'\n');const executions=[];
 const env={...webEnvironment(),CI:'1'}; // CI=1 also forbids Playwright from reusing an existing server.
 for(const check of commands(attempt)){
  const start=Date.now(),result=spawnSync(check.command[0],check.command.slice(1),{cwd:root,env,encoding:'utf8',maxBuffer:32e6,timeout:600000});const log=attempt+'/'+check.id+'.log',bytes=(result.stdout??'')+(result.stderr??'');writeFileSync(log,bytes);executions.push({...check,exitCode:result.status,signal:result.signal,errorCode:result.error?.code??null,elapsedMs:Date.now()-start,log,logSha256:digest(bytes)});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(check.id,result.status);
  assert.equal(result.status,0,'check failed; raw log: '+log);assert.equal(result.signal,null);assert(!result.error);
 }
 assert.deepEqual(snapshot(),captured,'inputs changed during execution');
 // Keep build output inventories, not generated bundles, in Git.
 for(const [id,path]of [['storybook','packages/ui/storybook-static'],['terminal','apps/terminal/out']])writeFileSync(attempt+'/'+id+'-build.json',JSON.stringify({sourceCommit,inputDigest:digest(JSON.stringify(captured)),files:files(path).map(path=>({path,sha256:digest(readFileSync(path))}))},null,2)+'\n');
 writeFileSync(attempt+'/terminal-runtime-build.json',readFileSync('apps/terminal/out/pre03-build.json'));writeFileSync(attempt+'/storybook-index.json',readFileSync('packages/ui/storybook-static/index.json'));
 const artifacts=files(attempt).filter(p=>!p.endsWith('.log')).map(path=>({path,sha256:digest(readFileSync(path))}));
 const receipt={schema:'quantos-ui103-current-function/v1',nodeId:'FE:UI-103',engineeringStatus:'PASS',componentIntegration:'PASS',stageGate:'NOT_ASSESSED',sourceCommit,snapshot:captured,inputDigest:digest(JSON.stringify(captured)),dependencies:prerequisites(),executions,artifacts,attempt,manualScreenReader:'NOT_RUN',confirmation:'PENDING',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN',recursiveDependencyRevalidation:false,formalAccepted:false,databaseExecution:false,production:false,externalPublished:false,runtimeAdmission:'DENIED'};
 verify(receipt);writeFileSync(attempt+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(verify(receipt),null,2));return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(JSON.parse(read(directory+'/receipt.json'))),null,2));}}catch(e){console.error(e.stack);process.exitCode=1;}}
