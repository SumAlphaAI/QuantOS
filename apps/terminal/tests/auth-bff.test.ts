import { describe, expect, it } from "vitest";

import { AuthBffError, completeLoginMfa, completeRecentAuth, submitAccessRequest } from "../src/auth/bff";

describe("UI-102 generated-schema auth transport", () => {
  it("submits MFA with the frozen login purpose and HttpOnly session credentials", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({ challengeRef: "11111111-2222-4333-8444-555555555555", status: "verified" }), { status: 200 });
    }) as typeof fetch;
    const result = await completeLoginMfa("https://bff.example", "123456", "csrf-test-token", fetchImpl);
    expect(result.status).toBe("verified");
    expect(captured?.credentials).toBe("include");
    expect(new Headers(captured?.headers).get("x-csrf-token")).toBe("csrf-test-token");
    expect(JSON.parse(String(captured?.body))).toEqual({ purpose: "login", code: "123456" });
  });

  it("maps 429 to a generic, account-neutral error with retry metadata", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      code: "RATE_LIMITED",
      message: "internal account detail",
      correlationId: "11111111-2222-4333-8444-555555555555",
      retryAfter: 60,
    }), { status: 429 })) as typeof fetch;
    const error = await completeLoginMfa("https://bff.example", "000000", "csrf-test-token", fetchImpl).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AuthBffError);
    expect((error as AuthBffError).message).not.toContain("account");
    expect((error as AuthBffError).retryAfter).toBe(60);
  });

  it("exchanges a verified challenge for a short-lived recent-auth reference with CSRF", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({ reauthTokenRef: "11111111-2222-4333-8444-555555555555", expiresAt: "2026-09-16T10:05:00Z" }), { status: 200 });
    }) as typeof fetch;
    const result = await completeRecentAuth("https://bff.example", "66666666-7777-4888-8999-000000000000", "csrf-test-token", fetchImpl);
    expect(result.reauthTokenRef).toBe("11111111-2222-4333-8444-555555555555");
    expect(new Headers(captured?.headers).get("x-csrf-token")).toBe("csrf-test-token");
    expect(JSON.parse(String(captured?.body))).toEqual({ challengeRef: "66666666-7777-4888-8999-000000000000" });
  });

  it("treats access request 202 as accepted rather than completed", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({
      jobId: "11111111-2222-4333-8444-555555555555",
      status: "accepted",
      correlationId: "66666666-7777-4888-8999-000000000000",
      auditRef: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    }), { status: 202 });
    }) as typeof fetch;
    const result = await submitAccessRequest("https://bff.example", {
      teamName: "Research",
      contactEmail: "research@example.com",
      purpose: "Paper research",
      markets: ["digital-assets"],
      expectedMode: "paper",
      privacyNoticeVersion: "2026-08-15",
    }, fetchImpl);
    expect(result.status).toBe("accepted");
    expect(new Headers(captured?.headers).has("x-csrf-token")).toBe(false);
  });
});

describe("A2 auth runtime response boundary", () => {
  it("rejects an apparent MFA success without its challenge reference", async () => {
    const fetchImpl = (async () => Response.json({ status: "verified" })) as typeof fetch;
    await expect(completeLoginMfa("https://bff.example", "123456", "csrf", fetchImpl)).rejects.toMatchObject({ name: "BffResponseError", operation: "mfaChallenge" });
  });

  it("rejects a malformed reauthentication success", async () => {
    const fetchImpl = (async () => Response.json({ reauthTokenRef: "not-a-uuid", expiresAt: "invalid" })) as typeof fetch;
    await expect(completeRecentAuth("https://bff.example", "challenge", "csrf", fetchImpl)).rejects.toMatchObject({ name: "BffResponseError" });
  });

  it("does not forward unvalidated error metadata", async () => {
    const fetchImpl = (async () => Response.json({ code: "RATE_LIMITED", retryAfter: "tomorrow", correlationId: "invalid" }, { status: 429 })) as typeof fetch;
    const error = await completeLoginMfa("https://bff.example", "000000", "csrf", fetchImpl).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 429, retryAfter: undefined, correlationId: undefined });
  });
});

describe("A2 cancellable transport", () => {
  it("bounds stalled headers without retrying an uncertain write", async () => {
    let calls = 0;
    let signal: AbortSignal | undefined;
    const fetchImpl = (async (_: unknown, init?: RequestInit) => {
      calls++; signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    await expect(completeLoginMfa("https://bff.example", "123456", "csrf", fetchImpl, { timeoutMs: 10 }))
      .rejects.toMatchObject({ code: "TIMEOUT", outcomeUnknown: true });
    expect(calls).toBe(1);
    expect(signal?.aborted).toBe(true);
  });

  it("bounds a response whose JSON body stalls", async () => {
    const fetchImpl = (async () => new Response(new ReadableStream({ start() {} }))) as typeof fetch;
    await expect(completeRecentAuth("https://bff.example", "challenge", "csrf", fetchImpl, { timeoutMs: 10 }))
      .rejects.toMatchObject({ code: "TIMEOUT", outcomeUnknown: true });
  });

  it("does not send a request cancelled before dispatch", async () => {
    const controller = new AbortController(); controller.abort();
    let calls = 0;
    const fetchImpl = (async () => { calls++; return Response.json({}); }) as typeof fetch;
    await expect(completeLoginMfa("https://bff.example", "123456", "csrf", fetchImpl, { signal: controller.signal }))
      .rejects.toMatchObject({ code: "CANCELLED" });
    expect(calls).toBe(0);
  });

  it("propagates caller cancellation and sanitizes network failures", async () => {
    const controller = new AbortController();
    const fetchImpl = (async () => { controller.abort(); return new Promise<Response>(() => {}); }) as typeof fetch;
    await expect(completeLoginMfa("https://bff.example", "123456", "csrf", fetchImpl, { signal: controller.signal }))
      .rejects.toMatchObject({ code: "CANCELLED" });
    const failing = (async () => { throw Error("secret upstream host"); }) as typeof fetch;
    const error = await completeLoginMfa("https://bff.example", "123456", "csrf", failing).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "NETWORK", outcomeUnknown: true });
    expect(String(error)).not.toContain("secret");
  });
});
