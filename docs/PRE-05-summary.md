# PRE-05 执行总结与验收自检

> 任务：PRE-05 环境方案（FEP-0）  状态：已纳入 G0 联合评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| `.env.example` | 四套环境模板（local/mock、local-integrated、staging、desktop），含 BFF origin、OIDC callback、feature flags、观测、E2E 测试账号 | [env/](../env/local-mock.env.example) |
| 配置校验 | validateEnv/assertEnv/parseEnvText + CLI；启动期 fail-fast | [packages/config/src/env.ts](../packages/config/src/env.ts)、[check-env.mjs](../packages/config/scripts/check-env.mjs)（`pnpm --filter @sumalpha/config check:env`） |
| 开发说明 | 四套环境对照、变量约定、启动流程、桌面差异、报错对照表 | [PRE-05-environment-guide.md](./PRE-05-environment-guide.md) |

## 2. 完成标准自检（实测）

| 完成标准 | 结果 | 证据 |
|---|---|---|
| 缺必需变量 fail-fast | 达成 | 测试"缺必需变量 fail-fast 并列出全部缺失"通过：缺 2 个必需变量即报完整清单；assertEnv 启动期抛错拒绝运行 |
| 客户端 bundle 不含 server secret | 达成 | key 指纹（SERVICE_ROLE/SECRET/PASSWORD/JWT 形态 value 等）双向扫描；测试覆盖 `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 与 JWT value 两例均拒绝 |
| 环境/mode 明确分离 | 达成 | env ∈ local-mock/local-integrated/staging 与 mode ∈ research/paper/shadow 独立校验；`assisted_live` 默认 mode 拒绝；staging 附加约束（禁 mock、强制 https、观测 DSN 必填）专项测试通过 |
| 四套配置 | 达成 | 四模板 CLI 校验 4/4 通过（check-env.mjs --examples） |
| 回归 | 通过 | vitest 10/10、typecheck、lint 全绿 |

## 3. 设计要点

- 只有 `NEXT_PUBLIC_` 前缀变量可进入 bundle；E2E 测试账号不带前缀（不进 bundle），口令存 CI secret。
- Assisted Live testnet flag 仅 off/on，客户端 flag 只是显示条件，授权始终由服务端 flag/capability 放行（L03）。
- desktop 模板复用部署环境 + 壳层变量（platform/deep link/quantos:// callback），与 PRE-03 Tauri 配置及 smoke 对齐。
- 校验器零依赖纯 TS，CLI 复用同一实现（Node 24 type stripping），CI 可直接接入。

## 4. 遗留项

1. FEP-1（UI-101/102）在 app bootstrap 接线 `assertEnv` 与各 app `env.ts` 适配。
2. `check:env` 已接入 Frontend Baseline CI。
3. staging 真实 origin/IdP/DSN 值由 SRE 在部署单中注入；模板只含占位公开值。
4. 本任务交付物已纳入 2026-08-14 G0 六方联合评审。
