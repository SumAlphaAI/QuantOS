"use client";

import { useEffect, useMemo, useState } from "react";
import { TerminalFrame } from "@sumalpha/ui";
import { TerminalHeader, TerminalNavigation } from "@sumalpha/domain-ui/chrome";
import {
  ConnectionStatusBar,
  RiskPostureBadge,
} from "@sumalpha/domain-ui/indicators";
import {
  visibleShellNavigation,
  type ConnectionState,
  type FreshnessState,
  type RiskPosture,
} from "@sumalpha/domain-ui/ui101";
import type { CommandProjection, CommandSeverity } from "../../src/command/model";

export interface CommandCenterProps { projection: CommandProjection; contractMode: "mocked" | "integrated"; onRefresh?: () => void }

function StatusDot({ tone }: { tone: "good" | "warn" | "bad" }) {
  return <span className={`status-dot ${tone}`} aria-hidden="true" />;
}

function formatSyncTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

function indicatorFreshness(state: FreshnessState): "live" | "delayed" | "stale" | "unavailable" {
  return state === "fresh" ? "live" : state === "unknown" ? "unavailable" : state;
}

function indicatorRisk(posture: RiskPosture): string {
  return posture === "normal" ? "allow" : posture === "elevated" ? "approval_required" : posture === "critical" ? "deny" : posture;
}

