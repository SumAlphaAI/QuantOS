"use client";

import { useState } from "react";
import { AuthIcon } from "../_components/auth-icon";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";
import { useIdentityAction } from "../_components/use-identity-action";
import { accessPayload, privacyNoticeVersion, requestAccess } from "../../src/identity/action";

export default function AccessRequestPage() {
  const action = useIdentityAction();
  const [validation, setValidation] = useState("");
  const [accepted, setAccepted] = useState<{ correlationId: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.disabled || accepted) return;
    let body;
    try { body = accessPayload(new FormData(event.currentTarget)); setValidation(""); }
    catch { setValidation("请检查团队、工作邮箱、用途、市场、模式和隐私同意后重试。"); return; }
    const result = await action.run(signal => requestAccess(process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "http://localhost:4010", body, signal));
    if (result) setAccepted({ correlationId: result.correlationId });
  }

  return <AuthPageShell><AuthCard className="access-card"><div data-smoke="route-/access-request"><AuthBrand />{accepted ? <div className="accepted-state" role="status"><div className="status-icon success" aria-hidden="true">✓</div><h1>申请已受理</h1><p className="auth-lead">申请已进入审核队列，这不代表访问权限已经开通。</p><code>{accepted.correlationId}</code><a className="auth-primary auth-link-button" href="/login">返回登录</a></div> : <><div className="identity-access-icon"><AuthIcon kind="access" /></div><h1>申请访问 QuantOS Terminal</h1><form className="access-form" onSubmit={submit} aria-busy={action.pending}>
    <fieldset disabled={action.pending || action.uncertain} className="identity-fields">
      <div className="identity-honeypot" aria-hidden="true"><label>请勿填写<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label>组织 / 公司<input name="teamName" placeholder="例如：SumAlpha Capital" required minLength={2} maxLength={100} autoComplete="organization" /></label>
      <label>工作邮箱<input name="contactEmail" type="email" placeholder="例如：name@company.com" required maxLength={254} autoComplete="email" /></label>
      <div className="identity-selects"><label>主要市场<select name="market" defaultValue="digital-assets"><option value="digital-assets">数字资产</option><option value="equities">股票</option><option value="futures">期货</option></select></label>
      <label>预期模式<select name="expectedMode" defaultValue="paper"><option value="research">Research</option><option value="paper">Paper</option><option value="shadow">Shadow</option></select></label></div>
      <label>使用场景 / 用途说明<textarea name="purpose" placeholder="请简要说明你希望如何使用 QuantOS Terminal" required minLength={20} maxLength={1000} /></label>
      <label className="identity-consent"><input name="consent" type="checkbox" required /><span>我已阅读隐私说明，同意将申请信息用于访问资格审核。（版本 {privacyNoticeVersion}）</span></label>
    </fieldset>
    <button className="auth-primary" type="submit" disabled={action.disabled}>{action.pending ? "正在提交…" : !action.online ? "离线，无法提交" : action.remaining ? `请等待 ${action.remaining} 秒` : "提交申请"}</button></form>
    {validation || action.error ? <p className="auth-error" role="alert">{validation || action.error}</p> : null}
    {action.uncertain ? <div className="identity-recovery"><p>此接口不提供幂等重放。恢复联网不会自动重提；请先联系管理员核查受理状态。</p><button type="button" disabled={!action.online || action.pending} onClick={action.acknowledgeRetry}>已核查受理状态，允许重新提交</button></div> : null}
    <p className="auth-note">申请信息仅用于资格审核。接口限速并记录审计；受理不表示访问权限开通。</p></>}</div></AuthCard></AuthPageShell>;
}
