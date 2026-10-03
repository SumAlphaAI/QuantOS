import {readFileSync,realpathSync} from 'node:fs';
import {execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{resolve,sep}from'node:path';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fullSha=value=>/^[a-f0-9]{40}$/.test(value??'');
const hash=value=>/^[a-f0-9]{64}$/.test(value??'');
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now();
export function validateA1Receipt(receipt,sha,inputsDigest,evidenceReader) {
 const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message);};
 check(fullSha(sha)&&receipt?.schema==='quantos-bff-a1-acceptance/v1'&&receipt?.sourceCommit===sha,'current full source SHA receipt required');
 check(hash(inputsDigest)&&receipt?.status==='PASS'&&receipt?.environment==='staging'&&receipt?.inputsDigest===inputsDigest,'staging PASS bound to current contract/generation inputs required');
 check(/^https:\/\//.test(receipt?.baseUrl??'')&&!/localhost|127\.0\.0\.1|\.(invalid|test|example)\b|example\.(com|org|net)/.test(receipt?.baseUrl??''),'real HTTPS staging provider required');
 const required=['cookie-session','request-response-schema','csrf-origin','idempotency-version','correlation-audit','sse-recovery-revocation','sensitive-fields'];
 check(Array.isArray(receipt?.checks)&&receipt.checks.length===required.length&&required.every(name=>receipt.checks.filter(c=>c.name===name&&c.status==='PASS'&&c.requestId&&hash(c.logSha256)&&c.evidence).length===1),'all seven staging evidence categories required');
 for(const item of receipt?.checks??[]) {
  try {const log=evidenceReader?.(item.evidence);check(log!==undefined&&sha256(log)===item.logSha256,`verified staging evidence ${item.name}`);}
  catch {check(false,`unreadable staging evidence ${item.name}`);}
 }
 const roles=['Product','Frontend','BFF','QA','Security','Risk','Domain'];
 check(Array.isArray(receipt?.signatures)&&receipt.signatures.length===roles.length&&roles.every(role=>receipt.signatures.filter(s=>s.role===role&&s.sourceCommit===sha&&s.identity&&timestamp(s.signedAt)&&s.receipt&&hash(s.receiptSha256)).length===1),'current seven-role G0/A1 signatures required');
 for(const sign of receipt?.signatures??[]) {
  try {
   const raw=evidenceReader?.(sign.receipt);const attestation=JSON.parse(raw);
   check(sha256(raw)===sign.receiptSha256&&attestation.schema==='quantos-g0-role-signoff/v1'&&attestation.approved===true&&attestation.sourceCommit===sha&&attestation.inputsDigest===inputsDigest&&attestation.role===sign.role&&attestation.identity===sign.identity&&attestation.signedAt===sign.signedAt,`verified signoff receipt ${sign.role}`);
  }catch {check(false,`unreadable signoff receipt ${sign.role}`);}
 }
 return{schema:'quantos-bff-a1-verification/v1',status:failures.length?'NOT_ACCEPTED':'PASS',failures};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const inputsDigest=sha256(Buffer.concat([readFileSync('bff/openapi/quantos-bff.v1.yaml'),readFileSync('packages/api-client/src/bff-gen/quantos-bff.zod.ts')]));
 const evidenceRoot=realpathSync('docs/audit/evidence');
 const reader=path=>{const file=realpathSync(resolve(path));if(!file.startsWith(evidenceRoot+sep))throw Error('Receipt evidence must be under docs/audit/evidence');return readFileSync(file);};
 let receipt;try{receipt=JSON.parse(readFileSync(process.env.QUANTOS_BFF_A1_RECEIPT??'docs/audit/evidence/bff-a1-staging-acceptance.json','utf8'));}catch{}
 const result=validateA1Receipt(receipt,sha,inputsDigest,reader);
 const sourcePaths=['bff','packages','apps','services','crates','scripts','tests','.github','Cargo.toml','Cargo.lock','package.json','pnpm-lock.yaml','Makefile'];
 try {
  execFileSync('git',['diff','--quiet','HEAD','--',...sourcePaths]);
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...sourcePaths],{encoding:'utf8'}).trim();
  if(untracked)throw Error('Uncommitted source');
 }catch {result.status='NOT_ACCEPTED';result.failures.push('source worktree must match receipt HEAD; evidence/doc updates alone do not change source');}
 console.log(JSON.stringify({...result,sourceCommit:sha,inputsDigest},null,2));if(result.status!=='PASS')process.exitCode=1;
}
