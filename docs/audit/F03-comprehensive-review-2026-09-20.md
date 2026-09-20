# F03 领域协议 v1 与 SDK 生成全面复审报告

> 更新：2026-09-20；本轮复核基线：`9aea0b5fa01c7c1824efac5610483005fc1d7958`。
> 依据：[开发计划 F03](../SumAlpha-QuantOS-Development-Plan.md#task-f03)。
> 结论：**并非全部解决。A01、A03、A05、A06保持关闭；A02、A04重新开放，状态为 FIX_VALIDATION / IMPLEMENTED_PENDING_ACCEPTANCE。** 上轮“20/20、4/4、ACCEPTED”结论撤回。

## 一、任务完成概况

协议定义、三语言构建、50份独立Schema、固定生成器及显式依赖更新已实现。本轮重新检查实现、执行负向探针并补修响应校验、TypeScript嵌套请求校验和互操作方向，未以历史绿色测试直接确认全部关闭。

| 原始等级 | 原问题数 | 已关闭 | 当前开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 2 | 1 | 1（A02） |
| 中危 | 3 | 2 | 1（A04） |
| 低危 | 1 | 1 | 0 |
| 合计 | 6 | 4 | 2 |

原问题关闭率 **4/6（66.7%）**。沿用20个检查点：PASS 17、PARTIAL 3，严格完成率 **17/20（85.0%）**。四项量化标准中3项通过、必填元数据测试1项部分通过；两种统计分母不同。

## 二、完成情况明细统计

| 检查点 | 状态 | 本轮结论 |
|---|---|---|
| C01–C04 包、领域对象、Engine/Event API | PASS | 六个v1包、计划对象和RPC定义保留；不等同真实Event服务上线 |
| C05–C06 Buf入口、OpenAPI交付 | PASS（实现） | 入口和既有生成物存在；本轮本地lint/build通过 |
| C07–C09 三语言SDK | PASS | Rust6项测试；Python95项；TS12项及构建通过 |
| C10–C11 Schema覆盖和独立编译 | PASS | 50/50编译通过，11/11计划领域消息存在；缺文件与悬空引用均被门禁拒绝 |
| C12 重新生成及漂移验证 | PARTIAL | 漂移检查代码保留；固定OpenAPI版本后的全项目远程重生成未执行，不能以Ping/Pong探针替代 |
| C13 生成版本与依赖锁 | PASS（配置） | 六个plugin有精确版本；常规生成不再更新buf.lock；正反配置测试通过 |
| C14–C16 Rust/Python/TS编译测试 | PASS | Rust6/6、Python95/95、TS12/12；PythonRuff/Pyright及TS类型检查通过 |
| C17 元数据声明覆盖 | PASS | 既有描述符测试验证11类消息及14种RPC输入输出类型的REQUIRED路径 |
| C18 元数据执行约束 | PARTIAL | 请求及响应校验有补修，但嵌套领域对象未递归验证，见A02 |
| C19 breaking阻断 | PASS | 本地历史基线比较通过；真实删除字段/恢复/自比较拒绝测试通过 |
| C20 往返及三语言兼容性 | PARTIAL | 11类各1,000组、全部六个二进制方向通过；原整改建议的ProtoJSON和完整边界覆盖仍缺失 |

量化标准：三语言编译PASS；100%必填元数据测试PARTIAL；Buf breaking阻断PASS；1,000组往返PASS。C20还包含“兼容性测试”交付物的完整性，不能仅以往返数量充足关闭。

### 已关闭项索引

| ID | 等级 | 复核依据 |
|---|---|---|
| A01 | 高危 | Schema内联引用保留；50份AJV编译和删除引用负向测试通过 |
| A03 | 中危 | StrategyRelease及DeploymentTarget文件存在，缺计划Schema会被拒绝；当前提取实现读取Proto源码，不是通用descriptor生成器 |
| A05 | 中危 | openapiv2固定v2.29.0，全部六项plugin有版本；配置负向测试通过。关闭的是未固定版本缺陷，全项目输出重现性另归C12 |
| A06 | 低危 | 独立proto-deps-update保留；常规脚本无dep update，重新注入会被拒绝 |

本轮证据见 [复核记录](./evidence/F03-recheck-2026-09-20/summary.json)。[初审摘要](./evidence/F03-review-2026-09-20/summary.json)和[上轮整改摘要](./evidence/F03-remediation-2026-09-20/summary.json)保留历史原文；后者的ACCEPTED结论已被本报告取代，不能继续作为当前全量验收依据。

## 三、当前问题清单及风险分析

### F03-A02：嵌套消息元数据执行边界不完整（高危，OPEN）

- 模块：三语言SDK元数据校验、Engine/Event协议边界。
- 已补修：Python unary/stream响应返回前校验元数据，无效响应返回INTERNAL；无效请求仍为INVALID_ARGUMENT。TypeScript支持StreamExecuteRequest的嵌套request路径。
- 剩余表现：`validate_message_metadata`验证外层元数据后即返回。合成EventEnvelope含有效外层metadata、内嵌Position仅含position_id时，Python负向探针仍输出`ACCEPTED nested Position without metadata`。Rust/TS当前也只提取本层或request路径，未遍历所有领域子消息。
- 影响：事件、提案等组合对象可能携带没有租户/主体/关联标识的子对象。当前单测不足以证明全部RPC和领域嵌套路径均拒绝缺失元数据；不能从validator存在推导出所有实际边界已接线。

### F03-A04：兼容性验收范围未完整覆盖（中危，OPEN）

- 模块：`check-proto-compatibility.mjs`及Rust/Python消费者。
- 已补修：从11类轮转共1,000组扩展到每类1,000组（共11,000组）；TypeScript、Python、Rust全部六个二进制方向均已执行并比较规范化语义。packed与unpacked的合法字节差异不会被误判。
- 剩余表现：没有三语言ProtoJSON互换；事件fixture只使用Position oneof，缺其余分支和未知字段/枚举/时间边界矩阵；样本仍由单个TS构造器播种，并非独立历史版本黄金语料。
- 影响：二进制互通通过仍不能证明JSON字段映射、全部oneof、协议演进与边界值的兼容性。

此外，C12缺固定版本后全项目重生成回执；它是验证缺口，未额外新增第七个问题。上轮自动审批曾拒绝向公共Buf发送内部协议，本轮没有重试该外发操作，也没有将未来GitHub Actions执行写成已通过。

## 四、整改建议与后续验收

1. A02：基于描述符或完整领域类型映射递归校验嵌套消息；对全部11类领域对象及14种RPC输入输出类型，覆盖缺失外层/内层metadata、逐项缺失身份字段，验证业务处理及响应发送均被阻断。
2. A04：补齐三语言ProtoJSON、全部事件oneof、未知字段/枚举、时间和数值边界；保留历史语料及各编码方独立构造的数据，避免同源fixture掩盖共同错误。
3. C12：经明确授权后运行全项目Buf远程重生成，或由用户人工推送后收集同SHA CI日志与生成物无漂移回执；当前不得记为已验证。
4. 仅在上述缺口通过后关闭A02/A04并重新计算完成率；已关闭的四项保留索引，不再展示为活动缺陷。
