import type { CommandProjection } from "./model";

/**
 * C01 + C02-compatible local projection fixture. It is intentionally isolated
 * from the page component and replaced by the generated BFF adapter once
 * BFF-FE-002 publishes the command summary schema.
 */
export const ui101CommandFixture = {
  session: {
    actorId: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    workspaceId: "33333333-3333-4333-8333-333333333333",
    accountId: "44444444-4444-4444-8444-444444444444",
    workspaceLabel: "Primary workspace",
    accountLabel: "Paper Account 01",
    actorInitials: "AN",
    mode: "paper",
    environment: "staging",
    capabilities: [
      "command:read", "research:read", "strategy:read", "portfolio:read", "market:read",
      "trade:read", "performance:read", "proposal:read", "approval:read", "order:read",
      "audit:read", "operations:read", "admin:read",
    ],
    mfaState: "verified",
    expiresAt: "2099-08-16T10:42:08+08:00",
  },
  guard: { resourceAvailable: true, dataAvailable: true },
  freshness: { state: "fresh", asOf: "2026-08-14T10:42:08+08:00" },
  risk: { posture: "normal", reason: "主工作区风险规则正常" },
  priority: [
    { severity: "warning", label: "审批待办", summary: "策略 release-042 等待风险审批", age: "6 分钟", action: "查看审批" },
    { severity: "critical", label: "风险告警", summary: "BTCUSDT 数据新鲜度接近阈值", age: "2 分钟", action: "查看风险" },
    { severity: "critical", label: "失败任务", summary: "Research run-1842 执行失败", age: "corr-7f2a…", action: "查看任务" },
  ],
  services: [
    { name: "Market Data", status: "Healthy", tone: "healthy", latency: "1.2s", availability: 5 },
    { name: "Engine Runtime", status: "Degraded", tone: "degraded", latency: "P95 820ms", availability: 3 },
    { name: "Event Projection", status: "Healthy", tone: "healthy", latency: "0.8s", availability: 5 },
    { name: "Execution Gateway", status: "Healthy", tone: "healthy", latency: "12ms", availability: 5 },
  ],
  activity: [
    { time: "10:41:33", actor: "Jane Smith", object: "Research run-1842", status: "Completed", tone: "success", id: "corr-7f2a…", detail: "查看研究" },
    { time: "10:40:12", actor: "Mike Chen", object: "Artifact art-9c31", status: "Archived", tone: "neutral", id: "corr-8b4d…", detail: "查看工作" },
    { time: "10:38:55", actor: "Yuki Sato", object: "Strategy release-042", status: "Submitted", tone: "info", id: "corr-3d91…", detail: "查看策略" },
    { time: "10:37:21", actor: "Risk Manager", object: "release-042 风险审批", status: "Approval required", tone: "warning", id: "corr-1a7c…", detail: "查看审批" },
    { time: "10:36:08", actor: "Ops Bot", object: "Paper Order po-7f8d", status: "Filled", tone: "success", id: "corr-5e2b…", detail: "查看订单" },
  ],
} satisfies CommandProjection;
