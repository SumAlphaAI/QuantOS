import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { validateEnv, validateEnvExample, ENV_PROFILES, workspaceLabel } from "../src/index.js";

import { parseEnvText } from "../src/env-file.js";

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
      const profile = ENV_PROFILES.find(profile => name === `${profile}.env.example`)!;
      const result = validateEnvExample(profile, loadExample(name));
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

describe("PRE-05 review regressions", () => {
  it("rejects known credentials inside public client IDs without echoing values", () => {
    for (const value of ["gh" + "p_" + "A".repeat(36), "AK" + "IA" + "A".repeat(16), "sb_" + "secret_" + "A".repeat(24)]) {
      const result = validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: value });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result.issues)).not.toContain(value);
    }
  });
  it("rejects padded flags, profiles, mode and public URL values before raw-value consumers run", () => {
    for (const key of Object.keys(validBase)) expect(validateEnv({ ...validBase, [key]: ` ${validBase[key]} ` }).ok).toBe(false);
  });
  it.each(["local-mock", "local-integrated", "staging"] as const)("requires a safe DSN whenever observation is enabled: %s", (profile) => {
    const vars = loadExample(`${profile}.env.example`);
    for (const dsn of ["", "not-a-dsn", "https://public:password@o0.ingest.sentry.io/1", "https://public@o0.ingest.sentry.io/1?token=synthetic", "https://public@o0.ingest.sentry.io/1#fragment", "https://public@o0.ingest.sentry.io/"]) {
      expect(validateEnv({ ...vars, NEXT_PUBLIC_QUANTOS_OBS_ENABLED: "true", NEXT_PUBLIC_QUANTOS_SENTRY_DSN: dsn }).ok).toBe(false);
    }
    expect(validateEnv({ ...vars, NEXT_PUBLIC_QUANTOS_OBS_ENABLED: "true", NEXT_PUBLIC_QUANTOS_SENTRY_DSN: "https://public@o0.ingest.sentry.io/1" }).ok).toBe(true);
  });
  it("rejects malformed configured DSN even when observation is off", () => {
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_SENTRY_DSN: "https://public:password@o0.ingest.sentry.io/1" }).ok).toBe(false);
  });
  it("requires the exact callback raw URI and rejects unsupported path issuers", () => {
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI: validBase.NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI + "/" }).ok).toBe(false);
    expect(validateEnv({ ...validBase, NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: "https://idp.example.test/tenant/realm" }).ok).toBe(false);
  });
  it("binds each template to its independent profile identity", () => {
    for (const profile of ["local-integrated", "staging"] as const) expect(validateEnvExample(profile, validBase).ok).toBe(false);
  });
  it("requires each staging role and rejects renamed, duplicated or credential-shaped identities", () => {
    const vars = loadExample("staging.env.example");
    for (const key of Object.keys(vars).filter(key => key.startsWith("QUANTOS_E2E_ACCOUNT_"))) {
      const missing = { ...vars }; delete missing[key];
      expect(validateEnvExample("staging", missing).ok).toBe(false);
      expect(validateEnvExample("staging", { ...vars, [key]: "wrong@staging.sumalpha.ai" }).ok).toBe(false);
    }
    expect(validateEnvExample("staging", { ...vars, QUANTOS_E2E_ACCOUNT_UNKNOWN: "extra" }).ok).toBe(false);
  });
  it("forbids server-only variables in Web example templates", () => {
    expect(validateEnvExample("local-mock", { ...validBase, DATABASE_URL: "synthetic" }).ok).toBe(false);
  });
  it("shares Next dotenv parsing for comments, quotes, multiline and expansion", () => {
    const vars = parseEnvText(`FLAG=true # comment\nQUOTED=" padded "\nSINGLE='literal # hash'\nMULTI="first\nsecond"\nBASE=paper\nEXPANDED=\${BASE}\nexport EXPORTED=value\n`);
    expect(vars).toEqual({ FLAG: "true", QUOTED: " padded ", SINGLE: "literal # hash", MULTI: "first\nsecond", BASE: "paper", EXPANDED: "paper", EXPORTED: "value" });
  });
  it("file parsing is isolated from inherited env and other parsed files", () => {
    const old = process.env.PRE05_PARSE_PROBE;
    process.env.PRE05_PARSE_PROBE = "inherited";
    try {
      expect(parseEnvText("PRE05_PARSE_PROBE=file\n").PRE05_PARSE_PROBE).toBe("file");
      expect(parseEnvText("OTHER=${PRE05_PARSE_PROBE}\n").OTHER).toBe("");
    } finally {
      if (old === undefined) delete process.env.PRE05_PARSE_PROBE; else process.env.PRE05_PARSE_PROBE = old;
    }
  });
});

it("rejects accidentally copied server-secret values even without a known fingerprint", () => {
  const secret = "synthetic-private-value/with space";
  for (const value of [secret, encodeURIComponent(secret)]) {
    const result = validateEnv({ ...validBase, PRE05_SERVER_SECRET: secret, NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID: value });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).not.toContain(secret);
  }
});
