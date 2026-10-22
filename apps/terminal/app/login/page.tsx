"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { beginAuth, type OidcConfig } from "../../src/auth/flow";
import { useIdentityAction } from "../_components/use-identity-action";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";

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
  const action = useIdentityAction();
  const starting = useRef(false);

  const startLogin = async () => {
    if (starting.current || !navigator.onLine) return;
    starting.current = true;
    setError(null);
    await action.run(async (signal) => {
    try {
      const { authorizeUrl, pending: p } = await beginAuth(config, searchParams.get("return_to"));
      if (signal.aborted || !navigator.onLine) { starting.current = false; return; }
      // PKCE verifier/state 仅存 sessionStorage（会话级，回调后立即清除）
      sessionStorage.setItem("quantos.auth.pending", JSON.stringify(p));
      window.location.assign(authorizeUrl);
    } catch {
      starting.current = false;
      setError("暂时无法发起登录。请重试；如果问题持续，请联系支持。");
    }
    });
  };

  return <AuthPageShell facts><AuthCard className="login-card"><div data-smoke="route-/login"><AuthBrand /><h1>进入 QuantOS Terminal</h1><p className="auth-lead">使用你的组织账户继续。所有受控操作都会记录到审计轨迹。</p><button className="auth-primary" type="button" onClick={startLogin} disabled={action.disabled || starting.current}>{action.pending ? <><span className="button-spinner" />正在跳转…</> : "使用组织账户继续"}</button>{!action.online ? <p role="status">网络已断开，恢复连接后请手动登录。</p> : null}{error ? <p className="auth-error" role="alert">{error}</p> : null}<div className="auth-separator"><span />或<span /></div><div className="login-links"><a href="/access-request">申请访问 ›</a><a href="#auth-support">需要帮助？ ›</a></div><div className="auth-assurance">▣ OIDC + PKCE · 安全会话</div></div></AuthCard></AuthPageShell>;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
