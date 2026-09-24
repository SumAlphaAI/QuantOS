import { describe, expect, it } from "vitest";

import { deriveCodeChallenge, generateCodeVerifier } from "../src/auth/pkce";
import {
  AuthError,
  buildAuthorizeUrl,
  exchangeCode,
  handleAuthHttpStatus,
  sanitizeReturnPath,
  sessionStore,
  type PendingAuth,
} from "../src/auth/flow";

const config = {
  issuer: "https://mock.idp.local",
  clientId: "quantos-terminal-local",
  redirectUri: "http://localhost:3100/auth/callback",
};

const pending: PendingAuth = { verifier: "v", state: "s", returnTo: "/command" };

describe("OIDC callback PoC（G0 #4）", () => {
  it("PKCE S256 符合 RFC 7636 测试向量", async () => {
    const challenge = await deriveCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("verifier 为 URL-safe 且足够长", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
  });

  it("authorize URL 携带必需参数", () => {
    const url = new URL(buildAuthorizeUrl(config, pending, "challenge"));
    expect(url.origin + url.pathname).toBe("https://mock.idp.local/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("s");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  });

  it("return path 消毒：拒绝跨站/协议跳转与查询串", () => {
    expect(sanitizeReturnPath("/command")).toBe("/command");
    expect(sanitizeReturnPath("/portfolio/positions")).toBe("/portfolio/positions");
    expect(sanitizeReturnPath("//evil.com/x")).toBe("/command");
    expect(sanitizeReturnPath("https://evil.com")).toBe("/command");
    expect(sanitizeReturnPath("/command?token=abc")).toBe("/command");
    expect(sanitizeReturnPath(null)).toBe("/command");
  });

  it("成功交换：携带 code_verifier，会话仅入内存，token 不出现在返回值", async () => {
    let captured = "";
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      captured = String(init?.body ?? "");
      return new Response(JSON.stringify({ subject: "user-1", expires_in: 300 }), { status: 200 });
    }) as unknown as typeof fetch;
    const session = await exchangeCode(config, pending, "code-1", "s", fetchImpl);
    expect(captured).toContain("code_verifier=v");
    expect(captured).toContain("grant_type=authorization_code");
    expect(session.subject).toBe("user-1");
    expect(JSON.stringify(session)).not.toContain("token");
    expect(sessionStore.get()?.subject).toBe("user-1");
    sessionStore.clear();
    expect(sessionStore.get()).toBeNull();
  });

  it("真实回调必须把短期 token 交换为 BFF HttpOnly 服务端会话", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).endsWith("/v1/auth/session")) {
        expect(init?.credentials).toBe("include");
        expect(init?.headers).toEqual({ authorization: "Bearer short-token" });
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ access_token: "short-token", user: { id: "user-1" }, expires_in: 300 }), { status: 200 });
    }) as typeof fetch;
    const session = await exchangeCode(config, pending, "code-1", "s", fetchImpl, "https://bff.example.com");
    expect(calls).toHaveLength(2);
    expect(session.subject).toBe("user-1");
    expect(JSON.stringify(session)).not.toContain("short-token");
    sessionStore.clear();
  });

  it("真实回调缺 token 时失败关闭", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ subject: "user-1", expires_in: 300 }), { status: 200 })) as typeof fetch;
    await expect(exchangeCode(config, pending, "code-1", "s", fetchImpl, "https://bff.example.com"))
      .rejects.toThrow(AuthError);
  });

  it("保留服务端 MFA 必需信号但不接收任何长期 token", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ subject: "user-1", expires_in: 300, mfa_required: true }), { status: 200 })) as typeof fetch;
    const session = await exchangeCode(config, pending, "code-1", "s", fetchImpl);
    expect(session.mfaRequired).toBe(true);
    expect(JSON.stringify(session)).not.toContain("access_token");
    sessionStore.clear();
  });

  it("state 不匹配拒绝且不发起交换", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await expect(exchangeCode(config, pending, "code-1", "wrong-state", fetchImpl)).rejects.toThrow(AuthError);
    expect(called).toBe(false);
  });

  it("交换失败返回安全错误且不泄露细节", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ correlationId: "9a1c4e60-2d3b-4c5f-8a9e-1b2c3d4e5f60", debug: "secret-detail" }), {
        status: 400,
      })) as unknown as typeof fetch;
    const err = await exchangeCode(config, pending, "code-1", "s", fetchImpl).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).message).not.toContain("secret-detail");
    expect((err as AuthError).correlationId).toBe("9a1c4e60-2d3b-4c5f-8a9e-1b2c3d4e5f60");
  });

  it("401 清理内存会话并只保留安全 return path", () => {
    sessionStore.set({ subject: "actor", establishedAt: "2026-08-15T00:00:00Z", expiresIn: 300 });
    expect(handleAuthHttpStatus(401, "/orders?token=secret")).toEqual({
      kind: "login",
      route: "/login?return_to=%2Fcommand",
    });
    expect(sessionStore.get()).toBeNull();
  });

  it("403/404 收敛为同一不可探测资源页面", () => {
    expect(handleAuthHttpStatus(403, "/orders/known")).toEqual({ kind: "concealed", route: "/unauthorized" });
    expect(handleAuthHttpStatus(404, "/orders/missing")).toEqual({ kind: "concealed", route: "/unauthorized" });
  });
});
