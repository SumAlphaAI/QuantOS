#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { root, digest, inventory, confined, nodesFromPlans, planInput, validateReceipt, publishStages, developmentEnvironment, staticEnvironment } from './provider-a1-receipts.mjs';
import { sourceDigest } from './pre03-build-receipt.mjs';
export const evidenceDirectory='docs/audit/evidence/frontend-g0-remediation-20261005';
const read=p=>readFileSync(confined(p),'utf8');
const json=p=>JSON.parse(read(p));
export const requiredRoles=['Product','Frontend','BFF','QA','Security','Risk'];
export const requiredChecks=['records','pre01','pre01-negative','boundary-negative','g0-negative','baseline','generated','proto','frontend-lint','frontend-types','auth-client-contract','sse','web-build','web-oidc-poc','js-budget','linux-baselines'];
export function policy(){
 const p=json('scripts/g0-policy.json');assert.equal(p.schema,'quantos-g0-development-policy/v1');assert.deepEqual(p.roles,requiredRoles,'six G0 role obligations must remain');assert.deepEqual(Object.keys(p.checks),requiredChecks,'G0 check obligations must remain');return p;
}
export function scopeRequest(p=policy()) {
 const openapi=parse(read('bff/openapi/quantos-bff.v1.yaml'));
 const catalog=parse(read('bff/page-operation-catalog.yaml'));
 const snapshot={schema:'quantos-g0-scope-request/v1',stage:'DEVELOPMENT',scope:p.scope,openapiVersion:openapi.info.version,platform:'phase-one Web',
  publishedOperations:Object.values(catalog.contracts).flatMap(c=>c.publishedOperations).sort(),plannedExcluded:Object.values(catalog.contracts).flatMap(c=>c.plannedOperations).sort(),
  excluded:p.excluded,requiredRoles:p.roles,inputs:inventory(p.inputSelectors)};
 return {...snapshot,scopeDigest:digest(JSON.stringify(snapshot))};
}
export function validateConfirmations(c,request,p=policy(),readRecord=path=>readFileSync(confined(path))) {
 assert.equal(c.schema,'quantos-g0-scope-confirmations/v1');
 if(c.status==='PENDING'){assert.equal(c.scopeDigest,null);assert.deepEqual(c.roles,[]);assert(c.reason?.trim());return {status:'PENDING',missingRoles:p.roles};}
 assert.equal(c.status,'CONFIRMED');assert.equal(c.scopeDigest,request.scopeDigest,'scope confirmation input digest changed');
 assert.deepEqual(c.roles.map(r=>r.role).sort(),[...p.roles].sort(),'six current roles required exactly once');
 for(const role of c.roles){assert(role.identity?.trim() && role.authorization?.trim(),'role identity and authority required');assert(Number.isFinite(Date.parse(role.confirmedAt)) && Date.parse(role.confirmedAt)>Date.parse('2026-08-14T23:59:59Z') && Date.parse(role.confirmedAt)<=Date.now(),'current confirmation timestamp required');
  assert.equal(role.scopeDigest,request.scopeDigest);assert(role.record && role.recordSha256,'actual confirmation record required');assert(!role.record.startsWith('/')&&!role.record.includes('..')&&!role.record.includes(':'),'unsafe scope confirmation record');const bytes=readRecord(role.record);assert.equal(digest(bytes),role.recordSha256,'confirmation record changed');
  const record=JSON.parse(bytes);for(const key of ['role','identity','authorization','confirmedAt','scopeDigest'])assert.equal(record[key],role[key],`role record ${key} mismatch`);assert.equal(record.decision,'CONFIRMED');assert.equal(record.stage,'DEVELOPMENT');
 }
 return {status:'CONFIRMED',missingRoles:[]};
}
export function validateManifest(m,{p=policy(),request=scopeRequest(p),confirmations=json('docs/gate-records/G0-current-scope-confirmations.json'),nodes=nodesFromPlans(),readBytes=path=>readFileSync(confined(path)),validateDependency=id=>validateReceipt(id,{nodes}),requireReady=false}={}) {
 const n=nodes.get('FRONTEND-GATE:G0');assert(n,'G0 checkpoint missing');
 assert.equal(m.schema,'quantos-g0-development-manifest/v1');assert.equal(m.nodeId,n.id);assert.equal(m.stage,'DEVELOPMENT');assert.equal(m.formalAccepted,false);assert.equal(m.engineeringStatus,'PASS');
 assert.deepEqual(m.planInput,planInput(n),'G0 functional plan changed');assert.deepEqual(m.scopeRequest,request,'G0 functional input inventory changed');
 assert.deepEqual(m.excluded,p.excluded);assert(/^[a-f0-9]{40}$/.test(m.observedSourceCommit),'G0 execution source required');
 assert(m.environment?.node && m.environment?.pnpm && m.environment?.platform && m.environment?.profile==='local-mock','G0 execution environment missing');
 const scope=validateConfirmations(confirmations,request,p);assert.deepEqual(m.confirmations,scope,'scope confirmation state changed');
 assert.equal(m.confirmationsSha256,digest(readBytes('docs/gate-records/G0-current-scope-confirmations.json')),'confirmation file changed');
 const status=scope.status==='CONFIRMED'?'READY':'BLOCKED';assert.equal(m.status,status,'G0 READY requires current scope confirmation');
 assert.deepEqual(m.residuals,status==='READY'?[]:['M-01: current six-role development scope confirmation missing'],'G0 residual inventory differs');
 assert.deepEqual(m.checks.map(c=>c.id).sort(),Object.keys(p.checks).sort(),'G0 required functional execution missing or extra');
 for(const c of m.checks){const spec=p.checks[c.id];assert.deepEqual(c.command,spec.command,'G0 command differs from required check');assert.equal(c.exitCode,0,'G0 failed or unexecuted check');assert.equal(c.status,'PASS');assert(Number.isFinite(Date.parse(c.executedAt)) && Date.parse(c.executedAt)<=Date.now(),'G0 execution timestamp missing');
  assert(c.log.startsWith(evidenceDirectory+'/logs/'),'G0 log path outside evidence directory');const bytes=readBytes(c.log);assert.equal(digest(bytes),c.logSha256,'G0 log content changed');assert(new RegExp(spec.marker).test(bytes.toString()),`G0 execution marker missing ${c.id}`);
 }
 assert.equal(m.webBuild.schema,'quantos-pre03-build/v1');assert.equal(m.webBuild.app,'terminal');assert.equal(m.webBuild.output,'export');assert(m.webBuild.buildId);assert.equal(m.webBuild.sourceDigest,sourceDigest(root,developmentEnvironment(read(p.developmentProfile.file),p.developmentProfile.overrides)),'G0 Web PoC build source changed');
 assert.equal(m.webBuildSha256,digest(readBytes(evidenceDirectory+'/terminal-build.json')),'G0 build artifact changed');assert.deepEqual(JSON.parse(readBytes(evidenceDirectory+'/terminal-build.json')),m.webBuild);
 assert.deepEqual(m.dependencies.map(d=>d.nodeId).sort(),[...n.dependencies].sort(),'G0 dependency receipt missing');
 for(const d of m.dependencies){const dep=nodes.get(d.nodeId);assert.equal(dep.stage_gate.status,'READY','G0 dependency not READY');assert.equal(d.inputDigest,dep.stage_gate.input_digest,'G0 dependency digest changed');assert.equal(d.manifest,'docs/'+dep.stage_gate.evidence[0]);validateDependency(d.nodeId);}
 if(requireReady)assert.equal(status,'READY','G0 BLOCKED: current six-role scope confirmation missing');
 return {nodeId:n.id,engineeringStatus:'PASS',status,formalAccepted:false,missingRoles:scope.missingRoles,checks:m.checks.length};
}
export function check({requireReady=false}={}) {
 const nodes=nodesFromPlans();const gate=nodes.get('FRONTEND-GATE:G0').stage_gate;
 assert(['READY','BLOCKED'].includes(gate.status),'G0 functional assessment absent');assert.equal(gate.stage,'DEVELOPMENT');assert.equal(gate.evidence.length,1);
 assert.equal('docs/'+gate.evidence[0],evidenceDirectory+'/g0.json','G0 cannot accept arbitrary/historical receipt');const bytes=readFileSync(confined('docs/'+gate.evidence[0]));assert.equal(digest(bytes),gate.input_digest,'G0 manifest digest mismatch');const m=JSON.parse(bytes);assert.equal(m.status,gate.status,'G0 plan/receipt status mismatch');return validateManifest(m,{nodes,requireReady});
}
export function assertG0ExecutionSnapshot(before,after,originalNode,currentNode) {
 assert.deepEqual(after,before,'G0 inputs changed during execution');
 assert.deepEqual(planInput(currentNode),planInput(originalNode),'G0 normative plan changed during execution');
}
export function assess() {
 const p=policy();const nodes=nodesFromPlans();const n=nodes.get('FRONTEND-GATE:G0');for(const dep of n.dependencies)validateReceipt(dep,{nodes});
 const before=scopeRequest(p);const confirmations=json('docs/gate-records/G0-current-scope-confirmations.json');const confirmed=validateConfirmations(confirmations,before,p);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert(dirty.every(line=>/^.. (?:docs\/audit\/|docs\/SumAlpha-QuantOS-(?:Frontend-Development-Execution|Development)-Plan\.md$)/.test(line)),'commit functional source before G0 execution');
 const env=staticEnvironment(developmentEnvironment(read(p.developmentProfile.file),p.developmentProfile.overrides));env.CI='true';
 mkdirSync(resolve(root,evidenceDirectory,'logs'),{recursive:true});const checks=[];
 for(const [id,spec]of Object.entries(p.checks)){
  const executedAt=new Date().toISOString();const result=spawnSync(spec.command[0]==='node'?process.execPath:spec.command[0],spec.command.slice(1),{cwd:root,env,encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024});
  const output=(result.stdout??'')+(result.stderr??'');const log=evidenceDirectory+'/logs/'+id+'.log';writeFileSync(resolve(root,log),output);checks.push({id,command:spec.command,executedAt,status:result.status===0?'PASS':'FAIL',exitCode:result.status,log,logSha256:digest(output)});console.log(id,result.status);
  writeFileSync(resolve(root,evidenceDirectory,'execution-results.json'),JSON.stringify(checks,null,2)+'\n');assert.equal(result.status,0,`G0 check failed ${id}; see ${log}`);assert(new RegExp(spec.marker).test(output),`G0 execution marker missing ${id}`);
 }
 const after=scopeRequest(p);const currentNodes=nodesFromPlans();assertG0ExecutionSnapshot(before,after,n,currentNodes.get(n.id));assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,'G0 source commit changed during execution');
 const buildBytes=readFileSync(resolve(root,'apps/terminal/out/pre03-build.json'));writeFileSync(resolve(root,evidenceDirectory,'terminal-build.json'),buildBytes);
 const m={schema:'quantos-g0-development-manifest/v1',nodeId:n.id,stage:'DEVELOPMENT',status:confirmed.status==='CONFIRMED'?'READY':'BLOCKED',engineeringStatus:'PASS',formalAccepted:false,observedSourceCommit:source,
  environment:{node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,profile:'local-mock',databaseExecuted:false},planInput:planInput(n),scopeRequest:before,confirmations:confirmed,confirmationsSha256:digest(readFileSync(confined('docs/gate-records/G0-current-scope-confirmations.json'))),checks,
  webBuild:JSON.parse(buildBytes),webBuildSha256:digest(buildBytes),dependencies:n.dependencies.map(id=>({nodeId:id,inputDigest:nodes.get(id).stage_gate.input_digest,manifest:'docs/'+nodes.get(id).stage_gate.evidence[0]})),excluded:p.excluded,residuals:confirmed.status==='CONFIRMED'?[]:['M-01: current six-role development scope confirmation missing']};
 validateManifest(m,{nodes:currentNodes});const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,evidenceDirectory,'g0.json'),bytes);
 n.stage_gate={stage:'DEVELOPMENT',status:m.status,input_digest:digest(bytes),evidence:[evidenceDirectory.slice(5)+'/g0.json']};
 const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';writeFileSync(resolve(root,plan),publishStages(read(plan),new Map([[n.id,n]]),'FE:'));
 writeFileSync(resolve(root,evidenceDirectory,'scope-request.json'),JSON.stringify(before,null,2)+'\n');console.log(JSON.stringify(check(),null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const mode=process.argv[2];assert(['--engineering','--ready','--assess','--scope',undefined].includes(mode),'unknown G0 mode');if(mode==='--assess')assess();else if(mode==='--scope')console.log(JSON.stringify(scopeRequest(),null,2));else console.log(JSON.stringify(check({requireReady:mode!=='--engineering'}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
