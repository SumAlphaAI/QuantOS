import { AuthBrand, AuthCard, AuthPageShell } from "./_components/auth-surface";

export default function NotFound() {
  return <AuthPageShell><AuthCard className="status-auth-card"><AuthBrand /><div className="status-icon danger" aria-hidden="true">×</div><h1>未找到或无权访问此资源</h1><p className="auth-lead">无法访问请求的内容。出于安全考虑，我们不会说明该资源是否存在。</p><div className="status-actions"><a href="/command">返回 Terminal</a><a href="#support">联系管理员</a></div></AuthCard></AuthPageShell>;
}
