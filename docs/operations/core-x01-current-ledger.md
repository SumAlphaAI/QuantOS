# CORE:X01 当前不可变 Fill 持久账本

2026-10-29，DEVELOPMENT，基线 `8ec5f2dd904026f9dae265f972d370ea74b8f2a4`。承接[X04移交](../audit/evidence/core-x04-current-local-20261029/handoff.json)；[当前范围](../execution/core-x01-current-scope.json)继承19项gap/8项义务，全部保持OPEN，仅记录L4-LEDGER-01的X04→X01本机进展。

X04与X01共用原生成交DTO，类型定义放在quantos-portfolio，X04继续原路径re-export；原canonical sourceHash域与全部字段保持不变。owner经当前授权的native getter读取原回执/快照，不接受HTTP上传或浏览器自报成交。新账本在入账前核对scope、原Command/Order/Subject/Proposal/decision、逐笔Fill、数量、费用币种及checksum，存完整来源与派生的append-only条目链。checksum只关联内容，来源认证仍依赖native的只读重放及owner HMAC存储，不能凭公开hash取得执行权限。

每个Command只能登记一个不可变来源；重复同源是幂等空操作，变更sourceHash、request映射或重复使用Fill ID均拒绝。整批先在独立状态求值，任何绑定/算术错误均不发布部分结果。持久化只保存来源日志与anchor，恢复时重新验证来源、链和anchor并重算位置/费用；不相信上传或落盘的累计投影。源Command消失也拒绝返回孤立账本。

使用Decimal而非f64，保留源十进制原文；成交名义、费用、现金变化的乘加拒绝精度损失/下溢/溢出，不猜测零金额。平均成本按Decimal有界精度除法计算，已实现P&L按当前观察成本与费用计算，不等于完整账户P&L。`quoteCashDelta`和`quoteFeesTotal`仅为已入账部分的观察累计；没有初始现金、权益、行情mark、未实现P&L或外汇换算。`valuationReady=false`且`executionAuthority=false`始终成立，不能据此替代可信财务或估值。

UNKNOWN即使已有实际Fill观察也整条Command隔离，保留观察的Fill ID/原币费用/来源，appliedFillIds为空表示未入账，绝不表示venue零成交或零费用。非报价币费用同样隔离，原因FEE_CONVERSION_REQUIRED，不将其当作零USDT。旧无journal回执登记JOURNAL_UNAVAILABLE隔离，不由均价/累计量推算Fill。隔离状态不能被重放、重启、改key或替换来源隐式解除，需后续明确对账流程；无自动补发或资金预算重置。

受限profile用独立`portfolio.json`、既有owner MAC、稳定文件锁及fsync保存账本，与commands/approvals分文件。approvals保存ledger anchor；恢复允许已验证日志领先于anchor，拒绝缺失、回退或同高度分叉。当前进程保留高水位并核对每次读取的权限/字节与原native来源。原生提交已成功而账本尚未保存时，后续读取从原Command补记，原key只取原回执，不产生新IO。此机制不是跨文件数据库原子事务、跨主机事务或有权回滚整目录/密钥的防护；目标Supabase/Vault/RLS仍NOT_RUN。

新增只读`GET /v1/assisted-testnet/ledger`，公共契约1.19.0；当前会话、角色、账户和server flag继续授权。返回观察范围、账本hash/anchor、原始来源引用、入账/隔离收据、位置和报价币费用。原请求视图可选ledger收据与同一facts.sourceHash关联，P11展示条目hash和入账/隔离说明；C10原完成事件sourceHash/fillIds与五节点链不改写，也不把全局可变ledgerHash塞回历史事件。客户端错绑/损坏收据会清除旧快照。

提交前先同步并验证账本。存在实际入账或隔离义务时，当前owned profile缺少成交后的可信估值/新风险输入，因此拒绝新Command；同一原Command恢复仍保留原key/期限并query-only。未观察到Fill的既有50个审批流程继续原范围测试，不把它们换算成50笔真实成交。实际风险输入刷新、估值、订单资金预留对账与真实新决策资格未在本项放行。

验证仅当前账本、原生快照接续、当前X01万条黄金回放/重建及受影响的审批、风险来源、真实loopback mTLS/多副本/崩溃恢复与P11/C10/默认关闭场景。历史40节点131组属于原候选，不递归重跑或改绑。旧release P95用例保留ignored，目标性能NOT_RUN；F05/F07 campaign与实际数据库均不执行。评审/完整联调/发布/M5另行记账。

工程Gate目标`PASS_CURRENT_NATIVE_FILL_DURABLE_LEDGER_UNKNOWN_ISOLATION`，实际执行结果以[当前证据](../audit/evidence/core-x01-current-local-20261029/README.md)为准。实现IMPLEMENTED_PENDING_ACCEPTANCE，完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。

入口：`node scripts/core-x01-current-review.mjs --run docs/audit/evidence/core-x01-current-local-20261029/attempt-NN`，需全新目录/已提交输入；复核`node scripts/core-x01-current-review.mjs --verify`。下一`CORE:X05 DEVELOPMENT`：使用独立books对当前native/X01来源开展可追溯对账，再接Alert；不得复制同一账本伪造独立对账或解除UNKNOWN义务。
