// Temporary Git fixtures exercise selection and receipt rules, not real acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';
import {resolveCandidate,candidateArgument,candidateFile,candidateNote} from './acceptance-candidate.mjs';
import {loadA1Candidate} from './check-bff-a1-acceptance.mjs';
import {checkF06Candidate} from './check-f06-acceptance.mjs';
import {checkP0Candidate,requiredChecks} from './check-p0-acceptance.mjs';
import {validateSourceRun,releaseDispatch} from './check-f02-release-candidate.mjs';

function fixture(t){
 const root=mkdtempSync(resolve(tmpdir(),'quantos-candidate-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-q');git('config','user.name','Synthetic candidate test');git('config','user.email','fixture@example.invalid');git('config','commit.gpgsign','false');
 const put=(path,bytes)=>{mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),bytes);};
 for(const path of ['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/audit/F06-closed-findings-2026-09-25.md'])put(path,readFileSync(path));
 put('bff/a1-review-policy.json',readFileSync('bff/a1-review-policy.json'));put('bff/openapi/quantos-bff.v1.yaml','candidate-contract');put('packages/api-client/src/bff-gen/quantos-bff.zod.ts','candidate-generated');
 put('services/runtime.txt','candidate-runtime');git('add','.');git('commit','-qm','frozen candidate');const candidate=git('rev-parse','HEAD');
 const f06={schema:'quantos-f06-target-acceptance/v2',sourceCommit:candidate,status:'PASS',failures:[],...Object.fromEntries(['realOidcBff','executionRoleAndVault','denialMatrix'].map(k=>[k,{status:'PASS'}]))};
 const log=Buffer.from('SYNTHETIC SCHEMA FIXTURE; NOT TARGET EXECUTION'),logFields={logGzipBase64:gzipSync(log).toString('base64'),logSha256:createHash('sha256').update(log).digest('hex')};
 const p0={schema:'quantos-p0-acceptance/v1',sourceCommit:candidate,status:'PASS',failures:[],admission:'A1_ONLY',environment:'macos-web-mock-and-configured-supabase',closedIssues:['B-01','H-01','M-01'],controls:Array.from({length:16},(_,i)=>({id:`C${String(i+1).padStart(2,'0')}`,status:'PASS'})),checks:requiredChecks.map(c=>({...c,exit_code:0,...logFields})),negativeChecks:['contract-return-structure','contract-return-contract','contract-return-sabotage','contract-return-direct-vitest','contract-dead-branch','contract-unused-helper','contract-zero-assertion'].map(name=>({name,exit_code:1,...logFields}))};
 const note=(ref,receipt)=>git('notes','--ref=refs/notes/'+ref,'add','-f','-m',JSON.stringify(receipt),candidate);
 note('f06-acceptance',f06);note('p0-acceptance',p0);
 return {root,git,put,candidate,f06,p0,note};
}
test('documentation and evidence commits do not move the selected acceptance target',t=>{
 const f=fixture(t);for(const check of [checkF06Candidate,checkP0Candidate])assert.equal(check(f.candidate,{root:f.root}).status,'PASS');
 f.put('docs/audit/report.md','subsequent evidence index');f.git('add','.');f.git('commit','-qm','record evidence');
 f.put('services/runtime.txt','uncommitted newer runtime');
 for(const check of [checkF06Candidate,checkP0Candidate]){const r=check(f.candidate,{root:f.root});assert.equal(r.status,'PASS');assert.equal(r.sourceCommit,f.candidate);assert.notEqual(r.observedHead,f.candidate);assert.equal(r.currentHeadAcceptance,'NOT_CLAIMED');assert.equal(r.workingTreeAcceptance,'NOT_CLAIMED');}
 assert.equal(candidateFile(f.root,f.candidate,'services/runtime.txt').toString(),'candidate-runtime');
 assert.equal(candidateNote(f.root,f.git('rev-parse','HEAD'),'f06-acceptance'),null);
 assert.equal(checkF06Candidate(f.git('rev-parse','HEAD'),{root:f.root}).status,'FAIL','new HEAD cannot inherit candidate note');
});
test('changed runtime commits need their own receipt; the old candidate remains separately identifiable',t=>{
 const f=fixture(t);f.put('services/runtime.txt','new committed runtime');f.git('add','.');f.git('commit','-qm','runtime change');
 assert.equal(checkP0Candidate(f.git('rev-parse','HEAD'),{root:f.root}).status,'FAIL');
 f.note('f06-acceptance',{...f.f06,sourceCommit:f.git('rev-parse','HEAD')});assert.equal(checkF06Candidate(f.candidate,{root:f.root}).status,'FAIL');
});
test('selection rejects omitted, symbolic, abbreviated, nonexistent and non-ancestor commits',t=>{
 const f=fixture(t);for(const value of [null,'HEAD',f.candidate.slice(0,12),'a'.repeat(40),'$(id)'])assert.throws(()=>resolveCandidate(value,{root:f.root}));
 f.git('checkout','--orphan','unrelated');f.git('commit','-qm','unrelated root');assert.throws(()=>resolveCandidate(f.candidate,{root:f.root}));
 assert.throws(()=>candidateArgument(['--candidate',f.candidate,'--candidate',f.candidate]));
 assert.throws(()=>candidateFile(f.root,f.candidate,'../secret'));assert.throws(()=>candidateFile(f.root,f.candidate,'/absolute'));
});
test('formal CLIs never silently select HEAD',()=>{
 for(const path of ['check-f06-acceptance.mjs','check-p0-acceptance.mjs','check-bff-a1-acceptance.mjs']){
  const run=spawnSync(process.execPath,['scripts/'+path],{encoding:'utf8',env:{PATH:process.env.PATH,QUANTOS_SKIP_ENV:'1'}});assert.equal(run.status,1);assert.match(run.stderr,/Select a frozen candidate explicitly/);assert.doesNotMatch(run.stderr,/ReferenceError|TypeError/);
 }
});
const request={candidate:'a'.repeat(40),runId:'123',repository:'SumAlphaAI/QuantOS'};
const run={id:123,head_sha:request.candidate,run_attempt:1,status:'completed',conclusion:'success',event:'push',head_branch:'main',path:'.github/workflows/ci.yml',repository:{full_name:request.repository},head_repository:{full_name:request.repository}};
test('source CI run is pinned independently of later workflow/document HEAD',()=>assert.equal(validateSourceRun(run,request).sourceCommit,request.candidate));
for(const [name,change]of [['wrong SHA',r=>r.head_sha='b'.repeat(40)],['wrong run',r=>r.id=124],['failed CI',r=>r.conclusion='failure'],['pending CI',r=>r.status='in_progress'],['PR build',r=>r.event='pull_request'],['other branch',r=>r.head_branch='dev'],['other workflow',r=>r.path='.github/workflows/other.yml'],['other repo',r=>r.repository.full_name='Other/Repo'],['fork',r=>r.head_repository.full_name='Fork/Repo'],['missing attempt',r=>delete r.run_attempt]])test('promotion rejects '+name,()=>{const bad=structuredClone(run);change(bad);assert.throws(()=>validateSourceRun(bad,request));});
test('push, PR, schedule and non-main dispatch cannot authorize signing',()=>{
 const env={GITHUB_RUN_ID:'456',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:request.repository,CANDIDATE_SHA:request.candidate,SOURCE_RUN_ID:request.runId};assert.deepEqual(releaseDispatch(env),request);
 for(const event of ['push','pull_request','schedule'])assert.throws(()=>releaseDispatch({...env,GITHUB_EVENT_NAME:event}));assert.throws(()=>releaseDispatch({...env,GITHUB_REF:'refs/heads/dev'}));
});
test('automatic CI has no signing environment; manual promotion downloads only the requested source run',()=>{
 const ci=parse(readFileSync('.github/workflows/ci.yml','utf8')),release=parse(readFileSync('.github/workflows/sign-release-candidate.yml','utf8')),f09=parse(readFileSync('.github/workflows/f09-observability.yml','utf8')),r01=parse(readFileSync('.github/workflows/r01-market.yml','utf8'));
 assert.deepEqual(Object.keys(release.on),['workflow_dispatch']);for(const key of ['candidate_sha','source_run_id'])assert.equal(release.on.workflow_dispatch.inputs[key].required,true);
 assert(!JSON.stringify(ci).includes('f02-signing'));assert(!JSON.stringify(ci).includes('secrets.QUANTOS_SIGNING_KEY'));
 const job=release.jobs['sign-main'];assert.equal(job.environment,'f02-signing');assert.equal(job.needs,'signing-policy');
 const download=job.steps.find(s=>s.uses?.startsWith('actions/download-artifact@'));assert.equal(download.with['run-id'],'${{ inputs.source_run_id }}');assert.equal(download.with.name,'quantos-build-inputs');
 assert(job.steps.some(s=>s.run==='node scripts/verify-release.mjs artifacts/release "$CANDIDATE_SHA"'));
 assert.equal(f09.jobs['supabase-target'].if,"github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'");assert(f09.jobs['supabase-target'].needs.includes('release-candidate'));assert.equal(f09.jobs['supabase-target'].steps[0].with.ref,'${{ needs.release-candidate.outputs.source_sha }}');
 assert.equal(f09.on.workflow_dispatch.inputs.candidate_sha.required,true);
 assert.equal(r01.jobs['supabase-coverage'].if,f09.jobs['supabase-target'].if);assert(r01.jobs['supabase-coverage'].needs.includes('release-candidate'));assert.equal(r01.jobs['supabase-coverage'].steps[0].with.ref,'${{ needs.release-candidate.outputs.source_sha }}');
});
test('source-run and payload validation precede the only credential-bearing signing step',()=>{
 const workflow=parse(readFileSync('.github/workflows/sign-release-candidate.yml','utf8')),steps=workflow.jobs['sign-main'].steps;
 const source=steps.findIndex(s=>s.run==='node scripts/check-f02-release-candidate.mjs'),download=steps.findIndex(s=>s.uses?.startsWith('actions/download-artifact@')),payload=steps.findIndex(s=>s.run==='node scripts/verify-release.mjs artifacts/release "$CANDIDATE_SHA"'),sign=steps.findIndex(s=>s.env?.QUANTOS_SIGNING_KEY);
 assert(source>=0&&source<download&&download<payload&&payload<sign);assert.equal(steps.filter(s=>s.env?.QUANTOS_SIGNING_KEY).length,1);assert.equal(steps[sign].env.QUANTOS_REQUIRE_FORMAL_SIGNATURE,'1');assert(steps[sign].run.includes('node scripts/write-f02-promotion-receipt.mjs'));
 const writer=readFileSync('scripts/write-f02-promotion-receipt.mjs','utf8');assert(writer.includes('verifyRelease('));assert(writer.includes('verify-artifact-signatures.sh'));assert(writer.includes('validateSourceRun('));assert(writer.includes('deploymentPerformed:false'));assert(writer.includes('formalAccepted:false'));
 assert(readFileSync('scripts/write-f02-ci-receipt.mjs','utf8').includes('formalSignatureVerified:false'));
});

