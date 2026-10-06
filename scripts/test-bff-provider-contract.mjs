/** Real loopback HTTP against the Rust reference provider; never starts a database. */
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import YAML from 'yaml';
import {operations,validateRequest,validateResponse} from '../tests/contract/http-contract.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const output=process.argv[2]??resolve(root,'artifacts/bff-provider-contract.json');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));
const port=reserve.address().port;await new Promise(r=>reserve.close(r));
execFileSync('cargo',['build','-p','bff-gateway','--bin','bff-gateway','--locked','--offline'],{cwd:root,stdio:'inherit'});
const child=spawn(resolve(root,'target/debug/bff-gateway'),[],{cwd:root,env:{...process.env,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
const records=[];let reauth;let challenge;let exportId;let profileVersion='profile-v1';let notificationVersion='notifications-v1';
const uuid='aaaaaaaa-1111-4111-8111-111111111111';
const base=`http://127.0.0.1:${port}`;
async function call(id,bodyOverride,unsafe=false,expectedStatus,overrides={}) {
 const op=operations.get(id);const params={};
 const path=op.path.replace(/\{([^}]+)\}/g,(_,name)=>params[name]=({sessionId:'session-remote',deviceId:'device-remote',factorId:'factor-totp',correlationId:uuid,exportId:exportId??'eeeeeeee-1111-4111-8111-111111111111'})[name]??uuid);
 const headers={cookie:'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',Origin:'http://localhost:3190','X-CSRF-Token':'csrf-token-0000000000000001','X-Request-Id':randomUUID(),'Idempotency-Key':randomUUID(),'X-Reauth-Token-Ref':reauth??uuid,'If-Match':id==='saveNotificationPrefs'?notificationVersion:profileVersion};
 const body=bodyOverride??op.requestBody?.content['application/json'].example;
 Object.assign(headers,overrides);
 if(body!==undefined)headers['content-type']='application/json';
 const request=new Request(base+path,{method:op.method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 if(!unsafe){const issues=(await validateRequest(id,request,params)).issues;if(issues.length)throw Error(id+' invalid harness request '+issues.join(';'));}
 const response=await fetch(request);
 const issues=await validateResponse(id,response);
 let payload;
 if(response.status!==204&&response.headers.get('content-type')?.includes('application/json'))payload=await response.clone().json();
 if(op.responses[response.status]?.content?.['text/event-stream']) {
   const reader=response.body.getReader(); const frame=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE first frame timeout')),5000))]);
   const text=new TextDecoder().decode(frame.value);await reader.cancel();for(const line of text.split('\n').filter(s=>s.startsWith('data: ')))issues.push(...validateFixture(JSON.parse(line.slice(6)),{schema:'StreamEvent'}));
 }
 records.push({operationId:id,status:response.status,requestValidation:unsafe?'EXPECTED_INVALID':'PASS',responseValidation:issues.length?'FAIL':'PASS',issues});
 if(issues.length)throw Error(id+' OpenAPI violation '+issues.join(';'));
 if(expectedStatus ? response.status!==expectedStatus : !unsafe&&!response.ok)throw Error(id+' unexpected business status '+response.status);
 if(payload?.objectVersion){if(id==='saveProfile')profileVersion=payload.objectVersion;if(id==='saveNotificationPrefs')notificationVersion=payload.objectVersion;}
 return {response,payload};
}
let failure;
try {
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Reference provider startup timeout')),30000);
  child.once('exit',()=>{clearTimeout(timer);reject(Error('Reference provider exited before readiness'));});
  child.stdout.on('data',chunk=>{if(chunk.toString().includes('"ready":true')){clearTimeout(timer);resolve();}});
  child.stderr.on('data',()=>{});
 });
 challenge=(await call('mfaChallenge',{purpose:'security_change',code:'123456'})).payload.challengeRef;
 reauth=(await call('reauth',{challengeRef:challenge})).payload.reauthTokenRef;
 const catalog=YAML.parse(readFileSync(resolve(root,'bff/page-operation-catalog.yaml'),'utf8'));
 const scope=['C01','C17','C10'].flatMap(id=>catalog.contracts[id].publishedOperations);
 // Positive requests must reference the correlation seeded by this provider.
 const exportBody=structuredClone(operations.get('createExport').requestBody.content['application/json'].example);
 exportBody.scope.correlationIds=[uuid];
 for(const id of scope.filter(id=>!['logout','mfaChallenge','reauth','getExportStatus','getExportDownload','cancelExport'].includes(id))) {
  let body=id==='createExport'?exportBody:undefined;
  if(id==='submitAccessRequest')body={teamName:'Research',contactEmail:'synthetic@example.invalid',purpose:'Paper research',markets:['digital-assets'],expectedMode:'paper',privacyNoticeVersion:'2026-10-03'};
  const result=await call(id,body);if(id==='createExport')exportId=result.payload?.exportId;
 }
 const createKey=randomUUID();const created=(await call('createExport',exportBody,false,202,{'Idempotency-Key':createKey})).payload;
 const replay=(await call('createExport',exportBody,false,202,{'Idempotency-Key':createKey})).payload;
 if(JSON.stringify(created)!==JSON.stringify(replay))throw Error('export same intent must replay the original result');
 for(const [field,value]of [['reason','A distinct legitimate purpose'],['scope',{correlationIds:[randomUUID()]}],['format','csv'],['watermark','Another watermark'],['retentionDays',14]]) {
  const conflict=await call('createExport',{...exportBody,[field]:value},false,409,{'Idempotency-Key':createKey});
  if(conflict.payload.code!=='IDEMPOTENCY_CONFLICT')throw Error('changed export intent must conflict before side effects');
 }
 await call('getExportStatus');await call('getExportStatus');await call('getExportDownload');
 const cancelKey=randomUUID();const cancelled=(await call('cancelExport',undefined,false,202,{'Idempotency-Key':cancelKey})).payload;
 const cancelledReplay=(await call('cancelExport',undefined,false,202,{'Idempotency-Key':cancelKey})).payload;
 if(JSON.stringify(cancelled)!==JSON.stringify(cancelledReplay))throw Error('cancel same resource must replay');
 exportId=created.exportId;
 const conflict=await call('cancelExport',undefined,false,409,{'Idempotency-Key':cancelKey});
 if(conflict.payload.code!=='IDEMPOTENCY_CONFLICT')throw Error('changed cancel resource must conflict');
 if((await call('getExportStatus')).payload.status==='cancelled')throw Error('conflicting cancel changed another export');
 const invalid=await call('saveProfile',{...operations.get('saveProfile').requestBody.content['application/json'].example,actorId:uuid},true);
 if(invalid.response.status!==422)throw Error('Reference provider accepted forged actor');
 await call('logout');
 if(!scope.every(id=>records.some(r=>r.operationId===id)))throw Error('Reference operation inventory is incomplete');
}catch(error){failure=error.message;}finally{child.kill('SIGTERM');await new Promise(r=>child.once('close',r));}
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({schema:'quantos-bff-provider-contract/v1',scope:'loopback-reference-only; no DB/IdP/storage/staging',status:failure?'FAIL':'PASS',records,failure:failure??null},null,2)+'\n');
console.log(JSON.stringify({status:failure?'FAIL':'PASS',records:records.length,failure:failure??null}));
if(failure)process.exitCode=1;
