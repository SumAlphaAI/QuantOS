import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHmac, randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { operations, validateResponse } from "../tests/contract/http-contract.mjs";

const root = path.resolve(import.meta.dirname, "..");
const output = path.resolve(process.argv[2] ?? "/private/tmp/quantos-bff-audit-live");
if (process.env.QUANTOS_RUN_BFF_AUDIT_LIVE !== "1") throw Error("Explicit QUANTOS_RUN_BFF_AUDIT_LIVE=1 required for the configured test Supabase");
process.loadEnvFile(path.join(root, ".env.local"));
fs.mkdirSync(output, { recursive: true });
const sourceCommitAtStart=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const records = [];
const assertions = [];
const correlations=[];
let cleanupVerified=false;
function checked(name, ok) { assert(ok, name); assertions.push(name); }
const inputPaths = ["services/bff-gateway/src/audit_core.rs", "services/bff-gateway/src/lib.rs", "services/bff-gateway/src/input_contract.rs", "services/bff-gateway/src/live/audit.rs", "services/bff-gateway/src/live.rs", "services/bff-gateway/src/live/settings.rs", "supabase/migrations/20261006100000_bff_audit_exports.sql", "supabase/migrations/20261006110000_bff_audit_scope_indexes.sql", "supabase/migrations/20261006120000_bff_domain_audit_read_model.sql", "supabase/migrations/20261006130000_bff_settings_audit_bridge.sql", "bff/openapi/quantos-bff.v1.yaml", "scripts/test-bff-fe-007-live.mjs"];
const sourceHashes = Object.fromEntries(inputPaths.map(p => [p, createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex")]));
const factors = new Set();
const enrollmentKeys = new Set();
const cookies = [];
const servers = [];
let cleanupBearer;
let originalProfile;
let originalNotifications;
let originalFactors;
let admin;
let metadataFixture;
const recoveryKeys=[];
const origin = "https://f06-local-smoke.invalid";
function assert(ok, message) { if (!ok) throw Error(message); }
const { Client } = createRequire(path.join(root,"package.json"))("pg");
const database = new URL(process.env.DATABASE_URL);
assert(/\.supabase\.(com|co)$/.test(database.hostname), "Configured hosted Supabase PostgreSQL required");
function pgClient() {
  return new Client({ host: database.hostname, port: Number(database.port || 5432), user: decodeURIComponent(database.username),
    password: decodeURIComponent(database.password), database: database.pathname.slice(1),
    ssl: { rejectUnauthorized: true, ...(process.env.QUANTOS_BFF_SSLROOTCERT ? {ca:fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT,"utf8")} : {}) } });
}
async function authRequest(route, token, method="GET", body) {
  const response=await fetch(new URL("/auth/v1/"+route,process.env.SUPABASE_URL),{method,
    headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,...(token?{authorization:"Bearer "+token}:{}),"content-type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  assert(response.ok, "Supabase test Auth request failed with HTTP "+response.status);
  return response.status===204?null:response.json();
}
async function auditMatches(result, action) {
  const correlation = result.response.headers.get("x-correlation-id");
  const rows = (await admin.query("select correlation_id::text from quantos.bff_settings_audits where user_id=$1 and action=$2 and correlation_id=$3", [process.env.QUANTOS_F06_TEST_USER_ID,action,correlation])).rows;
  checked("audit-response-"+action, rows.length===1);
  correlations.push(correlation);
  return correlation;
}
async function start() {
  const reserve=createServer();await new Promise(r=>reserve.listen(0,"127.0.0.1",r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const child=spawn(path.join(root,"target/debug/bff-gateway"),[],{cwd:root,env:{...process.env,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"live",QUANTOS_BFF_BIND:"127.0.0.1:"+port,
    QUANTOS_TERMINAL_ORIGIN:origin,QUANTOS_BFF_ENVIRONMENT:"dev",QUANTOS_TRACE_EXPORT_PATH:path.join(output,"traces.jsonl")},stdio:["ignore","pipe","pipe"]});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Live startup timeout")),30000);child.once("error",()=>{clearTimeout(timer);reject(Error("Live provider could not start"));});child.once("exit",()=>{clearTimeout(timer);reject(Error("Live provider exited"));});
    child.stdout.on("data",chunk=>{if(chunk.toString().includes('"ready":true')){clearTimeout(timer);resolve();}});child.stderr.on("data",()=>{});});
  const server={base:"http://127.0.0.1:"+port,child};servers.push(server);return server;
}
async function stop(server) {if(server.child.pid && server.child.exitCode===null && server.child.signalCode===null){const closed=new Promise(r=>server.child.once("close",r));server.child.kill("SIGTERM");const timer=setTimeout(()=>server.child.kill("SIGKILL"),5000);await closed;clearTimeout(timer);}}
async function login(server,token) {
  const response=await fetch(server.base+"/v1/auth/session",{method:"POST",headers:{origin,authorization:"Bearer "+token},signal:AbortSignal.timeout(25000)});
  assert(response.status===204,"BFF handshake returned "+response.status);
  const cookie=response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
  const csrf=/(?:^|; )quantos_csrf=([^;]+)/.exec(cookie)?.[1];assert(csrf,"Missing CSRF cookie");
  const session={cookie,csrf};cookies.push({...session});return session;
}
async function call(server,session,id,options={}) {
  if(session===activeSession && ['searchAuditEvents','getEvidenceChain','createExport','getExportStatus','cancelExport','getExportDownload'].includes(id)) {
    if(Date.now()-refreshedAt>120000)await refreshSession(server,session);
    if(options.headers?.['X-Reauth-Token-Ref'])options={...options,headers:{...options.headers,'X-Reauth-Token-Ref':liveReauthHeaders['X-Reauth-Token-Ref']}};
  }

  const operation=operations.get(id);const route=operation.path.replace(/\{([^}]+)\}/g,(_,name)=>options.params?.[name]??randomUUID())+(options.query?"?"+new URLSearchParams(options.query):"");
  const body=options.body??operation.requestBody?.content?.["application/json"]?.example;
  const commandKey=options.key??randomUUID();
  if(id==="setupMfa")enrollmentKeys.add(commandKey);
  const headers={origin,"X-Request-Id":randomUUID(),"Idempotency-Key":commandKey,...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{}),...options.headers};
  const response=await fetch(server.base+route,{method:operation.method,headers:{...headers,...(body!==undefined?{"content-type":"application/json"}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(id==="subscribeSessionRevocations"?240000:30000)});
  const issues=await validateResponse(id,response);
  const payload=response.headers.get("content-type")?.includes("application/json")?await response.clone().json():undefined;
  fs.writeFileSync(path.join(output,"progress.json"),JSON.stringify({operationId:id,status:response.status,calls:records.length+1,updatedAt:new Date().toISOString()}));
  if(id==="createExport"&&payload?.exportId&&!jobs.includes(payload.exportId))jobs.push(payload.exportId);
  if(id==="createExport"||id==="cancelExport")keys.push(commandKey);
  if(payload?.nextCursor)cursorHashes.add(createHash("sha256").update(payload.nextCursor).digest("hex"));
  records.push({operationId:id,status:response.status,issues,...(options.label?{label:options.label}:{})});
  assert(!issues.length,id+" response contract violation: "+issues.join("; "));
  const retrySafe=operation.method==="get"||["saveProfile","saveNotificationPrefs","revokeSession","revokeDevice","setupMfa","revokeMfaFactor"].includes(id);
  if(response.status===503 && options.expected!==503 && retrySafe && (options.attempt??0)<2){
    await new Promise(resolve=>setTimeout(resolve,1000));
    return call(server,session,id,{...options,key:commandKey,attempt:(options.attempt??0)+1});
  }
  if(options.expected!==undefined)assert(response.status===options.expected,id+" expected "+options.expected+" received "+response.status);
  return {response,payload};
}
function totp(uri) {
  const secret=new URL(uri).searchParams.get("secret");assert(secret,"Enrollment URI missing TOTP material");
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const c of secret.toUpperCase().replace(/=+$/, "")){const v=alphabet.indexOf(c);assert(v>=0,"Invalid TOTP material");bits+=v.toString(2).padStart(5,"0");}
  const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const mac=createHmac("sha1",Buffer.from(bytes)).update(counter).digest();const offset=mac.at(-1)&15;
  return String((mac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
async function event(reader) {
  let buffer="";const decoder=new TextDecoder();
  while(!buffer.includes("\n\n")){
    const next=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error("SSE delivery timeout")),20000))]);
    assert(!next.done,"SSE closed prematurely");buffer+=decoder.decode(next.value);
  }
  return JSON.parse(buffer.split("\n").find(line=>line.startsWith("data: ")).slice(6));
}

let activeSession;let refreshedAt=0;let liveReauthHeaders;let mfaUri;
async function verifyMfa(server,session,uri) {
 let proof;
 // The configured Auth service can time out while creating/verifying a pending
 // challenge. Explicit test-driver retries retain each 503 record, reuse the
 // provider's pending challenge and calculate a fresh TOTP. Business denials
 // and successful-but-unverified challenges are never retried or accepted.
 for(let attempt=0;attempt<3;attempt++) {
  proof=await call(server,session,'mfaChallenge',{body:{purpose:'security_change',code:totp(uri)}});
  if(proof.response.status!==503)break;
  if(attempt<2)await new Promise(r=>setTimeout(r,1000));
 }
 assert(proof.response.status===200&&proof.payload.status==='verified','MFA challenge did not verify');
 return proof;
}
async function refreshSession(server,session) {
 const fresh=await login(server,cleanupBearer);Object.assign(session,fresh);refreshedAt=Date.now();
 const proof=await verifyMfa(server,session,mfaUri);
 const grant=await call(server,session,'reauth',{expected:200,body:{challengeRef:proof.payload.challengeRef}});liveReauthHeaders['X-Reauth-Token-Ref']=grant.payload.reauthTokenRef;
}
const cursorHashes=new Set();const deviceIds=new Set();const jobs=[];const keys=[];const fixture=randomUUID();let actor;let originalCaps;let originalCapabilityRows;let originalQuotas;let failure;let latestServer;let originalContext;
const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
async function storage(method,key,body) {
 const r=await fetch(new URL('/storage/v1/object/quantos-bff-exports/'+key,process.env.SUPABASE_URL),{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,...(body?{'content-type':'application/x-ndjson','x-upsert':'true'}:{})},...(body?{body}:{}),signal:AbortSignal.timeout(20000)});return r;
}
async function poll(server,session,id,expected='ready') {
 for(let i=0;i<40;i++){const r=await call(server,session,'getExportStatus',{params:{exportId:id},expected:200});if(r.payload.status===expected)return r.payload;if(r.payload.status==='failed' && expected!=='failed')throw Error('Actual export generation failed');await new Promise(r=>setTimeout(r,500));}throw Error('Export worker deadline');
}
async function consume(server,session,metadata,expected=200) {
 const url=new URL(metadata.downloadUrl);assert(url.origin===origin,'Download origin not configured');
 const r=await fetch(server.base+url.pathname,{headers:{cookie:session.cookie},signal:AbortSignal.timeout(30000)});checked('consume-'+expected,r.status===expected);return r;
}
try {
 execFileSync('cargo',['build','-p','bff-gateway','--locked','--offline'],{cwd:root,stdio:'ignore'});
 const auth=await authRequest('token?grant_type=password',null,'POST',{email:process.env.QUANTOS_F06_TEST_EMAIL,password:process.env.QUANTOS_F06_TEST_PASSWORD});cleanupBearer=auth.access_token;
 const user=await authRequest('user',cleanupBearer);assert(user.id===process.env.QUANTOS_F06_TEST_USER_ID,'Configured test subject mismatch');originalFactors=(user.factors??[]).map(f=>f.id).sort();assert(originalFactors.length===0,'Existing MFA factors will not be changed');
 admin=pgClient();await admin.connect();
 originalContext=(await admin.query('select id,tenant_id from quantos.actors where user_id=$1 order by id',[user.id])).rows;assert(originalContext.length===1,'Unambiguous existing test actor required');actor=originalContext[0];
 originalCapabilityRows=(await admin.query("select * from quantos.actor_capabilities where actor_id=$1 and capability in ('audit:read','audit:export')",[actor.id])).rows;
 originalCaps=originalCapabilityRows.map(r=>r.capability);
 for(const capability of ['audit:read','audit:export'])if(!originalCaps.includes(capability))await admin.query('insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3)',[actor.tenant_id,actor.id,capability]);
 originalQuotas=(await admin.query('select * from quantos.bff_audit_quotas where user_id=$1',[user.id])).rows;await admin.query('delete from quantos.bff_audit_quotas where user_id=$1',[user.id]);
 let server=await start();latestServer=server;let active=await login(server,cleanupBearer);
 const security=(await call(server,active,'getSecuritySettings',{expected:200})).payload;
 const enrolled=await call(server,active,'setupMfa',{expected:202,body:{method:'authenticator'},headers:{'X-Reauth-Token-Ref':security.firstFactorSetupRef}});const enrollment=enrolled.payload.mfaEnrollment;factors.add(enrollment.factorRef);
 const verified=await verifyMfa(server,active,enrollment.uri);
 const grant=await call(server,active,'reauth',{expected:200,body:{challengeRef:verified.payload.challengeRef}});const reauth={'X-Reauth-Token-Ref':grant.payload.reauthTokenRef};activeSession=active;liveReauthHeaders=reauth;mfaUri=enrollment.uri;refreshedAt=Date.now();
checked('identity-audit-bridged-to-f05',(await admin.query("select count(*)::int as n from quantos.audit_entries where id in (select audit_ref from quantos.bff_settings_audits where user_id=$1 and action='auth.reauth' and created_at>now()-interval '5 minutes')",[user.id])).rows[0].n>0);
 const sessionHash=createHash('sha256').update(/quantos_session=([^;]+)/.exec(active.cookie)[1]).digest('hex');
 const context=(await call(server,active,'getSession',{expected:200})).payload;const ctx={workspace_id:context.workspaceId,account_id:context.accountId};
 checked("configured-scope-context",context.capabilities.includes("audit:read")&&context.capabilities.includes("audit:export"));
 const fixtureTime=Date.now()-10000;
 const eventIds=Array.from({length:8},()=>randomUUID());const auditIds=Array.from({length:8},()=>randomUUID());const streamId=randomUUID();
 await admin.query("insert into quantos.event_streams(id,tenant_id,aggregate_type,aggregate_id) values($1,$2,'bff-audit-fixture',$3)",[streamId,actor.tenant_id,fixture]);
 for(let i=0;i<8;i++) {
  const payload={workspaceId:ctx.workspace_id,accountId:ctx.account_id,reason:'synthetic-account-12345678901234567890',token:'SYNTHETIC_TOKEN'};const kind=i===7?'fill.recorded':'order.accepted';
  const hash='sha256:'+createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');const at=new Date(fixtureTime+i*100);
  await admin.query('insert into quantos.event_log(tenant_id,stream_id,event_id,actor_id,correlation_id,causation_id,aggregate_type,aggregate_id,sequence,event_kind,schema_version,payload,payload_hash,occurred_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[actor.tenant_id,streamId,eventIds[i],actor.id,fixture,i?eventIds[i-1]:eventIds[i],'bff-audit-fixture',fixture,i+1,kind,'v1',payload,hash,at]);
  await admin.query("insert into quantos.audit_entries(id,tenant_id,actor_id,actor_user_id,correlation_id,causation_id,event_id,action,details,recorded_at) values($1,$2,$3,$4,$5,$6,$7,'event.appended',$8,$9)",[auditIds[i],actor.tenant_id,actor.id,user.id,fixture,i?eventIds[i-1]:eventIds[i],eventIds[i],{workspaceId:ctx.workspace_id,accountId:ctx.account_id,event_kind:kind,payload_hash:hash,sequence:i+1},at]);
 }
 await call(server,null,'searchAuditEvents',{expected:401});
 const first=(await call(server,active,'searchAuditEvents',{query:{correlationId:fixture,pageSize:'3'},expected:200})).payload;
 checked('f05-domain-event-id-sequence',first.items.every((e,i)=>e.eventId===eventIds[i]&&e.auditRef===auditIds[i]&&e.sequence===i+1));
 checked('persistent-ledger-redaction',first.items.length===3 && !JSON.stringify(first).includes('SYNTHETIC_TOKEN') && !JSON.stringify(first).includes('12345678901234567890'));
 for(const e of first.items)checked('canonical-payload-hash',e.payloadHash==='sha256:'+createHash('sha256').update(JSON.stringify(canonical(e.redactedPayload))).digest('hex'));
 await call(server,active,'searchAuditEvents',{query:{correlationId:fixture,pageSize:'3',cursor:'audit:999'},expected:422});
 await call(server,active,'searchAuditEvents',{query:{correlationId:fixture,pageSize:'4',cursor:first.nextCursor},expected:422});
 const ids=first.items.map(e=>e.eventId);let cursor=first.nextCursor;
 while(cursor){const page=(await call(server,active,'searchAuditEvents',{query:{correlationId:fixture,pageSize:'3',cursor},expected:200})).payload;ids.push(...page.items.map(e=>e.eventId));cursor=page.nextCursor;}
 checked('snapshot-no-repeat-no-omission',ids.length===8 && new Set(ids).size===8 && eventIds.every(id=>ids.includes(id)));
 await call(server,active,'getEvidenceChain',{params:{correlationId:fixture},query:{pageSize:'3',cursor:first.nextCursor},expected:422});
 const chainIds=[];cursor=undefined;let chainPage;
 do{chainPage=(await call(server,active,'getEvidenceChain',{params:{correlationId:fixture},query:{pageSize:'3',...(cursor?{cursor}:{})},expected:200})).payload;chainIds.push(...chainPage.items.map(e=>e.eventId));cursor=chainPage.nextCursor;}while(cursor);
 checked('persistent-causal-chain',chainPage.complete===true && chainIds.length===8 && eventIds.every(id=>chainIds.includes(id)));
 const request={scope:{correlationIds:[fixture],eventKinds:['fill.recorded'],startAt:new Date(fixtureTime-60000).toISOString(),endAt:new Date(fixtureTime+60000).toISOString()},format:'jsonl',reason:'Synthetic-account-12345678901234567890 regulatory review',watermark:'Synthetic SECRET_TOKEN watermark',retentionDays:1};
 const make=async(body=request)=>{const key=randomUUID();keys.push(key);const result=await call(server,active,'createExport',{body,key,headers:reauth,expected:202});if(!jobs.includes(result.payload.exportId))jobs.push(result.payload.exportId);return {...result,key};};
 await call(server,active,'createExport',{body:request,headers:{...reauth,'X-CSRF-Token':''},expected:403});
 await call(server,active,'createExport',{body:request,expected:403});
 for(const body of [{...request,scope:{...request.scope,startAt:request.scope.endAt,endAt:request.scope.startAt}},{...request,scope:{correlationIds:[fixture,fixture]}},{...request,scope:{correlationIds:[fixture],unexpected:true}}])await call(server,active,'createExport',{body,headers:reauth,expected:422});
 await call(server,active,'createExport',{body:{...request,scope:{correlationIds:[randomUUID()]}},headers:reauth,expected:404});
 const created=await make();const id=created.payload.exportId;
 const replay=(await call(server,active,'createExport',{body:request,key:created.key,headers:reauth,expected:202})).payload;
 checked('durable-identical-intent-replay',replay.exportId===id && replay.auditRef===created.payload.auditRef);
 await poll(server,active,id);
 const before=(await admin.query('select count(*)::int as count from quantos.audit_entries where actor_id=$1 and correlation_id=$2',[actor.id,created.payload.correlationId])).rows[0].count;
 for(const scopePatch of [{eventKinds:['order.accepted']},{startAt:new Date(fixtureTime-50000).toISOString()},{endAt:new Date(fixtureTime+50000).toISOString()}])await call(server,active,'createExport',{body:{...request,scope:{...request.scope,...scopePatch}},key:created.key,headers:reauth,expected:409});
 checked('conflicts-have-no-business-or-audit-side-effects',(await admin.query('select count(*)::int as count from quantos.audit_entries where actor_id=$1 and correlation_id=$2',[actor.id,created.payload.correlationId])).rows[0].count===before);
 await poll(server,active,id);
 const meta=(await call(server,active,'getExportDownload',{params:{exportId:id},expected:200})).payload;
 const bytes=Buffer.from(await (await consume(server,active,meta)).arrayBuffer());
 checked('actual-storage-integrity',createHash('sha256').update(bytes).digest('hex')===meta.sha256 && bytes.length===meta.sizeBytes);
 const lines=bytes.toString().trim().split('\n').map(JSON.parse);checked('full-scope-and-watermarked-redaction',lines.length===2 && lines[0].watermark.startsWith('QuantOS restricted copy') && lines[1].kind==='fill.recorded' && !bytes.toString().includes('SECRET_TOKEN') && !bytes.toString().includes('12345678901234567890'));
 await consume(server,active,meta,410);
 const concurrentMeta=(await call(server,active,'getExportDownload',{params:{exportId:id},expected:200})).payload;
 const url=new URL(concurrentMeta.downloadUrl);
 const concurrent=await Promise.all([0,1].map(()=>fetch(server.base+url.pathname,{headers:{cookie:active.cookie},signal:AbortSignal.timeout(30000)})));
 checked('concurrent-ticket-consumption-once',JSON.stringify(concurrent.map(r=>r.status).sort())===JSON.stringify([200,410]));
 const tamper={...meta,downloadUrl:meta.downloadUrl.replace(/.$/,'x')};await consume(server,active,tamper,410);
 for(const format of ['csv','pdf']){const made=await make({...request,format});await poll(server,active,made.payload.exportId);const m=(await call(server,active,'getExportDownload',{params:{exportId:made.payload.exportId},expected:200})).payload;const b=Buffer.from(await(await consume(server,active,m)).arrayBuffer());checked('real-'+format+'-artifact',b.length===m.sizeBytes && createHash('sha256').update(b).digest('hex')===m.sha256 && (format==='pdf'?b.toString().startsWith('%PDF-1.4'):b.toString().startsWith('watermark,event')));}
 await admin.query("insert into quantos.bff_audit_quotas(user_id,operation,window_at,used) select $1,'createExport',date_trunc('minute',now())+n*interval '1 minute',5 from generate_series(0,1) n on conflict(user_id,operation,window_at) do update set used=5",[user.id]);await call(server,active,'createExport',{body:request,headers:reauth,expected:429});checked('per-actor-create-quota',true);
 const cancelLease=(await call(server,active,'getExportDownload',{params:{exportId:id},expected:200})).payload;
 const cancelKey=randomUUID();keys.push(cancelKey);await call(server,active,'cancelExport',{params:{exportId:id},headers:reauth,key:cancelKey,expected:202});await call(server,active,'cancelExport',{params:{exportId:id},headers:reauth,key:cancelKey,expected:202});await consume(server,active,cancelLease,410);
 checked('cancel-revokes-issued-leases',true);
 const expires=jobs[1];const expiredLease=(await call(server,active,'getExportDownload',{params:{exportId:expires},expected:200})).payload;
 await admin.query("update quantos.bff_export_jobs set retention_until=now()-interval '1 second' where export_id=$1",[expires]);await call(server,active,'getExportDownload',{params:{exportId:expires},expected:410});await consume(server,active,expiredLease,410);checked('retention-denies-issuance-and-consumption',true);
 const recovery=jobs[2];await admin.query("update quantos.bff_export_jobs set status='generating',job=jsonb_set(job,'{status}','\"generating\"'),lease_token=$2,lease_until=now()+interval '1 hour',attempts=0 where export_id=$1",[recovery,randomUUID()]);
 const pending=(await call(server,active,'getExportStatus',{params:{exportId:recovery},expected:200})).payload;checked('status-read-does-not-generate',pending.status==='generating');
 await stop(server);await admin.query("update quantos.bff_export_jobs set lease_until=now()-interval '1 second' where export_id=$1",[recovery]);server=await start();latestServer=server;active=await login(server,cleanupBearer);activeSession=active;refreshedAt=Date.now();await poll(server,active,recovery);checked('restart-recovers-expired-worker-lease',true);
 const recoveryRow=(await admin.query('select object_key from quantos.bff_export_jobs where export_id=$1',[recovery])).rows[0];
 const good=(await storage('GET',recoveryRow.object_key));assert(good.ok,'Original artifact read failed');const savedBytes=Buffer.from(await good.arrayBuffer());
 const lease=(await call(server,active,'getExportDownload',{params:{exportId:recovery},expected:200})).payload;
 assert((await storage('POST',recoveryRow.object_key,Buffer.from('SYNTHETIC_TAMPER'))).ok,'Controlled tamper injection failed');
 await consume(server,active,lease,503);assert((await storage('POST',recoveryRow.object_key,savedBytes)).ok,'Artifact restoration failed');checked('tampered-private-artifact-denied',true);
 await admin.query('update quantos.bff_export_jobs set user_id=$2 where export_id=$1',[recovery,randomUUID()]);
 await call(server,active,'getExportStatus',{params:{exportId:recovery},expected:404});await call(server,active,'getExportDownload',{params:{exportId:recovery},expected:404});
 await admin.query('update quantos.bff_export_jobs set user_id=$2 where export_id=$1',[recovery,user.id]);checked('resource-owner-hidden',true);
 // Force a recoverable oversized snapshot on our own job; no foreign objects or
 // bucket configuration are touched. Worker rejects before Storage upload.
 await admin.query("update quantos.bff_export_jobs set status='queued',job=jsonb_set(job,'{status}','\"queued\"'),snapshot=$2::jsonb,attempts=0,lease_token=null,lease_until=null where export_id=$1",[recovery,JSON.stringify([{synthetic:'x'.repeat(17*1024*1024)}])]);
 await poll(server,active,recovery,'failed');checked('generation-failure-terminal-and-audited',true);
 const after=(await admin.query("select distinct action from quantos.audit_entries where actor_id=$1 and action like 'export.%'",[actor.id])).rows.map(r=>r.action);
 checked('persistent-export-lifecycle', ['export.created','export.generating','export.ready','export.status_viewed','export.download_issued','export.download_consumed','export.cancelled','export.expired','export.consume_denied','export.failed','export.integrity_failed','export.resource_denied'].every(a=>after.includes(a)));
 checked('restricted-read-audit',(await admin.query("select count(*)::int as n from quantos.audit_entries where actor_id=$1 and action in ('audit.search_accessed','audit.chain_accessed')",[actor.id])).rows[0].n>=5);
 // Restore capability grants and verify a freshly established lower-capability
 // context is denied by all six provider operations, without fixture cookies.
 for(const cap of ['audit:read','audit:export'])await admin.query('delete from quantos.actor_capabilities where actor_id=$1 and capability=$2',[actor.id,cap]);const denied=await login(server,cleanupBearer);
 for(const operationId of ['searchAuditEvents','getEvidenceChain','createExport','getExportStatus','cancelExport','getExportDownload'])await call(server,denied,operationId,{body:operationId==='createExport'?request:undefined,params:{correlationId:fixture,exportId:recovery},headers:reauth,expected:403});checked('live-six-operation-capability-matrix',true);await call(server,denied,'createExport',{body:request,key:created.key,headers:reauth,expected:403});checked('revoked-capability-denies-replay',true);
 for(const cap of ['audit:read','audit:export'])if(!originalCaps.includes(cap)){}else await admin.query('insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3) on conflict do nothing',[actor.tenant_id,actor.id,cap]);
} catch(error){failure=error.code ? 'Target failure '+String(error.code).replace(/[^a-zA-Z0-9_]/g,'') : error.message;}
finally {
 try {
  for(const server of servers)await stop(server);
  if(admin){
   const discovered=(await admin.query("select export_id from quantos.bff_export_jobs where user_id=$1 and intent->'scope'->'correlationIds' ? $2",[process.env.QUANTOS_F06_TEST_USER_ID,fixture])).rows;
   for(const row of discovered)if(!jobs.includes(row.export_id))jobs.push(row.export_id);
   for(const id of jobs){const row=(await admin.query('select object_key from quantos.bff_export_jobs where export_id=$1',[id])).rows[0];if(row){const r=await storage('DELETE',row.object_key);if(!r.ok&&r.status!==404){const e=await r.json().catch(()=>({}));assert(String(e.statusCode)==='404'||e.code==='NoSuchKey','Storage cleanup failed');}}await admin.query('delete from quantos.bff_export_tickets where export_id=$1',[id]);await admin.query('delete from quantos.bff_export_jobs where export_id=$1',[id]);}
   for(const key of keys)await admin.query("delete from quantos.bff_security_commands where user_id=$1 and operation in ('createExport','cancelExport') and idempotency_key=$2",[process.env.QUANTOS_F06_TEST_USER_ID,key]);
   if(actor&&originalCapabilityRows){await admin.query("delete from quantos.actor_capabilities where actor_id=$1 and capability in ('audit:read','audit:export')",[actor.id]);for(const row of originalCapabilityRows)await admin.query('insert into quantos.actor_capabilities(id,tenant_id,actor_id,workspace_id,account_id,capability,mode_scope,created_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[row.id,row.tenant_id,row.actor_id,row.workspace_id,row.account_id,row.capability,row.mode_scope,row.created_at]);const restored=(await admin.query("select * from quantos.actor_capabilities where actor_id=$1 and capability in ('audit:read','audit:export') order by id",[actor.id])).rows;assert(JSON.stringify(restored)===JSON.stringify(originalCapabilityRows.toSorted((a,b)=>a.id.localeCompare(b.id))),'Capabilities restoration mismatch');}
   if(originalQuotas){await admin.query('delete from quantos.bff_audit_quotas where user_id=$1',[process.env.QUANTOS_F06_TEST_USER_ID]);for(const row of originalQuotas)await admin.query('insert into quantos.bff_audit_quotas values($1,$2,$3,$4)',[row.user_id,row.operation,row.window_at,row.used]);}
   for(const session of cookies){const raw=/(?:^|; )quantos_session=([^;]+)/.exec(session.cookie)?.[1];if(raw){const hash=createHash('sha256').update(raw).digest('hex');const device=(await admin.query('select device_id from quantos.bff_session_details where session_hash=$1',[hash])).rows[0];if(device)deviceIds.add(device.device_id);await admin.query('delete from quantos.bff_sessions where session_hash=$1',[hash]);}}
   for(const id of deviceIds)await admin.query('delete from quantos.bff_devices d where device_id=$1 and user_id=$2 and not exists(select 1 from quantos.bff_session_details s where s.device_id=d.device_id)',[id,process.env.QUANTOS_F06_TEST_USER_ID]);
   for(const hash of cursorHashes)await admin.query('delete from quantos.bff_audit_cursors where token_hash=$1 and user_id=$2',[hash,process.env.QUANTOS_F06_TEST_USER_ID]);
   for(const key of enrollmentKeys)await admin.query("delete from quantos.bff_security_commands where user_id=$1 and operation='setupMfa' and idempotency_key=$2",[process.env.QUANTOS_F06_TEST_USER_ID,key]);

   for(const factor of factors){const r=await fetch(new URL('/auth/v1/admin/users/'+process.env.QUANTOS_F06_TEST_USER_ID+'/factors/'+factor,process.env.SUPABASE_URL),{method:'DELETE',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(20000)});assert(r.ok,'MFA cleanup failed');}
   const user=await authRequest('user',cleanupBearer);assert(JSON.stringify((user.factors??[]).map(f=>f.id).sort())===JSON.stringify(originalFactors),'Factor restoration mismatch');
   checked('ephemeral-exports-cleaned',(await admin.query('select count(*)::int as n from quantos.bff_export_jobs where export_id=any($1::uuid[])',[jobs])).rows[0].n===0);cleanupVerified=true;
  }
 }catch(e){failure=(failure?failure+'; ':'')+'Controlled cleanup not verified';}
 if(admin)await admin.end();
}
const receipt={schema:'quantos-bff-audit-live/v1',sourceCommit:sourceCommitAtStart,sourceMatchesCommit:inputPaths.every(p=>{try{return createHash('sha256').update(execFileSync('git',['show',sourceCommitAtStart+':'+p],{stdio:['ignore','pipe','ignore']})).digest('hex')===sourceHashes[p];}catch{return false;}}),status:failure?'FAIL':'PASS',sourceHashes,fixture,assertions,records,cleanupVerified,target:'configured-supabase',formalAccepted:false,failure:failure??null,cleanup:'restore capabilities, quotas and factor set; delete own exports, objects and sessions; preserve append-only audit fixtures'};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,records:records.length,assertions:assertions.length,cleanupVerified,failure:failure??null}));if(failure)process.exitCode=1;
