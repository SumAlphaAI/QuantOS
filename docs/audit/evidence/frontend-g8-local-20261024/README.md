# G8 本机条件入口、职责分离与审计恢复证据

当前冻结候选：`2d0eefc0e2749b9b17732fb07b755c702ae8dc0f`；attempt-01全部命令符合预期。工程Gate **PASS_G8_OWNED_LOCAL_CONDITIONAL_COMPOSITION**，G8正式 **NOT_READY_GAPS_OPEN** / IN_REVIEW；159项stage_gate保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。未连接实际testnet，不使用生产凭据/数据库，不推送、部署或发布。

## 变更及证据入口

必要修复仅 `packages/domain-ui/src/strategy.ts`：flag严格为true且服务端存在enabled=true的assisted_live目标才返回可达；空列表、只有Paper、禁用目标和非布尔truthy均关闭。该helper当前仅用于场景模型，未连接实际P10/P11；不能据此宣称testnet UI/API已实现。

- [完整变更清单](./changed-files.json)：共享helper修复、G8单元/HTTP/浏览器测试与配置、评估工具、文档、计划及原始证据。
- [结果](./result.json)、[回执](./receipt.json)、[逐条命令](./attempt-01/executions.json)、[复核输出](./verify.log)。
- [真实Paper拒绝/恢复/C10](./attempt-01/flows/paper-recovery.json)、[未知flag拒绝](./attempt-01/flows/flag-gap.json)、[Shadow拒绝](./attempt-01/flows/shadow-refusal.json)。
- [规程](../../../operations/frontend-g8-bounded-composition.md)、[19项未决](../../../execution/frontend-g8-assessment.json)、[当前截图/axe复核](./visual-review.json)。

## 当前命令和结果

| 命令/检查 | 实际结果 |
| --- | --- |
| `node scripts/frontend-g8-review.mjs --run docs/audit/evidence/frontend-g8-local-20261024/attempt-01` | 16条限定命令均符合预期 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录当前源码与二进制哈希 |
| `cargo test --locked --offline -p quantos-execution --lib dual::tests::` | 3 passed；含50组双审批、100个hashed审计entry及拒绝 |
| `cargo test --locked --offline -p quantos-execution --lib venue::tests::` | 4 passed；含200个合成映射、endpoint/key及错误分类 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 28 passed |
| `pnpm exec vitest run … --reporter=json …` | 8个限定文件81 passed，0 failed/pending |
| `pnpm --filter @sumalpha/terminal typecheck` / `--filter @sumalpha/domain-ui typecheck` | PASS |
| 定向 `pnpm exec eslint …` | PASS |
| `node --test scripts/frontend-g8-review.test.mjs scripts/development-execution.test.mjs scripts/terminal-static-routes.test.mjs` | 87 passed，0 failed/skipped |
| `pnpm --filter @sumalpha/terminal build` | PASS；当前buildId绑定2d0eefc0，client secret scan 181 files PASS；public testnet flag=off |
| `pnpm exec playwright test --config=playwright.frontend-g8.config.ts --project=chromium --workers=1 --retries=0 …` | 7 passed，0 failed/skipped/flaky/retry；2个G8与5个FEP5功能回归 |
| `node scripts/check-development-plans.mjs` | PASS，7个G8直接依赖只索引原范围，159阶段不提升 |
| `node scripts/development-execution.mjs --integration FRONTEND-GATE:G8` / `--integration FE:FEP-8` | 各exit 1、allowed=false，预期拒绝 |
| `node scripts/development-execution.mjs --development FE:FEP-8` | exit 0、allowed=true |
| `node scripts/frontend-g8-review.mjs --verify` | PASS，输入/日志/构建/历史哈希及范围成立 |

完整参数与用例名称见executions.json和unit.json。本次没有全仓/全部上游复验或quantos-evidence性能/SLO/数据库campaign。原生35项与前端81项分别记录，不把原生场景数当成HTTP或浏览器次数。

## 组合与证据限制

同一实际本机Paper reference BFF中，发起人自批真实403、错误MFA不发decision、独立Approver MFA/reauth、非发起人Command拒绝、mode/flag注入422成立。审批、Command和撤单三个已提交回执显式丢失后，只使用原key/body恢复；最终Order cancelled、mode=paper、venueKind=mock、fills=[]，C10链完整且事件唯一。Node流172行HTTP，未知flag流22行、Shadow流5个GET；未知C11 flag真实422且版本不变，Shadow执行接口403。

当前浏览器真实P10→P11→C10恢复相同三对原请求；第二用例显式修改浏览器C01交付为assisted_live，只证明消费者拒绝，实际BFF身份仍Paper。当前Audit axe零violations，1项color-contrast incomplete/13节点保留；截图仅限本次旅程，不代表完整视觉/可访问性验收，原P14/G7等incomplete不关闭。

原生dual用例使用owned MFA前缀及ApprovalRecord内容hash，不是F06认证或生产密码学签名证明；50组/100 entries不等于50次双审批HTTP。200个venue场景全部通过ScenarioDrivenTransport，不会连接配置字符串中的testnet endpoint；native Order源不能拼成Paper C09同一笔订单。缺少实际版本化server flag/capability、P10/P11 Assisted Live正向、C09→L01本机adapter同源接续及双审批F06/HTTP→C10恢复，本轮新增4项OPEN。

G4/FEP-4、G6/FEP-6、P14、G7/FEP-7原15项、FEP7 PARTIAL和Beta NOT_READY原样保留，总19项未决；2520个历史证据文件按原Git源码/哈希保护，历史原失败/incomplete/NOT_RUN不重绑。实际testnet明确NOT_RUN_USER_FORBIDS_CONNECTION；真实IdP/Cookie/CORS、Supabase/RLS/事务/Storage/持久化审计、跨进程恢复、外部venue、同SHA远程CI、Firefox/WebKit/跨OS、手工读屏/原生200%、完整视觉、性能/容量/长稳、RELEASE-GATE:LIVE-READINESS全部NOT_RUN。无正式确认回执，FEP-8/L03/L04完整关闭未声明。

## 原始失败与重现

preflight-01保留helper原缺陷回归失败及初始Shadow测试假设；preflight-02保留Shadow读上下文应允许而测试错误预期拒绝的失败；preflight-03保留故意无效flag使用生成类型导致的类型失败。后两者是测试问题，修正后通过，原记录不删除、不计PASS。

```sh
node scripts/frontend-g8-review.mjs --verify
# 重跑须冻结源码并选用全新attempt；原失败和NOT_RUN保留。
node scripts/frontend-g8-review.mjs --run docs/audit/evidence/frontend-g8-local-20261024/attempt-NN
```

下一原任务：I10 FE:FEP-8，开展范围收口与M5缺口评估；不自动关闭19项未决，不授权实际testnet、实盘、部署或发布。
