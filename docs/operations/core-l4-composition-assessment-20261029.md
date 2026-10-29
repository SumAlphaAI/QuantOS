# CORE-GATE:L4 当前组合与剩余缺口评估（2026-10-29）

本轮是 DEVELOPMENT 评估，基线 `94e7c2c07c81798b7bd177d395c0211831fa4497`，接续 X06 移交。旧 L4（2026-10-28）及 X02/X04/X01/X05/X06 原始回执保持原 SHA/范围。当前源码的实际命令与新证据单列，不把历史结果改绑，也不宣称四项直接依赖已完整准入。

当前组合：R04 owned record/manifest + X02 签名 assisted_testnet_review/kill generation → 同一公共审批 Subject → 两个独立 reference 身份/MFA → native Command → 实际本机 L02 mTLS 进程 → owned L01 原始协议响应 → X04 Order/Fill → X01 认证持久账本 → X05 独立进程签名观察对账 → 持久 OPEN 证据 → 公共 Alert/P23 → 共同 C10。签名、scope、decision/proposal/subject/command、source/ledger/books/report hash 的关联按当前实际模块与原始输出复核；不能把对公共签名字段的关联检查说成独立公开密钥验证 X02 HMAC。

旧 L4 对“当前 R04/X02 未接”和“公共成交/账本/对账/Alert 未接”的描述只保留当时范围，本轮机器清单记录它们在 owned 本机范围内的接续。两项义务仍为 OPEN：真实财务来源/估值/新风险评估、完整独立账户 books/marks、异步 venue 成交、非报价币换算、外部通知/阅读确认/明确审查关闭，以及目标持久化尚未完成。独立 books 当前只是原始协议观察，不由 X01 克隆；`OBSERVED_EXECUTION_DELTAS_ONLY`，fullBooksReady/dayCloseAllowed/executionAuthority 仍 false。

UNKNOWN 保持查询义务。实际 zone commit 后调用方崩溃的场景，即使独立观察已见 Fill quantity 1，X01 仍隔离、不记账，公共 Alert/C10 保留来源绑定；协议调用保持 1，不补发。恢复匹配、读取、投递去重和进程重启都不会自动关闭 OPEN 证据。受影响恢复覆盖来源/持久状态损坏、缺失、回滚、跨副本并发去重与已写入 inbox/旧审批锚点窗口；只证明单主机协作文件锁和认证/fsync 文件，不证明 Supabase 事务、跨主机或目标恢复。

剩余开发缺口明确分开：

| 原义务 | 当前观察 | 下一步 |
|---|---|---|
| L4-NATIVE-CONTROL-01 | Assisted profile 的公共 kill engage/release 被 `CONTEXT_MODE_REQUIRED` 拒绝；内部 RiskGuard generation 与 native durable stop 各自可测，不构成公共全局/账户控制闭环 | 公共控制绑定当前 X02 generation、原生持久停止和共同 C10，职责分离；不得自动 release 或清除 UNKNOWN |
| L4-C11-ACTIVATION-01 | 公共 C11 feature flag 读取/写入被模式门禁拒绝，当前启用仍来自 owner reference 配置 | scoped versioned activation/history 实际控制运行时并验证权限、时效及恢复 |
| L4-LEDGER-01 | 同源公共只读接续已具备；完整 books/估值及 Alert 处置边界尚未具备 | 继续相应业务接续，不把已读或来源恢复当作解决 |

公共拒绝探针只记录“当前产品接续缺口”，不作为成功 kill 或 C11 启用。现有 kill API 是账户入参，不能由一个被模式拒绝的请求推断全局控制已实现或校验通过。

四项原直接依赖（L4-SERVICE、L03、L04、G8）的计划状态与五份旧范围材料，另加 X02/X04/X01/X05/X06 与前次 L4 的六份组件材料，共 11 份历史来源按原源码 blob/manifest/hash 检查；仅 ORIGINAL_SCOPE_ONLY。19 项继承 gap、8 项义务全部保持 OPEN；当前进展记录在 `currentAssessment`，不覆盖旧观察。159 个规范阶段、分母、要求和空白正式 source_commit 不提升。

本次直接验证：当前 source 授权函数测试、实际 BFF/mTLS/native/X01/X05/Alert/C10 三个进程场景；P10/P11→C10、P23→C10及默认关闭三个 Chromium 场景；相关消费者与两项契约套件、评估器负向测试、必要编译/lint/fmt/计划及阶段拒绝检查。未递归执行全部上游任务 Gate，不运行全仓覆盖率、数据库 campaign、真实凭据或外部环境。当前样本不代表 200 个 venue mapping 或 50 个获准 testnet 独立审批旅程；内部函数的 50 样本 corpus 单独记账。

```sh
pnpm assess:core-l4:local docs/audit/evidence/core-l4-composition-local-20261029/attempt-NN
pnpm check:core-l4:local
pnpm test:core-l4:gate
node docs/audit/evidence/core-l4-composition-local-20261029/verify.mjs
```

必须使用新 attempt、冻结源码和白名单环境，不读取 dotenv；历史旧脚本保留原作用域，当前 package 入口指向本轮评估器。工程 Gate 目标 `PASS_L4_CURRENT_X02_X04_X01_X05_X06_COMPOSITION_AND_GAPS`，以实际冻结结果为准。完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=`DENIED`，M5 `PREPARED_NOT_READY`。真实 IdP/Vault/Supabase/RLS、跨主机、真实获准 testnet、外部通知、部署/安全/容量/性能/长稳/同 SHA CI、完整浏览器和人工无障碍，以及发布均 NOT_RUN。

下一可执行原任务：`CORE:X06 DEVELOPMENT`，先处理 `L4-NATIVE-CONTROL-01` 公共全局/账户 kill → 当前 X02 generation → 原生 durable stop/共同 C10；之后接 C11 版本化启用。无需生产凭据或外部发布；任何正式测试/运行放行仍按独立阶段和授权办理。
