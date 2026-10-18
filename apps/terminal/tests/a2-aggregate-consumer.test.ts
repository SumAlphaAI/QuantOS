import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { consumeSse, SseStreamReducer } from "@sumalpha/api-client";
import { completeLoginMfa, completeRecentAuth } from "../src/auth/bff";
import { loadSettingsBundle, saveProfileSettings, revokeTrustedDevice, revokeSettingsSession } from "../src/settings/gateway";

import { createControlledExport, loadExportStatus, getControlledExportDownload, loadEvidenceChain } from "../src/audit/gateway";

let child: ChildProcess, origin: string;
const csrf = "csrf-token-0000000000000001";
const requests: string[] = [];
const transport: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  request.headers.set("cookie", `quantos_session=session-current; quantos_csrf=${csrf}`);
  request.headers.set("origin", "http://localhost:3190");
  requests.push(request.url);
  return fetch(request);
};
beforeAll(async () => {
  const reserve = createServer();
  await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(resolve(process.cwd(), "target/debug/bff-gateway"), [], { env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("reference startup timeout")), 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(Error("reference startup exit")); });
    child.stdout?.on("data", chunk => { if (String(chunk).includes('"ready":true')) { clearTimeout(timer); resolve(); } });
  });
}, 15000);
afterAll(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });

it("joins identity and audit consumers in one session: causal export evidence and terminal revocation across both surfaces", async () => {
  const bundle = await loadSettingsBundle(origin, transport);
  const { objectVersion, locale, timezone, theme, numberFormat, timeDisplay, defaultRoute, density, highContrast, reducedMotion } = bundle.profile;
  const input = { displayName: "A2 consumer", locale, timezone, theme, numberFormat, timeDisplay, defaultRoute, density, highContrast, reducedMotion };
  const key = crypto.randomUUID();
  const saved = await saveProfileSettings(origin, input, objectVersion, key, csrf, transport);
  expect(await saveProfileSettings(origin, input, objectVersion, key, csrf, transport)).toEqual(saved);
  await expect(saveProfileSettings(origin, { ...input, displayName: "changed" }, saved.objectVersion, key, csrf, transport)).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
  await expect(saveProfileSettings(origin, input, objectVersion, crypto.randomUUID(), csrf, transport)).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT", currentVersion: saved.objectVersion });
  expect((await loadSettingsBundle(origin, transport)).profile).toEqual(saved);
  const challenge = await completeLoginMfa(origin, "123456", csrf, transport);
  const grant = await completeRecentAuth(origin, challenge.challengeRef, csrf, transport);
  const revoked = await revokeTrustedDevice(origin, "device-remote", grant.reauthTokenRef, crypto.randomUUID(), csrf, transport);
  expect(revoked.status).toBe("accepted");
  await revokeSettingsSession(origin, "session-remote", grant.reauthTokenRef, crypto.randomUUID(), csrf, transport);
  const exportBody = { scope: { correlationIds: ["aaaaaaaa-1111-4111-8111-111111111111"] }, format: "jsonl" as const, reason: "A2 combined functional boundary", watermark: "QuantOS controlled copy", retentionDays: 7 };
  const exportKey = crypto.randomUUID();
  const job = await createControlledExport(origin, exportBody, exportKey, csrf, grant.reauthTokenRef, transport);
  expect(await createControlledExport(origin, exportBody, exportKey, csrf, grant.reauthTokenRef, transport)).toEqual(job);
  expect((await loadExportStatus(origin, job.exportId, transport)).status).toBe("ready");
  expect((await getControlledExportDownload(origin, job.exportId, transport)).watermarked).toBe(true);
  const chain = await loadEvidenceChain(origin, job.correlationId, {}, transport);
  expect(chain.items[0]?.eventId).toBe(job.auditRef);
  expect(chain.items.every(event => event.correlationId === job.correlationId)).toBe(true);
  const reducer = new SseStreamReducer();
  const controller = new AbortController();
  let dropped = false;
  const interruptedTransport: typeof fetch = async (input, init) => {
    const response = await transport(input, init);
    if (!dropped) {
      dropped = true;
      // Simulate a disconnected response before any queued event is acknowledged.
      await response.body?.cancel();
      return new Response("", { headers: { "content-type": "text/event-stream" } });
    }
    return response;
  };
  const stream = consumeSse({ url: origin + "/v1/settings/sessions/stream", reducer, fetchImpl: interruptedTransport, signal: controller.signal, retryDelayMs: 0 });
  expect((await stream.next()).value).toMatchObject({ type: "apply", event: { sequence: 1 } });
  expect(requests.filter(url => url.includes("afterSequence=0"))).toHaveLength(2);
  controller.abort();
  await stream.return(undefined);
  const resumed = consumeSse({ url: origin + "/v1/settings/sessions/stream", reducer, fetchImpl: transport, retryDelayMs: 0 });
  const logout = await transport(origin + "/v1/auth/logout", { method: "POST", headers: { "x-csrf-token": csrf } });
  expect(logout.status).toBe(204);
  expect((await resumed.next()).value).toEqual({ type: "closed", reason: "permission_revoked" });
  expect((await resumed.next()).done).toBe(true);
  expect(requests.some(url => url.includes("afterSequence=1"))).toBe(true);
  await expect(loadSettingsBundle(origin, transport)).rejects.toMatchObject({ status: 401 });
  await expect(loadExportStatus(origin, job.exportId, transport)).rejects.toMatchObject({ status: 401 });
  await expect(getControlledExportDownload(origin, job.exportId, transport)).rejects.toMatchObject({ status: 401 });
  await expect(loadEvidenceChain(origin, job.correlationId, {}, transport)).rejects.toMatchObject({ status: 401 });
}, 15000);
