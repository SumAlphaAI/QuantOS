import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHmac, randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { operations, validateResponse } from "../tests/contract/http-contract.mjs";

const root = path.resolve(import.meta.dirname, "..");
const output = path.resolve(process.argv[2] ?? "/private/tmp/quantos-bff-a2-live");
if (process.env.QUANTOS_RUN_BFF_A2_LIVE !== "1") throw Error("Explicit QUANTOS_RUN_BFF_A2_LIVE=1 required for the configured test Supabase");
process.loadEnvFile(path.join(root, ".env.local"));
fs.mkdirSync(output, { recursive: true });
const records = [];
const assertions = [];
const correlations=[];
let cleanupVerified=false;
function checked(name, ok) { assert(ok, name); assertions.push(name); }
const inputPaths = ["services/bff-gateway/src/live/settings.rs", "services/bff-gateway/src/live/settings_policy.rs", "services/bff-gateway/src/live.rs", "crates/quantos-auth/src/lib.rs", "supabase/migrations/20261003090000_bff_a2_identity_settings.sql", "bff/openapi/quantos-bff.v1.yaml", "scripts/test-bff-fe-001-live.mjs"];
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
  const session={cookie,csrf};cookies.push(session);return session;
}
async function call(server,session,id,options={}) {
  const operation=operations.get(id);const route=operation.path.replace(/\{([^}]+)\}/g,(_,name)=>options.params?.[name]??randomUUID())+(options.query?"?"+new URLSearchParams(options.query):"");
  const body=options.body??operation.requestBody?.content?.["application/json"]?.example;
  const commandKey=options.key??randomUUID();
  if(id==="setupMfa")enrollmentKeys.add(commandKey);
  const headers={origin,"X-Request-Id":randomUUID(),"Idempotency-Key":commandKey,...(session?{cookie:session.cookie,"X-CSRF-Token":session.csrf}:{}),...options.headers};
  const response=await fetch(server.base+route,{method:operation.method,headers:{...headers,...(body!==undefined?{"content-type":"application/json"}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(id==="subscribeSessionRevocations"?240000:30000)});
  const issues=await validateResponse(id,response);
  const payload=response.headers.get("content-type")?.includes("application/json")?await response.clone().json():undefined;
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

let failure;
try {
  execFileSync("cargo",["build","-p","bff-gateway","--locked","--offline"],{cwd:root,stdio:"ignore"});
  const auth=await authRequest("token?grant_type=password",null,"POST",{email:process.env.QUANTOS_F06_TEST_EMAIL,password:process.env.QUANTOS_F06_TEST_PASSWORD});
  cleanupBearer=auth.access_token;
  const user=await authRequest("user",cleanupBearer);assert(user.id===process.env.QUANTOS_F06_TEST_USER_ID,"Configured test subject mismatch");
  originalFactors=(user.factors??[]).map(f=>f.id).sort();
  assert(!originalFactors.length,"MFA live fixture requires the existing configured test subject to have no enrolled factor; existing factors will not be altered");
  admin=pgClient();await admin.connect();
  const prior=(await admin.query("select profile,notifications from quantos.bff_profiles where user_id=$1",[user.id])).rows[0];
  originalProfile=prior?.profile;originalNotifications=prior?.notifications;
  let server=await start();const first=await login(server,cleanupBearer);const second=await login(server,cleanupBearer);
  await call(server,first,"getSession",{expected:200});await call(server,first,"getContext",{expected:200});
  const profile=(await call(server,first,"getProfile",{expected:200})).payload;
  const profileInput={...operations.get("saveProfile").requestBody.content["application/json"].example,displayName:"A2 target roundtrip",locale:"en",theme:"light"};
  const profileKey=randomUUID();const saved=await call(server,first,"saveProfile",{expected:200,key:profileKey,body:profileInput,headers:{"If-Match":profile.objectVersion}});
  assert(saved.payload.displayName===profileInput.displayName,"Profile input discarded");
  const profileCorrelation=await auditMatches(saved,"saveProfile");
  const savedReplay=await call(server,first,"saveProfile",{expected:200,key:profileKey,body:profileInput,headers:{"If-Match":profile.objectVersion}});
  checked("profile-replay-stable-correlation",savedReplay.response.headers.get("x-correlation-id")===profileCorrelation);
  const read=(await call(server,first,"getProfile",{expected:200})).payload;assert(read.displayName===profileInput.displayName&&read.theme==="light","Profile roundtrip lost fields");
  await call(server,first,"saveProfile",{expected:409,key:profileKey,body:{...profileInput,theme:"dark"},headers:{"If-Match":read.objectVersion}});
  const notification=(await call(server,first,"getNotificationPrefs",{expected:200})).payload;
  const prefs={...operations.get("saveNotificationPrefs").requestBody.content["application/json"].example,quietHoursEnabled:true,digestFrequency:"weekly"};
  const savedPrefs=await call(server,first,"saveNotificationPrefs",{expected:200,key:profileKey,body:prefs,headers:{"If-Match":notification.objectVersion}});
  await auditMatches(savedPrefs,"saveNotificationPrefs");
  assert((await call(server,first,"getNotificationPrefs",{expected:200})).payload.digestFrequency==="weekly","Notification input discarded");
  const stale=await call(server,first,"saveProfile",{expected:409,body:profileInput,headers:{"If-Match":profile.objectVersion}});assert(stale.payload.currentVersion===read.objectVersion,"Missing conflict currentVersion");
  await stop(server);server=await start();
  assert((await call(server,first,"getProfile",{expected:200})).payload.displayName===profileInput.displayName,"Profile persistence lost on restart");
  const missingProof=await call(server,first,"getSecuritySettings",{expected:401});assert(missingProof.payload.code==="AUTH_REFRESH_REQUIRED","Missing ephemeral proof did not fail closed");
  const active=await login(server,cleanupBearer);
  const security=(await call(server,active,"getSecuritySettings",{expected:200})).payload;assert(security.firstFactorSetupRef,"Fresh login did not issue narrowly scoped first-factor grant");
  checked("primary-auth-timestamp",Date.parse(security.lastVerifiedAt)===Date.parse(user.last_sign_in_at));
  const lower=await login(server,cleanupBearer);
  const lowerSecurity=(await call(server,lower,"getSecuritySettings",{expected:200})).payload;
  const enrollKey=randomUUID();const enrolled=await call(server,active,"setupMfa",{expected:202,key:enrollKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  const enrollment=enrolled.payload.mfaEnrollment;assert(enrollment.uri&&enrollment.delivery==="one_time","TOTP enrollment material was not delivered once");factors.add(enrollment.factorRef);
  const replay=await call(server,active,"setupMfa",{expected:202,key:enrollKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  assert(replay.payload.jobId===enrolled.payload.jobId&&!replay.payload.mfaEnrollment.uri,"Enrollment replay duplicated job or exposed material");
  const cancellable=await call(server,active,"setupMfa",{expected:202,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  const cancelledFactor=cancellable.payload.mfaEnrollment.factorRef;factors.add(cancelledFactor);const cancellationKey=randomUUID();
  const cancelOptions={expected:202,key:cancellationKey,params:{factorId:cancelledFactor},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}};
  const cancelled=await call(server,active,"revokeMfaFactor",cancelOptions);
  const cancelledReplay=await call(server,active,"revokeMfaFactor",cancelOptions);
  assert(cancelled.payload.jobId===cancelledReplay.payload.jobId,"First-factor cancellation replay changed authorization policy or job");factors.delete(cancelledFactor);
  await call(server,active,"revokeSession",{expected:403,params:{sessionId:randomUUID()},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  const pending=await call(server,active,"mfaChallenge",{expected:200,body:{purpose:"security_change"}});assert(pending.payload.status==="pending","MFA initiation counted as failure");
  const verified=await call(server,active,"mfaChallenge",{expected:200,body:{purpose:"security_change",code:totp(enrollment.uri)}});assert(verified.payload.status==="verified","Real Supabase TOTP verification failed");
  await auditMatches(verified,"mfa.verify");
  const verifiedAt=(await admin.query("select max(created_at) as at from quantos.bff_settings_audits where user_id=$1 and action='mfa.verify'",[user.id])).rows[0].at;
  const securityAfter=(await call(server,active,"getSecuritySettings",{expected:200})).payload;
  checked("mfa-auth-timestamp",Math.abs(Date.parse(securityAfter.lastVerifiedAt)-new Date(verifiedAt).getTime())<=1);
  const lowerKey=randomUUID();
  await call(server,lower,"setupMfa",{expected:403,key:lowerKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":lowerSecurity.firstFactorSetupRef}});
  checked("stale-first-factor-new-enrollment-denied",!(await admin.query("select 1 from quantos.bff_security_commands where user_id=$1 and operation='setupMfa' and idempotency_key=$2",[user.id,lowerKey])).rowCount);
  const verifiedReplay=await call(server,active,"setupMfa",{expected:202,key:enrollKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  checked("verified-enrollment-completed-replay",verifiedReplay.payload.jobId===enrolled.payload.jobId&&!verifiedReplay.payload.mfaEnrollment.uri);
  // Simulate a persisted pre-completion checkpoint after upstream enrollment succeeded.
  await admin.query("update quantos.bff_security_commands set completed=false where user_id=$1 and operation='setupMfa' and idempotency_key=$2",[user.id,enrollKey]);
  const resumed=await call(server,active,"setupMfa",{expected:202,key:enrollKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":security.firstFactorSetupRef}});
  checked("pending-existing-factor-recovery",resumed.payload.mfaEnrollment.factorRef===enrollment.factorRef&&!resumed.payload.mfaEnrollment.uri);
  const absentKey=randomUUID(); recoveryKeys.push(absentKey);
  await admin.query("insert into quantos.bff_security_commands(user_id,operation,idempotency_key,intent,response) values($1,'setupMfa',$2,$3,$4)",[user.id,absentKey,JSON.stringify(["mfa",{method:"authenticator"}]),{jobId:randomUUID(),status:"accepted",correlationId:randomUUID(),auditRef:randomUUID(),_authOperation:"setupMfa"}]);
  await call(server,lower,"setupMfa",{expected:403,key:absentKey,body:{method:"authenticator"},headers:{"X-Reauth-Token-Ref":lowerSecurity.firstFactorSetupRef}});
  checked("pending-absent-factor-denied",(await authRequest("user",cleanupBearer)).factors.length===1);
  const cancelCheckpoint=randomUUID(); recoveryKeys.push(cancelCheckpoint);
  await admin.query("insert into quantos.bff_security_commands(user_id,operation,idempotency_key,intent,response) values($1,'revokeMfaFactor',$2,$3,$4)",[user.id,cancelCheckpoint,JSON.stringify([enrollment.factorRef,null]),{jobId:randomUUID(),status:"accepted",correlationId:randomUUID(),auditRef:randomUUID(),_authOperation:"cancelUnverifiedMfa"}]);
  await call(server,lower,"revokeMfaFactor",{expected:403,key:cancelCheckpoint,params:{factorId:enrollment.factorRef},headers:{"X-Reauth-Token-Ref":lowerSecurity.firstFactorSetupRef}});
  checked("verified-factor-overrides-cancel-checkpoint",(await authRequest("user",cleanupBearer)).factors.length===1);
  const grant=await call(server,active,"reauth",{expected:200,body:{challengeRef:verified.payload.challengeRef}});
  await auditMatches(grant,"auth.reauth");
  await call(server,active,"reauth",{expected:403,body:{challengeRef:verified.payload.challengeRef}});
  const reauth={"X-Reauth-Token-Ref":grant.payload.reauthTokenRef};
  // Fresh remote cookies keep this long-running integration fixture within the unchanged five-minute TTL.
  const remoteCookie=await login(server,cleanupBearer);
  const own=(await call(server,active,"listSessions",{expected:200})).payload;
  const remoteList=(await call(server,remoteCookie,"listSessions",{expected:200})).payload;
  const remote=remoteList.find(s=>s.current);assert(remote,"No own remote test session");
  const sequence=(await admin.query("select coalesce(max(sequence),0)::text as sequence from quantos.bff_settings_events where user_id=$1",[user.id])).rows[0].sequence;
  const stream=await call(server,active,"subscribeSessionRevocations",{expected:200,query:{afterSequence:sequence}});const reader=stream.response.body.getReader();
  const target=remoteCookie;
  const targetStream=await call(server,target,"subscribeSessionRevocations",{expected:200,query:{afterSequence:sequence}});const targetReader=targetStream.response.body.getReader();
  const revokeKey=randomUUID();const revoked=await call(server,active,"revokeSession",{expected:202,key:revokeKey,params:{sessionId:remote.sessionId},headers:reauth});
  await call(server,active,"revokeSession",{expected:202,key:revokeKey,params:{sessionId:remote.sessionId},headers:reauth});
  const revokeEvent=await event(reader);
  checked("revocation-event-correlation",revokeEvent.correlationId===revoked.payload.correlationId);
  await auditMatches(revoked,"revokeSession");
  assert(revokeEvent.payload.type==="session_revoked","Other-session revoke closed current stream");
  assert((await event(targetReader)).payload.type==="permission_revoked","Revoked target stream was not closed");await targetReader.cancel();await reader.cancel();
  await call(server,target,"getSession",{expected:401});
  const post=(await call(server,active,"getSecuritySettings",{expected:200})).payload;assert(post.factors.length===1,"Enrollment replay created more than one factor");
  await call(server,active,"revokeMfaFactor",{expected:409,params:{factorId:enrollment.factorRef},headers:reauth});
  const newFactor=await call(server,active,"setupMfa",{expected:202,body:{method:"authenticator"},headers:reauth});factors.add(newFactor.payload.mfaEnrollment.factorRef);
  const secondFactor=newFactor.payload.mfaEnrollment.factorRef;const factorKey=randomUUID();
  await call(server,active,"revokeMfaFactor",{expected:202,key:factorKey,params:{factorId:secondFactor},headers:reauth});factors.delete(secondFactor);
  await call(server,active,"revokeMfaFactor",{expected:202,key:factorKey,params:{factorId:secondFactor},headers:reauth});
  const trusted=(await call(server,active,"listDevices",{expected:200})).payload;assert(trusted.length===1,"Verified current device not persisted");
  metadataFixture=randomUUID();
  const metadata={downloadId:metadataFixture,objectLabel:"A2 metadata fixture",format:"csv",requestedAt:new Date().toISOString(),status:"preparing",watermarked:true,correlationId:randomUUID()};
  await admin.query("insert into quantos.bff_security_commands(user_id,operation,idempotency_key,intent,response,completed) values($1,'controlledDownload',$2,$3,$4,true)",[user.id,metadataFixture,{fixture:"A2 controlled metadata"},metadata]);
  const downloads=(await call(server,active,"listDownloads",{expected:200})).payload;
  assert(downloads.items.some(item=>item.downloadId===metadataFixture),"Persisted download metadata was not read");
  await call(server,active,"getPlatformCapabilities",{expected:200});
  const accessBody={teamName:"A2 controlled test",contactEmail:"synthetic@example.invalid",purpose:"Paper review",markets:["digital-assets"],expectedMode:"paper",privacyNoticeVersion:"2026-10-03"};
  await call(server,null,"submitAccessRequest",{expected:202,body:accessBody});
  const noCsrf=await fetch(server.base+"/v1/auth/logout",{method:"POST",headers:{origin,cookie:active.cookie}});assert(noCsrf.status===403,"Missing CSRF was accepted");
  records.push({operationId:"logout",status:noCsrf.status,label:"missing-CSRF-denied"});
  const preflight=await fetch(server.base+"/v1/settings/profile",{method:"OPTIONS",headers:{origin,"access-control-request-method":"PUT","access-control-request-headers":"x-csrf-token,idempotency-key,if-match,x-request-id"}});
  assert(preflight.headers.get("access-control-allow-methods")?.includes("PUT")&&preflight.headers.get("access-control-allow-headers")?.toLowerCase().includes("x-csrf-token"),"A2 preflight failed");
  const deviceKey=randomUUID();await call(server,active,"revokeDevice",{expected:202,key:deviceKey,params:{deviceId:trusted[0].deviceId},headers:reauth});
  await call(server,active,"getSession",{expected:401});
  const logoutSession=await login(server,cleanupBearer);await call(server,logoutSession,"logout",{expected:204});
  const persisted=(await admin.query("select response from quantos.bff_security_commands where user_id=$1 and operation='setupMfa' and idempotency_key=$2",[user.id,enrollKey])).rows[0].response;
  assert(!JSON.stringify(persisted).includes("otpauth:")&&!persisted.mfaEnrollment.uri,"Enrollment material persisted in commands");
  const covered=new Set(records.map(r=>r.operationId));const expected=[...operations].filter(([,op])=>op["x-quantos-policy"].owner==="BFF-FE-001").map(([id])=>id);assert(expected.every(id=>covered.has(id)),"Incomplete 20 operation coverage");
} catch(error) { failure=error.message; }
finally {
  try {
    if(cleanupBearer){
      // Fixture administrator is confined to cleanup of factor IDs created by this run.
      const current=await authRequest("user",cleanupBearer);
      const jobs=admin && enrollmentKeys.size ? (await admin.query("select response->>'jobId' as job from quantos.bff_security_commands where user_id=$1 and operation='setupMfa' and idempotency_key=any($2::uuid[])",[process.env.QUANTOS_F06_TEST_USER_ID,[...enrollmentKeys]])).rows : [];
      const names=new Set(jobs.map(row=>"QuantOS-"+row.job));
      for(const factor of current.factors??[])if(names.has(factor.friendly_name)&&!originalFactors.includes(factor.id))factors.add(factor.id);
      for(const factor of current.factors??[])if(factors.has(factor.id)){
        const response=await fetch(new URL("/auth/v1/admin/users/"+process.env.QUANTOS_F06_TEST_USER_ID+"/factors/"+factor.id,process.env.SUPABASE_URL),{method:"DELETE",headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(15000)});
        assert(response.ok||response.status===404,"Test factor cleanup failed");
      }
      const after=await authRequest("user",cleanupBearer);assert(JSON.stringify((after.factors??[]).map(f=>f.id).sort())===JSON.stringify(originalFactors),"Original factor set was not restored");
    }
  }catch(error){failure=(failure?failure+"; ":"")+error.message;}
  try {
    if(admin){
      if(recoveryKeys.length)await admin.query("delete from quantos.bff_security_commands where user_id=$1 and idempotency_key=any($2::uuid[])",[process.env.QUANTOS_F06_TEST_USER_ID,recoveryKeys]);
      if(metadataFixture)await admin.query("delete from quantos.bff_security_commands where user_id=$1 and operation='controlledDownload' and idempotency_key=$2",[process.env.QUANTOS_F06_TEST_USER_ID,metadataFixture]);
      if(originalProfile)await admin.query("update quantos.bff_profiles set profile=$2,notifications=$3 where user_id=$1",[process.env.QUANTOS_F06_TEST_USER_ID,originalProfile,originalNotifications]);
      for(const session of cookies){const raw=/(?:^|; )quantos_session=([^;]+)/.exec(session.cookie)?.[1];if(raw)await admin.query("delete from quantos.bff_sessions where session_hash=encode(extensions.digest($1,'sha256'),'hex')",[raw]);}
      const restored=(await admin.query("select profile,notifications from quantos.bff_profiles where user_id=$1",[process.env.QUANTOS_F06_TEST_USER_ID])).rows[0];
      assert(JSON.stringify(restored.profile)===JSON.stringify(originalProfile)&&JSON.stringify(restored.notifications)===JSON.stringify(originalNotifications),"Profile/preferences restoration mismatch");
      cleanupVerified=true;
    }
  }catch(error){failure=(failure?failure+"; ":"")+error.message;}
  if(admin)await admin.end();
  for(const server of servers)await stop(server);
}
if(!failure){
  const traces=fs.readFileSync(path.join(output,"traces.jsonl"),"utf8").trim().split("\n").map(JSON.parse);
  if(!correlations.every(c=>traces.some(t=>t.correlation_id===c&&t.status==="succeeded")))failure="Response/audit correlation did not resolve to successful trace";
}
const receipt={schema:"quantos-bff-a2-live-regression/v1",sourceCommit:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),sourceTreeClean:execFileSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8"}).trim()==="",status:failure?"FAIL":"PASS",
  sourceHashes,assertions,correlations,cleanupVerified,
  scope:"configured existing Supabase Auth/PostgreSQL; local live BFF, synthetic HTTPS Origin; not staging",records,failure:failure??null,cleanup:"restore own original profile/preferences and factor set; revoke own temporary sessions; retain append-only test audits"};
fs.writeFileSync(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({status:receipt.status,records:records.length,failure:failure??null}));
if(failure)process.exitCode=1;
