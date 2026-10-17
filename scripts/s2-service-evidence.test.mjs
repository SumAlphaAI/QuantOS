import test from 'node:test';
import assert from 'node:assert/strict';
import {nodesFromPlans,policy,digest} from './provider-a1-receipts.mjs';
import {dependencyChecks} from './s2-service-coverage.mjs';
import {buildEvidence,verifyEvidence} from './s2-service-evidence.mjs';
import {componentFixture} from './s2-service-test-fixture.mjs';
function fixture(){
 const nodes=nodesFromPlans(),p=policy(),base='docs/audit/evidence/provider-a1-remediation-20261004/s2-service-local-20990101/attempt-99',path=base+'/execution-results.json',source='a'.repeat(40),files=new Map(),rows=dependencyChecks(nodes,p).map(id=>{
  const log=base+'/logs/'+id+'.log',data=Buffer.from('UNIT_ONLY '+id);files.set(log,data);const c={id,command:p.checks[id].command,status:'PASS',exitCode:0,timedOut:false,executionErrorCode:null,signal:null,executedAt:'2026-10-16T00:00:00Z',log,logSha256:digest(data)};
  if(p.checks[id].artifact||p.checks[id].reproducibility){c.artifact=base+'/supporting/'+id+'/receipt.json';files.set(c.artifact,Buffer.from('{}'));c.artifactSha256=digest(files.get(c.artifact));}return c;
 });
 const flush=()=>files.set(path,Buffer.from(JSON.stringify(rows)));flush();const options={nodes,p,readBytes:path=>files.get(path),components:()=>({unitOnly:true})};return{source,path,files,rows,flush,options,run:()=>buildEvidence(path,source,options)};
}
test('all 124 current-attempt records precede aggregation',()=>{const f=fixture();const r=f.run();assert.equal(r.dependencyChecks.length,124);assert.equal(r.dependencyNodes.length,38);assert.equal(r.runtimeAdmission,'DENIED');assert.equal(verifyEvidence(r,f.source,f.options).status,'PASS');});
for(const [name,mutate]of [
 ['missing check',f=>f.rows.pop()],['duplicate check',f=>f.rows[1]=f.rows[0]],['reordered check',f=>f.rows.reverse()],['failed exit',f=>f.rows[0].exitCode=1],['failed status',f=>f.rows[0].status='FAIL'],['timeout',f=>f.rows[0].timedOut=true],['signal',f=>f.rows[0].signal='SIGTERM'],['spawn error',f=>f.rows[0].executionErrorCode='ETIMEDOUT'],['command rewrite',f=>f.rows[0].command=['true']],['missing time',f=>f.rows[0].executedAt='invalid'],['historical log',f=>f.rows[0].log='docs/audit/evidence/old.log'],['log tamper',f=>f.files.set(f.rows[0].log,Buffer.from('tamper'))],['missing artifact',f=>delete f.rows[0].artifact],['artifact tamper',f=>f.rows[0].artifactSha256=digest('tamper')],['historical artifact',f=>f.rows[0].artifact='docs/audit/evidence/old.json'],['unexpected own check',f=>f.rows.push({...f.rows[0],id:'foreign'})]
])test('refuses '+name,()=>{const f=fixture();mutate(f);f.flush();assert.throws(f.run);});
for(const [key,value]of [['observedSourceCommit','b'.repeat(40)],['runtimeAdmission','READY'],['formalAccepted',true],['databaseExecution',true],['externalPublished',true],['dependencyResultsDigest',digest('tamper')]])test('aggregate cannot promote or rewrite '+key,()=>{const f=fixture(),r=f.run();r[key]=value;assert.throws(()=>verifyEvidence(r,f.source,f.options));});
test('own executions cannot change dependency prefix digest',()=>{const f=fixture(),before=f.run();for(const id of f.options.p.nodes['CORE-GATE:S2-SERVICE'].checks)f.rows.push({id});f.flush();assert.deepEqual(f.run(),before);});
test('historical attempt directory cannot be aggregated',()=>{const f=fixture();assert.throws(()=>buildEvidence(f.path.replace('s2-service-local','service-s04-local'),f.source,f.options));});
test('actual component log regression fixture covers strategy, research and evaluations only',()=>{const f=componentFixture(),r=f.run();assert.equal(r.service.deniedUnverifiedUnapproved,100);assert.equal(r.references.length,4);assert.equal(r.evaluation.evaluation.rules,7);assert.equal(r.fullTp12Review,'X3_AFTER_CORE_TP07_AND_S2');});
for(const check of ['s01-rust','tp06-rust','s02-rust','s03-rust','service-s04-rust','tp07-evaluation','tp12-evaluation'])test('removing behavioral evidence fails '+check,()=>{const f=componentFixture();f.raw.set(f.rows.get(check).log,'missing actual proof');assert.throws(f.run);});
for(const check of ['tp08-development','tp09-local-development','tp10-local-development','tp11-local-development','r04-local-products','tp01-e-functional','tp01-f-functional','tp01-g-functional'])test('mixed component source fails '+check,()=>{const f=componentFixture(),path=f.rows.get(check).artifact,r=JSON.parse(f.raw.get(path));if(check==='r04-local-products')r.sourceCommit='b'.repeat(40);else r.observedSourceCommit='b'.repeat(40);f.raw.set(path,JSON.stringify(r));assert.throws(f.run);});
for(const [key,value]of [['status','FAIL'],['engineeringStatus','FAIL'],['formalAccepted',true],['validationMode','UPSTREAM'],['upstreamVerification',{status:'PASS',checkpoint:'RELEASE-GATE:BETA',externalExecution:true,currentPublicBytesVerified:true}]])test('reference cannot promote or skip local boundary '+key,()=>{const f=componentFixture(),path=f.rows.get('tp09-local-development').artifact,r=JSON.parse(f.raw.get(path));r[key]=value;f.raw.set(path,JSON.stringify(r));assert.throws(f.run);});
test('blocked reference admission is retained rather than promoted',()=>{const f=componentFixture();assert(f.run().references.every(r=>r.recordedAdmission==='BLOCKED'&&r.upstreamRuntime==='DENIED'));});

