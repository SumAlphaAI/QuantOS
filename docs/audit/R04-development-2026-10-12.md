# R04 本地开发完成记录（2026-10-12）

状态：源码实现已准备，当前需从新的干净冻结提交完整执行前置闭包及专用R04 Gate。此段将由实际运行结论更新，不继承旧候选回执。

范围为 R04_LOCAL：公共 Signal/Proposal 校验器；版本化 R03 仓库引用消费；真实本地 RD-Agent、LLMQuant、TradingAgents 合成 Engine 链；100 Proposal、过期等值拒绝、重放、订单工具拒绝；专用完成回执。内存服务和自有合成输入不证明目标数据库或上线可用。

研究请求只携带 `ResearchInputRef`（v1、source run、Artifact ID、content hash、消费 expires_at）。Runtime 在排队前及执行前按已认证会话读取 R03 仓库与运行账本，检查成功状态、来源能力授权、租户/工作区/Actor、源运行Artifact绑定、快照/策略、内容哈希/字节数与证据。验证后的研究摘要/发现/证据随Engine输入传播到Signal diagnostics，并完整进入Proposal内嵌Signal，源证据亦进入两者公共evidence_refs。消费expires_at只限制本次请求，不能延长数据授权。

公共解析器拒绝非法方向/动作、非有限或越界小数、缺失模型溯源、缺失或畸形metadata、缺失显式counter_views、Proposal早于或等于生成时间/超出Signal有效期、空或不可定位证据、executable=true。Decimal使用无符号固定小数，按数字精确比较，避免浮点舍入越过1。

专用 `quantos-r04-development/v1` 回执绑定候选SHA、源码清单、规范任务范围、四个前置摘要、四组真实命令和日志、100产物矩阵、R03消费产物、订单拒绝及进程清理。`make r04-admission-check`只证明前置；`make r04-gate-check`验证完成回执。`make r04-record-development`必须从干净提交执行完整闭包，不拼接失败尝试中的PASS。

失败证据在 [red](./evidence/r04-completion-20261012/red/)：首次公共入口回归11组中2 PASS/9 FAIL；修复后冻结前11/11与四项Runtime集成、16项Python边界、81项相关回执/阶段负向及Clippy通过；研究链测试清单不匹配、重放物理去重计数断言及回执测试/Clippy调试失败均原样保留。原7/9缺口探针、Supabase Auth500/只读及调度失败保留在历史报告和证据目录。

目标环境、Supabase持久Signal/Proposal/私有Storage读回、RLS/事务/独立进程恢复、实际BFF及页面、外部上游集成、性能/容量/长稳和同SHA CI继续移交RELEASE-GATE:BETA，全部NOT_RUN。正式项目用户验收独立，formalAccepted=false。未升级订阅，未使用生产凭据，未发布或推送。
