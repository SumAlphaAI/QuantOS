> TP05本轮新增功能输入后，本报告保留原冻结源码的历史结论；当前准入以[TP05报告](./TP05-development-2026-10-10.md)及计划Gate为准，历史READY不自动转移。

# TP04 TradingAgents 开发验收

日期：2026-10-10。依据核心计划 TP04；范围 R1 DEVELOPMENT，必要前置 F08、TP03、F0。

## 当前结论

**TP04 DEVELOPMENT READY**。冻结源码 `e27d5dab2e12e64ade9272a724d02f68024954c5` 的必要14节点/56唯一命令组全部实际PASS，严格递归内容校验通过；当前14 READY、145 NOT_ASSESSED、0 BLOCKED，formalAccepted=false。TP03/F08/F0等前置在本轮源码重评；TP02、TP01-C/D、R01/R02维持NOT_ASSESSED。R1-SERVICE整体、正式 ACCEPTED、hosted CI、发布均未授予。只允许配置的开发 Supabase，未建立本地数据库，未使用生产凭据或执行外部发布。

## 实现范围

- `decision.proposal.v1` 五 RPC；100 组实际 UDS Proposal schema 与 Execute/Stream 各两次重放。
- Proposal 必带 `counter_views`、证据、失效时间和 `executable=false`；有效期基于输入 Signal generation 并受其 valid_until 和 fixture TTL 双重约束。
- Signal tenant/workspace/Research、版本、digest、有限 confidence/strength、证据和时间窗口；policy/portfolio 引用与权威 Engine envelope 一致。Runtime proposal dispatch 使用 portfolio 引用，policy 保持工作流权威；不将 payload 自动回填成权限。
- 递归拒绝订单、交易所、凭据、网络、权限覆盖和未批准工具。order/secret 拒绝有机器码和 scope hash 审计，不记录原始 payload。
- 两份 committee/policy Artifact 完整 JSON 字节 hash、原子不可变写入、租户/工作区/actor 读隔离；使用 mock URI，无伪造 Supabase 上传。
- 按 owner 隔离 Cancel，执行身份冲突、command/transport deadline、每次流 delta 前取消检查、最终 Artifact 写入与 Cancel 同锁。
- 离线 wheel 新 venv、独立 `-I` 子进程五 RPC 和 <2s 取消/回收；本地实际 UDS 取消回执到 Research UI 状态处理器的响应桥接，无已部署 HTTP/browser E2E 声明。

外部 TradingAgents 已锁定参考 repo/tag/commit，但 baseline 为 descriptor-only、CVE 待 resolved lock 审计、productionApproved=false；本轮不变更或加载该 upstream。本地代码是 QuantOS 自有确定性 fixture adapter，不代表真实多 Agent 推理、模型质量或工具执行。policy/portfolio/release/Signal 引用仅验证范围与字段，未解析可信 bytes；风险评估与 live freshness 由消费者单独验收。Artifact/audit 与执行状态仅内存，OS 出站隔离未验证。

## 检查命令

```sh
node engines/trading-agents/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp04 docs/audit/evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02
node engines/trading-agents/check-development.mjs --admit
node engines/trading-agents/check-development.mjs --ready
node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-functional-artifacts.test.mjs scripts/tp02-functional-artifacts.test.mjs scripts/tp03-functional-artifacts.test.mjs scripts/tp04-functional-artifacts.test.mjs
pnpm test:development-plans
pnpm test:p0
make test
```

组件12组：TP04 310、全Python1002、Manager2、Runtime3、100实际schema/4破坏、UI3项无skip、wheel进程、Ruff/format/Pyright、锁和intake。12组全部PASS；见[组件回执](./evidence/tp04-20261010/receipt.json)。全量 `make test` 为Rust330、Python1002、Web227通过；Rust2项默认ignored、Web2项默认桥接skip不计目标验收，TP03/TP04专项桥接各3/3无skip。

[56组实际执行台账](./evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02/execution-results.json)、[TP04严格manifest](./evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02/core-tp04.json)、[TP03](./evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02/core-tp03.json)、[F08](./evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02/core-f08.json)、[F0](./evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-02/core-gate-f0.json)绑定冻结源码、命令、日志、wheel、实际输出和递归依赖。

