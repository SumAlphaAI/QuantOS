# PRE-05 Web 环境方案与开发说明

> 任务：FEP-0 / PRE-05 环境方案
> 版本：2.0
> 日期：2026-09-16
> 范围：第一期官网与 Web Terminal；Desktop 环境迁入[第二期计划](./SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)

## 1. 三套 Web 环境

| profile | 用途 | BFF / 认证 | mock | 模板 |
|---|---|---|---|---|
| `local-mock` | 无后端依赖的本地 UI、Story 与 E2E | MSW 拦截；mock OIDC | 必须开启 | [`env/local-mock.env.example`](../env/local-mock.env.example) |
| `local-integrated` | 本地 Web 对接本机 BFF 与开发/测试 IdP | `http://localhost:8080`；Web callback | 必须关闭 | [`env/local-integrated.env.example`](../env/local-integrated.env.example) |
| `staging` | 目标 Web 集成与验收 | HTTPS BFF、IdP、官网、Terminal 与 callback | 禁止开启 | [`env/staging.env.example`](../env/staging.env.example) |

Desktop 不是第四套一期环境。`env/desktop.env.example` 只保留为第二期未授权草案，不进入 `check:pre05`、一期构建矩阵或 PRE-05 Gate。

## 2. 配置契约

### 2.1 公开变量 allowlist

以下变量可以进入浏览器 bundle；新增任何 `NEXT_PUBLIC_*` 必须先修改 allowlist、威胁模型与测试，否则校验失败：

| 变量 | 约束 |
|---|---|
| `NEXT_PUBLIC_QUANTOS_ENV` | 仅 `local-mock`、`local-integrated`、`staging` |
| `NEXT_PUBLIC_SITE_ORIGIN` | 官网绝对 origin；staging 必须 HTTPS |
| `NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN` | Terminal 绝对 origin；staging 必须 HTTPS |
| `NEXT_PUBLIC_QUANTOS_BFF_ORIGIN` | Gateway/BFF 绝对 origin；浏览器不得直连内部服务 |
| `NEXT_PUBLIC_QUANTOS_OIDC_ISSUER` | OIDC issuer；staging 必须 HTTPS |
| `NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID` | 公开 client id，不是 client secret |
| `NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI` | 必须精确等于 `<Terminal origin>/auth/callback`；一期拒绝自定义 scheme |
| `NEXT_PUBLIC_QUANTOS_DEFAULT_MODE` | 仅 `research`、`paper`、`shadow` |
| `NEXT_PUBLIC_QUANTOS_MOCK_ENABLED` | 仅字符串 `true/false`；与 profile 强绑定 |
| `NEXT_PUBLIC_QUANTOS_OBS_ENABLED` | 仅字符串 `true/false` |
| `NEXT_PUBLIC_QUANTOS_SENTRY_DSN` | 可选公开 DSN；观测开启时必填 |
| `NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET` | 仅 `off/on`；`on` 仍不能替代服务端 flag/capability |

所有 URL 拒绝嵌入用户名、密码、query 或 fragment。`staging` 的官网、Terminal、BFF、OIDC issuer 和 callback 全部强制 HTTPS。

### 2.2 服务器秘密和测试身份

- service-role key、venue/API/模型密钥、JWT、refresh token、私钥、签名密钥与口令不得使用 `NEXT_PUBLIC_`，也不得写入三个模板。
- 校验器对公开变量 key、value 和 allowlist 做负向扫描；公开变量中的 secret 形态直接阻断构建。
- `QUANTOS_E2E_ACCOUNT_*` 仅是 staging 测试身份的非敏感标识，永不进入 bundle；模板值是占位格式，不代表账号已创建。
- 测试账号口令、MFA seed 和会话令牌只能由受控 CI/staging secret 注入。本任务未创建或使用真实账号。

### 2.3 环境与业务 mode 分离

部署 profile 只回答“连接哪套 Web 环境”，默认 mode 只回答“以 Research/Paper/Shadow 哪种业务模式进入”。Assisted Live 与 Guarded Live 都不能成为客户端默认 mode；客户端 feature flag 不是授权来源。

## 3. 启动与构建

本地运行前，把同一个 profile 放入对应 Web 应用：

```bash
cp env/local-mock.env.example apps/website/.env.local
cp env/local-mock.env.example apps/terminal/.env.local
pnpm check:pre05
pnpm --filter @sumalpha/website dev
pnpm --filter @sumalpha/terminal dev
```

`apps/website/next.config.ts` 与 `apps/terminal/next.config.ts` 在 Next.js 配置加载时调用 `assertEnv(process.env)`。缺变量、非法值、非同源 callback、staging HTTP、mock/profile 冲突或公开变量越过 allowlist 时，`dev` 和 `build` 都会在产物生成前失败。

CI 以显式的 `local-mock` job environment 构建，不依赖开发者机器上的 `.env.local`。staging 应由部署平台注入已审批的公开配置；不得把真实值提交回模板。

## 4. 校验与故障定位

| 命令 | 作用 |
|---|---|
| `pnpm check:pre05` | 校验三套 Web 模板 |
| `pnpm test:pre05` | 运行正向与 fail-closed 单元测试 |
| `node packages/config/scripts/check-env.mjs <file>` | 校验指定 env 文件 |

常见失败：

| 失败 | 处理 |
|---|---|
| 缺少必需变量 | 对照所选 Web profile 补齐，不增加代码 fallback |
| 未审核的 `NEXT_PUBLIC_*` | 先完成数据分类、allowlist 和测试评审 |
| callback 与 Terminal origin 不同源 | 注册并使用精确的 `<Terminal origin>/auth/callback` |
| staging 使用 HTTP 或启用 mock | 修正部署配置；不得绕过校验 |
| 命中 secret 指纹 | 从浏览器配置移除并轮换可能已暴露的凭据 |

## 5. 验收边界

PRE-05 repository Gate 证明配置模型、模板、应用启动 fail-fast 和 CI 接线在当前源码中可重放；它不证明 staging DNS、TLS、OIDC client、测试账号、Sentry 项目或 BFF 已实际配置。真实 staging 联调必须另行提供绑定精确提交和部署环境的证据。
