# F03 领域协议 v1 与 SDK 生成全面复审报告

> 更新：2026-09-20；本轮远端复核基线：`55c7d3a59ce8ef83ad234f8763299f31350bede1`。
> 依据：[开发计划 F03](../SumAlpha-QuantOS-Development-Plan.md#task-f03)。
> 结论：**原六项问题全部关闭；19/20 检查点通过（95%），4/4 量化标准通过。C12 独立作业已执行，但生成器循环依赖导致失败；本地已修复，远端仍待验，F03 保持 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION。**

## 一、任务完成概况

领域协议、三语言 SDK、50 份独立 Schema、固定生成器及依赖更新入口已实现。A02/A04 的既有修复和本地测试保持有效。本轮核对独立协议作业，下载同 SHA 回执并验证摘要，定位并修复 Rust ProtoJSON 生成器对自身 SDK 生成物的循环依赖。

| 原始等级 | 原问题数 | 已关闭 | 当前开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 2 | 2 | 0 |
| 中危 | 3 | 3 | 0 |
| 低危 | 1 | 1 | 0 |
| 合计 | 6 | 6 | 0 |

原问题关闭率 **100%**；检查点 PASS 19、PARTIAL 1，严格完成率 **95%**。问题关闭率不等同阶段完成率，C12 的远程生成回执不能以本地测试替代。

## 二、完成情况明细统计

| 检查点 | 状态 | 复核依据 |
|---|---|---|
| C01–C04 包、领域对象、Engine/Event API | PASS | 六个 v1 包、11 类领域对象、14 种 RPC 输入输出类型；不代表 Event 服务已上线 |
| C05–C06 Buf 入口、OpenAPI 交付 | PASS（实现） | 入口和既有生成物存在；本地 Buf lint/build 通过 |
| C07–C09 三语言 SDK | PASS | Rust、Python、TypeScript 构建/测试和运行时校验通过 |
| C10–C11 Schema 覆盖和独立编译 | PASS | 50/50 编译，11/11 领域消息覆盖；缺文件和悬空引用负向测试通过 |
| C12 重新生成及漂移验证 | PARTIAL | `55c7d3a` 独立作业 #1 实际执行，Buf 清理六份 serde 文件后 SDK 内的生成器无法编译；已移为独立工具，空输出/空构建目录重建六份文件且哈希一致；修复后远端回执待收集 |
| C13 生成版本与依赖锁 | PASS（配置） | 六个远程插件固定版本；pbjson/build 锁定 0.7.0；生成入口和漂移入口均接入本地 ProtoJSON 生成 |
| C14–C16 Rust/Python/TS 编译测试 | PASS | Rust 8 项、Python 127 项、TS 46 项；Ruff/Pyright、TS lint/typecheck 通过 |
| C17 元数据声明覆盖 | PASS | 描述符验证 11 类领域对象、14 种 RPC 类型的 REQUIRED 路径 |
| C18 元数据执行约束 | PASS | 三语言覆盖 25 类类型的缺失 metadata、10 类身份字段缺口和完整正例；全部九个事件分支、单事件/事件列表递归拒绝；Python 实际 unary/stream 入站拒绝 INVALID_ARGUMENT，出站拒绝 INTERNAL |
| C19 breaking 阻断 | PASS | 本轮历史基线比较通过；删除字段阻断及恢复已有负向回执保持有效 |
| C20 往返及三语言兼容性 | PASS | 11 类各 1,000 组 + 3 组独立冻结黄金样本；全部六个二进制和六个 ProtoJSON 方向语义一致；15 个非法 JSON 拒绝探针通过 |

四项量化标准全部通过：三语言编译、必填元数据测试、breaking 阻断、至少 1,000 组序列化往返。

本地修复证据：[修复验证摘要](./evidence/F03-A02-A04-2026-09-20/summary.json)。同 SHA 远端回执见 [C12 收集记录](./evidence/F03-C12-remote-2026-09-20/receipt.json)：主 CI #95 失败、Frontend Baseline #38 因 F03 尚未 COMPLETED 失败；Compatibility #59 三浏览器通过，但不执行协议生成。该记录仅描述历史 `a9f367a`。最新 `55c7d3a` 独立作业已执行并失败，见 [下载校验记录](./evidence/F03-C12-55c7d3a-2026-09-20/download-verification.json)、[原始回执](./evidence/F03-C12-55c7d3a-2026-09-20/receipt.json)和[原始日志](./evidence/F03-C12-55c7d3a-2026-09-20/proto-check.log)。ZIP 摘要与 GitHub 展示值一致，日志摘要与回执一致；92 份文件中六份 serde 缺失，其余 86 份远端摘要与本地相同。历次初审及整改记录保留在 evidence 和 Git 历史中，当前结论以本报告为准。

## 三、问题关闭依据与剩余风险

| ID | 等级 | 关闭依据 |
|---|---|---|
| A01 | 高危 | 50 份独立 Schema 编译与缺引用拒绝通过 |
| A02 | 高危 | Rust/TS 完整领域关系映射、Python 描述符遍历；TradeProposal.signal、GetEventResponse.event、StreamExecuteRequest.request 必须存在；子对象元数据递归验证，测试覆盖外层和内层拒绝 |
| A03 | 中危 | StrategyRelease/DeploymentTarget 已交付，计划 Schema 缺失会被门禁拒绝 |
| A04 | 中危 | 二进制和 ProtoJSON 双向交换覆盖全部语言组合、九个 oneof 分支；未知二进制字段、未知枚举数值/名称、非法 JSON 字段、重复 oneof、时间极值、int64 极值、高精度 Decimal 均有测试 |
| A05 | 中危 | 所有远程插件固定版本，配置负向测试通过 |
| A06 | 低危 | 常规生成不更新 buf.lock；依赖更新为显式独立操作 |

原六项缺陷保持关闭；新增生成启动缺陷已本地修复，归入 C12 修复验证。以下验收边界仍需保留：

- **C12 未完成**：独立作业 [#1](https://github.com/SumAlphaAI/QuantOS/actions/runs/35512326148) 的 sourceSha/expectedSha 均为 `55c7d3a59ce8ef83ad234f8763299f31350bede1`，`protocolStepOutcome=failure`、`acceptance=FAIL`。`buf.gen.yaml` 的 `clean: true` 删除 serde 输出后，原 `quantos-proto` example 编译 SDK 时找不到 include 文件。生成器现已拆为 `tools/proto-json-codegen`，不依赖 SDK；生成和漂移入口均已切换，CI 增加隔离启动回归。没有关闭清理选项、降低漂移检查或将失败回执改为成功。
- 黄金语料在本轮建立，由人工定义 ProtoJSON、Python 独立编码后冻结，不宣称已验证历史发布版本 SDK。未来协议演进必须保留 v1 语料。
- 未知二进制字段允许被 prost 丢弃；验证的是已知字段语义保持，不能用于保证未知字段透传。未知枚举数值必须保留；未知 JSON 字段/枚举名称默认拒绝。
- 本地 gRPC 回执来自真实套接字上的 SDK/测试引擎，不代表生产部署或远程 CI 验收；F02 A11 不在本轮关闭范围。

## 四、后续验收建议

1. 人工通过 GitHub Desktop 推送本轮生成器修复提交，运行独立 `F03 Protocol Acceptance / proto-check` 作业；该作业不依赖浏览器任务，仍完整执行 `make proto-check`。归档 `f03-protocol-<SHA>` 包中的日志、`receipt.json`、生成物 SHA-256 清单。仅在同 SHA、步骤 success、工作树无生成物漂移且日志包含完整兼容测试完成标记时记录 PASS。
2. 收集该回执后再将 C12 改为 PASS、F03 改为 COMPLETED/ACCEPTED，并复验 BFF 的 F03 完成状态依赖。当前不得为消除 Frontend Baseline 失败而提前修改状态。
3. CI 持续执行 `make proto-compat-check` 和三语言元数据测试；Rust ProtoJSON 必须由生成入口维护，禁止只手改生成物。
4. 新增领域嵌套字段、RPC 或枚举时同步扩展关系映射与负向测试；保留冻结黄金语料，防止同源生成掩盖回归。
