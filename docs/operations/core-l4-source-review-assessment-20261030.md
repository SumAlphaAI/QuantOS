# CORE-GATE:L4 DEVELOPMENT：来源健康与财务独立审查后的组合评估

本轮承接[最新 X06](./core-x06-source-review.md)，基线 `e0b7631831b9fcfd24bc868799b71ebf19d4f374`。仅新增组合测试、机器评估、证据门禁及文档；业务模块、Terminal、API 1.31.0 和客户端不改，32 个关键文件逐字节绑定基线，并拒绝 crates / BFF / execution gateway / Terminal / API 目录的运行时代码差异。必要修复仅限本任务真实缺陷，不用评估任务预授权新业务范围。[机器评估](../execution/core-l4-source-review-assessment-20261030.json)、[当前证据](../audit/evidence/core-l4-source-review-local-20261030/README.md)以冻结执行为准。

## 当前组合

1. **混合义务、实际执行和公共控制**：同一 owned 账户原 3 财务差异已修正但 OPEN 保留，可信账单原 2 秒期限到达追加 STALE，连续版本恢复可信/MATCHED 后共 4 OPEN。显式三人来源健康审查仅覆盖来源子集，新 X02 仍 Deny / 无 Subject；再独立财务审查覆盖财务子集，才接新签名 RiskDecision、同一不可变 Proposal 的新 Subject、独立订单双 MFA。公共 C11 关闭拒绝且 claims 不变，version2 启用后实际本机 mTLS/native ETH IO，X01 第二笔入账，独立 BTC1/ETH1/USDT现金7999.98/费用0.02 账单匹配，原 4 OPEN / C10 保留。跨公共全局/账户 kill、C11 到4、独立解除及冷恢复，原 Command/generation0/两份审查/签名/claims 不改。当前 generation4 必须重新取得两域各自三人审查、新风险/新零审批 Subject、独立双审批；同一已执行 Proposal 仍409，未第三次 IO 或预留。
2. **混合授权后的实际 UNKNOWN**：另一 owned 域同样 4 OPEN / 两域授权 / 新风险和独立订单审批，实际 ETH 提交后 BFF 死亡。独立账单声称成交仍只 GET 恢复 UNKNOWN；公共 kill/解除、C11 到4、冷恢复后保留原 generation0、两域授权、签名和 claims。仍为1已知入账/1隔离，原4加3个 UNKNOWN 相关 OPEN 共7条；两个审查入口409，无可用估值，不补发、不自动关闭。
3. **剩余估值来源边界**：两域当前授权均有效、books MATCHED、无 UNKNOWN 时，owner 认证参考估值可产生新 ApprovalRequired；其 sourceTrust 明确仍为 OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET。将真实 owner 输入端口的 sourceId 换成声称 R01 的字符串、mark.sourceRef 换成无认证产物引用，当前 valuation503，新风险不能复用旧 snapshot（503/无 Subject），claims 和原命令不变。显式恢复有效 owner 参考输入后仅恢复参考信任，不变成 R01；原4 OPEN、两域历史及 C10 保留，场景仅1次 seed IO，未审批或执行参考新 Subject。这是批准 R01 产物到 native mark 的适配尚未实现的证据，不把正确拒绝记为安全缺陷，也不将字符串声明当作真实行情授权。

三个场景均使用独立临时目录、自有证书/fixture 身份、独立 authored 账单、受控参考资金与 mark 和实际本机受限进程。不是原 50 授权旅程、200 venue、4 目标演练，不改变分母。原 UNKNOWN 和不在允许域的协议/覆盖义务仍不可人工绕过，任何原来源恢复/一次 ack 均不自动解除 OPEN。

## Gate 和剩余义务

工程 Gate 目标 `PASS_L4_SOURCE_AND_FINANCIAL_REVIEW_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT`，以冻结结果为准；DEVELOPMENT 评估 COMPLETED_CURRENT_SCOPE。完整 Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。19 gaps / 8 规划义务仍 OPEN；159 规范阶段、原量化分母和15项原风险规则/限额不变。fullBooksReady/dayCloseAllowed/executionAuthority=false。

来源健康显式处置的 owned 子范围已由 X06 实现，本轮以 mixed 组合验证；旧 L4“来源健康入口未实现”的叙述保留为原 SHA 事实，不能继续当作当前缺口。尚未接通的 R01/金融来源真实性、当前 Research/R04/账户全集、真实 IdP/MFA、Supabase/Vault/RLS/事务性 outbox/跨主机/外部单调锚、实际 venue/资金、异步成交/非报价币费用/FX/外部流/负债/在途订单预算、外部通知/源关闭、目标安全容量长稳/同 SHA CI/发布仍 NOT_RUN 或未验收。正式确认仅有完整文稿，未替用户批准。

## 验证与历史

入口 `pnpm assess:core-l4-source:local`；只读复核 `pnpm check:core-l4-source:local`。从冻结源码运行16项具名检查，包含3项当前 BFF/native 组合、门禁反例、必要构建/Clippy/格式/生成与计划清单、无 submit 校验、DEVELOPMENT 下一入口、INTEGRATION/RELEASE 应拒绝及密钥正反例扫描。共享 helper 只改可见性，运行时/API/UI不改，因此不重复最新 X06 已封存的134 Rust / 218消费者 / 93 Gate，不递归全上游、全仓或 F05/F07 campaign。当前浏览器/人工无障碍 NOT_RUN。

最新 X06 原源码 `101d940ae4835a64d811e707b3c5c2a476108df2` 的2034输入/68原始文件只按原 Git blob/hash 和 ORIGINAL_SCOPE_ONLY核验，不改绑成当前通过。诊断编译失败及后续修正保留；unfrozen preflight 只是门禁模型输入，不替代当前候选执行。先核对精确输入、执行日志/计数、签名账单、两域 journal/proof/C10、风险/Subject/Command/claims 和全部 OPEN，再发布当前 PASS；空执行/漏执行/过时来源/历史继承不得放行。

## 下一可执行任务

**CORE:X01 DEVELOPMENT / L4-R01-VALUATION-PROVENANCE-01**，归属既有 L4-CURRENT-SOURCE-01 / L4-LEDGER-01，不新增验收分母：把已批准 R01 MarketEvent/产物的 provider/source、用途许可、symbol/精度、质量、时间、version/hash 和不可变引用接到当前账本 mark / 风险快照；缺源、不可信/不健康/过时/未许可、文本冒名、UNKNOWN 和缓存替代必须拒绝。owner 期初资金/账户状态参考授权继续独立，不将 mark 来源提升为资金或账户来源。先使用仓库真实模块和 owned replay / artifact 完成本地开发，无生产凭据、外部发布或实时 provider 调用；真实许可行情、实际资金/身份/存储/venue 与完整目标验收仍独立。
