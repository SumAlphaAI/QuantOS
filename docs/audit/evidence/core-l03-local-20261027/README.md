# CORE:L03 当前公共审批、原生权限与 P10/P11 证据

固定候选 **10d13870229a3b9f6325b23fbde3203b466b27d3**；最终 **attempt-01** 的22项限定检查及packet核验通过。工程 Gate **PASS_OWNED_LOCAL_CORE_L03_PUBLIC_NATIVE_JOIN**；开发状态 **IMPLEMENTED_PENDING_ACCEPTANCE**。完整 Gate **NOT_READY_GAPS_OPEN**、stage **NOT_ASSESSED**、formalAccepted=false、runtimeAdmission=DENIED，M5 **PREPARED_NOT_READY**；原19项业务gap保持OPEN。没有生产凭据、数据库、真实testnet、push、部署或外部发布。

## 变更与证据入口

- [完整变更清单](./changed-files.json)：原生AssistedExecution、现有服务审批的side/申请者会话/原MFA期限绑定、公共BFF/1.18.0契约及生成物、P10/P11分流与原请求恢复、测试/规程/两份计划、原始诊断和精确空白例外。
- [机器回执](./receipt.json)、[结果](./result.json)、[实际命令](./attempt-01/executions.json)、[输入](./attempt-01/inputs.json)、[binary](./attempt-01/binary.json)、[Web构建](./attempt-01/terminal-build.json)、[导出文件摘要](./attempt-01/build-artifacts.json)、[核验输出](./verify.log)。
- [范围规程](../../../operations/core-l03-current-function.md)、[19项缺口及进展](../../../execution/core-l03-scope-assessment.json)、[CORE:L04移交](./handoff.json)、[六维待确认文稿](./review-draft.md)。正式确认PENDING，没有自行批准。
- [当前同源/计数摘要](./scope-summary.json)、[实际截图/axe查看](./visual-review.json)、[开发预检索引](./preflight-index.json)。

## 当前实际检查

| 命令/检查 | 最终实际结果 |
| --- | --- |
| `node scripts/core-l03-review.mjs --run docs/audit/evidence/core-l03-local-20261027/attempt-01` | 22项命令符合预期，packet核验PASS |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录当前source与实际binary SHA256 |
| `cargo test --locked --offline -p quantos-execution --test core_l03 --test service_l03 --test service_l03_native --test l4_service_boundary` | 24 passed，0 failed/ignored；当前桥接9项及直接服务/旧原生拒绝15项 |
| `cargo test --locked --offline -p bff-gateway --lib assisted::tests::` | 5 passed，含50组公共Axum审批/原生接续、默认关闭、自批/跨会话/注入/过期、200目录上限原键恢复 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 29 passed，旧Paper/Shadow原拒绝与恢复边界保留 |
| `pnpm exec vitest run …`（16个限定文件，见executions） | 198 passed，0 failed/pending；当前native消费者/拒绝26项及直接旧G8/FEP5等172项 |
| `pnpm exec vitest run tests/contract packages/api-client/tests …` | 106 passed，0 failed/pending |
| `node --test --test-reporter=tap scripts/core-l03-review.test.mjs scripts/development-execution.test.mjs` | 98 passed，0 failed/skipped |
| Terminal typecheck、定向ESLint、两包Cargo clippy/fmt | PASS |
| `check-bff-generated.mjs` / `check-bff-openapi.mjs` / `check-bff-compatibility.mjs` | PASS，基线5c05089d，新增8操作/12schema，既有134操作/既有schema语义保持，破坏性变更0 |
| `pnpm --filter @sumalpha/terminal build` | PASS，buildId=terminal-10d13870229a3b9f6325b23fbde3203b466b27d3 |
| `pnpm exec playwright test --config=playwright.core-l03.config.ts --project=chromium --workers=1 --retries=0 …` | 12 passed，0 failed/skipped/flaky；新native3项+直接旧Paper/G8/FEP5九项 |
| axe | 3扫描0 violations；Native P11与旧P11小屏0 incomplete，旧Audit仍1项color-contrast incomplete/13节点 |
| 双计划检查 / CORE:L03 INTEGRATION / CORE:L04 DEVELOPMENT | 159项stage/规范保持；INTEGRATION exit1 STAGE_NOT_READY；下一DEVELOPMENT exit0 allowed=true |
| gitleaks 8.28.0 | 当前任务diff及attempt未复核命中0；自有idempotency SHA256命中保留原报告并逐条限定复核，2个实际canary仍拒绝；不是全仓审计 |
| `node scripts/core-l03-review.mjs --verify` | 当前输入/日志/binary/build/来源/历史范围核验PASS |
| `node docs/audit/evidence/core-l03-local-20261027/verify.mjs` | 整包manifest与固定候选核验 |

