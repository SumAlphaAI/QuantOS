# X05 本地功能验收记录

2026-10-17。**X05_LOCAL / DEVELOPMENT READY，engineeringStatus=PASS，formalAccepted=false**。源码`4f527da80861bb1421c621a520ae1fb5a56917ff`的15组当前功能/直接影响检查全部PASS；两份计划同步，X05开发状态IMPLEMENTED_PENDING_ACCEPTANCE。仅QuantOS；未连接目标DB、建立本地PostgreSQL/Supabase、使用生产凭据、推送或外部发布。完整业务联调、实际持续窗口及28组目标NOT_RUN，项目用户确认PENDING。

## 实现与验收

| 要求 | 实现与当前证据 |
| --- | --- |
| Shadow无下单 | 新`shadow::ShadowRunner`只持有专用Shadow RiskGuard、scope及虚拟状态；无issuer/execution/venue/网络/DB句柄，非执行建议和虚拟Fill命名空间。源码边界、编译期无submit方法、真实worker拒绝submit共同验证无路径；不靠硬编码0计数器作证明。 |
| 当前风险及原子虚拟记账 | 当前Shadow身份/capability/角色/tenant/workspace/account校验；建议使用当前X01/S03/财务/venue风险；虚拟成交在X02锁内重验Allow/来源/策略/kill/有效期，幂等重放也复核。32并发虚拟同key仅1事件，超量、改payload、旧行情/失效/kill拒绝无重复账务。 |
| 虚拟账本 | 明确flat或已验证X01 seed/现金；18位Decimal和银行家舍入，多空反转、费用、现金、已实现/未实现PnL、按mark的gross exposure。独立手算黄金例通过；新行情重估已有仓位，不能拿旧建议生成新成交。 |
| 订单/成交/仓位/账本对账 | 双路ID并集、完整字段与独立内部从seed/Fill重建。相同非法状态、无seed/Fill来源的额外仓位和两路同样错误也不能判绿；重复/孤立/错Command/负费用/未来/跨scope/过大容差等拒绝，不记零差异。 |
| X03/X04/X01只读消费 | 测试使用真实X03签发的已知Command拼装合成X04事实并由实际replay/anchor验证；实际X01模块重建并验证快照。没有任何Kernel调用。scope/现金/anchor来源真实性仍由可信后端负责，未冒充完整部署业务联调。 |
| 20类差异 | 订单5、成交5、仓位5、账本5类均检测/实体定位，保留expected/actual、两路source_ref、输入/报告hash、observable/detected时刻与SLA结果。20类受控注入均在600秒检出；真实本机worker也定位20类。延迟901秒明确记录breach，不将合成时钟结果当目标SLA。 |
| 异常闭环 | 稳定scope/day/kind/entity ID，run幂等、source revision单调/同版本内容绑定和同日source pair固定；CAS ack后必须同日同源最新、重新抓取、版本推进且原实体差异消失的充分新鲜报告+非空说明才能关闭。关闭时再次检查mark新鲜度，删掉双方实体/换来源/旧报告/仍有差异均不能关闭。 |
| 日结、复发、恢复 | 最新报告零差异且该日异常全部关闭才可日结；复发reopen并撤销日结。追加actor/action/时间/hash journal独立anchor，恢复时重算报告及CAS/关闭规则，保留去重；篡改、截尾、换scope及重新hash的非法关闭均拒绝。16并发同run/ack唯一。 |
| 受控持续样例 | 10个受控UTC工作日逐日日结未解释差异0；历史legacy fixture单列兼容结果。没有实际行情持续10个交易日，目标仍NOT_RUN。 |

[操作规程](../operations/x05-local-admission.md)、[ADR/20类映射](../adr/20261017-x05-shadow-reconciliation.md)及组件README已同步。旧root/legacy浮点接口保持合成兼容，原fixture源码逐字保留；新可信路径位于model/shadow/reconciliation/exceptions。未新增BFF/HTTP或生产执行入口。

## 测试与输入

[15组原始结果](./evidence/x05-local-20261017/function-attempt-01/execution-results.json)、[输入清单](./evidence/x05-local-20261017/function-attempt-01/inputs.json)、[Gate manifest](./evidence/x05-local-20261017/manifest.json)及[摘要](./evidence/x05-local-20261017/summary.json)。每组记录实际影响理由、原命令、时刻、预算、退出码/信号/错误/超时及日志hash。Gate逐项核对源码Git blob、当前输入、正常退出、20类/原生/无submit/编译拒绝证明和覆盖率，事务发布失败会回滚计划与manifest。