test('A1 reads contract/generation bytes at the selected commit, never later HEAD bytes',t=>{
 const f=fixture(t),before=loadA1Candidate(f.candidate,{root:f.root});
 f.put('bff/openapi/quantos-bff.v1.yaml','new-contract');f.git('add','.');f.git('commit','-qm','new contract candidate');
 const old=loadA1Candidate(f.candidate,{root:f.root}),current=loadA1Candidate(f.git('rev-parse','HEAD'),{root:f.root});
 assert.equal(old.inputsDigest,before.inputsDigest);assert.notEqual(current.inputsDigest,old.inputsDigest);assert.equal(old.currentHeadAcceptance,'NOT_CLAIMED');
});

test('A1 development CLI still checks current inputs without formal acceptance',()=>{
 const run=spawnSync(process.execPath,['scripts/check-bff-a1-acceptance.mjs','--stage','development'],{encoding:'utf8',env:{PATH:process.env.PATH,QUANTOS_SKIP_ENV:'1'}});assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.status,'PASS');assert.equal(result.formalAccepted,false);
});
test('all main-push workflows keep configured live credentials behind manual dispatch',()=>{
 for(const filename of readdirSync('.github/workflows').filter(p=>p.endsWith('.yml'))){
  const workflow=parse(readFileSync('.github/workflows/'+filename,'utf8'));
  if(!workflow.on?.push?.branches?.includes('main'))continue;
  for(const [name,job]of Object.entries(workflow.jobs))if(/\$\{\{\s*secrets\./.test(JSON.stringify(job))||job.environment){
   assert.equal(job.if,"github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",filename+':'+name);
   assert(job.needs.includes('release-candidate'),filename+': candidate preflight required');
  }
 }
});
