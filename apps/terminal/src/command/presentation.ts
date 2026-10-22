import type { BffComponents } from "@sumalpha/api-client";
import type { CommandProjection } from "./model";

type Summary = BffComponents["schemas"]["CommandSummary"];
export type CommandItem = Summary["priority"][number];
export type CommandDomain = Summary["sources"][number]["domain"];
export const commandKindLabel = { run: "研究任务", order: "订单", approval: "审批待办", alert: "风险告警" } as const;
export const sourceLabel = { research: "Research", execution: "Execution", operations: "Operations", strategy: "Strategy" } as const;
export const sourceStateLabel = { ready: "Ready", stale: "Stale", unavailable: "Unavailable", forbidden: "Forbidden" } as const;
const paths = { run: "/research/runs/", order: "/orders/", approval: "/approvals/", alert: "/operations/alerts/" } as const;
export function commandItemPath(item: CommandItem): string | undefined {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(item.id) && item.objectRef === paths[item.kind] + item.id ? item.objectRef : undefined;
}

/** C02 is authoritative. Capabilities only remove data; they never synthesize facts. */
export function presentCommand(projection: CommandProjection) {
  const summary = projection.summary;
  const caps = new Set(projection.session.capabilities);
  const allowed = {
    research: caps.has("research.read"), execution: caps.has("execution.operate"),
    operations: caps.has("ops.read"), strategy: caps.has("strategy.write") || caps.has("strategy.approve"),
  };
  const source = (domain: CommandDomain) => summary?.sources.find(s => s.domain === domain);
  const visible = (domain: CommandDomain) => allowed[domain] && source(domain)?.status !== "forbidden";
  const ready = (domain: CommandDomain) => visible(domain) && source(domain)?.status === "ready";
  const canReadItem = (row: CommandItem) => !!commandItemPath(row) && (row.kind === "run" ? ready("research") : row.kind === "order" ? ready("execution") : row.kind === "alert" ? ready("operations") : ready("execution") || ready("strategy"));
  const priority = summary?.priority.filter(canReadItem) ?? [], activity = summary?.recentActivity.filter(canReadItem) ?? [];
  return {
    summary, priority, activity, visible, ready,
    sources: summary?.sources.filter(s => visible(s.domain)) ?? [],
    risk: ready("execution") ? projection.risk.posture : "unknown" as const,
    freshness: summary ? projection.freshness.state : "unknown" as const,
    openRiskAlerts: ready("operations") ? summary?.openRiskAlerts ?? null : null,
    orders: ready("execution") ? summary?.orderSummary ?? null : null,
    runningRuns: ready("research") ? summary?.runningRuns ?? null : null,
    failedRuns: ready("research") ? summary?.failedRuns ?? null : null,
    pendingApprovals: ready("execution") && ready("strategy") ? summary?.pendingApprovals ?? null : null,
    systemHealth: ready("operations") ? summary?.systemHealth ?? null : null,
    // Age at sampling is not transport latency or live market freshness.
    ageAtSampleMs: summary?.asOf ? Math.max(0, Date.parse(summary.sampledAt) - Date.parse(summary.asOf)) : null,
  };
}

export const commandLayoutKey = "quantos.command.layout.v1";
export function parseCommandLayout(raw: string | null): { collapsed: boolean; compact: boolean } {
  try { const value = JSON.parse(raw ?? "null"); if (value && typeof value.collapsed === "boolean" && typeof value.compact === "boolean") return { collapsed: value.collapsed, compact: value.compact }; } catch { /* Layout is optional, never an authorization input. */ }
  return { collapsed: false, compact: false };
}

/** Navigation aliases are read destinations; target routes must reauthorize. */
export function commandNavigationCapabilities(capabilities: readonly string[]) {
  const result = new Set(capabilities);
  if (result.has("execution.operate")) for (const cap of ["trade:read", "order:read", "proposal:read", "approval:read"]) result.add(cap);
  if (result.has("strategy.write") || result.has("strategy.approve")) for (const cap of ["strategy:read", "approval:read", "proposal:read"]) result.add(cap);
  return [...result];
}
