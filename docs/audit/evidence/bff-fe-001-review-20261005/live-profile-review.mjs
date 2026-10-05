import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { operations, validateResponse } from "../../../../tests/contract/http-contract.mjs";

const root = "/Users/anray/Documents/project/SumAlpha/QuantOS";
const output = path.resolve(process.argv[2] ?? "/private/tmp/quantos-bff-a2-live");
if (process.env.QUANTOS_RUN_BFF_A2_LIVE !== "1") throw Error("Explicit QUANTOS_RUN_BFF_A2_LIVE=1 required for the configured test Supabase");
process.loadEnvFile(path.join(root, ".env.local"));
fs.mkdirSync(output, { recursive: true });
const records = [];
const observations=[];
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
  admin=pgClient();await admin.connect();
  const prior=(await admin.query("select profile,notifications from quantos.bff_profiles where user_id=$1",[user.id])).rows[0];originalProfile=prior?.profile;originalNotifications=prior?.notifications;
  const server=await start();const own=await login(server,cleanupBearer);
  const current=(await call(server,own,"getProfile",{expected:200})).payload;
  const input={...operations.get('saveProfile').requestBody.content['application/json'].example,email:'forged@example.invalid',emailVerified:true,roleLabels:['admin'],memberId:'forged-member'};
  const changed=await call(server,own,'saveProfile',{expected:422,body:input,headers:{'If-Match':current.objectVersion}});
  const stored=(await call(server,own,'getProfile',{expected:200})).payload;
  observations.push({probe:'server-owned-profile-field-write',status:changed.response.status,writeRejected:changed.response.status===422,originalIdentityPreserved:stored.email===current.email&&JSON.stringify(stored.roleLabels)===JSON.stringify(current.roleLabels)&&stored.memberId===current.memberId,realAuthRoleUnchanged:(await call(server,own,'getSession',{expected:200})).payload.role});
  const response=await fetch(server.base+'/v1/settings/profile',{method:'PUT',headers:{origin,cookie:own.cookie,'X-CSRF-Token':own.csrf,'X-Request-Id':randomUUID(),'Idempotency-Key':randomUUID(),'If-Match':stored.objectVersion,'content-type':'application/json'},body:JSON.stringify({...input,email:123}),signal:AbortSignal.timeout(30000)});
  const issues=await validateResponse('saveProfile',response);
  const read=await fetch(server.base+'/v1/settings/profile',{headers:{origin,cookie:own.cookie},signal:AbortSignal.timeout(30000)});
  const readIssues=await validateResponse('getProfile',read);
  observations.push({probe:'invalid-server-owned-field-rejected',writeStatus:response.status,writeIssues:issues,readStatus:read.status,readIssues});
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
      if(metadataFixture)await admin.query("delete from quantos.bff_security_commands where user_id=$1 and operation='controlledDownload' and idempotency_key=$2",[process.env.QUANTOS_F06_TEST_USER_ID,metadataFixture]);
      if(originalProfile)await admin.query("update quantos.bff_profiles set profile=$2,notifications=$3 where user_id=$1",[process.env.QUANTOS_F06_TEST_USER_ID,originalProfile,originalNotifications]);
      for(const session of cookies){const raw=/(?:^|; )quantos_session=([^;]+)/.exec(session.cookie)?.[1];if(raw)await admin.query("delete from quantos.bff_sessions where session_hash=encode(extensions.digest($1,'sha256'),'hex')",[raw]);}
    }
  }catch(error){failure=(failure?failure+"; ":"")+error.message;}
  if(admin)await admin.end();
  for(const server of servers)await stop(server);
}
const receipt={schema:"quantos-bff-a2-live-regression/v1",sourceCommit:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),sourceTreeClean:execFileSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8"}).trim()==="",status:failure?"FAIL":"PASS",
  scope:"configured existing Supabase Auth/PostgreSQL; local live BFF, synthetic HTTPS Origin; not staging",records,observations,failure:failure??null,cleanup:"restore own original profile/preferences and factor set; revoke own temporary sessions; retain append-only test audits"};
fs.writeFileSync(path.join(output,"receipt.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({status:receipt.status,records:records.length,failure:failure??null}));
if(failure)process.exitCode=1;
