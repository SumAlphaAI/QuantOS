import type { ReactNode } from "react";

export function AuthBrand() {
  return <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true"><i /><b /><em /></span><span>SUMALPHA</span></div>;
}

export function AuthPageShell({ children, facts = false }: { children: ReactNode; facts?: boolean }) {
  return (
    <main className={`auth-page ${facts ? "with-facts" : ""}`}>
      <div className="auth-language" aria-label="当前语言">◎ 简体中文 ⌄</div>
      <div className="auth-stage">{children}{facts ? <SecurityFacts /> : null}</div>
      <footer className="auth-footer"><a href="/maintenance">系统状态</a><span /> <a href="#privacy">隐私</a><span /> <a href="#security">安全</a></footer>
    </main>
  );
}

export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`auth-card ${className}`}>{children}</section>;
}

function SecurityFacts() {
  const facts = [
    { icon: "♢", title: "安全边界", copy: "你的凭据永不对 QuantOS 暴露。通过组织身份提供商进行验证，密钥全程受保护。", tone: "cyan" },
    { icon: "▧", title: "全链路审计", copy: "所有受控操作都会记录并可追溯。审计日志具备完整性保护与防篡改保障。", tone: "cyan" },
    { icon: "▱", title: "Paper / Shadow", copy: "系统不下发任何交易指令。所有分析与模拟均在 Paper / Shadow 模式执行。", tone: "amber" },
  ];
  return <aside className="security-facts" aria-label="安全、审计与运行模式说明">{facts.map((fact) => <article key={fact.title}><span className={fact.tone} aria-hidden="true">{fact.icon}</span><div><h2>{fact.title}</h2><p>{fact.copy}</p></div></article>)}</aside>;
}
