"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  exchangeCode,
  sanitizeReturnPath,
  AuthError,
  type OidcConfig,
  type PendingAuth,
} from "../../../src/auth/flow";
import { AuthBrand, AuthCard, AuthPageShell } from "../../_components/auth-surface";

const config: OidcConfig = {
  issuer: process.env.NEXT_PUBLIC_QUANTOS_OIDC_ISSUER ?? "https://mock.idp.local",
  clientId: process.env.NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID ?? "quantos-terminal-local",
  redirectUri:
    process.env.NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI ??
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "http://localhost:3100/auth/callback"),
};

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const authError = searchParams.get("error");
      window.history.replaceState({}, "", "/auth/callback");
      if (authError) {
        // 回调错误写认证审计（服务端）；客户端不展示敏感细节，URL 不含 token
        setError("登录未完成或已取消。请重新尝试登录。");
        return;
      }
      const code = searchParams.get("code") ?? "";
      const state = searchParams.get("state") ?? "";
      const raw = sessionStorage.getItem("quantos.auth.pending");
      sessionStorage.removeItem("quantos.auth.pending");
      if (!raw) {
        setError("认证会话已失效，请重新登录。");
        return;
      }
      let pending: PendingAuth;
      try {
        pending = JSON.parse(raw) as PendingAuth;
      } catch {
        setError("认证会话已失效，请重新登录。");
        return;
      }
      try {
        const session = await exchangeCode(config, pending, code, state);
        const safeReturn = sanitizeReturnPath(pending.returnTo);
        router.replace(session.mfaRequired ? `/mfa?return_to=${encodeURIComponent(safeReturn)}` : safeReturn);
      } catch (e) {
        setError(e instanceof AuthError ? e.message : "登录交换失败，请重试。");
      }
    };
    void run();
  }, []);

  return <AuthPageShell><AuthCard className="status-auth-card"><div data-smoke="route-/auth/callback"><AuthBrand />{error ? <><div className="status-icon danger" aria-hidden="true">×</div><h1>登录失败</h1><p className="auth-lead" role="alert">{error}</p><a className="auth-primary auth-link-button" href="/login">返回登录</a></> : <><div className="auth-loader" aria-hidden="true" /><h1>正在完成登录</h1><p className="auth-lead" role="status">正在建立安全会话，请勿关闭此页面…</p></>}</div></AuthCard></AuthPageShell>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
