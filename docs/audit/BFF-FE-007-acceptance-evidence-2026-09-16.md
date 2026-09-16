# BFF-FE-007 验收证据（2026-09-16）

## 1. 范围与基线

- 任务：`A2 / BFF-FE-007`
- 前置依赖：`BFF-FE-001=COMPLETED`、`CORE:F05=COMPLETED`
- 起始提交：`320cdd31360f64b20cd0197996974257341c7356`
- 开始时工作树：clean
- 已检查锁文件：`Cargo.lock`、`pnpm-lock.yaml`、`engines/uv.lock`、`apps/terminal-desktop/src-tauri/Cargo.lock`
- 禁止边界：未使用生产或 staging 凭据，未部署，未发布，未调用外部 IdP、PostgreSQL 或对象存储。

## 2. 可重放验收矩阵

| 目标 | 仓库证据 | 本地结果 | 目标环境结果 |
|---|---|---|---|
| correlation/causation 分页与脱敏 | OpenAPI C10 schema、Rust provider integration test、BFF-FE-007 Gate/负向探针 | PASS | NOT RUN / NO RECEIPT |
| 按 correlation ID 在五分钟内还原 | 本地固定链分页测试可立即重放 | PASS（本地 fixture） | NOT RUN / NO RECEIPT（真实数据量/索引未验证） |
| 越权、未知、未就绪与过期下载拒绝 | capability 403、resource hiding 404、state 409、expiry 410 integration tests | PASS | NOT RUN / NO RECEIPT |
| 导出全过程审计 | create/status/cancel/download 均写入审计记录，并由 integration test 计数 | PASS（内存 provider） | NOT RUN / NO RECEIPT（真实 F05 ledger 未接线） |
| 短时 URL、水印、retention | status 不含 URL；download metadata 限时五分钟且要求 watermarked/retention/auditRef | PASS（契约与本地 provider） | NOT RUN / NO RECEIPT（真实签名器未接线） |
| 前端安全调用 | typed gateway 带 cookie、CSRF、幂等键、recent-auth；410 映射安全错误 | PASS | NOT RUN / NO RECEIPT |

## 3. 执行命令与结果

最终提交前重放以下命令：

```text
pnpm generate:bff
pnpm check:bff-openapi
pnpm check:bff-generated
pnpm check:bff-contract-coverage
pnpm check:bff-fe-000 && pnpm test:bff-fe-000
pnpm check:bff-fe-001 && pnpm test:bff-fe-001
pnpm check:bff-fe-007 && pnpm test:bff-fe-007
pnpm check:pre04 && pnpm test:pre04
pnpm check:pre06 && pnpm test:pre06
pnpm test:contract
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all -- --check
cargo clippy -p bff-gateway --all-targets -- -D warnings
cargo test -p bff-gateway
bash scripts/check-lockfiles.sh
node scripts/check-secrets.mjs
node scripts/check-development-plans.mjs
```

结果：

- OpenAPI/生成/coverage：PASS，`1.3.0 / 62 operations / 51 schemas / 62 page references`。
- BFF-FE-000/001/007 Gate：PASS；负向探针分别 `8/8`、`10/10`、`11/11`。
- PRE-04/PRE-06：PASS；负向探针分别 `6/6`、`7/7`。
- contract：`13/13` PASS；全工作区 pnpm unit tests：`116/116` PASS（其中 Terminal `60/60`）。
- lint 与 TypeScript typecheck：8 个工作区包全部 PASS。
- Rust：`cargo fmt --check` PASS、`clippy -D warnings` PASS、BFF provider `12/12` integration tests PASS。
- lockfile、secret-pattern、development-plan structure：PASS；platform load 与 GPT-6 Astra review 保持 `NOT_RUN`。

## 4. Gate 判定

- 仓库 Gate：`PASS`。
- FEP-5/G5 本地来源层：`PASS`；不得外推为 staging 或生产验收。
- staging/目标环境：`NOT RUN / NO RECEIPT`。
- GPT-6 Astra 功能复审：`NOT_STARTED`。

## 5. 未决风险

1. 本地 provider 为进程内确定性参考实现，尚未连接 F05 PostgreSQL append-only ledger/read projection；真实索引下的五分钟 SLA 未验证。
2. `downloads.invalid` 仅证明 URL 不进入 status、时效不超过五分钟以及客户端错误映射；真实对象存储签名、一次性消费、吊销和下载审计尚未验证。
3. staging consumer/provider contract、RBAC policy、retention sweeper 与目标环境隔离仍需要独立授权和结构化回执。
4. GitHub Actions 与 GPT-6 Astra 复审未在本任务中运行，不得标记为通过。
