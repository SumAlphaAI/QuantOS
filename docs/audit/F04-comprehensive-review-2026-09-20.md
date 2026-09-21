# F04 Core、错误、时钟与 ID 全面复审报告

> 初次复审日期：2026-09-20；整改复核日期：2026-09-20；远端验收核验：2026-09-21。
> 初次复审基线：`db2e51f4c37fdced7cf22d0b939e8277c73d959c`。
> 依据：[开发计划 F04](../SumAlpha-QuantOS-Development-Plan.md#task-f04)、开发计划第 2.2 节最低完成条件及第 2.3 节测试资产规则。
> 当前结论：**原 9 项问题经独立复核均已本地解决，追加门禁修复已通过；23/23 本地检查点 PASS，本地完成率 100%，49e61d6 远端视觉测试 27/27 通过，stable F04 Gate 已执行，nightly 成功；主 CI 后续锁文件自检失败，整体远端验收未通过。本地 F04 Gate、nightly branch 覆盖率、workspace Clippy 和完整 Rust workspace 测试均通过。最新回执见 [49e61d6 续检](F04-remote-acceptance-49e61d6-2026-09-21.md)。**

## 一、任务完成概况

初审发现 0 个阻塞级、3 个高危、5 个中危、1 个低危问题，严格完成率为 65.2%。本轮在整改提交 `b20aca4` 基础上独立复验全部问题，并修复验收脚本与 CI 配置的剩余缺口。

`quantos-core` 现提供强类型 UUID、UTC clock、11 个稳定核心错误码、受校验的金额/数量/版本/hash primitive，以及加载时验证内容 hash 的 fixture。新增 `quantos-testkit` 提供固定时钟、确定性 ID、1,000 组 fixture corpus 和 P95 验收。稳定 release 覆盖率为 97.74% line、96.73% region；nightly LLVM branch 覆盖率为 97.73%。

| 初审等级 | 原问题数 | 已关闭 | 当前开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 3 | 3 | 0 |
| 中危 | 5 | 5 | 0 |
| 低危 | 1 | 1 | 0 |
| **合计** | **9** | **9** | **0** |

原问题本地关闭率 **100%**；本地检查点 PASS 23、PARTIAL 0、FAIL 0，完成率 **100%**。该比例不代表远端验收完成。

## 二、完成情况明细统计

| 检查点 | 状态 | 整改后依据 |
|---|---|---|
| C01–C02 前置依赖和 crate 交付 | PASS | F03 已接受；`quantos-core` 与 `quantos-testkit` 均纳入锁定 workspace |
| C03–C04 强类型 ID | PASS | 22 个 UUID newtype、UUIDv7 默认生成、非法 ID 稳定拒绝；testkit 提供 deterministic ID source |
| C05–C06 UTC 时钟 | PASS | System/Fixed UTC clock、正负 offset 归一化、非法 RFC3339 拒绝均有测试 |
| C07–C08 稳定机器码 | PASS | 11/11 `ErrorCode` 的精确字符串、构造器、Display、`CoreError` 映射均由表驱动契约测试固定 |
| C09–C11 金额和数量 | PASS | 构造器及自定义 `Deserialize` 均执行 currency/sign/scale 校验；字段改为私有并提供只读 accessor；非法 JSON 全部拒绝 |
| C12–C14 版本和 hash primitive | PASS | SchemaVersion、BuildVersion、ContentHash 构造和反序列化共享同一校验路径，合法往返及非法 wire form 测试通过 |
| C15 canonical JSON | PASS | null/bool/number/string/array/object、Unicode、转义和递归对象排序均有固定断言 |
| C16 fixture hash 确定性 | PASS | 两个独立进程各生成 1,000 个 fixture，摘要一致：`sha256:7dbf9369132e5d90aef1cd8796450f6d787654bc50122a648920049fb0fd9c34` |
| C17 fixture 完整性 | PASS | `Fixture` 字段私有；自定义反序列化拒绝缺失、未知、错误类型、非法 primitive 和正文/hash 不一致 |
| C18 `quantos-testkit` | PASS | 提供 `FixedIdSource`、`fixed_clock`、fixture corpus 和 domain P95 工具，3/3 测试通过 |
| C19 包级质量 | PASS | core integration tests 10/10、testkit 3/3、doctest、fmt、包级 Clippy 均通过 |
| C20 覆盖率 | PASS | stable release：line 97.74%、region 96.73%；nightly：branch 97.73%，precision.rs 11/12（91.67%）；均高于 90%，clock branch N/A（见风险说明） |
| C21 纯领域计算 P95 | PASS | 两个独立进程各运行 1,000 次 ID 生成、时间解析、金额/数量解析及 fixture 构造/hash/verify；本轮最大 P95 为 31μs，低于 50ms |
| C22 工作区质量门禁 | PASS | workspace Clippy `-D warnings` 通过；完整 `cargo test --workspace --locked` 通过，UDS 测试在允许本地 socket 的环境执行 |
| C23 文档 | PASS | `quantos-core/README.md` 已记录公开契约、不变量、fixture hash 范围、testkit 和 Gate |

### 本轮验证记录

回执见 [本地复验记录](evidence/F04-recheck-2026-09-20/README.md)。扩充整数/十进制边界 corpus 后摘要按预期变化；生产 canonicalization 算法未改变。

| 命令 | 结果 | 关键回执 |
|---|---|---|
| `make f04-check` | PASS | core 10/10、testkit 3/3；1,000 fixture 双进程摘要一致；stable line 97.74%、region 96.73% |
| `make coverage-rust-branch`（nightly） | PASS | branch 43/44，97.73%；line 97.73%、region 96.65%；脚本强制 branch ≥90% |
| `node scripts/check-f04.mjs` | PASS | `fixtures=1000`、固定 digest、`p95Micros=31` |
| `cargo fmt --all -- --check` | PASS | 无格式差异 |
| `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` | PASS | workspace 无 warning |
| `cargo test --workspace --locked` | PASS | 全部已执行测试通过；1 个 helper-only 测试按设计 ignored；所有 doctest 通过 |

## 三、当前问题及风险分析

当前开放的本地问题：**阻塞级 0、高危 0、中危 0、低危 0**。原 A01–A09 的详细问题记录保留于 Git 历史 `b20aca4`，本文只保留当前验收结论。

本次独立复核还补齐了 nightly 工具链覆盖、branch 计数与百分比交叉校验、金额精度模块独立阈值、P95 无效输入拒绝，并扩充了纯领域性能样本、数值边界 corpus 和 fixture 元数据篡改测试。相关负向门禁测试 3/3 通过。

剩余验收边界：

- **远端主 CI 未通过**：`49e61d6` 视觉 27/27 通过，stable F04 已执行，nightly Run `35545816674` 成功；主 CI Run `35545816717` 后续锁文件自检因临时 fixture 遗漏 tools 成员失败。本地已补齐且 16/16 通过，待人工推送后同 SHA 复验。
- `clock.rs` 自身没有 LLVM 可计数的分支，branch 为 N/A；时区正负 offset、UTC 归一化及非法输入通过行为测试验证，line/region 均为 100%。不将依赖 chrono 的内部覆盖率计为本项目覆盖率。
- 本地 branch instrumentation 使用 nightly rustc，reporting 使用已安装 Rust 1.91 LLVM tools；远端 nightly 已执行成功，Linux 回执 line 97.75%、region 95.52%、branch 97.73%，不与本地 stable 指标混用。
- canonical JSON 仅面向 QuantOS 的 `serde_json::Value` 合约，不声明为 RFC 8785；FixtureId 按设计不进入内容 hash。

主 CI 系统依赖安装对齐已使 Linux 视觉测试 27/27 通过，诊断制品已归档。见 [视觉阻断整改](F04-visual-remediation-2026-09-21.md)。

## 四、后续维护建议

1. 每次修改 core primitive、serde 边界或 fixture canonicalization 时执行 `make f04-check`；不得以聚合 coverage 代替独立 core threshold。
2. 新增 `ErrorCode` 时必须同步扩展 11/11 表驱动契约；新增受约束 value object 时必须提供构造和反序列化的同一不变量测试。
3. 保持 `scripts/check-f04.mjs` 的双进程 1,000 fixture 比较和 P95 阈值；依赖升级后摘要变化必须经过明确兼容性评审。
4. 人工推送锁文件自检 fixture 修复后，收集修复提交同 SHA 的 `QuantOS CI` 与 `F04 Core Branch Coverage` 成功回执，确认 stable F04 Gate 实际执行通过，再将 `review_status` 更新为 `ACCEPTED`。
