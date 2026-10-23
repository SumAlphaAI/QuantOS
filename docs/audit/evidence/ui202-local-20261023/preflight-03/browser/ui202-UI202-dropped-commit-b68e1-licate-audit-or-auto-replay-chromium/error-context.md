# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui202.spec.ts >> UI202 dropped committed cancellation explicitly retries identical key; no duplicate audit or auto replay
- Location: tests/e2e/ui202.spec.ts:12:5

# Error details

```
Error: reference seed status 422
```

# Test source

```ts
  1  | // Isolated UI-202 reference harness. Actual C03/C04 bytes; identity and CORS bridge are local substitutes. Faults are labeled separately.
  2  | import {test,expect,type Page} from "@playwright/test";
  3  | import {spawn,execFileSync,type ChildProcess} from "node:child_process";
  4  | import {createServer as tcpServer} from "node:net";
  5  | import {createServer,request as httpsRequest} from "node:https";
  6  | import {request as httpRequest,type ServerResponse} from "node:http";
  7  | import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
  8  | import {tmpdir} from "node:os";
  9  | import {resolve,join} from "node:path";
  10 | import {createHash} from "node:crypto";
  11 | export const origin="https://127.0.0.1:4010",terminal="http://localhost:3190",csrf="csrf-token-0000000000000001",correlation="aaaaaaaa-1111-4111-8111-111111111111";
  12 | const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
  13 | type Row={method:string;path:string;status:number;source:string;port:string;query?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string;snapshotIds?:string[];createBody?:unknown;accepted?:unknown};
  14 | let fieldReject=false,listExpired=false,rateLimited=false,dropCancel=false,cancelReject=0;
  15 | let domainStream:"normal"|"gap"|"forbidden"|"wrong-resource"="normal",detailStatus:string|undefined;
  16 | let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false,readonlyAudit=false,slowSession=false,auditFailures=0,snapshotQuality:string|undefined;
  17 | const streams=new Set<ServerResponse>();
  18 | const proxy=createServer({},async(req,res)=>{
  19 |  const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
  20 |  for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
  21 |  if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
  22 |  const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
  23 |  if(path==="/v1/research-runs"&&method==="GET"&&listExpired){listExpired=false;rows.push({method,path,status:410,source:"SYNTHETIC_CURSOR_EXPIRED",port:"ACTUAL_BROWSER"});res.writeHead(410,{"content-type":"application/json"});res.end(JSON.stringify({code:"CURSOR_EXPIRED",message:"Refresh",correlationId:correlation}));return;}
  24 |  if(path==="/v1/data-snapshots"&&auditFailures>0){auditFailures--;rows.push({method,path,status:503,source:"SYNTHETIC_C04_503",port:"ACTUAL_BROWSER"});res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({code:"UNAVAILABLE",message:"Unavailable",correlationId:correlation}));return;}
  25 |  const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui202-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
  26 |  if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
  27 |  if(path==="/v1/research-runs"&&method==="POST"){row.createBody=JSON.parse(body.toString());if(fieldReject||rateLimited){row.status=rateLimited?429:422;row.source=rateLimited?"SYNTHETIC_RATE_LIMIT":"SYNTHETIC_FIELD_REJECTION";res.writeHead(row.status,{"content-type":"application/json"});res.end(JSON.stringify({code:rateLimited?"RATE_LIMITED":"INVALID_REQUEST",message:"private SQL must not display",correlationId:correlation,...(rateLimited?{retryAfter:1}:{fieldErrors:{budget:"private SQL",unexpected:"internal path"}})}));return;}}
  28 |  if(path.endsWith("/cancel")&&cancelReject){row.status=cancelReject;row.source="SYNTHETIC_CANCEL_REFUSAL";res.writeHead(cancelReject,{"content-type":"application/json"});res.end(JSON.stringify({code:cancelReject===429?"RATE_LIMITED":"STATE_CONFLICT",message:"private SQL",correlationId:correlation,...(cancelReject===429?{retryAfter:1}:{})}));return;}
  29 |  if(path.startsWith("/v1/research-runs/")&&path.endsWith("/stream")&&domainStream==="forbidden"){row.status=403;row.source="SYNTHETIC_DOMAIN_STREAM_403";res.writeHead(403);res.end();return;}
  30 |  if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
  31 |  const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  32 |   row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  33 |   if(path.startsWith("/v1/research-runs/")&&path.endsWith("/stream")&&domainStream!=="normal"){
  34 |    const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{const text=Buffer.concat(output).toString(),runId=path.split("/")[3],base={streamId:runId,occurredAt:new Date().toISOString(),correlationId:correlation,payloadVersion:"v1",payload:{type:"research.progress",runId}};
  35 |     const frame=(n:number)=>({ ...base,sequence:n,eventId:`22222222-2222-4222-8222-${String(n).padStart(12,"0")}`});
  36 |     const after=Number(url.searchParams.get("afterSequence")??0);let bytes:string;
  37 |     if(domainStream==="wrong-resource"){bytes=`data: ${JSON.stringify({...frame(1),streamId:correlation})}\n\n`;row.source="SYNTHETIC_WRONG_RESOURCE";}
  38 |     else{bytes=after===0?text+text+`data: ${JSON.stringify(frame(3))}\n\n`:after===1?[frame(2),frame(3)].map(e=>`data: ${JSON.stringify(e)}\n\n`).join(""):"";row.source="REFERENCE_QUEUED_PLUS_SYNTHETIC_DUPLICATE_GAP_NOTICES";}
  39 |     row.responseHash=hash(bytes);res.writeHead(row.status,{"content-type":"text/event-stream"});res.end(bytes);
  40 |    });return;
  41 |   }
  42 |   if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  43 |   const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
  44 |    let bytes=Buffer.concat(output);if(detailStatus&&/^\/v1\/research-runs\/[^/]+$/.test(path)&&row.status===200){bytes=Buffer.from(JSON.stringify({...JSON.parse(bytes.toString()),status:detailStatus}));row.source="SYNTHETIC_TERMINAL_DETAIL";}if(readonlyAudit&&["/v1/session","/v1/context"].includes(path)&&row.status===200){const c=JSON.parse(bytes.toString());c.capabilities=c.capabilities.filter((v:string)=>v!=="research.write");bytes=Buffer.from(JSON.stringify(c));row.source="SYNTHETIC_CAPABILITY_NARROWING";}if(snapshotQuality&&path.startsWith("/v1/data-snapshots/")&&row.status===200){const snapshot=JSON.parse(bytes.toString());snapshot.quality=snapshotQuality;snapshot.qualityBlocked=true;bytes=Buffer.from(JSON.stringify(snapshot));row.source="SYNTHETIC_SNAPSHOT_NARROWING";}if(path==="/v1/data-snapshots"&&row.status===200)row.snapshotIds=JSON.parse(bytes.toString()).items?.map((s:{snapshotId:string})=>s.snapshotId);row.responseHash=hash(bytes);
  45 |    if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
  46 |    if((path==="/v1/research-runs"||path.endsWith("/cancel"))&&method==="POST"&&row.status===202)row.accepted=JSON.parse(bytes.toString());
  47 |    if(path.endsWith("/cancel")&&method==="POST"&&dropCancel){dropCancel=false;row.source="REFERENCE_CANCEL_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
  48 |    if(path==="/v1/research-runs"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
  49 |    for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin","content-length"].includes(k))res.setHeader(k,v);
  50 |    res.setHeader("content-length",bytes.length);res.writeHead(row.status);if(slowSession&&path==="/v1/session"){row.source="REFERENCE_BYTES_DELAYED_800MS";setTimeout(()=>res.end(bytes),800);}else res.end(bytes);
  51 |   });
  52 |  });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
  53 | });
  54 | export async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui202-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
  55 | export async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
  56 | test.beforeAll(async()=>{
  57 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui202-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
  58 | });
  59 | test.beforeEach(async({context,page})=>{
  60 |  dropCancel=false;cancelReject=0;domainStream="normal";detailStatus=undefined;rows=[];identity="session-current";dropCreate=false;breakStream=false;readonlyAudit=false;slowSession=false;auditFailures=0;snapshotQuality=undefined;fieldReject=false;listExpired=false;rateLimited=false;
  61 |  await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  62 |  const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
  63 |  child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
  64 | });
  65 | test.afterEach(async({context,page},info)=>{
  66 |  if(info.status!=="passed"&&!page.isClosed()){await writeFile(info.outputPath("page-state.txt"),await page.locator(".research-workspace").innerText({timeout:1000}).catch(()=>"unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(()=>{});}
  67 |  const file=info.outputPath("ui202.json");await writeFile(file,JSON.stringify({schema:"quantos-ui202-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"LOCAL_REFERENCE_C03_CREATE_CANCEL_ONLY",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui202",{path:file,contentType:"application/json"});
  68 |  await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
  69 | });
  70 | test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});
  71 | 
  72 | export const networkRows=()=>rows;
  73 | export function fault(options:{readonly?:boolean;slow?:boolean;auditFailures?:number;dropCreate?:boolean;snapshotQuality?:"degraded"|"expired";fieldReject?:boolean;listExpired?:boolean;rateLimited?:boolean}){readonlyAudit=options.readonly??false;slowSession=options.slow??false;auditFailures=options.auditFailures??0;dropCreate=options.dropCreate??false;snapshotQuality=options.snapshotQuality;fieldReject=options.fieldReject??false;listExpired=options.listExpired??false;rateLimited=options.rateLimited??false;}
  74 | 
  75 | export function detailFault(options:{dropCancel?:boolean;cancelReject?:number;stream?:typeof domainStream;status?:string}){dropCancel=options.dropCancel??false;cancelReject=options.cancelReject??0;domainStream=options.stream??"normal";detailStatus=options.status;}
> 76 | export async function seed(){return new Promise<{jobId:string;correlationId:string; auditRef:string}>((resolve,reject)=>{const body=JSON.stringify({capability:"research.hypothesis.v1",dataSnapshotId:"11111111-1111-4111-8111-000000000001",question:"UI202 actual reference detail seed",budget:"10",deadlineAt:new Date(Date.now()+3600000).toISOString()});const req=httpsRequest(origin+"/v1/research-runs",{method:"POST",rejectUnauthorized:false,headers:{"content-type":"application/json","x-csrf-token":csrf,"idempotency-key":crypto.randomUUID(),"x-ui202-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>res.statusCode===202?resolve(JSON.parse(Buffer.concat(parts).toString())):reject(Error("reference seed status "+res.statusCode)));});req.on("error",reject);req.end(body);});}
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ^ Error: reference seed status 422
  77 | 
```