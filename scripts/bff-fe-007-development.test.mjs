import assert from 'node:assert/strict';
import test from 'node:test';
import {validateEvidence,commands,targetSourcePaths,targetAssertions,operations} from './bff-fe-007-development.mjs';
import {digest} from './provider-a1-receipts.mjs';
const inputs=targetSourcePaths.map(path=>({path,sha256:'sha256:'+'a'.repeat(64)}));const dependencies=new Map([['FE:BFF-FE-001',{status:'READY',input_digest:'sha256:'+'b'.repeat(64)}]]);
function fixture(){const files=new Map();const add=(id,data)=>{const path='docs/audit/evidence/bff-fe-007-remediation-20261006/unit/'+id+'.json';const bytes=Buffer.from(JSON.stringify(data));files.set(path,bytes);return{id,path,sha256:digest(bytes),status:'PASS',exitCode:0};};
 const results=commands.map(([command,args],i)=>{const log='log'+i;const raw=Buffer.from('test result: ok. 9 passed');files.set(log,raw);return{command,args,exitCode:0,log,logSha256:digest(raw)};});
 const records=Array.from({length:5},(_,i)=>{const log='mutation'+i;const expectedTest='business'+i;const bytes=Buffer.from(expectedTest+' ... FAILED');files.set(log,bytes);return{rejected:true,exitCode:101,log,expectedTest,logSha256:digest(bytes)};});
 const checks=[add('semantics',{status:'PASS',inputs,results}),add('mutations',{status:'PASS',inputs,sourceHash:'sha256:'+'a'.repeat(64),records}),add('live',{schema:'quantos-bff-audit-live/v1',databaseRunStart:'2026-01-01T00:00:00Z',jobCorrelations:['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'],status:'PASS',failure:null,formalAccepted:false,sourceMatchesCommit:true,target:'configured-supabase',cleanupVerified:true,sourceHashes:Object.fromEntries(inputs.map(i=>[i.path,i.sha256.slice(7)])),assertions:targetAssertions,records:operations.flatMap(operationId=>[{operationId,status:operationId.includes('create')||operationId.includes('cancel')?202:200,issues:[]},{operationId,status:401,issues:[]},{operationId,status:403,issues:[]}])})];
 return{m:{schema:'quantos-bff-audit-development/v1',nodeId:'FE:BFF-FE-007',stage:'DEVELOPMENT',status:'PASS',formalAccepted:false,residuals:[],observedSourceCommit:'c'.repeat(40),inputs,planInput:{id:'FE:BFF-FE-007'},dependencies:[{nodeId:'FE:BFF-FE-001',inputDigest:dependencies.get('FE:BFF-FE-001').input_digest}],checks},context:{inputs,plan:{id:'FE:BFF-FE-007'},dependencies,read:path=>files.get(path),validateDependency:()=>{}},files};}
test('fully bound executed evidence is admitted',()=>{const f=fixture();assert.equal(validateEvidence(f.m,f.context).status,'READY');});
for(const [name,change]of [
 ['comments-only replacement changes functional inputs',f=>{f.context.inputs=structuredClone(inputs);f.context.inputs[0].sha256=digest('// marker-only');}],
 ['unready dependency',f=>{f.context.dependencies=new Map([['FE:BFF-FE-001',{...dependencies.get('FE:BFF-FE-001'),status:'NOT_ASSESSED'}]]);}],
 ['missing live execution',f=>f.m.checks.pop()],
 ['evidence bytes changed',f=>f.files.set(f.m.checks[2].path,Buffer.from('{}'))],
 ['compilation-only mutant rejection',f=>{const c=f.m.checks[1];const r=JSON.parse(f.files.get(c.path));const raw=Buffer.from('compilation failed');f.files.set(r.records[0].log,raw);r.records[0].logSha256=digest(raw);const bytes=Buffer.from(JSON.stringify(r));f.files.set(c.path,bytes);c.sha256=digest(bytes);}],
 ['missing current export roots',f=>{const c=f.m.checks[2];const r=JSON.parse(f.files.get(c.path));r.jobCorrelations=[];const bytes=Buffer.from(JSON.stringify(r));f.files.set(c.path,bytes);c.sha256=digest(bytes);}],
 ['missing authentication matrix',f=>{const c=f.m.checks[2];const r=JSON.parse(f.files.get(c.path));r.records=r.records.filter(r=>r.status!==401);const bytes=Buffer.from(JSON.stringify(r));f.files.set(c.path,bytes);c.sha256=digest(bytes);}],
 ['unexecuted target assertion',f=>{const c=f.m.checks[2];const r=JSON.parse(f.files.get(c.path));r.assertions=[];const bytes=Buffer.from(JSON.stringify(r));f.files.set(c.path,bytes);c.sha256=digest(bytes);}],
 ['dependency validator failed',f=>f.context.validateDependency=()=>{throw Error('stale dependency');}],
])test(name+' is rejected',()=>{const f=fixture();change(f);assert.throws(()=>validateEvidence(f.m,f.context));});
