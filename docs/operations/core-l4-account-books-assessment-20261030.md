# CORE-GATE:L4 DEVELOPMENT：独立账户 books 后的当前组合

基线 933aa90ab9d3d81aad36f8900d7ace932b12e5a3，接 [X05 移交](core-x05-account-books.md)。[机器评估](../execution/core-l4-account-books-assessment-20261030.json)与[证据包](../audit/evidence/core-l4-account-books-local-20261030/README.md)共同记录本轮实际源码、输入、命令、结果与缺口。本轮修改测试组合、门禁及文档，运行时代码相对基线保持逐字节一致；不是完整业务联调、目标环境或发布验收。

## 两个同源场景

成功场景以一个当前 owner 域从真实本机 BTC native Fill/X01 入账开始，经过 X01 明确参考估值、新 X02 签名 ApprovalRequired、不可变 ETH Proposal 的新 Subject 独立双 MFA，公共 Owner MFA/CAS C11 off 拒绝、version2 允许实际 mTLS Command。两个已知成交进入当前 X01；另一个独立签名账单侧按场景明确写出 BTC1/ETH1/USDT7999.98/费用0.02，不读取 X01 财务、native Fill 或协议回报生成另一侧。当前独立账单覆盖/来源/版本/原期限核对为 MATCHED_DECLARED_ACCOUNT_BOOKS，fullBooksReady/dayCloseAllowed/executionAuthority 仍 false。

新账单版本分别注入仓位2、现金8000、费用0，产生三类财务差异，经公共 Alert 和共同 C10 消费。显式新版本修正只恢复声明范围一致，三条 OPEN 保留。随后在同一账户跨全局/账户 kill、C11 再启停、冷恢复与显式独立解除，当前 generation0→4、C11→4；原 generation0、Command/签名、Proposal/snapshot claims、账本、请求 C10 和 OPEN 财务证据不变。控制后的账单使用显式签署的新版本4，不能将旧租约静默续期。同一已执行 Proposal 在当前 generation4 上获得新风险决定、新零审批 Subject 和双 MFA 后，仍 STATE_CONFLICT，无第三次 IO。

UNKNOWN 场景是另一个独立 owner 域：先前 BTC 已知入账，第二个当前 ETH Command 已在实际本机 mTLS zone 提交，BFF 在回复前死亡；只通过 GET 恢复 UNKNOWN。独立账单即使声称两次成交，仍1笔已知入账/1命令隔离/3条 OPEN、不可用估值。公共 C11 到4、账户 kill 到1、冷恢复并独立显式解除到2，原 generation0/Command/claims 保留。读取独立账单不是确认丢失回复的权威，不补发、不推零、不自动关闭。两个场景不能跨域拼成一个账户。

公共 Alert 的账户级 finding 使用 binding=null，不虚构 Command；财务 Alert/C10 与 C11/kill 当前审计内容和 payload hash 都按实际读取核验。原请求的 C10 不因新账户事件而改写。默认只读 ack/unack 仍拒绝；本轮不实现通知投递或审查关闭。

## 当前确认的下一缺口

**L4-BOOKS-RISK-ADMISSION-01：X05 账户核对尚未进入 X02 风险准入。** 同一成功场景在账单仍有三类差异/三条 OPEN 时，显式提供新的有效 X01 估值快照，当前 X02 仍可形成 ApprovalRequired。本轮仅观察这次新评估，未在差异期间继续审批或执行；控制/新审批/重复 Proposal 拒绝在账单已显式修正之后验证。该事实表示现有受控风险输入合同尚未接入账户 books/OPEN 义务，不能将只读账户核对当成交易放行，亦不表示真实环境获准执行。

下一 CORE:X02 DEVELOPMENT 应把当前核对的 scope、独立来源/hash/version、覆盖、原始期限以及未决财务义务，作为显式新风险评估及新 Subject 的来源绑定；缺失、过期、分叉、不完整、有差异、UNKNOWN 或未审查解除的义务均须明确拒绝。IO 前重新核对，不继承原审批、不重签旧 Command、不复用原 Proposal 预算、不放宽限额。匹配恢复不能自动清除 OPEN 或解除 UNKNOWN。此接续归属既有 L4-CURRENT-SOURCE-01/L4-LEDGER-01，**不新增分母、不关闭原义务**；后续显式审查流程与真实账户/来源/目标准入另行验收。

## 当前与历史证据边界

最新 X05 冻结源码 e12e95f2c5b7dbe793fd93f03ce4e7c828665d4c 的1880输入/37原始文件只按原 Git blob/哈希验证，保持 ORIGINAL_SCOPE_ONLY，不对变化后的源码运行旧 Gate 或改绑旧3进程/55消费者结果。原 L04 浏览器等继续原 SHA/范围。本轮未改变 UI/生成契约/API1.28.0，浏览器与完整消费者重验 NOT_RUN；20条关键 runtime 绑定及全部相关 runtime 路径空差异检查用于说明范围，不冒充当前浏览器执行。

本轮直接验证只包含两个新同源组合、机器评估/门禁反例、必要构建/Clippy/fmt/ESLint、计划/生成/PRE-04/no-submit 和阶段拒绝。其余22个既有 process 案例按影响范围过滤，不计 PASS；不递归全仓/全部上游/F05F07 campaign，不读取私有 dotenv，不连接数据库或外部 venue。原目标分母保持200 venue场景、50实际授权审批旅程、四类目标演练及其他原目标；两个 owned 场景不替代它们。

## Gate 与未执行项

工程 Gate 目标 PASS_L4_ACCOUNT_BOOKS_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT，实际结果以冻结证据为准；DEVELOPMENT 评估 COMPLETED_CURRENT_SCOPE。完整 Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY；159规范阶段、19gap/8义务 OPEN 不变，正式评估文稿待用户确认，不自行批准。

真实金融/账户资产全集/资金/市场/R01/Research/R04/IdP、Supabase/Vault/RLS、实际 testnet/外部单调锚/多账户跨主机、异步成交/非报价币费用/FX/外部流/负债/在途订单预算、books 风险准入、通知投递确认及显式审查关闭、10交易日/20目标差异/15分钟定位、安全容量长稳/同 SHA CI/发布与人工无障碍仍未验收。临时 signer/参考 MFA/单主机认证文件不能证明真实目标准入，也不防 owner 整体回滚目录与密钥。未使用生产凭据，无 push/部署/外部发布。

当前入口：`pnpm assess:core-l4:local`；冻结验收复核：`pnpm check:core-l4:local`。独立新 attempt 记录源码/原始日志/二进制/签名账单与缺口，历史失败/诊断保留，不把 NOT_RUN 变成 PASS。下一可执行任务为 CORE:X02 DEVELOPMENT / L4-BOOKS-RISK-ADMISSION-01。
