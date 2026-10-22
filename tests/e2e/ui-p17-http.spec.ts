import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const bff = "https://bff.ui104.test", csrf = "csrf-token-0000000000000001";
let child: ChildProcess, origin: string;
const setupRows: Array<{method:string;path:string;status:number;bodySha256:string}> = [];
test.beforeAll(async () => {
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(resolve(process.cwd(), "target/debug/bff-gateway"), [], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 25000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
  async function seed(path:string, body:unknown, extra:Record<string,string>={}) {
    const response=await fetch(origin+path,{method:"POST",headers:{cookie:`quantos_session=session-current; quantos_csrf=${csrf}`,origin:"http://localhost:3190","content-type":"application/json","x-csrf-token":csrf,"x-request-id":crypto.randomUUID(),...extra},body:JSON.stringify(body)});
    const raw=await response.text(); setupRows.push({method:"POST",path,status:response.status,bodySha256:"sha256:"+createHash("sha256").update(raw).digest("hex")});expect(response.status).toBe(path==="/v1/exports"?202:200);return JSON.parse(raw);
  }
  // Create an owned unexpired in-memory export through real reference APIs. No target DB or IdP.
  const challenge=await seed("/v1/auth/mfa/challenges",{purpose:"security_change",code:"123456"});
  const grant=await seed("/v1/auth/reauth",{challengeRef:challenge.challengeRef});
  await seed("/v1/exports",{scope:{correlationIds:["aaaaaaaa-1111-4111-8111-111111111111"]},format:"jsonl",reason:"P17 offline reference browser verification",watermark:"P17 reference test",retentionDays:7},{"x-reauth-token-ref":grant.reauthTokenRef,"idempotency-key":crypto.randomUUID()});

});
test.afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
for (const scenario of ["browser", "readonly", "invalid"] as const) test(`P17 actual Rust C01/C17 policy history and lease refusal ${scenario}`, async ({page}, info) => {
 const identity = scenario === "readonly" ? "session-viewer" : scenario === "invalid" ? "invalid-session" : "session-current";
 const rows: Array<{method:string;path:string;status:number;bodySha256:string}> = [];
 await page.route(`${bff}/**`,async route=>{
  const request=route.request(), path=new URL(request.url()).pathname; expect(request.method()).toBe("GET");
  const response=await fetch(origin+path,{headers:{cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:"http://localhost:3190",accept:"application/json"}});
  const body=await response.text();rows.push({method:"GET",path,status:response.status,bodySha256:"sha256:"+createHash("sha256").update(body).digest("hex")});
  await route.fulfill({status:response.status,headers:{"access-control-allow-origin":"http://localhost:3190","access-control-allow-credentials":"true"},contentType:"application/json",body});
 });
 await page.goto("/settings/browser");
 if(scenario==="invalid"){await expect(page).toHaveURL(/\/login\?return_to=/);expect(rows.map(r=>r.path)).toEqual(["/v1/session"]);}
 else if(scenario==="readonly"){await expect(page).toHaveURL(/\/unauthorized$/);expect(rows.some(r=>r.path==="/v1/settings/downloads"&&r.status===403)).toBe(true);}
 else{await expect(page.locator("[data-ui-p17]")).toBeVisible();await expect(page.locator("body")).not.toContainText("C17 Local Mock");await expect(page.getByRole("region",{name:"最近下载记录"})).toBeVisible();
  const download=page.getByRole("button",{name:"下载",exact:true}).and(page.locator("button:not(:disabled)"));
  if(scenario==="browser"){await expect(download.first()).toBeEnabled();await download.first().click();await expect(page.locator(".toast")).toContainText("请求未完成");expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(1);await expect(page).toHaveURL(/\/settings\/browser/);}
 }
 const path=info.outputPath("reference-http.json");await writeFile(path,JSON.stringify({mode:"LOCAL_REFERENCE_SEEDED_PROVIDERS",scenario,identityFixture:identity,realIdp:"NOT_RUN",targetDatabase:"NOT_RUN",browserCookieCors:"NOT_RUN_TEST_BRIDGE",responseForwarding:"BYTE_FOR_BYTE",referenceLease:"REJECTED_UNTRUSTED_URL_NOT_DELIVERY",setupRows,rows},null,2));await info.attach("reference-http",{path,contentType:"application/json"});
});
