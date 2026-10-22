"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeReturnPath } from "../../src/auth/flow";
import { AuthIcon } from "../_components/auth-icon";
import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";

function OfflineContent() {
  const params = useSearchParams();
  const [online, setOnline] = useState(false);
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); addEventListener("online", update); addEventListener("offline", update); return () => { removeEventListener("online", update); removeEventListener("offline", update); }; }, []);
  return <AuthPageShell><AuthCard className="status-auth-card"><div data-smoke="route-/offline"><AuthBrand /><div className="status-icon amber" aria-hidden="true"><AuthIcon kind="offline" /></div><h1>{online ? "连接已恢复" : "连接已断开"}</h1><p className="auth-lead">{online ? "网络连接已经恢复。继续前仍会重新验证会话与页面权限。" : "连接已断开。仅可查看已有只读缓存；创建、审批和交易操作已暂停。"}</p><button className="auth-primary amber-button" type="button" onClick={() => { if (navigator.onLine) location.assign(`/login?return_to=${encodeURIComponent(sanitizeReturnPath(params.get("return_to")))}`); else setOnline(false); }}>{online ? "重新验证会话" : "重新连接"}</button><p className="auth-note">ⓘ 页面会感知网络状态变化。恢复后不会自动提交离线期间的旧意图。</p></div></AuthCard></AuthPageShell>;
}

export default function OfflinePage() { return <Suspense><OfflineContent /></Suspense>; }
