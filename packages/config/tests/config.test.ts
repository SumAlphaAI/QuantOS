import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseEnvText, validateEnv, workspaceLabel } from "../src/index.js";

const repoRoot = join(__dirname, "../../..");
const loadExample = (name: string) => parseEnvText(readFileSync(join(repoRoot, "env", name), "utf8"));

const validBase: Record<string, string> = {
  NEXT_PUBLIC_QUANTOS_ENV: "local-mock",
  NEXT_PUBLIC_SITE_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: "http://localhost:3100",
  NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: "http://localhost:4010",
  NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: "https://mock.idp.local",
  NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: "quantos-terminal-local",
  NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: "http://localhost:3100/auth/callback",
  NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: "paper",
  NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: "true",
  NEXT_PUBLIC_QUANTOS_OBS_ENABLED: "false",
  NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET: "off",
};

describe("config", () => {
  it("exports the workspace label", () => {
    expect(workspaceLabel).toBe("sumalpha-quantos");
  });
});

describe("PRE-05 环境配置校验", () => {
  it.each(["local-mock.env.example", "local-integrated.env.example", "staging.env.example"])(
    "三套 Web 环境示例均通过校验：%s",
    (name) => {
      const result = validateEnv(loadExample(name));
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );

  it("缺必需变量 fail-fast 并列出全部缺失", () => {
    const rest = { ...validBase };
    delete rest.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN;
    delete rest.NEXT_PUBLIC_QUANTOS_OIDC_ISSUER;
    const result = validateEnv(rest);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.key)).toEqual(
      expect.arrayContaining(["NEXT_PUBLIC_QUANTOS_BFF_ORIGIN", "NEXT_PUBLIC_QUANTOS_OIDC_ISSUER"]),
    );
  });

  it("客户端 bundle 不含 server secret：key 指纹拒绝", () => {
    const result = validateEnv({ ...validBase, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "whatever" });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("客户端 bundle 不含 server secret：value 指纹（JWT）拒绝", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c";
    const result = validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_SENTRY_DSN: jwt });
    expect(result.ok).toBe(false);
  });

  it("拒绝 allowlist 外的公开变量", () => {
    const result = validateEnv({ ...validBase, NEXT_PUBLIC_UNREVIEWED_VALUE: "public-looking" });
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ key: "NEXT_PUBLIC_UNREVIEWED_VALUE" }));
  });

  it("环境/mode 分离：非法环境与 assisted_live 默认 mode 均拒绝", () => {
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_ENV: "prod" }).ok).toBe(false);
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_DEFAULT_MODE: "assisted_live" }).ok).toBe(false);
  });

  it("布尔值与 Web callback 同源关系均 fail closed", () => {
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OBS_ENABLED: "yes" }).ok).toBe(false);
    expect(
      validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: "https://attacker.example/auth/callback" }).ok,
    ).toBe(false);
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: "quantos://auth/callback" }).ok).toBe(false);
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: "http://localhost:4010/v1" }).ok).toBe(false);
  });

  it("local-integrated 禁 mock", () => {
    expect(
      validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_ENV: "local-integrated", NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: "true" }).ok,
    ).toBe(false);
  });

  it("staging 约束：禁 mock、必须 https、观测开启必须配 DSN", () => {
    const staging = {
      ...validBase,
      NEXT_PUBLIC_QUANTOS_ENV: "staging",
      NEXT_PUBLIC_SITE_ORIGIN: "https://staging.sumalpha.ai",
      NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN: "https://app.staging.sumalpha.ai",
      NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: "false",
      NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: "https://bff.staging.sumalpha.ai",
      NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: "https://app.staging.sumalpha.ai/auth/callback",
      NEXT_PUBLIC_QUANTOS_OBS_ENABLED: "true",
      NEXT_PUBLIC_QUANTOS_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
    };
    expect(validateEnv(staging).ok).toBe(true);
    expect(validateEnv({ ...staging, NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: "true" }).ok).toBe(false);
    expect(validateEnv({ ...staging, NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: "http://bff.staging.sumalpha.ai" }).ok).toBe(false);
    expect(validateEnv({ ...staging, NEXT_PUBLIC_QUANTOS_SENTRY_DSN: "" }).ok).toBe(false);
    expect(validateEnv({ ...staging, NEXT_PUBLIC_QUANTOS_SENTRY_DSN: "not-a-dsn" }).ok).toBe(false);
  });
});
