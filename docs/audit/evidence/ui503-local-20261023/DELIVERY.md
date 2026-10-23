# FE:UI-503 交付报告

I5 Trade Ticket preflight，仅修改QuantOS，在main开发并生成本地提交；未使用生产凭据、推送或部署。

基线 `46d258f462a5715a493a84d514229c3eab35b0a5`；实现提交 `408e2913c2d1ebef586eb68f36dba0810ac2d960`；最终源码冻结 `942c705003f74e534b1cfc8bec3c5458773132ab`。证据封存提交只保存结果/文稿，不冒充已构建源码。全量清单见changed-files.txt。

## 变更文件与行为

- `apps/terminal/app/trade/{page.tsx,workspace.tsx,workspace.css}`：严格/trade?proposalId=UUID、授权前50条建议与独立深链、显式精确market venue选择、三步每步重读、财务/限额/健康/版本/mode及来源展示、非执行intent预填；明暗/响应式、加载/空/失败/拒绝/过期/陈旧/离线清理、显式恢复与复制反馈。
- `apps/terminal/src/trade/{policy.ts,runtime.ts}`：C01双读与持续route-access、C07读版本、C12精确行情及2秒质量时效、C13当前预检/限额/财务/健康与密集流、前后稳定性与期限核验、Decimal/BigInt金额精度、同步busy与有界429；来源变化退回审阅，错误不生成草稿，关闭/迟到响应清理；零业务POST。
- `apps/terminal/app/proposals/workspace.tsx`：P09详情增加仅含Proposal UUID的Trade Ticket入口，目标页独立授权，无account/mode/数量注入。
- `bff/openapi/quantos-bff.v1.yaml`、`services/bff-gateway/src/execution.rs`及生成的SDK/Zod/JSONSchema/MSW/operation/input-policy：OpenAPI1.15新增可选includeTicketContext字符串enum查询与可选TradeTicketContext；仅opt-in GET返回当前绑定源的财务equity/时间、venue健康/观察时间、政策/输入hash、原intent数量/限价。旧GET/false及SSE保持原形状，不返回command_key/签名/actor/私有source_ref，不扩大共享查询解析器。
- `services/bff-gateway/src/execution/tests.rs`：新增3项真实模块测试，覆盖opt-in/默认、余额缺口不伪造、当前财务/venue/政策事实更新、范围拒绝与无变更；加上20项直接执行回归共23项。
- `apps/terminal/tests/ui503{,-provider-consumer}.test.ts`、`packages/api-client/tests/bff-response.test.ts`：37项当前单元、1项实际C07/C12/C13消费者；响应specimen补显式null类型支持。UI502/P09/执行恢复/权限/导航及生成契约请求/响应为直接影响回归。
- `tests/e2e/{ui503.spec.ts,fixtures/ui503-reference.ts}`、`playwright{,.ui503}.config.ts`：16个Chromium场景、4组原始截图/axe；真实reference字节、合成身份/CORS与每个负面探针分开，拦截外部网络。
- `scripts/ui503-review{,.test}.mjs`、前端执行计划、操作说明和本目录：源码/命令/日志/构建/二进制/网络/截图hash及范围验证，同步IMPLEMENTED_PENDING_ACCEPTANCE与UI504交接，保留原失败。没有新增泛化静态fallback，也没有运行数据库或全覆盖率campaign。

## 测试命令与结果

