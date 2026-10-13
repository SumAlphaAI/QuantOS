import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
export function candidateArgument(args){
 const remaining=[...args],at=remaining.indexOf('--candidate');
 if(at<0)return {candidate:null,remaining};
 const candidate=remaining[at+1];remaining.splice(at,2);
 assert(!remaining.includes('--candidate'),'duplicate candidate');
 assert(/^[a-f0-9]{40}$/.test(candidate??''),'candidate must be a full lowercase commit SHA');
 return {candidate,remaining};
}
export function resolveCandidate(candidate,{root=process.cwd()}={}){
 assert(/^[a-f0-9]{40}$/.test(candidate??''),'Select a frozen candidate explicitly: --candidate <40-character SHA>; HEAD is not selected automatically');
 assert.equal(git(root,'rev-parse',candidate+'^{commit}').trim(),candidate,'candidate must identify a commit');
 const observedHead=git(root,'rev-parse','HEAD').trim();
 git(root,'merge-base','--is-ancestor',candidate,observedHead);
 return {sourceCommit:candidate,observedHead,validationTarget:'FROZEN_CANDIDATE_ONLY',currentHeadAcceptance:'NOT_CLAIMED',workingTreeAcceptance:'NOT_CLAIMED'};
}
export function candidateFile(root,sourceCommit,path){
 assert(/^[a-f0-9]{40}$/.test(sourceCommit));
 assert(path&&!path.startsWith('/')&&!path.split(/[\\/]/).some(p=>p==='..'||p===''),'invalid candidate path');
 return execFileSync('git',['show',sourceCommit+':'+path],{cwd:root,maxBuffer:32*1024*1024});
}
export function candidateNote(root,sourceCommit,ref){
 assert(/^[a-f0-9]{40}$/.test(sourceCommit));
 assert(/^[a-z0-9-]+$/.test(ref));
 try{return JSON.parse(git(root,'notes','--ref=refs/notes/'+ref,'show',sourceCommit));}catch{return null;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const {candidate,remaining}=candidateArgument(process.argv.slice(2));assert(remaining.length===0||(remaining.length===1&&remaining[0]==='--github-output'),'Usage: --candidate <SHA> [--github-output]');const result=resolveCandidate(candidate);if(remaining.length){assert(process.env.GITHUB_OUTPUT);appendFileSync(process.env.GITHUB_OUTPUT,'source_sha='+result.sourceCommit+'\n');}console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}
}
