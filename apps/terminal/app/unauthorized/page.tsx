"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";

function UnauthorizedContent() {
  const params = useSearchParams();
  const correlationId = params.get("correlation_id")?.match(/^[a-f0-9-]{16,64}$/i)?.[0] ?? "请从错误通知中复制关联 ID";
  async function copy() { if (correlationId.startsWith("请")) return; await navigator.clipboard.writeText(correlationId); }
  return <AuthPageShell><AuthCard className="status-auth-card"><div data-smoke="route-/unauthorized"><AuthBrand /><div className="status-icon danger" aria-hidden="true">×</div><h1>未找到或无权访问此资源</h1><p className="auth-lead">无法访问请求的内容。出于安全考虑，我们不会说明该资源是否存在。</p><div className="correlation-box"><span><small>关联 ID</small><code>{correlationId}</code></span><button type="button" onClick={copy} aria-label="复制关联 ID">▣</button></div><div className="status-actions"><a href="/command">返回 Terminal</a><a href="#support">联系管理员</a></div></div></AuthCard></AuthPageShell>;
}
export default function UnauthorizedPage() { return <Suspense><UnauthorizedContent /></Suspense>; }
