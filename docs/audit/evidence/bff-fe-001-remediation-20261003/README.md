# BFF-FE-001 工程整改证据

本目录配合 [整改记录](../../BFF-FE-001-remediation-2026-10-03.md)。原始失败检查保留在 `../bff-fe-001-review-20261003`；本目录不改写原始结论。

- `baseline.json`：当前版本与 inventory；`remediation-status.json`：稳定问题 ID 与 R01–R24 判定。
- `source-inputs.json`、`semantics.json`：当前代码摘要与实际 reference/consumer 执行；`semantics-0/1.log` 为原始输出。
- `mutations.json`、`mutation-*.log`：独立临时源码与独立编译目录中，三个安全变更真实触发业务断言失败。
- `live-regression.json`、`live-traces.jsonl`：真实现有 Supabase Auth/PostgreSQL 与本机 live BFF，合成 HTTPS Origin。回执保留预提交 dirty 状态，不是 staging 或最终签署；响应体与 TOTP URI/bearer/CSRF/cookie 不进入证据。只记录 operation、status、validator issues。
- `live-attempt05-failure.json`：一次真实上游超时失败，不能计 PASS。随后按本轮未完成命令的派生名称清理自己的因素；最终 live 回执验证原因素集合恢复。
- `supabase-migration-grants.json`、`migration-current.log`：实际数据库只读账本/授权核对与已应用迁移摘要复核。迁移文件不可修改后再次“应用”。
- `ruff-lineage.json`、`ruff-originals/*.txt`：43 个脚本的原始字节、旧/新 SHA256 和规范化 AST 核对。历史 manifest 的旧 source hash 对应这些原始副本；历史执行日志/JSON 不改写。
- `check-ruff-lineage.py`：重放已文档化 import 拆分/无用 import 移除、import 顺序、lambda→def 后的 AST 比较；不重新执行历史写入脚本。`ruff.log` / `pyright.log` 是当前全仓检查。
- `reference-rust.log`：默认开关下的本地 Rust 测试。其中条件 PostgreSQL/F09 用例默认提前返回，不能计作数据库执行通过。
- `reference-http.json`：28 条参考 HTTP 请求，覆盖本任务 20 operation 及 C10 harness。
- `manifest.json`：本目录最终文件摘要；`commands.json`：提交前命令与结果。P0/F06 的新 SHA 原始日志在仓外目录及 Git notes 中，以避免修改接受中的源码 SHA。

在根目录、仓库要求的工具链上重放：

```bash
pnpm generate:bff
make bff-contract-check
pnpm check:pre04 && pnpm test:pre04
pnpm check:pre06 && pnpm test:pre06
pnpm test:contract
pnpm --filter @sumalpha/terminal test
pnpm lint && pnpm typecheck
cargo fmt --check
cargo clippy --locked --offline --workspace --all-targets -- -D warnings
cargo test --locked --offline -p bff-gateway -p quantos-auth
uv run --locked --project engines --all-packages ruff check .
uv run --locked --project engines --all-packages pyright --project engines
python3 docs/audit/evidence/bff-fe-001-remediation-20261003/check-ruff-lineage.py
node scripts/test-bff-provider-contract.mjs /private/tmp/a2-reference.json
QUANTOS_RUN_BFF_A2_LIVE=1 node scripts/test-bff-fe-001-live.mjs /private/tmp/a2-live
```

最后一项使用已有 `.env.local` 的现有 Supabase、专用受限 BFF 登录、已配置测试身份以及仅用于清理本轮因素的测试管理员 key。若该测试身份已有 MFA 因素，测试拒绝覆盖它们。无新建、本地数据库、容器或 schema reset；live 使用随机本机回环端口，敏感配置不打印。短暂 503 仅对读取或带相同幂等键的安全写进行有限重试，所有重试仍记入回执。
