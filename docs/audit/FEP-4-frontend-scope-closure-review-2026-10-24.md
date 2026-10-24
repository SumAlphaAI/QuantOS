# FE:FEP-4 / I7 前端范围收口与里程碑缺口评估

日期2026-10-24（Asia/Shanghai）。基线 `5455613fae774910fe272c083490be320296cecd`；当前冻结候选 `4ab3e9af96d59fdc89f6a0110ce229f8f6c48c71`。仅QuantOS/main、本地提交；未使用生产凭据、连接目标数据库、推送、部署或外部发布。证据另行提交。

## 结论

本轮已完成**已实现前端范围的收口评估**，工程 **PASS_FEP4_FRONTEND_SCOPE_CLOSURE**。FEP-4 development_status=**PARTIAL**；G4与FEP-4正式结论均 **NOT_READY_GAPS_OPEN**。159项stage_gate保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED；G4 review_status仍IN_REVIEW。不是全范围功能完成、正式签署或发布放行。下一原开发任务 **FE:UI-603：Alerts收件箱**。

未发现需要新增修改产品运行代码的缺陷；没有借收口工作绕开G4未决来源/导出缺口。新增测试与显式模型、评估工具、规程，计划从UNSPECIFIED同步为PARTIAL。全部原followups/核心/provider/页面状态保持原样，不把辅助收口或G4缺口变成无关开发前置。

## 六项交付与21项依赖

UI-401/P18目录、自选、独立venue报价、详情和有限流；UI-402/P19 OHLCV、缺口、指标、标记绑定、规范引用与显示设置；UI-403/P21金额/币种/账本/估值/口径/provisional、周期报表、固定文档及受控下载，按当前契约完成已实现消费者范围核对。完整路由/契约/限制见[操作规程](../operations/fep4-function-closure.md)。

21项直接依赖为BFF-FE-000–011、UI-P07、CORE-GATE:X3-SERVICE、上述6项交付节点及FRONTEND-GATE:G4；只记录当前状态/规范摘要和原范围适用性，不递归复验全部上游。closes_core=[]不关闭核心复审。范围审计和逐项依赖见 [scope-audit.log](./evidence/fep4-function-local-20261024/attempt-01/scope-audit.log)。

## 当前验证

- 11个明确内存模型用例调用真实Market/Chart/Performance runtime和路由解析：维度交接、独立C14/C15、切源续传、未应用草稿、queued/显式完成、原意图恢复、账户变化、时效降级、离线/失权/过期和teardown。队列/拒绝/幂等/完成由模型设定，仅fixture.invalid，不访问网络；不是BFF/engine/DB或持久恢复证据。
- 1个新的实际只读consumer在同一原reference实例读取C01/C12/C09/C14/C15：coinbase/spot维度、实际C09 Shadow403后的C12保留、断流disconnected、C14逐点绑定C15 actual snapshot/sourceHash；所有请求仅loopback GET/no-store、没有财务写入。
- 9个现有G4边界探针当前重跑，覆盖截断UTF8/残帧、时间/许可漂移、局部403重核C01及401/撤权。没有扩大到原234项矩阵或浏览器全链。

实际只读consumer的Cookie为显式测试运输注入，Node HTTP未验证浏览器Cookie/CORS。读取的是owned synthetic reference，不是外部实盘/真实资金。二进制复用G4应用54684067，执行前核对其原hash及后端/协议/锁文件未变；不声称新Rust构建、当前SHA原生验收或浏览器验收。

## 命令与结果

冻结执行：`node scripts/fep4-function-review.mjs --run docs/audit/evidence/fep4-function-local-20261024/attempt-01`。

只读复核：`node scripts/fep4-function-review.mjs --verify`。

|实际命令|结果|
|---|---|
|`node scripts/development-execution.mjs --development FE:FEP-4`|PASS / exit0|
|`node scripts/fep4-function-review.mjs --audit`|PASS / exit0|
|`pnpm exec vitest run apps/terminal/tests/fep4-closure.test.ts apps/terminal/tests/fep4-provider-consumer.test.ts apps/terminal/tests/frontend-g4.test.ts --reporter=json --outputFile=docs/audit/evidence/fep4-function-local-20261024/attempt-01/unit.json`|21/21 PASS（11模型、1实际只读consumer、9个G4直接边界回归）|
|`pnpm --filter @sumalpha/terminal typecheck`|PASS / exit0|
|`pnpm exec eslint apps/terminal/tests/fep4-fixture.ts apps/terminal/tests/fep4-closure.test.ts apps/terminal/tests/fep4-provider-consumer.test.ts scripts/fep4-function-review.mjs scripts/fep4-function-review.test.mjs`|PASS / exit0|
|`node --test scripts/fep4-function-review.test.mjs scripts/development-execution.test.mjs`|48/48 PASS|
|`node scripts/check-development-plans.mjs`|PASS / exit0|
|`node scripts/development-execution.mjs --integration FE:FEP-4`|预期exit1 / STAGE_NOT_READY|
|`node scripts/development-execution.mjs --integration FRONTEND-GATE:G4`|预期exit1 / STAGE_NOT_READY|
|`node scripts/development-execution.mjs --development FE:UI-603`|允许FE:UI-603开发|

