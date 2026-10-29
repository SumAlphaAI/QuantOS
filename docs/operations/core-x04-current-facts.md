# CORE:X04 原生成交事实到公共只读来源

2026-10-29，DEVELOPMENT；基线 `99a9fc42d21981509c6fb851081ef90d9ebf0015`。承接[当前 X02 移交](../audit/evidence/core-x02-current-local-20261029/handoff.json)，本项只完成 L4-LEDGER-01 的 X04 来源部分。[范围](../execution/core-x04-current-scope.json)继承全部19项 gap 和8项义务，保持 OPEN。

原生执行在原 Command 预留时保存原 Subject；有界 IO 与事件收集之后，从真实 ExecutionGateway journal 取得该 Command 的 Order/Fill。捕获失败保留预留的 UNKNOWN，不重新发单。完成快照与原回执在同一认证 `commands.json` 事务内 fsync，不另建可竞态的成交文件。当前持久化只有单主机文件锁、owner HMAC 与认证存储，不代表 Supabase、跨主机事务或能抵抗有权回滚整目录/密钥的操作者。

私有 CommandFacts 包含原 Order、Fill、每条原 journal hash、按该 Command 过滤后派生的事实链及 anchor。派生链明确不是原全局 journal；原始 hash 分开保留。恢复时调用既有 OMS 只读 replay 校验 anchor、合法转换、精确 Fill/Order 一致性及 Command/账户/Subject 绑定，不恢复可执行 gateway、不访问 venue。公开 sourceHash 是带版本域的 canonical JSON SHA256，供去重和来源关联；owner 认证存储与当前服务身份才是来源信任边界，独立 checksum 不提供执行权或身份授权。

已有 `GET /v1/assisted-testnet/requests` 及单项查询增加可选 `facts`，包含原 request/Subject/Proposal/decision/Command、tenant/workspace/account、Order、逐笔 Fill、精确十进制费用字符串及币种、原/派生 hash 和 sourceHash。没有新写入口。每次读取校验当前会话、角色与账户；原审批/命令过期后，仍允许有效会话查阅历史事实，不能续期或重发。旧无 Subject/journal 的回执继续原范围只读，facts 缺省，不从累计数量或均价编造成交和费用。

`consumerReady` 仅表示接受结果且有经过验证的 journal、费用均为原报价币的观察来源可供后续消费，不表示账本已入账或业务闭环。UNKNOWN 保留已观察内容，reason=OUTCOME_UNRESOLVED；空集合不证明 venue 没有成交、不推断零费用或重置预算。非报价币费用保持原币金额，reason=FEE_CONVERSION_REQUIRED，consumerReady=false；不按零或猜测汇率转换。未完成的异步 venue 回报收集与不确定结果对账继续 NOT_RUN。

P11 展示只读来源、Order/Command、逐笔 Fill 和原币费用；生成客户端验证完整 DTO，并核对当前 scope、Subject、decision、Command 和 Fill 的同源绑定。损坏或错绑响应清除旧选择；scope 变化撤销当前页面权限。C10 同一 command_accepted 完成事件增加 executionFactsHash/fillIds，保持原5节点 causation 链；旧无 facts 的负载不新增字段，不改变历史 payload hash。执行请求、恢复原 key/body/CSRF 和 UNKNOWN query-only 规则保持原边界。

当前 native 测试实际消费两笔源 Fill 到 X01 内存投影，证明数量与0.2报价币费用可用；它不是公共持久账本集成。X01持久入账/去重与当前财务来源、X05独立 books 对账、Alert持久化和关闭、异步回报及非报价币费用转换均留待接续。不得复制一个来源伪造独立对账或切换 Shadow 身份获取 Assisted 权限。

验证范围为当前原生成交、OMS、受影响的风险来源/审批/恢复、真实 loopback mTLS 受限进程与两 BFF 共享文件恢复、生成契约、P11/C10/默认关闭四个 Chromium 场景及必要构建/静态检查；不递归运行上游或 F05/F07 campaign。原10万事件转换/去重/取消审计/Fill溯源标准由直接 OMS 功能回归保留，不能换算成10万笔真实 venue 订单。实际 IdP/MFA/资金源/Vault/RLS/Supabase、真实 testnet、跨主机、目标 P95/安全/负载/长稳/同 SHA hosted CI、完整浏览器/人工无障碍与联调/发布/M5保持 NOT_RUN。

工程 Gate 目标 `PASS_NATIVE_ORDER_FILL_PUBLIC_SOURCE`，以[冻结证据](../audit/evidence/core-x04-current-local-20261029/README.md)的实际结果为准。实现状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；完整 Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED、M5 `PREPARED_NOT_READY`。评审文稿不构成用户确认或正式验收。

执行：`node scripts/core-x04-current-review.mjs --run docs/audit/evidence/core-x04-current-local-20261029/attempt-NN`，必须全新目录、已提交源码及输入；只使用白名单环境和自有 loopback。复核：`node scripts/core-x04-current-review.mjs --verify`。收集命令、退出码、原始日志、源码/输入/二进制/产物 hash，保留失败；X02原219文件逐个核验，只属原范围。

下一任务 `CORE:X01 DEVELOPMENT`：消费当前不可变 Fill 到现有公共账本和财务来源，补齐持久去重、scope/来源绑定、精确费用与 UNKNOWN 隔离，再交 X05/Alert；真实外部运行另需授权。
