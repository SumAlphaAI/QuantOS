import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {operations,validateRequest,validateResponse} from '../../../../tests/contract/http-contract.mjs';
const root='/Users/anray/Documents/project/SumAlpha/QuantOS';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const child=spawn(root+'/target/debug/bff-gateway',[],{cwd:root,env:{...process.env,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_BIND:'127.0.0.1:'+port},stdio:['ignore','pipe','pipe']});
const observations=[];
try{
 await new Promise((resolve,reject)=>{child.stdout.on('data',c=>{if(c.toString().includes('"ready":true'))resolve();});child.once('exit',()=>reject(Error('reference start failed')));});
 const headers={cookie:'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',Origin:'http://localhost:3190','X-CSRF-Token':'csrf-token-0000000000000001','X-Request-Id':randomUUID(),'Idempotency-Key':randomUUID(),'If-Match':'profile-v1','content-type':'application/json'};
 const input={...operations.get('saveProfile').requestBody.content['application/json'].example,email:'forged@example.invalid',emailVerified:true,roleLabels:['admin'],memberId:'forged-member'};
 const req=new Request('http://127.0.0.1:'+port+'/v1/settings/profile',{method:'PUT',headers,body:JSON.stringify(input)});
 const validation=await validateRequest('saveProfile',req);
 const response=await fetch(req);const payload=await response.clone().json();const responseIssues=await validateResponse('saveProfile',response);
 const read=await fetch('http://127.0.0.1:'+port+'/v1/settings/profile',{headers:{cookie:headers.cookie}});const stored=await read.json();
 observations.push({probe:'server-owned-profile-field-write',requestIssues:validation.issues,status:response.status,responseIssues,persistedSpoof:stored.email===input.email&&stored.roleLabels[0]==='admin'&&stored.memberId===input.memberId});
 const corruptRequest=new Request('http://127.0.0.1:'+port+'/v1/settings/profile',{method:'PUT',headers:{...headers,'If-Match':payload.objectVersion,'Idempotency-Key':randomUUID()},body:JSON.stringify({...input,email:123})});
 const corruptValidation=await validateRequest('saveProfile',corruptRequest);const corrupt=await fetch(corruptRequest);
 observations.push({probe:'persisted-response-shape-corruption',requestIssues:corruptValidation.issues,status:corrupt.status,responseIssues:await validateResponse('saveProfile',corrupt)});
}finally{child.kill('SIGTERM');writeFileSync(root+'/docs/audit/evidence/bff-fe-001-review-20261005/reference-profile-probe.json',JSON.stringify({scope:'loopback reference only; no external data touched',observations},null,2)+'\n');}
console.log(JSON.stringify(observations));
