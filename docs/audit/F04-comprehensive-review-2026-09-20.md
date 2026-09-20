# F04 Core、错误、时钟与 ID 全面复审报告

> 初次复审日期：2026-09-20；整改复核日期：2026-09-20。
> 初次复审基线：`db2e51f4c37fdced7cf22d0b939e8277c73d959c`。
> 依据：[开发计划 F04](../SumAlpha-QuantOS-Development-Plan.md#task-f04)、开发计划第 2.2 节最低完成条件及第 2.3 节测试资产规则。
> 当前结论：**初审 9 项问题均已完成本地整改；23/23 检查点 PASS，严格完成率 100%。本地 F04 Gate、nightly branch 覆盖率、workspace Clippy 和完整 Rust workspace 测试均通过。新提交的 GitHub Actions 回执需在人工推送后另行收集。**

## 一、任务完成概况

初审发现 0 个阻塞级、3 个高危、5 个中危、1 个低危问题，严格完成率为 65.2%。本轮依照 A01 至 A09 顺序完成整改，关闭了反序列化不变量绕过、fixture hash 未验证、独立覆盖率不足、测试资产缺失、错误码覆盖不足、确定性证据不足、P95 缺失、工作区门禁失败和文档过期问题。

`quantos-core` 现提供强类型 UUID、UTC clock、11 个稳定核心错误码、受校验的金额/数量/版本/hash primitive，以及加载时验证内容 hash 的 fixture。新增 `quantos-testkit` 提供固定时钟、确定性 ID、1,000 组 fixture corpus 和 P95 验收。稳定 release 覆盖率为 97.74% line、96.73% region；nightly LLVM branch 覆盖率为 97.73%。

| 初审等级 | 原问题数 | 已关闭 | 当前开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 3 | 3 | 0 |
| 中危 | 5 | 5 | 0 |
| 低危 | 1 | 1 | 0 |
| **合计** | **9** | **9** | **0** |

原问题关闭率 **100%**；检查点 PASS 23、PARTIAL 0、FAIL 0，严格完成率 **100%**。

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
| C16 fixture hash 确定性 | PASS | 两个独立进程各生成 1,000 个 fixture，摘要一致：`sha256:582481edcadd359837c66fda701da043b08e3621882a2050b3589455a8ce2458` |
| C17 fixture 完整性 | PASS | `Fixture` 字段私有；自定义反序列化拒绝缺失、未知、错误类型、非法 primitive 和正文/hash 不一致 |
| C18 `quantos-testkit` | PASS | 提供 `FixedIdSource`、`fixed_clock`、fixture corpus 和 domain P95 工具，3/3 测试通过 |
| C19 包级质量 | PASS | core integration tests 10/10、testkit 3/3、doctest、fmt、包级 Clippy 均通过 |
| C20 覆盖率 | PASS | stable release：line 97.74%、region 96.73%；nightly：branch 97.73%；均高于 90% |
| C21 纯领域计算 P95 | PASS | 两个独立进程各运行 1,000 次构造/hash/verify；本轮最大 P95 为 31μs，低于 50ms |
| C22 工作区质量门禁 | PASS | workspace Clippy `-D warnings` 通过；完整 `cargo test --workspace --locked` 通过，UDS 测试在允许本地 socket 的环境执行 |
| C23 文档 | PASS | `quantos-core/README.md` 已记录公开契约、不变量、fixture hash 范围、testkit 和 Gate |

### 本轮验证记录

| 命令 | 结果 | 关键回执 |
|---|---|---|
| `make f04-check` | PASS | core 10/10、testkit 3/3；1,000 fixture 双进程摘要一致；stable line 97.74%、region 96.73% |
| `make coverage-rust-branch`（nightly） | PASS | branch 43/44，97.73%；line 97.73%、region 96.65%；脚本强制 branch ≥90% |
| `node scripts/check-f04.mjs` | PASS | `fixtures=1000`、固定 digest、`p95Micros=31` |
| `cargo fmt --all -- --check` | PASS | 无格式差异 |
| `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` | PASS | workspace 无 warning |
| `cargo test --workspace --locked` | PASS | 全部已执行测试通过；1 个 helper-only 测试按设计 ignored；所有 doctest 通过 |

## 三、问题关闭清单及剩余风险

| ID | 原等级 | 状态 | 关闭依据 |
|---|---|---|---|
| A01 | 高危 | CLOSED | Money、Quantity、SchemaVersion、BuildVersion、ContentHash 自定义反序列化强制复用校验；非法边界测试通过 |
| A02 | 高危 | CLOSED | Fixture 私有字段、validated deserialize、`verify()` 和 `CORE_FIXTURE_HASH_MISMATCH` 已实现；篡改负向测试通过 |
| A03 | 高危 | CLOSED（本地） | 独立 stable/release Gate 与 nightly branch Gate 已建立；本地 line/region/branch 均超过 90% |
| A04 | 中危 | CLOSED | `quantos-testkit` 已交付固定 clock、确定性 ID、fixture corpus 和性能工具 |
| A05 | 中危 | CLOSED | 11/11 错误码精确机器码均由自动化测试锁定 |
| A06 | 中危 | CLOSED | 1,000 组 Unicode、转义、嵌套和值类型 corpus 在两个独立进程产生相同摘要 |
| A07 | 中危 | CLOSED | 固定 1,000 样本 P95 Gate 已接入，本轮 31μs <50ms |
| A08 | 中危 | CLOSED | Proto Clippy 警告修复；mock Engine 元数据更新到当前协议；workspace Clippy 和完整 workspace test 通过 |
| A09 | 低危 | CLOSED | core README 已重写并描述当前 F04 契约和验收入口 |

当前没有开放的本地 F04 问题。以下边界继续保留：

- `FixtureId` 不进入内容 hash 文档；kind、schema version 和 fields 决定内容 hash，该语义已写入 README。
- canonical JSON 面向 QuantOS 自有的 `serde_json::Value` 合约，不声明为外部 RFC 8785 实现。
- nightly 本地复核使用 nightly rustc 的 branch instrumentation 和已安装 Rust 1.91 LLVM reporting tools；GitHub workflow 会在 Linux nightly 环境重新执行同一 90% 阈值。
- 本报告不能代替尚未发生的远端同 SHA GitHub Actions 回执。人工推送后应收集 `QuantOS CI` 和 `F04 Core Branch Coverage` 结果，再更新开发计划的远端验收状态。

## 四、后续维护建议

1. 每次修改 core primitive、serde 边界或 fixture canonicalization 时执行 `make f04-check`；不得以聚合 coverage 代替独立 core threshold。
2. 新增 `ErrorCode` 时必须同步扩展 11/11 表驱动契约；新增受约束 value object 时必须提供构造和反序列化的同一不变量测试。
3. 保持 `scripts/check-f04.mjs` 的双进程 1,000 fixture 比较和 P95 阈值；依赖升级后摘要变化必须经过明确兼容性评审。
4. 人工推送本提交后收集同 SHA 的 `QuantOS CI` 与 `F04 Core Branch Coverage` 回执。两项成功后，才把开发计划 F04 的 `review_status` 更新为 `ACCEPTED`。
