import type { Metadata } from "next";
import { Section } from "../_components/site-chrome";

export const metadata: Metadata = {
  title: "产品",
  description:
    "QuantOS 四项核心能力：可重放 Research、策略治理与不可变 Release、服务端风控与审批执行、全链路审计。",
  alternates: { canonical: "/product" },
};

const CAPABILITIES = [
  {
    id: "research",
    num: "CAP-01",
    name: "Research",
    summary: "把研究运行当作可审计的工程对象，而不是一次性对话。",
    points: [
      "每次运行固定 capability、数据快照、预算与截止时间，输入可追溯、可重放。",
      "SSE 流式输出以 sequence/cursor 去重，断线从最后确认游标回补。",
      "取消请求返回服务端受理态，前端不伪造已取消状态。",
      "Artifact 携带 input/content/environment hash、引擎与 prompt 版本及 correlation ID。",
    ],
    tags: ["REPLAYABLE", "ARTIFACT", "SSE"],
  },
  {
    id: "strategy",
    num: "CAP-02",
    name: "Strategy Governance",
    summary: "从草稿到 Release 的治理管线，未验证不得发布。",
    points: [
      "Lab 草稿自动保存并带版本；冲突时保留草稿并提供 diff，绝不覆盖服务端状态。",
      "回测固定 snapshot、clock、成本与滑点模型，泄漏检查失败即阻断 Release。",
      "Release 不可变：hash、参数、回测、数据与证据齐全才可提交审批。",
      "部署目标完全取自后端 allowedTargets；M3/M4 阶段仅限 Paper/Shadow。",
    ],
    tags: ["IMMUTABLE RELEASE", "BACKTEST", "APPROVAL GATE"],
  },
  {
    id: "risk",
    num: "CAP-03",
    name: "Risk & Execution",
    summary: "服务端是风控结论的唯一权威，前端不乐观展示任何订单成功。",
    points: [
      "TradeProposal 永久显示 executable=false；过期建议不允许进入评估。",
      "Trade Ticket 每一步重新取报价、余额、限额与 venue 健康，只预填 intent。",
      "审批执行 MFA 与职责分离；自批、过期、额度变化均被明确拒绝。",
      "命令提交只传服务端 command ref 与 Idempotency-Key，重复提交只产生一笔下游订单。",
    ],
    tags: ["RISK DECISION", "MFA", "IDEMPOTENT"],
  },
  {
    id: "audit",
    num: "CAP-04",
    name: "Audit",
    summary: "每个动作都能被还原：谁、何时、基于哪个版本、得到什么结论。",
    points: [
      "Audit Explorer 贯通 correlation/causation 链，五分钟还原完整证据链。",
      "受控导出异步生成，短时签名 URL，逐次授权并写入审计。",
      "账本差异贯通 Order/Fill/Performance/Alert，不允许手工改账。",
      "告警以游标续传订阅，权限变更即断开并重鉴。",
    ],
    tags: ["EVIDENCE CHAIN", "RECONCILIATION", "CONTROLLED EXPORT"],
  },
] as const;

export default function ProductPage() {
  return (
    <div data-smoke="website-product">
      <section className="hero">
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />产品能力</span>
        <h1 className="hero-title">研究到执行的<span className="accent">完整闭环</span></h1>
        <p className="hero-sub">
          四项能力共享同一份领域事实：服务端是权限、模式与风控结论的唯一权威，
          前端只做呈现、校验与受控提交。
        </p>
      </section>
      {CAPABILITIES.map((cap, index) => (
        <Section key={cap.id} index={`${String(index + 1).padStart(2, "0")} / ${cap.num}`} title={cap.name} lead={cap.summary}>
          <div id={cap.id}>
            <ol className="flow-list">
              {cap.points.map((point, pointIndex) => (
                <li key={point}>
                  <span className="step-id">{cap.num}.{pointIndex + 1}</span>
                  <span className="step-desc" style={{ gridColumn: "2 / -1" }}>{point}</span>
                </li>
              ))}
            </ol>
            <div className="card-tags" style={{ marginTop: 20 }}>
              {cap.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          </div>
        </Section>
      ))}
      <Section index="05 / 下一步" title="了解它如何被约束" lead="能力清单之外，更重要的是边界：Agent 与交易链路之间隔着确定性风控。">
        <div className="hero-actions">
          <a className="btn btn-primary" href="/architecture-security">阅读架构与安全</a>
          <a className="btn btn-ghost" href="/access-request">申请访问</a>
        </div>
      </Section>
    </div>
  );
}
