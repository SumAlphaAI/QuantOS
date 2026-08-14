# G0 Tauri 深链 PoC 可复现证据

> 验证日期：2026-08-14  验证范围：接收、消毒、授权 Gate、目标导航、OIDC callback、失败关闭
> 结论：通过。桌面壳不再把原始外部 URL 直接交给页面，也不允许深链绕过 BFF 会话/权限复核。

## 1. 实现证据

| 控制点 | 实现 |
|---|---|
| 冷启动接收 | `app.deep_link().get_current()` 读取启动参数中的协议 URL |
| 运行中接收 | `app.deep_link().on_open_url(...)` 接收 OS 二次投递 |
| URL 消毒 | 仅允许 `quantos://command` 和 `quantos://auth/callback`；拒绝凭据、端口、fragment、未知 query、未知路由和非 URL-safe OAuth 值 |
| 原始 URL 隔离 | Rust 将外部 URL 转成封闭的 `DeepLinkNavigation`，页面永远看不到原始 URL |
| 重新鉴权 | `quantos://command` 先进入 `/auth/deep-link?return_to=%2Fcommand`，页面以 cookie 调用 BFF `GET /v1/session` |
| 目标导航 | 2xx 才进入消毒后的 `/command`；401/403 转 `/login`；429/5xx/网络错误停留在 Gate 并显示安全错误 |
| OIDC callback | 只转发 code+state 或单一 error；既有 callback 继续校验 state、使用 PKCE verifier 交换并移除 URL 中授权材料 |
| 最小权限 | Webview capability 不再授予 `deep-link:default`；深链仅由 Rust 壳消费 |

关键文件：

- `apps/terminal-desktop/src-tauri/src/deep_link.rs`
- `apps/terminal-desktop/src-tauri/src/main.rs`
- `apps/terminal/app/auth/deep-link/page.tsx`
- `apps/terminal/src/auth/deep-link.ts`
- `tests/e2e/deep-link-reauth.spec.ts`

## 2. 自动化复现

在仓库根目录执行：

```bash
pnpm test:tauri-deep-link
pnpm --filter @sumalpha/terminal test
pnpm --filter @sumalpha/terminal build
pnpm exec playwright test tests/e2e/deep-link-reauth.spec.ts tests/e2e/auth-callback.spec.ts --project=chromium
pnpm smoke:pre03
```

2026-08-14 实测结果：

| 检查 | 结果 |
|---|---|
| Rust sanitizer/navigation | 4/4 通过 |
| Terminal unit/scenario | 40/40 通过，其中深链授权决策 3/3 |
| 深链重新鉴权 E2E | 4/4 通过：2xx、401、恶意目标、503 |
| OIDC callback E2E | 4/4 通过 |
| PRE-03 双端 smoke | 10/10 通过（构建后执行） |

## 3. OS/GUI 复验步骤

发布候选桌面包在 macOS/Windows 安装后使用以下相同用例复验；结果由 Frontend TL 与 Security 记录到发布流水线：

1. 启动关闭状态的应用，打开 `quantos://command`，确认先出现“重新验证会话”且 BFF 收到 `GET /v1/session`。
2. 关闭/撤销服务端会话后再次打开，确认进入 `/login?return_to=/command`，不能短暂显示业务页。
3. 应用运行中再次打开 `quantos://command`，确认复用同一 Gate。
4. 打开带 query/fragment、未知 host 或跨站材料的 URL，确认不导航。
5. 用 mock/staging IdP 回投 `quantos://auth/callback?code=<code>&state=<state>`，确认 state/PKCE 交换完成后 URL 不含 code/token。

该 GUI 复验属于每个签名桌面候选包的持续回归，不再是 G0 代码缺口；失败时桌面深链与系统浏览器登录能力必须保持关闭。
