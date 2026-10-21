"use client";

import { useEffect, useRef, useState } from "react";
import { AccessSubmissionError, createAccessSubmission, PRIVACY_NOTICE_VERSION } from "../../src/access-request";

/**
 * 访问申请表单（C01 submitAccessRequest）。
 * 防滥用：客户端校验 + honeypot + pending 防重复；服务端限速（429）与审计为准。
 * 安全语义：202 只表示“已受理”，不暗示权限开通；错误文案不泄露内部细节。
 */
export function AccessRequestForm() {
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ correlationId?: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<ReturnType<typeof createAccessSubmission>>(undefined);
  const mounted = useRef(false), submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const request = createAccessSubmission({ origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, siteOrigin: location.origin, online: () => navigator.onLine });
    controller.current = request;
    function syncNetworkState() {
      setOnline(navigator.onLine);
      if (!navigator.onLine) request.cancel();
    }
    syncNetworkState(); window.addEventListener("online", syncNetworkState); window.addEventListener("offline", syncNetworkState);
    return () => { mounted.current = false; request.close(); controller.current = undefined; window.removeEventListener("online", syncNetworkState); window.removeEventListener("offline", syncNetworkState); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!controller.current || submitting.current || pending || uncertain) return;
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    // honeypot and consent are checked before any network request.
    const draft = { teamName: String(data.get("teamName") ?? ""), contactEmail: String(data.get("contactEmail") ?? ""), purpose: String(data.get("purpose") ?? ""), market: String(data.get("market") ?? ""), expectedMode: String(data.get("expectedMode") ?? ""), consent: data.get("consent") === "on", website: String(data.get("website") ?? "") };
    setPending(true); setError("");
    try {
      const receipt = await controller.current.submit(draft);
      if (mounted.current && receipt) setAccepted(receipt);
    } catch (reason) {
      if (mounted.current) { setError(reason instanceof AccessSubmissionError ? reason.message : "申请结果无法确认，请联系支持。"); setUncertain(reason instanceof AccessSubmissionError && reason.outcomeUnknown); }
    } finally { submitting.current = false; if (mounted.current) setPending(false); }
  }

  if (accepted) {
    return (
      <div className="accepted-panel" role="status">
        <h2 style={{ marginTop: 0 }}>申请已受理</h2>
        <p className="form-hint">
          你的申请已进入审核队列——这不代表访问权限已经开通。审核结果将通过你提供的工作邮箱通知。
        </p>
        {accepted.correlationId ? <code>受理编号 {accepted.correlationId}</code> : null}
      </div>
    );
  }

  return (
    <form className="form-panel" onSubmit={submit} data-smoke="website-access-form">
      <fieldset disabled={pending || uncertain} className="access-fields">
      <div className="hp-field" aria-hidden="true">
        <label>请勿填写<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="form-field">
        <span>组织 / 公司</span>
        <input name="teamName" placeholder="例如：SumAlpha Capital" required minLength={2} maxLength={100} autoComplete="organization" />
      </label>
      <label className="form-field">
        <span>工作邮箱</span>
        <input name="contactEmail" type="email" maxLength={254} placeholder="name@company.com" required autoComplete="email" />
      </label>
      <label className="form-field">
        <span>主要市场</span>
        <select name="market" defaultValue="digital-assets">
          <option value="digital-assets">数字资产</option>
          <option value="equities">股票</option>
          <option value="futures">期货</option>
        </select>
      </label>
      <label className="form-field">
        <span>预期模式</span>
        <select name="expectedMode" defaultValue="paper">
          <option value="research">Research</option>
          <option value="paper">Paper</option>
          <option value="shadow">Shadow</option>
        </select>
      </label>
      <label className="form-field">
        <span>使用场景 / 用途说明</span>
        <textarea name="purpose" placeholder="请简要说明团队规模、研究方向与预期使用模式（至少 20 字）" required minLength={20} maxLength={1000} />
      </label>
      <label className="consent-row">
        <input type="checkbox" name="consent" required />
        <span>
          我已阅读隐私说明：申请信息仅用于访问资格审核，审核行为将被记录；申请接口有速率限制。
          （隐私说明版本 {PRIVACY_NOTICE_VERSION}）
        </span>
      </label>
      </fieldset>
      <button className="btn btn-primary" type="submit" disabled={pending || !online || uncertain}>
        {pending ? "正在提交…" : online ? "提交申请" : "离线，无法提交"}
      </button>
      {uncertain ? <div className="form-hint"><p>此接口不提供幂等重放；恢复联网不会自动重提。请先向支持核查，重复提交可能产生重复申请。</p><button className="btn btn-ghost" type="button" disabled={!online || pending} onClick={() => { controller.current?.acknowledgeRetry(); setUncertain(false); setError(""); }}>已核查受理状态，允许重新提交</button></div> : null}
      {!online && !error ? <p className="form-error" role="alert">网络已断开，恢复连接后可保留当前内容并提交。</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
