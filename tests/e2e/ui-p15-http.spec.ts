import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const bff = "https://bff.ui104.test", csrf = "csrf-token-0000000000000001";
let child: ChildProcess, origin: string;
test.beforeAll(async () => {
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(resolve(process.cwd(), "target/debug/bff-gateway"), [], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 25000); child.once("error", e => { clearTimeout(timer); reject(e); }); child.stdout?.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); resolve(); } }); });
});
test.afterAll(async () => { if (child?.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });
for (const scenario of ["profile", "notifications", "security", "readonly", "invalid", "missing-csrf"] as const) test(`P15 actual Rust C01/C17 browser composition ${scenario}`, async ({ page }, info) => {
  const identity = scenario === "readonly" ? "session-viewer" : scenario === "invalid" ? "invalid-session" : "session-current";
  const rows: Array<{ method: string; path: string; status: number; body?: Record<string, unknown>; bodySha256: string }> = [];
  if (scenario !== "missing-csrf") await page.context().addCookies([{ name: "quantos_csrf", value: csrf, url: "http://localhost:3190" }]);
  await page.route(`${bff}/**`, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // Test identity/CORS bridge; all response bodies forwarded byte-for-byte.
    // This bypass is explicitly NOT real browser Cookie/CORS or IdP acceptance.
    const headers = new Headers({ cookie: `quantos_session=${identity}; quantos_csrf=${csrf}`, origin: "http://localhost:3190", accept: "application/json" });
    for (const name of ["content-type", "if-match", "idempotency-key", "x-csrf-token", "x-request-id", "x-reauth-token-ref"]) if (request.headers()[name]) headers.set(name, request.headers()[name]);
    const response = await fetch(origin + path, { method: request.method(), headers, body: request.postData() ?? undefined });
    const body = await response.text(); rows.push({ method: request.method(), path, status: response.status, body: request.method() === "GET" || request.method() === "PUT" ? JSON.parse(body) : undefined, bodySha256: "sha256:" + createHash("sha256").update(body).digest("hex") });
    await route.fulfill({ status: response.status, headers: { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" }, contentType: "application/json", body });
  });
  const section = scenario === "security" || scenario === "notifications" ? scenario : "profile";
  await page.goto(`/settings/${section}`);
  if (scenario === "invalid") { await expect(page).toHaveURL(/\/login\?return_to=/); expect(rows.map(r => r.path)).toEqual(["/v1/session"]); }
  else {
    await expect(page.locator(`[data-ui-p15="${section}"]`)).toBeVisible(); await expect(page.locator("body")).not.toContainText("C17 Local Mock");
    if (scenario === "profile") { await page.getByLabel("显示名称", { exact: true }).fill("P15 reference member"); await page.getByLabel("时间显示", { exact: true }).selectOption("local"); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.locator(".toast")).toContainText("个人资料已保存"); await page.reload(); await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("P15 reference member"); await expect(page.getByLabel("时间显示", { exact: true })).toHaveValue("local"); }
    else if (scenario === "notifications") { await page.getByLabel("静默开始时间").fill("21:30"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); await page.reload(); await expect(page.getByLabel("静默开始时间")).toHaveValue("21:30"); }
    else if (scenario === "security") {
      for (const [button, resource, property] of [["撤销会话", "/v1/settings/sessions", "sessionId"], ["撤销信任", "/v1/settings/trusted-devices", "deviceId"], ["撤销 MFA 因素", "/v1/settings/security", "factorId"]]) {
        const body = rows.find(r => r.path === resource)!.body; const collection = resource.endsWith("security") ? (body as unknown as { factors: Array<Record<string, unknown>> }).factors : body as unknown as Array<Record<string, unknown>>; const target = collection.find(x => !x.current && !x.currentDevice)!;
        await page.getByRole("button", { name: button, exact: true }).and(page.locator("button:not(:disabled)")).first().click(); await confirm(page, `REVOKE ${target[property]}`); await page.getByRole("button", { name: button === "撤销会话" ? "确认撤销会话" : button === "撤销信任" ? "确认撤销信任" : "确认撤销 MFA 因素", exact: true }).click(); await expect(page.locator(".toast")).toContainText("已受理");
      }
      await page.getByRole("button", { name: "重新验证身份", exact: true }).click(); await confirm(page, "VERIFY SECURITY"); await page.getByRole("button", { name: "确认重新验证", exact: true }).click(); await expect(page.locator(".toast")).toContainText("近期身份验证已完成");
      expect(rows.filter(r => r.method === "DELETE")).toHaveLength(3); expect(rows.filter(r => r.method === "DELETE").every(r => r.status === 202)).toBe(true);
      await page.getByRole("button", { name: "重新验证并保留草稿" }).click(); await expect(page.getByRole("button", { name: "撤销信任", exact: true })).toHaveCount(0);
    } else if (scenario === "readonly") { await expect(page.getByRole("button", { name: "保存个人资料" })).toBeDisabled(); expect(rows.every(r => r.method === "GET")).toBe(true); }
    else { await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page).toHaveURL(/\/unauthorized$/); expect(rows.every(r => r.method === "GET")).toBe(true); }
  }
  const path = info.outputPath("reference-http.json"); await writeFile(path, JSON.stringify({ mode: "LOCAL_REFERENCE_SEEDED_PROVIDERS", scenario, identityFixture: identity, realIdp: "NOT_RUN", targetDatabase: "NOT_RUN", browserCookieCors: "NOT_RUN_TEST_BRIDGE", sensitiveResponseCapture: "HASH_ONLY_SECURITY_RESPONSES_BROWSER_BYTES_UNCHANGED", rows }, null, 2)); await info.attach("reference-http", { path, contentType: "application/json" });
});
async function confirm(page: Page, phrase: string) { await page.getByLabel(new RegExp(`输入“${phrase}”`)).fill(phrase); await page.getByLabel("MFA 验证码").fill("123456"); }
