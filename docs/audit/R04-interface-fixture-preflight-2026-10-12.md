# R04 接口与 fixture 预检、当前前置准入核对

本轮完成用户要求的 **预检与准入核对**。产品源码冻结于 `2c6e1fb4f6596f477877b0734a31d3c9c61f7e9e`，进入任务时 Git 干净；本轮只新增预检工具、证据并更新说明。现有 fixture 功能通过，接口仍有缺口；**不授予 R04 DEVELOPMENT READY**。

- 完整预检：12 个命令，9 PASS、3 EXPECTED_REJECTION；两组各 100 条真实本地 UDS schema/双 unary/双 stream 回放，49 项回执负向，另加 10 个 fixture 破坏探针。
- Runtime 三项集成通过：100 个 Proposal 的证据、反方观点、`executable=false`；100 次到期后评估拒绝；重放 hash 稳定；`order.execute` 输入被拒绝并使 run 失败。
- TP03、TP04、F0 当前均 `NOT_ASSESSED`，严格校验拒绝；历史 READY 不转移。R03 专用 `R03_LOCAL` 验证仍 PASS。
- 数据库执行、真实来源事实消费、部署、外部服务、hosted CI：**NOT RUN**；`formalAccepted=false`。未升级订阅、未连接或修改 Supabase，未重新使用已退役 fixture，未推送。

证据入口：[完整 manifest](./evidence/r04-preflight-20261012/attempt-02/manifest.json)、[执行索引](./evidence/r04-preflight-20261012/attempt-02/execution-results.json)、[可重跑预检程序](./evidence/r04-preflight-20261012/preflight.mjs)。manifest 绑定 1,246 个源文件/配置/测试/预检程序输入及 19 个闭包节点的规范字段；新输出单独保存，不覆盖旧组件回执。

## 接口核对

| 接口/边界 | 当前实现 | 本轮验证及限制 |
|---|---|---|
| Signal wire | `proto/quantos/strategy/v1/strategy.proto`、`v1Signal.schema.json`；`quant.signal.v1` | 100 条真实本地 UDS 输出、版本/置信度/时效/证据、两种双回放通过；受控 fixture，不是上游模型运行或真实 release/snapshot 字节解析 |
| Proposal wire | `proto/quantos/trading/v1/trading.proto`、`v1TradeProposal.schema.json`；`decision.proposal.v1` | 100 条 Proposal 含反方观点、证据、expiry、不可执行标记及可读 mock Artifact；禁止工具输入与审计由现有 Python 套件覆盖 |
| Runtime 编排 | `SignalProposalWorkflowInput`、`SignalProposalWorkflowCoordinator`、`SignalProposalSchemaValidator` | 三项现有集成实际通过；fixture 链启动 OpenBB/LLMQuant/TradingAgents 本地 sidecar，不能据此授予 TP05 或真实 Engine 准入 |
| 评估期限 | `TradeProposalEvaluationGate::ensure_evaluable`，到期条件为 `expires_at <= observed_at` | 现有 100 条集成分别验证到期前成功、到期后一秒拒绝；精确等时边界本轮未新增 Runtime 测试 |
| 存储/研究输入 | `new_persisted` 使用持久 snapshot reader；Signal/Proposal repository 仍为 `InMemorySignalProposalRepository` | 本轮仅用内存 catalog；R03 ResearchArtifact 到 Signal 的版本、租户、权限与内容 hash 消费闭环，以及持久 Proposal 查询/恢复未验收 |
| BFF/客户端 | OpenAPI 有 `/v1/proposals`、详情、stream、risk-evaluations；客户端 mock 有过期拒绝 | 合同存在不能证明部署路由已连接本协调器；本轮没有 HTTP/UI/真实 risk 请求与数据库证据 |

现有 Runtime 公共校验器的拒绝语义与 wire/schema、fixture 校验并不完全一致。独立 Rust 探针及结果见[源文件](./evidence/r04-preflight-20261012/runtime-contract-probe.rs)、[可重跑驱动](./evidence/r04-preflight-20261012/probe-runtime-contract.py)、[探针回执](./evidence/r04-preflight-20261012/runtime-contract-attempt-02/receipt.json)。该探针只调用公开纯校验接口，不创建 Engine、workflow 或数据库连接；“探针执行成功”不等于“接口要求通过”，具体缺口以结果文件为准。

