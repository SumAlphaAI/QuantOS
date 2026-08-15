"use client";

import { useEffect, useRef, useState } from "react";
import type { BffComponents, BffOperations } from "@sumalpha/api-client";

type AccessRequest = BffOperations["submitAccessRequest"]["requestBody"]["content"]["application/json"];
type AccessAccepted = BffOperations["submitAccessRequest"]["responses"][202]["content"]["application/json"];
type ErrorEnvelope = BffComponents["schemas"]["ErrorEnvelope"];

const BFF_ORIGIN = (process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "").replace(/\/$/, "");
const PRIVACY_NOTICE_VERSION = "2026-08-15";

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
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    function syncNetworkState() {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      if (!nextOnline) activeRequest.current?.abort();
    }
    syncNetworkState();
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);
    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
      activeRequest.current?.abort();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    // honeypot：正常用户不可见；被填充则静默拒绝
    if (String(data.get("website") ?? "") !== "") return;
    if (!navigator.onLine) {
      setOnline(false);
      setError("网络已断开，申请尚未提交。恢复连接后可保留当前内容并重试。");
      return;
    }

    setPending(true);
    setError("");
    const controller = new AbortController();
    activeRequest.current = controller;
    const payload: AccessRequest = {
      teamName: String(data.get("teamName") ?? ""),
      contactEmail: String(data.get("contactEmail") ?? ""),
      purpose: String(data.get("purpose") ?? ""),
      markets: [String(data.get("market") ?? "digital-assets")],
      expectedMode: String(data.get("expectedMode") ?? "paper") as AccessRequest["expectedMode"],
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    };
    try {
      const response = await fetch(`${BFF_ORIGIN}/v1/access-requests`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (response.status === 202) {
        const body = (await response.json()) as AccessAccepted;
        setAccepted({ correlationId: body.correlationId });
        return;
      }
      let correlationId: string | undefined;
      let retryAfter: number | undefined;
      try {
        const body = (await response.json()) as Partial<ErrorEnvelope>;
        correlationId = body.correlationId;
        retryAfter = body.retryAfter;
      } catch {
        /* 保持安全默认 */
      }
      if (response.status === 429) {
        setError(`申请提交过于频繁，请稍后重试。${retryAfter ? `建议等待 ${retryAfter} 秒。` : ""}${correlationId ? `（参考号 ${correlationId}）` : ""}`);
      } else if (response.status === 422) {
        setError(`部分信息未通过校验，请检查后重试。${correlationId ? `（参考号 ${correlationId}）` : ""}`);
      } else {
        setError(`暂时无法提交申请，请稍后重试。${correlationId ? `（参考号 ${correlationId}）` : ""}`);
      }
    } catch {
      setError(navigator.onLine
        ? "网络异常，申请未提交。请检查连接后重试。"
        : "网络已断开，申请尚未提交。恢复连接后可保留当前内容并重试。");
    } finally {
      activeRequest.current = null;
      setPending(false);
    }
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
      <div className="hp-field" aria-hidden="true">
        <label>请勿填写<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="form-field">
        <span>组织 / 公司</span>
        <input name="teamName" placeholder="例如：SumAlpha Capital" required minLength={2} maxLength={100} autoComplete="organization" />
      </label>
      <label className="form-field">
        <span>工作邮箱</span>
        <input name="contactEmail" type="email" placeholder="name@company.com" required autoComplete="email" />
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
        <input type="checkbox" required />
        <span>
          我已阅读隐私说明：申请信息仅用于访问资格审核，审核行为将被记录；申请接口有速率限制。
          （隐私说明版本 {PRIVACY_NOTICE_VERSION}）
        </span>
      </label>
      <button className="btn btn-primary" type="submit" disabled={pending || !online}>
        {pending ? "正在提交…" : online ? "提交申请" : "离线，无法提交"}
      </button>
      {!online && !error ? <p className="form-error" role="alert">网络已断开，恢复连接后可保留当前内容并提交。</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
