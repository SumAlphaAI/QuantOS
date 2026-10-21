import type { Metadata } from "next";
import { Section, TERMINAL_ORIGIN } from "../_components/site-chrome";

export const metadata: Metadata = {
  title: "登录",
  description:
    "登录 QuantOS Terminal：组织 SSO/OIDC 与 MFA，凭据不对 QuantOS 暴露。尚未开通访问？请先提交访问申请。",
  alternates: { canonical: "/login" },
};

/**
 * 官网登录入口页：认证在 Terminal（app.sumalpha.ai / 桌面端）完成，
 * 官网不实现 OIDC 流程，只提供受控入口与支持信息。
 */
export default function LoginPage() {
  return (
    <div data-smoke="website-login">
      <section className="hero" style={{ paddingBottom: 48 }}>
        <span className="hero-eyebrow"><span className="dot" aria-hidden="true" />登录</span>
        <h1 className="hero-title">进入 <span className="accent">Terminal</span></h1>
        <p className="hero-sub">
          认证由你的组织身份提供商完成。QuantOS 不接触你的凭据；
          高风险操作需要近期认证与六位 MFA。
        </p>
      </section>
      <Section index="01 / 登录" title="SSO / OIDC 认证">
        <div className="login-panel">
          <ul className="login-facts">
            <li><span className="sigil" aria-hidden="true">[01]</span>凭据永不对 QuantOS 暴露，全部验证在组织身份提供商完成。</li>
            <li><span className="sigil" aria-hidden="true">[02]</span>会话由 BFF 与组织身份服务管理；前端不持久化长期 token，登出或 401 清理当前前端状态。</li>
            <li><span className="sigil" aria-hidden="true">[03]</span>本页仅提供 Web Terminal 入口；桌面系统浏览器及深链认证按独立阶段验收。</li>
          </ul>
          <a className="btn btn-primary" href={`${TERMINAL_ORIGIN}/login`}>前往 Terminal 登录</a>
          <p className="form-hint" style={{ margin: 0 }}>
            尚未开通访问？<a href="/access-request" style={{ color: "var(--q-info)" }}>提交访问申请</a>。
            遇到登录问题？请联系你的组织管理员，或在系统状态页查看维护窗口。
          </p>
        </div>
      </Section>
    </div>
  );
}
