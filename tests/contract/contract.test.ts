import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { bffZodSchemas } from "../../packages/api-client/src/bff-gen/quantos-bff.zod";

import { handlers } from "./handlers";
import { loadFixture, validateFixture } from "./validate.mjs";

const server = setupServer(...handlers);
const cookieHeaders = { cookie: "quantos_session=synthetic; quantos_csrf=synthetic-csrf-00000001", Origin: "http://localhost:3190", "X-CSRF-Token": "synthetic-csrf-00000001",
  "Idempotency-Key": "11111111-1111-4111-8111-111111111111", "X-Request-Id": "22222222-2222-4222-8222-222222222222" };
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => expect.hasAssertions());
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
      headers: cookieHeaders,
    });
    expect(res.status).toBe(200);
    expect(validateFixture(await res.json(), { schema: "SessionContext" })).toEqual([]);
  });

  it("未授权请求返回 401 错误 envelope", async () => {
    const res = await fetch("http://localhost:4010/v1/session");
    expect(res.status).toBe(401);
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
      headers: { ...cookieHeaders, "content-type": "application/json", "if-match": "draft-v2" },
      body: JSON.stringify({ files: {}, parameters: {} }),
    });
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.currentVersion).toBe("draft-v3");
    expect(validateFixture(payload, { schema: "ErrorEnvelope" })).toEqual([]);
  });

  it("MFA 限流返回 429/retryAfter 且不泄露账户存在性", async () => {
    const res = await fetch("http://localhost:4010/v1/auth/mfa/challenges", { method: "POST", headers: cookieHeaders, body: JSON.stringify({purpose:"approval"}) });
    expect(res.status).toBe(429);
    const payload = await res.json();
    expect(payload.retryAfter).toBe(60);
    expect(JSON.stringify(payload)).not.toMatch(/account exists|用户存在/i);
    expect(validateFixture(payload, { schema: "ErrorEnvelope" })).toEqual([]);
  });
});

describe("PRE-06 complete fixture and sensitive-key policy", () => {
  it("all declared positive/negative fixtures match their schema and purpose", async () => {
    const { validateFixtureInventory, loadValidatedFixture } = await import("./fixture-inventory.mjs");
    expect(validateFixtureInventory().issues).toEqual([]);
    expect(() => loadValidatedFixture("command-center/default.json")).toThrow("Unknown positive fixture");
  });
  it("equivalent forbidden keys are rejected recursively without rejecting public fields", async () => {
    const { default: dictionary } = await import("./sensitive-fields.json");
    for (const key of dictionary.forbiddenKeyPatterns) {
      const words = key.replace(/([a-z])([A-Z])/g, "$1_$2").split("_");
      for (const alias of [key, words.join("_"), words.join("-"), words.join(".").toUpperCase()]) {
        expect(validateFixture({ data: [{ [alias]: "synthetic-private-marker" }] }).some(issue => issue.includes(alias))).toBe(true);
      }
    }
    expect(validateFixture({ expiresAt: "public", capabilities: [], publicKeyId: "public" })).toEqual([]);
  });
  it("getProposal response is schema-valid and never executable", async () => {
    const response = await fetch("http://localhost:4010/v1/proposals/5e6f7081-9a2b-4c3d-8e4f-6a7b8c9d0e1f", {headers:cookieHeaders});
    expect(response.status).toBe(200);
    expect(validateFixture(await response.json(), { schema: "TradeProposal" })).toEqual([]);
  });
  it("fresh version returns schema-valid StrategyDraft", async () => {
    const response = await fetch("http://localhost:4010/v1/strategies/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/draft", {
      method: "PUT", headers: { ...cookieHeaders, "if-match": "draft-v3", "content-type": "application/json" }, body: JSON.stringify({ files: {}, parameters: {} }),
    });
    expect(response.status).toBe(200);
    expect(validateFixture(await response.json(), { schema: "StrategyDraft" })).toEqual([]);
  });
});
