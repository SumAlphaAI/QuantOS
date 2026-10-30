# CORE-GATE:L4 DEVELOPMENT：认证 R01 mark 加入后的组合与缺口评估

承接[最新 X01](./core-x01-r01-provenance.md)，基线 `f6c3debeab8202da1b4fd78280829597eb3260c5`。本任务仅新增组合测试、机器评估、证据门禁和文档；36个关键运行时/Terminal/API文件逐字节绑定基线，并拒绝业务代码差异。API1.32.0 /160 operations /179 schemas、PRE-04 1083字段行保持。见[机器评估](../execution/core-l4-r01-assessment-20261030.json)、[当前证据](../audit/evidence/core-l4-r01-local-20261030/README.md)。

## 当前组合

1. 当前独立账户books经财务差异修正、来源过期再恢复后，保留原3财务+1来源OPEN。批准R01 MarketIngestor/F03产物、当前owner Trading用途许可与专用域签名派生BTC/ETH mark，绑定原始账户参考输入、不可变账本、风险快照和新Subject。来源健康三人审查单独仍签名Deny；另行独立财务审查后才ApprovalRequired、独立订单双MFA。C11关闭拒绝且claims不变，version2允许实际本机mTLS/native ETH IO；X01形成第二笔已知入账，独立BTC1/ETH1/cash7999.98/fees0.02账单MATCHED，原4 OPEN/C10保留。
2. 该原命令跨公共全局/账户kill、独立解除、C11到4和冷恢复，保留原generation0、R01证明、两域授权、签名及claims。当前generation4重新取得两域各自三人审查与当前账本的新R01连续产物version2后，以保持不变的BTC/ETH各1100 mark评估同一Proposal，集中度规则签名Deny、无新Subject。原命令再次执行拒绝，无第三次IO或新预留；不为重现旧参考价场景的ApprovalRequired而改变mark或限额。
3. 另一owned域同样以R01认证mark、两域审查与新风险/独立审批实际ETH提交后BFF死亡。独立账单声称成交仍只查询UNKNOWN；公共kill/解除、C11到4、冷恢复后保留原generation0/R01/两域授权/签名/claims，1已知入账/1隔离、原4+3未知相关OPEN共7，无可用估值快照、两个审查入口均拒绝，不补发或自动关闭。UNKNOWN返回既有sourceVersions/snapshotCount，仅计数不授予可用估值。
4. 剩余资金/状态边界：已认证R01 mark与当前两域审查可用于owned ApprovalRequired，但账户sourceTrust仍OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET。把owner账户输入sourceId改成声称独立cash/status的字符串，即使为该完整raw输入重新产生真实R01/F03并专用域签名，仍valuation503、新风险503无Subject，不能复用旧snapshot/claims。显式恢复合法owner参考输入与连续R01产物version3后仅恢复参考信任；原4 OPEN/两域历史/C10不改，未审批或执行新Subject。

以上为3项独立当前进程组合（第1/2项在同一成功场景），各用自有临时证书、fixture批准/身份、独立authored账单、真实仓库模块与loopback受限进程；不计作原50旅程/200venue/4目标演练。资金来源不从mark、Fill价格、成本或修正账单推断。R01 sourceId冒名拒绝的旧L4结果保留为原SHA事实，但“认证R01桥接未实现”不再是当前事实；不是关闭整个资金/来源/目标义务。

## Gate、验证与历史

工程Gate目标 `PASS_L4_AUTHENTICATED_R01_MARK_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT`，以冻结具名执行为准；DEVELOPMENT评估COMPLETED_CURRENT_SCOPE。完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19gaps/8规划义务保持OPEN，159规范阶段与原分母、风险规则/限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。

入口 `node scripts/core-l4-r01.mjs --run --attempt=attempt-01`，只读 `node docs/audit/evidence/core-l4-r01-local-20261030/verify.mjs`。冻结矩阵为16项具名检查：3项当前BFF/native组合、机器评估/门禁反例、构建/Clippy/格式/生成/计划/清单、no-submit、DEVELOPMENT下一入口、INTEGRATION/RELEASE预期拒绝、密钥扫描正反例。运行时只读绑定，测试helper仅扩大可见性，因此不递归重跑上游、全仓、F05/F07或最新X01的148Rust/243消费者/90Gate；后者仅原范围参考。未连接Supabase，不记数据库验收通过。

最新X01源码 `837cf7a1ce1038e193df8a44e3bd67246f4a8151` 的2065输入/105原始文件、原失败attempt、ignored性能与其他NOT_RUN均按Git blob/hash和ORIGINAL_SCOPE_ONLY保留。未冻结诊断不能替代当前候选；先验证具名运行/计数、R01签名/F03/原raw输入和风险快照hash、签名独立账单/两域审查journal/proof/C10、Subject/原Command/claims/OPEN，再发布PASS。禁止空执行、漏执行、历史改绑、自动修复UNKNOWN或借恢复刷新原期限。

真实许可/live R01、资金/状态/账户全集、Research/R04、实际IdP/MFA、Supabase/Vault/RLS/事务outbox/跨主机/外部单调锚、真实venue、异步成交/非报价币费用/FX/外部流/负债/在途预算、外部通知/源关闭、目标安全容量长稳/同SHA CI/发布及当前浏览器人工无障碍仍未验收或NOT_RUN。原R01发布性能ignore不转PASS。无生产凭据或外部推送/部署/发布；正式确认仅准备文稿，不自行批准。

## 下一可执行任务

**CORE:X01 DEVELOPMENT / L4-ACCOUNT-STATE-PROVENANCE-01**（既有L4-CURRENT-SOURCE-01/L4-LEDGER-01内，不新增验收分母）：将独立批准的账户期初资金/basis与状态观察产物，以scope、来源/许可、质量、时间、连续版本/hash和原账本origin绑定接入估值/风险。与R01 mark授权分离；不能以字符串、mark/Fill价格或修正账单推断资金，不重置或重基准期初资金/预算/限额/generation，不补发UNKNOWN或关闭OPEN。只用owned模块/fixture，真实许可/live资金与目标环境义务继续独立。
