import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {validateUserConfirmation,bytesDigest as hash} from './user-acceptance-confirmation.mjs';
import {verifyInputs} from './g1-download-review.mjs';
import {validateWorker,validateRegistration,validateChain} from './g3-integration-01-review.mjs';
export const directory='docs/audit/evidence/g3-integration-01-confirmation-20261023';
export const original='docs/audit/evidence/g3-integration-01-20261023';
export const source='696bef717390fea9646c8d54094665f1bdc14d44',packet='156f21c568a53869e25b774005a236bfd1c5e7c9';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const committed=p=>execFileSync('git',['show',packet+':'+p],{maxBuffer:96e6});
const rawText='确认接受 G3-INTEGRATION-01 限定候选 696bef71 及待确认文稿，证据包绑定 156f21c5，保存确认原文与摘要，保留历史 incomplete、全部 NOT_RUN 和完整 G3 未放行状态。';
export function validateRecord(r,raw){
 assert.equal(r.request.nodeId,'G3-INTEGRATION-01');assert.equal(r.request.stage,'INTEGRATION');assert.equal(r.request.sourceCommit,source);
 assert.equal(r.document,original+'/confirmation-draft.md');assert.equal(r.originalScope.path,original+'/scope.json');
 assert.equal(r.documentCommit,packet);assert.equal(r.packetCommit,packet);assert.equal(r.confirmationSource.text,rawText);assert.equal(raw,rawText+'\n');
 for(const[k,v]of Object.entries({scopeAdmission:'G3_INTEGRATION_01_OWNED_LOCAL_WORKER_CAUSAL_ONLY',fullG3Admission:'NOT_GRANTED',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED',allNotRunRetained:true,functionRerun:false,productionCredentialsUsed:false,pushed:false,deployed:false}))assert.deepEqual(r[k],v,k);
 const scope=JSON.parse(committed(original+'/scope.json'));
 for(const key of ['incomplete','notRun','historicalAdditionalNotRun','currentExecution','g3Gate','coreS04Gate'])assert.deepEqual(r[key],scope[key],key);
 assert.deepEqual(r.request,scope.request);
}
function verifyOriginalEvidence(r){
 const old=json(original+'/receipt.json');assert.equal(old.confirmation,'PENDING');assert.equal(old.sourceCommit,source);assert.equal(hash(JSON.stringify(old.inputs)),r.request.inputsDigest);assert.equal(old.inputs.length,1928);verifyInputs(source,old.inputs);
 assert.equal(old.executions.length,17);assert.equal(new Set(old.executions.map(e=>e.id)).size,17);
 for(const e of old.executions){assert.equal(e.exitCode,['g3-refusal','s04-refusal'].includes(e.id)?1:0,e.id);assert.equal(e.expectedExitCode,e.exitCode);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);}
 assert.equal(old.artifacts.length,211);for(const f of old.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 const log=read(old.attempt+'/bff-composition.log').toString(),matches=[...log.matchAll(/^G3_R03_WORKER_EVIDENCE=(.+)$/gm)];assert.equal(matches.length,1);validateWorker(JSON.parse(matches[0][1]),source);
 assert.match(log,/test result: ok\. 230 passed; 0 failed; 2 ignored/);
 for(const[name,count]of [['browser-worker',24],['browser-regression',20]]){const b=json(old.attempt+'/'+name+'/report.json');assert.deepEqual({expected:b.stats.expected,unexpected:b.stats.unexpected,skipped:b.stats.skipped,flaky:b.stats.flaky},{expected:count,unexpected:0,skipped:0,flaky:0});assert.deepEqual(b.errors,[]);const flatten=s=>[...(s.specs??[]),...(s.suites??[]).flatMap(flatten)],tests=b.suites.flatMap(flatten).flatMap(s=>s.tests);assert.equal(tests.length,count);for(const t of tests){assert.equal(t.projectName,'chromium');assert.equal(t.results.length,1);assert.equal(t.results[0].status,'passed');}}
 const chains=old.artifacts.filter(f=>f.path.endsWith('/r03-causal-chain.json'));assert.equal(chains.length,20);for(const f of chains){const v=json(f.path);validateRegistration(v.registration);validateChain(v.chain);assert.equal(v.chain.correlationId,v.registration.correlationId);}
 for(const id of ['g3-refusal','s04-refusal'])assert.equal(json(old.attempt+'/'+id+'.log').allowed,false);
 const result=json(original+'/verification.json');assert.equal(result.sourceCommit,source);assert.equal(result.chromiumCases,44);assert.equal(result.currentIncomplete,36);assert.equal(result.confirmation,'PENDING');return{sourceInputs:1928,originalCommands:17,originalArtifacts:211,workerJourneys:20,chromiumCases:44,businessRerun:false};
}
export function verify(){
 const approval=json(directory+'/approval.json'),r=json(approval.record);validateUserConfirmation(approval,r.request);validateRecord(r,read(r.confirmationSource.rawRecord).toString());
 const m=json(r.approvedTechnicalManifest.path);assert.equal(hash(read(r.approvedTechnicalManifest.path)),r.approvedTechnicalManifest.sha256);assert.equal(m.sourceCommit,source);assert.equal(m.packetCommit,packet);
 const oldManifest=json(original+'/manifest.json');const paths=[...execFileSync('git',['ls-tree','-r','--name-only',packet,'--',original],{encoding:'utf8'}).trim().split('\n'),...oldManifest.externalFiles].sort();assert.equal(paths.length,395);assert.deepEqual(m.files.map(f=>f.path),paths);
 for(const f of m.files){assert.equal(hash(committed(f.path)),f.sha256,f.path);if(f.path!=='.gitattributes')assert.equal(hash(read(f.path)),f.sha256,f.path);}
 for(const f of oldManifest.files)assert.equal(hash(committed(f.path)),f.sha256,f.path);assert.equal(hash(read(original+'/receipt.json')),oldManifest.receiptSha256);
 assert.equal(hash(read(r.originalScope.path)),r.originalScope.sha256);const evidence=verifyOriginalEvidence(r);
 return{status:'CONFIRMED',scopeAdmission:r.scopeAdmission,sourceCommit:source,packetCommit:packet,originalFiles:paths.length,...evidence,incomplete:r.incomplete,allNotRunRetained:true,g3Gate:r.g3Gate,coreS04Gate:r.coreS04Gate,stageGate:r.stageGate,formalAccepted:false,runtimeAdmission:'DENIED',currentHeadAcceptance:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(verify()));}catch(e){console.error(e.stack);process.exitCode=1;}}
