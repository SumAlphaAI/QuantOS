// Read-only source audit: synthetic loopback reference provider, no database.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {operations,validateResponse} from '../../../../tests/contract/http-contract.mjs';
import {validatePlans} from '../../../../scripts/check-development-plans.mjs';
import {loadBffFe000Inputs,validateBffFe000} from '../../../../scripts/check-bff-fe-000.mjs';
const output=new URL('.',import.meta.url);
const core=readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8');
const frontend=readFileSync('docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','utf8');
const baseline=validatePlans(core,frontend);
const nodes=new Map(baseline.tasks.map(t=>[t.task_type==='CORE'?'CORE:'+t.task_id:'FE:'+t.task_id,t]));
for(const text of [core,frontend])for(const match of text.matchAll(/```json\n([\s\S]*?)\n```/g)){const node=JSON.parse(match[1]);if(node.checkpoint_id)nodes.set(node.checkpoint_id,node);}
const selected=new Set();function visit(id){if(selected.has(id))return;selected.add(id);for(const dep of nodes.get(id).depends_on)visit(dep.includes(':')?dep:'FE:'+dep);}visit('PROVIDER:A1');
const fake=gate=>({...gate,status:'READY',input_digest:'sha256:'+'a'.repeat(64),evidence:['./audit/F01-remediation-2026-09-17.md']});
function mark(text,namespace){return text.replace(/^- stage_gate: (\{.*\})$/gm,(block,raw,offset)=>{const task=[...text.slice(0,offset).matchAll(/^- task_id: `([^`]+)`/gm)].at(-1)?.[1];return selected.has(namespace+task)?'- stage_gate: '+JSON.stringify(fake(JSON.parse(raw))):block;}).replace(/```json\n([\s\S]*?)\n```/g,(block,raw)=>{const data=JSON.parse(raw);if(!selected.has(data.checkpoint_id))return block;data.stage_gate=fake(data.stage_gate);return '```json\n'+JSON.stringify(data,null,2)+'\n```';});}
const staticResult=validatePlans(mark(core,'CORE:'),mark(frontend,'FE:'));delete staticResult.tasks;delete staticResult.execution_order;
writeFileSync(new URL('dependency-stage-snapshot.json',output),JSON.stringify({checkpoint:'PROVIDER:A1',nodes:[...selected].map(id=>({id,depends_on:nodes.get(id).depends_on,development_status:nodes.get(id).development_status??null,review_status:nodes.get(id).review_status,source_commit:nodes.get(id).source_commit,stage_gate:nodes.get(id).stage_gate}))},null,2)+'\n');
writeFileSync(new URL('stage-binding-probe.json',output),JSON.stringify({schema:'quantos-provider-a1-audit-stage-probe/v1',scope:'in-memory mutation only; static validator explicitly does not verify evidence content',engineeringBaseline:validateBffFe000(loadBffFe000Inputs()),arbitraryDigest:'sha256:'+'a'.repeat(64),evidence:'docs/audit/F01-remediation-2026-09-17.md',actualEvidenceSha256:createHash('sha256').update(readFileSync('docs/audit/F01-remediation-2026-09-17.md')).digest('hex'),staticAcceptedUnboundDevelopmentReceipts:true,staticResult},null,2)+'\n');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const child=spawn(resolve('target/debug/bff-gateway'),[],{env:{...process.env,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
const records=[];let grant;
const standard={'cookie':'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',Origin:'http://localhost:3190','X-CSRF-Token':'csrf-token-0000000000000001','If-Match':'profile-v1'};
async function call(name,id,expected,{body,headers={},path,key}={}) {
 const op=operations.get(id);const h={...standard,'X-Request-Id':randomUUID(),'Idempotency-Key':key??randomUUID(),...(grant?{'X-Reauth-Token-Ref':grant}:{}),...headers};
 for(const [k,v]of Object.entries(h))if(v===null)delete h[k];
 body=body??op.requestBody?.content['application/json']?.example;
 if(body!==undefined)h['Content-Type']='application/json';
 const response=await fetch(`http://127.0.0.1:${port}`+(path??op.path),{method:op.method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
 const issues=await validateResponse(id,response);let payload;
 if(response.headers.get('content-type')?.includes('application/json'))payload=await response.json();
 records.push({name,operationId:id,expectedStatus:expected,actualStatus:response.status,responseValidation:issues.length?'FAIL':'PASS',issues,code:payload?.code??null,result:response.status===expected&&!issues.length?'PASS':'FAIL'});
 return payload;
}
try {
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('startup timeout')),10000);child.stdout.on('data',c=>{if(c.toString().includes('"ready":true')){clearTimeout(timer);r();}});child.once('exit',()=>{clearTimeout(timer);j(Error('provider exited'));});});
 await call('missing-session','getSession',401,{headers:{cookie:null}});
 await call('invalid-session','getSession',401,{headers:{cookie:'quantos_session=invalid'}});
 await call('missing-CSRF','saveProfile',403,{headers:{'X-CSRF-Token':null}});
 await call('bad-origin','saveProfile',403,{headers:{Origin:'https://evil.example.invalid'}});
 await call('missing-idempotency','saveProfile',422,{headers:{'Idempotency-Key':null}});
 await call('invalid-request-id','saveProfile',422,{headers:{'X-Request-Id':'invalid'}});
 await call('forged-actor','saveProfile',422,{body:{...operations.get('saveProfile').requestBody.content['application/json'].example,actorId:randomUUID()}});
 await call('stale-version','saveProfile',409,{headers:{'If-Match':'profile-v0'}});
 await call('viewer-capability','searchAuditEvents',403,{headers:{cookie:'quantos_session=session-viewer'}});
 await call('unknown-sort','searchAuditEvents',422,{path:operations.get('searchAuditEvents').path+'?sort=unknown:asc'});
 const challenge=await call('valid-MFA-setup','mfaChallenge',200,{body:{purpose:'security_change',code:'123456'}});
 grant=(await call('valid-reauth-setup','reauth',200,{body:{challengeRef:challenge.challengeRef}})).reauthTokenRef;
 const exportBody=structuredClone(operations.get('createExport').requestBody.content['application/json'].example);
 const exportKey=randomUUID();const first=await call('export-create','createExport',202,{body:exportBody,key:exportKey});
 const replay=await call('export-same-intent-replay','createExport',202,{body:exportBody,key:exportKey});records.at(-1).sameExportId=replay.exportId===first.exportId;if(!records.at(-1).sameExportId)records.at(-1).result='FAIL';
 const conflict=await call('export-changed-intent','createExport',409,{body:{...exportBody,reason:'A different legitimate purpose'},key:exportKey});records.at(-1).replayedOriginalExport=conflict.exportId===first.exportId;
 const second=await call('export-second-create','createExport',202,{body:exportBody});
 const cancelKey=randomUUID();await call('export-cancel-first','cancelExport',202,{path:operations.get('cancelExport').path.replace('{exportId}',first.exportId),key:cancelKey});
 const other=await call('export-cancel-other-resource','cancelExport',409,{path:operations.get('cancelExport').path.replace('{exportId}',second.exportId),key:cancelKey});records.at(-1).returnedWrongExportId=other.exportId===first.exportId;
}catch(e){records.push({name:'harness-error',result:'FAIL',error:e.message});}finally{child.kill('SIGTERM');await new Promise(r=>child.once('close',r));}
const result={schema:'quantos-provider-a1-audit-negative/v1',scope:'C01/C17/C10 synthetic reference provider only; no DB/IdP/storage/staging',status:records.every(r=>r.result==='PASS')?'PASS':'FAIL',passed:records.filter(r=>r.result==='PASS').length,total:records.length,records};
writeFileSync(new URL('independent-http-probes.json',output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,passed:result.passed,total:result.total,failures:records.filter(r=>r.result==='FAIL')}));if(result.status==='FAIL')process.exitCode=1;
