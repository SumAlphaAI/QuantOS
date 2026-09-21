# F04 三项 CI 阻断整改与本地完整验收

代码提交：`b73eead7d6e74e6fbb4f05230ca580ace3da058f`。本报告所在后续提交仅归档回执和更新文档。**三项阻断已本地修复，三轮隔离构建和 clean-room 均 PASS；修复后的 Linux 同 SHA CI 尚未执行，F04 保持待验收。**

## 修复明细

1. `quantos-testkit` 对 `quantos-core` 声明 `version = "0.1.0"` 和 path；保留 `wildcards = "deny"`。未变更锁定依赖版本、许可证允许清单或 waiver。
2. F01 磁盘清单扫描 crates/services/tools，并继续与 Cargo workspace 双向精确比对。新增 `rustBuildBinaries` 收录全部 9 个构建二进制；`rustBinaries` 保留 services 下 7 个运行时服务。`fixture-corpus`、`quantos-proto-json-codegen` 进入输出完整性及可重复性检查，但不进入 runtime release payload。补齐两个模块 README；新增缺失工具输出拒绝、工具字节变更破坏摘要一致性的负向验证。
3. PRE-04 更新为 50 个 JSON Schema；6 个协议文件、38 message、15 enum、2 service、7 RPC 未变。F03 提交 `9aea0b5` 新增 `v1DeploymentTarget.schema.json` 与 `v1StrategyRelease.schema.json`，原 48 计数过期。同步断言、台账及摘要，保留生成物漂移门禁，并增加删声明/删 Schema 的负向测试。

## 协议逐项核对

| 文件 | message | enum | service | RPC |
|---|---:|---:|---:|---:|
| common | 12 | 5 | 0 | 0 |
| engine | 11 | 0 | 1 | 5 |
| events | 5 | 1 | 1 | 2 |
| research | 2 | 0 | 0 | 0 |
| strategy | 2 | 2 | 0 | 0 |
| trading | 6 | 7 | 0 | 0 |
| 合计 | 38 | 15 | 2 | 7 |

[逐文件清单及全部 50 个 Schema 路径](evidence/F04-ci-remediation-2026-09-21/protocol-inventory.json)。`make proto-check` 重生成无漂移，11,000 组 fixture 的六向二进制与 ProtoJSON 兼容性通过；未仅通过修改数量掩盖生成物不一致。

## 验收结果

| 检查 | 结果 | 回执 |
|---|---|---|
| cargo-deny bans/licenses/sources | PASS；wildcard 策略不变 | [日志](evidence/F04-ci-remediation-2026-09-21/cargo-deny.log) |
| F01 workspace / README 清单 | PASS；9 build / 7 runtime binaries，47 README | [清单](evidence/F04-ci-remediation-2026-09-21/inventory.json) |
| F01 负向测试 | 17/17 PASS | [日志](evidence/F04-ci-remediation-2026-09-21/f01-negative.log) |
| PRE-04 / 负向测试 | PASS；7/7 | 本轮执行 `node scripts/pre04-inventory.mjs`、`node --test scripts/pre04-gate-negative.mjs` |
| 协议生成与兼容性 | PASS | [日志](evidence/F04-ci-remediation-2026-09-21/proto-check.log) |
| 三轮隔离构建 | PASS；全部输出组合摘要三次相同 | [完整结构化回执](evidence/F04-ci-remediation-2026-09-21/f04-ci-fix-three-runs.json) |
| 独立 clean-room | PASS；216.227 秒 | [回执](evidence/F04-ci-remediation-2026-09-21/f04-ci-fix-clean-room.json) |
| F04 Gate | PASS；line 97.74%、region 96.73%、P95 27μs | [日志](evidence/F04-ci-remediation-2026-09-21/f04-check.log) |
| PRE-06 / 开发计划结构 / diff whitespace | PASS | 本轮执行检查器 |

三轮每次删除并重建物理路径相同的 source/install/build 目录，源码来自 `git archive b73eead`，只共享下载缓存。每轮核对 **9 个 Rust 二进制、8 个 Python wheel、7 个 JS 项目输出**；组合摘要均为：

```text
c1b65ecf417450ff5dbfa7342ede8ca6efc5d4d9ad9d7ecd4025d8ab3675942d
```

独立 clean-room 使用空 package 下载缓存，执行 bootstrap 以及 lockfile-check、f01-check、lint、test。回执中的 `reproducible: false` 表示 clean-room 模式不负责多轮比较，不是失败；三轮可重复性由另一份 PASS 回执证明。

## 远端交接

以上为 macOS arm64 本地验收，不是 Linux CI、数据库/RLS 远端验收或制品正式验签。请通过 GitHub Desktop 人工推送本轮提交，再收集最新完整 SHA 的 QuantOS CI、F01 Clean Room、Frontend Baseline、F03、F04 和 Compatibility 结果。F04 路径过滤已涵盖本轮核心及门禁修改；F02 A11 仍保持原状态。所有要求的远端回执成功前，不将 F04 标记 ACCEPTED。
