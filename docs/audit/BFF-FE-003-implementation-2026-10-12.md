# BFF-FE-003 实现与本地验收

日期：2026-10-12。阶段：A3 / DEVELOPMENT。允许变更：QuantOS。正式接受：false。

本轮补齐九个 C03/C04 页面 API 的 reference/live 路由、持久命令与 R03 适配器、附件契约、生成 client/schema/MSW、功能/权限/错误/幂等/回补测试和证据校验器。工程结果以[manifest](./evidence/bff-fe-003-20261012/manifest.json)为准；阶段 Gate 保持 **BLOCKED**。已实现不代表目标数据库或正式验收通过。

## 范围与控制矩阵

| 控制 | 实现与本地验证 | 目标边界 |
|---|---|---|
| Research list/create/get/cancel | 实际挂载路由；成功、未知对象、取消终态、并发重试/冲突测试 | live 数据库执行 NOT_RUN |
| Snapshot list/get | canonical R02 冷读、source/quality/license Gate；reference 正负样例 | source policy/迁移/RLS 未在目标执行 |
| Artifact/Evidence/attachment | 归属检查、私有 Storage/hash 校验代码；metadata/evidenceId 可定位；附件 JSON/生成契约测试 | 真实 Storage 权限/故障 NOT_RUN |
| cursor/filter/sort | 页面不可变快照、身份/查询绑定、TTL/范围/容量拒绝 | 进程重启使游标过期，返回 410；多实例路由需发布验证 |
| sequence/afterSequence | 持久 source UUID 去重、per-run 连续序列、SSE 回补/越界、客户端重复/乱序回归 | 真实 worker/断网/撤权目标链 NOT_RUN |
| 202/幂等/恢复 | statusRef/Audit；意图先存储，队列重试沿用 session/correlation/checkpoint | 强杀、事务/RLS和无重复费用需要目标验证 |
| 权限/CSRF/预算/deadline | 既有 guard，服务端 capability，伪造上下文、超预算、过期请求负向测试 | 真实 Auth 跨租户/角色重验 NOT_RUN |
| 限额 | request/page/游标/流容量及120请求/分钟、30新命令/分钟；拒绝含retryAfter | 进程内读限额不构成跨集群配额验收 |
| 契约与客户端 | OpenAPI 1.6.0，63 operations / 54 schemas；九项 provider response 独立 JSON Schema 检查 | 未宣称UI接入或consumer验收 |
| 证据与Gate | immutable Git源码/输入hash/实际命令/日志/probes；负向拒绝伪READY/自批准/源漂移/日志篡改 | 依赖、目标和正式确认独立 |

## 执行与复验

