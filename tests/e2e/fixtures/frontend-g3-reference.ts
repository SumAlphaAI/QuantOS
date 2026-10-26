// Actual C05 reference BFF bytes through a loopback TLS/CORS and identity substitute.
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
type Row = {method: string;path: string;status: number;source: string;control: boolean;keyHash?: string;bodyHash: string;version?: string;responseHash?: string};
let registrations: Record<string, unknown>[]=[];
export function workerRegistrations(){return registrations;}
let controlOrigin="",hostLogs="",clockControls:{seconds:number;status:number}[]=[];
let rows: Row[] = [], child: ChildProcess, port: number, scratch: string, drop = false, readonly = false, invalid = false, empty = false, listError = false, slow = false;
const streams = new Set<ServerResponse>();
const proxy = createServer({},async (req,res) => {
 const path = new URL(req.url!,origin).pathname, method = req.method!;
 for (const [k,v] of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match","access-control-allow-methods":"GET,PUT,POST,OPTIONS","cache-control":"no-store"})) res.setHeader(k,v);
 if (method === "OPTIONS") {res.writeHead(204);res.end();return;}
 const chunks: Buffer[] = [];for await (const b of req) chunks.push(Buffer.from(b));const body = Buffer.concat(chunks);
 const row: Row = {method,path,status:0,source:"REFERENCE_BYTES",control:Boolean(req.headers["x-ui301-control"]),bodyHash:hash(body),version:req.headers["if-match"] as string | undefined,keyHash:req.headers["idempotency-key"] ? hash(String(req.headers["idempotency-key"])) : undefined};rows.push(row);
 if(method==="GET"&&path==="/v1/strategies"&&(empty||listError)){row.status=listError?503:200;row.source=listError?"SYNTHETIC_CATALOG_FAILURE":"SYNTHETIC_EMPTY_CATALOG";res.writeHead(row.status,{"content-type":"application/json"});res.end(JSON.stringify(listError?{code:"UNAVAILABLE",message:"private SQL",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}:{items:[]}));return;}

 if (invalid && method === "PUT") {row.status = 422;row.source = "SYNTHETIC_VALIDATION_REJECTION";res.writeHead(422,{"content-type":"application/json"});res.end(JSON.stringify({code:"INVALID_REQUEST",message:"private SQL must not display",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}));return;}
  const upstream = request({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control&&req.headers["x-ui301-session"]==="session-approver"||readonly ? "session-approver" : "session-current"}; quantos_csrf=${csrf}`,origin:terminal}},response => {
  row.status = response.statusCode!;
  if (path.endsWith("/stream")) {res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",() => {streams.delete(res);response.destroy();});return;}
  const output: Buffer[] = [];response.on("data",b => output.push(Buffer.from(b)));response.on("end",() => {
   const bytes = Buffer.concat(output);
   row.responseHash = hash(bytes);
   if (drop && (method === "PUT" && row.status === 200 || method === "POST" && [201,202].includes(row.status))) {drop = false;row.source = "REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(() => res.destroy(),20);return;}
   res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length});if(slow&&path==="/v1/session")setTimeout(()=>res.end(bytes),800);else res.end(bytes);
  });
 });upstream.on("error",() => {if (!res.headersSent) res.writeHead(502);res.end();});res.on("close",() => upstream.destroy());upstream.end(body);
});
export const networkRows = () => rows;
export function fault(options: {drop?: boolean;readonly?: boolean;invalid?: boolean;empty?:boolean;listError?:boolean;slow?:boolean}) {drop = options.drop ?? false;readonly = options.readonly ?? false;invalid = options.invalid ?? false;empty=options.empty??false;listError=options.listError??false;slow=options.slow??false;}
export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
 const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
 return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-ui301-control":"1","x-ui301-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
}
export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
export async function openLab(page: Page,raw=true) {await page.goto("/strategies");await authorized(page);const link = page.getByRole("link",{name:/^打开 Lab/}).first();await expect(link).toBeVisible();const href = (await link.getAttribute("href"))!;await link.click();await authorized(page);if(raw)await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel(raw?"文件 JSON":"文件内容",{exact:true})).toBeVisible();await expect(page.getByRole("status").filter({hasText:"已保存 · objectVersion："})).toBeVisible();return href;}
export function installReferenceHooks(){
test.beforeAll(async () => {
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-ui301-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async ({context,page}) => {
 page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
 rows = [];registrations=[];hostLogs="";clockControls=[];fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
 const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
 child = spawn(JSON.parse(await readFile(process.env.QUANTOS_G3_HOST_RECEIPT!,"utf8")).executable,["strategy::frontend_g3::browser_host","--exact","--ignored","--nocapture"],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_G3_BROWSER_HOST:"1",QUANTOS_G3_R03:process.env.QUANTOS_G3_R03,QUANTOS_G3_ARTIFACTS:process.env.QUANTOS_G3_ARTIFACTS,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
 await new Promise<void>((done,reject)=>{let buffer="";const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.once("exit",code=>{clearTimeout(timer);reject(Error(`reference exited ${code}: ${hostLogs.slice(-2000)}`));});child.stderr!.on("data",b=>{hostLogs+=String(b);});child.stdout!.on("data",b=>{hostLogs+=String(b);buffer+=String(b);let i;while((i=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let status;try{status=JSON.parse(line);}catch{continue;}if(status.ready){registrations=status.registrations??[];controlOrigin=status.control;clearTimeout(timer);done();}}});});await page.bringToFront();
});
test.afterEach(async ({context,page},info) => {
 if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
 await writeFile(info.outputPath("ui301.json"),JSON.stringify({schema:"quantos-ui301-browser/v1",scenario:info.title,ownedClockControls:clockControls,artifactDocuments:process.env.QUANTOS_G3_ARTIFACTS,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile(JSON.parse(await readFile(process.env.QUANTOS_G3_HOST_RECEIPT!,"utf8")).executable)),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"LOCAL_REFERENCE_C05_DRAFT_STATIC_BACKTEST_RELEASE_SUBMISSION_WITH_C08_TEST_CONTROL",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
 await writeFile(info.outputPath("g3-host.log"),hostLogs);await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close",r));}
});
test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});

}

export async function advance(seconds:number){const r=await fetch(controlOrigin+"/advance",{method:"POST",headers:{"content-type":"application/json","x-g3-owned-control":"1"},body:JSON.stringify({seconds})});clockControls.push({seconds,status:r.status});expect(r.status).toBe(204);}
export async function decide(approvalId:string,decision:"approve"|"reject"|"request_info"="approve",copies=1,reason="Owned strategy review reason"){const opts={method:"POST" as const,session:"session-approver" as const},mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts);expect(mfa.status).toBe(200);const step=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,opts);expect(step.status).toBe(200);return Promise.all(Array.from({length:copies},()=>control(`/v1/approvals/${approvalId}/decisions`,{decision,...(decision!=="approve"?{reason}:{}),mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:step.body.reauthTokenRef},'0',opts)));}
