import type { BffComponents } from "@sumalpha/api-client";
export const P02_NOW = "2026-10-22T02:42:08.000Z";
export const p02Time = (offset = 0) => new Date(Date.parse(P02_NOW) + offset).toISOString();
export const p02Context = () => ({ actorId: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222", workspaceId: "33333333-3333-4333-8333-333333333333", accountId: "44444444-4444-4444-8444-444444444444", mode: "paper" as const, environment: "dev" as const, capabilities: ["ops.read", "research.read", "execution.operate", "strategy.write", "audit:read"], mfaState: "verified" as const, expiresAt: p02Time(300_000) });
export function p02Item(index: number, kind: "run" | "order" | "approval" | "alert"): BffComponents["schemas"]["CommandItem"] {
  const id = "10000000-0000-4000-8000-" + String(index).padStart(12, "0");
  const prefix = { run: "/research/runs/", order: "/orders/", approval: "/approvals/", alert: "/operations/alerts/" };
  return { kind, id, severity: kind === "run" || kind === "alert" ? "critical" : kind === "approval" ? "warning" : "info", status: kind === "run" ? "failed" : kind === "order" ? "filled" : kind === "approval" ? "pending" : "open", occurredAt: kind === "approval" ? null : p02Time(-index * 10_000), objectRef: prefix[kind] + id };
}
export function p02Summary(): BffComponents["schemas"]["CommandSummary"] {
  return { accountId: p02Context().accountId, mode: "paper", sampledAt: P02_NOW, asOf: p02Time(-5000), expiresAt: p02Time(25_000), revision: "sha256:" + "a".repeat(64), partial: false, dataFreshness: "fresh", riskPosture: "elevated", systemHealth: "degraded", openRiskAlerts: 7, pendingApprovals: 2, runningRuns: 4, failedRuns: 1, orderSummary: { mode: "paper", submitted: 18, filled: 13, rejected: 1 }, priority: [p02Item(1, "approval"), p02Item(2, "alert"), p02Item(3, "run"), p02Item(4, "order")], recentActivity: Array.from({ length: 7 }, (_, i) => p02Item(i + 10, (["run", "order", "approval", "alert"] as const)[i % 4])), sources: (["research", "execution", "operations", "strategy"] as const).map((domain, i) => ({ domain, status: "ready", asOf: p02Time(-5000 + i * 1000), sourceHash: "sha256:" + "b".repeat(64) })), bounded: { sourceCount: 4, rowLimit: 2000, itemLimit: 50, truncated: false } };
}
