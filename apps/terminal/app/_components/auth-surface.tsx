import { AuthIcon } from "./auth-icon";
import type { ReactNode } from "react";

export function AuthBrand() {
  return <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true"><i /><b /><em /></span><span>SUMALPHA</span></div>;
}

export function AuthPageShell({ children, facts = false }: { children: ReactNode; facts?: boolean }) {
  return (
    <main className={`auth-page ${facts ? "with-facts" : ""}`}>
      <div className="auth-language" aria-label="当前语言">◎ 简体中文</div>
      <div className="auth-stage">{children}{facts ? <SecurityFacts /> : null}</div>
      <footer className="auth-footer"><a href="/maintenance">系统状态</a><span />
        <details id="auth-privacy"><summary>隐私</summary><p>申请信息仅用于访问资格审核，审核行为记录审计。请勿在用途说明中提供密码、密钥或交易凭据。隐私说明版本：2026-08-15。</p></details><span />
        <details id="auth-security"><summary>安全</summary><p>登录通过组织身份提供商和 PKCE 完成。验证码仅用于当前验证，错误不会说明账户或资源是否存在。网络恢复后仍需验证会话与权限。</p></details><span />
        <details id="auth-support"><summary>需要帮助？</summary><p>请通过组织既有渠道联系主工作区管理员。提供错误通知中的关联 ID 和发生时间；请勿发送密码、验证码或密钥。</p></details>
      </footer>
    </main>
  );
}

export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`auth-card ${className}`}>{children}</section>;
}

function SecurityFacts() {
  const facts = [
    { icon: "shield" as const, title: "安全边界", copy: "你的凭据永不对 QuantOS 暴露。通过组织身份提供商进行验证，密钥全程受保护。", tone: "cyan" },
    { icon: "audit" as const, title: "全链路审计", copy: "所有受控操作都会记录并可追溯。审计日志具备完整性保护与防篡改保障。", tone: "cyan" },
    { icon: "paper" as const, title: "Paper / Shadow", copy: "系统不下发任何交易指令。所有分析与模拟均在 Paper / Shadow 模式执行。", tone: "amber" },
  ];
  return <aside className="security-facts" aria-label="安全、审计与运行模式说明">{facts.map((fact) => <article key={fact.title}><span className={fact.tone} aria-hidden="true"><AuthIcon kind={fact.icon} /></span><div><h2>{fact.title}</h2><p>{fact.copy}</p></div></article>)}</aside>;
}
