import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateF06Acceptance} from './check-f06-acceptance.mjs';
const root=resolve(import.meta.dirname,'..');
export const requiredChecks=JSON.parse(readFileSync(new URL('./p0-required-checks.json',import.meta.url))).checks;
export function validateP0Receipt({receipt,sourceCommit,plan,corePlan,f06,archivedFindings}) {
  const failures=[];
  const check=(ok,message)=>{if(!ok)failures.push(message);};
  check(/^[a-f0-9]{40}$/.test(sourceCommit),'full source SHA required');
  check(receipt?.schema==='quantos-p0-acceptance/v1'&&receipt.sourceCommit===sourceCommit,'missing receipt or source SHA mismatch');
  check(receipt?.status==='PASS'&&Array.isArray(receipt.failures)&&receipt.failures.length===0,'receipt must be a clean PASS');
  check(receipt?.admission==='A1_ONLY','P0 must only admit A1');
  check(receipt?.environment==='macos-web-mock-and-configured-supabase','explicit validated environment required');
  check(JSON.stringify(receipt?.closedIssues)===JSON.stringify(['B-01','H-01','M-01']),'all three audit findings must be closed');
  check(Array.isArray(receipt?.controls)&&receipt.controls.length===16&&receipt.controls.every((c,i)=>c.id===`C${String(i+1).padStart(2,'0')}`&&c.status==='PASS'),'sixteen unique passing controls required');
  for(const id of ['PRE-01','PRE-02','PRE-03','PRE-04','PRE-05','PRE-06']) {
    const section=plan.split(`<a id="task-${id.toLowerCase()}"></a>`)[1]?.split('<a id=')[0];
    check(section?.includes('- development_status: `COMPLETED`'),`${id} is not completed`);
  }
  const f06Result=validateF06Acceptance({plan:corePlan,receipt:f06,sourceCommit,archivedFindings});
  check(f06Result.status==='PASS','same-SHA F06 target acceptance required');
  const records=receipt?.checks??[];
  check(records.length===requiredChecks.length,'check inventory mismatch');
  for(const expected of requiredChecks) {
    const matches=records.filter(c=>c.name===expected.name);const record=matches[0];
    check(matches.length===1&&JSON.stringify(record?.command)===JSON.stringify(expected.command)&&record.exit_code===0,`missing or failed check: ${expected.name}`);
  }
  // Logs travel with the note, avoiding missing local files and stale HTTPS links.
  for(const record of [...records,...(receipt?.negativeChecks??[])]) {
    try {
      const bytes=gunzipSync(Buffer.from(record.logGzipBase64,'base64'),{maxOutputLength:8*1024*1024});
      check(createHash('sha256').update(bytes).digest('hex')===record.logSha256,`log digest mismatch: ${record.name}`);
    } catch {failures.push(`missing or invalid embedded log: ${record.name}`);}
  }
  const negatives=['contract-return-structure','contract-return-contract','contract-return-sabotage','contract-return-direct-vitest','contract-dead-branch','contract-unused-helper','contract-zero-assertion'];
  check(receipt?.negativeChecks?.length===negatives.length&&negatives.every(name=>receipt.negativeChecks.filter(c=>c.name===name&&c.exit_code===1).length===1),'execution-negative evidence missing or not rejected');
  return {schema:'quantos-p0-verification/v1',status:failures.length?'FAIL':'PASS',sourceCommit,admission:failures.length?'NONE':'A1_ONLY',failures};
}
export function readNote(ref,sha) {
  try{return JSON.parse(execFileSync('git',['notes',`--ref=refs/notes/${ref}`,'show',sha],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{return null;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const result=validateP0Receipt({sourceCommit,receipt:readNote('p0-acceptance',sourceCommit),f06:readNote('f06-acceptance',sourceCommit),plan:readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'),'utf8'),corePlan:readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Development-Plan.md'),'utf8'),archivedFindings:readFileSync(resolve(root,'docs/audit/F06-closed-findings-2026-09-25.md'),'utf8')});
  if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()){result.failures.push('working tree must be clean');result.status='FAIL';result.admission='NONE';}
  console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;
}
