# FEP-8 当前前端收口与 M5 准备证据

候选 **216f0825dcf7b9c4d852beb18bf6f7d1ef8cc9e6**，最终 **attempt-02** 的13项限定检查及证据核验符合预期。工程 Gate **PASS_FEP8_CURRENT_SCOPE_AND_M5_REVIEW_PREPARATION**；FEP-8仍 **PARTIAL**，FEP-8/G8 **NOT_READY_GAPS_OPEN**，M5 **PREPARED_NOT_READY**，159项stage **NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED、正式确认PENDING。原19项业务gap保持OPEN。

## 变更与材料

- [变更文件](./changed-files.json)：只读census来源/声明核查、当前M5评审/门禁工具及反向测试、机器评审材料、规程、两份计划与本地证据。未修改页面、BFF/核心运行时和契约。
- [机器评审包](../../../execution/fep8-current-m5-review.json)、[六维技术评审](../../../operations/fep8-current-m5-review.md)、[下一任务及19项缺口移交](./handoff.json)。每项有原任务owners和具体关闭判据，保留原始ID/OPEN及进展。
- [固定回执](./receipt.json)、[结果](./result.json)、[实际命令](./attempt-02/executions.json)、[输入](./attempt-02/inputs.json)、[实际binary](./attempt-02/binary.json)、[只读摘要](./read-summary.json)、[原范围参考](./original-scope.json)、[核验输出](./verify.log)。

采集修复：旧FEP8测试写死binarySourceCommit=2d0eefc0；本轮改为冻结采集器明确提供完整来源，核对Git输入/实际binary摘要。当前独立输出路径/schema，记录原Request query及method/path关联。M5材料已更新“C09 1.17.0 opt-in默认关闭已存在”与“C11 activation/原生正向权限未接通”的区别。旧FEP8、最新G8和L4材料保持原SHA，不覆盖历史观察。

## 实际测试

| 命令/检查 | 最终结果 |
| --- | --- |
| `node scripts/fep8-current-review.mjs --run docs/audit/evidence/fep8-current-local-20261027/attempt-02` | 13项检查符合预期，packet核验PASS |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，实际binary/source/hash记录 |
| `pnpm exec vitest run apps/terminal/tests/fep8-provider-consumer.test.ts apps/terminal/tests/fep8-hardening.test.ts apps/terminal/tests/g8-current-admission.test.ts apps/terminal/tests/g8-current-hardening.test.ts …` | 54 passed，0 failed/pending；2个真实HTTP只读census+52个直接模型回归 |
| `node --test --test-reporter=tap scripts/fep8-current-review.test.mjs scripts/development-execution.test.mjs` | 113 passed，0 failed/skipped；含旧binary来源、跨作用域、假开启、隐式关gap/升级Gate等拒绝 |
| `pnpm --filter @sumalpha/terminal typecheck` / 定向ESLint | PASS |
| 当前M5评审审计 / `node scripts/check-development-plans.mjs` | 19项依赖与19项缺口核对，159项规范/阶段保持 |
| FEP8、G8、CORE:L03 `--integration` | 各exit1，STAGE_NOT_READY，预期拒绝 |
| CORE:L03 `--development` | exit0，allowed=true |
| gitleaks 8.28.0（当前任务diff及attempt） | 0 findings，2个实际canary命中并拒绝；仅确切规则/路径/不变公开F06值例外，不是全仓审计 |
| `node scripts/fep8-current-review.mjs --verify` | 输入/日志/实际binary/来源/原范围核对PASS |
| `node docs/audit/evidence/fep8-current-local-20261027/verify.mjs` | 当前packet及完整封存摘要核验 |

[Paper原始census](./attempt-02/reads/paper.json)与[Shadow原始census](./attempt-02/reads/shadow.json)分别实际启动reference BFF，由GET-only transport限制；三种C01身份、审批权限、C11 flag库存、C09、审批/订单及Audit读权限逐项核对。Paper C09返回同作用域8秒默认关闭声明，三个权限布尔量false，venueSubmit=false；Shadow C09/审批/订单403，声明不返回。两流业务写入均0，没有创建审批、订单或新变更审计链。

未改产品页面，故本轮未重跑Web构建/浏览器/axe、Rust原生单测或完整上游。G8 source18408e7b的9项Chromium、截图、恢复和axe仅原范围参考；Audit原1项color-contrast incomplete/13节点不关闭。L4 owned原生服务也不改绑成本轮公共双审批证明。

## 未决与失败保留

完整19项见机器材料。尤其C11 activation、实际P10/P11 Assisted Live正向、同源C09/L01和F06独立审批→原生签发→公共C10/持久恢复仍未闭合。原50次双审批、200个venue映射、默认关闭和自批/超额/过期100%拒绝要求保留，历史计数不充当当前目标执行。核心L03/L04完整关闭未声明。

真实IdP/MFA/Cookie/CORS、Vault/数据库迁移/RLS/事务/Storage、共同持久事实和跨进程多副本恢复、venue HTTP/signing/testnet、目标网络/安全/容量/性能/持续窗口、同SHA hosted CI、全浏览器/人工读屏/原生200%缩放及RELEASE均NOT_RUN。没有生产凭据、push、部署或外部发布。

[失败索引](./failed-attempts.json)：preflight保留测试lint和文档脚本编码诊断，后续修复；attempt-01 source dd86610c的13项命令符合预期，但末尾按TAP解析默认Node文本失败，原112项输出与verification-failure原件保留，该轮FAIL、不计当前PASS。候选216f0825固定TAP并增加回归后使用attempt-02通过。

下一可执行原任务 **CORE:L03 DEVELOPMENT**：将已有C09关闭声明与公共C01/F06、服务独立审批、原生签发和P10/P11接成同源受控本机业务链，验证成功/拒绝/恢复；后续由CORE:L04承担公共C10和持久恢复。当前不放行INTEGRATION或RELEASE。本准备稿不是正式M5验收确认，不自行批准。

```sh
node scripts/fep8-current-review.mjs --verify
node docs/audit/evidence/fep8-current-local-20261027/verify.mjs
# 重跑应先冻结候选，选全新attempt，不覆盖原件。
node scripts/fep8-current-review.mjs --run docs/audit/evidence/fep8-current-local-20261027/attempt-NN
```