export function CommandCenter({ projection, contractMode, onRefresh }: CommandCenterProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("live");
  const [freshness, setFreshness] = useState<FreshnessState>(projection.freshness.state);
  const risk: RiskPosture = projection.risk.posture;
  const lastSync = useMemo(() => new Date(projection.freshness.asOf), [projection.freshness.asOf]);
  const summary = projection.summary;
  const [priorityFilter, setPriorityFilter] = useState<"all" | CommandSeverity>("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const offline = () => { setConnection("offline"); setFreshness("stale"); };
    const online = () => { setConnection("reconnecting"); onRefresh?.(); };
    if (!navigator.onLine) offline();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [onRefresh]);

  const navItems = useMemo(() => visibleShellNavigation(projection.session.capabilities), [projection.session.capabilities]);
  const priority = priorityFilter === "all"
    ? projection.priority
    : projection.priority.filter((item) => item.severity === priorityFilter);
  function refresh() {
    if (connection !== "offline") onRefresh?.();
  }

  return (
    <TerminalFrame collapsed={collapsed} data-ui101-shell data-contract-mode={contractMode} mainClassName="command-main" mainMarker="route-/command"
      header={<TerminalHeader workspace={projection.session.workspaceLabel} account={projection.session.accountLabel} workspaceTitle={projection.session.workspaceId} accountTitle={projection.session.accountId} initials={projection.session.actorInitials} mode={projection.session.mode} collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)} freshness={indicatorFreshness(freshness)} risk={indicatorRisk(risk)} notifications={3}/>}
      navigation={<TerminalNavigation items={navItems} activeRoute="/command"/>}
      status={<><ConnectionStatusBar state={connection === "live" ? "connected" : connection} liveUpdates={false} locale="en"/><span>Data latency: {contractMode === "mocked" ? "1.2s (fixture)" : "—"}</span><span>Last sync {formatSyncTime(lastSync)}</span></>}
    >
        {connection === "offline" ? <div className="offline-banner" role="alert">网络已断开。当前为只读状态，所有写操作均已禁用；恢复连接后不会自动提交旧意图。</div> : null}
        {contractMode === "mocked" ? <div className="command-contract-banner" role="status">C02 Runtime Guard Mocked · 本地演示数据；不代表真实会话或当前业务状态。</div> : null}
        <div className="page-toolbar">
          <div><div className="breadcrumb"><span>Home</span><b>/</b><strong>Command</strong></div><h1>Command Center</h1><p>主工作区的研究、风险与运行状态。</p></div>
          <div className="toolbar-actions">
            <span className="context-button">{projection.session.accountLabel}</span>
            <button className="square-button" type="button" onClick={refresh} disabled={connection === "offline" || !onRefresh} aria-label="刷新">↻</button>
            <button className="square-button" type="button" aria-label="布局设置">⊞</button><span>Last sync {formatSyncTime(lastSync)}</span>
          </div>
        </div>

        <section className="mode-banner" aria-label="当前运行模式"><span className="shield" aria-hidden="true">♢</span><strong>{projection.session.mode.toUpperCase()}</strong><i>·</i><span>{projection.session.mode === "research" ? "仅研究。不会向交易所提交订单。" : projection.session.mode === "shadow" ? "影子运行。不会向交易所提交订单。" : "模拟账本。不会向交易所提交订单。"}</span><span className="mode-risk"><RiskPostureBadge posture={indicatorRisk(risk)} reason={projection.risk.reason} locale="en" /></span></section>

        <div className="overview-grid">
          <section className="panel priority-panel">
            <div className="panel-heading"><h2>优先处理</h2><div className="segmented" aria-label="优先级筛选">{(["all", "critical", "warning", "info"] as const).map((filter) => <button key={filter} className={priorityFilter === filter ? "selected" : ""} type="button" onClick={() => setPriorityFilter(filter)}>{filter === "all" ? "全部" : `${filter === "critical" ? "严重" : filter === "warning" ? "警告" : "信息"} ${projection.priority.filter(item => item.severity === filter).length}`}</button>)}</div></div>
            <div className="priority-list" aria-live="polite">{priority.length ? priority.map((item, index) => <div className="priority-row" key={`${item.label}-${index}`}><span className={`alert-symbol ${item.severity}`} aria-hidden="true">{item.severity === "warning" ? "△" : "!"}</span><strong className={item.severity}>{item.label}</strong><span>{item.summary}</span><code>{item.age}</code><button type="button" disabled title="此页面仅提供只读监控">{item.action} <i>›</i></button></div>) : <div className="empty-row">当前没有需要你处理的事项。</div>}</div>
            <button className="panel-link" type="button">查看全部待办 <span>›</span></button>
          </section>

          <section className="panel health-panel">
            <div className="panel-heading"><h2>系统健康</h2></div><div className="health-head"><span>服务</span><span>状态</span><span>延迟/性能</span><span>可用性</span><span>更新时间</span></div>
            {projection.services.map((service) => <div className="health-row" key={service.name}><span>{service.name}</span><span className={service.tone}><StatusDot tone={service.tone === "healthy" ? "good" : "warn"} />{service.status}</span><span>{service.latency}</span><span className="availability" role="img" aria-label={`可用性 ${service.availability}/5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < service.availability ? service.tone : ""} key={index} />)}</span><code>{formatSyncTime(lastSync)}</code></div>)}
            <button className="panel-link" type="button">打开 Operations <span>›</span></button>
          </section>
        </div>

        <section className="kpi-grid" aria-label="关键状态">
          <article className="kpi-card"><span className="kpi-icon cyan">▤</span><div><h3>数据新鲜度</h3><strong>{contractMode === "mocked" ? "1.2s" : "—"}</strong><p className={freshness === "fresh" ? "good" : "bad"}>{freshness}</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon red">!</span><div><h3>开放风险</h3><strong>{summary ? summary.openRiskAlerts ?? "—" : 2}</strong><p className="bad">{risk}</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon cyan">▣</span><div><h3>订单状态</h3><strong>{summary ? summary.orderSummary?.submitted ?? "—" : 18}</strong><p className="cyan-text">{summary ? summary.pendingApprovals ?? "—" : 2} 待确认</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon violet">⌁</span><div><h3>运行任务</h3><strong>{summary ? summary.runningRuns ?? "—" : 4}</strong><p className="bad">{summary ? summary.failedRuns ?? "—" : 1} Failed</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
        </section>

        <div className="bottom-grid">
          <section className="panel activity-panel"><div className="panel-heading"><h2>最近活动</h2></div><div className="activity-table" role="table" aria-label="最近活动"><div className="activity-row activity-head" role="row"><span role="columnheader">时间</span><span role="columnheader">Actor</span><span role="columnheader">对象</span><span role="columnheader">状态</span><span role="columnheader">关联 ID</span><span role="columnheader">详情</span></div>{projection.activity.map((row) => <div className="activity-row" role="row" key={`${row.time}-${row.id}`}><code role="cell">{row.time}</code><span role="cell">{row.actor}</span><span role="cell">{row.object}</span><span role="cell"><b className={`activity-state ${row.tone}`}>{row.status}</b></span><code role="cell">{row.id}</code><span role="cell"><button type="button">{row.detail}</button></span></div>)}</div><button className="panel-link" type="button">查看全部活动 <span>›</span></button></section>
          <section className="panel quick-panel"><div className="panel-heading"><h2>快速开始</h2></div><button className="quick-action high-risk-action" type="button" disabled title="此页面仅提供只读监控"><span aria-hidden="true">♙</span><strong>发起研究<small>选择数据快照与 Engine</small></strong><i>›</i></button><button className="quick-action high-risk-action" type="button" disabled title="此页面仅提供只读监控"><span aria-hidden="true">▧</span><strong>创建策略草稿<small>从受控研究证据开始</small></strong><i>›</i></button><div className="quick-links"><button type="button">▥ 查看市场 ›</button><button type="button">♢ 打开审计 ›</button></div><p className="layout-saved">只读监控</p></section>
        </div>
        {notice ? <div className="toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="关闭通知">×</button></div> : null}
    </TerminalFrame>
  );
}
