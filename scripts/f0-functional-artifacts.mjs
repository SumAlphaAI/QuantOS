import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyBracesBackport,isBracesBackportFinding} from './braces-backport.mjs';
export function validateF0Artifact(kind,path,source){
 const r=JSON.parse(readFileSync(path));assert.equal(r.sourceCommit??r.source,source,'F0 artifact source differs');
 if(kind==='f02-database'){assert.equal(r.schema,'quantos-f02-development-database/v1');assert.equal(r.status,'PASS');assert.equal(r.targetClass,'configured-supabase');assert.equal(r.formalAccepted,false);assert.equal(r.fullReferenceRebuild,false);assert.equal(r.checks.length,7);}
 else if(kind==='f02-sca'){assert.equal(r.status,'PASS');assert.equal(r.passed,true);assert.deepEqual(Object.keys(r.scanners).sort(),['cargo','cargo-desktop','npm','pypi']);const proof=verifyBracesBackport(resolve(import.meta.dirname,'..'));assert.deepEqual(r.bracesBackport,proof,'SCA backport proof differs');assert(Object.values(r.scanners).every(c=>c.status==='PASS'&&c.findings.every(f=>f.waived||(f.backportVerified&&isBracesBackportFinding(f,proof)))),'unwaived vulnerabilities');}
 else if(kind==='f07-recovery'||kind==='f07-coverage'){
  assert.equal(r.schema,'quantos-f07-acceptance/v1');assert.equal(r.status,'DIAGNOSTIC_ONLY');assert.equal(r.targetPostgresMajor,17);assert(r.targetProjectRefHash);const m=r.measurements;assert.equal(m.schema,'quantos-f07-recovery-measurements/v1');assert.equal(m.recoveryCompleted,true);
  for(const key of ['scheduledRuns','recoveredRuns','uniqueArtifactBindings'])assert.equal(m[key],kind==='f07-recovery'?100:10,'checkpoint/Artifact count differs');
  assert(r.checks.some(c=>kind==='f07-recovery'?c.includes('100 task recoveries after an OS-killed worker'):c.includes('diagnostic coverage')),'actual recovery/coverage check missing');
  if(kind==='f07-coverage')execFileSync(process.execPath,[resolve(import.meta.dirname,'f07-coverage-check.cjs'),resolve(dirname(path),'coverage.json')],{encoding:'utf8'});
 }
 else if(kind==='f07-service'){
  assert.equal(r.schema,'quantos-f07-target-service/v1');assert.equal(r.targetClass,'configured-supabase-local-service-development');assert.equal(r.status,'DIAGNOSTIC_ONLY');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.formalAccepted,false);assert.equal(r.checks.length,6);assert.equal(r.storageCredentialScope,'temporary-admin-key');assert(r.checks.some(c=>c.includes('separate real Auth tenant denied')));assert(r.checks.some(c=>c.includes('logout revokes')));assert.deepEqual(r.excluded,['deployed HTTPS','restricted Runtime Storage credential','scheduling P95','hosted CI']);
 }
 else if(kind==='f08-service'){
  assert.equal(r.schema,'quantos-f08-target-service/v1');assert.equal(r.status,'PASS');assert.equal(r.installedFromWheel,true);assert.equal(r.targetDirectoryMode,'700');
  assert.deepEqual(r.cases.map(c=>c.id),['five_rpc_and_tenant_denial','three_supervised_crashes','deadline_two_seconds','running_cancel','durable_reconstruction','manager_os_kill_and_replay_policy','idempotency_and_changed_input','sidecar_artifact_integrity','untrusted_rpc_rejection']);
  for(const c of r.cases){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.error,null);const bytes=readFileSync(resolve(dirname(path),c.log));assert(/1 passed; 0 failed/.test(bytes.toString()),'engine scenario did not execute exactly one test');}
  assert(/^[a-f0-9]{64}$/.test(r.mockWheel.sha256));assert.equal(createHash('sha256').update(readFileSync(resolve(dirname(path),'wheels',r.mockWheel.file))).digest('hex'),r.mockWheel.sha256,'actual wheel bytes differ');
 }
 else if(kind==='f09-target'){
  assert.equal(r.schema,'quantos-f09-target-gate/v3');assert.equal(r.status,'PASS');assert.equal(r.dirty,false);assert.equal(r.targetClass,'test-supabase-postgresql');assert.equal(r.f09Accepted,false);assert.equal(r.secretLeakDetected??false,false);assert.equal(r.checks.length,6);assert.deepEqual(r.remainingDevelopmentAcceptance,[]);assert.deepEqual(r.deferredToRelease,['same-SHA remote CI and Nightly receipts']);
  assert.deepEqual(Object.keys(r.logs).sort(),['bff-write-trace.log','engine-crash.log','portfolio-query.log','portfolio-write-trace.log','postgres-exercises.log','runtime-write-trace.log','scheduler-smoke.log']);
  for(const [name,hash]of Object.entries(r.logs)){assert.equal(createHash('sha256').update(readFileSync(resolve(dirname(path),name))).digest('hex'),hash,'F09 nested log changed');}
  for(const key of ['bffSessionRevoke','runtimeRunSchedule'])assert(/^[a-f0-9-]{36}$/.test(r.writeTraces[key]),'persistent trace missing');assert(r.writeTraces.portfolioProjection.lastEventSequence>=20);
 }else assert.fail('unknown F0 artifact kind');
 return r;
}
