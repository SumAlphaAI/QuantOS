# CORE:X01 DEVELOPMENT / L4-VALUATION-RISK-INPUT-01

基线 `b8fdfdfacacaeeed885ef014f25827e44b8a3dd2`，接最新公共 kill/C11 后 L4 移交。本项把当前不可变 native/X01 账本接到精确估值、gross/net exposure 与来源/时效绑定风险输入快照；不生成新 RiskDecision/Proposal，不重签原审批/Command，不解除 kill 或 UNKNOWN。正式目标与历史结果保持原范围。

## 来源与计算

`quantos_portfolio::native_valuation` 使用 Decimal 字符串和账本原精度运算，不经 f64 转换；平均成本沿用原账本Decimal有界除法，不声明无限精度。不以成交价或平均成本代替缺失 mark。`quoteCash=已认证期初现金+native已入账现金变化`，`equity=quoteCash+净持仓市值`；gross 是逐持仓市值绝对值之和，net 为有符号之和。未实现 P&L 使用数量×(mark−成本)，今日已实现 P&L 包含显式来源提供的期初今日 P&L 与当前账本已实现值/费用；不默认为零。UTC 跨日拒绝，不自动清日损或预算。

本机自有参考来源端口是同一私有 owner MAC 域的 `valuation-input.json`，由既有 DurableStore 校验普通文件/权限/MAC；无环境或公网回退。来源固定 `owned-reference-valuation:v1`，明确 `OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET`。这验证受控来源端口和业务计算，不代表真实 R01 市场许可/行情、真实账户资金、托管或独立账户 books 已验收。未提供已认证端口时返回 SOURCE_UNAVAILABLE，不合成初始现金、mark 或零 exposure。

来源必须绑定 tenant/workspace/account、USDT、当前 ledgerHash/anchor、不可变空账本起点hash、期初时间/现金及今日P&L引用、账户状态/时间、现金覆盖时间，以及逐symbol mark价格/来源引用/质量/时间。基线仅适用于显式声明的 `EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS`，没有外部入出金、债务、期初持仓或跨币转换。其他账户范围不由该声明推断。

source version 从1顺序递增；同version仅允许完全相同内容，禁止改时间续期、改基线重置资金或回退。跨缺失mark版本仍保留逐symbol时间高水位。所有有效期半开，来源租约最长30秒，风险快照截止取来源、账户状态、现金覆盖、逐mark freshness及UTC日终的最小值；GET 不刷新 generatedAt/expiresAt。sourceHash、ledgerHash/anchor、scope、current kill generation、原输入版本和snapshotHash共同绑定。公开hash仅绑定内容，不能替代来源认证或授予执行权。

## UNKNOWN、权限与持久恢复

未建模的在途/部分成交订单资金预留也拒绝风险快照（OPEN_ORDER_RESERVATIONS_UNMODELED），不将未成交数量视为自由预算。UNKNOWN、缺journal或异币费用隔离时整份风险输入拒绝，返回 `UNKNOWN_OR_QUARANTINED_OBLIGATIONS`，不返回旧/部分的 equity/exposure 或 snapshot，也不推断零成交/零费用。已观察的Fill、隔离条目、签名预留、原generation和OPEN Alert原样保留，不补发、自动入账、自动关闭或预算重置。原 ledger 的 valuationReady=false 继续表示其仅是成交观察账本，不把该历史接口改成完整估值。

`GET /v1/assisted-testnet/valuation` 是当前C01/native读取权限下的只读接口，API1.24.0；状态/截止与当前数据快照分开表达。READY 仅表示当前 owned reference 数据在声明范围完整，executionAuthority恒false。缺来源、缺/过期mark、跨日或隔离返回明确blocked结果且snapshot缺席；错域、同版本篡改、回退、基线替换、算术溢出或损坏持久状态拒绝。查询参数/GET正文不接受资金或mark，POST无写入口。暂停/停止不解除当前读取授权，也不因此授予新交易权限。

来源版本与内容寻址快照追加在既有认证 approvals checkpoint 的 valuation 字段，同一durable事务保存后才应答。原来源/快照不删除，均有512条上限，32MiB持久文件上限；满额失败不淘汰旧事实。恢复按当前不可变账本的历史前缀重算原快照，校验来源/数值/hash/原期限；hot恢复检查已提交来源及快照前缀，失败写入不会把候选版本当作已提交高水位。真实写入拒绝返回503，不发布新快照；冷恢复读取最后持久版本，来源再次读取仍须显式当前有效。原durable事务取消保护继续完成同一已派发事务，不重试handler。

同主机认证文件/协作锁不证明目标数据库事务、外部单调锚点或全目录/密钥/宿主共同回滚防护。当前读取可能因真实文件写失败或恢复冲突暂时拒绝，不能以可用性为由放宽单调性或重签。实际目标持久化/多账户跨主机/真实身份与市场资金来源、完整book/估值/异步成交/FX、容量长稳安全/同SHA CI/发布均NOT_RUN。

## 本轮验证与移交

只执行当前17项估值模型、10项原native账本回归、当前BFF权限/来源函数、受影响共享恢复/kill/C11/UNKNOWN真实本机进程、当前契约/生成代码/类型/既有账本消费者和评估器负向检查；不递归全链Gate、全仓或F05/F07数据库campaign。本项无新Web页面，不把历史浏览器结果改绑当前源码；既有L4的2项axe incomplete及人工/全浏览器义务保持原范围待办。

工程Gate目标 `PASS_CURRENT_LEDGER_SOURCE_BOUND_VALUATION_RISK_INPUT`，以[冻结证据](../audit/evidence/core-x01-valuation-local-20261029/README.md)为准。[机器范围](../execution/core-x01-valuation-scope.json)继承19gap/8义务全部OPEN；IMPLEMENTED_PENDING_ACCEPTANCE，完整Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY，159规范阶段/原量化分母不变。正式文稿待用户确认，不自批。

下一 `CORE:X02 DEVELOPMENT / L4-CURRENT-RISK-REFRESH-01`：显式消费当前精确风险快照、scope/ledger/source哈希、当前generation和原截止，接新风险决定与同一不可变Proposal；旧f64种子/旧审批不能静默改绑。当前已有入账或UNKNOWN时的新Command继续拒绝，必须由后续新风险/审批链明确接续；本项不放行。

入口：`pnpm assess:core-x01-valuation:local docs/audit/evidence/core-x01-valuation-local-20261029/attempt-NN`、`pnpm check:core-x01-valuation:local`、`pnpm test:core-x01-valuation:gate`；必须新目录和冻结已提交源码。
