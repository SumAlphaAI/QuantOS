# CORE:X05 当前独立观察对账与 Alert 证据

2026-10-29，DEVELOPMENT；基线`abcea2032a00a53af1438f9c8c2ca96c63a0e7b6`，承接[X01移交](../audit/evidence/core-x01-current-local-20261029/handoff.json)。[范围](../execution/core-x05-current-scope.json)继承19gap/8义务，全部OPEN。仅记录L4-LEDGER-01的本机接续，不授予正式验收、运行或发布准入。

当前来源是：原native不可变事实、X01认证持久账本、独立采集的协议响应journal。独立journal由另一个L02受限进程的自有protocol port在native映射/返回之前保存HTTP状态和原body，绝不从X01投影复制、换名或反推。每次快照由该进程临时TLS证书对应的私钥签名，使用独立版本域；BFF读取owner配置钉住的证书fingerprint和公钥，校验私有普通文件、大小、签名、scope及source ID。它验证独立采集和派生差异，仍是owned协议数据，不是授权真实venue账户的独立余额/仓位books。

只比较已观察的Order/Fill、原币费用、已入账成交的仓位/现金变化。当前无可信mark、初始账户资金及完整books，因此coverage=OBSERVED_EXECUTION_DELTAS_ONLY、fullBooksReady=false、dayCloseAllowed=false、executionAuthority=false始终成立。没有编造mark/权益或把Assisted身份改为Shadow来调用原日结权限；原完整Shadow books/20类模型继续原接口和原范围，真实10交易日/日终目标未执行。

Source bindings同时保存request/Command、native sourceHash和X01 entryHash；report另绑定ledgerHash、签名booksHash及scope。独立响应的clientOrderId按当前native Command的原规则校验，HTTP状态、成交合计、订单/Fill身份与原币金额都参与验证。原X01和独立protocol raw分别计算，才能发现映射/入账差异；不能复制一个累计投影当作两侧一致。

UNKNOWN即使另一侧已观察到完整Fill，也保留X01隔离与OUTCOME_UNRESOLVED，并补充QUARANTINED_BOOK_OBSERVATION证据，不自动入账、重置预算或补发。旧无journal及非报价币同样保留未决义务，不把缺失或未入账解释成零。books缺失/签名错误按UNAVAILABLE报告并形成开放证据，过期按STALE；不刷新capture时间冒充新观察。已验证来源的revision回退/同高度分叉或前缀改变拒绝，None不清除先前高水位。

对账历史与Alert证据在同一认证`reconciliation.json`事务中保存，恢复从来源/ledger checkpoint重放，校验hash链、anchor及当前scope。approvals另存reconciliation anchor，当前进程也保留高水位；同输入重复读取不新建frame/证据。原子求值失败不发布部分状态。source不可用后恢复匹配也不关闭旧Alert证据，状态始终OPEN；没有ack/close/day-close/submit接口。这里只提供持久同源出箱，现有C11/X06 Alert消费、通知、投递确认与义务关闭尚未接入，不记作已送达或已关闭。

公共只读`GET /v1/assisted-testnet/reconciliation`沿用当前C01/原生scope、角色和server flag；契约1.20.0。P11通过显式reader capability读结果，校验完整scope、native/X01绑定、未决数量和Alert引用；损坏/错绑/503清除旧快照。C10仍用原native sourceHash/fillId和5节点链，不把可变对账结果重写进旧审计事件。

DEVELOPMENT验证仅当前模型、原X05直接20类模型/worker、受影响X01/native读取、L02自有mTLS响应路径、公共权限与持久恢复、P11/C10/默认关闭浏览器和必要构建/静态。不重跑全部上游，不执行F05/F07 campaign或实际数据库。单主机owner HMAC、文件锁/fsync和anchor不是跨主机/目标数据库事务，也不抵抗有权回滚整目录/密钥的操作者。真实IdP/MFA、Vault/Supabase/RLS、实际venue books/mark/testnet、异步回报/费用转换、目标性能/安全/长稳/同SHA CI、人工无障碍、完整联调/发布/M5均NOT_RUN。

工程Gate目标PASS_CURRENT_X05_OBSERVATION_RECONCILIATION_ALERT_EVIDENCE，以[冻结证据](../audit/evidence/core-x05-current-local-20261029/README.md)实际结果为准；实现IMPLEMENTED_PENDING_ACCEPTANCE，完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。入口`node scripts/core-x05-current-review.mjs --run docs/audit/evidence/core-x05-current-local-20261029/attempt-NN`需新目录/已提交输入；复核`node scripts/core-x05-current-review.mjs --verify`。

下一CORE:X06 DEVELOPMENT：将该OPEN证据接实际公共Alert/审计工作流，保留原Source/ledger/books/report链和UNKNOWN，权限确认与关闭必须独立，不因观察重新匹配自动解除。
