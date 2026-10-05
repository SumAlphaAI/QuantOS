import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {nodesFromPlans,digest,planInput,policy} from './provider-a1-receipts.mjs';
import {validateManifest,validateEnvelope,requiredDependencies,evidenceDirectory,checks} from './fep0-development.mjs';
import {validateF0Artifact} from './f0-functional-artifacts.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assertSchemaMatches}=require('./db-schema-state.cjs');
function fixture(blocked=false){
 const nodes=nodesFromPlans();const files=new Map();const validations=new Map();
 for(const id of requiredDependencies){const bytes=Buffer.from(JSON.stringify({nodeId:id,unitTestOnly:true}));const manifest=evidenceDirectory+'/unit-'+id.replaceAll(':','-')+'.json';files.set(manifest,bytes);nodes.get(id).stage_gate={stage:'DEVELOPMENT',status:blocked&&id==='FRONTEND-GATE:G0'?'BLOCKED':'READY',evidence:[manifest.slice(5)],input_digest:digest(bytes)};validations.set(id,{nodeId:id,status:nodes.get(id).stage_gate.status,...(id==='FRONTEND-GATE:G0'?{engineeringStatus:'PASS',missingApproval:blocked?'ProjectUser':undefined}:{})});}
 const executed=Object.entries(checks).map(([id,command])=>{const log=evidenceDirectory+'/logs/'+id+'.log';const bytes=Buffer.from(id==='negative'?'fail 0':'PASS');files.set(log,bytes);return {id,command,status:'PASS',exitCode:0,executedAt:new Date().toISOString(),log,logSha256:digest(bytes)};});
 const n=nodes.get('FE:FEP-0');const m={schema:'quantos-fep0-development-manifest/v1',assessmentDirectory:evidenceDirectory,nodeId:n.id,stage:'DEVELOPMENT',engineeringStatus:'PASS',status:blocked?'BLOCKED':'READY',formalAccepted:false,observedSourceCommit:'a'.repeat(40),environment:{node:'24',pnpm:'10',platform:'fixture',databaseExecuted:false},planInput:planInput(n),inputs:[],dependencies:requiredDependencies.map(nodeId=>({nodeId,inputDigest:nodes.get(nodeId).stage_gate.input_digest,manifest:'docs/'+nodes.get(nodeId).stage_gate.evidence[0],validation:validations.get(nodeId)})),checks:executed,residuals:blocked?['G0 current project-user confirmation pending']:[],excluded:['formal ACCEPTED','staging/deployment/real IdP','RELEASE performance/soak/hosted CI/final confirmation','unimplemented providers/pages/Desktop']};
 const options={nodes,currentInputs:[],readBytes:path=>{assert(files.has(path),'missing fixture evidence');return files.get(path);},validateDependency:id=>validations.get(id)};return {m,files,options,validations,validate:()=>validateManifest(m,options)};
}
test('all eight independently content-bound dependencies admit DEVELOPMENT only',()=>assert.equal(fixture().validate().status,'READY'));
test('engineering aggregation preserves the sole pending user confirmation',()=>{const f=fixture(true);assert.equal(validateManifest(f.m,{...f.options,requireReady:false}).status,'BLOCKED');assert.throws(f.validate,/current G0 user confirmation/);});
for(const [name,mutate,pattern]of [
 ['missing F0',f=>f.m.dependencies.shift(),/eight dependency/],
 ['missing PRE',f=>f.m.dependencies.splice(3,1),/eight dependency/],
 ['duplicate dependency',f=>f.m.dependencies[1]=f.m.dependencies[0],/eight dependency/],
 ['unready F0',f=>f.validations.get('CORE-GATE:F0').status='BLOCKED',/prerequisite not READY/],
 ['manifest bytes replaced',f=>f.files.set(f.m.dependencies[0].manifest,Buffer.from('historical report')),/actual manifest content/],
 ['digest substituted',f=>f.m.dependencies[0].inputDigest=digest('fake'),/dependency digest/],
 ['dependency path substituted',f=>f.m.dependencies[0].manifest='historical.md',/dependency path/],
 ['dependency verdict substituted',f=>f.m.dependencies[0].validation={status:'READY'},/validation result/],
 ['self manifest schema',f=>f.m.schema='historical-markdown',/quantos-fep0/],
 ['normative change',f=>f.m.planInput.scope='new',/normative scope/],
 ['source input change',f=>f.options.currentInputs=[{sha256:digest('changed')}],/inputs changed/],
 ['unexecuted check',f=>f.m.checks[0].exitCode=null,/failed or unexecuted/],
 ['missing execution time',f=>f.m.checks[0].executedAt=null,/timestamp missing/],
 ['missing required check',f=>f.m.checks.pop(),/required check/],
 ['duplicate check',f=>f.m.checks.push(f.m.checks[0]),/required check/],
 ['wrong command',f=>f.m.checks[0].command=['true'],/actual command/],
 ['log tampering',f=>f.files.set(f.m.checks[0].log,Buffer.from('fake')),/log content/],
 ['rehashed prose',f=>{const c=f.m.checks[0];const b=Buffer.from('audit prose');f.files.set(c.log,b);c.logSha256=digest(b);},/execution marker/],
 ['external log path',f=>f.m.checks[0].log='old-report.md',/approved directory/],
 ['false formal acceptance',f=>f.m.formalAccepted=true,/false/],
 ['aggregate claims database run',f=>f.m.environment.databaseExecuted=true,/boundary missing/],
 ['hidden exclusions',f=>f.m.excluded=[],/deep-equal/],
 ['unresolved functional finding',f=>f.m.residuals=['open'],/residual inventory/]
])test('milestone rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(f.validate,pattern);});
test('dependency validator is invoked and errors propagate',()=>{const f=fixture();f.options.validateDependency=()=>{throw Error('invalid nested execution');};assert.throws(f.validate,/nested execution/);});
test('fake READY cannot hide changed G0 scope',()=>{const f=fixture(true);f.m.status='READY';f.m.residuals=[];assert.throws(()=>validateManifest(f.m,{...f.options,requireReady:false}),/all eight current prerequisites/);});
test('arbitrary existing markdown cannot serve as a milestone receipt',()=>{const bytes=Buffer.from('{}');assert.throws(()=>validateEnvelope({stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:['audit/FEP-0-comprehensive-review-2026-10-05.md']},bytes),/historical evidence/);});
test('own arbitrary digest is rejected independently of dependency status',()=>{const bytes=Buffer.from('{}');assert.throws(()=>validateEnvelope({stage:'DEVELOPMENT',status:'READY',input_digest:digest('fake'),evidence:[evidenceDirectory.slice(5)+'/fep0.json']},bytes),/manifest digest/);});
test('F0 policy contains the six missing nodes and all eleven obligations',()=>{const p=policy();const nodes=nodesFromPlans();assert.equal(nodes.get('CORE-GATE:F0').dependencies.length,11);for(const id of ['CORE:F02','CORE:F07','CORE:F08','CORE:F09','CORE:TP01-A','CORE:TP01-B'])assert(p.nodes[id]?.checks.length>0);assert(p.checks['f09-target'].cleanSource);assert(p.checks['f07-recovery'].database);assert(p.checks['f02-database'].database);assert(p.checks['f08-service'].staticOnly);});
for(const dimension of ['tables','columns','constraints','indexes','policies','routines','triggers'])test('production schema drift comparator rejects '+dimension,()=>{const original=Object.fromEntries(['tables','columns','constraints','indexes','policies','routines','triggers'].map(n=>[n,[{name:n}]]));assertSchemaMatches(original,structuredClone(original));const changed=structuredClone(original);changed[dimension]=[];assert.throws(()=>assertSchemaMatches(changed,original),/SCHEMA_DRIFT/);});
test('100-worker development evidence cannot use 10-task diagnostic or accept P95',()=>{const dir=mkdtempSync(resolve(tmpdir(),'fep0-artifact-'));try{const path=resolve(dir,'recovery.json');const source='a'.repeat(40);const r={schema:'quantos-f07-acceptance/v1',sourceCommit:source,status:'DIAGNOSTIC_ONLY',targetPostgresMajor:17,targetProjectRefHash:'fixture',checks:['100 OS-killed worker'],measurements:{schema:'quantos-f07-recovery-measurements/v1',scheduledRuns:100,recoveredRuns:100,uniqueArtifactBindings:100,recoveryCompleted:true,scheduleP95Ms:800}};writeFileSync(path,JSON.stringify(r));validateF0Artifact('f07-recovery',path,source);r.measurements.recoveredRuns=10;writeFileSync(path,JSON.stringify(r));assert.throws(()=>validateF0Artifact('f07-recovery',path,source),/count differs/);r.measurements.recoveredRuns=100;r.status='PASS';writeFileSync(path,JSON.stringify(r));assert.throws(()=>validateF0Artifact('f07-recovery',path,source),/DIAGNOSTIC_ONLY/);}finally{rmSync(dir,{recursive:true,force:true});}});
test('CI consumes the full milestone engineering validator and its negatives',()=>{const workflow=readFileSync('.github/workflows/frontend-baseline.yml','utf8');assert(workflow.includes('pnpm check:fep0:engineering'));assert(workflow.includes('pnpm test:fep0'));});
