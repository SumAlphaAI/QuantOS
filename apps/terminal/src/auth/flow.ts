import { createBffFetch } from "@sumalpha/api-client";
import { deriveCodeChallenge, generateCodeVerifier, generateState } from "./pkce";

export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
}

export interface PendingAuth {
  verifier: string;
  state: string;
  returnTo: string;
  issuedAt: number;
}

export interface Session {
  subject: string;
  establishedAt: string;
  expiresIn: number;
  mfaRequired?: boolean;
}

/** 会话仅内存持有（401 清内存态；浏览器不持久化长期 token）。 */
let currentSession: Session | null = null;
let sessionEpoch = 0;
export const sessionStore = {
  get: () => currentSession,
  set: (s: Session) => {
    sessionEpoch++;
    currentSession = s;
  },
  clear: () => {
    sessionEpoch++;
    currentSession = null;
  },
};

export type AuthHttpDecision =
  | { kind: "continue" }
  | { kind: "login"; route: string }
  | { kind: "concealed"; route: "/unauthorized" }
  | { kind: "maintenance"; route: "/maintenance" };

/**
 * Global HTTP auth policy. A 401 always clears the only client-side session
 * state before returning a sanitized login route. 403 and 404 deliberately
 * collapse to one surface so object existence is never disclosed.
 */
export function handleAuthHttpStatus(
  status: number,
  rawReturnPath?: string | null,
): AuthHttpDecision {
  if (status === 401) {
    sessionStore.clear();
    const target = sanitizeReturnPath(rawReturnPath);
    return { kind: "login", route: `/login?return_to=${encodeURIComponent(target)}` };
  }
  if (status === 403 || status === 404) {
    return { kind: "concealed", route: "/unauthorized" };
  }
  if (status >= 500) {
    return { kind: "maintenance", route: "/maintenance" };
  }
  return { kind: "continue" };
}

/** return path 仅允许站内路径，拒绝协议/宿主跳转与查询串中的敏感参数。 */
export function sanitizeReturnPath(path: string | null | undefined): string {
  if (!path) return "/command";
  if (!/^\/[A-Za-z0-9\-/]*$/.test(path)) return "/command";
  if (path.startsWith("//")) return "/command";
  return path;
}

export function buildAuthorizeUrl(config: OidcConfig, pending: PendingAuth, challenge: string): string {
  const url = new URL("/authorize", config.issuer);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", pending.state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function beginAuth(config: OidcConfig, returnTo: string | null): Promise<{ authorizeUrl: string; pending: PendingAuth }> {
  sessionStore.clear();
  const pending: PendingAuth = {
    verifier: generateCodeVerifier(),
    state: generateState(),
    returnTo: sanitizeReturnPath(returnTo),
    issuedAt: Date.now(),
  };
  const challenge = await deriveCodeChallenge(pending.verifier);
  return { authorizeUrl: buildAuthorizeUrl(config, pending, challenge), pending };
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const pendingAuthKey = "quantos.auth.pending";
export const pendingAuthLifetimeMs = 10 * 60 * 1000;

/** Consume before any asynchronous work, including provider rejection; never replay. */
export function consumePendingAuth(storage: Pick<Storage, "getItem" | "removeItem">): PendingAuth {
  sessionStore.clear();
  const raw = storage.getItem(pendingAuthKey);
  storage.removeItem(pendingAuthKey);
  return parsePendingAuth(raw);
}

function parsePendingAuth(raw: string | null): PendingAuth {
  try {
    const p = JSON.parse(raw ?? "null") as PendingAuth | null;
    if (!p || !/^[A-Za-z0-9._~-]{43,128}$/.test(p.verifier) ||
        !/^[a-f0-9]{32}$/.test(p.state) || typeof p.returnTo !== "string" ||
        !Number.isFinite(p.issuedAt) || p.issuedAt > Date.now() ||
        Date.now() - p.issuedAt >= pendingAuthLifetimeMs) throw new Error();
    return { ...p, returnTo: sanitizeReturnPath(p.returnTo) };
  } catch {
    throw new AuthError("认证会话已失效，请重新登录。");
  }
}

/**
 * 回调交换：仅接受 code + 匹配 state；token 响应落内存，不进 URL/localStorage。
 * 失败抛 AuthError（安全可展示，不含敏感细节；审计 correlationId 透传）。
 */
export async function exchangeCode(
  config: OidcConfig,
  pending: PendingAuth,
  code: string,
  state: string,
  fetchImpl: typeof fetch = fetch,
  bffOrigin?: string,
): Promise<Session> {
  sessionStore.clear();
  const epoch = sessionEpoch;
  pending = parsePendingAuth(JSON.stringify(pending));
  if (!code) throw new AuthError("回调缺少授权码");
  if (state !== pending.state) throw new AuthError("认证状态不匹配，请重新登录");

  const boundedFetch = createBffFetch(fetchImpl, { timeoutMs: 15_000 });
  try {
    const res = await boundedFetch(new URL("/token", config.issuer).toString(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        code_verifier: pending.verifier,
      }),
    });
    if (!res.ok) {
      let correlationId: string | undefined;
      try {
        const body = (await res.json()) as { correlationId?: string };
        correlationId = body.correlationId;
      } catch {
        /* 保持安全默认 */
      }
      throw new AuthError("登录交换失败，请重试；若持续失败请联系支持", correlationId);
    }
    const body = (await res.json()) as { subject?: string; user?: { id?: string }; access_token?: string; expires_in?: number; mfa_required?: boolean };
    const subject = body.user?.id ?? body.subject;
    if (typeof subject !== "string" || !subject.trim() ||
        typeof body.expires_in !== "number" || !Number.isFinite(body.expires_in) || body.expires_in <= 0 ||
        (body.mfa_required !== undefined && typeof body.mfa_required !== "boolean")) {
      throw new AuthError("身份会话缺少必要字段，请重新登录。");
    }
    if (epoch !== sessionEpoch) throw new AuthError("认证会话已失效，请重新登录。");
    if (bffOrigin) {
      if (typeof body.access_token !== "string" || !body.access_token.trim()) {
        throw new AuthError("身份会话缺少必要字段，请重新登录。");
      }
      const established = await boundedFetch(`${bffOrigin}/v1/auth/session`, {
        method: "POST",
        credentials: "include",
        headers: { authorization: `Bearer ${body.access_token}` },
      });
      if (established.status !== 204) {
        throw new AuthError("服务端会话建立失败，请重新登录。");
      }
    }
    const session: Session = {
      subject,
      establishedAt: new Date().toISOString(),
      expiresIn: body.expires_in,
      mfaRequired: body.mfa_required === true,
    };
    if (epoch !== sessionEpoch) throw new AuthError("认证会话已失效，请重新登录。");
    sessionStore.set(session);
    return session;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("登录交换失败，请重试。");
  }
}
