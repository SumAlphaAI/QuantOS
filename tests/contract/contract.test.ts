import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { bffZodSchemas } from "../../packages/api-client/src/bff-gen/quantos-bff.zod";

import { handlers } from "./handlers";
import { loadFixture, validateFixture } from "./validate.mjs";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PRE-06 contract fixtures：schema 驱动", () => {
  it("OpenAPI 同源生成的 Zod schema 校验 session/error/proposal fixtures", () => {
    expect(bffZodSchemas.SessionContext.safeParse(loadFixture("session/default.json")).success).toBe(true);
    expect(bffZodSchemas.ErrorEnvelope.safeParse(loadFixture("errors/conflict.json")).success).toBe(true);
    expect(bffZodSchemas.TradeProposal.safeParse(loadFixture("proposal/default.json")).success).toBe(true);
    expect(bffZodSchemas.TradeProposal.safeParse({ ...loadFixture("proposal/default.json"), executable: true }).success).toBe(false);
  });

  it("session fixture 通过 OpenAPI 生成的 schema 校验", () => {
    expect(validateFixture(loadFixture("session/default.json"), { schema: "SessionContext" })).toEqual([]);
  });

  it("unauthorized fixture 通过错误 envelope 校验（403 不泄露对象存在性）", () => {
    expect(validateFixture(loadFixture("command-center/unauthorized.json"), { schema: "ErrorEnvelope" })).toEqual([]);
  });

  it("proposal fixture 通过 OpenAPI 生成的 TradeProposal schema 且 executable=false", () => {
    expect(validateFixture(loadFixture("proposal/default.json"), { schema: "TradeProposal" })).toEqual([]);
  });

  it("故意破坏 schema → 校验失败", () => {
    const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("故意破坏权限不变量（executable=true）→ 校验失败", () => {
    const issues = validateFixture(
      { ...loadFixture("proposal/default.json"), executable: true },
      { schema: "TradeProposal" },
    );
    expect(issues.some((i) => i.includes("executable"))).toBe(true);
  });

  it("故意注入敏感字段（venueApiKey）→ 校验失败", () => {
    const issues = validateFixture(loadFixture("sabotage/sensitive-field.json"), { schema: "SessionContext" });
    expect(issues.some((i) => i.includes("venueApiKey"))).toBe(true);
  });

  it("409 conflict 与 429 rate-limit fixtures 通过统一 ErrorEnvelope", () => {
    expect(validateFixture(loadFixture("errors/conflict.json"), { schema: "ErrorEnvelope" })).toEqual([]);
    expect(validateFixture(loadFixture("errors/rate-limited.json"), { schema: "ErrorEnvelope" })).toEqual([]);
  });
});

describe("PRE-06 MSW contract handlers", () => {
  it("授权请求返回 200 且响应通过 schema 校验", async () => {
    const res = await fetch("http://localhost:4010/v1/session", {
      headers: { authorization: "Bearer test" },
    });
    expect(res.status).toBe(200);
    expect(validateFixture(await res.json(), { schema: "SessionContext" })).toEqual([]);
  });

  it("未授权请求返回 403 错误 envelope", async () => {
    const res = await fetch("http://localhost:4010/v1/session");
    expect(res.status).toBe(403);
    expect(validateFixture(await res.json(), { schema: "ErrorEnvelope" })).toEqual([]);
  });

  it("未配置 operation 默认返回 501 且不伪造成功 fixture", async () => {
    const res = await fetch("http://localhost:4010/v1/orders");
    expect(res.status).toBe(501);
    const payload = await res.json();
    expect(payload.code).toBe("MOCK_NOT_CONFIGURED");
    expect(validateFixture(payload, { schema: "ErrorEnvelope" })).toEqual([]);
  });

  it("版本冲突返回 409/currentVersion，客户端不得静默覆盖", async () => {
    const res = await fetch("http://localhost:4010/v1/strategies/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/draft", {
      method: "PUT",
      headers: { "content-type": "application/json", "if-match": "draft-v2" },
      body: JSON.stringify({ name: "stale draft" }),
    });
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.currentVersion).toBe("draft-v3");
    expect(validateFixture(payload, { schema: "ErrorEnvelope" })).toEqual([]);
  });

  it("MFA 限流返回 429/retryAfter 且不泄露账户存在性", async () => {
    const res = await fetch("http://localhost:4010/v1/auth/mfa/challenges", { method: "POST" });
    expect(res.status).toBe(429);
    const payload = await res.json();
    expect(payload.retryAfter).toBe(60);
    expect(JSON.stringify(payload)).not.toMatch(/account exists|用户存在/i);
    expect(validateFixture(payload, { schema: "ErrorEnvelope" })).toEqual([]);
  });
});
