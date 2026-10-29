# CORE-GATE:L4 DEVELOPMENT：当前风险闭环后组合评估

基线为 `b94891b32ff83e9d51dae0aca44a74731acb705f`，接最新 CORE:L04 / L4-CURRENT-REVIEW-EXECUTION-01 移交。当前任务只评估组合与剩余缺口，新增评估器、原生公共组合测试和证据；不改变运行时代码、额度、权限或 UNKNOWN 恢复规则。历史包逐字校验并标为 ORIGINAL_SCOPE_ONLY，不对已变输入运行旧门禁，也不把历史结果改绑新源码。

工程 Gate 目标 `PASS_L4_CURRENT_RISK_APPROVAL_EXECUTION_CONTROLS_AND_GAP_ASSESSMENT`，以冻结实际执行为准。DEVELOPMENT 评估 COMPLETED_CURRENT_SCOPE；完整 Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。19项 gap / 8义务仍 OPEN，159规范阶段不变，原200 venue场景、50获准testnet审批旅程、100%目标审计、四类目标演练等量化分母不变。两项当前受控代表性测试不替代这些目标。

## 本轮具名组合

1. 在实际 BTC 原生入账后，当前 X01 精确参考估值→新 X02 签名风险→不可变 ETH Proposal→两人独立 MFA；公共 C11 Owner MFA/CAS off 时拒绝 IO、on 到 version2 后才能发当前 Command。Command 原 generation0、source/ledger/snapshot、原审批截止和当前 C11 version2/head 一并绑定；不是将 version0 bootstrap 冒充公共授权。实际 L02 mTLS 进程/owned 协议产生 ETH Fill，X01累计两条入账；独立观察故障产生 OPEN Alert，恢复观察只恢复比较结果，不关闭原 OPEN。
2. 同一个 accepted Command 在公共全局/账户 kill、C11再 off/on、冷恢复、分层独立审批解除中保持原签名/generation、Command/Fill/ledger/C10、Proposal及快照预留不变。当前 kill generation0→4、C11 version0→4；显式新的参考 mark/version 与 generation4 使同一原 Proposal 获得新 eligible RiskDecision，另起零审批的新 Subject 并取得两次新 MFA 后，仍因已执行 Proposal 预留得到 STATE_CONFLICT，没有第三次 IO。参考 BTC mark2200 是明示 owner 测试来源，不修改原集中度/金额规则，不授权真实资金。
3. 另一个当前风险 Command 在 zone 实际提交后 BFF 死亡，恢复 UNKNOWN；已知 BTC入账1条，当前ETH隔离1个，两条 OPEN Alert。公共 C11到version4、账户kill到generation1、重启与显式独立解除到generation2，均不能改签原generation0、清除预留/隔离、产生估值或补发。独立观察已见成交也不自动记账/关闭。

两项测试是两个独立 owner 临时域，各自同一 request/command/source/ledger/Alert 的连续观察，不能跨案例拼成同一业务主体。C10 payload/hash与原请求链明确核对。Ack/unack 当前 Assisted 域拒绝，不能据此声称人工确认/关闭工作流完成。

## 剩余范围与排序

| 义务 | 当前有界进展 | 尚未完成 |
| --- | --- | --- |
| L4-CURRENT-SOURCE-01 | 当前估值→签名 RiskDecision→独立审批→受限 IO；新代次再评估仍不能重发已执行 Proposal | 当前真实 Research/R04、获准资金/R01/IdP/venue来源；一般订单生命周期/分布式预算 |
| L4-LEDGER-01 | 原生事实/X01→独立协议观察/X05→只读 OPEN Alert/C10，跨当前控制保留 UNKNOWN | **完整账户 books 输入协议及覆盖范围/账户/来源/时效绑定**；异步成交、异币费用、外部资金/负债/FX/open-order风险预算、外部通知/确认/明确审查关闭 |
| L4-NATIVE-CONTROL-01 | 当前签名风险 Command 与公共全局/账户停止、独立显式解除同源，原 generation不改签 | 所有实际账户/跨主机、目标撤单/停止时延、外部单调锚、真实DB/Vault/身份/venue |
| L4-C11-ACTIVATION-01 | 当前 IO绑定公共version2；off拒绝，后续version4不解除kill或清除UNKNOWN | 实际目标/身份/多账户跨主机及一般治理范围 |
| L4-IDENTITY/PERSISTENCE/TESTNET/RELEASE | 本轮不重复冒充目标验收 | 各自保持原准入与 NOT_RUN，不由 owned mTLS 或本机文件锁替代 |

下一可执行任务 **CORE:X05 DEVELOPMENT / L4-INDEPENDENT-BOOKS-01**，属于既有 L4-LEDGER-01，不新增阶段或分母：定义并接入独立账户 books 输入端口，显式声明覆盖范围、账户/source/version/时间、仓位/现金/费用，与当前 X01 账本核对；缺失、过期、分叉、UNKNOWN均拒绝完整一致/日结/关闭。不得从 native/X01 反推“独立 books”，不得新增 submit 或自动关闭。先完成受控协议与拒绝/恢复测试，实际获准 provider/目标验收另行办理。

## 运行和证据边界

[机器评估](../execution/core-l4-current-risk-assessment-20261029.json)、[本轮证据](../audit/evidence/core-l4-current-risk-local-20261029/README.md)。当前验证只执行新增两项组合和直接 Gate/计划/生成/盘点/no-submit/编译/静态回归，不重新验收全部组件或 F05/F07 campaign。UI未修改，最新L04的4项Chromium与其他组件证据只在原 SHA/范围引用；本轮浏览器 NOT_RUN，不声明新源码 UI、全业务 INTEGRATION 或发布通过。

```sh
pnpm assess:core-l4:local --attempt=attempt-01
pnpm check:core-l4:local
pnpm test:core-l4:gate
node docs/audit/evidence/core-l4-current-risk-local-20261029/verify.mjs
```

每个 attempt 必须全新，源码/输入/二进制/命令/原始输出和失败均保留。旧 package 入口指向过期1.23评估，现同步到本轮评估器；旧脚本和历史包保持原字节/作用域，不用来评估当前源码。

当前仍是参考 C01/F06、owner 现金/mark、owned signer/协议及临时 mTLS、本机认证文件/fsync/协作OS锁。不能抵抗整个 owner目录/密钥/宿主共同回滚，不证明Supabase/Vault/RLS、跨主机原子性或真实testnet。真实金融/市场/身份/目标、完整books、外部通知/确认/审查关闭、安全/容量/时延/长稳/同SHA CI/发布和人工无障碍均未验收。禁止生产凭据与外部发布。

诊断记录保留：尝试用非Git字符串标识未冻结样本时，现有S03来源守卫正确拒绝启动；未改守卫，随后使用实际checkout SHA，但整体仍标 UNFROZEN_DIAGNOSTICS，不作为当前源码验收。该次未产生样本导致提前执行的评估负例缺夹具失败，及 structuredClone lint 声明失败均保留；完整样本生成和修复后的新检查通过，最终仍须冻结后新attempt。
