import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { policy, scopeRequest, validateConfirmations, validateManifest, assertG0ExecutionSnapshot, assertG0Worktree, confirmationRequest, evidenceDirectory, applyConfirmation } from './g0-development.mjs';
import { digest, nodesFromPlans, planInput, developmentEnvironment, root } from './provider-a1-receipts.mjs';
import { bytesDigest, confirmationMode } from './user-acceptance-confirmation.mjs';
import { sourceDigest } from './pre03-build-receipt.mjs';
const p=policy();
function fixture(){
 const nodes=nodesFromPlans();for(const n of nodes.values())if(n.stage_gate)n.stage_gate={...n.stage_gate,status:'READY',input_digest:'sha256:'+'c'.repeat(64),evidence:['unit-test.json']};const request=scopeRequest(p);const confirmations={schema:'quantos-g0-scope-confirmations/v2',status:'PENDING',scopeDigest:null,approval:null,reason:'Current user confirmation pending'};
 const logs=new Map();logs.set('docs/gate-records/G0-current-scope-confirmations.json',Buffer.from(JSON.stringify(confirmations)));
 const webBuild={schema:'quantos-pre03-build/v1',app:'terminal',output:'export',buildId:'fixture',sourceDigest:sourceDigest(root,developmentEnvironment(readFileSync(p.developmentProfile.file,'utf8'),p.developmentProfile.overrides))};
 logs.set(evidenceDirectory+'/terminal-build.json',Buffer.from(JSON.stringify(webBuild)));
 const checks=Object.entries(p.checks).map(([id,spec])=>{const log=evidenceDirectory+'/logs/'+id+'.log';const output=Buffer.from(spec.marker.replace('.*','fixture'));logs.set(log,output);return {id,command:spec.command,status:'PASS',exitCode:0,executedAt:new Date().toISOString(),log,logSha256:digest(output)};});
 const n=nodes.get('FRONTEND-GATE:G0');const m={schema:'quantos-g0-development-manifest/v1',nodeId:n.id,stage:'DEVELOPMENT',status:'BLOCKED',formalAccepted:false,engineeringStatus:'PASS',observedSourceCommit:'a'.repeat(40),environment:{node:'24',pnpm:'10',platform:'fixture',profile:'local-mock',protoBaseline:'b'.repeat(40)},planInput:planInput(n),scopeRequest:structuredClone(request),checks,
  confirmations:{status:'PENDING',missingApproval:'ProjectUser'},confirmationLedgerSnapshot:logs.get('docs/gate-records/G0-current-scope-confirmations.json').toString(),confirmationsSha256:digest(logs.get('docs/gate-records/G0-current-scope-confirmations.json')),excluded:p.excluded,residuals:['M-01: project user development scope confirmation missing'],webBuild,webBuildSha256:digest(logs.get(evidenceDirectory+'/terminal-build.json')),dependencies:n.dependencies.map(id=>({nodeId:id,inputDigest:nodes.get(id).stage_gate.input_digest,manifest:'docs/'+nodes.get(id).stage_gate.evidence[0]}))};
 return {m,logs,nodes,options:{p,request,confirmations,nodes,readBytes:path=>{assert(logs.has(path),'fixture path missing');return logs.get(path);},validateDependency:()=>{}}};
}
test('complete engineering checks retain BLOCKED while scope confirmation is absent',()=>{const f=fixture();assert.equal(validateManifest(f.m,f.options).status,'BLOCKED');});
test('strict acceptance rejects pending current user scope',()=>{const f=fixture();assert.throws(()=>validateManifest(f.m,{...f.options,requireReady:true}),/G0 BLOCKED/);});
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
test('pending scope cannot incorporate an approval record',()=>{assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v2',status:'PENDING',scopeDigest:null,reason:'pending',approval:{}},scopeRequest(p),p));});
test('legacy six-role records cannot grant current confirmation',()=>assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v1',status:'CONFIRMED',roles:[]},scopeRequest(p),p)));
test('confirmed scope must bind current input digest',()=>assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v2',status:'CONFIRMED',scopeDigest:bytesDigest('old'),approval:null},scopeRequest(p),p),/input digest changed/));
test('confirmed scope requires the single user record',()=>{const request=scopeRequest(p);assert.throws(()=>validateConfirmations({schema:'quantos-g0-scope-confirmations/v2',status:'CONFIRMED',scopeDigest:request.scopeDigest,approval:null},request,p),/project user confirmation record required/);});
test('dependency validation is actually invoked and failures propagate',()=>{const f=fixture();assert.throws(()=>validateManifest(f.m,{...f.options,validateDependency:()=>{throw new Error('upstream execution invalid');}}),/upstream execution invalid/);});
test('one document-bound current user confirmation replaces all role receipts',()=>{
 const request=scopeRequest(p);const expected=confirmationRequest(request);const doc='```json\n'+JSON.stringify({schema:'quantos-acceptance-draft/v1',mode:confirmationMode,draftedBy:'Codex',request:expected,reviewDimensions:expected.reviewDimensions})+'\n```';
 const document='docs/gate-records/unit-draft.md',record='docs/gate-records/unit-approval.json';const raw=JSON.stringify({schema:'quantos-user-acceptance-confirmation/v1',mode:confirmationMode,request:expected,decision:'CONFIRMED',approver:'ProjectUser',identity:'unit-test fixture only',confirmedAt:new Date().toISOString(),document,documentSha256:bytesDigest(doc),confirmationSource:{kind:'USER_MESSAGE',text:'Unit test only: confirm this draft'}});
 const files=new Map([[document,doc],[record,raw]]);assert.equal(validateConfirmations({schema:'quantos-g0-scope-confirmations/v2',status:'CONFIRMED',scopeDigest:request.scopeDigest,approval:{record,recordSha256:bytesDigest(raw)}},request,p,path=>files.get(path)).status,'CONFIRMED');
});
test('CI must always validate engineering receipts and G0 negatives',()=>{const workflow=readFileSync('.github/workflows/frontend-baseline.yml','utf8');assert(workflow.includes('run: pnpm check:g0-engineering && pnpm test:g0-development'));});
test('G0 rejects normative plan drift during execution before publishing',()=>{const f=fixture();const original=f.nodes.get(f.m.nodeId);const changed={...original,required_scope:'changed normative scope'};assert.throws(()=>assertG0ExecutionSnapshot(f.options.request,f.options.request,original,changed),/normative plan changed during execution/);});
test('G0 rejects code inventory drift during execution before publishing',()=>{const f=fixture();const node=f.nodes.get(f.m.nodeId);const after=structuredClone(f.options.request);after.inputs.pop();assert.throws(()=>assertG0ExecutionSnapshot(f.options.request,after,node,node),/inputs changed during execution/);});
test('lifecycle metadata alone does not change normative G0 inputs',()=>{const f=fixture();const original=f.nodes.get(f.m.nodeId);assert.doesNotThrow(()=>assertG0ExecutionSnapshot(f.options.request,f.options.request,original,{...original,stage_gate:{status:'BLOCKED'}}));});
test('real BFF baseline CLI matches its required G0 execution marker',()=>{const output=execFileSync(process.execPath,['scripts/check-bff-fe-000.mjs'],{encoding:'utf8'});assert(new RegExp(policy().checks.baseline.marker).test(output));});
for(const status of ['', ' M docs/SumAlpha-QuantOS-Development-Plan.md\n', 'M  docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md\n?? docs/audit/evidence/new/\n', '?? docs/audit/report.md\n'])test(`G0 worktree allows only lifecycle/evidence state ${JSON.stringify(status)}`,()=>assert.doesNotThrow(()=>assertG0Worktree(status)));
for(const status of [' M scripts/g0-development.mjs\n','M  apps/terminal/src/auth/flow.ts\n','?? bff/new.yaml\n','R  docs/audit/a.md -> scripts/backdoor.mjs\n'])test(`G0 worktree rejects uncommitted functional input ${JSON.stringify(status)}`,()=>assert.throws(()=>assertG0Worktree(status),/commit functional source/));

test('user-confirmed scope includes the normative G0 plan and excludes lifecycle metadata',()=>{const request=scopeRequest(p);const n=nodesFromPlans().get('FRONTEND-GATE:G0');assert.deepEqual(request.planInput,planInput(n));assert(!('stage_gate' in request.planInput));assert(request.reviewDimensions.includes('Risk'));assert.equal(request.confirmationMode,'AGENT_DRAFT_USER_CONFIRMATION');});

test('confirmation-only finalization refuses an absent user reply and cannot bless changed engineering inputs',()=>{const f=fixture();assert.throws(()=>applyConfirmation(f.m,{...f.options,ledgerBytes:f.m.confirmationLedgerSnapshot}),/current project user confirmation/);f.m.scopeRequest.inputs.pop();assert.throws(()=>applyConfirmation(f.m,{...f.options,ledgerBytes:f.m.confirmationLedgerSnapshot}),/functional input inventory/);});
test('document-bound user reply finalizes the unchanged engineering checks without fabricating new execution',()=>{
 const f=fixture();const request=confirmationRequest(f.options.request);const document='docs/gate-records/unit-finalize-draft.md',record='docs/gate-records/unit-finalize-confirmation.json';const doc=Buffer.from('```json\n'+JSON.stringify({schema:'quantos-acceptance-draft/v1',mode:confirmationMode,draftedBy:'Codex',request,reviewDimensions:request.reviewDimensions})+'\n```');
 const reply=Buffer.from(JSON.stringify({schema:'quantos-user-acceptance-confirmation/v1',mode:confirmationMode,request,decision:'CONFIRMED',approver:'ProjectUser',identity:'unit-test fixture only',confirmedAt:new Date().toISOString(),document,documentSha256:bytesDigest(doc),confirmationSource:{kind:'USER_MESSAGE',text:'Unit-test fixture only: confirm this document'}}));f.logs.set(document,doc);f.logs.set(record,reply);
 const confirmations={schema:'quantos-g0-scope-confirmations/v2',status:'CONFIRMED',scopeDigest:f.options.request.scopeDigest,approval:{record,recordSha256:bytesDigest(reply)},reason:'Unit-test confirmation only'};const ledgerBytes=JSON.stringify(confirmations);f.logs.set('docs/gate-records/G0-current-scope-confirmations.json',Buffer.from(ledgerBytes));
 const updated=applyConfirmation(f.m,{...f.options,confirmations,ledgerBytes});assert.equal(updated.status,'READY');assert.deepEqual(updated.checks,f.m.checks);assert.equal(updated.observedSourceCommit,f.m.observedSourceCommit);assert.equal(f.m.status,'BLOCKED');
});
