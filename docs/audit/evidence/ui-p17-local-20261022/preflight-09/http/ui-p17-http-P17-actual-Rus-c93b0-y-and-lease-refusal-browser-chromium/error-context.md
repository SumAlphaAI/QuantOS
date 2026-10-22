# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p17-http.spec.ts >> P17 actual Rust C01/C17 policy history and lease refusal browser
- Location: tests/e2e/ui-p17-http.spec.ts:15:73

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { spawn, type ChildProcess } from "node:child_process";
  3  | import { createServer } from "node:net";
  4  | import { writeFile } from "node:fs/promises";
  5  | import { resolve } from "node:path";
  6  | import { createHash } from "node:crypto";
  7  | const bff = "https://bff.ui104.test", csrf = "csrf-token-0000000000000001";
  8  | let child: ChildProcess, origin: string;
  9  | test.beforeAll(async () => {
  10 |   const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  11 |   child = spawn(resolve(process.cwd(), "target/debug/bff-gateway"), [], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  12 |   await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 25000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
  13 | });
  14 | test.afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
  15 | for (const scenario of ["browser", "readonly", "invalid"] as const) test(`P17 actual Rust C01/C17 policy history and lease refusal ${scenario}`, async ({page}, info) => {
  16 |  const identity = scenario === "readonly" ? "session-viewer" : scenario === "invalid" ? "invalid-session" : "session-current";
  17 |  const rows: Array<{method:string;path:string;status:number;bodySha256:string}> = [];
  18 |  await page.route(`${bff}/**`,async route=>{
  19 |   const request=route.request(), path=new URL(request.url()).pathname; expect(request.method()).toBe("GET");
  20 |   const response=await fetch(origin+path,{headers:{cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:"http://localhost:3190",accept:"application/json"}});
  21 |   const body=await response.text();rows.push({method:"GET",path,status:response.status,bodySha256:"sha256:"+createHash("sha256").update(body).digest("hex")});
  22 |   await route.fulfill({status:response.status,headers:{"access-control-allow-origin":"http://localhost:3190","access-control-allow-credentials":"true"},contentType:"application/json",body});
  23 |  });
  24 |  await page.goto("/settings/browser");
  25 |  if(scenario==="invalid"){await expect(page).toHaveURL(/\/login\?return_to=/);expect(rows.map(r=>r.path)).toEqual(["/v1/session"]);}
  26 |  else{await expect(page.locator("[data-ui-p17]")).toBeVisible();await expect(page.locator("body")).not.toContainText("C17 Local Mock");await expect(page.getByRole("region",{name:"最近下载记录"})).toBeVisible();
  27 |   const download=page.getByRole("button",{name:"下载",exact:true}).and(page.locator("button:not(:disabled)"));
> 28 |   if(scenario==="browser"){expect(await download.count()).toBeGreaterThan(0);await download.first().click();await expect(page.locator(".toast")).toContainText("请求未完成");expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(1);await expect(page).toHaveURL(/\/settings\/browser/);}
     |                                                           ^ Error: expect(received).toBeGreaterThan(expected)
  29 |  }
  30 |  const path=info.outputPath("reference-http.json");await writeFile(path,JSON.stringify({mode:"LOCAL_REFERENCE_SEEDED_PROVIDERS",scenario,identityFixture:identity,realIdp:"NOT_RUN",targetDatabase:"NOT_RUN",browserCookieCors:"NOT_RUN_TEST_BRIDGE",responseForwarding:"BYTE_FOR_BYTE",referenceLease:"REJECTED_UNTRUSTED_URL_NOT_DELIVERY",rows},null,2));await info.attach("reference-http",{path,contentType:"application/json"});
  31 | });
  32 | 
```