# PRE-05 环境方案：开发说明

> 任务：PRE-05 环境方案（FEP-0）  版本：1.0  日期：2026-08-14
> 校验器：[packages/config/src/env.ts](../packages/config/src/env.ts)；CLI：`pnpm --filter @sumalpha/config check:env` 或 `node packages/config/scripts/check-env.mjs <file>`

## 1. 四套环境

| 环境 | 用途 | BFF | 认证 | mock | 模板 |
|---|---|---|---|---|---|
| local/mock | 纯本地开发，零后端依赖 | MSW 浏览器侧拦截（origin 仅标识 `http://localhost:4010`） | MSW 伪认证流 | 强制开 | [env/local-mock.env.example](../env/local-mock.env.example) |
| local-integrated | 本地前端 + 本机真实 BFF 联调 | `http://localhost:8080` | 开发/staging IdP，本地回调 | 关 | [env/local-integrated.env.example](../env/local-integrated.env.example) |
| staging | 部署验收 | `https://bff.staging.sumalpha.ai`（强制 https） | staging IdP | 禁 mock | [env/staging.env.example](../env/staging.env.example) |
| desktop | Tauri 壳 | 复用上三种部署环境之一；壳层仅加平台/深链变量 | 系统浏览器 + `quantos://auth/callback` 深链回跳（回跳重新鉴权） | 随部署环境 | [env/desktop.env.example](../env/desktop.env.example) |

浏览器与桌面端只访问 Gateway/BFF，不直连 Supabase 数据库、Realtime 原始表、NATS、Engine、Execution Gateway 或 venue（执行计划 1.1）。

## 2. 变量约定

- **进入客户端 bundle 的变量一律 `NEXT_PUBLIC_` 前缀**，且只允许公开值（OIDC client id、Sentry 公网 DSN 等）。service role key、venue/API/模型密钥、JWT、私钥永远禁止；校验器对 key 与 value 做双向 secret 指纹扫描。
- **环境/mode 分离**：`NEXT_PUBLIC_QUANTOS_ENV`（部署环境：local-mock/local-integrated/staging）与 `NEXT_PUBLIC_QUANTOS_DEFAULT_MODE`（运行模式：research/paper/shadow）独立校验；Assisted/Guarded Live 不可作默认 mode。
- **feature flag**：`NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET` 仅 off/on，默认 off；即使 on，UI/API 也须由服务端 flag/capability 放行（L03）。客户端 flag 只是显示条件，不是授权。
- **观测**：`NEXT_PUBLIC_QUANTOS_OBS_ENABLED` + `NEXT_PUBLIC_QUANTOS_SENTRY_DSN`（公网 DSN）；staging 开启观测时 DSN 必填；token、密钥、完整敏感载荷不上报。
- **测试账号**：staging 模板尾部四个 `QUANTOS_E2E_ACCOUNT_*`（无 `NEXT_PUBLIC_` 前缀，不进 bundle），口令存 CI secret，不落库到任何 env 文件。

## 3. 启动流程（fail-fast）

1. 复制模板：`cp env/local-mock.env.example apps/terminal/.env.local`
2. 启动前校验：`node packages/config/scripts/check-env.mjs apps/terminal/.env.local`
3. 应用启动时 `assertEnv(process.env)`（FEP-1 接线进 app bootstrap）：缺任一必需变量即抛出完整缺失清单，拒绝启动——不允许"带病运行"。

## 4. 桌面端差异

- dev：`tauri dev` 经 `devUrl=http://localhost:3100` 加载 terminal dev server；prod：壳嵌入 `apps/terminal/out`（同一产物，PRE-03 smoke 验证）。
- `NEXT_PUBLIC_QUANTOS_PLATFORM=desktop` 供 `packages/platform` 选择 desktop adapter；业务代码禁止 `isDesktop` 分叉。
- OIDC redirect 使用 `quantos://auth/callback`，深链在 BFF 重新鉴权后加载，URL 不放 token/资源数据。

## 5. 常见校验失败对照

| 报错 | 含义 | 处理 |
|---|---|---|
| 缺少必需变量（fail-fast） | 8 个必需 `NEXT_PUBLIC_` 变量不全 | 对照所用环境模板补齐 |
| 非法环境 / 非法默认 mode | env 或 mode 拼写或越界 | env ∈ local-mock/local-integrated/staging；mode ∈ research/paper/shadow |
| staging 禁止开启 mock | staging 模板被改动 | staging 必须 `MOCK_ENABLED=false` |
| staging BFF/callback 必须 https | 协议降级 | 改回 https |
| key/value 命中 server-secret 指纹 | 把秘密写进了公开变量 | 移出客户端变量；secret 只属于 BFF/Vault |
| staging 观测开启必须配 DSN | OBS_ENABLED=true 但 DSN 空 | 配公网 DSN 或关观测 |
