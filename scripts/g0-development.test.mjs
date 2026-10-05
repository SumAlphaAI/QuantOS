import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { policy, scopeRequest, validateConfirmations, validateManifest, assertG0ExecutionSnapshot, assertG0Worktree, evidenceDirectory } from './g0-development.mjs';
import { digest, nodesFromPlans, planInput, developmentEnvironment, root } from './provider-a1-receipts.mjs';
import { sourceDigest } from './pre03-build-receipt.mjs';
const p=policy();
function fixture(){
 const nodes=nodesFromPlans();const request=scopeRequest(p);const confirmations={schema:'quantos-g0-scope-confirmations/v1',status:'PENDING',scopeDigest:null,roles:[],reason:'Human confirmed current six-role records absent'};
 const logs=new Map();logs.set('docs/gate-records/G0-current-scope-confirmations.json',Buffer.from(JSON.stringify(confirmations)));
 const webBuild={schema:'quantos-pre03-build/v1',app:'terminal',output:'export',buildId:'fixture',sourceDigest:sourceDigest(root,developmentEnvironment(readFileSync(p.developmentProfile.file,'utf8'),p.developmentProfile.overrides))};
 logs.set(evidenceDirectory+'/terminal-build.json',Buffer.from(JSON.stringify(webBuild)));
 const checks=Object.entries(p.checks).map(([id,spec])=>{const log=evidenceDirectory+'/logs/'+id+'.log';const output=Buffer.from(spec.marker.replace('.*','fixture'));logs.set(log,output);return {id,command:spec.command,status:'PASS',exitCode:0,executedAt:new Date().toISOString(),log,logSha256:digest(output)};});
 const n=nodes.get('FRONTEND-GATE:G0');const m={schema:'quantos-g0-development-manifest/v1',nodeId:n.id,stage:'DEVELOPMENT',status:'BLOCKED',formalAccepted:false,engineeringStatus:'PASS',observedSourceCommit:'a'.repeat(40),environment:{node:'24',pnpm:'10',platform:'fixture',profile:'local-mock',protoBaseline:'b'.repeat(40)},planInput:planInput(n),scopeRequest:structuredClone(request),checks,
  confirmations:{status:'PENDING',missingRoles:p.roles},confirmationsSha256:digest(logs.get('docs/gate-records/G0-current-scope-confirmations.json')),excluded:p.excluded,residuals:['M-01: current six-role development scope confirmation missing'],webBuild,webBuildSha256:digest(logs.get(evidenceDirectory+'/terminal-build.json')),dependencies:n.dependencies.map(id=>({nodeId:id,inputDigest:nodes.get(id).stage_gate.input_digest,manifest:'docs/'+nodes.get(id).stage_gate.evidence[0]}))};
 return {m,logs,nodes,options:{p,request,confirmations,nodes,readBytes:path=>{assert(logs.has(path),'fixture path missing');return logs.get(path);},validateDependency:()=>{}}};
}
test('complete engineering checks retain BLOCKED while scope confirmation is absent',()=>{const f=fixture();assert.equal(validateManifest(f.m,f.options).status,'BLOCKED');});
test('strict acceptance rejects pending current six-role scope',()=>{const f=fixture();assert.throws(()=>validateManifest(f.m,{...f.options,requireReady:true}),/G0 BLOCKED/);});
for(const [name,mutate,error]of [
 ['missing explicit proto baseline',f=>delete f.m.environment.protoBaseline,/explicit proto baseline/],
 ['same-head proto baseline',f=>f.m.environment.protoBaseline=f.m.observedSourceCommit,/explicit proto baseline/],
 ['fabricated READY',f=>f.m.status='READY',/requires current scope/],
 ['historical arbitrary manifest',f=>f.m.schema='historical-g0',/quantos-g0-development/],
 ['missing actual check',f=>f.m.checks.pop(),/required functional execution/],
 ['duplicate actual check',f=>f.m.checks.push(f.m.checks[0]),/required functional execution/],
 ['failed check',f=>f.m.checks[0].exitCode=1,/failed or unexecuted/],
 ['unexecuted check',f=>f.m.checks[0].executedAt=null,/execution timestamp/],
 ['wrong command',f=>f.m.checks[0].command=['true'],/command differs/],
 ['source inventory drift',f=>f.m.scopeRequest.inputs.pop(),/functional input inventory/],
 ['planned scope delivered claim',f=>f.m.scopeRequest.plannedExcluded=[],/functional input inventory/],
 ['log tampering',f=>f.logs.set(f.m.checks[0].log,Buffer.from('fake')),/log content changed/],
 ['arbitrary rehashed prose',f=>{const c=f.m.checks[0];f.logs.set(c.log,Buffer.from('some audit text'));c.logSha256=digest(f.logs.get(c.log));},/execution marker/],
 ['wrong Web build source',f=>f.m.webBuild.sourceDigest='bad',/Web PoC build source/],
 ['missing dependency',f=>f.m.dependencies.pop(),/dependency receipt missing/],
 ['dependency digest drift',f=>f.m.dependencies[0].inputDigest=digest('fake'),/dependency digest changed/],
 ['unready upstream',f=>f.nodes.get(f.m.dependencies[0].nodeId).stage_gate.status='BLOCKED',/dependency not READY/],
 ['hidden scope residual',f=>f.m.residuals=[],/residual inventory/],
])test(`G0 rejects ${name}`,()=>{const f=fixture();mutate(f);assert.throws(()=>validateManifest(f.m,f.options),error);});
test('pending scope cannot incorporate historical six-role claims',()=>{const request=scopeRequest(p);assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v1',status:'PENDING',scopeDigest:null,reason:'pending',roles:p.roles.map(role=>({role}))},request,p));});
test('confirmed scope must bind current input digest',()=>assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v1',status:'CONFIRMED',scopeDigest:digest('old'),roles:[]},scopeRequest(p),p),/input digest changed/));
test('confirmed scope requires all six current roles',()=>{const request=scopeRequest(p);assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v1',status:'CONFIRMED',scopeDigest:request.scopeDigest,roles:[]},request,p),/six current roles/);});
test('dependency validation is actually invoked and failures propagate',()=>{const f=fixture();assert.throws(()=>validateManifest(f.m,{...f.options,validateDependency:()=>{throw new Error('upstream execution invalid');}}),/upstream execution invalid/);});

function confirmedFixture(){const request=scopeRequest(p);const records=new Map();const roles=p.roles.map(role=>{const raw={role,identity:'test-fixture-'+role,authorization:'unit-test-only; no organizational authority',confirmedAt:new Date().toISOString(),scopeDigest:request.scopeDigest,decision:'CONFIRMED',stage:'DEVELOPMENT'};const record=`docs/gate-records/test-${role}.json`;records.set(record,Buffer.from(JSON.stringify(raw)));return {...raw,record,recordSha256:digest(records.get(record))};});return {request,records,c:{schema:'quantos-g0-scope-confirmations/v1',status:'CONFIRMED',scopeDigest:request.scopeDigest,roles}};}
test('six input-bound confirmation records can validate using explicit test readers',()=>{const f=confirmedFixture();assert.equal(validateConfirmations(f.c,f.request,p,path=>f.records.get(path)).status,'CONFIRMED');});
for(const [name,change,error]of [
 ['historical timestamp',r=>r.confirmedAt='2026-08-14T12:00:00Z',/current confirmation timestamp/],
 ['missing authority',r=>r.authorization='',/identity and authority/],
 ['outside record path',r=>r.record='/tmp/fake.json',/unsafe scope/],
 ['changed record',r=>r.recordSha256=digest('fake'),/record changed/],
 ['different identity',r=>r.identity='another-user',/record identity mismatch/],
 ['different role scope',r=>r.scopeDigest=digest('old'),/Expected values/],
])test(`scope confirmation rejects ${name}`,()=>{const f=confirmedFixture();change(f.c.roles[0]);assert.throws(()=>validateConfirmations(f.c,f.request,p,path=>f.records.get(path)),error);});
test('CI must always validate engineering receipts and G0 negatives',()=>{const workflow=readFileSync('.github/workflows/frontend-baseline.yml','utf8');assert(workflow.includes('run: pnpm check:g0-engineering && pnpm test:g0-development'));});
test('G0 rejects normative plan drift during execution before publishing',()=>{const f=fixture();const original=f.nodes.get(f.m.nodeId);const changed={...original,required_scope:'changed normative scope'};assert.throws(()=>assertG0ExecutionSnapshot(f.options.request,f.options.request,original,changed),/normative plan changed during execution/);});
test('G0 rejects code inventory drift during execution before publishing',()=>{const f=fixture();const node=f.nodes.get(f.m.nodeId);const after=structuredClone(f.options.request);after.inputs.pop();assert.throws(()=>assertG0ExecutionSnapshot(f.options.request,after,node,node),/inputs changed during execution/);});
test('lifecycle metadata alone does not change normative G0 inputs',()=>{const f=fixture();const original=f.nodes.get(f.m.nodeId);assert.doesNotThrow(()=>assertG0ExecutionSnapshot(f.options.request,f.options.request,original,{...original,stage_gate:{status:'BLOCKED'}}));});
test('real BFF baseline CLI matches its required G0 execution marker',()=>{const output=execFileSync(process.execPath,['scripts/check-bff-fe-000.mjs'],{encoding:'utf8'});assert(new RegExp(policy().checks.baseline.marker).test(output));});
for(const status of ['', ' M docs/SumAlpha-QuantOS-Development-Plan.md\n', 'M  docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md\n?? docs/audit/evidence/new/\n', '?? docs/audit/report.md\n'])test(`G0 worktree allows only lifecycle/evidence state ${JSON.stringify(status)}`,()=>assert.doesNotThrow(()=>assertG0Worktree(status)));
for(const status of [' M scripts/g0-development.mjs\n','M  apps/terminal/src/auth/flow.ts\n','?? bff/new.yaml\n','R  docs/audit/a.md -> scripts/backdoor.mjs\n'])test(`G0 worktree rejects uncommitted functional input ${JSON.stringify(status)}`,()=>assert.throws(()=>assertG0Worktree(status),/commit functional source/));
