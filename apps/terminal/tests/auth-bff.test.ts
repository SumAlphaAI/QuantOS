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
