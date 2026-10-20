# BFF-FE-008 本机功能准入

依据 AGENTS.md 分阶段测试。本任务只评估 C14 及实际受改动的 C15 只读来源、共享身份/F05/契约生成边界；不执行上游 Gate、全仓、三轮构建或性能闭包。A4/C15 用户原确认只绑定原源码、原文稿与原回执。

C14 发布8个接口：summary、series、attribution、report create、status、get、download grant、content。所有绩效返回完整相同版本视图，含 P&L、simple return、最大峰谷回撤、期间费用及符号归因。X01 实际 projection snapshot 通过自身 hash/范围校验，并与对应 C15 actual Book 的数量、成本、mark、已实现/未实现 P&L逐项核对。Decimal 账本计算；X01 f64 沿用核心 approx_eq 容差，输出18位不代表提升上游精度。valuationSnapshotId 是 X01 内容 hash；ledgerVersion 是对应 actual Book 内容 hash；series 保留逐点 runId 与版本，不把 expected/actual 或重跑重复计入。

仅 USD、simple。twr/mwr 与其他币种拒绝，不伪造 FX。simple=(末权益-初权益)/初权益，权益=actual现金+签名仓位市值；要求正权益、相同 seed、同 sourceRef、单调revision及原fill历史保持，遇到现金流或历史改写拒绝。fees=末累计费用-初累计费用，不重复扣期初费用；符号归因取 realized+unrealized 变化，LEDGER_RESIDUAL显式保留账本现金差，归因合计等于P&L。回撤为观测点权益至此前峰值的跌幅；采样间未观察峰谷不推断。

period=custom 显式 start/end，或 week/month/quarter/year；rolling 按 UTC 7天/日历月减法，calendar 从 UTC 周一/月/季/年首至 end。最大366天、未来/逆序拒绝。coverage同时展示请求与真实观测区间，完整覆盖要求两端吻合且间隔≤60秒；少于2点拒绝，缺区间或任一点未经对应X05日结证明/过期强制 provisional。不得把 provisional 显示成已对账。

报告创建冻结完整输入及 provisional 历史事实，202 queued；status 触发本进程待办执行，生成一次 immutable JSON artifact 后 succeeded；未完成get/download409。actor/session/key/intent精确重试返回原queued回执，不重新计算；相同键不同意图409。报告版本1，不覆盖历史，无自动supersede。内容的metadata与performance版本一致，下载返回真实JSON字节，sha256/sizeBytes绑定该字节；grant60秒，report15分钟；范围、会话、角色/能力与时效每次检查。过期返回410，撤销会话401，其他actor/session隐藏404。已下载副本保留原 asOf/frozen provisional，后续对账变更需新报告。最多1000样本/jobs/tickets，容量429；无浏览器输入账本、现金、估值或闭合证明入口。

live 保留 F06 caller，显式注入 X01/C15 两租约，无host503；create在真实适配代码内写F05事务，audit失败或commit不确定后quarantine进程租约并503，不能当作持久回滚/跨实例恢复通过。reference仅显式Shadow合成数据，真实X01/X05核心组合；新增参考样本保留既有C15事实。Paper默认Context不跨mode获取Shadow资料。原生测试验证并发唯一job、黄金金额、scope/method/coverage/幂等/有效期/租约丢失；HTTP+生成consumer验证成功/401/403/错误schema、100重试、字节哈希、F05根及基本Chromium。源码冻结后执行 `node scripts/record-bff-fe-008-functional.mjs`；`pnpm check:bff-fe-008`严格校验唯一当前回执与输入，发布失败原子恢复manifest/计划。CI分处置与strict READY，当前功能未验收不得隐式放行。

真实目标DB/Auth/RLS/MFA/Storage、持久跨实例或重启worker恢复、真实Paper/Shadow连续业务链、C16通知、完整P21 UI/G4/FEP4、性能/容量/长稳/同SHA hosted CI/部署均移交RELEASE-GATE:BETA并保持NOT_RUN；本任务不使用生产凭据、不进行venue submit/外部发布。用户完整确认PENDING，formalAccepted=false，runtimeAdmission=DENIED。

2026-10-20当前复核：原确认改为C15的007040fd/1e1ca813与A4的1297bc3b/4085bdef，各自原源码/稿/回执；新证据独立写入bff-fe-008-local-20261020。按15组当前检查与6个实际入口执行，不调用原组件Gate。

下载授权最多1000张；活动报告的已过期票据保留至报告到期，以维持已知过期授权410；所属报告15分钟到期后，票据在下一合法请求清理并释放限额，旧报告仍由REPORT_EXPIRED拒绝。新报告可获新授权，旧报告原创建键仍恢复原queued回执，jobs/replays不删除、不重算；1000个报告/历史幂等租约上限保留。此为期限/恢复语义验证，不作为性能容量准入。前端下载除hash、字节长度及报告/账本/估值ID外，必须逐项核对状态、createdAt/expiresAt、correlationId/auditRef及supersededBy与下载授权一致，重新计算hash也不能掩盖语义不匹配。reportVersion在当前schema固定为1，非1版本已有schema拒绝，本轮不把它描述为可复现版本漏洞。
