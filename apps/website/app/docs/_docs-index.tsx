"use client";

import { useMemo, useState } from "react";

const DOCUMENTS = [
  { id: "architecture", kind: "架构", title: "系统架构与信任边界", summary: "理解 Agent、BFF、确定性风控与执行网关之间的协议边界。", body: ["浏览器只访问 Gateway/BFF，不直连数据库、事件总线、Engine 或 venue。", "Agent 只产出 Artifact 与不可执行 TradeProposal；RiskDecision 和 TradeCommand 只能由确定性服务创建。"] },
  { id: "sdk", kind: "SDK", title: "Engine SDK 接入概念", summary: "Engine manifest、capability 声明、Artifact 输出与版本支持策略。", body: ["Engine manifest 必须声明输入、输出、预算和数据用途；协议中不提供交易原语。", "每个 Artifact 携带输入、内容、环境哈希及 Engine 版本，支持固定输入重放。"] },
  { id: "api", kind: "API", title: "BFF API 契约指南", summary: "REST/JSON、SSE cursor、幂等键、对象版本与 correlation ID 约定。", body: ["命令请求携带 Idempotency-Key 与对象版本；409 不得静默覆盖服务端状态。", "异步响应使用 202 受理语义；SSE 通过 sequence/cursor 去重并从最后确认游标恢复。"] },
  { id: "deployment", kind: "部署", title: "受控部署与发布", summary: "Paper/Shadow 环境、feature flag、可复现构建与制品完整性。", body: ["当前公开范围仅 Research、Paper 与 Shadow；更高风险模式必须通过独立 Gate。", "构建绑定提交版本，发布制品接受依赖、SBOM、签名及可复现性检查。"] },
  { id: "runbook", kind: "Runbook", title: "故障恢复 Runbook", summary: "离线、数据陈旧、流中断、维护窗口与升级路径。", body: ["离线或数据陈旧时禁用依赖该数据的写操作，恢复连接后不自动提交旧意图。", "流中断从最后确认 cursor 回补；重复事件按 sequence 去重，无法恢复时携 correlation ID 联系支持。"] },
  { id: "changelog", kind: "变更日志", title: "2026.08 首期变更日志", summary: "当前发布版本、兼容性边界与已冻结协议清单。", body: ["2026.08.15：发布官网七页首期内容、访问申请入口与 SEO 索引。", "当前开放 Research、Paper、Shadow；SSO/OIDC 登录继续由受控 Terminal 入口承载。"] },
] as const;

export function DocsIndex() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const matches = useMemo(
    () => DOCUMENTS.filter((document) =>
      `${document.kind} ${document.title} ${document.summary}`.toLocaleLowerCase("zh-CN").includes(normalized)),
    [normalized],
  );

  return (
    <div data-smoke="website-docs-index">
      <label className="form-field docs-search">
        <span>搜索文档</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="架构、SDK、API、部署、Runbook…"
        />
      </label>
      <p className="form-hint" aria-live="polite">当前版本 2026.08.15 · {matches.length} 篇文档</p>
      {matches.length > 0 ? (
        <ul className="docs-grid">
          {matches.map((document) => (
            <li className="card" id={document.id} key={document.id}>
              <span className="card-num">{document.kind} · v2026.08.15</span>
              <h2>{document.title}</h2>
              <p>{document.summary}</p>
              <details className="docs-details">
                <summary>阅读当前版本</summary>
                <ul>
                  {document.body.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <div className="docs-empty" role="status">
          <h2>没有匹配的文档</h2>
          <p>请清除搜索条件，或联系支持团队确认文档开放范围。</p>
          <div className="hero-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>清除搜索条件</button>
            <a className="btn btn-ghost" href="mailto:support@sumalpha.ai">联系支持</a>
          </div>
        </div>
      )}
    </div>
  );
}
