# R04 本地开发完成记录（2026-10-12）

状态：DEVELOPMENT READY（R04_LOCAL）。冻结源码 `54aeff32d0903a6dcd94994aaedfaef80fd87baa` 从干净提交完整执行 17 节点/56 组本地前置、R03 七组及 R04 四组，全部 PASS。F0、TP03、TP04、R03、R04 的限定本地 Gate READY；全图 5 READY / 154 NOT_ASSESSED / 0 BLOCKED。正式确认待办，formalAccepted=false；RELEASE-GATE:BETA 未验收。

## 实现与消费范围

七类公共输入缺口分别为 Signal 方向、强度/置信度小数、模型溯源、metadata，以及 Proposal 动作、显式 counter_views、失效时间下界。固定小数按数字精确比较，拒绝 NaN/Infinity、指数、符号、空白及越过 1 的精度边界；同时拒绝畸形嵌套 Signal、空证据、非法 quantity/notional 和 executable=true。

研究请求只携带版本化 ResearchInputRef（source run、Artifact ID、content hash、消费 expires_at）。Runtime 在排队前与执行前按认证会话读取 R03 仓库和运行账本，验证成功状态、能力授权、租户/工作区/Actor、源 Artifact 绑定、快照/策略、内容哈希/字节数和证据。验证后的摘要/发现/证据进入真实本地 LLMQuant Signal，再进入 TradingAgents Proposal；源证据同时进入两者公共 evidence_refs。消费期限只限制本次请求，不延长数据授权。

本轮消费仓库为 InMemoryResearchArtifactRepository，输入为自有合成数据。目标持久消费仓库、Supabase 私有 Artifact 读回与实际 BFF/页面链仍需补齐接入及目标验收；本地结果不证明这些能力已集成。未消费已退役的 32 条来源事实，未新采集数据，不给出新的 pending=0 或目标库可写结论。

## 新冻结提交复验

| 命令/组别 | 实际结果 |
|---|---|
| PATH 固定 pnpm 10.20.0，node scripts/r04-record-development.mjs docs/audit/evidence/r04-completion-20261012/attempt-05 | 17 节点 / 56 前置 + R03 7 + R04 4 全部 PASS；同一冻结源码，未拼接旧结果 |
| 前置内 make lint / make test | PASS；完整 Python 1382 项；Rust/Web 命令实际完成，Rust 保留 2 个既有 ignored 目标/辅助用例 |
| cargo test -p quantos-runtime --locked --test signal_proposal_contracts | 11 PASS |
| cargo test -p quantos-runtime --locked --test signal_proposal_orchestration | 4 PASS：100 Proposal、到期拒绝、重放、实际 order.execute 拒绝及 R03 消费；22 类无效引用/篡改拒绝 |
| engines/.venv/bin/python -m pytest engines/tests/test_r04_research_context.py -q | 16 PASS |
| 专用回执/执行结果/编排场景负向 | 35 PASS |
| node docs/audit/evidence/r04-completion-20261012/run-final-checks.mjs | 14 组预期结果全部满足；综合负向 273 PASS；计划/移交/diff/三组证据密钥扫描通过 |
| make f0-local-check tp03-local-check tp04-local-check r03-admission-check r04-admission-check r04-gate-check | 全部 PASS |
| make local-release-check / r03-release-check / r04-release-check | 均按预期拒绝（exit 2）；严格 F0/TP03/TP04 同样拒绝本地证据冒充完整目标准入 |

完整 make test 中两个既有 ignored 分别为 Supabase F09 目标测试与 PostgreSQL 恢复子进程辅助入口；其他需目标配置的用例未连接数据库，均不作为目标验收。R04 专用四场景全部执行、无 ignored。

