import type { CSSProperties, ReactNode } from "react";
const colors = { info: "var(--q-info)", success: "var(--q-success)", warning: "var(--q-warning)", danger: "var(--q-danger)" } as const;
export interface InlineAlertProps { tone?: keyof typeof colors; title: string; children?: ReactNode }
export function InlineAlert({ tone = "info", title, children }: InlineAlertProps) { return <div className="q-alert" role={tone === "danger" ? "alert" : "status"} style={{ "--q-alert-color": colors[tone] } as CSSProperties}><p className="q-alert__title">{title}</p>{children ? <div className="q-alert__message">{children}</div> : null}</div>; }
