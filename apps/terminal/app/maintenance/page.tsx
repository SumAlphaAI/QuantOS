import { AuthBrand, AuthCard, AuthPageShell } from "../_components/auth-surface";

export default function MaintenancePage() {
  return <AuthPageShell><AuthCard className="status-auth-card"><div data-smoke="route-/maintenance"><AuthBrand /><div className="status-icon amber" aria-hidden="true">◇</div><h1>系统维护中</h1><p className="auth-lead">Terminal 暂时不可用。系统不会在维护期间接受创建、审批或交易操作。</p><a className="auth-primary auth-link-button amber-button" href="/maintenance">刷新状态</a><p className="auth-note">如需协助，请通过支持渠道提供关联 ID；请勿发送凭据或验证码。</p></div></AuthCard></AuthPageShell>;
}
