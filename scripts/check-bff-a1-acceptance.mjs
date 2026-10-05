import {readFileSync,realpathSync} from 'node:fs';
import {execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{resolve,sep}from'node:path';
import{loadBffFe000Inputs,validateBffFe000}from'./check-bff-fe-000.mjs';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fullSha=value=>/^[a-f0-9]{40}$/.test(value??'');
const hash=value=>/^[a-f0-9]{64}$/.test(value??'');
import { confirmationMode, confirmationPolicy, reviewDimensions, validateUserConfirmation, readConfirmationFile } from './user-acceptance-confirmation.mjs';
export function validateA1Stage(stage,{policy,development,receipt,sha,inputsDigest,evidenceReader,confirmationReader}) {
 const policyValid=policy?.schema==='quantos-bff-a1-review-policy/v1'&&policy?.taskId==='BFF-FE-000'&&
  policy?.developmentStage==='development'&&policy?.stagingRequiredAt==='final-review'&&policy?.confirmationRequiredAt==='final-review'&&policy?.confirmationMode===confirmationMode&&
  policy?.finalReviewTransition==='RE_REVIEW -> ACCEPTED'&&policy?.missingStagingBlocksDevelopment===false&&policy?.missingStagingBlocksFinalAcceptance===true&&
  JSON.stringify(policy?.checkpoints)===JSON.stringify(['PROVIDER:A1','FRONTEND-GATE:G0'])&&
  policy?.developmentCommand==='pnpm check:bff-a1-development'&&policy?.finalReviewCommand==='pnpm check:bff-a1-final-review';
 if(!policyValid||!['development','final-review'].includes(stage))return{status:'FAIL',stage,formalAccepted:false,failures:['valid A1 review-stage policy and explicit known stage required']};
 if(stage==='development')return{schema:'quantos-bff-a1-development/v1',stage,status:development?.status==='PASS'?'PASS':'FAIL',
  scope:'engineering baseline only',formalAccepted:false,stagingStatus:'DEFERRED_TO_FINAL_REVIEW',confirmationStatus:'PENDING_FINAL_REVIEW',
  failures:development?.status==='PASS'?[]:development?.failures??['development baseline has not passed']};
 const result=validateA1Receipt(receipt,sha,inputsDigest,evidenceReader,confirmationReader);
 return{...result,stage,formalAccepted:result.status==='PASS'};
}
export function validateA1Receipt(receipt,sha,inputsDigest,evidenceReader,confirmationReader=evidenceReader) {
 const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message);};
 check(fullSha(sha)&&receipt?.schema==='quantos-bff-a1-acceptance/v2'&&receipt?.sourceCommit===sha,'current full source SHA receipt required');
 check(hash(inputsDigest)&&receipt?.status==='PASS'&&receipt?.environment==='staging'&&receipt?.inputsDigest===inputsDigest,'staging PASS bound to current contract/generation inputs required');
 check(/^https:\/\//.test(receipt?.baseUrl??'')&&!/localhost|127\.0\.0\.1|\.(invalid|test|example)\b|example\.(com|org|net)/.test(receipt?.baseUrl??''),'real HTTPS staging provider required');
 const required=['cookie-session','request-response-schema','csrf-origin','idempotency-version','correlation-audit','sse-recovery-revocation','sensitive-fields'];
 check(Array.isArray(receipt?.checks)&&receipt.checks.length===required.length&&required.every(name=>receipt.checks.filter(c=>c.name===name&&c.status==='PASS'&&c.requestId&&hash(c.logSha256)&&c.evidence).length===1),'all seven staging evidence categories required');
 for(const item of receipt?.checks??[]) {
  try {const log=evidenceReader?.(item.evidence);check(log!==undefined&&sha256(log)===item.logSha256,`verified staging evidence ${item.name}`);}
  catch {check(false,`unreadable staging evidence ${item.name}`);}
 }
 try {confirmationPolicy();validateUserConfirmation(receipt?.confirmation,{nodeId:'BFF-FE-000',stage:'RELEASE',sourceCommit:sha,inputsDigest:'sha256:'+inputsDigest,reviewDimensions:[...reviewDimensions,'Domain']},confirmationReader);}
 catch(error){check(false,'project user final confirmation required: '+error.message);}
 return{schema:'quantos-bff-a1-verification/v1',status:failures.length?'NOT_ACCEPTED':'PASS',failures};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);
 if(args.length&&!(args.length===2&&args[0]==='--stage'&&['development','final-review'].includes(args[1])))throw Error('Usage: --stage development|final-review');
 // The legacy acceptance command remains strict; development uses its explicit command.
 const stage=args[1]??'final-review';
 const policy=JSON.parse(readFileSync('bff/a1-review-policy.json','utf8'));
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const inputsDigest=sha256(Buffer.concat([readFileSync('bff/openapi/quantos-bff.v1.yaml'),readFileSync('packages/api-client/src/bff-gen/quantos-bff.zod.ts')]));
 if(stage==='development') {
  const result=validateA1Stage(stage,{policy,development:validateBffFe000(loadBffFe000Inputs())});
  console.log(JSON.stringify({...result,sourceCommit:sha,inputsDigest},null,2));if(result.status!=='PASS')process.exitCode=1;
 }else {
 const evidenceRoot=realpathSync('docs/audit/evidence');
 const reader=path=>{const file=realpathSync(resolve(path));if(!file.startsWith(evidenceRoot+sep))throw Error('Receipt evidence must be under docs/audit/evidence');return readFileSync(file);};
 let receipt;try{receipt=JSON.parse(readFileSync(process.env.QUANTOS_BFF_A1_RECEIPT??'docs/audit/evidence/bff-a1-staging-acceptance.json','utf8'));}catch{}
 const result=validateA1Stage(stage,{policy,receipt,sha,inputsDigest,evidenceReader:reader,confirmationReader:readConfirmationFile});
 const sourcePaths=['bff','packages','apps','services','crates','scripts','tests','.github','Cargo.toml','Cargo.lock','package.json','pnpm-lock.yaml','Makefile'];
 try {
  execFileSync('git',['diff','--quiet','HEAD','--',...sourcePaths]);
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...sourcePaths],{encoding:'utf8'}).trim();
  if(untracked)throw Error('Uncommitted source');
 }catch {result.status='NOT_ACCEPTED';result.formalAccepted=false;result.failures.push('source worktree must match receipt HEAD; evidence/doc updates alone do not change source');}
 console.log(JSON.stringify({...result,sourceCommit:sha,inputsDigest},null,2));if(result.status!=='PASS')process.exitCode=1;
 }
}
