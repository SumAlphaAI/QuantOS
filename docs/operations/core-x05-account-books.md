# CORE:X05 / L4-INDEPENDENT-BOOKS-01

本轮为 DEVELOPMENT 当前功能接续，基线 8d929c70388f31aa24d4b830eeb20d191c958048。原 L4 [移交](core-l4-current-risk-assessment-20261029.md)仍属于原 SHA/范围；[机器范围](../execution/core-x05-account-books-scope.json)保留19 gap/8义务 OPEN、159阶段、200 venue 场景/50授权旅程/原目标演练。冻结源码、实际命令/结果及文件摘要由[验收包](../audit/evidence/core-x05-account-books-local-20261030/README.md)记录。

## 独立输入与比较口径

受控 owner 目录新增私有普通单链接 `account-books.json`，上限4MiB，格式 `{payload,signature}`；payload 对应 `quantos_reconcile::account_books::Books`（camelCase、拒绝未知字段）。签名为钉住的独立 observer 证书公钥验证的 RSA/SHA256，canonical JSON 域 `quantos-x05-independent-account-books-signature/v1`，不同于原协议 journal 域。sourceId 必须等于 owner 配置的证书 SHA256 指纹；公网页面不能上传账单、期初资金或签名权威。文件缺失、坏签名、跨域签名、symlink/宽权限/多链接/坏JSON作为 SOURCE_UNAVAILABLE，不重用旧匹配。默认无此输入时只报告未具备；建立过独立账户来源后丢失会追加 OPEN 证据，永不清空来源高水位。协议 journal 保持独立原口径。

账单必须声明 scope(tenant/workspace/account)、sourceId/sourceRef、version/previousHash、coverage、已排序且唯一的 positionUniverse/cashUniverse/feeUniverse，以及 positionsComplete/cashComplete/feesComplete、externalFlowsAbsent/liabilitiesAbsent/openOrdersAbsent。每一余额行包含 asset/amount/sourceRef。periodStart、coverageThrough、capturedAt、validUntil 都由签名原文绑定；区间截止不晚于采集、不晚于当前时间，租约不超过30秒、半开区间到期即拒绝，coverage 也须在30秒内，不能靠查询续期。当前 native 的每个来源、订单和 Fill 都须落在声明区间，无未结束订单/隔离；只覆盖旧快照不能冒充当前账户。

本轮显式支持 `SPOT_EMPTY_ORIGIN_NO_EXTERNAL_FLOWS_QUOTE_FEES`：空持仓起点、BTCUSDT/ETHUSDT 两仓位、USDT 一现金及一期累计费用，显式无外部流、负债及未结订单。非支持资产/币种、费用转换、外部资金/FX/负债/订单预算/跨范围迁移不推算；声明不完整或余额缺行拒绝，必须显式写零才是已观察零。coverage 和 universe 首次注册后固定，不能在后续版本缩减分母换取匹配。

本地侧期初资金只取 X01 已认证、持久注册并按当前账本验证的首个 valuation input 的不可变 origin，保留原 sourceHash/cashSourceRef/openingAt/空账本 hash；不从独立账单选取期初资金，不以当前 mark 或成交价填补期初。先前已接受的期初来源不因 mark 过期而被重新签发或续期；这里仅复用该不可变期初，不产生可用风险快照。缺少期初来源拒绝现金核对。期末本地现金=已接受期初现金+X01精确现金变化，仓位=当前已入账数量，费用=本期X01报价币费用累计，均按 Decimal 精确运算，溢出/精度丢失拒绝。独立账单测试侧按已知场景手工编写余额，绝不读取 X01 财务字段、native Fill 或 observer body 来生成另一侧。

## 持久历史、公开报告与 OPEN 义务

首次版本须1/previousHash=null；后续须前一版本+1及准确前序内容 hash，采集与覆盖截止不回退，同版本逐字节相同才幂等。账户/来源、期初 authority、期间起点、coverage/universe 不允许改写；拒绝不能部分注册版本或 OPEN outbox。缺失不抹除高水位；原生 ledger/hash/来源绑定继续原验证。重放同一 frame 重算账户报告与来源链，验证原 hash/序号/anchor；保留历史不带新 optional 字段的 frame 原 hash，不回填新字段到历史。

现有 GET `/v1/assisted-testnet/reconciliation` 新增 optional accountBooks（API1.28.0，150操作/165schema）。原顶层 comparisonStatus/findings 仍表示协议观察，账户状态单独表示，不能把协议 MATCHED_OBSERVATIONS 误当账户匹配。报告绑定独立 statement hash/version/ref、期初 basis hash、当前 ledgerHash、原期间/期限与 sourceTrust。`comparisonReady` 表示可比较输入齐备，差异时状态 DIFFERENCES；只有 MATCHED_DECLARED_ACCOUNT_BOOKS 表示声明范围核对一致。fullBooksReady/dayCloseAllowed/executionAuthority 始终false，不授予日结、风险决定或执行。额外 query/GET body 拒绝；原权限/认证/只读表面保持。

仓位/现金/费用分别产生 ACCOUNT_BOOKS_*_DIFFERENCE，账户级 binding=null，不虚构 Command/Fill 关联。OPEN 证据绑定原 finding/statement/ledger/report/scope，进入同一认证 reconciliation checkpoint/fsync，再由现有公共 Alert inbox 与共同 C10 消费。原报告/证据/已消费前缀均保留，恢复匹配不 ack、不自动关闭；之后源过期或消失追加新的 OPEN。财务差异不能当作自动资金调整、入账补偿或当前风险许可。UNKNOWN 优先：即使独立侧声称成交，仍1个原命令隔离、原 generation/签名/Proposal及snapshot claims 保留，不补发、不推零、不建立新风险快照。

## 验证与剩余边界

运行 `pnpm assess:core-x05-account-books:local` 前先冻结代码；每次用新的 attempt 目录，源码/输入/二进制、具名命令/日志、三份实际进程结果和签名原文逐一绑定；`pnpm check:core-x05-account-books:local` 验证封存。测试包括当前模型/历史协议直接回归、X01 valuation、三个实际 BFF/独立 mTLS zone 场景、当前 L4 两个直接回归、生成 schema/Terminal Alert 消费者及编译静态。未改UI，不重跑无关浏览器/上游全闭包/F05F07 campaign；额外未执行项保持NOT_RUN。首次诊断失败保留在 preflight/observations.json，不把修复后结果覆盖为初次通过。

工程 Gate 目标 PASS_INDEPENDENT_ACCOUNT_BOOKS_SCOPE_VERSION_FRESHNESS_FINANCIAL_RECONCILIATION；功能 IMPLEMENTED_PENDING_ACCEPTANCE，完整 Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY。当前为 owned owner-reference 测试账单，签名只证明受控来源与内容，不能证明真实 venue 账户余额或完整资产清单；真实金融/资金/IdP/Vault/Supabase/跨主机与外部单调锚、真实10交易日/20目标差异/15分钟定位、异步成交/非报价币费用/FX/外部流/负债/在途订单预算、通知投递确认审查关闭、安全容量长稳/同SHA CI/发布尚未验收。单主机文件 MAC/锁/fsync不防有权回滚全目录和密钥的操作者。下一 CORE-GATE:L4 DEVELOPMENT 组合与剩余缺口评估。
