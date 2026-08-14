import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { handlers } from "./handlers";
import { loadFixture, validateFixture } from "./validate.mjs";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("PRE-06 contract fixtures：schema 驱动", () => {
  it("command-center 默认/陈旧 fixture 通过 schema 校验", () => {
    expect(validateFixture(loadFixture("command-center/default.json"), { schema: "command-center-view" })).toEqual([]);
    expect(validateFixture(loadFixture("command-center/stale.json"), { schema: "command-center-view" })).toEqual([]);
  });

  it("unauthorized fixture 通过错误 envelope 校验（403 不泄露对象存在性）", () => {
    expect(validateFixture(loadFixture("command-center/unauthorized.json"), { schema: "error-envelope" })).toEqual([]);
  });

  it("proposal fixture 通过 proto TradeProposal schema 校验且 executable=false", () => {
    expect(validateFixture(loadFixture("proposal/default.json"), { schema: "trade-proposal" })).toEqual([]);
  });

  it("故意破坏 schema → 校验失败", () => {
    const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "command-center-view" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("故意破坏权限不变量（executable=true）→ 校验失败", () => {
    const issues = validateFixture(loadFixture("sabotage/permission-executable.json"));
    expect(issues.some((i) => i.includes("executable"))).toBe(true);
  });

  it("故意注入敏感字段（venueApiKey）→ 校验失败", () => {
    const issues = validateFixture(loadFixture("sabotage/sensitive-field.json"), { schema: "command-center-view" });
    expect(issues.some((i) => i.includes("venueApiKey"))).toBe(true);
  });
});

describe("PRE-06 MSW contract handlers", () => {
  it("授权请求返回 200 且响应通过 schema 校验", async () => {
    const res = await fetch("http://localhost:4010/v1/command-center", {
      headers: { authorization: "Bearer test" },
    });
    expect(res.status).toBe(200);
    expect(validateFixture(await res.json(), { schema: "command-center-view" })).toEqual([]);
  });

  it("未授权请求返回 403 错误 envelope", async () => {
    const res = await fetch("http://localhost:4010/v1/command-center");
    expect(res.status).toBe(403);
    expect(validateFixture(await res.json(), { schema: "error-envelope" })).toEqual([]);
  });
});
