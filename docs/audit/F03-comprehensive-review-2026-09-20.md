# F03 领域协议 v1 与 SDK 生成全面复审报告

> 更新：2026-09-20；本轮修复基线：`180e36ecefb66aef132ca6a4d54f8e8c39d85710`。
> 依据：[开发计划 F03](../SumAlpha-QuantOS-Development-Plan.md#task-f03)。
> 结论：**原六项问题全部关闭；19/20 检查点通过（95%），4/4 量化标准通过。C12 全项目远程重生成仍待验，F03 保持 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION。**

## 一、任务完成概况

领域协议、三语言 SDK、50 份独立 Schema、固定生成器及依赖更新入口已实现。本轮完成 A02 的递归元数据约束和 A04 的完整跨语言兼容测试，并修复边界测试发现的 Rust ProtoJSON 未知枚举拒绝问题。

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
| C12 重新生成及漂移验证 | PARTIAL | 本轮新增 Rust ProtoJSON 代码可由本地 descriptor 重现；全部远程插件的全项目重生成仍无回执 |
| C13 生成版本与依赖锁 | PASS（配置） | 六个远程插件固定版本；pbjson/build 锁定 0.7.0；生成入口和漂移入口均接入本地 ProtoJSON 生成 |
| C14–C16 Rust/Python/TS 编译测试 | PASS | Rust 8 项、Python 127 项、TS 46 项；Ruff/Pyright、TS lint/typecheck 通过 |
| C17 元数据声明覆盖 | PASS | 描述符验证 11 类领域对象、14 种 RPC 类型的 REQUIRED 路径 |
| C18 元数据执行约束 | PASS | 三语言覆盖 25 类类型的缺失 metadata、10 类身份字段缺口和完整正例；全部九个事件分支、单事件/事件列表递归拒绝；Python 实际 unary/stream 入站拒绝 INVALID_ARGUMENT，出站拒绝 INTERNAL |
| C19 breaking 阻断 | PASS | 本轮历史基线比较通过；删除字段阻断及恢复已有负向回执保持有效 |
| C20 往返及三语言兼容性 | PASS | 11 类各 1,000 组 + 3 组独立冻结黄金样本；全部六个二进制和六个 ProtoJSON 方向语义一致；15 个非法 JSON 拒绝探针通过 |

四项量化标准全部通过：三语言编译、必填元数据测试、breaking 阻断、至少 1,000 组序列化往返。

本轮证据：[修复验证摘要](./evidence/F03-A02-A04-2026-09-20/summary.json)。历次初审及整改记录保留在 evidence 和 Git 历史中，当前结论以本报告为准。

## 三、问题关闭依据与剩余风险

| ID | 等级 | 关闭依据 |
|---|---|---|
| A01 | 高危 | 50 份独立 Schema 编译与缺引用拒绝通过 |
| A02 | 高危 | Rust/TS 完整领域关系映射、Python 描述符遍历；TradeProposal.signal、GetEventResponse.event、StreamExecuteRequest.request 必须存在；子对象元数据递归验证，测试覆盖外层和内层拒绝 |
| A03 | 中危 | StrategyRelease/DeploymentTarget 已交付，计划 Schema 缺失会被门禁拒绝 |
| A04 | 中危 | 二进制和 ProtoJSON 双向交换覆盖全部语言组合、九个 oneof 分支；未知二进制字段、未知枚举数值/名称、非法 JSON 字段、重复 oneof、时间极值、int64 极值、高精度 Decimal 均有测试 |
| A05 | 中危 | 所有远程插件固定版本，配置负向测试通过 |
| A06 | 低危 | 常规生成不更新 buf.lock；依赖更新为显式独立操作 |

当前无活动代码缺陷。以下验收边界仍需保留：

- **C12 未完成**：未执行向公共 Buf 发送内部协议的全项目远程重生成；既往自动审批拒绝仍有效，本轮未重试。需要人工推送后的同 SHA CI 无漂移回执，或另行明确授权的生成环境。
- 黄金语料在本轮建立，由人工定义 ProtoJSON、Python 独立编码后冻结，不宣称已验证历史发布版本 SDK。未来协议演进必须保留 v1 语料。
- 未知二进制字段允许被 prost 丢弃；验证的是已知字段语义保持，不能用于保证未知字段透传。未知枚举数值必须保留；未知 JSON 字段/枚举名称默认拒绝。
- 本地 gRPC 回执来自真实套接字上的 SDK/测试引擎，不代表生产部署或远程 CI 验收；F02 A11 不在本轮关闭范围。

## 四、后续验收建议

1. 人工通过 GitHub Desktop 推送本轮提交，收集同 SHA 的 `proto-check`、生成物无漂移及 CI 回执，再核定 C12。
2. CI 持续执行 `make proto-compat-check` 和三语言元数据测试；Rust ProtoJSON 必须由生成入口维护，禁止只手改生成物。
3. 新增领域嵌套字段、RPC 或枚举时同步扩展关系映射与负向测试；保留冻结黄金语料，防止同源生成掩盖回归。
