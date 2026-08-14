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
      const pending = JSON.parse(raw) as PendingAuth;
      try {
        await exchangeCode(config, pending, code, state);
        router.replace(sanitizeReturnPath(pending.returnTo));
      } catch (e) {
        setError(e instanceof AuthError ? e.message : "登录交换失败，请重试。");
      }
    };
    void run();
  }, []);

  return (
    <main data-smoke="route-/auth/callback" style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      {error ? (
        <>
          <h1>登录失败</h1>
          <p role="alert">{error}</p>
          <a href="/login">返回登录</a>
        </>
      ) : (
        <p>正在完成登录…</p>
      )}
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
