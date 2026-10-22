import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const referenceBffRoot = process.cwd();
const referenceBffExecutable = () => resolve(referenceBffRoot, process.env.CARGO_TARGET_DIR ?? "target", "debug", process.platform === "win32" ? "bff-gateway.exe" : "bff-gateway");
let child: ChildProcess, origin: string;
test.beforeAll(async () => {
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 25_000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
});
test.afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
for (const identity of ["session-current", "session-owner", "session-viewer", "invalid-session"]) test(`P02 actual local Rust C01/C02/C06/C16 composition for ${identity}`, async ({ page }, info) => {
  const rows: Array<{ method: string; path: string; status: number; body: Record<string, unknown> }> = [];
  // A test identity/CORS bridge only. Payloads come unchanged from the actual
  // local Rust reference module, never a browser fixture JSON replacement.
  await page.route("http://localhost:4010/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname; expect(request.method()).toBe("GET");
    const response = await fetch(origin + path + new URL(request.url()).search, { headers: { cookie: `quantos_session=${identity}`, accept: "application/json" } });
    const body = await response.text(); rows.push({ method: request.method(), path, status: response.status, body: JSON.parse(body) });
    await route.fulfill({ status: response.status, headers: { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" }, contentType: "application/json", body });
  });
  await page.goto("/command");
  if (identity === "invalid-session") { await expect(page).toHaveURL(/\/login$/); expect(rows.map(r => r.path)).toEqual(["/v1/session"]); }
  else if (identity === "session-viewer") { await expect(page).toHaveURL(/\/unauthorized$/); expect(rows.map(r => r.path)).toEqual(["/v1/session", "/v1/context"]); }
  else {
    await expect(page.locator('[data-ui-p02][data-contract-mode="integrated"]')).toBeVisible(); expect(rows.map(r => r.path)).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]);
    const context = rows[1].body, summary = rows[2].body; expect(summary.accountId).toBe(context.accountId); expect(summary.mode).toBe(context.mode);
    const caps = context.capabilities as string[];
    if (!caps.includes("research.read")) await expect(page.getByRole("heading", { name: "运行任务" })).toHaveCount(0);
    await expect(page.getByText(/C02 Runtime Guard Mocked/)).toHaveCount(0); await expect(page.locator(".terminal-statusbar")).toContainText("HTTP 快照");
  }
  const path = info.outputPath("reference-http.json"); await writeFile(path, JSON.stringify({ mode: "LOCAL_REFERENCE_SEEDED_PROVIDERS", identityFixture: identity, realIdp: "NOT_RUN", browserCookieCors: "NOT_RUN_TEST_BRIDGE", rows }, null, 2)); await info.attach("reference-http", { path, contentType: "application/json" });
});
