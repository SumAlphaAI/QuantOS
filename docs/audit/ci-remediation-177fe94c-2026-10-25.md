# 177fe94c CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `177fe94c6026e78eaf19c8b21bd6e8229e8302c9`。本轮在 main 修复并生成本地提交，不推送；工作树修复文件绑定见[证据目录](evidence/ci-177fe94c-20261025)的 `source-binding.json`。原始远程/本地结果保留自己的源码及范围，不改绑为新提交通过。

## 远端结果

该 SHA 的 8 个 push 工作流全部结束：6 成功、2 失败。QuantOS Compatibility 的 Linux 三浏览器、F01 Clean Room、F03、F08、F09、R01 成功。此提交未触发有路径过滤的 Visual Baseline Candidates，未将未运行项算作通过。

| 工作流 | 实际失败 |
|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40180270855) | Market API scoped disposition 中，实际 HTTP 返回 viewer read 200，旧测试期望 403 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40180270878) | `make bff-contract-check` 的 A2 当前清单仍为 1.14.0/113 schemas，导致静态前置失败、三组语义执行未启动；随后输出缺少执行回执及源摘要的连带错误 |

verify-download 继续因上游失败而拒绝，属正常传播。本轮不放宽该门禁。原始日志、job 元数据与终态列表全部保留。

## 根因与修复

Market 的现有 Rust 权限实现及 `market::tests::ui401_reference_c01_market_capabilities_and_viewer_isolation` 已明确允许 viewer 读取市场数据，并将 viewer 自选列表与 writer 隔离，viewer 写入仍拒绝。该实现来自 `98e6851b` 的 UI-401 工作，本轮未修改服务权限代码。

旧脚本却要求 viewer 在所有 C12 操作上返回 403。现在依据当前行为验证：6 个只读操作均返回 200、`saveWatchlist` 返回 403；读取空的 viewer 自选列表不能泄漏 writer 已保存内容。拒绝请求使用有效的 CSRF/origin/幂等与版本头，避免把无效请求的拒绝冒充权限控制。每个操作仍独立验证匿名 401 和不具备市场授权的 approver 身份 403；原拒绝覆盖数量、schema、SSE、幂等/版本冲突等校验不变。额外核对写拒绝后双方列表内容与版本均保持不变。

A2 当前清单及摘要同步到实际 OpenAPI 1.16.0、134 operations、119 schemas；C01/C17 仍为 20 个操作。修复清单后，既有门禁能正常执行三组当前语义测试并生成新回执，不再被静态前置挡住。未修改或复用历史 PASS 来伪造当前结果；旧缓存先复制保存，新回执与执行日志单独归档。旧历史交付、Supabase/staging 与正式验收状态均保留。

## 本地验证

| 范围/命令 | 结果 |
|---|---|
| `node --test scripts/pinned-pnpm.test.mjs` | 2 PASS；与原 Market 入口相同的 pnpm 前置 |
| `node scripts/test-bff-fe-005.mjs <本轮输出路径>` | PASS；最终 59 条真实 loopback Rust/Axum HTTP 记录、7 个 C12 操作、Chromium 请求验证；数据库/外部源/性能/正式验收均未执行 |
| viewer 权限及状态 | 6 个 GET/SSE 200，PUT 403；匿名及未授权角色各覆盖 7 个操作；双方列表隔离与拒绝后状态保留均 PASS，拒绝覆盖计数仍大于等于 20 |
| `cargo test --locked --offline -p bff-gateway --lib ui401_reference_c01_market_capabilities_and_viewer_isolation -- --nocapture` | 1 PASS，243 filtered；仅此直接相关策略用例 |
| `node --test scripts/bff-fe-005-functional-gate.test.mjs` | 46 PASS；原拒绝/完整性/门禁负向检查保持 |
| `pnpm check:bff-fe-001` | PASS；当前回执记录 policy Rust 8、provider Rust 17、Terminal consumer Vitest 29 项通过 |
| `node --test scripts/bff-fe-001-gate-negative.mjs` | 23 PASS；无回执、陈旧摘要、过期 inventory 和禁用接线仍拒绝 |
| `QUANTOS_BFF_BASE=177fe94c… make bff-contract-check` | 完整原失败步骤退出 0；包括实际生成物/结构、当前 A2 语义、9 个实际语义变异拒绝探针及后续该入口的组件校验 |
| 手工数据库策略测试 | 6 PASS；入口和自动事件拒绝策略不变 |
| Git/证据与密钥检查 | 原始 SHA、工作树修复摘要、回执和策略字节分别绑定；历史 Gitleaks 无真实凭据命中；原始证据中的两条源码摘要误报已逐项核实，详见下文 |

重放完整 BFF 合约步骤是对实际失败入口及其后续子命令的直接回归，没有递归重验全部上游 Gate、全仓或发布矩阵。结果不授予阶段 READY、目标运行或业务权限。

中间 Market 58 条记录保留为 `market-http-initial.json.gz`；随后新增 viewer 自身拒绝后状态断言，最终重新执行得到 59 条记录，不把中间结果当最终版本通过。最初 native 测试使用了错误模块全名，实际命中 0 项，保存在 `market-native-role-empty-filter.log.gz`，不计 PASS；改用唯一用例名称后确认实际执行 1 项。全部命令、原始输出及当前/旧缓存另行保存。

## 证据与扫描

`.gz` 均为无损压缩，使用 `gzip -dc` 读取，摘要见 `SHA256SUMS`。`validation-summary.json.gz` 核对实际 Market 记录及证明本轮没有修改 Rust 权限/原生测试、生产 OpenAPI、A2 执行器/门禁、Market 证据校验器、Makefile 或 package 入口。`source-binding.json` 绑定本轮三项源码/文档修改。执行时 Git HEAD 为原 SHA，修复位于工作树，报告不声称新提交已经取得同 SHA 远程 CI。

Gitleaks 8.28.0 扫描原始证据时报告两条 `authClient` 命中，分别来自新/旧 `semantics.json` 的 `sourceHashes`。逐条读取整行、核对确为 64 位摘要，并与对应 Git 提交的 `apps/terminal/src/auth/bff.ts` SHA-256 完全一致，确认是公开源码摘要而非凭据。保留原扫描 WARN/报告及 `artifact-digest-review.json.gz`；没有改写回执摘要、添加豁免或放宽扫描规则。历史源码扫描无命中。

## F05/F07 与待验项

该 SHA 的完整工作流清单中 F05/F07 均无运行；两个入口仍为 `workflow_dispatch`、确认默认 false，并需 `QUANTOS_MANUAL_F05_F07=1`。本轮未连接数据库或运行全量数据库/覆盖率 campaign，自动离线检查保留；证据见 `manual-policy.json.gz`。

新修复提交的 hosted CI 为 `NOT_RUN`，须用户推送后确认。原 SHA 的 Linux 三浏览器和 F01 成功仅适用于原范围。数据库、真实 IdP/外部行情源、发布/目标环境验收仍为 `NOT_RUN`。

下一步：用户推送本地修复提交后跟踪新 SHA 的 Frontend Baseline 与 QuantOS CI，确认这些入口及后续步骤，同时保留 F05/F07 手工边界。