专用 quantos-r04-development/v1 回执绑定候选 SHA、源码清单、规范任务范围、四个前置摘要、真实命令/日志、100 产物矩阵、R03 消费产物、订单拒绝和进程清理。r04-admission-check 只验证前置；r04-gate-check 验证完成回执。完整命令、退出码和哈希见[最终检查](./evidence/r04-completion-20261012/final-checks.json)、[汇总](./evidence/r04-completion-20261012/summary.json)及[文件清单](./evidence/r04-completion-20261012/changed-files.txt)。

## 保留的失败证据

| 尝试 | 事实与处置 |
|---|---|
| 初始公共入口与调试 red | 首次 11 组 2 PASS / 9 FAIL；研究链清单、物理去重断言、回执测试和 Clippy 调试日志均原样保存于[red 索引](./evidence/r04-completion-20261012/red/index.json)。 |
| attempt-01，e793cce3 | 证据目录未符合批准根目录，0 组执行；修正路径映射，保留[失败封装](./evidence/r04-completion-20261012/failed-attempt-01/failure.json)。 |
| attempt-02，d475a61c | 56 组 50 PASS / 6 FAIL：完整测试 15 分钟中断、编排仍按旧 3 场景误判、Python 格式及级联回执失败；[日志和实际产物](./evidence/r04-completion-20261012/failed-attempt-02/failure.json)未覆盖。 |
| attempt-03，307567de | 首组三次构建实际 PASS，但执行结果封装拒绝既有 90 分钟预算，0 个有效完成回执；[原始构建与失败日志](./evidence/r04-completion-20261012/failed-attempt-03/failure.json)保留。 |
| attempt-04，3b0cbfaa | 56/56 命令 PASS，但发布器先改写 F0 canonical、递归校验读到旧计划摘要而失败；R03/R04 尚未执行。[中间字节及失败日志](./evidence/r04-completion-20261012/failed-attempt-04/failure.json)保留。 |
| attempt-05，54aeff32 | 修正发布顺序和失败回滚，并撤销遗漏的旧 F0 READY；从新干净提交重新完整执行全部检查通过后，才发布本地 Gate。 |

发布器先验证全部新回执，再写入匹配的 canonical 与计划；写入或发布后校验失败会恢复原字节。四项新增回归覆盖既有 READY 替换、后续校验失败零写入、写入失败回滚与发布后失败回滚，修复前的实际失败及修复后 149 项相关回归证据保留。R03 同样在替换 manifest 前捕获任务记录，避免旧摘要递归读取。

runner 现在保存 timeout/errorCode/signal，异常退出不能记作 PASS；完整 make test 的 30 分钟预算为本机执行时限，不作为产品性能验收。共享编排回执要求四个命名场景全部成功，允许套件增长但拒绝缺场景、缩减、失败及 ignored。原 7/9 缺口探针、Supabase Auth500/只读与调度失败保留在历史证据中；旧 canonical 回执在覆盖前按冻结 SHA 归档。

## 未决项与下一步

13 组 Supabase 前置及持久 Signal/Proposal、私有 Storage、RLS/事务、独立进程恢复、实际 BFF/页面、外部上游与代表性性能/容量/长稳、同 SHA CI 均为 NOT_RUN，继续由测试/RELEASE-GATE:BETA 首次上线前实际验收。现有目标环境故障未在本轮复验解决；未升级订阅、未使用生产凭据、未推送或外部发布。

[R04 项目用户确认稿](../gate-records/R04-development-user-confirmation-draft-2026-10-12.md)为 PENDING_USER_CONFIRMATION，不能自行批准或转为 ACCEPTED。下一可执行工作为 R1-SERVICE 缺项盘点及 TP01-C 本地接口/fixture/前置预检；本轮不自动放行 R1-SERVICE 或 S01。

Git 链：e793cce3（实现与 red）、d475a61c（路径修复）、307567de（回执/时限/格式修复及完整失败）、3b0cbfaa（预算兼容及发布失败）、54aeff32（发布顺序/回滚修复，最终冻结源码）。之后仅提交 docs 证据及报告；新证据提交不冒充源码候选或正式同 SHA CI。
