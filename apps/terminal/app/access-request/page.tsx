"use client";

import { useState } from "react";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";
import { AuthBffError, submitAccessRequest } from "../../src/auth/bff";

export default function AccessRequestPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ correlationId: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAccessRequest(process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "http://localhost:4010", {
        teamName: String(data.get("teamName") ?? ""), contactEmail: String(data.get("contactEmail") ?? ""), purpose: String(data.get("purpose") ?? ""),
        markets: [String(data.get("market") ?? "digital-assets")], expectedMode: "paper", privacyNoticeVersion: "2026-08-15",
      });
      setAccepted({ correlationId: result.correlationId });
    } catch (reason) {
      setError(reason instanceof AuthBffError && reason.status === 429 ? `申请提交过于频繁，请稍后重试。${reason.retryAfter ? ` 建议等待 ${reason.retryAfter} 秒。` : ""}` : "暂时无法提交申请。请检查输入后重试。");
    } finally { setPending(false); }
  }

  return <AuthPageShell><AuthCard className="access-card"><div data-smoke="route-/access-request"><AuthBrand />{accepted ? <div className="accepted-state"><div className="status-icon success">✓</div><h1>申请已受理</h1><p className="auth-lead">申请已进入审核队列，这不代表访问权限已经开通。</p><code>{accepted.correlationId}</code><a className="auth-primary auth-link-button" href="/login">返回登录</a></div> : <><h1>申请访问 QuantOS Terminal</h1><form className="access-form" onSubmit={submit}><label>组织 / 公司<input name="teamName" placeholder="例如：SumAlpha Capital" required minLength={2} maxLength={100} /></label><label>工作邮箱<input name="contactEmail" type="email" placeholder="例如：name@company.com" required /></label><label>主要市场<select name="market" defaultValue="digital-assets"><option value="digital-assets">数字资产</option><option value="equities">股票</option><option value="futures">期货</option></select></label><label>使用场景 / 用途说明<textarea name="purpose" placeholder="请简要说明你希望如何使用 QuantOS Terminal" required minLength={20} maxLength={1000} /></label><button className="auth-primary" type="submit" disabled={pending}>{pending ? "正在提交…" : "提交申请"}</button></form>{error ? <p className="auth-error" role="alert">{error}</p> : null}<p className="auth-note">提交即表示你已阅读隐私说明。申请将被限速并进入审计记录。</p></>}</div></AuthCard></AuthPageShell>;
}