实际结果：9 个破坏输入中 **7 个被 Runtime 公共校验器接受**；`executable=true`、空证据两项拒绝。

| 被接受的破坏输入 | 调用入口 | 风险范围 |
|---|---|---|
| `direction=BUY`、`confidence.value=2` | `validate_signal` | enum/数值校验弱于 schema/fixture 校验 |
| 删除 `diagnostics.value.model_version`、删除 `metadata` | `validate_signal` | 版本与命令 metadata 未由该入口强制校验；`provided_signal` 路径也调用此入口 |
| `action=EXECUTE`、删除顶层 `counter_views` | `validate_proposal` | 非法动作被接受；Rust 从 committee evidence 摘要推导反方观点，未校验 wire 必需语义 |
| `expires_at=2000-01-01T00:00:00Z` | `validate_proposal` | 未在该入口校验生成时间关系；后续 evaluation gate 的到期拒绝仍有效，不能推论已执行评估或订单 |

## 当前准入

| 节点 | 机器 Gate | 本轮证据 | 结论 |
|---|---|---|---|
| CORE:R03 | READY / R03_LOCAL | `make r03-admission-check` exit 0 | 仅 R03 自身本地开发范围；不授予其上游数据库 Gate，也不构成 R04 的完整前置闭合 |
| CORE:TP03 | NOT_ASSESSED | 组件 `--verify` exit 1：`TP03 functional inputs changed`；严格准入拒绝 | 历史组件与当前输入 7 项变化、4 项新增；冻结 fbb5775e 的 READY 仅属历史 |
| CORE:TP04 | NOT_ASSESSED | 组件 `--verify` exit 1：`TP04 functional inputs changed`；严格准入拒绝 | 历史组件与当前输入 14 项变化、5 项新增；另有完整 Python 计数校验缺陷 |
| CORE-GATE:F0 | NOT_ASSESSED | `provider-a1-receipts.mjs --f0` exit 1：`dependency is not READY` | 冻结 8fbedfe8 的共同输入 17 项变化、10 项新增；原历史正式 7/7 ACCEPTED 保留原 SHA，不作为当前 DEVELOPMENT |
| CORE:R04 | NOT_ASSESSED | 四个直接依赖中三项未准入；A1 collector 无 R04 policy 节点 | 仅预检完成，尚无 R04 专用内容绑定验收程序/manifest 入口；不能借用 R03_LOCAL 放行 |

19 节点闭包已列入 manifest；本轮对其中相关接口和 fixture 做检查，**没有完整执行 19 节点全部验收**。全图仍为 **1 READY / 158 NOT_ASSESSED / 0 BLOCKED**；准入拒绝事实不等于擅自将机器字段改为 BLOCKED。

## 活动问题及下一步

| ID | 问题 | 本轮处置 | 下一步 |
|---|---|---|---|
| R04-P01 | TP03/TP04/F0 当前回执不闭合 | 保留所有历史回执，列出逐文件漂移；修正计划中 TP03 历史 READY 与当前状态混写 | 选择适用开发范围并在冻结源码完整复评必要闭包；任何扩大本地投影的策略须显式登记，不能直接复用 R03 专属授权 |
| R04-P02 | TP04 `checks.python.marker` 写死 `/1002 passed/`，当前实际 `1366 passed` | 记录 `matches=false`；没有改写校验器或通过改日志伪造回执 | 按现有 TP03/TP02 做法修复：真实完整命令、最低基线、零失败、输出内容绑定及负向验证；提交后复评 |
| R04-P03 | Runtime 公共 schema 校验覆盖弱于 wire/fixture 校验 | 纯 Rust 入口负向探针，保留结果；本轮不修改产品源码 | 补齐输入版本、enum/decimal、metadata/provenance、反方观点与期限语义的一致验证及负向测试 |
| R04-P04 | R04 验收入口与完整消费闭环尚缺证据 | 新增预检证据而不发布 feature Gate | 实现 R04 专用 validator/receipt，覆盖 R03 输入到 Signal/Proposal、到期边界及无订单调用的独立计数/审计；持久/部署部分按获准阶段取目标证据 |

