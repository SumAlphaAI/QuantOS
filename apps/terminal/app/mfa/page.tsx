"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";
import { AuthBffError, completeLoginMfa } from "../../src/auth/bff";
import { sanitizeReturnPath } from "../../src/auth/flow";

function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function updateDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, position) => position === index ? value : digit));
    if (value && index < 5) refs.current[index + 1]?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) {
      setError("请输入完整的六位验证码。");
      refs.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setPending(true); setError("");
    try {
      const origin = process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "http://localhost:4010";
      const csrfToken = document.cookie.match(/(?:^|; )quantos_csrf=([^;]+)/)?.[1];
      if (!csrfToken) throw new AuthBffError("安全会话已失效，请重新登录。", 403);
      const result = await completeLoginMfa(origin, code, decodeURIComponent(csrfToken));
      if (result.status !== "verified") {
        setError("验证码无效或已失效，请重新获取后再试。");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
        return;
      }
      router.replace(sanitizeReturnPath(searchParams.get("return_to")));
    } catch (reason) {
      const retry = reason instanceof AuthBffError && reason.retryAfter ? ` 请在 ${reason.retryAfter} 秒后重试。` : "";
      setError(`验证码无效或已失效，请重试。${retry}`);
    } finally { setPending(false); }
  }

  return <AuthPageShell><AuthCard className="mfa-card"><div data-smoke="route-/mfa"><AuthBrand /><div className="status-icon cyan" aria-hidden="true">♢</div><h1>完成身份验证</h1><p className="auth-lead">请输入你的六位验证码以继续。</p><form onSubmit={submit}><div className="mfa-digits" onPaste={(event) => { const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (pasted.length === 6) { event.preventDefault(); setDigits(pasted.split("")); refs.current[5]?.focus(); } }}>{digits.map((digit, index) => <input key={index} ref={(node) => { refs.current[index] = node; }} value={digit} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`验证码第 ${index + 1} 位`} maxLength={1} disabled={pending} />)}</div><button className="auth-primary" type="submit" disabled={pending}>{pending ? "正在验证…" : "验证并继续"}</button></form>{error ? <p className="auth-error" role="alert">{error}</p> : null}<p className="auth-note">ⓘ 为保护账户安全，请勿向他人泄露验证码。<br />验证码有效期 5 分钟，5 次失败后将短暂锁定 10 分钟。</p></div></AuthCard></AuthPageShell>;
}

export default function MfaPage() { return <Suspense><MfaForm /></Suspense>; }
