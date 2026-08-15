import type { Metadata } from "next";
import { Section } from "../_components/site-chrome";

export const metadata: Metadata = {
  title: "架构与安全",
  description:
    "QuantOS 架构边界：Agent 与交易链路隔离、事件溯源审计、服务端权限裁决、数据许可与供应链治理。",
  alternates: { canonical: "/architecture-security" },
};

export default function ArchitectureSecurityPage() {
  return (
    <div data-smoke="website-architecture">
      <section className="hero">
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />架构与安全</span>
        <h1 className="hero-title">边界先行，<span className="accent">能力在后</span></h1>
        <p className="hero-sub">
          QuantOS 的安全模型不是附加层：Agent、前端、BFF 与执行网关之间的每一条边界
          都是协议的一部分，并被持续审计。
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/access-request">联系团队</a>
          <a className="btn btn-ghost" href="/product">查看产品能力</a>
        </div>
      </section>

      <Section index="01 / Agent 边界" title="Agent 永远到不了交易链路" lead="研究引擎只产出 Artifact 与 TradeProposal；执行权力完全在确定性服务一侧。">
        <ul className="principle-list">
          <li><strong>协议隔离</strong><p>Engine 通过 gRPC Engine Protocol 接入，manifest 声明能力；协议中没有下单原语。</p></li>
          <li><strong>不可执行建议</strong><p>TradeProposal 在 schema 层标记 executable=false，任何前端展示都不得暗示可执行。</p></li>
          <li><strong>服务端裁决</strong><p>RiskDecision 只能由风控服务创建；前端不创建、不修改、不预测其结论。</p></li>
          <li><strong>密钥零触达</strong><p>浏览器与桌面端不持有交易密钥，不直连 venue、Engine、NATS 或数据库。</p></li>
        </ul>
      </Section>

      <Section index="02 / 身份与权限" title="每一次请求都被重新裁决" lead="会话、租户、RBAC/capability、资源、模式、数据时效——按固定顺序 fail closed。">
        <ol className="flow-list">
          <li><span className="step-id">AUTH-1</span><span className="step-name">OIDC + MFA</span><span className="step-desc">组织身份提供商 SSO，PKCE S256；高风险动作要求近期认证与六位 MFA。</span></li>
          <li><span className="step-id">AUTH-2</span><span className="step-name">路由守卫</span><span className="step-desc">session → tenant/workspace → RBAC/capability → resource → mode → data 串行执行，任一步失败即停止后续请求。</span></li>
          <li><span className="step-id">AUTH-3</span><span className="step-name">存在性隐藏</span><span className="step-desc">403 与 404 收敛为同一界面表述，不泄露对象是否存在。</span></li>
          <li><span className="step-id">AUTH-4</span><span className="step-name">职责分离</span><span className="step-desc">自批被协议拒绝；最后一名管理员受保护；权限变更全量审计。</span></li>
        </ol>
      </Section>

      <Section index="03 / 事件与审计" title="事件溯源，而非日志堆砌" lead="所有受控动作写入事件流，携带 correlation/causation 链与对象版本。">
        <ul className="principle-list">
          <li><strong>证据链</strong><p>从研究输入到订单成交，任一结论可在五分钟内还原其完整上下文。</p></li>
          <li><strong>实时投影</strong><p>SSE 以游标续传、乱序去重、断线回补；权限撤销立即断开订阅。</p></li>
          <li><strong>陈旧即阻断</strong><p>数据新鲜度不足或离线时，写操作在协议层被禁用，不依赖操作员自觉。</p></li>
          <li><strong>不可改账</strong><p>对账差异进入调查流，没有任何界面允许手工修改账本。</p></li>
        </ul>
      </Section>

      <Section index="04 / 数据与供应链" title="进入系统的每个字节都有出处" lead="数据许可、第三方依赖与构建制品接受同等强度的治理。">
        <div className="card-grid cols-3">
          <div className="card">
            <span className="card-num">SEC-D1</span>
            <h3>数据许可</h3>
            <p>DataSnapshot 标注来源、venue、as_of、质量与许可；license 缺失即阻断下游策略与交易用途。</p>
          </div>
          <div className="card">
            <span className="card-num">SEC-D2</span>
            <h3>依赖治理</h3>
            <p>第三方组件经过许可审查（如 OpenBB、Nautilus 的 license gate），SBOM 随制品发布。</p>
          </div>
          <div className="card">
            <span className="card-num">SEC-D3</span>
            <h3>制品完整性</h3>
            <p>构建可复现；桌面端制品签名发布，更新前验证签名，深链只携带交换码、绝不携带 token。</p>
          </div>
        </div>
      </Section>

      <Section index="05 / 部署形态" title="一套代码，三种入口" lead="官网、app.sumalpha.ai 与 Tauri 桌面端共享同一应用与同一后端审计语义。">
        <ul className="principle-list">
          <li><strong>Web 与 Desktop 对等</strong><p>业务页面与验收用例完全一致；平台差异收敛在 PlatformCapabilities 适配层。</p></li>
          <li><strong>小屏只读</strong><p>小于 768px 的视口自动隐藏审批、下单、撤单等全部高风险操作入口。</p></li>
        </ul>
        <div className="hero-actions" style={{ marginTop: 40 }}>
          <a className="btn btn-primary" href="/access-request">申请架构走查</a>
        </div>
      </Section>
    </div>
  );
}
