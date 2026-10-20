import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { beforeAll, afterAll, it, expect } from "vitest";
import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { commandClient } from "../src/command/gateway";
let child:ChildProcess, origin:string;
const csrf="csrf-token-0000000000000001";
const transport=(session="session-current"):typeof fetch=>async(input,init)=>{const r=new Request(input,init);r.headers.set("cookie",`quantos_session=${session}; quantos_csrf=${csrf}`);r.headers.set("origin","http://localhost:3190");return fetch(r);};
beforeAll(async()=>{const s=createServer();await new Promise<void>(r=>s.listen(0,"127.0.0.1",r));const port=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));origin=`http://127.0.0.1:${port}`;child=spawn(referenceBffExecutable(),[],{cwd:referenceBffRoot,env:{...referenceBffSourceEnv(),NODE_ENV:"test",PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("startup timeout")),30000);child.once("error",e=>{clearTimeout(timer);reject(e)});child.once("exit",()=>{clearTimeout(timer);reject(Error("reference exited"))});child.stdout?.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve()}})});},35000);
afterAll(async()=>{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r))}});

it("all generated API families share one owned host and retain independent facts",async()=>{
 const c=commandClient(origin,transport()),accountId="44444444-4444-4444-8444-444444444444";
 const before=await c.GET("/v1/command/summary");expect(before.response.status).toBe(200);
 const results=await Promise.all([
 c.GET("/v1/session"),c.GET("/v1/context"),c.GET("/v1/settings/profile"),c.GET("/v1/settings/downloads"),c.GET("/v1/platform/browser-capabilities"),c.GET("/v1/audit/events"),
 c.GET("/v1/research-runs"),c.GET("/v1/data-snapshots"),c.GET("/v1/markets/catalog"),c.GET("/v1/markets/watchlist"),c.GET("/v1/strategies"),c.GET("/v1/releases"),
 c.GET("/v1/portfolio",{params:{query:{accountId}}}),c.GET("/v1/risk",{params:{query:{accountId}}}),c.GET("/v1/proposals"),c.GET("/v1/approvals"),c.GET("/v1/orders",{params:{query:{accountId}}}),
 c.GET("/v1/reconciliation/runs",{params:{query:{accountId}}}),c.GET("/v1/ledger/entries",{params:{query:{accountId}}}),
 c.GET("/v1/performance/summary",{params:{query:{accountId,currency:"USD",method:"simple",period:"week",periodMode:"rolling"}}}),c.GET("/v1/operations/health"),commandClient(origin,transport("session-owner")).GET("/v1/admin/members"),c.GET("/v1/alerts")]);
 for(const [i,r] of results.entries()){expect(r.response.status).toBe(i>=17&&i<=19?403:200);if(i>=17&&i<=19)expect(r.error).toBeDefined();else expect(r.data).toBeDefined();expect(r.response.headers.get("cache-control")).toBe("no-store");}
 const after=await c.GET("/v1/command/summary");expect(after.data?.revision).toBe(before.data?.revision);
 expect(after.data?.mode).toBe("paper");
},30000);
it("current logout denies cross-family generated reads without stale data fallback",async()=>{
 const c=commandClient(origin,transport());expect((await c.GET("/v1/command/summary")).response.status).toBe(200);
 const result=await c.POST("/v1/auth/logout",{params:{header:{"X-CSRF-Token":csrf,"Origin":"http://localhost:3190","X-Request-Id":crypto.randomUUID(),"Idempotency-Key":crypto.randomUUID()}}});expect(result.response.status).toBe(204);
 for(const r of await Promise.all([c.GET("/v1/session"),c.GET("/v1/research-runs"),c.GET("/v1/strategies"),c.GET("/v1/markets/catalog"),c.GET("/v1/proposals"),c.GET("/v1/operations/health"),c.GET("/v1/command/summary"),c.GET("/v1/platform/browser-capabilities")])){expect(r.response.status).toBe(401);expect(r.data).toBeUndefined();expect(r.error).toBeDefined();}
},30000);
