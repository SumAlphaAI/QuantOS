# CORE:X04 DEVELOPMENT 当前原生成交来源

2026-10-29；接续基线 `99a9fc42d21981509c6fb851081ef90d9ebf0015`。

本目录记录原生 Fill/Order 经认证持久快照到公共请求查询、P11 和 C10 的同源证据。冻结源码 `c8f1e7302e6f6075619340490b08e358d774834e` 的 [attempt-01](./attempt-01/executions.json) 共27项实际命令均达到预期；3项集成/发布拒绝命令退出1属于预期拒绝，未转为阶段通过。源码、输入、二进制和全部产物 hash 见 [receipt](./receipt.json)；范围结果见 [result](./result.json)。本目录后续证据提交不改绑该源码回执。

工程 Gate `PASS_NATIVE_ORDER_FILL_PUBLIC_SOURCE`；实现 `IMPLEMENTED_PENDING_ACCEPTANCE`，完整 Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED、M5 `PREPARED_NOT_READY`。19 gap/8义务保持 OPEN，全部159阶段状态与依赖不提升。[评审文稿](./review-draft.md)待用户确认，无自行批准。

| 命令/验证 | 当前结果 |
| --- | --- |
| `node scripts/core-x04-current-review.mjs --run docs/audit/evidence/core-x04-current-local-20261029/attempt-01` | 27项达到预期，已冻结 |
| `cargo test --locked --offline -p quantos-execution --test core_x04_facts` | 7 PASS：两笔部分成交、费用/去重、认证重启、过期只读、UNKNOWN、非报价币、权限与损坏/旧回执 |
| `cargo test --locked --offline -p quantos-execution --test x04_oms` | 9 PASS，含10万混合事件、146667事实及46667 Fill溯源的直接OMS断言；非真实venue笔数 |
| 原生恢复、当前X02来源、BFF来源、公共mTLS进程、Audit HTTP | 分别15、15、9、3、14 PASS；合计Rust 72 |
| Vitest 当前消费者 / 全部契约与客户端 | 86 / 113 PASS，零skip；完整参数见executions.json |
| `node --test --test-reporter=tap scripts/core-x04-current-review.test.mjs scripts/development-execution.test.mjs` | 72 PASS，零skip |
| `pnpm exec playwright test --config=playwright.core-l4.config.ts --project=chromium --workers=1 --retries=0 ...` | 4 PASS；正向旅程16.118秒，原30秒限制不变 |
| 类型、ESLint、Rust Clippy/fmt、生成一致性、OpenAPI、计划校验、Rust/Web构建 | PASS；142 operations / 135 schemas，新增3个只读schema，无新操作 |
| axe当前P11/C10/默认关闭 | 3次扫描0 violation；C10 color-contrast 1 incomplete/9节点，不能记作人工无障碍通过 |
| 当前差异与证据 gitleaks + 随机canary | 零未审定泄漏；7条精确owned幂等SHA256记录逐条分类，实际canary拒绝1次 |

[真实公共来源](./attempt-01/native-facts.json)验证同一Command/Order/Subject/账户、一笔原生Fill、精确费用及canonical sourceHash；两BFF重启后12请求只产生1次受限进程协议调用，C10同一完成事件引用相同hash/fillIds。原生两部分成交测试还将实际Fill消费到X01内存投影，验证数量1与费用0.2；当前未建立公共持久账本写入，不冒充X01端到端通过。UNKNOWN保留原Command，发生响应丢失/受限进程死亡或BFF提交后崩溃时不重新发单。

[P11截图](./attempt-01/browser/cases/core-l4-CORE-L4-current-P1-9f407-ommon-C10-read-and-recovery-chromium/core-l4-p11.png)与[C10截图](./attempt-01/browser/cases/core-l4-CORE-L4-current-P1-9f407-ommon-C10-read-and-recovery-chromium/core-l4-c10.png)已实际检查；P11可见sourceHash、原始Fill及0.01 USDT费用，C10可见同源字段。共享C10壳仍有UNKNOWN/只读提示，人工读屏、200%缩放和全浏览器NOT_RUN。见[视觉记录](./visual-review.json)。

25份未冻结预检日志全部保留；其中6份FAIL包括类型/旧快照清理、loopback权限、审计事件位置假设，以及新增README尚未落地导致的计划/门禁失败，已修复或在授权loopback下重验。它们只属原始未冻结范围，不是当前PASS；见[预检索引](./preflight-index.json)与[失败记录](./failed-attempts.json)。本轮冻结attempt-01无失败。X02原219文件逐个hash核验，原先两轮30秒超时及历史NOT_RUN原样保留，不改绑当前源码。

实际X01持久入账、X05独立books和Alert闭环仍未接入；异步venue Fill收集、非报价币费用转换、真实身份/MFA/资金源/Vault/DB/RLS/testnet、跨主机、P95/安全/负载/长稳/同SHA CI及联调/发布/M5均NOT_RUN，见[移交](./handoff.json)与[发布清单](./release-checklist.json)。当前single-host owner HMAC文件存储不能证明目标数据库事务或抵抗有权整目录回滚。

复核：`node scripts/core-x04-current-review.mjs --verify`；完整封存复核：`node docs/audit/evidence/core-x04-current-local-20261029/verify.mjs`。文件列表见[变更索引](./changed-files.json)和[完整manifest](./manifest.json)。

范围见[当前 scope](../../../execution/core-x04-current-scope.json)，语义见[规程](../../../operations/core-x04-current-facts.md)。下一任务 `CORE:X01 DEVELOPMENT`；未使用生产凭据或执行外部发布。
