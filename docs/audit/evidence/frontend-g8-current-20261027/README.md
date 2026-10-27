# G8 当前 DEVELOPMENT 条件入口与恢复整改

固定候选 **18408e7bca2ac3c64ab586b3a98dbeb64ec078d6**，最终 **attempt-04** 的 21 项限定命令与 packet 核验符合预期。工程 Gate **PASS_G8_CURRENT_DEFAULT_OFF_AND_RECOVERY_HARDENING**。完整 G8 **NOT_READY_GAPS_OPEN**，review **IN_REVIEW**、159项 stage **NOT_ASSESSED**、formalAccepted=false、runtimeAdmission=DENIED、M5 **PREPARED_NOT_READY**；原19项业务 gap 均 OPEN。没有生产凭据、数据库、真实 venue/testnet、push、部署或外部发布。

## 变更与结果

- [37项候选变更清单](./changed-files.json)：C09 1.17.0 可选 opt-in 默认关闭声明、生成 SDK/schema、实际 P10/P11 提示、P11 原 CSRF/key/body 和 command deadline 恢复、P10/P11 自有失权清理；相应功能/消费者/浏览器/门禁测试、规程和两份计划。
- [固定回执](./receipt.json)、[结果](./result.json)、[命令原件](./attempt-04/executions.json)、[输入](./attempt-04/inputs.json)、[binary](./attempt-04/binary.json)、[Web 构建](./attempt-04/terminal-build.json)、[构建文件摘要](./attempt-04/build-artifacts.json)、[核验输出](./verify.log)。
- [当前机器评估](../../../execution/frontend-g8-current-assessment.json)、[规程](../../../operations/frontend-g8-current-development.md)、[原范围参考](./historical-references.json)、[待确认评审稿](./acceptance-draft.md)。正式确认 PENDING，没有自行批准。

| 测试命令/检查 | 最终实际结果 |
| --- | --- |
| `node scripts/frontend-g8-current-review.mjs --run …/attempt-04` | 21项命令符合预期，packet核验 PASS |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录实际 binary 摘要 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 29 passed，0 failed/ignored |
| `pnpm exec vitest run`（14个限定功能/消费者文件，参数见executions） | 172 passed，0 failed/pending |
| `pnpm exec vitest run tests/contract packages/api-client/tests` | 106 passed，0 failed/pending |
| `node --test`（G8 current、development、compatibility、A1 negative四个文件） | 123 passed，0 failed/skipped；包含新增11项兼容性及9项摘要复核测试 |
| `pnpm --filter @sumalpha/terminal typecheck`、定向 ESLint、Cargo fmt/clippy | PASS |
| `node scripts/check-bff-generated.mjs`、`check-bff-compatibility.mjs`、`check-bff-openapi.mjs` | PASS，基线6677a7d4，未登记破坏性变更0 |
| `pnpm --filter @sumalpha/terminal build` | PASS，buildId=terminal-18408e7bca2ac3c64ab586b3a98dbeb64ec078d6 |
| `pnpm exec playwright test --config=playwright.g8-current.config.ts --project=chromium --workers=1 --retries=0 …` | 9 passed，0 failed/skipped/flaky；当前2项、原G8两项、FEP5五项 |
| axe + [截图人工查看](./visual-review.json) | 两扫描0 violations；Audit 1项color-contrast incomplete/13节点，当前小屏0 incomplete |
| `node scripts/check-development-plans.mjs` | PASS，159阶段不提升 |
| `node scripts/development-execution.mjs --integration FRONTEND-GATE:G8` / `--integration FE:FEP-8` | 各exit1，STAGE_NOT_READY，预期拒绝 |
| `node scripts/development-execution.mjs --development FE:FEP-8` | exit0，allowed=true |
| gitleaks 8.28.0 限定扫描 | 当前 diff/attempt 未复核命中0；原始digest命中保留并限定复核，真实2个canary仍拒绝，详见secret-scan.log及secret-digest-review.json |
| `node docs/audit/evidence/frontend-g8-current-20261027/verify.mjs` | 候选输入、历史、失败记录及整包摘要核验 |

封存另执行[当前整包及候选任务 diff 扫描](./seal-scan/review.json)：241个文件，108项自有 idempotency SHA256 命中均逐条按原 attempt/source/字段复核，未复核命中0；原始报告保留。此项不是全仓秘密审计。

## 证据范围与未决

[当前只读HTTP](./attempt-04/http/admission-read.json)：实际 reference BFF 给两名 C01 reader 返回同作用域、8秒有效期声明，三个权限布尔量均false；实际 P10/P11 消费并显示 closed，业务写入0。未 opt-in 的旧 capability 响应不携带易变声明。此项为版本化默认关闭条件，不构成 C11 activation 或任何执行权限。

[Paper/mock恢复](./attempt-04/direct-http/paper-recovery.json)：MFA/审批→Command→撤单→C10 组合成功，三对已提交响应显式丢失后恢复保留原 key/body；浏览器旅程同样检查。新增 model 回归验证原 CSRF、在最终读取期间发生的轮换、半开提交 deadline、unknown保持以及被动callback下非JSON失权清理。浏览器仅使用显式 reference Cookie/TLS/CORS桥接，不能代替真实 IdP/生产 Cookie/CORS。没有把 owned native L03/L04 历史链改绑成当前公共链，也没有复跑全部上游。

G8-SERVER-FLAG、P10/P11 正向 Assisted Live、C09→L01 同源接续、双审批F06/原生权限→公共C10/持久恢复四项均未闭合，另15项原继承缺口也保持 OPEN。真实 IdP/MFA、Vault/数据库迁移/RLS/事务/Storage、共同持久事实和跨进程恢复、venue HTTP/signing/testnet、目标网络/轮换/通知/容量/全面安全/长稳/同SHA CI、全浏览器/人工读屏/原生200%缩放及 RELEASE 均 NOT_RUN。Audit incomplete 未关闭。当前结果不放行 INTEGRATION/M5/RELEASE。

## 失败原件与复现

[失败索引](./failed-attempts.json)：preflight-01保存旧P11 5 failed/1 passed；preflight-02保存开发时identity命名冲突；preflight-03保存最初非opt-in易变能力响应造成的旧Trade Ticket拒绝。另有一次未固定pnpm辅助lint中断，未计PASS；后续白名单固定pnpm lint通过。

- attempt-01 / 2eb1eea8：兼容性误判可选参数增量，后续未执行项保留 NOT_RUN。
- attempt-02 / c11761ac：构建/9项浏览器等通过，末尾秘密扫描将自有 keyHash 摘要报为36项generic-api-key；原始报告保留，该轮整体FAIL。
- attempt-03 / f2e89b57：21项命令符合预期，但末尾证据验证因采集未保存Request query失败；未生成PASS回执。补录工具输出明确标为transcription，不冒充旧collector生成记录。
- attempt-04 / 18408e7b：补齐原始Request query关联和核验失败持久记录后，全部限定检查与证据核验通过。前三轮不改绑、不计当前PASS。

```sh
node scripts/frontend-g8-current-review.mjs --verify
node docs/audit/evidence/frontend-g8-current-20261027/verify.mjs
# 重跑须先冻结候选，使用全新attempt；不覆盖原件。
node scripts/frontend-g8-current-review.mjs --run docs/audit/evidence/frontend-g8-current-20261027/attempt-NN
```

下一可执行原任务：**FE:FEP-8 DEVELOPMENT**，开展范围收口、M5缺口评估与评审准备；原19项缺口、正式确认和集成/发布义务继续保留。
