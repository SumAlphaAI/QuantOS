# PRE-05 Web 环境方案与开发说明

> 任务：FEP-0 / PRE-05 环境方案
> 版本：3.1
> 日期：2026-10-02
> 范围：第一期官网与 Web Terminal；Desktop 环境迁入[第二期计划](../SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)

## 1. 三套 Web 环境

| profile | 用途 | BFF / 认证 | mock | 模板 |
|---|---|---|---|---|
| `local-mock` | 本地配置、静态/fixture UI及带拦截的测试 | 普通dev无MSW worker；OIDC仅测试route拦截 | 必须开启 | [`env/local-mock.env.example`](../../env/local-mock.env.example) |
| `local-integrated` | 本地 Web 对接本机 BFF 与开发/测试 IdP | `http://localhost:8080`；Web callback | 必须关闭 | [`env/local-integrated.env.example`](../../env/local-integrated.env.example) |
| `staging` | 目标 Web 集成与验收 | HTTPS BFF、IdP、官网、Terminal 与 callback | 禁止开启 | [`env/staging.env.example`](../../env/staging.env.example) |

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
| `NEXT_PUBLIC_QUANTOS_OIDC_ISSUER` | 当前仅支持根路径的 IdP origin（/authorize、/token）；路径型issuer明确拒绝，staging必须HTTPS |
| `NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID` | 公开 client id，不是 client secret |
| `NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI` | 必须精确等于 `<Terminal origin>/auth/callback`；一期拒绝自定义 scheme |
| `NEXT_PUBLIC_QUANTOS_DEFAULT_MODE` | 仅 `research`、`paper`、`shadow` |
| `NEXT_PUBLIC_QUANTOS_MOCK_ENABLED` | 仅字符串 `true/false`；与 profile 强绑定 |
| `NEXT_PUBLIC_QUANTOS_OBS_ENABLED` | 仅字符串 `true/false` |
| `NEXT_PUBLIC_QUANTOS_SENTRY_DSN` | 可选公开 DSN；任一profile观测开启时必填；有值即检查HTTPS/公共用户名/数字项目路径，无密码/query/fragment |
| `NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET` | 仅 `off/on`；`on` 仍不能替代服务端 flag/capability |

官网/Terminal/BFF/IdP/callback URL拒绝用户名、密码、query或fragment。Sentry DSN必须带公开用户名，但同样拒绝密码/query/fragment。所有公开变量拒绝首尾空白；callback原值必须精确等于约定URI，不放行尾斜杠。`staging` 的官网、Terminal、BFF、OIDC issuer 和 callback 全部强制 HTTPS。

### 2.2 服务器秘密和测试身份

- service-role key、venue/API/模型密钥、JWT、refresh token、私钥、签名密钥与口令不得使用 `NEXT_PUBLIC_`，也不得写入三个模板。
- 校验器对公开变量key、value和allowlist做负向扫描；已知API/JWT/私钥/Supabase/GitHub/AWS凭据形态会在构建前拒绝，诊断不回显值。
- 两应用build最后扫描实际客户端JS/HTML/map/CSS/JSON等文件，同时检查已知凭据指纹及按各应用生产构建优先级加载的有效服务器秘密值（进程注入 > `.env.production.local` > `.env.local` > `.env.production` > `.env`，独立进程解析变量展开，应用间隔离）；所有明确命名的非空秘密均检查，不以长度豁免；空值不作为秘密指纹。目录缺失/为空也拒绝。`pnpm check:client-secrets`可重放产物检查，CI显式执行。指纹检查不能替代秘密管理、数据分类或真实发布审查。
- `QUANTOS_E2E_ACCOUNT_*` 仅是 staging 测试身份的非敏感标识，永不进入 bundle；模板值是占位格式，不代表账号已创建。
- 测试账号口令、MFA seed 和会话令牌只能由受控 CI/staging secret 注入。本任务未创建或使用真实账号。

### 2.3 环境与业务 mode 分离

部署 profile 只回答“连接哪套 Web 环境”，默认 mode 只回答“以 Research/Paper/Shadow 哪种业务模式进入”。Assisted Live 与 Guarded Live 都不能成为客户端默认 mode；客户端 feature flag 不是授权来源。

## 3. 启动与构建

本地运行前，把同一个profile放入对应Web应用。`local-mock`仅配置准备，不提供普通dev的离线登录/全BFF拦截：

```bash
cp env/local-mock.env.example apps/website/.env.local
cp env/local-mock.env.example apps/terminal/.env.local
pnpm check:pre05
pnpm --filter @sumalpha/website dev
pnpm --filter @sumalpha/terminal dev
```

`apps/website/next.config.ts` 与 `apps/terminal/next.config.ts` 在 Next.js 配置加载时调用 `assertEnv(process.env)`。缺变量、非法值、非同源 callback、staging HTTP、mock/profile 冲突或公开变量越过 allowlist 时，`dev` 和 `build` 都会在产物生成前失败。

普通dev登录会跳转模板的占位IdP，因此不能将认证成功作为此启动步骤的预期。`tests/e2e/auth-callback.spec.ts`通过Playwright route验证mock认证；这不是应用MSW注册。全量mock与真实IdP/provider由后续UI-102、BFF-FE-001及各页面契约任务承接，不把它们记作PRE-05已交付能力。

CI 以显式的 `local-mock` job environment 构建，不依赖开发者机器上的 `.env.local`。staging 应由部署平台注入已审批的公开配置；不得把真实值提交回模板。

## 4. 校验与故障定位

| 命令 | 作用 |
|---|---|
| `pnpm check:pre05` | 校验三套 Web 模板 |
| `pnpm test:pre05` | 配置回归与产物/CLI门禁回归 |
| `pnpm check:client-secrets` | 检查两个应用已有客户端产物；构建命令也逐应用执行 |
| `node packages/config/scripts/check-env.mjs <file>` | 校验指定env文件，相对路径按仓库根解析，绝对路径直接使用 |

`pnpm check:pre05`所调用的CLI独立绑定三个文件的profile身份，并要求staging模板保留Researcher/Trader/Approver/Admin四类非敏感占位标识；不允许Web模板掺入服务器变量。单个部署文件校验只检查公开运行配置，不强迫浏览器部署提供E2E账号。真实测试身份及可用性由受控测试环境负责。

CLI解析通过服务器专用入口`@sumalpha/config/env-file`复用与Next相同版本的`@next/env`（15.5.24），支持引号、行内注释、多行和变量展开。每个文件在独立进程的空环境中解析，不继承机器秘密或其他文件的缓存；因此CLI检验的是该文件本身。实际Next启动使用process.env优先，其后按NODE_ENV依次选取`.env.<env>.local`、`.env.local`（test时跳过）、`.env.<env>`、`.env`；CI注入值覆盖文件值。需要核对实际覆盖结果时使用各应用启动/构建检查，不把单文件校验当成部署环境读取回执。解析器不通过浏览器入口导出。

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
