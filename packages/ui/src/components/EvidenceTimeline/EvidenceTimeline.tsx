import type { ReactNode } from "react";
import type { ComponentState } from "../DataGrid/DataGrid";

export interface EvidenceEvent { id: string; timestamp: string; actor: string; event: string; state: string; correlationId: string; details?: ReactNode }
export interface EvidenceTimelineProps { title: string; events: EvidenceEvent[]; state?: ComponentState; stateMessage?: string }
const stateLabels: Record<Exclude<ComponentState, "default">, string> = { loading: "正在加载证据链", empty: "暂无证据事件", error: "证据链加载失败", unauthorized: "无权查看证据链", stale: "证据链数据已陈旧", offline: "离线缓存证据链" };
export function EvidenceTimeline({ title, events, state = "default", stateMessage }: EvidenceTimelineProps) {
  const effectiveState = state === "default" && events.length === 0 ? "empty" : state;
  return <section className="q-panel" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`} aria-busy={state === "loading" || undefined}><header className="q-panel__header"><h2 className="q-panel__title" id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2></header>
    {effectiveState !== "default" ? <div className="q-state" role={effectiveState === "error" ? "alert" : "status"}><div className="q-state__content"><p className="q-state__title">{stateLabels[effectiveState]}</p>{stateMessage ? <p className="q-state__message">{stateMessage}</p> : null}</div></div> : <ol className="q-timeline">{events.map((item) => <li className="q-timeline__item" key={item.id}><time className="q-timeline__time" dateTime={item.timestamp}>{item.timestamp}</time><div><p className="q-timeline__event">{item.event}</p><p className="q-timeline__meta">{item.actor} · {item.state}</p><p className="q-timeline__meta q-mono">Correlation ID: {item.correlationId}</p>{item.details ? <details><summary>查看证据详情</summary>{item.details}</details> : null}</div></li>)}</ol>}
  </section>;
}
