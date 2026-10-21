"use client";

import { useId, type ReactNode } from "react";
import { translate, useOptionalI18n } from "../../i18n/I18nProvider";
import type { ComponentState } from "../DataGrid/DataGrid";

export interface EvidenceEvent { id: string; timestamp: string; actor: string; event: string; state: string; correlationId: string; details?: ReactNode }
export interface EvidenceTimelineProps { title: string; events: EvidenceEvent[]; state?: ComponentState; stateMessage?: string }
export function EvidenceTimeline({ title, events, state = "default", stateMessage }: EvidenceTimelineProps) {
  const titleId = useId(); const locale = useOptionalI18n()?.locale ?? "zh-CN";
  const effectiveState = state === "default" && events.length === 0 ? "empty" : state;
  return <section className="q-panel" aria-labelledby={titleId} aria-busy={state === "loading" || undefined}><header className="q-panel__header"><h2 className="q-panel__title" id={titleId}>{title}</h2></header>
    {effectiveState !== "default" ? <div className="q-state" role={effectiveState === "error" ? "alert" : "status"}><div className="q-state__content"><p className="q-state__title">{translate(locale, `ui.timeline.${effectiveState}`)}</p>{stateMessage ? <p className="q-state__message">{stateMessage}</p> : null}</div></div> : <ol className="q-timeline">{events.map((item) => <li className="q-timeline__item" key={item.id}><time className="q-timeline__time" dateTime={item.timestamp}>{item.timestamp}</time><div><p className="q-timeline__event">{item.event}</p><p className="q-timeline__meta">{item.actor} · {item.state}</p><p className="q-timeline__meta q-mono">Correlation ID: {item.correlationId}</p>{item.details ? <details><summary>{translate(locale, "ui.timeline.details")}</summary>{item.details}</details> : null}</div></li>)}</ol>}
  </section>;
}
