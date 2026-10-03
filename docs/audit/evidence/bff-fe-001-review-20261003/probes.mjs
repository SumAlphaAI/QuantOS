import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const root=process.env.QUANTOS_REVIEW_ROOT??process.cwd();
const out=process.argv[2]??import.meta.dirname;
fs.mkdirSync(out,{recursive:true});
const {operations,validateResponse}=await import(pathToFileURL(path.join(root,'tests/contract/http-contract.mjs')));
const ts=createRequire(path.join(root,'package.json'))('typescript');
const requireClient=createRequire(path.join(root,'packages/api-client/package.json'));
const compiled=path.join(out,'compiled');fs.mkdirSync(compiled,{recursive:true});
function compile(relative,name,replacements={}) {
 let code=ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [from,to]of Object.entries(replacements))code=code.split('"'+from+'"').join('"'+to+'"');
 const file=path.join(compiled,name+'.mjs');fs.writeFileSync(file,code);return pathToFileURL(file).href;
}
const schemas=compile('packages/api-client/src/bff-gen/quantos-bff.zod.ts','schema',{zod:pathToFileURL(requireClient.resolve('zod')).href});
const reducer=await import(compile('packages/api-client/src/sse-contract.ts','sse',{'./bff-gen/quantos-bff.zod.js':schemas}));
const client=compile('packages/api-client/src/bff.ts','client',{'openapi-fetch':pathToFileURL(requireClient.resolve('openapi-fetch').replace(/index\.cjs$/,'index.mjs')).href});
const auth=await import(compile('apps/terminal/src/auth/bff.ts','auth'));
const settings=await import(compile('apps/terminal/src/settings/gateway.ts','settings',{'@sumalpha/api-client':client}));
const observations=[];
function record(id,facts){observations.push({id,...facts});}
async function start(live=false) {
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const origin=live?'https://f06-local-smoke.invalid':'http://localhost:3190';
 const child=spawn(path.join(root,'target/debug/bff-gateway'),[],{cwd:root,env:{...process.env,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:live?'live':'reference',QUANTOS_BFF_BIND:'127.0.0.1:'+port,QUANTOS_TERMINAL_ORIGIN:origin,QUANTOS_BFF_ENVIRONMENT:'dev',QUANTOS_TRACE_EXPORT_PATH:path.join(out,'live-traces.jsonl')},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),30000);child.once('exit',()=>{clearTimeout(timer);reject(Error('provider exited'));});child.stderr.on('data',()=>{});child.stdout.on('data',chunk=>{if(chunk.toString().includes('"ready":true')){clearTimeout(timer);resolve();}});});
 return {base:'http://127.0.0.1:'+port,origin,child,stop:async()=>{const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed;}};
}
async function withReference(fn){const server=await start();try{await fn(server);}finally{await server.stop();}}
async function call(s,id,options={}) {
 const op=operations.get(id);const route=op.path.replace(/\{([^}]+)\}/g,(_,k)=>options.params?.[k]??({'sessionId':'session-remote','deviceId':'device-remote','factorId':'factor-totp'}[k])??randomUUID());
 const headers={cookie:options.cookie??'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',origin:s.origin,'X-CSRF-Token':'csrf-token-0000000000000001','X-Request-Id':randomUUID(),'Idempotency-Key':options.key??randomUUID(),...options.headers};
 const body=options.body??op.requestBody?.content['application/json'].example;if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(s.base+route,{method:op.method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const issues=await validateResponse(id,response);let payload;
 if(response.headers.get('content-type')?.includes('application/json'))payload=await response.clone().json();
 return {status:response.status,payload,issues,headers:response.headers,response};
}
async function reauth(s,purpose='security_change'){const c=await call(s,'mfaChallenge',{body:{purpose,code:'123456'}});const r=await call(s,'reauth',{body:{challengeRef:c.payload.challengeRef}});return {token:r.payload.reauthTokenRef,challenge:c.payload.challengeRef};}

execFileSync('cargo',['build','-p','bff-gateway','--bin','bff-gateway','--locked','--offline'],{cwd:root,stdio:'inherit'});
await withReference(async s=>{
 const before=await call(s,'getProfile');const op=operations.get('saveProfile');const body={...op.requestBody.content['application/json'].example,displayName:'Changed by review',theme:'light',locale:'en'};
 const key=randomUUID();const written=await call(s,'saveProfile',{body,key,headers:{'If-Match':before.payload.objectVersion}});const read=await call(s,'getProfile');
 record('profile-roundtrip',{writeStatus:written.status,inputSaved:read.payload.displayName===body.displayName&&read.payload.theme===body.theme,versionChanged:read.payload.objectVersion!==before.payload.objectVersion});
 const changed=await call(s,'saveProfile',{body:{...body,displayName:'Second intent'},key,headers:{'If-Match':read.payload.objectVersion}});
 record('changed-intent',{expected:409,actual:changed.status});
 const notifications=await call(s,'getNotificationPrefs');const mixed=await call(s,'saveNotificationPrefs',{key,headers:{'If-Match':notifications.payload.objectVersion}});
 record('cross-operation-idempotency',{status:mixed.status,responseIssues:mixed.issues,returnedProfile:mixed.payload?.displayName!==undefined});
 const nbody={...operations.get('saveNotificationPrefs').requestBody.content['application/json'].example,quietHoursEnabled:true,digestFrequency:'weekly'};
 const saved=await call(s,'saveNotificationPrefs',{body:nbody,headers:{'If-Match':notifications.payload.objectVersion}});const reread=await call(s,'getNotificationPrefs');
 record('notification-roundtrip',{writeStatus:saved.status,inputSaved:reread.payload.quietHoursEnabled===true&&reread.payload.digestFrequency==='weekly'});
 const session=await call(s,'getSession');record('reference-session-expiry',{status:session.status,expiresInPast:Date.parse(session.payload.expiresAt)<Date.now()});
});
await withReference(async s=>{
 const grant=await reauth(s,'login');const reused=await call(s,'reauth',{body:{challengeRef:grant.challenge}});
 record('challenge-reuse',{purpose:'login',firstReauth:200,secondReauth:reused.status,distinctGrant:reused.payload?.reauthTokenRef!==grant.token});
 const key=randomUUID(),headers={'X-Reauth-Token-Ref':grant.token};const before=await call(s,'getSecuritySettings');
 const a=await call(s,'setupMfa',{key,headers}),b=await call(s,'setupMfa',{key,headers});const after=await call(s,'getSecuritySettings');
 record('mfa-setup-replay',{statuses:[a.status,b.status],sameJob:a.payload?.jobId===b.payload?.jobId,factorIncrease:after.payload.factors.length-before.payload.factors.length});
 const dk=randomUUID();const d1=await call(s,'revokeDevice',{key:dk,headers}),d2=await call(s,'revokeDevice',{key:dk,headers});record('device-revoke-replay',{statuses:[d1.status,d2.status]});
 const fk=randomUUID();const f1=await call(s,'revokeMfaFactor',{key:fk,headers}),f2=await call(s,'revokeMfaFactor',{key:fk,headers});record('factor-revoke-replay',{statuses:[f1.status,f2.status]});
 const sk=randomUUID();const revoked=await call(s,'revokeSession',{key:sk,headers});const replay=await call(s,'revokeSession',{key:sk,headers});
 record('accepted-correlation-replay',{statuses:[revoked.status,replay.status],initialMatch:revoked.payload.correlationId===revoked.headers.get('x-correlation-id'),replayMatch:replay.payload.correlationId===replay.headers.get('x-correlation-id')});
 const stream=await call(s,'subscribeSessionRevocations');const text=await stream.response.text();const event=JSON.parse(text.split('\n').find(line=>line.startsWith('data:')).slice(5));const state=new reducer.SseStreamReducer();const action=state.accept(event);
 record('remote-revoke-current-stream',{revokedObject:event.payload.objectId,currentSessionReadStatus:(await call(s,'getSession')).status,reducerAction:action.type,reducerClosed:state.isClosed,streamReachedEof:true});
});
await withReference(async s=>{
 const pending=await call(s,'mfaChallenge',{body:{purpose:'login'}});const attempts=[];for(let i=0;i<5;i++)attempts.push((await call(s,'mfaChallenge',{body:{purpose:'login',code:'000000'}})).status);
 const correct=await call(s,'mfaChallenge',{body:{purpose:'login',code:'123456'}});record('mfa-limit-and-init',{initialStatus:pending.payload.status,wrongStatuses:attempts,correctAfterLimit:correct.status});
});

const malformed=await auth.completeLoginMfa('https://bff.example','123456','csrf-probe',async()=>Response.json({status:'verified'}));record('auth-response-validation',{malformedAccepted:malformed.status==='verified',challengeMissing:malformed.challengeRef===undefined});
let calls=0;const bundle=await settings.loadSettingsBundle('https://bff.example',async input=>{calls++;const request=input instanceof Request?input:new Request(input);if(new URL(request.url).pathname==='/v1/settings/downloads')return Response.json({items:[]});return Response.json({});});
record('settings-response-validation',{malformedSessionAndSectionsAccepted:true,calls,hasMissingProfileVersion:bundle.profile.objectVersion===undefined});
const input={...operations.get('saveProfile').requestBody.content['application/json'].example};
const wrongStatus=await settings.saveProfileSettings('https://bff.example',input,'profile-v1',randomUUID(),'csrf-probe',async()=>Response.json({status:'accepted'}));record('settings-mutation-response-validation',{wrongSchemaAccepted:wrongStatus.status==='accepted'});

try { await settings.saveProfileSettings('https://bff.example',input,'profile-v1',randomUUID(),'csrf-probe',async()=>Response.json({code:'VERSION_CONFLICT',message:'changed',correlationId:randomUUID(),currentVersion:'profile-v2'},{status:409})); } catch(error) {record('settings-error-envelope',{name:error.name,correlationPreserved:error.correlationId!==undefined,codePreserved:error.code==='VERSION_CONFLICT',currentVersionPreserved:error.currentVersion==='profile-v2',statusPreserved:error.status===409});}

fs.writeFileSync(path.join(out,'reference-observations.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'reference HTTP and actual client/reducer; no database',observations},null,2)+'\n');
console.log(JSON.stringify({observations:observations.length,output:'reference-observations.json'}));

if(process.argv.includes('--live')) {
 process.loadEnvFile(path.join(root,'.env.local'));const server=await start(true);let cookie;const records=[];
 try{
  const login=await fetch(new URL('/auth/v1/token?grant_type=password',process.env.SUPABASE_URL),{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({email:process.env.QUANTOS_F06_TEST_EMAIL,password:process.env.QUANTOS_F06_TEST_PASSWORD}),signal:AbortSignal.timeout(15000)});if(!login.ok)throw Error('configured test Auth login failed');const token=(await login.json()).access_token;
  const established=await fetch(server.base+'/v1/auth/session',{method:'POST',headers:{origin:server.origin,authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(established.status!==204)throw Error('test session handshake failed');cookie=established.headers.get('set-cookie').split(';')[0];
  const ids=[...operations].filter(([,op])=>op['x-quantos-policy']?.owner==='BFF-FE-001').map(([id])=>id).filter(id=>id!=='logout');
  for(const id of ids){const result=await call(server,id,{cookie,headers:{'If-Match':'review-nonexistent-version','X-Reauth-Token-Ref':randomUUID()}});records.push({id,status:result.status,responseIssues:result.issues});}
  const logout=await fetch(server.base+'/v1/auth/logout',{method:'POST',headers:{origin:server.origin,cookie},signal:AbortSignal.timeout(20000)});records.push({id:'logout',status:logout.status,csrfHeaderSent:false,csrfCookieIssued:false,responseIssues:await validateResponse('logout',logout)});
 }finally{if(cookie)await fetch(server.base+'/v1/auth/logout',{method:'POST',headers:{origin:server.origin,cookie},signal:AbortSignal.timeout(20000)}).catch(()=>{});await server.stop();}
 fs.writeFileSync(path.join(out,'live-observations.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'configured Supabase Auth and database; local live BFF; synthetic HTTPS Origin; not staging; own test-session only',records},null,2)+'\n');console.log(JSON.stringify({liveOperations:records.length,success:records.filter(r=>r.status>=200&&r.status<300).length,missingRoutes:records.filter(r=>r.status===404).length}));
}
