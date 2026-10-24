// Actual C01/C14/C15/C16 reference BFF bytes through a loopback TLS/CORS and identity substitute.
import {test,expect,type Page} from "@playwright/test";
import {spawn,execFileSync,type ChildProcess} from "node:child_process";
import {createServer as reserveServer} from "node:net";
import {createServer,request as secureRequest} from "node:https";
import {request,type ServerResponse} from "node:http";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
const origin = "https://127.0.0.1:4010", terminal = "http://localhost:3190", csrf = "csrf-token-0000000000000001";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
type Row = {query:Record<string,string>;method: string;path: string;status: number;source: string;control: boolean;keyHash?: string;bodyHash: string;version?: string;responseHash?: string};
let rows:Row[]=[],child:ChildProcess,port:number,scratch:string;
let flags:{drop?:boolean;readonly?:boolean;expired?:boolean;empty?:boolean;foreign?:boolean;gap?:boolean;conflict?:boolean;rateLimit?:boolean;slow?:boolean;streamForbidden?:boolean;stateRows?:boolean;largeDecimal?:boolean}={};
let expiredAt=new Date().toISOString();
let lastFrame:Record<string,unknown>|undefined;
const streams=new Set<ServerResponse>();
export const networkRows=()=>rows;
export function fault(next:typeof flags){flags=next;expiredAt=new Date(Date.now()-1000).toISOString();}
const proxy=createServer({},async(req,res)=>{
 const u=new URL(req.url!,origin),path=u.pathname,method=req.method!;
 for(const[k,v]of Object.entries({'access-control-allow-origin':terminal,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,x-csrf-token,x-request-id,idempotency-key,if-match','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'}))res.setHeader(k,v);
 if(method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
 const row:Row={query:Object.fromEntries(u.searchParams),method,path,status:0,source:'REFERENCE_BYTES',control:Boolean(req.headers['x-ui-p22-control']),bodyHash:hash(body),version:req.headers['if-match']as string|undefined,keyHash:req.headers['idempotency-key']?hash(String(req.headers['idempotency-key'])):undefined};rows.push(row);
 const refuse=(status:number,source:string)=>{row.status=status;row.source=source;res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({code:status===429?'RATE_LIMITED':status===409?'VERSION_CONFLICT':'FORBIDDEN',message:'private SQL must never render',correlationId:'aaaaaaaa-1111-4111-8111-111111111111',...(status===429?{retryAfter:2}:{})}));};
 if(flags.streamForbidden&&path.endsWith('/stream')&&path.includes('/reconciliation/')){refuse(403,'SYNTHETIC_STREAM_FORBIDDEN');return;}
 if(flags.conflict&&method==='POST'&&path.endsWith('/reruns')){refuse(409,'SYNTHETIC_VERSION_CONFLICT');return;}
 if(flags.rateLimit&&path==='/v1/reconciliation/runs'){refuse(429,'SYNTHETIC_RATE_LIMIT');return;}
 const upstream=request({host:'127.0.0.1',port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control?String(req.headers['x-ui-p22-session']):flags.readonly?'session-viewer':'session-current'}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
 row.status=response.statusCode!;
 if(path==='/v1/settings/sessions/stream'){res.writeHead(row.status,{'content-type':'text/event-stream'});res.flushHeaders();streams.add(res);response.pipe(res);res.on('close',()=>{streams.delete(res);response.destroy();});return;}
 const output:Buffer[]=[];response.on('data',b=>output.push(Buffer.from(b)));response.on('end',()=>{let bytes=Buffer.concat(output);
 if(row.status===200&&!row.control&&path.startsWith('/v1/reconciliation/runs')){
 const change=(v:Record<string,unknown>)=>{if(flags.foreign)v.accountId='aaaaaaaa-1111-4111-8111-111111111111';if(flags.expired){v.asOf=new Date(Date.parse(expiredAt)-1000).toISOString();v.expiresAt=expiredAt;v.provisional=true;}};
 if(flags.empty||flags.foreign||flags.expired||flags.gap)row.source='SYNTHETIC_C15_SCOPE_FRESHNESS_OR_JOURNAL_PROBE';
 if(path.endsWith('/stream')){let frames=bytes.toString().split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));if(frames.length)lastFrame=structuredClone(frames.at(-1));if(flags.gap&&lastFrame)frames=[{...lastFrame,sequence:Number(row.query.afterSequence??0)+2,eventId:crypto.randomUUID()}];for(const e of frames)change(e.payload);bytes=Buffer.from(frames.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''));}
 else {const v=JSON.parse(bytes.toString());if(path==='/v1/reconciliation/runs'){if(flags.empty)v.items=[];else v.items.forEach(change);}else change(v);bytes=Buffer.from(JSON.stringify(v));}}
 if(row.status===200&&!row.control&&flags.stateRows&&path==='/v1/reconciliation/breaks'){const v=JSON.parse(bytes.toString());if(v.items[0]){const b=v.items[0];v.items=[b,{...b,breakId:'sha256:'+hash('closed-view-only'),status:'closed',closureReportHash:'sha256:'+hash('synthetic-closure-not-proof'),kind:'FeeMismatch',entity:'BTC fee',expectedJson:'9.19',actualJson:'9.42'},{...b,breakId:'sha256:'+hash('acknowledged-view-only'),status:'acknowledged',kind:'QuantityMismatch',entity:'ETH quantity',expectedJson:'0.250',actualJson:'0.249'}];}bytes=Buffer.from(JSON.stringify(v));row.source='SYNTHETIC_P22_STATUS_PRESENTATION_ONLY';}
 if(row.status===200&&!row.control&&flags.largeDecimal&&path==='/v1/ledger/entries'){const v=JSON.parse(bytes.toString());for(const e of v.items)e.amounts.cash='9007199254740993.123456789012345678';bytes=Buffer.from(JSON.stringify(v));row.source='SYNTHETIC_P22_DECIMAL_LEXEME_PROBE';}
 row.responseHash=hash(bytes);
 if(flags.drop&&method==='POST'&&path.endsWith('/reruns')&&row.status===202){flags.drop=false;row.source='REFERENCE_COMMITTED_RESPONSE_DROPPED';res.writeHead(202,{'content-type':'application/json','content-length':bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
 res.writeHead(row.status,{'content-type':path.endsWith('/stream')?'text/event-stream':'application/json','content-length':bytes.length});if(flags.slow&&path==='/v1/reconciliation/runs')setTimeout(()=>res.end(bytes),800);else res.end(bytes);
 });});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on('close',()=>upstream.destroy());upstream.end(body);
});
export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-viewer"|"session-owner"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
 const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
 return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-ui-p22-control":"1","x-ui-p22-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:Buffer.concat(parts).length?JSON.parse(Buffer.concat(parts).toString()):{}}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
}
export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
export function installReferenceHooks(){
test.beforeAll(async () => {
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-ui-p22-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async ({context,page}) => {
 page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
 rows = [];lastFrame=undefined;fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
 child = spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_REFERENCE_CONTEXT:"shadow",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
 await new Promise<void>((done,reject) => {const timer = setTimeout(() => reject(Error("reference startup timeout")),15000);child.once("error",e => {clearTimeout(timer);reject(e);});child.stdout!.on("data",b => {if (String(b).includes('"ready":true')) {clearTimeout(timer);done();}});});await page.bringToFront();
});
test.afterEach(async ({context,page},info) => {
 if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
 await writeFile(info.outputPath("ui-p22.json"),JSON.stringify({schema:"quantos-ui-p22-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"C15_RERUN_ONLY",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
 await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close",r));}
});
test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});

}
