"use client";

import { StateBadge, useOptionalI18n } from "@sumalpha/ui";
import type { CSSProperties } from "react";

export type IndicatorFreshnessState = "live" | "delayed" | "stale" | "unavailable";
export interface DataFreshnessIndicatorProps { state: IndicatorFreshnessState; asOf?: string; locale?: "en" | "zh-CN" }
export function DataFreshnessIndicator({ state, asOf, locale: explicitLocale }: DataFreshnessIndicatorProps) {
  const context = useOptionalI18n(); const locale = explicitLocale ?? context?.locale ?? "zh-CN";
  return <span className="q-row"><StateBadge state={state} locale={locale} />{asOf ? <span className="q-muted q-mono">as of <time dateTime={asOf}>{asOf}</time></span> : null}</span>;
}

export type IndicatorRiskPosture = "allow" | "deny" | "approval_required" | string;
export interface RiskPostureBadgeProps { posture: IndicatorRiskPosture; reason?: string; locale?: "en" | "zh-CN" }
const riskLabels: Record<string, string> = { allow: "允许", deny: "拒绝", approval_required: "需要审批" };
export function RiskPostureBadge({ posture, reason, locale: explicitLocale }: RiskPostureBadgeProps) {
  const context = useOptionalI18n(); const locale = explicitLocale ?? context?.locale ?? "zh-CN";
  const known = Object.hasOwn(riskLabels, posture);
  return <span className="q-row" data-blocking={!known || posture !== "allow"}><StateBadge state={posture} locale={locale} />{reason ? <span className="q-muted">{reason}</span> : null}</span>;
}

export type IndicatorConnectionState = "connected" | "reconnecting" | "offline";
export interface ConnectionStatusBarProps { liveUpdates?: boolean; state: IndicatorConnectionState | string; lastConnectedAt?: string; locale?: "en" | "zh-CN" }
const connectionCopy: Record<"en" | "zh-CN", Record<IndicatorConnectionState, { icon: string; title: string; detail: string }>> = { "zh-CN": {
  connected: { icon: "●", title: "连接正常", detail: "实时更新已启用" }, reconnecting: { icon: "▲", title: "正在重连", detail: "高风险操作暂时停用" }, offline: { icon: "■", title: "当前离线", detail: "仅显示只读缓存；创建、审批和交易操作已暂停" },
}, en: {
  connected: { icon: "●", title: "Connected", detail: "Live updates enabled" }, reconnecting: { icon: "▲", title: "Reconnecting", detail: "High-risk actions are temporarily disabled" }, offline: { icon: "■", title: "Offline", detail: "Read-only cache only; create, approve, and trade actions are paused" },
} };
export function ConnectionStatusBar({ state, lastConnectedAt, liveUpdates = true, locale: explicitLocale }: ConnectionStatusBarProps) {
  const context = useOptionalI18n(); const locale = explicitLocale ?? context?.locale ?? "zh-CN";
  const copy = connectionCopy[locale][Object.hasOwn(connectionCopy[locale], state) ? state as IndicatorConnectionState : "offline"]; const tone = state === "connected" ? "var(--q-success)" : state === "reconnecting" ? "var(--q-warning)" : "var(--q-danger)";
  return <div className="q-alert" role="status" aria-live="polite" style={{ "--q-alert-color": tone } as CSSProperties}><p className="q-alert__title"><span aria-hidden="true">{copy.icon}</span> {copy.title}</p><p className="q-alert__message">{state === "connected" && !liveUpdates ? (locale === "zh-CN" ? "只读投影；刷新时重新验证" : "Read-only snapshot; refresh revalidates") : copy.detail}{lastConnectedAt ? <> · {locale === "zh-CN" ? "上次连接" : "last connected"} <time dateTime={lastConnectedAt}>{lastConnectedAt}</time></> : null}</p></div>;
}
