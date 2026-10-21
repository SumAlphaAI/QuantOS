import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "../../terminal/tests/helpers/reference-bff";
import { createAccessSubmission } from "../src/access-request";
let child: ChildProcess, origin: string;
beforeAll(async () => {
  const s = createServer(); await new Promise<void>(r => s.listen(0, "127.0.0.1", r)); const port = (s.address() as { port: number }).port; await new Promise<void>(r => s.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 30000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
}, 35000);
afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
const draft = { teamName: "Research team", contactEmail: "web101@example.invalid", purpose: "Research and controlled paper workflow verification only.", market: "futures", consent: true, website: "", expectedMode: "research" };
const transport = (trusted = true): typeof fetch => async (input, init) => { const r = new Request(input, init); r.headers.set("origin", trusted ? "http://localhost:3190" : "https://untrusted.invalid"); return fetch(r); };
it.each(["research", "paper", "shadow"])("actual Rust anonymous %s request produces audited 202", async expectedMode => { const a = createAccessSubmission({ origin, siteOrigin: "http://localhost:3196", online: () => true, fetchImpl: transport() }); expect(await a.submit({ ...draft, expectedMode })).toMatchObject({ auditRef: expect.stringMatching(/^[a-f0-9-]{36}$/), jobId: expect.any(String), correlationId: expect.any(String) }); a.close(); });
it("actual reference refuses untrusted origins and public assisted-live requests", async () => { const a = createAccessSubmission({ origin, siteOrigin: "http://localhost:3196", online: () => true, fetchImpl: transport(false) }); await expect(a.submit(draft)).rejects.toMatchObject({ status: 403 }); a.close(); const r = await fetch(origin + "/v1/access-requests", { method: "POST", headers: { origin: "http://localhost:3190", "content-type": "application/json" }, body: JSON.stringify({ teamName: draft.teamName, contactEmail: draft.contactEmail, purpose: draft.purpose, markets: ["futures"], expectedMode: "assisted_live", privacyNoticeVersion: "2026-08-15" }) }); expect(r.status).toBe(422); });
