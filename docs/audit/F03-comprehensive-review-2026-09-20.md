# F03 领域协议 v1 与 SDK 生成全面复审报告

> 更新日期：2026-09-20。整改基线：`4ff0331ba3a13e204201b69ec787bac86c6b5b0a`。依据：[开发计划 F03](../SumAlpha-QuantOS-Development-Plan.md#task-f03)。
> 结论：**F03 已完成整改并通过本地验收，状态为 COMPLETED / ACCEPTED；检查点 20/20（100%），量化验收 4/4。**

## 一、任务完成概况

F03 已建立六个版本化 Proto 包，覆盖计划中的十类领域对象、`EventEnvelope`、Engine API 与 Event API；Rust、Python、TypeScript SDK 均可编译或打包。Buf 格式、lint、构建、生成物漂移和历史兼容门禁已接线，50 份 JSON Schema 可独立编译并覆盖全部 11 个计划领域消息。

初审发现的 2 个高危、3 个中危和 1 个低危问题已全部关闭。三语言 SDK 现在提供统一的必填元数据运行时校验，Python Engine gRPC 入口会在调用业务实现前拒绝缺少 tenant、actor、correlation 等身份信息的请求。新增互操作门禁使用同一批 1,000 个 fixture，轮转覆盖 11 类领域消息，由 TypeScript 编码，再由 Python、Rust 解码、校验、重编码并比较规范化语义。

| 等级 | 初审数量 | 已关闭 | 当前未解决 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 2 | 2 | 0 |
| 中危 | 3 | 3 | 0 |
| 低危 | 1 | 1 | 0 |
| 合计 | 6 | 6 | 0 |

## 二、完成情况明细统计

| ID | 检查项 | 结果 | 当前实现与验证依据 |
|---|---|---|---|
| C01 | `proto/*/v1` 包结构 | PASS | `common/research/strategy/trading/engine/events` 六个版本化包齐全 |
| C02 | 计划领域对象 | PASS | 十类计划对象与 `EventEnvelope` 均有 v1 定义 |
| C03 | Engine API | PASS | metadata、health、execute、stream execute、cancel 五类 RPC 完整 |
| C04 | Event API | PASS | EventLedger 查询、列表 API 与事件信封完整 |
| C05 | Buf 生成入口 | PASS | format、lint、build、generate、breaking 及 Make 入口齐全 |
| C06 | OpenAPI 交付物 | PASS | Engine/Event OpenAPI 生成物纳入漂移检查 |
| C07 | Rust SDK | PASS | `quantos-proto` 编译、Clippy、单元与往返测试通过 |
| C08 | Python SDK | PASS | wheel、生成包导入、全量 Engine 测试通过 |
| C09 | TypeScript SDK | PASS | typecheck、lint、test、build 通过 |
| C10 | JSON Schema 覆盖 | PASS | 50 份 Schema；11/11 计划领域消息均有独立文件，包括 `StrategyRelease` |
| C11 | JSON Schema 可独立使用 | PASS | 每份文件内联传递依赖；AJV 2020-12 编译 50/50 通过 |
| C12 | 生成物漂移门禁 | PASS | Rust/Python/TS/OpenAPI/JSON Schema 的已跟踪和未跟踪差异均受检 |
| C13 | 生成器与依赖可复现 | PASS | 六个 remote plugin 全部固定版本；OpenAPI 固定为 `v2.29.0` |
| C14 | Rust SDK 编译/测试 | PASS | 2 项元数据单元测试及 4 项协议测试通过 |
| C15 | Python SDK 编译/打包 | PASS | 完整回归 93/93，Ruff 与 Pyright 通过 |
| C16 | TypeScript SDK 编译/测试 | PASS | 12/12 包测试通过，ESLint、typecheck、build 通过 |
| C17 | 必填元数据声明覆盖 | PASS | 11 类消息和全部 Engine/Event RPC 元数据路径均检查 `REQUIRED` 注解 |
| C18 | 必填元数据运行时约束 | PASS | 三语言 validator 拒绝缺失/空身份字段；Python Engine gRPC 入口返回 `INVALID_ARGUMENT` |
| C19 | Buf breaking 阻断 | PASS | 历史基线检查通过；删除字段负向测试确认破坏性变更被拒绝 |
| C20 | 1,000 组往返与 SDK 兼容性 | PASS | 原 Rust 11类×1,000组及 Python 1,000组保留；新增三语言11类共1,000组互操作门禁通过 |

量化验收结果为 **4/4**：三语言 SDK 编译通过；必填元数据声明与运行时拒绝均覆盖；Buf breaking 可阻断删除字段；1,000 组 fixture 往返及跨语言互操作无语义差异。

## 三、问题关闭清单及风险分析

| ID | 原等级 | 状态 | 关闭依据 |
|---|---|---|---|
| F03-A01 | 高危 | CLOSED | Schema 提取器内联传递 `definitions`；50份全部经 AJV 编译；删除引用负向测试失败关闭 |
| F03-A02 | 高危 | CLOSED | Rust/Python/TypeScript validator 校验 request、tenant、workspace、actor、correlation、mode、environment、issued_at；Python gRPC 服务入口强制执行 |
| F03-A03 | 中危 | CLOSED | 从权威 `strategy.proto` 补充非 RPC 可达定义；`v1StrategyRelease` 与 `v1DeploymentTarget` 已生成；缺文件负向测试失败关闭 |
| F03-A04 | 中危 | CLOSED | 新增 1,000 组、11类消息的 TypeScript→Python/Rust 二进制互操作及规范化语义比较 |
| F03-A05 | 中危 | CLOSED | `openapiv2` 固定为 Buf 已发布的 `v2.29.0`；配置门禁拒绝任一未固定 remote plugin；非项目 Ping/Pong 探针验证该版本可执行 |
| F03-A06 | 低危 | CLOSED | 常规生成不再执行 `buf dep update`；新增独立 `proto-deps-update` 维护目标及负向配置测试 |

**当前活动问题清单为空。** 初审风险均有实现修复和正反测试，不再作为待整改问题保留。

验收边界：本轮未把 QuantOS 协议源码发送到公共 Buf 远程执行环境；固定插件版本使用不含项目内容的 Ping/Pong 探针验证。仓库 Proto 源文件未改变，本地 `buf format/lint/build`、既有生成物、Schema重新提取、历史 breaking 及全部新增门禁均通过。推送后的 GitHub Actions 将按固定插件对提交执行完整 `make proto-check`，其远程回执属于提交后的持续验证，不影响本次问题关闭。

## 四、整改结果与后续维护建议

1. JSON Schema 变更必须通过 `check-json-schemas.mjs` 及三项正反测试；新增计划领域消息时同步更新显式覆盖清单。
2. 所有 Engine/Event 服务入口必须调用 SDK 元数据 validator；不得以 Proto `REQUIRED` 注解替代运行时拒绝。
3. 协议或生成器升级后运行 `make proto-compat-check`，保持至少 1,000 组并覆盖全部计划消息；允许合法的 wire 编码形式差异，但规范化消息语义必须一致。
4. remote plugin 升级必须使用精确版本并单独评审生成物；依赖更新只通过 `make proto-deps-update` 执行。
5. 验证结果与命令摘要见 [整改证据](./evidence/F03-remediation-2026-09-20/summary.json)。
