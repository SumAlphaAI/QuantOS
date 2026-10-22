import { describe, expect, it } from "vitest";
import { BffTransportError } from "@sumalpha/api-client";
import { AuthBffError } from "../src/auth/bff";
import { sanitizeReturnPath } from "../src/auth/flow";
import { accessPayload, createIdentityAction, requestAccess } from "../src/identity/action";

const data = () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ teamName: " Research ", contactEmail: "work@example.com", purpose: "Paper research with controlled strategies and audit", market: "digital-assets", expectedMode: "shadow", consent: "on", website: "" })) form.set(key, value);
  return form;
};
describe("P01 request recovery and write boundaries", () => {
  it("serializes double clicks before any await and never replays on network recovery", async () => {
    let online = true, calls = 0, release!: (value: number) => void;
    const action = createIdentityAction({ online: () => online });
    const request = action.run(async () => { calls++; return new Promise<number>(resolve => { release = resolve; }); });
    await expect(action.run(async () => ++calls)).rejects.toThrow("不可重复");
    online = false; action.cancel(); release(1);
    await expect(request).rejects.toMatchObject({ outcomeUnknown: true });
    online = true;
    await expect(action.run(async () => ++calls)).rejects.toMatchObject({ outcomeUnknown: true });
    expect(calls).toBe(1);
    action.acknowledgeRetry(); expect(await action.run(async () => ++calls)).toBe(2);
  });
  it("refuses offline dispatch and closed consumers", async () => {
    const action = createIdentityAction({ online: () => false });
    let calls = 0;
    await expect(action.run(async () => ++calls)).rejects.toMatchObject({ outcomeUnknown: false });
    action.close();
    await expect(action.run(async () => ++calls)).rejects.toThrow(); expect(calls).toBe(0);
  });
  it("cancels the actual transport when the page closes", async () => {
    const action = createIdentityAction({ online: () => true });
    let signal!: AbortSignal;
    const response = action.run(s => { signal = s; return requestAccess("https://bff.example", accessPayload(data()), s, (async () => new Promise<Response>(() => {})) as typeof fetch); });
    action.close();
    await expect(response).rejects.toMatchObject({ outcomeUnknown: true }); expect(signal.aborted).toBe(true);
  });
  it("enforces server retryAfter through the exact deadline without leaking the body", async () => {
    let now = 1000, calls = 0;
    const action = createIdentityAction({ online: () => true, now: () => now });
    await expect(action.run(async () => { calls++; throw new AuthBffError("account exists secret", 429, undefined, 2); })).rejects.toThrow("2 秒");
    now = 2999; await expect(action.run(async () => ++calls)).rejects.toThrow();
    expect(action.remaining()).toBe(1); now = 3000;
    expect(await action.run(async () => ++calls)).toBe(2);
  });
  for (const error of [new BffTransportError("TIMEOUT", true), new AuthBffError("private account", 503), new Error("malformed success")]) {
    it(`blocks uncertain retry after ${error.constructor.name}`, async () => {
      const action = createIdentityAction({ online: () => true });
      const result = await action.run(async () => { throw error; }).catch(e => e);
      expect(result).toMatchObject({ outcomeUnknown: true }); expect(result.message).not.toMatch(/private|malformed/);
      await expect(action.run(async () => 1)).rejects.toMatchObject({ outcomeUnknown: true });
    });
  }
  it("allows a manual retry after definitive rejection but never retries itself", async () => {
    const action = createIdentityAction({ online: () => true }); let calls = 0;
    await expect(action.run(async () => { calls++; throw new AuthBffError("unknown email", 422); })).rejects.toMatchObject({ outcomeUnknown: false });
    expect(calls).toBe(1); expect(await action.run(async () => ++calls)).toBe(2);
  });
  for (const [key, value] of [["teamName", "  "], ["contactEmail", "not-email"], ["purpose", "short"], ["market", "private"], ["expectedMode", "live"], ["consent", ""], ["website", "bot"]]) {
    it(`rejects invalid ${key} before dispatch`, () => { const form = data(); form.set(key, value); expect(() => accessPayload(form)).toThrow(); });
  }
  it("sends only C01 fields and treats valid 202 as acceptance with audit references", async () => {
    const body = accessPayload(data()); expect(body.teamName).toBe("Research"); expect(body).not.toHaveProperty("website");
    const accepted = { jobId: "11111111-2222-4333-8444-555555555555", status: "accepted", correlationId: "66666666-7777-4888-8999-000000000000", auditRef: "77777777-8888-4999-8aaa-111111111111" };
    const result = await requestAccess("https://bff.example", body, new AbortController().signal, (async (_url, init) => { expect(JSON.parse(String(init?.body))).toEqual(body); return Response.json(accepted, { status: 202 }); }) as typeof fetch);
    expect(result).toEqual(accepted);
  });
  it("rejects malformed accepted responses instead of displaying success", async () => {
    await expect(requestAccess("https://bff.example", accessPayload(data()), new AbortController().signal, (async () => Response.json({ status: "accepted" }, { status: 202 })) as typeof fetch)).rejects.toThrow();
  });
  for (const path of ["//evil.example", "/command?token=secret", "/auth/callback", "/login/", "/mfa", "/offline", "/unauthorized", "/maintenance", "/access-request", "/%2f%2fevil", "/a/../login"]) {
    it(`falls back from unsafe or looping return path ${path}`, () => expect(sanitizeReturnPath(path)).toBe("/command"));
  }
  it("keeps a safe internal route", () => expect(sanitizeReturnPath("/portfolio/positions")).toBe("/portfolio/positions"));
});