另执行[当前整包和候选任务diff封存扫描](./seal-scan/review.json)，原始报告与逐条摘要复核结果保留；未复核命中0，不是全仓安全审计。

## 当前成功、拒绝与恢复

[真实socket HTTP五十组](./attempt-01/http/fifty-http.json)先读取三名C01身份，确认同tenant/workspace/account、Assisted Live模式和相应能力。每组Subject/申请均由原申请者发起，两名不同actor/user分别完成实际reference MFA/reauth公共路由，再经真实SERVICE:L03 HMAC证明和审批，进入真实AssistedExecution→X04→ProtocolKernel。50个Command/Order保留同一Subject hash、Request和数量/方向；50个Command ID、50个Order ID唯一，100条审批审计在当前服务内验证。订单均accepted、filledQuantity=0，不宣称真实成交。

[Axum五十组](./attempt-01/native-axum.json)为同类50参数化样本的另一个面，不把二者计作100个独立场景。[flag-off矩阵](./attempt-01/default-off.json)为50案例在默认无host/显式off两profile上共100次业务请求，100次403、nativeSubmissions=0；能力发现允许读取false。原生API不能降级调用Paper路径。

[当前控制器恢复](./attempt-01/http/runtime-recovery.json)显式丢失open、第一人审批和Command三个已提交响应；三对原key/body/CSRF恢复后只有2条审批审计、1个原生命令。[实际P10/P11旅程](./attempt-01/browser/cases/core-l03-CORE-L03-actual-P-8b935-same-source-native-recovery-chromium/core-l03-journey.json)由两名独立审批者操作，审批与Command两对原请求恢复后仍同一native Order。小屏无高风险写按钮，非JSON失权清除私有事实。

服务审批回执始终不授予执行权限。Native签发只在当前服务锁内验证两人/策略/会话generation/当前Subject及原期限后进行；同Proposal不能靠新申请重复下单。原命令最长30秒、MFA不延长原120秒窗口，unknown保留原reservation、不补单；原事实可只读核查。当前额度是单请求50000 USDT与白名单，不是完整累计账户/portfolio风险验收。

## 适用范围与风险

本轮使用显式loopback reference profile、reference Cookie/TLS/CORS与固定因素完成替代端口、可信owner自有Subject/RiskDecision投影和无网络ProtocolPort。L01实际协议解析与X04事实映射发生在当前同一进程，当前没有接上L02 mTLS受限进程；live启动没有挂载此profile。原L02/L4/FEP8/G8证据保持原SHA，不拼成当前目标接续成功。

新公共审批审计是本地keyed HMAC链，不是用户/组织公钥签署，也不是公共C10持久审计。真实F06/IdP、R04/X02完整来源/C11持久治理、L02当前mTLS/OS隔离、公共共同C10事实、跨重启/多副本恢复、Vault/数据库迁移/RLS/事务/Storage、实际venue HTTP/signing/testnet、目标网络/轮换/容量/安全/性能/长稳/同SHA hosted CI、人工读屏/原生200%缩放/全浏览器及RELEASE均NOT_RUN。原19项gap保持OPEN，四项本机进展独立列出；完整M5不放行。

所有预检原件及[空白检查原诊断](./whitespace-original.log)保留。九份Playwright错误上下文有原始尾空格，`.gitattributes`只对确切原件路径豁免，不改写字节。全零SHA预检3pass/9fail是来源标记错误，旧Paper resolver按规则拒绝；同时修复新入口应先规范化引用的行为。有效来源的未冻结预检随后12pass；均不当最终候选PASS。当前固定候选attempt-01是独立首次冻结采集。

下一可执行原项 **CORE:L04 DEVELOPMENT**：将同一原生权限组合接到L02 mTLS受限进程，建立公共C10共同持久事实、原reservation跨进程/多副本恢复及相应成功/拒绝/恢复证据；继续保留原缺口和目标授权边界。

```sh
node scripts/core-l03-review.mjs --verify
node docs/audit/evidence/core-l03-local-20261027/verify.mjs
# 重跑须先冻结候选，使用全新attempt，不能覆盖原件。
node scripts/core-l03-review.mjs --run docs/audit/evidence/core-l03-local-20261027/attempt-NN
```
