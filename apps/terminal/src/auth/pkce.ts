/**
 * OIDC + PKCE 工具（G0 未冻结项 #4 PoC）。
 * 约束（P01/6.3）：回调仅交换短期令牌；token 不进 URL、不持久化（仅内存）；
 * return path 必须经 sanitizeReturnPath 过滤，不得携带敏感参数。
 */

const VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(length = 64): string {
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (b) => VERIFIER_CHARS[b % VERIFIER_CHARS.length]).join("");
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateState(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  return Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
}
