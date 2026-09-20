# F03 领域协议 v1 与 SDK 生成全面复审报告

> 更新：2026-09-20；本轮远端复核基线：`c3be28d862dd17b6d1ee88cc0378659326abbe0a`。
> 依据：[开发计划 F03](../SumAlpha-QuantOS-Development-Plan.md#task-f03)。
> 结论：**原六项问题全部关闭；20/20 检查点通过（100%），4/4 量化标准通过。C12 已取得同 SHA 远端成功回执，F03 更新为 COMPLETED / ACCEPTED。**

## 一、任务完成概况

领域协议、三语言 SDK、50 份独立 Schema、固定生成器及依赖更新入口已实现。A02/A04 的既有修复和本地测试保持有效。本轮独立协议验收成功，核验下载包、原始日志与回执，并确认全部 92 份生成文件与验收提交哈希一致，关闭 C12。

| 原始等级 | 原问题数 | 已关闭 | 当前开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 2 | 2 | 0 |
| 中危 | 3 | 3 | 0 |
| 低危 | 1 | 1 | 0 |
| 合计 | 6 | 6 | 0 |

原问题关闭率 **100%**；检查点 PASS 20、PARTIAL 0，严格完成率 **100%**。结论限定于 F03 计划范围，不代表仓库全部 CI、生产部署或 F02 A11 已验收。

## 二、完成情况明细统计

| 检查点 | 状态 | 复核依据 |
|---|---|---|
| C01–C04 包、领域对象、Engine/Event API | PASS | 六个 v1 包、11 类领域对象、14 种 RPC 输入输出类型；不代表 Event 服务已上线 |
| C05–C06 Buf 入口、OpenAPI 交付 | PASS（实现） | 入口和既有生成物存在；本地 Buf lint/build 通过 |
| C07–C09 三语言 SDK | PASS | Rust、Python、TypeScript 构建/测试和运行时校验通过 |
| C10–C11 Schema 覆盖和独立编译 | PASS | 50/50 编译，11/11 领域消息覆盖；缺文件和悬空引用负向测试通过 |
| C12 重新生成及漂移验证 | PASS | `c3be28d` 独立作业 #2 成功；完整 `make proto-check` 通过，生成文件无漂移；下载包/日志摘要一致，92/92 份文件哈希与验收提交相同 |
| C13 生成版本与依赖锁 | PASS（配置） | 六个远程插件固定版本；pbjson/build 锁定 0.7.0；生成入口和漂移入口均接入本地 ProtoJSON 生成 |
| C14–C16 Rust/Python/TS 编译测试 | PASS | Rust 8 项、Python 127 项、TS 46 项；Ruff/Pyright、TS lint/typecheck 通过 |
| C17 元数据声明覆盖 | PASS | 描述符验证 11 类领域对象、14 种 RPC 类型的 REQUIRED 路径 |
| C18 元数据执行约束 | PASS | 三语言覆盖 25 类类型的缺失 metadata、10 类身份字段缺口和完整正例；全部九个事件分支、单事件/事件列表递归拒绝；Python 实际 unary/stream 入站拒绝 INVALID_ARGUMENT，出站拒绝 INTERNAL |
| C19 breaking 阻断 | PASS | 远端与 `55c7d3a` 基线比较通过；删除字段阻断及恢复已有负向回执保持有效 |
| C20 往返及三语言兼容性 | PASS | 11 类各 1,000 组 + 3 组独立冻结黄金样本；全部六个二进制和六个 ProtoJSON 方向语义一致；15 个非法 JSON 拒绝探针通过 |

四项量化标准全部通过：三语言编译、必填元数据测试、breaking 阻断、至少 1,000 组序列化往返。

当前证据：[下载校验记录](./evidence/F03-C12-c3be28d-2026-09-20/download-verification.json)、[原始回执](./evidence/F03-C12-c3be28d-2026-09-20/receipt.json)、[原始日志](./evidence/F03-C12-c3be28d-2026-09-20/proto-check.log)。GitHub [F03 Protocol Acceptance #2](https://github.com/SumAlphaAI/QuantOS/actions/runs/35514230105) 成功，用时 2m 33s；`sourceSha` 与 `expectedSha` 均为 `c3be28d862dd17b6d1ee88cc0378659326abbe0a`，`protocolStepOutcome=success`、`acceptance=PASS`、`generatedChanges` 为空。

三语言单测与元数据拒绝测试沿用 [已验证的本地修复证据](./evidence/F03-A02-A04-2026-09-20/summary.json)，不表述为本轮远端重新执行。历史 [a9f367a 前置步骤阻断记录](./evidence/F03-C12-remote-2026-09-20/receipt.json)和 [55c7d3a 生成循环依赖失败记录](./evidence/F03-C12-55c7d3a-2026-09-20/receipt.json)保留，不再作为当前活动缺口。

## 三、问题关闭依据与剩余风险

| ID | 等级 | 关闭依据 |
|---|---|---|
| A01 | 高危 | 50 份独立 Schema 编译与缺引用拒绝通过 |
| A02 | 高危 | Rust/TS 完整领域关系映射、Python 描述符遍历；TradeProposal.signal、GetEventResponse.event、StreamExecuteRequest.request 必须存在；子对象元数据递归验证，测试覆盖外层和内层拒绝 |
| A03 | 中危 | StrategyRelease/DeploymentTarget 已交付，计划 Schema 缺失会被门禁拒绝 |
| A04 | 中危 | 二进制和 ProtoJSON 双向交换覆盖全部语言组合、九个 oneof 分支；未知二进制字段、未知枚举数值/名称、非法 JSON 字段、重复 oneof、时间极值、int64 极值、高精度 Decimal 均有测试 |
| A05 | 中危 | 所有远程插件固定版本，配置负向测试通过 |
| A06 | 低危 | 常规生成不更新 buf.lock；依赖更新为显式独立操作 |

当前无活动 F03 问题。C12 的生成循环依赖已通过独立生成工具和隔离启动回归修复，并获远端完整生成、漂移检查及兼容测试成功回执。保留以下边界：

- 黄金语料在本轮建立，由人工定义 ProtoJSON、Python 独立编码后冻结，不宣称已验证历史发布版本 SDK。未来协议演进必须保留 v1 语料。
- 未知二进制字段允许被 prost 丢弃；验证的是已知字段语义保持，不能用于保证未知字段透传。未知枚举数值必须保留；未知 JSON 字段/枚举名称默认拒绝。
- 本地 gRPC 回执来自真实套接字上的 SDK/测试引擎，不代表生产部署或远程 CI 验收；F02 A11 不在本轮关闭范围。

## 四、验收后维护建议

1. 持续执行独立 `F03 Protocol Acceptance / proto-check`，按提交 SHA 归档日志、回执和生成文件清单；协议或工具链变更须重新验收。
2. 保留生成器独立性及隔离启动回归，维持 `clean: true` 和生成漂移失败门禁。
3. 新增领域嵌套字段、RPC 或枚举时同步扩展关系映射与负向测试；保留冻结黄金语料，防止同源生成掩盖回归。
4. 本轮验收文档提交需由用户通过 GitHub Desktop 推送。新文档提交的 CI 状态以其自身运行结果为准，不能把 `c3be28d` 的回执标为新提交的远端回执。F02 A11 保持原有状态。