1649项当前输入、14项当前产物与逐命令退出码/信号/时间/日志hash见 [receipt.json](./evidence/fep4-function-local-20261024/receipt.json)。只读consumer共37个请求，原source/binary hash、实际来源/账本/估值/核查原因及响应hash见 [read-consumer.json](./evidence/fep4-function-local-20261024/attempt-01/read-consumer.json)。应用/服务/共享组件/协议/锁文件/构建配置零变化，且工具拒绝未声明产品变更。

## 原证据保护与未重跑项

UI401/P18/UI402/P19/UI403/P21及G4共1,025个历史证据文件原字节不变，ORIGINAL_SCOPE_ONLY。G4原报告/manifest也校验文件hash及原提交绑定。G4应用54684067、工具3507c03a、封包5455613f的234单元/消费者、18C12、10C14、12Chromium及原packet工具失败仅按原SHA引用；没有将其改绑4ab3e9af。

Terminal build、浏览器/视觉/axe矩阵、Rust原生矩阵、完整X3/全仓/数据库campaign本轮 **NOT_REEXECUTED**，依据是产品/后端/协议/锁文件未变且旧binary hash一致。旧incomplete、失败和全部NOT_RUN不删除、不关闭。新的模型/只读consumer/类型/lint/门禁/计划实际绑定本轮源码。

preflight-01保留未冻结11项模型/21项组合预检，以及首次typecheck的TS2769诊断摘录（child env缺NODE_ENV）；明确补NODE_ENV=test后当前候选类型检查通过。预检GITHUB_SHA=5455613f仅标识启动环境，不能当作未提交变更已绑定该SHA。没有创建虚假receipt或把工具诊断改记为产品通过。

## 保留的里程碑风险

|范围|当前状态与关闭要求|
|---|---|
|UI402-MARKER-SOURCE-01|NOT_RUN_COMPOSED_SCOPE；真实C09同account/mode/venue/product/symbol spot来源阳性仍缺；Paper/mock和合成消费者不能替代|
|P19-C10-EXPORT-01|NOT_IMPLEMENTED_UNSUPPORTED_CONTRACT_SCOPE；先定义K线片段/图像的正式C12范围/格式/许可/审计契约，再实现受控导出；禁用不是完成|
|C12→C14估值join|NOT_CLAIMED；没有共同price snapshot就不制造市场价→账户收益因果；当前C14来源是C15|
|G4、核心/provider、页面确认|G4 IN_REVIEW/NOT_ASSESSED，全部原状态/原范围保留；本任务不自签/不授予READY|
|目标/RELEASE|真实IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部市场许可/现金流/成交、跨实例/重启恢复、远程同SHA CI、目标托管、性能/容量/长稳、Firefox/WebKit/跨OS、人工读屏/native200%、完整I7及发布均NOT_RUN|

当前只支持Shadow/USD/simple/UTC/JSON等已提供契约；TWR/基准/已实现拆分/其他归因/PDF/CSV、单标的告警阈值等缺源能力不补造。产品全范围仍PARTIAL；G4未决项不关闭，不通过“前端收口”自动获得正式里程碑完成。

## 变更文件（8项测试/工具/规程/计划）

- `apps/terminal/tests/fep4-closure.test.ts`
- `apps/terminal/tests/fep4-fixture.ts`
- `apps/terminal/tests/fep4-provider-consumer.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/operations/fep4-function-closure.md`
- `package.json`
- `scripts/fep4-function-review.mjs`
- `scripts/fep4-function-review.test.mjs`

另增加本报告和 `docs/audit/evidence/fep4-function-local-20261024/` 完整证据包。本地源码提交4ab3e9af，证据另行提交。下一原开发任务FE:UI-603，验证授权/去重/限速、ack只代表已读及离线禁写；G4缺口保留原责任任务跟踪。
