// Current X05 independent observed books join and durable Alert evidence, no release admission.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomBytes,X509Certificate,verify as cryptoVerify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {validateBrowser,validateOff,unitFiles} from './core-l4-review.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
export const base='abcea2032a00a53af1438f9c8c2ca96c63a0e7b6';
export const directory='docs/audit/evidence/core-x05-current-local-20261029';
export const scopePath='docs/execution/core-x05-current-scope.json';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
export const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128e6});
export const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]).sort();
export function safe(p){assert(typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&!p.includes('\0')&&!p.split('/').includes('..'));assert(!/(?:^|\/)\.env(?:$|\.(?!example$))/.test(p));}
export const notRun=['actualIdpMfaAndVenue','targetDatabaseVaultRls','crossHostTransactions','currentRiskValuationAndFreshReview','completeIndependentAccountBooksAndMarks','actualAlertIngestionDeliveryOrClosure','asynchronousVenueFillReconciliation','nonQuoteFeeConversion','targetLatencySecurityLoadSoakSameShaCI','integrationReleaseAndM5','manualAccessibilityFullBrowsers'];
export function boundary(){return{nodeId:'CORE:X05',engineeringGate:'PASS_CURRENT_X05_OBSERVATION_RECONCILIATION_ALERT_EVIDENCE',developmentStatus:'IMPLEMENTED_PENDING_ACCEPTANCE',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',m5:'PREPARED_NOT_READY',scope:'OWNED_NATIVE_X01_INDEPENDENT_SIGNED_PROTOCOL_OBSERVATIONS',identity:'REFERENCE_C01_F06_ASSISTED_LIVE',persistence:'SINGLE_HOST_AUTHENTICATED_FILES_NOT_TARGET_DB',independentBooks:'OWNED_SIGNED_PROTOCOL_OBSERVATIONS_ONLY',fullBooksReady:false,alertDelivery:'NOT_JOINED_EVIDENCE_OUTBOX_ONLY',actualTestnetConnected:false,inheritedGaps:19,openObligations:8,productionCredentialsUsed:false,pushed:false,published:false,nextTask:'CORE:X06',nextPhase:'DEVELOPMENT'};}
export function validateBoundary(b){assert.deepEqual(b,boundary());}
export function validateScope(s,prior){assert.equal(s.schema,'quantos-core-x05-current-scope/v1');assert.equal(s.baseline,base);assert.deepEqual(s.boundary,boundary());assert.deepEqual(s.notRun,notRun);assert.deepEqual(s.inheritedGaps,prior.remainingGaps);assert.deepEqual(s.obligations,prior.obligations);assert.equal(s.inheritedGaps.length,19);assert.equal(s.obligations.length,8);assert(s.inheritedGaps.every(g=>g.status==='OPEN'));assert(s.obligations.every(g=>g.status==='OPEN'));assert.equal(s.progress.obligation,'L4-LEDGER-01');assert.equal(s.progress.status,'X04_X01_X05_OBSERVATION_JOINED_ALERT_EVIDENCE_OPEN');}
export function validatePlans(before,after){assert.equal(before.size,159);assert.equal(after.size,159);for(const[id,n]of after){const p=before.get(id);assert(p);for(const k of ['stage_gate','dependencies','core_prerequisites','closes_core','development_status','source_commit'])assert.deepEqual(n[k],p[k],id+':'+k);}return{nodes:159,stagesUnchanged:true,formalAccepted:false};}
export function history(){const root='docs/audit/evidence/core-x01-current-local-20261029',receipt=root+'/receipt.json',manifest=root+'/manifest.json';for(const p of [receipt,manifest])assert.equal(hash(read(p)),hash(execFileSync('git',['show',base+':'+p],{maxBuffer:64e6})));const r=json(receipt),m=json(manifest);assert.equal(r.sourceCommit,'1601d98145a3d2d2f2e5df6d0d57648089cc8e41');assert.equal(m.files.length,125);for(const f of m.files){safe(f.path);assert.equal(hash(read(f.path)),f.sha256);}return{receipt,manifest,sourceCommit:r.sourceCommit,files:125,scope:'ORIGINAL_SCOPE_ONLY_NOT_CURRENT_PASS'};}
export function preflight(){const index=json(directory+'/preflight-index.json');assert.equal(index.schema,'quantos-core-x05-preflight/v1');assert.equal(index.baseline,base);assert.equal(index.scope,'UNFROZEN_SCOPE_ONLY_NOT_FINAL_CANDIDATE_ACCEPTANCE');assert.deepEqual(index.files.map(f=>f.path),files(directory+'/preflight'));for(const f of index.files){safe(f.path);assert.equal(hash(read(f.path)),f.sha256);}return{files:index.files.length,failedLogs:index.files.filter(f=>f.outcome.startsWith('FAIL')).length,scope:index.scope};}
export function audit(){validateScope(json(scopePath),json('docs/audit/evidence/core-x01-current-local-20261029/handoff.json'));const paths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];return{boundary:boundary(),history:history(),preflight:preflight(),plans:validatePlans(nodesFromPlans(paths.map(p=>git('show',base+':'+p))),nodesFromPlans())};}
export const consumerFiles=[...unitFiles,'apps/terminal/tests/core-x04-facts.test.ts','apps/terminal/tests/core-x01-ledger.test.ts','apps/terminal/tests/core-x05-reconciliation.test.ts'];
export const checks=[
 [
  "development",
  [
   "node",
   "scripts/development-execution.mjs",
   "--development",
   "CORE:X05"
  ]
 ],
 [
  "scope",
  [
   "node",
   "scripts/core-x05-current-review.mjs",
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
  "current-model",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "quantos-reconcile",
   "--test",
   "current_join"
  ]
 ],
 [
  "legacy-x05",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "quantos-reconcile",
   "--test",
   "x05_flow",
   "--test",
   "x05_sources",
   "--test",
   "x05_process"
  ]
 ],
 [
  "ledger-model",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "quantos-portfolio",
   "--test",
   "native_ledger"
  ]
 ],
 [
  "native-facts",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "quantos-execution",
   "--test",
   "core_x04_facts"
  ]
 ],
 [
  "restricted-zone",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "execution-gateway",
   "--test",
   "l02_mtls"
  ]
 ],
 [
  "public-source",
  [
   "cargo",
   "test",
   "--locked",
   "--offline",
   "-p",
   "bff-gateway",
   "--lib",
   "assisted::tests::"
  ]
 ],
 [
  "public-process",
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
  "no-submit",
  [
   "python3",
   "scripts/check-x05-no-submit.py"
  ]
 ],
 ['consumers',['pnpm','exec','vitest','run',...consumerFiles,'--reporter=json','--outputFile={attempt}/consumers.json']],
 [
  "contracts",
  [
   "pnpm",
   "exec",
   "vitest",
   "run",
   "tests/contract",
   "packages/api-client/tests",
   "--reporter=json",
   "--outputFile={attempt}/contracts.json"
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
  "openapi",
  [
   "node",
   "scripts/check-bff-openapi.mjs"
  ]
 ],
 [
  "types",
  [
   "pnpm",
   "exec",
   "tsc",
   "--noEmit",
   "-p",
   "apps/terminal/tsconfig.json"
  ]
 ],
 [
  "lint",
  [
   "pnpm",
   "exec",
   "eslint",
   "scripts/core-x05-current-review.mjs",
   "scripts/core-x05-current-review.test.mjs",
   "apps/terminal/src/assisted/runtime.ts",
   "apps/terminal/src/assisted/workspace.tsx",
   "apps/terminal/tests/core-x05-reconciliation.test.ts",
   "apps/terminal/tests/core-l03-fixture.ts",
   "tests/contract/core-x05-reconciliation.test.ts",
   "tests/e2e/core-l4.spec.ts"
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
   "quantos-reconcile",
   "-p",
   "bff-gateway",
   "-p",
   "execution-gateway",
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
   "quantos-reconcile",
   "-p",
   "bff-gateway",
   "-p",
   "execution-gateway"
  ]
 ],
 [
  "gate-tests",
  [
   "node",
   "--test",
   "--test-reporter=tap",
   "scripts/core-x05-current-review.test.mjs",
   "scripts/development-execution.test.mjs"
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
   "--config=playwright.core-l4.config.ts",
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
   "CORE:X05"
  ],
  1
 ],
 [
  "l4-refusal",
  [
   "node",
   "scripts/development-execution.mjs",
   "--integration",
   "CORE-GATE:L4"
  ],
  1
 ],
 [
  "release-refusal",
  [
   "node",
   "scripts/development-execution.mjs",
   "--release",
   "CORE:X05"
  ],
  1
 ],
 [
  "next-development",
  [
   "node",
   "scripts/development-execution.mjs",
   "--development",
   "CORE:X06"
  ]
 ],
 [
  "secret-scan",
  [
   "node",
   "scripts/core-x05-current-review.mjs",
   "--scan",
   "{attempt}"
  ]
 ]
];
export function inputs(){return git('ls-files','--','AGENTS.md','.gitattributes','Cargo.toml','Cargo.lock','rust-toolchain.toml','.cargo/','crates/','services/bff-gateway/','services/execution-gateway/','apps/terminal/','packages/','bff/','tests/contract/','tests/e2e/','scripts/','package.json','pnpm-lock.yaml','tsconfig.base.json','eslint.config.mjs','playwright*.config.ts','.gitleaks.toml','env/local-mock.env.example',scopePath,directory+'/preflight-index.json','docs/operations/core-x05-current-reconciliation.md','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md').trim().split('\n').filter(Boolean).sort().map(path=>({path,sha256:'sha256:'+hash(read(path))}));}
export function validateExecutions(executions,attempt,load=read){assert.equal(executions.length,checks.length);for(const[i,e]of executions.entries()){const[id,args,want=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(a=>a.replaceAll('{attempt}',attempt)));assert.equal(e.exitCode,want,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(e.log,attempt+'/'+id+'.log');assert.equal(hash(load(e.log)),e.logSha256);assert(Number.isFinite(Date.parse(e.finishedAt))&&Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}}

export function canonical(v){return v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
export function validateFacts(packet,source){assert.equal(packet.sourceCommit,source);assert.equal(packet.actualTestnet,false);assert.equal(packet.nativeProtocolCalls,1);assert.equal(packet.replicaRequests,12);const v=packet.view,f=v.facts;assert.deepEqual(validateFixture(v,{schema:'AssistedRequestView'}),[]);assert.deepEqual(validateFixture(packet.events,{schema:'AuditEventPage'}),[]);assert.equal(f.executionAuthority,false);assert.equal(f.consumerReady,true);assert.equal(f.outcome,'accepted');assert.equal(f.journalAvailable,true);assert.equal(f.quoteCurrency,'USDT');assert.equal(f.commandId,v.command.commandId);assert.equal(f.subjectHash,v.subject.subjectHash);assert.equal(f.subjectHash,v.request.subjectHash);assert.equal(f.proposalHash,v.subject.proposalHash);assert.equal(f.decisionId,v.subject.decisionId);assert.equal(f.accountId,v.subject.accountId);for(const k of ['tenantId','workspaceId','accountId'])assert.equal(f[k],packet.context[k]);assert.equal(packet.context.mode,'assisted_live');assert.equal(f.requestId,v.request.requestId);assert.equal(f.fills.length,1);assert.equal(f.fills[0].commandId,f.commandId);assert.equal(f.fills[0].orderId,f.order.orderId);assert.equal(f.order.orderId,v.command.order.orderId);assert.equal(f.fills[0].accountId,f.accountId);assert.equal(f.fills[0].feeCurrency,'USDT');assert.equal(typeof f.fills[0].feeAmount,'string');assert(f.factHashes.includes(f.fills[0].factHash));assert.equal(f.factHashes.length,3);assert.equal(f.nativeSourceHashes.length,3);const {sourceHash,...body}=f;assert.equal(sourceHash,'sha256:'+hash(canonical(['quantos-native-execution-source/v1',body])));const event=packet.events.items.find(n=>n.kind==='assisted.command_accepted'),last=event.redactedPayload;assert.equal(event.payloadHash,'sha256:'+hash(canonical(last)));assert.equal(last.executionFactsHash,f.sourceHash);assert.deepEqual(last.fillIds,f.fills.map(f=>f.fillId));assert.equal(packet.chain.items.length,5);return f;}

export function validateLedger(packet,unknown,source){
 for(const p of [packet,unknown]){
  assert.equal(p.sourceCommit,source);assert.equal(p.actualTestnet,false);assert.equal(p.nativeProtocolCalls,1);
  const l=p.ledger,c=p.checkpoint;assert.deepEqual(validateFixture(l,{schema:'AssistedLedgerView'}),[]);
  assert.equal(l.valuationReady,false);assert.equal(l.executionAuthority,false);assert.equal(l.scope,'OBSERVED_NATIVE_FILLS_ONLY');
  assert.equal(l.ledgerHash,'sha256:'+hash(canonical(c)));assert.equal(c.schemaVersion,'quantos-native-ledger-checkpoint.v1');
  for(const key of ['tenantId','workspaceId','accountId'])assert.equal(c.scope[key],l[key]);
  assert.deepEqual(c.anchor,l.anchor);assert.equal(c.entries.length,1);assert.equal(l.entries.length,1);
  const e=c.entries[0],b=e.observation.body;assert.equal(e.sequence,1);assert.equal(e.previous,null);assert.equal(e.observation.kind,'facts');
  assert.equal(e.hash,'sha256:'+hash(canonical(['quantos-native-ledger-entry/v1',1,e.observation,null])));assert.equal(l.anchor.head,e.hash);assert.equal(l.entries[0].entryHash,e.hash);
  assert.equal(l.entries[0].sourceHash,b.sourceHash);assert.equal(l.entries[0].commandId,b.commandId);assert.equal(l.entries[0].requestId,b.requestId);assert.equal(l.entries[0].subjectHash,b.subjectHash);
  const {sourceHash,...body}=b;assert.equal(sourceHash,'sha256:'+hash(canonical(['quantos-native-execution-source/v1',body])));
 }
 const l=packet.ledger,f=packet.view.facts;assert.equal(packet.replicaRequests,12);assert.equal(packet.unchangedLedgerOnRead,true);assert.equal(packet.missingOrCorruptLedgerDenied,true);assert.equal(packet.staleReviewNewCommandDenied,true);assert.deepEqual(packet.restartLedger,l);
 assert.equal(l.consumerReady,true);assert.equal(l.appliedFillCount,1);assert.equal(l.quarantinedCommandCount,0);assert.equal(l.quoteFeesTotal,f.fills[0].feeAmount);assert.equal(l.positions[0].quantity,'1');assert.equal(l.quoteCashDelta,'-1000.01');assert.equal(l.positions[0].realizedPnl,'-0.01');assert.deepEqual(l.entries[0],packet.view.ledger);assert.equal(l.entries[0].sourceHash,f.sourceHash);assert.deepEqual(l.entries[0].appliedFillIds,f.fills.map(v=>v.fillId));assert.equal(l.entries[0].state,'applied');assert.deepEqual(packet.checkpoint.entries[0].observation.body,f);
 const u=unknown.ledger;assert.equal(unknown.restartPreserved,true);assert.equal(unknown.noReplayTrace,true);assert.equal(unknown.command.state,'unknown');assert.equal(u.consumerReady,false);assert.equal(u.appliedFillCount,0);assert.equal(u.quarantinedCommandCount,1);assert.deepEqual(u.positions,[]);assert.equal(u.entries[0].state,'quarantined');assert.equal(u.entries[0].reason,'OUTCOME_UNRESOLVED');assert.deepEqual(u.entries[0].appliedFillIds,[]);assert.equal(u.entries[0].commandId,unknown.command.commandId);
 return {appliedFillCount:1,quarantinedCommandCount:1,sourceAndCheckpointBound:true};
}


export function validateReconciliation(positive,unknown,alerts,source){
 for(const p of [positive,unknown]){
  assert.equal(p.sourceCommit,source);assert.equal(p.actualTestnet,false);assert.equal(p.protocolCalls,1);
  const v=p.view,c=p.checkpoint,b=p.observer.payload,certificate=new X509Certificate(p.observerCertificate);
  assert.deepEqual(validateFixture(v,{schema:'AssistedReconciliationView'}),[]);assert.equal(v.fullBooksReady,false);assert.equal(v.dayCloseAllowed,false);assert.equal(v.executionAuthority,false);assert.equal(v.mode,'assisted_live');assert.equal(v.coverage,'OBSERVED_EXECUTION_DELTAS_ONLY');
  assert.equal(v.booksSourceId,'sha256:'+hash(certificate.raw));assert.equal(b.sourceId,v.booksSourceId);assert.equal(b.records[0].httpStatus,200);
  assert(cryptoVerify('sha256',Buffer.from(canonical(['quantos-x05-independent-observer-signature/v1',b])),certificate.publicKey,Buffer.from(p.observer.signature,'hex')));
  assert.equal(v.booksHash,'sha256:'+hash(canonical(['quantos-x05-independent-protocol-journal/v1',b])));
  assert.equal(c.schemaVersion,'quantos-x05-current-checkpoint.v1');assert.deepEqual(c.anchor,v.anchor);assert.equal(c.frames.length,1);
  const f=c.frames[0],i=f.input;assert.deepEqual(i.books,b);assert.equal(f.sequence,1);assert.equal(f.previous,null);assert.equal(f.hash,'sha256:'+hash(canonical(['quantos-x05-current-frame/v1',1,i,null])));assert.equal(v.anchor.head,f.hash);
  assert.equal(v.ledgerHash,'sha256:'+hash(canonical(i.ledgerCheckpoint)));assert.equal(v.reportId,'sha256:'+hash(canonical(['quantos-x05-current-report/v1',i.scope,v.ledgerHash,v.booksHash,v.booksState,v.sourceBindings,v.findings])));
  for(const k of ['tenantId','workspaceId','accountId'])assert.equal(i.scope[k],v[k]);assert.equal(v.sourceBindings[0].sourceHash,i.sources[0].sourceHash);assert.equal(v.sourceBindings[0].commandId,b.records[0].commandId);assert.equal(v.ledgerHash,p.ledger.ledgerHash);
  assert(v.alertEvidence.every(e=>e.status==='OPEN'&&e.executionAuthority===false));assert.equal(v.openAlertEvidenceCount,v.alertEvidence.length);
 }
 assert.equal(positive.readOnly,true);assert.equal(positive.view.comparisonStatus,'MATCHED_OBSERVATIONS');assert.equal(positive.view.findings.length,0);assert.equal(positive.view.unknownObligationsOpen,0);assert.equal(positive.view.openAlertEvidenceCount,0);assert.equal(positive.view.sourceBindings[0].sourceHash,positive.nativeView.facts.sourceHash);assert.equal(positive.view.sourceBindings[0].ledgerEntryHash,positive.nativeView.ledger.entryHash);assert.notEqual(positive.view.booksHash,positive.nativeView.facts.sourceHash);
 assert.equal(unknown.noReplay,true);assert.equal(unknown.view.unknownObligationsOpen,1);assert.equal(unknown.view.comparisonStatus,'DIFFERENCES');assert.equal(unknown.ledger.appliedFillCount,0);assert(unknown.view.findings.some(f=>f.kind==='OUTCOME_UNRESOLVED'));assert(unknown.view.findings.some(f=>f.kind==='QUARANTINED_BOOK_OBSERVATION'&&f.observed.executedQuantity==='1'));assert(unknown.view.alertEvidence.some(e=>e.binding?.sourceHash===unknown.view.sourceBindings[0].sourceHash));
 assert.equal(alerts.sourceCommit,source);assert.equal(alerts.actualTestnet,false);assert.equal(alerts.automaticClosure,false);assert.equal(alerts.corruptStoreDenied,true);assert.deepEqual(alerts.restart,alerts.restored);assert.equal(alerts.unavailable.comparisonStatus,'UNAVAILABLE');assert.equal(alerts.restored.comparisonStatus,'MATCHED_OBSERVATIONS');assert.equal(alerts.unavailable.openAlertEvidenceCount,1);assert.equal(alerts.restored.openAlertEvidenceCount,1);assert.deepEqual(alerts.restored.alertEvidence,alerts.unavailable.alertEvidence);assert.equal(alerts.restored.alertEvidence[0].status,'OPEN');
 return {independentSignedObservation:true,unknownPreserved:true,alertEvidenceOpenAfterRecovery:true};
}

export function reviewedDigest(f,attempt,source,load=p=>read(p).toString()){const parts=f.File?.split('/positive/');if(parts?.length!==2||f.RuleID!=='generic-api-key'||f.StartLine!==f.EndLine||!Number.isInteger(f.StartLine)||f.StartLine<1)return null;const path=parts[1],prefix=attempt+'/browser/cases/';if(!path.startsWith(prefix)||!/^[-a-zA-Z0-9]+\/frontend-g8\.json$/.test(path.slice(prefix.length)))return null;const text=load(path),v=JSON.parse(text);if(v.sourceCommit!==source||!/^\s*"keyHash": "[a-f0-9]{64}",?$/.test(text.split('\n')[f.StartLine-1]??''))return null;return{path,line:f.StartLine,classification:'OWNED_IDEMPOTENCY_SHA256_NOT_CREDENTIAL',sourceCommit:source};}
export function reviewedClientId(f,attempt,source,load=p=>read(p).toString()){
 const parts=f.File?.split('/positive/');if(parts?.length!==2||f.RuleID!=='generic-api-key'||f.StartLine!==f.EndLine||!Number.isInteger(f.StartLine)||f.StartLine<1)return null;const path=parts[1];const allowed=['reconciliation.json','unknown-reconciliation.json','alert-evidence.json'];if(!allowed.some(n=>path===attempt+'/'+n||path===directory+'/preflight/'+n))return null;
 try{const raw=load(path),v=JSON.parse(raw);if(v.sourceCommit!==(path.includes('/preflight/')?base:source))return null;const line=raw.split('\n')[f.StartLine-1]??'',m=line.match(/^\s*"clientOrderId": "(q[a-f0-9]{31})",?$/);if(!m)return null;const ids=new Set();const visit=x=>{if(!x||typeof x!=='object')return;if(x.commandId&&x.response?.clientOrderId){const expected='q'+hash(canonical(['l01-client/v1',x.commandId,x.commandId])).slice(0,31);if(expected===x.response.clientOrderId)ids.add(expected);}for(const value of Object.values(x))visit(value);};visit(v);if(!ids.has(m[1]))return null;return{path,line:f.StartLine,classification:'OWNED_DERIVED_CLIENT_ORDER_ID_NOT_CREDENTIAL',sourceCommit:v.sourceCommit};}catch{return null;}
}
export function classifyFinding(f,attempt,source,load=p=>read(p).toString()){return reviewedDigest(f,attempt,source,load)??reviewedClientId(f,attempt,source,load);}
export function verify(r){assert.equal(r.schema,'quantos-core-x05-current-receipt/v1');assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(r.attempt));validateBoundary(r.boundary);verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.deepEqual(r.audit,audit());assert.deepEqual(json(r.attempt+'/scope.log'),r.audit);validateExecutions(r.executions,r.attempt);assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts){safe(f.path);assert.equal(hash(read(f.path)),f.sha256);}const rust={};for(const[id,want]of [['current-model',12],['legacy-x05',20],['ledger-model',10],['native-facts',7],['restricted-zone',4],['public-source',9],['public-process',3]]){const matches=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert(matches.length>0);rust[id]=matches.reduce((sum,m)=>sum+Number(m[1]),0);assert.equal(rust[id],want,id);assert.equal(matches.reduce((n,m)=>n+Number(m[2]),0),0,id+':ignored');}validateFacts(json(r.attempt+'/native-facts.json'),r.sourceCommit);validateLedger(json(r.attempt+'/native-ledger.json'),json(r.attempt+'/unknown-ledger.json'),r.sourceCommit);validateReconciliation(json(r.attempt+'/reconciliation.json'),json(r.attempt+'/unknown-reconciliation.json'),json(r.attempt+'/alert-evidence.json'),r.sourceCommit);assert.match(read(r.attempt+'/no-submit.log').toString(),/X05_NO_VENUE_SUBMIT_PATH=ABSENT/);for(const[id,want]of [['consumers',109],['contracts',130]]){const t=json(r.attempt+'/'+id+'.json');assert.equal(t.success,true);assert.equal(t.numPassedTests,want);assert.equal(t.numTotalTests,want);assert.equal(t.numPendingTests,0);}const flow=json(r.attempt+'/flow.json'),crash=json(r.attempt+'/crash.json');assert.equal(flow.nativeProtocolCalls,1);assert.equal(flow.unknownNotReissued,true);assert.equal(crash.noReplayTrace,true);for(const v of [flow,crash])assert.equal(v.sourceCommit,r.sourceCommit);const selected=name=>r.artifacts.filter(f=>f.path.endsWith('/'+name)).map(f=>json(f.path));const report=json(r.attempt+'/browser/report.json');assert.equal(report.stats.expected,4);for(const k of ['unexpected','skipped','flaky'])assert.equal(report.stats[k],0);assert.deepEqual(report.errors,[]);assert.equal(selected('core-l4-journey.json').length,1);validateBrowser(selected('core-l4-journey.json')[0],r.sourceCommit);assert.equal(selected('core-l4-off.json').length,1);validateOff(selected('core-l4-off.json')[0],r.sourceCommit);const ui=selected('core-x04-facts.json');assert.equal(ui.length,1);assert.equal(ui[0].sourceCommit,r.sourceCommit);assert.equal(ui[0].venueWrites,1);assert.equal(ui[0].facts.consumerReady,true);assert.equal(ui[0].facts.commandId,ui[0].commandId);assert.equal(ui[0].c10Payload.executionFactsHash,ui[0].facts.sourceHash);assert.deepEqual(ui[0].c10Payload.fillIds,ui[0].facts.fills.map(f=>f.fillId));const ledgerUi=selected('core-x01-ledger.json');assert.equal(ledgerUi.length,1);const lu=ledgerUi[0];assert.equal(lu.sourceCommit,r.sourceCommit);assert.equal(lu.venueWrites,1);assert.equal(lu.actualTestnet,false);assert.equal(lu.ledger.entries[0].sourceHash,lu.sourceHash);assert.equal(lu.ledger.entries[0].commandId,lu.commandId);assert.deepEqual(lu.ledger.entries[0].appliedFillIds,[lu.fillId]);assert.equal(lu.ledger.consumerReady,true);assert.equal(lu.ledger.valuationReady,false);const reconUi=selected('core-x05-reconciliation.json');assert.equal(reconUi.length,1);const ru=reconUi[0];assert.equal(ru.sourceCommit,r.sourceCommit);assert.equal(ru.actualTestnet,false);assert.equal(ru.venueWrites,1);assert.equal(ru.view.comparisonStatus,'MATCHED_OBSERVATIONS');assert.equal(ru.view.sourceBindings[0].commandId,ru.commandId);assert.equal(ru.view.sourceBindings[0].sourceHash,ru.sourceHash);assert.equal(ru.view.fullBooksReady,false);assert.equal(ru.view.dayCloseAllowed,false);const bins=json(r.attempt+'/binaries.json');assert.equal(bins.sourceCommit,r.sourceCommit);for(const f of bins.files)assert.equal(hash(read(f.path)),f.sha256);assert.equal(selected('frontend-g8.json').length,4);for(const b of selected('frontend-g8.json')){assert.equal(b.sourceCommit,r.sourceCommit);assert.equal(b.status,'passed');assert.equal(b.binarySha256,bins.files.find(f=>f.path==='target/debug/bff-gateway').sha256);}const axes=[...selected('core-l4-axe.json'),...selected('core-l4-c10-axe.json'),...selected('g8-current-axe.json')];assert.equal(axes.length,3);for(const a of axes){assert.equal(a.sourceCommit,r.sourceCommit);assert.equal(a.violations.length,0);}assert.equal(json(r.attempt+'/web-build.json').buildId,'terminal-'+r.sourceCommit);const node=read(r.attempt+'/gate-tests.log').toString();assert.match(node,/# fail 0/);assert.match(node,/# skipped 0/);assert.equal(node.match(/# tests (\d+)/)[1],node.match(/# pass (\d+)/)[1]);for(const id of ['integration-refusal','l4-refusal'])assert.equal(json(r.attempt+'/'+id+'.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/release-refusal.log').reason,'USE_FROZEN_RELEASE_ACCEPTANCE_GATE');assert.equal(json(r.attempt+'/next-development.log').allowed,true);const scan=json(r.attempt+'/secret-scan.log'),raw=json(r.attempt+'/secret-report.json'),reviewed=raw.map(f=>classifyFinding(f,r.attempt,r.sourceCommit));assert(reviewed.every(Boolean));assert.deepEqual(json(r.attempt+'/secret-digest-review.json'),{rawFindings:raw.length,reviewed});assert.equal(scan.unreviewedFindings,0);assert.equal(scan.actualCanaryRefusals,1);return{sourceCommit:r.sourceCommit,...boundary(),checks:checks.length,rustCases:rust,rustTotal:Object.values(rust).reduce((a,b)=>a+b,0),consumers:109,contracts:130,nodeCases:Number(node.match(/# pass (\d+)/)[1]),chromiumCases:4,axeScans:3,axeIncomplete:axes.reduce((n,a)=>n+a.incomplete.length,0),releasePerformanceIgnored:0,stageGatesPreserved:159};}
export function scan(attempt){assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));const source=git('rev-parse','HEAD').trim(),paths=[...new Set([...git('diff','--name-only',base,'HEAD').trim().split('\n').filter(Boolean),...files(attempt)])].sort(),temp=mkdtempSync(join(tmpdir(),'quantos-x04-scan-')),env=webEnvironment(),tool='artifacts/tools/gitleaks';try{const config=resolve(attempt+'/secret-config.toml');writeFileSync(config,read('.gitleaks.toml'));for(const p of paths){safe(p);const out=join(temp,'positive',p);mkdirSync(dirname(out),{recursive:true});copyFileSync(p,out);}assert.equal(execFileSync(tool,['version'],{env,encoding:'utf8'}).trim(),'8.28.0');const run=(kind,name)=>spawnSync(tool,['dir',join(temp,kind),'--config',config,'--redact','--no-banner','--report-format','json','--report-path',resolve(attempt+'/'+name)],{env,encoding:'utf8',timeout:60000});const good=run('positive','secret-report.json');writeFileSync(attempt+'/gitleaks.log',good.stdout+good.stderr);const findings=json(attempt+'/secret-report.json');assert.equal(good.status,findings.length?1:0);const reviewed=findings.map(f=>classifyFinding(f,attempt,source));assert(reviewed.every(Boolean),'unreviewed secret finding');write(attempt+'/secret-digest-review.json',{rawFindings:findings.length,reviewed});mkdirSync(join(temp,'negative'));writeFileSync(join(temp,'negative/probe.rs'),'api_key = '+JSON.stringify(randomBytes(32).toString('hex'))+';\n');const bad=run('negative','secret-negative.json');writeFileSync(attempt+'/gitleaks-negative.log',bad.stdout+bad.stderr);assert.equal(bad.status,1);assert.equal(json(attempt+'/secret-negative.json').length,1);return{scope:'CURRENT_TASK_DIFF_AND_ATTEMPT_NOT_WHOLE_REPOSITORY',files:paths.length,rawFindings:findings.length,reviewedDigestFindings:reviewed.length,unreviewedFindings:0,actualCanaryRefusals:1,binarySha256:hash(read(tool))};}finally{rmSync(temp,{recursive:true,force:true});}}
export function run(attempt){assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'fresh attempt required');assert(!readdirSync('apps/terminal').some(p=>/^\.env(?:\.|$)/.test(p)&&!p.endsWith('.example')));const sourceCommit=git('rev-parse','HEAD').trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});write(attempt+'/inputs.json',{sourceCommit,inputs:sourceInputs});const env={...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET:'off',GITHUB_SHA:sourceCommit,CI:'1',QUANTOS_SKIP_ENV:'1',CARGO_NET_OFFLINE:'true',QUANTOS_L02_FIXTURE_EXECUTABLE:resolve('target/debug/execution-gateway'),QUANTOS_CORE_L04_RESULT:resolve(attempt+'/flow.json'),QUANTOS_CORE_L04_C10_RESULT:resolve(attempt+'/c10.json'),QUANTOS_CORE_L04_CRASH_RESULT:resolve(attempt+'/crash.json'),QUANTOS_CORE_X04_FACTS_RESULT:resolve(attempt+'/native-facts.json'),QUANTOS_CORE_X01_LEDGER_RESULT:resolve(attempt+'/native-ledger.json'),QUANTOS_CORE_X01_UNKNOWN_RESULT:resolve(attempt+'/unknown-ledger.json'),QUANTOS_CORE_X05_RECONCILIATION_RESULT:resolve(attempt+'/reconciliation.json'),QUANTOS_CORE_X05_UNKNOWN_RESULT:resolve(attempt+'/unknown-reconciliation.json'),QUANTOS_CORE_X05_ALERT_RESULT:resolve(attempt+'/alert-evidence.json'),PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/browser/report.json')},executions=[];for(const[id,args,want=0]of checks){const command=args.map(a=>a.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:96e6,timeout:300000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});write(attempt+'/executions.json',executions);console.log(id,out.status);if(out.status!==want){write(attempt+'/failure.json',{sourceCommit,status:'FAIL',failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])});throw Error('see '+log);}if(id==='build')write(attempt+'/binaries.json',{sourceCommit,files:['target/debug/bff-gateway','target/debug/execution-gateway'].map(path=>({path,sha256:hash(read(path))}))});if(id==='web-build')writeFileSync(attempt+'/web-build.json',read('apps/terminal/out/pre03-build.json'));}const r={schema:'quantos-core-x05-current-receipt/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,audit:audit(),attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};let result;try{result=verify(r);}catch(e){write(attempt+'/verification-failure.json',{sourceCommit,status:'FAIL',error:e.stack});throw e;}write(directory+'/receipt.json',r);write(directory+'/result.json',result);console.log(JSON.stringify(result));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else if(process.argv[2]==='--verify')console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));else if(process.argv[2]==='--audit')console.log(JSON.stringify(audit()));else if(process.argv[2]==='--scan')console.log(JSON.stringify(scan(process.argv[3])));else throw Error('Use --run <fresh attempt>, --verify, --audit or --scan');}catch(e){console.error(e.stack);process.exitCode=1;}}
