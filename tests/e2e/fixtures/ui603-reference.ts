// Actual C01/C16 reference BFF bytes through a loopback TLS/CORS and identity substitute.
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
const streams=new Set<ServerResponse>();
export const networkRows=()=>rows;
export function fault(next:typeof flags){flags=next;}
const proxy=createServer({},async(req,res)=>{
 const u=new URL(req.url!,origin),path=u.pathname,method=req.method!;
 for(const[k,v]of Object.entries({'access-control-allow-origin':terminal,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,x-csrf-token,x-request-id,idempotency-key,if-match','access-control-allow-methods':'GET,POST,PUT,OPTIONS','cache-control':'no-store','access-control-expose-headers':'x-stream-id'}))res.setHeader(k,v);
 if(method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
 const row:Row={query:Object.fromEntries([...u.searchParams].map(([k,v])=>[k,k==='ticket'?'sha256:'+hash(v):v])),method,path,status:0,source:'REFERENCE_BYTES',control:Boolean(req.headers['x-ui603-control']),bodyHash:hash(body),version:req.headers['if-match']as string|undefined,keyHash:req.headers['idempotency-key']?hash(String(req.headers['idempotency-key'])):undefined};rows.push(row);
 const upstream=request({host:'127.0.0.1',port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control?String(req.headers['x-ui603-session']):flags.readonly?'session-approver':'session-current'}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
 row.status=response.statusCode!;
 if(path==='/v1/settings/sessions/stream'){res.writeHead(row.status,{'content-type':'text/event-stream'});res.flushHeaders();streams.add(res);response.pipe(res);res.on('close',()=>{streams.delete(res);response.destroy();});return;}
 const output:Buffer[]=[];response.on('data',b=>output.push(Buffer.from(b)));response.on('end',()=>{let bytes=Buffer.concat(output);
 if(row.status===200&&!row.control&&flags.foreign&&path==='/v1/alerts'){const v=JSON.parse(bytes.toString());v.items[0].accountId='aaaaaaaa-1111-4111-8111-111111111111';bytes=Buffer.from(JSON.stringify(v));row.source='SYNTHETIC_FOREIGN_ACCOUNT';}
 row.responseHash=hash(bytes);
 if(flags.drop&&method==='POST'&&/\/(ack|unack)$/.test(path)&&row.status===200){flags.drop=false;row.source='REFERENCE_COMMITTED_RESPONSE_DROPPED';res.writeHead(200,{'content-type':'application/json','content-length':bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
 res.writeHead(row.status,{'content-type':path.endsWith('/stream')?'text/event-stream':'application/json','content-length':bytes.length,...(response.headers['x-stream-id']?{'x-stream-id':response.headers['x-stream-id']}:{})});res.end(bytes);
 });});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on('close',()=>upstream.destroy());upstream.end(body);
});
export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-viewer"|"session-owner"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
 const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
 return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-ui603-control":"1","x-ui603-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:Buffer.concat(parts).length?JSON.parse(Buffer.concat(parts).toString()):{}}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
}
export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
export function installReferenceHooks(){
test.beforeAll(async () => {
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-ui603-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async ({context,page}) => {
 page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
 rows = [];fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
 child = spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
 await new Promise<void>((done,reject) => {const timer = setTimeout(() => reject(Error("reference startup timeout")),15000);child.once("error",e => {clearTimeout(timer);reject(e);});child.stdout!.on("data",b => {if (String(b).includes('"ready":true')) {clearTimeout(timer);done();}});});await page.bringToFront();
});
test.afterEach(async ({context,page},info) => {
 if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
 await writeFile(info.outputPath("ui603.json"),JSON.stringify({schema:"quantos-ui603-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"C16_ACK_UNACK_SUBSCRIPTIONS_WITH_F06_STEPUP",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
 await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close",r));}
});
test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});

}
