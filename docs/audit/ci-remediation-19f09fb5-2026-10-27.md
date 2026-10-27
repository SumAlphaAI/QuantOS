# 19f09fb5 CI 跟踪与修复（2026-10-27）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。基线为 `19f09fb521ee09a21a3ea03674200c6a84c06e99`。直接在 main 修复、验证并生成本地提交，不推送。本地结果绑定该基线和修改文件字节；新提交 hosted CI、真实数据库、完整联调和发布验收仍为 NOT_RUN。

## 远端结果与原因

该 SHA 的 8 个 push 工作流均已结束，6 成功、2 失败。F01 Clean Room、F03、F08、F09、R01、QuantOS Compatibility 成功，结果保留原 SHA/范围。F05/F07 无运行。

- [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40505225516)：Secret scan 已通过；BFF 契约步骤执行到 BFF-FE-001 失败。verify-download 正常传播上游状态，未修改。
- [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40505225610)：PRE-01 已通过，同样在 A2 BFF-FE-001 auth/settings Gate 失败。

两处前置原因相同：独立 A2 current-inventory 与当前总结仍登记 API 1.16.0 / 134 operations / 119 schemas，当前 OpenAPI/生成物为 1.18.0 / 142 / 132。结构门禁拒绝后没有启动执行器，后续完整报告同时列出缺少或不匹配的语义回执。本地 structureOnly 复现仅列出台账与当前总结两项错误；原始完整失败日志保留。

## 修复与验证

同步 BFF-FE-001-current-inventory 的版本、操作数、schema 数和本轮证据路径。总结增加当前 2026-10-27 契约段，原 2026-10-25 段改列历史，正文及之后历史材料完整保留。C01/C17 仍为原20项；新增受控 Assisted 操作继续由 C08/BFF-FE-006 负责，不扩大 A2 验收范围。historicalEvidence、formalAccepted=false、stagingStatus=DEFERRED_TO_FINAL_REVIEW 和范围字段不变。

拒绝测试逐项验证旧 API 版本、旧操作数、旧 schema 数和过期当前总结，检查具体门禁错误。原无语义回执、源码摘要漂移、CSRF、权限、有效期等拒绝控制保留。显式 ESLint 首次指出测试文件原有 structuredClone 未声明；增加显式绑定后复验通过，未压制规则。执行器、Makefile、工作流、生产代码、锁文件和扫描配置均未修改。

| 检查 | 结果 |
|---|---|
| 原入口 pnpm check:bff-fe-001 | PASS，原20项 C01/C17；实际重跑三组语义测试 |
| live settings policy 单元（无数据库连接） | 8 PASS |
| auth/settings reference provider | 17 PASS |
| auth/settings client | 29 PASS，2 个测试文件 |
| A2 拒绝回归 | 26 PASS，0 skip；最终显式 binding 后再次通过 |
| 原 pnpm test:bff-fe-001 的 Rust 变异 | 9/9 被预期业务断言拒绝，exit 101；无编译失败、信号或工具错误冒充拒绝 |
| 变异 workspace 锁文件检查 | 离线裁剪353→330包；identity/checksum 是原锁子集，根 Cargo.lock 字节不变 |
| 迁移 ledger 静态检查 | 4 PASS，未执行迁移 |
| PRE-01 / PRE-04 当前入口 | PASS；保持1.18.0、142操作、132 schemas、792字段 |
| F05/F07 手工策略 | 6 PASS，0 skip |
| 修改脚本 ESLint / git diff --check | PASS |
| 原固定 Gitleaks 8.28.0 完整历史入口 | PASS；991 commits、约2.01GB；未新增豁免 |

实际语义回执 sourceCommit 为基线19f09fb5，核对18份当前输入摘要、三组退出码和日志摘要。变异回执与当前 provider/live policy 源码和各次日志摘要一致。receiver 单元中的 synthetic fixture 仅测试验证器，实际执行依据为本次 CLI 原始语义回执，二者分别留存。

原始证据目录扫描另报2项 generic-api-key：CLI 回执 semantics.json 中 authBoundary/authClient 的源文件摘要。逐项重新读取当前 quantos-auth/src/lib.rs 和 auth/bff.ts 字节计算 SHA-256，与原始行及回执字段完全一致；4项伪造回执/原始行控制均拒绝。原始目录扫描的 FAIL、脱敏发现、只读审阅脚本和2项非凭据分类全部保留，未修改扫描配置或将此结果记作原始目录扫描 PASS。原回执原字节压缩存档，摘要并非认证凭据。

## 证据与后续

[证据目录](evidence/ci-19f09fb5-20261027) 保留8工作流终态、两份原始失败、首次本地拒绝、最终实际语义/变异日志与回执、静态检查、lint 和历史扫描结果。`.gz` 可用 gzip -dc 无损读取；完整性见 SHA256SUMS，source-binding 绑定修改文件及未修改的运行输入。历史台账范围的保留另有 preservation.json。

F05/F07 仍只允许 workflow_dispatch、确认默认false且要求 QUANTOS_MANUAL_F05_F07=1。本轮未连接数据库、运行全量数据库 campaign、启动本机数据库、修改 secrets、推送或部署。新提交浏览器/全仓测试及原主 CI 后续步骤保持 NOT_RUN，不把旧 SHA 成功迁移为新提交验收。下一步由用户推送本地修复提交后，跟踪新同 SHA 的 A2 Gate 和后续 CI。
