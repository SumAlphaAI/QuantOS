import type { Metadata } from "next";
import { Section } from "../_components/site-chrome";
import { DocsIndex } from "./_docs-index";

export const metadata: Metadata = {
  title: "文档中心",
  description: "QuantOS 架构、Engine SDK、BFF API、部署、Runbook 与版本变更文档。",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return (
    <div data-smoke="website-docs">
      <section className="hero" style={{ paddingBottom: 48 }}>
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />文档中心 · v2026.08.15</span>
        <h1 className="hero-title">协议、边界与<span className="accent">运行手册</span></h1>
        <p className="hero-sub">
          从架构与 SDK 到部署和故障恢复，所有文档均绑定明确版本；失效或尚未开放的链接不会出现在索引中。
        </p>
      </section>
      <Section index="01 / 文档索引" title="首期文档" lead="搜索标题、类型或摘要；当前仅展示已随 2026.08.15 版本发布的内容。">
        <DocsIndex />
      </Section>
      <Section index="02 / 支持" title="没有找到需要的内容？">
        <p className="section-lead">清除搜索条件后仍无结果，可联系支持团队确认权限或申请补充文档。</p>
        <a className="btn btn-primary" href="mailto:support@sumalpha.ai">联系支持</a>
      </Section>
    </div>
  );
}
