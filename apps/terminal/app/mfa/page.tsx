"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useIdentityAction } from "../_components/use-identity-action";
import { AuthIcon } from "../_components/auth-icon";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";
import { AuthBffError, completeLoginMfa } from "../../src/auth/bff";
import { handleAuthHttpStatus, sanitizeReturnPath } from "../../src/auth/flow";

function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const action = useIdentityAction();
  const [error, setError] = useState("");
  useEffect(() => { if (!action.disabled && (error || action.error)) refs.current[0]?.focus(); }, [action.disabled, error, action.error]);

  function updateDigit(index: number, raw: string) {
    if (action.disabled) return;
    if (/^\d{6}$/.test(raw)) { setDigits(raw.split("")); refs.current[5]?.focus(); return; }
    const value = raw.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, position) => position === index ? value : digit));
    if (value && index < 5) refs.current[index + 1]?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (action.disabled) return;
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) {
      setError("请输入完整的六位验证码。");
      refs.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setError("");
    const result = await action.run(async signal => {
    try {
      const origin = process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "http://localhost:4010";
      const csrfToken = document.cookie.match(/(?:^|; )quantos_csrf=([^;]+)/)?.[1];
      if (!csrfToken) throw new AuthBffError("安全会话已失效，请重新登录。", 403);
      return await completeLoginMfa(origin, code, decodeURIComponent(csrfToken), fetch, { signal, timeoutMs: 15_000 });
    } catch (reason) {
      if (reason instanceof AuthBffError && reason.status === 401) {
        const decision = handleAuthHttpStatus(401, searchParams.get("return_to"));
        if (decision.kind === "login") router.replace(decision.route);
        return;
      }
      throw reason;
    }
    });
    setDigits(["", "", "", "", "", ""]);
    refs.current[0]?.focus();
    if (result) {
      if (result.status !== "verified") {
        setError("验证码无效或已失效，请重新获取后再试。");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
        return;
      }
      router.replace(sanitizeReturnPath(searchParams.get("return_to")));
    }
  }

  return <AuthPageShell><AuthCard className="mfa-card"><div data-smoke="route-/mfa"><AuthBrand /><div className="status-icon cyan" aria-hidden="true"><AuthIcon kind="mfa" /></div><h1>完成身份验证</h1><p className="auth-lead">请输入你的六位验证码以继续。</p><form onSubmit={submit} aria-busy={action.pending}><div className="mfa-digits" onPaste={(event) => { if (action.disabled) return; const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (pasted.length === 6) { event.preventDefault(); setDigits(pasted.split("")); refs.current[5]?.focus(); } }}>{digits.map((digit, index) => <input key={index} ref={(node) => { refs.current[index] = node; }} value={digit} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`验证码第 ${index + 1} 位`} maxLength={index === 0 ? 6 : 1} disabled={action.disabled} />)}</div><button className="auth-primary" type="submit" disabled={action.disabled}>{action.pending ? "正在验证…" : action.remaining ? `请等待 ${action.remaining} 秒` : !action.online ? "离线，无法验证" : "验证并继续"}</button></form>{error || action.error ? <p className="auth-error" role="alert">{error || action.error}</p> : null}{action.uncertain ? <p className="identity-recovery">验证结果未知，请重新登录以核查会话状态。</p> : null}<a className="identity-back" href={`/login?return_to=${encodeURIComponent(sanitizeReturnPath(searchParams.get("return_to")))}`}>重新登录</a><p className="auth-note">ⓘ 为保护账户安全，请勿向他人泄露验证码。<br />验证码有效期与重试限制以身份服务的实际响应为准。</p></div></AuthCard></AuthPageShell>;
}

export default function MfaPage() { return <Suspense><MfaForm /></Suspense>; }
