# CORE-GATE:L4 DEVELOPMENT：账户与 R01 双来源当前组合及剩余缺口

接[最新 X01](./core-x01-account-state.md)，main基线 `2ead32de186d85e443856453572efc002d24a2f8`。本任务只增加当前组合测试、机器评估、门禁和文档，测试helper仅扩大可见性；38关键运行时/Terminal/API文件逐字节绑定基线，拒绝业务代码差异。API1.33.0 /160 operations /180 schemas、PRE-04 1100字段行不改。见[机器评估](../execution/core-l4-dual-source-assessment-20261030.json)、[证据](../audit/evidence/core-l4-dual-source-local-20261030/README.md)。

## 当前组合与拒绝

1. **双来源、两域审查和当前控制**：同一owned当前账户的独立books经修正与来源恢复后保留原3财务+1来源OPEN。账户Opening/status与R01/F03 mark由不同用途批准、证书及实际公钥分别认证，共同绑定当前raw输入、原Opening、不可变账本和风险Snapshot。来源健康三人审查单独仍签名Deny；另行独立财务审查后，接新X02/同一Proposal新Subject、独立订单双MFA，公共C11关闭拒绝且claims不变，version2后实际loopback mTLS/native ETH IO。X01第二笔已知入账与独立BTC1/ETH1/cash7999.98/fees0.02 books匹配，原4 OPEN和共同C10保留。
2. **原证明与当前拒绝**：该命令经公共全局/账户kill、独立解除、C11到4及冷恢复，保留原generation0、账户/R01证明、两域授权、签名/claims。当前generation4重新两域审查、当前账本的连续账户/R01产物均version2，原Opening hash与10000不改；按原BTC/ETH各1100 mark评估同一Proposal，集中度签名Deny，无新Subject。原请求再次执行拒绝，无第三IO/预留，不调价或放宽限额来强求ApprovalRequired。
3. **双来源后的实际UNKNOWN**：另一独立owned域同样4 OPEN/两域审查/双来源风险与订单双审批，实际ETH提交后BFF死亡；独立books声称成交仍只查询UNKNOWN。公共kill/解除、C11到4及冷恢复后仍1已知入账/1隔离/7 OPEN（原4+3未知相关），原generation0/两个来源证明/两域授权/签名/claims不改，两个新审查入口拒绝，无可用估值，不补发或自动关闭。
4. **新发现的cash-only首次入口缺口**：另一个从未成交的新fixture域，原生账本0入账/0隔离/无持仓、generation0；独立批准账户Opening USDT10000/basis/status及独立签名books（BTC0/ETH0/cash10000/fees0）均有效。R01空ticks产物构建拒绝；提供真实规范化、签名且质量通过的BTC tick也因无对应持仓而无法形成当前估值。公共valuation503、合法UUID幂等键的risk-review503/无Subject，冷恢复仍503；未创建任何native claim/订单/IO，不用一次参考成交或假持仓来启动。

以上是3项具名当前进程场景，第1/2项在同一成功场景。最后一项是**执行过的拒绝场景，protocol IO=0，不计作成功交易**。它使用全新目录/身份/证书/账本，不通过删除或重置已有4/7 OPEN或UNKNOWN来制造空账本。

cash-only场景的X05协议观察层可以显示MATCHED_OBSERVATIONS（没有执行增量），但独立账户核对层明确LOCAL_OPENING_BASIS_UNAVAILABLE、comparisonReady=false/basisHash=null，并产生1条ACCOUNT_BOOKS_BASIS_UNAVAILABLE OPEN。原因是verified_opening只从已登记valuation.sources取得，而当前空仓路径尚不能登记可用估值source。此OPEN冷恢复不丢失；真实financial_review::coverage将其分为blocked=1、financial=0、sourceHealth=0，两种审查均不可用。API在没有source-health子集时可省略可选obligationCoverage；本评估直接调用领域分类函数并另存结果，不假造API字段。不将顶层协议MATCHED误记为完整财务匹配，也不把basis OPEN折为可审查的STALE。

旧L4“账户期初资金/状态来源桥接未实现”现在只保留为原SHA事实；当前已实现并组合验证的是owned独立批准签名产物，不是真实venue资金、金融许可、账户全集或运行权限。Snapshot.sourceTrust保留总体owner参考边界，新的accountProvenance明确其认证范围，两个来源的许可不能互相替代。

## Gate、矩阵和原始范围

工程Gate目标 **PASS_L4_ACCOUNT_AND_R01_DUAL_SOURCE_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT**，以冻结具名执行为准；DEVELOPMENT评估COMPLETED_CURRENT_SCOPE。完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19gaps/8规划义务保持OPEN、159规范阶段及200venue/50授权旅程/4目标演练原分母和风险规则/限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。

入口 `node scripts/core-l4-dual-source.mjs --run --attempt=attempt-01`；只读 `node docs/audit/evidence/core-l4-dual-source-local-20261030/verify.mjs`。16项具名检查包括3条当前公共HTTP/native组合、机器评估/门禁反例、必要构建/Clippy/fmt/生成/清单/计划/no-submit、DEVELOPMENT下一入口、INTEGRATION/RELEASE预期拒绝与秘密扫描正反例。运行时/UI不改，不递归重跑上游、全仓、F05/F07或最新X01149Rust/277消费者/115Gate；当前浏览器/人工无障碍NOT_RUN。未连接数据库，不记作Supabase验收。

最新X01源码 `5da60187684f60861f3f0409034fd50bf366a267` 的2069输入/74原始文件，及其preflight失败、原性能ignored/其他NOT_RUN，按原Git blob/hash与ORIGINAL_SCOPE_ONLY保留，不改绑成当前通过。preflight只作未冻结诊断/门禁模型；先核对具名运行、精确输入、二进制/日志hash、两份来源签名/独立公钥/批准与Opening/raw/Snapshot hash、独立签名books/两域journal/proof/C10、Command/claims/OPEN和新账户拒绝，再发布当前PASS；不以零执行、漏执行或历史结果放行。

真实许可/live R01、资金/账户状态/账户全集、Research/R04、IdP/MFA/Supabase/Vault/RLS/outbox/跨主机/外部单调锚、真实venue、异步成交/FX/非报价币费用/外部流/负债/在途预算/日切、通知/源关闭、安全容量长稳同SHA CI/发布与浏览器人工无障碍仍未验收或NOT_RUN。无生产凭据、推送、部署或外部发布；正式确认仅准备文稿，不自行批准。

## 下一可执行任务

**CORE:X01 DEVELOPMENT / L4-CASH-ONLY-VALUATION-01**，在既有L4-CURRENT-SOURCE-01/L4-LEDGER-01内支持经过独立批准账户Opening/status的cash-only/无持仓估值及当前风险来源；明确无持仓时不需要虚构market tick/持仓，持仓存在时仍严格要求R01。保持账户与market授权分离、原Opening与高水位，不用参考seed订单启动、不重基准现金/预算、不重置generation或UNKNOWN。

先前的ACCOUNT_BOOKS_BASIS_UNAVAILABLE OPEN仍应保留blocked，不能扩大审查覆盖、自动关闭或把blocked当STALE来强求ApprovalRequired；来源修复后风险仍可正确签名Deny、无Subject，独立处置义务另行评估。当前任务不预授权这些后续功能或实际外部资金接入。
