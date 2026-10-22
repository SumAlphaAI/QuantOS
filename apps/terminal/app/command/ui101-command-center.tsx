"use client";

import "./p02.css";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TerminalFrame } from "@sumalpha/ui";
import { TerminalHeader, TerminalNavigation } from "@sumalpha/domain-ui/chrome";
import { ConnectionStatusBar, RiskPostureBadge } from "@sumalpha/domain-ui/indicators";
import { visibleShellNavigation, type ConnectionState, type FreshnessState, type RiskPosture } from "@sumalpha/domain-ui/ui101";
import type { CommandProjection, CommandSeverity } from "../../src/command/model";
import { commandNavigationCapabilities, commandItemPath, commandKindLabel, commandLayoutKey, parseCommandLayout, presentCommand, sourceLabel, sourceStateLabel, type CommandItem } from "../../src/command/presentation";
import { AuthIcon } from "../_components/auth-icon";

export interface CommandCenterProps { projection: CommandProjection; contractMode: "mocked" | "integrated"; onRefresh?: () => void }
function formatTime(raw?: string | null) {
  return raw && Number.isFinite(Date.parse(raw)) ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(raw)) : "时间未知";
}
function indicatorFreshness(state: FreshnessState): "live" | "delayed" | "stale" | "unavailable" { return state === "fresh" ? "live" : state === "unknown" ? "unavailable" : state; }
function indicatorRisk(posture: RiskPosture): string { return posture === "normal" ? "allow" : posture === "elevated" ? "approval_required" : posture === "critical" ? "deny" : posture; }
function Metric({ label, icon, value, children, asOf }: { label: string; icon: string; value: string | number | null; children: ReactNode; asOf?: string | null }) {
  return <article className="kpi-card"><span className={`kpi-icon ${icon}`} aria-hidden="true">{icon === "red" ? "!" : icon === "violet" ? "⌁" : "▤"}</span><div><h3>{label}</h3><strong>{value ?? "—"}</strong>{children}<small title={asOf ?? "来源未提供时间"}>截至 {formatTime(asOf)}</small></div></article>;
}
function ItemLink({ item, disabled }: { item: CommandItem; disabled: boolean }) {
  const path = commandItemPath(item);
  return !disabled && path ? <a href={path} aria-label={`查看${commandKindLabel[item.kind]} ${item.id}`}>查看 <span aria-hidden="true">›</span></a> : <span className="p02-disabled">只读缓存</span>;
}

