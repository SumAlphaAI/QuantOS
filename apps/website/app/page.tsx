import type { Metadata } from "next";
import { Section } from "./_components/site-chrome";

export const metadata: Metadata = {
  title: { absolute: "SumAlpha QuantOS — AI 原生量化研究与交易操作系统" },
  description:
    "QuantOS 将研究、策略治理、风险审批与执行留证整合为同一条证据链。Agent 只提出建议、绝不直接下单；默认 Paper/Shadow 模式。",
  alternates: { canonical: "/" },
};

function EvidenceChainDiagram() {
  const nodes = [
    { x: 20, label: "TradeProposal", sub: "不可执行建议" },
    { x: 236, label: "RiskDecision", sub: "服务端风控结论" },
    { x: 452, label: "Approval", sub: "MFA · 职责分离" },
    { x: 668, label: "TradeCommand", sub: "幂等 · 审计留证" },
  ];
  return (
    <div className="hero-chain">
      <svg viewBox="0 0 880 132" role="img" aria-label="提议、风险决策、审批到执行命令的受控链路示意图">
        {nodes.slice(0, -1).map((node, i) => (
          <g key={`edge-${node.label}`}>
            <line
              x1={node.x + 168}
              y1={56}
              x2={nodes[i + 1].x + 8}
              y2={56}
              stroke="var(--q-accent-line)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d={`M ${nodes[i + 1].x + 2} 56 l 8 -4 v 8 z`}
              fill="var(--q-info)"
            />
          </g>
        ))}
        {nodes.map((node) => (
          <g key={node.label}>
            <rect
              x={node.x}
              y={20}
              width="176"
              height="72"
              rx="8"
              fill="var(--q-surface-2)"
              stroke="var(--q-border-strong)"
            />
            <text x={node.x + 88} y={50} textAnchor="middle" fill="var(--q-text-primary)" fontSize="14" fontFamily="JetBrains Mono, monospace">
              {node.label}
            </text>
            <text x={node.x + 88} y={72} textAnchor="middle" fill="var(--q-text-secondary)" fontSize="11">
              {node.sub}
            </text>
          </g>
        ))}
        <text x="20" y="122" fill="var(--q-text-disabled)" fontSize="11">
          每一步均为版本化对象；TradeProposal 永远标记为不可执行，TradeCommand 只能由服务端在风控与审批通过后生成。
        </text>
      </svg>
    </div>
  );
}

