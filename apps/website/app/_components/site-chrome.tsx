import type { ReactNode } from "react";

/** 官网站点框架：导航、页脚与品牌标识。全部为服务端渲染，无客户端 JS。 */

export const SITE_NAV = [
  { href: "/product", label: "产品" },
  { href: "/architecture-security", label: "架构与安全" },
  { href: "/use-cases", label: "使用场景" },
  { href: "/docs", label: "文档" },
  { href: "/access-request", label: "访问申请" },
] as const;

export const TERMINAL_ORIGIN =
  process.env.NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN ?? "https://app.sumalpha.ai";

export function BrandLockup() {
  return (
    <a className="brand-lockup" href="/" aria-label="SumAlpha 首页">
      <span className="brand-mark" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 9 L5 3 L8 7 L11 2" stroke="var(--q-info)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      SUMALPHA
    </a>
  );
}

export function SiteHeader({ activePath }: { activePath?: string }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLockup />
        <nav className="site-nav" aria-label="官网导航">
          {SITE_NAV.map((item) => (
            <a key={item.href} href={item.href} aria-current={activePath === item.href ? "page" : undefined}>
              {item.label}
            </a>
          ))}
          <a href="/login" aria-current={activePath === "/login" ? "page" : undefined}>登录</a>
        </nav>
        <a className="btn btn-primary header-cta" href="/access-request">申请访问</a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <BrandLockup />
          <p>
            QuantOS 是面向专业量化团队的 AI 原生研究与交易操作系统。Agent 只提出建议，绝不直接下单；
            所有受控操作默认在 Paper/Shadow 模式执行并留存全链路审计。
          </p>
        </div>
        <nav aria-label="产品导航">
          <h2>产品</h2>
          <ul>
            <li><a href="/product">产品能力</a></li>
            <li><a href="/architecture-security">架构与安全</a></li>
            <li><a href="/use-cases">使用场景</a></li>
            <li><a href="/docs">文档中心</a></li>
          </ul>
        </nav>
        <nav aria-label="支持导航">
          <h2>支持</h2>
          <ul>
            <li><a href="/access-request">访问申请</a></li>
            <li><a href="/login">登录 Terminal</a></li>
            <li><a href={`${TERMINAL_ORIGIN}/maintenance`}>系统状态</a></li>
          </ul>
        </nav>
      </div>
      <div className="footer-legal">
        © 2026 SumAlpha。本网站不构成投资建议，不宣传任何收益；QuantOS 不提供公众投资推荐、社区跟单或收益排行功能。
        访问申请与登录行为将被限速并记录审计。
      </div>
    </footer>
  );
}

export function Section({
  index,
  title,
  lead,
  children,
}: {
  index: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="page-section">
      <span className="section-index" aria-hidden="true">{index}</span>
      <h2 className="section-title">{title}</h2>
      {lead ? <p className="section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}
