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
/** value 指纹：常见密钥形态（允许 OIDC client id、Sentry 公网 DSN 等公开值） */
const SECRET_VALUE_PATTERNS = [
  /^sk-[A-Za-z0-9_-]{16,}$/, // generic secret key
  /^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/, // JWT
  /^-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^sbp_[A-Za-z0-9]{20,}$/, // Supabase service-role style
];

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

  // 1) 必需变量 fail-fast
  for (const key of REQUIRED_PUBLIC_KEYS) {
    if (!get(key)) issues.push({ key, reason: "缺少必需变量（fail-fast）" });
  }

  // 2) 环境/mode 分离
  const env = get("NEXT_PUBLIC_QUANTOS_ENV");
  if (env && !(RUNTIME_ENVS as readonly string[]).includes(env)) {
    issues.push({ key: "NEXT_PUBLIC_QUANTOS_ENV", reason: `非法环境 "${env}"，允许值：${RUNTIME_ENVS.join("/")}` });
  }
  const mode = get("NEXT_PUBLIC_QUANTOS_DEFAULT_MODE");
  if (mode && !(RUNTIME_MODES as readonly string[]).includes(mode)) {
    issues.push({
      key: "NEXT_PUBLIC_QUANTOS_DEFAULT_MODE",
      reason: `非法默认 mode "${mode}"；仅允许 ${RUNTIME_MODES.join("/")}，Assisted/Guarded Live 不可作默认值`,
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
    if (oidcRedirect.href.replace(/\/$/, "") !== expected) {
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
    if (get("NEXT_PUBLIC_QUANTOS_OBS_ENABLED") === "true") {
      const dsn = get("NEXT_PUBLIC_QUANTOS_SENTRY_DSN");
      if (!dsn) {
        issues.push({ key: "NEXT_PUBLIC_QUANTOS_SENTRY_DSN", reason: "staging 开启观测时必须配置 Sentry DSN（公网 DSN）" });
      } else {
        try {
          const parsed = new URL(dsn);
          if (parsed.protocol !== "https:" || !parsed.hostname || !parsed.username || parsed.password) {
            throw new Error("invalid public DSN");
          }
        } catch {
          issues.push({ key: "NEXT_PUBLIC_QUANTOS_SENTRY_DSN", reason: "必须是无密码的 HTTPS 公网 DSN" });
        }
      }
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
    if (SECRET_VALUE_PATTERNS.some((p) => p.test(v))) {
      issues.push({ key, reason: "value 命中 server-secret 指纹（JWT/私钥/service-role 形态）" });
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

/** 解析 KEY=VALUE 文本（供 CLI/测试复用，忽略注释与空行，支持可选引号）。 */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
