// Isolated UI-P04 reference harness. Actual C03/C04 bytes; identity and CORS bridge are local substitutes. Faults are labeled separately.
import {test,expect,type Page} from "@playwright/test";
import {spawn,execFileSync,type ChildProcess} from "node:child_process";
import {createServer as tcpServer} from "node:net";
import {createServer,request as httpsRequest} from "node:https";
import {request as httpRequest,type ServerResponse} from "node:http";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
export const origin="https://127.0.0.1:4010",terminal="http://localhost:3190",csrf="csrf-token-0000000000000001",correlation="aaaaaaaa-1111-4111-8111-111111111111";
const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
type Row={method:string;path:string;status:number;source:string;port:string;query?:string;upstreamQuery?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string;snapshotIds?:string[];createBody?:unknown;accepted?:unknown};
let artifactMode:"normal"|"relation"|"wrong-parent"|"hash"|"xss"|"no-audit"|"no-research"|"chain-pages"|"chain-expired"="normal";let chainPage=0;
let fieldReject=false,listExpired=false,rateLimited=false,dropCancel=false,cancelReject=0;
let domainStream:"normal"|"gap"|"forbidden"|"wrong-resource"="normal",detailStatus:string|undefined;
let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false,readonlyAudit=false,slowSession=false,auditFailures=0,snapshotQuality:string|undefined;
const streams=new Set<ServerResponse>();
const proxy=createServer({},async(req,res)=>{
 const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
 for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
 if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
 if(path==="/v1/research-runs"&&method==="GET"&&listExpired){listExpired=false;rows.push({method,path,status:410,source:"SYNTHETIC_CURSOR_EXPIRED",port:"ACTUAL_BROWSER"});res.writeHead(410,{"content-type":"application/json"});res.end(JSON.stringify({code:"CURSOR_EXPIRED",message:"Refresh",correlationId:correlation}));return;}
 if(path==="/v1/data-snapshots"&&auditFailures>0){auditFailures--;rows.push({method,path,status:503,source:"SYNTHETIC_C04_503",port:"ACTUAL_BROWSER"});res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({code:"UNAVAILABLE",message:"Unavailable",correlationId:correlation}));return;}
 const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui-p04-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
 if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
 if(path==="/v1/research-runs"&&method==="POST"){row.createBody=JSON.parse(body.toString());if(fieldReject||rateLimited){row.status=rateLimited?429:422;row.source=rateLimited?"SYNTHETIC_RATE_LIMIT":"SYNTHETIC_FIELD_REJECTION";res.writeHead(row.status,{"content-type":"application/json"});res.end(JSON.stringify({code:rateLimited?"RATE_LIMITED":"INVALID_REQUEST",message:"private SQL must not display",correlationId:correlation,...(rateLimited?{retryAfter:1}:{fieldErrors:{budget:"private SQL",unexpected:"internal path"}})}));return;}}
 if(path.endsWith("/cancel")&&cancelReject){row.status=cancelReject;row.source="SYNTHETIC_CANCEL_REFUSAL";res.writeHead(cancelReject,{"content-type":"application/json"});res.end(JSON.stringify({code:cancelReject===429?"RATE_LIMITED":"STATE_CONFLICT",message:"private SQL",correlationId:correlation,...(cancelReject===429?{retryAfter:1}:{})}));return;}
 if(path.startsWith("/v1/research-runs/")&&path.endsWith("/stream")&&domainStream==="forbidden"){row.status=403;row.source="SYNTHETIC_DOMAIN_STREAM_403";res.writeHead(403);res.end();return;}
 if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
 let upstreamPath=req.url!;if(artifactMode==="chain-pages"&&path.includes("/evidence-chains/")&&url.searchParams.get("cursor")==="synthetic-next"){const bounded=new URL(url);bounded.searchParams.delete("cursor");upstreamPath=bounded.pathname+bounded.search;row.upstreamQuery=bounded.search;}
 const upstream=httpRequest({host:"127.0.0.1",port,path:upstreamPath,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  if(path.startsWith("/v1/research-runs/")&&path.endsWith("/stream")&&domainStream!=="normal"){
   const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{const text=Buffer.concat(output).toString(),runId=path.split("/")[3],base={streamId:runId,occurredAt:new Date().toISOString(),correlationId:correlation,payloadVersion:"v1",payload:{type:"research.progress",runId}};
    const frame=(n:number)=>({ ...base,sequence:n,eventId:`22222222-2222-4222-8222-${String(n).padStart(12,"0")}`});
    const after=Number(url.searchParams.get("afterSequence")??0);let bytes:string;
    if(domainStream==="wrong-resource"){bytes=`data: ${JSON.stringify({...frame(1),streamId:correlation})}\n\n`;row.source="SYNTHETIC_WRONG_RESOURCE";}
    else{bytes=after===0?text+text+`data: ${JSON.stringify(frame(3))}\n\n`:after===1?[frame(2),frame(3)].map(e=>`data: ${JSON.stringify(e)}\n\n`).join(""):"";row.source="REFERENCE_QUEUED_PLUS_SYNTHETIC_DUPLICATE_GAP_NOTICES";}
    row.responseHash=hash(bytes);res.writeHead(row.status,{"content-type":"text/event-stream"});res.end(bytes);
   });return;
  }
  if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
   let bytes=Buffer.concat(output);
   if(artifactMode==="no-audit"||artifactMode==="no-research"){if(["/v1/session","/v1/context"].includes(path)&&row.status===200){const c=JSON.parse(bytes.toString());c.capabilities=c.capabilities.filter((v:string)=>v!==(artifactMode==="no-audit"?"audit:read":"research.read"));bytes=Buffer.from(JSON.stringify(c));row.source="SYNTHETIC_CAPABILITY_NARROWING";}}
   if(["relation","wrong-parent"].includes(artifactMode)&&/^\/v1\/research-runs\/[^/]+$/.test(path)&&row.status===200){const r=JSON.parse(bytes.toString());r.artifactRefs=artifactMode==="wrong-parent"?[]:["44444444-4444-4444-8444-444444444444"];r.evidenceRefs=["77777777-7777-4777-8777-777777777777"];bytes=Buffer.from(JSON.stringify(r));row.source="SYNTHETIC_REFERENCE_RELATIONSHIP_OVERLAY_NO_ENGINE_COMPLETION";}
   if(["relation","xss"].includes(artifactMode)&&/^\/v1\/artifacts\/[^/]+$/.test(path)&&row.status===200){const a=JSON.parse(bytes.toString());a.evidence=[{evidenceId:"77777777-7777-4777-8777-777777777777",artifactId:a.artifactId,summary:"Synthetic relationship fixture; no engine evidence claimed"}];if(artifactMode==="xss")a.summary='<img src="https://evil.invalid/x" onerror="window.unsafeExecuted=true">';bytes=Buffer.from(JSON.stringify(a));row.source=artifactMode==="xss"?"SYNTHETIC_UNTRUSTED_TEXT":"SYNTHETIC_DOMAIN_EVIDENCE_RELATIONSHIP_OVERLAY";}
   if(artifactMode==="hash"&&path.endsWith("/attachment")&&row.status===200){const a=JSON.parse(bytes.toString());a.contentHash="sha256:"+"b".repeat(64);bytes=Buffer.from(JSON.stringify(a));row.source="SYNTHETIC_ATTACHMENT_HASH_MISMATCH";}
   if(["chain-pages","chain-expired"].includes(artifactMode)&&path.includes("/evidence-chains/")&&row.status===200){const chain=JSON.parse(bytes.toString());chainPage++;const n=chain.items[0];if(n){n.eventId=chainPage===1?"88888888-8888-4888-8888-888888888888":"99999999-9999-4999-8999-999999999999";n.sequence=chainPage;n.route="/untrusted?token=DO_NOT_FOLLOW";if(artifactMode==="chain-expired")n.retentionUntil=new Date(Date.now()-1000).toISOString();}chain.items=n?[n]:[];chain.complete=artifactMode==="chain-expired"||chainPage>1;chain.nextCursor=chain.complete?undefined:"synthetic-next";bytes=Buffer.from(JSON.stringify(chain));row.source="SYNTHETIC_C10_PAGING_OR_RETENTION";}
if(detailStatus&&/^\/v1\/research-runs\/[^/]+$/.test(path)&&row.status===200){bytes=Buffer.from(JSON.stringify({...JSON.parse(bytes.toString()),status:detailStatus}));row.source="SYNTHETIC_TERMINAL_DETAIL";}if(readonlyAudit&&["/v1/session","/v1/context"].includes(path)&&row.status===200){const c=JSON.parse(bytes.toString());c.capabilities=c.capabilities.filter((v:string)=>v!=="research.write");bytes=Buffer.from(JSON.stringify(c));row.source="SYNTHETIC_CAPABILITY_NARROWING";}if(snapshotQuality&&path.startsWith("/v1/data-snapshots/")&&row.status===200){const snapshot=JSON.parse(bytes.toString());snapshot.quality=snapshotQuality;snapshot.qualityBlocked=true;bytes=Buffer.from(JSON.stringify(snapshot));row.source="SYNTHETIC_SNAPSHOT_NARROWING";}if(path==="/v1/data-snapshots"&&row.status===200)row.snapshotIds=JSON.parse(bytes.toString()).items?.map((s:{snapshotId:string})=>s.snapshotId);row.responseHash=hash(bytes);
   if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
   if((path==="/v1/research-runs"||path.endsWith("/cancel"))&&method==="POST"&&row.status===202)row.accepted=JSON.parse(bytes.toString());
   if(path.endsWith("/cancel")&&method==="POST"&&dropCancel){dropCancel=false;row.source="REFERENCE_CANCEL_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
   if(path==="/v1/research-runs"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
   for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin","content-length"].includes(k))res.setHeader(k,v);
   res.setHeader("content-length",bytes.length);res.writeHead(row.status);if(slowSession&&path==="/v1/session"){row.source="REFERENCE_BYTES_DELAYED_800MS";setTimeout(()=>res.end(bytes),800);}else res.end(bytes);
  });
 });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
});
export async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui-p04-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
export async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
test.beforeAll(async()=>{
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui-p04-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async({context,page})=>{
 artifactMode="normal";chainPage=0;dropCancel=false;cancelReject=0;domainStream="normal";detailStatus=undefined;rows=[];identity="session-current";dropCreate=false;breakStream=false;readonlyAudit=false;slowSession=false;auditFailures=0;snapshotQuality=undefined;fieldReject=false;listExpired=false;rateLimited=false;
 await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
 child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
});
test.afterEach(async({context,page},info)=>{
 if(info.status!=="passed"&&!page.isClosed()){await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(()=>"unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(()=>{});}
 const file=info.outputPath("ui-p04.json");await writeFile(file,JSON.stringify({schema:"quantos-ui-p04-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"REFERENCE_C03_SEED_AND_EXPLICIT_CANCEL_WITH_LABELED_OVERLAYS",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui-p04",{path:file,contentType:"application/json"});
 await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
});
test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});

export const networkRows=()=>rows;
export function fault(options:{readonly?:boolean;slow?:boolean;auditFailures?:number;dropCreate?:boolean;snapshotQuality?:"degraded"|"expired";fieldReject?:boolean;listExpired?:boolean;rateLimited?:boolean}){readonlyAudit=options.readonly??false;slowSession=options.slow??false;auditFailures=options.auditFailures??0;dropCreate=options.dropCreate??false;snapshotQuality=options.snapshotQuality;fieldReject=options.fieldReject??false;listExpired=options.listExpired??false;rateLimited=options.rateLimited??false;}

export function detailFault(options:{dropCancel?:boolean;cancelReject?:number;stream?:typeof domainStream;status?:string}){dropCancel=options.dropCancel??false;cancelReject=options.cancelReject??0;domainStream=options.stream??"normal";detailStatus=options.status;}
export async function seed(){return new Promise<{jobId:string;correlationId:string; auditRef:string}>((resolve,reject)=>{const body=JSON.stringify({capability:"research.hypothesis.v1",dataSnapshotId:"11111111-1111-4111-8111-000000000001",question:"UI-P04 actual reference detail seed",budget:"10",deadlineAt:new Date(Date.now()+3600000).toISOString()});const req=httpsRequest(origin+"/v1/research-runs",{method:"POST",rejectUnauthorized:false,headers:{"content-type":"application/json","x-csrf-token":csrf,"idempotency-key":crypto.randomUUID(),"x-ui-p04-control":"1","x-request-id":crypto.randomUUID()}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>res.statusCode===202?resolve(JSON.parse(Buffer.concat(parts).toString())):reject(Error("reference seed status "+res.statusCode)));});req.on("error",reject);req.end(body);});}

export function artifactFault(mode:typeof artifactMode){artifactMode=mode;chainPage=0;}
