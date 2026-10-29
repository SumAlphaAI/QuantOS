import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
import {verifyInputs} from './g1-download-review.mjs';
export const directory='docs/audit/evidence/core-x06-c11-activation-local-20261029',scopePath='docs/execution/core-x06-c11-activation-scope.json';
export const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n'),git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:128e6});
export const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]).sort();
export function safe(p){assert.equal(typeof p,'string');assert(!p.startsWith('/')&&!p.split('/').some(s=>['..','.git'].includes(s)));return p;}
export function validateScope(s){
 assert.equal(s.schema,'quantos-c11-activation-scope/v1');assert.equal(s.nodeId,'CORE:X06');assert.equal(s.obligation,'L4-C11-ACTIVATION-01');
 assert.deepEqual(s.boundary,{engineeringGate:'PASS_CURRENT_SCOPED_VERSIONED_C11_RUNTIME_ACTIVATION_HISTORY_C10',developmentStatus:'IMPLEMENTED_PENDING_ACCEPTANCE',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',m5:'PREPARED_NOT_READY',scope:'OWNED_SINGLE_HOST_FIXED_EXECUTION_DOMAIN_C11_ONLY',identity:'REFERENCE_C01_F06_NOT_REAL_IDP',persistence:'AUTHENTICATED_FSYNC_FILES_COOPERATING_OS_LOCK_NOT_TARGET_DB',bootstrap:'VERSION_ZERO_BOUNDED_OWNER_REFERENCE_IMPORT_NOT_PUBLIC_OR_TARGET_ACCEPTANCE',generation:'C11_VERSION_INDEPENDENT_KILL_AND_APPROVAL_GENERATIONS_UNCHANGED',unknown:'PRESERVED_NO_RESEND_NO_POST_NO_AUTOMATIC_CLOSE',actualTestnetConnected:false,productionCredentialsUsed:false,pushed:false,published:false});
 const old=json('docs/execution/core-x06-native-control-scope.json');assert.deepEqual(s.inheritedGaps,old.inheritedGaps);assert.deepEqual(s.obligations,old.obligations);assert.equal(s.inheritedGaps.length,19);assert.equal(s.obligations.length,8);for(const r of [...s.inheritedGaps,...s.obligations])assert.equal(r.status,'OPEN');assert.deepEqual(s.review,{approval:null,selfApproved:false,status:'PENDING_USER_REVIEW'});assert.equal(s.next.nodeId,'CORE-GATE:L4');assert.equal(s.next.phase,'DEVELOPMENT');assert.equal(s.history.scope,'ORIGINAL_SCOPE_ONLY_NOT_REBOUND');return s;
}
export function audit(){const s=validateScope(json(scopePath)),m=json(s.history.manifest);assert.equal(hash(read(s.history.manifest)),s.history.sha256);assert.equal(m.sourceCommit,s.history.sourceCommit);for(const f of m.files){safe(f.path);assert.equal(hash(read(f.path)),f.sha256);}
 const pre=json(directory+'/preflight-index.json');assert.equal(pre.scope,'UNFROZEN_DIAGNOSTIC_ONLY');assert.deepEqual(pre.files.map(f=>f.path),files(directory+'/preflight'));for(const f of pre.files)assert.equal(hash(read(f.path)),f.sha256);
 return{boundary:s.boundary,openGaps:19,openObligations:8,historicalFiles:m.files.length,historicalStatus:'ORIGINAL_SCOPE_ONLY',preflightFiles:pre.files.length,next:s.next};}
export function inputs(){return [...new Set(git('ls-files','AGENTS.md','.gitattributes','.gitleaks.toml','Cargo.toml','Cargo.lock','crates','services/bff-gateway','services/execution-gateway','apps/terminal','packages/api-client','packages/ui','packages/domain-ui','bff','tests/contract','tests/e2e','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','eslint.config.mjs','playwright.config.ts','playwright.c11-activation.config.ts',scopePath,'docs/operations/core-x06-c11-activation.md','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md',directory+'/preflight-index.json',directory+'/verify.mjs').trim().split('\n'))].filter(Boolean).sort().map(path=>({path,sha256:'sha256:'+hash(read(path))}));}
export const checks=[
 [
  "development",
  [
   "node",
   "scripts/development-execution.mjs",
   "--development",
   "CORE:X06"
  ]
 ],
 [
  "scope",
  [
   "node",
   "scripts/core-x06-c11-activation-review.mjs",
   "--audit"
  ]
 ],
 [
  "build",
  [
   "cargo",
   "build",
   "--locked",
   "--offline",
   "-p",
   "bff-gateway",
   "-p",
   "execution-gateway"
  ]
 ],
 [
  "native",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "quantos-execution",
   "--test",
   "core_l04"
  ]
 ],
 [
  "authority",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "bff-gateway",
   "--lib",
   "assisted::"
  ]
 ],
 [
  "process",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "bff-gateway",
   "--test",
   "core_l04"
  ]
 ],
 [
  "consumers",
  [
   "pnpm",
   "exec",
   "vitest",
   "run",
   "apps/terminal/tests/c11-activation.test.ts",
   "apps/terminal/tests/core-l03-hardening.test.ts",
   "apps/terminal/tests/native-kill-control.test.ts",
   "apps/terminal/tests/core-l4-audit.test.ts",
   "apps/terminal/tests/ui602.test.ts",
   "apps/terminal/tests/ui-p14.test.ts",
   "--reporter=json",
   "--outputFile={attempt}/consumers.json"
  ]
 ],
 [
  "contracts",
  [
   "pnpm",
   "exec",
   "vitest",
   "run",
   "tests/contract/c11-activation.test.ts",
   "tests/contract/native-kill-control.test.ts",
   "--reporter=json",
   "--outputFile={attempt}/contracts.json"
  ]
 ],
 [
  "gate-tests",
  [
   "node",
   "--test",
   "--test-reporter=tap",
   "scripts/core-x06-c11-activation-review.test.mjs",
   "scripts/development-execution.test.mjs"
  ]
 ],
 [
  "openapi",
  [
   "node",
   "scripts/check-bff-openapi.mjs"
  ]
 ],
 [
  "generated",
  [
   "node",
   "scripts/check-bff-generated.mjs"
  ]
 ],
 [
  "typecheck",
  [
   "pnpm",
   "--filter",
   "@sumalpha/terminal",
   "typecheck"
  ]
 ],
 [
  "lint",
  [
   "pnpm",
   "exec",
   "eslint",
   "apps/terminal/src/activation",
   "apps/terminal/src/assisted",
   "apps/terminal/app/admin/workspace.tsx",
   "apps/terminal/tests/c11-activation.test.ts",
   "apps/terminal/tests/fixtures/c11-activation.ts",
   "apps/terminal/tests/core-l03-fixture.ts",
   "tests/contract/c11-activation.test.ts",
   "tests/e2e/c11-activation.spec.ts",
   "tests/e2e/c11-activation-off.spec.ts",
   "tests/e2e/c11-activation-paper.spec.ts",
   "playwright.c11-activation.config.ts",
   "scripts/core-x06-c11-activation-review.mjs",
   "scripts/core-x06-c11-activation-review.test.mjs"
  ]
 ],
 [
  "rust-lint",
  [
   "cargo",
   "clippy",
   "--locked",
   "--offline",
   "-p",
   "bff-gateway",
   "-p",
   "quantos-execution",
   "--all-targets",
   "--no-deps",
   "--",
   "-D",
   "warnings"
  ]
 ],
 [
  "rust-format",
  [
   "cargo",
   "fmt",
   "--check",
   "-p",
   "bff-gateway",
   "-p",
   "quantos-execution"
  ]
 ],
 [
  "plans",
  [
   "node",
   "scripts/check-development-plans.mjs"
  ]
 ],
 [
  "no-submit",
  [
   "python3",
   "scripts/check-x05-no-submit.py"
  ]
 ],
 [
  "web-build",
  [
   "pnpm",
   "--filter",
   "@sumalpha/terminal",
   "build"
  ]
 ],
 [
  "browser",
  [
   "pnpm",
   "exec",
   "playwright",
   "test",
   "--config=playwright.c11-activation.config.ts",
   "--project=chromium",
   "--workers=1",
   "--retries=0",
   "--reporter=list,json",
   "--output={attempt}/browser/cases"
  ]
 ],
 [
  "integration-refusal",
  [
   "node",
   "scripts/development-execution.mjs",
   "--integration",
   "CORE:X06"
  ],
  1
 ],
 [
  "release-refusal",
  [
   "node",
   "scripts/development-execution.mjs",
   "--release",
   "CORE:X06"
  ],
  1
 ],
 [
  "next-development",
  [
   "node",
   "scripts/development-execution.mjs",
   "--development",
   "CORE-GATE:L4"
  ]
 ],
 [
  "secret-scan",
  [
   "node",
   "scripts/core-x06-c11-activation-review.mjs",
   "--scan",
   "{attempt}"
  ]
 ]
];
export function validateExecutions(rows,attempt,load=read){assert.equal(rows.length,checks.length);for(const[i,r]of rows.entries()){const[id,cmd,want=0]=checks[i];assert.equal(r.id,id);assert.deepEqual(r.command,cmd.map(v=>v.replaceAll('{attempt}',attempt)));assert.equal(r.exitCode,want);assert.equal(r.signal,null);assert.equal(r.errorCode,null);assert.equal(r.log,attempt+'/'+id+'.log');assert.equal(hash(load(r.log)),r.logSha256);assert(Number.isFinite(Date.parse(r.startedAt))&&Date.parse(r.finishedAt)>=Date.parse(r.startedAt));}}
export function validateView(v){assert.deepEqual(validateFixture(v,{schema:'AssistedActivationView'}),[]);assert.equal(v.version,v.nativeActivationVersion);const at=Date.parse(v.checkedAt),effective=v.targetPermitted&&v.enabled&&Date.parse(v.validFrom)<=at&&at<Date.parse(v.validUntil);assert.equal(v.effective,effective);assert.equal(v.nativeActivationEffective,effective);assert.equal(v.runtimeWritable,effective&&!v.nativeStopped);assert(Date.parse(v.expiresAt)>at&&Date.parse(v.expiresAt)-at<=8000);assert(Date.parse(v.validUntil)<=Date.parse(v.ceilingExpiresAt));return v;}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function validateDrills(flow,recovery,unknown,source){
 for(const p of [flow,recovery,unknown]){assert.equal(p.sourceCommit,source);assert.equal(p.actualTestnet,false);}
 for(const[k,version,on]of [['initial','0',true],['off','1',false],['on','2',true],['expired','3',false],['disabled','4',false]]){const v=validateView(flow[k]);assert.equal(v.version,version);assert.equal(v.effective,on);assert.equal(v.killGeneration,'0');}
 assert.equal(flow.initial.source,'owner_reference_bootstrap');assert.equal(flow.expired.enabled,true);assert.equal(flow.expired.historyCount,4);assert.equal(flow.protocolCalls,1);assert.equal(flow.replicas,12);assert.equal(flow.killGenerationUnchanged,true);assert.equal(flow.noAutomaticResend,true);assert.equal(flow.offCapabilities.canRequest,false);assert.equal(flow.offCapabilities.policyRevision,1);assert.equal(flow.reviewed.request.revision,2);assert.equal(flow.reviewed.request.policyVersion,'1');assert.equal(flow.command.state,'accepted');assert.deepEqual(flow.before,flow.after);
 const h=flow.history;assert.deepEqual(validateFixture(h,{schema:'AssistedActivationHistory'}),[]);assert.equal(h.items.length,5);assert.equal(new Set(h.items.map(e=>e.eventId)).size,5);assert.equal(new Set(h.items.map(e=>e.recordHash)).size,5);assert.equal(flow.c10.items.length,5);assert.equal(flow.events.items.length,5);for(const[i,e]of h.items.entries()){assert.equal(e.resourceId,flow.initial.resourceId);assert.equal(e.version,String(i));assert.equal(e.previous,i?h.items[i-1].recordHash:null);assert.equal(e.source,i?'public_c11':'owner_reference_bootstrap');assert.equal(e.actorId,i?flow.originalReceipt.event.actorId:null);const event=flow.events.items.find(v=>v.eventId===e.eventId);assert(event);assert.deepEqual(event.redactedPayload,e);assert.equal(event.payloadHash,'sha256:'+hash(canonical(e)));assert.equal(event.kind,i?'assisted.activation_changed':'assisted.activation_bootstrap');assert.equal(event.sequence,i+1);}
 const r=validateView(recovery.recovered);assert.equal(r.version,'1');assert.equal(r.effective,false);assert.equal(recovery.protocolCalls,0);for(const k of ['actualBffDeathAfterCommit','originalReceiptOnly','oldApprovalRollbackDenied','nativeSameVersionForkDenied'])assert.equal(recovery[k],true);
 const u=validateView(unknown.on),off=validateView(unknown.off);assert.equal(off.version,'1');assert.equal(off.effective,false);assert.equal(u.version,'2');assert.equal(u.effective,true);assert.equal(u.nativeStopped,true);assert.equal(u.runtimeWritable,false);assert.equal(u.killGeneration,unknown.killGenerationBefore);assert.equal(off.killGeneration,unknown.killGenerationBefore);assert.equal(u.killGeneration,'1');assert.equal(u.unknownCommands,1);assert.deepEqual(unknown.before,unknown.after);assert.equal(unknown.after.appliedFillCount,0);assert.equal(unknown.after.quarantinedCommandCount,1);assert.equal(unknown.command.state,'unknown');assert.deepEqual(unknown.alerts,unknown.afterAlerts);assert.equal(unknown.alerts.items.length,2);for(const a of unknown.alerts.items){assert.equal(a.sourceEvidence.status,'OPEN');assert.equal(a.resolved,false);}assert.equal(unknown.unknownReservationsUnchanged,true);assert.equal(unknown.noResend,true);assert.equal(unknown.protocolCalls,1);
 return{currentVersion:'4',actualExpiryVersion:'3',killGenerationUnchanged:true,unknownKillGeneration:'1',unknownOpen:1,unknownPosted:0,unknownAlerts:2,unknownProtocolCalls:1,automaticResends:0,automaticClosures:0};
}
export function classifyFinding(f,attempt,source,load=read){
 const parts=f.File?.split('/positive/');if(parts?.length!==2||f.RuleID!=='generic-api-key'||f.StartLine!==f.EndLine||!Number.isInteger(f.StartLine)||f.StartLine<1)return null;
 const p=parts[1];safe(p);const current=p.startsWith(attempt+'/browser/cases/'),preflight=new RegExp('^'+directory+'/preflight/browser-[0-9]+/').test(p);if(!(current||preflight)||!/^[-a-zA-Z0-9]+\/(?:frontend-g8|native-control-network)\.json$/.test(p.slice((current?attempt+'/browser/cases/':p.match(new RegExp('^'+directory+'/preflight/browser-[0-9]+/'))[0]).length)))return null;
 const raw=load(p).toString(),v=JSON.parse(raw),line=raw.split('\n')[f.StartLine-1]??'',m=line.match(/^\s*"keyHash": "([a-f0-9]{64})",?$/);if(!m)return null;
 if(v.sourceCommit!==(preflight?json(scopePath).baseline:source)||!v.rows?.some(r=>r.keyHash===m[1]&&/^[a-f0-9]{64}$/.test(r.bodyHash)&&(r.method==='POST'&&/^\/v1\/risk\/kill-switch\/(?:engage|release|release-approvals)$/.test(r.path)||r.method==='PUT'&&/^\/v1\/admin\/feature-flags\/[a-f0-9-]{36}$/.test(r.path))))return null;
 return{path:p,line:f.StartLine,classification:'OWNED_IDEMPOTENCY_SHA256_NOT_CREDENTIAL',sourceCommit:v.sourceCommit};
}
export function scan(attempt){assert(new RegExp('^'+directory+'/(?:attempt-[0-9]+|seal-scan)$').test(attempt));const s=json(scopePath),source=git('rev-parse','HEAD').trim(),paths=[...new Set([...git('diff','--name-only',s.baseline,'HEAD').trim().split('\n'),...files(directory)])].filter(p=>p&&!p.includes('/seal-scan/')).sort(),temp=mkdtempSync(join(tmpdir(),'quantos-native-control-scan-'));try{for(const p of paths){safe(p);const out=join(temp,'positive',p);mkdirSync(dirname(out),{recursive:true});copyFileSync(p,out);}const tool='artifacts/tools/gitleaks',env=webEnvironment();assert.equal(execFileSync(tool,['version'],{env,encoding:'utf8'}).trim(),'8.28.0');const run=(kind,name)=>spawnSync(tool,['dir',join(temp,kind),'--config',resolve('.gitleaks.toml'),'--redact','--no-banner','--report-format','json','--report-path',resolve(attempt+'/'+name)],{env,encoding:'utf8',timeout:60000});const good=run('positive','secret-report.json');writeFileSync(attempt+'/gitleaks.log',good.stdout+good.stderr);const findings=json(attempt+'/secret-report.json');assert.equal(good.status,findings.length?1:0);const reviewed=findings.map(f=>classifyFinding(f,attempt,source));assert(reviewed.every(Boolean),'unreviewed secret finding');write(attempt+'/secret-review.json',{rawFindings:findings.length,reviewed});mkdirSync(join(temp,'negative'));writeFileSync(join(temp,'negative/probe.rs'),'api_key = '+JSON.stringify(randomBytes(32).toString('hex'))+';\n');const bad=run('negative','secret-negative.json');writeFileSync(attempt+'/gitleaks-negative.log',bad.stdout+bad.stderr);assert.equal(bad.status,1);assert.equal(json(attempt+'/secret-negative.json').length,1);return{scope:'CURRENT_TASK_DIFF_AND_PACKET_ONLY',files:paths.length,rawFindings:findings.length,reviewed:reviewed.length,unreviewed:0,actualCanaryRefusals:1,binarySha256:hash(read(tool)),inputs:paths.map(path=>({path,sha256:hash(read(path))}))};}finally{rmSync(temp,{recursive:true,force:true});}}
export function verify(r){assert.equal(r.schema,'quantos-c11-activation-receipt/v1');assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(r.attempt));verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.deepEqual(r.audit,audit());validateExecutions(r.executions,r.attempt);assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts){safe(f.path);assert.equal(hash(read(f.path)),f.sha256);}
 const rust={};for(const[id,want]of [['native',13],['authority',31],['process',8]]){const m=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert.equal(m.length,1);assert.equal(Number(m[0][1]),want);assert.equal(Number(m[0][2]),0);rust[id]=want;}
 const vitest={};for(const[id,want]of [['consumers',99],['contracts',21]]){const v=json(r.attempt+'/'+id+'.json');assert.equal(v.success,true);assert.equal(v.numPassedTests,want);assert.equal(v.numTotalTests,want);assert.equal(v.numPendingTests,0);vitest[id]=want;}
 const drills=validateDrills(...['flow','recovery','unknown'].map(n=>json(r.attempt+'/'+n+'.json')),r.sourceCommit),report=json(r.attempt+'/browser/report.json');assert.equal(report.stats.expected,4);for(const k of ['unexpected','skipped','flaky'])assert.equal(report.stats[k],0);assert.deepEqual(report.errors,[]);const selected=name=>r.artifacts.filter(f=>f.path.endsWith('/'+name)).map(f=>json(f.path));
 const c11=selected('c11-browser.json');assert.equal(c11.length,1);const b=c11[0];assert.equal(b.sourceCommit,r.sourceCommit);assert.equal(b.protocolCalls,0);assert.equal(b.actualTestnet,false);assert.equal(b.operatorReadOnly,true);for(const v of [b.disabled,b.enabled])validateView(v);assert.equal(b.disabled.version,'1');assert.equal(b.disabled.effective,false);assert.equal(b.enabled.version,'2');assert.equal(b.enabled.effective,true);assert.equal(b.enabled.killGeneration,'0');assert.equal(b.history.items.length,3);assert.equal(b.chain.items.length,3);assert.equal(b.originalPair.length,2);for(const k of ['bodyHash','idempotencyDigest','version'])assert.equal(b.originalPair[0][k],b.originalPair[1][k]);
 const off=selected('c11-off.json');assert.equal(off.length,1);assert.equal(off[0].sourceCommit,r.sourceCommit);assert.equal(off[0].targetPermitted,false);assert.equal(off[0].uiEnableDenied,true);assert.equal(off[0].protocolCalls,0);assert.equal(off[0].noBrowserWrites,true);
 const paper=selected('c11-paper.json');assert.equal(paper.length,1);assert.equal(paper[0].sourceCommit,r.sourceCommit);assert.equal(paper[0].mode,'paper');assert.equal(paper[0].legacyCatalogVisible,true);assert.equal(paper[0].noBrowserMutations,true);
 const kill=selected('native-control-browser.json');assert.equal(kill.length,1);assert.equal(kill[0].sourceCommit,r.sourceCommit);assert.equal(kill[0].current.generation,'2');assert.equal(kill[0].current.nativeStopped,false);assert.equal(kill[0].independentRelease,true);assert.equal(kill[0].protocolCalls,0);
 const axes=[...selected('c11-axe.json'),...selected('native-control-axe.json')];assert.equal(axes.length,2);for(const a of axes){assert.equal(a.sourceCommit,r.sourceCommit);assert.deepEqual(a.violations,[]);}
 const bins=json(r.attempt+'/binaries.json');for(const f of bins.files)assert.equal(hash(read(f.path)),f.sha256);const bridges=selected('frontend-g8.json');assert.equal(bridges.length,4);for(const f of bridges){assert.equal(f.sourceCommit,r.sourceCommit);assert.equal(f.status,'passed');assert.equal(f.binarySha256,bins.files[0].sha256);}assert.equal(json(r.attempt+'/web-build.json').buildId,'terminal-'+r.sourceCommit);
 const tap=read(r.attempt+'/gate-tests.log').toString();assert.match(tap,/# fail 0/);assert.match(tap,/# skipped 0/);assert.equal(tap.match(/# tests (\d+)/)[1],tap.match(/# pass (\d+)/)[1]);assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/release-refusal.log').reason,'USE_FROZEN_RELEASE_ACCEPTANCE_GATE');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 const scan=json(r.attempt+'/secret-scan.log');assert.equal(scan.unreviewed,0);assert.equal(scan.actualCanaryRefusals,1);assert.equal(scan.binarySha256,hash(read('artifacts/tools/gitleaks')));const raw=json(r.attempt+'/secret-report.json'),reviewed=raw.map(f=>classifyFinding(f,r.attempt,r.sourceCommit));assert(reviewed.every(Boolean));assert.deepEqual(json(r.attempt+'/secret-review.json'),{rawFindings:raw.length,reviewed});assert.equal(json(r.attempt+'/secret-negative.json').length,1);
 return{sourceCommit:r.sourceCommit,...r.audit.boundary,checks:checks.length,rustCases:rust,rustTotal:52,...vitest,nodeCases:Number(tap.match(/# pass (\d+)/)[1]),chromium:4,axeViolations:0,axeIncomplete:axes.reduce((n,a)=>n+a.incomplete.length,0),drills,openGaps:19,openObligations:8,next:'CORE-GATE:L4 DEVELOPMENT'};
}
export function run(attempt){assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'fresh attempt required');assert(!readdirSync('apps/terminal').some(p=>/^\.env(?:\.|$)/.test(p)&&!p.endsWith('.example')));const sourceCommit=git('rev-parse','HEAD').trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});write(attempt+'/inputs.json',{sourceCommit,inputs:sourceInputs});const env={...webEnvironment(),GITHUB_SHA:sourceCommit,CI:'1',QUANTOS_SKIP_ENV:'1',CARGO_NET_OFFLINE:'true',NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET:'off',QUANTOS_L02_FIXTURE_EXECUTABLE:resolve('target/debug/execution-gateway'),PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/browser/report.json')};for(const[k,n]of [['QUANTOS_C11_FLOW_RESULT','flow'],['QUANTOS_C11_RECOVERY_RESULT','recovery'],['QUANTOS_C11_UNKNOWN_RESULT','unknown']])env[k]=resolve(attempt+'/'+n+'.json');const executions=[];for(const[id,args,want=0]of checks){const command=args.map(a=>a.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:96e6,timeout:300000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});write(attempt+'/executions.json',executions);console.log(id,out.status);if(out.status!==want){write(attempt+'/failure.json',{sourceCommit,status:'FAIL',failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])});throw Error('see '+log);}if(id==='build')write(attempt+'/binaries.json',{sourceCommit,files:['target/debug/bff-gateway','target/debug/execution-gateway'].map(path=>({path,sha256:hash(read(path))}))});if(id==='web-build')writeFileSync(attempt+'/web-build.json',read('apps/terminal/out/pre03-build.json'));}const receipt={schema:'quantos-c11-activation-receipt/v1',sourceCommit,inputs:sourceInputs,audit:audit(),attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};let result;try{result=verify(receipt);}catch(e){write(attempt+'/verification-failure.json',{sourceCommit,status:'FAIL',error:e.stack});throw e;}write(directory+'/receipt.json',receipt);write(directory+'/result.json',result);console.log(JSON.stringify(result));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else if(process.argv[2]==='--verify')console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));else if(process.argv[2]==='--audit')console.log(JSON.stringify(audit()));else if(process.argv[2]==='--scan')console.log(JSON.stringify(scan(process.argv[3])));else throw Error('Use --run <fresh attempt>, --verify, --audit or --scan');}catch(e){console.error(e.stack);process.exitCode=1;}}
