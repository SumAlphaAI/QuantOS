import { StateBadge } from "@sumalpha/ui";
import type { CSSProperties } from "react";

export type IndicatorFreshnessState = "live" | "delayed" | "stale" | "unavailable";
export interface DataFreshnessIndicatorProps { state: IndicatorFreshnessState; asOf?: string; locale?: "en" | "zh-CN" }
const freshnessLabels = { live: "实时", delayed: "延迟", stale: "陈旧", unavailable: "不可用" } as const;
export function DataFreshnessIndicator({ state, asOf, locale = "zh-CN" }: DataFreshnessIndicatorProps) {
  const label = locale === "zh-CN" ? freshnessLabels[state] : state;
  return <span className="q-row"><StateBadge state={state} label={label} locale={locale} />{asOf ? <span className="q-muted q-mono">as of <time dateTime={asOf}>{asOf}</time></span> : null}</span>;
}

export type IndicatorRiskPosture = "allow" | "deny" | "approval_required" | string;
export interface RiskPostureBadgeProps { posture: IndicatorRiskPosture; reason?: string; locale?: "en" | "zh-CN" }
const riskLabels: Record<string, string> = { allow: "允许", deny: "拒绝", approval_required: "需要审批" };
export function RiskPostureBadge({ posture, reason, locale = "zh-CN" }: RiskPostureBadgeProps) {
  const known = posture in riskLabels; const label = locale === "zh-CN" ? riskLabels[posture] : posture;
  return <span className="q-row" data-blocking={!known || posture !== "allow"}><StateBadge state={posture} label={label} locale={locale} />{reason ? <span className="q-muted">{reason}</span> : null}</span>;
}

export type IndicatorConnectionState = "connected" | "reconnecting" | "offline";
export interface ConnectionStatusBarProps { state: IndicatorConnectionState; lastConnectedAt?: string; locale?: "en" | "zh-CN" }
const connectionCopy: Record<"en" | "zh-CN", Record<IndicatorConnectionState, { icon: string; title: string; detail: string }>> = { "zh-CN": {
  connected: { icon: "●", title: "连接正常", detail: "实时更新已启用" }, reconnecting: { icon: "▲", title: "正在重连", detail: "高风险操作暂时停用" }, offline: { icon: "■", title: "当前离线", detail: "仅显示只读缓存；创建、审批和交易操作已暂停" },
}, en: {
  connected: { icon: "●", title: "Connected", detail: "Live updates enabled" }, reconnecting: { icon: "▲", title: "Reconnecting", detail: "High-risk actions are temporarily disabled" }, offline: { icon: "■", title: "Offline", detail: "Read-only cache only; create, approve, and trade actions are paused" },
} };
export function ConnectionStatusBar({ state, lastConnectedAt, locale = "zh-CN" }: ConnectionStatusBarProps) {
  const copy = connectionCopy[locale][state]; const tone = state === "connected" ? "var(--q-success)" : state === "reconnecting" ? "var(--q-warning)" : "var(--q-danger)";
  return <div className="q-alert" role="status" aria-live="polite" style={{ "--q-alert-color": tone } as CSSProperties}><p className="q-alert__title"><span aria-hidden="true">{copy.icon}</span> {copy.title}</p><p className="q-alert__message">{copy.detail}{lastConnectedAt ? <> · {locale === "zh-CN" ? "上次连接" : "last connected"} <time dateTime={lastConnectedAt}>{lastConnectedAt}</time></> : null}</p></div>;
}
