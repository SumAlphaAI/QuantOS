import { StateBadge, designTokens } from "@sumalpha/ui";

/**
 * PRE-03 PoC：共享路由 /command。
 * Web（app.sumalpha.ai）与 Tauri Desktop 加载同一份构建产物打开此路由；
 * smoke 标记：data-smoke="route-/command"。
 */
export default function CommandPage() {
  const t = designTokens.color.dark;
  return (
    <main
      data-smoke="route-/command"
      style={{ background: t.surface["0"], color: t.text.primary, minHeight: "100vh", padding: 24 }}
    >
      <h1 style={{ fontSize: 24, lineHeight: "32px", fontWeight: 600 }}>Command Center</h1>
      <p style={{ color: t.text.secondary, fontSize: 14, lineHeight: "20px" }}>
        主工作区的研究、风险与运行状态。（PRE-03 双端加载 PoC）
      </p>
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <StateBadge state="running" label="运行中" />
        <StateBadge state="approval_required" label="需要审批" />
        <StateBadge state="stale" label="数据陈旧" />
      </div>
    </main>
  );
}
