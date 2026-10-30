# CORE:X02 / L4-BOOKS-RISK-ADMISSION-01

后续接续：[CORE:X06 独立财务审查](core-x06-financial-review.md) 增加同源、独立双人 MFA 与原期限内的 financialReview 投影，供显式新风险引用；原 OPEN count/hash 不归零，旧风险/审批/Command 不重签。下述为 X02 原交付范围；历史冻结结果与零未审查义务边界保留原 SHA，不改绑为新审查通过。

本轮接 [L4 当前移交](core-l4-account-books-assessment-20261030.md)，基线 547a36ba4a015b56e6d047c1758a6d1853ad6c6a；实现当前账户 books/OPEN 义务到新风险、新 Subject、审批与 IO 前核对。[机器范围](../execution/core-x02-books-risk-scope.json)及[验收证据](../audit/evidence/core-x02-books-risk-local-20261030/README.md)记录实际冻结源码、输入和结果。历史 L4 的缺口反例只属原源码/范围，不改写为本轮通过。

## 新风险与来源

`quantos-portfolio::books_risk::BooksRiskInput` 是 owner 适配器提供的只读来源合同，不是 HTTP 上传 schema 或执行令牌。X05 从认证持久状态生成它：scope、当前 ledgerHash、reconciliation/account report hash、钉住的独立来源/id/hash/version、期初 basis hash、固定覆盖、原始期间/采集/覆盖截止/validUntil，以及全部未决 X05 证据的 count/hash 和 UNKNOWN 数量。义务从 X05 append-only outbox 得出，不从可过滤/未投递的 Alert 页面或浏览器计数得出。当前采用所有 X05 OPEN 的保守边界，包含财务差异、来源不可用、协议未决等；匹配恢复不删除/关闭它们。

BFF 只接收原 snapshotHash/expectedGeneration。服务端重新读取当前 X01 估值与认证 X05/独立签名账单，构造 NativeRiskContext.books，纳入 RiskGuard 的签名 factsHash。15条原有规则和限额保持；仅在 exact native namespace 追加 account_books 检查，原 Rule::ALL 和 legacy 签名形状不改。缺少来源、过期/时序无效、覆盖不支持、不匹配、协议不匹配、UNKNOWN、OPEN 未审查义务产生明确的额外拒绝原因。可验证财务快照存在时，形成新签名 Deny、无 Subject；若估值本身不可用或源/版本分叉无法认证，则先拒绝请求，不伪造可评估输入。

只有当前闭合声明范围 MATCHED、协议观察 MATCHED、零 UNKNOWN、零 OPEN 且来源仍有效，才继续执行原精确限额检查；这些条件不覆盖/放宽任何旧规则。ApprovalRequired 的原截止收紧为 X01/风险/Proposal/venue 原期限与独立 books 的 min(validUntil, coverageThrough+30秒)，半开区间到期拒绝，不靠读请求续期。book source/hash/version、覆盖及义务 hash 任一变化，即使余额相同，也改变签名事实；旧 key 的恢复不改绑新来源，须显式新评估。

## 新 Subject、审批和 IO

新 Subject 的 nativeRiskBinding.books 投影与其 RiskDecision 私有上下文一致；原审批不继承。open、MFA 前/后审批均重新核对当前估值和完整 books/义务绑定。来源换版后旧请求即使已获一次审批也不能继续第二审批，必须新风险、新 Subject，从零审批开始。

IO 前在现有稳定审批事务/可信估值输入锁下，额外持有 `account-books-fence.lock` 发布者锁，重新读取独立签名原文、X05/当前 ledger/未决义务；只有与已签名的整个 NativeRiskContext 相同才交给原 native 路径。原 Proposal/snapshot 一次性预留、guard/approval/C11/kill 检查和 fsync-before-IO 不变。Command currentRisk.books 随原签名及预留持久化，Command 截止不能超过 books 原期限；恢复会检查同 scope/ledger、原 issuedAt 下的合格性和截止，不能用更新后的当前账单改写旧 Command。

所有公共核对读取也持同一发布者锁，避免把合作发布过程中的半写文件当成来源丢失。open/审批持锁跨当前核对与实际状态变更；风险与审批在取得锁后重新采样时钟，风险决定形成前再次采样。实际阻塞反例验证请求等待发布锁期间原2秒账单已到期，解锁后只能生成 BOOKS_SOURCE_STALE Deny，不能用等待前时间形成过期的“合格”新 Subject。

