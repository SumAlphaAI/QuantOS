import type { Metadata } from "next";
import { Section } from "../_components/site-chrome";
import { AccessRequestForm } from "./_form";

export const metadata: Metadata = {
  title: "访问申请",
  description:
    "申请访问 QuantOS Terminal：面向专业量化团队，当前开放 Research / Paper / Shadow 模式。申请将被限速并记录审计。",
  alternates: { canonical: "/access-request" },
};

export default function AccessRequestPage() {
  return (
    <div data-smoke="website-access-request">
      <section className="hero" style={{ paddingBottom: 48 }}>
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />访问申请</span>
        <h1 className="hero-title">申请访问 <span className="accent">QuantOS Terminal</span></h1>
        <p className="hero-sub">
          我们面向有风控纪律的专业量化团队逐步开放。提交即表示同意隐私说明；
          受理不代表权限开通，审核结果将通过工作邮箱通知。
        </p>
      </section>
      <Section index="01 / 申请" title="团队信息">
        <AccessRequestForm />
      </Section>
      <Section index="02 / 范围" title="当前支持范围">
        <ul className="principle-list">
          <li><strong>开放模式</strong><p>Research、Paper、Shadow。更高风险模式需单独评审，不在公开申请范围内。</p></li>
          <li><strong>审核依据</strong><p>团队背景、用途说明与目标市场；我们可能通过邮件进一步核实信息。</p></li>
          <li><strong>隐私</strong><p>申请信息仅用于资格审核，不用于营销；本网站不加载第三方追踪脚本。</p></li>
          <li><strong>防滥用</strong><p>申请接口限速并记录审计；恶意或批量提交将被拒绝。</p></li>
        </ul>
      </Section>
    </div>
  );
}