入口：`node scripts/ui503-review.mjs --run docs/audit/evidence/ui503-local-20261023/attempt-02`，14组命令按预期退出；精确参数/时间/退出码/日志hash见attempt-02/executions.json。项目webEnvironment白名单非生产环境、固定pnpm10.20.0，Cargo locked/offline；仅临时回环reference服务，无目标DB。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-503` | 允许当前功能开发 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| `pnpm exec vitest run apps/terminal/tests/ui503.test.ts apps/terminal/tests/ui503-provider-consumer.test.ts apps/terminal/tests/ui-p09.test.ts apps/terminal/tests/ui-p09-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts tests/contract/bff-remediation.test.ts apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui502-provider-consumer.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts apps/terminal/tests/g1-route-access.test.ts packages/domain-ui/tests/ui101.test.ts apps/terminal/tests/ui-p02-presentation.test.ts --reporter=json --outputFile=docs/audit/evidence/ui503-local-20261023/attempt-02/unit.json` | 200/200；37新单元、1新实际消费者、162直接回归 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 23/23；含3项UI503当前投影测试 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS，六类生成文件与OpenAPI一致 |
| `rustfmt --check --edition 2024 services/bff-gateway/src/execution.rs services/bff-gateway/src/execution/tests.rs` | PASS |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint <变更范围>` | PASS，精确参数见executions.json |
| `node --test scripts/ui503-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 21/21 |
| `pnpm --filter @sumalpha/terminal build` | PASS，静态导出与client-secrets检查通过，buildId绑定完整源码SHA |
| `pnpm exec playwright test --config=playwright.ui503.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui503-local-20261023/attempt-02/browser` | 16/16，零重试/跳过；4明暗桌面移动扫描零axe违规 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-503` | 预期拒绝exit1，未伪记READY |
| `node scripts/development-execution.mjs --development FE:UI-504` | 允许下一原任务 |
| `node scripts/ui503-review.mjs --verify` | PASS，源码/输入/日志/产物hash一致 |

回归选择依据：新增C13响应/查询与宿主需要真实C13执行回归及生成契约；C13旧默认消费者/UI502/P09与入口DOM改变直接受影响，保留对应当前单元/实际消费者、执行恢复和C01/导航；没有递归整条依赖链、全仓测试或目标数据库验收。

初始失败保留：类型夹具paper字面量过窄；boolean查询被现有宿主拒绝，改为明确true/false字符串enum而未扩大共享解析器；响应specimen未覆盖JSON null，修复测试生成器；首次冻结408e2913浏览器8/16因全局alert定位与Next播报节点冲突，改为应用区域定位并加强真实断流断言。每次原始源快照、FAIL/JSON/log和首轮200单元/23宿主/4视觉均ORIGINAL_SCOPE_ONLY，不拼接新候选PASS。首轮8个Playwright原始error-context含尾随空白，保留暂存检查exit2原件，只以.gitattributes精确文件级豁免，不重写字节或扩大运行时回归。

## Gate与未决风险

工程有界Gate **PASS_UI503_PREFLIGHT_FUNCTION**；计划IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。不构成I5 READY、正式ACCEPTED或目标/生产验收。

**真实可用现金仍缺失**：AccountFinancials仅有权益余额及账本时间，availableCash=null、availableCashChecked=false、submissionReady=false始终成立。页面重新读取权益事实但不推断资金充足，也未验证完整可用现金余额要求；补齐真实现金源/资金校验仍NOT_RUN。生成的只是原建议绑定的非执行intent草稿，不能直接作为Command或下单授权。

C12报价与OWNED_PAPER执行上下文、USD/USDT单位不同，明确分开；没有假装行情报价是执行报价，没有跨币种比较market minNotional与账户限额。真实execution venue/quote对齐仍NOT_RUN。参考BFF的当前财务/venue/risk事实与显式测试Kill不证明真实provider或资金业务验收。

合成cookie身份、固定测试MFA与回环TLS/CORS替代不证明真实IdP/cookie/CORS、目标Supabase/RLS/事务、真实组合/venue/行情、持久恢复或长期SSE。Firefox/WebKit/跨OS、人工读屏/native200%、同SHA远程CI、性能容量长稳、完整I5/RELEASE均NOT_RUN。Axe2组/20个非文本共享导航节点incomplete保留，不当作通过；4张最终截图已逐张复核。

下一可执行原任务：**FE:UI-504：Approval、MFA、职责分离**。本任务10月23日启动并跨入10月24日，保留原始时间，目录沿用开始日；没有推送、部署或外部发布。