**Rust24 PASS / 0 FAIL / 0 ignored**（X05流程16、只读来源/黄金样例2、真实worker2、legacy兼容3、编译拒绝1；不重复计算coverage运行）；**Node125 PASS**（专用Gate81、计划负向44）。必要compile、Clippy零warning、fmt、源码无submit边界、计划和交接规则全部通过。没有X01–X04运行时代码改动，不重跑X04的100000事件、X03/TP07全套或整条依赖闭包；没有全仓或三轮独立构建。

五个新生产文件覆盖率要求分别为行≥90%/region≥85%；原始LLVM数据/回执见[coverage](./evidence/x05-local-20261017/function-attempt-01/coverage/receipt.json)：

| 文件 | 行 | Region |
| --- | --- | --- |
| model.rs | 96.56% | 89.04% |
| shadow.rs | 96.65% | 88.94% |
| reconciliation.rs | 95.75% | 92.80% |
| exceptions.rs | 97.04% | 94.95% |
| quantos-reconcile.rs | 96.30% | 91.53% |

这只是五个新文件的LLVM指标，不宣称全仓/目标/独立分支覆盖。子进程测试只传LLVM_PROFILE_FILE用于native采集，产品worker不加载环境凭据或配置，也不把本机进程隔离当OS沙箱。

## 失败、历史与版本

[预验诊断](./evidence/x05-local-20261017/preflight/index.json)保留首轮编译失败（JoinHandle在filter借用中被消费），修复为拥有式join/map并清理unused imports。审查另补强新行情重估/旧建议拒绝、相同非法状态/phantom仓位、关闭动作时的mark新鲜度、日来源绑定和可恢复journal容量限制；原范围回归验证。预验发生在未冻结工作树，只作为诊断保留，不改绑为本轮正式PASS。唯一正式function-attempt-01正常完成；未降低覆盖率或把失败/中断记PASS。

X04运行时代码和全部原始证据保留。因Cargo.lock/Makefile/共享门禁输入变化，其当前独立READY撤回NOT_ASSESSED，见[撤回记录](./evidence/x05-local-20261017/x04-admission-withdrawal.json)。本轮只读消费者回归只属于X05，不将旧READY拼接为新候选，也不授予X01–X04/S2上游READY。既有audit/gate文件保全见[历史核对](./evidence/x05-local-20261017/post/history-preservation.json)。

后续文档/证据提交只登记该固定源码，不声称新HEAD整体重新通过运行时测试；只执行相应元数据检查。完整[变更文件索引](./evidence/x05-local-20261017/changed-files.json)、[收尾结果](./evidence/x05-local-20261017/post/checks.json)与Git记录可核对。

## 未决、Gate与下一步

来源身份、现金、行情许可/质量、scope和anchor必须由可信后端核验；离线worker明确标CALLER_PROVIDED，输出不能作为真实源或人工关闭权限。Mark.sequence需归一化为QuantOS观察游标，不直接混用provider序号。当前按UTC工作日标签验证，未实现交易所日历和真实feed订阅/调度；10受控工作日不是10个实际交易日。风险估值沿用X02已声明模型，虚拟账本不支持隐式FX/入出金/公司行动/衍生品保证金，不授予实际交易权限。

Shadow状态仍是进程内；异常journal支持显式导出/恢复，不能替代Supabase/RLS持久事务、跨实例CAS/单写者、自动调度或崩溃原子归档。独立可信anchor保证完整性，不证明历史操作者身份；日志和anchor同时伪造不在本地保证内。最多10000动作/8MiB journal，达到容量在提交前拒绝，应归档后进入新窗口，不静默丢弃。不自动修复账务或用文字豁免未消失的差异。

真实获准行情/身份/时钟、连续10个实际交易日、日终零未解释差异、实际20类≤15分钟与无venue submit部署证明、持久账本/异常/CAS/审计/anchor和跨实例恢复、完整Paper/Shadow业务链、法律/供应链/OS隔离/安全/负载/性能/长稳及同SHA hosted CI等28组目标全部NOT_RUN。真实Nautilus仍未运行/未放行；本轮没有重新评估其法律或供应链。

仅X05功能DEVELOPMENT READY；CORE-GATE:X3-SERVICE仍NOT_ASSESSED，完整INTEGRATION和RELEASE-GATE:BETA未放行，formalAccepted=false。发布/目标拒绝检查是预期拒绝，不算目标实测。[七维项目用户确认稿](./evidence/x05-local-20261017/confirmation-draft.md)为PENDING，Codex不自行批准。

下一可执行：**SERVICE:X06：执行/审计/运维服务功能检查点**，完成授权查询与受控操作、订单/成交/仓位证据链、告警/健康/incident、禁止改账/任意Runbook、职责分离及幂等恢复的当前功能范围。完整页面/BFF消费者归CORE:X06及G4/G5/G6联调；TP12完整复审仍待TP07完整业务联调，不能以X05局部READY替代其前提。
