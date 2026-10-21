import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { createSettingsRuntime } from "../src/settings/runtime";
let child: ChildProcess, origin: string;
beforeAll(async () => {
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 30_000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
}, 35_000);
afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
function actor(session = "session-current") {
  const transport: typeof fetch = async (input, init) => { const request = new Request(input, init); request.headers.set("cookie", `quantos_session=${session}; quantos_csrf=csrf-token-0000000000000001`); request.headers.set("origin", "http://localhost:3190"); return fetch(request); };
  return createSettingsRuntime({ mock: false, origin, section: session === "session-viewer" ? "profile" : undefined, fetchImpl: transport, runtime: () => ({ online: true, width: 1440, csrf: "csrf-token-0000000000000001" }) });
}
it("actual Rust C17 save, conflict, explicit rebase, MFA/reauth revoke and authoritative reload", async () => {
  const a = actor(); const s = await a.load(); const saved = await a.saveProfile({ ...s.bundle.profile, displayName: "UI104 local proof" }); expect(saved.displayName).toBe("UI104 local proof");
  const draft = { ...s.bundle.profile, displayName: "Conflict draft" }; await expect(a.saveProfile(draft)).rejects.toMatchObject({ status: 409 }); const rebased = await a.refreshProfile(draft); expect(rebased.displayName).toBe("Conflict draft"); expect((await a.saveProfile(rebased)).displayName).toBe("Conflict draft");
  const target = s.bundle.sessions!.find(row => !row.current)!; const response = await a.revoke("session", target.sessionId, `REVOKE ${target.sessionId}`, "123456"); expect(response.status).toBe("accepted"); expect(s.bundle.sessions!.some(row => row.sessionId === target.sessionId)).toBe(true);
  expect((await a.load()).bundle.sessions!.some(row => row.sessionId === target.sessionId)).toBe(false);
  console.log("UI104_LOOPBACK C17 save/CAS/rebase/security_change/reauth/delete/readback PASS"); a.close();
});
it("actual read-only session cannot write and an invalid session cannot read private settings", async () => {
  const viewer = actor("session-viewer"); const s = await viewer.load(); await expect(viewer.saveProfile(s.bundle.profile)).rejects.toMatchObject({ status: 403 }); viewer.close();
  const invalid = actor("invalid-session"); await expect(invalid.load()).rejects.toMatchObject({ status: 401 }); invalid.close();
});
