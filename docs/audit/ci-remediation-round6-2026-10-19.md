# cb6d81b0 五个 CI 工作流跟踪与第六轮修复（2026-10-19）

基线：`cb6d81b0870a8fc6f347b714c5cb3a5ccad88c27`。五个工作流均进入终态，3 成功、2 失败。本轮直接在 main 修复并生成本地提交，未推送；前五轮报告与历史验收记录保持原样。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果 |
|---|---|---|
| QuantOS Compatibility | [39206738352](https://github.com/SumAlphaAI/QuantOS/actions/runs/39206738352) | SUCCESS |
| F08 Engine CI | [39206738311](https://github.com/SumAlphaAI/QuantOS/actions/runs/39206738311) | SUCCESS |
| F01 Clean Room | [39206738294](https://github.com/SumAlphaAI/QuantOS/actions/runs/39206738294) | SUCCESS；clean-room 与 reproducibility 两作业均通过，结果只绑定 cb6d81b0。 |
| Frontend Baseline (FEP-0) | [39206738429](https://github.com/SumAlphaAI/QuantOS/actions/runs/39206738429) | FAILURE；PRE-04 仍硬编码 API 1.7.0 / 70 operations / 62 schemas，并混用了后续领域更新；来源摘要、领域/任务映射、Gap 与字段字典不一致。 |
| QuantOS CI | [39206738296](https://github.com/SumAlphaAI/QuantOS/actions/runs/39206738296) | FAILURE；合并 Rust 覆盖率行 88.72%、region 86.82%，低于行 90% 门槛。F02 归档/下载拒绝是该前置失败的连锁结果。 |

## PRE-04 修复

当前盘点同步为 OpenAPI 1.12.0 / 132 operations / 110 schemas，保留 17 个契约、17 个 Gap 与 23 个 P0 页面单元。C05/C13/C15 等已发布能力移出 planned；C11/C14/C16 统一合法 core task、角色与页面映射。P05/P18 订阅改用真实 saveAlertSubscriptions 名称并明确告警源联调未验，C05 backtest stream 标明已发布；C02 仍为 Open、2 个 planned operation。Gap Closed 只表示操作发布，不授予实现或目标验收。

补齐所有已发布 operation 直接引用的领域 wire 模型，清除已发布领域的 planned-only 字段，按真实 required、类型、约束和来源重新渲染 692 行字段。共享 envelope/union 仍由共享 schema 章节记录。Gate 新增模型遗漏、已发布字段伪装 planned、版本/计数/生成物不一致等拒绝检查，保留 Open/Partial/Closed、权限、字段来源、角色/任务及历史回执损坏拒绝。

当前 provider/test 文件摘要只用于盘点漂移检查；旧验收报告保持原字节、原 SHA/原范围，不由本次清单刷新改绑 READY。清单对新增领域只保证生成契约，已有工程实现仍由各自原报告说明，不借用为本候选准入。

摘要元数据迁移为 `quantos-pre04-baseline/v2` 的显式来源/表示方式/SHA 行，避免将 openapiDigest 误识别为 API key；旧 schema 被拒绝。未修改 Gitleaks 规则或新增豁免；原 v1 基线从 Git blob 原样压缩留存。

## Rust 覆盖率修复

原三库合并范围未执行 execution-gateway 中已有的真实 Paper 子进程消费者测试。补跑该包的协议、命令去重、取消、故障拒绝与恢复用例，同时仅将原 quantos-core / quantos-risk / quantos-execution 纳入报告；新增 service 自身的行不进入分母，避免用额外已测代码稀释关键库缺口。行 90% / region 85% 门槛不变，未排除任何原关键库生产文件。

旧本机 instrumentation 目录混有历史构建对象/行映射，首次报告出现 8,645 行、70.82% 的 FAIL；该记录保留，不作为当前源码的通过证据。独立目录复验得到原 21 个生产文件、6,455 行与 9,265 regions，分母与远程失败完全一致；新命中 6,122 行、8,612 regions，对应 94.84% / 92.95%。process_kernel 的行覆盖率从远程 37.80% 到 95.20%。

最终 Makefile 合并覆盖率命令经 with-fresh-coverage-target 包装，每次建立独立 objects/profiles 目录，移除继承的旧 target/profile 覆盖配置；保留既有尝试，失败/信号/启动错误不能记作成功。实际执行最终入口亦为 94.84% / 92.95%、exit 0。质量自检已接入范围和目录隔离正负向回归，拒绝去掉消费者、降低门槛、排除关键源文件、稀释分母或复用旧 profile。原第一条 quantos-core release 覆盖率命令不变，本轮只复验失败的三库合并命令。

## 本地结果

| 检查 | 结果 |
|---|---|
| PRE-04 当前入口 / 字段字典重渲染 | PASS；132 operations / 110 schemas / 692 fields；17 contracts、17 gaps、23 P0 units |
| PRE-04 / 覆盖率范围 / fresh target 回归 | 61/61 PASS，0 skip |
| 主 CI 质量自检实际入口 | 49/49 PASS，0 skip；含原 F01/F02 自检及新覆盖率检查，数据库相关用例只检查临时 SQL 文本 |
| PRE-01 / PRE-06 直接回归 | 63/63 PASS，0 skip；两项当前 Gate 均 PASS |
| 独立目录关键 Rust 覆盖率及最终 Makefile 合并入口 | 两次均 PASS；121 tests / 0 FAIL / 2 原有性能 ignored；94.84% lines、92.95% regions；21 个原生产文件完整保留 |
| 开发计划一致性 / 修改脚本语法 / git diff --check | PASS |
| Gitleaks 8.28.0 历史及新增暂存补丁 | PASS；642 commits / 0 leaks；新增暂存补丁 0 leaks，未新增豁免 |

本轮复用了实际调用边界所在的既有消费者测试，Rust 业务实现保持原样。两个 release performance ignored 保留；region 不是 branch coverage，真实分支、性能、目标数据库、部署和发布验收不在本轮结果中。本机未启动或连接数据库，未重新执行全仓测试或完整 F01 三轮构建。

## 证据与边界

[第六轮证据](evidence/ci-remediation-round6-20261019/)保留原始远程失败日志、五工作流终态、F01 成功作业状态、初次 PRE-04 失败及修复回归、旧目录 FAIL、独立覆盖率原始 JSON（gzip）、原 v1 基线 Git blob（gzip）和最终入口日志。摘要绑定原三库逐文件 SHA、原分母和实际度量；manifest.json 绑定修复输入与证据，候选由所在 Git 提交标识。

初次旧负向 fixture、report 子命令不支持所给参数，以及 OpenAPI 摘要误报等记录保留，后续修正与成功结果分别存档。

本轮 Gate：`PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）。cb6d81b0 的 F01 SUCCESS 不改绑到新提交；后续尚未抵达的前端构建/e2e、主 CI 许可证/SCA/F02 生成与下载等仍须推送后核对新同 SHA 五工作流，不以本地结果替代远程或正式验收。
