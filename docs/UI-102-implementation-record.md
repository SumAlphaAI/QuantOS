# UI-102 实施记录

> 阶段：FEP-1（W3–W4）  状态：UI Complete / Local Provider Implemented  日期：2026-09-16

## 需求与交付映射

| UI-102 要求 | 实现 | 验证 |
|---|---|---|
| OIDC + PKCE | 组织账户登录、S256 challenge、state 校验、callback 交换；pending verifier 仅在 `sessionStorage` 且回调读取后删除 | `auth-poc.test.ts`、`auth-callback.spec.ts` |
| 安全 callback | 读取 code/state 后立即清理地址栏；错误不展示 IdP 内部描述；服务端 `mfa_required` 分流到 `/mfa` | unit + E2E |
| MFA | 六位键盘/粘贴输入、冻结 C01 `mfaChallenge` schema、verified 后返回安全路由；failed/429 使用账户中性文案和 retryAfter | `auth-bff.test.ts`、`ui102-auth.spec.ts` |
| 401 | `handleAuthHttpStatus` 清空唯一内存 session，再生成消毒后的 login return path；已接入 desktop deep-link 重新鉴权 | unit + deep-link E2E |
| 403/404 | 两者统一为“未找到或无权访问此资源”，不区分真实不存在与无权；支持安全 correlation ID | E2E 对比两路由文案 |
| maintenance/offline | 维护期明确拒绝写操作；离线强制只读，恢复后重新鉴权且不自动提交旧意图 | E2E |
| 访问申请 | 使用冻结 C01 schema；202 仅显示“已受理”，不伪造权限开通；422/429 安全失败 | unit + E2E |
| 多端与无障碍 | 1440 基准、390px、200% 缩放、六位输入标签、焦点、axe、视觉回归 | Chromium E2E + 实际浏览器复核 |

## 时间节点与质量状态

- W3：OIDC/PKCE、安全 callback、统一 HTTP auth policy 完成。
- W4：P01 页面、MFA、错误/维护/离线状态、多端适配、unit/E2E/axe/视觉验证完成。
- C01/C08 的本任务所需 operation 已使用 OpenAPI 1.2.0 生成类型；C01 已有本地 Rust 参考 provider，provider staging 与真实 IdP/MFA 联调仍需在 G1 环境签署。

## G1 待联调项

1. staging IdP callback、SameSite/HttpOnly cookie、CSRF 与服务端 logout/revoke 证据。
2. MFA challenge 的真实 5 次失败锁定、retryAfter、recent-auth 生命周期及审计事件。
3. callback error 的服务端认证审计 operation 尚未在页面契约中单列；当前前端只保留安全提示，不伪造审计成功。
4. Web/Desktop 同一用例矩阵与设计 1440 视觉签署完成后，方可标记 G1 Done。
