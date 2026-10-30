# CORE:X01 DEVELOPMENT / L4-ACCOUNT-STATE-PROVENANCE-01

承接[最新 L4](./core-l4-r01-assessment-20261030.md)，main基线 `56c315ebba2c447727e90e9aaa6133f4df329d9b`。本轮将独立批准的账户期初资金/basis与状态观察产物接入当前估值/风险、新Subject与IO前复核；[范围](../execution/core-x01-account-state-scope.json)、[证据](../audit/evidence/core-x01-account-state-local-20261030/README.md)绑定冻结源码与具名运行。旧L4源码6d3eac6f23f3dc9bdadf023afef521df6135ee6e的1950输入/46原始文件保留原Git blob/hash及ORIGINAL_SCOPE_ONLY。

## 独立账户权限与原基准

`quantos-portfolio::account_provenance` 新增 Policy、Opening、Observation、Artifact/SignedArtifact、Binding/Summary和追加式History。账户Policy来自独立owner MAC认证的 `account-valuation-policy`，不来自HTTP或产物自声明；明确批准tenant/workspace/account、账户估值用途 assisted_testnet_account_valuation、provider/dataset、批准ref/version/document hash、scope hash、signer/public certificate、原Opening及最长新鲜度（1–30秒）。与R01 Trading mark批准分离；账户签名证书及实际公钥必须与R01/原observer不同，换证而复用同一私钥也拒绝。证书与Policy有效期均检查，专用签名域 quantos-account-valuation-artifact-signature/v1，market/observer签名不能替用。当前不支持签名轮换。

Observation是独立来源记录，不由consumer的现金断言构造权威。owned进程测试独立编写Opening：固定USDT10000、原期初realized PnL -5、原owner开始时间、空origin和既有source/basis/ref，状态观察为独立active/suspended及观察/覆盖时间；不从mark、Fill价格、平均成本或修正books推导这些量。Artifact绑定完整raw valuation input hash、scope、Policy hash、连续version/previous hash、Opening、状态/来源ref/观察时间/覆盖时间与质量。消费时逐字段核对原raw输入及当前账本，缺值不推断0，不以标签或缓存替代签名来源。

Opening含原sourceId/basis/originLedgerHash/openingAt/cashSourceRef/quoteCashAtOpening/realizedPnlBeforeOriginToday/quoteCurrency。初次认证必须匹配原已登记估值origin；Policy后续修订与观察产物不得改变Opening。原Native State注册器继续核对同一source origin，禁止以认证迁移、修正或日切为由重基准期初现金/PnL、预算或限额。当前basis仍 EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS / USDT；实际外部流、FX/非报价币费用、负债、在途订单和跨日账簿不被新证明授权。

## 版本、时间、拒绝与恢复

owner临时启动配置新增默认关闭 accountValuationEnabled；完整模式要求R01启用或已有R01历史。raw valuation input不得自带accountProvenance；BFF从独立认证Policy及私有单链接regular `account-valuation-artifact.json` 绑定账户证明，再绑定R01证明。两份产物共同绑定相同raw输入hash；raw_market_hash只去掉派生mark与两个证明，避免循环依赖，完整Inputs和Snapshot hash仍包含两份来源。旧None字段省略序列化，旧hash/签名/未启用参考模式保持原范围。

已认证Policy与well-formed签名观察head在原审批checkpoint的valuation.accountHistory追加。Policy/artifact各最多64，产物最多262144字节，PEM最多16384；连续版本从1开始，前hash一致、时间不回退，同一状态时间不能更换状态。撤销/不健康的已认证新head即使消费拒绝也持久保留；读、重启或移除开关不能退回旧授权/健康产物或owner裸参考输入。坏签名/结构非法记录不是可信新head；文件仍在时拒绝，不用缓存兜底。恢复必须显式更新合法连续来源，不自动清除历史或OPEN。

原30秒估值上限、R01/F03窗口、Policy/证书、账户观察/status/cash coverage、raw输入和UTC日终取最小半开截止；读/风险重评估/冷恢复不刷新原时间。active之外的已签名suspended/closed继续INACTIVE_ACCOUNT且无可用快照，认证不等于允许交易。UNKNOWN在消费当前来源前拒绝可用估值，只返回原sourceVersions/snapshotCount历史计数；原命令仅查询。

