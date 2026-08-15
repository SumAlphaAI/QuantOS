import { describe, expect, it } from "vitest";

import { AuthBffError, completeLoginMfa, submitAccessRequest } from "../src/auth/bff";

describe("UI-102 generated-schema auth transport", () => {
  it("submits MFA with the frozen login purpose and HttpOnly session credentials", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({ challengeRef: "11111111-2222-4333-8444-555555555555", status: "verified" }), { status: 200 });
    }) as typeof fetch;
    const result = await completeLoginMfa("https://bff.example", "123456", fetchImpl);
    expect(result.status).toBe("verified");
    expect(captured?.credentials).toBe("include");
    expect(JSON.parse(String(captured?.body))).toEqual({ purpose: "login", code: "123456" });
  });

  it("maps 429 to a generic, account-neutral error with retry metadata", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      code: "RATE_LIMITED",
      message: "internal account detail",
      correlationId: "11111111-2222-4333-8444-555555555555",
      retryAfter: 60,
    }), { status: 429 })) as typeof fetch;
    const error = await completeLoginMfa("https://bff.example", "000000", fetchImpl).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AuthBffError);
    expect((error as AuthBffError).message).not.toContain("account");
    expect((error as AuthBffError).retryAfter).toBe(60);
  });

  it("treats access request 202 as accepted rather than completed", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      jobId: "11111111-2222-4333-8444-555555555555",
      status: "accepted",
      correlationId: "66666666-7777-4888-8999-000000000000",
    }), { status: 202 })) as typeof fetch;
    const result = await submitAccessRequest("https://bff.example", {
      teamName: "Research",
      contactEmail: "research@example.com",
      purpose: "Paper research",
      markets: ["digital-assets"],
      expectedMode: "paper",
      privacyNoticeVersion: "2026-08-15",
    }, fetchImpl);
    expect(result.status).toBe("accepted");
  });
});