export default function HomePage() {
  return (
    <div data-smoke="website-home">
      <section className="hero">
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />当前开放范围：Research / Paper / Shadow</span>
        <h1 className="hero-title">
          AI-native operating system for <span className="accent">quantitative research and trading</span>
        </h1>
        <p className="hero-sub">
          QuantOS 把研究、策略治理、风险审批与执行留证放进同一条证据链。
          Agent 始终只能提出建议——是否执行，由确定性风控与人工审批决定。
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/access-request">申请访问</a>
          <a className="btn btn-ghost" href="/architecture-security">查看架构</a>
        </div>
        <EvidenceChainDiagram />
      </section>

      <Section index="01 / 信任边界" title="三条不变承诺" lead="写在系统协议里的约束，而不是营销文案。">
        <div className="trust-strip">
          <div className="trust-item">
            <strong><span className="trust-sigil" style={{ background: "var(--q-info)" }} aria-hidden="true" />Agent 不直接下单</strong>
            <p>Agent 产出永远是不可执行的 TradeProposal；前端不拼装交易命令、不持有交易密钥。</p>
          </div>
          <div className="trust-item">
            <strong><span className="trust-sigil" style={{ background: "var(--q-mode-paper)" }} aria-hidden="true" />默认 Paper / Shadow</strong>
            <p>所有策略先在模拟账本与影子模式下验证；更高风险模式必须由服务端 capability 显式放行。</p>
          </div>
          <div className="trust-item">
            <strong><span className="trust-sigil" style={{ background: "var(--q-mode-shadow)" }} aria-hidden="true" />全链路审计</strong>
            <p>每个受控动作携带 correlation ID，从研究输入到订单成交可在五分钟内核验完整证据链。</p>
          </div>
        </div>
      </Section>

      <Section index="02 / 能力" title="四项核心能力" lead="从研究假设到审计回放，覆盖量化团队的完整闭环。">
        <div className="card-grid">
          <a className="card" href="/product#research">
            <span className="card-num">CAP-01</span>
            <h3>Research</h3>
            <p>固定输入、可重放的研究运行；每次执行产出带环境哈希与证据的 Artifact，取消在两秒内受理。</p>
            <span className="card-link">了解研究闭环 →</span>
          </a>
          <a className="card" href="/product#strategy">
            <span className="card-num">CAP-02</span>
            <h3>Strategy Governance</h3>
            <p>草稿自动版本化、静态检查与固定快照回测；未验证、未审批的策略无法生成 Release。</p>
            <span className="card-link">了解策略治理 →</span>
          </a>
          <a className="card" href="/product#risk">
            <span className="card-num">CAP-03</span>
            <h3>Risk &amp; Execution</h3>
            <p>服务端风控决策与职责分离审批；命令提交幂等，重复提交只产生一笔下游订单。</p>
            <span className="card-link">了解风险与执行 →</span>
          </a>
          <a className="card" href="/product#audit">
            <span className="card-num">CAP-04</span>
            <h3>Audit</h3>
            <p>correlation/causation 链完整可查；受控导出异步生成、短时链接、逐次授权并留痕。</p>
            <span className="card-link">了解审计能力 →</span>
          </a>
        </div>
      </Section>

      <Section index="03 / 对象链" title="版本化对象，而不是聊天记录" lead="DataSnapshot 到 TradeCommand 的每一步都有内容哈希、版本与责任人。">
        <ol className="flow-list">
          <li><span className="step-id">OBJ-1</span><span className="step-name">DataSnapshot</span><span className="step-desc">带质量、许可与时效标记的数据快照；过期或许可缺失即阻断下游用途。</span></li>
          <li><span className="step-id">OBJ-2</span><span className="step-name">StrategyRelease</span><span className="step-desc">不可变发布：参数、回测、数据与证据哈希齐全后才允许进入审批。</span></li>
          <li><span className="step-id">OBJ-3</span><span className="step-name">TradeProposal</span><span className="step-desc">Agent 或研究员提交的建议，永久标记 executable=false，过期即不可评估。</span></li>
          <li><span className="step-id">OBJ-4</span><span className="step-name">RiskDecision</span><span className="step-desc">只能由服务端风控创建；自批、过期、额度变化均被明确拒绝。</span></li>
          <li><span className="step-id">OBJ-5</span><span className="step-name">TradeCommand</span><span className="step-desc">携带 Idempotency-Key 提交；订单与成交时间线贯通对账与审计。</span></li>
        </ol>
      </Section>

      <Section index="04 / 团队" title="同一条证据链上的四种角色" lead="研究员、量化开发、交易员与风控负责人共享同一份事实，而非各自的截图。">
        <ul className="principle-list">
          <li><strong>研究员</strong><p>发起可重放研究，引用 Artifact 证据支持策略假设。</p></li>
          <li><strong>量化开发</strong><p>在固定快照与成本模型下回测，静态检查不过即无法发布。</p></li>
          <li><strong>交易员</strong><p>在 Trade Ticket 中逐步刷新报价、余额与限额，只预填意图、不生成命令。</p></li>
          <li><strong>风控负责人</strong><p>审批链上查看实时敞口与规则命中，kill switch 常驻可见。</p></li>
        </ul>
      </Section>

      <Section index="05 / 开发者与治理" title="开放的协议，封闭的权限" lead="Engine Protocol 允许接入自有研究引擎，但权限、数据许可与供应链治理由平台统一裁决。">
        <div className="card-grid cols-3">
          <div className="card">
            <span className="card-num">GOV-01</span>
            <h3>Engine Protocol</h3>
            <p>gRPC 契约与 manifest 声明能力边界；引擎不接触交易链路，只产出研究 Artifact。</p>
          </div>
          <div className="card">
            <span className="card-num">GOV-02</span>
            <h3>数据许可</h3>
            <p>每个数据源标注许可与用途范围；license 缺失的快照不能进入策略或交易流程。</p>
          </div>
          <div className="card">
            <span className="card-num">GOV-03</span>
            <h3>第三方治理</h3>
            <p>依赖经过许可审查与 SBOM 清单管理；上游变更进入评估队列，不静默升级。</p>
          </div>
        </div>
        <div className="hero-actions" style={{ marginTop: 32 }}>
          <a className="btn btn-ghost" href="/docs">阅读架构、API 与 Runbook 文档</a>
        </div>
      </Section>

      <Section index="06 / 访问" title="为谁而建，不为谁而建" lead="QuantOS 面向有风控纪律的专业团队。当前仅开放 Research / Paper / Shadow，不面向公众投资者。">
        <ul className="principle-list">
          <li><strong>适用</strong><p>量化研究团队、自营交易团队、需要审计证据链的机构开发与风控部门。</p></li>
          <li><strong>不适用</strong><p>公众投资推荐、收益宣传、社区跟单与喊单场景——这些功能不存在，也不会出现。</p></li>
        </ul>
        <div className="hero-actions" style={{ marginTop: 40 }}>
          <a className="btn btn-primary" href="/access-request">提交访问申请</a>
          <a className="btn btn-ghost" href="/use-cases">查看使用场景</a>
        </div>
      </Section>
    </div>
  );
}
