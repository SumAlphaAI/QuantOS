# X04 本地功能验收记录

2026-10-17。**X04_LOCAL / DEVELOPMENT READY，engineeringStatus=PASS，formalAccepted=false**。源码`0e93b885aa433accf3da426f5f22b9d44999f7f4`的16组当前功能/直接影响检查全部PASS；计划状态IMPLEMENTED_PENDING_ACCEPTANCE。仅QuantOS；未连接目标数据库、创建本地PostgreSQL/Supabase、使用生产凭据、推送或外部发布。完整业务联调、27组发布目标NOT_RUN，项目用户确认PENDING。

## 实现与证据

| 要求 | 当前实现和验证 |
| --- | --- |
| 可信提交/取消 | 原X03当前风险/Consumed审批/签名原子消费不变；取消复核当前身份权限、tenant/workspace/account、原requester、精确已存Command和consumer claim。Command过期或kill允许减少风险的已有订单控制，submit仍拒绝；1000并发submit单次下游、取消同键1000重放单调用。 |
| Paper/内核边界 | 自有Paper即时成交与挂单模式；真实本机子进程可提交/取消，终态拒绝保留原因；严格64KiB JSON行/固定启动参数/清空环境/0700 cwd/最多1秒IO预算。Nautilus仅自有wire/outbox映射，未安装或执行上游。 |
| 状态机 | ack/fill/reject/cancel/expiry映射；Decimal部分成交、加权均价、非负费用、超量/未知Command/venue关联/乱序/冲突及非法终态拒绝。GTD控制时补记Expired，再拒绝终态取消。 |
| append-only事实 | 提交意图与取消请求在IO前追加；kernel事件整批通过后提交订单/Fill和事实，失败保留旧前缀并隔离。连续序号/domain哈希链/前哈希及外部anchor支持全链重放，发现改写、乱序、缺行和截尾；重放再验业务约束。 |
| Fill溯源 | 每条Fill直接含command_id/order_id及venue_fill_id；通过已存Command关联原签名/决策。公开schema仍可Fill→Order→Command关联，没有冒充已发布新HTTP/客户端契约。 |
| 100000事件 | 20000订单，每单5条混合kernel事件：ACK、两条partial及最终fill/cancel/expiry和cancel rejection；100000合法/0非法，46667 Fill全部可追溯，26667取消审计、146667追加事实按anchor重放完全一致。另验submission reject及非法转换/批次回滚；不是目标性能验收。 |
| 取消不确定 | 稳定关联ID、request/completion时间、微秒延迟、outcome/reason；超时、崩溃、缺回包/结果和错误关联记Uncertain，原请求与不确定事实保留。相同键或换新键均不自动重投；九类真实进程传输故障和原claim隔离通过。 |

操作入口与状态/信任边界见[规程](../operations/x04-local-admission.md)、[ADR](../adr/20261017-x04-paper-oms-facts.md)和两个组件README。旧浮点paper fixture非法成交先修改再拒绝的错误已修复，并验证NaN、负费用和跨订单事件均完整回滚；其接口不授予执行权限。

## 测试与范围

[16组原始执行结果](./evidence/x04-local-20261017/function-attempt-01/execution-results.json)、[精确输入](./evidence/x04-local-20261017/function-attempt-01/inputs.json)、[Gate manifest](./evidence/x04-local-20261017/manifest.json)和[机器摘要](./evidence/x04-local-20261017/summary.json)记录命令、影响理由、源码、时间、正常退出、信号/错误/超时与日志摘要。全部PASS，无递归上游、全仓或三轮独立构建；本地编译依赖的输入哈希不等于重新验收依赖。Gate逐项核对输入确实存在于固定Git提交，并拒绝日志缺失、证据替换、假绿100000声明、历史TP07回执、覆盖率不足及联调/发布权限提升。

非coverage重复计数：**Rust 88 PASS / 0 FAIL / 1 ignored**，包括X04 OMS 9、真实进程3、TP07消费8/进程4、相关包兼容56和X03签发8。ignored是既有发布性能用例。**Node 126 PASS**（X04 Gate 82、计划负向44）；必要compile、Clippy零warning、fmt、两份计划/交接和固定上游排除检查通过。RiskGuard源码未改，现有X03/TP07直接回归覆盖其当前消费边界，不重跑无关X02或更早全闭包。

