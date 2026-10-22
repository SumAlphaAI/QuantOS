// Isolated P05 hooks reuse the unchanged UI-204 reference fixture pattern; C04 uses actual unchanged Rust reference bytes. Identity cookie / CORS are explicit local substitutes.
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
type Row={method:string;path:string;status:number;source:string;port:string;query?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string;snapshotIds?:string[]};
let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false,readonlyAudit=false,slowSession=false,auditFailures=0,snapshotQuality:string|undefined;
const streams=new Set<ServerResponse>();
const proxy=createServer({},async(req,res)=>{
 const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
 for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
 if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
 if(path==="/v1/data-snapshots"&&auditFailures>0){auditFailures--;rows.push({method,path,status:503,source:"SYNTHETIC_C04_503",port:"ACTUAL_BROWSER"});res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({code:"UNAVAILABLE",message:"Unavailable",correlationId:correlation}));return;}
 const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui-p05-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
 if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
 if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
 const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
   let bytes=Buffer.concat(output);if(readonlyAudit&&["/v1/session","/v1/context"].includes(path)&&row.status===200){const c=JSON.parse(bytes.toString());c.capabilities=c.capabilities.filter((v:string)=>v!=="snapshot.read");bytes=Buffer.from(JSON.stringify(c));row.source="SYNTHETIC_CAPABILITY_NARROWING";}if(snapshotQuality&&path.startsWith("/v1/data-snapshots/")&&row.status===200){const snapshot=JSON.parse(bytes.toString());snapshot.quality=snapshotQuality;snapshot.qualityBlocked=true;bytes=Buffer.from(JSON.stringify(snapshot));row.source="SYNTHETIC_SNAPSHOT_NARROWING";}if(path==="/v1/data-snapshots"&&row.status===200)row.snapshotIds=JSON.parse(bytes.toString()).items?.map((s:{snapshotId:string})=>s.snapshotId);row.responseHash=hash(bytes);
   if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
   if(path==="/v1/exports"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
   for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin","content-length"].includes(k))res.setHeader(k,v);
   res.setHeader("content-length",bytes.length);res.writeHead(row.status);if(slowSession&&path==="/v1/session"){row.source="REFERENCE_BYTES_DELAYED_800MS";setTimeout(()=>res.end(bytes),800);}else res.end(bytes);
  });
 });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
});
export async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui-p05-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
export async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
test.beforeAll(async()=>{
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui-p05-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async({context,page})=>{
 rows=[];identity="session-current";dropCreate=false;breakStream=false;readonlyAudit=false;slowSession=false;auditFailures=0;snapshotQuality=undefined;
 await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
 child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
});
test.afterEach(async({context,page},info)=>{
 if(info.status!=="passed"&&!page.isClosed()){await writeFile(info.outputPath("page-state.txt"),await page.locator(".snapshot-workspace").innerText().catch(()=>"unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true}).catch(()=>{});}
 await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
 const file=info.outputPath("ui-p05.json");await writeFile(file,JSON.stringify({schema:"quantos-ui-p05-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"NOT_RUN_READ_ONLY_UI_P05",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui-p05",{path:file,contentType:"application/json"});
});
test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});

export const networkRows=()=>rows;
export function fault(options:{readonly?:boolean;slow?:boolean;auditFailures?:number;dropCreate?:boolean;snapshotQuality?:"degraded"|"expired"}){readonlyAudit=options.readonly??false;slowSession=options.slow??false;auditFailures=options.auditFailures??0;dropCreate=options.dropCreate??false;snapshotQuality=options.snapshotQuality;}
