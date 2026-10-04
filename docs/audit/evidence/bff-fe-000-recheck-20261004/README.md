# BFF-FE-000 2026-10-04 复核证据

基线为 `272aec4dd219915facf8abcfb9df95a059419108`。本轮是原 14 项发现的工程与阶段策略复核，不是新的 P0/F06、数据库、staging 或发布验收。

- `commands.json` / `*.log`：实际命令、退出码、日志摘要。final-review 的 exit 1 为预期拒绝，不算正式验收 PASS。
- `inspection.json`：独立 Zod parse 保真/拒绝探针与当前 source inventory；`reference-http.json`：Rust 参考 provider 26 operation / 28 HTTP 请求。
- `issue-status.json`：13 项工程关闭、B-01 递延的机读清单；`docs-current.json`：修正活跃文档版本/schema 数及报告结构。
- `p0-baseline.json`：新增审计文件前、干净原 HEAD 的 FAIL；当前 SHA 缺回执。不得拿旧提交回执或本地测试替代。
- `critical-coverage-summary.json`：六个关键政策文件的四项 100% 覆盖；不代表全部代码或实际目标可靠性。
- `source-inputs.json` / `manifest.json`：当前输入、文档与证据文件字节摘要。

原始报告逐字保留于 `../../BFF-FE-000-findings-archive-2026-10-03.md` 的 BEGIN/END ORIGINAL REPORT 之间；`issue-status.json.originalReportSha256` 是原字节摘要。既有 2026-10-03 失败证据未改写。

重放时使用工程要求的 Node/pnpm/Rust：`pnpm check:bff-a1-development`、`pnpm check:bff-compatibility`、`node --test scripts/bff-fe-000-gate-negative.mjs scripts/bff-remediation-negative.mjs`、`pnpm check:bff-generated`、`pnpm test:contract`、`pnpm --filter @sumalpha/api-client test`、`pnpm coverage:critical`、`cargo test -p bff-gateway --test auth_settings_provider --test audit_export_provider --locked --offline`、`node scripts/test-bff-provider-contract.mjs /private/tmp/a1-reference.json`。HTTP/SSE 需要回环监听权限；这些命令不启动本地数据库。