export function CommandCenter({ projection, contractMode, onRefresh }: CommandCenterProps) {
  const view = useMemo(() => presentCommand(projection), [projection]);
  const summary = view.summary;
  const [layout, setLayout] = useState({ collapsed: false, compact: false });
  const [layoutStatus, setLayoutStatus] = useState("默认布局"), [showLayout, setShowLayout] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("live");
  const [priorityFilter, setPriorityFilter] = useState<"all" | CommandSeverity>("all");
  const [allPriority, setAllPriority] = useState(false), [allActivity, setAllActivity] = useState(false);
  useEffect(() => { try { const raw = localStorage.getItem(commandLayoutKey); setLayout(parseCommandLayout(raw)); if (raw) setLayoutStatus("已载入布局偏好"); } catch { setLayoutStatus("布局仅在本次会话保留"); } }, []);
  function saveLayout(next: typeof layout) {
    setLayout(next);
    try { localStorage.setItem(commandLayoutKey, JSON.stringify(next)); setLayoutStatus("布局已保存"); }
    catch { setLayoutStatus("无法保存布局，本次会话仍可用"); }
  }
  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () => { setConnection("reconnecting"); onRefresh?.(); };
    if (!navigator.onLine) offline();
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [onRefresh]);
  const offline = connection !== "live";
  const freshness = offline ? "stale" : view.freshness;
  const priority = view.priority.filter(item => priorityFilter === "all" || item.severity === priorityFilter);
  const navItems = visibleShellNavigation(commandNavigationCapabilities(projection.session.capabilities)).map(item => ({ ...item, badge: item.route === "/approvals" ? view.pendingApprovals ?? undefined : undefined }));
  const sourceTime = (domain: string) => view.sources.find(s => s.domain === domain)?.asOf;
  const age = view.ageAtSampleMs === null ? null : `${(view.ageAtSampleMs / 1000).toFixed(1)}s`;
  const empty = summary?.partial ? "可用授权来源暂无待办，部分来源尚不可用。" : "当前没有需要你处理的事项。";
  return <TerminalFrame collapsed={layout.collapsed} data-ui101-shell data-ui-p02 data-contract-mode={contractMode} className={`p02-shell${layout.compact ? " command-compact" : ""}`} mainClassName="command-main" mainMarker="route-/command"
    header={<TerminalHeader workspace={projection.session.workspaceLabel} account={projection.session.accountLabel} workspaceTitle={projection.session.workspaceId} accountTitle={projection.session.accountId} initials={projection.session.actorInitials} mode={projection.session.mode} collapsed={layout.collapsed} onToggle={() => saveLayout({ ...layout, collapsed: !layout.collapsed })} freshness={indicatorFreshness(freshness)} risk={indicatorRisk(view.risk)} notifications={null} readOnlyControls helpHref="#command-help" />}
    navigation={<TerminalNavigation items={navItems} activeRoute="/command" />}
    status={<><ConnectionStatusBar state={connection === "live" ? "connected" : connection} liveUpdates={false} locale="en" /><span>HTTP 快照 · 未订阅实时流</span><span title={summary?.sampledAt}>Sampled {formatTime(summary?.sampledAt)} UTC+08</span></>}
  >
    {offline ? <div className="offline-banner" role="alert">网络已断开或正在重新验证。当前为只读缓存，资源入口暂不可用；恢复连接后不会自动提交旧意图。</div> : null}
    {contractMode === "mocked" ? <div className="command-contract-banner" role="status">C02 Runtime Guard Mocked · 本地演示数据；不代表真实会话或当前业务状态。</div> : null}
    <div className="page-toolbar"><div><div className="breadcrumb"><span>Home</span><b>/</b><strong>Command</strong></div><h1>Command Center</h1><p>主工作区的研究、风险与运行状态。</p></div><div className="toolbar-actions"><span className="context-button" title="仅显示当前受权账户">{projection.session.accountLabel}</span><span className="p02-window">当前快照</span><button className="square-button" type="button" disabled={offline || !onRefresh} onClick={() => onRefresh?.()} aria-label="刷新">↻</button><button className="square-button" type="button" aria-label="布局设置" aria-expanded={showLayout} aria-controls="command-layout" onClick={() => setShowLayout(value => !value)}>⊞</button></div></div>
    {showLayout ? <section id="command-layout" className="p02-layout" aria-label="布局设置"><label><input type="checkbox" checked={layout.compact} onChange={e => saveLayout({ ...layout, compact: e.target.checked })} /> 紧凑布局</label><button type="button" onClick={() => saveLayout({ collapsed: false, compact: false })}>恢复默认布局</button><p role="status">{layoutStatus} · 仅保存显示偏好</p></section> : null}
    <section className="mode-banner" aria-label="当前运行模式"><span aria-hidden="true"><AuthIcon kind="shield" /></span><strong>{projection.session.mode.toUpperCase()}</strong><i>·</i><span>{projection.session.mode === "research" ? "仅研究。不会向交易所提交订单。" : projection.session.mode === "shadow" ? "影子运行。不会向交易所提交订单。" : "模拟账本。不会向交易所提交订单。"}</span><span className="mode-risk"><RiskPostureBadge posture={indicatorRisk(view.risk)} reason={contractMode === "mocked" ? projection.risk.reason : undefined} locale="en" /></span></section>
    {!summary || summary.partial || summary.bounded.truncated || freshness !== "fresh" ? <div className="p02-data-notice" role="status">{!summary ? "汇总数据不可用，未展示任何默认业务数值。" : `${summary.partial ? "部分来源不可用；" : ""}${freshness !== "fresh" ? "数据陈旧或未知；" : ""}${summary.bounded.truncated ? "结果已截断；" : ""}仅显示当前账户已授权的服务端快照，请刷新核验。`}</div> : null}
    <div className="overview-grid">
      <section className="panel priority-panel" aria-labelledby="priority-heading"><div className="panel-heading"><h2 id="priority-heading">优先处理</h2><div className="segmented" aria-label="优先级筛选">{(["all", "critical", "warning", "info"] as const).map(filter => <button key={filter} className={priorityFilter === filter ? "selected" : ""} type="button" aria-pressed={priorityFilter === filter} onClick={() => { setPriorityFilter(filter); setAllPriority(false); }}>{filter === "all" ? "全部" : `${filter === "critical" ? "严重" : filter === "warning" ? "警告" : "信息"} ${view.priority.filter(item => item.severity === filter).length}`}</button>)}</div></div>
        <div className="priority-list" aria-live="polite">{priority.length ? priority.slice(0, allPriority ? 50 : 3).map(item => <div className="priority-row" key={`${item.kind}-${item.id}`}><span className={`alert-symbol ${item.severity}`} aria-hidden="true">{item.severity === "warning" ? "△" : "!"}</span><strong className={item.severity}>{commandKindLabel[item.kind]}</strong><span title={item.objectRef}>{item.status} · {item.id.slice(0, 8)}…</span><code title={item.occurredAt ?? "服务端未提供时间"}>{formatTime(item.occurredAt)}</code><ItemLink item={item} disabled={offline} /></div>) : <div className="empty-row">{empty}</div>}</div>
        <button className="panel-link" type="button" disabled={!priority.length} onClick={() => setAllPriority(value => !value)}>{allPriority ? "收起待办" : `查看全部待办（${priority.length}）`} <span aria-hidden="true">›</span></button>
      </section>
      <section className="panel health-panel" aria-labelledby="health-heading"><div className="panel-heading"><h2 id="health-heading">系统健康</h2><span className="p02-health-state">{view.systemHealth ?? "未知"}</span></div><div className="health-head"><span>来源</span><span>状态</span><span>延迟/性能</span><span>可用性</span><span>来源时间</span></div>
        {view.sources.map(source => <div className="health-row" key={source.domain}><span>{sourceLabel[source.domain]}</span><span className={source.status === "ready" ? "healthy" : "degraded"}><span className={`status-dot ${source.status === "ready" ? "good" : "warn"}`} aria-hidden="true" />{sourceStateLabel[source.status]}</span><span title="数据来源未提供延迟">—</span><span title="数据来源未提供可用率">—</span><code title={source.asOf ?? "来源未提供时间"}>{formatTime(source.asOf)}</code></div>)}
        {!view.sources.length ? <p className="empty-row">暂无可展示的授权来源。</p> : null}
        {view.visible("operations") && !offline ? <a className="panel-link" href="/operations">打开 Operations <span aria-hidden="true">›</span></a> : <p className="p02-disabled">Operations 入口不可用</p>}
      </section>
    </div>
    <section className="kpi-grid" aria-label="关键状态">
      {view.visible("execution") ? <Metric label="数据新鲜度" icon="cyan" value={age} asOf={summary?.asOf}><p className={freshness === "fresh" ? "good" : "bad"}>{freshness}</p><p className="p02-metric-note">采样时数据年龄</p></Metric> : null}
      {view.visible("operations") ? <Metric label="开放风险" icon="red" value={view.openRiskAlerts} asOf={sourceTime("operations")}><p className={view.risk === "normal" ? "good" : view.risk === "elevated" ? "warn" : "bad"}>{view.risk}</p></Metric> : null}
      {view.visible("execution") ? <Metric label="订单状态" icon="cyan" value={view.orders?.submitted ?? null} asOf={sourceTime("execution")}><p className="cyan-text">{view.orders?.filled ?? "—"} Filled · {view.orders?.rejected ?? "—"} Rejected</p><p className="p02-metric-note">已提交订单 · {projection.session.mode.toUpperCase()}</p></Metric> : null}
      {view.visible("research") ? <Metric label="运行任务" icon="violet" value={view.runningRuns} asOf={sourceTime("research")}><p className="bad">{view.failedRuns ?? "—"} Failed</p></Metric> : null}
    </section>
    <div className="bottom-grid">
      <section className="panel activity-panel" aria-labelledby="activity-heading"><div className="panel-heading"><h2 id="activity-heading">最近活动</h2></div><div className="activity-table" role="table" aria-label="最近活动"><div className="activity-row activity-head" role="row"><span role="columnheader">时间</span><span role="columnheader">Actor</span><span role="columnheader">对象</span><span role="columnheader">状态</span><span role="columnheader">对象 ID</span><span role="columnheader">详情</span></div>{view.activity.slice(0, allActivity ? 50 : 5).map(item => <div className="activity-row" role="row" key={`${item.kind}-${item.id}`}><code role="cell" title={item.occurredAt ?? "服务端未提供时间"}>{formatTime(item.occurredAt)}</code><span role="cell" title="数据来源未提供Actor">—</span><span role="cell" title={item.objectRef}>{commandKindLabel[item.kind]}</span><span role="cell"><b className={`activity-state ${item.severity === "critical" ? "warning" : "neutral"}`}>{item.status}</b></span><code role="cell" title={item.id}>{item.id.slice(0, 8)}…</code><span role="cell"><ItemLink item={item} disabled={offline} /></span></div>)}</div>{!view.activity.length ? <p className="p02-empty-activity">当前可用授权来源暂无活动。</p> : null}<button className="panel-link" type="button" disabled={!view.activity.length} onClick={() => setAllActivity(value => !value)}>{allActivity ? "收起活动" : `查看全部活动（${view.activity.length}）`} <span aria-hidden="true">›</span></button></section>
      <section className="panel quick-panel" aria-labelledby="quick-heading"><div className="panel-heading"><h2 id="quick-heading">快速开始</h2></div>
        {view.visible("research") ? <button className="quick-action high-risk-action" type="button" disabled title="研究创建在后续研究模块提供，本页仅监控"><span aria-hidden="true">♙</span><strong>发起研究<small>进入研究模块后重新验证创建权限</small></strong><i aria-hidden="true">›</i></button> : null}
        {view.visible("strategy") ? <button className="quick-action high-risk-action" type="button" disabled title="策略创建在后续策略模块提供，本页仅监控"><span aria-hidden="true">▧</span><strong>创建策略草稿<small>进入策略模块后重新验证写权限</small></strong><i aria-hidden="true">›</i></button> : null}
        <div className="quick-links">{view.visible("research") && !offline ? <a href="/research">查看研究 ›</a> : null}{projection.session.capabilities.includes("audit:read") && !offline ? <a href="/audit">打开审计 ›</a> : null}</div><p className="layout-saved" role="status">只读监控 · {layoutStatus}</p>
      </section>
    </div>
    {summary ? <p className="p02-bounds">{summary.bounded.truncated ? "部分结果已截断。" : ""}每类最多展示 {summary.bounded.itemLimit} 项；数据为服务端有界快照，空列表不代表完整历史为空。</p> : null}
    <details id="command-help" className="p02-help"><summary>Command 数据与操作说明</summary><p>本页只读。各卡片按当前权限与数据来源状态展示；未知数值显示 —，零值保留。数据来源未提供操作人、请求关联 ID、服务延迟或可用率时保持未知。资源链接仅供安全导航，目标模块仍须重新鉴权；创建研究与策略的业务流程由后续页面交付。</p></details>
  </TerminalFrame>;
}
