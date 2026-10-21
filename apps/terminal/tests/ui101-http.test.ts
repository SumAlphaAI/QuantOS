import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { createCommandBffSource } from "../src/command/source";
import { loadGuardedCommand } from "../src/command/runtime";
let child: ChildProcess, origin: string;
beforeAll(async () => {
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 30_000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
}, 35_000);
afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
it.each(["session-current", "session-owner", "session-viewer", "invalid-session"])("actual Rust C01/context/C02 composition for %s", async session => {
  const paths: string[] = [];
  const transport: typeof fetch = async (input, init) => { const request = new Request(input, init); request.headers.set("cookie", `quantos_session=${session}`); paths.push(new URL(request.url).pathname); return fetch(request); };
  const r = await loadGuardedCommand(createCommandBffSource(origin, transport));
  if (session === "invalid-session") { expect(r.decision.destination).toBe("/login"); expect(paths).toEqual(["/v1/session"]); }
  else if (session === "session-viewer") { expect(r.decision.stoppedAt).toBe("rbac_capability"); expect(paths).toEqual(["/v1/session", "/v1/context"]); }
  else { expect(r.decision.allowed).toBe(true); expect(paths).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]); expect(r.projection?.summary?.sources).toHaveLength(4); expect(r.projection?.session.capabilities).toContain("ops.read"); }
  console.log("UI101_LOOPBACK", session, r.decision.allowed, paths.join(","));
});
