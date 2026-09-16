# BFF-FE-001 验收证据（2026-09-16）

> 范围：A2 / BFF-FE-001
> 起始提交：`8288854b2e35363a56cf03d1d00120f0045d6a84`
> 起始工作树：clean
> 起始锁文件：`Cargo.lock`、`pnpm-lock.yaml`、`engines/uv.lock`、`apps/terminal-desktop/src-tauri/Cargo.lock`

## 证据清单

| 要求 | 仓库证据 | 结论 |
|---|---|---|
| session/context/reauth/MFA/logout/access request | OpenAPI C01、`services/bff-gateway/src/lib.rs`、provider 集成测试 | PASS（本地） |
| profile/locale/theme、通知偏好 | OpenAPI C17、Terminal settings gateway、版本冲突/幂等测试 | PASS（本地） |
| active session / trusted device revoke | recent-auth + CSRF + 404 + `auditRef` | PASS（本地） |
| 最后有效 MFA 因素保护 | `revokeMfaFactor` + `LAST_FACTOR_PROTECTED` 409 测试 | PASS（本地） |
| 撤销后实时失效 | `permission_revoked` SSE + `afterSequence` 集成测试 | PASS（本地） |
| 401/403/404 与安全文案 | provider fail-closed 集成测试；共享错误 envelope | PASS（本地） |
| 生成漂移与页面追踪 | OpenAPI/client/Zod/schema/MSW/manifest/coverage Gate | PASS |
| 可破坏 Gate | CSRF、cookie auth、recent-auth、404、409、SSE、auditRef、依赖回退 | PASS |

## 可重放命令

以下命令均在仓库根目录执行；Node/pnpm 使用仓库要求的 Node 24.12.0 / pnpm 10.20.0。

```bash
pnpm generate:bff
pnpm check:bff-openapi
pnpm check:bff-generated
pnpm check:bff-contract-coverage
pnpm check:bff-fe-000 && pnpm test:bff-fe-000
pnpm check:bff-fe-001 && pnpm test:bff-fe-001
pnpm check:pre04 && pnpm test:pre04
pnpm check:pre06 && pnpm test:pre06
cargo fmt --check
cargo clippy -p bff-gateway --all-targets -- -D warnings
cargo test -p bff-gateway
pnpm --filter @sumalpha/terminal typecheck
pnpm --filter @sumalpha/terminal test
pnpm lint
pnpm typecheck
pnpm test
node scripts/check-development-plans.mjs --fresh-review
bash scripts/check-lockfiles.sh
node scripts/check-secrets.mjs
```

## Gate 判定

- **Repository / local provider Gate：PASS**。代码、契约、生成物、客户端、测试、文档和 CI 接线均在同一提交中可重放。
- **完整 Web 测试：PASS**。首次在受限沙箱内因 SSE 测试无法绑定 `127.0.0.1` 而 `EPERM`；在允许本机 loopback 的环境中原命令重放后全部通过，未修改测试条件。
- **Target environment Gate：NOT RUN / NO RECEIPT**。未调用生产或 staging 凭据，未部署，未执行真实 IdP、Postgres、跨实例 session/SSE 或 consumer/provider 签署。
- **Review Gate：NOT_STARTED**。执行计划中的 GPT-6 Astra 复审入口保持未启动，不以本地测试替代复审。