覆盖率按变更的六个文件分别要求行≥90%/region≥85%，原始LLVM数据与回执见[coverage](./evidence/x04-local-20261017/function-attempt-01/coverage/receipt.json)：

| 文件 | 行 | Region |
| --- | --- | --- |
| authority.rs | 96.99% | 92.21% |
| gateway.rs | 95.73% | 94.10% |
| dispatch.rs | 98.53% | 94.84% |
| process_kernel.rs | 95.20% | 93.68% |
| oms.rs | 100.00% | 100.00% |
| paper.rs | 95.02% | 94.39% |

这是LLVM文件级指标，部分文件包含编译的内嵌单元测试，不宣称全仓、独立分支或目标环境覆盖率。原生子进程产品保持env_clear；仅测试专用直接协议探针转发LLVM_PROFILE_FILE采集本机child。

## 失败、历史及版本边界

[preflight诊断](./evidence/x04-local-20261017/preflight/index.json)逐项保留：初始RunMode编译错误；首轮100000测试7PASS/1FAIL，发现跨drain批次Fill列表按哈希排序造成重放不一致，现按事实顺序生成；错误scope selector、计划状态值和Clippy问题；首次paper行覆盖89.80%低于90%门槛。修正并加入非法金额/外部订单回滚验证后重新通过，不降低门槛。大型失败日志以gzip原字节保留，索引有解压前/后哈希；未冻结preflight不充当验收PASS。唯一正式function-attempt-01正常完成，无历史READY拼接。

TP07历史manifest、日志和先前签署逐字保留，因共享输入变化撤回当前独立stage_gate为NOT_ASSESSED，见[撤回记录](./evidence/x04-local-20261017/tp07-admission-withdrawal.json)。本轮TP07和X03回归只属于X04当前影响范围；依赖条目NOT_REVALIDATED/referenceOnly，不授予上游READY。全部旧audit/gate记录保全与原始blob边界见[历史核对](./evidence/x04-local-20261017/post/history-preservation.json)。

后续README、计划与证据提交仅补充登记，未重新宣称新HEAD整体已测试。只运行对应门禁/计划/文档和增量密钥检查，不因元数据提交再发起功能或全闭包测试。完整[变更索引](./evidence/x04-local-20261017/changed-files.json)、[收尾检查](./evidence/x04-local-20261017/post/checks.json)及Git提交供核对。

## 未决、Gate与后续

事实、读模型、issuer claim和取消去重仍是进程内状态；没有Supabase强制RLS/持久事务、持久anchor和多实例单写者保证。重放不恢复执行权限或证明外部副作用；不确定结果须独立对账恢复，不能换网关重投。GTD仅在控制请求时补记，无持续实时定时器；挂单事件泵、断线补偿与部署组合仍待联调。

实际Nautilus bridge/API、LGPL分发/法律许可、完整运行时SBOM及最新CVE/可达性复审仍未执行。离线1051包/56个历史advisory ID快照不是当前漏洞清零或法律批准；Paper真实进程不是Nautilus运行证据，env_clear/私有cwd也不是完整OS文件/出网沙箱。可信部署身份/时间/来源撤权、密钥托管、实际目标10万事件与cancel延迟、完整Paper/Shadow业务链、安全/负载/性能/长稳、同SHA hosted CI等继承26组及X04新增1组目标均NOT_RUN。

仅X04功能DEVELOPMENT READY；CORE-GATE:X3-SERVICE仍NOT_ASSESSED，INTEGRATION与RELEASE-GATE:BETA NOT_RUN/NOT_ASSESSED，真实NautilusruntimeAdmission=DENIED，正式确认PENDING，formalAccepted=false。`make x04-release-check`必须拒绝缺失目标与正式确认；拒绝检查不算目标实测。[七维项目用户确认文稿](./evidence/x04-local-20261017/confirmation-draft.md)已完整拟定，按一人确认规程等待真实答复；Codex不自行批准。

下一可执行：**CORE:X05：Shadow运行、对账与异常队列**，完成当前功能范围的固定输入订单/成交/仓位/虚拟账本对账、20类差异定位、异常关闭和无venue submit验证。10个实际交易日及目标时效/性能单列NOT_RUN；TP12完整复审仍待TP07完整业务联调，不把X04功能READY替代该前提。