下一可执行任务：**先修复 TP04 完整 Python 套件回执计数校验并补负向测试，再在新冻结提交复评 TP03/TP04/F0 的适用前置；R04 产品缺口与专用验收入口在准入范围明确后实施。** 本轮没有因 Supabase 只读请求付费升级，也没有将已有 R03 发布延期自动扩展到其他节点。

后续修改 Runtime、Engine 或 `scripts/` 会影响已绑定的 R03_LOCAL 功能输入；届时必须重新核验并刷新受影响回执，不能沿用本轮 R03 验证结果。完整变更清单见[changed-files.txt](./evidence/r04-preflight-20261012/changed-files.txt)，文档与补充探针完整性检查见[最终校验](./evidence/r04-preflight-20261012/final-verification.json)。

## 命令与结果

全部命令数组、执行时间和原始日志见执行索引。摘要如下：

| 命令 | 结果 |
|---|---|
| `engines/.venv/bin/python -m pytest engines/tests -q` | 1366 passed，exit 0 |
| `cargo test --locked --offline -p quantos-runtime --test signal_proposal_orchestration -- --nocapture` | 3 passed，0 failed；100 个集成 fixture，exit 0 |
| `node scripts/tp03-signal-schema.mjs`、`node scripts/tp04-proposal-schema.mjs` | 各 100 条 schema/回放 PASS；各 4 个原有 schema 破坏探针拒绝 |
| `node --test scripts/tp03-functional-artifacts.test.mjs scripts/tp04-functional-artifacts.test.mjs` | 49 passed，0 failed |
| `make r03-admission-check` | PASS，exit 0 |
| TP03/TP04 `check-development.mjs --verify`；`node scripts/provider-a1-receipts.mjs --f0` | 三项 exit 1，均为已核对具体原因的 EXPECTED_REJECTION，不记作功能验收 PASS |
| `bash scripts/check-lockfiles.sh`、`node scripts/check-development-plans.mjs` | PASS，exit 0 |
| `node scripts/r1-process-cleanup.cjs <本轮输出>` | PASS；本轮 scope 新增残留进程 0，remaining=[] |
| `node docs/audit/evidence/r04-preflight-20261012/preflight.mjs --verify docs/audit/evidence/r04-preflight-20261012/attempt-02` | 内容绑定证据校验 PASS；不是 R04 admission |
| 独立 Rust 公共校验器探针（驱动内记录 Cargo/rustc 命令） | 执行 exit 0；需求结果 GAPS_FOUND，7 个非法输入被接受、2 个拒绝 |

重跑完整预检需使用新的目录，避免覆盖证据：

```sh
node docs/audit/evidence/r04-preflight-20261012/preflight.mjs --run docs/audit/evidence/r04-preflight-20261012/attempt-03
python3 docs/audit/evidence/r04-preflight-20261012/probe-runtime-contract.py docs/audit/evidence/r04-preflight-20261012/runtime-contract-attempt-03
```

预检程序剔除数据库/Supabase 测试变量与敏感环境键；本地 UDS 和进程核验需允许相应本机执行。独立 Rust 驱动从 Cargo 实际输出获取库与原生链接路径，二进制位于临时目录并自动清理。

## 失败尝试与范围边界

- [首次预检失败](./evidence/r04-preflight-20261012/attempt-01/failure.json)：12 个命令均取得预期退出码，但新增汇总探针将 matrix row 当作 output，出现 TypeError，未产生有效验收 manifest。原脚本与全部日志保留；修正后 attempt-02 从同一产品源码完整重跑，不拼接第一次结果。
- [首次独立 Rust 探针编译失败](./evidence/r04-preflight-20261012/runtime-contract/failure.json)：直接 rustc 未携带 Cargo 输出的 OpenSSL 原生搜索路径，链接失败，探针未执行；保留编译日志，后续驱动补齐路径重新执行。
- R02 的 32 条来源事实授权、退役 pending=0、Supabase 容量状态均按原证据保留，**本轮未重新观测或消费**。本轮使用合成/受控 fixture 不恢复数据授权、不代表目标数据库通过。
- R03 原确认文稿仍按原流程处理；本轮未提交用户验收确认、未自行批准，未取得 release/production 权限。
