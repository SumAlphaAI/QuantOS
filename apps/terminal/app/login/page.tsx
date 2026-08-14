"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { beginAuth, type OidcConfig } from "../../src/auth/flow";

const config: OidcConfig = {
  issuer: process.env.NEXT_PUBLIC_QUANTOS_OIDC_ISSUER ?? "https://mock.idp.local",
  clientId: process.env.NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID ?? "quantos-terminal-local",
  redirectUri:
    process.env.NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI ??
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "http://localhost:3100/auth/callback"),
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const startLogin = async () => {
    setPending(true);
    setError(null);
    try {
      const { authorizeUrl, pending: p } = await beginAuth(config, searchParams.get("return_to"));
      // PKCE verifier/state 仅存 sessionStorage（会话级，回调后立即清除）
      sessionStorage.setItem("quantos.auth.pending", JSON.stringify(p));
      window.location.assign(authorizeUrl);
    } catch {
      setPending(false);
      setError("暂时无法发起登录。请重试；如果问题持续，请联系支持。");
    }
  };

  return (
    <main data-smoke="route-/login" style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>进入 QuantOS Terminal</h1>
      <p>使用你的组织账户继续。所有受控操作都会记录到审计轨迹。</p>
      <button type="button" onClick={startLogin} disabled={pending}>
        {pending ? "正在跳转…" : "使用组织账户继续（SSO）"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <small>安全 · 审计 · Paper/Shadow</small>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
