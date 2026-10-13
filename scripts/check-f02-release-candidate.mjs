import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveCandidate} from './acceptance-candidate.mjs';

export function validateSourceRun(run,{candidate,runId,repository}){
 assert(/^[a-f0-9]{40}$/.test(candidate));assert(/^[1-9][0-9]*$/.test(String(runId)));assert(/^[\w.-]+\/[\w.-]+$/.test(repository));
 assert.equal(String(run.id),String(runId));assert.equal(run.head_sha,candidate,'CI source differs from frozen candidate');
 assert(Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0);
 assert.equal(run.status,'completed');assert.equal(run.conclusion,'success','source CI must succeed');
 assert.equal(run.event,'push');assert.equal(run.head_branch,'main');
 assert.equal(run.path,'.github/workflows/ci.yml','source run must be QuantOS CI');
 assert.equal(run.repository?.full_name,repository);assert.equal(run.head_repository?.full_name,repository,'fork source run rejected');
 return {sourceCommit:candidate,sourceRunId:String(runId),sourceRunAttempt:run.run_attempt};
}
export function releaseDispatch(env){
 assert(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID??''),'GitHub promotion run identity required');
 assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(env.GITHUB_REF,'refs/heads/main','signing dispatch must use protected main workflow');
 assert(/^[a-f0-9]{40}$/.test(env.CANDIDATE_SHA??''));assert(/^[1-9][0-9]*$/.test(env.SOURCE_RUN_ID??''));assert(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY??''));
 return {candidate:env.CANDIDATE_SHA,runId:env.SOURCE_RUN_ID,repository:env.GITHUB_REPOSITORY};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const request=releaseDispatch(process.env);const candidate=resolveCandidate(request.candidate);assert(process.env.GITHUB_TOKEN,'read-only Actions token required');const response=await fetch('https://api.github.com/repos/'+request.repository+'/actions/runs/'+request.runId,{headers:{authorization:'Bearer '+process.env.GITHUB_TOKEN,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000),redirect:'error'});assert.equal(response.status,200,'source CI metadata read failed');const run=await response.json();const proof=validateSourceRun(run,request);mkdirSync('artifacts/f02',{recursive:true});writeFileSync('artifacts/f02/source-ci-run.json',JSON.stringify(run,null,2)+'\n');console.log(JSON.stringify({...candidate,...proof,formalAccepted:false}));}catch(e){console.error(e.message);process.exitCode=1;}
}