test('nested X01 assessment retains the full S2 prefix before its four own groups',()=>{
 const f=fixture(),old=f.path.slice(0,f.path.lastIndexOf('/')),base=old.replace('s2-service-local','x01-local'),path=base+'/execution-results.json';
 const files=new Map([...f.files].map(([key,value])=>[key.replace(old,base),value]));
 const rows=f.rows.map(row=>({...row,log:row.log.replace(old,base),...(row.artifact?{artifact:row.artifact.replace(old,base)}:{})}));
 const options={...f.options,readBytes:p=>files.get(p)},flush=()=>files.set(path,Buffer.from(JSON.stringify(rows)));flush();
 const before=buildEvidence(path,f.source,options);
 const own=[...f.options.p.nodes['CORE-GATE:S2-SERVICE'].checks,...f.options.p.nodes['CORE:X01'].checks.filter(id=>!f.options.p.checks[id].database)];
 rows.push(...own.map(id=>({id})));flush();assert.deepEqual(buildEvidence(path,f.source,options),before);
 [rows[124],rows[127]]=[rows[127],rows[124]];flush();assert.throws(()=>buildEvidence(path,f.source,options));
 [rows[124],rows[127]]=[rows[127],rows[124]];rows.push({id:'unregistered'});flush();assert.throws(()=>buildEvidence(path,f.source,options));
});

test('nested X02 assessment retains the full S2 prefix before its four own groups',()=>{
 const f=fixture(),old=f.path.slice(0,f.path.lastIndexOf('/')),base=old.replace('s2-service-local','x02-local'),path=base+'/execution-results.json';
 const files=new Map([...f.files].map(([key,value])=>[key.replace(old,base),value]));
 const rows=f.rows.map(row=>({...row,log:row.log.replace(old,base),...(row.artifact?{artifact:row.artifact.replace(old,base)}:{})}));
 const options={...f.options,readBytes:p=>files.get(p)},flush=()=>files.set(path,Buffer.from(JSON.stringify(rows)));flush();
 const before=buildEvidence(path,f.source,options);
 const own=[...f.options.p.nodes['CORE-GATE:S2-SERVICE'].checks,...f.options.p.nodes['CORE:X01'].checks.filter(id=>!f.options.p.checks[id].database),...f.options.p.nodes['CORE:X02'].checks.filter(id=>!f.options.p.checks[id].target)];
 rows.push(...own.map(id=>({id})));flush();assert.deepEqual(buildEvidence(path,f.source,options),before);
 [rows[124],rows[127]]=[rows[127],rows[124]];flush();assert.throws(()=>buildEvidence(path,f.source,options));
 [rows[124],rows[127]]=[rows[127],rows[124]];rows.push({id:'unregistered'});flush();assert.throws(()=>buildEvidence(path,f.source,options));
});
