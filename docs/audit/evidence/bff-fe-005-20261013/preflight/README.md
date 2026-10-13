# BFF-FE-005 冻结前预检

入口复评在原 HEAD 4f73e815 完成，旧 A2/R1/BFF003 本地回执当时有效；新增共享源码后已在计划撤回旧 READY，等待全闭包实际重跑。这里的预检是在未提交实现候选执行，HTTP 的 sourceCommit 是当时 HEAD，仅作诊断，不能用来发布新 READY。正式候选以随后 clean HEAD 的完整 attempt 为准。

- Rust：`cargo test -p bff-gateway -p quantos-market --lib --locked --offline -- --skip pure_domain_p95_under_fifty_milliseconds --skip real_logout_db_write_matches_persistent_trace`，43+14 PASS；2 项分别移交性能和目标数据库验收。
- Clippy：`cargo clippy -p bff-gateway -p quantos-market --all-targets --locked --offline -- -D warnings` PASS。
- HTTP/Chromium：`node scripts/test-bff-fe-005.mjs`，7 operation、33 请求 PASS；只运行回环 Rust reference/R01 受控输入。
- 契约/client：`pnpm exec vitest run tests/contract packages/api-client/tests`，96 PASS。
- Gate：`node --test scripts/research-local-gate.test.mjs scripts/bff-fe-005-development.test.mjs`，55 PASS。
- API client typecheck/lint、PRE01/PRE04、OpenAPI/generated/compatibility、BFF007、开发计划检查 PASS；完整输出见本目录。
- F02：`GITLEAKS_BIN=artifacts/tools/gitleaks make f02-check`，14 PASS / 1 SKIP；补丁及新增源码扫描无泄露。精确豁免仅公开 OpenAPI SHA256，独立重算见 public-digest.json。

预检发现并修正：sandbox 禁止回环监听（已在授权本地测试中复跑）；新 fixture 未登记（已登记）；通用 schema specimen 不支持 oneOf nullable（已支持）；Clippy 条件合并（已修正）。这些诊断不作为正式回执。固定使用缓存 pnpm 10.20.0，避免宿主 pnpm 11 自动解析依赖。

数据库/外部来源/发布/性能/正式验收均 NOT_RUN；没有使用生产凭据、运行数据库或发布。formalAccepted=false。
