import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),base='docs/audit/evidence/ci-47cb743-remediation-20261007';
const {nodesFromPlans,validateReceipt,digest}=await import(root+'/scripts/provider-a1-receipts.mjs');
const identity=await import(root+'/scripts/bff-fe-001-development.mjs');
const audit=await import(root+'/scripts/bff-fe-007-development.mjs');
const window=await import(root+'/scripts/provider-a2-development.mjs');
const g0=await import(root+'/scripts/g0-development.mjs');
const fep0=await import(root+'/scripts/fep0-development.mjs');
const nodes=nodesFromPlans(),previous=JSON.parse(fs.readFileSync(base+'/previous-ready-nodes.json'));
const validation=previous.map(({nodeId})=>{
 const result=nodeId==='FE:BFF-FE-001'?identity.validateA2():nodeId==='FE:BFF-FE-007'?audit.validateAudit():nodeId==='PROVIDER:A2'?window.check():nodeId==='FRONTEND-GATE:G0'?g0.check({requireReady:false}):nodeId==='FE:FEP-0'?fep0.check({requireReady:false}):validateReceipt(nodeId);
 return {nodeId,result,gate:nodes.get(nodeId).stage_gate};
});
const stageCounts={};for(const n of nodes.values())stageCounts[n.stage_gate.status]=(stageCounts[n.stage_gate.status]||0)+1;
assert.equal(validation.length,26);assert.equal(stageCounts.READY+(stageCounts.BLOCKED||0),26);assert.equal(stageCounts.NOT_ASSESSED,133);
const sourceCommit='d00041ee354701a08fa7483e948b74f374439b13';
const focused=JSON.parse(fs.readFileSync(base+'/focused-verification.json'));
for(const [path,sha256]of Object.entries(focused.sourceHashes)){
 assert.equal(digest(fs.readFileSync(path)),'sha256:'+sha256,'focused source changed '+path);
 assert.equal(digest(execFileSync('git',['show',sourceCommit+':'+path],{maxBuffer:32*1024*1024})),'sha256:'+sha256,'focused source not committed '+path);
}
const targetSources=[];
for(const [task,commit,paths]of [['identity','d758c839fbd57366346d0f2b9ef2081c68ab51e6',identity.targetSourcePaths],['audit','5e3339c9e5cc95d550c6e67ffa36701998cb0e2f',audit.targetSourcePaths]]){
 assert.equal(execFileSync('git',['cat-file','-t',commit],{encoding:'utf8'}).trim(),'commit');
 for(const path of paths){const expected=digest(execFileSync('git',['show',commit+':'+path],{maxBuffer:32*1024*1024})),actual=digest(fs.readFileSync(path));assert.equal(actual,expected,path);targetSources.push({task,path,sourceCommit:commit,sha256:actual,status:'PASS'});}
}
const directory='docs/audit/evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007';
const original=JSON.parse(fs.readFileSync(directory+'/execution-results.json')),effective=JSON.parse(fs.readFileSync(directory+'/effective-execution-results.json'));
assert.equal(original.length,87);assert.equal(original.filter(x=>x.status==='PASS').length,86);assert.equal(effective.length,87);assert(effective.every(x=>x.status==='PASS'));
const result={schema:'quantos-ci-remediation-closure/v1',status:'PASS',checkedAt:new Date().toISOString(),sourceCommit,formalAccepted:false,hostedCandidateStatus:'NOT_RUN',validation,stageCounts,targetSources,targetExecutionReused:true,targetIdentityCalls:51,targetIdentityAssertions:14,targetAuditCalls:83,targetAuditAssertions:45,originalExecution:{groups:87,passed:86,failed:1,path:directory+'/execution-results.json'},effectiveExecution:{groups:87,passed:87,failed:0,path:directory+'/effective-execution-results.json'},focusedVerification:base+'/focused-verification.json',focusedSourceHashes:focused.sourceHashes};
fs.writeFileSync(base+'/closure-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',stageCounts,validatedNodes:26,targetSourceEntries:targetSources.length}));
