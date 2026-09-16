# BFF-FE-000 验收证据（2026-09-16）

> 任务：A1 / BFF-FE-000 页面 BFF OpenAPI 基线
>
> 开始基线：`e3f126acd7fefb95d0378d3b213d03e9d6922667`
>
> 环境：macOS，Node.js `v24.12.0`，仓库指定 pnpm `10.20.0`
>
> 证据边界：仅仓库、生成契约、fixture/mock 与本地测试；未使用生产/staging 凭据，未部署或外部发布。

## 1. 开始状态与锁文件

- 开始时 `git status --short` 为空，分支 `main`，HEAD 为上述提交。
- 仓库锁文件包括根 `pnpm-lock.yaml`、根 `Cargo.lock`、`apps/terminal-desktop/src-tauri/Cargo.lock` 与 `engines/uv.lock`。
- 为交付计划明确要求的同源 Zod schema，`packages/api-client` 增加仓库已锁定的 `zod@4.4.3`，并仅更新 `pnpm-lock.yaml` 的 workspace importer；Rust 与 uv 锁文件无变更。

## 2. 实现证据

| 要求 | 实现与证据 |
|---|---|
| session/error/cursor/sort/filter/202/idempotency/version/correlation/SSE 基线 | `bff/openapi/quantos-bff.v1.yaml` 的共享 parameters/headers/schemas；A1 Gate 强制 |
| C01–C17 与一期页面追踪 | `bff/page-operation-catalog.yaml`；17 契约、22 页、55 published + 51 planned |
| TS client / Zod / JSON Schema / MSW | `pnpm generate:bff` 同源生成；`pnpm check:bff-generated` 防漂移；Zod fixture 正/负向解析进入 contract test |
| provider/consumer 与敏感字段 Gate | OpenAPI/coverage/A1 negative probes + `tests/contract` 的 403/409/429/501、schema、权限和敏感字段用例 |
| CI | `make bff-contract-check` 与 `.github/workflows/frontend-baseline.yml` 均运行 A1 正/负向 Gate |

## 3. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `bash scripts/check-lockfiles.sh` | PASS | 必需锁文件存在；pnpm importer 同步 Zod，其他锁文件未改 |
| `pnpm check:bff-openapi` | PASS | OpenAPI 3.1、本地 ref、operationId、幂等和 SSE 基线通过 |
| `pnpm check:bff-generated` | PASS | client/Zod/JSON Schema/55-operation manifest/MSW 无漂移 |
| `pnpm check:bff-contract-coverage` | PASS | 55 operations / 41 schemas / 页面引用通过 |
| `pnpm check:bff-fe-000` | PASS | 17 contracts / 22 pages / 55 published + 51 planned |
| `pnpm test:bff-fe-000` | PASS | 8/8 正向与删除/漂移负向探针 |
| `pnpm test:contract` | PASS | 13/13；JSON Schema/Zod/MSW/错误/权限/敏感字段契约测试通过 |
| `node scripts/check-development-plans.mjs` | PASS | 项目计划结构与依赖拓扑通过；未声称模型复审 |
| `pnpm lint` / `pnpm typecheck` | PASS | workspace 静态检查通过 |
| `pnpm test` | PASS | 22 个测试文件、111 个测试通过；SSE loopback 用例在允许本机监听的环境复验 |
| `git diff --check` | PASS | 无空白错误 |

## 4. Gate 结论

- **A1/BFF-FE-000 repository Gate：PASS。** 任务 `development_status=COMPLETED`。
- **生成契约与 mock/consumer Gate：PASS。** 已发布面可重生成且漂移受阻断。
- **A2–A6 provider/staging Gate：NOT RUN / NO RECEIPT。** 51 个 planned operation 仍须后续任务发布和实现。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造模型调用或组织联签。

## 5. 未决风险

1. 本轮没有启动真实 BFF/provider，也没有 staging 身份、权限、限流、SSE 回补或审计回执。
2. catalog 的 planned operation 只冻结名称和 owner；最终 path、method、request/response schema 仍由 A2–A6 版本化 OpenAPI 决定。
3. GitHub Actions 本轮未运行；本地验证不是远端 CI receipt。

## 6. 下一可执行任务

按拓扑顺序进入 **A2 / BFF-FE-001：身份、会话与设置 API**。执行时不得把 A1 mock/生成证据当作 staging provider 验收。
