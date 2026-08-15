import type { Metadata } from "next";
import { Section } from "../_components/site-chrome";

export const metadata: Metadata = {
  title: "使用场景",
  description:
    "QuantOS 使用场景：研究团队的可重放研究、量化开发的治理管线、交易与风控在同一证据链上的协作。",
  alternates: { canonical: "/use-cases" },
};

const SCENARIOS = [
  {
    num: "SCN-01",
    role: "研究团队",
    title: "可重放的研究，而不是聊天截图",
    body: [
      "研究员以固定 DataSnapshot 发起研究运行，结果附带 input/environment hash 与证据引用。",
      "同事可以按相同输入重放同一次运行，验证结论而非转述结论。",
      "Artifact 直接作为策略立项的输入证据，评审记录留在同一条 causation 链上。",
    ],
  },
  {
    num: "SCN-02",
    role: "量化开发",
    title: "从草稿到 Release 的治理管线",
    body: [
      "Lab 草稿自动版本化；409 冲突保留草稿并提供 diff，不丢失任何一方的工作。",
      "回测固定快照、时钟与成本模型，静态检查或泄漏检查失败即无法进入发布。",
      "Release 不可变，部署目标由后端 allowedTargets 限定，当前阶段仅 Paper/Shadow。",
    ],
  },
  {
    num: "SCN-03",
    role: "交易与风控协作",
    title: "审批链上共享同一份事实",
    body: [
      "交易员在 Trade Ticket 看到的报价、余额与限额每步实时刷新；风控看到的是同一对象版本。",
      "审批要求 MFA 与职责分离；自批、过期建议、额度变化在服务端被明确拒绝。",
      "命令提交幂等，撤单走请求—受理语义，订单与成交时间线贯通对账与审计。",
    ],
  },
] as const;

export default function UseCasesPage() {
  return (
    <div data-smoke="website-use-cases">
      <section className="hero">
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />使用场景</span>
        <h1 className="hero-title">三种角色，<span className="accent">一条证据链</span></h1>
        <p className="hero-sub">
          QuantOS 不是给某个人用的工具，而是让整个团队在同一份可核验的事实上协作。
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/access-request">申请演示</a>
        </div>
      </section>
      {SCENARIOS.map((scenario, index) => (
        <Section
          key={scenario.num}
          index={`${String(index + 1).padStart(2, "0")} / ${scenario.role}`}
          title={scenario.title}
        >
          <ol className="flow-list">
            {scenario.body.map((line, lineIndex) => (
              <li key={line}>
                <span className="step-id">{scenario.num}.{lineIndex + 1}</span>
                <span className="step-desc" style={{ gridColumn: "2 / -1" }}>{line}</span>
              </li>
            ))}
          </ol>
        </Section>
      ))}
      <Section index="04 / 边界" title="这些场景我们不服务" lead="明确的不适用清单，与能力清单同等重要。">
        <ul className="principle-list">
          <li><strong>不面向公众投资者</strong><p>没有收益宣传、投资推荐或面向公众的营销内容。</p></li>
          <li><strong>不做社区与跟单</strong><p>没有跟单、喊单、收益排行或任何社交化交易功能。</p></li>
        </ul>
        <div className="hero-actions" style={{ marginTop: 40 }}>
          <a className="btn btn-primary" href="/access-request">提交访问申请</a>
          <a className="btn btn-ghost" href="/architecture-security">查看架构与安全</a>
        </div>
      </Section>
    </div>
  );
}
