import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateExecution,commands,validateDisposition,validateAxe,validateToolDelta,toolRepairPaths} from './ui-103-functional-review.mjs';
import {digest} from './provider-a1-receipts.mjs';
const bytes=Buffer.from('actual output\n'),expected=commands('fixture'),rows=expected.map(row=>({...row,exitCode:0,signal:null,errorCode:null,log:'fixture.log',logSha256:digest(bytes)}));
test('complete exact commands, successful exit and bound nonempty logs pass execution validation',()=>validateExecution(rows,expected,()=>bytes));
for(const [name,mutate]of [['missing result',r=>r.pop()],['extra result',r=>r.push(r[0])],['failed check',r=>r[0].exitCode=1],['signal',r=>r[0].signal='SIGTERM'],['timeout',r=>r[0].errorCode='ETIMEDOUT'],['command substitution',r=>r[0].command=['true']],['log substitution',r=>r[0].logSha256=digest('other')]])test(name+' is rejected',()=>{const r=structuredClone(rows);mutate(r);assert.throws(()=>validateExecution(r,expected,()=>bytes));});
test('empty logs cannot satisfy successful exits',()=>{const r=structuredClone(rows);r.forEach(r=>r.logSha256=digest(''));assert.throws(()=>validateExecution(r,expected,()=>Buffer.from('')));});

test('the scoped executor never schedules an upstream gate, database, install or workspace campaign',()=>{
 for(const row of commands('fixture'))assert(!row.command.some(arg=>/^(cargo|install|--workspace|--update-snapshots=all)$/.test(arg)));
 assert(!commands('fixture').some(r=>r.command.some(arg=>/scripts\/(g0-development|provider-all-development|record-.*functional)/.test(arg))));
 assert(commands('fixture').some(r=>r.id==='browser'&&!r.command.includes('--interactions-only')));
});

const disposition={engineeringStatus:'PASS',componentIntegration:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,production:false,externalPublished:false,runtimeAdmission:'DENIED',manualScreenReader:'NOT_RUN',confirmation:'PENDING',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN',recursiveDependencyRevalidation:false};
test('component PASS preserves separate unassessed integration and pending acceptance',()=>validateDisposition(disposition));
for(const [field,value]of Object.entries({stageGate:'READY',componentIntegration:'NOT_RUN',formalAccepted:true,databaseExecution:true,production:true,externalPublished:true,runtimeAdmission:'ALLOWED',manualScreenReader:'PASS',confirmation:'CONFIRMED',businessIntegration:'PASS',releaseAcceptance:'PASS',recursiveDependencyRevalidation:true}))test('refuses false phase promotion '+field,()=>assert.throws(()=>validateDisposition({...disposition,[field]:value})));

const layouts=['dark-en-1440','light-zh-1440','dark-en-768','light-zh-390','dark-en-200pct'].map(id=>({id,status:'PASS',reflow:{scroll:390,client:390}}));
const axe=[...Array.from({length:9},(_,id)=>({id,status:'PASS',violations:[]})),...layouts];
test('real mixed axe/layout records validate without reading nonexistent violations',()=>validateAxe(axe,1));
test('serious portal violations cannot hide among layout records',()=>assert.throws(()=>validateAxe([...axe,{status:'PASS',violations:[{impact:'serious'}]}],1)));
test('missing portal scans or missing 200pct layout reject',()=>{assert.throws(()=>validateAxe(axe.slice(0,2),1));assert.throws(()=>validateAxe(axe.filter(r=>r.id!=='dark-en-200pct'),1));});
const original={inputs:[...toolRepairPaths.map(path=>({path,sha256:'before'})),{path:'packages/ui/src/runtime.ts',sha256:'same'}],checks:[],requirements:{id:'FE:UI-103'}};
const updated=structuredClone(original);updated.inputs.slice(0,2).forEach(r=>r.sha256='after');const changedInputs=toolRepairPaths.map(path=>({path,before:'before',after:'after'}));
test('reviewer-only repair keeps original engineering source and exact runtime inputs',()=>{assert.equal(validateToolDelta(original,updated,{changedInputs}).length,2);const runtime=structuredClone(updated);runtime.inputs[2].sha256='different';assert.throws(()=>validateToolDelta(original,runtime,{changedInputs}));const command=structuredClone(updated);command.checks=['skip'];assert.throws(()=>validateToolDelta(original,command,{changedInputs}));});