完整命令、执行时间、退出码、日志摘要见 manifest.checks 与 logs/*.json；源码和生成物摘要见 manifest.inputs。`provider-responses.json` 是真实 Axum in-process 路由的九项响应，Artifact 数据显式 fixture，不是 Supabase 回执。测试不启动数据库或容器，不读取生产凭据。

可复验入口：

- `pnpm check:bff-fe-003`：检查本地工程证据，返回 engineeringStatus=PASS / stageGate=BLOCKED。
- `pnpm test:bff-fe-003`：证据/Gate 负向回归。
- `pnpm check:bff-fe-003:development`：严格准入；当前预期退出 2。
- Rust、Clippy、客户端/SSE、生成一致性、契约覆盖、兼容性和计划校验的精确命令见 manifest；Rust 明确排除依赖真实数据库的 logout test，该测试 NOT_RUN。

初次客户端完整回归受到沙箱 loopback EPERM 限制，日志保存在 initial/web-loopback-eperm.log；版本/数量固定断言的初始失败同样保留。最终结果只取重新执行的成功日志，不覆盖这些失败事实。

## 未决风险与Gate

1. 新迁移未在配置的 Supabase 执行。BFF Auth/Runtime/Snapshot 连接、RLS/事务、私有 Storage 及 R03 worker 持久闭环、强杀/取消故障仍为 NOT_RUN；新增 target harness 只提供明确 dev smoke 入口。
2. 九项直接依赖按当前回执实际检查，细节见 manifest.dependencies。共享 BFF/OpenAPI/Runtime 输入变化会使旧 A2/R03/R04 证据失效；不能沿用历史 READY 为本轮放行。
3. 当前 RD-Agent 未提供 prompt/code 版本时返回 unreported；完整 provenance 需领域输出补齐。此项不伪装为已验证版本。
4. 游标与读配额/流连接限额为本进程能力；跨实例路由、真实撤权时延/网络故障、性能和长稳等待 RELEASE。超过2000条需缩小筛选。
5. hosted CI、staging/发布、consumer/UI 和 ProjectUser 正式确认未执行。未推送、未部署、未使用生产凭据。

DEVELOPMENT：BLOCKED；本地工程：PASS（以实际 manifest 成立为前提）；数据库验收：NOT_RUN；RELEASE：NOT_ASSESSED；formalAccepted=false。完整任务尚未获得阶段验收，不能记作 ACCEPTED。

下一可执行任务：刷新受影响的 A2/核心前置回执并推进 R1-SERVICE 准入；另可开始同迭代 BFF-FE-005 实现。具备获准非生产资源后，执行目标迁移/功能/安全负向/恢复验证，再重评 BFF-FE-003 和 PROVIDER:A3。

## 变更文件与提交范围

完整逐文件清单：[changed-files.json](./evidence/bff-fe-003-20261012/changed-files.json)。实现提交覆盖33个文件，证据提交另含本报告、计划Gate摘要和证据目录。

| 分组 | 变更文件 |
|---|---|
| Provider | services/bff-gateway/src/research.rs、research_tests.rs、live/research.rs、lib.rs、live.rs、generated-input-policy.json；Cargo.toml、README.md |
| R03适配 | crates/quantos-runtime/src/pg.rs、research_pg.rs；Cargo.lock |
| 迁移 | supabase/migrations/20261012150000_bff_research_pages.sql |
| 契约 | bff/openapi/quantos-bff.v1.yaml、page-operation-catalog.yaml、compatibility/a1-security-correction.json |
| 生成物/客户端 | packages/api-client/src/bff-gen/quantos-bff.ts、quantos-bff.zod.ts；tests/contract/generated/ 下4份生成文件；packages/api-client/tests/bff-response.test.ts、tests/contract/bff-remediation.test.ts |
| 测试/Gate/CI | scripts/bff-fe-003-development.mjs、bff-fe-003-development.test.mjs、check-bff-fe-003-probes.mjs、test-bff-fe-003-live.mjs；package.json、.github/workflows/frontend-baseline.yml |
| 文档 | 前端执行计划、PRE-01-page-api-coverage-register.md、BFF-FE-003-summary.md、ADR-BFF-FE-003-research-page-provider.md、本报告 |

独立响应 Schema 检查曾发现 Snapshot.window 字段映射错误，本轮已修复；原响应、失败日志和原候选 SHA 记录均保存在 initial/。运行环境仅检查配置是否存在，不读取/输出凭据值，结果见 target-configuration-presence.json；所需 dev 目标配置均未设置。

## 最终工程结果

冻结源码：`ecf893e385e7a09d9c3ac3124418809086c0956d`。12组检查全部 PASS：

| 命令 | 结果 |
|---|---|
| cargo test -p bff-gateway -p quantos-runtime --lib --locked --offline -- --skip real_logout_db_write_matches_persistent_trace | BFF 32 + Runtime 19，共51项通过；1项目标 logout test 明确排除 |
| cargo test -p bff-gateway --test auth_settings_provider --test audit_export_provider --locked --offline | 12 + 9，共21项通过 |
| cargo clippy -p bff-gateway -p quantos-runtime --all-targets --locked --offline -- -D warnings | 通过，无警告 |
| node node_modules/vitest/vitest.mjs run tests/contract packages/api-client/tests | 9文件、89项通过；含loopback SSE恢复/重复/乱序/撤权 |
| node node_modules/typescript/bin/tsc --project packages/api-client/tsconfig.json --noEmit | 通过 |
| node scripts/check-bff-openapi.mjs / check-bff-generated.mjs / check-bff-contract-coverage.mjs / check-bff-compatibility.mjs | 分别通过；63 operations、54 schemas；85项累计工程兼容修正匹配 |
| node scripts/check-development-plans.mjs | 通过 |
| node --test scripts/bff-fe-003-development.test.mjs | 21项通过 |
| node scripts/check-bff-fe-003-probes.mjs docs/audit/evidence/bff-fe-003-20261012/provider-responses.json | 九项真实reference路由响应均通过独立Schema检查 |

每项完整参数、实际执行时间、退出码和日志hash均已写入 manifest。九个前置节点的发布状态均为 NOT_ASSESSED，当前不能递归获得READY；strict Gate按此事实拒绝。本轮没有执行目标迁移或数据库测试。