沿用同一account-books-fence覆盖账户/R01 Policy与产物发布、公共新风险/open/MFA和native预留/fsync/IO前复核。publisher先独立发布valuation-input，再在共同fence下发布两份证明；不在持有fence时反向取valuation-input锁，避免逆序锁。中间来源hash不一致只拒绝。Policy撤销在等待IO的fence内提交，释放后旧审批不能产生IO或预留。

## 公共链路、API与信任边界

accountProvenance Summary进入Snapshot、X02 signed facts、新Subject.nativeRiskBinding、原Command.currentRisk及共同C10；风险仍绑定同一不可变Proposal，仍需来源/财务独立审查、独立订单双MFA和C11/kill，未增加submit通道。实际owned ETH完成后独立BTC1/ETH1/cash7999.98/fees0.02 books匹配、X01两笔入账，原4 OPEN保留；跨公共全局/账户kill、C11到4、独立解除和冷恢复，原generation0、两个来源证明、签名/claims不改。实际丢响应UNKNOWN保持1已知入账/1隔离/7 OPEN及两个原证明，两个新审查入口均拒绝，不补发、自动关闭或放宽限额。

API1.33.0 /160 operations /180 schemas，新增AccountValuationProvenance；Inputs内部保留完整Binding，公开Snapshot/Valuation/Review/Subject/Command只增optional Summary。完整ready reason为READY_OWNED_AUTHENTICATED_ACCOUNT_AND_R01；旧reason不变。client/Zod/MSW/input-policy/PRE-04 1100字段行同步。Terminal核对上下文、两个来源/风险/Subject/Command一致与原期限，展示账户来源、批准版本、观察/截止；旧Command查询不要求当前期限仍有效，避免把UNKNOWN变成重发。

公开Snapshot.sourceTrust继续OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET，明确总体仍为owned受控来源范围；新账户trust为AUTHENTICATED_OWNER_APPROVED_ACCOUNT_OPENING_STATUS_ARTIFACT_NOT_VENUE_FUNDS。这是owner独立批准、签名并精确绑定账户记录的证据，区别原裸参考输入；不把fixture审批、证书或mark批准当作真实venue资金、金融许可、实际账户全集或运行权限。单机owner MAC/证书pin不是外部单调锚；整个目录/密钥回滚仍属目标义务，当前不声称分布式或真实IdP/Vault/RLS能力。

## 测试、Gate与移交

当前功能测试覆盖独立来源/公钥、用途/scope、精确Opening/状态/raw输入/hash/时间、签名/域、撤销/质量/停用/当前IO fence、冷恢复与篡改、UNKNOWN原证明/claims/OPEN及消费者。共享Inputs/Snapshot/当前Command序列化、来源校验和checkpoint恢复影响core_l04原61项，因此冻结候选上补跑该文件61项直接回归；不递归全上游、全仓、F05/F07或发布campaign。构建/Clippy/格式/类型/生成/计划/清单/秘密正反例按矩阵记录；未连接数据库，不能记Supabase验收通过。

入口 `node scripts/core-x01-account-state.mjs --run --attempt=attempt-01`，只读 `node docs/audit/evidence/core-x01-account-state-local-20261030/verify.mjs`。工程Gate目标PASS_CURRENT_INDEPENDENT_ACCOUNT_OPENING_STATUS_PROVENANCE_RISK_SUBJECT_IO，以冻结具名执行为准；功能IMPLEMENTED_PENDING_ACCEPTANCE。完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19gaps/8义务OPEN、159阶段与200venue/50授权旅程/4目标演练分母、原风险规则/限额不变；fullBooksReady/dayCloseAllowed/executionAuthority=false。

真实许可/资金/状态/live R01/账户全集/Research/R04、IdP/MFA/Supabase/Vault/RLS/outbox/跨主机/外部锚、轮换/多账户源、异步费用/FX/外部流/负债/在途预算/日切、通知/源关闭、目标安全容量长稳/同SHA CI/发布及人工浏览器/无障碍仍未验收或NOT_RUN；原R01发布性能ignore保留原范围NOT_RUN。只用自有临时证书、fixture批准、仓库模块和loopback；不读生产凭据、不推送/部署/外部发布。正式确认只有文稿，未自行批准。

下一 **CORE-GATE:L4 DEVELOPMENT**：评估独立账户Opening/状态证明与R01 mark、两域审查、X02/X04/X01/X05/X06及公共kill/C11加入后的当前组合与剩余缺口；保留UNKNOWN、原generation、OPEN和集中度等正确风险拒绝。