F01三轮独立构建及全量lint/test通过；F02/F05数据库与Storage/RLS、F06真实Auth/BFF/Runtime/执行权限/Vault与8项数据库测试、F07恢复、F08服务/覆盖、F09真实cron/故障/容量/trace等均本轮实际执行，fixture清理记录保留。只连接已有开发Supabase。

实际独立wheel进程取消 **12.68ms**；实际UDS/UI响应桥接取消 **12.66ms**，Artifact delta=0，均低于2秒，仅代表当前开发环境。固定fixture的20样本延迟测试不代表部署P95或长期负载。

聚焦回执132/132、计划负向38/38、P0策略16/16、[9项最终严格回执破坏探针](./evidence/tp04-20261010/final-gate-probes.json)与[最终检查](./evidence/tp04-20261010/final-checks.json)通过。[全量统计](./evidence/tp04-20261010/full-test-summary.json)、[Git证据字节追踪](./evidence/tp04-20261010/git-evidence-tracking.json)保留；提交后再次核对所有被引用证据的Git字节。后续只更新文档与证据，功能输入保持冻结e27d5dab。本轮未推送，候选hosted CI未执行。

F05本轮事件/receipt/派发/唯一副作用各10,000，checkpoint=10001，消费324461ms、event-ID-client-retrieval诊断4920.98ms；该诊断不代表完整载荷链或代表性P95。

F07本轮100任务恢复完成、唯一Artifact绑定100；调度P95诊断 **1453.13ms**，目标200ms。恢复正确性PASS不授予性能PASS。

## 原始失败与修复

首轮复用生命周期时残留 `mapped.signal_payload`，4失败/3通过；已修正为 Proposal，保留[原始日志](./evidence/tp04-20261010/initial/mapper-name.log)。下一轮 2失败/253通过：空 Signal 被错误归为 scope 拒绝；已在解析前判空并返回 INVALID_ARGUMENT，保留[原始日志](./evidence/tp04-20261010/initial/development-01.log)。随后296项通过，再新增typed data-query与digest边界，最终310项单独记录。Pyright发现终止helper缺少NoReturn及可空错误details，已修正，0 errors。

额外全仓format探针发现20个既有未格式化文件，均不在本轮修改范围；专项10文件format通过，未为TP04扩散格式变更。[原始结果](./evidence/tp04-20261010/initial/global-format-baseline.log)保留。全仓Ruff check与Pyright均通过。`make test`属于静态/本地合约检查，缺连接提前返回及默认ignored用例不算数据库验收；数据库结论只采本轮目标执行回执。

复核发现committee/policy两份不同字节Artifact共用mock URI后，补充100组唯一URI断言、独立wheel断言及URI碰撞证据破坏测试，URI改为包含Artifact种类和digest。旧冻结16994064仅完成F01三轮构建、F06和F09目标检查；在目标检查结束后停止自有旧复评进程，未发布READY。[中断范围](./evidence/tp04-20261010/initial/interrupted-admission-01/scope.json)、[原始URI回归](./evidence/tp04-20261010/initial/interrupted-admission-01/uri-regression.log)、[进程清理](./evidence/tp04-20261010/initial/interrupted-admission-01/process-cleanup.json)及目标原始回执保留，修复后已重新冻结e27d5dab，完整56组重新执行通过。

## 风险与下一任务

真实 upstream 运行时/依赖审计、实际 Agent/模型质量、可信快照解析、持久Artifact/audit、OS出站隔离、部署身份与HTTP/UI链、代表性P95/长稳和生产取消时限均待验；F05/F07性能风险不随开发正确性解除。下一可执行任务：TP05（F05/F08/F0前置当前严格READY，保持许可证隔离/用途Gate）。R04仍需R03自身当前准入。

## 变更文件

主要代码 `engines/trading-agents/src/trading_agents/{adapter,artifacts,fixtures,proposal_mapper,service}.py`、Runtime proposal envelope、Python/Rust/UI测试、组件/wheel/schema/UI验证、统一回执策略及核心/前端计划、README/操作进度。完整清单见[changed-files.txt](./evidence/tp04-20261010/changed-files.txt)。

严格准入14节点：CORE:F01/F03/F04/F05/F06/F07/F08/F02/F09、CORE:TP01-A、CORE:TP01-B、CORE-GATE:F0、CORE:TP03、CORE:TP04。源码提交e27d5dab，最终证据提交见Git历史；均仅本地。
