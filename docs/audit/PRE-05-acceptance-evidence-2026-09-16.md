# PRE-05 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-05 环境方案（Web-only）
> 验证基线：`56b3086505563e6f53ad5dc2051f6441d0c77c2c`
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`
> 证据边界：验证当前仓库的三套 Web 配置、构建期 fail-fast、secret 防线与 CI 接线；未使用生产/staging 凭据、真实测试账号、签名材料或外部发布授权。

## 1. 开始状态与锁文件

- 开始时 `git status --short --branch` 为 `## main...origin/main [ahead 1]`，工作区和暂存区为空；HEAD 为上述 Web/Desktop 计划拆分提交。
- `bash scripts/check-lockfiles.sh` 确认所有必需锁文件存在。
- Terminal 为直接加载共享 Web 配置校验器新增 `@sumalpha/config` workspace 依赖；`pnpm-lock.yaml` 仅增加对应 importer link。固定 pnpm 以 `--lockfile-only --offline --frozen-lockfile` 证明 manifest 与锁文件一致。

## 2. 发现与修复

1. 旧 PRE-05 把 Desktop 列为第四环境，与第一期 Web-only 边界冲突；现收敛为 `local-mock`、`local-integrated`、`staging`，Desktop 样例仅保留为第二期未授权草案并退出一期 Gate。
2. `validateEnv/assertEnv` 已存在但没有接入官网和 Terminal 的 Next.js 配置，缺变量时仍可能依赖页面 fallback；现两个应用均在配置加载阶段 fail-fast。
3. 旧配置未冻结官网/Terminal origin，也未强制 OIDC callback 与 Terminal 同源；现 callback 必须精确为 `<Terminal origin>/auth/callback`，第一期拒绝 `quantos://`。
4. 旧校验允许未知 `NEXT_PUBLIC_*`、非标准布尔值和带路径的 origin；现使用显式公开变量 allowlist，并拒绝凭据、query、fragment、origin path 及 profile/mock 冲突。
5. staging 旧约束只要求 Sentry DSN 非空；现要求无密码的 HTTPS 公网 DSN，并继续禁止 mock、HTTP URL 与 Assisted/Guarded Live 默认 mode。
6. CI 与可复现构建脚本原先没有显式 Web profile；相关 job/script 现使用非敏感且确定性的 `local-mock` 配置，CI 同时执行 PRE-05 正向/负向测试。

## 3. 交付物

| 产出 | 位置 |
|---|---|
| 三套 Web 模板 | `env/local-mock.env.example`、`env/local-integrated.env.example`、`env/staging.env.example` |
| 配置模型与 fail-fast | `packages/config/src/env.ts` |
| 模板 CLI 与负向测试 | `packages/config/scripts/check-env.mjs`、`packages/config/tests/config.test.ts` |
| 官网/Terminal 构建接线 | `apps/website/next.config.ts`、`apps/terminal/next.config.ts` |
| 开发说明 | `docs/PRE-05-environment-guide.md` |
| CI 接线 | `.github/workflows/ci.yml`、`frontend-baseline.yml`、`compatibility.yml` |
| 可复现构建接线 | `scripts/verify-reproducible-builds.mjs` |

## 4. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `pnpm check:pre05` | PASS | 三套 Web example 全部通过；Desktop 不在一期 examples 集合 |
| `pnpm test:pre05` | PASS | 12/12；缺变量、secret、未知公开变量、环境/mode、布尔值、callback/origin、mock/profile、staging HTTPS/DSN 均 fail closed |
| 清空 `NEXT_PUBLIC_*` 后执行 Terminal build | PASS（预期拒绝） | Next 配置加载阶段输出 `环境配置校验失败（fail-fast）` 并列出 BFF/OIDC 等缺失项 |
| 显式 local-mock 配置构建 website / terminal | PASS | 官网 12 个静态生成步骤；Terminal 17 个静态生成步骤、15 条路由 |
| 显式 local-mock 配置执行 `pnpm build` | PASS | 8 个 workspace 项目完成构建；配置、官网、Terminal 与既有 workspace 依赖链无回归 |
| `node --check scripts/verify-reproducible-builds.mjs` | PASS | 可复现构建脚本的确定性 Web profile 接线语法有效 |
| `pnpm lint` | PASS | 8 个 workspace 项目 |
| `pnpm typecheck` | PASS | 8 个 workspace 项目 |
| `pnpm test` | PASS | 沙箱外允许本机临时回环监听后，22 个测试文件、111 个测试通过；沙箱内仅既有 SSE 用例因 `listen EPERM` 失败 |
| `pnpm check:pre03` | PASS | 26 个锁定依赖、43 个运行时契约检查、3 个构建路由 smoke |
| YAML parse（三个修改的 workflow） | PASS | `ci.yml`、`frontend-baseline.yml`、`compatibility.yml` 均可解析 |
| `node scripts/check-secrets.mjs .` | PASS | repository secret-pattern checks passed |
| `node scripts/check-development-plans.mjs --fresh-review` | PASS | structure / desktop_scope_split PASS；platform/model review NOT_RUN |
| `bash scripts/check-lockfiles.sh` | PASS | 所有必需锁文件存在 |
| `git diff --check` | PASS | 无空白错误 |

## 5. Gate 结论

- **PRE-05 repository Gate：PASS。** 三套 Web profile、配置 allowlist、构建期 fail-fast、secret 防线、文档和 CI 接线可在当前仓库重放。
- **PRE-05 development status：COMPLETED。** 仅表示源码与仓库 Gate 完成，不表示 staging 已部署或 Integrated。
- **Web-only scope Gate：PASS。** Desktop 环境不参与 `check:pre05`、一期构建或本任务验收。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造平台加载或模型结论。

## 6. 未决风险

1. staging DNS、TLS、BFF、OIDC client/callback、Sentry 项目和四类测试身份尚未在目标环境验证；模板值不是部署 receipt。
2. `QUANTOS_E2E_ACCOUNT_*` 仅为非敏感占位标识；口令、MFA seed 和会话必须由受控 secret 系统提供，不能提交到仓库。
3. Desktop 环境草案保留给第二期，未经过第二期 D0/D1 Gate，不得据此启动签名、分发或更新通道。
4. 当前任务没有生产凭据、外部网络联调或发布证据；staging 验收仍须绑定精确源提交与部署 receipt。

## 7. 下一可执行任务

按执行计划依赖顺序为 **PRE-06：测试基线**。开始前保持 PRE-04/PRE-05 repository Gate 通过，并继续将本地/仓库测试与真实 staging 验收分开记录。
