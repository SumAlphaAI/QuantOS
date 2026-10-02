/**
 * PRE-05 环境方案：第一期 Web 三套环境配置模型与校验。
 *
 * 完成标准对应：
 * - 缺必需变量 fail-fast：validateEnv/assertEnv 在启动时抛出完整缺失清单；
 * - 客户端 bundle 不含 server secret：只允许 NEXT_PUBLIC_ 前缀进入 bundle，
 *   且对 key 与 value 做 server-secret 负向扫描；
 * - 环境/mode 明确分离：NEXT_PUBLIC_QUANTOS_ENV（部署环境）与 NEXT_PUBLIC_QUANTOS_DEFAULT_MODE
 *   （运行模式 research/paper/shadow）独立校验，mode 永远不允许 assisted_live 默认值。
 */

/** Known credential fingerprints, shared by input and client-artifact checks.
 * Return labels only: never include matched credential values in diagnostics. */
const fingerprints: ReadonlyArray<readonly [string, RegExp]> = [
  ["API secret", /\bsk-[A-Za-z0-9_-]{16,}/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Supabase token", /\bsbp_[A-Za-z0-9]{20,}/],
  ["Supabase secret", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{30,}/],
  ["AWS credential identifier", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
export function secretFingerprints(value: string): string[] {
  return fingerprints.filter(([, pattern]) => pattern.test(value)).map(([label]) => label);
}

/** Inspect only explicitly named server credentials; public values remain public. */
export function serverSecretVariants(vars: Record<string, string | undefined>): string[] {
  return Object.entries(vars)
    .filter(([key, value]) => !key.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|PRIVATE_KEY|API_KEY|TOKEN|SIGNING|SERVICE_ROLE/i.test(key) && typeof value === "string" && value.length > 0)
    .flatMap(([, value]) => [value!, JSON.stringify(value).slice(1, -1), encodeURIComponent(value!)]);
}

export const ENV_PROFILES = ["local-mock", "local-integrated", "staging"] as const;
export type EnvProfile = (typeof ENV_PROFILES)[number];

export const RUNTIME_ENVS = ENV_PROFILES;
export type RuntimeEnv = (typeof RUNTIME_ENVS)[number];

export const RUNTIME_MODES = ["research", "paper", "shadow"] as const;
export type RuntimeMode = (typeof RUNTIME_MODES)[number];

const PUBLIC_PREFIX = "NEXT_PUBLIC_";

/** 进入客户端 bundle 的必需变量（全部环境） */
const REQUIRED_PUBLIC_KEYS = [
  "NEXT_PUBLIC_QUANTOS_ENV",
  "NEXT_PUBLIC_SITE_ORIGIN",
  "NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN",
  "NEXT_PUBLIC_QUANTOS_BFF_ORIGIN",
  "NEXT_PUBLIC_QUANTOS_OIDC_ISSUER",
  "NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID",
  "NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI",
  "NEXT_PUBLIC_QUANTOS_DEFAULT_MODE",
  "NEXT_PUBLIC_QUANTOS_MOCK_ENABLED",
  "NEXT_PUBLIC_QUANTOS_OBS_ENABLED",
  "NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET",
] as const;

const OPTIONAL_PUBLIC_KEYS = ["NEXT_PUBLIC_QUANTOS_SENTRY_DSN"] as const;
const ALLOWED_PUBLIC_KEYS = new Set<string>([...REQUIRED_PUBLIC_KEYS, ...OPTIONAL_PUBLIC_KEYS]);
const BOOLEAN_KEYS = ["NEXT_PUBLIC_QUANTOS_MOCK_ENABLED", "NEXT_PUBLIC_QUANTOS_OBS_ENABLED"] as const;

/** server secret 指纹：key 命中即拒绝出现在 NEXT_PUBLIC_ 变量中 */
const SECRET_KEY_PATTERN = /(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|APIKEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SESSION_KEY|SIGNING)/i;
export interface EnvIssue {
  key: string;
  reason: string;
}

export interface EnvValidationResult {
  ok: boolean;
  issues: EnvIssue[];
}

export function validateEnv(vars: Record<string, string | undefined>): EnvValidationResult {
  const issues: EnvIssue[] = [];
  const get = (k: string) => (vars[k] ?? "").trim();

  // Do not validate a trimmed value while Next/client code consumes the raw one.
  for (const [key, raw] of Object.entries(vars)) {
    if (key.startsWith(PUBLIC_PREFIX) && raw !== undefined && raw !== raw.trim()) {
      issues.push({ key, reason: "公开变量必须使用规范原值，不允许首尾空白" });
    }
  }

  // 1) 必需变量 fail-fast
  for (const key of REQUIRED_PUBLIC_KEYS) {
    if (!get(key)) issues.push({ key, reason: "缺少必需变量（fail-fast）" });
  }

  // 2) 环境/mode 分离
  const env = get("NEXT_PUBLIC_QUANTOS_ENV");
  if (env && !(RUNTIME_ENVS as readonly string[]).includes(env)) {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_ENV", reason: `非法环境，允许值：${RUNTIME_ENVS.join("/")}` });
  }
  const mode = get("NEXT_PUBLIC_QUANTOS_DEFAULT_MODE");
  if (mode && !(RUNTIME_MODES as readonly string[]).includes(mode)) {
    issues.push({
      key: "NEXT_PUBLIC_QUANTOS_DEFAULT_MODE",
      reason: `非法默认 mode；仅允许 ${RUNTIME_MODES.join("/")}，Assisted/Guarded Live 不可作默认值`,
    });
  }

  for (const key of BOOLEAN_KEYS) {
    const value = get(key);
    if (value && value !== "true" && value !== "false") {
      issues.push({ key, reason: '只允许字符串 "true" 或 "false"' });
    }
  }

  const url = (key: string): URL | undefined => {
    const value = get(key);
    if (!value) return undefined;
    try {
      const parsed = new URL(value);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) {
        issues.push({ key, reason: "URL 不得包含凭据、query 或 fragment" });
      }
      return parsed;
    } catch {
      issues.push({ key, reason: "必须是绝对 URL" });
      return undefined;
    }
  };
  const siteOrigin = url("NEXT_PUBLIC_SITE_ORIGIN");
  const terminalOrigin = url("NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN");
  const bffOrigin = url("NEXT_PUBLIC_QUANTOS_BFF_ORIGIN");
  const oidcIssuer = url("NEXT_PUBLIC_QUANTOS_OIDC_ISSUER");
  const oidcRedirect = url("NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI");

  for (const [key, parsed] of [
    ["NEXT_PUBLIC_SITE_ORIGIN", siteOrigin],
    ["NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN", terminalOrigin],
    ["NEXT_PUBLIC_QUANTOS_BFF_ORIGIN", bffOrigin],
    ["NEXT_PUBLIC_QUANTOS_OIDC_ISSUER", oidcIssuer],
  ] as const) {
    if (parsed && !["http:", "https:"].includes(parsed.protocol)) {
      issues.push({ key, reason: "Web 环境只允许 http/https URL" });
    }
  }
  for (const [key, parsed] of [
    ["NEXT_PUBLIC_SITE_ORIGIN", siteOrigin],
    ["NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN", terminalOrigin],
    ["NEXT_PUBLIC_QUANTOS_BFF_ORIGIN", bffOrigin],
    ["NEXT_PUBLIC_QUANTOS_OIDC_ISSUER", oidcIssuer],
  ] as const) {
    if (parsed && parsed.pathname !== "/") {
      issues.push({ key, reason: "必须是纯 origin，不得包含路径" });
    }
  }
  if (oidcRedirect && !["http:", "https:"].includes(oidcRedirect.protocol)) {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI", reason: "第一期 Web callback 只允许 http/https URL" });
  }
  if (terminalOrigin && oidcRedirect) {
    const expected = `${terminalOrigin.origin}/auth/callback`;
    if (get("NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI") !== expected) {
      issues.push({
        key: "NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI",
        reason: `必须与 Terminal origin 同源并精确指向 ${expected}`,
      });
    }
  }

  // 3) 环境特定约束
  if (env === "staging") {
    if (get("NEXT_PUBLIC_QUANTOS_MOCK_ENABLED") === "true") {
      issues.push({ key: "NEXT_PUBLIC_QUANTOS_MOCK_ENABLED", reason: "staging 禁止开启 mock" });
    }
    for (const [key, parsed] of [
      ["NEXT_PUBLIC_SITE_ORIGIN", siteOrigin],
      ["NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN", terminalOrigin],
      ["NEXT_PUBLIC_QUANTOS_BFF_ORIGIN", bffOrigin],
      ["NEXT_PUBLIC_QUANTOS_OIDC_ISSUER", oidcIssuer],
      ["NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI", oidcRedirect],
    ] as const) {
      if (parsed && parsed.protocol !== "https:") {
        issues.push({ key, reason: "staging Web URL 必须使用 https" });
      }
    }
  }
  const dsn = get("NEXT_PUBLIC_QUANTOS_SENTRY_DSN");
  if (get("NEXT_PUBLIC_QUANTOS_OBS_ENABLED") === "true" && !dsn) {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_SENTRY_DSN", reason: "开启观测时必须配置 HTTPS 公网 DSN" });
  }
  // Validate any configured DSN, even while observation is disabled.
  if (dsn) {
    try {
      const parsed = new URL(dsn);
      if (parsed.protocol !== "https:" || !parsed.hostname || !parsed.username || parsed.password ||
          parsed.search || parsed.hash || !/^\/\d+$/.test(parsed.pathname)) throw new Error("invalid public DSN");
    } catch {
      issues.push({ key: "NEXT_PUBLIC_QUANTOS_SENTRY_DSN", reason: "DSN 必须是无密码/query/fragment的 HTTPS 公网 DSN，路径为项目编号" });
    }
  }
  if (env === "local-mock" && get("NEXT_PUBLIC_QUANTOS_MOCK_ENABLED") !== "true") {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_MOCK_ENABLED", reason: "local-mock 环境必须 NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=true" });
  }
  if (env === "local-integrated" && get("NEXT_PUBLIC_QUANTOS_MOCK_ENABLED") !== "false") {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_MOCK_ENABLED", reason: "local-integrated 环境必须 NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=false" });
  }

  // 4) Assisted Live testnet flag：默认 off；开启只允许显式记录（M5 评审准备）
  const al = get("NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET");
  if (al && al !== "off" && al !== "on") {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET", reason: "只允许 off/on；开启必须经服务端 flag/capability 放行（L03）" });
  }

  const serverValues = serverSecretVariants(vars);

  // 5) server secret 负向扫描：进入 bundle 的变量（NEXT_PUBLIC_）不得含 secret 指纹
  for (const [key, raw] of Object.entries(vars)) {
    if (!key.startsWith(PUBLIC_PREFIX) || raw === undefined || raw === "") continue;
    if (!ALLOWED_PUBLIC_KEYS.has(key)) {
      issues.push({ key, reason: "不在客户端公开变量 allowlist，禁止进入 bundle" });
      continue;
    }
    if (SECRET_KEY_PATTERN.test(key)) {
      issues.push({ key, reason: "key 命中 server-secret 指纹，禁止进入客户端 bundle" });
      continue;
    }
    const v = raw.trim();
    if (secretFingerprints(v).length || serverValues.some(value => v.includes(value))) {
      issues.push({ key, reason: "value 命中已知凭据指纹，禁止进入客户端配置" });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** 启动期 fail-fast：任一问题即抛出完整清单。 */
export function assertEnv(vars: Record<string, string | undefined>): void {
  const result = validateEnv(vars);
  if (!result.ok) {
    const lines = result.issues.map((i) => `  - ${i.key}: ${i.reason}`).join("\n");
    throw new Error(`[quantos-config] 环境配置校验失败（fail-fast）：\n${lines}`);
  }
}

/** Reviewed template identity; these identifiers are placeholders, not live accounts. */
export const E2E_ROLES = ["RESEARCHER", "TRADER", "APPROVER", "ADMIN"] as const;
export function validateEnvExample(profile: EnvProfile, vars: Record<string, string | undefined>): EnvValidationResult {
  const result = validateEnv(vars);
  const issues = [...result.issues];
  if (vars.NEXT_PUBLIC_QUANTOS_ENV !== profile) issues.push({ key: "NEXT_PUBLIC_QUANTOS_ENV", reason: "模板文件与指定 profile 不匹配" });
  const identityKeys = E2E_ROLES.map(role => `QUANTOS_E2E_ACCOUNT_${role}`);
  for (const [key, value] of Object.entries(vars)) {
    if (!key.startsWith(PUBLIC_PREFIX) && !(profile === "staging" && identityKeys.includes(key))) {
      issues.push({ key, reason: "Web 模板只能包含已审核公开配置及 staging 四类测试身份" });
    }
    if (identityKeys.includes(key) && value && secretFingerprints(value).length) {
      issues.push({ key, reason: "测试身份标识不得包含凭据" });
    }
  }
  if (profile === "staging") for (const role of E2E_ROLES) {
    const key = `QUANTOS_E2E_ACCOUNT_${role}`;
    if (vars[key] !== `e2e-${role.toLowerCase()}@staging.sumalpha.ai`) {
      issues.push({ key, reason: "模板必须保留对应角色的非敏感 staging 占位标识；真实身份由目标环境注入" });
    }
  }
  return { ok: !issues.length, issues };
}