独立账单发布者必须先取得稳定 `account-books-fence.lock`，在锁内以私有普通单链接文件签名/原子替换并 fsync，再释放；BFF 在预留、实际 IO 和结果保存期间持有同一锁。测试验证另一个线程/发布者在实际第二次 mTLS IO 暂停期间取不到锁，BFF 死亡后才可取得。此协议保护合作的单主机发布者，不抵抗有权忽略协议/整体回滚目录或更换密钥的 owner；跨主机/实际数据库事务另验收。producer 不应同时持有 books 锁并反向等待估值/审批锁。

## 历史与旧入口

新字段使用 default/skip-none：旧 NativeRiskContext 和 currentRisk 无 books 的序列化形状不回填，旧签名/Command/generation/claims/审计仍可按原事实读取。历史无 books 的未执行当前 Subject 不能继续获审批或用新 native 入口执行，必须显式新评估；不是以新规则重签原事实。

原空账本 reference seed 仅保留原本起步范围，没有当前风险放行权：已有任何当前评估/原生入账时，不可退回旧通路。旧 IO 同样持有发布者锁；若原账户 books 文件存在（包括坏文件/symlink）、X05 内存状态或持久 anchor 已存在，即强制当前财务核对，删除文件/冷恢复不能使它变回“未配置”。从未具备账户来源/未观察 X05 的空账本参考 seed 仍只是既有测试启动材料，不等于实际账户资金初始化或本轮 books-bound 当前批准，更不构成生产准入。

## OPEN、UNKNOWN 与公共界面

三类差异→新签名 Deny，无新 Subject；显式新账单修正为匹配后，原三条 OPEN 仍导致 OPEN_FINANCIAL_OBLIGATIONS Deny。无自动 ack/关闭、账务调整、风险放行或补发。UNKNOWN 仍优先隔离，X01 不生成可用快照，实际独立账单声称已成交也不能确认丢失回复；原 generation/签名/预留和书面来源保持，原命令恢复仅 GET。

API1.29.0 / 150操作 / 167schema，新增只读 BooksRiskInput/BooksRiskAdmission 投影、native rule 上限16，Subject/Command 的 books 为 optional 以保留历史可读。客户端、Zod、输入策略和 PRE-04 当前清单同步；当前新评估必须有 booksAdmission。Terminal 显示账户核对原因/账单版本/未决数/原期限，Deny 无发起审批入口；核对新 Subject 和 Command 的一致 books，不能把变化后的来源当成原回执。浏览器未得到上传财务或放行权。风险评估丢回复仍只按原 key/body/CSRF/原期限显式恢复，服务端再核对来源；不自动重新评估。

## 当前功能验收与剩余范围

验收入口 `pnpm assess:core-x02-books:local`；复核 `pnpm check:core-x02-books:local`。当前领域模型包含半开期限、来源/版本/scope/ledger/义务签名与拒绝、原限额/MFA/恢复；实际进程包含成功/新 Subject/OPEN Deny/四类 IO 拒绝/发布者锁与 UNKNOWN/旧入口回退拒绝。审批/IO 共享入口改变，因此直接回归同一 BFF core_l04 的其余场景；未递归全仓/全部上游/F05F07 campaign，不载入私有 dotenv、不连接数据库或外部服务。消费者/契约/类型/静态证明不等于真实浏览器或目标验收，当前浏览器/人工无障碍 NOT_RUN。

工程 Gate 目标 PASS_CURRENT_BOOKS_BOUND_RISK_SUBJECT_AND_IO_RECHECK，以冻结实际结果为准；IMPLEMENTED_PENDING_ACCEPTANCE。完整 Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。159阶段、19gap/8义务 OPEN 和原200venue/50授权旅程/目标演练等分母不变；临时证书、参考身份/资金/mark、限定空起点现货覆盖和单主机文件不是实际金融/账户全集/IdP/Vault/Supabase/跨主机/testnet、安全容量长稳/同SHA CI或发布验收。fullBooksReady/dayCloseAllowed/executionAuthority 仍 false，无生产凭据、无外部推送/部署/发布。

下一 CORE:X06 DEVELOPMENT / L4-FINANCIAL-OBLIGATION-REVIEW-01：设计/接入独立授权、当前同源证据和追加式审查记录，区分原 OPEN 事实与当前可否解除风险阻塞；不得删除历史，不因匹配自动关闭，UNKNOWN 不得凭独立账单或一次 ack 解除。实际通知/目标/正式准入另验收。
