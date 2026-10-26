// U01 actual reference C03/C04 bytes plus R03/RD-Agent; explicit identity/TLS/CORS substitutions.
import {test,expect,type Page} from "@playwright/test";
import {spawn,execFileSync,type ChildProcess} from "node:child_process";
import {createServer as reserveServer} from "node:net";
import {createServer,request as secureRequest} from "node:https";
import {request,type ServerResponse} from "node:http";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
const origin = "https://127.0.0.1:4010", terminal = "http://localhost:3190", csrf = "csrf-token-0000000000000001";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
type Row = {method: string;path: string;status: number;source: string;control: boolean;keyHash?: string;bodyHash: string;version?: string;responseHash?: string;mfaStatus?: string};
let snapshot="";
export function snapshotId(){return snapshot;}
let controlOrigin="",hostLogs="";
let rows: Row[] = [], child: ChildProcess, port: number, scratch: string, readonly = false;
const streams = new Set<ServerResponse>();
const proxy = createServer({},async (req,res) => {
 const path = new URL(req.url!,origin).pathname, method = req.method!;
 for (const [k,v] of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match","access-control-allow-methods":"GET,PUT,POST,OPTIONS","cache-control":"no-store"})) res.setHeader(k,v);
 if (method === "OPTIONS") {res.writeHead(204);res.end();return;}
 const chunks: Buffer[] = [];for await (const b of req) chunks.push(Buffer.from(b));const body = Buffer.concat(chunks);
 const row: Row = {method,path,status:0,source:"REFERENCE_BYTES",control:Boolean(req.headers["x-u01-control"]),bodyHash:hash(body),version:req.headers["if-match"] as string | undefined,keyHash:req.headers["idempotency-key"] ? hash(String(req.headers["idempotency-key"])) : undefined};rows.push(row);
  const upstream = request({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control&&req.headers["x-u01-session"]==="session-approver"||readonly ? "session-approver" : "session-current"}; quantos_csrf=${csrf}`,origin:terminal}},response => {
  row.status = response.statusCode!;
  if (path.endsWith("/stream")) {res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",() => {streams.delete(res);response.destroy();});return;}
  const output: Buffer[] = [];response.on("data",b => output.push(Buffer.from(b)));response.on("end",() => {
   const bytes = Buffer.concat(output);
   row.responseHash = hash(bytes);
   if(path==="/v1/auth/mfa/challenges"&&row.status===200)row.mfaStatus=JSON.parse(bytes.toString()).status;
   res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length});res.end(bytes);
  });
 });upstream.on("error",() => {if (!res.headersSent) res.writeHead(502);res.end();});res.on("close",() => upstream.destroy());upstream.end(body);
});
export const networkRows = () => rows;
export function fault(options:{readonly?:boolean}){readonly=options.readonly??false;}
export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
 const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
 return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-u01-control":"1","x-u01-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:Buffer.concat(parts).length?JSON.parse(Buffer.concat(parts).toString()):{}}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
}
export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
export function installReferenceHooks(options:{workflowForTest?:(title:string)=>string|undefined;r1?:boolean;recoverForTest?:(title:string)=>boolean}={}){
test.beforeAll(async () => {
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-u01-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async ({context,page},info) => {
 page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
 rows = [];snapshot="";hostLogs="";fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
 child = spawn(JSON.parse(await readFile(process.env.QUANTOS_U01_HOST_RECEIPT!,"utf8")).executable,["u01::browser_host","--exact","--ignored","--nocapture"],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_U01_HOST:"1",...(options.workflowForTest?.(info.title)?{QUANTOS_TP01_FIXTURE:options.workflowForTest(info.title)}:{}),...(options.r1?{QUANTOS_R1_CHAIN:"1"}:{}),...(options.recoverForTest?.(info.title)?{QUANTOS_R1_RECOVERY:"1"}:{}),QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},detached:true,stdio:["ignore","pipe","pipe"]});
 await new Promise<void>((done,reject)=>{let buffer="";const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.once("exit",code=>{clearTimeout(timer);reject(Error(`reference exited ${code}: ${hostLogs.slice(-2000)}`));});child.stderr!.on("data",b=>{hostLogs+=String(b);});child.stdout!.on("data",b=>{hostLogs+=String(b);buffer+=String(b);let i;while((i=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let status;try{status=JSON.parse(line);}catch{continue;}if(status.ready){snapshot=status.snapshotId;controlOrigin=status.control;clearTimeout(timer);done();}}});});await page.bringToFront();
});
test.afterEach(async ({context,page},info) => {
 if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
 await writeFile(info.outputPath("u01-network.json"),JSON.stringify({schema:"quantos-u01-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile(JSON.parse(await readFile(process.env.QUANTOS_U01_HOST_RECEIPT!,"utf8")).executable)),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"REFERENCE_C03_INTENT_TO_ACTUAL_R03_RD_AGENT_OWNED_MEMORY",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
 await writeFile(info.outputPath("u01-host.log"),hostLogs);await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {process.kill(-child.pid!,"SIGTERM");await new Promise(r => child.once("close",r));}
});
test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});

}

export async function executeWorker(){const r=await fetch(controlOrigin+"/execute",{method:"POST",headers:{"x-u01-owned-control":"1"}});expect(r.status).toBe(200);return await r.json();}
