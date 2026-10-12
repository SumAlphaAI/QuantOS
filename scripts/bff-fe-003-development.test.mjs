import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checks,verify,operations,directory,dependencies} from './bff-fe-003-development.mjs';
import {digest,nodesFromPlans} from './provider-a1-receipts.mjs';
const content=Buffer.from('test result: ok. 10 passed; 0 failed; Tests 89 passed\nFinished `dev` profile\n结构校验通过\nmatch the frozen OpenAPI\n63 operations, 54 schemas\n"status": "PASS"\n"stage_contract": "PASS"\n# fail 0\n9 operations');
const probes=Buffer.from('[]');
const options={inputs:[],plan:{},checkSource:false,read:p=>p.endsWith('provider-responses.json')?probes:content};
function receipt(){return {schema:'quantos-bff-fe-003-development/v1',nodeId:'FE:BFF-FE-003',stage:'DEVELOPMENT',engineeringStatus:'PASS',status:'BLOCKED',sourceCommit:'a'.repeat(40),inputs:[],planInput:{},operations,checks:checks.map(c=>({id:c.id,command:c.command,exitCode:0,status:'PASS',executedAt:'2026-10-01T00:00:00Z',log:directory+'/logs/'+c.id+'.log',logSha256:digest(content)})),probesSha256:digest(probes),dependencies:nodesFromPlans().get('FE:BFF-FE-003').dependencies.map(nodeId=>({nodeId,status:'BLOCKED'})),databaseExecution:false,production:false,formalAccepted:false,target:{status:'NOT_RUN'},hostedCI:'NOT_RUN',consumerUI:'NOT_RUN'};}
test('local PASS remains BLOCKED without target and dependency admission',()=>assert.equal(verify(receipt(),options).stageGate,'BLOCKED'));
for(const [label,change]of [
 ['source drift',r=>r.inputs.push({path:'forged',sha256:'x'})],['plan drift',r=>r.planInput.extra='forged'],['missing operation',r=>r.operations=r.operations.slice(1)],['missing source SHA',r=>r.sourceCommit='main'],
 ['forged READY',r=>r.status='READY'],['self approval',r=>r.formalAccepted=true],['claimed database execution',r=>r.databaseExecution=true],['claimed target pass',r=>r.target.status='PASS'],['claimed hosted CI',r=>r.hostedCI='PASS'],
 ['missing check',r=>r.checks.pop()],['changed command',r=>r.checks[0].command=['true']],['failed check',r=>r.checks[0].exitCode=1],['log tamper',r=>r.checks[0].logSha256='x'],['unsafe log path',r=>r.checks[0].log='../escape'],['future execution',r=>r.checks[0].executedAt='2099-01-01T00:00:00Z'],['missing dependency',r=>r.dependencies.pop()],['probe tamper',r=>r.probesSha256='x'],
])test('rejects '+label,()=>{const r=receipt();change(r);assert.throws(()=>verify(r,options));});
test('failed output cannot pass even with a recomputed log hash',()=>{const r=receipt();const bad=Buffer.concat([content,Buffer.from('\nUnhandled Errors')]);r.checks.forEach(c=>c.logSha256=digest(bad));assert.throws(()=>verify(r,{...options,read:p=>p.endsWith('provider-responses.json')?probes:bad}));});
test('changed immutable Git source is rejected',()=>{const r=receipt();r.inputs=[{path:'a',sha256:digest(Buffer.from('expected'))}];assert.throws(()=>verify(r,{...options,inputs:r.inputs,checkSource:true,source:()=>Buffer.from('different')}));});
test('dependency inspection preserves the nine exact prerequisite obligations',()=>assert.deepEqual(dependencies().map(d=>d.nodeId),nodesFromPlans().get('FE:BFF-FE-003').dependencies));
