# FEP-7 本机硬化与范围收口证据

冻结候选：`a61d22f246dc20011e0e562129e52d1b552df60b`，仅QuantOS/main。当前attempt-01执行通过。工程Gate **PASS_FEP7_FRONTEND_SCOPE_HARDENING**；FEP-7 development_status=PARTIAL，FEP-7/G7 **NOT_READY_GAPS_OPEN**、Beta NOT_READY，159阶段Gate保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。

本次只补充硬化测试和范围评估，产品运行代码未变。索引40项直接依赖、22个高保真页面入口，不把其源码存在或历史完成标签当成当前候选完整页面验收。

## 文件和证据

- [完整变更清单](./changed-files.json)：3个新测试/夹具、2个评估脚本、计划、规程、缺口清单及本轮证据。
- [结果](./result.json)、[回执](./receipt.json)、[逐条命令](./attempt-01/executions.json)、[复核输出](./verify.log)。
- [范围与历史核查](./attempt-01/scope-audit.log)、[Paper只读HTTP](./attempt-01/reads/paper.json)、[Shadow只读HTTP](./attempt-01/reads/shadow.json)。
- [规程](../../../operations/fep7-function-closure.md)、[Beta缺口](../../../execution/fep7-scope-assessment.json)。

## 当前命令和结果

| 检查 | 命令/结果 |
| --- | --- |
| 当前限定矩阵 | `node scripts/fep7-function-review.mjs --run docs/audit/evidence/fep7-function-local-20261024/attempt-01`：全部10条命令满足预期退出码 |
| 范围核查 | `node scripts/fep7-function-review.mjs --audit`：40依赖/22页面、15未决保留、2500历史文件不变 |
| 前端模型与实际HTTP | `pnpm exec vitest run … --reporter=json …`：6个限定文件104 passed，0 failed/pending；含17项新增Performance硬化模型、2条真实GET-only消费者及85项直接回归 |
| 类型 | `pnpm --filter @sumalpha/terminal typecheck`：PASS |
| 静态检查 | `pnpm exec eslint …`：3个新测试/夹具和2个脚本PASS |
| 门禁拒绝探针 | `node --test scripts/fep7-function-review.test.mjs scripts/development-execution.test.mjs`：66 passed，0 failed/skipped |
| 计划 | `node scripts/check-development-plans.mjs`：PASS；159阶段不提升，原G4/FEP4、G6/FEP6、P14/G7及既有followups不变 |
| FEP-7/G7联调入口 | `node scripts/development-execution.mjs --integration FE:FEP-7` / `--integration FRONTEND-GATE:G7`：各exit 1，allowed=false，预期拒绝 |
| 下一开发入口 | `node scripts/development-execution.mjs --development FRONTEND-GATE:G8`：exit 0，allowed=true |
| 证据复核 | `node scripts/fep7-function-review.mjs --verify`：PASS，源码/日志/历史哈希和范围绑定成立 |

完整命令参数和逐文件测试名称见executions.json和unit.json。新增模型调用真实前端runtime/gateway/schema但无BFF/F06/签名/Worker/数据库；模型effect计数仅限模型。新增用例覆盖原key/body恢复、8种C01权限绑定变化、offline/精确到期/CSRF替换、非JSON401/403、C15来源不一致、交付中下载deadline和close清理，未虚构产品修复。

新HTTP消费者实际复用G7原二进制：binarySourceCommit=abc4c1707a25a5dc6fd0e04f73ba7e41fd62e691，SHA256=4154f9fdcceb29a529171523ac9870dc395cd3568df4b4c57dc9b0c547e52dd9；fixtureSourceCommit为本次a61d22f2，由reference源码校验。Paper 73个GET、Shadow 85个GET，无业务POST/PUT/DELETE。两者各读取4个市场行；Shadow核对3个Performance/C15来源连接，Paper收益拒绝；Shadow C05/C06/执行列表拒绝。Owner无audit:read、Operator未获得admin.write；告警来源未解决、通知EOF disconnected。未创建新业务mutation或其审计链。

## Beta与原范围边界

G4/FEP-4、G6/FEP-6、P14及G7全部15项缺口原样保留：研究HTTP队列→Worker、Release激活→同源Proposal、Paper Fill→Shadow账本、C15异常→匹配Alert、Shadow C06正向源、Marker匹配、受控K线导出、估值同源及UI601/P13/P14契约缺口均未关闭。

原G7源码abc4c170、包6da93973的35个前端/HTTP、52个原生（20条Worker因果链）、78项门禁/路由、18个Chromium、构建与181文件secret扫描只以ORIGINAL_SCOPE_ONLY保留。本次没有Cargo重建、应用构建、原生测试或浏览器重跑；其结果不能记为当前a61d22f2 PASS。G7旧attempt、superseded包、原始预检失败及2500个历史证据文件均按原SHA核验保留。

原G7两个Audit axe零violations，2项color-contrast incomplete/26节点及P14等历史incomplete保持原状。视觉/兼容均原范围索引；Firefox/WebKit/跨OS、手工读屏、原生200%缩放未执行。未测数值性能、容量、长稳或恢复SLA，构建时长不作为性能基线。真实IdP/Cookie/CORS、Supabase/RLS/事务/Storage/持久化审计、外部行情/venue、跨进程重启恢复、同SHA远程CI及RELEASE-GATE:BETA全部NOT_RUN，不能判定全范围功能阻断缺陷为零。

未使用生产凭据，不连接数据库，不推送、部署或发布；无正式确认回执。下一原任务FRONTEND-GATE:G8（I10），仅可开展本机条件入口与权限/flag/MFA/职责分离/审计恢复组合评估，不授权实际testnet连接、运行或实盘。

## 重现

```sh
node scripts/fep7-function-review.mjs --verify
# 重跑须先冻结源码，再使用全新attempt；失败保留，禁止覆盖。
node scripts/fep7-function-review.mjs --run docs/audit/evidence/fep7-function-local-20261024/attempt-NN
```
