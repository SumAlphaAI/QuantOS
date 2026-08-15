"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ConnectionStatusBar,
  DataFreshnessIndicator,
  RiskPostureBadge,
} from "@sumalpha/domain-ui/indicators";
import {
  visibleShellNavigation,
  writesAllowed,
  type ConnectionState,
  type FreshnessState,
  type RiskPosture,
} from "@sumalpha/domain-ui/ui101";
import type { CommandProjection, CommandSeverity } from "../../src/command/model";

export interface CommandCenterProps { projection: CommandProjection; contractMode: "mocked" | "integrated" }

function Icon({ name }: { name: string }) {
  const glyphs: Record<string, string> = {
    home: "⌂", research: "◉", strategy: "↗", portfolio: "◔", markets: "▥", trade: "⇄",
    performance: "▥", proposals: "▤", approvals: "✓", orders: "▣", audit: "▥",
    operations: "≋", admin: "⚙",
  };
  return <span className="nav-icon" aria-hidden="true">{glyphs[name] ?? "•"}</span>;
}

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

export function CommandCenter({ projection, contractMode }: CommandCenterProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("live");
  const [freshness, setFreshness] = useState<FreshnessState>(projection.freshness.state);
  const [risk] = useState<RiskPosture>(projection.risk.posture);
  const [lastSync, setLastSync] = useState(() => new Date(projection.freshness.asOf));
  const [refreshing, setRefreshing] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | CommandSeverity>("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const update = () => {
      if (navigator.onLine) {
        setConnection("live");
        setFreshness((current) => current === "stale" ? "fresh" : current);
      } else {
        setConnection("offline");
        setFreshness("stale");
      }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const navItems = useMemo(() => visibleShellNavigation(projection.session.capabilities), [projection.session.capabilities]);
  const priority = priorityFilter === "all"
    ? projection.priority
    : projection.priority.filter((item) => item.severity === priorityFilter);
  const safeToWrite = writesAllowed({ connection, freshness, risk, compactViewport: false });

  function refresh() {
    if (connection === "offline" || refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => {
      setLastSync(new Date());
      setRefreshing(false);
      setNotice("状态投影已刷新");
    }, 420);
  }

  return (
    <div className={`terminal-shell ${collapsed ? "sidebar-collapsed" : ""}`} data-ui101-shell data-contract-mode={contractMode}>
      <header className="terminal-topbar">
        <button className="brand" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}>
          <span className="brand-mark" aria-hidden="true"><i /><b /><em /></span>
          <span className="brand-word">SUMALPHA</span>
        </button>
        <span className="top-divider" />
        <button className="context-button workspace-context" type="button"><span aria-hidden="true">▣</span>{projection.session.workspaceLabel}<span aria-hidden="true">⌄</span></button>
        <button className="context-button account-context" type="button">{projection.session.accountLabel}<span aria-hidden="true">⌄</span></button>
        <span className="mode-chip">PAPER</span>
        <div className="top-status freshness-status"><DataFreshnessIndicator state={indicatorFreshness(freshness)} locale="en" /></div>
        <div className="top-status risk-status"><RiskPostureBadge posture={indicatorRisk(risk)} locale="en" /></div>
        <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="全局搜索" placeholder="搜索  ⌘K" /></label>
        <button className="icon-button notification-button" type="button" aria-label="通知，3 条未读">♧<span>3</span></button>
        <button className="icon-button help-button" type="button" aria-label="帮助">?</button>
        <a className="avatar" href="/settings/profile" aria-label="打开个人设置">{projection.session.actorInitials}</a>
      </header>

      <aside className="terminal-sidebar" aria-label="主导航">
        <nav>
          {navItems.map((item) => (
            <a className={item.route === "/command" ? "active" : ""} href={item.route} key={item.route} aria-current={item.route === "/command" ? "page" : undefined}>
              <Icon name={item.icon} /><span className="nav-label">{item.label}</span>
              {item.badge ? <span className="nav-badge" aria-label={`${item.badge} 条待处理`}>{item.badge}</span> : null}
            </a>
          ))}
        </nav>
      </aside>

      <main className="command-main" data-smoke="route-/command">
        {connection === "offline" ? <div className="offline-banner" role="alert">网络已断开。当前为只读状态，所有写操作均已禁用；恢复连接后不会自动提交旧意图。</div> : null}
        {contractMode === "mocked" ? <div className="command-contract-banner" role="status">C02 Runtime Guard Mocked · 六步守卫已在页面渲染前执行；Command 聚合契约等待 BFF-FE-002 签署。</div> : null}
        <div className="page-toolbar">
          <div><div className="breadcrumb"><span>Home</span><b>/</b><strong>Command</strong></div><h1>Command Center</h1><p>主工作区的研究、风险与运行状态。</p></div>
          <div className="toolbar-actions">
            <button type="button">全部账户 <span>⌄</span></button><button type="button">今日 <span>⌄</span></button>
            <button className={`square-button ${refreshing ? "spinning" : ""}`} type="button" onClick={refresh} disabled={connection === "offline"} aria-label="刷新">↻</button>
            <button className="square-button" type="button" aria-label="布局设置">⊞</button><span>Last sync {formatSyncTime(lastSync)}</span>
          </div>
        </div>

        <section className="mode-banner" aria-label="当前运行模式"><span className="shield" aria-hidden="true">♢</span><strong>PAPER</strong><i>·</i><span>模拟账本。不会向交易所提交订单。</span><span className="mode-risk"><RiskPostureBadge posture={indicatorRisk(risk)} reason={projection.risk.reason} locale="en" /></span></section>

        <div className="overview-grid">
          <section className="panel priority-panel">
            <div className="panel-heading"><h2>优先处理</h2><div className="segmented" aria-label="优先级筛选">{(["all", "critical", "warning", "info"] as const).map((filter) => <button key={filter} className={priorityFilter === filter ? "selected" : ""} type="button" onClick={() => setPriorityFilter(filter)}>{filter === "all" ? "全部" : filter === "critical" ? "严重 2" : filter === "warning" ? "警告 1" : "信息 0"}</button>)}</div></div>
            <div className="priority-list" aria-live="polite">{priority.length ? priority.map((item, index) => <div className="priority-row" key={`${item.label}-${index}`}><span className={`alert-symbol ${item.severity}`} aria-hidden="true">{item.severity === "warning" ? "△" : "!"}</span><strong className={item.severity}>{item.label}</strong><span>{item.summary}</span><code>{item.age}</code><button type="button" onClick={() => setNotice(`${item.action}入口已定位`)}>{item.action} <i>›</i></button></div>) : <div className="empty-row">当前没有需要你处理的事项。</div>}</div>
            <button className="panel-link" type="button">查看全部待办 <span>›</span></button>
          </section>

          <section className="panel health-panel">
            <div className="panel-heading"><h2>系统健康</h2></div><div className="health-head"><span>服务</span><span>状态</span><span>延迟/性能</span><span>可用性</span><span>更新时间</span></div>
            {projection.services.map((service) => <div className="health-row" key={service.name}><span>{service.name}</span><span className={service.tone}><StatusDot tone={service.tone === "healthy" ? "good" : "warn"} />{service.status}</span><span>{service.latency}</span><span className="availability" role="img" aria-label={`可用性 ${service.availability}/5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < service.availability ? service.tone : ""} key={index} />)}</span><code>{formatSyncTime(lastSync)}</code></div>)}
            <button className="panel-link" type="button">打开 Operations <span>›</span></button>
          </section>
        </div>

        <section className="kpi-grid" aria-label="关键状态">
          <article className="kpi-card"><span className="kpi-icon cyan">▤</span><div><h3>数据新鲜度</h3><strong>1.2<span>s</span></strong><p className="good">Fresh</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon red">!</span><div><h3>开放风险</h3><strong>2</strong><p className="bad">1 Critical</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon cyan">▣</span><div><h3>订单状态</h3><strong>18</strong><p className="cyan-text">2 待确认</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
          <article className="kpi-card"><span className="kpi-icon violet">⌁</span><div><h3>运行任务</h3><strong>4</strong><p className="bad">1 Failed</p><small>截至 {formatSyncTime(lastSync)}</small></div></article>
        </section>

        <div className="bottom-grid">
          <section className="panel activity-panel"><div className="panel-heading"><h2>最近活动</h2></div><div className="activity-table" role="table" aria-label="最近活动"><div className="activity-row activity-head" role="row"><span role="columnheader">时间</span><span role="columnheader">Actor</span><span role="columnheader">对象</span><span role="columnheader">状态</span><span role="columnheader">关联 ID</span><span role="columnheader">详情</span></div>{projection.activity.map((row) => <div className="activity-row" role="row" key={`${row.time}-${row.id}`}><code role="cell">{row.time}</code><span role="cell">{row.actor}</span><span role="cell">{row.object}</span><span role="cell"><b className={`activity-state ${row.tone}`}>{row.status}</b></span><code role="cell">{row.id}</code><span role="cell"><button type="button">{row.detail}</button></span></div>)}</div><button className="panel-link" type="button">查看全部活动 <span>›</span></button></section>
          <section className="panel quick-panel"><div className="panel-heading"><h2>快速开始</h2></div><button className="quick-action high-risk-action" type="button" disabled={!safeToWrite} onClick={() => setNotice("已进入“发起研究”流程")}><span aria-hidden="true">♙</span><strong>发起研究<small>选择数据快照与 Engine</small></strong><i>›</i></button><button className="quick-action high-risk-action" type="button" disabled={!safeToWrite} onClick={() => setNotice("已进入“创建策略草稿”流程")}><span aria-hidden="true">▧</span><strong>创建策略草稿<small>从受控研究证据开始</small></strong><i>›</i></button><div className="quick-links"><button type="button">▥ 查看市场 ›</button><button type="button">♢ 打开审计 ›</button></div><p className="layout-saved">✓ 布局已保存</p></section>
        </div>
        {notice ? <div className="toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="关闭通知">×</button></div> : null}
      </main>

      <footer className="terminal-statusbar" aria-label="连接状态"><ConnectionStatusBar state={connection === "live" ? "connected" : connection} lastConnectedAt={lastSync.toISOString()} locale="en" /><span>Data latency: 1.2s</span><span>Last sync {formatSyncTime(lastSync)}</span></footer>
    </div>
  );
}
