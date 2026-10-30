# CORE-GATE:L4 DEVELOPMENT：cash-only 与双来源当前组合评估

接[最新 X01 移交](./core-x01-cash-only.md)，main基线 `9b9628ce3d9ce631316eb3607148c90cd6d59719`。本次只增加当前组合测试、机器评估、Gate和文档，业务运行时/权限/API/Terminal与X01保持逐字节一致，拒绝运行时代码差异。API1.34.0 /160 operations /180 schemas、PRE-04 1100字段行不改。见[机器评估](../execution/core-l4-cash-assessment-20261030.json)、[证据](../audit/evidence/core-l4-cash-local-20261030/README.md)。

## 当前结论与分离的拒绝原因

认证现金账户估值与当前风险来源的桥接已经实现。原“cash-only首次入口未接入”只保留为旧SHA事实，不再作为当前缺口；此结论不消除原19gaps/8规划义务的真实目标与业务全量范围。

当前执行六条具名进程场景：

1. 双来源成功：分别批准账户Opening/status与R01/F03 mark，不同用途和公钥共同绑定原Opening、当前raw/账本/风险。同一不可变Proposal经来源健康与财务两域独立审查、新风险/新Subject/订单双MFA、公共C11关闭拒绝后version2实际loopback mTLS/native ETH IO；两笔已知入账与独立books匹配，原4 OPEN保留。公共全局/账户kill和独立解除至generation4、C11到4/冷恢复后原命令generation0、证明、签名和claims不改。当前连续来源version2以原1100 mark评估仍集中度签名Deny，无第三IO/新预留，不改价或限额强求ApprovalRequired。
2. 双来源实际丢响应：ETH提交后BFF死亡，冷恢复UNKNOWN；独立books声称成交不能将其转已知。公共控制至2/C11到4后仍1已知/1隔离/7 OPEN、原generation0/证明/claims保留，两个新审查入口拒绝，无可用估值，不补发或自动关闭。
3. 保留原basis OPEN的现金账户：另一个从未成交的fixture，先前独立books缺basis产生1条BASIS_UNAVAILABLE OPEN；批准账户Opening10000/status使当前空仓Snapshot与独立books账户层MATCHED，gross/net/unrealized0、现金=权益10000。无R01 flag/policy/artifact/mark或参考seed，当前X02绑定同一Proposal签名Deny、无Subject，冷恢复同key返回原决定、claims不变。原OPEN仍blocked=1/financial=0/sourceHealth=0，两域均不可审查。风险同时包含集中度和账户义务拒绝；不能将来源恢复等同于义务解除。
4. **新增加的独立对照**：另一个全新目录/证书/账本的无成交账户，先发布批准原basis再做首次对账，从未产生该OPEN，未删除/重置前一场景历史。独立books MATCHED、0 OPEN、账户准入ELIGIBLE_REFERENCE_BOOKS，但同一ETH Proposal仍签名concentration Deny，无Subject/claim/IO，冷恢复同key原决定保留。现行规则为 `symbolAfter > grossAfter * maxSymbolConcentration`；零持仓下首个正notional单一symbol占新增gross100%，因此当前限额下拒绝成立。它是现行风险策略边界，不能记成来源故障、靠删除OPEN解决，或改用cash/equity分母、合成成交/多腿承诺、假mark、放宽限额来通过。是否支持初始组合准入须另行明确策略及原子/中间态风险，不由本评估授权。
5. 现金账户坏签名/缺产物/改raw现金/撤销/冷恢复旧head拒绝，无缓存兜底。
6. 现金账户原期限后的暖/冷拒绝，不续期，原账户来源/快照历史不改。

两条cash-only风险Deny的IO=0是已执行的拒绝证据，不计成功交易；双来源两场景分别含实际2次owned协议IO，验证传输并未被禁用。所有fixture相互独立，持久事实与历史OPEN/UNKNOWN均在各自原范围保留。

共同C10保留原风险与来源/控制审计及payload hash；X01修复的风险事件读投影去重继续覆盖现金冷恢复回放。此次不增加风险/审批/审查/关闭/重试入口，也不扩展现有两域allowlist。

## 范围、验证与Gate

当前机器评估保留159规范阶段、原依赖和开发状态、19gaps/8规划义务OPEN、200venue/50授权旅程/4部署演练分母与限额。工程Gate目标 **PASS_L4_CASH_ONLY_AND_DUAL_SOURCE_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT**；DEVELOPMENT评估COMPLETED_CURRENT_SCOPE，以冻结具名执行为准。完整Gate **NOT_READY_GAPS_OPEN** /stage NOT_ASSESSED /formalAccepted=false /runtimeAdmission=DENIED /M5 PREPARED_NOT_READY，fullBooksReady/dayCloseAllowed/executionAuthority=false。

`node scripts/core-l4-cash.mjs --run --attempt=attempt-01`，只读 `node docs/audit/evidence/core-l4-cash-local-20261030/verify.mjs`。当前4个cash/2个dual公共HTTP/native组合、机器评估与Gate反例、必要build/Clippy/fmt、计划/生成/PRE-04/no-submit、DEVELOPMENT下一入口和INTEGRATION/RELEASE预期拒绝、秘密扫描正/负canary。运行时/UI字节未改，不递归重跑最新X01的157Rust/291消费者/102Gate、全仓、F05/F07或三轮构建；当前浏览器/人工无障碍NOT_RUN。

最新X01源码3c85c7d1主清单2083输入、10份历史模型fixture其中8份补充、去重2091输入/79原始文件、20检查与原预检失败/ignored/NOT_RUN均以原Git blob/hash保留为ORIGINAL_SCOPE_ONLY，不改绑当前PASS。当前输入清单在源码冻结前覆盖明确引用的fixture路径；前次额外fixture校验是历史范围，不作为当前执行替代。真实资金/状态/账户全集/live许可R01/Research/R04/IdP/MFA/Supabase PostgreSQL/Vault/RLS/outbox/跨主机/外部单调锚、真实venue/FX/外部流/负债/在途预算/日切/通知/源关闭、安全容量长稳同SHA CI/发布与浏览器人工无障碍未验收或NOT_RUN。无生产凭据、推送、部署或外部发布，正式确认仅准备文稿，不自行批准。

## 下一可执行任务

**CORE:X06 DEVELOPMENT / L4-BLOCKED-OBLIGATION-EXPLAIN-01**。当前Terminal已有原始Deny规则与通用“未审查核对事项”文案，但恢复后的books、原不可审查basis OPEN、两域真实分类及与单独集中度Deny的区别缺少同源只读说明。接当前ledger/source/generation/decision/obligation hash和原截止，明确为什么已有审查入口不能处置，拒绝过期/异scope证据。不增加审批/处置/豁免按钮、扩大审查、自动关闭或放宽限额；UNKNOWN保持查询和原证明/claims。独立basis处置或初始组合风险策略须另行任务和授权，本次不预授权。
