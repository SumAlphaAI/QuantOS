# F01 初始化 Polyglot Monorepo 全面复审报告

> 更新日期：2026-09-17；状态：**COMPLETED / ACCEPTED**。
> 本文呈现当前结论；初审问题明细见 [历史初审归档](./F01-initial-review-2026-09-17.md)，逐项修复与关闭证据见 [整改记录](./F01-remediation-2026-09-17.md)。

## 一、任务完成概况

F01 已达到本次 Monorepo 初始化验收要求。原有 10 个问题全部解决，当前没有未解决问题；检查点 **20/20（100%）**，三项量化验收 **3/3**。本结论仅适用于 F01，不改变 F0 其他任务或总体 Gate 状态。

| 优先级 | 初审数量 | 已解决 | 当前未解决 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 2 | 2 | 0 |
| 中危 | 7 | 7 | 0 |
| 低危 | 1 | 1 | 0 |
| 合计 | 10 | 10 | 0 |

本次在 `194c854c9c68043baedfa0f7f73aa0f1b6dce6b9` 上重新核对实现、测试与证据。正式验收绑定源码 `6059310c4f3a2159f04e951a9308a5aae4d0366b`；两者之间仅有文档及审计材料变更，实现、锁文件和构建配置未改变。本次重新执行针对性检查并校验既有回执，未重新执行整套冷启动与三轮构建，也未将原回执改标为当前 HEAD 的新构建。

## 二、完成情况与验证证据

### 2.1 需求及交付物

沿用初审 C01–C20 的等权检查口径：PASS 20、PARTIAL 0、FAIL 0、NO RECEIPT 0。模块 README 分母为 7 个顶层边界 + 23 个 Cargo 成员 + 8 个 Python 成员 + 7 个一期 JS 成员，共 45 个模块根；不包含生成目录、缓存或第二期 Desktop。

| 检查点 | 复验结果 | 依据 |
|---|---|---|
| C01 Cargo workspace | PASS | 23 个成员进入实际 lint/test；回执内源清单 |
| C02 proto | PASS | 原契约目录保留；生成 SDK 随工作区编译 |
| C03 crates | PASS | 16 个 crate 清单与目录双向核对 |
| C04 services | PASS | 7 个 binary 三次实际构建与逐文件 digest |
| C05 engines | PASS | 8 个 Python 成员、91 项 Python 测试 |
| C06 website | PASS | 独立 lint/typecheck/test 与三次静态构建 |
| C07 terminal | PASS | 独立 lint/typecheck/test 与三次静态构建 |
| C08 packages | PASS | 5 个共享包进入检查和构建图 |
| C09 supabase | PASS | 初始化目录、说明与迁移资产保留；不代表真实数据库验收 |
| C10 Rust 固定 | PASS | 1.91.0 预检及实际 fmt/Clippy/test/build |
| C11 uv 固定 | PASS | .uv-version 0.7.0、安装说明、错误版本拒绝 |
| C12 Node 固定 | PASS | Node 24.12.0 / pnpm 10.20.0 预检 |
| C13 锁与构建闭包 | PASS | 三语言冻结检查；Hatchling/传递依赖锁定；漂移负向验证 |
| C14 Make 任务 | PASS | 一期入口实际执行；Desktop 独立 workspace/lock |
| C15 本地环境基线 | PASS | README 工具安装、预检及构建路径约束；空缓存初始化回执 |
| C16 DATABASE_URL 约定 | PASS | 原示例环境与 Supabase 操作约定保持；未读取真实凭据 |
| C17 模块 README | PASS | 45/45 模块根、服务索引一致、删除 README 拒绝 |
| C18 新环境 ≤30 分钟 | PASS | clean-room.json 中 elapsedSeconds ≤1800、所有命令退出 0 |
| C19 连续三次构建 | PASS | 同一 SHA、三轮重新安装/构建、全部产物哈希一致 |
| C20 最低质量接线 | PASS | app TSX 纳入 lint；正式 ADR 对齐 Cargo 执行器；三语言 lint/test 全通过 |

### 2.2 验收与本次复核

| 检查 | 结果 | 证据 |
|---|---|---|
| 新环境初始化、门禁、lint、test | PASS；空包缓存，总计 948.682 秒，低于 1800 秒 | [验收回执](./evidence/F01-remediation-2026-09-17/clean-room.json)、[运行日志](./evidence/F01-remediation-2026-09-17/clean-room.log) |
| 连续三次独立构建 | PASS；7 个 Rust binary、8 个 wheel、7 个 Web/package 输出全部一致 | [逐文件摘要与源码清单](./evidence/F01-remediation-2026-09-17/three-builds.json) |
| 三语言质量基线 | PASS；Rust 186 passed / 1 ignored，Python 91、一期 TypeScript 115 项通过 | [完整验收日志](./evidence/F01-remediation-2026-09-17/clean-room.log) |
| 本次实际锁检查与 F01 门禁 | PASS；45/45 README；16/16 负向与隔离测试 | [本次检查日志](./evidence/F01-recheck-2026-09-17/gates.log) |
| 本次 Python 构建后端漂移检查 | PASS；8 个成员逐个注入漂移，全部拒绝 | [本次探针结果](./evidence/F01-recheck-2026-09-17/backend-drift.json) |
| 本次回执完整性与适用性检查 | PASS；18 个归档文件哈希、源码 commit/tree、退出码、三轮清单及汇总哈希核对一致；实现无变更 | [本次核验记录](./evidence/F01-recheck-2026-09-17/receipt-verification.json) |

三轮合并 SHA-256：`b9ae04ac55dd89a40d99890d6a24868af3fbc17ace3e9815ef0710cde0916a48`。
本次复核总入口：[summary.json](./evidence/F01-recheck-2026-09-17/summary.json)。此前失败尝试与整改过程保留在历史证据中，不计入通过结果。

## 三、当前问题与验收边界

**当前问题清单为空。** 已解决问题不再作为活动问题或待整改项重复展示，历史明细与关闭依据保留在归档及整改记录中。

验收结论适用于以下条件：

- macOS arm64、预装固定工具链、空包下载缓存；工具链安装不计入 bootstrap 时限，依赖下载计入实测耗时。
- 三次构建使用相同 OS、工具链和固定物理构建路径，每轮删除并重建源码、安装及输出目录；不承诺跨路径或跨平台位级一致。
- Rust 执行器按 [已采纳 ADR](../adr/20260917-f01-rust-test-runner.md) 使用 `cargo test --workspace --locked`，保留集成测试和 doctest；未声称运行 nextest。
- 远程 GitHub CI、真实数据库与浏览器矩阵保留 `NOT RUN / NO RECEIPT`。无凭据时提前返回的数据库测试不计作真实数据库验收。

这些是验收适用范围，不作为已经关闭问题的残余整改项。

## 四、维护与后续验证

F01 无待整改项。后续源码、依赖或构建配置改变时，应重新运行 `make lockfile-check f01-check lint test`，并在干净提交执行 `make f01-clean-room-check f01-reproducibility-check` 获取新回执。远程 CI 和其他任务的目标环境验收仍按各自计划执行。
